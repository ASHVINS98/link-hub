# LINK MIND — Smart Link Organizer Chrome Extension

**LINK MIND** is a premium, modern, and privacy-focused Chrome Extension designed to help you save, organize, and auto-categorize your web links locally. Using Google Gemini 3.5 Flash, the extension intelligently auto-classifies saved pages based on their titles and URLs. It features an interactive, page-injected floating action button (FAB), a lightweight action popup, and a comprehensive analytics-driven dashboard.

---

## 🎨 Design System: Classy Obsidian & Ruby Red
LINK MIND features a bespoke, premium dark UI designed to be high-contrast yet elegant:
* **Backgrounds**: Obsidian Black (`#08080a`) and matte charcoal (`#0f0f12`, `#141418`).
* **Highlights & Accents**: Rich ruby red gradient (`#e52b2b` to `#990000`) and glowing drop-shadows.
* **Secondary Elements**: Soft metallic silvers (`#f3f4f6`) and light zinc/gray (`#a1a1aa`) for a clean, premium visual aesthetic.

---

## ✨ Features

### 1. 🤖 AI Auto-Categorization
* Automatically classifies saved bookmarks via the Google Gemini 3.5 Flash API.
* **Custom Classification Rules**:
  * **YouTube Videos**: Categorized as `Youtube - <Video Topic/Creator Content>` (e.g. `Youtube - Coding`).
  * **Streaming Platforms (e.g., Netflix)**: Categorized as `Netflix - <Genre/Category>` (e.g., `Netflix - Action`).
  * **General Sites**: Classified neatly under their domain brand name (e.g., `Github.com`, `Wikipedia.org`).

### 2. 🖲️ Page-Injected Floating Action Button (FAB)
* Seamlessly injected into the bottom right of all active tabs (`content.js`).
* Easily save pages, toggle stars (favorites), categorize, or delete directly without opening the extension.
* Fluid glassmorphic expanding animations on hover.

### 3. 🎫 Compact Action Popup
* Accessible via the extension icon in the toolbar.
* Save the active tab with a single click, choose categories manually, search, and view recently saved pages.

### 4. 📊 Full-Scale Analytics Dashboard
* **Dynamic Sidebar**: Categorized filtering with live count badges.
* **Live Statistics**: Real-time bookmark counts and favorite charts.
* **Search & Filters**: Multi-criteria search by title, URL, or category. Sort links chronologically or alphabetically.
* **Inline Edits**: Rename link titles directly in the folder grid.
* **Data Portability**: Export your bookmarks as a JSON backup or import them back anytime.

---

## 📁 File Structure

```text
├── manifest.json       # Extension configuration & permissions
├── background.js       # Background service worker (Gemini API bridge)
├── content.js          # Injected Floating Action Button (FAB) logic
├── content.css         # Injected FAB styles (Glassmorphism & Red accents)
├── shared.js           # Shared utilities (storage, category detection)
├── popup.html          # Lightweight popup UI
├── popup.js            # Popup logic
├── popup.css           # Popup styles (Obsidian & Ruby Red variables)
├── dashboard.html      # Comprehensive dashboard layout
├── dashboard.js        # Dashboard operations (stats, imports, inline edits)
├── dashboard.css       # Dashboard styles (Obsidian, sidebar, & charts)
└── icons/              # Extension logo icons
```

---

## 🚀 Installation & Setup

### 1. Load the Extension in Chrome
1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the folder containing these project files.

### 2. Configure Gemini Auto-Categorization (Optional)
1. Go to the **LINK MIND Dashboard** (accessible by clicking the dashboard button inside the popup).
2. Locate the **AI Auto-Categorization** section in the sidebar.
3. Input your **Google Gemini API Key** and click save (represented by the checkmark `✓` icon).
4. Newly saved links will now be automatically categorized by Gemini in the background!

---

## 🔒 Privacy & Permissions
* **Storage**: Saved links and settings are stored locally on your machine using `chrome.storage.local`. No bookmark data is sent to external servers except for the Gemini API.
* **ActiveTab**: Allows the extension to read the current page's URL and title for saving.
* **Gemini API**: Sent strictly under secure HTTPS connection only when an API key is configured.

---

## 📄 License
Copyright © 2026 **Ashwani Singh**. Released under the [MIT License](LICENSE).
