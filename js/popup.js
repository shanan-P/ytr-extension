// YouTube Ratioed Extension Popup JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const apiKeyInput = document.getElementById('api-key');
  const minRatioInput = document.getElementById('min-ratio');
  const maxResultsInput = document.getElementById('max-results');
  const enabledTrueRadio = document.getElementById('enabled-true');
  const enabledFalseRadio = document.getElementById('enabled-false');
  const saveButton = document.getElementById('save-settings');
  const scanButton = document.getElementById('scan-page');
  const clearButton = document.getElementById('clear-ratios');
  const statusDiv = document.getElementById('status');
  const infoSection = document.getElementById('info-section');

  // Load settings when popup opens
  loadSettings();

  // Event listeners
  saveButton.addEventListener('click', saveSettings);
  scanButton.addEventListener('click', scanCurrentPage);
  clearButton.addEventListener('click', clearRatios);
  
  // Add listeners to the radio buttons for immediate feedback
  enabledTrueRadio.addEventListener('change', function() {
    if (this.checked) {
      console.log('Radio button changed: Enabling extension');
      showStatus('Enabling extension...', 1000);
      saveSettingsWithEnabledState(true);
    }
  });
  
  enabledFalseRadio.addEventListener('change', function() {
    if (this.checked) {
      console.log('Radio button changed: Disabling extension');
      showStatus('Disabling extension...', 1000);
      saveSettingsWithEnabledState(false);
    }
  });

  // Functions
  function loadSettings() {
    chrome.storage.sync.get(['apiKey', 'minRatio', 'maxResults', 'enabled'], (settings) => {
      console.log('Loaded settings:', settings);
      apiKeyInput.value = settings.apiKey || '';
      minRatioInput.value = settings.minRatio || 0.5;
      maxResultsInput.value = settings.maxResults || 50;
      
      // Default to true if not explicitly set to false
      const isEnabled = settings.enabled !== false;
      console.log('Setting radio buttons to:', isEnabled);
      
      // Set the appropriate radio button
      if (isEnabled) {
        enabledTrueRadio.checked = true;
        enabledFalseRadio.checked = false;
      } else {
        enabledTrueRadio.checked = false;
        enabledFalseRadio.checked = true;
      }
      
      // Check if we're on a YouTube or Google search page
      checkCurrentPage();
    });
  }

  function saveSettingsWithEnabledState(isEnabled) {
    // Get current values
    const apiKey = apiKeyInput.value.trim();
    const minRatio = parseFloat(minRatioInput.value) || 0.5;
    const maxResults = parseInt(maxResultsInput.value) || 50;
    
    console.log('Quick-saving settings with enabled state:', isEnabled);
    
    // Save settings immediately
    const settings = {
      apiKey: apiKey,
      minRatio: minRatio,
      maxResults: maxResults,
      enabled: isEnabled
    };
    
    chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: settings
    }, (response) => {
      if (response && response.success) {
        showStatus(`Extension ${isEnabled ? 'enabled' : 'disabled'}`, 2000);
      } else {
        showStatus('Error saving settings', 2000);
        // Revert radio buttons if there was an error
        if (isEnabled) {
          enabledTrueRadio.checked = false;
          enabledFalseRadio.checked = true;
        } else {
          enabledTrueRadio.checked = true;
          enabledFalseRadio.checked = false;
        }
      }
    });
  }

  function saveSettings() {
    // Validate inputs
    const apiKey = apiKeyInput.value.trim();
    const minRatio = parseFloat(minRatioInput.value);
    const maxResults = parseInt(maxResultsInput.value);
    const enabled = enabledTrueRadio.checked;
    
    console.log('Saving settings:', { apiKey: apiKey ? '(set)' : '(empty)', minRatio, maxResults, enabled });
    
    if (apiKey === '') {
      showStatus('YouTube API Key is required');
      return;
    }
    
    if (isNaN(minRatio) || minRatio < 0) {
      showStatus('Minimum ratio must be a positive number');
      return;
    }
    
    if (isNaN(maxResults) || maxResults < 1) {
      showStatus('Maximum results must be at least 1');
      return;
    }
    
    // Save settings
    const settings = {
      apiKey: apiKey,
      minRatio: minRatio,
      maxResults: maxResults,
      enabled: enabled
    };
    
    chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: settings
    }, (response) => {
      if (response && response.success) {
        showStatus(`Settings saved! Extension ${enabled ? 'enabled' : 'disabled'}.`, 2000);
      } else {
        showStatus('Error saving settings', 2000);
      }
    });
  }

  function scanCurrentPage() {
    // Get API key
    chrome.storage.sync.get(['apiKey', 'enabled'], (settings) => {
      if (!settings.apiKey) {
        showStatus('Please enter a YouTube API Key in the settings', 3000);
        return;
      }
      
      if (settings.enabled === false) {
        showStatus('Ratio display is currently disabled. Enable it in settings to see ratios.', 3000);
        return;
      }
      
      // Check if we're on a YouTube or Google search page
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        const isYouTube = currentTab.url.includes('youtube.com');
        const isGoogleSearch = currentTab.url.includes('google.com/search');
        
        if (isYouTube || isGoogleSearch) {
          showStatus('Initiating scan...');
          
          // Send message to analyze the page
          chrome.runtime.sendMessage({ action: 'analyze' }, (response) => {
            console.log('YouTube Ratioed DEBUG: Analyze response:', response);
            if (response && response.success) {
              showStatus('Scanning in progress...', 2000);
            } else {
              const errorMsg = (response && response.error) ? response.error : 'Unknown error';
              console.error('YouTube Ratioed ERROR: Scan failed:', errorMsg);
              showStatus('Error starting scan: ' + errorMsg, 5000);
              
              // If there's a specific error that suggests reloading
              if (errorMsg.includes('Content script not found') || 
                  errorMsg.includes('Could not establish connection')) {
                setTimeout(() => {
                  showStatus('Please try refreshing the page and trying again.', 5000);
                }, 5000);
              }
            }
          });
        } else {
          showStatus('Please navigate to YouTube or a Google search page with YouTube results', 3000);
        }
      });
    });
  }

  function clearRatios() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      const isYouTube = currentTab.url.includes('youtube.com');
      const isGoogleSearch = currentTab.url.includes('google.com/search');
      
      if (isYouTube || isGoogleSearch) {
        showStatus('Clearing ratio displays...');
        
        // Send message to clear the ratios
        chrome.tabs.sendMessage(currentTab.id, { action: 'clearRatios' }, (response) => {
          if (response && response.success) {
            showStatus('Ratio displays cleared!', 2000);
          } else {
            const errorMsg = (response && response.error) ? response.error : 'Unknown error';
            showStatus('Error clearing ratios: ' + errorMsg, 3000);
          }
        });
      } else {
        showStatus('Please navigate to YouTube or a Google search page with YouTube results', 3000);
      }
    });
  }

  function checkCurrentPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      const isYouTube = currentTab.url.includes('youtube.com');
      const isGoogleSearch = currentTab.url.includes('google.com/search');
      
      if (isYouTube) {
        // Check if on YouTube homepage
        const isHomepage = currentTab.url.match(/^https?:\/\/(www\.)?youtube\.com\/?(\?.*)?$/) ||
                        currentTab.url.includes('/feed/trending') || 
                        currentTab.url.includes('/feed/explore') ||
                        currentTab.url.includes('/feed/subscriptions');
        
        if (isHomepage) {
          scanButton.textContent = 'Scan YouTube Homepage';
          scanButton.disabled = false;
          infoSection.innerHTML = `
            <p>Click the "Scan YouTube Homepage" button to analyze videos on the YouTube homepage.</p>
            <p>Videos with high ratios (10%+) are highlighted in green, medium ratios (5-10%) in orange, and lower ratios in red.</p>
            <p><strong>Note:</strong> A YouTube API Key is required for this extension to work.</p>
          `;
        } else if (currentTab.url.includes('youtube.com/results') || 
                  currentTab.url.includes('search_query=')) {
          scanButton.textContent = 'Scan YouTube Search Results';
          scanButton.disabled = false;
          infoSection.innerHTML = `
            <p>Click the "Scan YouTube Search Results" button to analyze videos in the search results.</p>
            <p>Videos with high ratios (10%+) are highlighted in green, medium ratios (5-10%) in orange, and lower ratios in red.</p>
            <p><strong>Note:</strong> A YouTube API Key is required for this extension to work.</p>
          `;
        } else {
          scanButton.textContent = 'Scan YouTube Page';
          scanButton.disabled = false;
          infoSection.innerHTML = `
            <p>Click the "Scan YouTube Page" button to analyze videos on this YouTube page.</p>
            <p>Videos with high ratios (10%+) are highlighted in green, medium ratios (5-10%) in orange, and lower ratios in red.</p>
            <p><strong>Note:</strong> A YouTube API Key is required for this extension to work.</p>
          `;
        }
      } else if (isGoogleSearch) {
        // For Google search, update button text
        scanButton.textContent = 'Scan Google Results';
        scanButton.disabled = false;
        infoSection.innerHTML = `
          <p>Click the "Scan Google Results" button to analyze YouTube videos in the search results.</p>
          <p>Videos with high ratios (10%+) are highlighted in green, medium ratios (5-10%) in orange, and lower ratios in red.</p>
          <p><strong>Note:</strong> A YouTube API Key is required for this extension to work.</p>
        `;
      } else {
        scanButton.textContent = 'Not on YouTube or Google Search';
        scanButton.disabled = true;
        infoSection.innerHTML = `
          <p>Please navigate to YouTube or a Google search page with YouTube results to use this extension.</p>
          <p><strong>Note:</strong> A YouTube API Key is required for this extension to work.</p>
        `;
      }
    });
  }

  function showStatus(message, timeout = 0) {
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    
    if (timeout > 0) {
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, timeout);
    }
  }
}); 