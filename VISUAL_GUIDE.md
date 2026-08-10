# Visual Guide to Melody Search Results

## Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Melody Search Results                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Tune Name                                      ⏵    │   │
│  │ (from <title> in <work>)              [Play Icon]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Old Hundredth (Doxology)                       ◯    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Amazing Grace                                  ◯    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ St. Anne (O God, Our Help)                     ◯    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Circular Progress States

### Before Playback
```
     ⏵           Circle is empty
    ───          Play triangle visible
   /   \         No progress shown
  │     │
   \   /
    ───
```

### During Playback (25% complete)
```
    ▐▐           Circle fills clockwise
   ████─         Pause bars visible
  ╱████ \        Progress shown by fill
 │ ████  │
  \████ /
   ████─
```

### During Playback (75% complete)
```
    ▐▐           Circle almost full
   ████──        Pause bars visible
  ╱██████\       Nearly complete
 │████████│
  \██████/
   ████──
```

## Data Flow

```
┌─────────────────┐
│   Search Query  │
│   "Amazing"     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Filter Results │
│  from Database  │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Results Array:                      │
│  [                                   │
│    {                                 │
│      title: "Amazing Grace",         │
│      incipCode: "@clef:G-2 ...",    │
│      workId: "002"                   │
│    }                                 │
│  ]                                   │
└────────┬─────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ MelodySearch    │
│ Results.render()│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Display List   │
│  of Results     │
└─────────────────┘
```

## Playback Flow

```
User Clicks Play
     │
     ▼
┌─────────────────────────────┐
│ Convert PAE to MEI XML      │
│ "@clef:G-2..." → <mei>...</ │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Load MEI into Verovio       │
│ toolkit.loadData(mei)       │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Generate MIDI               │
│ toolkit.renderToMIDI()      │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Play via MIDIjs/midi-player │
│ MIDIjs.play(midiData)       │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Animate Progress Circle     │
│ (fills during playback)     │
└─────────────────────────────┘
```

## Component Architecture

```
┌────────────────────────────────────────┐
│      MelodySearchResults Class         │
├────────────────────────────────────────┤
│                                        │
│  Properties:                           │
│  • container (DOM element)             │
│  • vrvToolkit (Verovio instance)       │
│  • currentlyPlaying (index)            │
│  • audioContext                        │
│  • defaultDuration                     │
│                                        │
│  Constants:                            │
│  • CIRCLE_RADIUS = 45                  │
│  • CIRCLE_CIRCUMFERENCE = 282.74       │
│  • DEFAULT_DURATION_MS = 5000          │
│                                        │
│  Methods:                              │
│  • render(results)                     │
│  • createResultItem(result)            │
│  • createPlayButton(result)            │
│  • handlePlayClick(result, button)     │
│  • startPlayback(result, button)       │
│  • stopPlayback(button)                │
│  • convertPaeToMei(paeCode)           │
│  • animateProgress(circle, duration)   │
│  • playMidi(base64midi, button)        │
│                                        │
└────────────────────────────────────────┘
```

## SVG Structure

```xml
<svg class="play-progress-circle">
  <!-- Background circle (always visible) -->
  <circle class="progress-bg" r="45" />
  
  <!-- Progress circle (fills during playback) -->
  <circle class="progress-fill" r="45" 
          stroke-dasharray="283"
          stroke-dashoffset="283" />
  
  <!-- Icon group -->
  <g class="play-icon">
    <!-- Play triangle (visible when not playing) -->
    <path class="icon-play" d="M35,25 L35,75 L75,50 Z" />
    
    <!-- Pause bars (visible during playback) -->
    <g class="icon-pause hidden">
      <rect x="35" y="30" width="10" height="40" />
      <rect x="55" y="30" width="10" height="40" />
    </g>
  </g>
</svg>
```

## CSS Structure

