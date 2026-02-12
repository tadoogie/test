# Troubleshooting: "Content is not allowed in prolog" Error

## Understanding the Error

The error "Content is not allowed in prolog" typically occurs when trying to execute XQuery scripts via the eXist-db REST interface instead of using eXide (the web-based IDE).

## Common Causes

1. **Trying to execute via REST API**: The REST interface expects to receive data/queries in a specific format
2. **Using HTTP POST incorrectly**: The script needs proper HTTP headers and body formatting
3. **File upload issues**: Hidden characters or encoding problems

## Solution: Use eXide (Recommended)

### Method 1: Use eXide Web Interface (EASIEST)

This is the recommended way to run XQuery scripts in eXist-db:

1. **Access eXide**:
   - Open your browser and go to: `http://localhost:8080/exist/apps/eXide/` (adjust host/port as needed)
   - Or from eXist-db dashboard, click "eXide" icon

2. **Create a New XQuery File**:
   - Click "File" → "New" → "XQuery"
   - Paste the contents of `add-plaine-easie-incipit.xq`

3. **Update Collection Path**:
   - Find line 363: `for $doc in collection("/db/tunes/8.8.8.8/")//mei:mei`
   - Change to your actual collection path

4. **Run the Script**:
   - Click the "Eval" button (or press Ctrl+Enter)
   - The script will execute and show results in the output panel
   - This will update all matching documents in your database

### Method 2: Upload and Execute via eXide

1. **Upload the file**:
   - In eXide, click "File" → "Open"
   - Navigate to your eXist-db file system
   - Click "Upload" and select `add-plaine-easie-incipit.xq`

2. **Open and run**:
   - Select the uploaded file
   - Click "Eval" to execute

## Why the REST API Fails

The error you're seeing happens when trying to access `/exist/rest/db/` directly because:

1. The REST interface is for **retrieving** data and **executing** queries, not for uploading script files
2. The REST interface expects XML or XQuery wrapped in specific HTTP request format
3. Direct file upload via REST requires specific Content-Type headers

## Alternative: Execute via REST API (Advanced)

If you must use REST API, here's the correct way:

### Using curl:

```bash
curl -X POST \
  -H "Content-Type: application/xml" \
  -u admin:your-password \
  --data-binary @add-plaine-easie-incipit.xq \
  http://localhost:8080/exist/rest/db/
```

### Using XQuery wrapped in HTTP:

```bash
curl -X POST \
  -H "Content-Type: application/x-xquery" \
  -u admin:your-password \
  --data-binary @add-plaine-easie-incipit.xq \
  http://localhost:8080/exist/rest/db/?_query=
```

## Diagnostic Steps

### 1. Run Diagnostic Script First

Before running the main script, test with the diagnostic script:

```xquery
(: Paste this in eXide and run :)
xquery version "3.1";
declare namespace mei = "http://www.music-encoding.org/ns/mei";

let $collection-path := "/db/tunes/8.8.8.8/"  (: UPDATE THIS :)
return
<test>
  <collection-exists>{xmldb:collection-available($collection-path)}</collection-exists>
  <mei-count>{count(collection($collection-path)//mei:mei)}</mei-count>
</test>
```

### 2. Test with Single File

Test on one file before processing entire collection:

```xquery
(: Replace line 363 in main script with: :)
for $doc in (doc("/db/tunes/8.8.8.8/Ps47.xml")//mei:mei)
```

### 3. Check File Encoding

If you're copying/pasting the script:
- Make sure no extra characters are added
- Use plain text editor (not Word)
- Ensure UTF-8 encoding

## Common Mistakes to Avoid

❌ **Don't**: Try to execute by browsing to the file in eXist-db file system via web browser
✅ **Do**: Use eXide to open and execute the file

❌ **Don't**: Upload the file to `/db/` and try to access it via `/exist/rest/db/filename.xq`
✅ **Do**: Open the file in eXide and click "Eval"

❌ **Don't**: Try to POST the file contents directly to REST API without proper formatting
✅ **Do**: Use eXide or properly formatted REST API requests

## Quick Test

To verify eXist-db is working, try this simple query in eXide:

```xquery
xquery version "3.1";
"Hello from eXist-db!"
```

If this works, your eXist-db is fine and you can proceed with the main script.

## Still Having Issues?

1. **Check eXist-db is running**: Can you access the dashboard?
2. **Check permissions**: Do you have write access to the collection?
3. **Check collection path**: Does `/db/tunes/8.8.8.8/` exist?
4. **Run diagnostic-script.xq** in eXide to verify setup

## Contact Support

If problems persist:
1. Note which method you're using (eXide, REST API, other)
2. Include the exact error message
3. Confirm you can run simple queries in eXide
4. Share the collection path you're trying to access
