/**
 * Smart Link Organizer - Background Service Worker
 * Handles message routing and dashboard tab management.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'open_dashboard') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    return false; // synchronous response
  }

  if (message.action === 'classify_link') {
    classifyLink(message.url, message.title)
      .then(category => {
        sendResponse({ category });
      })
      .catch(err => {
        console.error('Error during classification:', err);
        sendResponse({ category: null });
      });
    return true; // Keep message channel open for async response
  }
});

/**
 * Call the Gemini API to classify the url and title.
 * @param {string} url 
 * @param {string} title 
 * @returns {Promise<string|null>} The classified category or null.
 */
async function classifyLink(url, title) {
  try {
    const result = await chrome.storage.local.get('settings');
    const apiKey = result.settings ? result.settings.geminiApiKey : null;
    if (!apiKey) {
      console.log('Gemini API key is not configured.');
      return null;
    }

    const prompt = `You are an AI bookmark categorizer. Analyze the page title and URL:
Title: "${title}"
URL: "${url}"

Rules:
1. For video-based websites like YouTube (youtube.com, youtu.be, etc.), categorize the bookmark as "Youtube - <Video Topic/Creator Content>" (e.g., "Youtube - Coding", "Youtube - Music", "Youtube - Tech Reviews", "Youtube - Gaming").
2. For movie/show streaming websites like Netflix (netflix.com, etc.), categorize the bookmark as "Netflix - <Genre/Category>" (e.g., "Netflix - Romcom", "Netflix - Action", "Netflix - Sci-Fi", "Netflix - Documentaries").
3. For any other websites, categorize the bookmark by its domain brand name (e.g., "Github.com", "Google.com", "Wikipedia.org").
4. Return ONLY the category name. Do not write any explanations, markdown, or punctuation. The category name must be maximum 3-4 words.`;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! Status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.error.message) {
          errorMessage += ` - ${errorData.error.message}`;
        }
      } catch (e) {
        // Fallback if parsing fails
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
      const category = data.candidates[0].content.parts[0].text.trim();
      console.log('AI Classified Category:', category);
      return category;
    }
  } catch (error) {
    console.error('Error fetching Gemini API:', error);
  }
  return null;
}
