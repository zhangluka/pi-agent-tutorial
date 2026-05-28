<script setup>
import { ref, onMounted } from 'vue'

const base = '/pi-agent-tutorial/'

const chapters = [
  { id: 1, title: '什么是 AI Agent', part: '核心概念', icon: '🧠' },
  { id: 2, title: 'Pi 的设计哲学', part: '核心概念', icon: '💡' },
  { id: 3, title: '第一次 LLM 调用', part: '核心概念', icon: '⚡' },
  { id: 4, title: 'Agent Loop', part: '核心概念', icon: '🔄' },
  { id: 5, title: '工具系统', part: '核心机制', icon: '🔧' },
  { id: 6, title: '多 Provider 支持', part: '核心机制', icon: '🔌' },
  { id: 7, title: '会话与记忆', part: '核心机制', icon: '💾' },
  { id: 8, title: '上下文工程', part: '核心机制', icon: '📐' },
  { id: 9, title: '扩展系统', part: '扩展体系', icon: '🧩' },
  { id: 10, title: 'Skill 系统', part: '扩展体系', icon: '✨' },
  { id: 11, title: 'TUI 交互', part: '扩展体系', icon: '🖥' },
  { id: 12, title: '完整项目组装', part: '实战组装', icon: '🏗' },
  { id: 13, title: '运行与测试', part: '实战组装', icon: '🚀' },
  { id: 14, title: '总结与扩展', part: '实战组装', icon: '🎯' },
]

const parts = [
  { name: '核心概念', range: [1, 4], desc: '理解 Agent 的本质' },
  { name: '核心机制', range: [5, 8], desc: '掌握四大核心系统' },
  { name: '扩展体系', range: [9, 11], desc: '构建可插拔架构' },
  { name: '实战组装', range: [12, 14], desc: '组装完整项目' },
]

const demoCode = `import { Agent } from '@pi/core'
import { bash, read, write, edit } from '@pi/tools'

const agent = new Agent({
  model: 'claude-sonnet-4-20250514',
  tools: [bash, read, write, edit],
  system: 'You are a helpful coding agent.'
})

// 一句话启动，Agent 自主完成任务
const result = await agent.run(
  '帮我写一个 fibonacci 函数并加上单元测试'
)`

const visible = ref(false)
onMounted(() => {
  requestAnimationFrame(() => { visible.value = true })
})
</script>

<template>
  <div class="homepage" :class="{ visible }">
    <!-- Hero -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-badge">基于 Pi 的渐进式教程</div>
        <h1 class="hero-title">
          <span class="hero-title-main">从零到一</span>
          <span class="hero-title-sub">亲手构建一个 AI Agent</span>
        </h1>
        <p class="hero-desc">
          14 章内容 &middot; 8 个可运行 Demo &middot; 1 个完整项目<br>
          不是调 API，是理解 Agent 是怎么跑起来的
        </p>
        <div class="hero-actions">
          <a class="btn btn-primary" :href="base + 'guide/ch01-what-is-agent/'">开始学习</a>
          <a class="btn btn-secondary" :href="base + 'demos/'">Demo 源码</a>
        </div>
      </div>
    </section>

    <!-- Code preview -->
    <section class="code-preview">
      <div class="code-preview-inner">
        <div class="code-label">你将学会写的东西</div>
        <div class="code-block">
          <div class="code-block-header">
            <span class="code-dot"></span>
            <span class="code-dot"></span>
            <span class="code-dot"></span>
            <span class="code-filename">demo.ts</span>
          </div>
          <pre><code>{{ demoCode }}</code></pre>
        </div>
      </div>
    </section>

    <!-- Learning path -->
    <section class="path">
      <div class="path-inner">
        <h2 class="section-title">学习路线</h2>
        <p class="section-desc">四个阶段，从理解概念到动手实操</p>

        <div class="path-grid">
          <div v-for="part in parts" :key="part.name" class="path-part">
            <div class="path-part-header">
              <span class="path-part-num">{{ String(parts.indexOf(part) + 1).padStart(2, '0') }}</span>
              <div>
                <h3 class="path-part-name">{{ part.name }}</h3>
                <p class="path-part-desc">{{ part.desc }}</p>
              </div>
            </div>
            <div class="path-chapters">
              <a
                v-for="ch in chapters.filter(c => c.id >= part.range[0] && c.id <= part.range[1])"
                :key="ch.id"
                :href="base + `guide/ch${String(ch.id).padStart(2, '0')}-${getSlug(ch.id)}/`"
                class="path-chapter"
              >
                <span class="path-ch-icon">{{ ch.icon }}</span>
                <span class="path-ch-title">{{ ch.title }}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Why this tutorial -->
    <section class="why">
      <div class="why-inner">
        <h2 class="section-title">为什么读这个教程</h2>
        <div class="why-grid">
          <div class="why-card">
            <div class="why-icon">📖</div>
            <h3>源码级讲解</h3>
            <p>不是调 API 的 quickstart，是逐行拆解 Agent 的核心循环、工具调度、上下文管理</p>
          </div>
          <div class="why-card">
            <div class="why-icon">🧪</div>
            <h3>代码都能跑</h3>
            <p>8 个 Demo 从 Hello LLM 到完整 Agent，每个都是独立可运行的项目</p>
          </div>
          <div class="why-card">
            <div class="why-icon">🏗</div>
            <h3>渐进式架构</h3>
            <p>先核心后扩展，先单文件后模块化——你看到的每一层都是上一层的自然延伸</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta">
      <div class="cta-inner">
        <p class="cta-text">准备好了？</p>
        <a class="btn btn-primary btn-lg" :href="base + 'guide/ch01-what-is-agent/'">从第一章开始</a>
      </div>
    </section>
  </div>
