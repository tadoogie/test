#!/usr/bin/env python3
"""
Process MEI files to remove redundant accidentals from plaineAndEasie incipCode elements.

This script reads MEI XML files and updates the incipCode[@form="plaineAndEasie"] elements
by removing accidentals that are already covered by the key signature.

Usage:
    python3 process_mei_files.py [file1.xml file2.xml ...]
    
If no files are specified, it processes all *.xml files in the current directory that
contain MEI namespace elements.
"""

import re
import sys
from pathlib import Path

def is_flat_in_key(pitch, key_sig_code):
    """Check if a pitch has a flat in the key signature."""
    return f"b{pitch}" in key_sig_code

def is_sharp_in_key(pitch, key_sig_code):
    """Check if a pitch has a sharp in the key signature."""
    return f"x{pitch}" in key_sig_code

def process_plaine_easie(pae_code):
    """
    Process plaineAndEasie code and remove redundant accidentals.
    
    Args:
        pae_code: The complete plaineAndEasie code string
    
    Returns:
        Processed plaineAndEasie code with redundant accidentals removed
    """
    # Extract key signature using regex
    key_sig_match = re.search(r'\$([^\s@]+)', pae_code)
    key_sig_code = key_sig_match.group(1) if key_sig_match else ""
    
    # Split into header (up to and including time signature) and melody
    # Header format: %clef $keysig @timesig
    header_match = re.match(r'^(.*?@[^\s]+\s+)', pae_code)
    if header_match:
        header = header_match.group(1)
        melody = pae_code[len(header):]
    else:
        # Fallback if pattern doesn't match
        header = ""
        melody = pae_code
    
    # Process notes with accidentals in the melody only
    # Pattern: [octave][duration][dots][accidental][pitch]
    # where octave is apostrophes or commas, duration is digits, dots are dots, 
    # accidental is b/x/n, and pitch is A-G
    pattern = r"([',]*[0-9\.]*)([bxn])([A-G])"
    
    def replace_note(match):
        prefix = match.group(1)
        accid = match.group(2)
        pitch = match.group(3)
        
        # Check if this accidental matches the key signature
        is_redundant = False
        if accid == 'b' and is_flat_in_key(pitch, key_sig_code):
            is_redundant = True
        elif accid == 'x' and is_sharp_in_key(pitch, key_sig_code):
            is_redundant = True
        
        if is_redundant:
            return f"{prefix}{pitch}"
        else:
            return match.group(0)
    
    processed_melody = re.sub(pattern, replace_note, melody)
    return header + processed_melody

def process_mei_file(file_path):
    """
    Process an MEI file and update plaineAndEasie incipCode elements.
    Uses simple text replacement to preserve XML formatting.
    
    Args:
        file_path: Path to the MEI XML file
    
    Returns:
        True if the file was modified, False otherwise
    """
    try:
        # Read the file as text
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if this is an MEI file
        if 'http://www.music-encoding.org/ns/mei' not in content:
            print(f"Skipping {file_path}: Not an MEI file")
            return False
        
        # Find all incipCode elements with form="plaineAndEasie"
        # Pattern to match: <incipCode form="plaineAndEasie">...content...</incipCode>
        pattern = r'(<incipCode\s+form="plaineAndEasie">)(.*?)(</incipCode>)'
        
        modified = False
        original_content = content
        
        def replace_incipit(match):
            nonlocal modified
            prefix = match.group(1)
            original = match.group(2)
            suffix = match.group(3)
            
            processed = process_plaine_easie(original)
            
            if original != processed:
                print(f"\nProcessing {file_path}:")
                print(f"  Original:  {original}")
                print(f"  Processed: {processed}")
                modified = True
                return prefix + processed + suffix
            else:
                return match.group(0)
        
        # Replace all matching incipCode elements
        content = re.sub(pattern, replace_incipit, content, flags=re.DOTALL)
        
        if modified:
            # Write the modified content back to the file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"  ✓ Updated {file_path}")
            return True
        else:
            print(f"  No changes needed for {file_path}")
            return False
            
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """Main entry point."""
    # Get files to process
    if len(sys.argv) > 1:
        files = [Path(f) for f in sys.argv[1:]]
    else:
        # Process all XML files in current directory
        files = list(Path('.').glob('*.xml'))
    
    if not files:
        print("No XML files found to process.")
        return
    
    print(f"Processing {len(files)} file(s)...")
    
    modified_count = 0
    for file_path in files:
        if process_mei_file(file_path):
            modified_count += 1
    
    print(f"\n{'='*60}")
    print(f"Processed {len(files)} file(s), modified {modified_count} file(s).")

if __name__ == '__main__':
    main()
