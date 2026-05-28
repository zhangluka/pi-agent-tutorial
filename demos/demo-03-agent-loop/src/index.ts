import { readFileSync, existsSync } from "fs"
import { execSync } from "child_process"

const API_KEY = process.env.OPENAI_API_KEY!

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

const toolRegistry = new Map<string, Tool>()

function registerTool(tool: Tool) {
  toolRegistry.set(tool.name, tool)
}

registerTool({
  name: "read",
  description: "读取文件内容",
  parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  execute: async (args) => {
    try {
      const content = readFileSync(args.path, "utf-8")
      return content.split("\n").map((l, i) => `${i + 1}\t${l}`).join("\n")
    } catch { return `错误：文件 ${args.path} 不存在` }
  },
})

registerTool({
  name: "bash",
  description: "执行 shell 命令",
  parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
  execute: async (args) => {
    try { return execSync(args.command, { encoding: "utf-8", timeout: 10000 }) || "(无输出)" }
    catch (err: any) { return `命令失败: ${err.stderr || err.message}` }
  },
})

async function callLLM(messages: Message[]): Promise<Message> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      tools: Array.from(toolRegistry.values()).map(t => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
    }),
  })
  const data = await response.json()
  return data.choices[0].message
}

async function executeTool(toolCall: any): Promise<string> {
  const tool = toolRegistry.get(toolCall.function.name)
  if (!tool) return `错误：未知工具 ${toolCall.function.name}`
  try {
    return await tool.execute(JSON.parse(toolCall.function.arguments))
  } catch (err: any) { return `工具执行错误: ${err.message}` }
}

async function agentLoop(userMessage: string): Promise<string> {
  const messages: Message[] = [
    { role: "system", content: "你是一个编码助手，可以读取文件和执行命令。" },
    { role: "user", content: userMessage },
  ]

  for (let i = 0; i < 20; i++) {
    console.log(`\n--- 第 ${i + 1} 轮 ---`)
    const response = await callLLM(messages)
    messages.push(response)

    if (response.tool_calls?.length > 0) {
      for (const tc of response.tool_calls) {
        console.log(`  → ${tc.function.name}(${tc.function.arguments})`)
        const result = await executeTool(tc)
        console.log(`  ← ${result.slice(0, 100)}${result.length > 100 ? "..." : ""}`)
        messages.push({ role: "tool", content: result, tool_call_id: tc.id })
      }
    } else {
      console.log("\nAgent 完成任务")
      return response.content || ""
    }
  }
  return "达到最大迭代次数"
}

async function main() {
  const result = await agentLoop("当前目录有哪些文件？读一下 package.json 看看项目信息。")
  console.log(`\n最终回答:\n${result}`)
}

main().catch(console.error)
