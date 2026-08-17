# MHReader 项目约定

## 验证方式

你自己用computer\_use或者kimi WebBridge验证。如果这两个不能使用，你先排查原因，把这两个弄正常再验证。

## 常用命令

* 前端类型检查：`npx tsc --noEmit`
* 前端构建：`npm run build`
* 桌面端联调：`npm run tauri dev`（需要本机 Rust + MSVC Build Tools，首次编译约 2 分钟）
* 打包：`npm run tauri build`

