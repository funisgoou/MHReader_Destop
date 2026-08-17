# MHReader

一款基于 **Rust + Tauri 2** 的 Windows 桌面 Markdown 阅读编辑器，类似 Typora 的所见即所得体验。

## 功能

- **所见即所得编辑**：基于 Milkdown Crepe（ProseMirror），输入即渲染
- **多标签页**：多个文档共用一个窗口，标签从左排成一行，当前标签放大加粗突出；未保存标签显示绿点
- **新建 / 打开 / 保存**：`Ctrl+N` / `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S`
- **自定义主题**：内置 默认亮 / 护眼绿 / 暗夜 三套主题；状态栏右侧点击可循环切换，选择持久化。支持用户自定义主题——在程序同级目录（exe 旁边）新建 `themes` 文件夹，放入主题 JSON 后重启即可在菜单中看到，参考 `themes/my-theme.example.json`

### 主题 JSON 格式

```json
{
  "name": "my-theme",
  "label": "我的主题",
  "vars": {
    "--bg": "#fdf6e3",
    "--bg-soft": "#f5edda",
    "--bg-hover": "#ece1c8",
    "--fg": "#5b4636",
    "--fg-dim": "#9b8a74",
    "--accent": "#b58900",
    "--accent-soft": "rgba(181, 137, 0, 0.16)",
    "--border": "#e3d5b8",
    "--shadow": "rgba(91, 70, 54, 0.15)"
  }
}
```

`name` 与内置主题（default / eyes-green / dark）相同时会覆盖内置主题。
- **搜索**：`Ctrl+F` 全文搜索，匹配高亮，Enter / Shift+Enter 跳转
- **缩放**：`Ctrl+=` / `Ctrl+-` / `Ctrl+0`，或状态栏按钮
- **大纲**：`Ctrl+B` 开关左侧大纲面板，点击标题直达定位

## 技术栈

- 后端：Rust + Tauri 2（文件读写命令、无边框窗口）
- 前端：Vite + TypeScript + Milkdown Crepe
- 渲染：系统 WebView2

## 开发

前置要求：Node.js、Rust（stable-msvc）、Visual Studio Build Tools（C++ 工作负载）、WebView2

```bash
npm install
npm run tauri dev
```

## 打包

```bash
npm run tauri build
```

产物在 `src-tauri/target/release/`（便携 exe）与 `src-tauri/target/release/bundle/nsis/`（安装包）。

## 项目结构

```
src/            前端模块（editor/tabs/files/outline/search/zoom/theme/menu/titlebar）
src/styles/     布局与排版样式
themes/         主题定义（JSON 形式的 CSS 变量）
src-tauri/      Tauri 后端（Rust）
samples/        示例 Markdown
```

## License

MIT
