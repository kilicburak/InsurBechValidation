function openDoc(entry) {
  docEntry = entry;
  loadStore(entry.id);
  tasks = buildTasks(entry);
  current = 0;
  addOpen = false;
  showErrors = false;
  document.getElementById("docTitle").textContent = entry.title;
  document.getElementById("search").value = "";
  document.getElementById("matches").textContent = "";
  document.getElementById("chooser").style.display = "none";
  document.getElementById("app").classList.add("on");
  location.hash = "doc=" + encodeURIComponent(entry.id);
  if (entry.pdf) {
    requestAnimationFrame(() => requestAnimationFrame(() => loadPdf(entry.pdf)));
  }
  renderForm();
}

function showChooser() {
  document.getElementById("app").classList.remove("on");
  document.getElementById("chooser").style.display = "flex";
  location.hash = "";
  renderGrid();
}

function progressFor(entry) {
  let store = {};
  try { store = JSON.parse(localStorage.getItem(storeKey(entry.id))) || {}; } catch (e) {}
  const done = Object.values(store).filter(isDone).length;
  return { done, total: entry.count };
}
function makeCard(entry) {
  const p = progressFor(entry);
  const card = document.createElement("div");
  card.className = "card";
  card.onclick = () => openDoc(entry);
  const name = document.createElement("div");
  name.className = "name"; name.textContent = entry.title;
  const meta = document.createElement("div");
  meta.className = "meta"; meta.textContent = p.done + " / " + p.total + " validated";
  const bar = document.createElement("div");
  bar.className = "bar";
  const fill = document.createElement("i");
  fill.style.width = (p.total ? (100 * p.done / p.total) : 0) + "%";
  bar.appendChild(fill);
  card.appendChild(name); card.appendChild(meta); card.appendChild(bar);
  return card;
}

function renderGrid() {
  const root = document.getElementById("grid");
  root.innerHTML = "";
  if (!docs.length) { root.innerHTML = '<div class="empty">No documents in manifest.json.</div>'; return; }
  const order = catOrder.length ? catOrder.slice() : [];
  docs.forEach((d) => { if (!order.includes(d.category || "Other")) order.push(d.category || "Other"); });
  let grandDone = 0, grandTotal = 0;
  order.forEach((cat, idx) => {
    const inCat = docs.filter((d) => (d.category || "Other") === cat);
    if (!inCat.length) return;
    let done = 0, total = 0;
    inCat.forEach((e) => { const p = progressFor(e); done += p.done; total += p.total; });
    grandDone += done; grandTotal += total;
    const section = document.createElement("details");
    section.className = "catgroup";
    if (idx === 0) section.open = true;
    const head = document.createElement("summary");
    head.className = "cathead";
    head.textContent = cat + "  (" + done + "/" + total + ")";
    const grid = document.createElement("div");
    grid.className = "grid";
    inCat.forEach((entry) => grid.appendChild(makeCard(entry)));
    section.appendChild(head); section.appendChild(grid);
    root.appendChild(section);
  });
  const exportBtn = document.getElementById("exportAll");
  if (exportBtn) exportBtn.textContent = "Export all (" + grandDone + " / " + grandTotal + ")";
}
