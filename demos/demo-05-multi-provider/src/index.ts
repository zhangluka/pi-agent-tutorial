const OPENAI_KEY = process.env.OPENAI_API_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

interface ChatRequest {
  model: string
  messages: any[]
  tools?: any[]
  system?: string
}

interface ChatResponse {
  content: string | null
  toolCalls: any[]
  usage: { input: number; output: number }
}

interface Provider {
  name: string
  chat(request: ChatRequest): Promise<ChatResponse>
  listModels(): string[]
}

class OpenAIProvider implements Provider {
  name = "openai"
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages = []
    if (request.system) messages.push({ role: "system", content: request.system })
    messages.push(...request.messages)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: request.model, messages, tools: request.tools }),
    })
    const data = await response.json()
    const choice = data.choices[0].message
    return {
      content: choice.content,
      toolCalls: choice.tool_calls || [],
      usage: { input: data.usage?.prompt_tokens || 0, output: data.usage?.completion_tokens || 0 },
    }
  }
  listModels() { return ["gpt-4o", "gpt-4o-mini"] }
}

class AnthropicProvider implements Provider {
  name = "anthropic"
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages = request.messages.filter((m: any) => m.role !== "system").map((m: any) => {
      if (m.role === "tool") return { role: "user", content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content }] }
      return { role: m.role, content: m.content }
    })
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: request.model, max_tokens: 4096, system: request.system, messages,
        tools: request.tools?.map((t: any) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters })),
      }),
    })
    const data = await response.json()
    const textBlock = data.content?.find((b: any) => b.type === "text")
    const toolBlocks = data.content?.filter((b: any) => b.type === "tool_use") || []
    return {
      content: textBlock?.text || null,
      toolCalls: toolBlocks.map((b: any) => ({ id: b.id, function: { name: b.name, arguments: JSON.stringify(b.input) } })),
      usage: { input: data.usage?.input_tokens || 0, output: data.usage?.output_tokens || 0 },
    }
  }
  listModels() { return ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"] }
}

class ProviderRegistry {
  private providers = new Map<string, Provider>()
  register(provider: Provider) { this.providers.set(provider.name, provider) }
  resolve(model: string): { provider: Provider; model: string } {
    if (model.includes("/")) {
      const [name, ...rest] = model.split("/")
      return { provider: this.providers.get(name)!, model: rest.join("/") }
    }
    for (const provider of this.providers.values()) {
      if (provider.listModels().includes(model)) return { provider, model }
    }
    throw new Error(`无法解析模型: ${model}`)
  }
}

async function main() {
  const registry = new ProviderRegistry()
  if (OPENAI_KEY) registry.register(new OpenAIProvider())
  if (ANTHROPIC_KEY) registry.register(new AnthropicProvider())

  if (OPENAI_KEY) {
    const { provider, model } = registry.resolve("openai/gpt-4o-mini")
    const result = await provider.chat({ model, messages: [{ role: "user", content: "用一句话介绍自己" }] })
    console.log(`[OpenAI] ${result.content}`)
    console.log(`Token: ${result.usage.input} + ${result.usage.output}`)
  }

  if (ANTHROPIC_KEY) {
    const { provider, model } = registry.resolve("anthropic/claude-sonnet-4-20250514")
    const result = await provider.chat({ model, system: "你是一个有帮助的助手。", messages: [{ role: "user", content: "用一句话介绍自己" }] })
    console.log(`[Anthropic] ${result.content}`)
    console.log(`Token: ${result.usage.input} + ${result.usage.output}`)
  }
}

main().catch(console.error)
