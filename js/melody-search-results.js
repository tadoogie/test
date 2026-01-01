/**
 * Melody Search Results Component
 * 
 * Displays melody search results with:
 * - Tune name (from <title> in <work> element)
 * - Play icon with circular progress indicator
 * - MIDI playback using Verovio from plaineAndEasie code
 */

export class MelodySearchResults {
  constructor(containerElement, verovioToolkit) {
    this.container = containerElement;
    this.vrvToolkit = verovioToolkit;
    this.currentlyPlaying = null;
    this.audioContext = null;
    this.playbackStopTime = null;
    
    // Initialize audio context on first user interaction
    this.initAudioContext();
  }
  
  initAudioContext() {
    // Audio context must be created after user interaction
    // Only initialize in browser environment
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      document.addEventListener('click', () => {
        if (!this.audioContext) {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
      }, { once: true });
    }
  }
  
  /**
   * Render search results
   * @param {Array} results - Array of result objects containing: { title, incipCode, workId }
   */
  render(results) {
    this.container.innerHTML = '';
    
    if (!results || results.length === 0) {
      this.container.innerHTML = '<div class="no-results">No melody results found</div>';
      return;
    }
    
    const resultsList = document.createElement('div');
    resultsList.className = 'melody-search-results';
    
    results.forEach((result, index) => {
      const resultItem = this.createResultItem(result, index);
      resultsList.appendChild(resultItem);
    });
    
    this.container.appendChild(resultsList);
  }
  
  /**
   * Create a single result item
   */
  createResultItem(result, index) {
    const item = document.createElement('div');
    item.className = 'melody-result-item';
    item.dataset.resultId = index;
    
    // Title on the left
    const titleDiv = document.createElement('div');
    titleDiv.className = 'melody-result-title';
    titleDiv.textContent = result.title || 'Untitled';
    
    // Play button with circular progress on the right
    const playButtonContainer = document.createElement('div');
    playButtonContainer.className = 'melody-play-container';
    
    const playButton = this.createPlayButton(result, index);
    playButtonContainer.appendChild(playButton);
    
    item.appendChild(titleDiv);
    item.appendChild(playButtonContainer);
    
    return item;
  }
  
  /**
   * Create play button with circular progress indicator
   */
  createPlayButton(result, index) {
    const button = document.createElement('button');
    button.className = 'melody-play-button';
    button.dataset.resultId = index;
    button.setAttribute('aria-label', `Play ${result.title || 'melody'}`);
    
    // Create SVG for circular progress
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'play-progress-circle');
    
    // Background circle
    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', '50');
    bgCircle.setAttribute('cy', '50');
    bgCircle.setAttribute('r', '45');
    bgCircle.setAttribute('class', 'progress-bg');
    svg.appendChild(bgCircle);
    
    // Progress circle (starts empty, fills during playback)
    const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressCircle.setAttribute('cx', '50');
    progressCircle.setAttribute('cy', '50');
    progressCircle.setAttribute('r', '45');
    progressCircle.setAttribute('class', 'progress-fill');
    progressCircle.setAttribute('data-progress', '0');
    svg.appendChild(progressCircle);
    
    // Play/pause icon
    const iconGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    iconGroup.setAttribute('class', 'play-icon');
    
    // Play triangle
    const playPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    playPath.setAttribute('d', 'M35,25 L35,75 L75,50 Z');
    playPath.setAttribute('class', 'icon-play');
    iconGroup.appendChild(playPath);
    
    // Pause bars (hidden by default)
    const pauseGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pauseGroup.setAttribute('class', 'icon-pause hidden');
    const pauseBar1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    pauseBar1.setAttribute('x', '35');
    pauseBar1.setAttribute('y', '30');
    pauseBar1.setAttribute('width', '10');
    pauseBar1.setAttribute('height', '40');
    const pauseBar2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    pauseBar2.setAttribute('x', '55');
    pauseBar2.setAttribute('y', '30');
    pauseBar2.setAttribute('width', '10');
    pauseBar2.setAttribute('height', '40');
    pauseGroup.appendChild(pauseBar1);
    pauseGroup.appendChild(pauseBar2);
    iconGroup.appendChild(pauseGroup);
    
