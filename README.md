# Disney+ Legacy Link Redirector

**Fix outdated Disney+ links still appearing in search engines.** This free Chrome extension redirects legacy regional Disney+ movie and series links to the corresponding **official Disney+ title pages** when a reliable match is available.

Search engines (including Google and Bing) can continue to show older `apps.disneyplus.com` URLs even after Disney+ has moved titles to its newer `disneyplus.com/.../browse/entity-...` URL format. Clicking such results can open an outdated page instead of the movie or show you were looking for. This extension is a link-compatibility and convenience tool to address that problem.

## Example

Old search-result URL:

```text
https://www.apps.disneyplus.com/eg/movies/hannah-montana-the-movie/1260018296?utm_source=gwa
```

Official newer title page:

```text
https://www.disneyplus.com/en-gb/browse/entity-b6c11c9e-bda2-4346-a7df-f7e2a75d5e18
```

## Not a piracy tool

**This extension does not facilitate piracy.** It only helps visitors reach Disney+'s own official title pages.

- It **does not** host, stream, download, copy, or distribute movies or TV shows.
- It **does not** provide free access, cracked accounts, DRM circumvention, or unofficial streaming sources.
- It **does not** bypass paywalls, Disney+ subscriptions, authentication, geo-restrictions, or regional availability.
- Viewing a title still requires whatever valid Disney+ subscription, location eligibility, and access rights Disney+ normally requires.

This is an independent, unofficial project and is **not affiliated with, endorsed by, or operated by Disney** or Disney+.

## Installation

1. Download the repository using **Code → Download ZIP**, or clone it.
2. Extract the ZIP, keeping all files and the `icons` folder together.
3. In Chrome, open `chrome://extensions`, and turn on **Developer mode**.
4. Click **Load unpacked** and choose the folder containing `manifest.json`.
5. Open a legacy Disney+ title link. The extension tries to take you to the corresponding official title page.

## Supported links

Title-level movie and show links on regional `apps.disneyplus.com` sites, for example:

- `https://www.apps.disneyplus.com/eg/movies/some-movie/1234567890`
- `https://www.apps.disneyplus.com/ae/shows/some-show/1271342309`
- `https://apps.disneyplus.com/my/series/some-show/1234567890`

It deliberately does not rewrite watch-page, episode, homepage, or search URLs.

## How matching works

1. User-saved mappings take priority.
2. A verified Hannah Montana: The Movie mapping is included as an example.
3. Previously resolved exact-title mappings are cached locally.
4. The extension looks for a matching Disney+ browse ID in **Wikidata**.
5. It can check public **Bing** search results for exact matching official Disney+ title pages.
6. If no sufficiently reliable match exists, it opens a title-specific **Google** search (default) or keeps the old link, depending on your setting.

Regional numeric catalog IDs are **not** mathematically interchangeable with Disney+'s newer UUID-based IDs; the extension does not fabricate conversions or guess when titles are ambiguous.

## Options

Click the extension icon to:

- Enable or disable redirects.
- Choose a destination locale (default: `en-gb`).
- Choose what to do if no exact match is found.
- Add or remove your own mappings from old Disney+ links to official `browse/entity-...` title pages.
- Test a link to see its proposed destination.

## Privacy and security

- Settings and saved mappings are kept locally in `chrome.storage.local`.
- When a title needs identification, its name may be sent to **Wikidata** or **Bing** as a lookup; the optional fallback opens a Google search.
- The extension does not send Disney+ cookies or account credentials to these lookup services and does not rely on any developer-operated server.
- Automatically resolved destinations and manual mappings are restricted to official `disneyplus.com` title-page URLs.
- A newer title page being found does not imply the content is playable in your country or subscription.

## Testing

Run `node test.js` from the repository directory. The test suite covers link parsing, matching, custom mappings, fallbacks, and navigation interception.

## Technical notes

Built with Chrome **Manifest V3**, `webNavigation`, `chrome.storage.local`, a service worker, and an extension-owned temporary resolving page. No external JavaScript code is loaded.