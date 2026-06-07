import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import JSZip from "jszip";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const pdfInput = document.querySelector("#pdfInput");
const fileNameEl = document.querySelector("#fileName");
const pageCountEl = document.querySelector("#pageCount");
const originalCountEl = document.querySelector("#originalCount");
const blankCountEl = document.querySelector("#blankCount");
const deletedCountEl = document.querySelector("#deletedCount");
const outputCountEl = document.querySelector("#outputCount");
const downloadBtn = document.querySelector("#downloadBtn");
const resetBtn = document.querySelector("#resetBtn");
const pageList = document.querySelector("#pageList");
const emptyState = document.querySelector("#emptyState");
const previewList = document.querySelector("#previewList");
const previewEmpty = document.querySelector("#previewEmpty");
const recentFiles = document.querySelector("#recentFiles");
const mergeInput = document.querySelector("#mergeInput");
const mergeEmpty = document.querySelector("#mergeEmpty");
const mergeList = document.querySelector("#mergeList");
const mergeDownloadBtn = document.querySelector("#mergeDownloadBtn");
const mergeClearBtn = document.querySelector("#mergeClearBtn");
const splitRangeInput = document.querySelector("#splitRangeInput");
const splitDownloadBtn = document.querySelector("#splitDownloadBtn");
const selectionCount = document.querySelector("#selectionCount");
const selectAllBtn = document.querySelector("#selectAllBtn");
const clearSelectionBtn = document.querySelector("#clearSelectionBtn");
const batchDeleteBtn = document.querySelector("#batchDeleteBtn");
const batchRestoreBtn = document.querySelector("#batchRestoreBtn");
const batchBlankBtn = document.querySelector("#batchBlankBtn");
const navTabs = document.querySelectorAll(".nav-tab");
const appPages = document.querySelectorAll(".app-page");
const imageToPdfInput = document.querySelector("#imageToPdfInput");
const imageDropZone = document.querySelector("#imageDropZone");
const imageToPdfMergeInput = document.querySelector("#imageToPdfMergeInput");
const imageToPdfPageSize = document.querySelector("#imageToPdfPageSize");
const imageToPdfMargin = document.querySelector("#imageToPdfMargin");
const imageToPdfList = document.querySelector("#imageToPdfList");
const imageToPdfClearBtn = document.querySelector("#imageToPdfClearBtn");
const imageToPdfBtn = document.querySelector("#imageToPdfBtn");
const imageToPdfStatus = document.querySelector("#imageToPdfStatus");
const pdfToImagesInput = document.querySelector("#pdfToImagesInput");
const pdfToImagesRangeInput = document.querySelector("#pdfToImagesRangeInput");
const pdfToImagesBtn = document.querySelector("#pdfToImagesBtn");
const pdfToImagesStatus = document.querySelector("#pdfToImagesStatus");
const textToPdfInput = document.querySelector("#textToPdfInput");
const textToPdfBtn = document.querySelector("#textToPdfBtn");
const textToPdfStatus = document.querySelector("#textToPdfStatus");
const compressPdfInput = document.querySelector("#compressPdfInput");
const compressPdfBtn = document.querySelector("#compressPdfBtn");
const compressPdfStatus = document.querySelector("#compressPdfStatus");
const compressModeSelect = document.querySelector("#compressModeSelect");
const compressQualityInput = document.querySelector("#compressQualityInput");
const compressScaleInput = document.querySelector("#compressScaleInput");
const compressGrayscaleInput = document.querySelector("#compressGrayscaleInput");
const compressEstimatePanel = document.querySelector("#compressEstimatePanel");
const compressEstimateSize = document.querySelector("#compressEstimateSize");
const compressOriginalSize = document.querySelector("#compressOriginalSize");
const compressSavedSize = document.querySelector("#compressSavedSize");
const compressEstimateRatio = document.querySelector("#compressEstimateRatio");
const compressEstimateHint = document.querySelector("#compressEstimateHint");
const pdfToTextInput = document.querySelector("#pdfToTextInput");
const pdfToTextBtn = document.querySelector("#pdfToTextBtn");
const pdfToTextStatus = document.querySelector("#pdfToTextStatus");
const pdfToJpgInput = document.querySelector("#pdfToJpgInput");
const pdfToJpgBtn = document.querySelector("#pdfToJpgBtn");
const pdfToJpgStatus = document.querySelector("#pdfToJpgStatus");
const jpgQualityInput = document.querySelector("#jpgQualityInput");
const photoResizeInput = document.querySelector("#photoResizeInput");
const photoResizeWidthInput = document.querySelector("#photoResizeWidthInput");
const photoResizeHeightInput = document.querySelector("#photoResizeHeightInput");
const photoResizeBgInput = document.querySelector("#photoResizeBgInput");
const photoResizeSourceBgInput = document.querySelector("#photoResizeSourceBgInput");
const photoResizeFitSelect = document.querySelector("#photoResizeFitSelect");
const photoResizeAutoSourceBtn = document.querySelector("#photoResizeAutoSourceBtn");
const photoResizeReplaceBgInput = document.querySelector("#photoResizeReplaceBgInput");
const photoResizeToleranceInput = document.querySelector("#photoResizeToleranceInput");
const photoResizeCanvas = document.querySelector("#photoResizeCanvas");
const photoResizeDownloadBtn = document.querySelector("#photoResizeDownloadBtn");
const photoResizeStatus = document.querySelector("#photoResizeStatus");
const recentFilesKey = "moapdf.recentFiles.v1";
const a4PortraitSize = [595.28, 841.89];

const state = {
  file: null,
  bytes: null,
  previewPdf: null,
  renderToken: 0,
  pageSizes: [],
  pageOrder: [],
  insertions: new Map(),
  deletedPages: new Set(),
  selectedPages: new Set(),
  lastSelectedPage: null,
  mergeFiles: [],
  imageFiles: [],
  pdfToImagesFile: null,
  textFile: null,
  compressFile: null,
  pdfToTextFile: null,
  pdfToJpgFile: null,
  photoResizeFile: null,
  photoResizeBitmap: null,
  photoResizeDrawBox: null,
};

function activeBlankPages() {
  let count = 0;

  for (let pageNumber = 1; pageNumber <= state.pageSizes.length; pageNumber += 1) {
    if (!state.deletedPages.has(pageNumber)) {
      count += getInsertionCount(pageNumber);
    }
  }

  return count;
}

function getInsertionCount(position) {
  return state.insertions.get(position) ?? 0;
}

function setInsertionCount(position, count) {
  if (count <= 0) {
    state.insertions.delete(position);
    return;
  }
  state.insertions.set(position, count);
}

function hasCustomPageOrder() {
  return state.pageOrder.some((pageNumber, index) => pageNumber !== index + 1);
}

function getOutputCount() {
  return state.pageSizes.length - state.deletedPages.size + activeBlankPages();
}

function hasPendingPageEdits() {
  const outputCount = getOutputCount();
  return outputCount > 0 && (activeBlankPages() > 0 || state.deletedPages.size > 0 || hasCustomPageOrder());
}

function updateSelectionControls() {
  const selectedCount = state.selectedPages.size;
  if (selectionCount) selectionCount.textContent = selectedCount > 0 ? `已选择 ${selectedCount} 页` : "未选择页面";
  if (selectAllBtn) selectAllBtn.disabled = !state.file;
  if (clearSelectionBtn) clearSelectionBtn.disabled = selectedCount === 0;
  if (batchDeleteBtn) batchDeleteBtn.disabled = selectedCount === 0;
  if (batchRestoreBtn) batchRestoreBtn.disabled = selectedCount === 0;
  if (batchBlankBtn) batchBlankBtn.disabled = selectedCount === 0;
}

