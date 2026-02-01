// app.js
import {
  VOTE_API_URL,
  RESULTS_API_URL,
  ADMIN_NEW_POLL_URL,
} from "./config.js";

// ---------- DOM refs ----------
const pollIdInput = document.getElementById("pollId");
const currentPollEl = document.getElementById("currentPollId");

const idNumberInput = document.getElementById("idNumber");

const adminKeyInput = document.getElementById("adminKey");
const newPollBtn = document.getElementById("newPollBtn");

const voteABtn = document.getElementById("voteA");
const voteBBtn = document.getElementById("voteB");

const barAEl = document.getElementById("barA");
const barBEl = document.getElementById("barB");
const countAEl = document.getElementById("countA");
const countBEl = document.getElementById("countB");
const totalVotesEl = document.getElementById("totalVotes");

const toastWrap = document.getElementById("toastWrap");
const outEl = document.getElementById("out"); // optional <pre id="out"></pre>

// ---------- state ----------
let lastTotalVotes = null; // used to detect new voters

// ---------- small helpers ----------
function showOutput(obj) {
  if (!outEl) return;
  outEl.textContent = JSON.stringify(obj, null, 2);
}

function getAdminKey() {
  return adminKeyInput?.value?.trim() || "";
}

function getTypedPollId() {
  const typed = pollIdInput?.value?.trim() || "";
  return typed.length ? typed : null;
}

function setCurrentPollId(pollId) {
  if (currentPollEl) currentPollEl.textContent = pollId || "(unknown)";
  if (pollIdInput) pollIdInput.value = pollId || "";
  lastTotalVotes = null; // reset "new vote" detector when poll changes
}

function getEffectivePollIdOrExplain() {
  const typed = getTypedPollId();
  if (typed) return typed;

  const current = currentPollEl?.textContent?.trim();
  if (current && current !== "(unknown)") return current;

  toastWarn("No poll", "Type a pollId or click 'New Poll'.");
  return null;
}

// ---------- Toast UI ----------
function showToast(type, title, message, timeoutMs = 3000) {
  if (!toastWrap) {
    alert(`${title}\n\n${message}`);
    return;
  }

  const icons = { success: "✅", error: "⛔", warn: "⚠️", info: "ℹ️" };
  const el = document.createElement("div");
  el.className = `toast ${type || "info"}`;
  el.innerHTML = `
    <div class="icon">${icons[type] || icons.info}</div>
    <div>
      <div class="title">${title}</div>
      <div class="msg">${message}</div>
    </div>
    <button class="close" aria-label="Close">×</button>
  `;

  el.querySelector(".close")?.addEventListener("click", () => el.remove());
  toastWrap.appendChild(el);

  if (timeoutMs > 0) setTimeout(() => el.remove(), timeoutMs);
}

const toastSuccess = (t, m, ms = 1800) => showToast("success", t, m, ms);
const toastError = (t, m, ms = 4500) => showToast("error", t, m, ms);
const toastWarn = (t, m, ms = 3500) => showToast("warn", t, m, ms);

// ---------- Israeli ID validation (checksum) ----------
function isValidIsraeliID(raw) {
  const id = String(raw || "").trim();
  if (!/^\d{5,9}$/.test(id)) return false;

  const padded = id.padStart(9, "0");
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    let num = Number(padded[i]) * ((i % 2) + 1);
    if (num > 9) num = Math.floor(num / 10) + (num % 10);
    sum += num;
  }

  return sum % 10 === 0;
}

// ---------- Rendering ----------
function renderCounts(a, b) {
  const countA = Number(a) || 0;
  const countB = Number(b) || 0;
  const total = countA + countB;

  // Always show real numbers
  if (countAEl) countAEl.textContent = `${countA} votes`;
  if (countBEl) countBEl.textContent = `${countB} votes`;
  if (totalVotesEl) totalVotesEl.textContent = `Total: ${total}`;

  // Set bar widths by total (nice UX)
  const pctA = total === 0 ? 0 : Math.round((countA / total) * 100);
  const pctB = total === 0 ? 0 : Math.round((countB / total) * 100);

  if (barAEl) barAEl.style.width = `${pctA}%`;
  if (barBEl) barBEl.style.width = `${pctB}%`;
}

function extractCountsFromResults(data) {
  // Expected shape: { pollId, results: [{ optionId:"optionA", count:n }, ...] }
  const arr = Array.isArray(data?.results) ? data.results : [];
  const a = arr.find((x) => x?.optionId === "optionA")?.count ?? 0;
  const b = arr.find((x) => x?.optionId === "optionB")?.count ?? 0;
  return { a, b };
}

