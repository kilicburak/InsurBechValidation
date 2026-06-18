function annotatorName() {
  return localStorage.getItem("annotator") || "anonymous";
}

function ownerId() {
  let id = localStorage.getItem("owner_id");
  if (!id) {
    id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    localStorage.setItem("owner_id", id);
  }
  return id;
}

function accessKey() {
  return localStorage.getItem("access_key") || "";
}

const authApi = {
  async status(accessCode) {
    try {
      const res = await fetch(WORKER_URL + "/auth", { headers: { "x-access-key": accessCode || "" } });
      return res.status;
    } catch (e) {
      return 0;
    }
  },
};

async function ensureAccess() {
  const stored = localStorage.getItem("access_key") || "";
  if (await authApi.status(stored) === 200) return;
  await promptForAccess();
}

function promptForAccess() {
  return new Promise((resolve) => {
    const gate = document.createElement("div");
    gate.className = "acgate";
    const card = document.createElement("div");
    card.className = "acgate-card";
    const h = document.createElement("h2");
    h.textContent = "Access code";
    const p = document.createElement("p");
    p.textContent = "Enter the shared code to use the annotation tool.";
    const input = document.createElement("input");
    input.type = "password";
    input.placeholder = "Access code";
    const btn = document.createElement("button");
    btn.textContent = "Continue";
    const err = document.createElement("div");
    err.className = "acgate-err";
    card.appendChild(h); card.appendChild(p); card.appendChild(input); card.appendChild(btn); card.appendChild(err);
    gate.appendChild(card);
    document.body.appendChild(gate);
    setTimeout(() => input.focus(), 0);

    const submit = async () => {
      const code = input.value.trim();
      btn.disabled = true; err.textContent = "";
      const status = await authApi.status(code);
      if (status === 200) {
        localStorage.setItem("access_key", code);
        gate.remove();
        resolve();
      } else if (status === 401) {
        err.textContent = "Incorrect code";
        btn.disabled = false;
        input.select();
      } else {
        err.textContent = "Cannot reach server";
        btn.disabled = false;
      }
    };
    btn.onclick = submit;
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  });
}
