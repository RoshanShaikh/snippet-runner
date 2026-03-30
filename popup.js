// ─── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg, type = 'success') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = type === 'error' ? 'error' : '';
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

// ─── LIST ──────────────────────────────────────────────────────────────────────

async function renderList() {
  const snippets = await loadSnippets();
  const list = document.getElementById('snippet-list');
  const empty = document.getElementById('snippet-list-empty');

  list.innerHTML = '';

  if (snippets.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  snippets.forEach(snippet => {
    const li = document.createElement('li');
    li.className = 'snippet-item';
    li.dataset.id = snippet.id;

    const varCount = (snippet.variables || []).length;
    const metaText = snippet.desc || `${snippet.code.length} chars`;

    li.innerHTML = `
      <div class="snippet-info">
        <div class="snippet-name">${escapeHtml(snippet.name)}</div>
        <div class="snippet-meta">${escapeHtml(metaText)}</div>
      </div>
      ${varCount > 0 ? `<span class="snippet-badge">${varCount} var${varCount > 1 ? 's' : ''}</span>` : ''}
      <div class="snippet-actions">
        <button class="btn-action run" title="Run" data-action="run">▶</button>
        <button class="btn-action edit" title="Edit" data-action="edit">✎</button>
        <button class="btn-action del" title="Delete" data-action="delete">✕</button>
      </div>
    `;

    li.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'run') openRunModal(snippet);
      if (action === 'edit') openEditorPage(snippet.id);
      if (action === 'delete') confirmDelete(li, snippet);
    });

    list.appendChild(li);
  });
}

function confirmDelete(li, snippet) {
  if (li.dataset.confirming) return;
  li.dataset.confirming = '1';

  li.innerHTML = `
    <div class="delete-confirm">
      <span>Delete <strong>${escapeHtml(snippet.name)}</strong>?</span>
      <div class="delete-confirm-actions">
        <button class="btn-action confirm-yes" data-action="confirm-yes">Yes, delete</button>
        <button class="btn-action confirm-no" data-action="confirm-no">Cancel</button>
      </div>
    </div>
  `;

  li.addEventListener('click', async e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'confirm-yes') {
      const snippets = await loadSnippets();
      await saveSnippets(snippets.filter(s => s.id !== snippet.id));
      renderList();
      showToast('Snippet deleted');
    } else if (action === 'confirm-no') {
      renderList();
    }
  }, { once: true });
}

// ─── OPEN EDITOR PAGE ──────────────────────────────────────────────────────────

function openEditorPage(snippetId = null) {
  const url = chrome.runtime.getURL('editor.html') + (snippetId ? `?id=${snippetId}` : '');
  chrome.tabs.create({ url });
  window.close();
}

// ─── RUN MODAL ─────────────────────────────────────────────────────────────────

let activeSnippet = null;

function openRunModal(snippet) {
  activeSnippet = snippet;
  document.getElementById('modal-snippet-name').textContent = snippet.name;

  const modalVars = document.getElementById('modal-vars');
  modalVars.innerHTML = '';

  const vars = snippet.variables || [];
  if (vars.length === 0) {
    modalVars.innerHTML = `<p class="modal-no-vars">No variables — snippet runs as-is.</p>`;
  } else {
    vars.forEach(v => {
      const row = document.createElement('div');
      row.className = 'modal-var-row';
      row.innerHTML = `
        <div class="modal-var-label">{{${escapeHtml(v.name)}}}</div>
        <input class="run-var-input" data-var="${escapeHtml(v.name)}" type="text"
          placeholder="${escapeHtml(v.default || '')}" value="${escapeHtml(v.default || '')}" />
      `;
      modalVars.appendChild(row);
    });
  }

  document.getElementById('run-modal').classList.remove('hidden');
  const first = modalVars.querySelector('input');
  if (first) setTimeout(() => first.focus(), 50);
}

function closeRunModal() {
  document.getElementById('run-modal').classList.add('hidden');
  activeSnippet = null;
}

// ─── EXECUTE ───────────────────────────────────────────────────────────────────

