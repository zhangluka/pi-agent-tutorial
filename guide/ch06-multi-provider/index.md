# Ch06 多 Provider 支持

## 为什么需要多 Provider？

真实世界中，不同的 LLM 各有优势：

| Provider | 优势 | 劣势 |
|----------|------|------|
| OpenAI (GPT-4o) | 综合能力强，工具调用稳定 | 贵 |
| Anthropic (Claude) | 长上下文，代码理解好 | 有时过于谨慎 |
| Google (Gemini) | 便宜，速度快 | 工具调用偶尔不稳定 |
| DeepSeek | 极其便宜 | 能力略弱 |

Pi 的做法是：**用一套代码支持所有 Provider，中途可以无缝切换**。

## 统一 Provider 抽象

```typescript
// provider.ts

interface ProviderConfig {
  name: string
  apiType: "openai" | "anthropic" | "google"
  baseUrl: string
  apiKey: string
  models: ModelInfo[]
}

interface ModelInfo {
  id: string
  name: string
  contextWindow: number
  maxOutput: number
  supportsTools: boolean
  supportsStreaming: boolean
}

interface ChatRequest {
  model: string
  messages: Message[]
  tools?: ToolDefinition[]
  stream?: boolean
  temperature?: number
  maxTokens?: number
  system?: string
}

interface ChatResponse {
  content: string | null
  toolCalls: ToolCall[]
  usage: { input: number; output: number }
  stopReason: "tool_use" | "end_turn" | "max_tokens"
}

// 统一的 Provider 接口
interface Provider {
  config: ProviderConfig
  chat(request: ChatRequest): Promise<ChatResponse>
  chatStream(request: ChatRequest): AsyncGenerator<StreamEvent>
}
```

## OpenAI 适配器

```typescript
class OpenAIProvider implements Provider {
  constructor(public config: ProviderConfig) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: this.formatMessages(request),
        tools: request.tools?.map(this.formatTool),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false,
      }),
    })

    const data = await response.json()
    const choice = data.choices[0]

    return {
      content: choice.message.content,
      toolCalls: choice.message.tool_calls?.map(this.parseToolCall) || [],
      usage: { input: data.usage.prompt_tokens, output: data.usage.completion_tokens },
      stopReason: choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn",
    }
  }

  async *chatStream(request: ChatRequest): AsyncGenerator<StreamEvent> {
    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: this.formatMessages(request),
        tools: request.tools?.map(this.formatTool),
        stream: true,
      }),
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
        const delta = json.choices[0]?.delta

        if (delta?.content) {
          yield { type: "text", content: delta.content }
        }
        if (delta?.tool_calls) {
          yield { type: "tool_call", toolCalls: delta.tool_calls }
        }
      }
    }
  }

  // OpenAI 的消息格式（和我们的统一格式基本一致）
  private formatMessages(request: ChatRequest): any[] {
    const messages = []
    if (request.system) {
      messages.push({ role: "system", content: request.system })
    }
    for (const msg of request.messages) {
      messages.push({
        role: msg.role,
        content: msg.content,
        tool_calls: msg.toolCalls,
        tool_call_id: msg.toolCallId,
      })
    }
    return messages
  }

  private formatTool(tool: ToolDefinition) {
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }
    }
  }

  private parseToolCall(tc: any): ToolCall {
    return {
      id: tc.id,
      type: "function",
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      }
    }
  }
}
```

## Anthropic 适配器

Anthropic 的 API 格式和 OpenAI 有几个关键差异：

```typescript
class AnthropicProvider implements Provider {
  constructor(public config: ProviderConfig) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens || 4096,
        system: request.system,  // Anthropic 的 system 是顶级字段
        messages: this.formatMessages(request),
        tools: request.tools?.map(this.formatTool),
      }),
    })

    const data = await response.json()

    // Anthropic 的响应格式不同
    const textBlock = data.content.find((b: any) => b.type === "text")
    const toolBlocks = data.content.filter((b: any) => b.type === "tool_use")

    return {
      content: textBlock?.text || null,
      toolCalls: toolBlocks.map((b: any) => ({
        id: b.id,
        type: "function",
        function: {
          name: b.name,
          arguments: JSON.stringify(b.input),
        }
      })),
      usage: { input: data.usage.input_tokens, output: data.usage.output_tokens },
      stopReason: data.stop_reason === "tool_use" ? "tool_use" : "end_turn",
    }
  }

  private formatMessages(request: ChatRequest): any[] {
    // Anthropic 不支持 system 消息在 messages 数组中
    // 也不支持连续的同角色消息，需要合并
    const messages = []
    for (const msg of request.messages) {
      if (msg.role === "system") continue  // 跳过，system 单独传
      if (msg.role === "tool") {
        // Anthropic 用 tool_result 角色
        messages.push({
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: msg.toolCallId,
            content: msg.content,
          }]
        })
      } else {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
    return messages
  }

  private formatTool(tool: ToolDefinition) {
    // Anthropic 的工具格式：直接是 JSON Schema，没有 function 包装
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }
  }
}
```

::: warning Anthropic 的关键差异
1. `system` 是顶级字段，不在 messages 数组中
2. 工具结果用 `tool_result` 类型，放在 `user` 角色中
3. 工具定义用 `input_schema` 而不是 `parameters`
4. 不支持连续的同角色消息
:::

