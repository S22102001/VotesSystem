// app.js
import {
  VOTE_API_URL,
  RESULTS_API_URL,
  ADMIN_NEW_POLL_URL,
  ADMIN_RESET_POLL_URL,
} from "./config.js";

// ---------- DOM ----------
const outEl = document.getElementById("out");
const pollIdInput = document.getElementById("pollId");
const currentPollEl = document.getElementById("currentPollId");

const idNumberInput = document.getElementById("idNumber");

const adminKeyInput = document.getElementById("adminKey");
const newPollBtn = document.getElementById("newPollBtn");
const resetPollBtn = document.getElementById("resetPollBtn");

const showResultsBtn = document.getElementById("showResultsBtn");
const voteABtn = document.getElementById("voteA");
const voteBBtn = document.getElementById("voteB");

// ---------- helpers ----------
function showOutput(obj) {
  if (!outEl) return;
  outEl.textContent = JSON.stringify(obj, null, 2);
}

function getAdminKey() {
  return adminKeyInput?.value?.trim() || "";
}

/**
 * If user typed a pollId -> use it.
 * Else -> use CURRENT (by sending nothing), but we still show CURRENT on screen.
 */
function getTypedPollId() {
  const typed = pollIdInput?.value?.trim() || "";
  return typed.length ? typed : null;
}

function setCurrentPollId(pollId) {
  if (currentPollEl) currentPollEl.textContent = pollId || "(unknown)";
  // also fill input for convenience
  if (pollIdInput) pollIdInput.value = pollId || "";
}

/**
 * For actions that REQUIRE a specific pollId in the request (like GET /results),
 * we will:
 * - if user typed -> use it
 * - else -> fallback to currentPollId text (must be known)
 */
function getEffectivePollIdOrExplain() {
  const typed = getTypedPollId();
  if (typed) return typed;

  const current = currentPollEl?.textContent?.trim();
  if (current && current !== "(unknown)") return current;

  showOutput({
    error: "No pollId selected yet",
    hint: "Type a pollId, or click 'New Poll' to create one (and set CURRENT).",
  });
  return null;
}

// ---------- Admin: New Poll ----------
async function adminNewPoll() {
  const adminKey = getAdminKey();
  if (!adminKey) return showOutput({ error: "Missing admin key" });

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

    const data = await res.json().catch(() => ({}));
    showOutput({ action: "adminNewPoll", sent: payload, response: data });

    if (data?.pollId) setCurrentPollId(data.pollId);
  } catch (e) {
    showOutput({ error: "Failed to fetch", details: String(e) });
  }
}


// ---------- Admin: Reset Poll ----------
async function adminResetPoll() {
  const adminKey = getAdminKey();
  if (!adminKey) return showOutput({ error: "Missing admin key" });

  // If user typed a pollId -> reset THAT poll
  // If empty -> let server use CURRENT by sending {} (no pollId)
  const typedPollId = getTypedPollId();
  const payload = typedPollId ? { pollId: typedPollId } : {};

  try {
    const res = await fetch(ADMIN_RESET_POLL_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    showOutput({
      action: "adminResetPoll",
      sent: payload,
      response: data,
    });
  } catch (e) {
    showOutput({ error: "Failed to fetch", details: String(e) });
  }
}

// ---------- Results ----------
async function showResults() {
  const pollId = getEffectivePollIdOrExplain();
  if (!pollId) return;

  try {
    const url = new URL(RESULTS_API_URL);
    url.searchParams.set("pollId", pollId);

    const res = await fetch(url.toString(), { method: "GET" });
    const data = await res.json().catch(() => ({}));

    showOutput({
      action: "results",
      pollId,
      response: data,
    });
  } catch (e) {
    showOutput({ error: "Failed to fetch", details: String(e) });
  }
}

// ---------- Vote ----------
async function vote(optionId) {
  const pollId = getEffectivePollIdOrExplain();
  if (!pollId) return;

  const idNumber = idNumberInput?.value?.trim() || "";
  if (!idNumber) {
    return showOutput({ error: "Missing Israeli ID" });
  }

  try {
    const res = await fetch(VOTE_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pollId,
        optionId,
        idNumber,
      }),
    });

    const data = await res.json().catch(() => ({}));
    showOutput({
      action: "vote",
      pollId,
      optionId,
      response: data,
    });
  } catch (e) {
    showOutput({ error: "Failed to fetch", details: String(e) });
  }
}

// ---------- wiring ----------
newPollBtn?.addEventListener("click", adminNewPoll);
resetPollBtn?.addEventListener("click", adminResetPoll);
showResultsBtn?.addEventListener("click", showResults);

voteABtn?.addEventListener("click", () => vote("optionA"));
voteBBtn?.addEventListener("click", () => vote("optionB"));

// Optional: when page loads, show currentPollId as unknown
setCurrentPollId("");
