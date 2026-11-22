# 鼓房课表 · Drum Studio Schedule

新宿架子鼓老师的「学生看空档 + 老师排课 + 练鼓公示」网页。中文界面，手机优先。

## 当前状态

这是一个**可交互的前端原型**：

- 公开页、老师后台、可视化日历都已完成
- 数据保存在浏览器 `localStorage`，刷新不丢，但**换设备不同步**
- 本地老师入口需要密码；Supabase 项目和课表跨设备同步尚未配置

## 本地运行

需要 Node.js 18+。

```bash
cd "/Users/yumi/Documents/Projects(yumi项目)/shared-apps/drum-studio"

npm install
npm run dev
# 打开 http://127.0.0.1:5173
```

构建和预览：

```bash
npm run build
npm run preview
```

如果这台机器上 `npm install` 报 npm cache 权限错误，可以用项目内缓存：

```bash
npm install --cache .npm-cache
```

## 老师登录

学生直接打开首页。老师点击「老师入口」后只输入密码，退出后台后需要重新登录。

本地开发和预览由 Vite 服务验证 `.env.local` 中的 `DRUM_TEACHER_PASSWORD`。
配置以下变量后，登录改由 Supabase Auth 验证：

- `VITE_SUPABASE_URL`：项目 URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`：publishable key 或旧版 anon key
- `VITE_DRUM_TEACHER_EMAIL`：已在 Auth 中创建的老师邮箱
- `VITE_DRUM_TEACHER_ID`：该老师账号的 Auth User UID

老师密码在 Supabase Auth 账号中设置。启用云端模式前，在目标项目的 SQL Editor 运行 `supabase/drum-studio.sql`，将两个零值 UUID 替换为专用老师账号的 Auth User UID。然后设置对应的 GitHub Actions 仓库变量并重新部署。

云端模式直接读写 Supabase，学生端每 30 秒刷新公开课表。现有本地课表和体验数据不会自动上传。

## 目录结构

```text
drum-studio/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig*.json
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx        # React 入口
    ├── App.tsx         # 页面骨架、公开页、老师后台、时段表单、联系弹窗
    ├── calendar.tsx    # 周概览条、单日时间轴、桌面周网格
    ├── types.ts        # Entry / StudioLocation 类型
    ├── utils.ts        # 时间格式化、区间合并/相减、freeGaps
    ├── mock.ts         # 新宿地点 + 本周示例数据
    └── styles.css      # 全部样式（无 UI 框架）
```

## 数据怎么存的

- `localStorage` key：`drum-studio-proto-v1`
- 首次打开会用 `src/mock.ts` 生成当前周的示例数据
- 老师后台底部有「重置示例数据」
- 换浏览器、换手机、清缓存都会看不到之前的修改

正式版计划换成 Supabase，表名统一加 `drum_` 前缀，避免影响已有项目。

## 体验版与部署

- 右上角「体验版」或在地址末尾加 `#demo`，可以试用学生课表、学生名单和老师排课。
- 体验版使用独立的示例数据，修改只保留在本次页面会话中。请使用示例姓名。
- GitHub Pages 由 `.github/workflows/pages.yml` 构建发布。静态站点可直接访问体验版。
- GitHub Pages 无法运行本地 Vite 密码服务。应用数据库脚本并配置仓库变量后，可启用 Supabase 登录和课表同步。
- 正式数据在当前版本保存在浏览器。已有课程的姓名也可在老师的选单中复用。

## 文档

- 需求说明：[REQUIREMENTS.md](./REQUIREMENTS.md)
- 给 GPT 的修改提示：[GPT_PROMPT.md](./GPT_PROMPT.md)

## 已知取舍

- 时间粒度固定 30 分钟，只能选整点或半点
- 同一地点同一时间只允许一个「课程 / 练鼓 / 休息」；「可约」是背景层，允许被课程覆盖
- 鼓房只是文字信息，不做鼓房冲突检测
- 公开页不显示学生姓名和备注
- 周次、今天和「现在」线统一按东京时区（Asia/Tokyo）计算
