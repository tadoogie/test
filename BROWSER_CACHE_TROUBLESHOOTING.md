# Browser Cache Issue - Troubleshooting Guide

## Problem
You've updated `app-dev.js` with debugging code, but the changes aren't showing up in the browser. The old version is still being served due to **browser cache**.

## Quick Fix - Force Refresh

### Windows/Linux:
- **Chrome/Edge/Firefox**: Press `Ctrl + Shift + R` or `Ctrl + F5`
- **Alternative**: Hold `Ctrl` and click the refresh button

### Mac:
- **Chrome/Edge/Firefox**: Press `Cmd + Shift + R` or `Shift + Reload Button`
- **Safari**: Press `Option + Cmd + R`

## Step-by-Step Solution

### 1. Hard Refresh (Recommended)
1. Open your website
2. Open DevTools (F12 or Cmd+Option+I on Mac)
3. Go to the Console tab
4. Perform a hard refresh using the keyboard shortcuts above
5. Look for the version banner in the console

### 2. Clear Browser Cache Completely
If hard refresh doesn't work:

**Chrome/Edge:**
1. Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
2. Select "Cached images and files"
3. Choose "All time" for time range
4. Click "Clear data"

**Firefox:**
1. Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
2. Select "Cache"
3. Choose "Everything" for time range
4. Click "Clear Now"

**Safari:**
1. Safari menu → Preferences → Advanced
2. Check "Show Develop menu in menu bar"
3. Develop menu → Empty Caches

### 3. Disable Cache in DevTools (Best for Development)
1. Open DevTools (F12)
2. Go to Network tab
3. Check "Disable cache" checkbox
4. Keep DevTools open while testing
5. Refresh the page

### 4. Verify Correct File is Loaded

After refreshing, you should see this **VERSION BANNER** at the top of the console:

```
═══════════════════════════════════════════════════════════
🎵 APP-DEV.JS VERSION 2.2 - LOADED SUCCESSFULLY 🎵
═══════════════════════════════════════════════════════════
If you see this message, the updated app-dev.js is loaded!
Debugging features: Spinner logs with emoji indicators 🔄✅🎨
Minimum spinner display time: 500ms
═══════════════════════════════════════════════════════════
```

**If you don't see this banner:**
- The old version is still cached
- Try the cache clearing steps above
- Try in an incognito/private browsing window

### 5. Check Network Tab
To verify which file is being loaded:

1. Open DevTools (F12)
2. Go to Network tab
3. Refresh the page
4. Find `app-dev.js` in the list
5. Check the "Size" column:
   - If it says "(memory cache)" or "(disk cache)" → old version cached
   - If it shows a file size (e.g., "92.3 KB") → file was fetched from server
6. Right-click on app-dev.js → Open in new tab
7. Search for "VERSION 2.2" in the opened file
   - If found → correct version
   - If not found → wrong version being served

## After Cache is Cleared

Once you see the version banner, when you load a score you should see:

```
🔄 [SPINNER] showLoadingSpinner() called
✅ [SPINNER] Spinner HTML set, start time: 1770760998523
🎨 [SPINNER] Forced reflow to ensure paint
⏰ [LOAD] Scheduling processing with setTimeout(50ms)
🚀 [LOAD] setTimeout callback executing - starting Verovio processing
⚡ [LOAD] Verovio processing completed in XXms
⏱️ [SPINNER] Time elapsed: XXms, minimum: 500ms
⏳ [SPINNER] Waiting additional XXms to meet minimum display time
✅ [SPINNER] Minimum display time met, executing callback
🖼️ [LOAD] Calling loadPage() to display rendered content
✅ [LOAD] loadDataWithLayerVolumes() complete
```

## Alternative: Incognito/Private Mode

If all else fails, open your site in an incognito/private window:
- **Chrome**: Ctrl+Shift+N (Windows) or Cmd+Shift+N (Mac)
- **Firefox**: Ctrl+Shift+P (Windows) or Cmd+Shift+P (Mac)
- **Safari**: Cmd+Shift+N (Mac)

Incognito mode starts with a clean cache and will load the latest version.

## For Server Administrators

If you're serving the files yourself, you can add cache-busting headers:

```apache
# Apache .htaccess
<FilesMatch "\.(js|css)$">
  Header set Cache-Control "no-cache, no-store, must-revalidate"
  Header set Pragma "no-cache"
  Header set Expires 0
</FilesMatch>
```

Or add a version query parameter to the script tag:
```html
<script src="app-dev.js?v=2.2"></script>
```

## Still Having Issues?

If you still don't see the debug logs after clearing cache:

1. Check browser console for any JavaScript errors
2. Verify the file path is correct in your HTML
3. Check file permissions on the server
4. Try a different browser
5. Check if a CDN or proxy is caching the file

## Contact Information

If problems persist after trying all these steps, please provide:
- Browser name and version
- Screenshot of browser console showing the output
- Screenshot of Network tab showing app-dev.js being loaded
- Whether incognito mode works
