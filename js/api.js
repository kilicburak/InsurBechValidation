const annotationsApi = {
  async save(scope, annotator, accessCode, data) {
    const res = await fetch(WORKER_URL + "/annotations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-scope": scope || "all",
        "x-annotator": annotator || "anonymous",
        "x-owner": ownerId(),
        "x-access-key": accessCode || "",
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  },
};
function recordsForDoc(entry) {
  let store = {};
  try { store = JSON.parse(localStorage.getItem(storeKey(entry.id))) || {}; } catch (e) {}
  return entry.tasks.map((t) => {
    const rec = { ...blank(t), ...(store[t.id] || {}) };
    const mentions = (t.mentions || []).map((m, i) => {
      const j = rec.mentions_judgments[i] || { state: null, fix: "" };
      return { mention: m, state: j.state, fix: j.fix || "" };
    });
    return {
      doc: entry.id,
      id: t.id,
      question: { text: t.question, correct: rec.question_correct, fix: rec.question_fix || "" },
      answer: { text: t.answer, options: t.answer_options || [], correct: rec.answer_correct, fix: rec.answer_correct === false ? (t.answer_options[0] || null) : null },
      reasoning: { text: t.reasoning, correct: rec.reasoning_correct, fix: rec.reasoning_fix || "" },
      reasoning_type: { value: t.reasoning_type, options: t.type_options || [], correct: rec.type_correct, fix: rec.type_fix || null },
      mentions: mentions,
      mentions_added: rec.mentions_added || [],
      skipped: rec.skipped || false,
    };
  });
}

/**
 * Groups a document's recordings by their question id.
 */
async function recordingsByQuestion(docId) {
  let items = [];
  try { items = await recordingsApi.list(docId); } catch (e) { return {}; }
  const map = {};
  items.forEach((it) => {
    const qid = (it.meta && it.meta.questionId) || "";
    if (!map[qid]) map[qid] = [];
    map[qid].push({
      key: it.key,
      url: recordingsApi.streamUrl(it.key),
      durationMs: it.meta && it.meta.duration ? Number(it.meta.duration) : null,
      owner: (it.meta && it.meta.owner) || "",
      annotator: (it.meta && it.meta.annotator) || "",
      createdAt: (it.meta && it.meta.createdAt) || "",
    });
  });
  return map;
}

/**
 * Builds a document's records with matching recordings attached per question.
 */
async function recordsForDocWithAudio(entry) {
  const byQuestion = await recordingsByQuestion(entry.id);
  return recordsForDoc(entry).map((rec, i) => {
    const t = entry.tasks[i];
    const qid = String(t.id != null ? t.id : i + 1);
    return { ...rec, recordings: byQuestion[qid] || [] };
  });
}

function download(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function saveAnnotationsToCloud(scope, data, btn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Saving";
  try {
    await annotationsApi.save(scope, annotatorName(), accessKey(), data);
    btn.textContent = "Saved";
  } catch (e) {
    if (String(e.message).includes("401")) { localStorage.removeItem("access_key"); btn.textContent = "Wrong code"; }
    else btn.textContent = "Save failed";
  } finally {
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1500);
  }
}

/**
 * Assigns sequential annotator labels per unique owner across the records.
 */
function labelAnnotators(records) {
  const firstSeen = {};
  records.forEach((r) => (r.recordings || []).forEach((rc) => {
    const o = rc.owner || "";
    if (!o) return;
    if (!(o in firstSeen) || (rc.createdAt && rc.createdAt < firstSeen[o])) {
      firstSeen[o] = rc.createdAt || firstSeen[o] || "";
    }
  }));
  const owners = Object.keys(firstSeen).sort((a, b) => (firstSeen[a] || "").localeCompare(firstSeen[b] || "") || a.localeCompare(b));
  const label = {};
  owners.forEach((o, i) => { label[o] = "annotator_" + (i + 1); });
  records.forEach((r) => (r.recordings || []).forEach((rc) => {
    rc.annotator = rc.owner ? (label[rc.owner] || "annotator_unknown") : "annotator_unknown";
  }));
  return records;
}

async function exportJson() {
  const data = labelAnnotators(await recordsForDocWithAudio(docEntry));
  return saveAnnotationsToCloud(docEntry.id, data, document.getElementById("export"));
}

async function exportAll() {
  const merged = [];
  for (const entry of docs) {
    const recs = await recordsForDocWithAudio(entry);
    merged.push(...recs);
  }
  return saveAnnotationsToCloud("all", labelAnnotators(merged), document.getElementById("exportAll"));
}
