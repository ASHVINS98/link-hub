# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LINK MIND — a Manifest V3 Chrome extension that saves and auto-categorizes bookmarks locally, with a page-injected floating action button (FAB), a toolbar popup, and a full dashboard.

## Build / Run / Test

There is no build step, package manager, bundler, linter, or test suite. The repo is loaded directly as an unpacked extension:

1. `chrome://extensions/` → enable **Developer mode** → **Load unpacked** → select this folder.
2. After editing `background.js` or `manifest.json`, hit **Reload** on the extension card.
3. After editing `content.js`/`content.css`, reload the extension **and** refresh any open tabs (old content scripts stay injected but their extension context becomes invalidated).
4. `popup.html`/`dashboard.html` changes take effect on next open.

Debugging: service worker logs live behind the "service worker" link on the extension card; content script logs appear in the host page's DevTools console; popup logs require right-click → Inspect on the popup.

## Architecture

### Four contexts, one shared script

`shared.js` is a plain classic script (no ESM, no exports) loaded into **three** contexts:
- content script (declared in `manifest.json` before `content.js`)
- `popup.html` (before `popup.js`)
- `dashboard.html` (before `dashboard.js`)

Everything it defines is a global function. **Do not add `import`/`export` to any file** — the manifest declares no `"type": "module"`, and content scripts can't use ESM under this setup. New shared helpers go in `shared.js` and are automatically available in all three UIs; `background.js` does *not* load `shared.js` and must be self-contained.

### Storage is the message bus

There is no central state manager. `chrome.storage.local` holds three keys:

| Key | Shape |
|---|---|
| `links` | `[{ id, url, title, category, starred, addedAt }]` — `id` is `Date.now().toString()`, `url` is always normalized |
| `settings` | `{ theme, customCategories, geminiApiKey }` |
| `fabPosition` | `{ right, bottom }` — CSS px strings for the dragged FAB |

Every UI registers a `chrome.storage.onChanged` listener and re-renders when `links` (or `settings`) changes. That is how a save in the FAB updates the open popup and dashboard, and how async AI re-categorization lands in the UI. When you add a mutation, write through `saveLinks()`/`saveSettings()` — never `chrome.storage.local.set({links})` directly — so the sync path fires.

### URL normalization is the identity key

`normalizeUrl()` in `shared.js` strips `www`-less host casing, trailing slashes, `utm_*`/`fbclid`/`gclid` params, and non-route hashes. Links are **stored** normalized, and dedupe/lookup/"is this page saved?" all compare normalized forms. Any new code that matches a link to a page must go through `normalizeUrl()`.

`getLinks()` is not a pure read: it dedupes by normalized URL and **writes the cleaned list back** when duplicates are found. Expect a storage write (and therefore an `onChanged` event) from a plain read.

### Categories are derived, not stored

`getAllCategories()` returns the union of distinct `link.category` values plus `settings.customCategories`, sorted with `Others` forced last. There is no category table — deleting the last link in a category makes the category vanish unless it was added as a custom category. `DEFAULT_CATEGORIES` in `shared.js` is intentionally empty.

### AI categorization flow

Only `background.js` may talk to the network (`generativelanguage.googleapis.com` is the sole host permission). The flow is fire-and-forget:

`triggerAiClassification(id, url, title)` (shared.js) → `chrome.runtime.sendMessage({action:'classify_link'})` → `classifyLink()` in background.js reads the key from `settings.geminiApiKey` and calls Gemini (`gemini-3.5-flash`, `v1beta:generateContent`) → callback patches `link.category` and `saveLinks()` → `onChanged` re-renders every open UI.

The link is saved immediately with the local `detectCategory()` guess (capitalized hostname); the AI result overwrites it later, or never if no key is configured. The classification prompt (YouTube → `Youtube - <topic>`, Netflix → `Netflix - <genre>`, else domain brand) lives inline in `background.js`.

The message listener returns `true` for `classify_link` to keep the channel open for the async response, and `false` for `open_dashboard`. Preserve that distinction when adding actions.

### Content script constraints

`content.js` is an IIFE guarded by `window.sloContentScriptInjected`. All injected DOM ids and CSS classes use the `slo-` prefix and positioning uses `setProperty(..., 'important')` to survive hostile host-page CSS — keep both conventions for anything new you inject.

It runs on every `http(s)` page and must tolerate **extension context invalidation** (the user reloading the extension orphans already-injected scripts). That's why storage helpers check `chrome.runtime?.id` and every handler is wrapped in try/catch that degrades quietly. Follow this pattern rather than letting exceptions surface on the host page.

SPA navigation (YouTube, Netflix) is detected by a 500ms `setInterval` polling `location.href`, plus `popstate`/`hashchange` — `pushState` gives no event.

## Conventions

- **Theming**: `document.body.className` is `theme-dark` or `theme-light`, driven by `settings.theme`; colors come from CSS custom properties defined under `:root` and `body.theme-light`. The variable block is **duplicated** in `popup.css` and `dashboard.css` — a palette change must be made in both. `content.css` is independent (glassmorphic FAB, always dark).
- **Rendering**: UI is built with template-literal `innerHTML` plus `addEventListener` on the resulting nodes. `dashboard.js` has an `escapeHTML()` helper for user-controlled strings; `popup.js` and `content.js` currently interpolate page titles unescaped — escape any new user/page-derived text you interpolate.
- **Async style**: `shared.js` wraps the callback-based `chrome.storage` API in promises that resolve to safe defaults instead of rejecting. Callers therefore rarely need error handling, but also never see failures — keep new helpers consistent with that contract.
