import { PDFDocument, PDFHexString, PDFName, PDFNumber } from "pdf-lib";
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
const mergeInput = document.querySelector("#mergeInput");
const mergeEmpty = document.querySelector("#mergeEmpty");
const mergeList = document.querySelector("#mergeList");
const mergeDownloadBtn = document.querySelector("#mergeDownloadBtn");
const mergeClearBtn = document.querySelector("#mergeClearBtn");
const splitRangeInput = document.querySelector("#splitRangeInput");
const splitDownloadBtn = document.querySelector("#splitDownloadBtn");
const navTabs = document.querySelectorAll(".nav-tab");
const appPages = document.querySelectorAll(".app-page");
const imageToPdfInput = document.querySelector("#imageToPdfInput");
const imageToPdfBtn = document.querySelector("#imageToPdfBtn");
const imageToPdfStatus = document.querySelector("#imageToPdfStatus");
const pdfToImagesInput = document.querySelector("#pdfToImagesInput");
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
const pdfToTextInput = document.querySelector("#pdfToTextInput");
const pdfToTextBtn = document.querySelector("#pdfToTextBtn");
const pdfToTextStatus = document.querySelector("#pdfToTextStatus");
const pdfToJpgInput = document.querySelector("#pdfToJpgInput");
const pdfToJpgBtn = document.querySelector("#pdfToJpgBtn");
const pdfToJpgStatus = document.querySelector("#pdfToJpgStatus");
const jpgQualityInput = document.querySelector("#jpgQualityInput");

const state = {
  file: null,
  bytes: null,
  previewPdf: null,
  renderToken: 0,
  pageSizes: [],
  insertions: new Map(),
  deletedPages: new Set(),
  mergeFiles: [],
  imageFiles: [],
  pdfToImagesFile: null,
  textFile: null,
  compressFile: null,
  pdfToTextFile: null,
  pdfToJpgFile: null,
};

