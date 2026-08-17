import defaultTheme from "../themes/default.json";
import eyesGreenTheme from "../themes/eyes-green.json";
import darkTheme from "../themes/dark.json";

export interface ThemeDef {
  name: string;
  label: string;
  vars: Record<string, string>;
}

export const themes: ThemeDef[] = [defaultTheme, eyesGreenTheme, darkTheme];

const STORAGE_KEY = "mhreader.theme";
let current = themes[0];

const listeners = new Set<(t: ThemeDef) => void>();

export function getCurrentTheme(): ThemeDef {
  return current;
}

export function onThemeChange(fn: (t: ThemeDef) => void): void {
  listeners.add(fn);
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

export function initTheme(): void {
  const saved = localStorage.getItem(STORAGE_KEY);
  applyTheme(saved ?? themes[0].name);
  // 状态栏主题名点击可循环切换
  document.getElementById("theme-label")?.addEventListener("click", () => {
    const idx = themes.findIndex((t) => t.name === current.name);
    applyTheme(themes[(idx + 1) % themes.length].name);
  });
}