</template>

<script>
const slugMap = {
  1: 'what-is-agent',
  2: 'pi-philosophy',
  3: 'first-llm-call',
  4: 'agent-loop',
  5: 'tool-system',
  6: 'multi-provider',
  7: 'session-memory',
  8: 'context-engineering',
  9: 'extension-system',
  10: 'skill-system',
  11: 'tui-overview',
  12: 'full-project',
  13: 'run-and-test',
  14: 'summary',
}

function getSlug(id) {
  return slugMap[id] || ''
}

export default { methods: { getSlug } }
</script>

<style scoped>
/* ============================================================
   Homepage — Custom Layout
   ============================================================ */

.homepage {
  max-width: 100%;
  overflow-x: hidden;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.homepage.visible {
  opacity: 1;
  transform: translateY(0);
}

/* --- Hero --- */

.hero {
  padding: 6rem 1.5rem 4rem;
  text-align: center;
  background:
    radial-gradient(ellipse 60% 50% at 50% 0%, var(--c-clay-glow), transparent),
    var(--c-ivory);
}

.dark .hero {
  background:
    radial-gradient(ellipse 60% 50% at 50% 0%, rgba(232, 115, 74, 0.06), transparent),
    var(--c-ivory);
}

.hero-inner {
  max-width: 640px;
  margin: 0 auto;
}

.hero-badge {
  display: inline-block;
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--c-clay);
  background: var(--c-clay-glow);
  padding: 6px 16px;
  border-radius: 100px;
  margin-bottom: 2rem;
}

.hero-title {
  margin: 0 0 1.5rem;
}

.hero-title-main {
  display: block;
  font-family: var(--font-display);
  font-size: clamp(2.5rem, 6vw, 3.8rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1.1;
  color: var(--c-slate-900);
}

.hero-title-sub {
  display: block;
  font-family: var(--font-body);
  font-size: clamp(1.2rem, 3vw, 1.6rem);
  font-weight: 400;
  color: var(--c-slate-500);
  margin-top: 0.5rem;
  letter-spacing: -0.01em;
}

.hero-desc {
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.8;
  color: var(--c-slate-400);
  margin: 0 0 2.5rem;
}

.hero-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 14px;
  padding: 10px 28px;
  border-radius: var(--r-md);
  text-decoration: none;
  transition: all 0.2s;
  letter-spacing: 0.01em;
}

.btn-primary {
  background: var(--c-slate-900);
  color: var(--c-ivory);
}

.btn-primary:hover {
  background: var(--c-slate-700);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-secondary {
  border: 1px solid var(--vp-c-divider);
  color: var(--c-slate-700);
  background: transparent;
}

.btn-secondary:hover {
  border-color: var(--c-slate-400);
  color: var(--c-slate-900);
}

.btn-lg {
  padding: 14px 36px;
  font-size: 15px;
}

/* --- Code Preview --- */

.code-preview {
  padding: 0 1.5rem 4rem;
  margin-top: -1rem;
}

.code-preview-inner {
  max-width: 620px;
  margin: 0 auto;
}

.code-label {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--c-slate-400);
  margin-bottom: 0.75rem;
  text-align: center;
}

