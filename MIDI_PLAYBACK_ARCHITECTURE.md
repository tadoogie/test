# MIDI Playback Architecture

## Question Answered
> "I know melody-player.js is used by the results in the melody search modal, but is that the file that playMIDI in the controls menu uses to play the MIDI as well?"

## Answer: NO - They Are Separate Systems

The application has **TWO INDEPENDENT** MIDI playback systems that serve different purposes.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MIDI PLAYBACK ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────────┘

SYSTEM 1: Main Controls Playback
┌─────────────────────────────────────────────────────────────────────┐
│ User Action:   Clicks Play button in controls menu                  │
│ Button ID:     playMIDI                                             │
│ Handled by:    app-dev.js                                           │
│ Function:      loadAudioAndPlayHandler()                            │
│ Player ID:     verovio-midi-player                                  │
│ Player HTML:   <midi-player id="verovio-midi-player">              │
│ Location:      page.html (line 1098)                               │
│ Data Source:   Full MEI document (loaded score)                     │
│ Purpose:       Play complete psalm/score with highlighting          │
└─────────────────────────────────────────────────────────────────────┘

SYSTEM 2: Melody Search Playback
┌─────────────────────────────────────────────────────────────────────┐
│ User Action:   Clicks play button in melody search results          │
│ Button Class:  melody-play-btn                                      │
│ Handled by:    melody-player.js                                     │
│ Class:         MelodyPlayer                                         │
│ Function:      MelodyPlayer.play()                                  │
│ Player ID:     melody-midi-player                                   │
│ Player HTML:   Created dynamically via createElement()              │
│ Location:      Created in melody-player.js (line 223)              │
│ Data Source:   PAE (Plaine and Easie) code from search results     │
│ Purpose:       Quick preview of melody search matches               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Comparison

| Feature | Main Controls | Melody Search |
|---------|---------------|---------------|
| **File** | app-dev.js | melody-player.js |
| **Player ID** | `verovio-midi-player` | `melody-midi-player` |
| **Creation** | Static HTML element | Dynamic JavaScript creation |
| **Data Format** | Full MEI document | PAE (Plaine and Easie) code |
| **Scope** | Complete score | Short melody incipit |
| **Features** | Page highlighting, tempo control, volume | Simple play/pause with progress |
| **Lifecycle** | Persistent (in HTML) | On-demand (created when needed) |
| **Use Case** | Main score viewing | Search result preview |

---

## Code Flow

### Main Controls Playback Flow

```javascript
// 1. User clicks Play button in controls
<a class="tooltip" id="playMIDI">

// 2. Event listener in app-dev.js (line 107)
const playMIDIButton = document.getElementById("playMIDI");
playMIDIButton.addEventListener("click", async function() {
    stopMIDIHandler();
    await loadAudioAndPlayHandler();
});

// 3. Function gets main player (line 1046)
const player = document.getElementById('verovio-midi-player');

// 4. Renders full score to MIDI (line 1089)
let base64midi = vrvToolkit.renderToMIDI();
player.src = 'data:audio/midi;base64,' + base64midi;

// 5. Starts playback with highlighting
player.start();
highlightNotesAtMidiPlaybackTime();
```

### Melody Search Playback Flow

```javascript
// 1. User clicks play button in search result
button.addEventListener('click', () => {
    melodyPlayer.play(paeCode, tuneName, button);
});

// 2. MelodyPlayer class in melody-player.js (line 153)
async play(paeCode, tuneName, button) {
    // Load PAE into Verovio
    this.verovioToolkit.loadData(paeCode);
    
    // Render to MIDI
    const base64midi = this.verovioToolkit.renderToMIDI();
    
    // Get or create player (line 221)
    let player = document.getElementById('melody-midi-player');
    if (!player) {
        player = document.createElement('midi-player');
        player.id = 'melody-midi-player';
        document.body.appendChild(player);
    }
    
    // Play melody
    player.src = 'data:audio/midi;base64,' + base64midi;
    player.start();
}
```

---

## Why Two Separate Systems?

### Different Data Sources
- **Main**: Full MEI (Music Encoding Initiative) document
  - Complete musical notation
  - Multiple stanzas, verses, voices
  - Full metadata
  
- **Melody**: PAE (Plaine and Easie) code
  - Compact melody representation
  - Just the melodic contour
  - Used for searching/matching

### Different Features
- **Main**: 
  - Page highlighting (notes turn red during playback)
  - Tempo adjustment
  - Volume control per voice
  - Page turning during playback
  - Synchronized with score display
  
- **Melody**:
  - Simple play/pause
  - Circular progress indicator
  - No highlighting (no score displayed)
  - Quick preview only

### Different Lifecycles
- **Main**: 
  - Persistent HTML element
  - Always present in page
  - One player for entire session
  
- **Melody**:
  - Created on demand
  - Only exists when melody search is used
  - Recreated if needed

---

## iOS Optimization Applied to Both

Both systems received iOS optimization in this PR:

### Main Controls (app-dev.js)
```javascript
// Added AudioContext monitoring
function configureAudioContextForIOS() {
    console.log('AudioContext status checked for iOS compatibility');
}

// Enhanced Tone.start() logging
await Tone.start();
console.log('AudioContext state:', Tone.context.state);
```

### Melody Search (melody-player.js)
```javascript
// Added playsinline attribute
player.setAttribute('playsinline', '');

// Enhanced Tone.start() logging
await Tone.start();
console.log('Tone.js started for melody playback');
```

### Main Player HTML (page.html)
```html
<!-- Added playsinline attribute -->
<midi-player id="verovio-midi-player" preload="auto" playsinline>
```

---

## File Locations

| File | Lines | What It Contains |
|------|-------|------------------|
| **page.html** | 988 | Play button HTML (`id="playMIDI"`) |
| **page.html** | 1098 | Main player HTML (`id="verovio-midi-player"`) |
| **app-dev.js** | 107-119 | Play button event listener |
| **app-dev.js** | 1035-1107 | `loadAudioAndPlayHandler()` function |
| **melody-player.js** | 1-270 | Complete `MelodyPlayer` class |
| **melody-player.js** | 221-228 | Creates `melody-midi-player` |

---

## Summary

**The playMIDI button in the controls menu does NOT use melody-player.js.**

- **playMIDI button** → app-dev.js → verovio-midi-player
- **Melody search** → melody-player.js → melody-midi-player

They are two independent systems that happen to use the same underlying technology (html-midi-player + Tone.js) but serve different purposes and operate on different data sources.

---

## Visual Reference

```
page.html
├── Controls Menu
│   └── Play Button (id="playMIDI")
│       └── Handled by: app-dev.js
│           └── Uses: verovio-midi-player
│
└── Melody Search Modal
    └── Play Buttons (class="melody-play-btn")
        └── Handled by: melody-player.js
            └── Uses: melody-midi-player (created dynamically)
```

Both systems are now iOS-optimized with playsinline and proper AudioContext handling! ✅