function updateSummary() {
  const originalCount = state.pageSizes.length;
  const blankCount = activeBlankPages();
  const deletedCount = state.deletedPages.size;
  const outputCount = getOutputCount();

  originalCountEl.textContent = String(originalCount);
  blankCountEl.textContent = String(blankCount);
  deletedCountEl.textContent = String(deletedCount);
  outputCountEl.textContent = String(outputCount);
  downloadBtn.disabled = !state.file || !hasPendingPageEdits();
  resetBtn.disabled = !state.file || !hasPendingPageEdits();
  splitDownloadBtn.disabled = !state.file || splitRangeInput.value.trim() === "";
  updateSelectionControls();

  if (!state.file) {
    fileNameEl.textContent = "尚未选择";
    pageCountEl.textContent = "选择 PDF 后显示页码";
    return;
  }

  fileNameEl.textContent = state.file.name;
  pageCountEl.textContent = `${outputCount} 页，已插入 ${blankCount} 张空白页，删除 ${deletedCount} 页`;
}

function getOutputSequence() {
  if (!state.file) return [];

  const sequence = [];

  for (const pageNumber of state.pageOrder) {
    if (state.deletedPages.has(pageNumber)) continue;

    sequence.push({
      type: "page",
      detail: `原始第 ${pageNumber} 页`,
      sourcePage: pageNumber,
    });

    const blanksHere = getInsertionCount(pageNumber);
    for (let blank = 0; blank < blanksHere; blank += 1) {
      sequence.push({
        type: "blank",
        detail: `插入在原始第 ${pageNumber} 页后`,
        afterPage: pageNumber,
        blankIndex: blank,
      });
    }
  }

  return sequence;
}

function renderPreview() {
  if (!previewList || !previewEmpty) return;

  previewList.innerHTML = "";
  const sequence = getOutputSequence();

  if (!state.file || sequence.length === 0) {
    previewEmpty.hidden = false;
    if (state.file) {
      previewEmpty.textContent = "当前没有可输出页面";
    } else {
      previewEmpty.textContent = "选择 PDF 后显示最终页序";
    }
    return;
  }

  previewEmpty.hidden = true;

  for (const [index, item] of sequence.entries()) {
    const outputPageNumber = index + 1;
    const card = document.createElement("article");
    card.className = `preview-card ${item.type === "blank" ? "blank" : ""}`;
    card.dataset.outputIndex = String(index);

    if (item.type === "page") {
      card.innerHTML = `
        <div class="preview-card-media">
          <canvas class="page-thumb preview-thumb" data-page="${item.sourcePage}" aria-label="第 ${outputPageNumber} 页预览"></canvas>
        </div>
        <div class="preview-card-body">
          <strong>第 ${outputPageNumber} 页</strong>
          <span>${item.detail}</span>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="preview-card-media">
          <div class="blank-preview preview-blank" aria-hidden="true">Blank</div>
        </div>
        <div class="preview-card-body">
          <strong>第 ${outputPageNumber} 页</strong>
          <span>${item.detail}</span>
        </div>
      `;
    }

    previewList.appendChild(card);
  }
}

function movePageInOrder(pageNumber, direction) {
  const index = state.pageOrder.indexOf(pageNumber);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= state.pageOrder.length) return;

  const [item] = state.pageOrder.splice(index, 1);
  state.pageOrder.splice(nextIndex, 0, item);
  renderPages();
}

function togglePageSelection(pageNumber, extendRange = false) {
  if (extendRange && state.lastSelectedPage) {
    const startIndex = state.pageOrder.indexOf(state.lastSelectedPage);
    const endIndex = state.pageOrder.indexOf(pageNumber);
    if (startIndex >= 0 && endIndex >= 0) {
      const [start, end] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
      state.pageOrder.slice(start, end + 1).forEach((item) => state.selectedPages.add(item));
    }
  } else if (state.selectedPages.has(pageNumber)) {
    state.selectedPages.delete(pageNumber);
  } else {
    state.selectedPages.add(pageNumber);
  }

  state.lastSelectedPage = pageNumber;
  renderPages();
}

function makePageRow(pageNumber) {
  const isDeleted = state.deletedPages.has(pageNumber);
  const count = getInsertionCount(pageNumber);
  const isSelected = state.selectedPages.has(pageNumber);
  const orderIndex = state.pageOrder.indexOf(pageNumber);
  const row = document.createElement("article");
  row.className = `page-row ${isDeleted ? "is-deleted" : ""} ${isSelected ? "is-selected" : ""}`;
  row.dataset.page = String(pageNumber);
  row.draggable = true;

  row.innerHTML = `
    <div class="page-id">
      <canvas class="page-thumb" data-page="${pageNumber}" aria-label="原始第 ${pageNumber} 页预览"></canvas>
      <div>
        <strong>第 ${pageNumber} 页后</strong>
        <span>${isDeleted ? `原始第 ${pageNumber} 页将从输出中删除` : `原始第 ${pageNumber} 页内容保持不变`}</span>
      </div>
    </div>
    <div class="page-tools">
      <button class="delete-page" type="button">${isDeleted ? "恢复页面" : "删除页面"}</button>
      <div class="order-tools" aria-label="调整第 ${pageNumber} 页顺序">
        <button class="move-up" type="button" title="上移页面" ${orderIndex <= 0 ? "disabled" : ""}>↑</button>
        <button class="move-down" type="button" title="下移页面" ${orderIndex >= state.pageOrder.length - 1 ? "disabled" : ""}>↓</button>
      </div>
      <div class="stepper" aria-label="第 ${pageNumber} 页后空白页数量">
        <button class="minus" type="button" title="减少空白页" ${count === 0 || isDeleted ? "disabled" : ""}>-</button>
        <span>${isDeleted ? "删" : count}</span>
        <button class="plus" type="button" title="增加空白页" ${isDeleted ? "disabled" : ""}>+</button>
      </div>
    </div>
  `;

  row.addEventListener("dragstart", (event) => {
    state.draggedPage = pageNumber;
    event.dataTransfer.effectAllowed = "move";
  });

  row.addEventListener("dragover", (event) => {
    event.preventDefault();
    row.classList.add("is-drop-target");
  });

  row.addEventListener("dragleave", () => {
    row.classList.remove("is-drop-target");
  });

  row.addEventListener("drop", (event) => {
    event.preventDefault();
    row.classList.remove("is-drop-target");
    const draggedPage = state.draggedPage;
    if (!draggedPage || draggedPage === pageNumber) return;
    const fromIndex = state.pageOrder.indexOf(draggedPage);
    const toIndex = state.pageOrder.indexOf(pageNumber);
    if (fromIndex < 0 || toIndex < 0) return;
    const [item] = state.pageOrder.splice(fromIndex, 1);
    state.pageOrder.splice(toIndex, 0, item);
    state.draggedPage = null;
    renderPages();
  });

  row.querySelector(".minus").addEventListener("click", () => {
    setInsertionCount(pageNumber, getInsertionCount(pageNumber) - 1);
    renderPages();
  });

  row.querySelector(".plus").addEventListener("click", () => {
    setInsertionCount(pageNumber, getInsertionCount(pageNumber) + 1);
    renderPages();
  });

  row.querySelector(".move-up").addEventListener("click", () => {
    movePageInOrder(pageNumber, -1);
  });

  row.querySelector(".move-down").addEventListener("click", () => {
    movePageInOrder(pageNumber, 1);
  });

  row.querySelector(".delete-page").addEventListener("click", () => {
    if (state.deletedPages.has(pageNumber)) {
      state.deletedPages.delete(pageNumber);
    } else {
      state.deletedPages.add(pageNumber);
    }
    renderPages();
  });

  return row;
}

