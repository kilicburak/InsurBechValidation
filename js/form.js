function gate(field, value, valueText, options, rec) {
  rec.skipped = false;
  if (rec[field + "_correct"] === value) {
    rec[field + "_correct"] = null;
    rec[field + "_fix"] = options === "text" ? "" : null;
  } else {
    rec[field + "_correct"] = value;
    if (value) {
      rec[field + "_fix"] = (Array.isArray(options) || options === "choice") ? null : "";
    } else if (options === "text" && typeof rec[field + "_fix"] !== "string") {
      rec[field + "_fix"] = "";
    }
  }
  saveStore();
  renderForm();
}

function buildGate(label, valueText, field, options, rec, def, showValue) {
  const wrap = document.createElement("div");
  if (label) {
    const lab = document.createElement("div");
    lab.className = "label"; lab.textContent = label;
    wrap.appendChild(lab);
  }
  if (showValue !== false) {
    const val = document.createElement("div");
    val.className = "value";
    const c = rec[field + "_correct"];
    if (c === true) val.classList.add("ok");
    else if (c === false) val.classList.add("bad");
    val.textContent = valueText;
    wrap.appendChild(val);
  }
  if (def) {
    const d = document.createElement("div");
    d.className = "typedef"; d.textContent = def;
    wrap.appendChild(d);
  }
  const correct = rec[field + "_correct"];
  const g = document.createElement("div");
  g.className = "gate";
  const ok = document.createElement("button");
  ok.textContent = "Correct";
  if (correct === true) ok.className = "sel-good";
  ok.onclick = () => gate(field, true, valueText, options, rec);
  const bad = document.createElement("button");
  bad.textContent = "Incorrect";
  if (correct === false) bad.className = "sel-bad";
  bad.onclick = () => gate(field, false, valueText, options, rec);
  g.appendChild(ok); g.appendChild(bad);
  if (showErrors && correct === null) g.classList.add("needs");
  wrap.appendChild(g);
  const fix = document.createElement("div");
  fix.className = "fix" + (correct === false ? "" : " hidden");
  if (Array.isArray(options)) {
    const opts = document.createElement("div");
    opts.className = "opts";
    options.forEach((o) => {
      const b = document.createElement("button");
      b.textContent = TYPE_NAMES[o] || o;
      if (TYPE_DEFS[o]) b.title = TYPE_DEFS[o];
      if (rec[field + "_fix"] === o) b.className = "sel";
      b.onclick = () => { rec[field + "_fix"] = o; saveStore(); renderForm(); };
      opts.appendChild(b);
    });
    fix.appendChild(opts);
  } else if (options === "text") {
    const ta = document.createElement("textarea");
    ta.rows = 5;
    ta.value = rec[field + "_fix"] || "";
    ta.placeholder = "Write the correct " + field;
    ta.oninput = () => { rec[field + "_fix"] = ta.value; saveStore(); flashSaved(ta); };
    fix.appendChild(ta);
  }
  if (fix.childNodes.length) wrap.appendChild(fix);
  if (showErrors) {
    let msg = null;
    if (correct === null) msg = "Choose Correct or Incorrect";
    else if (correct === false && options === "text" && !(rec[field + "_fix"] || "").trim()) msg = "Write the corrected version";
    else if (correct === false && Array.isArray(options) && !rec[field + "_fix"]) msg = "Pick the correct option";
    if (msg) {
      const e = document.createElement("div");
      e.className = "fielderr"; e.textContent = msg;
      wrap.appendChild(e);
    }
  }
  return wrap;
}

