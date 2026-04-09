/**
 * Simple MIDI Bridge
 * Connects MidiPlayer.js to the Verovio highlighting system
 */

// Global player bridge object
window.midiPlayerBridge = {
  // State properties
  currentTime: 0,
  paused: true,
  ended: false,
  _playing: false,
  _updateInterval: null,
  
  // Initialize the bridge
  init: function() {
    console.log("Initializing MIDI bridge");
    // Create the element if it doesn't exist
    if (!document.getElementById('verovio-midi-player')) {
      const playerEl = document.createElement('div');
      playerEl.id = 'verovio-midi-player';
      playerEl.style.display = 'none';
      document.body.appendChild(playerEl);
      
      // Set up element event handlers
      const element = document.getElementById('verovio-midi-player');
      element.addEventListener = function(event, handler) {
        if (!this._eventHandlers) this._eventHandlers = {};
        if (!this._eventHandlers[event]) this._eventHandlers[event] = [];
        this._eventHandlers[event].push(handler);
      };
      
      element.removeEventListener = function(event, handler) {
        if (!this._eventHandlers || !this._eventHandlers[event]) return;
        this._eventHandlers[event] = this._eventHandlers[event].filter(h => h !== handler);
      };
      
      element.dispatchEvent = function(event) {
        if (!this._eventHandlers || !this._eventHandlers[event.type]) return;
        const handlers = this._eventHandlers[event.type].slice();
        for (let handler of handlers) {
          handler.call(this, event);
        }
      };
      
      // Add bridge methods to the element
      element.start = function() { window.midiPlayerBridge.start(); };
      element.stop = function() { window.midiPlayerBridge.stop(); };
      element.pause = function() { window.midiPlayerBridge.pause(); };
    }
  },
  
  // Start playback
  start: function() {
    console.log("MIDI Bridge: start()");
    this._playing = true;
    this.paused = false;
    this.ended = false;
    
    // Start real player
    if (window.player && typeof window.player.play === 'function') {
      window.player.play();
    }
    
    // Start time tracking
    this._startTimeTracking();
    
    // Dispatch event
    const element = document.getElementById('verovio-midi-player');
    if (element) {
      const event = new Event('start');
      element.dispatchEvent(event);
    }
  },
  
  // Stop playback
  stop: function() {
    console.log("MIDI Bridge: stop()");
    this._playing = false;
    this.paused = true;
    
    // Stop real player
    if (window.player && typeof window.player.stop === 'function') {
      window.player.stop();
    }
    
    // Stop time tracking
    this._stopTimeTracking();
    
    // Dispatch event
    const element = document.getElementById('verovio-midi-player');
    if (element) {
      const event = new Event('stop');
      element.dispatchEvent(event);
    }
  },
  
  // Pause playback (same as stop for this implementation)
  pause: function() {
    this.stop();
    
    // Dispatch event
    const element = document.getElementById('verovio-midi-player');
    if (element) {
      const event = new Event('pause');
      element.dispatchEvent(event);
    }
  },
  
  // Start time tracking
  _startTimeTracking: function() {
    // Clear any existing interval
    this._stopTimeTracking();
    
    // Start a new interval to update currentTime
    const self = this;
    this._updateInterval = setInterval(function() {
      if (window.player && typeof window.player.getSongTime === 'function') {
        self.currentTime = window.player.getSongTime();
        
        // Update the DOM element
        const element = document.getElementById('verovio-midi-player');
        if (element) {
          element.currentTime = self.currentTime;
        }
        
        // Check if player has ended
        if (window.player.getSongPercentage && window.player.getSongPercentage() >= 100) {
          self.ended = true;
          self.stop();
          
          // Dispatch event
          if (element) {
            const event = new Event('ended');
            element.dispatchEvent(event);
          }
        }
      }
    }, 50); // Update every 50ms
  },
  
  // Stop time tracking
  _stopTimeTracking: function() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
  }
};

// Initialize the bridge when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
  window.midiPlayerBridge.init();
  console.log("MIDI Bridge: Ready");
});