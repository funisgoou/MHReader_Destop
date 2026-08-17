import { getView, scrollToPos } from "./editor";

export interface Heading {
  level: number;
  text: string;
  index: number; // 文档中第几个标题（与 ProseMirror 遍历顺序对应）
}

let headings: Heading[] = [];
let collapsed = false;

/** 从 markdown 解析标题（跳过代码块内内容） */
export function parseHeadings(markdown: string): Heading[] {
  const result: Heading[] = [];
  let inFence = false;
  let index = 0;
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      result.push({ level: m[1].length, text: m[2], index: index++ });
    }
  }
  return result;
}

function render(): void {
  const panel = document.getElementById("outline");
  if (!panel) return;
  panel.classList.toggle("collapsed", collapsed);
  panel.innerHTML = "";
  if (collapsed) return;
  if (headings.length === 0) {
    const empty = document.createElement("div");
    empty.className = "outline-empty";
    empty.textContent = "无大纲";
    panel.appendChild(empty);
    return;
  }
  for (const h of headings) {
    const item = document.createElement("div");
    item.className = `outline-item level-${h.level}`;
    item.style.paddingLeft = `${10 + (h.level - 1) * 14}px`;
    item.textContent = h.text;
    item.title = h.text;
    item.addEventListener("click", () => jumpToHeading(h.index));
    panel.appendChild(item);
  }
}

/** 按标题序号在 ProseMirror 文档中定位并滚动 */
function jumpToHeading(index: number): void {
  const view = getView();
  if (!view) return;
  let i = 0;
  let pos: number | null = null;
  view.state.doc.descendants((node, p) => {
    if (pos !== null) return false; // 已找到，停止遍历
    if (node.type.name === "heading") {
      if (i === index) {
        pos = p;
        return false;
      }
      i++;
    }
    return true;
  });
  if (pos !== null) scrollToPos(pos);
}

export function updateOutline(markdown: string): void {
  headings = parseHeadings(markdown);
  render();
}

export function toggleOutline(): void {
  collapsed = !collapsed;
  render();
}

export function isOutlineCollapsed(): boolean {
  return collapsed;
}

export function clearOutline(): void {
  headings = [];
  render();
}
