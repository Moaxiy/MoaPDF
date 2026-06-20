export const RECENT_FILES_KEY = "moapdf.recentFiles.v1";
export const A4_PORTRAIT_SIZE = [595.28, 841.89];

export function getErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}" ? serialized : String(error);
  } catch {
    return String(error);
  }
}

export function getFileBaseName(file) {
  return file.name.replace(/\.[^.]+$/, "");
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "--";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Image export failed"));
      }
    }, type, quality);
  });
}