    svg.appendChild(iconGroup);
    button.appendChild(svg);
    
    // Add click handler
    button.addEventListener('click', () => this.handlePlayClick(result, index, button));
    
    return button;
  }
  
  /**
   * Handle play button click
   */
  async handlePlayClick(result, index, button) {
    // If this melody is already playing, stop it
    if (this.currentlyPlaying === index) {
      this.stopPlayback(button);
      return;
    }
    
    // Stop any currently playing melody
    if (this.currentlyPlaying !== null) {
      const currentButton = this.container.querySelector(`[data-result-id="${this.currentlyPlaying}"]`);
      if (currentButton) {
        this.stopPlayback(currentButton);
      }
    }
    
    // Start playing this melody
    await this.startPlayback(result, index, button);
  }
  
  /**
   * Start MIDI playback
   */
  async startPlayback(result, index, button) {
    if (!result.incipCode) {
      console.error('No incipCode provided for melody');
      return;
    }
    
    try {
      // Convert Plaine and Easie code to MEI using Verovio
      const meiData = this.convertPaeToMei(result.incipCode, result.title);
      
      // Load the MEI data into Verovio
      this.vrvToolkit.loadData(meiData);
      
      // Render to MIDI
      const base64midi = this.vrvToolkit.renderToMIDI();
      
      // Get MIDI duration for progress calculation
      const midiData = atob(base64midi);
      const duration = this.estimateMidiDuration(midiData);
      
      // Update button state
      button.classList.add('playing');
      const playIcon = button.querySelector('.icon-play');
      const pauseIcon = button.querySelector('.icon-pause');
      if (playIcon) playIcon.classList.add('hidden');
      if (pauseIcon) pauseIcon.classList.remove('hidden');
      
      this.currentlyPlaying = index;
      
      // Start progress animation
      const progressCircle = button.querySelector('.progress-fill');
      this.animateProgress(progressCircle, duration);
      
      // Play MIDI using existing playback mechanism
      await this.playMidi(base64midi, button, duration);
      
    } catch (error) {
      console.error('Error playing melody:', error);
      this.stopPlayback(button);
    }
  }
  
  /**
   * Stop playback
   */
  stopPlayback(button) {
    button.classList.remove('playing');
    const playIcon = button.querySelector('.icon-play');
    const pauseIcon = button.querySelector('.icon-pause');
    if (playIcon) playIcon.classList.remove('hidden');
    if (pauseIcon) pauseIcon.classList.add('hidden');
    
    const progressCircle = button.querySelector('.progress-fill');
    if (progressCircle) {
      progressCircle.setAttribute('data-progress', '0');
      progressCircle.style.strokeDashoffset = '283'; // Reset to start (2 * PI * r = 2 * PI * 45)
    }
    
    this.currentlyPlaying = null;
    
    // Stop MIDI playback
    if (window.MIDIjs && window.MIDIjs.stop) {
      window.MIDIjs.stop();
    }
    
    if (this.playbackStopTime) {
      clearTimeout(this.playbackStopTime);
      this.playbackStopTime = null;
    }
  }
  
  /**
   * Convert Plaine and Easie code to MEI format
   */
  convertPaeToMei(paeCode, title = 'Melody') {
    // Create a minimal MEI document with the PAE code
    // Verovio can import PAE format directly
    const meiTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">
  <meiHead>
    <fileDesc>
      <titleStmt>
        <title>${this.escapeXml(title)}</title>
      </titleStmt>
      <pubStmt></pubStmt>
    </fileDesc>
  </meiHead>
  <music>
    <body>
      <mdiv>
        <score>
          <scoreDef>
            <staffGrp>
              <staffDef n="1" lines="5" clef.shape="G" clef.line="2"/>
            </staffGrp>
          </scoreDef>
          <section>
            <incip>
              <incipCode form="plaineAndEasie">${this.escapeXml(paeCode)}</incipCode>
            </incip>
          </section>
        </score>
      </mdiv>
    </body>
  </music>
</mei>`;
    
    return meiTemplate;
  }
  
  /**
   * Escape XML special characters
   */
  escapeXml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
  
  /**
   * Estimate MIDI duration (rough estimation)
   */
  estimateMidiDuration(midiData) {
    // This is a simplified duration estimation
    // In practice, you'd parse the MIDI file properly
    // For now, return a default duration
    return 5000; // 5 seconds default
  }
  
  /**
   * Animate circular progress
   */
  animateProgress(circle, duration) {
    const circumference = 2 * Math.PI * 45; // 2 * PI * radius
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = circumference;
    
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const offset = circumference * (1 - progress);
      circle.style.strokeDashoffset = offset;
      circle.setAttribute('data-progress', (progress * 100).toFixed(1));
      
      if (progress < 1 && this.currentlyPlaying !== null) {
        requestAnimationFrame(animate);
      } else {
        // Playback completed
        const button = circle.closest('.melody-play-button');
        if (button) {
          this.stopPlayback(button);
        }
      }
    };
    
    requestAnimationFrame(animate);
  }
  
  /**
   * Play MIDI using existing site mechanisms
   */
  async playMidi(base64midi, button, duration) {
    // Use the existing MIDI playback mechanism if available
    if (window.MIDIjs) {
      const midiString = 'data:audio/midi;base64,' + base64midi;
      window.MIDIjs.play(midiString);
      
      // Set timeout to stop after duration
      this.playbackStopTime = setTimeout(() => {
        this.stopPlayback(button);
      }, duration);
    } else if (window.mp && window.mp.start) {
      // Try midi-player element if MIDIjs not available
      try {
        const blob = this.base64ToBlob(base64midi, 'audio/midi');
        const noteSequence = await window.midiCore.blobToNoteSequence(blob);
        window.mp.noteSequence = noteSequence;
        window.mp.start();
        
        this.playbackStopTime = setTimeout(() => {
          window.mp.stop();
          this.stopPlayback(button);
        }, duration);
      } catch (error) {
        console.error('Error with midi-player:', error);
      }
    } else {
      console.warn('No MIDI playback mechanism available');
      // Fallback: just show the progress animation
      this.playbackStopTime = setTimeout(() => {
        this.stopPlayback(button);
      }, duration);
    }
  }
  
  /**
   * Convert base64 to Blob
   */
  base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}

// Add CSS for the component
export const melodySearchResultsCSS = `
.melody-search-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.melody-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f5f5f5;
  border-radius: 8px;
  transition: background 0.2s ease;
}

.melody-result-item:hover {
  background: #e8e8e8;
}

.melody-result-title {
  flex: 1;
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.melody-play-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.melody-play-button {
  width: 48px;
  height: 48px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.melody-play-button:hover {
  transform: scale(1.1);
}

.melody-play-button:active {
  transform: scale(0.95);
}

.play-progress-circle {
  width: 100%;
  height: 100%;
}

.progress-bg {
  fill: none;
  stroke: #ddd;
  stroke-width: 3;
}

.progress-fill {
  fill: none;
  stroke: #6fc252;
  stroke-width: 3;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
  transition: stroke-dashoffset 0.1s linear;
}

.play-icon .icon-play {
  fill: #333;
  transition: fill 0.2s ease;
}

.play-icon .icon-pause rect {
  fill: #333;
}

.melody-play-button:hover .icon-play {
  fill: #6fc252;
}

.melody-play-button:hover .icon-pause rect {
  fill: #6fc252;
}

.melody-play-button.playing .progress-fill {
  stroke: #4CAF50;
}

.hidden {
  display: none;
}

.no-results {
  padding: 20px;
  text-align: center;
  color: #888;
  font-style: italic;
}
`;
