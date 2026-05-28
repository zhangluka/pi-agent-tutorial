# Ch13 运行与测试

## 运行 Mini Agent

### 前置条件

```bash
# Node.js 18+
node --version

# 设置 API Key（至少一个）
export OPENAI_API_KEY=sk-xxx
# 或
export ANTHROPIC_API_KEY=sk-ant-xxx
```

### 安装和运行

```bash
cd demos/demo-08-mini-agent
npm install
npm run dev
```

你应该看到：

```
🤖 Mini Agent 教学版
输入消息开始对话，输入 /help 查看命令

You: 
```

### 测试基本功能

```bash
# 1. 基本对话
You: 你好，帮我看看当前目录有什么文件

# 2. 读取文件
You: 读一下 package.json

# 3. 执行命令
You: 运行一下 npm --version

# 4. 修改文件
You: 在 src/index.ts 顶部加一行注释 "Mini Agent Entry Point"
```

### 测试工具调用

```bash
# 复杂任务：需要多次工具调用
You: 帮我创建一个 hello.txt 文件，内容是 "Hello World"，然后读取确认内容正确

# 预期行为：
# 1. Agent 调用 write 工具创建文件
# 2. Agent 调用 read 工具读取文件
# 3. Agent 输出确认信息
```

### 测试会话管理

```bash
# 切换模型
You: /model gpt-4o-mini

# 清空历史
You: /clear

# 手动压缩
You: /compact
```

## 常见问题排查

### 问题 1：API Key 无效

```
错误: 401 Unauthorized
```

**解决**：检查环境变量是否正确设置：

```bash
echo $OPENAI_API_KEY
# 应该输出 sk-xxx...
```

### 问题 2：上下文溢出

```
错误: context_length_exceeded
```

**解决**：触发手动压缩或清空历史：

```bash
You: /compact
# 或
You: /clear
```

### 问题 3：工具执行超时

```
工具执行错误: 执行超时
```

**解决**：检查命令是否需要更长时间。可以修改 bash 工具的超时设置：

```typescript
// src/tools/bash.ts
timeout: 60000  // 改为 60 秒
```

### 问题 4：Agent 无限循环

```
--- 第 20 轮 ---
--- 第 21 轮 ---
...
```

**解决**：Agent 可能陷入了循环。按 `Ctrl+C` 中断，然后：

```bash
You: /clear
# 或者直接退出
You: /quit
```

## 调试技巧

### 1. 查看 Agent 的推理过程

在 `agent-loop.ts` 中添加日志：

```typescript
// 在每轮开始时
console.log(`\n--- 第 ${iterations} 轮 ---`)
console.log(`当前消息数: ${messages.length}`)

// 在 LLM 响应后
if (response.content) {
  console.log(`Agent 思考: ${response.content.slice(0, 200)}`)
}
```

### 2. 查看工具调用详情

```typescript
// 在工具执行前
console.log(`工具调用: ${toolCall.function.name}`)
console.log(`参数: ${toolCall.function.arguments}`)

// 在工具执行后
console.log(`结果长度: ${result.length}`)
console.log(`结果预览: ${result.slice(0, 200)}`)
```

### 3. 查看上下文大小

```typescript
function estimateTokens(messages: Message[]): number {
  const text = messages.map(m => m.content || "").join("")
  return Math.ceil(text.length * 1.5)
}

// 在每轮开始时
console.log(`估计 token 数: ${estimateTokens(messages)}`)
```

### 4. 查看 Provider 请求

在 Provider 中添加请求日志：

```typescript
// 在 fetch 请求前
console.log(`[${this.config.name}] 请求: ${request.model}`)
console.log(`[${this.config.name}] 消息数: ${request.messages.length}`)

// 在响应后
console.log(`[${this.config.name}] 响应: ${response.content?.slice(0, 100)}`)
```

## 性能优化

### 1. 减少不必要的工具调用

```typescript
// 优化前：Agent 可能会这样做
// 1. read 文件
// 2. read 同一个文件（重复）

// 优化后：在 system prompt 中提示
"不要重复读取同一个文件。如果已经读取过，直接使用之前的结果。"
```

### 2. 使用更快的模型

```bash
# 对于简单任务，用更快的模型
You: /model gpt-4o-mini
```

### 3. 截断工具输出

```typescript
// 确保工具输出不会太大
const MAX_OUTPUT = 50000
if (result.length > MAX_OUTPUT) {
  result = result.slice(0, MAX_OUTPUT) + "\n... (已截断)"
}
```

## 测试用例

### 测试 1：基本对话

```typescript
async function testBasicChat() {
  const agent = createTestAgent()
  const result = await agent.run("用一句话解释什么是 TypeScript")
  console.assert(result.length > 0, "应该有输出")
  console.log("✅ 基本对话测试通过")
}
```

### 测试 2：工具调用

```typescript
async function testToolCalling() {
  const agent = createTestAgent()
  const result = await agent.run("读取 package.json 文件")
  console.assert(result.includes("mini-agent"), "应该包含项目名")
  console.log("✅ 工具调用测试通过")
}
```

### 测试 3：多轮对话

```typescript
async function testMultiTurn() {
  const agent = createTestAgent()
  
  await agent.run("创建一个 test.txt 文件，内容是 hello")
  const result = await agent.run("读取 test.txt 的内容")
  
  console.assert(result.includes("hello"), "应该读取到正确内容")
  console.log("✅ 多轮对话测试通过")
}
```

### 测试 4：错误处理

```typescript
async function testErrorHandling() {
  const agent = createTestAgent()
  const result = await agent.run("读取一个不存在的文件：nonexistent.txt")
  
  // Agent 应该处理错误，而不是崩溃
  console.assert(!result.includes("Error"), "应该优雅处理错误")
  console.log("✅ 错误处理测试通过")
}
```

## 小练习

::: details 练习 1：添加日志系统
为 Mini Agent 添加一个日志系统，将所有交互记录到文件中。

::: details 参考思路
```typescript
import { appendFileSync } from "fs"

class AgentLogger {
  private logFile: string

  constructor(logFile: string) {
    this.logFile = logFile
  }

  logUserInput(input: string) {
    appendFileSync(this.logFile, `\n[${new Date().toISOString()}] USER: ${input}\n`)
  }

  logAgentResponse(response: string) {
    appendFileSync(this.logFile, `[${new Date().toISOString()}] AGENT: ${response}\n`)
  }

  logToolCall(tool: string, args: string) {
    appendFileSync(this.logFile, `[${new Date().toISOString()}] TOOL_CALL: ${tool}(${args})\n`)
  }

  logToolResult(result: string) {
    appendFileSync(this.logFile, `[${new Date().toISOString()}] TOOL_RESULT: ${result.slice(0, 200)}\n`)
  }
}
```
:::
:::

::: details 练习 2：添加单元测试
使用 Vitest 为各个模块编写单元测试。

::: details 提示
```bash
npm install -D vitest
```

测试 Provider：
```typescript
import { describe, it, expect } from "vitest"
import { OpenAIProvider } from "../src/providers/openai"

describe("OpenAIProvider", () => {
  it("should format messages correctly", () => {
    const provider = new OpenAIProvider({ /* ... */ })
    const messages = provider.formatMessages({ /* ... */ })
    expect(messages[0].role).toBe("system")
  })
})
```
:::
:::

## 下一章

Mini Agent 已经可以运行了。最后一章，我们将总结整个教程，并探讨扩展方向。
