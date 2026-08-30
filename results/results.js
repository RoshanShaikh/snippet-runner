document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById("btn-clear-history").addEventListener("click", () => {
    clearHistory();
    window.close();
  });

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
    await clearPendingResultSafe(resultId);

    if (!result) {
      const waitingEnded = new Date();
      const waitedFor = (waitingEnded - waitingStarted) / 1000;

      main.innerHTML = `
        <div class="no-result">
          <div class="no-result-icon">⏱</div>
          <p>Execution did not produce a result.</p>
          <p class="muted">Waited for: ${waitedFor.toFixed(1)} seconds.</p>
          <p class="muted">The snippet may still be running in the target tab.</p>
        </div>`;

      await renderHistorySidebar(resultId);
      return;
    }

    render(main, result);
    await renderHistorySidebar(result.id);
    return;
  }

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

    await renderHistorySidebar(result?.id);
    return;
  }

  await renderHistorySidebar(result?.id);
  render(main, result);
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

  const start = pending.ranAt;
  const timerEl = document.getElementById('running-timer');
  const interval = setInterval(() => {
    if (!timerEl?.isConnected) {
      clearInterval(interval);
      return;
    }

    timerEl.textContent = ((Date.now() - start) / 1000).toFixed(1) + 's';
  }, 100);

  main.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.closest('button')) return;

      const section = header.closest('.collapsible');
      section.classList.toggle('collapsed');

      const hint = header.querySelector('.collapse-hint');
      if (hint) {
        hint.textContent = section.classList.contains('collapsed')
          ? 'click to expand'
          : 'click to collapse';
      }
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

async function clearPendingResultSafe(id) {
  if (!id) return;

  try {
    if (typeof clearPendingResult === 'function') {
      await clearPendingResult(id);
    }
  } catch (_) {
    // Best effort. A missing pending record should not break rendering.
  }
}

// ─── History sidebar ───────────────────────────────────────────────────────────

