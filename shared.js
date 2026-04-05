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

async function saveToHistory(result) {
  const history = await loadHistory();
  // Prepend newest first, cap at HISTORY_MAX
  const updated = [result, ...history].slice(0, HISTORY_MAX);
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

// Keep backward-compat shims so old results.js polling still works during transition
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