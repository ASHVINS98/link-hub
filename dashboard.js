/**
 * Smart Link Organizer - Dashboard Controller Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Application State
  let links = [];
  let categories = [];
  let settings = {};
  let activeCategoryFilter = null; // null means 'All'
  let collapsedFolders = {}; // Track which category folders are collapsed

  // DOM Elements
  const categoryFilterList = document.getElementById('category-filter-list');
  const newCategoryInput = document.getElementById('new-category-input');
  const addCategoryBtn = document.getElementById('add-category-btn');
  
  const statTotal = document.getElementById('stat-total');
  const statFavorites = document.getElementById('stat-favorites');
  const statChartContainer = document.getElementById('stat-chart-container');
  
  const themeToggle = document.getElementById('theme-toggle');
  const exportBtn = document.getElementById('export-btn');
  const importBtnTrigger = document.getElementById('import-btn-trigger');
  const importFileInput = document.getElementById('import-file-input');
  const clearAllBtn = document.getElementById('clear-all-btn');
  
  const dashboardSearch = document.getElementById('dashboard-search');
  const dashboardSort = document.getElementById('dashboard-sort');
  const foldersContainer = document.getElementById('folders-container');
  
  const activeFiltersBar = document.getElementById('active-filters-bar');
  const activeFilterName = document.getElementById('active-filter-name');
  const clearCategoryFilterBtn = document.getElementById('clear-category-filter-btn');

  // AI DOM Elements
  const geminiApiKeyInput = document.getElementById('gemini-api-key-input');
  const saveApiKeyBtn = document.getElementById('save-api-key-btn');
  const aiStatusText = document.getElementById('ai-status-text');

  // Modal Dialog Elements
  const modalContainer = document.getElementById('modal-container');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');

  let modalCallback = null;

  // Initialize
  await initDashboard();

   async function initDashboard() {
    await loadData();
    setupTheme();
    setupEventListeners();
    updateAiStatusUI();
    renderDashboard();
  }

  // Update AI Status UI based on saved key
  function updateAiStatusUI() {
    if (settings && settings.geminiApiKey) {
      geminiApiKeyInput.value = settings.geminiApiKey;
      aiStatusText.textContent = "AI Auto-Categorization is active.";
      aiStatusText.style.color = "var(--success-color)";
    } else {
      geminiApiKeyInput.value = "";
      aiStatusText.textContent = "AI Categorization is disabled. Enter API Key above.";
      aiStatusText.style.color = "var(--text-muted)";
    }
  }

  // Load state from local storage
  async function loadData() {
    links = await getLinks();
    categories = await getAllCategories();
    settings = await getSettings();
  }

  // Setup theme styling on page load
  function setupTheme() {
    const theme = settings.theme || 'dark';
    document.body.className = theme === 'light' ? 'theme-light' : 'theme-dark';
    themeToggle.checked = theme === 'dark';
  }

  // Set up event interactions
  function setupEventListeners() {
    // Theme toggle handler
    themeToggle.addEventListener('change', async (e) => {
      const isDark = e.target.checked;
      settings.theme = isDark ? 'dark' : 'light';
      await saveSettings(settings);
      document.body.className = isDark ? 'theme-dark' : 'theme-light';
      showToast(`Switched to ${isDark ? 'Dark' : 'Light'} Mode`);
    });

    // Add new custom category
    addCategoryBtn.addEventListener('click', addNewCategory);
    newCategoryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addNewCategory();
    });

    // Search bar handler
    dashboardSearch.addEventListener('input', () => {
      renderDashboardContents();
    });

    // Sort order dropdown
    dashboardSort.addEventListener('change', () => {
      renderDashboardContents();
    });

    // Clear active category filter tag
    clearCategoryFilterBtn.addEventListener('click', () => {
      activeCategoryFilter = null;
      renderDashboard();
    });

    // Export button handler
    exportBtn.addEventListener('click', exportBackup);

    // Import triggers
    importBtnTrigger.addEventListener('click', () => {
      importFileInput.click();
    });
    importFileInput.addEventListener('change', importBackup);

    // Clear all button handler
    clearAllBtn.addEventListener('click', () => {
      showModal(
        "Clear All Saved Data?",
        "This will permanently erase all saved links, tags, and custom categories. This action cannot be undone.",
        async () => {
          await chrome.storage.local.clear();
          showToast("All data successfully cleared.");
          // Reset default storage values
          await loadData();
          setupTheme();
          renderDashboard();
        }
      );
    });

    // Modal actions
    modalCancelBtn.addEventListener('click', closeModal);
    modalConfirmBtn.addEventListener('click', () => {
      if (modalCallback) modalCallback();
      closeModal();
    });

    // Save API key handler
    saveApiKeyBtn.addEventListener('click', async () => {
      const newKey = geminiApiKeyInput.value.trim();
      settings.geminiApiKey = newKey;
      await saveSettings(settings);
      updateAiStatusUI();
      if (newKey) {
        showToast("Gemini API Key saved successfully.");
      } else {
        showToast("Gemini API Key removed. AI categorization disabled.");
      }
    });

    // Handle Enter key in API key input
    geminiApiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveApiKeyBtn.click();
      }
    });

    // Sync dashboard on remote chrome storage changes
    chrome.storage.onChanged.addListener(async (changes) => {
      // Avoid loops by reading state and selectively updating UI if data updates
      if (changes.links || changes.settings) {
        await loadData();
        updateAiStatusUI();
        renderDashboard();
      }
    });
  }

  // Render the entire dashboard UI
  function renderDashboard() {
    renderSidebar();
    renderDashboardContents();
  }

  // Sidebar controls render (Categories filter list, stats)
  function renderSidebar() {
    // 1. Sidebar Categories list
    categoryFilterList.innerHTML = '';
    
    // Add "All" Category Filter first
    const allItem = document.createElement('div');
    allItem.className = `category-filter-item ${activeCategoryFilter === null ? 'active' : ''}`;
    allItem.innerHTML = `
      <div class="filter-name-wrapper">
        <svg class="filter-icon" viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0-2-.9-2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
        <span>All Links</span>
      </div>
      <span class="filter-count">${links.length}</span>
    `;
    allItem.addEventListener('click', () => {
      activeCategoryFilter = null;
      renderDashboard();
    });
    categoryFilterList.appendChild(allItem);

    // Dynamic list
    categories.forEach(cat => {
      const count = links.filter(l => l.category === cat).length;
      const item = document.createElement('div');
      item.className = `category-filter-item ${activeCategoryFilter === cat ? 'active' : ''}`;
      
      const folderIcon = `
        <svg class="filter-icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
      `;

      item.innerHTML = `
        <div class="filter-name-wrapper">
          ${folderIcon}
          <span>${cat}</span>
        </div>
        <span class="filter-count">${count}</span>
      `;
      item.addEventListener('click', () => {
        activeCategoryFilter = cat;
        renderDashboard();
      });
      categoryFilterList.appendChild(item);
    });

    // 2. Statistics Rendering
    statTotal.textContent = links.length;
    statFavorites.textContent = links.filter(l => l.starred).length;

    // Stat chart breakdown
    statChartContainer.innerHTML = '';
    
    // Sort categories by link counts descending
    const catStats = categories.map(cat => ({
      name: cat,
      count: links.filter(l => l.category === cat).length
    }))
    .filter(stat => stat.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4); // Display top 4 categories in stats chart

    if (catStats.length === 0) {
      statChartContainer.innerHTML = `<span style="font-size: 11px; color: var(--text-muted); text-align: center;">No stats to display.</span>`;
    } else {
      catStats.forEach(stat => {
        const percentage = links.length > 0 ? Math.round((stat.count / links.length) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'chart-bar-row';
        row.innerHTML = `
          <div class="chart-bar-info">
            <span>${stat.name}</span>
            <span>${stat.count} (${percentage}%)</span>
          </div>
          <div class="chart-bar-outer">
            <div class="chart-bar-inner" style="width: ${percentage}%"></div>
          </div>
        `;
        statChartContainer.appendChild(row);
      });
    }
  }

  // Render Category Folders and Nested Links
  function renderDashboardContents() {
    const searchQuery = dashboardSearch.value.toLowerCase().trim();
    const sortOrder = dashboardSort.value;

    // Toggle Category Filter Bar
    if (activeCategoryFilter) {
      activeFiltersBar.classList.remove('hidden');
      activeFilterName.textContent = activeCategoryFilter;
    } else {
      activeFiltersBar.classList.add('hidden');
    }

    foldersContainer.innerHTML = '';

    // Filter categories to display
    let categoriesToDisplay = categories;
    if (activeCategoryFilter) {
      categoriesToDisplay = categories.filter(c => c === activeCategoryFilter);
    }

    let foldersRendered = 0;

    categoriesToDisplay.forEach(cat => {
      // Filter links inside this category
      let categoryLinks = links.filter(l => l.category === cat);

      // Search Query filter
      if (searchQuery) {
        categoryLinks = categoryLinks.filter(l => 
          l.title.toLowerCase().includes(searchQuery) ||
          l.url.toLowerCase().includes(searchQuery)
        );
      }

      // If active filter is not selected and search is active, do not display empty folders
      if (searchQuery && categoryLinks.length === 0 && !activeCategoryFilter) {
        return;
      }

      // Sort links inside folder
      if (sortOrder === 'newest') {
        categoryLinks.sort((a, b) => b.addedAt - a.addedAt);
      } else if (sortOrder === 'oldest') {
        categoryLinks.sort((a, b) => a.addedAt - b.addedAt);
      } else if (sortOrder === 'alphabetical') {
        categoryLinks.sort((a, b) => a.title.localeCompare(b.title));
      }

      foldersRendered++;

      const isCollapsed = collapsedFolders[cat] === true;

      // Construct Folder Card
      const folderCard = document.createElement('div');
      folderCard.className = `folder-card ${isCollapsed ? 'collapsed' : ''}`;
      folderCard.dataset.category = cat;

      folderCard.innerHTML = `
        <div class="folder-header">
          <div class="folder-title-left">
            <svg class="folder-icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
            <span class="folder-name">${cat}</span>
            <span class="folder-count-badge">${categoryLinks.length}</span>
          </div>
          <div class="folder-actions">
            <svg class="arrow-toggle-icon" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
          </div>
        </div>
        <div class="folder-links-list" id="folder-list-${cat.replace(/\s+/g, '-')}">
          <!-- Nested Links go here -->
        </div>
      `;

      // Collapse Toggle Click
      folderCard.querySelector('.folder-header').addEventListener('click', () => {
        const collapsed = folderCard.classList.toggle('collapsed');
        collapsedFolders[cat] = collapsed;
      });

      const linksListContainer = folderCard.querySelector('.folder-links-list');

      if (categoryLinks.length === 0) {
        linksListContainer.innerHTML = `<div class="folder-empty-state">No links saved in this category.</div>`;
      } else {
        categoryLinks.forEach(link => {
          const row = document.createElement('div');
          row.className = 'link-row';
          row.dataset.id = link.id;

          const isStarred = link.starred ? 'active' : '';
          const formattedDate = new Date(link.addedAt).toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          });

          // Generate move category dropdown selector options
          let moveOptions = '';
          categories.forEach(c => {
            moveOptions += `<option value="${c}" ${c === cat ? 'selected' : ''}>${c}</option>`;
          });

          row.innerHTML = `
            <div class="link-row-left">
              <button class="star-checkbox ${isStarred}" title="Toggle star">
                <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
              </button>
              <div class="title-edit-wrapper">
                <span class="link-text-title" title="Click to edit title">${escapeHTML(link.title)}</span>
                <a href="${link.url}" target="_blank" class="link-text-url" title="${link.url}">${link.url}</a>
              </div>
            </div>
            <div class="link-row-right">
              <span class="link-date">${formattedDate}</span>
              <select class="move-category-select" title="Change category">
                ${moveOptions}
              </select>
              <button class="btn-icon-action btn-open-link" title="Open in new tab">
                <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
              </button>
              <button class="btn-icon-action btn-delete-link" title="Delete Saved Link">
                <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            </div>
          `;

          // Handle star clicks
          row.querySelector('.star-checkbox').addEventListener('click', async (e) => {
            e.stopPropagation();
            link.starred = !link.starred;
            await saveLinks(links);
            renderDashboard();
            showToast(link.starred ? "Link starred" : "Removed star");
          });

          // Handle inline title editing on click
          const titleSpan = row.querySelector('.link-text-title');
          titleSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            startInlineEdit(titleSpan, link);
          });

          // Handle category changes
          const moveSelect = row.querySelector('.move-category-select');
          moveSelect.addEventListener('change', async (e) => {
            const oldCat = link.category;
            const newCat = e.target.value;
            link.category = newCat;
            await saveLinks(links);
            renderDashboard();
            showToast(`Moved link from ${oldCat} to ${newCat}`);
          });

          // Handle link open clicks
          row.querySelector('.btn-open-link').addEventListener('click', () => {
            window.open(link.url, '_blank');
          });

          // Handle deletes
          row.querySelector('.btn-delete-link').addEventListener('click', () => {
            showModal(
              "Delete Bookmark?",
              `Are you sure you want to delete the saved link "${link.title}"?`,
              async () => {
                links = links.filter(l => l.id !== link.id);
                await saveLinks(links);
                renderDashboard();
                showToast("Link successfully deleted.");
              }
            );
          });

          linksListContainer.appendChild(row);
        });
      }

      foldersContainer.appendChild(folderCard);
    });

    if (foldersRendered === 0) {
      foldersContainer.innerHTML = `
        <div class="dashboard-empty-state">
          <svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/></svg>
          <h3>No matching links found</h3>
          <p>Try clearing your active filters, modifying search keywords, or adding new bookmarks.</p>
        </div>
      `;
    }
  }

  // Handle inline title editing activation
  function startInlineEdit(spanElement, linkObj) {
    const parent = spanElement.parentElement;
    
    // Create an input box to overlay
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = linkObj.title;

    // Replace span with input box
    parent.replaceChild(input, spanElement);
    input.focus();
    input.select();

    let finished = false;

    async function finishEditing() {
      if (finished) return;
      finished = true;
      
      const newTitle = input.value.trim();
      
      if (newTitle && newTitle !== linkObj.title) {
        linkObj.title = newTitle;
        await saveLinks(links);
        renderDashboard();
        showToast("Link title updated.");
      } else {
        // Swap back to original element
        parent.replaceChild(spanElement, input);
      }
    }

    input.addEventListener('blur', finishEditing);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        finishEditing();
      } else if (e.key === 'Escape') {
        finished = true;
        parent.replaceChild(spanElement, input);
      }
    });
  }

  // Action: Add new custom category
  async function addNewCategory() {
    const value = newCategoryInput.value.trim();
    if (!value) return;

    if (categories.includes(value)) {
      showToast("Category already exists", false);
      return;
    }

    settings.customCategories = settings.customCategories || [];
    settings.customCategories.push(value);
    
    await saveSettings(settings);
    newCategoryInput.value = '';
    
    await loadData();
    renderDashboard();
    showToast(`Added category "${value}"`);
  }

  // Action: Export Backup
  function exportBackup() {
    if (links.length === 0) {
      showToast("Nothing to export yet!", false);
      return;
    }

    const dataObj = {
      backupVersion: 1,
      timestamp: Date.now(),
      links: links,
      settings: settings
    };

    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const formattedDate = new Date().toISOString().split('T')[0];
    link.download = `smart-links-backup-${formattedDate}.json`;
    link.click();
    
    // Clean up
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);

    showToast("Export successful!");
  }

  // Action: Import Backup JSON
  function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        // Validate imports
        if (!importedData || !Array.isArray(importedData.links)) {
          showToast("Invalid file format. Import failed.", false);
          return;
        }

        showModal(
          "Confirm JSON Import?",
          `Found ${importedData.links.length} links and user preferences. Importing will merge with your current bookmarks. Proceed?`,
          async () => {
            // Process imported links
            const currentLinks = await getLinks();
            let mergeCount = 0;
            
            // Create a unique set by matching URLs
            const mergedMap = new Map();
            currentLinks.forEach(l => mergedMap.set(l.url, l));
            
            importedData.links.forEach(l => {
              if (l.url && l.title) {
                // Keep the imported version, or merge details
                const exists = mergedMap.has(l.url);
                if (!exists) mergeCount++;
                mergedMap.set(l.url, {
                  id: l.id || Date.now().toString() + Math.random().toString(),
                  url: l.url,
                  title: l.title,
                  category: l.category || 'Others',
                  starred: !!l.starred,
                  addedAt: l.addedAt || Date.now()
                });
              }
            });

            const mergedList = Array.from(mergedMap.values());
            await saveLinks(mergedList);

            // Import categories and settings
            if (importedData.settings) {
              const currentSettings = await getSettings();
              const importedCustomCats = importedData.settings.customCategories || [];
              const combinedCats = [...(currentSettings.customCategories || [])];

              importedCustomCats.forEach(cat => {
                if (!combinedCats.includes(cat)) {
                  combinedCats.push(cat);
                }
              });

              currentSettings.customCategories = combinedCats;
              await saveSettings(currentSettings);
            }

            await loadData();
            renderDashboard();
            showToast(`Imported ${mergeCount} new links successfully!`);
          }
        );
      } catch (err) {
        console.error('Error importing backup JSON:', err);
        showToast("Error parsing backup JSON file.", false);
      }
    };
    reader.readAsText(file);
    
    // Clear input value so same file can be re-selected if necessary
    importFileInput.value = '';
  }

  // Toast systems
  function showToast(message, isSuccess = true) {
    const toast = document.getElementById('dashboard-toast');
    const toastMsg = document.getElementById('toast-message');
    
    toastMsg.textContent = message;
    
    if (isSuccess) {
      toast.style.background = 'rgba(16, 185, 129, 0.9)'; // Green
    } else {
      toast.style.background = 'rgba(239, 68, 68, 0.9)'; // Red
    }

    toast.classList.remove('hidden');
    
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 2800);
  }

  // Modal alert dialog window manager
  function showModal(title, bodyText, onConfirm) {
    modalTitle.textContent = title;
    modalBody.textContent = bodyText;
    modalCallback = onConfirm;
    modalContainer.classList.remove('hidden');
  }

  function closeModal() {
    modalContainer.classList.add('hidden');
    modalCallback = null;
  }

  // Helper escape script tags
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});