async function safeReadJson(res) {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

// ---------- API: Results ----------
async function showResults({ silent = true } = {}) {
  const pollId = getEffectivePollIdOrExplain();
  if (!pollId) return;

  try {
    const url = new URL(RESULTS_API_URL);
    url.searchParams.set("pollId", pollId);

    const res = await fetch(url.toString(), { method: "GET" });
    const data = await safeReadJson(res);

    showOutput({ action: "showResults", pollId, status: res.status, data });

    if (!res.ok) {
      toastError("Results error", data?.error || data?.message || `HTTP ${res.status}`);
      return;
    }

    const { a, b } = extractCountsFromResults(data);
    renderCounts(a, b);

    // Show toast only when total votes changes
    const total = Number(a) + Number(b);
    if (lastTotalVotes === null) {
      lastTotalVotes = total; // init
    } else if (total !== lastTotalVotes) {
      toastSuccess("New vote!", "A new voter was added 🎉");
      lastTotalVotes = total;
    }

    // Optional: if user manually typed pollId, we can set CURRENT
    if (currentPollEl && currentPollEl.textContent.trim() === "(unknown)") {
      setCurrentPollId(pollId);
    }

    if (!silent) toastSuccess("Results", "Updated");
  } catch (e) {
    toastError("Results error", String(e));
  }
}

// ---------- API: Vote ----------
async function vote(optionId) {
  const pollId = getEffectivePollIdOrExplain();
  if (!pollId) return;

  const idNumber = idNumberInput?.value?.trim() || "";
  if (!isValidIsraeliID(idNumber)) {
    toastError("Invalid ID", "Enter a valid Israeli ID (5-9 digits + checksum).");
    return;
  }

  try {
    const res = await fetch(VOTE_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pollId, optionId, idNumber }),
    });

    const data = await safeReadJson(res);
    showOutput({ action: "vote", pollId, optionId, status: res.status, data });

    const msg = String(data?.message || data?.error || "").toLowerCase();
    const isDuplicate = msg.includes("already voted") || data?.alreadyVoted === true;

    if (isDuplicate) {
      toastWarn("Already voted", "You already voted in this poll 🙂");
      await showResults({ silent: true });
      return;
    }

    if (!res.ok) {
      toastError("Vote failed", data?.error || data?.message || `HTTP ${res.status}`);
      return;
    }

    toastSuccess("Vote received", "Thanks! Your vote was counted.");
    await showResults({ silent: true });
  } catch (e) {
    toastError("Network error", String(e));
  }
}

// ---------- API: Admin New Poll ----------
async function adminNewPoll() {
  const adminKey = getAdminKey();
  if (!adminKey) {
    toastError("Admin", "Missing admin key");
    return;
  }

  const typedPollId = getTypedPollId();
  const payload = typedPollId ? { pollId: typedPollId } : {};

  try {
    const res = await fetch(ADMIN_NEW_POLL_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await safeReadJson(res);
    showOutput({ action: "adminNewPoll", status: res.status, payload, data });

    if (!res.ok) {
      toastError("New Poll failed", data?.error || data?.message || `HTTP ${res.status}`);
      return;
    }

    if (data?.pollId) setCurrentPollId(data.pollId);

    toastSuccess("New Poll", "Created successfully");
    renderCounts(0, 0);              // force bars to 0% immediately
    await showResults({ silent: true });
  } catch (e) {
    toastError("New Poll error", String(e));
  }
}

// ---------- Admin panel toggle (from HTML button) ----------
window.toggleAdmin = function () {
  const panel = document.getElementById("adminPanel");
  panel?.classList.toggle("hidden");
};

// ---------- wiring ----------
newPollBtn?.addEventListener("click", adminNewPoll);

voteABtn?.addEventListener("click", () => vote("optionA"));
voteBBtn?.addEventListener("click", () => vote("optionB"));

// When user types a pollId and presses Enter -> refresh results
pollIdInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    // user-set pollId becomes "current" for this session
    const typed = getTypedPollId();
    if (typed) setCurrentPollId(typed);
    showResults({ silent: false });
  }
});

// ---------- init ----------
renderCounts(0, 0);        // IMPORTANT: prevents default CSS width=100%
setCurrentPollId("");      // shows (unknown)
toastSuccess("Ready", "Type pollId or create a new poll", 1500);

// Auto-refresh every 2 seconds (silent, no spam)
setInterval(() => {
  const current = currentPollEl?.textContent?.trim();
  if (current && current !== "(unknown)") showResults({ silent: true });
}, 2000);
