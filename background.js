// ─── SnippetRunner background service worker ──────────────────────────────────
importScripts("shared.js");

const SNIPPET_EXECUTION_TIMEOUT_MS = 300000; // 5 minutes

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "EXECUTE_SNIPPET") {
        handleExecution(msg.payload)
            .then(sendResponse)
            .catch((err) => sendResponse({ error: err.message }));
        return true;
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
    let resultId = null;
    let ranAt = null;

    try {
        // Generate ID upfront so the results page URL is stable from the start
        resultId = uid();
        ranAt = Date.now();

        // Write a pending placeholder immediately so the results page can open
        await savePendingResult({
            id: resultId,
            snippetId,
            snippetName,
            code,
            pageUrl,
            pageTitle,
            ranAt,
        });

        // Open the results page right away — it will show a loader until execution finishes
        const resultsUrl =
            chrome.runtime.getURL("results/results.html") + "?id=" + resultId;
        chrome.tabs.create({ url: resultsUrl });

        // Run the snippet.
        //
        // IMPORTANT:
        // - The injected function is async, so executeScript waits for the snippet.
        // - The user's code is compiled directly as the body of an AsyncFunction,
        //   so top-level await works.
        // - console output is captured but NEVER forwarded to the page console.
        // - sourceURL makes runtime errors point back to the user's snippet.
        const executionPromise = chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: async (codeToRun, sName) => {
                const captured = [];

                const originalConsole = {
                    log: console.log,
                    warn: console.warn,
                    error: console.error,
                    groupCollapsed: console.groupCollapsed,
                    groupEnd: console.groupEnd,
                };

                function safeString(value) {
                    try {
                        if (value === null) return "null";
                        if (value === undefined) return "undefined";

                        if (typeof value === "string") return value;

                        if (value instanceof Error) {
                            return value.message || String(value);
                        }

                        if (typeof value === "object") {
                            try {
                                return JSON.stringify(value, null, 2);
                            } catch (_) {
                                return String(value);
                            }
                        }

                        return String(value);
                    } catch (_) {
                        return "[unserializable]";
                    }
                }

                function getErrorInfo(error) {
                    let message;

                    try {
                        message =
                            error?.message ||
                            error?.details ||
                            error?.description ||
                            String(error);
                    } catch (_) {
                        message = "Unknown error";
                    }

                    let name;

                    try {
                        name =
                            error?.name ||
                            error?.type ||
                            error?.typeName ||
                            "Error";
                    } catch (_) {
                        name = "Error";
                    }

                    let stack;

                    try {
                        stack = error?.stack || "";
                    } catch (_) {
                        stack = "";
                    }

                    return {
                        name: String(name),
                        message: String(message),
                        stack: String(stack),
                    };
                }

                function parseRuntimeError(error) {
                    const info = getErrorInfo(error);
                    const stack = info.stack;

                    /*
                     * AsyncFunction adds 3 lines before the user's code.
                     *
                     * Generated:
                     *
                     * async function anonymous(
                     * ) {
                     *     <USER CODE>
                     * }
                     */

                    const match = stack.match(
                        /SnippetRunner\/(.+?\.js):(\d+):(\d+)/,
                    );

                    if (!match) {
                        return {
                            ...info,
                            line: null,
                            column: null,
                            file: null,
                        };
                    }

                    let file = match[1];

                    try {
                        file = decodeURIComponent(file);
                    } catch (_) {}

                    const generatedLine = Number(match[2]);
                    const column = Number(match[3]);

                    const ASYNC_FUNCTION_LINE_OFFSET = 2;

                    const line = Math.max(
                        1,
                        generatedLine - ASYNC_FUNCTION_LINE_OFFSET,
                    );

                    return {
                        ...info,
                        file,
                        line,
                        column,
                        generatedLine,
                    };
                }

                function serializeValue(value) {
                    try {
                        if (value === null) return "null";
                        if (value === undefined) return "undefined";

                        return typeof value === "object"
                            ? JSON.stringify(value, null, 2)
                            : String(value);
                    } catch (_) {
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

                    return {
                        title: null,
                        body: serializeValue(args[0]),
                    };
                }

                /*
                 * Capture console without forwarding to the page console.
                 */
                console.log = (...args) => {
                    captured.push({
                        level: "log",
                        ...serialize(args),
                    });
                };

                console.warn = (...args) => {
                    captured.push({
                        level: "warn",
                        ...serialize(args),
                    });
                };

                console.error = (...args) => {
                    captured.push({
                        level: "error",
                        ...serialize(args),
                    });
                };

                try {
                    const AsyncFunction = Object.getPrototypeOf(
                        async function () {},
                    ).constructor;

                    /*
                     * IMPORTANT:
                     * No leading newline before codeToRun.
                     *
                     * This keeps source line numbers predictable.
                     */
                    const source =
                        codeToRun +
                        "\n//# sourceURL=SnippetRunner/" +
                        encodeURIComponent(sName || "snippet") +
                        ".js";

                    const runner = new AsyncFunction(source);

                    /*
                     * This catches:
                     *
                     *   throw new Error(...)
                     *   throw "Custom Error"
                     *   TypeError
                     *   NetSuite errors
                     *   rejected Promises
                     *   await failures
                     */
                    await runner();
                } catch (error) {
                    const runtimeError = parseRuntimeError(error);

                    captured.push({
                        level: "error",

                        // Example:
                        // TypeError: values.map is not a function
                        title: `${runtimeError.name}: ${runtimeError.message}`,

                        body: "",

                        line: runtimeError.line,
                        column: runtimeError.column,
                        file: runtimeError.file,
                        stack: runtimeError.stack,
                    });
                } finally {
                    console.log = originalConsole.log;
                    console.warn = originalConsole.warn;
                    console.error = originalConsole.error;
                    console.groupCollapsed = originalConsole.groupCollapsed;
                    console.groupEnd = originalConsole.groupEnd;
                }

                return JSON.stringify(captured);
            },
            args: [code, snippetName],
        });

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(
                    new Error(
                        `Snippet execution timed out after ${SNIPPET_EXECUTION_TIMEOUT_MS / 1000} seconds.`,
                    ),
                );
            }, SNIPPET_EXECUTION_TIMEOUT_MS);
        });

        let executionResult;

        try {
            executionResult = await Promise.race([
                executionPromise,
                timeoutPromise,
            ]);
        } catch (err) {
            // The browser cannot forcibly cancel an already-running
            // executeScript invocation. We stop waiting here and record a
            // useful result for the user instead of leaving the results page
            // stuck on "Executing…".
            const finishedAt = Date.now();

            const timeoutResult = {
                id: resultId,
                snippetId,
                snippetName,
                code,
                logs: [
                    {
                        level: "error",
                        title: "Execution timed out",
                        body: err?.message || "The snippet did not finish.",
                        line: null,
                        column: null,
                        file: null,
                        stack: null,
                    },
                ],
                ranAt,
                duration: finishedAt - ranAt,
                pageUrl,
                pageTitle,
            };

            await saveToHistory(timeoutResult);
            await saveResult(timeoutResult);
            await clearPendingResultSafe(resultId);

            return { ok: false, resultId };
        }

        const [{ result: logs }] = executionResult;

        let parsedLogs = [];
        try {
            parsedLogs = JSON.parse(logs || "[]");
        } catch (parseError) {
            parsedLogs = [
                {
                    level: "error",
                    title: "Runner error",
                    body: "The snippet completed, but its output could not be read.",
                    line: null,
                    column: null,
                    file: null,
                    stack: parseError?.stack || null,
                },
            ];
        }

        const finishedAt = Date.now();
        const resultData = {
            id: resultId,
            snippetId,
            snippetName,
            code,
            logs: parsedLogs,
            ranAt,
            duration: finishedAt - ranAt,
            pageUrl,
            pageTitle,
        };

        // Save to history and overwrite the pending placeholder with the real result
        await saveToHistory(resultData);
        await saveResult(resultData);
        await clearPendingResultSafe(resultId);

        return { ok: true, resultId };
    } catch (err) {
        // IMPORTANT:
        // If executeScript itself fails (tab closed, navigation, permission
        // error, etc.), still write a result. Otherwise the results page would
        // remain on "Executing…" forever.
        const message = err?.message || String(err);

        if (resultId && ranAt != null) {
            try {
                const finishedAt = Date.now();

                const resultData = {
                    id: resultId,
                    snippetId,
                    snippetName,
                    code,
                    logs: [
                        {
                            level: "error",
                            title: "Execution error",
                            body: message,
                            line: null,
                            column: null,
                            file: null,
                            stack: err?.stack || null,
                        },
                    ],
                    ranAt,
                    duration: finishedAt - ranAt,
                    pageUrl,
                    pageTitle,
                };

                await saveToHistory(resultData);
                await saveResult(resultData);
                await clearPendingResultSafe(resultId);

                return { ok: false, resultId };
            } catch (_) {
                // Fall through to the normal error response.
            }
        }

        return { error: message };
    }
}

// Some versions of shared.js may not expose clearPendingResultSafe.
// Keep the cleanup defensive so a cleanup failure never hides the result.
async function clearPendingResultSafe(id) {
    if (!id) return;

    try {
        if (typeof clearPendingResult === "function") {
            await clearPendingResult(id);
        }
    } catch (_) {
        // Result has already been persisted; cleanup is best-effort.
    }
}
