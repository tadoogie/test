# Fix: Suggested Tune Button Using Full Path

## Problem
When clicking the suggested tune button and then clicking GO, a 404 error occurred:
```
GET http://3.9.17.247:8080/exist/apps/splitleaf-demo/SL44 404 (Not Found)
```

The suggested tune button was passing just the tune identifier "SL44" instead of the full path to the MEI file.

## Root Cause
In `getTunes.xq`, the suggested tune data structure was using:
```xquery
"id": $tune//mei:identifier/text()
```

This only extracted the identifier (e.g., "SL44"), not the full file path.

## Solution
Changed line 65 in `getTunes.xq` to use the **exact same format** as regular tune buttons (line 30):

```xquery
"id": concat("/exist/rest", base-uri($tune))
```

This generates the complete path like `/exist/rest/db/tunes/SL44.xml` instead of just `SL44`.

## How Regular Tune Buttons Work
Regular tune buttons in the tune list use this format (lines 28-30):
```xquery
map {
  "label": concat($tune//mei:work/mei:title/text(), " (", $tune//mei:edition/mei:date/text(), ")"),
  "id": concat("/exist/rest", base-uri($tune))
}
```

The suggested tune button now uses the identical format.

## Result
✅ The suggested tune button now passes the correct full path to `app-dev.js`  
✅ The XMLHttpRequest at line 1650 of `app-dev.js` receives a valid URL  
✅ The MEI file loads successfully  
✅ No more 404 errors

## Files Changed
- `getTunes.xq` (line 65): Changed suggested tune ID format to match regular buttons
