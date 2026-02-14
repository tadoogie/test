# Fix: Suggested Tune Button Using Client-Side Lookup (Procedural Fix)

## Problem
After the first fix attempt (modifying getTunes.xq to use base-uri), the system dramatically slowed down and sometimes the score wouldn't render. The user correctly identified this as a **procedural problem**, not a data problem.

## Root Cause Analysis

### How Regular Tune Buttons Work:
1. Server sends tune list with full paths: `{label: "TUNE (date)", id: "/exist/rest/db/tunes/..."}`
2. Client builds lookup table: `window._pstuneMap[label] = id`
3. When button is clicked: `const mappingId = window._pstuneMap[lbl] || ''`
4. Result: Gets full path from **client-side cache**

### How Suggested Tune Button Was Working (WRONG):
1. Server sends tune with identifier: `data-tuneid="SL44"`
2. When button is clicked: `const mappingId = suggTuneBtn.dataset.tuneid || ''`
3. Result: Gets incomplete identifier, causes 404

### Why First Fix Failed:
My first fix tried to make getTunes.xq do extra lookups to build the full path for the suggested tune. This:
- Added server-side processing overhead
- Required additional database queries
- Slowed down every tune list request
- Sometimes timed out

## The Correct Solution (Procedural Fix)

**Changed ONE line in interface-dev.js (line 606):**

```javascript
// Before (WRONG - uses server data directly)
const mappingId = suggTuneBtn.dataset.tuneid || '';

// After (CORRECT - uses client-side lookup)
const mappingId = window._pstuneMap[lbl] || '';
```

## Why This Works

1. **The suggested tune is already in the tune list** - it's not special, it's just highlighted
2. **`window._pstuneMap` already contains the full path** for ALL tunes including the suggested one
3. **No server changes needed** - getTunes.xq stays fast and simple
4. **Uses existing infrastructure** - the same lookup mechanism regular buttons use

## Data Flow (Corrected)

```
Server (getTunes.xq):
  - Generates tune list with full paths
  - Marks one tune as "suggested" (cosmetic only)
  ↓
Client (interface-dev.js):
  - Builds window._pstuneMap from tune list
  - Map contains: {"BELMONT (47a)": "/exist/rest/db/tunes/SL47a.xml", ...}
  ↓
When ANY button is clicked (regular OR suggested):
  - Get label from button: lbl = button.dataset.label
  - Look up full path: mappingId = window._pstuneMap[lbl]
  - Use full path in XMLHttpRequest
```

## Benefits

✅ **Fast** - No extra server processing  
✅ **Simple** - Uses existing lookup mechanism  
✅ **Consistent** - Suggested tune works exactly like regular tunes  
✅ **Maintainable** - One code path for all tune selections  
✅ **No 404 errors** - Always gets correct full path  

## Files Changed

- **interface-dev.js** (line 606): Changed suggested tune button click handler to use `window._pstuneMap[lbl]` instead of `suggTuneBtn.dataset.tuneid`
- **getTunes.xq**: No changes needed (reverted to original fast version)

## Lesson Learned

The user was right to question the approach. The problem wasn't about what data to put in the button, but about **HOW to get the data when the button is clicked**. The procedural solution (using the existing client-side lookup) is simpler, faster, and more maintainable than trying to fix it on the server side.
