# Quick Start Guide for eXide Users

## Important: How to Run the Script

The `add-plaine-easie-incipit.xq` script is designed to process MEI files **stored in your eXist-db database**, not files open in the eXide editor.

### Step-by-Step Instructions

#### 1. Upload Your MEI File to the Database

First, you need to store your MEI file in the database collection:

**Option A: Using eXide**
1. In eXide, click "File" → "Save As"
2. Navigate to `/db/tunes/8.8.8.8/`
3. Save your MEI file there (e.g., `myfile.xml`)

**Option B: Using the Collection Browser**
1. Open the eXist-db dashboard
2. Go to "Collections"
3. Navigate to `/db/tunes/8.8.8.8/`
4. Upload your MEI file

#### 2. Run the Script

1. Open `add-plaine-easie-incipit.xq` in eXide
2. Click the "Eval" button (or press Ctrl+Enter)
3. The script will process **all** MEI files in `/db/tunes/8.8.8.8/`

#### 3. Verify the Results

1. Open your MEI file from the database
2. Check that the `<incip>` element now contains all 4 `<incipCode>` forms:
   - `plaineAndEasie`
   - `pitchclass`
   - `signedinterval`
   - `contour`

### Common Issues and Solutions

#### Issue: "No files processed" or "0 results"

**Cause**: Your MEI file is not in the expected collection path

**Solution**: 
- Verify your file is saved at `/db/tunes/8.8.8.8/yourfile.xml`
- OR change line 363 in the script to match your collection path

#### Issue: "Script doesn't process my currently open file"

**Cause**: The script uses `collection()` which searches the database, not open files

**Solution**: Save your file to the database first (see Step 1 above)

#### Issue: "File has incip but no incipCodes are generated"

**Possible Causes**:
1. **File structure**: Ensure your MEI file has:
   - `<workList>` → `<work>` → `<incip>`
   - Musical content in `<music>` → `<body>` → measures with notes

2. **Missing staffDef**: The script needs `staffDef[@n="1"]` with clef, key sig, and meter

3. **No notes**: The script needs notes in staff 1, layer 1

### Testing on a Single File

If you want to test on a specific file instead of processing all files, modify line 363:

**Original (processes all files in collection):**
```xquery
for $doc in collection("/db/tunes/8.8.8.8/")//mei:mei
```

**Modified (processes single file):**
```xquery
for $doc in doc("/db/tunes/8.8.8.8/yourfile.xml")//mei:mei
```

Replace `yourfile.xml` with your actual filename.

### Using simple-test.xq

Before running the main script, use `simple-test.xq` to verify your setup:

1. Open `simple-test.xq` in eXide
2. Update line 11 with your collection path
3. Click "Eval"
4. Check the results to see if your files are found

This will tell you:
- ✓ If the collection exists
- ✓ How many MEI files are found
- ✓ Which files will be processed
- ✓ Any structure issues

### Need More Help?

See `TROUBLESHOOTING.md` for detailed troubleshooting steps, including:
- Common eXist-db errors
- File structure requirements
- Debugging techniques