function makeInsertedBlankRow(pageNumber, index) {
  const row = document.createElement("article");
  row.className = "page-row inserted-blank";
  row.dataset.blankAfter = String(pageNumber);
  row.dataset.blankIndex = String(index);

  row.innerHTML = `
    <div class="page-id">
      <div class="blank-preview" aria-hidden="true">Blank</div>
      <div>
        <strong>第 ${pageNumber} 页后空白页</strong>
        <span>会紧跟在原始第 ${pageNumber} 页后</span>
      </div>
    </div>
    <div class="page-tools blank-tools">
      <span>实时插入预览</span>
      <button class="delete-blank" type="button">删除空白页</button>
    </div>
  `;

  row.querySelector(".delete-blank").addEventListener("click", () => {
    setInsertionCount(pageNumber, getInsertionCount(pageNumber) - 1);
    renderPages();
  });

  return row;
}

async function renderThumbnail(pageNumber, canvas, token) {
  if (!state.previewPdf) return;

  const page = await state.previewPdf.getPage(pageNumber);
  if (token !== state.renderToken) return;

  const baseViewport = page.getViewport({ scale: 1 });
  const bounds = canvas.classList.contains("preview-thumb")
    ? { width: 160, height: 220 }
    : { width: 180, height: 230 };
  const scale = Math.min(bounds.width / baseViewport.width, bounds.height / baseViewport.height);
  const viewport = page.getViewport({ scale });
  const pixelRatio = window.devicePixelRatio || 1;
  const context = canvas.getContext("2d");

  canvas.width = Math.floor(viewport.width * pixelRatio);
  canvas.height = Math.floor(viewport.height * pixelRatio);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  await page.render({ canvasContext: context, viewport }).promise;

}

function renderVisibleThumbnails() {
  if (!state.previewPdf) return;

  const token = state.renderToken;
  const canvases = document.querySelectorAll(".page-thumb[data-page]");

  for (const canvas of canvases) {
    const pageNumber = Number(canvas.dataset.page);
    renderThumbnail(pageNumber, canvas, token).catch((error) => {
      canvas.replaceWith(document.createTextNode(`预览失败：${getErrorMessage(error)}`));
    });
  }
}

function renderPages() {
  pageList.innerHTML = "";
  emptyState.hidden = Boolean(state.file);

  if (!state.file) {
    updateSummary();
    renderPreview();
    return;
  }

  for (const pageNumber of state.pageOrder) {
    pageList.appendChild(makePageRow(pageNumber));

    if (state.deletedPages.has(pageNumber)) continue;

    for (let blank = 0; blank < getInsertionCount(pageNumber); blank += 1) {
      pageList.appendChild(makeInsertedBlankRow(pageNumber, blank));
    }
  }

  updateSummary();
  renderPreview();
  renderVisibleThumbnails();
}

async function loadPdf(file) {
  const bytes = await file.arrayBuffer();
  const pdfBytes = bytes.slice(0);
  const pdf = await PDFDocument.load(bytes);
  const previewPdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;

  state.file = file;
  state.bytes = bytes;
  state.previewPdf = previewPdf;
  state.renderToken += 1;
  state.pageSizes = pdf.getPages().map((page) => page.getSize());
  state.pageOrder = Array.from({ length: state.pageSizes.length }, (_, index) => index + 1);
  state.insertions.clear();
  state.deletedPages.clear();
  state.selectedPages.clear();
  state.lastSelectedPage = null;
  saveRecentFile(file);

  renderPages();
}

function addBlankPage(outputPdf, position) {
  const referenceSize = state.pageSizes[position - 1] ?? state.pageSizes[0];
  outputPdf.addPage([referenceSize.width, referenceSize.height]);
}

async function buildOutputPdf() {
  const sourcePdf = await PDFDocument.load(state.bytes);
  const outputPdf = await PDFDocument.create();
  const outputCount = getOutputCount();

  if (outputCount === 0) {
    throw new Error("输出 PDF 至少需要保留一页");
  }

  const keptPageIndexes = [];
  for (const originalPageNumber of state.pageOrder) {
    if (!state.deletedPages.has(originalPageNumber)) {
      keptPageIndexes.push(originalPageNumber - 1);
    }
  }

  const copiedPages = await outputPdf.copyPages(sourcePdf, keptPageIndexes);
  let copiedPageIndex = 0;

  for (const originalPageNumber of state.pageOrder) {
    if (state.deletedPages.has(originalPageNumber)) continue;

    outputPdf.addPage(copiedPages[copiedPageIndex]);
    copiedPageIndex += 1;

    for (let blank = 0; blank < getInsertionCount(originalPageNumber); blank += 1) {
      addBlankPage(outputPdf, originalPageNumber);
    }
  }

  return outputPdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });
}

function downloadBytes(bytes, filename, type = "application/pdf") {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function readRecentFiles() {
  try {
    const raw = localStorage.getItem(recentFilesKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeRecentFiles(files) {
  localStorage.setItem(recentFilesKey, JSON.stringify(files.slice(0, 5)));
}

function saveRecentFile(file) {
  const nextItem = {
    name: file.name,
    size: file.size,
    time: new Date().toLocaleString("zh-CN", { hour12: false }),
  };
  const files = readRecentFiles().filter((item) => item.name !== file.name || item.size !== file.size);
  writeRecentFiles([nextItem, ...files]);
  renderRecentFiles();
}

function renderRecentFiles() {
  const files = readRecentFiles();
  if (files.length === 0) {
    recentFiles.innerHTML = "";
    return;
  }

  recentFiles.innerHTML = `
    <span>最近处理</span>
    <div>
      ${files.map((file) => `<strong title="${file.name}">${file.name}</strong>`).join("")}
    </div>
  `;
}

function parseLoosePageList(value, pageCount) {
  try {
    return value.trim() ? parsePageRanges(value, pageCount) : [];
  } catch {
    return [];
  }
}

function isTauriApp() {
  return Boolean(window.__TAURI_INTERNALS__);
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}" ? serialized : String(error);
  } catch {
    return String(error);
  }
}

async function saveBytes(bytes, filename, type = "application/pdf") {
  if (!isTauriApp()) {
    downloadBytes(bytes, filename, type);
    return;
  }

  const [{ save }, { invoke }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/api/core"),
  ]);

  const filePath = await save({
    defaultPath: filename,
    filters: [
      {
        name: type === "application/zip" ? "ZIP" : type.startsWith("text/") ? "Text" : "PDF / File",
        extensions: [filename.includes(".") ? filename.split(".").pop() : ""].filter(Boolean),
      },
    ],
  });

  if (!filePath) {
    return;
  }

  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  await invoke("save_export", { path: filePath, bytes: Array.from(data) });
}

function switchPage(targetId) {
  const targetExists = [...appPages].some((page) => page.id === targetId);
  const nextTargetId = targetExists ? targetId : "editPage";

  appPages.forEach((page) => {
    page.hidden = page.id !== nextTargetId;
    page.classList.toggle("is-active", page.id === nextTargetId);
  });

  navTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.pageTarget === nextTargetId);
  });

  if (window.location.hash !== `#${nextTargetId}`) {
    window.history.replaceState(null, "", `#${nextTargetId}`);
  }
}

function getFileBaseName(file) {
  return file.name.replace(/\.[^.]+$/, "");
}

function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("图片导出失败"));
      }
    }, type, quality);
  });
}

function clampPhotoDimension(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(8000, Math.max(1, Math.round(number)));
}

