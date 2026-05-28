# Demo 08 - Mini Agent (完整版)

## 目标

将前面所有模块组装成一个完整可运行的 Mini Agent。

## 核心知识点

- 模块化组装
- 事件驱动架构
- TUI 交互
- 完整的 Agent 生命周期

## 项目结构

```
demo-08-mini-agent/
├── src/
│   ├── agent.ts          # Agent Loop + 工具注册
│   ├── providers.ts      # 多 Provider 支持
│   ├── session.ts        # 会话管理
│   ├── skills.ts         # Skill 系统
│   ├── tui.ts            # 终端 UI
│   └── index.ts          # 入口 + 组装
├── package.json
└── tsconfig.json
```

## 核心源码

### src/agent.ts - Agent Loop

```typescript
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"
import { dirname, resolve } from "path"
import { execSync } from "child_process"

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

export class AgentLoop {
  private tools = new Map<string, Tool>()
  private listeners: AgentEventListener[] = []
  private messages: Message[] = []
  private maxIterations = 20

  constructor(
    private provider: any,
    private model: string,
    private systemPrompt: string,
  ) {
    this.registerBuiltinTools()
    this.messages.push({ role: "system", content: systemPrompt })
  }

  on(listener: AgentEventListener) {
    this.listeners.push(listener)
  }

  private emit(event: AgentEvent) {
    this.listeners.forEach(l => l(event))
  }

  private registerBuiltinTools() {
    // read
    this.tools.set("read", {
      name: "read",
      description: "读取文件内容",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      execute: async (args) => {
        try {
          const content = readFileSync(resolve(args.path), "utf-8")
          return truncate(content.split("\n").map((l, i) => `${i + 1}\t${l}`).join("\n"))
        } catch { return `错误：文件 ${args.path} 不存在` }
      },
    })

    // write
    this.tools.set("write", {
      name: "write",
      description: "写入文件",
      parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
      execute: async (args) => {
        const filePath = resolve(args.path)
        mkdirSync(dirname(filePath), { recursive: true })
        writeFileSync(filePath, args.content, "utf-8")
        return `已写入 ${filePath}（${args.content.split("\n").length} 行）`
      },
    })

    // edit
    this.tools.set("edit", {
      name: "edit",
      description: "精确替换文件内容",
      parameters: { type: "object", properties: { path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } }, required: ["path", "old_string", "new_string"] },
      execute: async (args) => {
        const filePath = resolve(args.path)
        const content = readFileSync(filePath, "utf-8")
        const count = content.split(args.old_string).length - 1
        if (count === 0) return "错误：未找到匹配文本"
        if (count > 1) return "警告：找到多处匹配，请提供更多上下文"
        writeFileSync(filePath, content.replace(args.old_string, args.new_string), "utf-8")
        return `已在 ${filePath} 中完成替换`
      },
    })

    // bash
    this.tools.set("bash", {
      name: "bash",
      description: "执行 shell 命令",
      parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
      execute: async (args) => {
        try {
          return truncate(execSync(args.command, { encoding: "utf-8", timeout: 30000 }) || "(无输出)")
        } catch (err: any) { return `命令失败: ${err.stderr || err.message}` }
      },
    })
  }

  async run(userMessage: string): Promise<string> {
    this.messages.push({ role: "user", content: userMessage })

    for (let i = 0; i < this.maxIterations; i++) {
      this.emit({ type: "turn_start", turn: i + 1 })

      const response = await this.provider.chat({
        model: this.model,
        messages: this.messages,
        tools: Array.from(this.tools.values()).map(t => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
      })

      this.messages.push({
        role: "assistant",
        content: response.content,
        tool_calls: response.toolCalls,
      })

      if (response.content) {
        this.emit({ type: "text", content: response.content })
      }

      if (response.toolCalls?.length > 0) {
        for (const tc of response.toolCalls) {
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

  setModel(model: string) {
    this.model = model
  }

  clearHistory() {
    this.messages = this.messages.filter(m => m.role === "system")
  }
}
```

### src/tui.ts - 终端 UI

