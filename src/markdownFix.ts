/** Markdown 预处理：把 HTML <img> 标签转成 markdown 图片语法（跳过代码块） */
export function transformHtmlImages(md: string): string {
  const lines = md.split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence || line.indexOf("<img") === -1) return line;
      return line.replace(/<img\s[^>]*>/gi, (tag) => {
        const src = /src\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
        if (!src) return tag;
        const alt = /alt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
        // 含空格的目标用 <> 包裹（CommonMark 规定）
        const dest = /\s/.test(src) ? `<${src}>` : src;
        return `![${alt}](${dest})`;
      });
    })
    .join("\n");
}
