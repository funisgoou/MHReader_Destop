const MIN = 0.5;
const MAX = 2.0;
const STEP = 0.1;
const BASE_FONT = 16;
const STORAGE_KEY = "mhreader.zoom";

let zoom = 1;
const listeners = new Set<(z: number) => void>();

function render(): void {
  document.documentElement.style.setProperty(
    "--editor-font-size",
    `${Math.round(BASE_FONT * zoom)}px`
  );
  const label = document.getElementById("zoom-label");
  if (label) label.textContent = `${Math.round(zoom * 100)}%`;
  localStorage.setItem(STORAGE_KEY, String(zoom));
  for (const fn of listeners) fn(zoom);
}

export function getZoom(): number {
  return zoom;
}

export function onZoomChange(fn: (z: number) => void): void {
  listeners.add(fn);
}

export function zoomIn(): void {
  zoom = Math.min(MAX, Math.round((zoom + STEP) * 10) / 10);
  render();
}

export function zoomOut(): void {
  zoom = Math.max(MIN, Math.round((zoom - STEP) * 10) / 10);
  render();
}

export function zoomReset(): void {
  zoom = 1;
  render();
}

export function initZoom(): void {
  const saved = Number(localStorage.getItem(STORAGE_KEY));
  if (saved >= MIN && saved <= MAX) zoom = saved;
  render();
  document.getElementById("zoom-in")?.addEventListener("click", zoomIn);
  document.getElementById("zoom-out")?.addEventListener("click", zoomOut);
  document.getElementById("zoom-reset")?.addEventListener("click", zoomReset);
}
