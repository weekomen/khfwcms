/* Public fallback content used when an older data/content.json has not yet
 * been opened and saved in the new CMS editor. */
window.KHB_DEFAULTS = Object.freeze({
  navigation: [
    { id: 'home', label: '首页', href: '#home', children: [] },
    { id: 'about', label: '关于课后邦', href: '#about', children: [
      { id: 'about-intro', label: '课后邦集团介绍', href: '#about', target: '', action: '' },
      { id: 'brochure', label: '公司展册', href: 'https://kehoubang.cn/profile/upload/pdf/3/index.html', target: 'blank', action: '' },
      { id: 'handbook', label: '课程手册', href: 'https://kehoubang.cn/profile/upload/pdf/1/index.html', target: 'blank', action: '' },
      { id: 'school-plan', label: '一校一案', href: 'https://kehoubang.cn/profile/upload/pdf/2/index.html', target: 'blank', action: '' },
      { id: 'team', label: '核心团队', href: '#team', target: '', action: '' }
    ] },
    { id: 'business', label: '集团核心业务', href: '#services', children: [
      { id: 'supply-chain', label: '课后邦供应链', href: '/content-page.html?type=business&id=supply-chain', target: 'blank', action: 'business' },
      { id: 'online-education', label: '线上素质教育', href: '/content-page.html?type=business&id=online-education', target: 'blank', action: 'business' },
      { id: 'education-street', label: '教育一条街', href: '/content-page.html?type=business&id=education-street', target: 'blank', action: 'business' },
      { id: 'youth-center', label: '青少年成长中心', href: '/content-page.html?type=business&id=youth-center', target: 'blank', action: 'business' },
      { id: 'ai-museum', label: '人工智能科技馆', href: '/content-page.html?type=business&id=ai-museum', target: 'blank', action: 'business' }
    ] },
    { id: 'courses', label: '课程资源库', href: '#course-catalog', children: [
      { id: 'aesthetic', label: '美育类', href: '#course-catalog', target: '', action: 'course-category', value: '美育类' },
      { id: 'puzzle', label: '益智类', href: '#course-catalog', target: '', action: 'course-category', value: '益智类' },
      { id: 'technology', label: '科技类', href: '#course-catalog', target: '', action: 'course-category', value: '科技类' },
      { id: 'craft', label: '手工类', href: '#course-catalog', target: '', action: 'course-category', value: '手工类' }
    ] },
    { id: 'news', label: '新闻资讯', href: '#news', children: [
      { id: 'group-news', label: '集团动态', href: '#news', target: '', action: 'news-group', value: 'group' },
      { id: 'industry-news', label: '行业洞察', href: '#news', target: '', action: 'news-group', value: 'industry' }
    ] },
    { id: 'venture', label: '智邻创投', href: '/content-page.html?type=venture&id=intro', children: [
      { id: 'venture-intro', label: '简介', href: '/content-page.html?type=venture&id=intro', target: '', action: 'venture' },
      { id: 'venture-dinner', label: '书院世家年夜饭', href: '/content-page.html?type=venture&id=new-year-dinner', target: '', action: 'venture' }
    ] },
    { id: 'contact', label: '联系我们', href: '#contact', children: [
      { id: 'contact-business', label: '商务合作', href: '#contact', target: '', action: 'contact-topic', value: 'business' },
      { id: 'contact-teachers', label: '师资合作', href: '#contact', target: '', action: 'contact-topic', value: 'teachers' },
      { id: 'contact-careers', label: '人才招聘', href: '#contact', target: '', action: 'contact-topic', value: 'careers' },
      { id: 'contact-info', label: '联系方式', href: '#contact', target: '', action: 'contact-topic', value: 'info' }
    ] }
  ],
  businessPages: [
    { id: 'supply-chain', title: '课后邦供应链', summary: '连接优质课程与服务资源，为学校和合作伙伴提供稳定的课程供给。', body: '围绕课程研发、资源整合与落地交付，建立从内容到服务的协同体系。', image: '/assets/logo.webp' },
    { id: 'online-education', title: '线上素质教育', summary: '用线上内容和数字化工具，让优质素质教育触达更多孩子。', body: '通过线上课程、学习支持和运营服务，补充线下教学场景，形成连续的学习体验。', image: '/assets/logo.webp' },
    { id: 'education-street', title: '教育一条街', summary: '汇聚多元教育服务，打造开放、友好的社区教育场景。', body: '以教育服务为纽带连接家庭、学校与社区，让课程、活动和成长支持在身边发生。', image: '/assets/logo.webp' },
    { id: 'youth-center', title: '青少年成长中心', summary: '关注青少年综合成长，提供课程、活动与陪伴支持。', body: '结合成长阶段和真实需求，提供兴趣发展、实践体验与成长规划等服务。', image: '/assets/logo.webp' },
    { id: 'ai-museum', title: '人工智能科技馆', summary: '把人工智能和科技实践带进真实场景，激发孩子的探索力。', body: '通过展陈、实验、工作坊和项目制学习，帮助学生理解科技、使用科技并创造科技。', image: '/assets/logo.webp' }
  ],
  courseCategories: [
    { id: 'aesthetic', title: '美育类', description: '在表达、阅读与艺术创作中，发现兴趣，感受美。', image: '/assets/course-aesthetic.webp' },
    { id: 'puzzle', title: '益智类', description: '在游戏、推理与对弈中，练习观察，探索思考的方法。', image: '/assets/course-puzzle.webp' },
    { id: 'technology', title: '科技类', description: '从科学实验到人工智能，在动手探索中认识科技。', image: '/assets/course-technology.webp' },
    { id: 'craft', title: '手工类', description: '在生活实践、手工创作与非遗体验中，感受劳动的价值。', image: '/assets/course-labor.webp' }
  ],
  venturePages: [
    { id: 'intro', title: '智邻创投简介', summary: '关注教育、科技与社区创新项目，连接伙伴与长期价值。', body: '智邻创投以教育服务和科技创新为关注方向，支持有真实需求、有长期价值的项目，让更多好想法在社区和校园落地。', image: '/assets/logo.webp' },
    { id: 'new-year-dinner', title: '书院世家年夜饭', summary: '在书院世家相聚，分享一桌年味，也分享人与人的温度。', body: '书院世家年夜饭是一场面向伙伴、家庭与社区的年度相聚活动。我们用一顿饭回望一年的同行，也为新一年的合作与成长举杯。', image: '/assets/hero.webp' }
  ],
  contactTopics: [
    { id: 'business', title: '商务合作', description: '课程落地、区域项目和品牌合作，欢迎与我们沟通。' },
    { id: 'teachers', title: '师资合作', description: '课程研发、授课服务和教师发展合作，可通过下方联系方式联系。' },
    { id: 'careers', title: '人才招聘', description: '期待教育、产品、技术和运营方向的伙伴加入课后邦。' },
    { id: 'info', title: '联系方式', description: '电话、邮箱和地址等公开联系方式见本页下方。' }
  ]
});

window.cloneKHBDefaults = () => JSON.parse(JSON.stringify(window.KHB_DEFAULTS));