function getPhotoResizeSettings() {
  return {
    width: clampPhotoDimension(photoResizeWidthInput.value, 800),
    height: clampPhotoDimension(photoResizeHeightInput.value, 800),
    background: photoResizeBgInput.value || "#ffffff",
    sourceBackground: photoResizeSourceBgInput.value || "#3f95de",
    fit: photoResizeFitSelect.value,
    replaceBackground: photoResizeReplaceBgInput.checked,
    tolerance: Number(photoResizeToleranceInput.value),
  };
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
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

function applyAutoPhotoSourceColor() {
  const color = detectPhotoBackgroundColor();
  if (!color) return;
  photoResizeSourceBgInput.value = rgbToHex(color);
  drawPhotoResizePreview();
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
  const canvas = photoResizeCanvas;
  const context = canvas.getContext("2d");
  const settings = getPhotoResizeSettings();

  canvas.width = settings.width;
  canvas.height = settings.height;
  context.fillStyle = settings.background;
  context.fillRect(0, 0, settings.width, settings.height);

  if (!state.photoResizeBitmap) {
    photoResizeDownloadBtn.disabled = true;
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
  photoResizeDownloadBtn.disabled = false;
  photoResizeStatus.textContent = `预览尺寸 ${settings.width} x ${settings.height}px，背景 ${settings.background}`;
}

async function convertImageToPngBytes(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await canvasToBlob(canvas, "image/png");
  return blob.arrayBuffer();
}

async function embedImage(pdf, file) {
  const bytes = await file.arrayBuffer();
  if (file.type === "image/jpeg" || /\.(jpe?g)$/i.test(file.name)) {
    return pdf.embedJpg(bytes);
  }
  if (file.type === "image/png" || /\.png$/i.test(file.name)) {
    return pdf.embedPng(bytes);
  }
  const pngBytes = await convertImageToPngBytes(file);
  return pdf.embedPng(pngBytes);
}

function getImageToPdfOptions() {
  return {
    pageSize: imageToPdfPageSize.value,
    margin: Number(imageToPdfMargin.value),
  };
}

function getImagePdfPageSize(image, options) {
  if (options.pageSize === "a4-portrait") return a4PortraitSize;
  if (options.pageSize === "a4-landscape") return [a4PortraitSize[1], a4PortraitSize[0]];
  return [image.width + options.margin * 2, image.height + options.margin * 2];
}

function getFittedImageBox(image, pageWidth, pageHeight, margin) {
  const maxWidth = Math.max(1, pageWidth - margin * 2);
  const maxHeight = Math.max(1, pageHeight - margin * 2);
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  return {
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  };
}

async function buildImagesPdf(files, options = getImageToPdfOptions()) {
  const outputPdf = await PDFDocument.create();

  for (const file of files) {
    const image = await embedImage(outputPdf, file);
    const [pageWidth, pageHeight] = getImagePdfPageSize(image, options);
    const page = outputPdf.addPage([pageWidth, pageHeight]);
    page.drawImage(image, getFittedImageBox(image, pageWidth, pageHeight, options.margin));
  }

  return outputPdf.save();
}

async function buildSingleImagePdf(file, options) {
  return buildImagesPdf([file], options);
}

function getUniqueZipFileName(baseName, usedNames) {
  let fileName = `${baseName}.pdf`;
  let suffix = 2;

  while (usedNames.has(fileName)) {
    fileName = `${baseName}-${suffix}.pdf`;
    suffix += 1;
  }

  usedNames.add(fileName);
  return fileName;
}

async function buildSeparateImagePdfsZip(files, options) {
  const zip = new JSZip();
  const usedNames = new Set();

  for (const [index, file] of files.entries()) {
    imageToPdfStatus.textContent = `正在生成第 ${index + 1}/${files.length} 个 PDF...`;
    const pdfBytes = await buildSingleImagePdf(file, options);
    const baseName = getFileBaseName(file) || `image-${index + 1}`;
    zip.file(getUniqueZipFileName(baseName, usedNames), pdfBytes);
  }

  return zip.generateAsync({ type: "uint8array" });
}

async function renderPdfPagesToZip(file, imageType, extension, quality, statusEl, pageRange = "") {
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const zip = new JSZip();
  const baseName = getFileBaseName(file);
  const pageNumbers = pageRange.trim() ? parsePageRanges(pageRange, pdf.numPages) : Array.from({ length: pdf.numPages }, (_, index) => index + 1);

  for (const [index, pageNumber] of pageNumbers.entries()) {
    statusEl.textContent = `正在渲染第 ${index + 1}/${pageNumbers.length} 页...`;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await canvasToBlob(canvas, imageType, quality);
    zip.file(`${baseName}-page-${String(pageNumber).padStart(3, "0")}.${extension}`, blob);
  }

  return zip.generateAsync({ type: "uint8array" });
}

async function buildPdfText(file) {
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    pdfToTextStatus.textContent = `正在提取第 ${pageNumber}/${pdf.numPages} 页...`;
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push(`--- Page ${pageNumber} ---\n${pageText}`);
  }

  const text = pages.join("\n\n");
  return new TextEncoder().encode(text || "");
}

function wrapCanvasText(context, text, maxWidth) {
  const lines = [];
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const char of paragraph) {
      const nextLine = `${line}${char}`;
      if (context.measureText(nextLine).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = nextLine;
      }
    }
    lines.push(line);
  }

  return lines;
}

async function addTextCanvasPage(outputPdf, lines, start, linesPerPage) {
  const canvas = document.createElement("canvas");
  const width = 1240;
  const height = 1754;
  const margin = 112;
  const lineHeight = 38;
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#1f2933";
  context.font = "28px 'Segoe UI', 'Microsoft YaHei', sans-serif";
  context.textBaseline = "top";

  for (let index = 0; index < linesPerPage; index += 1) {
    const line = lines[start + index];
    if (line === undefined) break;
    context.fillText(line || " ", margin, margin + index * lineHeight);
  }

  const blob = await canvasToBlob(canvas, "image/png");
  const image = await outputPdf.embedPng(await blob.arrayBuffer());
  const page = outputPdf.addPage([595.28, 841.89]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: 595.28,
    height: 841.89,
  });
}

async function buildTextPdf(file) {
  const text = await file.text();
  const measureCanvas = document.createElement("canvas");
  const context = measureCanvas.getContext("2d");
  context.font = "28px 'Segoe UI', 'Microsoft YaHei', sans-serif";

  const lines = wrapCanvasText(context, text, 1016);
  const outputPdf = await PDFDocument.create();
  const linesPerPage = 40;

  for (let start = 0; start < Math.max(lines.length, 1); start += linesPerPage) {
    await addTextCanvasPage(outputPdf, lines, start, linesPerPage);
  }

  return outputPdf.save();
}

async function compressPdfFile(file) {
  const bytes = await file.arrayBuffer();
  const pdf = await PDFDocument.load(bytes);
  return pdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });
}

const compressionPresets = {
  lossless: { quality: 0.92, scale: 1.4, grayscale: false },
  balanced: { quality: 0.72, scale: 1.15, grayscale: false },
  strong: { quality: 0.58, scale: 0.95, grayscale: false },
  extreme: { quality: 0.42, scale: 0.78, grayscale: true },
};

