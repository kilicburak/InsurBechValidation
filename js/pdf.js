function initViewer() {
  const container = document.getElementById("viewerContainer");
  container.innerHTML = '<div id="viewer" class="pdfViewer"></div>';
  eventBus = new pdfjsViewer.EventBus();
  const linkService = new pdfjsViewer.PDFLinkService({ eventBus });
  findController = new pdfjsViewer.PDFFindController({ eventBus, linkService });
  pdfViewer = new pdfjsViewer.PDFViewer({ container, eventBus, linkService, findController });
  linkService.setViewer(pdfViewer);
  const origScroll = findController.scrollMatchIntoView.bind(findController);
  findController.scrollMatchIntoView = (params) => {
    const armed = findController._scrollMatches !== false;
    origScroll(params);
    const el = params && params.element;
    const sel = findController.selected;
    if (!armed || !el || !sel || params.pageIndex !== sel.pageIdx || params.matchIndex !== sel.matchIdx) return;
    requestAnimationFrame(() => {
      const target = el.querySelector(".highlight.selected") || el;
      centerMatch(target, container);
    });
  };
  eventBus.on("pagesinit", () => {
    pdfViewer.currentScaleValue = "page-width";
    setTimeout(() => { if (pdfViewer.pdfDocument) pdfViewer.currentScaleValue = "page-width"; }, 120);
  });
  eventBus.on("updatefindmatchescount", (e) => showMatches(e.matchesCount));
  eventBus.on("updatefindcontrolstate", (e) => showMatches(e.matchesCount));
}

function centerMatch(el, container) {
  const cRect = container.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  const top = container.scrollTop + (eRect.top - cRect.top) - container.clientHeight / 2 + eRect.height / 2;
  container.scrollTo({ top: Math.max(0, top) });
}

function showMatches(mc) {
  const el = document.getElementById("matches");
  const show = mc && mc.total;
  document.getElementById("findPrev").style.display = show ? "" : "none";
  document.getElementById("findNext").style.display = show ? "" : "none";
  el.textContent = show ? mc.current + " / " + mc.total : "";
}

async function loadPdf(url, attempt) {
  attempt = attempt || 0;
  initViewer();
  try {
    const doc = await pdfjsLib.getDocument(encodeURI(url)).promise;
    pdfViewer.setDocument(doc);
    pdfViewer.linkService.setDocument(doc, null);
  } catch (e) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 400));
      return loadPdf(url, attempt + 1);
    }
  }
}

function runFind(type) {
  const query = document.getElementById("search").value;
  eventBus.dispatch("find", {
    source: null, type, query,
    phraseSearch: true, caseSensitive: false, entireWord: false,
    highlightAll: true, findPrevious: type === "again-prev",
  });
}
function refitPdf() {
  if (pdfViewer && pdfViewer.pdfDocument && pdfViewer.currentScaleValue === "page-width") {
    pdfViewer.currentScaleValue = "page-width";
  }
}
