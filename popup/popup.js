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

let focusedSnippetId = null;

function getFocusedItem() {
  return document.querySelector('.snippet-item.focused');
}

function setFocusedItem(li) {
  document.querySelectorAll('.snippet-item.focused').forEach(el => el.classList.remove('focused'));
  if (li) {
    li.classList.add('focused');
    focusedSnippetId = li.dataset.id;
    li.scrollIntoView({ block: 'nearest' });
  } else {
    focusedSnippetId = null;
  }
}

async function renderList(query = '') {
  const snippets = await loadSnippets();
  const list  = document.getElementById('snippet-list');
  const empty = document.getElementById('snippet-list-empty');

  list.innerHTML = '';

  const q = query.trim().toLowerCase();
  const filtered = q
    ? snippets.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.desc || '').toLowerCase().includes(q))
    : snippets;

  if (filtered.length === 0) {
    empty.classList.remove('hidden');
    empty.querySelector('p').innerHTML = q
      ? `No snippets match <strong>"${escapeHtml(q)}"</strong>`
      : 'No snippets yet.<br/>Hit <strong>＋</strong> to create one.';
    return;
  }
  empty.classList.add('hidden');

  filtered.forEach(snippet => {
    const li = document.createElement('li');
    li.className = 'snippet-item';
    li.dataset.id = snippet.id;

    const varCount = (snippet.variables || []).length;
    const metaText = snippet.desc || `${snippet.code.length} chars`;
    // Only attach data-full (tooltip) when there's a description that might truncate
    const metaAttr = snippet.desc ? ` data-full="${escapeHtml(snippet.desc)}"` : '';

    li.innerHTML = `
      <div class="snippet-info">
        <div class="snippet-name">${escapeHtml(snippet.name)}</div>
        <div class="snippet-meta"${metaAttr}>${escapeHtml(metaText)}</div>
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

  // Restore focused item if it still exists, otherwise clear
  if (focusedSnippetId) {
    const restored = list.querySelector(`.snippet-item[data-id="${focusedSnippetId}"]`);
    if (restored) restored.classList.add('focused');
    else focusedSnippetId = null;
  }

  // Auto-focus first item when search has content and nothing is focused
  if (!focusedSnippetId) {
    const first = list.querySelector('.snippet-item');
    if (first) setFocusedItem(first);
  }
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
  const url = chrome.runtime.getURL('editor/editor.html') + (snippetId ? `?id=${snippetId}` : '');
  chrome.tabs.create({ url });
  window.close();
}

// ─── OPEN HISTORY PAGE ──────────────────────────────────────────────────────────

function openHistoryPage(resultId = null) {
  const url = chrome.runtime.getURL('results/results.html') + (resultId ? `?id=${resultId}` : '')
  chrome.tabs.create({ url });
  window.close();
}

// ─── RUN MODAL ─────────────────────────────────────────────────────────────────

let activeSnippet = null;

function openRunModal(snippet) {
  activeSnippet = snippet;
  document.getElementById('modal-snippet-name').textContent = snippet.name;
  const descEl = document.getElementById('modal-snippet-desc');
  if (descEl) {
    descEl.textContent = snippet.desc || '';
    descEl.style.display = snippet.desc ? 'block' : 'none';
  }

  const modalVars = document.getElementById('modal-vars');
  modalVars.innerHTML = '';

  const vars = snippet.variables || [];
  if (vars.length === 0) {
    modalVars.innerHTML = `<p class="modal-no-vars">No variables — snippet runs as-is.</p>`;
  } else {
    modalVars.innerHTML = `
      <p class="modal-vars-desc">Each value replaces its <code>{{placeholder}}</code> as a raw JavaScript value in the script.</p>
      <table class="modal-vars-table">
        <thead>
          <tr>
            <th>Placeholder</th>
            <th>JS value</th>
          </tr>
        </thead>
        <tbody>
          ${vars.map(v => `
            <tr class="${v.fieldDesc ? 'has-hint' : ''}">
              <td class="modal-var-name"><code>{{${escapeHtml(v.name)}}}</code></td>
              <td class="modal-var-input-cell">
                ${v.multiline
                  ? `<input type="hidden" class="run-var-input" data-var="${escapeHtml(v.name)}" value="${escapeHtml(v.default || '')}"/>
                     <div class="multiline-preview-cell">
                       <span class="multiline-preview ${v.default ? 'has-value' : ''}" data-var="${escapeHtml(v.name)}">
                         ${v.default ? escapeHtml(v.default.split('\n')[0]) + (v.default.includes('\n') ? ' …' : '') : '(empty)'}
                       </span>
                       <button class="btn-edit-multiline" type="button"
                         data-var="${escapeHtml(v.name)}"
                         data-hint="${escapeHtml(v.fieldDesc || '')}">Edit</button>
                     </div>`
                  : `<input class="run-var-input" data-var="${escapeHtml(v.name)}" type="text"
                      placeholder="${escapeHtml(v.default || '(empty)')}"
                      value="${escapeHtml(v.default || '')}"
                      autocomplete="off" spellcheck="false"/>`
                }
              </td>
            </tr>
            ${v.fieldDesc ? `
            <tr class="modal-var-hint-row">
              <td colspan="2" class="modal-var-hint-cell">${escapeHtml(v.fieldDesc)}</td>
            </tr>` : ''}
          `).join('')}
        </tbody>
      </table>
    `;
  }

  document.getElementById('run-modal').classList.remove('hidden');
  const first = modalVars.querySelector('input:not([type="hidden"])');
  if (first) setTimeout(() => first.focus(), 50);

  // Wire up Edit buttons for multiline vars
  modalVars.querySelectorAll('.btn-edit-multiline').forEach(btn => {
    btn.addEventListener('click', () => {
      const varName = btn.dataset.var;
      const hint    = btn.dataset.hint;
      const hidden  = modalVars.querySelector(`.run-var-input[data-var="${varName}"]`);
      const preview = modalVars.querySelector(`.multiline-preview[data-var="${varName}"]`);
      openMultilineOverlay(
        '{{' + varName + '}}',
        hint,
        hidden ? hidden.value : '',
        (newVal) => {
          if (hidden) hidden.value = newVal;
          if (preview) {
            const firstLine = newVal ? newVal.split('\n')[0] + (newVal.includes('\n') ? ' …' : '') : '(empty)';
            preview.textContent = firstLine;
            preview.className = 'multiline-preview' + (newVal ? ' has-value' : '');
          }
        }
      );
    });
  });
}

function closeRunModal() {
  document.getElementById('run-modal').classList.add('hidden');
  activeSnippet = null;
  // Return focus to search input
  setTimeout(() => document.getElementById('search-input')?.focus(), 50);
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

        function serializeValue(a) {
          try {
            if (a === null) return 'null';
            if (a === undefined) return 'undefined';
            return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a);
          } catch (_e) { return '[unserializable]'; }
        }

        function serialize(args) {
          if (args.length > 1) {
            // First arg is the title, remaining args are the copyable body
            return {
              title: serializeValue(args[0]),
              body: args.slice(1).map(serializeValue).join(' '),
            };
          }
          return { title: null, body: serializeValue(args[0]) };
        }

        // Patch window.console — script tags read from window.console
        window.console.log   = (...a) => { captured.push({ level: 'log',   ...serialize(a) }); _log(...a);   };
        window.console.warn  = (...a) => { captured.push({ level: 'warn',  ...serialize(a) }); _warn(...a);  };
        window.console.error = (...a) => { captured.push({ level: 'error', ...serialize(a) }); _error(...a); };

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

    // Build the result object with a unique ID
    const resultId = uid();
    const resultData = {
      id: resultId,
      snippetId,
      snippetName,
      code,
      logs: parsedLogs,
      ranAt: Date.now(),
      pageUrl: tab.url,
      pageTitle: tab.title
    };

    // Save to history (prepends, capped at 50) — also keep lastResult for compat
    await saveToHistory(resultData);
    await saveResult(resultData);

    overlay.classList.add('hidden');

    // Open results tab with the specific result ID
    openHistoryPage(resultId)

    setTimeout(() => window.close(), 300);

  } catch (err) {
    overlay.classList.add('hidden');
    showToast('Error: ' + err.message, 'error');
    console.error('[SnippetRunner]', err);
  }
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────

async function exportSnippets() {
  const snippets = await loadSnippets();
  if (snippets.length === 0) { showToast('No snippets to export', 'error'); return; }

  const checklist = document.getElementById('export-checklist');
  const countEl   = document.getElementById('export-selected-count');
  checklist.innerHTML = '';

  snippets.forEach(s => {
    const row = document.createElement('label');
    row.className = 'checklist-row';
    row.innerHTML = `
      <input type="checkbox" class="checklist-cb" data-id="${escapeHtml(s.id)}" checked
        accent-color="var(--accent)"/>
      <span class="checklist-name">${escapeHtml(s.name)}</span>
      ${s.desc ? `<span class="checklist-desc">${escapeHtml(s.desc)}</span>` : ''}
    `;
    checklist.appendChild(row);
  });

  const updateCount = () => {
    const n = checklist.querySelectorAll('.checklist-cb:checked').length;
    countEl.textContent = `${n} of ${snippets.length} selected`;
    document.getElementById('export-select-all').checked = n === snippets.length;
    document.getElementById('export-select-all').indeterminate = n > 0 && n < snippets.length;
  };
  checklist.addEventListener('change', updateCount);
  updateCount();

  document.getElementById('export-select-all').onchange = function() {
    checklist.querySelectorAll('.checklist-cb').forEach(cb => cb.checked = this.checked);
    updateCount();
  };

  document.getElementById('export-modal').classList.remove('hidden');
}

function doExport() {
  const checklist = document.getElementById('export-checklist');
  const selectedIds = new Set(
    [...checklist.querySelectorAll('.checklist-cb:checked')].map(cb => cb.dataset.id)
  );
  if (selectedIds.size === 0) { showToast('Select at least one snippet', 'error'); return; }

  loadSnippets().then(snippets => {
    const selected = snippets.filter(s => selectedIds.has(s.id));
    // Strip IDs before exporting — new IDs will be generated on import
    const exportable = selected.map(({ id: _id, ...rest }) => rest);
    const payload = { version: 1, exportedAt: new Date().toISOString(), snippets: exportable };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `snippetrunner-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    document.getElementById('export-modal').classList.add('hidden');
    showToast(`Exported ${selected.length} snippet${selected.length > 1 ? 's' : ''}`);
    // Return focus to search input
    setTimeout(() => document.getElementById('search-input')?.focus(), 50);
  });
}