async function renderHistorySidebar(activeId, isPending = false) {
  const history = await loadHistory();

  const sidebar = document.getElementById('history-sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'history-title';
  title.textContent = 'History';
  sidebar.appendChild(title);

  if (history.length === 0) {
    const item = document.createElement('p');
    item.className = 'history-title';
    item.textContent = 'No history found.';
    sidebar.appendChild(item);
  }

  history.forEach(entry => {
    const item = document.createElement('a');
    item.className = 'history-item' + (entry.id === activeId ? ' active' : '');
    item.href = 'results.html?id=' + encodeURIComponent(entry.id);

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

  if (s < 60) return 'just now';

  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';

  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';

  return Math.floor(h / 24) + 'd ago';
}

function formatDuration(ms) {
  return (ms / 1000).toFixed(2) + 's';
}

// ─── Error helpers ─────────────────────────────────────────────────────────────

function getSourceLine(code, line) {
  if (!code || !Number.isInteger(line) || line < 1) return null;

  const lines = code.split(/\r?\n/);
  return lines[line - 1] ?? null;
}

function getSourceContext(code, line, radius = 2) {
  if (!code || !Number.isInteger(line) || line < 1) return [];

  const lines = code.split(/\r?\n/);
  const start = Math.max(1, line - radius);
  const end = Math.min(lines.length, line + radius);

  return Array.from({ length: end - start + 1 }, (_, index) => ({
    number: start + index,
    text: lines[start - 1 + index],
    current: start + index === line,
  }));
}

function formatErrorLocation(entry) {
  if (!entry.line) return '';

  const file = entry.file
    ? escapeHtml(entry.file)
    : 'Snippet';

  return `
    <div class="runtime-error-location">
      <span class="runtime-error-location-file">${file}</span>
      <span class="runtime-error-location-separator">·</span>
      <span>Line ${entry.line}</span>
      ${entry.column ? `<span class="runtime-error-location-separator">·</span><span>Column ${entry.column}</span>` : ''}
    </div>
  `;
}

function renderErrorDetails(container, entry, code) {
  const sourceContext = getSourceContext(code, entry.line, 2);

  if (!entry.line && !entry.stack) return;

  const details = document.createElement('div');
  details.className = 'runtime-error-details';

  if (entry.line) {
    const location = document.createElement('div');
    location.className = 'runtime-error-location-block';
    location.innerHTML = formatErrorLocation(entry);
    details.appendChild(location);
  }

  if (sourceContext.length) {
    const source = document.createElement('div');
    source.className = 'runtime-error-source';

    sourceContext.forEach(item => {
      const row = document.createElement('div');
      row.className = 'runtime-error-source-row' + (item.current ? ' current' : '');

      const number = document.createElement('span');
      number.className = 'runtime-error-source-number';
      number.textContent = item.number;

      const marker = document.createElement('span');
      marker.className = 'runtime-error-source-marker';
      marker.textContent = item.current ? '›' : '';

      const text = document.createElement('code');
      text.className = 'runtime-error-source-text';
      text.textContent = item.text || ' ';

      row.appendChild(number);
      row.appendChild(marker);
      row.appendChild(text);
      source.appendChild(row);

      if (item.current && entry.column) {
        const caretRow = document.createElement('div');
        caretRow.className = 'runtime-error-caret-row';

        const caret = document.createElement('span');
        caret.className = 'runtime-error-caret';
        caret.textContent = ' '.repeat(Math.max(0, entry.column - 1)) + '^';

        caretRow.appendChild(document.createElement('span'));
        caretRow.appendChild(document.createElement('span'));
        caretRow.appendChild(caret);
        source.appendChild(caretRow);
      }
    });

    details.appendChild(source);
  }

  if (entry.stack) {
    const stackToggle = document.createElement('button');
    stackToggle.className = 'runtime-error-stack-toggle';
    stackToggle.textContent = 'Show stack trace';

    const stack = document.createElement('pre');
    stack.className = 'runtime-error-stack';
    stack.textContent = entry.stack;
    stack.hidden = true;

    stackToggle.addEventListener('click', e => {
      e.stopPropagation();
      stack.hidden = !stack.hidden;
      stackToggle.textContent = stack.hidden
        ? 'Show stack trace'
        : 'Hide stack trace';
    });

    details.appendChild(stackToggle);
    details.appendChild(stack);
  }

  container.appendChild(details);
}

// ─── Render result ─────────────────────────────────────────────────────────────

function render(main, result) {
  const logs = Array.isArray(result.logs) ? result.logs : [];
  const hasError = logs.some(l => l.level === 'error');
  const statusClass = hasError ? 'error' : 'success';
  const statusIcon = hasError ? '✕' : '✓';
  const ranAt = new Date(result.ranAt);

  const durationHtml = result.duration != null
    ? `&nbsp;·&nbsp; ${formatDuration(result.duration)}`
    : '';

  const logCountHtml = logs.length > 0
    ? `<span class="log-count">${logs.length} line${logs.length > 1 ? 's' : ''}</span>`
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
          ${logs.length > 0 ? '<button id="btn-copy-output" class="btn-ghost btn-xs">Copy</button>' : ''}
        </div>
      </div>
      <div class="section-body"><div class="section-body-inner">
        <div class="logs-block" id="logs-block"></div>
      </div></div>
    </section>
  `;

  const logsBlock = document.getElementById('logs-block');

  if (logs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'log-empty';
    empty.textContent = 'No console output — snippet ran silently.';
    logsBlock.appendChild(empty);
  } else {
    const levels = new Set(logs.map(l => l.level));
    const showLevelTag = levels.size > 1;

    logs.forEach((entry, i) => {
      const hasTitle = entry.title != null;
      const bodyText = entry.body !== undefined ? entry.body : (entry.text || '');
      const isRuntimeError = entry.level === 'error' && (
        entry.line != null ||
        entry.column != null ||
        entry.file != null ||
        entry.stack != null
      );

      const isOverflowing =
        !hasTitle &&
        (bodyText.includes('\n') || bodyText.length > 200);

      const isCollapsible =
        isRuntimeError ||
        hasTitle ||
        isOverflowing;

      const row = document.createElement('div');

      row.className =
        `log-row log-${entry.level}` +
        (isCollapsible ? ' log-collapsible collapsed' : '') +
        (hasTitle ? ' log-has-title-row' : '') +
        (isRuntimeError ? ' log-runtime-error' : '');

      const header = document.createElement('div');
      header.className = 'log-row-header';

      const chevron = document.createElement('span');
      chevron.className =
        'log-chevron' +
        (isCollapsible ? '' : ' log-chevron-hidden');
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

      if (isRuntimeError && entry.line) {
        const lineBadge = document.createElement('span');
        lineBadge.className = 'log-location-badge';
        lineBadge.textContent =
          `L${entry.line}` + (entry.column ? `:${entry.column}` : '');
        lineBadge.title = 'Source location';
        header.appendChild(lineBadge);
      }

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn-xs log-copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.title = 'Copy this line';

      copyBtn.addEventListener('click', e => {
        e.stopPropagation();

        const location =
          entry.line
            ? `\nLocation: ${entry.file || 'Snippet'}:${entry.line}${entry.column ? ':' + entry.column : ''}`
            : '';

        const copyValue =
          (hasTitle && bodyText)
            ? `${bodyText}${location}`
            : `${entry.title || bodyText}${location}`;

        navigator.clipboard.writeText(copyValue).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => copyBtn.textContent = 'Copy', 1500);
        });
      });

      header.appendChild(copyBtn);
      row.appendChild(header);

      if (isRuntimeError) {
        const body = document.createElement('div');
        body.className = 'log-row-body';

        const errorMessage = document.createElement('div');
        errorMessage.className = 'runtime-error-message';
        errorMessage.textContent = bodyText;

        body.appendChild(errorMessage);
        renderErrorDetails(body, entry, result.code);

        row.appendChild(body);
      } else if (hasTitle || isOverflowing) {
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
          if (e.target.closest('.runtime-error-stack-toggle')) return;

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
      if (hint) {
        hint.textContent = section.classList.contains('collapsed')
          ? 'click to expand'
          : 'click to collapse';
      }
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
      const text = logs.map(l => {
        const body = l.body !== undefined ? l.body : (l.text || '');

        const location =
          l.line
            ? ` [${l.file || 'Snippet'}:${l.line}${l.column ? ':' + l.column : ''}]`
            : '';

        return l.title != null
          ? `${l.title}: ${body}${location}`
          : `${body}${location}`;
      }).join('\n');

      navigator.clipboard.writeText(text).then(() => {
        copyOutputBtn.textContent = 'Copied!';
        setTimeout(() => copyOutputBtn.textContent = 'Copy', 1500);
      });
    });
  }
}
