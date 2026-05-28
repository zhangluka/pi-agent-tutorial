# Demo 01 - Hello LLM

## 目标

实现第一个 LLM API 调用，理解请求/响应格式和流式输出。

## 核心知识点

- OpenAI Chat Completions API
- 消息格式（role: system/user/assistant）
- 流式响应（Streaming）
- 错误处理

## 项目结构

```
demo-01-hello-llm/
├── src/
│   └── index.ts
├── package.json
└── tsconfig.json
```

## 源码

```typescript
// src/index.ts
const API_KEY = process.env.OPENAI_API_KEY!
const MODEL = "gpt-4o-mini"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

// 非流式调用
async function chat(messages: ChatMessage[]): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`API 错误: ${error.error?.message || response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// 流式调用
async function* chatStream(messages: ChatMessage[]): AsyncGenerator<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, stream: true }),
  })

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue
      const json = JSON.parse(line.slice(6))
      const content = json.choices[0]?.delta?.content
      if (content) yield content
    }
  }
}

// 运行
async function main() {
  const messages: ChatMessage[] = [
    { role: "system", content: "你是一个有帮助的助手。" },
    { role: "user", content: "用三句话介绍 TypeScript" },
  ]

  console.log("=== 非流式调用 ===")
  const result = await chat(messages)
  console.log(result)

  console.log("\n=== 流式调用 ===")
  for await (const chunk of chatStream(messages)) {
    process.stdout.write(chunk)
  }
  console.log()
}

main().catch(console.error)
```

## 运行

```bash
cd demos/demo-01-hello-llm
npm install
OPENAI_API_KEY=sk-xxx npx tsx src/index.ts
```

## 输出示例

```
=== 非流式调用 ===
TypeScript 是 JavaScript 的超集，添加了静态类型系统，能在编译时捕获类型错误。
它由微软开发维护，广泛应用于大型项目开发。
TypeScript 编译后生成标准的 JavaScript 代码，可在任何支持 JS 的环境中运行。

=== 流式调用 ===
TypeScript 是 JavaScript 的超集，添加了静态类型系统，能在编译时捕获类型错误。
...
```

## 关键概念

### 消息格式

```typescript
interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}
```

- **system**：系统提示，设定 AI 的行为
- **user**：用户输入
- **assistant**：AI 的回复

### 流式响应

流式响应通过 Server-Sent Events (SSE) 实现：

```
data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" World"}}]}
data: [DONE]
```

## 小练习

1. 修改 system prompt，让 AI 用英文回答
2. 添加重试机制：遇到 429 错误时自动重试
3. 实现一个简单的多轮对话循环