function closeExportModal() {
  document.getElementById('export-modal').classList.add('hidden');
  // Return focus to search input
  setTimeout(() => document.getElementById('search-input')?.focus(), 50);
}

// ─── IMPORT ───────────────────────────────────────────────────────────────────

let pendingImport = null;

function openImportPicker() {
  document.getElementById('import-file-input').click();
}

function onImportFileChosen(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      const snippets = Array.isArray(data) ? data
                     : Array.isArray(data.snippets) ? data.snippets
                     : null;

      if (!snippets || snippets.length === 0) { showToast('No valid snippets found in file', 'error'); return; }

      const valid = snippets.filter(s => s && typeof s.name === 'string' && typeof s.code === 'string');
      if (valid.length === 0) { showToast('No valid snippets found in file', 'error'); return; }

      pendingImport = valid;

      document.getElementById('import-summary').textContent =
        `Found ${valid.length} snippet${valid.length > 1 ? 's' : ''} in "${file.name}"`;

      // Build checklist
      const checklist = document.getElementById('import-checklist');
      const countEl   = document.getElementById('import-selected-count');
      checklist.innerHTML = '';

      valid.forEach(s => {
        const row = document.createElement('label');
        row.className = 'checklist-row';
        row.innerHTML = `
          <input type="checkbox" class="checklist-cb" data-id="${escapeHtml(s.id || '')}" checked/>
          <span class="checklist-name">${escapeHtml(s.name)}</span>
          ${s.desc ? `<span class="checklist-desc">${escapeHtml(s.desc)}</span>` : ''}
        `;
        checklist.appendChild(row);
      });

      const updateCount = () => {
        const n = checklist.querySelectorAll('.checklist-cb:checked').length;
        countEl.textContent = `${n} of ${valid.length} selected`;
        document.getElementById('import-select-all').checked = n === valid.length;
        document.getElementById('import-select-all').indeterminate = n > 0 && n < valid.length;
      };
      checklist.addEventListener('change', updateCount);
      updateCount();

      document.getElementById('import-select-all').onchange = function() {
        checklist.querySelectorAll('.checklist-cb').forEach(cb => cb.checked = this.checked);
        updateCount();
      };

      document.getElementById('import-options').classList.remove('hidden');
      document.getElementById('import-modal').classList.remove('hidden');
    } catch {
      showToast('Invalid JSON file', 'error');
    }
  };
  reader.readAsText(file);
}

