/**
 * Smart Link Organizer - Popup controller script
 */

document.addEventListener('DOMContentLoaded', async () => {
  let currentTab = null;
  let currentLinkState = null;
  let allLinks = [];
  let allCategories = [];

  // DOM Elements
  const currentTitleEl = document.getElementById('current-title');
  const currentUrlEl = document.getElementById('current-url');
  const bookmarkBtn = document.getElementById('bookmark-current-btn');
  const bookmarkBtnText = document.getElementById('bookmark-btn-text');
  const searchInput = document.getElementById('search-input');
  const searchResultsSection = document.getElementById('search-results-section');
  const searchLinksContainer = document.getElementById('search-links-container');
  const linksCountBadge = document.getElementById('links-count');
  const openDashboardBtn = document.getElementById('open-dashboard-btn');

  // Load configuration and data
  await loadPopupData();

  // Get current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs && tabs[0]) {
      currentTab = tabs[0];
      
      // Ignore chrome:// or internal extension pages
      if (currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('chrome-extension://') || currentTab.url.startsWith('about:')) {
        currentTitleEl.textContent = "Cannot save system pages";
        currentUrlEl.textContent = currentTab.url;
        bookmarkBtn.disabled = true;
        return;
      }

      currentTitleEl.textContent = currentTab.title;
      currentUrlEl.textContent = currentTab.url;

      // Check state
      currentLinkState = allLinks.find(l => normalizeUrl(l.url) === normalizeUrl(currentTab.url)) || null;
      updateCurrentTabUI();
    }
  });

  // Load links and setup UI
  async function loadPopupData() {
    allLinks = await getLinks();
    allCategories = await getAllCategories();
    const settings = await getSettings();
    
    // Set theme
    document.body.className = settings.theme === 'light' ? 'theme-light' : 'theme-dark';
  }

  // Update current tab card layout based on state
  function updateCurrentTabUI() {
    if (currentLinkState) {
      // Saved state
      bookmarkBtn.classList.add('active');
      bookmarkBtnText.textContent = "Saved";
    } else {
      // Unsaved state
      bookmarkBtn.classList.remove('active');
      bookmarkBtnText.textContent = "Save Page";
    }
  }

  // Render search results list
  function renderSearchResults(linksToRender) {
    if (linksCountBadge) {
      linksCountBadge.textContent = linksToRender.length;
    }
    searchLinksContainer.innerHTML = '';

    if (linksToRender.length === 0) {
      searchLinksContainer.innerHTML = `<div class="empty-state">No matching links found.</div>`;
      return;
    }

    // Sort by addedAt descending
    const list = [...linksToRender].sort((a, b) => b.addedAt - a.addedAt);

    list.forEach(link => {
      const card = document.createElement('div');
      card.className = 'link-item-card';

      card.innerHTML = `
        <div class="link-item-info">
          <span class="link-title" title="${link.title}">${link.title}</span>
          <div class="link-meta">
            <span class="link-category">${link.category}</span>
          </div>
        </div>
        <div class="link-actions-row">
          <button class="btn-open" title="Open Link">
            <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
          </button>
          <button class="btn-delete" title="Delete">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      `;

      // Handle card click to open link
      card.querySelector('.link-item-info').addEventListener('click', () => {
        window.open(link.url, '_blank');
      });

      card.querySelector('.btn-open').addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(link.url, '_blank');
      });

      card.querySelector('.btn-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        allLinks = allLinks.filter(l => l.id !== link.id);
        await saveLinks(allLinks);
        
        if (currentTab && link.url === currentTab.url) {
          currentLinkState = null;
          updateCurrentTabUI();
        }
        
        // Refresh search view
        triggerSearch();
      });

      searchLinksContainer.appendChild(card);
    });
  }

  // Toggle Save current tab
  bookmarkBtn.addEventListener('click', async () => {
    if (!currentTab) return;

    let isNewSave = false;
    const currentNormUrl = normalizeUrl(currentTab.url);

    if (currentLinkState) {
      // Remove
      allLinks = allLinks.filter(l => normalizeUrl(l.url) !== currentNormUrl);
      currentLinkState = null;
    } else {
      // Save
      const detectedCat = detectCategory(currentTab.url);
      currentLinkState = {
        id: Date.now().toString(),
        url: currentNormUrl,
        title: currentTab.title || 'Untitled Page',
        category: detectedCat,
        starred: false,
        addedAt: Date.now()
      };
      allLinks.push(currentLinkState);
      isNewSave = true;
    }
    await saveLinks(allLinks);
    updateCurrentTabUI();
    
    // Refresh search results if active
    triggerSearch();

    if (isNewSave && currentLinkState) {
      triggerAiClassification(currentLinkState.id, currentLinkState.url, currentLinkState.title);
    }
  });

  // Run filtering on current links list
  function triggerSearch() {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      searchResultsSection.classList.add('hidden');
      searchLinksContainer.innerHTML = '';
      return;
    }

    const filtered = allLinks.filter(l => 
      l.title.toLowerCase().includes(query) || 
      l.url.toLowerCase().includes(query) ||
      l.category.toLowerCase().includes(query)
    );
    
    searchResultsSection.classList.remove('hidden');
    renderSearchResults(filtered);
  }

  // Search input change handler
  searchInput.addEventListener('input', triggerSearch);

  // Open Dashboard
  openDashboardBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'open_dashboard' });
  });

  // Real-time synchronization if changed from background/other content scripts
  chrome.storage.onChanged.addListener(async (changes) => {
    if (changes.links) {
      allLinks = await getLinks();
      if (currentTab) {
        currentLinkState = allLinks.find(l => normalizeUrl(l.url) === normalizeUrl(currentTab.url)) || null;
      }
      updateCurrentTabUI();
      triggerSearch();
    }
  });
});
