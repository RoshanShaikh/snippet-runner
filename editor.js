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

  document.getElementById('btn-save').addEventListener('click', saveEditor);
  document.getElementById('btn-cancel').addEventListener('click', () => window.close());
  document.getElementById('btn-add-var').addEventListener('click', () => addVarRow());

  // Sync variable name hints into code textarea as user types
  document.getElementById('variables-list').addEventListener('input', updateVarHints);
});

// ─── Populate form when editing ────────────────────────────────────────────────

function populateForm(snippet) {
  document.getElementById('field-name').value = snippet.name  || '';
  document.getElementById('field-desc').value = snippet.desc  || '';
  document.getElementById('field-code').value = snippet.code  || '';
  (snippet.variables || []).forEach(v => addVarRow(v.name, v.default));
}

// ─── Variable rows ─────────────────────────────────────────────────────────────

function addVarRow(name = '', defaultVal = '') {
  const hint = document.querySelector('.vars-empty-hint');
  if (hint) hint.remove();

  const row = document.createElement('div');
  row.className = 'var-row';
  row.innerHTML = `
    <div class="var-row-inner">
      <div class="var-field">
        <span class="var-field-label">Name</span>
        <input class="var-name" type="text" placeholder="tokenName" value="${escapeHtml(name)}" autocomplete="off"/>
      </div>
      <span class="var-eq">=</span>
      <div class="var-field">
        <span class="var-field-label">Default value</span>
        <input class="var-default" type="text" placeholder="(empty)" value="${escapeHtml(defaultVal)}" autocomplete="off"/>
      </div>
      <button class="btn-remove-var" title="Remove variable">✕</button>
    </div>
    <div class="var-usage-hint"></div>
  `;
  row.querySelector('.btn-remove-var').addEventListener('click', () => {
    row.remove();
    if (!document.querySelector('.var-row')) {
      const list = document.getElementById('variables-list');
      list.innerHTML = '<p class="vars-empty-hint">No variables yet. Add one to use <code>{{placeholders}}</code> in your code.</p>';
    }
  });
  row.querySelector('.var-name').addEventListener('input', updateVarHints);
  document.getElementById('variables-list').appendChild(row);
  updateVarHints();
}

function updateVarHints() {
  document.querySelectorAll('.var-row').forEach(row => {
    const name = row.querySelector('.var-name').value.trim();
    const hint = row.querySelector('.var-usage-hint');
    hint.textContent = name ? `Use {{${name}}} in your code` : '';
  });
}

// ─── Save ──────────────────────────────────────────────────────────────────────

async function saveEditor() {
  const name = document.getElementById('field-name').value.trim();
  const code = document.getElementById('field-code').value.trim();

  if (!name) { showToast('Name is required', 'error'); return; }
  if (!code) { showToast('Code is required', 'error'); return; }

  const variables = [];
  document.querySelectorAll('.var-row').forEach(row => {
    const varName = row.querySelector('.var-name').value.trim();
    const varDefault = row.querySelector('.var-default').value;
    if (varName) variables.push({ name: varName, default: varDefault });
  });

  const snippets = await loadSnippets();

  if (editingId) {
    const idx = snippets.findIndex(s => s.id === editingId);
    if (idx > -1) {
      snippets[idx] = { ...snippets[idx], name, desc: document.getElementById('field-desc').value.trim(), code, variables };
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