function formatFileSize(bytes) {
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function estimateCompressedSize(file, options) {
  if (!file) return null;

  if (options.mode === "lossless") {
    const min = file.size * 0.88;
    const max = file.size * 1.02;
    return { min, max, method: "无损优化预估" };
  }

  const qualityWeight = options.quality / compressionPresets.balanced.quality;
  const scaleWeight = Math.pow(options.scale / compressionPresets.balanced.scale, 1.8);
  const grayscaleWeight = options.grayscale ? 0.82 : 1;
  const baseWeightByMode = {
    balanced: 0.62,
    strong: 0.48,
    extreme: 0.36,
  };
  const modeWeight = baseWeightByMode[options.mode] ?? baseWeightByMode.balanced;
  const expectedRatio = clamp(modeWeight * qualityWeight * scaleWeight * grayscaleWeight, 0.12, 1.08);

  return {
    min: file.size * clamp(expectedRatio * 0.78, 0.08, 1.05),
    max: file.size * clamp(expectedRatio * 1.22, 0.12, 1.18),
    method: "重渲染压缩预估",
  };
}

function getCompressionOptions() {
  return {
    mode: compressModeSelect.value,
    quality: Number(compressQualityInput.value),
    scale: Number(compressScaleInput.value),
    grayscale: compressGrayscaleInput.checked,
  };
}

function updateCompressionEstimate(actualResult = null) {
  const file = state.compressFile;

  if (!file) {
    compressEstimatePanel.classList.add("is-empty");
    compressEstimateSize.textContent = "等待选择 PDF";
    compressOriginalSize.textContent = "--";
    compressSavedSize.textContent = "--";
    compressEstimateRatio.textContent = "--";
    compressEstimateHint.textContent = "选择 PDF 后会根据当前压缩设置实时估算。";
    return;
  }

  compressEstimatePanel.classList.remove("is-empty");
  compressOriginalSize.textContent = formatFileSize(file.size);

  if (actualResult) {
    const savedBytes = Math.max(0, file.size - actualResult.size);
    const ratio = file.size > 0 ? ((1 - actualResult.size / file.size) * 100).toFixed(1) : "0.0";
    compressEstimatePanel.classList.add("has-actual");
    compressEstimateSize.textContent = formatFileSize(actualResult.size);
    compressSavedSize.textContent = formatFileSize(savedBytes);
    compressEstimateRatio.textContent = `${ratio}%`;
    compressEstimateHint.textContent = `实际结果：${actualResult.strategy}`;
    return;
  }

  compressEstimatePanel.classList.remove("has-actual");
  const estimate = estimateCompressedSize(file, getCompressionOptions());
  const middle = (estimate.min + estimate.max) / 2;
  const savedBytes = Math.max(0, file.size - middle);
  const ratio = file.size > 0 ? ((1 - middle / file.size) * 100).toFixed(0) : "0";
  const sizeText =
    Math.abs(estimate.max - estimate.min) < 1024
      ? formatFileSize(middle)
      : `${formatFileSize(estimate.min)} - ${formatFileSize(estimate.max)}`;

  compressEstimateSize.textContent = sizeText;
  compressSavedSize.textContent = formatFileSize(savedBytes);
  compressEstimateRatio.textContent = `${ratio}%`;
  compressEstimateHint.textContent = `${estimate.method}，实际结果会受 PDF 图片占比、字体和页面复杂度影响。`;
}

function applyCompressionPreset(mode) {
  const preset = compressionPresets[mode] ?? compressionPresets.balanced;
  compressQualityInput.value = String(preset.quality);
  compressScaleInput.value = String(preset.scale);
  compressGrayscaleInput.checked = preset.grayscale;
  updateCompressionEstimate();
}

function applyGrayscale(context, width, height) {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    data[index] = gray;
    data[index + 1] = gray;
    data[index + 2] = gray;
  }

  context.putImageData(imageData, 0, 0);
}

async function compressPdfByRendering(file, options) {
  const bytes = await file.arrayBuffer();
  const sourcePdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const outputPdf = await PDFDocument.create();

  for (let pageNumber = 1; pageNumber <= sourcePdf.numPages; pageNumber += 1) {
    compressPdfStatus.textContent = `正在重绘压缩第 ${pageNumber}/${sourcePdf.numPages} 页...`;
    const sourcePage = await sourcePdf.getPage(pageNumber);
    const baseViewport = sourcePage.getViewport({ scale: 1 });
    const viewport = sourcePage.getViewport({ scale: options.scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await sourcePage.render({ canvasContext: context, viewport }).promise;

    if (options.grayscale) {
      applyGrayscale(context, canvas.width, canvas.height);
    }

    const jpgBlob = await canvasToBlob(canvas, "image/jpeg", options.quality);
    const jpgImage = await outputPdf.embedJpg(await jpgBlob.arrayBuffer());
    const page = outputPdf.addPage([baseViewport.width, baseViewport.height]);
    page.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: baseViewport.width,
      height: baseViewport.height,
    });
  }

  return outputPdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });
}

async function buildCompressedPdf(file) {
  const mode = compressModeSelect.value;
  const losslessBytes = await compressPdfFile(file);

  if (mode === "lossless") {
    return { bytes: losslessBytes, strategy: "无损优化" };
  }

  const renderedBytes = await compressPdfByRendering(file, {
    quality: Number(compressQualityInput.value),
    scale: Number(compressScaleInput.value),
    grayscale: compressGrayscaleInput.checked,
  });

  if (renderedBytes.byteLength < losslessBytes.byteLength) {
    return { bytes: renderedBytes, strategy: "重渲染强压" };
  }

  return { bytes: losslessBytes, strategy: "无损优化更小，已自动采用" };
}

async function readPdfPageCount(file) {
  const bytes = await file.arrayBuffer();
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPageCount();
}

function updateMergeControls() {
  const canMerge = state.mergeFiles.length >= 2;
  mergeEmpty.hidden = state.mergeFiles.length > 0;
  mergeDownloadBtn.disabled = !canMerge;
  mergeClearBtn.disabled = state.mergeFiles.length === 0;
}

function renderMergeList() {
  mergeList.innerHTML = "";

  state.mergeFiles.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = "merge-row";
    row.innerHTML = `
      <div class="merge-order">${index + 1}</div>
      <div class="merge-info">
        <strong>${item.file.name}</strong>
        <span>${item.pageCount} 页</span>
      </div>
      <div class="merge-row-actions">
        <button type="button" class="move-up" ${index === 0 ? "disabled" : ""}>上移</button>
        <button type="button" class="move-down" ${index === state.mergeFiles.length - 1 ? "disabled" : ""}>下移</button>
        <button type="button" class="remove">移除</button>
      </div>
    `;

    row.querySelector(".move-up").addEventListener("click", () => {
      const [itemToMove] = state.mergeFiles.splice(index, 1);
      state.mergeFiles.splice(index - 1, 0, itemToMove);
      renderMergeList();
    });

    row.querySelector(".move-down").addEventListener("click", () => {
      const [itemToMove] = state.mergeFiles.splice(index, 1);
      state.mergeFiles.splice(index + 1, 0, itemToMove);
      renderMergeList();
    });

    row.querySelector(".remove").addEventListener("click", () => {
      state.mergeFiles.splice(index, 1);
      renderMergeList();
    });

    mergeList.appendChild(row);
  });

  updateMergeControls();
}

async function loadMergeFiles(files) {
  const pdfFiles = [...files].filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (pdfFiles.length === 0) return;

  mergeDownloadBtn.disabled = true;
  mergeDownloadBtn.textContent = "读取中...";

  try {
    const items = [];
    for (const file of pdfFiles) {
      items.push({
        file,
        pageCount: await readPdfPageCount(file),
      });
    }
    state.mergeFiles = items;
    renderMergeList();
  } catch (error) {
    alert(`读取合并文件失败：${getErrorMessage(error)}`);
  } finally {
    mergeDownloadBtn.textContent = "下载合并 PDF";
    updateMergeControls();
  }
}

