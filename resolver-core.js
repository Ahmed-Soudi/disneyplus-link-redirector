'use strict';

// MENA / Hotstar links use numeric IDs; global Disney+ uses GUIDs.
// There is no mathematical conversion between the two ID namespaces.
const DisneyLinkCore = (() => {
  const EXAMPLE_ID = '1260018296';
  const EXAMPLE_GUID = 'b6c11c9e-bda2-4346-a7df-f7e2a75d5e18';
  const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const targetRe = new RegExp('^/(?:[a-z]{2}(?:-[a-z]{2})?/)?browse/entity-(' + UUID + ')/?$', 'i');
  const resultRe = new RegExp('^/(?:[a-z]{2}(?:-[a-z]{2})?/)?(?:browse/entity-|whats-on/entity-)(' + UUID + ')/?$', 'i');

  function parseLegacyUrl(input) {
    try {
      const u = new URL(input);
      if (u.protocol !== 'https:' || !/^(?:www\.)?apps\.disneyplus\.com$/i.test(u.hostname)) return null;
      const m = u.pathname.match(/^\/([a-z]{2})\/(movies|shows|series)\/([^/]+)\/(\d+)\/?$/i);
      if (!m) return null;
      const slug = decodeURIComponent(m[3]);
      return { url: u.href, country: m[1].toLowerCase(), type: m[2].toLowerCase(), slug, numericId: m[4], title: titleFromSlug(slug) };
    } catch (_) { return null; }
  }

  function titleFromSlug(slug) {
    return slug.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function comparableTitle(input) {
    return (input || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/&amp;/g, '&').replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }

  function normalizeLocale(input) {
    const val = String(input || '').toLowerCase().trim();
    return /^[a-z]{2}-[a-z]{2}$/.test(val) ? val : 'en-gb';
  }

  function getTarget(id, locale = 'en-gb') {
    if (!new RegExp('^' + UUID + '$', 'i').test(id)) return null;
    return 'https://www.disneyplus.com/' + normalizeLocale(locale) + '/browse/entity-' + id.toLowerCase();
  }

  function readTargetGuid(url) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' || !/^(?:www\.)?disneyplus\.com$/i.test(u.hostname)) return null;
      return u.pathname.match(targetRe)?.[1]?.toLowerCase() || null;
    } catch (_) { return null; }
  }

  function readResultGuid(url) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' || !/^(?:www\.)?disneyplus\.com$/i.test(u.hostname)) return null;
      return u.pathname.match(resultRe)?.[1]?.toLowerCase() || null;
    } catch (_) { return null; }
  }

  function matchesSearchResult(title, searchTitle) {
    const s = comparableTitle(searchTitle);
    const cleaned = String(title || '').replace(/^\s*(?:watch|stream|view)\s+/i, '')
      .split(/\s+[|–—]\s+disney\s*\+?/i)[0]
      .replace(/\s+(?:on|at)\s+disney\s*\+.*$/i, '')
      .replace(/\s*\(\d{4}\)\s*$/, '').trim();
    return s.length > 1 && comparableTitle(cleaned) === s;
  }

  function fallbackSearch(title) {
    const q = 'site:disneyplus.com/browse/entity- "' + title + '"';
    return 'https://www.google.com/search?q=' + encodeURIComponent(q);
  }

  return { EXAMPLE_ID, EXAMPLE_GUID, parseLegacyUrl, titleFromSlug, comparableTitle,
    normalizeLocale, getTarget, readTargetGuid, readResultGuid, matchesSearchResult, fallbackSearch };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DisneyLinkCore;
