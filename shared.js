/**
 * Smart Link Organizer - Shared Utilities
 * Used by popup, content script, and dashboard.
 */

const DEFAULT_CATEGORIES = [];

/**
 * Automatically determine the category from a URL.
 * @param {string} urlString 
 * @returns {string} The detected category name.
 */
function detectCategory(urlString) {
  try {
    const url = new URL(urlString);
    let host = url.hostname.toLowerCase();

    // Remove "www." prefix if it exists
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }

    // Capitalize the first letter of the domain name to make it look clean (e.g. leetcode.com -> Leetcode.com)
    if (host.length > 0) {
      return host.charAt(0).toUpperCase() + host.slice(1);
    }
  } catch (e) {
    console.error('Error parsing URL in detectCategory:', e);
  }
  return 'Others';
}

/**
 * Normalize a URL for consistent storage and comparison.
 * @param {string} urlString 
 * @returns {string} The normalized URL.
 */
function normalizeUrl(urlString) {
  try {
    if (!urlString) return '';
    const url = new URL(urlString);
    
    let host = url.hostname.toLowerCase();
    let pathname = url.pathname;
    
    // Remove trailing slash from pathname if it's not just '/'
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    
    let normalized = `${url.protocol}//${host}${pathname}`;
    
    // Normalize query parameters (filtering trackers)
    const searchParams = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!lowerKey.startsWith('utm_') && lowerKey !== 'fbclid' && lowerKey !== 'gclid') {
        searchParams.append(key, value);
      }
    });
    
    const searchStr = searchParams.toString();
    if (searchStr) {
      normalized += `?${searchStr}`;
    }
    
    // Keep hash only if it's route-based
    if (url.hash && url.hash.startsWith('#/')) {
      normalized += url.hash;
    }
    
    return normalized;
  } catch (e) {
    let cleaned = (urlString || '').trim();
    if (cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1);
    }
    return cleaned;
  }
}

/**
 * Get all links from chrome.storage.local, automatically deduplicating and normalizing.
 * @returns {Promise<Array>} List of saved links.
 */
function getLinks() {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        resolve([]);
        return;
      }
      chrome.storage.local.get({ links: [] }, (result) => {
        if (chrome.runtime.lastError) {
          resolve([]);
        } else {
          let rawLinks = result ? result.links || [] : [];
          let uniqueLinks = [];
          let seenUrls = new Set();
          let hasDuplicates = false;
          
          for (let link of rawLinks) {
            let normUrl = normalizeUrl(link.url);
            if (!seenUrls.has(normUrl)) {
              seenUrls.add(normUrl);
              link.url = normUrl; // ensure it is stored normalized
              uniqueLinks.push(link);
            } else {
              hasDuplicates = true;
            }
          }
          
          if (hasDuplicates) {
            chrome.storage.local.set({ links: uniqueLinks }, () => {
              resolve(uniqueLinks);
            });
          } else {
            resolve(uniqueLinks);
          }
        }
      });
    } catch (e) {
      resolve([]);
    }
  });
}

/**
 * Save all links to chrome.storage.local.
 * @param {Array} links 
 * @returns {Promise<void>}
 */
function saveLinks(links) {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        resolve();
        return;
      }
      chrome.storage.local.set({ links }, () => {
        resolve();
      });
    } catch (e) {
      resolve();
    }
  });
}

/**
 * Check if a URL is already saved.
 * @param {string} url 
 * @returns {Promise<boolean>}
 */
async function isLinkSaved(url) {
  try {
    const links = await getLinks();
    const normUrl = normalizeUrl(url);
    return links.some(link => normalizeUrl(link.url) === normUrl);
  } catch (e) {
    return false;
  }
}

/**
 * Get settings (theme, categories, etc.)
 * @returns {Promise<Object>} Settings object.
 */
function getSettings() {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        resolve({ theme: 'dark', customCategories: [] });
        return;
      }
      chrome.storage.local.get({
        settings: {
          theme: 'dark', // default theme
          customCategories: []
        }
      }, (result) => {
        if (chrome.runtime.lastError) {
          resolve({ theme: 'dark', customCategories: [] });
        } else {
          resolve(result ? result.settings || { theme: 'dark', customCategories: [] } : { theme: 'dark', customCategories: [] });
        }
      });
    } catch (e) {
      resolve({ theme: 'dark', customCategories: [] });
    }
  });
}

/**
 * Save settings to storage.
 * @param {Object} settings 
 * @returns {Promise<void>}
 */
function saveSettings(settings) {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        resolve();
        return;
      }
      chrome.storage.local.set({ settings }, () => {
        resolve();
      });
    } catch (e) {
      resolve();
    }
  });
}

/**
 * Get the list of all categories dynamically from saved links and custom categories.
 * @returns {Promise<Array<string>>}
 */
async function getAllCategories() {
  const links = await getLinks();
  const settings = await getSettings();
  const custom = settings.customCategories || [];

  const categoriesSet = new Set();

  // Extract categories from saved links
  links.forEach(link => {
    if (link.category) {
      categoriesSet.add(link.category);
    }
  });

  // Include custom categories
  custom.forEach(cat => {
    if (cat) {
      categoriesSet.add(cat);
    }
  });

  // Convert to array and sort alphabetically
  const all = Array.from(categoriesSet).sort((a, b) => {
    if (a === 'Others') return 1;
    if (b === 'Others') return -1;
    return a.localeCompare(b);
  });

  return all;
}

/**
 * Trigger AI classification of a link in the background if Gemini API key is configured.
 * @param {string} linkId 
 * @param {string} url 
 * @param {string} title 
 */
function triggerAiClassification(linkId, url, title) {
  getSettings().then(settings => {
    if (settings && settings.geminiApiKey) {
      chrome.runtime.sendMessage({
        action: 'classify_link',
        url: url,
        title: title
      }, (response) => {
        if (response && response.category) {
          getLinks().then(links => {
            const link = links.find(l => l.id === linkId);
            if (link) {
              const oldCategory = link.category;
              link.category = response.category;
              saveLinks(links).then(() => {
                console.log(`Successfully classified link "${title}" from category "${oldCategory}" to "${response.category}" via Gemini.`);
              });
            }
          });
        }
      });
    }
  });
}