async function buildMergedPdf() {
  const outputPdf = await PDFDocument.create();

  for (const item of state.mergeFiles) {
    const bytes = await item.file.arrayBuffer();
    const sourcePdf = await PDFDocument.load(bytes);
    const pageIndexes = sourcePdf.getPageIndices();
    const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndexes);
    copiedPages.forEach((page) => outputPdf.addPage(page));
  }

  return outputPdf.save();
}

pdfInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    await loadPdf(file);
  } catch (error) {
    alert(`读取 PDF 失败：${getErrorMessage(error)}`);
    state.file = null;
    state.bytes = null;
    state.previewPdf = null;
    state.renderToken += 1;
    state.pageSizes = [];
    state.insertions.clear();
    state.deletedPages.clear();
    renderPages();
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!state.file || !hasPendingPageEdits()) return;

  downloadBtn.disabled = true;
  downloadBtn.textContent = "生成中...";

  try {
    const outputBytes = await buildOutputPdf();
    const baseName = state.file.name.replace(/\.pdf$/i, "");
    await saveBytes(outputBytes, `${baseName}-with-blanks.pdf`);
  } catch (error) {
    alert(`生成 PDF 失败：${getErrorMessage(error)}`);
  } finally {
    downloadBtn.textContent = "下载处理后 PDF";
    updateSummary();
  }
});

resetBtn.addEventListener("click", () => {
  state.insertions.clear();
  state.deletedPages.clear();
  state.selectedPages.clear();
  state.pageOrder = Array.from({ length: state.pageSizes.length }, (_, index) => index + 1);
  renderPages();
});

selectAllBtn?.addEventListener("click", () => {
  state.pageOrder.forEach((pageNumber) => state.selectedPages.add(pageNumber));
  renderPages();
});

clearSelectionBtn?.addEventListener("click", () => {
  state.selectedPages.clear();
  renderPages();
});

batchDeleteBtn?.addEventListener("click", () => {
  state.selectedPages.forEach((pageNumber) => state.deletedPages.add(pageNumber));
  renderPages();
});

batchRestoreBtn?.addEventListener("click", () => {
  state.selectedPages.forEach((pageNumber) => state.deletedPages.delete(pageNumber));
  renderPages();
});

batchBlankBtn?.addEventListener("click", () => {
  state.selectedPages.forEach((pageNumber) => {
    if (!state.deletedPages.has(pageNumber)) {
      setInsertionCount(pageNumber, getInsertionCount(pageNumber) + 1);
    }
  });
  renderPages();
});

function parsePageRanges(value, pageCount) {
  const pages = [];
  const seen = new Set();
  const chunks = value.split(",").map((chunk) => chunk.trim()).filter(Boolean);

  if (chunks.length === 0) {
    throw new Error("请输入页码范围");
  }

  for (const chunk of chunks) {
    const match = chunk.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) {
      throw new Error(`无法识别页码范围：${chunk}`);
    }

    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new Error(`页码超出范围：${chunk}`);
    }
    if (start > end) {
      throw new Error(`页码范围起点不能大于终点：${chunk}`);
    }

    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
      if (!seen.has(pageNumber)) {
        seen.add(pageNumber);
        pages.push(pageNumber);
      }
    }
  }

  return pages;
}

async function buildSplitPdf() {
  const sourcePdf = await PDFDocument.load(state.bytes);
  const outputPdf = await PDFDocument.create();
  const selectedPages = parsePageRanges(splitRangeInput.value, sourcePdf.getPageCount());
  const copiedPages = await outputPdf.copyPages(
    sourcePdf,
    selectedPages.map((pageNumber) => pageNumber - 1),
  );
  copiedPages.forEach((page) => outputPdf.addPage(page));
  return outputPdf.save();
}

splitRangeInput.addEventListener("input", updateSummary);

splitDownloadBtn.addEventListener("click", async () => {
  if (!state.file) return;

  splitDownloadBtn.disabled = true;
  splitDownloadBtn.textContent = "拆分中...";

  try {
    const outputBytes = await buildSplitPdf();
    const baseName = state.file.name.replace(/\.pdf$/i, "");
    await saveBytes(outputBytes, `${baseName}-split.pdf`);
  } catch (error) {
    alert(`拆分 PDF 失败：${getErrorMessage(error)}`);
  } finally {
    splitDownloadBtn.textContent = "下载拆分 PDF";
    updateSummary();
  }
});

mergeInput.addEventListener("change", async (event) => {
  await loadMergeFiles(event.target.files);
});

mergeDownloadBtn.addEventListener("click", async () => {
  if (state.mergeFiles.length < 2) return;

  mergeDownloadBtn.disabled = true;
  mergeDownloadBtn.textContent = "合并中...";

  try {
    const outputBytes = await buildMergedPdf();
    await saveBytes(outputBytes, "merged.pdf");
  } catch (error) {
    alert(`合并 PDF 失败：${getErrorMessage(error)}`);
  } finally {
    mergeDownloadBtn.textContent = "下载合并 PDF";
    updateMergeControls();
  }
});

mergeClearBtn.addEventListener("click", () => {
  state.mergeFiles = [];
  mergeInput.value = "";
  renderMergeList();
});

navTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    switchPage(tab.dataset.pageTarget);
  });
});

window.addEventListener("hashchange", () => {
  switchPage(window.location.hash.slice(1) || "editPage");
});

