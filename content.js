/**
 * Smart Link Organizer - Content Script
 * Injected on web pages to provide the Floating Action Button (FAB).
 */

(function () {
  // Prevent duplicate injection
  if (window.sloContentScriptInjected) return;
  window.sloContentScriptInjected = true;

  let currentLinkState = null; // null if not saved, otherwise Link object
  let allCategories = [];
  let isDragging = false;
  let dragStartX, dragStartY;
  let buttonStartX, buttonStartY;
  let dragTimer = null;
  let isReadyToDrag = false;

  // DOM Elements
  let container, mainBtn, menu, categorySelector, toastEl;

  // Icons SVG map
  const ICONS = {
    main: `<svg class="slo-icon" viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`,
    star: `<svg class="slo-icon" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`,
    bookmark: `<svg class="slo-icon" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>`,
    category: `<svg class="slo-icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
    dashboard: `<svg class="slo-icon" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>`,
    delete: `<svg class="slo-icon" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
    success: `<svg class="slo-toast-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`
  };

  // Initialize content script
  init();

  async function init() {
    // Read state from storage
    await refreshState();

    // Create & Inject FAB UI
    injectUI();

    // Setup drag positioning
    setupDraggability();

    // Setup click handlers
    setupEventHandlers();

    // Listen for storage changes to stay in sync
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.links) {
        refreshState().then(() => updateUIState());
      }
    });

    // Detect URL changes (e.g. for SPAs like YouTube/Netflix)
    setupUrlChangeDetection();
  }

  function setupUrlChangeDetection() {
    let lastUrl = window.location.href;

    async function handleUrlChange() {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        await refreshState();
        updateUIState();
      }
    }

    // Listen to standard events
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    // Periodically poll for pushState/replaceState changes
    setInterval(handleUrlChange, 500);
  }

  // Fetch state from chrome.storage
  // Fetch state from chrome.storage
  async function refreshState() {
    currentLinkState = null;
    try {
      const links = await getLinks();
      const currentNormUrl = normalizeUrl(window.location.href);
      currentLinkState = links.find(l => normalizeUrl(l.url) === currentNormUrl) || null;
      allCategories = await getAllCategories();
    } catch (e) {
      console.warn("LNKAI: Failed to refresh state due to context invalidation:", e);
    }
  }

  // Inject HTML Elements
  function injectUI() {
    container = document.createElement('div');
    container.id = 'slo-fab-container';
    container.className = 'slo-reset';

    // Inject SVG and content
    container.innerHTML = `
      <button id="slo-fab-main" class="slo-fab-btn slo-main-btn">
        ${ICONS.main}
      </button>
      <div id="slo-fab-menu">
        <button id="slo-fab-save" class="slo-fab-btn slo-sub-btn" title="Save/Bookmark page">
          ${ICONS.bookmark}
        </button>
        <button id="slo-fab-dashboard" class="slo-fab-btn slo-sub-btn" title="Open Dashboard">
          ${ICONS.dashboard}
        </button>
        <button id="slo-fab-delete" class="slo-fab-btn slo-sub-btn" title="Remove page">
          ${ICONS.delete}
        </button>
      </div>
    `;

    document.body.appendChild(container);

    mainBtn = document.getElementById('slo-fab-main');
    menu = document.getElementById('slo-fab-menu');

    // Create Toast Container
    toastEl = document.createElement('div');
    toastEl.className = 'slo-toast';
    document.body.appendChild(toastEl);

    // Apply saved coordinates if any
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['fabPosition'], (result) => {
          if (result && result.fabPosition) {
            container.style.setProperty('bottom', result.fabPosition.bottom, 'important');
            container.style.setProperty('right', result.fabPosition.right, 'important');
          }
        });
      }
    } catch (e) {
      console.warn("LNKAI: Failed to read fabPosition:", e);
    }

    updateUIState();
  }

  // Update FAB styles based on link saved state
  function updateUIState() {
    const saveBtn = document.getElementById('slo-fab-save');
    const deleteBtn = document.getElementById('slo-fab-delete');

    if (!saveBtn || !deleteBtn) return;

    if (currentLinkState) {
      mainBtn.classList.add('slo-active');
      saveBtn.classList.add('slo-active');
      saveBtn.title = "Saved (Click to remove)";
      deleteBtn.style.display = 'flex';
    } else {
      mainBtn.classList.remove('slo-active');
      saveBtn.classList.remove('slo-active');
      saveBtn.title = "Bookmark page";
      deleteBtn.style.display = 'none';
    }
  }

  // Toast message utility
  function showToast(message, isSuccess = true) {
    if (!toastEl) return;
    toastEl.innerHTML = `${ICONS.success} <span>${message}</span>`;
    toastEl.classList.add('slo-show');
    setTimeout(() => {
      if (toastEl) toastEl.classList.remove('slo-show');
    }, 2500);
  }

  // Enable dragging
  function setupDraggability() {
    mainBtn.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', dragEnd);

    // Mobile / Touch support
    mainBtn.addEventListener('touchstart', (e) => dragStart(e.touches[0]));
    document.addEventListener('touchmove', (e) => dragMove(e.touches[0]));
    document.addEventListener('touchend', dragEnd);
  }

  function dragStart(e) {
    isDragging = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const style = window.getComputedStyle(container);
    buttonStartX = parseInt(style.right, 10);
    buttonStartY = parseInt(style.bottom, 10);
    
    mainBtn.style.cursor = 'move';
    container.classList.add('slo-dragging');
  }

  function dragMove(e) {
    if (dragStartX === undefined) return;

    const deltaX = dragStartX - e.clientX;
    const deltaY = dragStartY - e.clientY;

    // Start dragging immediately if moved slightly (more than 2px)
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      isDragging = true;
      
      // Calculate new position
      const newRight = buttonStartX + deltaX;
      const newBottom = buttonStartY + deltaY;

      // Limit positions within the viewport
      const maxRight = window.innerWidth - 60;
      const maxBottom = window.innerHeight - 60;

      container.style.setProperty('right', `${Math.max(10, Math.min(newRight, maxRight))}px`, 'important');
      container.style.setProperty('bottom', `${Math.max(10, Math.min(newBottom, maxBottom))}px`, 'important');
    }
  }

  function dragEnd() {
    mainBtn.style.cursor = '';
    container.classList.remove('slo-dragging');

    if (dragStartX === undefined) return;

    if (isDragging) {
      // Save position in local storage
      chrome.storage.local.set({
        fabPosition: {
          right: container.style.right,
          bottom: container.style.bottom
        }
      });
    }

    dragStartX = undefined;
    dragStartY = undefined;
  }

  // Setup click handlers
  function setupEventHandlers() {
    // Save Action
    const saveBtn = document.getElementById('slo-fab-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', toggleSave);
    }

    // Dashboard Action
    const dashboardBtn = document.getElementById('slo-fab-dashboard');
    if (dashboardBtn) {
      dashboardBtn.addEventListener('click', () => {
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({ action: "open_dashboard" });
          }
        } catch (e) {
          console.warn("LNKAI: Failed to open dashboard due to context invalidation:", e);
        }
      });
    }

    // Delete Action
    const deleteBtn = document.getElementById('slo-fab-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', deleteLink);
    }
  }

  // Action: Bookmark / Toggle Save
  async function toggleSave() {
    try {
      const links = await getLinks();
      const currentNormUrl = normalizeUrl(window.location.href);

      if (currentLinkState) {
        // Remove
        const updatedLinks = links.filter(l => normalizeUrl(l.url) !== currentNormUrl);
        await saveLinks(updatedLinks);
        currentLinkState = null;
        showToast("Link removed");
      } else {
        // Check if it already exists (duplicate protection)
        const exists = links.some(l => normalizeUrl(l.url) === currentNormUrl);
        if (exists) {
          showToast("Already Saved", false);
          return;
        }

        // Add
        const newLink = {
          id: Date.now().toString(),
          url: currentNormUrl,
          title: document.title || 'Untitled Link',
          category: detectCategory(window.location.href),
          starred: false,
          addedAt: Date.now()
        };
        links.push(newLink);
        await saveLinks(links);
        currentLinkState = newLink;
        showToast(`Saved to ${newLink.category}!`);
        triggerAiClassification(newLink.id, newLink.url, newLink.title);
      }
      updateUIState();
    } catch (e) {
      console.warn("LNKAI: Failed to toggle save:", e);
    }
  }

  // Action: Delete/Remove Link
  async function deleteLink() {
    try {
      if (!currentLinkState) return;
      const links = await getLinks();
      const currentNormUrl = normalizeUrl(window.location.href);
      const updatedLinks = links.filter(l => normalizeUrl(l.url) !== currentNormUrl);
      await saveLinks(updatedLinks);
      currentLinkState = null;
      showToast("Link removed");
      updateUIState();
    } catch (e) {
      console.warn("LNKAI: Failed to delete link:", e);
    }
  }
})();
