import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { dirname, resolve } from "path"
import { execSync } from "child_process"

const API_KEY = process.env.OPENAI_API_KEY!

interface Tool {
  name: string
  description: string
  parameters: object
  execute: (args: Record<string, any>) => Promise<string>
}

function truncate(text: string, max = 50000): string {
  return text.length > max ? text.slice(0, max) + "\n... (截断)" : text
}

const tools: Tool[] = [
  {
    name: "read",
    description: "读取文件内容，返回带行号的内容",
    parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    execute: async (args) => {
      try {
        const content = readFileSync(resolve(args.path), "utf-8")
        return truncate(content.split("\n").map((l, i) => `${i + 1}\t${l}`).join("\n"))
      } catch { return `错误：文件 ${args.path} 不存在` }
    },
  },
  {
    name: "write",
    description: "写入文件，自动创建父目录",
    parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
    execute: async (args) => {
      const filePath = resolve(args.path)
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, args.content, "utf-8")
      return `已写入 ${filePath}（${args.content.split("\n").length} 行）`
    },
  },
  {
    name: "edit",
    description: "精确替换文件中的文本",
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
  },
  {
    name: "bash",
    description: "执行 shell 命令",
    parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
    execute: async (args) => {
      try { return truncate(execSync(args.command, { encoding: "utf-8", timeout: 30000 }) || "(无输出)") }
      catch (err: any) { return `命令失败: ${err.stderr || err.message}` }
    },
  },
]

async function agentLoop(userMessage: string): Promise<string> {
  const messages: any[] = [
    { role: "system", content: "你是一个编码助手，可以读写文件和执行命令。" },
    { role: "user", content: userMessage },
  ]

  for (let i = 0; i < 20; i++) {
    console.log(`\n--- 第 ${i + 1} 轮 ---`)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        tools: tools.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })),
      }),
    }).then(r => r.json()).then(d => d.choices[0].message)

    messages.push(response)

    if (response.tool_calls?.length > 0) {
      for (const tc of response.tool_calls) {
        const tool = tools.find(t => t.name === tc.function.name)!
        const args = JSON.parse(tc.function.arguments)
        console.log(`  → ${tc.function.name}(${JSON.stringify(args).slice(0, 80)})`)
        const result = await tool.execute(args)
        console.log(`  ← ${result.slice(0, 100)}`)
        messages.push({ role: "tool", content: result, tool_call_id: tc.id })
      }
    } else {
      return response.content || ""
    }
  }
  return "达到最大迭代次数"
}

async function main() {
  const result = await agentLoop("创建一个 hello.txt 文件，内容是 Hello World，然后读取确认内容正确。")
  console.log(`\n最终回答:\n${result}`)
}

main().catch(console.error)
