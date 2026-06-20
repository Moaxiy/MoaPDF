export function createProgressController(state, dom) {
  function clearTaskProgressTimer() {
    if (state.taskProgressTimer) {
      window.clearTimeout(state.taskProgressTimer);
      state.taskProgressTimer = null;
    }
  }

  function showTaskProgress(title, detail, current = 0, total = 1) {
    const safeTotal = Math.max(total, 1);
    const ratio = Math.max(0, Math.min(1, current / safeTotal));
    const percent = Math.round(ratio * 100);

    clearTaskProgressTimer();
    dom.taskProgress.classList.remove("is-hidden");
    dom.taskProgress.classList.remove("is-error", "is-complete");
    dom.taskProgress.classList.add("is-active");
    dom.taskProgress.setAttribute("aria-busy", "true");
    dom.taskProgressTitle.textContent = title;
    dom.taskProgressValue.textContent = `${percent}%`;
    dom.taskProgressBar.style.width = `${percent}%`;
    dom.taskProgressDetail.textContent = detail;

    const progressTrack = dom.taskProgressBar.parentElement;
    progressTrack?.setAttribute("role", "progressbar");
    progressTrack?.setAttribute("aria-valuemin", "0");
    progressTrack?.setAttribute("aria-valuemax", "100");
    progressTrack?.setAttribute("aria-valuenow", String(percent));
  }

  function completeTaskProgress(title, detail) {
    showTaskProgress(title, detail, 1, 1);
    dom.taskProgress.classList.remove("is-active", "is-error");
    dom.taskProgress.classList.add("is-complete");
    dom.taskProgress.setAttribute("aria-busy", "false");
    state.taskProgressTimer = window.setTimeout(() => {
      dom.taskProgress.classList.add("is-hidden");
      dom.taskProgress.classList.remove("is-complete");
      state.taskProgressTimer = null;
    }, 2200);
  }

  function cancelTaskProgress(title, detail) {
    showTaskProgress(title, detail, 1, 1);
    dom.taskProgress.classList.remove("is-active", "is-error");
    dom.taskProgress.classList.add("is-complete");
    dom.taskProgress.setAttribute("aria-busy", "false");
    state.taskProgressTimer = window.setTimeout(() => {
      dom.taskProgress.classList.add("is-hidden");
      dom.taskProgress.classList.remove("is-complete");
      state.taskProgressTimer = null;
    }, 1200);
  }

  function failTaskProgress(title, detail) {
    clearTaskProgressTimer();
    dom.taskProgress.classList.remove("is-hidden");
    dom.taskProgress.classList.remove("is-active", "is-complete");
    dom.taskProgress.classList.add("is-error");
    dom.taskProgress.setAttribute("aria-busy", "false");
    dom.taskProgressTitle.textContent = title;
    dom.taskProgressValue.textContent = "Failed";
    dom.taskProgressBar.style.width = "100%";
    dom.taskProgressDetail.textContent = detail;
    dom.taskProgressBar.parentElement?.setAttribute("aria-valuenow", "100");
  }

  function resetTaskProgressTone() {
    clearTaskProgressTimer();
    dom.taskProgress.classList.remove("is-error", "is-complete");
  }

  return {
    showTaskProgress,
    completeTaskProgress,
    cancelTaskProgress,
    failTaskProgress,
    resetTaskProgressTone,
  };
}
