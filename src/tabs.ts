import {
  mountEditor,
  destroyEditor,
  getMarkdown,
  setReadonly,
  onMarkdownUpdated,
  onEditorReady,
  setDirProvider,
} from "./editor";
import { openFileDialog, writeFile, saveFileDialog, readFile, fileName } from "./files";
import { updateOutline, clearOutline } from "./outline";
import { resetSearch } from "./search";
import { transformHtmlImages } from "./markdownFix";
import { askSave } from "./dialog";

export interface Tab {
  id: string;
  path: string | null;
  name: string;
  markdown: string;
  savedMarkdown: string;
  readonly: boolean;
}

const tabs: Tab[] = [];
let activeId: string | null = null;
let seq = 0;
let suppressDirty = false;
let lastScrolledActiveId: string | null = null;

export function getTabs(): Tab[] {
  return tabs;
}

export function getActiveTab(): Tab | null {
  return tabs.find((t) => t.id === activeId) ?? null;
}

function isDirty(t: Tab): boolean {
  return t.markdown !== t.savedMarkdown;
}

export function isActiveReadonly(): boolean {
  return getActiveTab()?.readonly ?? false;
}

/** 当前标签文件所在目录（用于解析相对路径图片）；未保存标签返回 null */
export function getActiveFileDir(): string | null {
  const t = getActiveTab();
  if (!t?.path) return null;
  const idx = Math.max(t.path.lastIndexOf("\\"), t.path.lastIndexOf("/"));
  return idx > 0 ? t.path.slice(0, idx) : null;
}

/* ---------------- 渲染 ---------------- */

function renderTabs(): void {
  const container = document.getElementById("tabs");
  if (!container) return;
  container.innerHTML = "";

  const n = tabs.length;

  tabs.forEach((t) => {    const el = document.createElement("div");
    el.className = "tab" + (t.id === activeId ? " active" : "");
    el.title = t.path ?? t.name;

    const name = document.createElement("span");
    name.className = "tab-name";
    name.textContent = t.name;
    el.appendChild(name);

    if (isDirty(t)) {
      const dot = document.createElement("span");
      dot.className = "tab-dirty";
      dot.textContent = "●";
      el.appendChild(dot);
    }

    const close = document.createElement("button");
    close.className = "tab-close";
    close.textContent = "✕";
    close.title = "关闭 (Ctrl+W)";
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      void closeTab(t.id);
    });
    el.appendChild(close);

    el.addEventListener("click", () => void activateTab(t.id));
    container.appendChild(el);
  });

  // 仅在切换标签时滚动定位，避免每次输入都触发滚动闪烁
  if (activeId !== lastScrolledActiveId) {
    lastScrolledActiveId = activeId;
    const activeEl = container.querySelector(".tab.active");
    activeEl?.scrollIntoView({ inline: "center", block: "nearest" });
  }

  const empty = document.getElementById("editor-empty");
  empty?.classList.toggle("hidden", n > 0);
}

function renderStatus(): void {
  const el = document.getElementById("status-file");
  if (!el) return;
  const t = getActiveTab();
  if (!t) {
    el.textContent = "未打开文件";
    return;
  }
  const chars = t.markdown.replace(/\s/g, "").length;
  const lines = t.markdown === "" ? 0 : t.markdown.split("\n").length;
  const dirty = isDirty(t) ? " · 未保存" : "";
  el.textContent = `${t.name}${dirty} · ${chars} 字 · ${lines} 行${t.readonly ? " · 只读" : ""}`;
}

function renderAll(): void {
  renderTabs();
  renderStatus();
}

/* ---------------- 标签操作 ---------------- */

async function activateTab(id: string): Promise<void> {
  if (id === activeId) return;
  activeId = id;
  const t = getActiveTab();
  if (!t) return;
  suppressDirty = true;
  await mountEditor(t.markdown);
  setReadonly(t.readonly);
  suppressDirty = false;
  updateOutline(t.markdown);
  resetSearch();
  renderAll();
}