## Provider 注册表

```typescript
class ProviderRegistry {
  private providers = new Map<string, Provider>()

  register(provider: Provider) {
    this.providers.set(provider.config.name, provider)
  }

  get(name: string): Provider {
    const provider = this.providers.get(name)
    if (!provider) throw new Error(`未知的 Provider: ${name}`)
    return provider
  }

  // 根据模型名自动选择 Provider
  resolve(model: string): { provider: Provider; model: string } {
    // 格式: "provider/model" 或只是 "model"
    if (model.includes("/")) {
      const [providerName, ...rest] = model.split("/")
      return { provider: this.get(providerName), model: rest.join("/") }
    }

    // 自动匹配
    for (const provider of this.providers.values()) {
      const found = provider.config.models.find(m => m.id === model)
      if (found) return { provider, model }
    }

    throw new Error(`无法解析模型: ${model}`)
  }

  listModels(): ModelInfo[] {
    const models: ModelInfo[] = []
    for (const provider of this.providers.values()) {
      models.push(...provider.config.models)
    }
    return models
  }
}
```

使用方式：

```typescript
const registry = new ProviderRegistry()

registry.register(new OpenAIProvider({
  name: "openai",
  apiType: "openai",
  baseUrl: "https://api.openai.com",
  apiKey: process.env.OPENAI_API_KEY!,
  models: [
    { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, maxOutput: 16384, supportsTools: true, supportsStreaming: true },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", contextWindow: 128000, maxOutput: 16384, supportsTools: true, supportsStreaming: true },
  ]
}))

registry.register(new AnthropicProvider({
  name: "anthropic",
  apiType: "anthropic",
  baseUrl: "https://api.anthropic.com",
  apiKey: process.env.ANTHROPIC_API_KEY!,
  models: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet", contextWindow: 200000, maxOutput: 64000, supportsTools: true, supportsStreaming: true },
  ]
}))

// 使用
const { provider, model } = registry.resolve("openai/gpt-4o")
// 或
const { provider, model } = registry.resolve("gpt-4o")  // 自动匹配
```

## 中途切换模型

Pi 的一个特色功能是**中途切换模型**。在对话进行到一半时，你可以切换到另一个 Provider/模型，对话继续：

```typescript
class AgentSession {
  private currentProvider: Provider
  private currentModel: string

  setModel(model: string) {
    const { provider, model: resolvedModel } = this.providerRegistry.resolve(model)
    this.currentProvider = provider
    this.currentModel = resolvedModel
    console.log(`已切换到 ${provider.config.name}/${resolvedModel}`)
  }

  // Agent Loop 使用 this.currentProvider 和 this.currentModel
}
```

::: tip 上下文兼容性
切换模型时，对话历史保持不变。不同模型对历史消息的处理可能略有差异，但基本格式是兼容的。Pi 在切换时会做最佳努力的格式转换（比如在 Anthropic 和 OpenAI 的消息格式之间转换）。
:::

## 使用环境变量配置

```typescript
function loadProvidersFromEnv(): ProviderRegistry {
  const registry = new ProviderRegistry()

  if (process.env.OPENAI_API_KEY) {
    registry.register(new OpenAIProvider({
      name: "openai",
      apiType: "openai",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com",
      apiKey: process.env.OPENAI_API_KEY,
      models: [/* ... */],
    }))
  }

  if (process.env.ANTHROPIC_API_KEY) {
    registry.register(new AnthropicProvider({
      name: "anthropic",
      apiType: "anthropic",
      baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
      apiKey: process.env.ANTHROPIC_API_KEY,
      models: [/* ... */],
    }))
  }

  if (process.env.GOOGLE_API_KEY) {
    // Google Gemini...
  }

  return registry
}
```

## 小练习

::: details 练习 1：实现 Google Gemini 适配器
参考 OpenAI 和 Anthropic 适配器，实现 Google Gemini 的适配器。Gemini 的 API 端点和格式与前两者差异较大。

::: details 关键差异
- 端点：`https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent`
- 消息格式：`contents: [{ role: "user", parts: [{ text: "..." }] }]`
- 工具格式：`tools: [{ functionDeclarations: [...] }]`
- API Key 通过 URL 参数传递：`?key=xxx`
:::
:::

::: details 练习 2：实现 Provider 自动故障转移
当一个 Provider 调用失败时，自动切换到备用 Provider。比如 OpenAI 挂了，自动切到 Anthropic。

::: details 参考思路
```typescript
async function chatWithFallback(registry: ProviderRegistry, request: ChatRequest, fallbackOrder: string[]) {
  for (const providerName of fallbackOrder) {
    try {
      const provider = registry.get(providerName)
      return await provider.chat(request)
    } catch (err) {
      console.log(`${providerName} 失败: ${err.message}，尝试下一个...`)
      continue
    }
  }
  throw new Error("所有 Provider 都失败了")
}
```
:::
:::

## 下一章

多 Provider 搞定了。下一章，我们将实现会话与记忆系统——让 Agent 能记住之前的对话，并在上下文窗口不够时自动压缩历史。
