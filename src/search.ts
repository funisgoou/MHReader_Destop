import { Plugin, PluginKey } from "@milkdown/prose/state";
import { Decoration, DecorationSet } from "@milkdown/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { getView, focusEditor } from "./editor";

interface SearchState {
  query: string;
  active: number;
  matches: { from: number; to: number }[];
}

const searchKey = new PluginKey<DecorationSet>("mhreader-search");

let state: SearchState = { query: "", active: 0, matches: [] };
let visible = false;

/** 在文档中查找所有匹配位置 */
function findMatches(query: string): { from: number; to: number }[] {
  const view = getView();
  if (!view || !query) return [];
  const matches: { from: number; to: number }[] = [];
  const q = query.toLowerCase();
  view.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text.toLowerCase();
    let idx = 0;
    while ((idx = text.indexOf(q, idx)) !== -1) {
      matches.push({ from: pos + idx, to: pos + idx + q.length });
      idx += q.length;
    }
  });
  return matches;
}

function buildDecos(): DecorationSet {
  const view = getView();
  if (!view || state.matches.length === 0) return DecorationSet.empty;
  const decos = state.matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class: i === state.active ? "search-hit active" : "search-hit",
    })
  );
  return DecorationSet.create(view.state.doc, decos);
}

/** 提供给 main.ts 挂载到 Crepe 的 ProseMirror 插件 */
export const searchProsePlugin = $prose(
  () =>
    new Plugin<DecorationSet>({
      key: searchKey,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, old) {
          if (tr.getMeta(searchKey)) return buildDecos();
          if (tr.docChanged && state.query) {
            state.matches = findMatches(state.query);
            if (state.active >= state.matches.length) state.active = 0;
            return buildDecos();
          }
          return old.map(tr.mapping, tr.doc);
        },
      },
      props: {
        decorations(s) {
          return searchKey.getState(s);
        },
      },
    })
);

function refresh(keepActive = false): void {
  const view = getView();
  if (!view) return;
  state.matches = findMatches(state.query);
  if (!keepActive) state.active = 0;
  if (state.active >= state.matches.length) state.active = 0;
  view.dispatch(view.state.tr.setMeta(searchKey, true));
  updateCount();
}

function updateCount(): void {
  const el = document.getElementById("search-count");
  if (!el) return;
  el.textContent =
    state.matches.length === 0 ? "0/0" : `${state.active + 1}/${state.matches.length}`;
}

function jump(delta: number): void {
  if (state.matches.length === 0) return;
  const view = getView();
  if (!view) return;
  state.active =
    (state.active + delta + state.matches.length) % state.matches.length;
  view.dispatch(view.state.tr.setMeta(searchKey, true));
  updateCount();
  const m = state.matches[state.active];
  try {
    const dom = view.domAtPos(m.from);
    const el = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement;
    el?.scrollIntoView({ behavior: "auto", block: "center" });
  } catch {
    /* ignore */
  }
}

export function openSearch(): void {
  const bar = document.getElementById("searchbar");
  if (!bar) return;
  visible = true;
  bar.classList.remove("hidden");
  const input = document.getElementById("search-input") as HTMLInputElement;
  input?.focus();
  input?.select();
}

export function closeSearch(): void {
  const bar = document.getElementById("searchbar");
  if (!bar) return;
  visible = false;
  bar.classList.add("hidden");
  state = { query: "", active: 0, matches: [] };
  const view = getView();
  if (view) view.dispatch(view.state.tr.setMeta(searchKey, true));
  focusEditor();
}

export function isSearchOpen(): boolean {
  return visible;
}

/** 编辑器重建后清空高亮 */
export function resetSearch(): void {
  state = { query: "", active: 0, matches: [] };
  const input = document.getElementById("search-input") as HTMLInputElement;
  if (input) input.value = "";
  updateCount();
}

export function initSearch(): void {
  const input = document.getElementById("search-input") as HTMLInputElement;
  input?.addEventListener("input", () => {
    state.query = input.value;
    refresh();
    if (state.matches.length > 0) jump(0);
  });
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      jump(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
    }
  });
  document.getElementById("search-prev")?.addEventListener("click", () => jump(-1));
  document.getElementById("search-next")?.addEventListener("click", () => jump(1));
  document.getElementById("search-close")?.addEventListener("click", closeSearch);
}
