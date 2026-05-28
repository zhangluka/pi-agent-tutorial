---
layout: home

hero:
  name: "Pi Agent 原理与实现"
  text: "从零到一实现一个 AI Agent"
  tagline: 基于 Pi 的设计哲学，通过渐进式 Demo 理解 AI Agent 的核心原理
  actions:
    - theme: brand
      text: 开始学习 →
      link: /guide/ch01-what-is-agent/
    - theme: alt
      text: 查看 Demo 源码
      link: /demos/

features:
  - icon: 🧠
    title: 理解 Agent 核心
    details: 从 ReAct 模式到 Agent Loop，理解 AI Agent 的推理-行动-观察循环是如何工作的
  - icon: 🔧
    title: 四把手术刀
    details: Pi 只用 read / write / edit / bash 四个工具就能完成几乎所有编码任务，理解为什么少即是多
  - icon: 🌐
    title: 多 Provider 统一抽象
    details: 学习如何用一套代码同时支持 OpenAI、Anthropic、Google 等 15+ 模型提供商
  - icon: 💾
    title: 会话与记忆
    details: 掌握树状会话管理、上下文压缩、Compaction 等核心记忆机制
  - icon: 🧩
    title: 扩展系统
    details: 理解 Pi 的扩展生命周期、事件钩子、自定义工具注册等可插拔架构
  - icon: 🚀
    title: 动手实操
    details: 8 个渐进式 Demo + 1 个完整项目，所有代码均可运行，跟着做就能复现
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #5b8def 30%, #7c4dff);
}
</style>
