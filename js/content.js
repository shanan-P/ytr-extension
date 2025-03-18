// Content script for YouTube Ratioed Extension

// Global variables to store settings and results
let settings = {
  apiKey: '',
  minRatio: 0.1,
  maxResults: 10,
  enabled: true
};

let videoRatios = new Map(); // Maps videoId to ratio data
let isScanning = false;
let isGoogleSearch = false;
let isYouTubeSearch = false;
let isYouTubeHomepage = false;
let skipScanButton = true; // Set to true to hide scan buttons on all pages

// Get settings when the script loads
chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
  if (response) {
    settings = response;
    console.log('YouTube Ratioed: Loaded settings:', settings);
    
    // Now that we have settings, determine the page type
    detectPageType(window.location.href);
  }
});

// Listen for messages from background script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('YouTube Ratioed DEBUG: Content script received message:', request);
  
  // If we receive updated settings, store them
  if (request.action === 'settingsUpdated') {
    const oldEnabled = settings.enabled;
    settings = request.settings;
    console.log('YouTube Ratioed DEBUG: Settings updated:', settings);
    
    // If the extension is disabled, clear all ratio displays
    if (settings.enabled === false) {
      console.log('YouTube Ratioed: Extension disabled, clearing displays');
      clearAllRatioDisplays();
      // Remove the scan button if it exists (just in case)
      const existingButton = document.getElementById('yt-ratioed-scan-btn');
      if (existingButton) existingButton.remove();
    } else {
      // Just refresh ratios with new settings
      console.log('YouTube Ratioed: Refreshing with new settings');
      if (isGoogleSearch) {
        updateGoogleSearchRatioLabels();
      } else {
        updateVideoRatioLabels();
      }
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  // If we're asked to analyze the current page
  if (request.action === 'analyze') {
    console.log('YouTube Ratioed DEBUG: Received analyze request in content script');
    try {
      // Check if the extension is enabled
      if (!settings.enabled) {
        console.log('YouTube Ratioed: Extension is disabled, not analyzing');
        sendResponse({ 
          success: false, 
          error: 'Extension is disabled. Please enable it in settings.'
        });
        return true;
      }
      
      if (isScanning) {
        console.log('YouTube Ratioed DEBUG: Already scanning, sending response');
        sendResponse({ success: false, message: 'Already scanning' });
      } else {
        if (isGoogleSearch) {
          console.log('YouTube Ratioed DEBUG: Starting Google search scan');
          // Wrap in try-catch to catch any errors
          try {
            scanGoogleSearch();
            sendResponse({ success: true });
          } catch (error) {
            console.error('YouTube Ratioed ERROR in scanGoogleSearch:', error);
            sendResponse({ success: false, error: error.message || 'Error in Google search scan' });
          }
        } else if (isYouTubeHomepage) {
          console.log('YouTube Ratioed DEBUG: Scanning YouTube homepage');
          // Wrap in try-catch to catch any errors
          try {
            scanYouTubePage();
            sendResponse({ success: true });
          } catch (error) {
            console.error('YouTube Ratioed ERROR in scanYouTubeHomepage:', error);
            sendResponse({ success: false, error: error.message || 'Error in YouTube homepage scan' });
          }
        } else {
          console.log('YouTube Ratioed DEBUG: Starting YouTube page scan');
          // Wrap in try-catch to catch any errors
          try {
            scanYouTubePage();
            sendResponse({ success: true });
          } catch (error) {
            console.error('YouTube Ratioed ERROR in scanYouTubePage:', error);
            sendResponse({ success: false, error: error.message || 'Error in YouTube page scan' });
          }
        }
      }
    } catch (error) {
      console.error('YouTube Ratioed ERROR in analyze action:', error);
      sendResponse({ success: false, error: error.message || 'Error handling analyze request' });
    }
    return true; // Keep the message channel open for async response
  }
  
  // If we're asked to clear ratio displays
  if (request.action === 'clearRatios') {
    console.log('YouTube Ratioed DEBUG: Received clearRatios request');
    try {
      clearAllRatioDisplays();
      sendResponse({ success: true });
    } catch (error) {
      console.error('YouTube Ratioed ERROR in clearRatios:', error);
      sendResponse({ success: false, error: error.message || 'Error clearing ratio displays' });
    }
    return true;
  }
  
  // If a page has loaded
  if (request.action === 'pageLoaded') {
    console.log('YouTube Ratioed DEBUG: Page loaded notification received, URL:', request.url);
    try {
      detectPageType(request.url);
      sendResponse({ success: true });
    } catch (error) {
      console.error('YouTube Ratioed ERROR in pageLoaded:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  return true; // Keep the message channel open for async response
});

// Function to detect what type of page we're on
function detectPageType(url) {
  if (!url) url = window.location.href;
  console.log('YouTube Ratioed DEBUG: Detecting page type for URL:', url);
  
  // Check for YouTube homepage 
  // Match either exactly youtube.com or youtube.com/ with or without www.
  const isHomepage = url.match(/^https?:\/\/(www\.)?youtube\.com\/?(\?.*)?$/) || 
                    url.includes('/feed/trending') || 
                    url.includes('/feed/explore') ||
                    url.includes('/feed/subscriptions');
  
  if (isHomepage) {
    isYouTubeHomepage = true;
    isYouTubeSearch = false;
    isGoogleSearch = false;
    console.log('YouTube Ratioed: On YouTube Homepage or feed page');
    // Set up observer to track changes on the YouTube homepage
    setTimeout(() => {
      try {
        startObservingVideos();
      } catch (error) {
        console.error('YouTube Ratioed ERROR in YouTube homepage setup:', error);
      }
    }, 2000);
    return;
  }
  
  // Check for YouTube search page
  if (url.includes('youtube.com/results') || 
     (url.includes('youtube.com') && url.includes('search_query='))) {
    isYouTubeHomepage = false;
    isYouTubeSearch = true;
    isGoogleSearch = false;
    console.log('YouTube Ratioed: On YouTube Search page');
    // Allow time for the page to load fully
    setTimeout(() => {
      try {
        startObservingVideos();
      } catch (error) {
        console.error('YouTube Ratioed ERROR in YouTube search page setup:', error);
      }
    }, 2000);
  }
  // Check for YouTube regular page
  else if (url.includes('youtube.com')) {
    isYouTubeHomepage = false;
    isYouTubeSearch = false;
    isGoogleSearch = false;
    console.log('YouTube Ratioed: On YouTube page');
    // Allow time for the page to load fully
    setTimeout(() => {
      try {
        startObservingVideos();
      } catch (error) {
        console.error('YouTube Ratioed ERROR in YouTube page setup:', error);
      }
    }, 2000);
  } 
  // Check for Google search with YouTube results
  else if (url.includes('google.com/search')) {
    isYouTubeHomepage = false;
    isYouTubeSearch = false;
    isGoogleSearch = true;
    console.log('YouTube Ratioed: On Google Search page');
  } else {
    isYouTubeHomepage = false;
    isYouTubeSearch = false;
    isGoogleSearch = false;
    console.log('YouTube Ratioed: Not on a supported page type');
  }
}

// Function to clear all ratio displays
function clearAllRatioDisplays() {
  console.log('YouTube Ratioed DEBUG: Clearing all ratio displays');
  
  // Reset all titles that have been modified
  document.querySelectorAll('[data-yt-ratioed="true"]').forEach(element => {
    try {
      // Get the original title
      const originalTitle = element.getAttribute('data-original-title');
      if (originalTitle) {
        element.innerHTML = originalTitle;
      }
      // Remove the data attribute
      element.removeAttribute('data-yt-ratioed');
      element.removeAttribute('data-original-title');
      // Clear any tooltips
      element.title = '';
    } catch (error) {
      console.error('YouTube Ratioed ERROR clearing element:', error);
    }
  });
  
  // Remove any overlays
  document.querySelectorAll('.yt-ratioed-overlay').forEach(element => {
    element.remove();
  });
  
  // Clear the videoRatios map
  videoRatios.clear();
  
  // Clear the badge
  chrome.runtime.sendMessage({ action: 'resultsReady', count: 0 });
  
  console.log('YouTube Ratioed DEBUG: All ratio displays cleared');
}

// Function to scan Google Search results for YouTube videos
async function scanGoogleSearch() {
  if (isScanning) return;
  
  isScanning = true;
  
  // Show scanning indicator
  showStatusMessage('Scanning Google search results for YouTube videos...');
  
  // Find all search result links that point to YouTube videos
  const videoLinks = findYouTubeLinksInSearch();
  console.log(`YouTube Ratioed: Found ${videoLinks.length} YouTube video links in search results`);
  
  if (videoLinks.length === 0) {
    showStatusMessage('No YouTube videos found in search results', 3000);
    isScanning = false;
    return;
  }
  
  let processedCount = 0;
  
  // Process each video link
  for (const linkInfo of videoLinks) {
    try {
      // Skip if this link already has a ratio label
      if (linkInfo.element.querySelector('.yt-ratioed-overlay')) {
        continue;
      }
      
      const videoId = linkInfo.videoId;
      
      if (!videoId) {
        continue;
      }
      
      // Skip if we've already processed this video
      if (videoRatios.has(videoId)) {
        addGoogleSearchRatioOverlay(linkInfo, videoRatios.get(videoId));
        continue;
      }
      
      updateStatusMessage(`Scanning ${++processedCount} of ${videoLinks.length} videos`);
      
      // Fetch video details
      const videoData = await fetchVideoDetails(videoId);
      
      // Calculate ratio if we have valid data
      let ratioData;
      if (videoData.error || videoData.views < 0 || videoData.likes < 0) {
        // Error case - use -1 for views/likes and 0 for ratio
        ratioData = {
          videoId,
          url: linkInfo.url,
          views: videoData.views,
          likes: videoData.likes,
          likeRatio: "0",
          error: true
        };
      } else {
        // Valid data
        const likeRatio = videoData.views > 0 ? (videoData.likes / videoData.views) * 100 : 0;
        ratioData = {
          videoId,
          url: linkInfo.url,
          views: videoData.views,
          likes: videoData.likes,
          likeRatio: likeRatio.toFixed(4),
          error: false
        };
      }
      
      videoRatios.set(videoId, ratioData);
      
      // Add overlay to the search result
      addGoogleSearchRatioOverlay(linkInfo, ratioData);
    } catch (error) {
      console.error('Error processing video:', error);
    }
  }
  
  // Update status
  showStatusMessage(`Added like ratio to ${processedCount} YouTube videos in search results`, 3000);
  isScanning = false;
  
  // Store results for popup
  chrome.storage.local.set({ videoRatios: Array.from(videoRatios.entries()) });
  
  // Notify background script that results are ready
  chrome.runtime.sendMessage({ 
    action: 'resultsReady', 
    count: videoRatios.size 
  });
}

// Function to find YouTube links in Google search results
function findYouTubeLinksInSearch() {
  let results = [];
  
  // Find all links in the search results
  const links = document.querySelectorAll('a');
  
  for (const link of links) {
    const href = link.href;
    
    // Skip if not a YouTube video link
    if (!href || !href.includes('youtube.com/watch')) {
      continue;
    }
    
    try {
      // Extract video ID from URL
      const url = new URL(href);
      const videoId = url.searchParams.get('v');
      
      if (!videoId) {
        continue;
      }
      
      // Find the parent element that contains the whole search result
      const resultElement = link.closest('.g') || // Standard search result
                            link.closest('[data-hveid]') || // Video carousel item
                            link.closest('div[data-sokoban-feature]') || // Another result type
                            link; // Fallback to the link itself
      
      // Store the link and its context
      results.push({
        element: resultElement,
        link: link,
        url: href,
        videoId: videoId
      });
    } catch (e) {
      // Skip invalid URLs
      console.error('Error parsing URL:', e);
    }
  }
  
  // Remove duplicates (same videoId)
  const uniqueResults = [];
  const seenIds = new Set();
  
  for (const result of results) {
    if (!seenIds.has(result.videoId)) {
      uniqueResults.push(result);
      seenIds.add(result.videoId);
    }
  }
  
  return uniqueResults;
}

// Function to add ratio to a Google search result
function addGoogleSearchRatioOverlay(linkInfo, ratioData) {
  // If extension is disabled, don't add overlay
  if (settings.enabled === false) {
    return;
  }
  
  console.log('YouTube Ratioed DEBUG: Attempting to add ratio to Google search result for video:', ratioData.videoId);
  
  // Skip videos that don't meet the minimum ratio unless there was an error
  if (!ratioData.error && ratioData.views >= 0 && ratioData.likes > 0 && parseFloat(ratioData.likeRatio) < settings.minRatio) {
    console.log(`YouTube Ratioed DEBUG: Skipping Google result for video ${ratioData.videoId} - ratio ${ratioData.likeRatio} below minimum ${settings.minRatio}`);
    return;
  }
  
  // Find a title element
  const titleElement = linkInfo.element.querySelector('h3') || 
                     linkInfo.element.querySelector('[role="heading"]') ||
                     linkInfo.element.querySelector('[class*="title"]') ||
                     linkInfo.link;
  
  if (!titleElement) {
    console.log(`YouTube Ratioed DEBUG: Could not find title element for Google result ${ratioData.videoId}`);
    return;
  }
  
  // Check if this title is already processed
  if (titleElement.getAttribute('data-yt-ratioed') === 'true') {
    console.log(`YouTube Ratioed DEBUG: Title already processed for Google result ${ratioData.videoId}`);
    return;
  }
  
  // Format the ratio and get color
  let ratioPrefix;
  let colorClass;
  
  if (ratioData.error || ratioData.views <= 0 || ratioData.likes <= 0) {
    ratioPrefix = '[N/A] ';
    colorClass = 'yt-ratioed-error-text';
  } else {
    const ratio = parseFloat(ratioData.likeRatio);
    const formattedRatio = ratio >= 1 ? ratio.toFixed(1) : ratio.toFixed(2);
    ratioPrefix = `[${formattedRatio}%] `;
    
    if (ratio >= 10) {
      colorClass = 'yt-ratioed-high-text';
    } else if (ratio >= 5) {
      colorClass = 'yt-ratioed-medium-text';
    } else {
      colorClass = 'yt-ratioed-low-text';
    }
  }
  
  // Get the original title and store it
  const originalTitle = titleElement.textContent;
  titleElement.setAttribute('data-original-title', originalTitle);
  
  // Special handling for Google search results which can have more complex title structures
  // Check if we're dealing with a basic title or a structure with child elements
  if (titleElement.childElementCount > 0) {
    // More complex title structure, try to find the right element to modify
    // Usually in google search, the heading has a single span or div inside
    const innerElement = titleElement.querySelector('span') || titleElement.querySelector('div');
    
    if (innerElement) {
      // If we have an inner element, modify that
      const innerOriginalText = innerElement.textContent;
      innerElement.innerHTML = `<span class="${colorClass}">${ratioPrefix}</span>${innerOriginalText}`;
    } else {
      // Fallback if no inner element found, inject at the beginning
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = `<span class="${colorClass}">${ratioPrefix}</span>`;
      titleElement.insertBefore(tempDiv.firstChild, titleElement.firstChild);
    }
  } else {
    // Simple title element, just replace the text
    titleElement.innerHTML = `<span class="${colorClass}">${ratioPrefix}</span>${originalTitle}`;
  }
  
  // Mark as processed
  titleElement.setAttribute('data-yt-ratioed', 'true');
  
  // Also add tooltip with more info
  if (ratioData.error || ratioData.views <= 0 || ratioData.likes <= 0) {
    const errorMsg = ratioData.message || 'No likes/views available';
    titleElement.title = `Unable to retrieve data: ${errorMsg}`;
  } else {
    titleElement.title = `Likes: ${formatNumberWithCommas(ratioData.likes)}, Views: ${formatNumberWithCommas(ratioData.views)}, Ratio: ${parseFloat(ratioData.likeRatio).toFixed(2)}%`;
  }
  
  console.log(`YouTube Ratioed DEBUG: Successfully added ratio to title for Google result ${ratioData.videoId}`);
}

// Helper function to format a number with commas
function formatNumberWithCommas(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Function to update ratio labels in Google search results after settings change
function updateGoogleSearchRatioLabels() {
  // Remove all ratio overlays
  document.querySelectorAll('.yt-ratioed-overlay').forEach(overlay => {
    overlay.remove();
  });
  
  // Re-scan the page with new settings
  scanGoogleSearch();
}

// Function to start observing for new videos that appear on the page
function startObservingVideos() {
  // Create a MutationObserver to watch for new videos
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    
    mutations.forEach(mutation => {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        for (let node of mutation.addedNodes) {
          if (node.nodeType === 1) { // Element node
            const videoElements = findVideoElementsInNode(node);
            if (videoElements && videoElements.length > 0) {
              shouldScan = true;
              break;
            }
          }
        }
      }
    });
    
    if (shouldScan && !isScanning) {
      processNewVideos();
    }
  });
  
  // Start observing the document with the configured parameters
  observer.observe(document.body, { 
    childList: true,
    subtree: true
  });
  
  console.log('YouTube Ratioed: Started observing for new videos');
}

// Process new videos that appear on the page
function processNewVideos() {
  if (isScanning) return;
  
  // Get video elements from the page that don't have ratio labels yet
  const videoElements = findVideoElementsWithoutLabels();
  
  if (videoElements.length > 0) {
    console.log(`YouTube Ratioed: Found ${videoElements.length} new videos to process`);
    processVideoElements(videoElements);
  }
}

// Main function to scan all YouTube videos on the page
async function scanYouTubePage() {
  if (isScanning) return;
  
  isScanning = true;
  
  // Show scanning indicator
  showStatusMessage('Scanning videos for like ratios...');
  
  // Get all video elements from the page
  const videoElements = findVideoElements();
  console.log(`YouTube Ratioed: Found ${videoElements.length} videos on page`);
  
  // Process the videos
  await processVideoElements(videoElements);
  
  // Update status
  hideStatusMessage();
  isScanning = false;
  
  // Store results for popup
  chrome.storage.local.set({ videoRatios: Array.from(videoRatios.entries()) });
  
  // Notify background script that results are ready
  chrome.runtime.sendMessage({ 
    action: 'resultsReady', 
    count: videoRatios.size 
  });
}

// Process a batch of video elements
async function processVideoElements(videoElements) {
  if (videoElements.length === 0) return;
  
  // Process each video
  let processedCount = 0;
  
  for (const videoEl of videoElements) {
    try {
      // Check if this video already has a ratio label
      if (videoEl.querySelector('.yt-ratioed-overlay')) {
        continue;
      }
      
      // Extract video URL - try different possible selectors
      let videoUrl = '';
      let videoId = '';
      
      // Try various selectors for finding the video link
      const linkSelectors = [
        'a#thumbnail', 
        'a.ytd-thumbnail', 
        'a[href*="/watch"]',
        'a'
      ];
      
      for (const selector of linkSelectors) {
        const linkEl = videoEl.querySelector(selector);
        if (linkEl && linkEl.href && linkEl.href.includes('/watch?v=')) {
          videoUrl = linkEl.href;
          break;
        }
      }
      
      // If we still don't have a URL and the element itself is an anchor with a watch link
      if (!videoUrl && videoEl.tagName === 'A' && videoEl.href && videoEl.href.includes('/watch?v=')) {
        videoUrl = videoEl.href;
      }
      
      // Skip if we couldn't find a video URL
      if (!videoUrl) {
        continue;
      }
      
      // Extract video ID from the URL
      try {
        videoId = new URLSearchParams(new URL(videoUrl).search).get('v');
      } catch (e) {
        continue;
      }
      
      if (!videoId) {
        continue;
      }
      
      // Skip if we've already processed this video
      if (videoRatios.has(videoId)) {
        addRatioOverlay(videoEl, videoRatios.get(videoId));
        continue;
      }
      
      // Find the thumbnail container
      const thumbnailContainer = videoEl.querySelector('a#thumbnail') || 
                               videoEl.querySelector('a.ytd-thumbnail') || 
                               videoEl.querySelector('a[href*="/watch"]');
      
      if (!thumbnailContainer) {
        continue;
      }
      
      updateStatusMessage(`Scanning ${++processedCount} of ${videoElements.length} videos`);
      
      // We need to visit the actual video page to get views and likes
      const videoData = await fetchVideoDetails(videoId);
      
      // Calculate ratio if we have valid data
      let ratioData;
      if (videoData.error || videoData.views < 0 || videoData.likes < 0) {
        // Error case - use -1 for views/likes and 0 for ratio
        ratioData = {
          videoId,
          url: videoUrl,
          views: videoData.views,
          likes: videoData.likes,
          likeRatio: "0",
          error: true
        };
      } else {
        // Valid data
        const likeRatio = videoData.views > 0 ? (videoData.likes / videoData.views) * 100 : 0;
        ratioData = {
          videoId,
          url: videoUrl,
          views: videoData.views,
          likes: videoData.likes,
          likeRatio: likeRatio.toFixed(4),
          error: false
        };
      }
      
      videoRatios.set(videoId, ratioData);
      
      // Add overlay to the thumbnail
      addRatioOverlay(videoEl, ratioData);
    } catch (error) {
      console.error('Error processing video:', error);
    }
  }
}

// Function to add ratio overlay to a video element
function addRatioOverlay(videoElement, ratioData) {
  // If extension is disabled, don't add overlay
  if (settings.enabled === false) {
    return;
  }
  
  console.log('YouTube Ratioed DEBUG: Attempting to add ratio to video title for:', ratioData.videoId);
  
  // Skip videos that don't meet the minimum ratio unless there was an error
  if (!ratioData.error && ratioData.views >= 0 && ratioData.likes > 0 && parseFloat(ratioData.likeRatio) < settings.minRatio) {
    console.log(`YouTube Ratioed DEBUG: Skipping video ${ratioData.videoId} - ratio ${ratioData.likeRatio} below minimum ${settings.minRatio}`);
    return;
  }
  
  // Find the title element
  const titleElement = videoElement.querySelector('#video-title') || 
                     videoElement.querySelector('.title') || 
                     videoElement.querySelector('[id*="title"]') ||
                     videoElement.querySelector('[class*="title"]') ||
                     videoElement.querySelector('h3') ||
                     videoElement.querySelector('a[title]');
  
  if (!titleElement) {
    console.log(`YouTube Ratioed DEBUG: Could not find title element for video ${ratioData.videoId}`);
    return;
  }
  
  // Check if this title is already processed
  if (titleElement.getAttribute('data-yt-ratioed') === 'true') {
    console.log(`YouTube Ratioed DEBUG: Title already processed for video ${ratioData.videoId}`);
    return;
  }
  
  // Format the ratio and get color
  let ratioPrefix;
  let colorClass;
  
  if (ratioData.error || ratioData.views <= 0 || ratioData.likes <= 0) {
    ratioPrefix = '[N/A] ';
    colorClass = 'yt-ratioed-error-text';
  } else {
    const ratio = parseFloat(ratioData.likeRatio);
    const formattedRatio = ratio >= 1 ? ratio.toFixed(1) : ratio.toFixed(2);
    ratioPrefix = `[${formattedRatio}%] `;
    
    if (ratio >= 10) {
      colorClass = 'yt-ratioed-high-text';
    } else if (ratio >= 5) {
      colorClass = 'yt-ratioed-medium-text';
    } else {
      colorClass = 'yt-ratioed-low-text';
    }
  }
  
  // Get the original title and store it
  const originalTitle = titleElement.textContent;
  titleElement.setAttribute('data-original-title', originalTitle);
  
  // Check if we're dealing with a basic title or a structure with child elements
  if (titleElement.childElementCount > 0) {
    // More complex title structure
    const innerElement = titleElement.querySelector('span') || titleElement.querySelector('div');
    
    if (innerElement) {
      // If we have an inner element, modify that
      const innerOriginalText = innerElement.textContent;
      innerElement.innerHTML = `<span class="${colorClass}">${ratioPrefix}</span>${innerOriginalText}`;
    } else {
      // Fallback if no inner element found, inject at the beginning
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = `<span class="${colorClass}">${ratioPrefix}</span>`;
      titleElement.insertBefore(tempDiv.firstChild, titleElement.firstChild);
    }
  } else {
    // Simple title element, just replace the text
    titleElement.innerHTML = `<span class="${colorClass}">${ratioPrefix}</span>${originalTitle}`;
  }
  
  // Mark as processed
  titleElement.setAttribute('data-yt-ratioed', 'true');
  
  // Also add tooltip with more info
  if (ratioData.error || ratioData.views <= 0 || ratioData.likes <= 0) {
    const errorMsg = ratioData.message || 'No likes/views available';
    titleElement.title = `Unable to retrieve data: ${errorMsg}`;
  } else {
    titleElement.title = `Likes: ${formatNumberWithCommas(ratioData.likes)}, Views: ${formatNumberWithCommas(ratioData.views)}, Ratio: ${parseFloat(ratioData.likeRatio).toFixed(2)}%`;
  }
  
  console.log(`YouTube Ratioed DEBUG: Successfully added ratio to title for video ${ratioData.videoId}`);
}

// Function to update all existing ratio labels with current settings
function updateVideoRatioLabels() {
  // Remove all ratio overlays
  document.querySelectorAll('.yt-ratioed-overlay').forEach(overlay => {
    overlay.remove();
  });
  
  // Reset the data-yt-ratioed attribute
  document.querySelectorAll('[data-yt-ratioed]').forEach(el => {
    el.removeAttribute('data-yt-ratioed');
  });
  
  // Re-add overlays with current settings
  for (const videoEl of findVideoElements()) {
    // Find the video ID
    let videoId = '';
    let videoUrl = '';
    
    const linkEl = videoEl.querySelector('a[href*="/watch"]');
    if (linkEl && linkEl.href) {
      videoUrl = linkEl.href;
      try {
        videoId = new URLSearchParams(new URL(videoUrl).search).get('v');
      } catch (e) {
        continue;
      }
    }
    
    if (videoId && videoRatios.has(videoId)) {
      addRatioOverlay(videoEl, videoRatios.get(videoId));
    }
  }
}

// Function to find video elements
function findVideoElements() {
  const selectors = [
    'ytd-rich-grid-media',
    'ytd-rich-item-renderer ytd-rich-grid-media',
    'ytd-video-renderer',
    'ytd-grid-video-renderer', 
    'ytd-rich-item-renderer',
    'ytd-compact-video-renderer',
    // Add selectors for search page
    'ytd-video-renderer.ytd-item-section-renderer',
    'ytd-compact-video-renderer.ytd-item-section-renderer',
    // Add more selectors for different types of video elements
    'ytd-watch-card-renderer',
    'ytd-playlist-video-renderer',
    'ytd-horizontal-card-list-renderer ytd-grid-video-renderer'
  ];
  
  let foundElements = [];
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    console.log(`YouTube Ratioed: Found ${elements.length} elements with selector "${selector}"`);
    
    if (elements && elements.length > 0) {
      foundElements = Array.from(elements);
      break;
    }
  }
  
  // If standard selectors failed, try to find videos by looking for thumbnails with watch links
  if (foundElements.length === 0) {
    console.log('YouTube Ratioed: Trying fallback method to find videos');
    // Look for any thumbnails that link to watch pages
    const thumbnails = document.querySelectorAll('a[href*="/watch"]');
    
    // Filter to only include proper video thumbnails
    const videoThumbnails = Array.from(thumbnails).filter(thumb => {
      // Check if this is a video thumbnail (usually has an img element)
      return thumb.querySelector('img') && 
             // Exclude playlist thumbnails
             !thumb.href.includes('&list=') &&
             // Try to walk up the DOM to find the video container
             (thumb.closest('[id*="video"]') || 
              thumb.closest('[class*="video"]') ||
              thumb.closest('ytd-rich-grid-media') || 
              thumb.closest('ytd-grid-video-renderer') ||
              thumb.closest('ytd-video-renderer') ||
              thumb.closest('ytd-compact-video-renderer'));
    });
    
    console.log(`YouTube Ratioed: Found ${videoThumbnails.length} video thumbnails with fallback method`);
    
    // Map the thumbnails to their parent containers
    foundElements = videoThumbnails.map(thumb => 
      thumb.closest('[id*="video"]') || 
      thumb.closest('[class*="video"]') ||
      thumb.closest('ytd-rich-grid-media') || 
      thumb.closest('ytd-grid-video-renderer') ||
      thumb.closest('ytd-video-renderer') ||
      thumb.closest('ytd-compact-video-renderer') ||
      thumb
    );
  }
  
  console.log(`YouTube Ratioed: Returning ${foundElements.length} video elements`);
  return foundElements;
}

