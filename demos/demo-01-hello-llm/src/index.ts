const API_KEY = process.env.OPENAI_API_KEY!
const MODEL = "gpt-4o-mini"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

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
