chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-search') {
    // Always set the flag first — popup listens via storage.onChanged
    // Using Date.now() so every press is a unique value and triggers the event
    await chrome.storage.session.set({ openInSearchMode: Date.now() });
    // Try to open popup; silently ignore error if it's already open
    try {
      await chrome.action.openPopup();
    } catch (_) {
      // Popup already open — storage change event handles it
    }
  }
});