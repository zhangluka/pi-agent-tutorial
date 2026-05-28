# Ch05 工具系统：read / write / edit / bash

## 四把手术刀的完整实现

上一章我们实现了简单的 read 和 bash。这一章，我们将完整实现 Pi 的四个核心工具，并深入理解工具系统的设计细节。

## 工具设计原则

Pi 的工具设计遵循几个关键原则：

| 原则 | 说明 | 例子 |
|------|------|------|
| **最小正交** | 每个工具做一件事，不重叠 | read 只读，write 只写 |
| **原子操作** | 每次调用是原子的 | edit 一次替换一处 |
| **明确反馈** | 返回清晰的结果或错误 | 文件不存在要明确说 |
| **安全截断** | 输出不能超过限制 | 大文件只返回前 N 行 |

## read：读取文件

```typescript
import { Type } from "@sinclair/typebox"

const readTool = {
  name: "read",
  label: "Read",
  description: "读取文件内容。返回指定行范围的内容。默认从第 1 行开始，最多返回 2000 行。",
  parameters: Type.Object({
    path: Type.String({ description: "文件的绝对或相对路径" }),
    offset: Type.Optional(Type.Number({ description: "起始行号（从 0 开始）", default: 0 })),
    limit: Type.Optional(Type.Number({ description: "最多返回的行数", default: 2000 })),
  }),
  execute: async (_toolCallId: string, params: { path: string; offset?: number; limit?: number }) => {
    const fs = await import("fs/promises")
    const path = await import("path")
    
    const filePath = path.resolve(params.path)
    const offset = params.offset ?? 0
    const limit = params.limit ?? 2000
    
    try {
      const content = await fs.readFile(filePath, "utf-8")
      const lines = content.split("\n")
      const selected = lines.slice(offset, offset + limit)
      
      // 带行号输出（Pi 的风格）
      const numbered = selected
        .map((line, i) => `${offset + i + 1}\t${line}`)
        .join("\n")
      
      return {
        content: [{ type: "text", text: numbered }],
        details: { totalLines: lines.length, returned: selected.length },
      }
    } catch (err) {
      return {
        content: [{ type: "text", text: `错误：无法读取文件 ${filePath} - ${err.message}` }],
        details: {},
      }
    }
  },
}
```

::: tip 为什么要带行号？
LLM 在调用 edit 工具时需要知道要修改第几行。带行号的输出让 LLM 能准确定位。Pi 的 read 工具默认就带行号。
:::

## write：写入文件

```typescript
const writeTool = {
  name: "write",
  label: "Write",
  description: "将内容写入文件。如果文件已存在则覆盖。如果父目录不存在会自动创建。",
  parameters: Type.Object({
    path: Type.String({ description: "文件路径" }),
    content: Type.String({ description: "要写入的内容" }),
  }),
  execute: async (_toolCallId: string, params: { path: string; content: string }) => {
    const fs = await import("fs/promises")
    const path = await import("path")
    
    const filePath = path.resolve(params.path)
    
    try {
      // 自动创建父目录
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, params.content, "utf-8")
      
      const lines = params.content.split("\n").length
      return {
        content: [{ type: "text", text: `已写入 ${filePath}（${lines} 行）` }],
        details: { path: filePath, lines },
      }
    } catch (err) {
      return {
        content: [{ type: "text", text: `错误：无法写入 ${filePath} - ${err.message}` }],
        details: {},
      }
    }
  },
}
```

## edit：精确替换

edit 是最复杂的工具。Pi 的 edit 工具做的是**精确字符串替换**——找到旧文本，替换成新文本：

```typescript
const editTool = {
  name: "edit",
  label: "Edit",
  description: "精确替换文件中的文本。old_string 必须与文件中的内容完全匹配（包括空格和缩进）。",
  parameters: Type.Object({
    path: Type.String({ description: "文件路径" }),
    old_string: Type.String({ description: "要替换的原始文本" }),
    new_string: Type.String({ description: "替换后的新文本" }),
  }),
  execute: async (_toolCallId: string, params: { path: string; old_string: string; new_string: string }) => {
    const fs = await import("fs/promises")
    const path = await import("path")
    
    const filePath = path.resolve(params.path)
    
    try {
      const content = await fs.readFile(filePath, "utf-8")
      
      // 检查 old_string 是否存在
      const count = content.split(params.old_string).length - 1
      
      if (count === 0) {
        return {
          content: [{ type: "text", text: `错误：在 ${filePath} 中未找到匹配的文本。请检查 old_string 是否完全正确。` }],
          details: {},
        }
      }
      
      if (count > 1) {
        return {
          content: [{ type: "text", text: `警告：找到 ${count} 处匹配。请提供更多上下文使 old_string 唯一。` }],
          details: {},
        }
      }
      
      // 执行替换
      const newContent = content.replace(params.old_string, params.new_string)
      await fs.writeFile(filePath, newContent, "utf-8")
      
      return {
        content: [{ type: "text", text: `已在 ${filePath} 中完成替换` }],
        details: { path: filePath },
      }
    } catch (err) {
      return {
        content: [{ type: "text", text: `错误：无法编辑 ${filePath} - ${err.message}` }],
        details: {},
      }
    }
  },
}
```

::: warning edit 工具的陷阱
1. **空格敏感**：`old_string` 必须和文件中的内容**完全一致**，包括空格和缩进
2. **唯一性**：如果 `old_string` 匹配多处，LLM 需要提供更多上下文
3. **原子性**：一次只替换一处，避免批量替换导致意外
:::

## bash：执行命令

