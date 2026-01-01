# Melody Search Results Integration Guide

## Overview

This component provides a modern interface for displaying melody search results with MIDI playback capability. It replaces the display of "intervals and pitch classes" with a clean list showing tune names and play buttons with circular progress indicators.

## Features

- **Clean Display**: Shows only the tune name on the left side
- **Play Button**: Interactive play icon on the right side  
- **Circular Progress**: Visual indicator that fills as the melody plays
- **Verovio Integration**: Uses Verovio to convert Plaine and Easie code to MIDI
- **Existing Playback**: Works with the site's existing MIDI playback mechanisms (MIDIjs or midi-player)
- **Responsive**: Works on mobile and desktop

## Quick Start

### 1. Import the Component

```javascript
import { MelodySearchResults, melodySearchResultsCSS } from './js/melody-search-results.js';
```

### 2. Add CSS to Your Page

```javascript
const styleEl = document.createElement('style');
styleEl.textContent = melodySearchResultsCSS;
document.head.appendChild(styleEl);
```

### 3. Initialize Verovio

```javascript
verovio.module.onRuntimeInitialized = function () {
    const tk = new verovio.toolkit();
    tk.setOptions({
        scale: 40,
        pageWidth: 2100,
        pageHeight: 2970
    });
    
    // Create the component
    const container = document.getElementById('your-container');
    const melodyResults = new MelodySearchResults(container, tk);
    
    // Render results
    melodyResults.render(yourSearchResults);
};
```

## Data Format

The component expects an array of result objects:

```javascript
const results = [
    {
        title: "Name of the Tune",           // Required: Displayed on left
        incipCode: "@clef:G-2 @keysig:...",  // Required: Plaine and Easie notation
        workId: "unique-id"                   // Optional: For reference
    },
    // ... more results
];
```

### Extracting Data from XML

If your data is in MEI XML format with `<work>` and `<incipCode>` elements:

```javascript
function extractMelodyData(xmlDoc) {
    const works = xmlDoc.querySelectorAll('work');
    return Array.from(works).map(work => {
        const title = work.querySelector('title')?.textContent || 'Untitled';
        const incipCodeEl = work.querySelector('incipCode[form="plaineAndEasie"]');
        const incipCode = incipCodeEl?.textContent || '';
        const workId = work.getAttribute('xml:id') || '';
        
        return { title, incipCode, workId };
    });
}
```

## Integration Examples

### Example 1: Search Results Page

```javascript
// After performing a search
async function displaySearchResults(searchQuery) {
    const results = await searchMelodies(searchQuery);
    
    // Transform results to expected format
    const melodyData = results.map(result => ({
        title: result.work.title,
        incipCode: result.work.incipCode,
        workId: result.id
    }));
    
    // Render
    melodyResults.render(melodyData);
}
```

### Example 2: Tune List Page

```javascript
// Load and display all available tunes
async function loadTuneList() {
    const tunes = await fetchTunesFromDatabase();
    
    const melodyData = tunes.map(tune => ({
        title: tune.name,
        incipCode: tune.paeNotation,
        workId: tune.id
    }));
    
    melodyResults.render(melodyData);
}
```

### Example 3: XQuery Integration

If you're using XQuery to fetch data (like in searchTexts.xq):

```xquery
xquery version "3.1";

(: Return melody search results as JSON :)
let $query := request:get-parameter("query", "")

let $results :=
  for $work in collection("/db/tunes")//work
  let $title := string($work/title)
  let $incipCode := string($work/incipCode[@form="plaineAndEasie"])
  where contains(lower-case($title), lower-case($query))
  return map {
    "title": $title,
    "incipCode": $incipCode,
    "workId": string($work/@xml:id)
  }

return array { $results }
```

Then in JavaScript:

```javascript
async function searchMelodies(query) {
    const response = await fetch(`searchMelodies.xq?query=${encodeURIComponent(query)}`);
    const results = await response.json();
    melodyResults.render(results);
}
```

## Styling Customization

The component's appearance can be customized by overriding CSS variables:

```css
.melody-result-item {
    background: #your-color;
    border-radius: 12px; /* Adjust rounding */
}

.melody-result-title {
    font-size: 18px; /* Adjust title size */
    color: #your-color;
}

.progress-fill {
    stroke: #your-color; /* Change progress color */
}
```

## Advanced Usage

### Custom Progress Colors

```javascript
// Modify the component after creation
const button = container.querySelector('.melody-play-button');
const progressCircle = button.querySelector('.progress-fill');
progressCircle.style.stroke = '#ff6b6b'; // Custom color
```

### Play Specific Melody Programmatically

```javascript
// Get the button for a specific result
const button = container.querySelector('[data-result-id="0"]');
button.click(); // Trigger playback
```

### Handle Playback Events

```javascript
// Add custom event handling
const melodyResults = new MelodySearchResults(container, tk);

// Override the startPlayback method to add custom behavior
const originalStartPlayback = melodyResults.startPlayback.bind(melodyResults);
melodyResults.startPlayback = async function(result, index, button) {
    console.log(`Starting playback of: ${result.title}`);
    await originalStartPlayback(result, index, button);
    console.log('Playback started');
};
```

## Browser Compatibility

- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Requirements**: 
  - ES6 modules support
  - SVG support
  - Web Audio API (for MIDI playback)
  - Verovio toolkit

## Troubleshooting

### No Sound When Playing

1. Check that MIDIjs or midi-player is loaded
2. Ensure user has interacted with the page (required for audio context)
3. Check browser console for errors

### Circular Progress Not Animating

1. Verify SVG is rendering correctly
2. Check CSS is properly loaded
3. Ensure `requestAnimationFrame` is supported

### Plaine and Easie Not Converting

1. Verify the PAE notation is valid
2. Check Verovio version supports PAE import
3. Ensure Verovio toolkit is fully initialized

## Performance Considerations

- The component handles one playback at a time
- MIDI data is generated on-demand, not pre-cached
- For large result sets, consider pagination or virtual scrolling

## Accessibility

- Buttons include `aria-label` attributes
- Keyboard navigation supported
- Screen reader friendly

## Next Steps

1. Replace existing melody search results display with this component
2. Test with actual melody data from your database
3. Customize styling to match your site's design
4. Add analytics/tracking for melody playback

## Support

For issues or questions, refer to:
- Verovio documentation: https://www.verovio.org/
- Plaine and Easie code reference: https://www.iaml.info/plaine-easie-code
