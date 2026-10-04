# Privacy Policy for SnippetRunner

**Effective date:** October 4, 2026
**Extension:** SnippetRunner (Chrome extension, version 1.0.0)
**Developer:** Roshan Shaikh

SnippetRunner is a Chrome extension that lets you store JavaScript snippets with configurable variables and run them in the page you are viewing. This policy explains what data the extension handles and how.

## Summary

- SnippetRunner **does not collect, transmit, sell, or share** any personal or usage data.
- All data you create (snippets, variables, run history) is stored **locally on your device** in your browser's extension storage.
- SnippetRunner has **no servers, no accounts, no analytics, no advertising, and no tracking**.
- The extension makes **no network requests** of its own.

## Data the extension handles

All of the following stays on your device, in `chrome.storage.local`, and is never sent to the developer or any third party by the extension.

| Data | Purpose | Where it lives |
|---|---|---|
| Snippets you create (name, description, variables and default values, JavaScript code) | To save and re-run your snippets | Local extension storage |
| Variable values you enter when running a snippet | To substitute `{{variable}}` placeholders before execution | Used in memory and recorded as part of the executed code in your run history |
| Execution history (up to the 50 most recent runs): the code that was run, the URL and title of the tab it ran on, timestamp, console output, returned values, and errors | To let you review recent runs and their results | Local extension storage |
| Your most recent run result | To display the results page | Local extension storage |

SnippetRunner does not read the content of web pages on its own. It only interacts with a page when **you** click Run on a snippet, and then only in the tab you are currently using.

## How permissions are used

- **`activeTab`**: Grants temporary access to the tab you are on when you run a snippet, so the snippet can execute there. Access is only used in response to your action.
- **`scripting`**: Used to inject and execute the snippet you chose in the active tab, and to capture its console output, return value, and any errors so they can be shown to you on the results page.
- **`storage`**: Used to save your snippets, settings, and run history locally in your browser.

SnippetRunner does not request host permissions and does not run on any site until you invoke it.

## What your snippets can do

Snippets are code that **you** write or import, and they run with the same access as any script running in the page. A snippet can read page data, modify the page, or make network requests if you write it to do so. That behavior is determined entirely by your code, not by SnippetRunner, and any data a snippet sends elsewhere is outside the control of this extension. Only run snippets you trust and understand, especially ones you import from other people.

Snippet code, variable values, and run history are stored **unencrypted** in your browser profile. Avoid saving passwords, API keys, or other secrets in snippets or variable defaults unless you are comfortable with them being stored locally in this way.

## Import and export

- **Export** creates a JSON file of the snippets you select and saves it to your device through your browser's normal download mechanism. The file is not uploaded anywhere.
- **Import** reads a JSON file that you choose from your device. The file is processed locally.

Exported files are your responsibility once they are saved. If you share them, the people you share them with will be able to read their contents.

## External links

The extension includes links to the project's GitHub page and a feedback form. These open in a new browser tab only when you click them. Those sites are operated by third parties (GitHub and Google Forms) and are governed by their own privacy policies. SnippetRunner does not send any data to them.

## Data sharing and sale

SnippetRunner does not sell, rent, trade, transfer, or otherwise disclose user data to any third party. It does not use data for advertising, creditworthiness, lending, or any purpose unrelated to the extension's single purpose of storing and running your snippets. This extension's use of information complies with the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements.

## Data retention and deletion

Your data stays on your device until you remove it:

- Delete individual snippets from within the extension.
- Clear your execution history from within the extension.
- Uninstalling SnippetRunner removes all of its stored data from your browser.

Because the developer never receives your data, there is nothing to request or delete on our side.

## Children's privacy

SnippetRunner is a developer tool and is not directed at children under 13. It does not knowingly collect personal information from anyone.

## Changes to this policy

If this policy changes, the updated version will be published at the same location with a revised effective date. Material changes, such as any change to what data is collected or how it is used, will be reflected here before they take effect.

## Contact

Questions about this policy can be sent through:

- GitHub: https://github.com/RoshanShaikh/snippet-runner/issues
- Feedback form: https://forms.gle/hpnJCDxk6obQkLVi8