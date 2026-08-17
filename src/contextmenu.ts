import { getView, runCommand } from "./editor";
import { open } from "@tauri-apps/plugin-dialog";
import { askInput } from "./dialog";
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInHeadingCommand,
  insertHrCommand,
  createCodeBlockCommand,
  insertImageCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand, insertTableCommand } from "@milkdown/kit/preset/gfm";
import { setBlockTypeCommand } from "@milkdown/kit/preset/commonmark";

interface CtxItem {
  label?: string;
  shortcut?: string;
  enabled?: () => boolean;
  action?: () => void;
  children?: CtxItem[];
  sep?: boolean;
}

let menuEl: HTMLElement | null = null;

function closeMenu(): void {
  menuEl?.remove();
  menuEl = null;
}

function hasSelection(): boolean {
  const view = getView();
  return !!view && !view.state.selection.empty;
}

/* ---- 剪贴板 ---- */

async function cut(): Promise<void> {
  const view = getView();
  if (!view || view.state.selection.empty) return;
  const { from, to } = view.state.selection;
  await navigator.clipboard.writeText(view.state.doc.textBetween(from, to, "\n"));
  view.dispatch(view.state.tr.deleteRange(from, to));
  view.focus();
}

async function copy(): Promise<void> {
  const view = getView();
  if (!view || view.state.selection.empty) return;
  const { from, to } = view.state.selection;
  await navigator.clipboard.writeText(view.state.doc.textBetween(from, to, "\n"));
  view.focus();
}

async function paste(): Promise<void> {
  const view = getView();
  if (!view) return;
  const text = await navigator.clipboard.readText();
  if (text) view.dispatch(view.state.tr.insertText(text));
  view.focus();
}

function deleteSelection(): void {
  const view = getView();
  if (!view) return;
  const { from, to, empty } = view.state.selection;
  view.dispatch(empty ? view.state.tr.delete(from, from + 1) : view.state.tr.deleteRange(from, to));
  view.focus();
}

/* ---- 段落 / 插入 ---- */

function insertParagraph(where: "above" | "below"): void {
  const view = getView();
  if (!view) return;
  const { state } = view;
  const $from = state.selection.$from;
  const depth = $from.depth;
  const pos = where === "above" ? $from.before(depth) : $from.after(depth);
  const paragraph = state.schema.nodes.paragraph;
  const tr = state.tr.insert(pos, paragraph.create());
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

async function insertImage(): Promise<void> {
  const path = await open({
    multiple: false,
    filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"] }],
  });
  if (!path || typeof path !== "string") return;
  runCommand(insertImageCommand, { src: path.replace(/\\/g, "/"), alt: "" });
}

function insertLink(): void {
  void askInput("链接地址", "https://").then((href) => {
    if (href) runCommand(toggleLinkCommand, { href });
  });
}

function buildItems(): CtxItem[] {
  return [
    { label: "剪切", shortcut: "Ctrl+X", enabled: hasSelection, action: () => void cut() },
    { label: "复制", shortcut: "Ctrl+C", enabled: hasSelection, action: () => void copy() },
    { label: "粘贴", shortcut: "Ctrl+V", action: () => void paste() },
    { label: "删除", shortcut: "Del", enabled: hasSelection, action: deleteSelection },
    { sep: true },
    { label: "加粗", shortcut: "Ctrl+B", action: () => runCommand(toggleStrongCommand) },
    { label: "斜体", shortcut: "Ctrl+I", action: () => runCommand(toggleEmphasisCommand) },
    { label: "删除线", action: () => runCommand(toggleStrikethroughCommand) },
    { label: "行内代码", action: () => runCommand(toggleInlineCodeCommand) },
    { label: "链接…", action: insertLink },
    { sep: true },
    {
      label: "段落",
      children: [
        { label: "正文", action: () => {
          const view = getView();
          if (view) runCommand(setBlockTypeCommand, { nodeType: view.state.schema.nodes.paragraph });
        } },
        { sep: true },
        { label: "一级标题", action: () => runCommand(wrapInHeadingCommand, 1) },
        { label: "二级标题", action: () => runCommand(wrapInHeadingCommand, 2) },
        { label: "三级标题", action: () => runCommand(wrapInHeadingCommand, 3) },
        { label: "四级标题", action: () => runCommand(wrapInHeadingCommand, 4) },
        { label: "五级标题", action: () => runCommand(wrapInHeadingCommand, 5) },
        { label: "六级标题", action: () => runCommand(wrapInHeadingCommand, 6) },
        { sep: true },
        { label: "引用", action: () => runCommand(wrapInBlockquoteCommand) },
        { label: "无序列表", action: () => runCommand(wrapInBulletListCommand) },
        { label: "有序列表", action: () => runCommand(wrapInOrderedListCommand) },
      ],
    },
    {
      label: "插入",
      children: [
        { label: "表格", action: () => runCommand(insertTableCommand) },
        { label: "代码块", action: () => runCommand(createCodeBlockCommand) },
        { label: "水平分割线", action: () => runCommand(insertHrCommand) },
        { label: "图片…", action: () => void insertImage() },
        { sep: true },
        { label: "段落（上方）", action: () => insertParagraph("above") },
        { label: "段落（下方）", action: () => insertParagraph("below") },
      ],
    },
  ];
}

function createItemEl(item: CtxItem): HTMLElement {
  if (item.sep) {
    const sep = document.createElement("div");
    sep.className = "menu-sep";
    return sep;
  }
  const el = document.createElement("div");
  el.className = "menu-item";
  if (item.enabled && !item.enabled()) {
    el.style.opacity = "0.4";
    el.style.pointerEvents = "none";
  }

  const left = document.createElement("span");
  const check = document.createElement("span");
  check.className = "check";
  left.appendChild(check);
  left.appendChild(document.createTextNode(item.label ?? ""));
  el.appendChild(left);

  if (item.shortcut) {
    const sc = document.createElement("span");
    sc.className = "shortcut";
    sc.textContent = item.shortcut;
    el.appendChild(sc);
  }

  if (item.children) {
    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.textContent = "▶";
    el.appendChild(arrow);
    el.addEventListener("mouseenter", () => {
      el.parentElement
        ?.querySelectorAll(":scope > .menu-item > .submenu")
        .forEach((s) => s.remove());
      const sub = document.createElement("div");
      sub.className = "submenu";
      for (const child of item.children!) sub.appendChild(createItemEl(child));
      el.appendChild(sub);
    });
    el.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  } else {
    el.addEventListener("click", () => {
      closeMenu();
      item.action?.();
    });
  }
  return el;
}

function openMenu(x: number, y: number): void {
  closeMenu();
  menuEl = document.createElement("div");
  menuEl.id = "ctxmenu";
  for (const item of buildItems()) menuEl.appendChild(createItemEl(item));
  document.body.appendChild(menuEl);
  // 边界修正
  const rect = menuEl.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 8);
  const top = Math.min(y, window.innerHeight - rect.height - 8);
  menuEl.style.left = `${Math.max(4, left)}px`;
  menuEl.style.top = `${Math.max(4, top)}px`;
}

export function initContextMenu(): void {
  const editor = document.getElementById("editor");
  editor?.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openMenu(e.clientX, e.clientY);
  });
  document.addEventListener("click", (e) => {
    if (menuEl && !menuEl.contains(e.target as Node)) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
  window.addEventListener("blur", closeMenu);
}
