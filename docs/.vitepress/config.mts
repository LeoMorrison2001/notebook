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
      }
    ],

    sidebar: {
      '/tech/': [
        {
          text: '技术栈',
          items: [
            { text: 'Java', link: '/tech/java' },
            { text: 'MySQL', link: '/tech/mysql' }
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
