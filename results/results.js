document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('btn-close').addEventListener('click', () => window.close());

  const main = document.getElementById('results-main');
  main.innerHTML = `<div class="loading-results">Loading results<span class="loading-dots"></span></div>`;

  // Get result ID from URL param, fall back to polling lastResult for compat
  const params = new URLSearchParams(window.location.search);
  const resultId = params.get('id');

  let result = null;
  if (resultId) {
    result = await waitForResultById(resultId, 3000);
  } else {
    result = await waitForResult(3000);
  }

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
  await renderHistorySidebar(result.id);
});

// ─── Wait helpers ──────────────────────────────────────────────────────────────

async function waitForResultById(id, timeoutMs) {
  const interval = 100;
  const attempts = timeoutMs / interval;
  for (let i = 0; i < attempts; i++) {
    const r = await loadResultById(id);
    if (r) return r;
    await new Promise(res => setTimeout(res, interval));
  }
  return null;
}

async function waitForResult(timeoutMs) {
  const interval = 100;
  const attempts = timeoutMs / interval;
  for (let i = 0; i < attempts; i++) {
    const r = await loadResult();
    if (r) return r;
    await new Promise(res => setTimeout(res, interval));
  }
  return null;
}

// ─── History sidebar ───────────────────────────────────────────────────────────

async function renderHistorySidebar(activeId) {
  const history = await loadHistory();
  if (history.length <= 1) return; // no sidebar needed for a single result

  const sidebar = document.getElementById('history-sidebar');
  if (!sidebar) return;
  sidebar.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'history-title';
  title.textContent = 'History';
  sidebar.appendChild(title);

  history.forEach(entry => {
    const item = document.createElement('a');
    item.className = 'history-item' + (entry.id === activeId ? ' active' : '');
    item.href = 'results.html?id=' + entry.id;

    const hasError = (entry.logs || []).some(l => l.level === 'error');
    const dot = document.createElement('span');
    dot.className = 'history-dot ' + (hasError ? 'error' : 'success');

    const info = document.createElement('span');
    info.className = 'history-info';

    const name = document.createElement('span');
    name.className = 'history-name';
    name.textContent = entry.snippetName;

    const time = document.createElement('span');
    time.className = 'history-time';
    time.textContent = formatRelativeTime(entry.ranAt);

    info.appendChild(name);
    info.appendChild(time);
    item.appendChild(dot);
    item.appendChild(info);
    sidebar.appendChild(item);
  });

  // Show the sidebar layout
  document.body.classList.add('has-sidebar');
}

function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24)  return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

// ─── Render result ─────────────────────────────────────────────────────────────

function render(main, result) {
  const hasError    = result.logs.some(l => l.level === 'error');
  const statusClass = hasError ? 'error' : 'success';
  const statusIcon  = hasError ? '✕' : '✓';
  const ranAt       = new Date(result.ranAt);

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

  document.title = `SnippetRunner — ${result.snippetName}`;

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
          &nbsp;·&nbsp; ${new Date(result.ranAt).toLocaleDateString()}
        </div>
      </div>
    </div>

    <section class="result-section collapsible collapsed">
      <div class="section-header">
        <div class="section-header-left">
          <span class="chevron"></span>
          <span>Code</span>
          <span class="collapse-hint">click to expand</span>
        </div>
        <div class="section-header-right">
          <button id="btn-copy-code" class="btn-ghost btn-xs">Copy</button>
        </div>
      </div>
      <div class="section-body"><div class="section-body-inner">
        <pre class="code-block">${escapeHtml(result.code)}</pre>
      </div></div>
    </section>

    <section class="result-section collapsible">
      <div class="section-header">
        <div class="section-header-left">
          <span class="chevron"></span>
          <span>Output</span>
          <span class="collapse-hint">click to collapse</span>
        </div>
        <div class="section-header-right">
          ${logCountHtml}
          ${result.logs && result.logs.length > 0 ? '<button id="btn-copy-output" class="btn-ghost btn-xs">Copy</button>' : ''}
        </div>
      </div>
      <div class="section-body"><div class="section-body-inner">
        <div class="logs-block">${logsHtml}</div>
      </div></div>
    </section>
  `;

  main.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const section = header.closest('.collapsible');
      section.classList.toggle('collapsed');
      const hint = header.querySelector('.collapse-hint');
      if (hint) hint.textContent = section.classList.contains('collapsed') ? 'click to expand' : 'click to collapse';
    });
  });

  document.getElementById('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard.writeText(result.code).then(() => {
      const btn = document.getElementById('btn-copy-code');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 1500);
    });
  });

  const copyOutputBtn = document.getElementById('btn-copy-output');
  if (copyOutputBtn) {
    copyOutputBtn.addEventListener('click', () => {
      const text = (result.logs || []).map(l => l.text).join('\n');
      navigator.clipboard.writeText(text).then(() => {
        copyOutputBtn.textContent = 'Copied!';
        setTimeout(() => copyOutputBtn.textContent = 'Copy', 1500);
      });
    });
  }
}