```typescript
const bashTool = {
  name: "bash",
  label: "Bash",
  description: "执行 shell 命令并返回输出。适用于运行代码、安装包、git 操作等。",
  parameters: Type.Object({
    command: Type.String({ description: "要执行的 shell 命令" }),
  }),
  execute: async (_toolCallId: string, params: { command: string }) => {
    const { execSync } = await import("child_process")
    
    try {
      const output = execSync(params.command, {
        encoding: "utf-8",
        timeout: 30000,  // 30 秒超时
        maxBuffer: 1024 * 1024,  // 1MB 输出限制
        cwd: process.cwd(),
      })
      
      // 截断过长的输出
      const truncated = output.length > 50000
        ? output.slice(0, 50000) + "\n\n... (输出被截断，共 " + output.length + " 字符)"
        : output
      
      return {
        content: [{ type: "text", text: truncated || "(命令执行成功，无输出)" }],
        details: { exitCode: 0 },
      }
    } catch (err: any) {
      return {
        content: [{
          type: "text",
          text: `命令执行失败:\nstdout: ${err.stdout || ""}\nstderr: ${err.stderr || ""}\nexit code: ${err.status}`
        }],
        details: { exitCode: err.status },
      }
    }
  },
}
```

::: tip 为什么 bash 是万能的？
有了 bash，Agent 可以：
- `grep -r "pattern" .` —— 搜索代码
- `find . -name "*.ts"` —— 查找文件
- `ls -la` —— 列目录
- `git diff` —— 查看变更
- `npm test` —— 运行测试
- `curl https://api.example.com` —— 调用 API

这就是 Pi 把 7 个工具砍到 4 个的底气。
:::

## 工具输出截断

这是一个关键的工程细节。工具的输出可能非常大（比如读一个 10MB 的日志文件），如果不截断，会撑爆上下文窗口。

Pi 的截断策略：

| 限制 | 值 |
|------|-----|
| 最大字符数 | 50,000 字符 |
| 最大行数 | 2,000 行 |

```typescript
function truncateOutput(text: string, maxChars = 50000, maxLines = 2000): string {
  const lines = text.split("\n")
  
  // 先按行数截断
  if (lines.length > maxLines) {
    const truncated = lines.slice(0, maxLines).join("\n")
    return truncated + `\n\n... (截断，共 ${lines.length} 行，显示前 ${maxLines} 行)`
  }
  
  // 再按字符数截断
  if (text.length > maxChars) {
    return text.slice(0, maxChars) + `\n\n... (截断，共 ${text.length} 字符)`
  }
  
  return text
}
```

## 工具定义的 Token 预算

让我们算一下 4 个工具定义占多少 token：

```
read:    name + description + parameters ≈ 200 tokens
write:   name + description + parameters ≈ 180 tokens
edit:    name + description + parameters ≈ 220 tokens
bash:    name + description + parameters ≈ 170 tokens
────────────────────────────────────────
总计:                                   ≈ 770 tokens
```

对比：
- Claude Code 的工具集：~4,000 tokens
- LangChain 的默认工具集：~10,000+ tokens

::: tip Token 经济学
每个 API 调用都会发送工具定义。如果你一天调用 1000 次 API：
- Pi: 770 × 1000 = 770K tokens 浪费在工具定义上
- Claude Code: 4,000 × 1000 = 4M tokens

按 $3/百万 token 计算，Pi 每天省 $9.7。
:::

## 工具执行的安全考虑

```typescript
// 安全的工具执行包装器
async function safeExecuteTool(toolCall: ToolCall): Promise<string> {
  const tool = toolRegistry.get(toolCall.function.name)
  if (!tool) return `错误：未知工具 ${toolCall.function.name}`

  // 1. 解析参数
  let args: Record<string, any>
  try {
    args = JSON.parse(toolCall.function.arguments)
  } catch {
    return `错误：参数格式无效 - ${toolCall.function.arguments}`
  }

  // 2. 参数校验（使用 TypeBox）
  const isValid = validateParams(tool.parameters, args)
  if (!isValid) return `错误：参数校验失败`

  // 3. 执行（带超时）
  const timeout = 30000
  const result = await Promise.race([
    tool.execute(toolCall.id, args),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error("工具执行超时")), timeout)
    ),
  ])

  return typeof result === "string" ? result : JSON.stringify(result)
}
```

## 小练习

::: details 练习 1：实现 search 工具
虽然 Pi 不内置 search，但作为练习，实现一个简单的文本搜索工具：在指定目录下搜索包含特定文本的文件。

::: details 参考思路
```typescript
const searchTool = {
  name: "search",
  description: "在文件中搜索文本",
  parameters: Type.Object({
    pattern: Type.String({ description: "搜索的文本或正则" }),
    path: Type.Optional(Type.String({ description: "搜索目录，默认当前目录" })),
  }),
  execute: async (_id, params) => {
    const { execSync } = await import("child_process")
    const cmd = `grep -rn "${params.pattern}" ${params.path || "."} --include="*.ts" --include="*.js" | head -50`
    try {
      return execSync(cmd, { encoding: "utf-8" }) || "未找到匹配"
    } catch {
      return "未找到匹配"
    }
  },
}
```
:::
:::

::: details 练习 2：为 edit 添加撤销功能
为 edit 工具添加撤销功能：每次替换前保存原始内容，提供一个 undo 工具可以恢复。

::: details 提示
- 在 edit 执行前，把 `{ path, oldContent }` 存到一个 Map 里
- 实现 undo 工具，从 Map 里取出原始内容并恢复
- 注意：这是一个简化方案，真正的撤销应该用 git
:::
:::

## 下一章

工具系统搞定了。下一章，我们将实现多 Provider 支持——让 Agent 能同时使用 OpenAI、Anthropic、Google 等不同模型。
