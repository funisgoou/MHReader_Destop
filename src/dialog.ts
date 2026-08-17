/** 应用内模态对话框（WebView2 对 window.confirm/prompt 支持不可靠，自绘替代） */

function buildDialog(opts: {
  title: string;
  message?: string;
  input?: { placeholder?: string; value?: string };
  buttons: { label: string; value: string; primary?: boolean }[];
}): Promise<string> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "dlg-overlay";

    const box = document.createElement("div");
    box.className = "dlg-box";

    const title = document.createElement("div");
    title.className = "dlg-title";
    title.textContent = opts.title;
    box.appendChild(title);

    if (opts.message) {
      const msg = document.createElement("div");
      msg.className = "dlg-message";
      msg.textContent = opts.message;
      box.appendChild(msg);
    }

    let inputEl: HTMLInputElement | null = null;
    if (opts.input) {
      inputEl = document.createElement("input");
      inputEl.className = "dlg-input";
      inputEl.type = "text";
      inputEl.placeholder = opts.input.placeholder ?? "";
      inputEl.value = opts.input.value ?? "";
      box.appendChild(inputEl);
    }

    const btnRow = document.createElement("div");
    btnRow.className = "dlg-buttons";
    const done = (value: string) => {
      overlay.remove();
      document.removeEventListener("keydown", onKey, true);
      resolve(value);
    };
    const defaultBtn = opts.buttons.find((b) => b.primary) ?? opts.buttons[0];
    for (const b of opts.buttons) {
      const btn = document.createElement("button");
      btn.className = "dlg-btn" + (b.primary ? " primary" : "");
      btn.textContent = b.label;
      btn.addEventListener("click", () =>
        done(b.value === "__input__" ? (inputEl?.value ?? "") : b.value)
      );
      btnRow.appendChild(btn);
    }
    box.appendChild(btnRow);
    overlay.appendChild(box);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        done("cancel");
      } else if (e.key === "Enter") {
        e.stopPropagation();
        done(
          defaultBtn.value === "__input__" ? (inputEl?.value ?? "") : defaultBtn.value
        );
      }
    };
    document.addEventListener("keydown", onKey, true);

    document.body.appendChild(overlay);
    (inputEl ?? btnRow.querySelector("button.primary") ?? btnRow.querySelector("button"))?.focus();
  });
}

/** 未保存文件询问：保存 / 丢弃 / 取消 */
export function askSave(name: string): Promise<"save" | "discard" | "cancel"> {
  return buildDialog({
    title: "保存",
    message: `是否保存对「${name}」的更改？\n如果不保存，您的更改将会丢失。`,
    buttons: [
      { label: "保存", value: "save", primary: true },
      { label: "丢弃", value: "discard" },
      { label: "取消", value: "cancel" },
    ],
  }) as Promise<"save" | "discard" | "cancel">;
}

/** 单行输入对话框；取消返回 null */
export async function askInput(
  title: string,
  placeholder = "",
  value = ""
): Promise<string | null> {
  const r = await buildDialog({
    title,
    input: { placeholder, value },
    buttons: [
      { label: "确定", value: "__input__", primary: true },
      { label: "取消", value: "cancel" },
    ],
  });
  if (r === "cancel") return null;
  return r.trim() === "" ? null : r;
}
