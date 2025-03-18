# YouTube Ratioed Chrome Extension

A Chrome extension that identifies and highlights YouTube videos with high engagement ratios (comments-to-views or likes-to-views).

## Features

- Find videos with high comment-to-view ratios (default)
- Or switch to find videos with high like-to-view ratios
- Set minimum ratio threshold to filter results
- Configure maximum number of results to display
- Works on YouTube trending and search results pages
- Filter by time period (any, today, this week, this month)
- Responsive UI with dark mode support

## Installation

### Option 1: Install from Chrome Web Store (Coming Soon)

*Note: This extension is not yet available on the Chrome Web Store. Once published, installation instructions will be updated.*

### Option 2: Install in Developer Mode

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the `extension` directory from this repository
5. The extension should now appear in your extensions list and be ready to use

## Usage

1. **Configure Settings**
   - Click the YouTube Ratioed extension icon in your toolbar
   - Set your preferred ratio type (comments-to-views or likes-to-views)
   - Adjust the minimum ratio percentage
   - Set the maximum number of results
   - Click "Save Settings"

2. **Scan YouTube Pages**
   - Navigate to YouTube search results or trending pages
   - Click the extension icon to open the popup
   - Click "Scan Current Page"
   - Results will appear in the popup, sorted by the ratio you selected

3. **View Results**
   - Click on any video title to open it in a new tab
   - Results show the video thumbnail, title, channel name, views, comments/likes, and the calculated ratio

## Icon Replacement

Before using this extension, you'll need to replace the placeholder icon files in the `images` directory with actual PNG icons:

- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can create your own icons or use a free icon generator online.

## Development

### Project Structure

```
extension/
├── css/
│   ├── content.css    # Styles for content script
│   └── popup.css      # Styles for popup UI
├── images/
│   ├── icon16.png     # Extension icon (16x16)
│   ├── icon48.png     # Extension icon (48x48)
│   └── icon128.png    # Extension icon (128x128)
├── js/
│   ├── background.js  # Background service worker
│   ├── content.js     # Content script for YouTube pages
│   └── popup.js       # Popup UI functionality
├── manifest.json      # Extension manifest
├── popup.html         # Popup UI HTML
└── README.md          # This file
```

### Customization

Feel free to modify any of the code to suit your needs. The main files you might want to customize:

- `content.js`: Contains scraping logic to extract video information
- `popup.html` and `popup.css`: Change the UI appearance
- `manifest.json`: Update permissions or metadata

## License

MIT License 