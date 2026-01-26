import { VOTE_API_URL, RESULTS_API_URL } from "./config.js";

const $ = (id) => document.getElementById(id);

function getOrCreateDeviceId() {
  const key = "voteSystemDeviceId";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID(); 
    localStorage.setItem(key, id);
  }
  return id;
}

function show(obj) {
  $("out").textContent = JSON.stringify(obj, null, 2);
}

async function postVote() {
  const pollId = $("pollId").value.trim();
  const optionId = $("optionId").value.trim();
  if (!pollId || !optionId) {
    return show({ error: "pollId ו-optionId הם חובה" });
  }

  const voterKey = getOrCreateDeviceId(); 
  const payload = { pollId, optionId, voterKey };

  const res = await fetch(VOTE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  show({ status: res.status, ...data, sent: payload });
}

async function getResults() {
  const pollId = $("pollId").value.trim();
  if (!pollId) return show({ error: "pollId חובה" });

  const url = `${RESULTS_API_URL}?pollId=${encodeURIComponent(pollId)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  show({ status: res.status, ...data });
}

$("voteBtn").addEventListener("click", postVote);
$("resultsBtn").addEventListener("click", getResults);

// shows the user identifier
$("voterKey").value = getOrCreateDeviceId();
