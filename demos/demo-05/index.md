# Demo 05 - Multi Provider

## 目标

实现多 Provider 统一抽象，支持 OpenAI 和 Anthropic。

## 核心知识点

- Provider 接口设计
- OpenAI / Anthropic API 差异
- 自动 Provider 解析
- 中途切换模型

## 源码

```typescript
// src/providers.ts
const OPENAI_KEY = process.env.OPENAI_API_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

interface Message {
  role: string
  content: string | null
  tool_calls?: any[]
  tool_call_id?: string
}

interface ChatRequest {
  model: string
  messages: Message[]
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

// OpenAI 适配器
class OpenAIProvider implements Provider {
  name = "openai"

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages = []
    if (request.system) messages.push({ role: "system", content: request.system })
    messages.push(...request.messages)

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages,
        tools: request.tools,
      }),
    })

    const data = await response.json()
    const choice = data.choices[0]

    return {
      content: choice.message.content,
      toolCalls: choice.message.tool_calls || [],
      usage: { input: data.usage?.prompt_tokens || 0, output: data.usage?.completion_tokens || 0 },
    }
  }

  listModels(): string[] {
    return ["gpt-4o", "gpt-4o-mini"]
  }
}

// Anthropic 适配器
class AnthropicProvider implements Provider {
  name = "anthropic"

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages = request.messages
      .filter(m => m.role !== "system")
      .map(m => {
        if (m.role === "tool") {
          return { role: "user", content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content }] }
        }
        return { role: m.role, content: m.content }
      })

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: 4096,
        system: request.system,
        messages,
        tools: request.tools?.map(t => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters,
        })),
      }),
    })

    const data = await response.json()
    const textBlock = data.content?.find((b: any) => b.type === "text")
    const toolBlocks = data.content?.filter((b: any) => b.type === "tool_use") || []

    return {
      content: textBlock?.text || null,
      toolCalls: toolBlocks.map((b: any) => ({
        id: b.id,
        function: { name: b.name, arguments: JSON.stringify(b.input) },
      })),
      usage: { input: data.usage?.input_tokens || 0, output: data.usage?.output_tokens || 0 },
    }
  }

  listModels(): string[] {
    return ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"]
  }
}

// Provider 注册表
class ProviderRegistry {
  private providers = new Map<string, Provider>()

  register(provider: Provider) {
    this.providers.set(provider.name, provider)
  }

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

// 使用示例
async function main() {
  const registry = new ProviderRegistry()
  if (OPENAI_KEY) registry.register(new OpenAIProvider())
  if (ANTHROPIC_KEY) registry.register(new AnthropicProvider())

  // 测试 OpenAI
  if (OPENAI_KEY) {
    const { provider, model } = registry.resolve("openai/gpt-4o-mini")
    const result = await provider.chat({
      model,
      messages: [{ role: "user", content: "用一句话介绍自己" }],
    })
    console.log(`[OpenAI] ${result.content}`)
    console.log(`Token 用量: ${result.usage.input} + ${result.usage.output}`)
  }

  // 测试 Anthropic
  if (ANTHROPIC_KEY) {
    const { provider, model } = registry.resolve("anthropic/claude-sonnet-4-20250514")
    const result = await provider.chat({
      model,
      system: "你是一个有帮助的助手。",
      messages: [{ role: "user", content: "用一句话介绍自己" }],
    })
    console.log(`[Anthropic] ${result.content}`)
    console.log(`Token 用量: ${result.usage.input} + ${result.usage.output}`)
  }
}

main().catch(console.error)
```

## 运行

```bash
cd demos/demo-05-multi-provider
npm install
OPENAI_API_KEY=sk-xxx ANTHROPIC_API_KEY=sk-ant-xxx npx tsx src/index.ts
```

## 关键差异对比

| 特性 | OpenAI | Anthropic |
|------|--------|-----------|
| 系统提示 | messages 数组中 | 单独的 system 字段 |
| 工具结果 | role: "tool" | role: "user" + tool_result |
| 工具定义 | function 包装 | 直接 input_schema |
| Token 字段 | prompt_tokens | input_tokens |

## 小练习

1. 实现 Google Gemini 适配器
2. 添加 Provider 自动故障转移
3. 实现流式响应的统一抽象
