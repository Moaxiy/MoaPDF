import { canvasToBlob, getErrorMessage, getFileBaseName } from "../../shared/utils.js";
import { saveBytes } from "../../shared/files.js";

export function initPhotoFeature({ state, dom, progress }) {
  let previewRenderToken = 0;
  let fullSourceCanvasCache = null;
  let fullSourceCanvasCacheKey = "";
  let cropFramePending = false;
  const PHOTO_SIZE_PRESETS = {
    "295x413": { width: 295, height: 413 },
    "413x579": { width: 413, height: 579 },
    "260x378": { width: 260, height: 378 },
    "350x500": { width: 350, height: 500 },
  };

  function resetCropInteraction() {
    state.photoResizePointerActive = false;
    state.photoResizePointerStart = null;
    state.photoResizeCropDraft = null;
    state.photoResizeCropInteraction = null;
    state.photoResizeCropStartRect = null;
  }

  function clearPreviewCache() {
    fullSourceCanvasCache = null;
    fullSourceCanvasCacheKey = "";
  }

  function clampCropRect(rect, sourceWidth, sourceHeight) {
    if (!rect) return null;
    const width = Math.max(1, Math.min(rect.width, sourceWidth));
    const height = Math.max(1, Math.min(rect.height, sourceHeight));
    const x = Math.min(Math.max(0, rect.x), Math.max(0, sourceWidth - width));
    const y = Math.min(Math.max(0, rect.y), Math.max(0, sourceHeight - height));
    return { x, y, width, height };
  }

  function normalizeCropRect(startX, startY, endX, endY) {
    return {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
    };
  }

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
      sourceBackground: state.photoResizeSourceBackground,
      fit: dom.photoResizeFitSelect.value,
      replaceBackground: dom.photoResizeReplaceBgInput.checked,
      tolerance: Number(dom.photoResizeToleranceInput.value),
    };
  }

  function syncSizePresetState() {
    const preset = dom.photoResizeSizePreset?.value ?? "custom";
    const isCustom = preset === "custom";
    if (dom.photoResizeCustomSizePanel) {
      dom.photoResizeCustomSizePanel.hidden = !isCustom;
    }
    dom.photoResizeWidthInput.disabled = !isCustom;
    dom.photoResizeHeightInput.disabled = !isCustom;
    if (dom.photoResizeApplyCustomSizeBtn) {
      dom.photoResizeApplyCustomSizeBtn.disabled = !isCustom;
    }
    if (!isCustom && PHOTO_SIZE_PRESETS[preset]) {
      const { width, height } = PHOTO_SIZE_PRESETS[preset];
      dom.photoResizeWidthInput.value = String(width);
      dom.photoResizeHeightInput.value = String(height);
    }
  }

  function applyPhotoResizeDimensions() {
    const width = clampPhotoDimension(dom.photoResizeWidthInput.value, 295);
    const height = clampPhotoDimension(dom.photoResizeHeightInput.value, 413);
    dom.photoResizeWidthInput.value = String(width);
    dom.photoResizeHeightInput.value = String(height);
    clearPreviewCache();
    drawPhotoResizePreview();
  }

  function syncBgPresetState() {
    const preset = dom.photoResizeBgPreset?.value ?? "custom";
    const isCustom = preset === "custom";
    dom.photoResizeBgInput.disabled = !isCustom;
    if (!isCustom) {
      dom.photoResizeBgInput.value = preset;
    }
  }

  function getCropAspectRatio() {
    if (!dom.photoResizeCropRatioInput?.checked) return null;
    const settings = getPhotoResizeSettings();
    return settings.width > 0 && settings.height > 0 ? settings.width / settings.height : null;
  }

  function updateCropControls() {
    const hasBitmap = Boolean(state.photoResizeBitmap);
    const hasCrop = Boolean(state.photoResizeCrop);
    dom.photoResizeCropToggleBtn.disabled = !hasBitmap;
    dom.photoResizeCropClearBtn.disabled = !hasCrop && !state.photoResizeCropMode;
    dom.photoResizeCropToggleBtn.textContent = state.photoResizeCropMode ? "完成裁剪" : "开始裁剪";
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

  function getFullSourceCanvasCacheKey(settings) {
    const bitmap = state.photoResizeBitmap;
    if (!bitmap) return "";
    return [
      bitmap.width,
      bitmap.height,
      settings.background,
      settings.sourceBackground ?? "",
      settings.replaceBackground ? 1 : 0,
      settings.tolerance,
    ].join("|");
  }

  function createPhotoSourceCanvas(settings, cropRect = null) {
    const sourceCanvas = document.createElement("canvas");
    const sourceCrop = clampCropRect(cropRect, state.photoResizeBitmap.width, state.photoResizeBitmap.height);
    const cropX = sourceCrop?.x ?? 0;
    const cropY = sourceCrop?.y ?? 0;
    const cropWidth = sourceCrop?.width ?? state.photoResizeBitmap.width;
    const cropHeight = sourceCrop?.height ?? state.photoResizeBitmap.height;

    sourceCanvas.width = cropWidth;
    sourceCanvas.height = cropHeight;
    const sourceContext = sourceCanvas.getContext("2d");
    sourceContext.drawImage(
      state.photoResizeBitmap,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight,
    );
    if (!settings.replaceBackground || !settings.sourceBackground) return sourceCanvas;

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

  function getFullSourceCanvas(settings) {
    const cacheKey = getFullSourceCanvasCacheKey(settings);
    if (fullSourceCanvasCache && fullSourceCanvasCacheKey === cacheKey) {
      return fullSourceCanvasCache;
    }
    fullSourceCanvasCache = createPhotoSourceCanvas(settings, null);
    fullSourceCanvasCacheKey = cacheKey;
    return fullSourceCanvasCache;
  }

  function drawCropOverlay(context, sourceCanvas) {
    if (!state.photoResizeDrawBox) return;
    const activeCrop = state.photoResizeCropDraft ?? state.photoResizeCrop;
    dom.photoResizeCanvas.classList.toggle("is-crop-mode", state.photoResizeCropMode);
    if (!state.photoResizeCropMode || !activeCrop) return;

    const box = state.photoResizeDrawBox;
    context.save();
    context.fillStyle = state.photoResizeCropMode ? "rgba(16, 24, 40, 0.3)" : "rgba(16, 24, 40, 0.18)";
    context.fillRect(box.x, box.y, box.width, box.height);

    if (activeCrop) {
      const cropX = box.x + (activeCrop.x / box.sourceWidth) * box.width;
      const cropY = box.y + (activeCrop.y / box.sourceHeight) * box.height;
      const cropWidth = (activeCrop.width / box.sourceWidth) * box.width;
      const cropHeight = (activeCrop.height / box.sourceHeight) * box.height;

      context.save();
      context.beginPath();
      context.rect(cropX, cropY, cropWidth, cropHeight);
      context.clip();
      context.drawImage(
        sourceCanvas,
        activeCrop.x,
        activeCrop.y,
        activeCrop.width,
        activeCrop.height,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
      );
      context.restore();

      context.strokeStyle = "#2f6fed";
      context.lineWidth = 2;
      context.setLineDash([8, 6]);
      context.strokeRect(cropX, cropY, cropWidth, cropHeight);
      context.setLineDash([]);
      context.fillStyle = "#2f6fed";
      context.font = "12px 'Segoe UI', 'Microsoft YaHei', sans-serif";
      context.fillText(
        `${Math.round(activeCrop.width)} x ${Math.round(activeCrop.height)}`,
        cropX + 8,
        Math.max(18, cropY - 8),
      );
    }

    context.restore();
  }

  function drawPhotoResizePreview() {
    const renderToken = ++previewRenderToken;
    const canvas = dom.photoResizeCanvas;
    const context = canvas.getContext("2d");
    const settings = getPhotoResizeSettings();
    const activeCrop = state.photoResizeCropDraft ?? state.photoResizeCrop;

    canvas.width = settings.width;
    canvas.height = settings.height;
    context.fillStyle = settings.background;
    context.fillRect(0, 0, settings.width, settings.height);

    if (!state.photoResizeBitmap) {
      dom.photoResizeDownloadBtn.disabled = true;
      state.photoResizeDrawBox = null;
      updateCropControls();
      return;
    }

    const sourceCanvas = state.photoResizeCropMode
      ? getFullSourceCanvas(settings)
      : activeCrop
        ? createPhotoSourceCanvas(settings, activeCrop)
        : getFullSourceCanvas(settings);

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

    if (renderToken !== previewRenderToken) return;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(sourceCanvas, x, y, drawWidth, drawHeight);
    drawCropOverlay(context, state.photoResizeCropMode ? getFullSourceCanvas(settings) : sourceCanvas);
    dom.photoResizeDownloadBtn.disabled = false;

    const cropText = state.photoResizeCrop ? `，裁剪区域 ${Math.round(state.photoResizeCrop.width)} x ${Math.round(state.photoResizeCrop.height)}px` : "";
    const modeText = state.photoResizeCropMode ? "，当前处于裁剪模式" : "";
    dom.photoResizeStatus.textContent = `预览 ${settings.width} x ${settings.height}px，背景色 ${settings.background}${cropText}${modeText}`;
    updateCropControls();
  }

  function getCanvasPoint(event) {
    const bounds = dom.photoResizeCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (dom.photoResizeCanvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (dom.photoResizeCanvas.height / bounds.height),
    };
  }

  function getSourcePointFromCanvasPoint(point) {
    const box = state.photoResizeDrawBox;
    if (!box) return null;
    if (point.x < box.x || point.y < box.y || point.x > box.x + box.width || point.y > box.y + box.height) {
      return null;
    }
    return {
      x: ((point.x - box.x) / box.width) * box.sourceWidth,
      y: ((point.y - box.y) / box.height) * box.sourceHeight,
    };
  }

  function buildAspectCropRect(startPoint, endPoint) {
    const aspectRatio = getCropAspectRatio();
    if (!aspectRatio) {
      return normalizeCropRect(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
    }

    const sourceWidth = state.photoResizeDrawBox.sourceWidth;
    const sourceHeight = state.photoResizeDrawBox.sourceHeight;
    const deltaX = endPoint.x - startPoint.x;
    const deltaY = endPoint.y - startPoint.y;
    const directionX = deltaX >= 0 ? 1 : -1;
    const directionY = deltaY >= 0 ? 1 : -1;
    const maxWidth = directionX > 0 ? sourceWidth - startPoint.x : startPoint.x;
    const maxHeight = directionY > 0 ? sourceHeight - startPoint.y : startPoint.y;
    const rawWidth = Math.abs(deltaX);
    const rawHeight = Math.abs(deltaY);

    let width = Math.max(1, rawWidth);
    let height = width / aspectRatio;
    if (height < rawHeight) {
      height = Math.max(1, rawHeight);
      width = height * aspectRatio;
    }
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    const x = directionX > 0 ? startPoint.x : startPoint.x - width;
    const y = directionY > 0 ? startPoint.y : startPoint.y - height;
    return clampCropRect({ x, y, width, height }, sourceWidth, sourceHeight);
  }

  function isPointInsideCrop(point, crop) {
    return Boolean(
      crop
      && point.x >= crop.x
      && point.x <= crop.x + crop.width
      && point.y >= crop.y
      && point.y <= crop.y + crop.height
    );
  }

  function moveCropRect(rect, deltaX, deltaY, sourceWidth, sourceHeight) {
    const nextX = Math.min(Math.max(0, rect.x + deltaX), sourceWidth - rect.width);
    const nextY = Math.min(Math.max(0, rect.y + deltaY), sourceHeight - rect.height);
    return { ...rect, x: nextX, y: nextY };
  }

  function scheduleInteractivePreview() {
    if (cropFramePending) return;
    cropFramePending = true;
    requestAnimationFrame(() => {
      cropFramePending = false;
      if (state.photoResizePointerActive) drawPhotoResizePreview();
    });
  }

  function handleCropPointerDown(event) {
    if (!state.photoResizeCropMode || !state.photoResizeBitmap || !state.photoResizeDrawBox) return;
    event.preventDefault();
    const sourcePoint = getSourcePointFromCanvasPoint(getCanvasPoint(event));
    if (!sourcePoint) return;

    state.photoResizePointerActive = true;
    state.photoResizePointerStart = sourcePoint;
    if (isPointInsideCrop(sourcePoint, state.photoResizeCrop)) {
      state.photoResizeCropInteraction = "move";
      state.photoResizeCropStartRect = { ...state.photoResizeCrop };
      state.photoResizeCropDraft = { ...state.photoResizeCrop };
    } else {
      state.photoResizeCropInteraction = "draw";
      state.photoResizeCropStartRect = null;
      state.photoResizeCropDraft = { x: sourcePoint.x, y: sourcePoint.y, width: 1, height: 1 };
    }
    dom.photoResizeCanvas.setPointerCapture?.(event.pointerId);
    drawPhotoResizePreview();
  }

  function handleCropPointerMove(event) {
    if (!state.photoResizePointerActive || !state.photoResizePointerStart || !state.photoResizeDrawBox) return;
    const sourcePoint = getSourcePointFromCanvasPoint(getCanvasPoint(event));
    if (!sourcePoint) return;

    if (state.photoResizeCropInteraction === "move" && state.photoResizeCropStartRect) {
      const deltaX = sourcePoint.x - state.photoResizePointerStart.x;
      const deltaY = sourcePoint.y - state.photoResizePointerStart.y;
      state.photoResizeCropDraft = moveCropRect(
        state.photoResizeCropStartRect,
        deltaX,
        deltaY,
        state.photoResizeDrawBox.sourceWidth,
        state.photoResizeDrawBox.sourceHeight,
      );
    } else {
      state.photoResizeCropDraft = buildAspectCropRect(state.photoResizePointerStart, sourcePoint);
    }

    scheduleInteractivePreview();
  }

  function handleCropPointerUp(event) {
    if (!state.photoResizePointerActive) return;
    dom.photoResizeCanvas.releasePointerCapture?.(event.pointerId);
    if (state.photoResizeCropDraft) {
      const { width, height } = state.photoResizeCropDraft;
      state.photoResizeCrop = width < 4 || height < 4 ? null : state.photoResizeCropDraft;
    }
    resetCropInteraction();
    drawPhotoResizePreview();
  }

  function toggleCropMode() {
    if (!state.photoResizeBitmap) return;
    state.photoResizeCropMode = !state.photoResizeCropMode;
    resetCropInteraction();
    drawPhotoResizePreview();
    dom.photoResizeStatus.textContent = state.photoResizeCropMode
      ? "已开启裁剪模式。请拖拽框选照片区域；拖动已有裁剪框可微调位置。"
      : state.photoResizeCrop
        ? `已完成裁剪：${Math.round(state.photoResizeCrop.width)} x ${Math.round(state.photoResizeCrop.height)}px`
        : "已退出裁剪模式";
    updateCropControls();
  }

  function clearCrop() {
    state.photoResizeCrop = null;
    state.photoResizeCropMode = false;
    resetCropInteraction();
    drawPhotoResizePreview();
    dom.photoResizeStatus.textContent = "已清除裁剪区域";
  }

  function applyAutoPhotoSourceColor() {
    const color = detectPhotoBackgroundColor();
    if (!color) return;
    state.photoResizeSourceBackground = rgbToHex(color);
    clearPreviewCache();
    drawPhotoResizePreview();
  }

  dom.photoResizeInput.addEventListener("change", async (event) => {
    const file = event.target.files[0] ?? null;
    state.photoResizeFile = file;
    if (state.photoResizeBitmap) {
      state.photoResizeBitmap.close();
      state.photoResizeBitmap = null;
    }
    clearPreviewCache();
    state.photoResizeCrop = null;
    state.photoResizeCropMode = false;
    resetCropInteraction();

    if (!file) {
      dom.photoResizeStatus.textContent = "未选择照片";
      dom.photoResizeDownloadBtn.disabled = true;
      dom.photoResizeAutoSourceBtn.disabled = true;
      updateCropControls();
      drawPhotoResizePreview();
      return;
    }

    try {
      progress.resetTaskProgressTone();
      progress.showTaskProgress("读取照片", `正在读取 ${file.name}`, 0, 3);
      state.photoResizeBitmap = await createImageBitmap(file);
      state.photoResizeSourceBackground = null;
      progress.showTaskProgress("读取照片", "正在读取照片尺寸", 1, 3);
      if ((dom.photoResizeSizePreset?.value ?? "295x413") === "custom") {
        dom.photoResizeWidthInput.value = String(state.photoResizeBitmap.width);
        dom.photoResizeHeightInput.value = String(state.photoResizeBitmap.height);
      }
      dom.photoResizeAutoSourceBtn.disabled = false;
      progress.showTaskProgress("读取照片", "正在准备预览", 2, 3);
      dom.photoResizeStatus.textContent = `已选择 ${file.name}`;
      drawPhotoResizePreview();
      progress.completeTaskProgress("读取照片", `${file.name} 已就绪`);
    } catch (error) {
      progress.failTaskProgress("读取照片", `读取失败：${getErrorMessage(error)}`);
      state.photoResizeFile = null;
      dom.photoResizeStatus.textContent = "照片加载失败";
      dom.photoResizeDownloadBtn.disabled = true;
      dom.photoResizeAutoSourceBtn.disabled = true;
      updateCropControls();
      alert(`照片处理失败：${getErrorMessage(error)}`);
    }
  });

  [
    dom.photoResizeWidthInput,
    dom.photoResizeHeightInput,
    dom.photoResizeBgInput,
    dom.photoResizeFitSelect,
    dom.photoResizeReplaceBgInput,
    dom.photoResizeToleranceInput,
    dom.photoResizeCropRatioInput,
  ].forEach((control) => {
    control.addEventListener("input", () => {
      if (control === dom.photoResizeWidthInput || control === dom.photoResizeHeightInput) return;
      if (control === dom.photoResizeBgInput) {
        if (dom.photoResizeBgPreset) dom.photoResizeBgPreset.value = "custom";
      }
      clearPreviewCache();
      drawPhotoResizePreview();
    });
    control.addEventListener("change", () => {
      if (control === dom.photoResizeWidthInput || control === dom.photoResizeHeightInput) return;
      if (control === dom.photoResizeBgInput) {
        if (dom.photoResizeBgPreset) dom.photoResizeBgPreset.value = "custom";
      }
      clearPreviewCache();
      drawPhotoResizePreview();
    });
  });

  dom.photoResizeSizePreset?.addEventListener("change", () => {
    syncSizePresetState();
    clearPreviewCache();
    drawPhotoResizePreview();
  });
  dom.photoResizeApplyCustomSizeBtn?.addEventListener("click", applyPhotoResizeDimensions);
  dom.photoResizeBgPreset?.addEventListener("change", () => {
    syncBgPresetState();
    clearPreviewCache();
    drawPhotoResizePreview();
  });

  dom.photoResizeAutoSourceBtn.addEventListener("click", applyAutoPhotoSourceColor);
  dom.photoResizeCropToggleBtn.addEventListener("click", toggleCropMode);
  dom.photoResizeCropClearBtn.addEventListener("click", clearCrop);

  dom.photoResizeCanvas.addEventListener("click", (event) => {
    if (state.photoResizeCropMode) return;
    if (!state.photoResizeBitmap || !state.photoResizeDrawBox) return;
    const sourcePoint = getSourcePointFromCanvasPoint(getCanvasPoint(event));
    if (!sourcePoint) return;
    const color = samplePhotoBitmapColor(sourcePoint.x, sourcePoint.y);
    if (!color) return;
    state.photoResizeSourceBackground = rgbToHex(color);
    clearPreviewCache();
    drawPhotoResizePreview();
    dom.photoResizeStatus.textContent = `已吸取源背景色 ${state.photoResizeSourceBackground}`;
  });

  dom.photoResizeCanvas.addEventListener("dblclick", () => {
    toggleCropMode();
  });
  dom.photoResizeCanvas.addEventListener("pointerdown", handleCropPointerDown);
  dom.photoResizeCanvas.addEventListener("pointermove", handleCropPointerMove);
  dom.photoResizeCanvas.addEventListener("pointerup", handleCropPointerUp);
  dom.photoResizeCanvas.addEventListener("pointerleave", handleCropPointerUp);

  dom.photoResizeDownloadBtn.addEventListener("click", async () => {
    if (!state.photoResizeBitmap) return;
    progress.resetTaskProgressTone();
    progress.showTaskProgress("导出照片", "正在生成处理后的图片", 0, 1);
    dom.photoResizeDownloadBtn.disabled = true;
    dom.photoResizeDownloadBtn.textContent = "生成中...";

    try {
      drawPhotoResizePreview();
      const settings = getPhotoResizeSettings();
      const blob = await canvasToBlob(dom.photoResizeCanvas, "image/png");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const baseName = state.photoResizeFile ? getFileBaseName(state.photoResizeFile) : "photo";
      const saved = await saveBytes(progress, bytes, `${baseName}-${settings.width}x${settings.height}.png`, "image/png");
      if (saved) {
        dom.photoResizeStatus.textContent = `已生成 ${settings.width} x ${settings.height}px PNG`;
        progress.completeTaskProgress("导出照片", "PNG 已生成");
      } else {
        progress.cancelTaskProgress("导出照片", "已取消保存");
      }
    } catch (error) {
      progress.failTaskProgress("导出照片", `生成失败：${getErrorMessage(error)}`);
      alert(`导出照片失败：${getErrorMessage(error)}`);
    } finally {
      dom.photoResizeDownloadBtn.textContent = "下载处理后的照片";
      dom.photoResizeDownloadBtn.disabled = !state.photoResizeBitmap;
    }
  });

  syncSizePresetState();
  syncBgPresetState();
  updateCropControls();
  drawPhotoResizePreview();
}
