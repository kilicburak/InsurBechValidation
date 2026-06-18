function initDragger() {
  const app = document.getElementById("app");
  const dragger = document.getElementById("dragger");
  const MIN = 320, MAX_FROM_LEFT = 380;
  let dragging = false;
  const stored = parseInt(localStorage.getItem("side_width") || "", 10);
  if (stored) app.style.setProperty("--side-w", stored + "px");

  function move(clientX) {
    let w = window.innerWidth - clientX;
    w = Math.max(MIN, Math.min(window.innerWidth - MAX_FROM_LEFT, w));
    app.style.setProperty("--side-w", w + "px");
    refitPdf();
  }
  dragger.addEventListener("mousedown", (e) => {
    dragging = true;
    dragger.classList.add("active");
    document.body.style.userSelect = "none";
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => { if (dragging) move(e.clientX); });
  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    dragger.classList.remove("active");
    document.body.style.userSelect = "";
    const w = parseInt(getComputedStyle(app).getPropertyValue("--side-w"), 10);
    if (w) localStorage.setItem("side_width", String(w));
    refitPdf();
  });
  window.addEventListener("resize", refitPdf);
}

async function init() {
  document.getElementById("prev").onclick = () => go(-1);
  document.getElementById("skip").onclick = skip;
  document.getElementById("next").onclick = () => go(1);
  document.getElementById("export").onclick = exportJson;
  document.getElementById("exportAll").onclick = exportAll;
  document.getElementById("back").onclick = showChooser;
  document.getElementById("zoomIn").onclick = () => { if (pdfViewer) pdfViewer.currentScale *= 1.15; };
  document.getElementById("zoomOut").onclick = () => { if (pdfViewer) pdfViewer.currentScale /= 1.15; };
  const search = document.getElementById("search");
  search.addEventListener("keydown", (e) => { if (e.key === "Enter") runFind("again"); });
  search.addEventListener("input", () => runFind(""));
  document.getElementById("findNext").onclick = () => runFind("again");
  document.getElementById("findPrev").onclick = () => runFind("again-prev");
  document.getElementById("textOut").onclick = () => setFormZoom(formZoom - 0.05);
  document.getElementById("textIn").onclick = () => setFormZoom(formZoom + 0.05);
  applyFormZoom();
  initDragger();
  await ensureAccess();
  try {
    await discover();
  } catch (e) {
    document.getElementById("grid").innerHTML = '<div class="empty">Could not load manifest.json: ' + e.message + '</div>';
    return;
  }
  renderGrid();
  const m = location.hash.match(/doc=([^&]+)/);
  if (m) {
    const entry = docs.find((e) => e.id === decodeURIComponent(m[1]));
    if (entry) openDoc(entry);
  }
}
if (document.readyState === "complete") init();
else window.addEventListener("load", init);
