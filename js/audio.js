const MIC_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.08A7 7 0 0 0 19 11z"/></svg>';
const PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
/**
 * Converts Float32 audio samples to signed 16 bit PCM.
 */
function floatTo16(input) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/**
 * Concatenates captured PCM chunks into one buffer.
 */
function mergeChunks(chunks) {
  let len = 0;
  chunks.forEach((c) => { len += c.length; });
  const all = new Int16Array(len);
  let offset = 0;
  chunks.forEach((c) => { all.set(c, offset); offset += c.length; });
  return all;
}

/**
 * Encodes mono PCM into an MP3 blob playable in every browser.
 */
function encodeMp3(chunks, sampleRate) {
  const samples = mergeChunks(chunks);
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const block = 1152;
  const parts = [];
  for (let i = 0; i < samples.length; i += block) {
    const slice = samples.subarray(i, i + block);
    const buf = encoder.encodeBuffer(slice);
    if (buf.length > 0) parts.push(new Uint8Array(buf));
  }
  const tail = encoder.flush();
  if (tail.length > 0) parts.push(new Uint8Array(tail));
  return new Blob(parts, { type: "audio/mpeg" });
}

function createAudioRecorder() {
  let ctx = null;
  let source = null;
  let processor = null;
  let stream = null;
  let sampleRate = 44100;
  let chunks = [];
  return {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      sampleRate = ctx.sampleRate;
      source = ctx.createMediaStreamSource(stream);
      processor = ctx.createScriptProcessor(4096, 1, 1);
      chunks = [];
      processor.onaudioprocess = (e) => {
        chunks.push(floatTo16(e.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(ctx.destination);
    },
    async stop() {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      let total = 0;
      chunks.forEach((c) => { total += c.length; });
      const durationMs = sampleRate ? Math.round((total / sampleRate) * 1000) : 0;
      const blob = encodeMp3(chunks, sampleRate);
      await ctx.close();
      return { blob, durationMs };
    },
  };
}

const recordingsApi = {
  async list(docId) {
    const res = await fetch(WORKER_URL + "/recordings?doc=" + encodeURIComponent(docId), {
      headers: { "x-access-key": accessKey() },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return data.items || [];
  },
  async upload(docId, questionId, questionText, annotator, accessCode, blob, durationMs) {
    const res = await fetch(WORKER_URL + "/recordings", {
      method: "POST",
      headers: {
        "content-type": blob.type || "audio/webm",
        "x-doc-id": docId,
        "x-question-id": questionId || "",
        "x-question-text": encodeURIComponent(questionText || ""),
        "x-annotator": annotator || "anonymous",
        "x-owner": ownerId(),
        "x-duration-ms": String(durationMs || 0),
        "x-access-key": accessCode || "",
      },
      body: blob,
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  },
  async remove(objectKey, accessCode) {
    const res = await fetch(WORKER_URL + "/recordings/" + objectKey, {
      method: "DELETE",
      headers: { "x-access-key": accessCode || "" },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
  },
  streamUrl(key) {
    return WORKER_URL + "/recordings/" + key;
  },
  async sign(key) {
    const res = await fetch(WORKER_URL + "/sign?key=" + encodeURIComponent(key), {
      headers: { "x-access-key": accessKey() },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return data.url;
  },
};

/**
 * Millisecond timestamp for a recording, preferring its stored creation time.
 */
function recordedAt(it) {
  const stamp = (it.meta && it.meta.createdAt) || it.uploaded;
  const ms = Date.parse(stamp);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Forces the browser to read the true clip length so the seek bar maps correctly.
 */
function fixAudioDuration(audio) {
  audio.addEventListener("loadedmetadata", function onMeta() {
    audio.removeEventListener("loadedmetadata", onMeta);
    audio.currentTime = 1e101;
    audio.addEventListener("timeupdate", function onSeek() {
      audio.removeEventListener("timeupdate", onSeek);
      audio.currentTime = 0;
    });
  });
}
function createRecorderPanel() {
  const recorder = createAudioRecorder();
  let docId = null;
  let questionId = null;
  let questionText = "";
  let recording = false;
  let busy = false;
  let lastTarget = null;

  const element = document.createElement("div");
  element.className = "recorder";
  const bar = document.createElement("div");
  bar.className = "recbar";
  const micBtn = document.createElement("button");
  micBtn.type = "button";
  micBtn.className = "micbtn";
  micBtn.innerHTML = MIC_SVG;
  const status = document.createElement("span");
  status.className = "recstatus";
  bar.appendChild(status);
  bar.appendChild(micBtn);
  const listEl = document.createElement("div");
  listEl.className = "reclist";
  element.appendChild(listEl);
  element.appendChild(bar);

  function paintMic() {
    micBtn.title = recording ? "Stop" : "Record";
    micBtn.setAttribute("aria-label", recording ? "Stop" : "Record");
    micBtn.classList.toggle("on", recording);
    micBtn.disabled = busy;
  }

  function buildItem(it) {
    const row = document.createElement("div");
    row.className = "recitem";

    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = it.signedUrl || (recordingsApi.streamUrl(it.key) + "?k=" + encodeURIComponent(accessKey()));

    const knownMs = it.meta && it.meta.duration ? Number(it.meta.duration) : 0;
    const known = knownMs > 0 ? knownMs / 1000 : 0;
    const totalSeconds = () => (known > 0 ? known : (isFinite(audio.duration) ? audio.duration : 0));

    const fmt = (s) => {
      if (!isFinite(s) || s < 0) s = 0;
      const m = Math.floor(s / 60);
      const r = Math.floor(s % 60);
      return m + ":" + (r < 10 ? "0" + r : r);
    };

    const player = document.createElement("div");
    player.className = "player";
    const play = document.createElement("button");
    play.type = "button";
    play.className = "pbtn";
    play.innerHTML = PLAY_SVG;
    const track = document.createElement("div");
    track.className = "ptrack";
    const fill = document.createElement("div");
    fill.className = "pfill";
    track.appendChild(fill);
    const time = document.createElement("span");
    time.className = "ptime";
    player.appendChild(play);
    player.appendChild(track);
    player.appendChild(time);

    const paint = () => {
      const t = totalSeconds();
      const cur = audio.currentTime || 0;
      fill.style.width = (t > 0 ? Math.min(1, cur / t) * 100 : 0) + "%";
      time.textContent = fmt(cur) + " / " + fmt(t);
    };
    audio.addEventListener("loadedmetadata", paint);
    audio.addEventListener("timeupdate", paint);
    audio.addEventListener("ended", () => { play.innerHTML = PLAY_SVG; });
    const linkExpired = () => {
      try {
        const exp = Number(new URL(audio.src).searchParams.get("exp"));
        return !exp || Date.now() > exp - 5000;
      } catch (e) { return false; }
    };
    const refreshLink = async () => {
      try { audio.src = await recordingsApi.sign(it.key); } catch (e) {}
    };
    play.onclick = async () => {
      if (audio.paused) {
        play.innerHTML = PAUSE_SVG;
        if (linkExpired()) await refreshLink();
        audio.play().catch(() => {});
      } else {
        audio.pause();
        play.innerHTML = PLAY_SVG;
      }
    };
    let retried = false;
    audio.addEventListener("error", async () => {
      if (retried) return;
      retried = true;
      await refreshLink();
      audio.play().catch(() => {});
    });
    track.onclick = (e) => {
      const t = totalSeconds();
      if (t <= 0) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      audio.currentTime = ratio * t;
      paint();
    };
    paint();

    const del = document.createElement("button");
    del.type = "button";
    del.className = "recdel";
    del.textContent = "\u2715";
    del.title = "Delete recording";
    del.onclick = async () => {
      if (!window.confirm("Delete this recording?")) return;
      del.disabled = true;
      try { await recordingsApi.remove(it.key, accessKey()); await refresh(); }
      catch (e) {
        del.disabled = false;
        if (String(e.message).includes("401")) { localStorage.removeItem("access_key"); status.textContent = "wrong access code"; }
      }
    };
    row.appendChild(audio);
    row.appendChild(player);
    row.appendChild(del);
    return row;
  }

  async function refresh() {
    listEl.innerHTML = "";
    if (!docId) return;
    let items = [];
    try { items = await recordingsApi.list(docId); }
    catch (e) { status.textContent = "storage offline"; return; }
    const mine = items.filter((it) => it.meta && it.meta.questionId === questionId && it.meta.owner === ownerId());
    curRecordingCount = mine.length;
    mine
      .sort((a, b) => recordedAt(b) - recordedAt(a))
      .forEach((it) => listEl.appendChild(buildItem(it)));
  }

  micBtn.onclick = async () => {
    if (busy) return;
    if (!recording) {
      busy = true; paintMic(); status.textContent = "";
      try {
        await recorder.start();
        recording = true; busy = false; paintMic();
        status.textContent = "recording";
      } catch (e) {
        busy = false; recording = false; paintMic();
        status.textContent = "microphone blocked";
      }
      return;
    }
    busy = true; paintMic(); status.textContent = "saving";
    try {
      const { blob, durationMs } = await recorder.stop();
      recording = false;
      await recordingsApi.upload(docId, questionId, questionText, annotatorName(), accessKey(), blob, durationMs);
      status.textContent = "";
      await refresh();
      if (showErrors) renderForm();
    } catch (e) {
      if (String(e.message).includes("401")) { localStorage.removeItem("access_key"); status.textContent = "wrong access code"; }
      else status.textContent = "upload failed";
    } finally {
      busy = false; paintMic();
    }
  };

  function setTarget(nextDoc, nextQuestion, nextQuestionText) {
    docId = nextDoc;
    questionId = nextQuestion == null ? "" : String(nextQuestion);
    questionText = nextQuestionText || "";
    paintMic();
    const target = nextDoc + "|" + nextQuestion;
    if (target !== lastTarget && !recording) {
      lastTarget = target;
      refresh();
    }
  }

  return { element, setTarget };
}

let recorderPanel = null;
function getRecorderPanel() {
  if (!recorderPanel) recorderPanel = createRecorderPanel();
  return recorderPanel;
}
