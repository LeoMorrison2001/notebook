import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "LEO知识库-破釜沉舟",
  description: "记录我所有知识的地方，AI时代构建自己的知识库很重要！破釜沉舟，死也要肝完！",

  // 默认开启暗黑模式
  appearance: 'dark',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '首页', link: '/' },
      {
        text: '技术栈',
        items: [
          { text: 'Java', link: '/tech/java' },
          { text: 'MySQL', link: '/tech/mysql' }
        ]
      },
      {
        text: 'Wemirr Platform',
        items: [
          { text: '基础框架', link: '/wemirr-platform/基础框架' },
          { text: '核心模块', link: '/wemirr-platform/common-framework-core-核心模块' },
          { text: '数据层', link: '/wemirr-platform/数据访问层详解' },
          { text: '安全与通信', link: '/wemirr-platform/登录与鉴权流程' },
        ]
      }
    ],

    sidebar: {
      '/tech/': [
        {
          text: '技术栈',
          items: [
            { text: 'Java', link: '/tech/java' },
            {
              text: 'MySQL',
              items: [
                { text: '完整版', link: '/tech/mysql' },
                { text: '核心知识 20%', link: '/tech/mysql-20-percent' }
              ]
            }
          ]
        }
      ],
      '/wemirr-platform/': [
        {
          text: 'Wemirr Platform',
          items: [
            { text: '基础框架', link: '/wemirr-platform/基础框架' }
          ]
        },
        {
          text: '核心基础',
          items: [
            { text: 'Common Framework Core', link: '/wemirr-platform/common-framework-core-核心模块' }
          ]
        },
        {
          text: '数据层',
          items: [
            { text: '数据访问层详解', link: '/wemirr-platform/数据访问层详解' },
            { text: '缓存层详解', link: '/wemirr-platform/缓存层详解' },
            { text: '数据变更日志详解', link: '/wemirr-platform/数据变更日志详解' }
          ]
        },
        {
          text: '安全与通信',
          items: [
            { text: '登录与鉴权流程', link: '/wemirr-platform/登录与鉴权流程' },
            { text: '多租户路由流程', link: '/wemirr-platform/多租户路由流程' },
            { text: 'Feign 远程调用详解', link: '/wemirr-platform/Feign远程调用详解' }
          ]
        },
        {
          text: '业务增强',
          items: [
            { text: 'Excel 处理详解', link: '/wemirr-platform/Excel处理详解' },
            { text: 'WebSocket 详解', link: '/wemirr-platform/WebSocket详解' },
            { text: 'PDF 处理详解', link: '/wemirr-platform/PDF处理详解' }
          ]
        }
      ],
      '/': [
        {
          text: '导航',
          items: [
            { text: '首页', link: '/' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/LeoMorrison2001/notebook' }
    ]
  }
})
