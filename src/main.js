import { PDFDocument, PDFHexString, PDFName, PDFNumber } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const pdfInput = document.querySelector("#pdfInput");
const fileNameEl = document.querySelector("#fileName");
const pageCountEl = document.querySelector("#pageCount");
const originalCountEl = document.querySelector("#originalCount");
const blankCountEl = document.querySelector("#blankCount");
const outputCountEl = document.querySelector("#outputCount");
const downloadBtn = document.querySelector("#downloadBtn");
const resetBtn = document.querySelector("#resetBtn");
const pageList = document.querySelector("#pageList");
const emptyState = document.querySelector("#emptyState");
const previewList = document.querySelector("#previewList");
const previewEmpty = document.querySelector("#previewEmpty");

const state = {
  file: null,
  bytes: null,
  previewPdf: null,
  renderToken: 0,
  pageSizes: [],
  insertions: new Map(),
};

function totalBlankPages() {
  return [...state.insertions.values()].reduce((sum, count) => sum + count, 0);
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

function updateSummary() {
  const originalCount = state.pageSizes.length;
  const blankCount = totalBlankPages();

  originalCountEl.textContent = String(originalCount);
  blankCountEl.textContent = String(blankCount);
  outputCountEl.textContent = String(originalCount + blankCount);
  downloadBtn.disabled = !state.file || blankCount === 0;
  resetBtn.disabled = !state.file || blankCount === 0;

  if (!state.file) {
    fileNameEl.textContent = "尚未选择";
    pageCountEl.textContent = "选择 PDF 后显示页码";
    return;
  }

  fileNameEl.textContent = state.file.name;
  pageCountEl.textContent = `${originalCount} 页，已安排 ${blankCount} 张空白页`;
}

function getOutputSequence() {
  if (!state.file) return [];

  const sequence = [];
  const beforeFirstCount = getInsertionCount(0);

  for (let blank = 0; blank < beforeFirstCount; blank += 1) {
    sequence.push({ type: "blank", label: "首页前空白" });
  }

  for (let pageNumber = 1; pageNumber <= state.pageSizes.length; pageNumber += 1) {
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
  row.className = "page-row";
  row.dataset.position = String(position);

  const count = getInsertionCount(position);
  const label = position === 0 ? "首页前" : `第 ${position} 页后`;
  const detail =
    position === 0
      ? "输出 PDF 最前面"
      : `原始第 ${position} 页内容保持不变`;
  const thumbnailMarkup =
    position === 0
      ? `<div class="blank-preview" aria-hidden="true">空白</div>`
      : `<canvas class="page-thumb" data-page="${position}" aria-label="原始第 ${position} 页预览"></canvas>`;

  row.innerHTML = `
    <div class="page-id">
      ${thumbnailMarkup}
      <div>
        <strong>${label}</strong>
        <span>${detail}</span>
      </div>
    </div>
    <div class="stepper" aria-label="${label} 空白页数量">
      <button class="minus" type="button" title="减少空白页" ${count === 0 ? "disabled" : ""}>-</button>
      <span>${count}</span>
      <button class="plus" type="button" title="增加空白页">+</button>
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

  for (let blank = 0; blank < getInsertionCount(0); blank += 1) {
    addBlankPage(outputPdf, 0);
  }

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const [copiedPage] = await outputPdf.copyPages(sourcePdf, [pageIndex]);
    outputPdf.addPage(copiedPage);

    const originalPageNumber = pageIndex + 1;
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
    renderPages();
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!state.file || totalBlankPages() === 0) return;

  downloadBtn.disabled = true;
  downloadBtn.textContent = "生成中...";

  try {
    const outputBytes = await buildOutputPdf();
    const baseName = state.file.name.replace(/\.pdf$/i, "");
    downloadBytes(outputBytes, `${baseName}-with-blanks.pdf`);
  } catch (error) {
    alert(`生成 PDF 失败：${error.message}`);
  } finally {
    downloadBtn.textContent = "下载新 PDF";
    updateSummary();
  }
});

resetBtn.addEventListener("click", () => {
  state.insertions.clear();
  renderPages();
});

renderPages();
