# Demo 源码总览

本教程包含 8 个渐进式 Demo，从最简单的 LLM 调用到完整的 Mini Agent。每个 Demo 都可以独立运行。

## Demo 列表

| Demo | 名称 | 核心知识点 | 代码量 |
|------|------|-----------|--------|
| [01](./demo-01/) | Hello LLM | LLM API 调用、流式响应 | ~80 行 |
| [02](./demo-02/) | Tool Calling | Function Calling 机制 | ~120 行 |
| [03](./demo-03/) | Agent Loop | ReAct 循环核心 | ~150 行 |
| [04](./demo-04/) | Read/Write/Bash | 四工具完整实现 | ~200 行 |
| [05](./demo-05/) | Multi Provider | 多 Provider 抽象 | ~250 行 |
| [06](./demo-06/) | Session & Memory | JSONL 会话 + Compaction | ~300 行 |
| [07](./demo-07/) | Skill System | 按需加载能力 | ~200 行 |
| [08](./demo-08/) | Mini Agent | 完整项目组装 | ~500 行 |

## 快速开始

```bash
# 克隆教程仓库
git clone <repo-url>
cd pi-agent-tutorial

# 进入任意 Demo 目录
cd demos/demo-01

# 安装依赖
npm install

# 设置 API Key
export OPENAI_API_KEY=sk-xxx

# 运行
npm run dev
```

## 技术栈

所有 Demo 统一使用：
- **TypeScript** —— 类型安全
- **tsx** —— 直接运行 TypeScript，无需编译
- **Node.js 18+** —— 原生 fetch 支持

## 学习建议

1. **按顺序学习**：每个 Demo 都建立在前一个的基础上
2. **先跑通再理解**：先确保代码能运行，再逐行理解
3. **动手修改**：尝试修改参数、添加功能、制造错误
4. **对比 Pi 源码**：教学版简化了很多，对比真实实现能学到更多
