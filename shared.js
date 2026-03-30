// ─── Shared storage helpers ────────────────────────────────────────────────────

function loadSnippets() {
    return new Promise((resolve) => {
        chrome.storage.local.get("snippets", (data) =>
            resolve(data.snippets || []),
        );
    });
}

function saveSnippets(snippets) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ snippets }, resolve);
    });
}

function saveResult(result) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ lastResult: result }, resolve);
    });
}

function loadResult() {
    return new Promise((resolve) => {
        chrome.storage.local.get("lastResult", (data) =>
            resolve(data.lastResult || null),
        );
    });
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