function buildMentions(task, rec) {
  const mentions = Array.isArray(task.mentions) ? task.mentions : [];
  const wrap = document.createElement("div");
  wrap.className = "mentions";

  mentions.forEach((s, i) => {
    const j = rec.mentions_judgments[i];
    const row = document.createElement("div");
    row.className = "mblock";

    const top = document.createElement("div");
    top.className = "mrow" + (j.state === "correct" ? " ok" : "") + (j.state === "incorrect" ? " edit" : "") + (j.state === "irrelevant" ? " wrong" : "") + (showErrors && !j.state ? " needs" : "");
    const txt = document.createElement("span");
    txt.className = "mtext"; txt.textContent = s;
    const acts = document.createElement("div");
    acts.className = "macts";

    const set = (state) => {
      j.state = j.state === state ? null : state;
      if (j.state !== "incorrect") j.fix = "";
      rec.skipped = false;
      saveStore(); renderForm();
    };

    const ok = document.createElement("button");
    ok.textContent = "Correct";
    if (j.state === "correct") ok.className = "sel-good";
    ok.onclick = () => set("correct");
    const inc = document.createElement("button");
    inc.textContent = "Incorrect";
    if (j.state === "incorrect") inc.className = "sel-edit";
    inc.onclick = () => set("incorrect");
    const irr = document.createElement("button");
    irr.textContent = "Irrelevant";
    if (j.state === "irrelevant") irr.className = "sel-bad";
    irr.onclick = () => set("irrelevant");

    acts.appendChild(ok); acts.appendChild(inc); acts.appendChild(irr);
    top.appendChild(txt); top.appendChild(acts);
    row.appendChild(top);

    if (j.state === "incorrect") {
      const fix = document.createElement("div");
      fix.className = "mfix";
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = j.fix;
      inp.placeholder = "Write the correct section";
      inp.oninput = () => { j.fix = inp.value; saveStore(); flashSaved(inp); };
      fix.appendChild(inp);
      row.appendChild(fix);
      if (showErrors && !j.fix.trim()) {
        const e = document.createElement("div");
        e.className = "fielderr"; e.textContent = "Write the corrected section name";
        row.appendChild(e);
      }
    }
    wrap.appendChild(row);
  });

  if (rec.mentions_added.length) {
    const chips = document.createElement("div");
    chips.className = "chips";
    rec.mentions_added.forEach((s) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.appendChild(document.createTextNode(s));
      const x = document.createElement("button");
      x.textContent = "×";
      x.onclick = () => {
        rec.mentions_added = rec.mentions_added.filter((m) => m !== s);
        saveStore(); renderForm();
      };
      chip.appendChild(x);
      chips.appendChild(chip);
    });
    wrap.appendChild(chips);
  }

  if (!addOpen) {
    const plus = document.createElement("button");
    plus.className = "plus";
    plus.textContent = "+";
    plus.title = "Add a missing section";
    plus.onclick = () => { addOpen = true; renderForm(); };
    wrap.appendChild(plus);
  } else {
    const addRow = document.createElement("div");
    addRow.className = "addrow";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Add a missing section";
    const addBtn = document.createElement("button");
    addBtn.textContent = "Add";
    const commit = () => {
      const v = input.value.trim();
      if (v && !rec.mentions_added.includes(v)) rec.mentions_added.push(v);
      saveStore(); renderForm();
    };
    addBtn.onclick = commit;
    const cancel = document.createElement("button");
    cancel.textContent = "✕";
    cancel.className = "addcancel";
    cancel.title = "Cancel";
    cancel.onclick = () => { addOpen = false; renderForm(); };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") commit();
      else if (e.key === "Escape") { addOpen = false; renderForm(); }
    });
    addRow.appendChild(input); addRow.appendChild(addBtn); addRow.appendChild(cancel);
    wrap.appendChild(addRow);
    setTimeout(() => input.focus(), 0);
  }

  return wrap;
}
function locateEvidence(row, quote) {
  const search = document.getElementById("search");
  search.value = quote;
  runFind("");
  document.querySelectorAll(".evrow.active").forEach((r) => r.classList.remove("active"));
  row.classList.add("active");
}

