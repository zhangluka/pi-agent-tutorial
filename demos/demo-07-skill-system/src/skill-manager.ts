import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"

interface SkillMeta {
  name: string
  description: string
  path: string
}

interface Skill extends SkillMeta {
  content: string
}

class SkillManager {
  private skills: SkillMeta[] = []
  private loadedSkills: Map<string, Skill> = new Map()

  constructor(private skillDirs: string[]) {
    this.discover()
  }

  private discover() {
    for (const dir of this.skillDirs) {
      if (!existsSync(dir)) continue
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const skillMdPath = join(dir, entry.name, "SKILL.md")
        if (!existsSync(skillMdPath)) continue
        const content = readFileSync(skillMdPath, "utf-8")
        const meta = this.parseFrontmatter(content, join(dir, entry.name))
        if (meta) this.skills.push(meta)
      }
    }
    console.log(`发现 ${this.skills.length} 个 Skill`)
  }

  private parseFrontmatter(content: string, skillPath: string): SkillMeta | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/)
    if (!match) return null
    const frontmatter = match[1]
    const nameMatch = frontmatter.match(/name:\s*(.+)/)
    const descMatch = frontmatter.match(/description:\s*(.+)/)
    if (!nameMatch || !descMatch) return null
    return { name: nameMatch[1].trim(), description: descMatch[1].trim(), path: skillPath }
  }

  getDescriptions(): string {
    return this.skills.map(s => `- ${s.name}: ${s.description}`).join("\n")
  }

  load(name: string): Skill | null {
    if (this.loadedSkills.has(name)) return this.loadedSkills.get(name)!
    const meta = this.skills.find(s => s.name === name)
    if (!meta) return null
    const content = readFileSync(join(meta.path, "SKILL.md"), "utf-8")
    const skill: Skill = { ...meta, content }
    this.loadedSkills.set(name, skill)
    return skill
  }

  detectNeeded(userMessage: string): string[] {
    const lower = userMessage.toLowerCase()
    return this.skills
      .filter(s => {
        const keywords = s.description.toLowerCase().split(/[,、，]/)
        return keywords.some(kw => lower.includes(kw.trim()))
      })
      .map(s => s.name)
  }
}

function createSampleSkills() {
  const skillsDir = "./skills"
  const braveDir = join(skillsDir, "brave-search")
  if (!existsSync(braveDir)) {
    mkdirSync(braveDir, { recursive: true })
    writeFileSync(join(braveDir, "SKILL.md"), `---
name: brave-search
description: 通过 Brave Search API 搜索网页，用于查找文档、搜索技术问题、获取最新信息。
---

# Brave Search

## 使用方法
\`\`\`bash
export BRAVE_API_KEY=your_key
node search.js "搜索内容"
\`\`\`
`)
  }

  const pdfDir = join(skillsDir, "pdf-tools")
  if (!existsSync(pdfDir)) {
    mkdirSync(pdfDir, { recursive: true })
    writeFileSync(join(pdfDir, "SKILL.md"), `---
name: pdf-tools
description: 处理 PDF 文件：提取文本内容、填写 PDF 表单、合并多个 PDF、拆分 PDF 页面。
---

# PDF Tools

## 提取文本
\`\`\`bash
node pdf-tools.js extract input.pdf
\`\`\`
`)
  }
}

async function main() {
  createSampleSkills()
  const manager = new SkillManager(["./skills"])

  console.log("\n=== Skill 描述（注入 System Prompt）===")
  console.log(manager.getDescriptions())

  const testMessages = [
    "帮我搜一下 React 19 的新特性",
    "把这个 PDF 转成文本",
    "你好，今天天气怎么样？",
  ]

  for (const msg of testMessages) {
    const needed = manager.detectNeeded(msg)
    console.log(`\n用户: "${msg}"`)
    console.log(`需要 Skill: ${needed.length > 0 ? needed.join(", ") : "无"}`)
    for (const name of needed) {
      const skill = manager.load(name)
      if (skill) console.log(`已加载 Skill: ${skill.name} (${skill.content.length} 字符)`)
    }
  }
}

main().catch(console.error)
