// Background script for YouTube Ratioed Extension

// Default settings
const DEFAULT_SETTINGS = {
  apiKey: '', // YouTube API key (empty by default, user must provide)
  minRatio: 0.1, // Lower the default minimum ratio to ensure more results show up
  maxResults: 50,
  enabled: true // Whether to show the ratio in video titles
};

// Initialize extension when installed
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.sync.set(DEFAULT_SETTINGS, () => {
    console.log('YouTube Ratioed: Default settings initialized');
  });
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('YouTube Ratioed DEBUG: Background received message:', request);
  
  // Handle request for settings
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      console.log('YouTube Ratioed DEBUG: Sending settings:', settings);
      sendResponse(settings);
    });
    return true; // Keep the message channel open for async response
  }
  
  // Handle saving settings
  if (request.action === 'saveSettings') {
    console.log('YouTube Ratioed DEBUG: Saving settings:', request.settings);
    chrome.storage.sync.set(request.settings, () => {
      // Notify all tabs with YouTube or Google search that settings have changed
      chrome.tabs.query({ url: ['*://*.youtube.com/*', '*://*.google.com/search*'] }, (tabs) => {
        console.log('YouTube Ratioed DEBUG: Found', tabs.length, 'tabs to update with new settings');
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'settingsUpdated',
            settings: request.settings
          }).catch(err => console.error('Error sending settings update:', err));
        }
      });
      
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Handle analyze request
  if (request.action === 'analyze') {
    console.log('YouTube Ratioed DEBUG: Received analyze request');
    
    // Check if API key is set and extension is enabled
    chrome.storage.sync.get(['apiKey', 'enabled'], (settings) => {
      if (!settings.apiKey) {
        console.error('YouTube Ratioed ERROR: No YouTube API key provided');
        sendResponse({ success: false, error: 'No YouTube API key provided. Please add your API key in the extension settings.' });
        return;
      }
      
      if (settings.enabled === false) {
        console.error('YouTube Ratioed ERROR: Extension is disabled');
        sendResponse({ success: false, error: 'Extension is disabled. Please enable it in settings.' });
        return;
      }
      
      // Forward the analyze request to the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          console.log('YouTube Ratioed DEBUG: Forwarding analyze request to tab', tabs[0].id);
          chrome.tabs.sendMessage(tabs[0].id, { action: 'analyze' })
            .then(response => {
              console.log('YouTube Ratioed DEBUG: Tab response to analyze:', response);
              sendResponse(response);
            })
            .catch(error => {
              console.error('YouTube Ratioed DEBUG: Error analyzing tab:', error);
              // Check if content script is not loaded
              if (error.message && error.message.includes('Could not establish connection')) {
                sendResponse({ 
                  success: false, 
                  error: 'Content script not found. Please refresh the page and try again.' 
                });
              } else {
                sendResponse({ success: false, error: error.message || 'Unknown error' });
              }
            });
        } else {
          console.error('YouTube Ratioed DEBUG: No active tab found');
          sendResponse({ success: false, error: 'No active tab found' });
        }
      });
    });
    
    return true;
  }
  
  // Handle results ready notification
  if (request.action === 'resultsReady') {
    // Update the extension badge with the count of videos that meet criteria
    const count = request.count || 0;
    console.log('YouTube Ratioed DEBUG: Results ready, count:', count);
    
    if (count > 0) {
      chrome.action.setBadgeText({ text: count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
    
    sendResponse({ success: true });
    return true;
  }
});

// Listen for tab updates to inject content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only run when the page is fully loaded
  if (changeInfo.status === 'complete') {
    // Check if this is a YouTube page or Google search page
    const isYouTube = tab.url && tab.url.includes('youtube.com');
    const isGoogleSearch = tab.url && tab.url.includes('google.com/search');
    
    if (isYouTube || isGoogleSearch) {
      console.log(`YouTube Ratioed DEBUG: Tab ${tabId} loaded: ${isYouTube ? 'YouTube' : 'Google Search'} page`);
      // Notify the content script that the page has loaded
      chrome.tabs.sendMessage(tabId, { 
        action: 'pageLoaded',
        url: tab.url
      }).catch(err => {
        // If the content script isn't loaded yet, this will fail silently
        // This is expected behavior
        console.log(`YouTube Ratioed DEBUG: Could not send pageLoaded message to tab ${tabId} - this is normal if first load`);
      });
    }
  }
}); 