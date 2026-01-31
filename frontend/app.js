import { VOTE_API_URL, RESULTS_API_URL } from "./config.js";

// Display output on screen
function showOutput(data) {
  document.getElementById("out").textContent = JSON.stringify(data, null, 2);
}

// Read ID number from input
function getIdNumber() {
  const el = document.getElementById("idNumber");
  return (el?.value || "").trim();
}

// Send vote to backend
export async function vote(optionId) {
  const pollId = "poll1";
  const idNumber = getIdNumber();

  if (!idNumber) {
    showOutput({ message: "Please enter Israeli ID first." });
    return;
  }

  try {
    const res = await fetch(VOTE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Send raw ID to server ONLY for validation + hashing
      body: JSON.stringify({ pollId, optionId, idNumber }),
    });

    const data = await res.json();
    showOutput(data);
  } catch (err) {
    showOutput({ error: err.message });
  }
}

// Load results from backend
export async function loadResults() {
  const pollId = "poll1";

  try {
    const res = await fetch(`${RESULTS_API_URL}?pollId=${pollId}`);
    const data = await res.json();
    showOutput(data);
  } catch (err) {
    showOutput({ error: err.message });
  }
}

// Expose functions for HTML buttons
window.vote = vote;
window.loadResults = loadResults;
