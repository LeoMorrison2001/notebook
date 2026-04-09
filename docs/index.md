---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "LEO知识库"
  text: "记录即思考，书写即成长"
  tagline: "AI时代构建个人第二大脑！破釜沉舟，死也要肝完！"
  actions:
    - theme: brand
      text: 🚀 开始阅读
      link: /tech/java
    - theme: alt
      text: 📖 Wemirr Platform
      link: /wemirr-platform/基础框架

features:
  - title: 🧠 体系化思考
    details: 拒绝碎片化信息，在这里将所有学到的知识结构化、体系化，形成自己的知识网络。
  - title: 🤖 AI 时代原住民
    details: 记录 AI 提示词工程、大模型应用探索，以及如何利用 AI 提升个人生产力。
  - title: ⚔️ 破釜沉舟死磕
    details: 学如逆水行舟，不进则退。立下此库，记录每一次技术攻坚与认知迭代的脚印。
---

<style>
/* 如果你喜欢，还可以加一点简单的样式覆盖，比如让标题变得更酷炫 */
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #bd34fe 30%, #41d1ff);
}

/* 缩小 hero text 字体 - 响应式 */
.VPHero .text {
  font-size: clamp(28px, 4vw, 50px) !important;
}

</style>