async function executeSnippet() {
  if (!activeSnippet) return;

  let code = activeSnippet.code;
  document.querySelectorAll('.run-var-input').forEach(input => {
    const regex = new RegExp(`\\{\\{${escapeRegex(input.dataset.var)}\\}\\}`, 'g');
    code = code.replace(regex, input.value);
  });

  const snippetName = activeSnippet.name;
  const snippetId   = activeSnippet.id;
  closeRunModal();

  const overlay = document.getElementById('loading-overlay');
  overlay.classList.remove('hidden');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject into page — patches window.console so the <script> tag
    // (which reads window.console at call time) sees the intercepted version.
    const [{ result: logs }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: (codeToRun, sName) => {
        const captured = [];
        const _log   = window.console.log.bind(console);
        const _warn  = window.console.warn.bind(console);
        const _error = window.console.error.bind(console);

        function serialize(args) {
          return args.map(a => {
            try {
              if (a === null) return 'null';
              if (a === undefined) return 'undefined';
              return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a);
            } catch (_e) { return '[unserializable]'; }
          }).join(' ');
        }

        // Patch window.console — script tags read from window.console
        window.console.log   = (...a) => { captured.push({ level: 'log',   text: serialize(a) }); _log(...a);   };
        window.console.warn  = (...a) => { captured.push({ level: 'warn',  text: serialize(a) }); _warn(...a);  };
        window.console.error = (...a) => { captured.push({ level: 'error', text: serialize(a) }); _error(...a); };

        // Log the group header using original _log so it isn't captured
        window.console.groupCollapsed(
          '%c[SnippetRunner]%c ' + sName + ' %c(expand for code)',
          'color:#1a7a1a;font-weight:bold',
          'color:inherit;font-weight:bold',
          'color:#888;font-weight:normal;font-style:italic'
        );
        _log('%cCode:', 'color:#0055cc;font-weight:bold', '\n' + codeToRun);
        window.console.groupEnd();

        // Run via <script> tag — synchronous, CSP-safe, no eval
        const script = document.createElement('script');
        script.textContent = `(function(){try{${codeToRun}}catch(e){console.error('[SnippetRunner] Runtime error: '+e.message);}})();`;
        (document.head || document.documentElement).appendChild(script);
        script.remove();

        // Restore
        window.console.log   = _log;
        window.console.warn  = _warn;
        window.console.error = _error;

        // Return as JSON string to guarantee cross-world serialization
        return JSON.stringify(captured);
      },
      args: [code, snippetName]
    });

    // Parse the JSON string back — avoids structured clone dropping data
    let parsedLogs = [];
    try { parsedLogs = JSON.parse(logs || '[]'); } catch (_) {}

    // Build the result object and save to storage
    const resultData = {
      snippetId,
      snippetName,
      code,
      logs: parsedLogs,
      ranAt: Date.now(),
      pageUrl: tab.url,
      pageTitle: tab.title
    };

    // Explicitly wait for storage write to complete via callback
    await new Promise(resolve => {
      chrome.storage.local.set({ lastResult: resultData }, resolve);
    });

    overlay.classList.add('hidden');

    // Open results tab — storage is guaranteed written before this line
    chrome.tabs.create({ url: chrome.runtime.getURL('results.html') });

    // Delay close so the popup's JS context isn't torn down before
    // the storage write propagates to the new tab's read
    setTimeout(() => window.close(), 300);

  } catch (err) {
    overlay.classList.add('hidden');
    showToast('Error: ' + err.message, 'error');
    console.error('[SnippetRunner]', err);
  }
}

// ─── Wire-up ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-new').addEventListener('click', () => openEditorPage());

  document.getElementById('modal-cancel').addEventListener('click', closeRunModal);
  document.getElementById('modal-run').addEventListener('click', executeSnippet);
  document.getElementById('run-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeRunModal();
  });
  document.getElementById('run-modal').addEventListener('keydown', e => {
    if (e.key === 'Enter') executeSnippet();
    if (e.key === 'Escape') closeRunModal();
  });

  renderList();
});