```typescript
import * as readline from "readline"

type TUIEventListener = (input: string) => void

export class SimpleTUI {
  private rl: readline.Interface
  private isStreaming = false
  private inputListener: TUIEventListener | null = null
  private commandListener: ((cmd: string, args: string) => void) | null = null

  constructor() {
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  }

  onInput(listener: TUIEventListener) { this.inputListener = listener }
  onCommand(listener: (cmd: string, args: string) => void) { this.commandListener = listener }

  start() {
    console.log("\n🤖 Mini Agent 教学版")
    console.log("输入消息开始对话，/help 查看命令，/quit 退出\n")
    this.prompt()
  }

  private prompt() {
    this.rl.question("You: ", (input) => {
      const trimmed = input.trim()
      if (!trimmed) return this.prompt()
      if (trimmed.startsWith("/")) {
        const [cmd, ...rest] = trimmed.slice(1).split(" ")
        this.commandListener?.(cmd, rest.join(" "))
        return this.prompt()
      }
      this.inputListener?.(trimmed)
    })
  }

  writeStream(text: string) {
    if (!this.isStreaming) {
      process.stdout.write("\nAgent: ")
      this.isStreaming = true
    }
    process.stdout.write(text)
  }

  endStream() {
    if (this.isStreaming) {
      process.stdout.write("\n")
      this.isStreaming = false
    }
  }

  showToolCall(tool: string, args: string) {
    console.log(`\n  🔧 ${tool}(${args.slice(0, 80)}${args.length > 80 ? "..." : ""})`)
  }

  showToolResult(result: string) {
    console.log(`  ← ${result.slice(0, 150)}${result.length > 150 ? "..." : ""}`)
  }

  showStatus(turn: number, model: string) {
    console.log(`\x1b[90m[Turn ${turn} | ${model}]\x1b[0m`)
  }

  resume() { this.prompt() }
  close() { this.rl.close() }
}
```

### src/index.ts - 入口组装

```typescript
import { AgentLoop } from "./agent"
import { SimpleTUI } from "./tui"

const API_KEY = process.env.OPENAI_API_KEY!

// 简化的 OpenAI Provider
const provider = {
  async chat(request: any) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: request.model, messages: request.messages, tools: request.tools }),
    })
    const data = await response.json()
    const choice = data.choices[0].message
    return { content: choice.content, toolCalls: choice.tool_calls || [] }
  },
}

async function main() {
  const agent = new AgentLoop(provider, "gpt-4o-mini", "你是一个编码助手，可以读写文件和执行命令。")
  const tui = new SimpleTUI()

  // 连接 Agent 事件到 TUI
  agent.on((event) => {
    switch (event.type) {
      case "text": tui.writeStream(event.content); break
      case "tool_start": tui.showToolCall(event.tool, event.args); break
      case "tool_result": tui.showToolResult(event.result); break
      case "turn_start": tui.showStatus(event.turn, "gpt-4o-mini"); break
      case "done": tui.endStream(); break
      case "error": console.error(`\n❌ ${event.error}`); break
    }
  })

  // 处理用户输入
  tui.onInput(async (input) => {
    try { await agent.run(input) } catch (err: any) { console.error(`\n❌ ${err.message}`) }
    tui.endStream()
    tui.resume()
  })

  // 处理命令
  tui.onCommand((cmd, args) => {
    switch (cmd) {
      case "help":
        console.log("\n/help   - 显示帮助\n/model  - 切换模型\n/clear  - 清空历史\n/quit   - 退出\n")
        break
      case "model":
        agent.setModel(args)
        console.log(`已切换到: ${args}`)
        break
      case "clear":
        agent.clearHistory()
        console.log("已清空对话历史")
        break
      case "quit":
        process.exit(0)
    }
  })

  tui.start()
}

main().catch(console.error)
```

## 运行

```bash
cd demos/demo-08-mini-agent
npm install
OPENAI_API_KEY=sk-xxx npx tsx src/index.ts
```

## 测试场景

```bash
# 1. 基本对话
You: 你好，帮我看看当前目录有什么文件

# 2. 文件操作
You: 创建一个 hello.txt，内容是 "Hello World"，然后读取确认

# 3. 代码修改
You: 把 hello.txt 里的 "Hello" 改成 "Hi"

# 4. 命令执行
You: 运行 cat hello.txt 看看内容

# 5. 复杂任务
You: 创建一个 src/main.ts 文件，写一个简单的 HTTP 服务器，然后用 node 运行测试
```

## 与 Pi 的对比

| 方面 | Mini Agent | Pi |
|------|-----------|-----|
| 代码量 | ~300 行 | ~50,000 行 |
| Provider | 1 个 | 15+ |
| 扩展系统 | 无 | 完整生命周期钩子 |
| TUI | 基础 ANSI | 差分渲染 + 组件 |
| 会话 | 内存 | JSONL 树状 |
| Skill | 无 | agentskills.io 标准 |

::: tip 核心思想
虽然实现细节有差异，但核心思想完全一致：**循环调用 LLM，执行工具，把结果喂回去，直到 LLM 说"我做完了"**。
:::

## 小练习

1. 添加会话持久化（集成 demo-06 的 SessionManager）
2. 添加 Skill 支持（集成 demo-07 的 SkillManager）
3. 添加流式输出
4. 添加多 Provider 支持
