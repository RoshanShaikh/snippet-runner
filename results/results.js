document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('btn-close').addEventListener('click', () => window.close());

  const main     = document.getElementById('results-main');
  const params   = new URLSearchParams(window.location.search);
  const resultId = params.get('id');

  const pending = resultId ? await loadPendingResult(resultId) : null;
  const waitingStarted = new Date();

  if (pending) {
    renderLoading(main, pending);
    await renderHistorySidebar(resultId, true);

    const result = await waitForResultById(resultId, 300000);
    await clearPendingResult(resultId);

    if (!result) {
      const waitingEnded = new Date();
      let waitedFor = (waitingEnded - waitingStarted) / 1000;
      main.innerHTML = `
        <div class="no-result">
          <div class="no-result-icon">🤷</div>
          <p>Execution timed out or failed.</p>
          <p class="muted">Waited for: ${waitedFor} seconds.</p>
          <p class="muted">Check the page console for errors.</p>
        </div>`;
      return;
    }

    render(main, result);
    await renderHistorySidebar(result.id);
    return;
  }

  main.innerHTML = `<div class="loading-results">Loading results<span class="loading-dots"></span></div>`;

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

// ─── Loading UI ────────────────────────────────────────────────────────────────

function renderLoading(main, pending) {
  document.title = `SnippetRunner — ${pending.snippetName}`;
  main.innerHTML = `
    <div class="result-hero">
      <div class="result-status-icon running">
        <span class="running-spinner"></span>
      </div>
      <div>
        <h1 class="result-snippet-name">${escapeHtml(pending.snippetName)}</h1>
        <div class="result-meta">
          Running on
          <a href="${escapeHtml(pending.pageUrl)}" target="_blank" class="page-link"
            title="${escapeHtml(pending.pageUrl)}">${escapeHtml(pending.pageTitle || pending.pageUrl)}</a>
          &nbsp;·&nbsp; <span id="running-timer">0.0s</span>
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
        <pre class="code-block">${escapeHtml(pending.code)}</pre>
      </div></div>
    </section>

    <section class="result-section collapsible">
      <div class="section-header">
        <div class="section-header-left">
          <span class="chevron"></span>
          <span>Output</span>
          <span class="collapse-hint">click to collapse</span>
        </div>
        <div class="section-header-right"></div>
      </div>
      <div class="section-body"><div class="section-body-inner">
        <div class="log-empty" style="display:flex;align-items:center;gap:10px;">
          <span class="running-spinner running-spinner-sm"></span>
          Executing…
        </div>
      </div></div>
    </section>
  `;

  // Live timer
  const start = pending.ranAt;
  const timerEl = document.getElementById('running-timer');
  const interval = setInterval(() => {
    if (!timerEl.isConnected) { clearInterval(interval); return; }
    timerEl.textContent = ((Date.now() - start) / 1000).toFixed(1) + 's';
  }, 100);

  // Section collapse listeners
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
    navigator.clipboard.writeText(pending.code).then(() => {
      const btn = document.getElementById('btn-copy-code');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 1500);
    });
  });
}

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

async function renderHistorySidebar(activeId, isPending = false) {
  const history = await loadHistory();

  // During pending, we may not be in history yet — only show sidebar if there's other history
  const others = history.filter(r => r.id !== activeId);
  if (!isPending && history.length <= 1) return;
  if (isPending && others.length === 0) return;

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

    const meta = document.createElement('span');
    meta.className = 'history-time';
    const parts = [formatRelativeTime(entry.ranAt)];
    if (entry.duration != null) parts.push(formatDuration(entry.duration));
    meta.textContent = parts.join(' · ');

    info.appendChild(name);
    info.appendChild(meta);
    item.appendChild(dot);
    item.appendChild(info);
    sidebar.appendChild(item);
  });

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

function formatDuration(ms) {
  return (ms / 1000).toFixed(2) + 's';
}

// ─── Render result ─────────────────────────────────────────────────────────────

function render(main, result) {
  const hasError    = result.logs.some(l => l.level === 'error');
  const statusClass = hasError ? 'error' : 'success';
  const statusIcon  = hasError ? '✕' : '✓';
  const ranAt       = new Date(result.ranAt);

  const durationHtml = result.duration != null
    ? `&nbsp;·&nbsp; ${formatDuration(result.duration)}`
    : '';

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
          &nbsp;·&nbsp; ${ranAt.toLocaleDateString()}
          ${durationHtml}
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
        <div class="logs-block" id="logs-block"></div>
      </div></div>
    </section>
  `;

  const logsBlock = document.getElementById('logs-block');
  if (!result.logs || result.logs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'log-empty';
    empty.textContent = 'No console output — snippet ran silently.';
    logsBlock.appendChild(empty);
  } else {
    const levels = new Set((result.logs || []).map(l => l.level));
    const showLevelTag = levels.size > 1;

    result.logs.forEach((entry, i) => {
      const hasTitle = entry.title != null;
      const bodyText = entry.body !== undefined ? entry.body : (entry.text || '');
      const isOverflowing = !hasTitle && (bodyText.includes('\n') || bodyText.length > 200);
      const isCollapsible = hasTitle || isOverflowing;

      const row = document.createElement('div');
      row.className = `log-row log-${entry.level}` + (isCollapsible ? ' log-collapsible collapsed' : '') + (hasTitle ? ' log-has-title-row' : '');

      const header = document.createElement('div');
      header.className = 'log-row-header';

      const chevron = document.createElement('span');
      chevron.className = 'log-chevron' + (isCollapsible ? '' : ' log-chevron-hidden');
      header.appendChild(chevron);

      const idx = document.createElement('span');
      idx.className = 'log-index';
      idx.textContent = i + 1;
      header.appendChild(idx);

      if (showLevelTag) {
        const tag = document.createElement('span');
        tag.className = `log-level-tag log-level-tag-${entry.level}`;
        tag.textContent = entry.level;
        header.appendChild(tag);
      }

      const headerText = document.createElement('span');
      headerText.className = 'log-header-text';
      headerText.textContent = hasTitle ? entry.title : bodyText;
      header.appendChild(headerText);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn-xs log-copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.title = 'Copy this line';
      copyBtn.addEventListener('click', e => {
        e.stopPropagation();
        const copyValue = (hasTitle && bodyText) ? bodyText : (entry.title || bodyText);
        navigator.clipboard.writeText(copyValue).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => copyBtn.textContent = 'Copy', 1500);
        });
      });
      header.appendChild(copyBtn);
      row.appendChild(header);

      if (hasTitle || isOverflowing) {
        const body = document.createElement('div');
        body.className = 'log-row-body';
        const pre = document.createElement('pre');
        pre.className = 'log-text';
        pre.textContent = bodyText;
        body.appendChild(pre);
        row.appendChild(body);
      }

      logsBlock.appendChild(row);

      if (isCollapsible) {
        row.addEventListener('click', e => {
          if (e.target.closest('.log-copy-btn')) return;
          row.classList.toggle('collapsed');
        });
      }
    });
  }

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
      const text = (result.logs || []).map(l => {
        const body = l.body !== undefined ? l.body : (l.text || '');
        return l.title != null ? `${l.title}: ${body}` : body;
      }).join('\n');
      navigator.clipboard.writeText(text).then(() => {
        copyOutputBtn.textContent = 'Copied!';
        setTimeout(() => copyOutputBtn.textContent = 'Copy', 1500);
      });
    });
  }
}