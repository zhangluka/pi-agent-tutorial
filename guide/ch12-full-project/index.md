# Ch12 完整项目组装

## 从模块到产品

前面 11 章，我们分别实现了 Agent 的各个模块。这一章，我们把它们组装成一个完整可运行的 Mini Agent。

## 项目结构

```
mini-agent/
├── src/
│   ├── core/
│   │   ├── agent-loop.ts      # Agent 核心循环
│   │   ├── message.ts         # 消息类型定义
│   │   └── session.ts         # 会话管理
│   ├── providers/
│   │   ├── base.ts            # Provider 接口
│   │   ├── openai.ts          # OpenAI 适配器
│   │   ├── anthropic.ts       # Anthropic 适配器
│   │   └── registry.ts        # Provider 注册表
│   ├── tools/
│   │   ├── index.ts           # 工具注册
│   │   ├── read.ts            # read 工具
│   │   ├── write.ts           # write 工具
│   │   ├── edit.ts            # edit 工具
│   │   └── bash.ts            # bash 工具
│   ├── extensions/
│   │   ├── system.ts          # 扩展系统核心
│   │   └── built-in.ts        # 内置扩展
│   ├── skills/
│   │   └── manager.ts         # Skill 管理器
│   ├── context/
│   │   └── manager.ts         # 上下文管理器
│   ├── compaction/
│   │   └── manager.ts         # 压缩管理器
│   ├── tui/
│   │   └── index.ts           # 终端 UI
│   └── index.ts               # 入口文件
├── .pi/
│   ├── skills/                # 项目 Skill
│   └── extensions/            # 项目扩展
├── AGENTS.md                  # 项目配置
├── package.json
└── tsconfig.json
```

## 核心组装代码

```typescript
// src/index.ts
import { AgentLoop } from "./core/agent-loop"
import { ProviderRegistry } from "./providers/registry"
import { OpenAIProvider } from "./providers/openai"
import { AnthropicProvider } from "./providers/anthropic"
import { registerBuiltinTools } from "./tools/index"
import { ExtensionSystem } from "./extensions/system"
import { SkillManager } from "./skills/manager"
import { ContextManager } from "./context/manager"
import { CompactionManager } from "./compaction/manager"
import { SimpleTUI } from "./tui/index"
import { SessionManager } from "./core/session"

async function main() {
  // 1. 初始化 Provider
  const providerRegistry = new ProviderRegistry()
  
  if (process.env.OPENAI_API_KEY) {
    providerRegistry.register(new OpenAIProvider({
      name: "openai",
      apiType: "openai",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com",
      apiKey: process.env.OPENAI_API_KEY,
      models: [
        { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, maxOutput: 16384, supportsTools: true, supportsStreaming: true },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", contextWindow: 128000, maxOutput: 16384, supportsTools: true, supportsStreaming: true },
      ],
    }))
  }

  if (process.env.ANTHROPIC_API_KEY) {
    providerRegistry.register(new AnthropicProvider({
      name: "anthropic",
      apiType: "anthropic",
      baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
      apiKey: process.env.ANTHROPIC_API_KEY,
      models: [
        { id: "claude-sonnet-4-20250514", name: "Claude Sonnet", contextWindow: 200000, maxOutput: 64000, supportsTools: true, supportsStreaming: true },
      ],
    }))
  }

  // 2. 选择默认 Provider 和模型
  const defaultProvider = providerRegistry.get("openai") || providerRegistry.get("anthropic")
  if (!defaultProvider) {
    console.error("请设置 OPENAI_API_KEY 或 ANTHROPIC_API_KEY 环境变量")
    process.exit(1)
  }

  // 3. 初始化工具
  const tools = registerBuiltinTools()

  // 4. 初始化扩展系统
  const extensionSystem = new ExtensionSystem()
  await extensionSystem.loadExtensions(".pi/extensions")
  await extensionSystem.loadExtensions("~/.pi/agent/extensions")

  // 5. 初始化 Skill
  const skillManager = new SkillManager([
    ".pi/skills",
    "~/.pi/agent/skills",
  ])

  // 6. 初始化上下文管理器
  const contextManager = new ContextManager({
    systemPrompt: loadSystemPrompt(),
    agentsMd: loadAgentsMd(),
    skillDescriptions: skillManager.getDescriptions(),
  })

  // 7. 初始化会话管理
  const sessionManager = new SessionManager(getSessionPath())

  // 8. 初始化压缩管理器
  const compactionManager = new CompactionManager(defaultProvider, "gpt-4o")

  // 9. 初始化 Agent Loop
  const agentLoop = new AgentLoop({
    provider: defaultProvider,
    model: "gpt-4o",
    tools,
    sessionManager,
    contextManager,
    compactionManager,
    extensionSystem,
    skillManager,
  })

  // 10. 初始化 TUI
  const tui = new SimpleTUI({
    onInput: async (input) => {
      try {
        await agentLoop.run(input)
      } catch (err) {
        console.error(`\n❌ 错误: ${err.message}`)
      }
      tui.endStream()
      tui.prompt()
    },
    onCommand: (command, args) => {
      handleCommand(command, args, agentLoop, tui, providerRegistry)
    },
  })

  // 11. 连接 Agent 事件到 TUI
  agentLoop.on("text", (text) => tui.writeStream(text))
  agentLoop.on("tool_call", (event) => tui.showToolCall(event.tool, event.args))
  agentLoop.on("tool_result", (result) => tui.showToolResult(result))
  agentLoop.on("turn_start", (turn) => tui.setStatus(`Turn ${turn}`, agentLoop.model))

  // 12. 启动！
  tui.start()
}

function handleCommand(command: string, args: string, agent: AgentLoop, tui: SimpleTUI, registry: ProviderRegistry) {
  switch (command) {
    case "help":
      console.log(`