function buildEvidence(task) {
  if (!SHOW_DOCUMENT_EVIDENCE || !docEntry) return null;
  const perDoc = evidenceData[docEntry.id] || {};
  const entry = perDoc[String(task.id)];
  const items = Array.isArray(entry) ? entry : entry && entry.ev;
  if (!items || !items.length) return null;
  const verdict = !Array.isArray(entry) && entry.verdict;
  const note = !Array.isArray(entry) && entry.note;

  const wrap = document.createElement("div");
  wrap.className = "evidence" + (evidenceOpen ? "" : " closed");
  const head = document.createElement("div");
  head.className = "evhead";
  const lab = document.createElement("div");
  lab.className = "label";
  lab.textContent = "Document evidence (" + items.length + ")";
  head.appendChild(lab);
  if (SHOW_EVIDENCE_ANALYSIS && verdict) {
    const badge = document.createElement("span");
    badge.className = "evbadge " + verdict;
    badge.textContent = VERDICT_LABELS[verdict] || verdict;
    head.appendChild(badge);
  }
  const arrow = document.createElement("span");
  arrow.className = "evarrow";
  arrow.textContent = evidenceOpen ? "▾" : "▸";
  head.appendChild(arrow);
  head.onclick = () => { evidenceOpen = !evidenceOpen; renderForm(); };
  wrap.appendChild(head);
  if (!evidenceOpen) return wrap;

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Starting points for locating the relevant wording. Click a quote to search it in the PDF; the match counter above the PDF shows where it lands. Judge the item yourself.";
  wrap.appendChild(hint);

  if (SHOW_EVIDENCE_ANALYSIS && note) {
    const n = document.createElement("div");
    n.className = "evnote " + (verdict || "ok");
    n.textContent = note;
    wrap.appendChild(n);
  }

  items.forEach((e) => {
    const row = document.createElement("div");
    row.className = "evrow";
    const txt = document.createElement("div");
    txt.className = "evtxt";
    const sec = document.createElement("span");
    sec.className = "evsec";
    sec.textContent = e.s;
    const q = document.createElement("span");
    q.className = "evq";
    q.textContent = "“" + e.t + "”";
    txt.appendChild(sec);
    txt.appendChild(q);
    const pg = document.createElement("span");
    pg.className = "evpage";
    pg.textContent = "p." + e.p + " ▶";
    row.appendChild(txt);
    row.appendChild(pg);
    row.onclick = () => locateEvidence(row, e.t);
    wrap.appendChild(row);
  });
  return wrap;
}

