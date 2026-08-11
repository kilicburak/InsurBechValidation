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

async function exportJson() {
  const data = recordsForDoc(docEntry);
  return saveAnnotationsToCloud(docEntry.id, data, document.getElementById("export"));
}

async function exportAll() {
  const merged = [];
  for (const entry of docs) {
    merged.push(...recordsForDoc(entry));
  }
  return saveAnnotationsToCloud("all", merged, document.getElementById("exportAll"));
}
