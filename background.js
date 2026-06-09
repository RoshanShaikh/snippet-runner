// ─── SnippetRunner background service worker ──────────────────────────────────
// importScripts makes shared helpers (saveToHistory, saveResult, uid) available
importScripts("shared.js");

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "EXECUTE_SNIPPET") {
        handleExecution(msg.payload)
            .then(sendResponse)
            .catch((err) => {
                sendResponse({ error: err.message });
            });
        return true; // keep message channel open for async response
    }
});

async function handleExecution({
    code,
    snippetName,
    snippetId,
    tabId,
    pageUrl,
    pageTitle,
}) {
    try {
        const [{ result: logs }] = await chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: (codeToRun, sName) => {
                const captured = [];
                const _log = window.console.log.bind(console);
                const _warn = window.console.warn.bind(console);
                const _error = window.console.error.bind(console);

                function serializeValue(a) {
                    try {
                        if (a === null) return "null";
                        if (a === undefined) return "undefined";
                        return typeof a === "object"
                            ? JSON.stringify(a, null, 2)
                            : String(a);
                    } catch (_e) {
                        return "[unserializable]";
                    }
                }

                function serialize(args) {
                    if (args.length > 1) {
                        return {
                            title: serializeValue(args[0]),
                            body: args.slice(1).map(serializeValue).join(" "),
                        };
                    }
                    return { title: null, body: serializeValue(args[0]) };
                }

                window.console.log = (...a) => {
                    captured.push({ level: "log", ...serialize(a) });
                    _log(...a);
                };
                window.console.warn = (...a) => {
                    captured.push({ level: "warn", ...serialize(a) });
                    _warn(...a);
                };
                window.console.error = (...a) => {
                    captured.push({ level: "error", ...serialize(a) });
                    _error(...a);
                };

                window.console.groupCollapsed(
                    "%c[SnippetRunner]%c " + sName + " %c(expand for code)",
                    "color:#1a7a1a;font-weight:bold",
                    "color:inherit;font-weight:bold",
                    "color:#888;font-weight:normal;font-style:italic",
                );
                _log(
                    "%cCode:",
                    "color:#0055cc;font-weight:bold",
                    "\n" + codeToRun,
                );
                window.console.groupEnd();

                const script = document.createElement("script");
                script.textContent = `(function(){try{${codeToRun}}catch(e){console.error('[SnippetRunner] Runtime error: '+e.message);}})();`;
                (document.head || document.documentElement).appendChild(script);
                script.remove();

                window.console.log = _log;
                window.console.warn = _warn;
                window.console.error = _error;

                return JSON.stringify(captured);
            },
            args: [code, snippetName],
        });

        let parsedLogs = [];
        try {
            parsedLogs = JSON.parse(logs || "[]");
        } catch (_) {}

        const resultId = uid();
        const resultData = {
            id: resultId,
            snippetId,
            snippetName,
            code,
            logs: parsedLogs,
            ranAt: Date.now(),
            pageUrl,
            pageTitle,
        };

        await saveToHistory(resultData);
        await saveResult(resultData);

        // Open results page — works whether popup is still open or already closed
        const resultsUrl =
            chrome.runtime.getURL("results/results.html") + "?id=" + resultId;
        chrome.tabs.create({ url: resultsUrl });

        return { ok: true, resultId };
    } catch (err) {
        return { error: err.message };
    }
}
