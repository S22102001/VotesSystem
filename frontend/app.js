import { VOTE_API_BASE, RESULTS_API_BASE } from "./config.js";

const $ = (id) => document.getElementById(id);

$("voteBtn").addEventListener("click", async () => {
  const pollId = $("pollId").value.trim();
  const voterKey = $("voterKey").value.trim();
  const optionId = $("optionId").value.trim();

  const body = { pollId, optionId };
  if (voterKey) body.voterKey = voterKey;

  const res = await fetch(`${VOTE_API_BASE}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  $("out").textContent = JSON.stringify(data, null, 2);
});

$("resultsBtn").addEventListener("click", async () => {
  const pollId = $("pollId").value.trim();
  const res = await fetch(`${RESULTS_API_BASE}/results?pollId=${encodeURIComponent(pollId)}`);
  const data = await res.json();
  $("out").textContent = JSON.stringify(data, null, 2);
});