export async function newTab(): Promise<void> {
  const tab: Tab = {
    id: `tab-${++seq}`,
    path: null,
    name: `未命名-${seq}.md`,
    markdown: "",
    savedMarkdown: "",
    readonly: false,
  };
  tabs.push(tab);
  activeId = tab.id;
  suppressDirty = true;
  await mountEditor("");
  suppressDirty = false;
  updateOutline("");
  resetSearch();
  renderAll();
}

export async function openFile(): Promise<void> {
  const file = await openFileDialog();
  if (!file) return;
  await openPath(file.path, file.content, file.name);
}

export async function openPath(path: string, content: string, name?: string): Promise<void> {
  const existing = tabs.find((t) => t.path === path);
  if (existing) {
    await activateTab(existing.id);
    return;
  }
  const fixed = transformHtmlImages(content);
  const tab: Tab = {
    id: `tab-${++seq}`,
    path,
    name: name ?? fileName(path),
    markdown: fixed,
    savedMarkdown: fixed,
    readonly: false,
  };
  tabs.push(tab);
  activeId = tab.id;
  suppressDirty = true;
  await mountEditor(fixed);
  suppressDirty = false;
  updateOutline(fixed);
  resetSearch();
  renderAll();
}

export async function closeTab(id: string): Promise<boolean> {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return true;
  const t = tabs[idx];
  if (isDirty(t)) {
    const r = await askSave(t.name);
    if (r === "cancel") return false;
    if (r === "save") {
      if (t.id !== activeId) await activateTab(t.id);
      const ok = await saveActive();
      if (!ok) return false; // 另存对话框被取消
    }
  }
  tabs.splice(idx, 1);
  if (activeId === id) {
    activeId = null;
    if (tabs.length > 0) {
      await activateTab(tabs[Math.min(idx, tabs.length - 1)].id);
    } else {
      await destroyEditor();
      clearOutline();
      resetSearch();
      renderAll();
    }
  } else {
    renderAll();
  }
  return true;
}

export async function saveActive(): Promise<boolean> {
  const t = getActiveTab();
  if (!t) return false;
  t.markdown = getMarkdown();
  let path = t.path;
  if (!path) {
    path = await saveFileDialog(t.name);
    if (!path) return false;
    t.path = path;
    t.name = fileName(path);
  }
  await writeFile(path, t.markdown);
  t.savedMarkdown = t.markdown;
  renderAll();
  return true;
}

export async function saveActiveAs(): Promise<boolean> {
  const t = getActiveTab();
  if (!t) return false;
  t.markdown = getMarkdown();
  const path = await saveFileDialog(t.name);
  if (!path) return false;
  t.path = path;
  t.name = fileName(path);
  await writeFile(path, t.markdown);
  t.savedMarkdown = t.markdown;
  renderAll();
  return true;
}

export function toggleReadonly(): void {
  const t = getActiveTab();
  if (!t) return;
  t.readonly = !t.readonly;
  setReadonly(t.readonly);
  renderStatus();
}

/** 关闭窗口前逐个询问未保存文件，全部处理完才真正退出 */
export async function requestClose(): Promise<void> {
  const dirty = tabs.filter((t) => isDirty(t));
  for (const t of dirty) {
    if (t.id !== activeId) await activateTab(t.id);
    const r = await askSave(t.name);
    if (r === "cancel") return;
    if (r === "save") {
      const ok = await saveActive();
      if (!ok) return; // 另存对话框被取消
    }
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().destroy();
}

/** 供命令行/拖拽等方式直接打开文件 */
export async function openFileByPath(path: string): Promise<void> {
  const file = await readFile(path);
  await openPath(file.path, file.content, file.name);
}

/* ---------------- 初始化 ---------------- */

export function initTabs(): void {
  setDirProvider(getActiveFileDir);
  onMarkdownUpdated((md) => {
    const t = getActiveTab();
    if (!t || suppressDirty) return;
    t.markdown = md;
    renderTabs();
    renderStatus();
    updateOutline(md);
  });
  onEditorReady(() => {
    renderStatus();
  });
  document.getElementById("tab-new")?.addEventListener("click", () => void newTab());
  renderAll();
}
