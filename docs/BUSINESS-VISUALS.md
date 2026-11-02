# 集团核心业务配图说明

生成方式：内置 `image_gen`。七张图片用于业务概念场景展示，采用蓝白色教育场景插画；网页标题和正文保持独立、可编辑。网页素材按比例压缩为 WebP，原始生成 PNG 保留在本机生成工具输出目录。

| 业务 | 网页素材 | 尺寸 |
| --- | --- | --- |
| 课后邦课后服务进校供应链 | `/assets/business-supply-chain-v1.webp` | 1672 × 941 |
| 课后邦人工智能进校供应链 | `/assets/business-ai-school-supply-v1.webp` | 1672 × 941 |
| 线上AI伴学 | `/assets/business-online-ai-study-v1.webp` | 1672 × 941 |
| 线上素质教育 | `/assets/business-online-education-v1.webp` | 1672 × 941 |
| 教育一条街 | `/assets/business-education-street-v1.webp` | 1672 × 941 |
| 青少年成长中心 | `/assets/business-youth-center-v1.webp` | 1672 × 940 |
| 人工智能科技馆 | `/assets/business-ai-museum-v1.webp` | 1672 × 941 |

六个进校配套详情页分别使用对应进校业务的配图。运行数据、初始化数据和公开快照均记录素材路径；可在 CMS 更换。已有上传长图与既定页面跳转保留。

## 完整提示词组合

下列公共提示词分别与七个 Subject 组合，构成实际调用的七条提示词。

```text
Create one finished, premium editorial illustration for the Chinese education company Kehoubang's corporate website. Wide landscape 16:9 composition, high resolution. A cohesive sophisticated architectural miniature / semi-realistic 3D illustration, NOT a photograph: warm human presence, matte physical materials, natural soft daylight, elegant cobalt blue and cyan accents, ivory white architecture, a little warm amber. Detailed and credible education setting, calm uncluttered composition, no sci-fi neon. The main activity is in the center-right; leave the left quarter visually quieter for HTML caption overlay. Keep important subjects in the central 60% vertically so the banner can crop to a wide strip or a square on phones. No text, no letters, no numbers, no logos, no watermarks, no arrows or infographic labels, no collage or split panels. Brand mood: modern, professional, welcoming, precise.
```

### 课后邦课后服务进校供应链

```text
Subject: After-school services entering schools: an inviting modern primary-school activity classroom, a female teacher guiding four stylized children around one shared table doing creative art and small engineering construction, organized course material kits and books on tidy shelves, a discreet tablet on the teacher's side. Make coordinated courses, teaching support and school delivery immediately understandable. A real-feeling school interior rather than a warehouse.
```

### 课后邦人工智能进校供应链

```text
Subject: Artificial-intelligence education entering schools: a modern primary-school STEM classroom with one teacher and four stylized children collaborating around a small tabletop educational robot and simple sensors, two tablets displaying only abstract shapes and graphs, one wall display with an abstract learning diagram. Emphasize practical classroom teaching and helpful technology; no giant humanoid robot, no fantasy holograms.
```

### 线上AI伴学

```text
Subject: Online AI-supported study at home: one stylized school-age learner at an ergonomic light-wood desk using a tablet and writing in an open notebook, a parent gently accompanying nearby. A small friendly abstract blue digital-assistant symbol is visible only as a simple shape on the tablet screen, with a few modest progress tiles containing geometric shapes and no lettering. Cozy home study corner, organized books, quiet focused learning, technology assisting human learning.
```

### 线上素质教育

```text
Subject: Online enrichment education: a bright home creative studio with two stylized children engaged in a live video art-and-science workshop on a large tablet, one child painting and one building colorful geometric blocks, useful craft materials, a small plant and books. A tiny teacher portrait appears naturally on the screen, surrounded only by abstract colored shapes. Communicate arts, logic, technology and hands-on creativity through tangible activities rather than floating icons.
```

### 教育一条街

```text
Subject: A community education street: a beautifully designed pedestrian neighborhood street seen at a gentle isometric aerial angle, three connected storefront learning spaces opening onto a small shared courtyard, art studio, maker classroom and reading space recognizable through large windows. Stylized families strolling, a few children participating in a small outdoor craft table, trees, benches and warm welcoming community life. Human-scale architecture, blue-white facades, all shop signs blank, not a shopping mall advertisement.
```

### 青少年成长中心

```text
Subject: A youth development center: a generous contemporary interior with connected zones for collaborative project making, reading and informal presentation, a mentor and a small group of stylized young people working together on a tangible creative model, another pair reading nearby. Curved cobalt-blue seating, warm wood tables, bookshelves and daylight. Convey belonging, discovery, collaboration and long-term growth without sports stadiums or trophies.
```

### 人工智能科技馆

```text
Subject: An artificial intelligence science museum: a refined contemporary interactive exhibition space with a compact robotic arm demonstration, a small educational mobile robot, an accessible interactive screen showing abstract geometric computer-vision shapes, and a stylized parent with two curious children exploring with a guide. Large clean white curved exhibition architecture, cobalt blue exhibit plinths, subtle cyan details, bright daylight-like illumination. Credible hands-on science discovery, no space station or fantasy hologram.
```
