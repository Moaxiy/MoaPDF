export function createAppState() {
  return {
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
    draggedPage: null,
    mergeFiles: [],
    imageFiles: [],
    draggedImageIndex: undefined,
    pdfToImagesFile: null,
    textFile: null,
    compressFile: null,
    pdfToTextFile: null,
    pdfToJpgFile: null,
    photoResizeFile: null,
    photoResizeBitmap: null,
    photoResizeDrawBox: null,
    taskProgressTimer: null,
  };
}

export function resetEditorState(state) {
  state.file = null;
  state.bytes = null;
  state.previewPdf = null;
  state.renderToken += 1;
  state.pageSizes = [];
  state.pageOrder = [];
  state.insertions.clear();
  state.deletedPages.clear();
  state.selectedPages.clear();
  state.lastSelectedPage = null;
  state.draggedPage = null;
}