async function confirmImport() {
  if (!pendingImport) return;

  const checklist = document.getElementById('import-checklist');
  const checkboxes = [...checklist.querySelectorAll('.checklist-cb')];
  const selected = pendingImport.filter((_, i) => checkboxes[i]?.checked);

  if (selected.length === 0) { showToast('Select at least one snippet', 'error'); return; }

  const existing = await loadSnippets();
  // Track all names (existing + already-processed imports) to detect collisions
  const takenNames = new Set(existing.map(s => s.name.toLowerCase()));

  // Always generate fresh IDs; rename collisions with a numeric suffix
  const incoming = selected.map(s => {
    let name = s.name;
    if (takenNames.has(name.toLowerCase())) {
      let counter = 2;
      while (takenNames.has(`${name} (${counter})`.toLowerCase())) counter++;
      name = `${name} (${counter})`;
    }
    takenNames.add(name.toLowerCase());
    return {
      ...s,
      id: uid(),
      name,
      variables: s.variables || [],
      createdAt: s.createdAt || Date.now()
    };
  });

  await saveSnippets([...existing, ...incoming]);
  closeImportModal();
  renderList();
  showToast(`Imported ${incoming.length} snippet${incoming.length > 1 ? 's' : ''}`);
  // Return focus to search input
  setTimeout(() => document.getElementById('search-input')?.focus(), 50);
}

