# Demo 03 - Agent Loop

## 目标

实现完整的 Agent Loop，支持真实的文件系统操作。

## 核心知识点

- 完整的 ReAct 循环
- 真实的工具实现（read、bash）
- 工具注册系统
- 迭代次数限制

## 源码

```typescript
// src/index.ts
import { readFileSync, existsSync } from "fs"
import { execSync } from "child_process"

const API_KEY = process.env.OPENAI_API_KEY!

interface Message {
  role: "system" | "user" | "assistant" | "tool"
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

// 工具注册表
const toolRegistry = new Map<string, Tool>()

function registerTool(tool: Tool) {
  toolRegistry.set(tool.name, tool)
}

// 注册工具
registerTool({
  name: "read",
  description: "读取文件内容",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "文件路径" },
    },
    required: ["path"],
  },
  execute: async (args) => {
    try {
      const content = readFileSync(args.path, "utf-8")
      const lines = content.split("\n")
      return lines.map((line, i) => `${i + 1}\t${line}`).join("\n")
    } catch {
      return `错误：文件 ${args.path} 不存在`
    }
  },
})

registerTool({
  name: "bash",
  description: "执行 shell 命令",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "要执行的命令" },
    },
    required: ["command"],
  },
  execute: async (args) => {
    try {
      return execSync(args.command, { encoding: "utf-8", timeout: 10000 })
    } catch (err: any) {
      return `命令失败: ${err.stderr || err.message}`
    }
  },
})

// 调用 LLM
async function callLLM(messages: Message[]): Promise<Message> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      tools: Array.from(toolRegistry.values()).map(tool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
    }),
  })

  const data = await response.json()
  return data.choices[0].message
}

// 执行工具
async function executeTool(toolCall: any): Promise<string> {
  const tool = toolRegistry.get(toolCall.function.name)
  if (!tool) return `错误：未知工具 ${toolCall.function.name}`

  try {
    const args = JSON.parse(toolCall.function.arguments)
    return await tool.execute(args)
  } catch (err: any) {
    return `工具执行错误: ${err.message}`
  }
}

// Agent Loop
async function agentLoop(userMessage: string): Promise<string> {
  const messages: Message[] = [
    { role: "system", content: "你是一个编码助手，可以读取文件和执行命令。" },
    { role: "user", content: userMessage },
  ]

  const MAX_ITERATIONS = 20

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`\n--- 第 ${i + 1} 轮 ---`)

    const response = await callLLM(messages)
    messages.push(response)

    if (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        console.log(`  → ${toolCall.function.name}(${toolCall.function.arguments})`)
        const result = await executeTool(toolCall)
        console.log(`  ← ${result.slice(0, 100)}${result.length > 100 ? "..." : ""}`)

        messages.push({
          role: "tool",
          content: result,
          tool_call_id: toolCall.id,
        })
      }
    } else {
      console.log("\nAgent 完成任务")
      return response.content || ""
    }
  }

  return "达到最大迭代次数"
}

// 运行
async function main() {
  const result = await agentLoop("当前目录有哪些文件？读一下 package.json 看看项目信息。")
  console.log(`\n最终回答:\n${result}`)
}

main().catch(console.error)
```

## 运行

```bash
cd demos/demo-03-agent-loop
npm install
OPENAI_API_KEY=sk-xxx npx tsx src/index.ts
```

## 输出示例

```
--- 第 1 轮 ---
  → bash({"command":"ls -la"})
  ← total 24\ndrwxr-xr-x  4 user  staff  128 May 28 10:00 .\n...
  → read({"path":"package.json"})
  ← 1\t{\n2\t  "name": "demo-03",...

--- 第 2 轮 ---
Agent 完成任务

最终回答:
当前目录下有以下文件：
- package.json
- src/index.ts
- node_modules/
- tsconfig.json

项目信息：
- 名称：demo-03
- 版本：1.0.0
```

## 小练习

1. 添加 `write` 工具
2. 实现流式输出
3. 添加工具执行超时处理
