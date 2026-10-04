// ─── Shared storage helpers ────────────────────────────────────────────────────

const HISTORY_MAX = 50;

function loadSnippets() {
  return new Promise(resolve => {
    chrome.storage.local.get('snippets', data => resolve(data.snippets || []));
  });
}

function saveSnippets(snippets) {
  return new Promise(resolve => {
    chrome.storage.local.set({ snippets }, resolve);
  });
}

// ─── Execution history ─────────────────────────────────────────────────────────

function loadHistory() {
  return new Promise(resolve => {
    chrome.storage.local.get('executionHistory', data => resolve(data.executionHistory || []));
  });
}

function clearHistory() {
  return new Promise(resolve => {
    chrome.storage.local.set({ executionHistory: null, lastResult: null }, resolve);
  });
}

async function saveToHistory(result) {
  const history = await loadHistory();
  // Replace existing entry with same id (pending → real), or prepend
  const filtered = history.filter(r => r.id !== result.id);
  const updated  = [result, ...filtered].slice(0, HISTORY_MAX);
  return new Promise(resolve => {
    chrome.storage.local.set({ executionHistory: updated }, resolve);
  });
}

function loadResultById(id) {
  return new Promise(async resolve => {
    const history = await loadHistory();
    resolve(history.find(r => r.id === id) || null);
  });
}

// ─── Pending placeholder ───────────────────────────────────────────────────────
// Written before execution starts so the results page can open immediately.
// The background overwrites it with the real result when done.

function savePendingResult(meta) {
  // Store as a lightweight pending entry — NOT in history yet
  return new Promise(resolve => {
    chrome.storage.local.set({ [`pending_${meta.id}`]: meta }, resolve);
  });
}

function loadPendingResult(id) {
  return new Promise(resolve => {
    chrome.storage.local.get(`pending_${id}`, data => resolve(data[`pending_${id}`] || null));
  });
}

function clearPendingResult(id) {
  return new Promise(resolve => {
    chrome.storage.local.remove(`pending_${id}`, resolve);
  });
}

// ─── Last result shim ──────────────────────────────────────────────────────────

function saveResult(result) {
  return new Promise(resolve => {
    chrome.storage.local.set({ lastResult: result }, resolve);
  });
}

function loadResult() {
  return new Promise(resolve => {
    chrome.storage.local.get('lastResult', data => resolve(data.lastResult || null));
  });
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}