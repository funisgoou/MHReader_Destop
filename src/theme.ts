import { invoke } from "@tauri-apps/api/core";
import defaultTheme from "../themes/default.json";
import eyesGreenTheme from "../themes/eyes-green.json";
import darkTheme from "../themes/dark.json";

export interface ThemeDef {
  name: string;
  label: string;
  vars: Record<string, string>;
  /** Typora 风格 CSS 全文（已做选择器映射），存在时注入页面 */
  css?: string;
}

/** 内置主题 */
const builtinThemes: ThemeDef[] = [defaultTheme, eyesGreenTheme, darkTheme];

/** 内置 + 用户自定义（同名覆盖内置） */
export let themes: ThemeDef[] = [...builtinThemes];

const STORAGE_KEY = "mhreader.theme";
let current = themes[0];

const listeners = new Set<(t: ThemeDef) => void>();

export function getCurrentTheme(): ThemeDef {
  return current;
}

export function onThemeChange(fn: (t: ThemeDef) => void): void {
  listeners.add(fn);
}

function isValidTheme(t: unknown): t is ThemeDef {
  const o = t as ThemeDef;
  return (
    !!o &&
    typeof o.name === "string" &&
    typeof o.label === "string" &&
    !!o.vars &&
    typeof o.vars === "object"
  );
}

/** Typora 主题作用域：编辑器内容区 */
const EDITOR_SCOPE = "#editor .milkdown .ProseMirror";

/** 把单个选择器映射到本应用 DOM；返回 null 表示丢弃 */
function mapSelector(sel: string): string | null {
  const s = sel.trim();
  if (!s) return null;
  // html/:root 保留全局（Typora 主题用 html 设整体背景/字号）
  if (s === "html" || s === ":root") return ":root";
  if (s.startsWith("html ")) return ":root " + s.slice(5);
  // body 的字体/颜色/行高 → 编辑区
  if (s === "body") return EDITOR_SCOPE;
  if (s.startsWith("body")) return EDITOR_SCOPE + s.slice(4);
  // Typora 编辑区容器
  if (s.startsWith("#write")) return EDITOR_SCOPE + s.slice(6);
  if (s.startsWith(".typora-export")) return EDITOR_SCOPE + s.slice(14);
  // 伪元素（::selection、::-webkit-scrollbar 等）保留全局
  if (s.startsWith("::")) return s;
  // 其余一律收进编辑区作用域：Typora 应用自身的类在编辑区内匹配不到，自然失效
  return `${EDITOR_SCOPE} ${s}`;
}

/** 处理一段 CSS（递归处理 @media/@supports 内部） */
function processCssBlock(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const brace = css.indexOf("{", i);
    if (brace === -1) break;
    const prelude = css.slice(i, brace).trim();
    let depth = 1;
    let j = brace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(brace + 1, j - 1);
    if (/^@(font-face|keyframes|page)/i.test(prelude)) {
      out += `${prelude}{${body}}`;
    } else if (/^@(media|supports)/i.test(prelude)) {
      out += `${prelude}{${processCssBlock(body)}}`;
    } else if (prelude.startsWith("@")) {
      // 丢弃未知 at 规则（Typora 的 @include-when-export 等）
    } else {
      const sels = prelude
        .split(",")
        .map(mapSelector)
        .filter((x): x is string => !!x);
      if (sels.length > 0) out += `${sels.join(",")}{${body}}`;
    }
    i = j;
  }
  return out;
}

/** 从主题 CSS 的 :root 变量中提取配色，映射到应用外框变量 */
function extractChromeVars(css: string): Record<string, string> {
  const m = /:root\s*\{([\s\S]*?)\}/.exec(css);
  if (!m) return {};
  const get = (k: string): string | null =>
    new RegExp(`${k}\\s*:\\s*([^;]+)`).exec(m[1])?.[1]?.trim() ?? null;
  const out: Record<string, string> = {};
  const bg = get("--bg-color");
  if (bg) {
    out["--bg"] = bg;
    out["--crepe-color-background"] = bg;
  }
  const side = get("--side-bar-bg-color");
  if (side) {
    out["--bg-soft"] = side;
    out["--crepe-color-surface"] = side;
  }
  const accent = get("--active-file-border-color");
  if (accent) {
    out["--accent"] = accent;
    out["--crepe-color-primary"] = accent;
  }
  const sel = get("--text-selection-bg-color");
  if (sel) {
    out["--accent-soft"] = sel;
    out["--crepe-color-selected"] = sel;
  }
  return out;
}

/** 把 Typora 主题 CSS 转换为本应用可用的样式 */
export function transformTyporaCss(css: string): string {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const noStatements = noComments.replace(/@[\w-]+[^;{}]*;/g, "");
  return processCssBlock(noStatements);
}

/** 加载 exe 同级 themes/ 下的用户主题（.json / .css） */
async function loadUserThemes(): Promise<void> {
  try {
    const entries = await invoke<[string, string][]>("read_user_themes");
    for (const [filename, raw] of entries) {
      let theme: ThemeDef | null = null;
      if (filename.endsWith(".json")) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (isValidTheme(parsed)) theme = parsed;
        } catch {
          /* 跳过格式错误的主题文件 */
        }
      } else if (filename.endsWith(".css")) {
        // Typora CSS 主题：默认变量打底 + 从 :root 提取外框配色 + CSS 转换注入
        const base = filename.replace(/\.css$/i, "");
        theme = {
          name: base.toLowerCase().replace(/\s+/g, "-"),
          label: base,
          vars: { ...defaultTheme.vars, ...extractChromeVars(raw) },
          css: transformTyporaCss(raw),
        };
      }
      if (!theme) continue;
      const idx = themes.findIndex((t) => t.name === theme!.name);
      if (idx >= 0) themes[idx] = theme;
      else themes.push(theme);
    }
  } catch {
    /* 无用户主题目录 */
  }
}

let injectedStyle: HTMLStyleElement | null = null;

export function applyTheme(name: string): void {
  const theme = themes.find((t) => t.name === name) ?? themes[0];
  current = theme;
  const root = document.documentElement;
  root.dataset.theme = theme.name;
  for (const [k, v] of Object.entries(theme.vars)) {
    root.style.setProperty(k, v);
  }
  // CSS 主题：注入/更新样式全文
  if (theme.css) {
    if (!injectedStyle) {
      injectedStyle = document.createElement("style");
      injectedStyle.id = "user-theme-css";
      document.head.appendChild(injectedStyle);
    }
    injectedStyle.textContent = theme.css;
  } else {
    injectedStyle?.remove();
    injectedStyle = null;
  }
  localStorage.setItem(STORAGE_KEY, theme.name);
  const label = document.getElementById("theme-label");
  if (label) label.textContent = theme.name;
  for (const fn of listeners) fn(theme);
}

export async function initTheme(): Promise<void> {
  await loadUserThemes();
  const saved = localStorage.getItem(STORAGE_KEY);
  applyTheme(saved ?? themes[0].name);
  // 状态栏主题名点击可循环切换
  document.getElementById("theme-label")?.addEventListener("click", () => {
    const idx = themes.findIndex((t) => t.name === current.name);
    applyTheme(themes[(idx + 1) % themes.length].name);
  });
}
