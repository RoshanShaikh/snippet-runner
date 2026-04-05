// ─── Init ──────────────────────────────────────────────────────────────────────

let editingId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (id) {
    editingId = id;
    document.getElementById('page-title').textContent = 'Edit Snippet';
    document.title = 'SnippetRunner — Edit Snippet';
    const snippets = await loadSnippets();
    const snippet  = snippets.find(s => s.id === id);
    if (snippet) populateForm(snippet);
  }

  document.getElementById('field-code').addEventListener('input', () => syncVarsFromCode());

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
    if (e.key === 'Escape') closeMultilineOverlay();
  });
  document.getElementById('btn-save').addEventListener('click', saveEditor);
  document.getElementById('btn-cancel').addEventListener('click', () => window.close());
});

// ─── Populate form when editing ────────────────────────────────────────────────

function populateForm(snippet) {
  document.getElementById('field-name').value = snippet.name || '';
  document.getElementById('field-desc').value = snippet.desc || '';
  document.getElementById('field-code').value = snippet.code || '';
  syncVarsFromCode(snippet.variables || []);
}

// ─── Auto-detect variables from {{placeholders}} in code ──────────────────────

function extractVarNames(code) {
  const matches = [...code.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)];
  const seen = new Set();
  return matches.map(m => m[1]).filter(n => seen.has(n) ? false : seen.add(n));
}

// ─── Build / swap the default-value cell ──────────────────────────────────────

function setDefaultField(td, value, multiline, varName, varHint) {
  td.innerHTML = '';
  if (multiline) {
    // Hidden input stores the actual value
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.className = 'var-default';
    hidden.value = value;

    // Preview + Edit button
    const cell = document.createElement('div');
    cell.className = 'multiline-preview-cell';

    const preview = document.createElement('span');
    preview.className = 'multiline-preview' + (value ? ' has-value' : '');
    preview.textContent = value ? value.split('\n')[0] + (value.includes('\n') ? ' …' : '') : '(empty)';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit-multiline';
    editBtn.textContent = 'Edit';
    editBtn.type = 'button';
    editBtn.addEventListener('click', () => {
      openMultilineOverlay(
        '{{' + varName + '}}',
        varHint || '',
        hidden.value,
        (newVal) => {
          hidden.value = newVal;
          preview.textContent = newVal ? newVal.split('\n')[0] + (newVal.includes('\n') ? ' …' : '') : '(empty)';
          preview.className = 'multiline-preview' + (newVal ? ' has-value' : '');
        }
      );
    });

    cell.appendChild(preview);
    cell.appendChild(editBtn);
    td.appendChild(hidden);
    td.appendChild(cell);
  } else {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'var-default var-default-input';
    inp.autocomplete = 'off';
    inp.spellcheck = false;
    inp.placeholder = "e.g. 'hello', 42, true";
    inp.value = value;
    td.appendChild(inp);
  }
}

// ─── Multiline overlay ─────────────────────────────────────────────────────────

let _multilineCallback = null;

