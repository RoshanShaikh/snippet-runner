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

  // Detect variables live as user types code
  document.getElementById('field-code').addEventListener('input', () => syncVarsFromCode());

  document.getElementById('btn-save').addEventListener('click', saveEditor);
  document.getElementById('btn-cancel').addEventListener('click', () => window.close());
});

// ─── Populate form when editing ────────────────────────────────────────────────

function populateForm(snippet) {
  document.getElementById('field-name').value = snippet.name || '';
  document.getElementById('field-desc').value = snippet.desc || '';
  document.getElementById('field-code').value = snippet.code || '';
  // Sync from code first, then restore saved default values
  syncVarsFromCode(snippet.variables || []);
}

// ─── Auto-detect variables from {{placeholders}} in code ──────────────────────

function extractVarNames(code) {
  const matches = [...code.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)];
  // Deduplicate while preserving order of first appearance
  const seen = new Set();
  return matches.map(m => m[1]).filter(name => seen.has(name) ? false : seen.add(name));
}

function syncVarsFromCode(existingVars = []) {
  const code     = document.getElementById('field-code').value;
  const names    = extractVarNames(code);
  const list     = document.getElementById('variables-list');

  // Collect current default values keyed by name so we don't lose them on re-sync
  const currentDefaults = {};
  list.querySelectorAll('[data-var-name]').forEach(row => {
    const n = row.dataset.varName;
    const d = row.querySelector('.var-default')?.value;
    if (n && d !== undefined) currentDefaults[n] = d;
  });

  // Also pull in defaults passed from saved snippet (for initial load)
  existingVars.forEach(v => {
    if (!(v.name in currentDefaults)) currentDefaults[v.name] = v.default || '';
  });

  list.innerHTML = '';

  if (names.length === 0) {
    list.innerHTML = `<p class="vars-empty-hint">
      Use <code>{{variableName}}</code> placeholders in your code — variables appear here automatically.
    </p>`;
    return;
  }

  // Description banner
  const desc = document.createElement('p');
  desc.className = 'vars-description';
  desc.innerHTML = `Each <code>{{placeholder}}</code> is replaced with its JavaScript value at run time. You can set a default here — it will be pre-filled when you run the snippet and can be overridden then.`;
  list.appendChild(desc);

  // Table
  const table = document.createElement('table');
  table.className = 'vars-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Placeholder</th>
        <th>Default JS value</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  names.forEach(name => {
    const defaultVal = currentDefaults[name] ?? '';
    const tr = document.createElement('tr');
    tr.dataset.varName = name;
    tr.innerHTML = `
      <td class="var-name-cell"><code>{{${escapeHtml(name)}}}</code></td>
      <td><input class="var-default var-default-input" type="text"
        placeholder="e.g. 'hello', 42, true, null"
        value="${escapeHtml(defaultVal)}" autocomplete="off" spellcheck="false"/></td>
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

  // Build variables from detected table rows
  const variables = [];
  document.querySelectorAll('.vars-table tbody tr[data-var-name]').forEach(row => {
    const varName    = row.dataset.varName;
    const varDefault = row.querySelector('.var-default').value;
    if (varName) variables.push({ name: varName, default: varDefault });
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