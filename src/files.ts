import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export interface OpenedFile {
  path: string;
  name: string;
  content: string;
}

const MD_FILTERS = [{ name: "Markdown", extensions: ["md", "markdown", "mdown", "txt"] }];

export function fileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** 打开文件对话框 + 读取内容 */
export async function openFileDialog(): Promise<OpenedFile | null> {
  const selected = await open({ multiple: false, filters: MD_FILTERS });
  if (!selected || typeof selected !== "string") return null;
  return readFile(selected);
}

export async function readFile(path: string): Promise<OpenedFile> {
  const content = await invoke<string>("read_text_file", { path });
  return { path, name: fileName(path), content };
}

/** 写文件 */
export async function writeFile(path: string, content: string): Promise<void> {
  await invoke("write_text_file", { path, content });
}

/** 另存为对话框，返回选定路径 */
export async function saveFileDialog(defaultName: string): Promise<string | null> {
  const path = await save({ defaultPath: defaultName, filters: MD_FILTERS });
  return path;
}
