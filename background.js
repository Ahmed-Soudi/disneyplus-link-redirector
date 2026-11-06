'use strict';
importScripts('resolver-core.js');

const BASE_DEFAULTS = { enabled: true, locale: 'en-gb', unknownAction: 'search', overrides: {}, cached: {} };
const bypassOnce = new Map();
let enabled = true;

chrome.storage.local.get('enabled').then(s => { enabled = s.enabled !== false; });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) enabled = changes.enabled.newValue !== false;
});

chrome.runtime.onInstalled.addListener(async () => {
  const s = await chrome.storage.local.get(Object.keys(BASE_DEFAULTS));
  const missing = {};
  for (const [key, value] of Object.entries(BASE_DEFAULTS)) {
    if (s[key] === undefined) missing[key] = value;
  }
  if (Object.keys(missing).length) await chrome.storage.local.set(missing);
});

// Intercept before the regional site changes URL or returns a generic landing page.
chrome.webNavigation.onBeforeNavigate.addListener(details => {
  if (details.frameId !== 0 || details.tabId < 0 || !enabled) return;
  if (!DisneyLinkCore.parseLegacyUrl(details.url)) return;
  if (bypassOnce.get(details.tabId) === details.url) {
    bypassOnce.delete(details.tabId);
    return;
  }
  const localPage = chrome.runtime.getURL('resolving.html') + '?url=' + encodeURIComponent(details.url);
  chrome.tabs.update(details.tabId, { url: localPage }).catch(() => {});
}, { url: [{ hostSuffix: 'apps.disneyplus.com' }] });

chrome.tabs.onRemoved.addListener(id => bypassOnce.delete(id));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'RESOLVE') {
    resolveLink(message.url)
      .then(sendResponse)
      .catch(err => sendResponse({ kind: 'error', message: String(err.message || err) }));
    return true;
  }
  if (message?.type === 'OPEN_ORIGINAL') {
    const parsed = DisneyLinkCore.parseLegacyUrl(message.url);
    if (!parsed || !sender.tab?.id) { sendResponse({ ok: false }); return; }
    bypassOnce.set(sender.tab.id, parsed.url);
    chrome.tabs.update(sender.tab.id, { url: parsed.url })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});

async function resolveLink(inputUrl) {
  const parsed = DisneyLinkCore.parseLegacyUrl(inputUrl);
  if (!parsed) return { kind: 'error', message: 'Not a supported Disney+ movie or series link.' };
  const opts = { ...BASE_DEFAULTS, ...await chrome.storage.local.get(Object.keys(BASE_DEFAULTS)) };
  if (!opts.enabled) return { kind: 'original', url: parsed.url, title: parsed.title };
  const locale = DisneyLinkCore.normalizeLocale(opts.locale);
  const known = opts.overrides?.[parsed.numericId] ||
    (parsed.numericId === DisneyLinkCore.EXAMPLE_ID ? DisneyLinkCore.EXAMPLE_GUID : null) ||
    opts.cached?.[parsed.numericId];
  if (known && DisneyLinkCore.getTarget(known, locale)) {
    return { kind: 'match', url: DisneyLinkCore.getTarget(known, locale), title: parsed.title, source: opts.overrides?.[parsed.numericId] ? 'your rule' : parsed.numericId === DisneyLinkCore.EXAMPLE_ID ? 'built-in example' : 'saved lookup' };
  }
  // Some regional URLs use '-' rather than a meaningful title slug.
  // Without a title or an explicit mapping, do not guess at a destination.
  if (!parsed.title) return { kind: 'original', url: parsed.url, title: '' };

  let guid = null, source = null;
  try { guid = await tryWikidata(parsed.title); if (guid) source = 'Wikidata'; } catch (e) { console.debug('Wikidata unavailable:', e); }
  if (!guid) {
    try { guid = await tryBingRss(parsed.title); if (guid) source = 'Bing search'; } catch (e) { console.debug('Bing unavailable:', e); }
  }
  if (guid) {
    // Cache only exact-title matches, never search guesses or redirects.
    const latest = await chrome.storage.local.get('cached');
    const cached = latest.cached || {};
    cached[parsed.numericId] = guid;
    await chrome.storage.local.set({ cached });
    return { kind: 'match', url: DisneyLinkCore.getTarget(guid, locale), title: parsed.title, source };
  }
  if (opts.unknownAction === 'original') return { kind: 'original', url: parsed.url, title: parsed.title };
  return { kind: 'search', url: DisneyLinkCore.fallbackSearch(parsed.title), title: parsed.title };
}

async function fetchText(url, timeout = 5500) {
  const controller = new AbortController();
  const stop = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, credentials: 'omit', cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } finally { clearTimeout(stop); }
}

async function tryWikidata(title) {
  const search = new URL('https://www.wikidata.org/w/api.php');
  Object.entries({ action: 'wbsearchentities', format: 'json', language: 'en', uselang: 'en',
    search: title, type: 'item', limit: '15', origin: '*' }).forEach(([k,v]) => search.searchParams.set(k,v));
  const found = JSON.parse(await fetchText(search.href));
  const exact = (found.search || []).filter(item =>
    DisneyLinkCore.comparableTitle(item.label) === DisneyLinkCore.comparableTitle(title) ||
    DisneyLinkCore.comparableTitle(item.match?.text) === DisneyLinkCore.comparableTitle(title));
  if (!exact.length) return null;

  const details = new URL('https://www.wikidata.org/w/api.php');
  Object.entries({ action: 'wbgetentities', format: 'json', ids: exact.map(item => item.id).join('|'),
    props: 'claims|labels', languages: 'en', origin: '*' }).forEach(([k,v]) => details.searchParams.set(k,v));
  const data = JSON.parse(await fetchText(details.href));
  const matches = new Set();
  for (const item of exact) {
    const entity = data.entities?.[item.id];
    if (!entity || DisneyLinkCore.comparableTitle(entity.labels?.en?.value || item.label) !== DisneyLinkCore.comparableTitle(title)) continue;
    for (const claim of (entity.claims?.P13902 || [])) {
      const id = claim.mainsnak?.datavalue?.value;
      if (typeof id === 'string' && /^entity-[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) matches.add(id.slice(7).toLowerCase());
    }
  }
  return matches.size === 1 ? [...matches][0] : null;
}

function unescapeXml(s) {
  return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
      const k = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1),16) : parseInt(n,10);
      return Number.isFinite(k) && k <= 0x10FFFF ? String.fromCodePoint(k) : '';
    })
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&apos;/gi,"'")
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}

async function tryBingRss(title) {
  // Bing RSS provides structured *public search results*. It may be rate-limited or unavailable.
  const queries = [
    'site:disneyplus.com/browse/entity- "' + title + '"',
    'site:disneyplus.com "' + title + '" Disney+'
  ];
  for (const q of queries) {
    const endpoint = 'https://www.bing.com/search?format=rss&q=' + encodeURIComponent(q);
    const xml = await fetchText(endpoint);
    const results = new Set();
    for (const hit of xml.match(/<item>[\s\S]*?<\/item>/gi) || []) {
      const rawTitle = hit.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
      const rawLink = hit.match(/<link>([\s\S]*?)<\/link>/i)?.[1];
      if (!rawTitle || !rawLink || !DisneyLinkCore.matchesSearchResult(unescapeXml(rawTitle), title)) continue;
      const guid = DisneyLinkCore.readResultGuid(unescapeXml(rawLink));
      if (guid) results.add(guid);
    }
    if (results.size === 1) return [...results][0];
    if (results.size > 1) return null; // ambiguous titles: don't guess
  }
  return null;
}
