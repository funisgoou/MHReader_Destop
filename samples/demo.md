# MHReader 功能演示

这是一个用于联调测试的 **Markdown** 示例文档，覆盖常用语法。

## 1. 文本样式

支持 **加粗**、*斜体*、~~删除线~~、`行内代码`，以及 [链接](https://tauri.app)。

## 2. 列表

### 无序列表

- 新建文件（Ctrl+N）
- 打开文件（Ctrl+O）
- 保存文件（Ctrl+S）

### 有序列表

1. 安装 Rust
2. npm install
3. tauri dev

### 任务列表

- [x] 多标签页
- [x] 自定义主题
- [ ] 发布 v1.0

## 3. 代码块

```rust
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}
```

## 4. 表格

| 功能 | 快捷键 | 状态 |
| --- | --- | --- |
| 搜索 | Ctrl+F | 已实现 |
| 大纲 | Ctrl+B | 已实现 |
| 缩放 | Ctrl+= / Ctrl+- | 已实现 |

## 5. 引用

> 简洁即美。
> —— 某位工程师

## 6. 搜索测试词

苹果 香蕉 苹果 橘子 苹果，大纲跳转测试，缩放测试，主题切换测试。
