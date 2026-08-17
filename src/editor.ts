import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { callCommand } from "@milkdown/kit/utils";
import type { $Command } from "@milkdown/kit/utils";
import type { EditorView } from "@milkdown/prose/view";
import { convertFileSrc } from "@tauri-apps/api/core";
import { searchProsePlugin } from "./search";
import { mermaidProsePlugin } from "./mermaid";

let crepe: Crepe | null = null;

/** 当前文档所在目录（由 tabs 模块注入，用于解析相对路径图片） */
let dirProvider: () => string | null = () => null;

export function setDirProvider(fn: () => string | null): void {
  dirProvider = fn;
}

const mdListeners = new Set<(markdown: string) => void>();
const readyListeners = new Set<() => void>();

export function onMarkdownUpdated(fn: (markdown: string) => void): void {
  mdListeners.add(fn);
}

export function onEditorReady(fn: () => void): void {
  readyListeners.add(fn);
}

/** 销毁旧实例并用给定 markdown 重建编辑器 */
export async function mountEditor(markdown: string): Promise<void> {
  if (crepe) {
    try {
      await crepe.destroy();
    } catch {
      /* ignore */
    }
    crepe = null;
  }
  const root = document.getElementById("editor");
  if (!root) return;
  root.innerHTML = "";

  crepe = new Crepe({
    root,
    defaultValue: markdown,
    featureConfigs: {
      [Crepe.Feature.Placeholder]: { text: "请输入…", mode: "doc" },
    },
  });
  crepe.editor.use(searchProsePlugin);
  crepe.editor.use(mermaidProsePlugin);
  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, md) => {
      for (const fn of mdListeners) fn(md);
    });
  });
  await crepe.create();
  observeImages();
  for (const fn of readyListeners) fn();
}

/* ---------- 本地图片支持 ---------- */

let imgObserver: MutationObserver | null = null;

function resolveImageSrc(src: string): string | null {
  if (!src) return null;
  // 已是可加载的形式
  if (/^(https?|data|blob|asset):/i.test(src)) return null;
  if (src.startsWith("http://localhost") || src.startsWith("https://tauri")) return null;
  let abs = src;
  const isAbsolute = /^[a-zA-Z]:[\\/]/.test(src) || src.startsWith("\\\\") || src.startsWith("/");
  if (!isAbsolute) {
    const dir = dirProvider();
    if (!dir) return null; // 未保存的新文档无法解析相对路径
    abs = `${dir}\\${src}`;
  }
  return convertFileSrc(abs.replace(/\//g, "\\"));
}

function rewriteImages(container: HTMLElement): void {
  container.querySelectorAll("img").forEach((img) => {
    if (img.dataset.mhResolved) return;
    const src = img.getAttribute("src") ?? "";
    const resolved = resolveImageSrc(src);
    if (resolved) {
      img.dataset.mhResolved = "1";
      img.src = resolved;
    }
  });
}

function observeImages(): void {
  imgObserver?.disconnect();
  imgObserver = null;
  const root = document.getElementById("editor");
  if (!root) return;
  const run = () => rewriteImages(root);
  imgObserver = new MutationObserver(run);
  imgObserver.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });
  run();
}

/* ---------- 命令执行（右键菜单用） ---------- */

export function runCommand<T>(cmd: $Command<T>, payload?: T): boolean {
  if (!crepe) return false;
  try {
    return crepe.editor.action(callCommand(cmd.key, payload)) as boolean;
  } catch {
    return false;
  }
}

export async function destroyEditor(): Promise<void> {
  if (crepe) {
    try {
      await crepe.destroy();
    } catch {
      /* ignore */
    }
    crepe = null;
  }
  const root = document.getElementById("editor");
  if (root) root.innerHTML = "";
}

export function getMarkdown(): string {
  if (!crepe) return "";
  try {
    return crepe.getMarkdown();
  } catch {
    return "";
  }
}

export function setReadonly(readonly: boolean): void {
  crepe?.setReadonly(readonly);
}

/** 取到底层 ProseMirror EditorView（供搜索/大纲定位用） */
export function getView(): EditorView | null {
  if (!crepe) return null;
  try {
    return crepe.editor.ctx.get(editorViewCtx);
  } catch {
    return null;
  }
}

export function focusEditor(): void {
  getView()?.focus();
}

/** 滚动到文档中指定位置（优先取该位置节点对应的 DOM 元素） */
export function scrollToPos(pos: number): void {
  const view = getView();
  if (!view) return;
  try {
    let el: HTMLElement | null = null;
    const nodeDom = view.nodeDOM(pos);
    if (nodeDom instanceof HTMLElement) {
      el = nodeDom;
    } else {
      const dom = view.domAtPos(Math.min(pos + 1, view.state.doc.content.size));
      el = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement;
    }
    el?.scrollIntoView({ behavior: "auto", block: "start" });
  } catch {
    /* ignore */
  }
}
