import { PDFDocument, PDFHexString, PDFName, PDFNumber } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

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

const state = {
  file: null,
  bytes: null,
  previewPdf: null,
  renderToken: 0,
  pageSizes: [],
  insertions: new Map(),
  deletedPages: new Set(),
  mergeFiles: [],
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

function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
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

renderPages();
renderMergeList();