.code-block {
  border-radius: var(--r-lg);
  border: 1px solid var(--vp-c-divider);
  background: var(--c-slate-900);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.dark .code-block {
  background: #111110;
  border-color: rgba(255, 255, 255, 0.06);
}

.code-block-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.code-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}

.code-dot:first-child { background: #ff5f57; }
.code-dot:nth-child(2) { background: #ffbd2e; }
.code-dot:nth-child(3) { background: #28c840; }

.code-filename {
  font-family: var(--font-mono);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin-left: 8px;
}

.code-block pre {
  margin: 0;
  padding: 20px 24px;
  overflow-x: auto;
}

.code-block code {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
  color: #e8e6dc;
  white-space: pre;
}

/* --- Learning Path --- */

.path {
  padding: 5rem 1.5rem;
  background: var(--c-ivory-warm);
}

.path-inner {
  max-width: 960px;
  margin: 0 auto;
}

.section-title {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--c-slate-900);
  text-align: center;
  margin: 0 0 0.5rem;
}

.section-desc {
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--c-slate-400);
  text-align: center;
  margin: 0 0 3rem;
}

.path-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

@media (max-width: 768px) {
  .path-grid {
    grid-template-columns: 1fr;
  }
}

.path-part {
  background: var(--c-ivory);
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--r-lg);
  padding: 1.75rem;
  transition: box-shadow 0.25s;
}

.path-part:hover {
  box-shadow: var(--shadow-md);
}

.path-part-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 1.25rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.path-part-num {
  font-family: var(--font-mono);
  font-size: 28px;
  font-weight: 700;
  color: var(--c-slate-300);
  line-height: 1;
  flex-shrink: 0;
}

.path-part-name {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--c-slate-900);
  margin: 0 0 2px;
  letter-spacing: -0.01em;
}

.path-part-desc {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--c-slate-400);
  margin: 0;
}

.path-chapters {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.path-chapter {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--r-md);
  text-decoration: none;
  transition: background 0.15s;
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--c-slate-700);
}

.path-chapter:hover {
  background: var(--c-ivory-warm);
  color: var(--c-slate-900);
}

.path-ch-icon {
  font-size: 16px;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}

.path-ch-title {
  font-weight: 500;
}

/* --- Why Section --- */

.why {
  padding: 5rem 1.5rem;
}

.why-inner {
  max-width: 960px;
  margin: 0 auto;
}

.why-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

@media (max-width: 768px) {
  .why-grid {
    grid-template-columns: 1fr;
  }
}

.why-card {
  text-align: center;
  padding: 2rem 1.5rem;
  border-radius: var(--r-lg);
  border: 1px solid var(--vp-c-divider);
  background: var(--c-ivory);
  transition: all 0.25s;
}

.why-card:hover {
  border-color: var(--c-slate-300);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.why-icon {
  font-size: 32px;
  margin-bottom: 1rem;
}

.why-card h3 {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--c-slate-900);
  margin: 0 0 0.5rem;
  letter-spacing: -0.01em;
}

.why-card p {
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.65;
  color: var(--c-slate-500);
  margin: 0;
}

/* --- CTA --- */

.cta {
  padding: 5rem 1.5rem 6rem;
  text-align: center;
  background:
    radial-gradient(ellipse 50% 60% at 50% 100%, var(--c-clay-glow), transparent);
}

.cta-inner {
  max-width: 480px;
  margin: 0 auto;
}

.cta-text {
  font-family: var(--font-body);
  font-size: 18px;
  color: var(--c-slate-500);
  margin: 0 0 1.5rem;
  font-style: italic;
}

/* --- Responsive --- */

@media (max-width: 768px) {
  .hero {
    padding: 4rem 1.25rem 3rem;
  }

  .hero-actions {
    flex-direction: column;
    align-items: center;
  }

  .btn {
    width: 100%;
    max-width: 280px;
    justify-content: center;
  }

  .code-block code {
    font-size: 11.5px;
  }

  .path-part-header {
    gap: 10px;
  }

  .path-part-num {
    font-size: 22px;
  }
}
</style>
