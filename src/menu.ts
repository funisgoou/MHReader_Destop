import { undo, redo } from "@milkdown/prose/history";
import { getView } from "./editor";
import { themes } from "./theme";

export interface MenuActions {
  newFile: () => void;
  openFile: () => void;
  save: () => void;
  saveAs: () => void;
  closeTab: () => void;
  find: () => void;
  toggleReadonly: () => void;
  isReadonly: () => boolean;
  toggleOutline: () => void;
  isOutlineOpen: () => boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  applyTheme: (name: string) => void;
  currentTheme: () => string;
  about: () => void;
  quit: () => void;
}

interface Item {
  label?: string;
  shortcut?: string;
  checked?: () => boolean;
  action?: () => void;
  children?: Item[];
  sep?: boolean;
}

function buildItems(a: MenuActions): Item[] {
  return [
    {
      label: "文件",
      children: [
        { label: "新建", shortcut: "Ctrl+N", action: a.newFile },
        { label: "打开…", shortcut: "Ctrl+O", action: a.openFile },
        { sep: true },
        { label: "保存", shortcut: "Ctrl+S", action: a.save },
        { label: "另存为…", shortcut: "Ctrl+Shift+S", action: a.saveAs },
        { sep: true },
        { label: "关闭标签", shortcut: "Ctrl+W", action: a.closeTab },
        { label: "退出", action: a.quit },
      ],
    },
    {
      label: "编辑",
      children: [
        { label: "撤销", shortcut: "Ctrl+Z", action: () => runHistory(undo) },
        { label: "重做", shortcut: "Ctrl+Y", action: () => runHistory(redo) },
        { sep: true },
        { label: "查找", shortcut: "Ctrl+F", action: a.find },
        { label: "只读模式", checked: a.isReadonly, action: a.toggleReadonly },
      ],
    },
    {
      label: "视图",
      children: [
        { label: "大纲", shortcut: "Ctrl+B", checked: a.isOutlineOpen, action: a.toggleOutline },
        { sep: true },
        { label: "放大", shortcut: "Ctrl+=", action: a.zoomIn },
        { label: "缩小", shortcut: "Ctrl+-", action: a.zoomOut },
        { label: "重置缩放", shortcut: "Ctrl+0", action: a.zoomReset },
      ],
    },
    {
      label: "主题",
      children: themes.map((t) => ({
        label: t.label,
        checked: () => a.currentTheme() === t.name,
        action: () => a.applyTheme(t.name),
      })),
    },
    {
      label: "帮助",
      children: [{ label: "关于 MHReader", action: a.about }],
    },
  ];
}

function runHistory(cmd: (state: never, dispatch?: never) => boolean): void {
  const view = getView();
  if (!view) return;
  (cmd as (s: unknown, d?: unknown) => boolean)(view.state, view.dispatch);
  view.focus();
}

function createItemEl(item: Item, closeAll: () => void): HTMLElement {
  if (item.sep) {
    const sep = document.createElement("div");
    sep.className = "menu-sep";
    return sep;
  }
  const el = document.createElement("div");
  el.className = "menu-item";

  const left = document.createElement("span");
  const check = document.createElement("span");
  check.className = "check";
  check.textContent = item.checked?.() ? "✓" : "";
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

    let sub: HTMLElement | null = null;
    const closeSub = () => {
      sub?.remove();
      sub = null;
    };
    const openSub = () => {
      if (sub?.isConnected) return;
      sub = null;
      // 先清掉兄弟项的子菜单
      el.parentElement
        ?.querySelectorAll(":scope > .menu-item > .submenu")
        .forEach((s) => s.remove());
      sub = document.createElement("div");
      sub.className = "submenu";
      for (const child of item.children!) sub.appendChild(createItemEl(child, closeAll));
      // 鼠标从子菜单移出到别处时收起
      sub.addEventListener("mouseleave", (e) => {
        const t = e.relatedTarget as Node | null;
        if (t && (sub?.contains(t) || el.contains(t))) return;
        closeSub();
      });
      el.appendChild(sub);
    };
    el.addEventListener("mouseenter", openSub);
    el.addEventListener("mouseleave", (e) => {
      if (sub && !sub.contains(e.relatedTarget as Node)) closeSub();
    });
    // 点击同样展开（兼容触摸与不触发 hover 的环境）；已由 hover 展开时保持不变
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      openSub();
    });
  } else {
    el.addEventListener("click", () => {
      item.action?.();
      closeAll();
    });
  }
  return el;
}

export function initMenu(actions: MenuActions): void {
  const hamburger = document.getElementById("hamburger");
  const menubar = document.getElementById("menubar");
  if (!hamburger || !menubar) return;

  const closeAll = () => menubar.classList.add("hidden");

  hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!menubar.classList.contains("hidden")) {
      closeAll();
      return;
    }
    menubar.innerHTML = "";
    for (const item of buildItems(actions)) {
      menubar.appendChild(createItemEl(item, closeAll));
    }
    menubar.classList.remove("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!menubar.contains(e.target as Node) && e.target !== hamburger) closeAll();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });
}
