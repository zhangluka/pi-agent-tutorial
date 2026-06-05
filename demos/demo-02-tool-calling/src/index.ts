const API_KEY = process.env.OPENAI_API_KEY!

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: any[]
  tool_call_id?: string
}

const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "获取指定城市的天气信息",
      parameters: {
        type: "object",
        properties: { city: { type: "string", description: "城市名称" } },
        required: ["city"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description: "执行数学计算",
      parameters: {
        type: "object",
        properties: { expression: { type: "string", description: "数学表达式" } },
        required: ["expression"],
      },
    },
  },
]

function executeTool(name: string, args: Record<string, any>): string {
  switch (name) {
    case "get_weather":
      return JSON.stringify({
        city: args.city,
        temperature: Math.floor(Math.random() * 30) + 5,
        condition: ["晴", "多云", "小雨"][Math.floor(Math.random() * 3)],
      })
    case "calculate":
      // 注意：生产环境应使用安全的数学表达式解析器（如 mathjs 或 expr-eval）
      // 这里使用 eval() 是为了简化教学示例
      try { return JSON.stringify({ result: eval(args.expression) }) }
      catch { return JSON.stringify({ error: "计算错误" }) }
    default:
      return JSON.stringify({ error: `未知工具: ${name}` })
  }
}

async function chatWithTools(messages: ChatMessage[]): Promise<ChatMessage> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages, tools }),
  })
  const data = await response.json()
  return data.choices[0].message
}

async function agentLoop(userMessage: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: "你是一个有帮助的助手，可以查询天气和做计算。" },
    { role: "user", content: userMessage },
  ]

  while (true) {
    const response = await chatWithTools(messages)
    messages.push(response)

    if (response.tool_calls?.length > 0) {
      console.log(`\n[调用工具: ${response.tool_calls.map(tc => tc.function.name).join(", ")}]`)
      for (const toolCall of response.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments)
        console.log(`  → ${toolCall.function.name}(${JSON.stringify(args)})`)
        const result = executeTool(toolCall.function.name, args)
        console.log(`  ← ${result}`)
        messages.push({ role: "tool", content: result, tool_call_id: toolCall.id })
      }
    } else {
      return response.content || ""
    }
  }
}

async function main() {
  console.log("=== 测试 1: 查询天气 ===")
  console.log(`\n最终回答: ${await agentLoop("北京和上海今天天气怎么样？")}`)

  console.log("\n=== 测试 2: 数学计算 ===")
  console.log(`\n最终回答: ${await agentLoop("计算 (15 * 23) + 47 等于多少？")}`)
}

main().catch(console.error)
