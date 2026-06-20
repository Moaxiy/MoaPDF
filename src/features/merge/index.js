import { PDFDocument } from "../../shared/pdf.js";
import { getErrorMessage } from "../../shared/utils.js";
import { saveBytes } from "../../shared/files.js";

export function initMergeFeature({ state, dom, progress }) {
  async function readPdfPageCount(file) {
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    return pdf.getPageCount();
  }

  function updateMergeControls() {
    const canMerge = state.mergeFiles.length >= 2;
    dom.mergeEmpty.hidden = state.mergeFiles.length > 0;
    dom.mergeDownloadBtn.disabled = !canMerge;
    dom.mergeClearBtn.disabled = state.mergeFiles.length === 0;
  }

  function renderMergeList() {
    dom.mergeList.innerHTML = "";
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
      dom.mergeList.appendChild(row);
    });
    updateMergeControls();
  }

  async function loadMergeFiles(files) {
    const pdfFiles = [...files].filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length === 0) return;
    progress.resetTaskProgressTone();
    progress.showTaskProgress("合并 PDF", `正在读取 ${pdfFiles.length} 个 PDF`, 0, pdfFiles.length);
    dom.mergeDownloadBtn.disabled = true;
    dom.mergeDownloadBtn.textContent = "读取中...";
    try {
      const items = [];
      for (const [index, file] of pdfFiles.entries()) {
        progress.showTaskProgress("合并 PDF", `正在读取第 ${index + 1} / ${pdfFiles.length} 个文件`, index, pdfFiles.length);
        items.push({ file, pageCount: await readPdfPageCount(file) });
        progress.showTaskProgress("合并 PDF", `已读取第 ${index + 1} / ${pdfFiles.length} 个文件`, index + 1, pdfFiles.length);
      }
      state.mergeFiles = items;
      renderMergeList();
      progress.completeTaskProgress("合并 PDF", `已就绪 ${items.length} 个文件`);
    } catch (error) {
      progress.failTaskProgress("合并 PDF", `读取失败：${getErrorMessage(error)}`);
      alert(`读取待合并文件失败：${getErrorMessage(error)}`);
    } finally {
      dom.mergeDownloadBtn.textContent = "下载合并后的 PDF";
      updateMergeControls();
    }
  }

  async function buildMergedPdf() {
    const outputPdf = await PDFDocument.create();
    for (const [index, item] of state.mergeFiles.entries()) {
      progress.showTaskProgress("合并 PDF", `正在合并第 ${index + 1} / ${state.mergeFiles.length} 个文件`, index, state.mergeFiles.length);
      const bytes = await item.file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(bytes);
      const pageIndexes = sourcePdf.getPageIndices();
      const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndexes);
      copiedPages.forEach((page) => outputPdf.addPage(page));
      progress.showTaskProgress("合并 PDF", `已合并第 ${index + 1} / ${state.mergeFiles.length} 个文件`, index + 1, state.mergeFiles.length);
    }
    return outputPdf.save();
  }

  dom.mergeInput.addEventListener("change", async (event) => {
    await loadMergeFiles(event.target.files);
  });
  dom.mergeDownloadBtn.addEventListener("click", async () => {
    if (state.mergeFiles.length < 2) return;
    progress.resetTaskProgressTone();
    progress.showTaskProgress("合并 PDF", `正在准备 ${state.mergeFiles.length} 个文件`, 0, state.mergeFiles.length);
    dom.mergeDownloadBtn.disabled = true;
    dom.mergeDownloadBtn.textContent = "合并中...";
    try {
      const outputBytes = await buildMergedPdf();
      const saved = await saveBytes(progress, outputBytes, "merged.pdf");
      if (saved) {
        progress.completeTaskProgress("合并 PDF", "已生成合并后的 PDF");
      } else {
        progress.cancelTaskProgress("合并 PDF", "已取消保存");
      }
    } catch (error) {
      progress.failTaskProgress("合并 PDF", `合并失败：${getErrorMessage(error)}`);
      alert(`合并 PDF 失败：${getErrorMessage(error)}`);
    } finally {
      dom.mergeDownloadBtn.textContent = "下载合并后的 PDF";
      updateMergeControls();
    }
  });
  dom.mergeClearBtn.addEventListener("click", () => {
    state.mergeFiles = [];
    dom.mergeInput.value = "";
    renderMergeList();
  });

  renderMergeList();
}
