const TYPE_NAMES = {
  EEC: "Exclusion Exception Chain",
  PB: "Provision Boundary",
  PI: "Provision Interaction",
  CE: "Condition Evaluation",
};

const TYPE_DEFS = {
  EEC: "Exclusion exception chain: cover applies, an exclusion removes it, then an exception may restore it (or none applies).",
  PB: "Provision boundary: one clause sets a scope or limit; the answer turns on whether facts fall inside or outside it.",
  PI: "Provision interaction: two or more clauses apply, and the outcome comes from their combined effect.",
  CE: "Condition evaluation: a clause applies only if stated conditions are met; each is checked against the facts.",
};

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

let docs = [];
let catOrder = [];
let docEntry = null;
let tasks = [];
let results = {};
let current = 0;
let addOpen = false;
let showErrors = false;
let formZoom = parseFloat(localStorage.getItem("form_zoom")) || 1;

function applyFormZoom() {
  document.getElementById("form").style.zoom = formZoom;
}
function setFormZoom(z) {
  formZoom = Math.max(0.6, Math.min(1.3, Math.round(z * 100) / 100));
  localStorage.setItem("form_zoom", String(formZoom));
  applyFormZoom();
}

let pdfViewer = null;
let findController = null;
let eventBus = null;

const SHOW_DOCUMENT_EVIDENCE = !!(window.APP_CONFIG && window.APP_CONFIG.SHOW_DOCUMENT_EVIDENCE);
const SHOW_EVIDENCE_ANALYSIS = !!(window.APP_CONFIG && window.APP_CONFIG.SHOW_EVIDENCE_ANALYSIS);
const VERDICT_LABELS = { ok: "✓ Looks correct", warn: "⚠ Needs review", bad: "✗ Likely wrong" };
let evidenceData = {};
let evidenceOpen = false;

async function loadEvidence(docId) {
  if (!SHOW_DOCUMENT_EVIDENCE || evidenceData[docId]) return;
  try {
    const res = await fetch("evidences/" + docId + ".json", { cache: "no-store" });
    evidenceData[docId] = res.ok ? await res.json() : {};
  } catch (e) {
    evidenceData[docId] = {};
  }
  if (docEntry && docEntry.id === docId) renderForm();
}

async function discover() {
  const res = await fetch("manifest.json", { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status + " for manifest.json");
  const data = await res.json();
  docs = (data.docs || []).slice().sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  catOrder = data.categories || [];
}

function buildTasks(entry) {
  return entry.tasks;
}

function storeKey(id) { return "annotations_" + id; }
function loadStore(id) { try { results = JSON.parse(localStorage.getItem(storeKey(id))) || {}; } catch (e) { results = {}; } }
function saveStore() { localStorage.setItem(storeKey(docEntry.id), JSON.stringify(results)); }

const savedTimers = new WeakMap();
function flashSaved(field) {
  let badge = field.parentNode.querySelector(".savedtag");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "savedtag";
    badge.textContent = "✓ saved";
    field.parentNode.appendChild(badge);
  }
  const timers = savedTimers.get(badge) || {};
  clearTimeout(timers.show);
  clearTimeout(timers.hide);
  badge.classList.remove("show");
  timers.show = setTimeout(() => {
    badge.classList.add("show");
    timers.hide = setTimeout(() => badge.classList.remove("show"), 1500);
  }, 600);
  savedTimers.set(badge, timers);
}

function blank(task) {
  return {
    id: task.id,
    question_correct: null, question_fix: "",
    answer_correct: null, answer_fix: null,
    reasoning_correct: null, reasoning_fix: "",
    mentions_judgments: (task.mentions || []).map(() => ({ state: null, fix: "" })),
    mentions_added: [],
    type_correct: null, type_fix: null,
    skipped: false,
  };
}
function record(task) {
  const merged = { ...blank(task), ...(results[task.id] || {}) };
  const n = (task.mentions || []).length;
  if (!Array.isArray(merged.mentions_judgments)) merged.mentions_judgments = [];
  while (merged.mentions_judgments.length < n) merged.mentions_judgments.push({ correct: null, fix: "" });
  merged.mentions_judgments = merged.mentions_judgments.slice(0, n).map((j) => ({
    state: j && ["correct", "incorrect", "irrelevant"].includes(j.state) ? j.state : null,
    fix: j && typeof j.fix === "string" ? j.fix : "",
  }));
  if (!Array.isArray(merged.mentions_added)) merged.mentions_added = [];
  results[task.id] = merged;
  return merged;
}
function isDone(rec) { return rec && rec.question_correct !== null && rec.answer_correct !== null && rec.reasoning_correct !== null && rec.type_correct !== null; }
const WORKER_URL = (window.APP_CONFIG && window.APP_CONFIG.WORKER_URL) || "";
