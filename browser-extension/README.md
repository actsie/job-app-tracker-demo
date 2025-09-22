# Job App Tracker - Browser Extension

This browser extension allows you to capture job descriptions directly from job posting websites and automatically send them to your local Job App Tracker desktop application.

## Installation

### Chrome/Chromium-based browsers (Chrome, Edge, Opera, Brave, etc.)

1. Open your browser and navigate to `chrome://extensions/`
2. Enable "Developer mode" by clicking the toggle in the top-right corner
3. Click "Load unpacked"
4. Select the `browser-extension` folder from your Job App Tracker project
5. The extension should now appear in your extensions list and toolbar

### Firefox

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" in the left sidebar
3. Click "Load Temporary Add-on"
4. Navigate to the `browser-extension` folder and select `manifest.json`
5. The extension will be loaded temporarily (until you restart Firefox)

For a permanent installation in Firefox, you would need to package and sign the extension.

## Usage

### Method 1: Extension Popup
1. Navigate to any job posting website (LinkedIn, Indeed, Glassdoor, etc.)
2. Click the Job App Tracker extension icon in your browser toolbar
3. The popup will show the current page URL and connection status
4. Click "Capture Job Description" to extract and save the job posting
5. The popup will confirm successful capture or show any errors

### Method 2: Keyboard Shortcut
1. Navigate to any job posting website
2. Press `Ctrl+Shift+J` (or `Cmd+Shift+J` on Mac)
3. The job description will be automatically captured

## Features

- **Smart Content Detection**: Automatically finds job description content using intelligent selectors
- **Secure Communication**: Uses authentication tokens to securely communicate with your desktop app
- **Error Handling**: Provides clear feedback when the desktop app isn't running or capture fails
- **Multiple Sources**: Works with most major job posting websites
- **Fallback Options**: If specific job content isn't found, captures the main page content

## Supported Websites

The extension has been optimized for:
- LinkedIn Jobs
- Indeed
- Glassdoor
- And many other job posting websites

It uses generic selectors as fallbacks, so it should work on most job posting sites.

## Troubleshooting

### Extension won't load
- Make sure you selected the correct folder containing `manifest.json`
- Check that Developer mode is enabled (Chrome) or temporary add-ons are allowed (Firefox)

### "Connection failed" error
- Ensure your Job App Tracker desktop application is running
- Verify it's accessible at `http://localhost:3000` (or update the server URL in the extension popup)
- Check that no firewall is blocking the connection

### "Could not find job description" error
- The extension couldn't detect sufficient job description text on the current page
- Try navigating to the actual job posting page (not a list view)
- Some websites may have unusual layouts that aren't detected by the current selectors

### Authentication errors
- The extension will automatically fetch a new authentication token from your desktop app
- If this fails, ensure the desktop app is running and accessible

## Privacy & Security

- The extension only captures content when you explicitly trigger it
- All data is sent directly to your local desktop application
- No data is sent to external servers
- Authentication tokens are generated locally and expire after 24 hours
- The extension requires minimal permissions (only access to the active tab when used)

## Development

To modify the extension:

1. Edit the files in the `browser-extension` folder
2. Reload the extension in your browser's extension management page
3. Test your changes on various job posting websites

Key files:
- `manifest.json`: Extension configuration
- `popup.html` & `popup.js`: Extension popup interface
- `content.js`: Content script that runs on web pages
- `bookmarklet.js`: Standalone bookmarklet version