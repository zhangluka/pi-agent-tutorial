import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"
import { dirname, resolve } from "path"
import { execSync } from "child_process"
import * as readline from "readline"

const API_KEY = process.env.OPENAI_API_KEY!

// === Agent Loop ===
interface Message {
  role: string
  content: string | null
  tool_calls?: any[]
  tool_call_id?: string
}

interface Tool {
  name: string
  description: string
  parameters: object
  execute: (args: Record<string, any>) => Promise<string>
}

type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool_start"; tool: string; args: string }
  | { type: "tool_result"; result: string }
  | { type: "turn_start"; turn: number }
  | { type: "done" }
  | { type: "error"; error: string }

type AgentEventListener = (event: AgentEvent) => void

function truncate(text: string, max = 50000): string {
  return text.length > max ? text.slice(0, max) + "\n... (截断)" : text
}

class AgentLoop {
  private tools = new Map<string, Tool>()
  private listeners: AgentEventListener[] = []
  private messages: Message[] = []

  constructor(private model: string) {
    this.registerBuiltinTools()
    this.messages.push({ role: "system", content: "你是一个编码助手，可以读写文件和执行命令。完成任务后直接总结，不要重复操作。" })
  }

  on(listener: AgentEventListener) { this.listeners.push(listener) }
  private emit(event: AgentEvent) { this.listeners.forEach(l => l(event)) }

  private registerBuiltinTools() {
    this.tools.set("read", {
      name: "read", description: "读取文件内容",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      execute: async (args) => {
        try { return truncate(readFileSync(resolve(args.path), "utf-8").split("\n").map((l, i) => `${i + 1}\t${l}`).join("\n")) }
        catch { return `错误：文件 ${args.path} 不存在` }
      },
    })
    this.tools.set("write", {
      name: "write", description: "写入文件",
      parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
      execute: async (args) => {
        const fp = resolve(args.path)
        mkdirSync(dirname(fp), { recursive: true })
        writeFileSync(fp, args.content, "utf-8")
        return `已写入 ${fp}（${args.content.split("\n").length} 行）`
      },
    })
    this.tools.set("edit", {
      name: "edit", description: "精确替换文件内容",
      parameters: { type: "object", properties: { path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } }, required: ["path", "old_string", "new_string"] },
      execute: async (args) => {
        const content = readFileSync(resolve(args.path), "utf-8")
        const count = content.split(args.old_string).length - 1
        if (count === 0) return "错误：未找到匹配文本"
        if (count > 1) return "警告：找到多处匹配，请提供更多上下文"
        writeFileSync(resolve(args.path), content.replace(args.old_string, args.new_string), "utf-8")
        return `已在 ${args.path} 中完成替换`
      },
    })
    this.tools.set("bash", {
      name: "bash", description: "执行 shell 命令",
      parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
      execute: async (args) => {
        try { return truncate(execSync(args.command, { encoding: "utf-8", timeout: 30000 }) || "(无输出)") }
        catch (err: any) { return `命令失败: ${err.stderr || err.message}` }
      },
    })
  }

  async run(userMessage: string): Promise<string> {
    this.messages.push({ role: "user", content: userMessage })
    for (let i = 0; i < 20; i++) {
      this.emit({ type: "turn_start", turn: i + 1 })
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: this.model, messages: this.messages,
          tools: Array.from(this.tools.values()).map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })),
        }),
      }).then(r => r.json()).then(d => d.choices[0].message)
      this.messages.push(response)
      if (response.content) this.emit({ type: "text", content: response.content })
      if (response.tool_calls?.length > 0) {
        for (const tc of response.tool_calls) {
          const tool = this.tools.get(tc.function.name)
          if (!tool) continue
          const args = JSON.parse(tc.function.arguments)
          this.emit({ type: "tool_start", tool: tc.function.name, args: JSON.stringify(args) })
          const result = await tool.execute(args)
          this.emit({ type: "tool_result", result })
          this.messages.push({ role: "tool", content: result, tool_call_id: tc.id })
        }
      } else {
        this.emit({ type: "done" })
        return response.content || ""
      }
    }
    return "达到最大迭代次数"
  }

  setModel(model: string) { this.model = model }
  clearHistory() { this.messages = this.messages.filter(m => m.role === "system") }
}

// === TUI ===
class SimpleTUI {
  private rl: readline.Interface
  private isStreaming = false
  constructor() { this.rl = readline.createInterface({ input: process.stdin, output: process.stdout }) }
  onInput(listener: (input: string) => void) {
    this.rl.on("line", (line) => {
      const trimmed = line.trim()
      if (!trimmed) return
      if (trimmed.startsWith("/")) {
        const [cmd, ...rest] = trimmed.slice(1).split(" ")
        this.handleCommand(cmd, rest.join(" "))
        return
      }
      listener(trimmed)
    })
  }
  private handleCommand(_cmd: string, _args: string) {}
  writeStream(text: string) {
    if (!this.isStreaming) { process.stdout.write("\nAgent: "); this.isStreaming = true }
    process.stdout.write(text)
  }
  endStream() { if (this.isStreaming) { process.stdout.write("\n"); this.isStreaming = false } }
  showToolCall(tool: string, args: string) { console.log(`\n  🔧 ${tool}(${args.slice(0, 80)})`) }
  showToolResult(result: string) { console.log(`  ← ${result.slice(0, 150)}${result.length > 150 ? "..." : ""}`) }
  showStatus(turn: number) { console.log(`\x1b[90m[Turn ${turn}]\x1b[0m`) }
}

// === Main ===
async function main() {
  const agent = new AgentLoop("gpt-4o-mini")
  const tui = new SimpleTUI()

  agent.on((event) => {
    switch (event.type) {
      case "text": tui.writeStream(event.content); break
      case "tool_start": tui.showToolCall(event.tool, event.args); break
      case "tool_result": tui.showToolResult(event.result); break
      case "turn_start": tui.showStatus(event.turn); break
      case "done": tui.endStream(); break
      case "error": console.error(`\n❌ ${event.error}`); break
    }
  })

  console.log("\n🤖 Mini Agent 教学版")
  console.log("输入消息开始对话，Ctrl+C 退出\n")

  tui.onInput(async (input) => {
    try { await agent.run(input) } catch (err: any) { console.error(`\n❌ ${err.message}`) }
    tui.endStream()
  })
}

main().catch(console.error)
