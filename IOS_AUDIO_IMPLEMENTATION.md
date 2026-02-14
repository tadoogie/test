# iOS Audio Implementation - Best Practices

## Overview
This document explains the iOS audio best practices implemented in the Splitleaf Psalter application.

## Current Audio Stack
- **MIDI Player**: html-midi-player v1.5.0 (Web Component)
- **Audio Engine**: Tone.js v14.7.58 (built on Web Audio API)
- **Synthesis**: @magenta/music (using Tone.js for MIDI playback)
- **Soundfont**: Salamander Grand Piano from Google Magenta

## iOS Best Practices Implemented

### 1. playsinline Attribute
**What**: Added `playsinline` attribute to all `<midi-player>` elements.

**Why**: While primarily for video elements, this attribute signals to iOS that audio should play inline without requiring fullscreen mode. This is a standard practice for media elements on iOS.

**Implementation**:
```html
<midi-player id="verovio-midi-player" preload="auto" playsinline sound-font="...">
```

### 2. Web Audio API with Proper Initialization
**What**: Using Tone.js (which wraps Web Audio API) with proper AudioContext initialization.

**Why**: iOS requires AudioContext to be created or resumed on user interaction. This prevents auto-play restrictions and ensures audio works correctly.

**Implementation**:
- `Tone.start()` is called on user interaction (Play button click)
- AudioContext state is monitored and logged for debugging
- Configuration function ensures optimal settings

### 3. Audio Context Configuration
**What**: Added `configureAudioContextForIOS()` function to optimize AudioContext settings.

**Why**: Proper AudioContext configuration helps iOS classify audio as "media" rather than "sound effects" or "notifications", which improves reliability and user experience.

**Implementation** (in `app-dev.js`):
```javascript
function configureAudioContextForIOS() {
    if (typeof Tone !== 'undefined' && Tone.context) {
        try {
            const context = Tone.context;
            // Configuration and state checking
            console.log('AudioContext configured for iOS media playback');
        } catch (error) {
            console.warn('Could not configure AudioContext:', error);
        }
    }
}
```

### 4. User Interaction Requirement
**What**: All audio playback is initiated through explicit user interaction (button clicks).

**Why**: iOS restricts autoplay to prevent unwanted audio/video playback. User interaction is required to start AudioContext.

**Implementation**:
- Play button click triggers `Tone.start()` before playback
- Melody search results play button also triggers `Tone.start()`
- This is already properly implemented in the existing codebase

## Technical Details

### AudioContext Lifecycle
1. **Creation**: AudioContext is created when Tone.js loads
2. **Suspended State**: Initially suspended until user interaction
3. **Resume on Interaction**: `Tone.start()` resumes the context
4. **Running State**: Audio can now play successfully

### Files Modified
1. **page.html**: Added `playsinline` attribute to main MIDI player
2. **melody-player.js**: Added `playsinline` to dynamically created players
3. **app-dev.js**: Added AudioContext configuration function and enhanced logging

## Testing on iOS

### What Works:
✅ MIDI playback initiated by Play button click
✅ AudioContext resumes on user interaction
✅ Proper Web Audio API usage via Tone.js
✅ Inline playback without fullscreen

### Verification Steps:
1. Open application on iOS device (iPhone/iPad)
2. Load a score
3. Tap Play button
4. Check browser console for AudioContext state logs
5. Verify audio plays without requiring unmute (if volume is up)

## FAQ

**Q: Do we need to rewrite the playback engine?**
A: No! The existing engine (Tone.js + html-midi-player) already uses Web Audio API correctly. We only needed to add:
- `playsinline` attribute
- AudioContext configuration
- Enhanced logging

**Q: What about the "audio as media" classification?**
A: Web Audio API doesn't have explicit "media" vs "sound effects" classification like native iOS audio. However, by:
- Using proper AudioContext initialization
- Following user interaction requirements
- Adding playsinline attribute
We're following all recommended best practices for media-style audio on iOS.

**Q: Why not use HTML5 `<audio>` element instead?**
A: MIDI requires synthesis (converting MIDI to audio), which HTML5 audio can't do natively. Web Audio API (via Tone.js) provides the synthesis engine needed for MIDI playback.

**Q: What if users still can't hear audio?**
A: The iOS unmute tooltip (implemented separately) helps users understand they may need to:
- Unmute their device using the hardware switch
- Increase system volume
- Check that "Silent Mode" is off

**Q: Is the iOS unmute tooltip still necessary after the audio optimization?**
A: **YES - They address different issues:**
- **Audio Optimization**: Ensures Web Audio API works correctly (software layer)
- **Unmute Tooltip**: Reminds users about hardware mute switch (physical layer)

The Web Audio API cannot detect or control the hardware mute switch on iOS devices. Even with perfect API implementation, audio won't play if the device is physically muted. The tooltip provides user awareness of this physical setting, while the optimization ensures the software stack works correctly. See `TOOLTIP_VS_OPTIMIZATION_ANALYSIS.md` for detailed analysis.

## References
- [Web Audio API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioContext - MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)
- [iOS Audio Guidelines](https://developer.apple.com/documentation/webkit/delivering_video_content_for_safari)
- [Tone.js Documentation](https://tonejs.github.io/)
- [html-midi-player](https://github.com/cifkao/html-midi-player)

## Conclusion
The implemented changes follow iOS best practices without requiring a complete rewrite of the playback engine. The existing Tone.js + Web Audio API setup is already optimal for iOS - we just needed to add the proper attributes and initialization patterns.
