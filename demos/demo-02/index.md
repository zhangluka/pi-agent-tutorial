# Demo 02 - Tool Calling

## 目标

理解 Function Calling 机制，让 LLM 能够请求调用函数。

## 核心知识点

- 工具定义（JSON Schema）
- LLM 的 tool_calls 响应
- 工具执行和结果返回
- 多轮工具调用

## 源码

```typescript
// src/index.ts
const API_KEY = process.env.OPENAI_API_KEY!

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: any[]
  tool_call_id?: string
}

// 工具定义
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "获取指定城市的天气信息",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "城市名称" },
        },
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
        properties: {
          expression: { type: "string", description: "数学表达式" },
        },
        required: ["expression"],
      },
    },
  },
]

// 工具实现
function executeTool(name: string, args: Record<string, any>): string {
  switch (name) {
    case "get_weather":
      return JSON.stringify({
        city: args.city,
        temperature: Math.floor(Math.random() * 30) + 5,
        condition: ["晴", "多云", "小雨"][Math.floor(Math.random() * 3)],
      })
    case "calculate":
      try {
        const result = eval(args.expression)
        return JSON.stringify({ result })
      } catch {
        return JSON.stringify({ error: "计算错误" })
      }
    default:
      return JSON.stringify({ error: `未知工具: ${name}` })
  }
}

// 带工具的 LLM 调用
async function chatWithTools(messages: ChatMessage[]): Promise<ChatMessage> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      tools,
    }),
  })

  const data = await response.json()
  return data.choices[0].message
}

// Agent Loop（简化版）
async function agentLoop(userMessage: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: "你是一个有帮助的助手，可以查询天气和做计算。" },
    { role: "user", content: userMessage },
  ]

  while (true) {
    const response = await chatWithTools(messages)
    messages.push(response)

    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`\n[调用工具: ${response.tool_calls.map(tc => tc.function.name).join(", ")}]`)

      for (const toolCall of response.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments)
        console.log(`  → ${toolCall.function.name}(${JSON.stringify(args)})`)

        const result = executeTool(toolCall.function.name, args)
        console.log(`  ← ${result}`)

        messages.push({
          role: "tool",
          content: result,
          tool_call_id: toolCall.id,
        })
      }
    } else {
      return response.content || ""
    }
  }
}

// 运行
async function main() {
  console.log("=== 测试 1: 查询天气 ===")
  const result1 = await agentLoop("北京和上海今天天气怎么样？")
  console.log(`\n最终回答: ${result1}`)

  console.log("\n=== 测试 2: 数学计算 ===")
  const result2 = await agentLoop("计算 (15 * 23) + 47 等于多少？")
  console.log(`\n最终回答: ${result2}`)
}

main().catch(console.error)
```

## 运行

```bash
cd demos/demo-02-tool-calling
npm install
OPENAI_API_KEY=sk-xxx npx tsx src/index.ts
```

## 输出示例

```
=== 测试 1: 查询天气 ===

[调用工具: get_weather]
  → get_weather({"city":"北京"})
  ← {"city":"北京","temperature":22,"condition":"多云"}
  → get_weather({"city":"上海"})
  ← {"city":"上海","temperature":25,"condition":"晴"}

最终回答: 北京今天22°C，多云；上海今天25°C，晴天。

=== 测试 2: 数学计算 ===

[调用工具: calculate]
  → calculate({"expression":"(15 * 23) + 47"})
  ← {"result":392}

最终回答: (15 * 23) + 47 = 392
```

## 关键概念

### 工具定义格式

```json
{
  "type": "function",
  "function": {
    "name": "tool_name",
    "description": "工具描述",
    "parameters": {
      "type": "object",
      "properties": { ... },
      "required": [...]
    }
  }
}
```

### LLM 的 tool_calls 响应

当 LLM 决定调用工具时，返回：

```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"city\":\"北京\"}"
      }
    }
  ]
}
```

### 工具结果格式

```json
{
  "role": "tool",
  "content": "{\"city\":\"北京\",\"temperature\":22}",
  "tool_call_id": "call_abc123"
}
```

## 小练习

1. 添加一个 `search` 工具，模拟搜索功能
2. 让 LLM 在一次响应中调用多个工具
3. 添加错误处理：工具执行失败时返回错误信息
