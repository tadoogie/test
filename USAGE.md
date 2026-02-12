# Quick Start Guide

This guide shows you how to use the scripts to remove redundant accidentals from MEI files.

## Using the Python Script (Recommended)

The Python script is the easiest way to process your MEI files.

### Process a single file:
```bash
python3 process_mei_files.py Ps47.xml
```

### Process multiple files:
```bash
python3 process_mei_files.py Ps47.xml Ps101.xml Ps102.xml
```

### Process all XML files in the current directory:
```bash
python3 process_mei_files.py
```

## Example Output

When you run the script, you'll see:

```
Processing 1 file(s)...

Processing Ps47.xml:
  Original:  %G-2 $bB @4/4 9A''C/'2A'G'F'G/'2G'F'F'nE/'9F/'9A''C/'2bB'bB'A'A/'2A'bB'G'G/'9xF/...
  Processed: %G-2 $bB @4/4 9A''C/'2A'G'F'G/'2G'F'F'nE/'9F/'9A''C/'2B'B'A'A/'2A'B'G'G/'9xF/...
  ✓ Updated Ps47.xml

============================================================
Processed 1 file(s), modified 1 file(s).
```

## What Gets Changed?

The script removes accidentals that match the key signature:

### Example 1: Key with 1 flat (B♭)
- Key signature: `$bB`
- Before: `'2bB'bB'A'A`
- After: `'2B'B'A'A`
- Explanation: B is already flat in the key signature, so the `b` is redundant

### Example 2: Accidentals that differ are preserved
- Key signature: `$bB` (B is flat)
- Before: `'nE/'9xF`
- After: `'nE/'9xF` (unchanged)
- Explanation: 
  - `nE` (natural E) is kept - E is not in the key signature, so natural is explicit
  - `xF` (sharp F) is kept - F is not affected by the key signature with 1 flat

### Example 3: Key with 2 flats (B♭, E♭)
- Key signature: `$bBE`
- Before: `'2bB'bE'A'A`
- After: `'2B'E'A'A`
- Explanation: Both B and E are flat in the key signature

## Verifying Changes

After running the script, you can verify the changes with:

```bash
# View the changes made
git diff Ps47.xml

# View just the modified line
grep 'form="plaineAndEasie"' Ps47.xml
```

## Backing Up Files

The script modifies files in place. If you want to keep the original:

```bash
# Create a backup first
cp Ps47.xml Ps47.xml.backup

# Then process the file
python3 process_mei_files.py Ps47.xml

# If needed, restore from backup
cp Ps47.xml.backup Ps47.xml
```

## Processing a Collection

To process an entire collection of MEI files:

```bash
# Process all MEI files in a directory
cd /path/to/mei/collection
python3 /path/to/process_mei_files.py *.xml
```

## Requirements

- Python 3.6 or higher (no additional packages needed)
- MEI XML files with `incipCode[@form="plaineAndEasie"]` elements

## Troubleshooting

### "No changes needed for file.xml"
This means either:
- The file doesn't have any plaineAndEasie incipCode elements
- The file doesn't have any redundant accidentals (already correct)

### "Skipping file.xml: Not an MEI file"
The file doesn't contain the MEI namespace. Make sure you're processing MEI files.

### Script shows an error
Make sure:
1. You have Python 3 installed: `python3 --version`
2. The MEI file is valid XML
3. You have write permissions to the file

## Need Help?

See the [README.md](README.md) for more detailed information about:
- How the algorithm works
- Key signature patterns
- Plaine and Easie format details
- Using the XQuery scripts