可用命令:
  /help          - 显示帮助
  /model <name>  - 切换模型
  /clear         - 清空对话历史
  /compact       - 手动触发压缩
  /tree          - 查看会话树
  /fork          - 从当前节点分叉
  /quit          - 退出
`)
      break
    case "model":
      try {
        agent.setModel(args)
        console.log(`已切换到: ${args}`)
      } catch (err) {
        console.error(`切换失败: ${err.message}`)
      }
      break
    case "clear":
      agent.clearHistory()
      console.log("已清空对话历史")
      break
    case "compact":
      agent.compact()
      console.log("已触发压缩")
      break
    case "quit":
      process.exit(0)
  }
}

main().catch(console.error)
```

## AGENTS.md

```markdown
# Mini Agent 项目

这是一个教学版的 AI Agent，参考 Pi 的设计哲学构建。

## 技术栈
- TypeScript
- Node.js
- OpenAI / Anthropic API

## 可用工具
- read: 读取文件
- write: 写入文件
- edit: 编辑文件
- bash: 执行命令

## 注意事项
- 这是教学版本，省略了安全检查
- 不要在生产环境中使用
- 工具执行默认超时 30 秒
```

## 与 Pi 的对比

| 方面 | 我们的 Mini Agent | Pi 的真实实现 |
|------|-----------------|-------------|
| 代码量 | ~1500 行 | ~50,000 行 |
| Provider | 2 个 | 15+ |
| 工具 | 4 个 | 4 个核心 + 可扩展 |
| 扩展系统 | 简化版 | 完整生命周期钩子 |
| TUI | 基础 ANSI | 差分渲染 + 组件系统 |
| 会话 | JSONL 文件 | JSONL 树状 + 分支 |
| Compaction | 基础总结 | 多层压缩策略 |
| Skill | 基础加载 | agentskills.io 标准 |
| 测试 | 无 | 完整测试套件 |

::: tip 核心思想是一样的
虽然实现细节有差异，但核心思想完全一致：
1. 循环调用 LLM，执行工具，把结果喂回去
2. 只用 4 个工具，bash 是万能胶水
3. 扩展系统处理所有非核心功能
4. 上下文工程决定 Agent 质量
:::

## 下一章

项目组装完成。下一章，我们将讲解如何运行、测试和调试这个 Mini Agent。
