document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('btn-close').addEventListener('click', () => window.close());

  const main = document.getElementById('results-main');
  main.innerHTML = `<div class="loading-results">Loading results<span class="loading-dots"></span></div>`;

  // Poll up to 3s — popup writes storage then delays close by 300ms,
  // so results should appear within the first few polls.
  const result = await waitForResult(3000);

  if (!result) {
    main.innerHTML = `
      <div class="no-result">
        <div class="no-result-icon">🤷</div>
        <p>No execution result found.</p>
        <p class="muted">Run a snippet from the extension popup.</p>
      </div>`;
    return;
  }

  render(main, result);
});

async function waitForResult(timeoutMs) {
  const interval = 100;
  const attempts = timeoutMs / interval;
  for (let i = 0; i < attempts; i++) {
    const result = await loadResult();
    if (result) return result;
    await new Promise(r => setTimeout(r, interval));
  }
  return null;
}

function render(main, result) {
  const hasError = result.logs.some(l => l.level === 'error');
  const statusClass = hasError ? 'error' : 'success';
  const statusIcon  = hasError ? '✕' : '✓';

  document.title = `SnippetRunner — ${result.snippetName}`;

  const ranAt = new Date(result.ranAt);

  // Build log rows HTML
  let logsHtml;
  if (!result.logs || result.logs.length === 0) {
    logsHtml = `<div class="log-empty">No console output — snippet ran silently.</div>`;
  } else {
    logsHtml = result.logs.map((entry, i) => `
      <div class="log-row log-${escapeHtml(entry.level)}">
        <span class="log-index">${i + 1}</span>
        <span class="log-level">${escapeHtml(entry.level)}</span>
        <pre class="log-text">${escapeHtml(entry.text)}</pre>
      </div>
    `).join('');
  }

  const logCountHtml = result.logs && result.logs.length > 0
    ? `<span class="log-count">${result.logs.length} line${result.logs.length > 1 ? 's' : ''}</span>`
    : '';

  main.innerHTML = `
    <div class="result-hero">
      <div class="result-status-icon ${statusClass}">${statusIcon}</div>
      <div>
        <h1 class="result-snippet-name">${escapeHtml(result.snippetName)}</h1>
        <div class="result-meta">
          Ran on
          <a href="${escapeHtml(result.pageUrl)}" target="_blank" class="page-link"
            title="${escapeHtml(result.pageUrl)}">${escapeHtml(result.pageTitle || result.pageUrl)}</a>
          &nbsp;·&nbsp; ${ranAt.toLocaleTimeString()}
        </div>
      </div>
    </div>

    <section class="result-section">
      <div class="section-label">
        <span>Code</span>
        <button id="btn-copy-code" class="btn-ghost btn-xs">Copy</button>
      </div>
      <pre class="code-block">${escapeHtml(result.code)}</pre>
    </section>

    <section class="result-section">
      <div class="section-label">
        <span>Output</span>
        ${logCountHtml}
      </div>
      <div class="logs-block">${logsHtml}</div>
    </section>
  `;

  document.getElementById('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard.writeText(result.code).then(() => {
      const btn = document.getElementById('btn-copy-code');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 1500);
    });
  });
}