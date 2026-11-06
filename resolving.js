'use strict';
const source = new URLSearchParams(location.search).get('url');
const status = document.getElementById('status');

function goOriginal() {
  if (!source) return;
  chrome.runtime.sendMessage({type: 'OPEN_ORIGINAL', url: source}, answer => {
    if (chrome.runtime.lastError || !answer?.ok) status.textContent = 'Could not open original link. Try the extension menu.';
  });
}
document.getElementById('original').addEventListener('click', goOriginal);

if (!source) {
  status.textContent = 'No source URL was provided.';
} else {
  chrome.runtime.sendMessage({ type: 'RESOLVE', url: source }, result => {
    if (chrome.runtime.lastError || !result) { status.textContent = 'Lookup unavailable. You can open the original link.'; return; }
    if (result.kind === 'original') { status.textContent = 'Opening the original link…'; goOriginal(); return; }
    if ((result.kind === 'match' || result.kind === 'search') && result.url) {
      status.textContent = result.kind === 'match' ? 'Found a matching Disney+ title page.' : 'No exact match found. Opening a web search for the title.';
      window.location.replace(result.url);
      return;
    }
    status.textContent = result.message || 'Unable to resolve this link.';
  });
}
