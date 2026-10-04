# SnippetRunner

A lightweight Chrome extension for storing JavaScript snippets with configurable variables and running them directly in the current page's console.

---

## Features

- **Create and edit snippets** — Save reusable JavaScript snippets with names and descriptions.
- **Configurable variables** — Define `{{variableName}}` placeholders and provide values before execution.
- **Run in the current page** — Execute snippets against the active tab and inspect results in DevTools.
- **Search snippets** — Quickly filter snippets by name or description.
- **Import / export** — Back up selected snippets to JSON and restore them later.
- **Execution history** — Review recent snippet runs.

---

## Installation

### Chrome Web Store (recommended)

<p align="center">
<a href="YOUR_CHROME_WEB_STORE_LINK"><img src="https://github.com/user-attachments/assets/7a829ba4-dcd0-452b-922a-5efacbfda498" alt="Download from Chrome Web Store" height="48" /></a>
</p>

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/RoshanShaikh/snippet-runner
   cd snippet-runner
   ```
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `snippet-runner/` directory.
5. Optionally pin the extension via the puzzle-piece icon in the toolbar.

---

## Usage

1. Open **SnippetRunner** from the browser toolbar.
2. Click **＋** to create a snippet.
3. Add a name, optional description, variables, and JavaScript code.
4. Use `{{variableName}}` placeholders where variable values should be inserted.
5. Click **▶** beside a snippet, fill in its variables, and run it.
6. Use the **⋯** menu beside the add-snippet button to **Import** or **Export** snippets.

### Example

```text
Name: Set Auth Token
Variable: token (default: "")

Code:
  localStorage.setItem('auth_token', '{{token}}');
  console.log('Auth token updated');
```

---

## Technologies

- Chrome Extension Manifest V3
- JavaScript
- HTML
- CSS
- Chrome Storage API
- Chrome Scripting API
