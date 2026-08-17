import "./styles/base.css";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

import { message } from "@tauri-apps/plugin-dialog";

import { initTheme, applyTheme, getCurrentTheme } from "./theme";
import { initTitlebar } from "./titlebar";
import { initZoom, zoomIn, zoomOut, zoomReset } from "./zoom";
import { initMenu } from "./menu";
import { initSearch, openSearch, closeSearch, isSearchOpen } from "./search";
import { initTabs, newTab, openFile, openFileByPath, saveActive, saveActiveAs, closeTab, getActiveTab, toggleReadonly, isActiveReadonly, requestClose } from "./tabs";
import { toggleOutline, isOutlineCollapsed } from "./outline";
import { initContextMenu } from "./contextmenu";
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
      case key === "b":
        e.preventDefault();
        toggleOutline();
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
  initTheme();
  initTitlebar();
  initZoom();
  initTabs();
  initSearch();
  initMenu({
    newFile: () => void newTab(),
    openFile: () => void openFile(),
    save: () => void saveActive(),
    saveAs: () => void saveActiveAs(),
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
