# ⚡ SnippetRunner — Browser Extension MVP

Store JS snippets with configurable variables and run them in any page's console.

---

## Installation (Chrome / Edge / Brave)

1. Open your browser and go to `chrome://extensions`
2. Enable **Developer Mode** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `snippet-runner/` folder
5. The ⚡ icon appears in your toolbar — pin it for easy access

---

## How to Use

### Creating a Snippet
1. Click the ⚡ icon → hit **＋**
2. Give it a **name** and optional description
3. Add **variables** using the `＋ Add Variable` button
   - Each variable has a **name** and **default value**
4. Write your **code**, using `{{variableName}}` placeholders
5. Hit **Save**

### Example Snippet
```
Name: Set Auth Token
Variable: token  (default: "")
Variable: userId (default: "42")

Code:
  localStorage.setItem('auth_token', '{{token}}');
  localStorage.setItem('user_id', '{{userId}}');
  console.log('Auth set for user', '{{userId}}');
```

### Running a Snippet
1. Navigate to the page you want to run the snippet on
2. Open **SnippetRunner** → click **▶** next to your snippet
3. Fill in the variable values (pre-filled with defaults)
4. Hit **Run in Console**
5. Open DevTools → Console to see the output

---

## File Structure

```
snippet-runner/
├── manifest.json      # Extension manifest (MV3)
├── popup.html         # Extension popup UI
├── popup.css          # Styles
├── popup.js           # All logic (storage, editor, execution)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## How Variables Work

Variables are defined as `{{variableName}}` in your code.
Before execution, all `{{placeholders}}` are replaced with the values you enter in the run modal.

Example:
```js
// Snippet code:
fetch('{{apiUrl}}', {
  headers: { Authorization: 'Bearer {{token}}' }
}).then(r => r.json()).then(console.log);

// After filling in: apiUrl = "https://api.example.com/users", token = "abc123"
// Becomes:
fetch('https://api.example.com/users', {
  headers: { Authorization: 'Bearer abc123' }
}).then(r => r.json()).then(console.log);
```

---

## Permissions Used

| Permission | Why |
|---|---|
| `activeTab` | To target the current page for script injection |
| `scripting` | To inject and execute JS on the page |
| `storage` | To persist your snippets locally |

---

## Roadmap Ideas (post-MVP)
- [ ] Import / Export snippets as JSON
- [ ] Snippet categories / tags
- [ ] Keyboard shortcut to open popup
- [ ] Execution history log
- [ ] Multi-line variable values (for JSON bodies etc.)
- [ ] Duplicate snippet
- [ ] Search/filter snippets
