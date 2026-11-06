'use strict';
const $ = id => document.getElementById(id);

async function loadUI() {
  const opts = await chrome.storage.local.get(['enabled', 'locale', 'unknownAction', 'overrides']);
  $('enabled').checked = opts.enabled !== false;
  $('locale').value = opts.locale || 'en-gb';
  $('unknownAction').value = opts.unknownAction || 'search';
  showMappings(opts.overrides || {});
}

function feedback(str, error = false) {
  $('feedback').textContent = str;
  $('feedback').className = error ? 'error' : 'good';
}

function showMappings(overrides) {
  const list = $('mappingList'); list.replaceChildren();
  const items = Object.entries(overrides).sort((a,b) => a[0].localeCompare(b[0]));
  $('count').textContent = String(items.length + (overrides[DisneyLinkCore.EXAMPLE_ID] ? 0 : 1));
  // Built-in sample is always available, can be replaced with a manual rule.
  const all = items.slice();
  if (!(DisneyLinkCore.EXAMPLE_ID in overrides)) all.unshift([DisneyLinkCore.EXAMPLE_ID, DisneyLinkCore.EXAMPLE_GUID, true]);
  for (const [id, guid, builtIn] of all) {
    const row = document.createElement('div'); row.className = 'mapping';
    const copy = document.createElement('div'); copy.className = 'mapping-info';
    const a = document.createElement('a'); a.textContent = id; a.href = DisneyLinkCore.getTarget(guid, $('locale').value); a.target = '_blank'; a.rel = 'noopener noreferrer';
    const small = document.createElement('small'); small.textContent = builtIn ? 'Built-in example' : 'Custom mapping';
    copy.append(a, small); row.append(copy);
    if (!builtIn) {
      const del = document.createElement('button'); del.className = 'delete'; del.textContent = 'Remove';
      del.addEventListener('click', async () => {
        const data = await chrome.storage.local.get('overrides');
        const updated = data.overrides || {}; delete updated[id];
        await chrome.storage.local.set({ overrides: updated }); showMappings(updated);
      });
      row.append(del);
    }
    list.append(row);
  }
}

$('enabled').addEventListener('change', e => chrome.storage.local.set({ enabled: e.target.checked }));
$('locale').addEventListener('change', async e => {
  await chrome.storage.local.set({ locale: e.target.value });
  const d = await chrome.storage.local.get('overrides'); showMappings(d.overrides || {});
});
$('unknownAction').addEventListener('change', e => chrome.storage.local.set({ unknownAction: e.target.value }));

$('save').addEventListener('click', async () => {
  const src = $('source').value.trim();
  const id = /^\d+$/.test(src) ? src : DisneyLinkCore.parseLegacyUrl(src)?.numericId;
  const guid = DisneyLinkCore.readTargetGuid($('destination').value.trim());
  if (!id) { feedback('Enter a numeric title ID or a supported original movie/show URL.', true); return; }
  if (!guid) { feedback('The new link must be a disneyplus.com/browse/entity-UUID URL.', true); return; }
  const o = await chrome.storage.local.get('overrides');
  const overrides = o.overrides || {}; overrides[id] = guid;
  await chrome.storage.local.set({ overrides });
  $('source').value = ''; $('destination').value = '';
  feedback('Saved. This title will now redirect automatically.');
  showMappings(overrides);
});

$('check').addEventListener('click', () => {
  $('result').textContent = 'Looking up the title…';
  chrome.runtime.sendMessage({ type: 'RESOLVE', url: $('test').value.trim() }, result => {
    if (chrome.runtime.lastError || !result) { $('result').textContent = 'Lookup unavailable.'; return; }
    const box = $('result'); box.replaceChildren();
    if (!result.url) { box.textContent = result.message || 'No matching URL.'; return; }
    const label = document.createElement('span');
    label.textContent = result.kind === 'match' ? 'Exact title match: ' : result.kind === 'search' ? 'No exact match; search: ' : 'Original URL: ';
    const a = document.createElement('a'); a.href = result.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = result.url;
    box.append(label, a);
  });
});

loadUI();
