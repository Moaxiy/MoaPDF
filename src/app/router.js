export function initRouter(dom) {
  function switchPage(targetId) {
    const targetExists = [...dom.appPages].some((page) => page.id === targetId);
    const nextTargetId = targetExists ? targetId : "editPage";

    dom.appPages.forEach((page) => {
      page.hidden = page.id !== nextTargetId;
      page.classList.toggle("is-active", page.id === nextTargetId);
    });

    dom.navTabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.pageTarget === nextTargetId);
    });

    if (window.location.hash !== `#${nextTargetId}`) {
      window.history.replaceState(null, "", `#${nextTargetId}`);
    }
  }

  dom.navTabs.forEach((tab) => {
    tab.addEventListener("click", () => switchPage(tab.dataset.pageTarget));
  });

  window.addEventListener("hashchange", () => {
    switchPage(window.location.hash.slice(1) || "editPage");
  });

  switchPage(window.location.hash.slice(1) || "editPage");

  return { switchPage };
}
