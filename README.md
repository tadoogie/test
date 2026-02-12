# Plaine and Easie IncipiCode Accidental Fix

⚠️ **IMPORTANT**: If you're getting "Content is not allowed in prolog" error, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md). You must use **eXide** (not REST API) to run these scripts.

This repository contains an XQuery script to fix the encoding of accidentals in Plaine and Easie incipCode elements within MEI (Music Encoding Initiative) files.

## The Problem

The Plaine and Easie specification states that only accidentals NOT covered by the key signature should be encoded. However, the previous version of the script was encoding ALL accidentals, including those already defined by the key signature.

For example, in a key signature of 1 flat (B♭):
- **Incorrect**: B♭ notes were encoded as `bB`
- **Correct**: B♭ notes should be encoded as just `B` (flat is implied)

Additionally, the script was not processing files that already had incipCode elements, returning 0 results when run on existing databases.

## The Solution

This update includes:

1. **Accidental Filtering Logic**: New function `local:is-accidental-in-key-sig()` that checks if an accidental is covered by the key signature (supports 1-7 flats and 1-7 sharps)

2. **Always Regenerate plaineAndEasie**: The script now ALWAYS regenerates the plaineAndEasie incipCode to apply the fix, even if one already exists

3. **Process All Files**: Updated WHERE clause to process ALL files with `<incip>` elements, not just those missing incipCodes

## Files in This Repository

### Core Script
- **`add-plaine-easie-incipit.xq`** - Main XQuery script to update/add incipCodes in MEI files

### Utilities
- **`diagnostic-script.xq`** - Run this first to verify your eXist-db database structure and see how many files will be processed

### Test Files
- **`Ps47.xml`** - Example MEI file demonstrating the fix (key signature 1f - B♭)

## Quick Start

⚠️ **IMPORTANT**: Use eXide (the web-based IDE) to run these scripts, NOT the REST API or direct file access.

### Step 0: Access eXide

1. Open your browser
2. Go to: `http://localhost:8080/exist/apps/eXide/` (adjust host/port as needed)
3. Or from eXist-db dashboard, click the "eXide" icon

### Step 1: Run Simple Test (First Time Users)

1. Open `simple-test.xq` in eXide (File → Open or copy/paste content)
2. Update line 11: `let $collection-path := "/db/tunes/8.8.8.8/"`
3. Click "Eval" button (or press Ctrl+Enter)
4. Review the test results to verify your setup

### Step 2: Run Diagnostic (Optional but Recommended)

1. Open `diagnostic-script.xq` in eXide
2. Update the collection path on line 9
3. Click "Eval" to see:
   - How many MEI documents are in your collection
   - How many have the required structure
   - Sample files that will be processed

### Step 3: Update Main Script

1. Open `add-plaine-easie-incipit.xq` in eXide
2. Find line 363: `for $doc in collection("/db/tunes/8.8.8.8/")//mei:mei`
3. Change `/db/tunes/8.8.8.8/` to your actual collection path
4. Save (optional, can run without saving)

### Step 4: Run Main Script

1. Click "Eval" button in eXide
2. The script will:
   - Process ALL MEI files with `<incip>` elements
   - Regenerate plaineAndEasie with corrected accidental encoding
   - Generate missing pitchclass, signedinterval, and contour codes
   - Preserve existing pitchclass, signedinterval, and contour codes
3. Check the output panel for results

## What Gets Changed

For each MEI file processed:

| incipCode Form | Behavior |
|---------------|----------|
| **plaineAndEasie** | ✅ Always regenerated with corrected accidental logic |
| **pitchclass** | Generated if missing, preserved if exists |
| **signedinterval** | Generated if missing, preserved if exists |
| **contour** | Generated if missing, preserved if exists |

## Example Output

### Before Fix
```xml
<incipCode form="plaineAndEasie">
%G-2 $bB @4/4 9A''C/'2bB'bB'A'A/'2A'bB'G'G/'9xF/...
</incipCode>
```
- 9 instances of 'bB' (1 in key sig + 8 redundant)

### After Fix
```xml
<incipCode form="plaineAndEasie">
%G-2 $bB @4/4 9A''C/'2B'B'A'A/'2A'B'G'G/'9xF/...
</incipCode>
```
- 1 instance of 'bB' (only in key signature declaration $bB)
- All B♭ notes now encoded as 'B' (flat implied by key signature)
- F♯ still encoded as 'xF' (not in key signature)

## Key Signatures Supported

The script correctly handles all standard key signatures:

**Flats**: 1f through 7f (B♭, B♭E♭, B♭E♭A♭, B♭E♭A♭D♭, B♭E♭A♭D♭G♭, B♭E♭A♭D♭G♭C♭, B♭E♭A♭D♭G♭C♭F♭)

**Sharps**: 1s through 7s (F♯, F♯C♯, F♯C♯G♯, F♯C♯G♯D♯, F♯C♯G♯D♯A♯, F♯C♯G♯D♯A♯E♯, F♯C♯G♯D♯A♯E♯B♯)

## Troubleshooting

### Getting "Content is not allowed in prolog" Error?

This error occurs when trying to execute scripts via the REST API instead of eXide. **Solution**:

1. ✅ **Use eXide**: Go to `http://localhost:8080/exist/apps/eXide/`
2. ✅ **Copy/paste the script** into eXide's editor
3. ✅ **Click "Eval"** to execute

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed instructions.

### Getting 0 Results?

1. **Run simple-test.xq** to verify:
   - Collection path exists and contains MEI files
   - Files have the required structure (`<workList>` → `<work>` → `<incip>`)
   
2. **Try a broader path**: Change `/db/tunes/8.8.8.8/` to `/db/tunes/`

3. **Test on single file**: 
   ```xquery
   for $doc in (doc("/db/tunes/8.8.8.8/Ps47.xml")//mei:mei)
   ```

### Files Not Being Updated?

Ensure your MEI files have this structure:
```xml
<mei xmlns="http://www.music-encoding.org/ns/mei">
  <meiHead>
    <workList>
      <work>
        <incip>
          <!-- incipCodes will be added/updated here -->
        </incip>
      </work>
    </workList>
  </meiHead>
  <music>
    <!-- Musical content -->
  </music>
</mei>
```

## Technical Details

### Changes to `add-plaine-easie-incipit.xq`

1. **New Function**: `local:is-accidental-in-key-sig($pname, $accid, $key-sig)`
   - Lines 78-99
   - Returns true if the accidental is covered by the key signature

2. **Modified Function**: `local:process-notes($notes, $first-note-in-piece, $key-sig)`
   - Line 130: Added $key-sig parameter
   - Lines 169-174: Conditional logic to exclude redundant accidentals

3. **Updated WHERE Clause**: Line 378
   - Old: `where not($has-pae) or not($has-pc) or not($has-si) or not($has-contour)`
   - New: `where $incip`

4. **Always Regenerate plaineAndEasie**: Lines 384-386
   - Removed conditional check
   - Always calls `local:extract-melody($doc)`

## License & Attribution

This script processes MEI files for musicological research. Please ensure compliance with your institution's data handling policies when running on production databases.

## Support

If you encounter issues:
1. Run diagnostic-script.xq to verify your setup
2. Test on a single file first
3. Check that files have the required MEI structure
4. Verify collection path is correct

## Version History

- **v2.0** (2026-02-12): Fixed WHERE clause, always regenerate plaineAndEasie, added diagnostic script
- **v1.0**: Initial release with accidental filtering logic
