# 鼓房课表（drum-studio）

新宿架子鼓老师用的约课网页：学生看空档、老师排课、练鼓公示。中文界面，手机优先。详细见 `README.md`、`REQUIREMENTS.md`。

## 给 AI 的说明（Claude、Codex、DeepSeek Harness 共用）

- 用户不是程序员，用中文、口语化解释；每步先说再做，等用户同意。
- **推送到 `main` = 自动发布**（`.github/workflows/pages.yml` 发布到 GitHub Pages），推送前必须问用户。
- 技术：React + Vite + TypeScript，Node 22。`npm install` → `npm run dev`（http://127.0.0.1:5173）。
- 数据：老师排课接了 Supabase（`supabase/drum-studio.sql`）。密钥、老师密码不能入库。
- 动手前先 `git status`，不要覆盖其他 AI 没提交的改动。
- 历史：2026-11 在 DeepSeek Harness 的 dsh-scratch 工作区里做的，2026-11-23 搬到这里。DSH 里旧对话提到的路径已经失效。
