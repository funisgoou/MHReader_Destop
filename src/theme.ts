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

/** 把 Typora 主题 CSS 的选择器映射到本应用编辑器 DOM */
function transformTyporaCss(css: string): string {
  return css
    .replace(/#write\b/g, "#editor .milkdown .ProseMirror")
    .replace(/\.typora-export\b/g, "#editor-host")
    .replace(/\bbody\s*\{/g, "#editor-host {");
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
        // Typora CSS 主题：以默认主题的变量打底，CSS 全文注入
        const base = filename.replace(/\.css$/i, "");
        theme = {
          name: base.toLowerCase().replace(/\s+/g, "-"),
          label: base,
          vars: { ...defaultTheme.vars },
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