function openMultilineOverlay(label, hint, currentValue, onApply) {
  _multilineCallback = onApply;
  document.getElementById('multiline-label').textContent = label;
  document.getElementById('multiline-hint').textContent = hint;
  document.getElementById('multiline-textarea').value = currentValue;
  document.getElementById('multiline-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('multiline-textarea').focus(), 50);
}

function closeMultilineOverlay() {
  document.getElementById('multiline-overlay').classList.add('hidden');
  _multilineCallback = null;
}

// ─── Sync vars table from code ────────────────────────────────────────────────

function syncVarsFromCode(existingVars = []) {
  const code  = document.getElementById('field-code').value;
  const names = extractVarNames(code);
  const list  = document.getElementById('variables-list');

  // Preserve existing values across re-syncs
  const current = {};
  list.querySelectorAll('tr[data-var-name]').forEach(row => {
    const n = row.dataset.varName;
    current[n] = {
      default:   row.querySelector('.var-default')?.value ?? '',
      fieldDesc: row.querySelector('.var-field-desc')?.value ?? '',
      multiline: row.querySelector('.var-multiline')?.checked ?? false
    };
  });
  existingVars.forEach(v => {
    if (!(v.name in current)) {
      current[v.name] = {
        default:   v.default   || '',
        fieldDesc: v.fieldDesc || '',
        multiline: v.multiline || false
      };
    }
  });

  list.innerHTML = '';

  if (names.length === 0) {
    list.innerHTML = '<p class="vars-empty-hint">Use <code>{{variableName}}</code> placeholders in your code \u2014 variables appear here automatically.</p>';
    return;
  }

  const banner = document.createElement('p');
  banner.className = 'vars-description';
  banner.innerHTML = 'Each <code>{{placeholder}}</code> is replaced with its value at run time. Set defaults and descriptions \u2014 they appear in the run modal to guide input.';
  list.appendChild(banner);

  const table = document.createElement('table');
  table.className = 'vars-table';
  table.innerHTML = '<thead><tr><th>Placeholder</th><th>Default JS value</th><th>Description / type hint</th><th class="th-multiline">Multi-line</th></tr></thead><tbody></tbody>';
  const tbody = table.querySelector('tbody');

  names.forEach(name => {
    const saved = current[name] || { default: '', fieldDesc: '', multiline: false };
    const tr = document.createElement('tr');
    tr.dataset.varName = name;

    // Placeholder cell
    const tdName = document.createElement('td');
    tdName.className = 'var-name-cell';
    tdName.innerHTML = '<code>{{' + escapeHtml(name) + '}}</code>';

    // Default value cell
    const tdDefault = document.createElement('td');
    tdDefault.className = 'td-default';
    setDefaultField(tdDefault, saved.default, saved.multiline, name, saved.fieldDesc);

    // Description cell
    const tdDesc = document.createElement('td');
    const inpDesc = document.createElement('input');
    inpDesc.type = 'text';
    inpDesc.className = 'var-field-desc var-default-input';
    inpDesc.autocomplete = 'off';
    inpDesc.spellcheck = false;
    inpDesc.placeholder = 'e.g. Auth token (string)';
    inpDesc.value = saved.fieldDesc;
    tdDesc.appendChild(inpDesc);

    // Multi-line checkbox cell
    const tdCheck = document.createElement('td');
    tdCheck.className = 'td-multiline';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'var-multiline';
    checkbox.title = 'Render as textarea in run modal';
    checkbox.checked = saved.multiline;
    checkbox.addEventListener('change', function () {
      const currentVal = tdDefault.querySelector('.var-default')?.value || '';
      const currentDesc = tdDesc.querySelector('.var-field-desc')?.value || '';
      setDefaultField(tdDefault, currentVal, this.checked, name, currentDesc);
    });
    tdCheck.appendChild(checkbox);

    tr.appendChild(tdName);
    tr.appendChild(tdDefault);
    tr.appendChild(tdDesc);
    tr.appendChild(tdCheck);
    tbody.appendChild(tr);
  });

  list.appendChild(table);
}

// ─── Save ──────────────────────────────────────────────────────────────────────

async function saveEditor() {
  const name = document.getElementById('field-name').value.trim();
  const code = document.getElementById('field-code').value.trim();

  if (!name) { showToast('Name is required', 'error'); return; }
  if (!code) { showToast('Code is required', 'error'); return; }

  const variables = [];
  document.querySelectorAll('#variables-list tr[data-var-name]').forEach(row => {
    const varName      = row.dataset.varName;
    const varDefault   = row.querySelector('.var-default')?.value || '';
    const varFieldDesc = row.querySelector('.var-field-desc')?.value || '';
    const varMultiline = row.querySelector('.var-multiline')?.checked || false;
    if (varName) variables.push({ name: varName, default: varDefault, fieldDesc: varFieldDesc, multiline: varMultiline });
  });

  const snippets = await loadSnippets();

  if (editingId) {
    const idx = snippets.findIndex(s => s.id === editingId);
    if (idx > -1) {
      snippets[idx] = {
        ...snippets[idx],
        name,
        desc: document.getElementById('field-desc').value.trim(),
        code,
        variables
      };
    }
  } else {
    snippets.push({
      id: uid(),
      name,
      desc: document.getElementById('field-desc').value.trim(),
      code,
      variables,
      createdAt: Date.now()
    });
  }

  await saveSnippets(snippets);
  showToast(editingId ? 'Snippet updated!' : 'Snippet saved!');
  setTimeout(() => window.close(), 800);
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (type === 'error' ? 'error' : 'success');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = 'toast hidden', 2500);
}