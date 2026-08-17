import { getActiveTab } from "./tabs";
import { saveFileDialog, writeFile } from "./files";
import { getCurrentTheme } from "./theme";

/** 把 asset://localhost/<编码路径> 还原成本地文件路径 */
function assetToPath(src: string): string | null {
  const m = /^https?:\/\/asset\.localhost\/(.+)$/.exec(src);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

/** 收集当前文档全部样式表文本 */
function harvestCss(): string {
  let out = "";
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) out += rule.cssText + "\n";
    } catch {
      /* 跨域样式表跳过 */
    }
  }
  return out;
}

/** 导出当前标签为独立 HTML 文件 */
export async function exportHtml(): Promise<void> {
  const t = getActiveTab();
  if (!t) return;
  const milkdown = document.querySelector("#editor .milkdown");
  if (!milkdown) return;

  const clone = milkdown.cloneNode(true) as HTMLElement;

  // 还原图片地址为本地路径；去掉编辑态交互元素
  clone.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    const path = assetToPath(src);
    if (path) img.src = path;
  });
  clone
    .querySelectorAll(".milkdown-block-handle, .crepe-toolbar, milkdown-toolbar, .table-button-group, .cell-handle")
    .forEach((el) => el.remove());
  clone.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));

  const theme = getCurrentTheme();
  const vars = Object.entries(theme.vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join("\n  ");

  const html = `<!doctype html>
<html lang="zh-CN" data-theme="${theme.name}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${t.name}</title>
<style>
:root {
  ${vars}
}
body { margin: 0; background: var(--bg); }
#editor-host { min-height: 100vh; }
</style>
<style>
${harvestCss()}
</style>
</head>
<body>
<main id="workspace">
<section id="editor-host">
<div id="editor">
${clone.outerHTML}
</div>
</section>
</main>
</body>
</html>
`;

  const savePath = await saveFileDialog(t.name.replace(/\.(md|markdown|mdown)$/i, "") + ".html");
  if (!savePath) return;
  await writeFile(savePath, html);
}
