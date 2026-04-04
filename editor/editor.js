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

function syncVarsFromCode(existingVars = []) {
  const code  = document.getElementById('field-code').value;
  const names = extractVarNames(code);
  const list  = document.getElementById('variables-list');

  // Preserve existing values across re-syncs
  const current = {};
  list.querySelectorAll('tr[data-var-name]').forEach(row => {
    const n = row.dataset.varName;
    current[n] = {
      default: row.querySelector('.var-default')?.value ?? '',
      fieldDesc: row.querySelector('.var-field-desc')?.value ?? ''
    };
  });
  existingVars.forEach(v => {
    if (!(v.name in current)) {
      current[v.name] = { default: v.default || '', fieldDesc: v.fieldDesc || '' };
    }
  });

  list.innerHTML = '';

  if (names.length === 0) {
    list.innerHTML = `<p class="vars-empty-hint">
      Use <code>{{variableName}}</code> placeholders in your code — variables appear here automatically.
    </p>`;
    return;
  }

  const banner = document.createElement('p');
  banner.className = 'vars-description';
  banner.innerHTML = `Each <code>{{placeholder}}</code> is replaced with its value at run time. Set defaults and descriptions — they appear in the run modal to guide input.`;
  list.appendChild(banner);

  const table = document.createElement('table');
  table.className = 'vars-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Placeholder</th>
        <th>Default JS value</th>
        <th>Description / type hint</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  names.forEach(name => {
    const saved = current[name] ?? { default: '', fieldDesc: '' };
    const tr = document.createElement('tr');
    tr.dataset.varName = name;
    tr.innerHTML = `
      <td class="var-name-cell"><code>{{${escapeHtml(name)}}}</code></td>
      <td><input class="var-default var-default-input" type="text"
        placeholder="e.g. 'hello', 42, true"
        value="${escapeHtml(saved.default)}" autocomplete="off" spellcheck="false"/></td>
      <td><input class="var-field-desc var-default-input" type="text"
        placeholder="e.g. Auth token (string)"
        value="${escapeHtml(saved.fieldDesc)}" autocomplete="off" spellcheck="false"/></td>
    `;
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
    const varName     = row.dataset.varName;
    const varDefault  = row.querySelector('.var-default')?.value || '';
    const varFieldDesc = row.querySelector('.var-field-desc')?.value || '';
    if (varName) variables.push({ name: varName, default: varDefault, fieldDesc: varFieldDesc });
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