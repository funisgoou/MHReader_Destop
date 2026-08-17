import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import type { EditorView } from "@milkdown/prose/view";
import { searchProsePlugin } from "./search";

let crepe: Crepe | null = null;

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

  crepe = new Crepe({ root, defaultValue: markdown });
  crepe.editor.use(searchProsePlugin);
  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, md) => {
      for (const fn of mdListeners) fn(md);
    });
  });
  await crepe.create();
  for (const fn of readyListeners) fn();
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
