import { PDFDocument, pdfjsLib } from "../../shared/pdf.js";
import { getErrorMessage } from "../../shared/utils.js";
import { readRecentFiles, saveBytes, writeRecentFiles } from "../../shared/files.js";
import { resetEditorState } from "../../app/state.js";

export function initEditorFeature({ state, dom, progress }) {
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
    if (dom.selectionCount) {
      dom.selectionCount.textContent = selectedCount > 0 ? `已选择 ${selectedCount} 页` : "未选择页面";
    }
    if (dom.selectAllBtn) dom.selectAllBtn.disabled = !state.file;
    if (dom.clearSelectionBtn) dom.clearSelectionBtn.disabled = selectedCount === 0;
    if (dom.batchDeleteBtn) dom.batchDeleteBtn.disabled = selectedCount === 0;
    if (dom.batchRestoreBtn) dom.batchRestoreBtn.disabled = selectedCount === 0;
    if (dom.batchBlankBtn) dom.batchBlankBtn.disabled = selectedCount === 0;
  }

  function updateSummary() {
    const originalCount = state.pageSizes.length;
    const blankCount = activeBlankPages();
    const deletedCount = state.deletedPages.size;
    const outputCount = getOutputCount();

    dom.originalCountEl.textContent = String(originalCount);
    dom.blankCountEl.textContent = String(blankCount);
    dom.deletedCountEl.textContent = String(deletedCount);
    dom.outputCountEl.textContent = String(outputCount);
    dom.downloadBtn.disabled = !state.file || !hasPendingPageEdits();
    dom.resetBtn.disabled = !state.file || !hasPendingPageEdits();
    dom.splitDownloadBtn.disabled = !state.file || dom.splitRangeInput.value.trim() === "";
    updateSelectionControls();

    if (!state.file) {
      dom.fileNameEl.textContent = "未选择文件";
      dom.pageCountEl.textContent = "请选择一个 PDF 查看页面";
      return;
    }

    dom.fileNameEl.textContent = state.file.name;
    dom.pageCountEl.textContent = `共 ${outputCount} 页，插入空白页 ${blankCount} 页，移除 ${deletedCount} 页`;
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
          detail: `插入在第 ${pageNumber} 页后`,
          afterPage: pageNumber,
          blankIndex: blank,
        });
      }
    }
    return sequence;
  }

  function renderPreview() {
    if (!dom.previewList || !dom.previewEmpty) return;
    dom.previewList.innerHTML = "";
    const sequence = getOutputSequence();

    if (!state.file || sequence.length === 0) {
      dom.previewEmpty.hidden = false;
      dom.previewEmpty.textContent = state.file ? "当前没有可输出的页面" : "请选择 PDF 预览最终顺序";
      return;
    }

    dom.previewEmpty.hidden = true;
    for (const [index, item] of sequence.entries()) {
      const outputPageNumber = index + 1;
      const card = document.createElement("article");
      card.className = `preview-card ${item.type === "blank" ? "blank" : ""}`;
      card.dataset.outputIndex = String(index);
      card.innerHTML = item.type === "page"
        ? `
          <div class="preview-card-media">
            <canvas class="page-thumb preview-thumb" data-page="${item.sourcePage}" aria-label="预览第 ${outputPageNumber} 页"></canvas>
          </div>
          <div class="preview-card-body">
            <strong>第 ${outputPageNumber} 页</strong>
            <span>${item.detail}</span>
          </div>
        `
        : `
          <div class="preview-card-media">
            <div class="blank-preview preview-blank" aria-hidden="true">空白页</div>
          </div>
          <div class="preview-card-body">
            <strong>第 ${outputPageNumber} 页</strong>
            <span>${item.detail}</span>
          </div>
        `;
      dom.previewList.appendChild(card);
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
        <canvas class="page-thumb" data-page="${pageNumber}" aria-label="预览原始第 ${pageNumber} 页"></canvas>
        <div>
          <strong>第 ${pageNumber} 页</strong>
          <span>${isDeleted ? `原始第 ${pageNumber} 页将被移除` : `原始第 ${pageNumber} 页将保留在输出中`}</span>
        </div>
      </div>
      <div class="page-tools">
        <button class="delete-page" type="button">${isDeleted ? "恢复页面" : "移除页面"}</button>
        <div class="order-tools" aria-label="移动第 ${pageNumber} 页">
          <button class="move-up" type="button" title="上移页面" ${orderIndex <= 0 ? "disabled" : ""}>上移</button>
          <button class="move-down" type="button" title="下移页面" ${orderIndex >= state.pageOrder.length - 1 ? "disabled" : ""}>下移</button>
        </div>
        <div class="stepper" aria-label="第 ${pageNumber} 页后插入空白页">
          <button class="minus" type="button" title="减少空白页" ${count === 0 || isDeleted ? "disabled" : ""}>-</button>
          <span>${isDeleted ? "已移除" : count}</span>
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
    row.addEventListener("dragleave", () => row.classList.remove("is-drop-target"));
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
    row.querySelector(".move-up").addEventListener("click", () => movePageInOrder(pageNumber, -1));
    row.querySelector(".move-down").addEventListener("click", () => movePageInOrder(pageNumber, 1));
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
        <div class="blank-preview" aria-hidden="true">空白页</div>
        <div>
          <strong>第 ${pageNumber} 页后的空白页</strong>
          <span>该页面会插入到原始第 ${pageNumber} 页之后</span>
        </div>
      </div>
      <div class="page-tools blank-tools">
        <span>实时输出预览</span>
        <button class="delete-blank" type="button">移除空白页</button>
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
    dom.pageList.innerHTML = "";
    dom.emptyState.hidden = Boolean(state.file);

    if (!state.file) {
      updateSummary();
      renderPreview();
      return;
    }

    for (const pageNumber of state.pageOrder) {
      dom.pageList.appendChild(makePageRow(pageNumber));
      if (state.deletedPages.has(pageNumber)) continue;
      for (let blank = 0; blank < getInsertionCount(pageNumber); blank += 1) {
        dom.pageList.appendChild(makeInsertedBlankRow(pageNumber, blank));
      }
    }

    updateSummary();
    renderPreview();
    renderVisibleThumbnails();
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
      dom.recentFiles.innerHTML = "";
      return;
    }
    dom.recentFiles.innerHTML = `
      <span>最近打开</span>
      <div>${files.map((file) => `<strong title="${file.name}">${file.name}</strong>`).join("")}</div>
    `;
  }

  async function loadPdf(file) {
    progress.showTaskProgress("读取 PDF", `正在读取 ${file.name}`, 0, 4);
    const bytes = await file.arrayBuffer();
    progress.showTaskProgress("读取 PDF", "正在解析页面", 1, 4);
    const pdfBytes = bytes.slice(0);
    const pdf = await PDFDocument.load(bytes);
    progress.showTaskProgress("读取 PDF", "正在准备预览", 2, 4);
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

    progress.showTaskProgress("读取 PDF", `已加载 ${state.pageSizes.length} 页`, 3, 4);
    renderPages();
    progress.completeTaskProgress("读取 PDF", `${file.name} 已就绪`);
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

    return outputPdf.save({ useObjectStreams: true, addDefaultPage: false });
  }

  function parsePageRanges(value, pageCount) {
    const pages = [];
    const seen = new Set();
    const chunks = value.split(",").map((chunk) => chunk.trim()).filter(Boolean);
    if (chunks.length === 0) {
      throw new Error("请输入页码范围");
    }

    for (const chunk of chunks) {
      const match = chunk.match(/^(\d+)(?:-(\d+))?$/);
      if (!match) throw new Error(`页码范围格式无效：${chunk}`);
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : start;
      if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
        throw new Error(`页码范围超出限制：${chunk}`);
      }
      if (start > end) {
        throw new Error(`起始页不能大于结束页：${chunk}`);
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
    const selectedPages = parsePageRanges(dom.splitRangeInput.value, sourcePdf.getPageCount());
    const copiedPages = await outputPdf.copyPages(sourcePdf, selectedPages.map((pageNumber) => pageNumber - 1));
    copiedPages.forEach((page) => outputPdf.addPage(page));
    return outputPdf.save();
  }

  dom.pdfInput.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      progress.resetTaskProgressTone();
      await loadPdf(file);
    } catch (error) {
      progress.failTaskProgress("读取 PDF", `读取失败：${getErrorMessage(error)}`);
      alert(`读取 PDF 失败：${getErrorMessage(error)}`);
      resetEditorState(state);
      renderPages();
    }
  });

  dom.downloadBtn.addEventListener("click", async () => {
    if (!state.file || !hasPendingPageEdits()) return;
    progress.resetTaskProgressTone();
    progress.showTaskProgress("导出 PDF", "正在生成输出 PDF", 0, 1);
    dom.downloadBtn.disabled = true;
    dom.downloadBtn.textContent = "导出中...";
    try {
      const outputBytes = await buildOutputPdf();
      const baseName = state.file.name.replace(/\.pdf$/i, "");
      const saved = await saveBytes(progress, outputBytes, `${baseName}-with-blanks.pdf`);
      if (saved) {
        progress.completeTaskProgress("导出 PDF", "已生成编辑后的 PDF");
      } else {
        progress.cancelTaskProgress("导出 PDF", "已取消保存");
      }
    } catch (error) {
      progress.failTaskProgress("导出 PDF", `导出失败：${getErrorMessage(error)}`);
      alert(`导出 PDF 失败：${getErrorMessage(error)}`);
    } finally {
      dom.downloadBtn.textContent = "下载编辑后的 PDF";
      updateSummary();
    }
  });

  dom.resetBtn.addEventListener("click", () => {
    state.insertions.clear();
    state.deletedPages.clear();
    state.selectedPages.clear();
    state.pageOrder = Array.from({ length: state.pageSizes.length }, (_, index) => index + 1);
    renderPages();
  });

  dom.selectAllBtn?.addEventListener("click", () => {
    state.pageOrder.forEach((pageNumber) => state.selectedPages.add(pageNumber));
    renderPages();
  });
  dom.clearSelectionBtn?.addEventListener("click", () => {
    state.selectedPages.clear();
    renderPages();
  });
  dom.batchDeleteBtn?.addEventListener("click", () => {
    state.selectedPages.forEach((pageNumber) => state.deletedPages.add(pageNumber));
    renderPages();
  });
  dom.batchRestoreBtn?.addEventListener("click", () => {
    state.selectedPages.forEach((pageNumber) => state.deletedPages.delete(pageNumber));
    renderPages();
  });
  dom.batchBlankBtn?.addEventListener("click", () => {
    state.selectedPages.forEach((pageNumber) => {
      if (!state.deletedPages.has(pageNumber)) {
        setInsertionCount(pageNumber, getInsertionCount(pageNumber) + 1);
      }
    });
    renderPages();
  });

  dom.splitRangeInput.addEventListener("input", updateSummary);
  dom.splitDownloadBtn.addEventListener("click", async () => {
    if (!state.file) return;
    progress.resetTaskProgressTone();
    progress.showTaskProgress("拆分 PDF", "正在生成拆分后的 PDF", 0, 1);
    dom.splitDownloadBtn.disabled = true;
    dom.splitDownloadBtn.textContent = "拆分中...";
    try {
      const outputBytes = await buildSplitPdf();
      const baseName = state.file.name.replace(/\.pdf$/i, "");
      const saved = await saveBytes(progress, outputBytes, `${baseName}-split.pdf`);
      if (saved) {
        progress.completeTaskProgress("拆分 PDF", "已生成拆分后的 PDF");
      } else {
        progress.cancelTaskProgress("拆分 PDF", "已取消保存");
      }
    } catch (error) {
      progress.failTaskProgress("拆分 PDF", `拆分失败：${getErrorMessage(error)}`);
      alert(`拆分 PDF 失败：${getErrorMessage(error)}`);
    } finally {
      dom.splitDownloadBtn.textContent = "下载拆分后的 PDF";
      updateSummary();
    }
  });

  renderRecentFiles();
  renderPages();

  return {
    parsePageRanges,
    renderPages,
  };
}
