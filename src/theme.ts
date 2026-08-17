import { invoke } from "@tauri-apps/api/core";
import defaultTheme from "../themes/default.json";
import eyesGreenTheme from "../themes/eyes-green.json";
import darkTheme from "../themes/dark.json";

export interface ThemeDef {
  name: string;
  label: string;
  vars: Record<string, string>;
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

/** 加载 exe 同级 themes/*.json 用户主题 */
async function loadUserThemes(): Promise<void> {
  try {
    const rawList = await invoke<string[]>("read_user_themes");
    for (const raw of rawList) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isValidTheme(parsed)) continue;
        const idx = themes.findIndex((t) => t.name === parsed.name);
        if (idx >= 0) themes[idx] = parsed;
        else themes.push(parsed);
      } catch {
        /* 跳过格式错误的主题文件 */
      }
    }
  } catch {
    /* 无用户主题目录 */
  }
}

export function applyTheme(name: string): void {
  const theme = themes.find((t) => t.name === name) ?? themes[0];
  current = theme;
  const root = document.documentElement;
  root.dataset.theme = theme.name;
  for (const [k, v] of Object.entries(theme.vars)) {
    root.style.setProperty(k, v);
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
