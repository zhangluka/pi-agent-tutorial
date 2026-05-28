import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/pi-agent-tutorial/',
  lang: 'zh-CN',
  title: 'Pi Agent 原理与实现',
  description: '从零到一实现一个 AI Agent —— 基于 Pi 的渐进式教程',

  head: [
    ['link', { rel: 'icon', href: '/pi-agent-tutorial/favicon.svg' }],
  ],

  themeConfig: {
    logo: '/pi-agent-tutorial/logo.svg',
    siteTitle: 'Pi Agent 教程',

    nav: [
      { text: '首页', link: '/' },
      { text: '开始学习', link: '/guide/ch01-what-is-agent/' },
      { text: 'Demo 源码', link: '/demos/' },
      {
        text: '相关链接',
        items: [
          { text: 'Pi 官网', link: 'https://pi.dev' },
          { text: 'GitHub 仓库', link: 'https://github.com/earendil-works/pi' },
          { text: '官方文档', link: 'https://pi.dev/docs/latest' },
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '开篇',
          items: [
            { text: '教程简介', link: '/guide/' },
          ]
        },
        {
          text: '第一部分：核心概念',
          collapsed: false,
          items: [
            { text: 'Ch01 什么是 AI Agent', link: '/guide/ch01-what-is-agent/' },
            { text: 'Ch02 Pi 的设计哲学', link: '/guide/ch02-pi-philosophy/' },
            { text: 'Ch03 第一次 LLM 调用', link: '/guide/ch03-first-llm-call/' },
            { text: 'Ch04 Agent Loop：核心循环', link: '/guide/ch04-agent-loop/' },
          ]
        },
        {
          text: '第二部分：核心机制',
          collapsed: false,
          items: [
            { text: 'Ch05 工具系统：read / write / edit / bash', link: '/guide/ch05-tool-system/' },
            { text: 'Ch06 多 Provider 支持', link: '/guide/ch06-multi-provider/' },
            { text: 'Ch07 会话与记忆系统', link: '/guide/ch07-session-memory/' },
            { text: 'Ch08 上下文工程', link: '/guide/ch08-context-engineering/' },
          ]
        },
        {
          text: '第三部分：扩展体系',
          collapsed: false,
          items: [
            { text: 'Ch09 扩展系统架构', link: '/guide/ch09-extension-system/' },
            { text: 'Ch10 Skill 系统', link: '/guide/ch10-skill-system/' },
            { text: 'Ch11 TUI 与交互设计', link: '/guide/ch11-tui-overview/' },
          ]
        },
        {
          text: '第四部分：实战组装',
          collapsed: false,
          items: [
            { text: 'Ch12 完整项目组装', link: '/guide/ch12-full-project/' },
            { text: 'Ch13 运行与测试', link: '/guide/ch13-run-and-test/' },
            { text: 'Ch14 总结与扩展方向', link: '/guide/ch14-summary/' },
          ]
        }
      ],
      '/demos/': [
        {
          text: 'Demo 源码',
          items: [
            { text: 'Demo 总览', link: '/demos/' },
            { text: 'Demo 01 - Hello LLM', link: '/demos/demo-01/' },
            { text: 'Demo 02 - Tool Calling', link: '/demos/demo-02/' },
            { text: 'Demo 03 - Agent Loop', link: '/demos/demo-03/' },
            { text: 'Demo 04 - Read / Write / Bash', link: '/demos/demo-04/' },
            { text: 'Demo 05 - Multi Provider', link: '/demos/demo-05/' },
            { text: 'Demo 06 - Session & Memory', link: '/demos/demo-06/' },
            { text: 'Demo 07 - Skill System', link: '/demos/demo-07/' },
            { text: 'Demo 08 - Mini Agent (完整版)', link: '/demos/demo-08/' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/earendil-works/pi' }
    ],

    footer: {
      message: '基于 Pi Agent 的渐进式教学教程',
      copyright: 'Released under the MIT License.'
    },

    search: {
      provider: 'local'
    },

    outline: {
      level: [2, 3],
      label: '本章目录'
    },

    lastUpdated: {
      text: '最后更新'
    },

    docFooter: {
      prev: '上一章',
      next: '下一章'
    },

    returnToTopLabel: '返回顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
  },

  markdown: {
    lineNumbers: true,
  },
})
