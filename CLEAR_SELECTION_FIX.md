# Fix: Clear Selection Button Preserves Suggested Tune

## Problem
When clicking the "Clear Selection" button on the Tunes tab, the suggested tune button and "Select a different tune:" label were being deleted.

## Root Cause
The Clear Selection button (in `interface-dev.js` line 2146) was calling:
```javascript
getTunes(currentMetre);  // e.g., getTunes("8.6.8.6")
```

This caused the `getTunes` function to incorrectly interpret the metre value as the suggested tune ID:
```javascript
// Line 556 in getTunes function
var suggTune = tuneLabel || psData[2] || "201a";
// When tuneLabel = "8.6.8.6", suggTune became "8.6.8.6" instead of the actual tune ID
```

Since there's no tune with ID "8.6.8.6", the getTunes.xq server-side script couldn't find a matching suggested tune and didn't generate the button.

## Solution
Changed the Clear Selection handler to call `getTunes('')` with an empty string:
```javascript
getTunes('');  // Pass empty string to preserve suggested tune from psData[2]
```

With an empty string:
```javascript
var suggTune = tuneLabel || psData[2] || "201a";
// tuneLabel = '' (falsy), so suggTune = psData[2] (the correct suggested tune ID)
```

Now the suggested tune ID is correctly extracted from `psData[2]`, which contains the tune suggestion from the selected psalm/text.

## Result
- ✅ Clicking "Clear Selection" now preserves the suggested tune button
- ✅ The "Select a different tune:" label is also preserved
- ✅ The tune list is reset to show all tunes for the selected metre
- ✅ The selected tune is cleared (as intended)

## Files Modified
- `interface-dev.js` (line 2147)

## Testing
To test:
1. Select a source and text (which has a suggested tune)
2. Select a tune from the list
3. Click "Clear Selection" button
4. Verify that:
   - The suggested tune button is still visible
   - The "Select a different tune:" label is still visible
   - The tune selection is cleared
   - All tunes for that metre are shown again
