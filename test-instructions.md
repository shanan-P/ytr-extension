# YouTube Ratioed Test Instructions

## Testing the Toggle Button

1. Load the extension in Chrome by going to `chrome://extensions/` and enabling Developer Mode
2. Click "Load unpacked" and select the extension folder
3. Click on the YouTube Ratioed extension icon to open the popup
4. Try clicking the "Enable Ratio Display" toggle switch
   - It should immediately save the setting without requiring you to click "Save Settings"
   - You should see a status message confirming the change

## Testing Homepage Behavior

1. Navigate to the YouTube homepage (https://www.youtube.com/)
2. Verify that:
   - No scan button appears on the page
   - If you click the extension icon and try to scan, it should tell you scanning isn't supported on the homepage

## Testing Search Pages

1. Navigate to a YouTube search page (search for anything)
2. Click the extension icon
3. Verify that:
   - The "Scan YouTube Page" button is enabled
   - The toggle button correctly reflects your enabled/disabled setting

## Bug Reports and Feedback

If you encounter any issues with the extension, please provide:
1. The specific page URL where the issue occurred
2. What action you performed
3. What you expected to happen
4. What actually happened
5. Any error messages in the Chrome console (press F12 to open DevTools, then check the Console tab) 