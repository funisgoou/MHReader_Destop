# MHReader 项目约定

## 验证方式

- 任何需要控制电脑（点击窗口、截图、键盘鼠标操作等 Computer Use / kimi-cu 类操作）的验证步骤，都不要由 AI 自动执行，改为列出验证步骤请用户手动验证。
- AI 只负责：改代码、跑构建/类型检查/单元测试等命令行可完成的验证，并把需要人工确认的操作步骤和预期结果写清楚。

## 常用命令

- 前端类型检查：`npx tsc --noEmit`
- 前端构建：`npm run build`
- 桌面端联调：`npm run tauri dev`（需要本机 Rust + MSVC Build Tools，首次编译约 2 分钟）
- 打包：`npm run tauri build`
