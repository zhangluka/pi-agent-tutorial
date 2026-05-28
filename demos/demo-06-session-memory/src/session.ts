import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs"
import { dirname } from "path"

interface SessionEntry {
  id: string
  parentId: string | null
  role: string
  content: string | null
  toolCalls?: any[]
  toolCallId?: string
  timestamp: number
}

class SessionManager {
  private entries: SessionEntry[] = []
  private currentLeafId: string | null = null

  constructor(private filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true })
    if (existsSync(filePath)) this.load()
  }

  private load() {
    const content = readFileSync(this.filePath, "utf-8")
    this.entries = content.split("\n").filter(l => l.trim()).map(l => JSON.parse(l))
    if (this.entries.length > 0) this.currentLeafId = this.entries[this.entries.length - 1].id
  }

  append(entry: Omit<SessionEntry, "id" | "parentId" | "timestamp">): SessionEntry {
    const newEntry: SessionEntry = {
      ...entry,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      parentId: this.currentLeafId,
      timestamp: Date.now(),
    }
    this.entries.push(newEntry)
    this.currentLeafId = newEntry.id
    appendFileSync(this.filePath, JSON.stringify(newEntry) + "\n")
    return newEntry
  }

  getPath(): SessionEntry[] {
    const path: SessionEntry[] = []
    let currentId = this.currentLeafId
    while (currentId) {
      const entry = this.entries.find(e => e.id === currentId)
      if (!entry) break
      path.unshift(entry)
      currentId = entry.parentId
    }
    return path
  }

  toMessages(): any[] {
    return this.getPath().map(e => ({
      role: e.role, content: e.content,
      tool_calls: e.toolCalls, tool_call_id: e.toolCallId,
    }))
  }

  branch(entryId: string) { this.currentLeafId = entryId }

  getBranchPoints(): SessionEntry[] {
    const childCounts = new Map<string, number>()
    for (const entry of this.entries) {
      if (entry.parentId) childCounts.set(entry.parentId, (childCounts.get(entry.parentId) || 0) + 1)
    }
    return this.entries.filter(e => (childCounts.get(e.id) || 0) > 1)
  }
}

class CompactionManager {
  constructor(private apiKey: string) {}

  estimateTokens(messages: any[]): number {
    return Math.ceil(messages.map(m => m.content || "").join("").length * 1.5)
  }

  needsCompaction(messages: any[], contextWindow: number): boolean {
    return this.estimateTokens(messages) > contextWindow * 0.75
  }

  async compact(messages: any[], keepRecent = 5): Promise<any[]> {
    const recent = messages.slice(-keepRecent)
    const toSummarize = messages.slice(0, -keepRecent)
    if (toSummarize.length === 0) return messages

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `请将以下对话压缩为简洁摘要，保留关键信息：\n${JSON.stringify(toSummarize.map(m => ({ role: m.role, content: m.content?.slice(0, 200) })))}`,
        }],
      }),
    })
    const data = await response.json()
    return [{ role: "system", content: `[对话摘要]\n${data.choices[0].message.content}` }, ...recent]
  }
}

async function main() {
  const session = new SessionManager("./sessions/test-session.jsonl")
  const compaction = new CompactionManager(process.env.OPENAI_API_KEY!)

  session.append({ role: "user", content: "你好" })
  session.append({ role: "assistant", content: "你好！有什么可以帮你的？" })
  session.append({ role: "user", content: "帮我写个排序算法" })
  session.append({ role: "assistant", content: "好的，我来写一个快速排序..." })

  console.log(`会话包含 ${session.getPath().length} 条消息`)
  const messages = session.toMessages()
  console.log(`转换后 ${messages.length} 条消息`)

  if (messages.length > 3) {
    const compacted = await compaction.compact(messages, 2)
    console.log(`压缩后 ${compacted.length} 条消息`)
    console.log(`摘要: ${compacted[0].content}`)
  }
}

main().catch(console.error)
