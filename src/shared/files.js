import { RECENT_FILES_KEY } from "./utils.js";

function downloadBytes(bytes, filename, type = "application/pdf") {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function isTauriApp() {
  return Boolean(window.__TAURI_INTERNALS__);
}

export async function saveBytes(progress, bytes, filename, type = "application/pdf") {
  if (!isTauriApp()) {
    progress.showTaskProgress("保存文件", `正在准备 ${filename}`, 0, 1);
    downloadBytes(bytes, filename, type);
    return true;
  }

  const [{ save }, { invoke }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/api/core"),
  ]);

  progress.showTaskProgress("保存文件", `请选择 ${filename} 的保存位置`, 0, 2);
  const filePath = await save({
    defaultPath: filename,
    filters: [
      {
        name: type === "application/zip" ? "ZIP 压缩包" : type.startsWith("text/") ? "文本文件" : "PDF / 文件",
        extensions: [filename.includes(".") ? filename.split(".").pop() : ""].filter(Boolean),
      },
    ],
  });

  if (!filePath) {
    return false;
  }

  progress.showTaskProgress("保存文件", `正在写入 ${filename}`, 1, 2);
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  await invoke("save_export", { path: filePath, bytes: Array.from(data) });
  progress.showTaskProgress("保存文件", `已保存 ${filename}`, 2, 2);
  return true;
}

export function readRecentFiles() {
  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeRecentFiles(files) {
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(files.slice(0, 5)));
}