function closeImportModal() {
  document.getElementById('import-modal').classList.add('hidden');
  document.getElementById('import-options').classList.add('hidden');
  pendingImport = null;
  // Return focus to search input
  setTimeout(() => document.getElementById('search-input')?.focus(), 50);
}

// ─── TOOLTIP POSITIONING ──────────────────────────────────────────────────────
// CSS ::after with position:fixed needs coordinates from JS
document.addEventListener('mousemove', e => {
  const meta = e.target.closest('.snippet-meta[data-full]');
  if (meta) {
    const r = meta.getBoundingClientRect();
    document.documentElement.style.setProperty('--tt-x', `${r.left}px`);
    document.documentElement.style.setProperty('--tt-y', `${r.bottom + 6}px`);
  }
});

// ─── MULTILINE OVERLAY ────────────────────────────────────────────────────────

let _multilineCallback = null;

function openMultilineOverlay(label, hint, currentValue, onApply) {
  _multilineCallback = onApply;
  document.getElementById('multiline-label').textContent = label;
  document.getElementById('multiline-hint').textContent = hint || '';
  document.getElementById('multiline-textarea').value = currentValue;
  document.getElementById('multiline-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('multiline-textarea').focus(), 50);
}

function closeMultilineOverlay() {
  document.getElementById('multiline-overlay').classList.add('hidden');
  _multilineCallback = null;
  // Return focus to search input
  setTimeout(() => document.getElementById('search-input')?.focus(), 50);
}

// ─── Wire-up ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-new').addEventListener('click', () => openEditorPage());
  document.getElementById('btn-history').addEventListener('click', () => openHistoryPage());

  // Multiline overlay
  document.getElementById('multiline-confirm').addEventListener('click', () => {
    const val = document.getElementById('multiline-textarea').value;
    if (_multilineCallback) _multilineCallback(val);
    closeMultilineOverlay();
  });
  document.getElementById('multiline-cancel').addEventListener('click', closeMultilineOverlay);
  document.getElementById('multiline-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeMultilineOverlay();
  });
  document.getElementById('multiline-overlay').addEventListener('keydown', e => {
    if (e.key === "Escape") {
        e.preventDefault();
        closeMultilineOverlay();
    }
  });

  document.getElementById('btn-export').addEventListener('click', exportSnippets);
  document.getElementById('export-cancel').addEventListener('click', closeExportModal);
  
  document.getElementById('export-confirm').addEventListener('click', doExport);
  document.getElementById("export-modal").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeExportModal();
  });
  document.getElementById('export-modal').addEventListener('keydown', e => {
      if (e.key === "Escape") {
          e.preventDefault();
          closeExportModal();
      }
  });

  document.getElementById('btn-import').addEventListener('click', openImportPicker);
  document.getElementById('import-file-input').addEventListener('change', onImportFileChosen);
  document.getElementById('import-cancel').addEventListener('click', closeImportModal);
  document.getElementById('import-confirm').addEventListener('click', confirmImport);
  document.getElementById('import-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeImportModal();
  });
  document.getElementById('import-modal').addEventListener('keydown', e => {
      if (e.key === "Escape") {
          e.preventDefault();
          closeImportModal();
      }
  });

  document.getElementById('modal-cancel').addEventListener('click', closeRunModal);
  document.getElementById('modal-run').addEventListener('click', executeSnippet);
  document.getElementById('run-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeRunModal();
  });
  document.getElementById('run-modal').addEventListener('keydown', e => {
      if (e.key === "Escape") {
          e.preventDefault();
          closeRunModal();
      }
  });

  // Search input — always visible, auto-focused on popup open
  const searchInput = document.getElementById('search-input');

  // Auto-focus search input on popup open
  setTimeout(() => searchInput.focus(), 50);

  // Global keydown — Ctrl+Enter for execution
  document.addEventListener('keydown', e => {
    // Ctrl+Enter: execute if run modal is open, otherwise open run modal for focused/first snippet
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!document.getElementById('run-modal').classList.contains('hidden')) {
        // Run modal is open — execute the snippet
        executeSnippet();
      } else {
        // Run modal is closed — open it for the focused/first snippet
        const target = getFocusedItem() || document.querySelector('.snippet-item');
        if (target) target.querySelector('[data-action="run"]')?.click();
      }
      return;
    }

    if(e.key === "Escape"){
      e.preventDefault();
      if (!document.getElementById('run-modal').classList.contains('hidden')) {
        closeRunModal();
      }
      else if (!document.getElementById('export-modal').classList.contains('hidden')) {
        closeExportModal();
      }
      else if (!document.getElementById('import-modal').classList.contains('hidden')) {
        closeImportModal();
      }
      return;
    }
  });

  searchInput.addEventListener('input', () => {
    focusedSnippetId = null; // let renderList auto-focus the new first item
    renderList(searchInput.value);
  });

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...document.querySelectorAll('.snippet-item')];
      if (!items.length) return;
      const current = getFocusedItem();
      const idx = current ? items.indexOf(current) : -1;
      if (e.key === 'ArrowDown') {
        const next = items[idx + 1];
        if (next) setFocusedItem(next);
      } else {
        if (idx <= 0) setFocusedItem(null);
        else setFocusedItem(items[idx - 1]);
      }
    }
    if (e.key === "Escape" && searchInput.value) {
        searchInput.value = "";
        focusedSnippetId = null;
        renderList();
    }
  });

  renderList();
});