// Function to fetch video details by ID (views, likes, comments)
async function fetchVideoDetails(videoId) {
  console.log(`YouTube Ratioed DEBUG: Fetching details for video ${videoId}`);
  
  try {
    // Retrieve the API key from storage
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(['apiKey'], (settings) => {
        if (!settings.apiKey) {
          console.error('YouTube Ratioed ERROR: No YouTube API key provided');
          resolve({ views: -1, likes: -1, error: true, message: 'No YouTube API key provided' });
          return;
        }
        
        const apiKey = settings.apiKey;
        
        // Use YouTube Data API v3 to get video statistics
        fetchFromYouTubeAPI(videoId, apiKey)
          .then(data => resolve(data))
          .catch(error => {
            console.error('YouTube Ratioed ERROR: YouTube API error:', error);
            resolve({ views: -1, likes: -1, error: true, message: error.message || 'YouTube API error' });
          });
      });
    });
  } catch (error) {
    console.error(`YouTube Ratioed ERROR: Failed to fetch video details for ${videoId}:`, error);
    return { views: -1, likes: -1, error: true, message: error.message || 'Unknown error' };
  }
}

// Function to fetch video details from YouTube API
async function fetchFromYouTubeAPI(videoId, apiKey) {
  console.log(`YouTube Ratioed DEBUG: Fetching from YouTube API for ${videoId}`);
  
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=statistics&key=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: `HTTP error ${response.status}` } }));
      throw new Error(errorData.error ? errorData.error.message : `HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check if we have items in the response
    if (!data.items || data.items.length === 0) {
      console.error(`YouTube Ratioed ERROR: Video ${videoId} not found or API quota exceeded`);
      return { views: -1, likes: -1, error: true, message: 'Video not found or API quota exceeded' };
    }
    
    // Extract statistics
    const statistics = data.items[0].statistics;
    
    if (!statistics) {
      console.error(`YouTube Ratioed ERROR: No statistics found for video ${videoId}`);
      return { views: -1, likes: -1, error: true, message: 'No statistics found for video' };
    }
    
    const views = parseInt(statistics.viewCount || '0');
    const likes = parseInt(statistics.likeCount || '0');
    
    console.log(`YouTube Ratioed DEBUG: API data for ${videoId} - Views: ${views}, Likes: ${likes}`);
    
    return { views, likes, error: false };
  } catch (error) {
    console.error(`YouTube Ratioed ERROR: YouTube API fetch error for ${videoId}:`, error);
    return { views: -1, likes: -1, error: true, message: error.message || 'YouTube API fetch error' };
  }
}

// Helper function to find video elements in a specific node
function findVideoElementsInNode(node) {
  console.log('YouTube Ratioed DEBUG: Finding video elements in node', node);
  const selectors = [
    'ytd-rich-grid-media',
    'ytd-rich-item-renderer ytd-rich-grid-media',
    'ytd-video-renderer',
    'ytd-grid-video-renderer', 
    'ytd-rich-item-renderer',
    'ytd-compact-video-renderer'
  ];
  
  let foundElements = [];
  
  try {
    for (const selector of selectors) {
      if (!node.querySelectorAll) {
        console.log('YouTube Ratioed DEBUG: Node does not have querySelectorAll method');
        continue;
      }
      
      const elements = node.querySelectorAll(selector);
      if (elements && elements.length > 0) {
        console.log(`YouTube Ratioed DEBUG: Found ${elements.length} elements with selector "${selector}" in node`);
        foundElements = Array.from(elements);
        break;
      }
    }
    
    // If node itself is a video element
    if (node.matches) {
      for (const selector of selectors) {
        if (node.matches(selector)) {
          console.log('YouTube Ratioed DEBUG: Node itself matches a video element selector');
          foundElements.push(node);
          break;
        }
      }
    }
  } catch (error) {
    console.error('YouTube Ratioed ERROR finding video elements in node:', error);
  }
  
  return foundElements;
}

// Function to find video elements that don't have ratio labels yet
function findVideoElementsWithoutLabels() {
  console.log('YouTube Ratioed DEBUG: Finding video elements without ratio labels');
  try {
    const allVideos = findVideoElements();
    const videosWithoutLabels = allVideos.filter(videoEl => !videoEl.querySelector('.yt-ratioed-overlay') && !videoEl.hasAttribute('data-yt-ratioed'));
    console.log(`YouTube Ratioed DEBUG: Found ${videosWithoutLabels.length} videos without labels out of ${allVideos.length} total`);
    return videosWithoutLabels;
  } catch (error) {
    console.error('YouTube Ratioed ERROR finding videos without labels:', error);
    return [];
  }
}

// Helper function to extract number from strings like "123K views"
function extractNumber(text) {
  if (!text) return 0;
  
  try {
    console.log('YouTube Ratioed DEBUG: Extracting number from', text);
    
    // Remove commas and spaces
    text = text.replace(/[\s,]/g, '');
    
    // Try to match patterns like "123K" or "1.2M"
    const match = text.match(/(\d+(?:\.\d+)?)[KkMmBb]?/);
    if (match) {
      let num = parseFloat(match[0].replace(/[KkMmBb]/i, ''));
      
      if (/K/i.test(match[0])) {
        num *= 1000;
      } else if (/M/i.test(match[0])) {
        num *= 1000000;
      } else if (/B/i.test(match[0])) {
        num *= 1000000000;
      }
      
      console.log('YouTube Ratioed DEBUG: Extracted number:', num);
      return Math.round(num);
    }
    
    // If no match with K/M/B, try to extract just digits
    const digits = text.match(/\d+/);
    if (digits) {
      const num = parseInt(digits[0]);
      console.log('YouTube Ratioed DEBUG: Extracted number (digits only):', num);
      return num;
    }
    
    return 0;
  } catch (error) {
    console.error('YouTube Ratioed ERROR extracting number:', error);
    return 0;
  }
}

// Status message functions
function showStatusMessage(message, autoHideMs = 0) {
  console.log('YouTube Ratioed DEBUG: Showing status message:', message);
  let statusElement = document.getElementById('yt-ratioed-status');
  if (!statusElement) {
    statusElement = document.createElement('div');
    statusElement.id = 'yt-ratioed-status';
    statusElement.className = 'yt-ratioed-status';
    document.body.appendChild(statusElement);
  }
  
  statusElement.textContent = message;
  statusElement.style.display = 'block';
  
  if (autoHideMs > 0) {
    setTimeout(() => {
      hideStatusMessage();
    }, autoHideMs);
  }
}

function updateStatusMessage(message) {
  console.log('YouTube Ratioed DEBUG: Updating status message:', message);
  const statusElement = document.getElementById('yt-ratioed-status');
  if (statusElement) {
    statusElement.textContent = message;
  } else {
    showStatusMessage(message);
  }
}

function hideStatusMessage() {
  console.log('YouTube Ratioed DEBUG: Hiding status message');
  const statusElement = document.getElementById('yt-ratioed-status');
  if (statusElement) {
    statusElement.style.display = 'none';
  }
}

// Initialize
(() => {
  console.log('YouTube Ratioed: Content script loaded');
  // Wait for page to be fully loaded
  if (document.readyState === 'complete') {
    detectPageType();
  } else {
    window.addEventListener('load', () => detectPageType());
  }
})();