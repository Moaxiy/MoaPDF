import { getDom } from "./dom.js";
import { createProgressController } from "./progress.js";
import { initRouter } from "./router.js";
import { createAppState } from "./state.js";
import { initConvertFeature } from "../features/convert/index.js";
import { initEditorFeature } from "../features/editor/index.js";
import { initMergeFeature } from "../features/merge/index.js";
import { initPhotoFeature } from "../features/photo/index.js";

export function bootstrapApp() {
  const state = createAppState();
  const dom = getDom();
  const progress = createProgressController(state, dom);

  initRouter(dom);
  const editor = initEditorFeature({ state, dom, progress });
  initMergeFeature({ state, dom, progress });
  initConvertFeature({ state, dom, progress, editor });
  initPhotoFeature({ state, dom, progress });
}