function updateImageToPdfControls() {
  const count = state.imageFiles.length;
  const mergeImages = imageToPdfMergeInput.checked;
  const files = getOrderedImageFiles();

  imageToPdfBtn.disabled = count === 0;
  imageToPdfClearBtn.disabled = count === 0;
  imageToPdfBtn.textContent = getImageToPdfButtonText(count, mergeImages);

  if (count === 0) {
    imageToPdfStatus.textContent = "尚未选择图片";
    return;
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const pageText = imageToPdfPageSize.selectedOptions[0]?.textContent ?? "当前尺寸";
  const marginText = imageToPdfMargin.selectedOptions[0]?.textContent ?? "当前边距";

  imageToPdfStatus.textContent = mergeImages
    ? `已选择 ${count} 张图片（${formatFileSize(totalSize)}），${pageText} / ${marginText}，将合并为 1 个 PDF`
    : count > 1
      ? `已选择 ${count} 张图片（${formatFileSize(totalSize)}），${pageText} / ${marginText}，将分别生成 ${count} 个 PDF`
      : `已选择 1 张图片，${pageText} / ${marginText}，将生成 1 个 PDF`;
}

function getImageToPdfButtonText(count, mergeImages) {
  if (mergeImages) return "下载合并 PDF";
  return count > 1 ? "下载独立 PDF ZIP" : "下载图片 PDF";
}

function getImageFileItems(files) {
  return files.map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}-${file.size}`,
    file,
    previewUrl: URL.createObjectURL(file),
  }));
}

function getOrderedImageFiles() {
  return state.imageFiles.map((item) => item.file ?? item);
}

function addImageFiles(files) {
  const imageFiles = [...files].filter((file) => file.type.startsWith("image/"));
  if (imageFiles.length === 0) return;
  state.imageFiles = [...state.imageFiles, ...getImageFileItems(imageFiles)];
  renderImageToPdfList();
  updateImageToPdfControls();
}

function clearImageFiles() {
  state.imageFiles.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
  state.imageFiles = [];
  imageToPdfInput.value = "";
  renderImageToPdfList();
  updateImageToPdfControls();
}

function moveImageItem(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= state.imageFiles.length) return;
  const [item] = state.imageFiles.splice(index, 1);
  state.imageFiles.splice(nextIndex, 0, item);
  renderImageToPdfList();
  updateImageToPdfControls();
}

function removeImageItem(index) {
  const [item] = state.imageFiles.splice(index, 1);
  if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
  if (state.imageFiles.length === 0) {
    imageToPdfInput.value = "";
  }
  renderImageToPdfList();
  updateImageToPdfControls();
}

function renderImageToPdfList() {
  imageToPdfList.innerHTML = "";

  if (state.imageFiles.length === 0) {
    imageToPdfList.hidden = true;
    return;
  }

  imageToPdfList.hidden = false;
  state.imageFiles.forEach((item, index) => {
    const file = item.file ?? item;
    const row = document.createElement("div");
    row.className = "image-sort-row";
    row.draggable = true;
    row.dataset.index = String(index);
    row.innerHTML = `
      <span class="image-sort-order">${index + 1}</span>
      <img class="image-sort-thumb" src="${item.previewUrl}" alt="" />
      <div class="image-sort-info">
        <strong title="${file.name}">${file.name}</strong>
        <span>${formatFileSize(file.size)}</span>
      </div>
      <div class="image-sort-actions">
        <button type="button" class="move-up" title="上移" ${index === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="move-down" title="下移" ${index === state.imageFiles.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" class="remove" title="移除">删除</button>
      </div>
    `;

    row.addEventListener("dragstart", () => {
      state.draggedImageIndex = index;
    });

    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      row.classList.add("is-drop-target");
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("is-drop-target");
    });

    row.addEventListener("drop", (event) => {
      event.preventDefault();
      row.classList.remove("is-drop-target");
      const fromIndex = state.draggedImageIndex;
      if (fromIndex === undefined || fromIndex === index) return;
      const [draggedItem] = state.imageFiles.splice(fromIndex, 1);
      state.imageFiles.splice(index, 0, draggedItem);
      state.draggedImageIndex = undefined;
      renderImageToPdfList();
      updateImageToPdfControls();
    });

    row.querySelector(".move-up").addEventListener("click", () => moveImageItem(index, -1));
    row.querySelector(".move-down").addEventListener("click", () => moveImageItem(index, 1));
    row.querySelector(".remove").addEventListener("click", () => removeImageItem(index));
    imageToPdfList.appendChild(row);
  });
}

imageToPdfInput.addEventListener("change", (event) => {
  addImageFiles(event.target.files);
  imageToPdfInput.value = "";
});

imageToPdfMergeInput.addEventListener("change", updateImageToPdfControls);
imageToPdfPageSize.addEventListener("change", updateImageToPdfControls);
imageToPdfMargin.addEventListener("change", updateImageToPdfControls);
imageToPdfClearBtn.addEventListener("click", clearImageFiles);

imageDropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  imageDropZone.classList.add("is-dragging");
});

imageDropZone.addEventListener("dragleave", () => {
  imageDropZone.classList.remove("is-dragging");
});

imageDropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  imageDropZone.classList.remove("is-dragging");
  addImageFiles(event.dataTransfer.files);
});

async function saveSeparateImagePdfs(files, options) {
  if (files.length === 1) {
    const outputBytes = await buildSingleImagePdf(files[0], options);
    await saveBytes(outputBytes, `${getFileBaseName(files[0]) || "image"}.pdf`);
    imageToPdfStatus.textContent = "已生成 1 个 PDF";
    return;
  }

  const zipBytes = await buildSeparateImagePdfsZip(files, options);
  await saveBytes(zipBytes, "image-pdfs.zip", "application/zip");
  imageToPdfStatus.textContent = `已生成 ${files.length} 个独立 PDF，并打包为 ZIP`;
}

imageToPdfBtn.addEventListener("click", async () => {
  if (state.imageFiles.length === 0) return;

  imageToPdfBtn.disabled = true;
  imageToPdfBtn.textContent = "生成中...";

  try {
    const files = getOrderedImageFiles();
    const options = getImageToPdfOptions();

    if (imageToPdfMergeInput.checked) {
      const outputBytes = await buildImagesPdf(files, options);
      await saveBytes(outputBytes, "images.pdf");
      imageToPdfStatus.textContent = `已合并生成 1 个 PDF，共 ${files.length} 页`;
    } else {
      await saveSeparateImagePdfs(files, options);
    }
  } catch (error) {
    alert(`图片转 PDF 失败：${getErrorMessage(error)}`);
  } finally {
    imageToPdfBtn.disabled = state.imageFiles.length === 0;
    imageToPdfBtn.textContent = getImageToPdfButtonText(state.imageFiles.length, imageToPdfMergeInput.checked);
  }
});

pdfToImagesInput.addEventListener("change", (event) => {
  state.pdfToImagesFile = event.target.files[0] ?? null;
  pdfToImagesBtn.disabled = !state.pdfToImagesFile;
  pdfToImagesStatus.textContent = state.pdfToImagesFile
    ? `已选择 ${state.pdfToImagesFile.name}`
    : "尚未选择 PDF";
});

pdfToImagesRangeInput.addEventListener("input", () => {
  if (!state.pdfToImagesFile) return;
  pdfToImagesStatus.textContent = pdfToImagesRangeInput.value.trim()
    ? `已选择 ${state.pdfToImagesFile.name}，将按页码范围导出`
    : `已选择 ${state.pdfToImagesFile.name}`;
});

pdfToImagesBtn.addEventListener("click", async () => {
  if (!state.pdfToImagesFile) return;

  pdfToImagesBtn.disabled = true;
  pdfToImagesBtn.textContent = "转换中...";

  try {
    const zipBytes = await renderPdfPagesToZip(
      state.pdfToImagesFile,
      "image/png",
      "png",
      undefined,
      pdfToImagesStatus,
      pdfToImagesRangeInput.value,
    );
    await saveBytes(zipBytes, `${getFileBaseName(state.pdfToImagesFile)}-images.zip`, "application/zip");
    pdfToImagesStatus.textContent = "图片 ZIP 已生成";
  } catch (error) {
    alert(`PDF 转图片失败：${getErrorMessage(error)}`);
  } finally {
    pdfToImagesBtn.textContent = "下载图片 ZIP";
    pdfToImagesBtn.disabled = !state.pdfToImagesFile;
  }
});

textToPdfInput.addEventListener("change", (event) => {
  state.textFile = event.target.files[0] ?? null;
  textToPdfBtn.disabled = !state.textFile;
  textToPdfStatus.textContent = state.textFile
    ? `已选择 ${state.textFile.name}`
    : "尚未选择文本文件";
});

textToPdfBtn.addEventListener("click", async () => {
  if (!state.textFile) return;

  textToPdfBtn.disabled = true;
  textToPdfBtn.textContent = "生成中...";

  try {
    const outputBytes = await buildTextPdf(state.textFile);
    await saveBytes(outputBytes, `${getFileBaseName(state.textFile)}.pdf`);
    textToPdfStatus.textContent = "文本 PDF 已生成";
  } catch (error) {
    alert(`文本转 PDF 失败：${getErrorMessage(error)}`);
  } finally {
    textToPdfBtn.textContent = "下载文本 PDF";
    textToPdfBtn.disabled = !state.textFile;
  }
});

compressPdfInput.addEventListener("change", (event) => {
  state.compressFile = event.target.files[0] ?? null;
  compressPdfBtn.disabled = !state.compressFile;
  compressPdfStatus.textContent = state.compressFile
    ? `已选择 ${state.compressFile.name}，${formatFileSize(state.compressFile.size)}`
    : "尚未选择 PDF";
  updateCompressionEstimate();
});

compressModeSelect.addEventListener("change", () => {
  applyCompressionPreset(compressModeSelect.value);
});

[compressQualityInput, compressScaleInput, compressGrayscaleInput].forEach((control) => {
  control.addEventListener("input", () => updateCompressionEstimate());
  control.addEventListener("change", () => updateCompressionEstimate());
});

compressPdfBtn.addEventListener("click", async () => {
  if (!state.compressFile) return;

  compressPdfBtn.disabled = true;
  compressPdfBtn.textContent = "压缩中...";

  try {
    const result = await buildCompressedPdf(state.compressFile);
    const outputBytes = result.bytes;
    const beforeSize = state.compressFile.size;
    const afterSize = outputBytes.byteLength;
    const ratio = ((1 - afterSize / beforeSize) * 100).toFixed(1);
    await saveBytes(outputBytes, `${getFileBaseName(state.compressFile)}-compressed.pdf`);
    compressPdfStatus.textContent = `${result.strategy}：${formatFileSize(beforeSize)} -> ${formatFileSize(afterSize)}，减少 ${ratio}%`;
    updateCompressionEstimate({ size: afterSize, strategy: result.strategy });
  } catch (error) {
    alert(`PDF 压缩失败：${getErrorMessage(error)}`);
  } finally {
    compressPdfBtn.textContent = "下载压缩 PDF";
    compressPdfBtn.disabled = !state.compressFile;
  }
});

pdfToTextInput.addEventListener("change", (event) => {
  state.pdfToTextFile = event.target.files[0] ?? null;
  pdfToTextBtn.disabled = !state.pdfToTextFile;
  pdfToTextStatus.textContent = state.pdfToTextFile
    ? `已选择 ${state.pdfToTextFile.name}`
    : "尚未选择 PDF";
});

pdfToTextBtn.addEventListener("click", async () => {
  if (!state.pdfToTextFile) return;

  pdfToTextBtn.disabled = true;
  pdfToTextBtn.textContent = "提取中...";

  try {
    const textBytes = await buildPdfText(state.pdfToTextFile);
    await saveBytes(textBytes, `${getFileBaseName(state.pdfToTextFile)}.txt`, "text/plain;charset=utf-8");
    pdfToTextStatus.textContent = "TXT 已生成";
  } catch (error) {
    alert(`PDF 转 TXT 失败：${getErrorMessage(error)}`);
  } finally {
    pdfToTextBtn.textContent = "下载 TXT";
    pdfToTextBtn.disabled = !state.pdfToTextFile;
  }
});

pdfToJpgInput.addEventListener("change", (event) => {
  state.pdfToJpgFile = event.target.files[0] ?? null;
  pdfToJpgBtn.disabled = !state.pdfToJpgFile;
  pdfToJpgStatus.textContent = state.pdfToJpgFile
    ? `已选择 ${state.pdfToJpgFile.name}`
    : "尚未选择 PDF";
});

pdfToJpgBtn.addEventListener("click", async () => {
  if (!state.pdfToJpgFile) return;

  pdfToJpgBtn.disabled = true;
  pdfToJpgBtn.textContent = "转换中...";

  try {
    const quality = Number(jpgQualityInput.value);
    const zipBytes = await renderPdfPagesToZip(
      state.pdfToJpgFile,
      "image/jpeg",
      "jpg",
      quality,
      pdfToJpgStatus,
    );
    await saveBytes(zipBytes, `${getFileBaseName(state.pdfToJpgFile)}-jpg.zip`, "application/zip");
    pdfToJpgStatus.textContent = `JPG ZIP 已生成，质量 ${(quality * 100).toFixed(0)}%`;
  } catch (error) {
    alert(`PDF 转 JPG 失败：${getErrorMessage(error)}`);
  } finally {
    pdfToJpgBtn.textContent = "下载 JPG ZIP";
    pdfToJpgBtn.disabled = !state.pdfToJpgFile;
  }
});

photoResizeInput.addEventListener("change", async (event) => {
  const file = event.target.files[0] ?? null;
  state.photoResizeFile = file;

  if (state.photoResizeBitmap) {
    state.photoResizeBitmap.close();
    state.photoResizeBitmap = null;
  }

  if (!file) {
    photoResizeStatus.textContent = "尚未选择照片";
    photoResizeDownloadBtn.disabled = true;
    photoResizeAutoSourceBtn.disabled = true;
    drawPhotoResizePreview();
    return;
  }

  try {
    state.photoResizeBitmap = await createImageBitmap(file);
    photoResizeWidthInput.value = String(state.photoResizeBitmap.width);
    photoResizeHeightInput.value = String(state.photoResizeBitmap.height);
    photoResizeAutoSourceBtn.disabled = false;
    const sourceColor = detectPhotoBackgroundColor();
    if (sourceColor) {
      photoResizeSourceBgInput.value = rgbToHex(sourceColor);
    }
    photoResizeStatus.textContent = `已选择 ${file.name}`;
    drawPhotoResizePreview();
  } catch (error) {
    state.photoResizeFile = null;
    photoResizeStatus.textContent = "照片读取失败";
    photoResizeDownloadBtn.disabled = true;
    photoResizeAutoSourceBtn.disabled = true;
    alert(`照片处理失败：${getErrorMessage(error)}`);
  }
});

[photoResizeWidthInput, photoResizeHeightInput, photoResizeBgInput, photoResizeFitSelect, photoResizeReplaceBgInput, photoResizeToleranceInput].forEach((control) => {
  control.addEventListener("input", drawPhotoResizePreview);
  control.addEventListener("change", drawPhotoResizePreview);
});

photoResizeSourceBgInput.addEventListener("input", drawPhotoResizePreview);
photoResizeSourceBgInput.addEventListener("change", drawPhotoResizePreview);
photoResizeAutoSourceBtn.addEventListener("click", applyAutoPhotoSourceColor);

photoResizeCanvas.addEventListener("click", (event) => {
  if (!state.photoResizeBitmap || !state.photoResizeDrawBox) return;

  const bounds = photoResizeCanvas.getBoundingClientRect();
  const canvasX = (event.clientX - bounds.left) * (photoResizeCanvas.width / bounds.width);
  const canvasY = (event.clientY - bounds.top) * (photoResizeCanvas.height / bounds.height);
  const box = state.photoResizeDrawBox;

  if (canvasX < box.x || canvasY < box.y || canvasX > box.x + box.width || canvasY > box.y + box.height) {
    return;
  }

  const sourceX = ((canvasX - box.x) / box.width) * box.sourceWidth;
  const sourceY = ((canvasY - box.y) / box.height) * box.sourceHeight;
  const color = samplePhotoBitmapColor(sourceX, sourceY);
  if (!color) return;

  photoResizeSourceBgInput.value = rgbToHex(color);
  drawPhotoResizePreview();
  photoResizeStatus.textContent = `已从预览取样原背景色 ${photoResizeSourceBgInput.value}`;
});

photoResizeDownloadBtn.addEventListener("click", async () => {
  if (!state.photoResizeBitmap) return;

  photoResizeDownloadBtn.disabled = true;
  photoResizeDownloadBtn.textContent = "生成中...";

  try {
    drawPhotoResizePreview();
    const settings = getPhotoResizeSettings();
    const blob = await canvasToBlob(photoResizeCanvas, "image/png");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const baseName = state.photoResizeFile ? getFileBaseName(state.photoResizeFile) : "photo";
    await saveBytes(bytes, `${baseName}-${settings.width}x${settings.height}.png`, "image/png");
    photoResizeStatus.textContent = `已生成 ${settings.width} x ${settings.height}px PNG`;
  } catch (error) {
    alert(`照片导出失败：${getErrorMessage(error)}`);
  } finally {
    photoResizeDownloadBtn.textContent = "下载处理后照片";
    photoResizeDownloadBtn.disabled = !state.photoResizeBitmap;
  }
});

renderPages();
renderMergeList();
switchPage(window.location.hash.slice(1) || "editPage");
