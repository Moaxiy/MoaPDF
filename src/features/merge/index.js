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
          <span>${item.pageCount} pages</span>
        </div>
        <div class="merge-row-actions">
          <button type="button" class="move-up" ${index === 0 ? "disabled" : ""}>Up</button>
          <button type="button" class="move-down" ${index === state.mergeFiles.length - 1 ? "disabled" : ""}>Down</button>
          <button type="button" class="remove">Remove</button>
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
    progress.showTaskProgress("Merge PDFs", `Reading ${pdfFiles.length} PDFs`, 0, pdfFiles.length);
    dom.mergeDownloadBtn.disabled = true;
    dom.mergeDownloadBtn.textContent = "Reading...";
    try {
      const items = [];
      for (const [index, file] of pdfFiles.entries()) {
        progress.showTaskProgress("Merge PDFs", `Reading ${index + 1} of ${pdfFiles.length}`, index, pdfFiles.length);
        items.push({ file, pageCount: await readPdfPageCount(file) });
        progress.showTaskProgress("Merge PDFs", `Loaded ${index + 1} of ${pdfFiles.length}`, index + 1, pdfFiles.length);
      }
      state.mergeFiles = items;
      renderMergeList();
      progress.completeTaskProgress("Merge PDFs", `${items.length} files are ready`);
    } catch (error) {
      progress.failTaskProgress("Merge PDFs", `Read failed: ${getErrorMessage(error)}`);
      alert(`Reading merge files failed: ${getErrorMessage(error)}`);
    } finally {
      dom.mergeDownloadBtn.textContent = "Download merged PDF";
      updateMergeControls();
    }
  }

  async function buildMergedPdf() {
    const outputPdf = await PDFDocument.create();
    for (const [index, item] of state.mergeFiles.entries()) {
      progress.showTaskProgress("Merge PDFs", `Merging ${index + 1} of ${state.mergeFiles.length}`, index, state.mergeFiles.length);
      const bytes = await item.file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(bytes);
      const pageIndexes = sourcePdf.getPageIndices();
      const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndexes);
      copiedPages.forEach((page) => outputPdf.addPage(page));
      progress.showTaskProgress("Merge PDFs", `Merged ${index + 1} of ${state.mergeFiles.length}`, index + 1, state.mergeFiles.length);
    }
    return outputPdf.save();
  }

  dom.mergeInput.addEventListener("change", async (event) => {
    await loadMergeFiles(event.target.files);
  });
  dom.mergeDownloadBtn.addEventListener("click", async () => {
    if (state.mergeFiles.length < 2) return;
    progress.resetTaskProgressTone();
    progress.showTaskProgress("Merge PDFs", `Preparing ${state.mergeFiles.length} files`, 0, state.mergeFiles.length);
    dom.mergeDownloadBtn.disabled = true;
    dom.mergeDownloadBtn.textContent = "Merging...";
    try {
      const outputBytes = await buildMergedPdf();
      const saved = await saveBytes(progress, outputBytes, "merged.pdf");
      if (saved) {
        progress.completeTaskProgress("Merge PDFs", "Merged PDF created");
      } else {
        progress.cancelTaskProgress("Merge PDFs", "Save cancelled");
      }
    } catch (error) {
      progress.failTaskProgress("Merge PDFs", `Merge failed: ${getErrorMessage(error)}`);
      alert(`Merge PDF failed: ${getErrorMessage(error)}`);
    } finally {
      dom.mergeDownloadBtn.textContent = "Download merged PDF";
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
