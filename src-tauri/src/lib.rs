use std::fs;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

/// 启动时待打开的文件（来自命令行参数/文件关联）
static PENDING_FILES: Mutex<Vec<String>> = Mutex::new(Vec::new());

fn is_md_file(arg: &str) -> bool {
    let lower = arg.to_lowercase();
    (lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".mdown") || lower.ends_with(".txt"))
        && fs::metadata(arg).map(|m| m.is_file()).unwrap_or(false)
}

fn collect_md_files(args: &[String]) -> Vec<String> {
    args.iter().skip(1).filter(|a| is_md_file(a)).cloned().collect()
}

/// 读取 UTF-8 文本文件
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("读取文件失败 {path}: {e}"))
}

/// 写入 UTF-8 文本文件
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("写入文件失败 {path}: {e}"))
}

/// 前端启动后拉取待打开文件（双击 .md 冷启动场景）
#[tauri::command]
fn take_pending_files() -> Vec<String> {
    std::mem::take(&mut *PENDING_FILES.lock().unwrap())
}

/// 读取 exe 同级 themes 目录下的用户自定义主题（*.json），返回文件内容列表
#[tauri::command]
fn read_user_themes() -> Vec<String> {
    let mut out = Vec::new();
    let Ok(exe) = std::env::current_exe() else { return out };
    let Some(dir) = exe.parent().map(|p| p.join("themes")) else {
        return out;
    };
    let Ok(entries) = fs::read_dir(dir) else { return out };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(content) = fs::read_to_string(&path) {
                out.push(content);
            }
        }
    }
    out
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 首个实例：先缓存启动参数里的 md 文件
    let initial: Vec<String> = collect_md_files(&std::env::args().collect::<Vec<_>>());
    *PENDING_FILES.lock().unwrap() = initial;

    tauri::Builder::default()
        // 单实例：后续双击 md 文件时，在已有窗口里开新标签
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
            let files = collect_md_files(&args);
            if !files.is_empty() {
                let _ = app.emit("open-files", files);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            take_pending_files,
            read_user_themes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