```css
.melody-search-results          /* Container for all results */
  └── .melody-result-item       /* Individual result row */
      ├── .melody-result-title  /* Tune name (left) */
      └── .melody-play-container
          └── .melody-play-button
              └── .play-progress-circle
                  ├── .progress-bg     /* Background circle */
                  ├── .progress-fill   /* Animated progress */
                  └── .play-icon       /* Play/pause icons */
```

## Integration Points

```
Your Site                    Melody Search Component
─────────                    ───────────────────────

Verovio Toolkit    ──────►   vrvToolkit parameter
                              (passed to constructor)

MIDIjs / midi-player ─────►  window.MIDIjs.play()
                              (used for playback)

Search Results     ──────►   render(results)
                              (display melodies)

Container Element  ──────►   containerElement
                              (where to render)

CSS Stylesheet     ──────►   melodySearchResultsCSS
                              (component styles)
```

## Example Usage Flow

```
Step 1: User opens page
   │
   ▼
Step 2: Verovio loads
   │
   ▼
Step 3: Initialize component
   const melodyResults = new MelodySearchResults(container, toolkit);
   │
   ▼
Step 4: User searches
   │
   ▼
Step 5: Fetch results from database
   │
   ▼
Step 6: Render results
   melodyResults.render(searchResults);
   │
   ▼
Step 7: User clicks play button
   │
   ▼
Step 8: MIDI plays with progress animation
   │
   ▼
Step 9: Playback completes, button resets
```

## File Structure

```
project/
├── js/
│   └── melody-search-results.js     ← Core component
│
├── melody-search-example.html       ← Simple demo
├── melody-search-integration-       ← Full example
│   example.html
│
├── test-melody-search.mjs           ← Automated tests
│
├── MELODY_SEARCH_INTEGRATION.md     ← Integration guide
├── README_MELODY_SEARCH.md          ← Feature summary
├── IMPLEMENTATION_COMPLETE.md       ← Final summary
└── VISUAL_GUIDE.md                  ← This file
```

## API Quick Reference

### Constructor
```javascript
new MelodySearchResults(container, toolkit, options)
```

### Options Object
```javascript
{
  defaultDuration: 5000  // Duration in milliseconds
}
```

### Render Method
```javascript
melodyResults.render([
  {
    title: "Tune Name",               // Required
    incipCode: "@clef:G-2 @data:...", // Required
    workId: "unique-id"                // Optional
  }
])
```

### Constants (Class-level)
```javascript
MelodySearchResults.CIRCLE_RADIUS         // 45
MelodySearchResults.CIRCLE_CIRCUMFERENCE  // ~283
MelodySearchResults.DEFAULT_DURATION_MS   // 5000
```

## Browser DevTools Inspection

When debugging, look for:

1. **Console Logs:**
   - "Verovio loaded and ready"
   - "Starting playback of: [tune name]"
   - Any error messages

2. **Network Tab:**
   - Verovio WASM module loads
   - MIDIjs library loads
   - No errors fetching resources

3. **Elements Tab:**
   - `.melody-search-results` container exists
   - `.melody-result-item` elements present
   - SVG circles render correctly

4. **Console Commands:**
   ```javascript
   // Check if component exists
   window.melodyResults
   
   // Check Verovio
   verovio.toolkit
   
   // Check MIDI playback
   window.MIDIjs
   ```

## Common Issues & Solutions

| Issue | Check | Solution |
|-------|-------|----------|
| No sound | MIDIjs loaded? | Include MIDIjs script |
| No progress | SVG rendering? | Check CSS loaded |
| PAE errors | Valid notation? | Validate PAE syntax |
| No results | Data format? | Check result objects |

## Summary

This visual guide illustrates the complete melody search results implementation:

- ✅ Component structure
- ✅ Data flow
- ✅ Playback process
- ✅ SVG construction
- ✅ Integration points
- ✅ File organization
- ✅ API reference
- ✅ Debugging tips

For implementation details, see the other documentation files!