function renderForm() {
  const form = document.getElementById("form");
  if (!tasks.length) { form.innerHTML = '<div class="empty">No tasks.</div>'; return; }
  const task = tasks[current];
  const rec = record(task);
  document.getElementById("counter").textContent = (current + 1) + " / " + tasks.length;
  form.innerHTML = "";

  const qLab = document.createElement("div");
  qLab.className = "label"; qLab.textContent = "Question";
  const q = document.createElement("div");
  q.className = "question" + (rec.question_correct === true ? " ok" : rec.question_correct === false ? " bad" : "");
  q.textContent = task.question;
  form.appendChild(qLab); form.appendChild(q);
  const qh = document.createElement("div");
  qh.className = "qhelper";
  qh.textContent = "Is this question answerable from this document and clearly worded? Mark Correct to keep it, or Incorrect to rewrite it.";
  form.appendChild(qh);
  form.appendChild(buildGate("", task.question, "question", "text", rec, null, false));

  form.appendChild(buildGate("Answer", task.answer, "answer", null, rec, null));

  const reasoningGate = buildGate("Reasoning", task.reasoning, "reasoning", "text", rec, null);
  const ev = buildEvidence(task);
  if (ev) reasoningGate.insertBefore(ev, reasoningGate.querySelector(".gate"));
  form.appendChild(reasoningGate);

  const mLab = document.createElement("div");
  mLab.className = "label"; mLab.textContent = "Mentions";
  form.appendChild(mLab);
  const hint = document.createElement("div");
  hint.className = "hint";
  hint.innerHTML = "For each section: <b>Correct</b> if it is relevant and well written, <b>Incorrect</b> if the wording is wrong (then fix it), or <b>Irrelevant</b> if it should not be here." +
    '<details class="rules">' +
    "<summary>Numbering &amp; casing rules</summary>" +
    "<div>Ignore missing section numbers and differences in capitalization, only the wording matters, unless a number is present and wrong.</div>" +
    '<div class="examples">' +
    '<div><span class="yes">&#10003;</span> Section reads &ldquo;1. Title&rdquo;, written as &ldquo;Title&rdquo;</div>' +
    '<div><span class="yes">&#10003;</span> Section reads &ldquo;Title&rdquo;, written as &ldquo;TITLE&rdquo; (or vice versa)</div>' +
    '<div><span class="no">&#10007;</span> Section reads &ldquo;1. Title&rdquo;, written as &ldquo;2. Title&rdquo;</div>' +
    "</div></details>";
  form.appendChild(hint);
  form.appendChild(buildMentions(task, rec));

  form.appendChild(buildGate("Reasoning type", TYPE_NAMES[task.reasoning_type] || task.reasoning_type, "type", task.type_options, rec, TYPE_DEFS[task.reasoning_type] || null));

  const gl = document.createElement("details");
  gl.className = "formglossary";
  const sum = document.createElement("summary");
  sum.textContent = "Reasoning types";
  gl.appendChild(sum);
  Object.keys(TYPE_DEFS).forEach((k) => {
    const row = document.createElement("div");
    row.className = "g";
    const b = document.createElement("b");
    b.textContent = k + " — ";
    row.appendChild(b);
    row.appendChild(document.createTextNode(TYPE_DEFS[k]));
    gl.appendChild(row);
  });
  form.appendChild(gl);
}

function missingFields(task, rec) {
  const m = [];
  if (rec.question_correct === null) m.push("Question: choose Correct or Incorrect");
  else if (rec.question_correct === false && !(rec.question_fix || "").trim()) m.push("Question: write the corrected version");
  if (rec.answer_correct === null) m.push("Answer: choose Correct or Incorrect");
  if (rec.reasoning_correct === null) m.push("Reasoning: choose Correct or Incorrect");
  else if (rec.reasoning_correct === false && !(rec.reasoning_fix || "").trim()) m.push("Reasoning: write the corrected version");
  if (rec.type_correct === null) m.push("Reasoning type: choose Correct or Incorrect");
  else if (rec.type_correct === false && !rec.type_fix) m.push("Reasoning type: pick the correct type");
  const mentions = task.mentions || [];
  if (mentions.some((s, i) => !rec.mentions_judgments[i] || !rec.mentions_judgments[i].state)) {
    m.push("Mentions: mark each section Correct, Incorrect, or Irrelevant");
  } else if (mentions.some((s, i) => rec.mentions_judgments[i].state === "incorrect" && !(rec.mentions_judgments[i].fix || "").trim())) {
    m.push("Mentions: write the corrected name for any marked Incorrect");
  }
  return m;
}

function skip() {
  const task = tasks[current];
  const fresh = blank(task);
  fresh.skipped = true;
  results[task.id] = fresh;
  saveStore();
  showErrors = false;
  current = Math.min(tasks.length - 1, current + 1);
  addOpen = false;
  evidenceOpen = false;
  document.getElementById("formScroll").scrollTop = 0;
  renderForm();
}

function go(delta) {
  if (delta > 0) {
    const task = tasks[current];
    const rec = record(task);
    const miss = missingFields(task, rec);
    if (miss.length) {
      showErrors = true;
      renderForm();
      const el = document.querySelector(".fielderr, .mrow.needs");
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
  }
  showErrors = false;
  current = Math.max(0, Math.min(tasks.length - 1, current + delta));
  addOpen = false;
  evidenceOpen = false;
  document.getElementById("formScroll").scrollTop = 0;
  renderForm();
}
