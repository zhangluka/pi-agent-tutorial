# Demo 04 - Read / Write / Bash

## 目标

实现 Pi 的完整四工具集：read、write、edit、bash。

## 核心知识点

- 工具输出截断
- edit 工具的精确替换
- 工具错误处理
- 工具注册系统

## 源码

```typescript
// src/tools.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"
import { dirname, resolve } from "path"
import { execSync } from "child_process"

interface Tool {
  name: string
  description: string
  parameters: object
  execute: (args: Record<string, any>) => Promise<string>
}

// 输出截断
function truncate(text: string, maxChars = 50000, maxLines = 2000): string {
  const lines = text.split("\n")
  if (lines.length > maxLines) {
    return lines.slice(0, maxLines).join("\n") + `\n\n... (截断，共 ${lines.length} 行)`
  }
  if (text.length > maxChars) {
    return text.slice(0, maxChars) + `\n\n... (截断，共 ${text.length} 字符)`
  }
  return text
}

// read 工具
export const readTool: Tool = {
  name: "read",
  description: "读取文件内容，返回带行号的内容",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "文件路径" },
      offset: { type: "number", description: "起始行号（从 0 开始）" },
      limit: { type: "number", description: "最多返回的行数" },
    },
    required: ["path"],
  },
  execute: async (args) => {
    const filePath = resolve(args.path)
    const offset = args.offset ?? 0
    const limit = args.limit ?? 2000

    try {
      const content = readFileSync(filePath, "utf-8")
      const lines = content.split("\n")
      const selected = lines.slice(offset, offset + limit)
      const numbered = selected.map((line, i) => `${offset + i + 1}\t${line}`).join("\n")
      return truncate(numbered)
    } catch {
      return `错误：文件 ${filePath} 不存在`
    }
  },
}

// write 工具
export const writeTool: Tool = {
  name: "write",
  description: "写入文件，如果父目录不存在会自动创建",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "文件路径" },
      content: { type: "string", description: "要写入的内容" },
    },
    required: ["path", "content"],
  },
  execute: async (args) => {
    const filePath = resolve(args.path)
    try {
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, args.content, "utf-8")
      const lines = args.content.split("\n").length
      return `已写入 ${filePath}（${lines} 行）`
    } catch (err: any) {
      return `错误：无法写入 ${filePath} - ${err.message}`
    }
  },
}

// edit 工具
export const editTool: Tool = {
  name: "edit",
  description: "精确替换文件中的文本，old_string 必须完全匹配",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "文件路径" },
      old_string: { type: "string", description: "要替换的原始文本" },
      new_string: { type: "string", description: "替换后的新文本" },
    },
    required: ["path", "old_string", "new_string"],
  },
  execute: async (args) => {
    const filePath = resolve(args.path)
    try {
      const content = readFileSync(filePath, "utf-8")
      const count = content.split(args.old_string).length - 1

      if (count === 0) {
        return `错误：在 ${filePath} 中未找到匹配的文本`
      }
      if (count > 1) {
        return `警告：找到 ${count} 处匹配，请提供更多上下文`
      }

      const newContent = content.replace(args.old_string, args.new_string)
      writeFileSync(filePath, newContent, "utf-8")
      return `已在 ${filePath} 中完成替换`
    } catch (err: any) {
      return `错误：无法编辑 ${filePath} - ${err.message}`
    }
  },
}

// bash 工具
export const bashTool: Tool = {
  name: "bash",
  description: "执行 shell 命令",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "要执行的命令" },
    },
    required: ["command"],
  },
  execute: async (args) => {
    try {
      const output = execSync(args.command, {
        encoding: "utf-8",
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      })
      return truncate(output || "(命令执行成功，无输出)")
    } catch (err: any) {
      return `命令执行失败:\nstdout: ${err.stdout || ""}\nstderr: ${err.stderr || ""}`
    }
  },
}

// 注册所有工具
export function registerAllTools(): Map<string, Tool> {
  const registry = new Map<string, Tool>()
  for (const tool of [readTool, writeTool, editTool, bashTool]) {
    registry.set(tool.name, tool)
  }
  return registry
}
```

## 运行

```bash
cd demos/demo-04-read-write-bash
npm install
OPENAI_API_KEY=sk-xxx npx tsx src/index.ts
```

## 测试用例

```bash
# 测试 read
You: 读取 package.json

# 测试 write
You: 创建一个 hello.txt 文件，内容是 "Hello World"

# 测试 edit
You: 把 hello.txt 里的 "Hello" 改成 "Hi"

# 测试 bash
You: 运行 ls -la 看看当前目录
```

## 小练习

1. 为 edit 工具添加撤销功能
2. 为 bash 工具添加超时配置
3. 添加 `search` 工具（用 grep 实现）
