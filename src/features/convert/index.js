import { JSZip, PDFDocument, pdfjsLib } from "../../shared/pdf.js";
import { A4_PORTRAIT_SIZE, canvasToBlob, clamp, formatFileSize, getErrorMessage, getFileBaseName } from "../../shared/utils.js";
import { saveBytes } from "../../shared/files.js";

const compressionPresets = {
  lossless: { quality: 0.92, scale: 1.4, grayscale: false },
  balanced: { quality: 0.72, scale: 1.15, grayscale: false },
  strong: { quality: 0.58, scale: 0.95, grayscale: false },
  extreme: { quality: 0.42, scale: 0.78, grayscale: true },
};

export function initConvertFeature({ state, dom, progress, editor }) {
  function parseLoosePageList(value, pageCount) {
    try {
      return value.trim() ? editor.parsePageRanges(value, pageCount) : [];
    } catch {
      return [];
    }
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
    if (file.type === "image/jpeg" || /\.(jpe?g)$/i.test(file.name)) return pdf.embedJpg(bytes);
    if (file.type === "image/png" || /\.png$/i.test(file.name)) return pdf.embedPng(bytes);
    const pngBytes = await convertImageToPngBytes(file);
    return pdf.embedPng(pngBytes);
  }

  function getImageToPdfOptions() {
    return {
      pageSize: dom.imageToPdfPageSize.value,
      margin: Number(dom.imageToPdfMargin.value),
    };
  }

  function getImagePdfPageSize(image, options) {
    if (options.pageSize === "a4-portrait") return A4_PORTRAIT_SIZE;
    if (options.pageSize === "a4-landscape") return [A4_PORTRAIT_SIZE[1], A4_PORTRAIT_SIZE[0]];
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
    for (const [index, file] of files.entries()) {
      progress.showTaskProgress("图片转 PDF", `正在处理第 ${index + 1} / ${files.length} 张图片`, index, files.length);
      const image = await embedImage(outputPdf, file);
      const [pageWidth, pageHeight] = getImagePdfPageSize(image, options);
      const page = outputPdf.addPage([pageWidth, pageHeight]);
      page.drawImage(image, getFittedImageBox(image, pageWidth, pageHeight, options.margin));
      progress.showTaskProgress("图片转 PDF", `已处理第 ${index + 1} / ${files.length} 张图片`, index + 1, files.length);
    }
    return outputPdf.save();
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
      progress.showTaskProgress("图片转 PDF", `正在生成第 ${index + 1} / ${files.length} 个 PDF`, index, files.length);
      dom.imageToPdfStatus.textContent = `正在生成第 ${index + 1} / ${files.length} 个 PDF...`;
      const pdfBytes = await buildImagesPdf([file], options);
      const baseName = getFileBaseName(file) || `image-${index + 1}`;
      zip.file(getUniqueZipFileName(baseName, usedNames), pdfBytes);
      progress.showTaskProgress("图片转 PDF", `已生成第 ${index + 1} / ${files.length} 个 PDF`, index + 1, files.length);
    }
    return zip.generateAsync({ type: "uint8array" });
  }

  async function renderPdfPagesToZip(file, imageType, extension, quality, statusEl, pageRange = "") {
    const bytes = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const zip = new JSZip();
    const baseName = getFileBaseName(file);
    const pageNumbers = pageRange.trim()
      ? editor.parsePageRanges(pageRange, pdf.numPages)
      : Array.from({ length: pdf.numPages }, (_, index) => index + 1);

    for (const [index, pageNumber] of pageNumbers.entries()) {
      progress.showTaskProgress("PDF 转图片", `正在渲染第 ${index + 1} / ${pageNumbers.length} 页`, index, pageNumbers.length);
      statusEl.textContent = `正在渲染第 ${index + 1} / ${pageNumbers.length} 页...`;
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
      progress.showTaskProgress("PDF 转图片", `已渲染第 ${index + 1} / ${pageNumbers.length} 页`, index + 1, pageNumbers.length);
    }
    return zip.generateAsync({ type: "uint8array" });
  }

  async function buildPdfText(file) {
    const bytes = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      progress.showTaskProgress("PDF 转 TXT", `正在提取第 ${pageNumber} / ${pdf.numPages} 页文本`, pageNumber - 1, pdf.numPages);
      dom.pdfToTextStatus.textContent = `正在提取第 ${pageNumber} / ${pdf.numPages} 页文本...`;
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
      pages.push(`--- 第 ${pageNumber} 页 ---\n${pageText}`);
      progress.showTaskProgress("PDF 转 TXT", `已提取第 ${pageNumber} / ${pdf.numPages} 页文本`, pageNumber, pdf.numPages);
    }
    return new TextEncoder().encode(pages.join("\n\n") || "");
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
    page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }

  async function buildTextPdf(file) {
    const text = await file.text();
    const measureCanvas = document.createElement("canvas");
    const context = measureCanvas.getContext("2d");
    context.font = "28px 'Segoe UI', 'Microsoft YaHei', sans-serif";
    const lines = wrapCanvasText(context, text, 1016);
    const outputPdf = await PDFDocument.create();
    const linesPerPage = 40;
    const pageTotal = Math.max(1, Math.ceil(Math.max(lines.length, 1) / linesPerPage));
    let pageIndex = 0;
    for (let start = 0; start < Math.max(lines.length, 1); start += linesPerPage) {
      progress.showTaskProgress("文本转 PDF", `正在生成第 ${pageIndex + 1} / ${pageTotal} 页`, pageIndex, pageTotal);
      await addTextCanvasPage(outputPdf, lines, start, linesPerPage);
      pageIndex += 1;
      progress.showTaskProgress("文本转 PDF", `已生成第 ${pageIndex} / ${pageTotal} 页`, pageIndex, pageTotal);
    }
    return outputPdf.save();
  }

  async function compressPdfFile(file) {
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    return pdf.save({ useObjectStreams: true, addDefaultPage: false });
  }

  function estimateCompressedSize(file, options) {
    if (!file) return null;
    if (options.mode === "lossless") {
      return { min: file.size * 0.88, max: file.size * 1.02, method: "无损压缩预估" };
    }
    const qualityWeight = options.quality / compressionPresets.balanced.quality;
    const scaleWeight = Math.pow(options.scale / compressionPresets.balanced.scale, 1.8);
    const grayscaleWeight = options.grayscale ? 0.82 : 1;
    const baseWeightByMode = { balanced: 0.62, strong: 0.48, extreme: 0.36 };
    const modeWeight = baseWeightByMode[options.mode] ?? baseWeightByMode.balanced;
    const expectedRatio = clamp(modeWeight * qualityWeight * scaleWeight * grayscaleWeight, 0.12, 1.08);
    return {
      min: file.size * clamp(expectedRatio * 0.78, 0.08, 1.05),
      max: file.size * clamp(expectedRatio * 1.22, 0.12, 1.18),
      method: "重绘压缩预估",
    };
  }

  function getCompressionOptions() {
    return {
      mode: dom.compressModeSelect.value,
      quality: Number(dom.compressQualityInput.value),
      scale: Number(dom.compressScaleInput.value),
      grayscale: dom.compressGrayscaleInput.checked,
    };
  }

  function updateCompressionEstimate(actualResult = null) {
    const file = state.compressFile;
    if (!file) {
      dom.compressEstimatePanel.classList.add("is-empty");
      dom.compressEstimateSize.textContent = "请选择 PDF";
      dom.compressOriginalSize.textContent = "--";
      dom.compressSavedSize.textContent = "--";
      dom.compressEstimateRatio.textContent = "--";
      dom.compressEstimateHint.textContent = "选择 PDF 后会自动更新压缩预估。";
      return;
    }
    dom.compressEstimatePanel.classList.remove("is-empty");
    dom.compressOriginalSize.textContent = formatFileSize(file.size);
    if (actualResult) {
      const savedBytes = Math.max(0, file.size - actualResult.size);
      const ratio = file.size > 0 ? ((1 - actualResult.size / file.size) * 100).toFixed(1) : "0.0";
      dom.compressEstimatePanel.classList.add("has-actual");
      dom.compressEstimateSize.textContent = formatFileSize(actualResult.size);
      dom.compressSavedSize.textContent = formatFileSize(savedBytes);
      dom.compressEstimateRatio.textContent = `${ratio}%`;
      dom.compressEstimateHint.textContent = `实际结果：${actualResult.strategy}`;
      return;
    }
    dom.compressEstimatePanel.classList.remove("has-actual");
    const estimate = estimateCompressedSize(file, getCompressionOptions());
    const middle = (estimate.min + estimate.max) / 2;
    const savedBytes = Math.max(0, file.size - middle);
    const ratio = file.size > 0 ? ((1 - middle / file.size) * 100).toFixed(0) : "0";
    const sizeText = Math.abs(estimate.max - estimate.min) < 1024
      ? formatFileSize(middle)
      : `${formatFileSize(estimate.min)} - ${formatFileSize(estimate.max)}`;
    dom.compressEstimateSize.textContent = sizeText;
    dom.compressSavedSize.textContent = formatFileSize(savedBytes);
    dom.compressEstimateRatio.textContent = `${ratio}%`;
    dom.compressEstimateHint.textContent = `${estimate.method}；实际大小会受 PDF 内容影响。`;
  }

  function applyCompressionPreset(mode) {
    const preset = compressionPresets[mode] ?? compressionPresets.balanced;
    dom.compressQualityInput.value = String(preset.quality);
    dom.compressScaleInput.value = String(preset.scale);
    dom.compressGrayscaleInput.checked = preset.grayscale;
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
      progress.showTaskProgress("压缩 PDF", `正在重绘第 ${pageNumber} / ${sourcePdf.numPages} 页`, pageNumber - 1, sourcePdf.numPages);
      dom.compressPdfStatus.textContent = `正在重绘第 ${pageNumber} / ${sourcePdf.numPages} 页...`;
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
      if (options.grayscale) applyGrayscale(context, canvas.width, canvas.height);
      const jpgBlob = await canvasToBlob(canvas, "image/jpeg", options.quality);
      const jpgImage = await outputPdf.embedJpg(await jpgBlob.arrayBuffer());
      const page = outputPdf.addPage([baseViewport.width, baseViewport.height]);
      page.drawImage(jpgImage, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height });
      progress.showTaskProgress("压缩 PDF", `已重绘第 ${pageNumber} / ${sourcePdf.numPages} 页`, pageNumber, sourcePdf.numPages);
    }
    return outputPdf.save({ useObjectStreams: true, addDefaultPage: false });
  }

  async function buildCompressedPdf(file) {
    const mode = dom.compressModeSelect.value;
    const losslessBytes = await compressPdfFile(file);
    if (mode === "lossless") {
      return { bytes: losslessBytes, strategy: "无损优化" };
    }
    const renderedBytes = await compressPdfByRendering(file, getCompressionOptions());
    if (renderedBytes.byteLength < losslessBytes.byteLength) {
      return { bytes: renderedBytes, strategy: "重绘压缩" };
    }
    return { bytes: losslessBytes, strategy: "无损优化体积更小" };
  }

  function updateImageToPdfControls() {
    const count = state.imageFiles.length;
    const mergeImages = dom.imageToPdfMergeInput.checked;
    const files = state.imageFiles.map((item) => item.file ?? item);
    dom.imageToPdfBtn.disabled = count === 0;
    dom.imageToPdfClearBtn.disabled = count === 0;
    dom.imageToPdfBtn.textContent = mergeImages
      ? "下载合并后的 PDF"
      : count > 1 ? "下载 PDF 压缩包" : "下载图片 PDF";

    if (count === 0) {
      dom.imageToPdfStatus.textContent = "未选择图片";
      return;
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const pageText = dom.imageToPdfPageSize.selectedOptions[0]?.textContent ?? "当前尺寸";
    const marginText = dom.imageToPdfMargin.selectedOptions[0]?.textContent ?? "当前边距";
    dom.imageToPdfStatus.textContent = mergeImages
      ? `已选择 ${count} 张图片（${formatFileSize(totalSize)}），${pageText} / ${marginText}，将合并为 1 个 PDF`
      : count > 1
        ? `已选择 ${count} 张图片（${formatFileSize(totalSize)}），${pageText} / ${marginText}，将生成 ${count} 个 PDF`
        : `已选择 1 张图片，${pageText} / ${marginText}，将生成 1 个 PDF`;
  }

  function getImageFileItems(files) {
    return files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}-${file.size}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
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
    dom.imageToPdfInput.value = "";
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
      dom.imageToPdfInput.value = "";
    }
    renderImageToPdfList();
    updateImageToPdfControls();
  }

  function renderImageToPdfList() {
    dom.imageToPdfList.innerHTML = "";
    if (state.imageFiles.length === 0) {
      dom.imageToPdfList.hidden = true;
      return;
    }
    dom.imageToPdfList.hidden = false;
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
          <button type="button" class="move-up" title="上移" ${index === 0 ? "disabled" : ""}>上移</button>
          <button type="button" class="move-down" title="下移" ${index === state.imageFiles.length - 1 ? "disabled" : ""}>下移</button>
          <button type="button" class="remove" title="移除">移除</button>
        </div>
      `;
      row.addEventListener("dragstart", () => {
        state.draggedImageIndex = index;
      });
      row.addEventListener("dragover", (event) => {
        event.preventDefault();
        row.classList.add("is-drop-target");
      });
      row.addEventListener("dragleave", () => row.classList.remove("is-drop-target"));
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
      dom.imageToPdfList.appendChild(row);
    });
  }

  async function saveSeparateImagePdfs(files, options) {
    if (files.length === 1) {
      const outputBytes = await buildImagesPdf([files[0]], options);
      const saved = await saveBytes(progress, outputBytes, `${getFileBaseName(files[0]) || "image"}.pdf`);
      if (!saved) return false;
      dom.imageToPdfStatus.textContent = "已生成 1 个 PDF";
      return true;
    }
    const zipBytes = await buildSeparateImagePdfsZip(files, options);
    const saved = await saveBytes(progress, zipBytes, "image-pdfs.zip", "application/zip");
    if (!saved) return false;
    dom.imageToPdfStatus.textContent = `已生成 ${files.length} 个 PDF，并已打包为 ZIP`;
    return true;
  }

  dom.imageToPdfInput.addEventListener("change", (event) => {
    addImageFiles(event.target.files);
    dom.imageToPdfInput.value = "";
  });
  dom.imageToPdfMergeInput.addEventListener("change", updateImageToPdfControls);
  dom.imageToPdfPageSize.addEventListener("change", updateImageToPdfControls);
  dom.imageToPdfMargin.addEventListener("change", updateImageToPdfControls);
  dom.imageToPdfClearBtn.addEventListener("click", clearImageFiles);
  dom.imageDropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dom.imageDropZone.classList.add("is-dragging");
  });
  dom.imageDropZone.addEventListener("dragleave", () => {
    dom.imageDropZone.classList.remove("is-dragging");
  });
  dom.imageDropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dom.imageDropZone.classList.remove("is-dragging");
    addImageFiles(event.dataTransfer.files);
  });
  dom.imageToPdfBtn.addEventListener("click", async () => {
    if (state.imageFiles.length === 0) return;
    progress.resetTaskProgressTone();
    progress.showTaskProgress("图片转 PDF", `正在准备 ${state.imageFiles.length} 张图片`, 0, state.imageFiles.length);
    dom.imageToPdfBtn.disabled = true;
    dom.imageToPdfBtn.textContent = "生成中...";
    try {
      const files = state.imageFiles.map((item) => item.file ?? item);
      const options = getImageToPdfOptions();
      if (dom.imageToPdfMergeInput.checked) {
        const outputBytes = await buildImagesPdf(files, options);
        const saved = await saveBytes(progress, outputBytes, "images.pdf");
        if (!saved) {
          progress.cancelTaskProgress("图片转 PDF", "已取消保存");
          return;
        }
        dom.imageToPdfStatus.textContent = `已生成 1 个 PDF，共 ${files.length} 页`;
      } else {
        const saved = await saveSeparateImagePdfs(files, options);
        if (!saved) {
          progress.cancelTaskProgress("图片转 PDF", "已取消保存");
          return;
        }
      }
      progress.completeTaskProgress("图片转 PDF", "图片 PDF 已生成");
    } catch (error) {
      progress.failTaskProgress("图片转 PDF", `生成失败：${getErrorMessage(error)}`);
      alert(`图片转 PDF 失败：${getErrorMessage(error)}`);
    } finally {
      updateImageToPdfControls();
    }
  });

  dom.pdfToImagesInput.addEventListener("change", (event) => {
    state.pdfToImagesFile = event.target.files[0] ?? null;
    dom.pdfToImagesBtn.disabled = !state.pdfToImagesFile;
    dom.pdfToImagesStatus.textContent = state.pdfToImagesFile ? `已选择 ${state.pdfToImagesFile.name}` : "未选择 PDF";
  });
  dom.pdfToImagesRangeInput.addEventListener("input", () => {
    if (!state.pdfToImagesFile) return;
    const selectedPages = parseLoosePageList(dom.pdfToImagesRangeInput.value, 999999);
    dom.pdfToImagesStatus.textContent = selectedPages.length > 0
      ? `已选择 ${state.pdfToImagesFile.name}，将导出 ${selectedPages.length} 页`
      : `已选择 ${state.pdfToImagesFile.name}`;
  });
  dom.pdfToImagesBtn.addEventListener("click", async () => {
    if (!state.pdfToImagesFile) return;
    progress.resetTaskProgressTone();
    progress.showTaskProgress("PDF 转 PNG", "正在准备渲染 PDF", 0, 1);
    dom.pdfToImagesBtn.disabled = true;
    dom.pdfToImagesBtn.textContent = "转换中...";
    try {
      const zipBytes = await renderPdfPagesToZip(
        state.pdfToImagesFile,
        "image/png",
        "png",
        undefined,
        dom.pdfToImagesStatus,
        dom.pdfToImagesRangeInput.value,
      );
      const saved = await saveBytes(progress, zipBytes, `${getFileBaseName(state.pdfToImagesFile)}-images.zip`, "application/zip");
      if (saved) {
        dom.pdfToImagesStatus.textContent = "图片 ZIP 已生成";
        progress.completeTaskProgress("PDF 转 PNG", "图片 ZIP 已生成");
      } else {
        progress.cancelTaskProgress("PDF 转 PNG", "已取消保存");
      }
    } catch (error) {
      progress.failTaskProgress("PDF 转 PNG", `转换失败：${getErrorMessage(error)}`);
      alert(`PDF 转 PNG 失败：${getErrorMessage(error)}`);
    } finally {
      dom.pdfToImagesBtn.textContent = "下载图片 ZIP";
      dom.pdfToImagesBtn.disabled = !state.pdfToImagesFile;
    }
  });

  dom.textToPdfInput.addEventListener("change", (event) => {
    state.textFile = event.target.files[0] ?? null;
    dom.textToPdfBtn.disabled = !state.textFile;
    dom.textToPdfStatus.textContent = state.textFile ? `已选择 ${state.textFile.name}` : "未选择文本文件";
  });
  dom.textToPdfBtn.addEventListener("click", async () => {
    if (!state.textFile) return;
    progress.resetTaskProgressTone();
    progress.showTaskProgress("文本转 PDF", "正在排版文档", 0, 1);
    dom.textToPdfBtn.disabled = true;
    dom.textToPdfBtn.textContent = "生成中...";
    try {
      const outputBytes = await buildTextPdf(state.textFile);
      const saved = await saveBytes(progress, outputBytes, `${getFileBaseName(state.textFile)}.pdf`);
      if (saved) {
        dom.textToPdfStatus.textContent = "文本 PDF 已生成";
        progress.completeTaskProgress("文本转 PDF", "文本 PDF 已生成");
      } else {
        progress.cancelTaskProgress("文本转 PDF", "已取消保存");
      }
    } catch (error) {
      progress.failTaskProgress("文本转 PDF", `生成失败：${getErrorMessage(error)}`);
      alert(`文本转 PDF 失败：${getErrorMessage(error)}`);
    } finally {
      dom.textToPdfBtn.textContent = "下载文本 PDF";
      dom.textToPdfBtn.disabled = !state.textFile;
    }
  });

  dom.compressPdfInput.addEventListener("change", (event) => {
    state.compressFile = event.target.files[0] ?? null;
    dom.compressPdfBtn.disabled = !state.compressFile;
    dom.compressPdfStatus.textContent = state.compressFile ? `已选择 ${state.compressFile.name}，${formatFileSize(state.compressFile.size)}` : "未选择 PDF";
    updateCompressionEstimate();
  });
  dom.compressModeSelect.addEventListener("change", () => applyCompressionPreset(dom.compressModeSelect.value));
  [dom.compressQualityInput, dom.compressScaleInput, dom.compressGrayscaleInput].forEach((control) => {
    control.addEventListener("input", () => updateCompressionEstimate());
    control.addEventListener("change", () => updateCompressionEstimate());
  });
  dom.compressPdfBtn.addEventListener("click", async () => {
    if (!state.compressFile) return;
    progress.resetTaskProgressTone();
    progress.showTaskProgress("压缩 PDF", "正在分析压缩结果", 0, 1);
    dom.compressPdfBtn.disabled = true;
    dom.compressPdfBtn.textContent = "压缩中...";
    try {
      const result = await buildCompressedPdf(state.compressFile);
      const beforeSize = state.compressFile.size;
      const afterSize = result.bytes.byteLength;
      const ratio = ((1 - afterSize / beforeSize) * 100).toFixed(1);
      const saved = await saveBytes(progress, result.bytes, `${getFileBaseName(state.compressFile)}-compressed.pdf`);
      if (saved) {
        dom.compressPdfStatus.textContent = `${result.strategy}，${formatFileSize(beforeSize)} -> ${formatFileSize(afterSize)}，体积减少 ${ratio}%`;
        updateCompressionEstimate({ size: afterSize, strategy: result.strategy });
        progress.completeTaskProgress("压缩 PDF", `压缩完成，体积减少 ${ratio}%`);
      } else {
        progress.cancelTaskProgress("压缩 PDF", "已取消保存");
      }
    } catch (error) {
      progress.failTaskProgress("压缩 PDF", `压缩失败：${getErrorMessage(error)}`);
      alert(`压缩 PDF 失败：${getErrorMessage(error)}`);
    } finally {
      dom.compressPdfBtn.textContent = "下载压缩后的 PDF";
      dom.compressPdfBtn.disabled = !state.compressFile;
    }
  });

  dom.pdfToTextInput.addEventListener("change", (event) => {
    state.pdfToTextFile = event.target.files[0] ?? null;
    dom.pdfToTextBtn.disabled = !state.pdfToTextFile;
    dom.pdfToTextStatus.textContent = state.pdfToTextFile ? `已选择 ${state.pdfToTextFile.name}` : "未选择 PDF";
  });
  dom.pdfToTextBtn.addEventListener("click", async () => {
    if (!state.pdfToTextFile) return;
    progress.resetTaskProgressTone();
    progress.showTaskProgress("PDF 转 TXT", "正在准备提取文本", 0, 1);
    dom.pdfToTextBtn.disabled = true;
    dom.pdfToTextBtn.textContent = "提取中...";
    try {
      const textBytes = await buildPdfText(state.pdfToTextFile);
      const saved = await saveBytes(progress, textBytes, `${getFileBaseName(state.pdfToTextFile)}.txt`, "text/plain;charset=utf-8");
      if (saved) {
        dom.pdfToTextStatus.textContent = "TXT 已生成";
        progress.completeTaskProgress("PDF 转 TXT", "TXT 已生成");
      } else {
        progress.cancelTaskProgress("PDF 转 TXT", "已取消保存");
      }
    } catch (error) {
      progress.failTaskProgress("PDF 转 TXT", `提取失败：${getErrorMessage(error)}`);
      alert(`PDF 转 TXT 失败：${getErrorMessage(error)}`);
    } finally {
      dom.pdfToTextBtn.textContent = "下载 TXT";
      dom.pdfToTextBtn.disabled = !state.pdfToTextFile;
    }
  });

  dom.pdfToJpgInput.addEventListener("change", (event) => {
    state.pdfToJpgFile = event.target.files[0] ?? null;
    dom.pdfToJpgBtn.disabled = !state.pdfToJpgFile;
    dom.pdfToJpgStatus.textContent = state.pdfToJpgFile ? `已选择 ${state.pdfToJpgFile.name}` : "未选择 PDF";
  });
  dom.pdfToJpgBtn.addEventListener("click", async () => {
    if (!state.pdfToJpgFile) return;
    progress.resetTaskProgressTone();
    progress.showTaskProgress("PDF 转 JPG", "正在准备渲染 PDF", 0, 1);
    dom.pdfToJpgBtn.disabled = true;
    dom.pdfToJpgBtn.textContent = "转换中...";
    try {
      const quality = Number(dom.jpgQualityInput.value);
      const zipBytes = await renderPdfPagesToZip(
        state.pdfToJpgFile,
        "image/jpeg",
        "jpg",
        quality,
        dom.pdfToJpgStatus,
      );
      const saved = await saveBytes(progress, zipBytes, `${getFileBaseName(state.pdfToJpgFile)}-jpg.zip`, "application/zip");
      if (saved) {
        dom.pdfToJpgStatus.textContent = `JPG ZIP 已生成，质量 ${(quality * 100).toFixed(0)}%`;
        progress.completeTaskProgress("PDF 转 JPG", "JPG ZIP 已生成");
      } else {
        progress.cancelTaskProgress("PDF 转 JPG", "已取消保存");
      }
    } catch (error) {
      progress.failTaskProgress("PDF 转 JPG", `转换失败：${getErrorMessage(error)}`);
      alert(`PDF 转 JPG 失败：${getErrorMessage(error)}`);
    } finally {
      dom.pdfToJpgBtn.textContent = "下载 JPG 压缩包";
      dom.pdfToJpgBtn.disabled = !state.pdfToJpgFile;
    }
  });

  updateImageToPdfControls();
  updateCompressionEstimate();
}
