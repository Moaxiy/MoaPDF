import { canvasToBlob, getErrorMessage, getFileBaseName } from "../../shared/utils.js";
import { saveBytes } from "../../shared/files.js";

export function initPhotoFeature({ state, dom, progress }) {
  function clampPhotoDimension(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(8000, Math.max(1, Math.round(number)));
  }

  function getPhotoResizeSettings() {
    return {
      width: clampPhotoDimension(dom.photoResizeWidthInput.value, 800),
      height: clampPhotoDimension(dom.photoResizeHeightInput.value, 800),
      background: dom.photoResizeBgInput.value || "#ffffff",
      sourceBackground: dom.photoResizeSourceBgInput.value || "#3f95de",
      fit: dom.photoResizeFitSelect.value,
      replaceBackground: dom.photoResizeReplaceBgInput.checked,
      tolerance: Number(dom.photoResizeToleranceInput.value),
    };
  }

  function hexToRgb(hex) {
    const normalized = hex.replace("#", "");
    const value = Number.parseInt(
      normalized.length === 3 ? normalized.split("").map((char) => `${char}${char}`).join("") : normalized,
      16,
    );
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }

  function rgbToHex({ r, g, b }) {
    return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
  }

  function getPixelDistance(data, index, color) {
    const red = data[index] - color.r;
    const green = data[index + 1] - color.g;
    const blue = data[index + 2] - color.b;
    return Math.sqrt(red * red + green * green + blue * blue);
  }

  function getDominantBorderColor(imageData) {
    const { data, width, height } = imageData;
    const bucketCounts = new Map();
    const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 120));
    const edgeDepth = Math.max(2, Math.floor(Math.min(width, height) * 0.04));

    function addSample(x, y) {
      const index = (y * width + x) * 4;
      if (data[index + 3] < 220) return;
      const key = `${data[index] >> 4},${data[index + 1] >> 4},${data[index + 2] >> 4}`;
      bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
    }

    for (let x = 0; x < width; x += sampleStep) {
      for (let y = 0; y < edgeDepth; y += sampleStep) addSample(x, y);
      for (let y = Math.max(0, height - edgeDepth); y < height; y += sampleStep) addSample(x, y);
    }
    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < edgeDepth; x += sampleStep) addSample(x, y);
      for (let x = Math.max(0, width - edgeDepth); x < width; x += sampleStep) addSample(x, y);
    }

    const [bestKey] = [...bucketCounts.entries()].sort((first, second) => second[1] - first[1])[0] ?? ["15,15,15"];
    const [r, g, b] = bestKey.split(",").map((part) => Number(part) * 16 + 8);
    return { r, g, b };
  }

  function detectPhotoBackgroundColor() {
    if (!state.photoResizeBitmap) return null;
    const canvas = document.createElement("canvas");
    canvas.width = state.photoResizeBitmap.width;
    canvas.height = state.photoResizeBitmap.height;
    const context = canvas.getContext("2d");
    context.drawImage(state.photoResizeBitmap, 0, 0);
    return getDominantBorderColor(context.getImageData(0, 0, canvas.width, canvas.height));
  }

  function samplePhotoBitmapColor(sourceX, sourceY) {
    if (!state.photoResizeBitmap) return null;
    const canvas = document.createElement("canvas");
    canvas.width = state.photoResizeBitmap.width;
    canvas.height = state.photoResizeBitmap.height;
    const context = canvas.getContext("2d");
    context.drawImage(state.photoResizeBitmap, 0, 0);
    const x = Math.max(0, Math.min(canvas.width - 1, Math.round(sourceX)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.round(sourceY)));
    const [r, g, b] = context.getImageData(x, y, 1, 1).data;
    return { r, g, b };
  }

  function createPhotoSourceCanvas(settings) {
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = state.photoResizeBitmap.width;
    sourceCanvas.height = state.photoResizeBitmap.height;
    const sourceContext = sourceCanvas.getContext("2d");
    sourceContext.drawImage(state.photoResizeBitmap, 0, 0);
    if (!settings.replaceBackground) return sourceCanvas;

    const imageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const borderColor = hexToRgb(settings.sourceBackground);
    const targetColor = hexToRgb(settings.background);
    const tolerance = Math.max(1, settings.tolerance);
    const feather = Math.max(18, tolerance * 0.42);

    for (let index = 0; index < imageData.data.length; index += 4) {
      const distance = getPixelDistance(imageData.data, index, borderColor);
      if (distance > tolerance + feather) continue;
      const strength = distance <= tolerance ? 1 : 1 - (distance - tolerance) / feather;
      imageData.data[index] = imageData.data[index] * (1 - strength) + targetColor.r * strength;
      imageData.data[index + 1] = imageData.data[index + 1] * (1 - strength) + targetColor.g * strength;
      imageData.data[index + 2] = imageData.data[index + 2] * (1 - strength) + targetColor.b * strength;
    }

    sourceContext.putImageData(imageData, 0, 0);
    return sourceCanvas;
  }

  function drawPhotoResizePreview() {
    const canvas = dom.photoResizeCanvas;
    const context = canvas.getContext("2d");
    const settings = getPhotoResizeSettings();
    canvas.width = settings.width;
    canvas.height = settings.height;
    context.fillStyle = settings.background;
    context.fillRect(0, 0, settings.width, settings.height);

    if (!state.photoResizeBitmap) {
      dom.photoResizeDownloadBtn.disabled = true;
      state.photoResizeDrawBox = null;
      return;
    }

    const sourceCanvas = createPhotoSourceCanvas(settings);
    const scale = settings.fit === "cover"
      ? Math.max(settings.width / sourceCanvas.width, settings.height / sourceCanvas.height)
      : Math.min(settings.width / sourceCanvas.width, settings.height / sourceCanvas.height);
    const drawWidth = sourceCanvas.width * scale;
    const drawHeight = sourceCanvas.height * scale;
    const x = (settings.width - drawWidth) / 2;
    const y = (settings.height - drawHeight) / 2;
    state.photoResizeDrawBox = {
      x,
      y,
      width: drawWidth,
      height: drawHeight,
      sourceWidth: sourceCanvas.width,
      sourceHeight: sourceCanvas.height,
    };

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(sourceCanvas, x, y, drawWidth, drawHeight);
    dom.photoResizeDownloadBtn.disabled = false;
    dom.photoResizeStatus.textContent = `Preview ${settings.width} x ${settings.height}px, background ${settings.background}`;
  }

  function applyAutoPhotoSourceColor() {
    const color = detectPhotoBackgroundColor();
    if (!color) return;
    dom.photoResizeSourceBgInput.value = rgbToHex(color);
    drawPhotoResizePreview();
  }

  dom.photoResizeInput.addEventListener("change", async (event) => {
    const file = event.target.files[0] ?? null;
    state.photoResizeFile = file;
    if (state.photoResizeBitmap) {
      state.photoResizeBitmap.close();
      state.photoResizeBitmap = null;
    }
    if (!file) {
      dom.photoResizeStatus.textContent = "No photo selected";
      dom.photoResizeDownloadBtn.disabled = true;
      dom.photoResizeAutoSourceBtn.disabled = true;
      drawPhotoResizePreview();
      return;
    }
    try {
      progress.resetTaskProgressTone();
      progress.showTaskProgress("Read photo", `Reading ${file.name}`, 0, 3);
      state.photoResizeBitmap = await createImageBitmap(file);
      progress.showTaskProgress("Read photo", "Reading photo dimensions", 1, 3);
      dom.photoResizeWidthInput.value = String(state.photoResizeBitmap.width);
      dom.photoResizeHeightInput.value = String(state.photoResizeBitmap.height);
      dom.photoResizeAutoSourceBtn.disabled = false;
      progress.showTaskProgress("Read photo", "Detecting background color", 2, 3);
      const sourceColor = detectPhotoBackgroundColor();
      if (sourceColor) dom.photoResizeSourceBgInput.value = rgbToHex(sourceColor);
      dom.photoResizeStatus.textContent = `Selected ${file.name}`;
      drawPhotoResizePreview();
      progress.completeTaskProgress("Read photo", `${file.name} is ready`);
    } catch (error) {
      progress.failTaskProgress("Read photo", `Read failed: ${getErrorMessage(error)}`);
      state.photoResizeFile = null;
      dom.photoResizeStatus.textContent = "Photo loading failed";
      dom.photoResizeDownloadBtn.disabled = true;
      dom.photoResizeAutoSourceBtn.disabled = true;
      alert(`Photo processing failed: ${getErrorMessage(error)}`);
    }
  });

  [
    dom.photoResizeWidthInput,
    dom.photoResizeHeightInput,
    dom.photoResizeBgInput,
    dom.photoResizeFitSelect,
    dom.photoResizeReplaceBgInput,
    dom.photoResizeToleranceInput,
  ].forEach((control) => {
    control.addEventListener("input", drawPhotoResizePreview);
    control.addEventListener("change", drawPhotoResizePreview);
  });
  dom.photoResizeSourceBgInput.addEventListener("input", drawPhotoResizePreview);
  dom.photoResizeSourceBgInput.addEventListener("change", drawPhotoResizePreview);
  dom.photoResizeAutoSourceBtn.addEventListener("click", applyAutoPhotoSourceColor);
  dom.photoResizeCanvas.addEventListener("click", (event) => {
    if (!state.photoResizeBitmap || !state.photoResizeDrawBox) return;
    const bounds = dom.photoResizeCanvas.getBoundingClientRect();
    const canvasX = (event.clientX - bounds.left) * (dom.photoResizeCanvas.width / bounds.width);
    const canvasY = (event.clientY - bounds.top) * (dom.photoResizeCanvas.height / bounds.height);
    const box = state.photoResizeDrawBox;
    if (canvasX < box.x || canvasY < box.y || canvasX > box.x + box.width || canvasY > box.y + box.height) {
      return;
    }
    const sourceX = ((canvasX - box.x) / box.width) * box.sourceWidth;
    const sourceY = ((canvasY - box.y) / box.height) * box.sourceHeight;
    const color = samplePhotoBitmapColor(sourceX, sourceY);
    if (!color) return;
    dom.photoResizeSourceBgInput.value = rgbToHex(color);
    drawPhotoResizePreview();
    dom.photoResizeStatus.textContent = `Sampled source color ${dom.photoResizeSourceBgInput.value}`;
  });
  dom.photoResizeDownloadBtn.addEventListener("click", async () => {
    if (!state.photoResizeBitmap) return;
    progress.resetTaskProgressTone();
    progress.showTaskProgress("Export photo", "Generating the processed image", 0, 1);
    dom.photoResizeDownloadBtn.disabled = true;
    dom.photoResizeDownloadBtn.textContent = "Generating...";
    try {
      drawPhotoResizePreview();
      const settings = getPhotoResizeSettings();
      const blob = await canvasToBlob(dom.photoResizeCanvas, "image/png");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const baseName = state.photoResizeFile ? getFileBaseName(state.photoResizeFile) : "photo";
      const saved = await saveBytes(progress, bytes, `${baseName}-${settings.width}x${settings.height}.png`, "image/png");
      if (saved) {
        dom.photoResizeStatus.textContent = `Generated ${settings.width} x ${settings.height}px PNG`;
        progress.completeTaskProgress("Export photo", "PNG generated");
      } else {
        progress.cancelTaskProgress("Export photo", "Save cancelled");
      }
    } catch (error) {
      progress.failTaskProgress("Export photo", `Generation failed: ${getErrorMessage(error)}`);
      alert(`Photo export failed: ${getErrorMessage(error)}`);
    } finally {
      dom.photoResizeDownloadBtn.textContent = "Download processed photo";
      dom.photoResizeDownloadBtn.disabled = !state.photoResizeBitmap;
    }
  });

  drawPhotoResizePreview();
}
