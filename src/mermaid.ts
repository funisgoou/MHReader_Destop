import { Plugin, PluginKey } from "@milkdown/prose/state";
import { Decoration, DecorationSet } from "@milkdown/prose/view";
import type { Node as PmNode } from "@milkdown/prose/model";
import { $prose } from "@milkdown/kit/utils";
import mermaid from "mermaid";
import { getView } from "./editor";
import { onThemeChange } from "./theme";

const mermaidKey = new PluginKey<DecorationSet>("mhreader-mermaid");
let seq = 0;

function currentMermaidTheme(): "dark" | "neutral" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "neutral";
}

function initMermaid(): void {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: currentMermaidTheme(),
  });
}

function isMermaidBlock(node: PmNode): boolean {
  if (node.type.name !== "code_block") return false;
  const lang = String(node.attrs.language ?? "").toLowerCase();
  return lang === "mermaid" || lang === "mmd";
}

function buildDecos(doc: PmNode): DecorationSet {
  const decos: Parameters<typeof DecorationSet.create>[1] = [];
  doc.descendants((node, pos) => {
    if (isMermaidBlock(node)) {
      // 隐藏代码块本身，渲染为架构图
      decos.push(Decoration.node(pos, pos + node.nodeSize, { style: "display:none" }));
      decos.push(
        Decoration.widget(pos + node.nodeSize, () => {
          const div = document.createElement("div");
          div.className = "mermaid-diagram";
          div.textContent = "渲染中…";
          const id = `mmd-${Date.now()}-${++seq}`;
          mermaid
            .render(id, node.textContent)
            .then(({ svg }) => {
              div.innerHTML = svg;
            })
            .catch(() => {
              div.textContent = "Mermaid 渲染失败";
              div.classList.add("mermaid-error");
            });
          return div;
        })
      );
    }
    return true;
  });
  return DecorationSet.create(doc, decos);
}

/** mermaid 代码块 → 架构图 的 ProseMirror 插件 */
export const mermaidProsePlugin = $prose(() => {
  initMermaid();
  return new Plugin<DecorationSet>({
    key: mermaidKey,
    state: {
      init: (_config, instance) => buildDecos(instance.doc),
      apply(tr, old, _oldState, newState) {
        if (tr.getMeta(mermaidKey) || tr.docChanged) return buildDecos(newState.doc);
        return old.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(s) {
        return this.getState(s);
      },
    },
  });
});

/** 主题切换后用对应配色重渲染 */
onThemeChange(() => {
  initMermaid();
  const view = getView();
  if (view) view.dispatch(view.state.tr.setMeta(mermaidKey, true));
});
