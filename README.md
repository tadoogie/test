# Remove Redundant Accidentals from MEI Files

This directory contains scripts to process MEI (Music Encoding Initiative) files and remove redundant accidentals from `plaineAndEasie` encoded melodies.

## Problem

MEI files contain `incipCode` elements with `@form="plaineAndEasie"` that encode melodies. These melodies include:
1. A key signature (e.g., `$bB` for one flat)
2. Individual notes with accidentals (e.g., `bB` for B-flat)

Currently, the encoding includes redundant accidentals. For example, if the key signature is `$bB` (meaning B is flat), the melody still explicitly marks B notes as `bB`. This is redundant since B is already flat in the key signature.

## Solution

The scripts in this directory remove accidentals from notes when they match the key signature, while preserving accidentals that differ from the key signature.

### Example

**Before:**
```
%G-2 $bB @4/4 9A''C/'2A'G'F'G/'2G'F'F'nE/'9F/'9A''C/'2bB'bB'A'A/'2A'bB'G'G/'9xF/...
```

**After:**
```
%G-2 $bB @4/4 9A''C/'2A'G'F'G/'2G'F'F'nE/'9F/'9A''C/'2B'B'A'A/'2A'B'G'G/'9xF/...
```

Changes:
- All `bB` (B-flat) changed to `B` - redundant since B is already flat in key signature `$bB`
- `nE` (natural E) preserved - differs from key signature
- `xF` (sharp F) preserved - differs from key signature

## Scripts

### 1. `process_mei_files.py` (Python, Recommended)

A Python script that processes MEI XML files directly.

**Usage:**
```bash
# Process specific files
python3 process_mei_files.py Ps47.xml Ps101.xml

# Process all XML files in current directory
python3 process_mei_files.py
```

**Requirements:**
- Python 3.6 or higher
- No additional packages required (uses standard library)

### 2. `remove-redundant-accidentals.xq` (XQuery)

An XQuery script for use with XML databases like eXist-db or BaseX.

**Usage:**
```xquery
(: Load and execute the script in your XQuery processor :)
(: The script processes all MEI documents in the /db/tunes/5.5.5.5/ collection :)
```

**Note:** Requires an XQuery 3.1 processor with update facility.

### 3. `process-mei-file.xq` (XQuery)

A standalone XQuery script that can process individual MEI files.

**Usage:**
```bash
# With Saxon (example)
saxon -s:Ps47.xml -xsl:process-mei-file.xq -o:Ps47-processed.xml
```

## Key Signature Patterns

### Flats (order: B, E, A, D, G, C, F)
- `$bB` (1♭): B flat
- `$bBE` (2♭): B, E flat
- `$bBEA` (3♭): B, E, A flat
- `$bBEAD` (4♭): B, E, A, D flat
- `$bBEADG` (5♭): B, E, A, D, G flat
- `$bBEADGC` (6♭): B, E, A, D, G, C flat
- `$bBEADGCF` (7♭): B, E, A, D, G, C, F flat

### Sharps (order: F, C, G, D, A, E, B)
- `$xF` (1♯): F sharp
- `$xFC` (2♯): F, C sharp
- `$xFCG` (3♯): F, C, G sharp
- `$xFCGD` (4♯): F, C, G, D sharp
- `$xFCGDA` (5♯): F, C, G, D, A sharp
- `$xFCGDAE` (6♯): F, C, G, D, A, E sharp
- `$xFCGDAEB` (7♯): F, C, G, D, A, E, B sharp

## Plaine and Easie Format

The Plaine and Easie format encodes melodies as:

```
%[clef] $[keysig] @[timesig] [notes]
```

Where notes are encoded as:
```
[octave][duration][dots][accidental][pitch]
```

- **octave**: `'`, `''`, `'''` (up) or `,`, `,,`, `,,,` (down)
- **duration**: `0` (breve), `9` (whole), `2` (half), `4` (quarter), `8` (eighth), `6` (16th), `3` (32nd)
- **dots**: `.` for dotted notes
- **accidental**: `b` (flat), `x` (sharp), `n` (natural)
- **pitch**: `A-G` (uppercase)

## Testing

The repository includes test files:
- `Ps47.xml` - MEI file with plaineAndEasie encoding
- `/tmp/test_pae_processing.py` - Python test script that demonstrates the logic

## Author

Created to process MEI files for music encoding projects.

## License

Same as the repository license.
