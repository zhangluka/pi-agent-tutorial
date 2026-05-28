---
layout: home

hero:
  name: "Pi Agent 原理与实现"
  text: "从零到一实现一个 AI Agent"
  tagline: 基于 Pi 的设计哲学，通过 8 个渐进式 Demo 和 14 章教程，亲手构建一个保留核心思想的 AI Agent
  actions:
    - theme: brand
      text: 开始学习
      link: /guide/ch01-what-is-agent/
    - theme: alt
      text: 查看 Demo 源码
      link: /demos/

features:
  - title: Agent 核心循环
    details: 从 ReAct 模式到 Agent Loop，理解推理-行动-观察循环是如何驱动 Agent 自主完成任务的
  - title: 极简工具设计
    details: Pi 只用 read、write、edit、bash 四个工具覆盖所有编码场景——理解为什么少即是多
  - title: 多 Provider 抽象
    details: 一套代码同时支持 OpenAI、Anthropic、Google 等 15+ 模型提供商，中途无缝切换
  - title: 会话与记忆
    details: JSONL 树状会话存储、上下文自动压缩（Compaction）、分支探索与合并
  - title: 可插拔扩展
    details: 生命周期钩子、自定义工具注册、Skill 按需加载——核心极简，扩展无限
  - title: 动手实操
    details: 8 个渐进式 Demo + 1 个完整项目，所有代码均可运行，跟着教程从零复现
---
