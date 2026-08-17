import { getCurrentWindow } from "@tauri-apps/api/window";

export function initTitlebar(): void {
  const win = getCurrentWindow();

  document.getElementById("win-min")?.addEventListener("click", () => win.minimize());
  document.getElementById("win-max")?.addEventListener("click", () => win.toggleMaximize());
  document.getElementById("win-close")?.addEventListener("click", async () => {
    const { requestClose } = await import("./tabs");
    await requestClose();
  });

  // 双击标题栏空白处最大化/还原
  document.getElementById("tabstrip")?.addEventListener("dblclick", (e) => {
    if ((e.target as HTMLElement).closest("button, .tab")) return;
    win.toggleMaximize();
  });
}
