import "./styles/base.css";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

import { message } from "@tauri-apps/plugin-dialog";

import { initTheme, applyTheme, getCurrentTheme } from "./theme";
import { initTitlebar } from "./titlebar";
import { initZoom, zoomIn, zoomOut, zoomReset } from "./zoom";
import { initMenu } from "./menu";
import { initSearch, openSearch, closeSearch, isSearchOpen } from "./search";
import { initTabs, newTab, openFile, openFileByPath, saveActive, saveActiveAs, closeTab, getActiveTab, getRecentFiles, openRecentFile, activateAdjacentTab, toggleReadonly, isActiveReadonly, requestClose } from "./tabs";
import { toggleOutline, isOutlineCollapsed, initOutlineTracking, syncOutlineActive } from "./outline";
import { initContextMenu, editorActions } from "./contextmenu";
import { exportHtml } from "./exportHtml";
import { runCommand, onEditorReady } from "./editor";
import { wrapInHeadingCommand, createCodeBlockCommand } from "@milkdown/kit/preset/commonmark";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

function initShortcuts(): void {
  window.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) {
      if (e.key === "Escape" && isSearchOpen()) closeSearch();
      return;
    }
    const key = e.key.toLowerCase();
    const active = getActiveTab();
    // 输入框/对话框内不触发全局快捷键
    const target = e.target as HTMLElement | null;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    // Ctrl+Tab 切换标签
    if (key === "tab") {
      e.preventDefault();
      void activateAdjacentTab(e.shiftKey ? -1 : 1);
      return;
    }
    // Ctrl+1..6 标题级别（Typora 风格）
    if (/^[1-6]$/.test(e.key) && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      runCommand(wrapInHeadingCommand, Number(e.key));
      return;
    }
    switch (true) {
      case key === "n":
        e.preventDefault();
        void newTab();
        break;
      case key === "o":
        e.preventDefault();
        void openFile();
        break;
      case key === "s" && e.shiftKey:
        e.preventDefault();
        void saveActiveAs();
        break;
      case key === "s":
        e.preventDefault();
        void saveActive();
        break;
      case key === "w":
        e.preventDefault();
        if (active) void closeTab(active.id);
        break;
      case key === "f":
        e.preventDefault();
        if (active) openSearch();
        break;
      case key === "b" && e.shiftKey:
        e.preventDefault();
        toggleOutline();
        break;
      case key === "t" && !e.shiftKey:
        e.preventDefault();
        void editorActions.insertTable();
        break;
      case key === "k" && e.shiftKey:
        e.preventDefault();
        runCommand(createCodeBlockCommand);
        break;
      case key === "k":
        e.preventDefault();
        editorActions.insertLink();
        break;
      case key === "i" && e.shiftKey:
        e.preventDefault();
        void editorActions.insertImage();
        break;
      case e.key === "=" || e.key === "+":
        e.preventDefault();
        zoomIn();
        break;
      case e.key === "-":
        e.preventDefault();
        zoomOut();
        break;
      case e.key === "0":
        e.preventDefault();
        zoomReset();
        break;
    }
  });
}


async function about(): Promise<void> {
  await message(
    "MHReader v0.1.0\n\n一款基于 Rust + Tauri 的 Markdown 阅读编辑器。\n\n支持：多标签页、所见即所得编辑、自定义主题、搜索、缩放、大纲。",
    { title: "关于 MHReader", kind: "info" }
  );
}

async function main(): Promise<void> {
  await initTheme();
  initTitlebar();
  initZoom();
  initTabs();
  initSearch();
  initMenu({
    newFile: () => void newTab(),
    openFile: () => void openFile(),
    recentFiles: getRecentFiles,
    openRecent: (p) => void openRecentFile(p),
    save: () => void saveActive(),
    saveAs: () => void saveActiveAs(),
    exportHtml: () => void exportHtml(),
    closeTab: () => {
      const t = getActiveTab();
      if (t) void closeTab(t.id);
    },
    find: () => {
      if (getActiveTab()) openSearch();
    },
    toggleReadonly,
    isReadonly: isActiveReadonly,
    toggleOutline,
    isOutlineOpen: () => !isOutlineCollapsed(),
    zoomIn,
    zoomOut,
    zoomReset,
    applyTheme,
    currentTheme: () => getCurrentTheme().name,
    about: () => void about(),
    quit: () => void requestClose(),
  });
  initShortcuts();
  initContextMenu();
  initOutlineTracking();
  onEditorReady(() => syncOutlineActive());

  // 双击 .md 冷启动：打开启动参数里的文件；否则新建空标签
  const pending = await invoke<string[]>("take_pending_files");
  if (pending.length > 0) {
    for (const f of pending) await openFileByPath(f);
  } else {
    await newTab();
  }

  // 双击 .md 时已有实例在运行：同窗口开新标签
  await listen<string[]>("open-files", async (e) => {
    for (const f of e.payload) await openFileByPath(f);
  });

  // 拖拽 .md 文件到窗口打开
  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  await getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === "drop") {
      for (const p of event.payload.paths) {
        if (/\.(md|markdown|mdown|txt)$/i.test(p)) void openFileByPath(p);
      }
    }
  });
}

void main();