function activeBlankPages() {
  let count = getInsertionCount(0);

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

function hasPendingPageEdits() {
  const outputCount = state.pageSizes.length - state.deletedPages.size + activeBlankPages();
  return outputCount > 0 && (activeBlankPages() > 0 || state.deletedPages.size > 0);
}

function updateSummary() {
  const originalCount = state.pageSizes.length;
  const blankCount = activeBlankPages();
  const deletedCount = state.deletedPages.size;

  originalCountEl.textContent = String(originalCount);
  blankCountEl.textContent = String(blankCount);
  deletedCountEl.textContent = String(deletedCount);
  outputCountEl.textContent = String(originalCount - deletedCount + blankCount);
  downloadBtn.disabled = !state.file || !hasPendingPageEdits();
  resetBtn.disabled = !state.file || !hasPendingPageEdits();
  splitDownloadBtn.disabled = !state.file || splitRangeInput.value.trim() === "";

  if (!state.file) {
    fileNameEl.textContent = "尚未选择";
    pageCountEl.textContent = "选择 PDF 后显示页码";
    return;
  }

  fileNameEl.textContent = state.file.name;
  pageCountEl.textContent = `${originalCount} 页，已安排 ${blankCount} 张空白页，删除 ${deletedCount} 页`;
}

function getOutputSequence() {
  if (!state.file) return [];

  const sequence = [];
  const beforeFirstCount = getInsertionCount(0);

  for (let blank = 0; blank < beforeFirstCount; blank += 1) {
    sequence.push({ type: "blank", label: "首页前空白" });
  }

  for (let pageNumber = 1; pageNumber <= state.pageSizes.length; pageNumber += 1) {
    if (state.deletedPages.has(pageNumber)) continue;

    sequence.push({ type: "page", label: `原 ${pageNumber}` });

    const blanksHere = getInsertionCount(pageNumber);
    for (let blank = 0; blank < blanksHere; blank += 1) {
      sequence.push({ type: "blank", label: `第 ${pageNumber} 页后空白` });
    }
  }

  return sequence;
}

function renderPreview() {
  previewList.innerHTML = "";

  if (!state.file) {
    previewEmpty.hidden = false;
    return;
  }

  const sequence = getOutputSequence();
  previewEmpty.hidden = true;

  for (const [index, item] of sequence.entries()) {
    const chip = document.createElement("span");
    chip.className = `preview-chip ${item.type === "blank" ? "blank" : ""}`;
    chip.textContent = `${index + 1}. ${item.label}`;
    previewList.appendChild(chip);
  }
}

function makeRow(position) {
  const row = document.createElement("article");
  row.className = `page-row ${state.deletedPages.has(position) ? "is-deleted" : ""}`;
  row.dataset.position = String(position);

  const count = getInsertionCount(position);
  const isDeleted = state.deletedPages.has(position);
  const label = position === 0 ? "首页前" : `第 ${position} 页后`;
  const detail =
    position === 0
      ? "输出 PDF 最前面"
      : isDeleted
        ? `原始第 ${position} 页将从输出中删除`
        : `原始第 ${position} 页内容保持不变`;
  const thumbnailMarkup =
    position === 0
      ? `<div class="blank-preview" aria-hidden="true">空白</div>`
      : `<canvas class="page-thumb" data-page="${position}" aria-label="原始第 ${position} 页预览"></canvas>`;
  const deleteButton =
    position === 0
      ? ""
      : `<button class="delete-page" type="button">${isDeleted ? "恢复页面" : "删除页面"}</button>`;

  row.innerHTML = `
    <div class="page-id">
      ${thumbnailMarkup}
      <div>
        <strong>${label}</strong>
        <span>${detail}</span>
      </div>
    </div>
    <div class="page-tools">
      ${deleteButton}
      <div class="stepper" aria-label="${label} 空白页数量">
        <button class="minus" type="button" title="减少空白页" ${count === 0 || isDeleted ? "disabled" : ""}>-</button>
        <span>${isDeleted ? "删" : count}</span>
        <button class="plus" type="button" title="增加空白页" ${isDeleted ? "disabled" : ""}>+</button>
      </div>
    </div>
  `;

  row.querySelector(".minus").addEventListener("click", () => {
    setInsertionCount(position, getInsertionCount(position) - 1);
    renderPages();
  });

  row.querySelector(".plus").addEventListener("click", () => {
    setInsertionCount(position, getInsertionCount(position) + 1);
    renderPages();
  });

  row.querySelector(".delete-page")?.addEventListener("click", () => {
    if (state.deletedPages.has(position)) {
      state.deletedPages.delete(position);
    } else {
      state.deletedPages.add(position);
    }
    renderPages();
  });

  return row;
}

async function renderThumbnail(pageNumber, canvas, token) {
  if (!state.previewPdf) return;

  const page = await state.previewPdf.getPage(pageNumber);
  if (token !== state.renderToken) return;

  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(180 / baseViewport.width, 230 / baseViewport.height);
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
  const canvases = pageList.querySelectorAll(".page-thumb");

  for (const canvas of canvases) {
    const pageNumber = Number(canvas.dataset.page);
    renderThumbnail(pageNumber, canvas, token).catch((error) => {
      canvas.replaceWith(document.createTextNode(`预览失败：${error.message}`));
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

  pageList.appendChild(makeRow(0));
  for (let pageNumber = 1; pageNumber <= state.pageSizes.length; pageNumber += 1) {
    pageList.appendChild(makeRow(pageNumber));
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
  state.insertions.clear();
  state.deletedPages.clear();

  renderPages();
}

function addBlankPage(outputPdf, position) {
  const fallbackSize = state.pageSizes[0];
  const referenceSize = position === 0 ? fallbackSize : state.pageSizes[position - 1];
  outputPdf.addPage([referenceSize.width, referenceSize.height]);
}

function addLabelRange(outputPdf, outputIndex, labelSpec) {
  const nums = outputPdf.__pageLabelNums;
  nums.push(PDFNumber.of(outputIndex));
  nums.push(outputPdf.context.obj(labelSpec));
}

function applyPageLabels(outputPdf) {
  const nums = [];
  outputPdf.__pageLabelNums = nums;

  let outputIndex = 0;
  const beforeFirstCount = getInsertionCount(0);

  for (let blank = 0; blank < beforeFirstCount; blank += 1) {
    addLabelRange(outputPdf, outputIndex, {
      P: PDFHexString.fromText("空白"),
    });
    outputIndex += 1;
  }

  for (let pageNumber = 1; pageNumber <= state.pageSizes.length; pageNumber += 1) {
    if (state.deletedPages.has(pageNumber)) continue;

    addLabelRange(outputPdf, outputIndex, {
      S: PDFName.of("D"),
      St: PDFNumber.of(pageNumber),
    });
    outputIndex += 1;

    const blanksHere = getInsertionCount(pageNumber);
    for (let blank = 0; blank < blanksHere; blank += 1) {
      addLabelRange(outputPdf, outputIndex, {
        P: PDFHexString.fromText("空白"),
      });
      outputIndex += 1;
    }
  }

  outputPdf.catalog.set(
    PDFName.of("PageLabels"),
    outputPdf.context.obj({ Nums: nums }),
  );
  delete outputPdf.__pageLabelNums;
}

async function buildOutputPdf() {
  const sourcePdf = await PDFDocument.load(state.bytes);
  const outputPdf = await PDFDocument.create();
  const pageCount = sourcePdf.getPageCount();
  const outputCount = state.pageSizes.length - state.deletedPages.size + activeBlankPages();

  if (outputCount === 0) {
    throw new Error("输出 PDF 至少需要保留一页或插入一张空白页");
  }

  for (let blank = 0; blank < getInsertionCount(0); blank += 1) {
    addBlankPage(outputPdf, 0);
  }

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const originalPageNumber = pageIndex + 1;
    if (state.deletedPages.has(originalPageNumber)) continue;

    const [copiedPage] = await outputPdf.copyPages(sourcePdf, [pageIndex]);
    outputPdf.addPage(copiedPage);

    for (let blank = 0; blank < getInsertionCount(originalPageNumber); blank += 1) {
      addBlankPage(outputPdf, originalPageNumber);
    }
  }

  applyPageLabels(outputPdf);
  return outputPdf.save();
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

async function buildImagesPdf(files) {
  const outputPdf = await PDFDocument.create();

  for (const file of files) {
    const image = await embedImage(outputPdf, file);
    const page = outputPdf.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }

  return outputPdf.save();
}

async function renderPdfPagesToZip(file, imageType, extension, quality, statusEl) {
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const zip = new JSZip();
  const baseName = getFileBaseName(file);

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    statusEl.textContent = `正在渲染第 ${pageNumber}/${pdf.numPages} 页...`;
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

function applyCompressionPreset(mode) {
  const preset = compressionPresets[mode] ?? compressionPresets.balanced;
  compressQualityInput.value = String(preset.quality);
  compressScaleInput.value = String(preset.scale);
  compressGrayscaleInput.checked = preset.grayscale;
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
    alert(`读取合并文件失败：${error.message}`);
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
    alert(`读取 PDF 失败：${error.message}`);
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
    downloadBytes(outputBytes, `${baseName}-with-blanks.pdf`);
  } catch (error) {
    alert(`生成 PDF 失败：${error.message}`);
  } finally {
    downloadBtn.textContent = "下载处理后 PDF";
    updateSummary();
  }
});

resetBtn.addEventListener("click", () => {
  state.insertions.clear();
  state.deletedPages.clear();
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
    downloadBytes(outputBytes, `${baseName}-split.pdf`);
  } catch (error) {
    alert(`拆分 PDF 失败：${error.message}`);
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
    downloadBytes(outputBytes, "merged.pdf");
  } catch (error) {
    alert(`合并 PDF 失败：${error.message}`);
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

imageToPdfInput.addEventListener("change", (event) => {
  state.imageFiles = [...event.target.files].filter((file) => file.type.startsWith("image/"));
  imageToPdfBtn.disabled = state.imageFiles.length === 0;
  imageToPdfStatus.textContent =
    state.imageFiles.length === 0 ? "尚未选择图片" : `已选择 ${state.imageFiles.length} 张图片`;
});

imageToPdfBtn.addEventListener("click", async () => {
  if (state.imageFiles.length === 0) return;

  imageToPdfBtn.disabled = true;
  imageToPdfBtn.textContent = "生成中...";

  try {
    const outputBytes = await buildImagesPdf(state.imageFiles);
    downloadBytes(outputBytes, "images.pdf");
    imageToPdfStatus.textContent = `已生成 ${state.imageFiles.length} 页 PDF`;
  } catch (error) {
    alert(`图片转 PDF 失败：${error.message}`);
  } finally {
    imageToPdfBtn.textContent = "下载图片 PDF";
    imageToPdfBtn.disabled = state.imageFiles.length === 0;
  }
});

pdfToImagesInput.addEventListener("change", (event) => {
  state.pdfToImagesFile = event.target.files[0] ?? null;
  pdfToImagesBtn.disabled = !state.pdfToImagesFile;
  pdfToImagesStatus.textContent = state.pdfToImagesFile
    ? `已选择 ${state.pdfToImagesFile.name}`
    : "尚未选择 PDF";
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
    );
    downloadBytes(zipBytes, `${getFileBaseName(state.pdfToImagesFile)}-images.zip`, "application/zip");
    pdfToImagesStatus.textContent = "图片 ZIP 已生成";
  } catch (error) {
    alert(`PDF 转图片失败：${error.message}`);
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
    downloadBytes(outputBytes, `${getFileBaseName(state.textFile)}.pdf`);
    textToPdfStatus.textContent = "文本 PDF 已生成";
  } catch (error) {
    alert(`文本转 PDF 失败：${error.message}`);
  } finally {
    textToPdfBtn.textContent = "下载文本 PDF";
    textToPdfBtn.disabled = !state.textFile;
  }
});

compressPdfInput.addEventListener("change", (event) => {
  state.compressFile = event.target.files[0] ?? null;
  compressPdfBtn.disabled = !state.compressFile;
  compressPdfStatus.textContent = state.compressFile
    ? `已选择 ${state.compressFile.name}，${(state.compressFile.size / 1024 / 1024).toFixed(2)} MB`
    : "尚未选择 PDF";
});

compressModeSelect.addEventListener("change", () => {
  applyCompressionPreset(compressModeSelect.value);
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
    downloadBytes(outputBytes, `${getFileBaseName(state.compressFile)}-compressed.pdf`);
    compressPdfStatus.textContent = `${result.strategy}：${(beforeSize / 1024 / 1024).toFixed(2)} MB -> ${(afterSize / 1024 / 1024).toFixed(2)} MB，减少 ${ratio}%`;
  } catch (error) {
    alert(`PDF 压缩失败：${error.message}`);
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
    downloadBytes(textBytes, `${getFileBaseName(state.pdfToTextFile)}.txt`, "text/plain;charset=utf-8");
    pdfToTextStatus.textContent = "TXT 已生成";
  } catch (error) {
    alert(`PDF 转 TXT 失败：${error.message}`);
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
    downloadBytes(zipBytes, `${getFileBaseName(state.pdfToJpgFile)}-jpg.zip`, "application/zip");
    pdfToJpgStatus.textContent = `JPG ZIP 已生成，质量 ${(quality * 100).toFixed(0)}%`;
  } catch (error) {
    alert(`PDF 转 JPG 失败：${error.message}`);
  } finally {
    pdfToJpgBtn.textContent = "下载 JPG ZIP";
    pdfToJpgBtn.disabled = !state.pdfToJpgFile;
  }
});

renderPages();
renderMergeList();
switchPage(window.location.hash.slice(1) || "editPage");
