// Piano interface for melody search

(function() {

  // Pitch class mapping (C=1)
  const pitchClassMap = {
  'C': '0', 'C#': '1', 'D': '2', 'D#': '3', 'E':  '4', 'F': '5',
  'F#':  '6', 'G': '7', 'G#': '8', 'A': '9', 'A#': '10', 'B': '11'
};
  
  // Sol-fa mapping (fixed Do = C)
  const solfaMap = {
    'C': 'Do', 'C#': 'Di', 'D': 'Re', 'D#': 'Ri',
    'E': 'Mi', 'F': 'Fa', 'F#': 'Fi', 'G': 'Sol',
    'G#': 'Si', 'A': 'La', 'A#': 'Li', 'B': 'Ti'
  };
  
  // One and a half octaves starting from C (C to F#)
  const pianoKeys = [
    { note: 'C', octave: 4, type: 'white' },
    { note: 'C#', octave: 4, type: 'black' },
    { note: 'D', octave: 4, type: 'white' },
    { note: 'D#', octave: 4, type: 'black' },
    { note: 'E', octave: 4, type:  'white' },
    { note: 'F', octave: 4, type: 'white' },
    { note:  'F#', octave:  4, type: 'black' },
    { note: 'G', octave: 4, type: 'white' },
    { note: 'G#', octave: 4, type: 'black' },
    { note: 'A', octave: 4, type:  'white' },
    { note: 'A#', octave: 4, type: 'black' },
    { note: 'B', octave:  4, type: 'white' },
    { note: 'C', octave: 5, type: 'white' },
    { note: 'C#', octave: 5, type:  'black' },
    { note: 'D', octave: 5, type: 'white' },
    { note:  'D#', octave:  5, type: 'black' },
    { note: 'E', octave: 5, type: 'white' },
    { note: 'F', octave: 5, type: 'white' },
    { note: 'F#', octave: 5, type:  'black' }
  ];
  
  
  let enteredPitches = []; // For search (pitch classes 1-12)
  let enteredNotes = [];   // For display (note names)
  let isInitialized = false;
  let pianoSynth = null;
  let samplerReady = false;
  let useSolfa = false;    // Toggle state for notation display
  let useFuzzySearch = true; // Toggle state for search mode (fuzzy/exact)
  let searchIncipit = false; // Toggle state for search location (incipit/anywhere)
  let resizeHandlerAttached = false; // Track if resize handler is attached
  
  // Selectors for piano keys
  const WHITE_KEY_SELECTOR = '.piano-key.white:not(.half-key)';
  const BLACK_KEY_SELECTOR = '.piano-key.black';
  
  // Black key positioning map - defines which white keys each black key sits between
  const blackKeyPositions = {
    1: [0, 1], 3: [1, 2], 6: [3, 4], 8: [4, 5], 10: [5, 6],
    13: [7, 8], 15: [8, 9], 18: [10, 11]
  };
  
  // Initialize with a realistic piano synthesizer
  async function initializePianoSampler() {
    if (samplerReady && pianoSynth) {
      return true;
    }
    
    if (typeof Tone === 'undefined') {
      console.error('❌ Tone.js not loaded');
      return false;
    }
    
    try {
      await Tone.start();
      
      // Use MembraneSynth for a more percussive, piano-like sound
      pianoSynth = new Tone.PolySynth(Tone.MembraneSynth, {
        pitchDecay: 0.008,
        octaves: 2,
        envelope: {
          attack: 0.001,
          decay: 0.3,
          sustain: 0.05,
          release: 1.4,
          attackCurve: 'exponential'
        }
      }).toDestination();
      
      // Set volume
      pianoSynth.volume.value = -10;
      
      samplerReady = true;
      
      // Enable all piano keys
      const keys = document.querySelectorAll('.piano-key:not(.half-key)');
      keys.forEach(key => {
        key.style.opacity = '1';
        key.style.cursor = 'pointer';
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Error initializing:', error);
      samplerReady = false;
      
      // Enable keys anyway
      const keys = document.querySelectorAll('.piano-key:not(.half-key)');
      keys.forEach(key => {
        key.style.opacity = '1';
        key.style.cursor = 'pointer';
      });
      
      return false;
    }
  }
  
  // Play note with the synth
  function playNote(note, octave) {
    if (!samplerReady || !pianoSynth) {
      console.warn('⚠ Piano not ready yet');
      return;
    }
    
    try {
      const toneNote = `${note}${octave}`;
      
      // Play with moderate duration
      pianoSynth.triggerAttackRelease(toneNote, '4n');
      
    } catch (error) {
      console.error('Error playing note:', error);
    }
  }
  
  // Update all key labels based on current notation mode
  function updateKeyLabels() {
    const keys = document.querySelectorAll('.piano-key:not(.half-key)');
    
    keys.forEach(key => {
      const note = key.dataset.note;
      const label = key.querySelector('span');
      if (label && note) {
        const newLabel = useSolfa ?  solfaMap[note] :  note;
        label.textContent = newLabel;
      }
    });
  }
  
  // Update display with current notation
  function updateDisplay() {
    // Update visible input with note names or sol-fa
    const visibleInput = document.getElementById('melodySearchInputDisplay');
    if (visibleInput) {
      const displayValues = enteredNotes.map(note => 
        useSolfa ? solfaMap[note] : note
      );
      visibleInput.value = displayValues.join(' ');
    }
    
    // Update hidden input with pitch class numbers for search
    const hiddenInput = document.getElementById('melodySearchInput');
    if (hiddenInput) {
      hiddenInput.value = enteredPitches.join(' ');
    }
  }
  
  // Initialize piano when modal opens
  function initializePiano() {
    const keyboard = document.getElementById('pianoKeyboard');
    
    if (!keyboard) {
      console.error('Piano keyboard element not found! ');
      return;
    }
    
    if (isInitialized) {
      return;
    }
    
    keyboard.innerHTML = '';
    
    // Set up the toggle button (it's already in the HTML above the keyboard)
    const toggleBtn = document.getElementById('notationToggle');
    if (toggleBtn) {
      // Remove old listener if exists by cloning the button
      const newBtn = toggleBtn.cloneNode(true);
      toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);
      
      // Add fresh event listener
      newBtn.addEventListener('click', function() {
        useSolfa = !useSolfa;
        newBtn.textContent = useSolfa ? 'Pitches' : 'Sol-fa';
        newBtn.title = useSolfa ? 'Switch to pitch names' : 'Switch to Sol-fa notation';
        newBtn.classList.toggle('active', useSolfa);
        updateKeyLabels();
        updateDisplay();
      });
    }
    
    // Set up the search mode toggle buttons (Fuzzy/Exact)
    const searchModeToggleFuzzy = document.getElementById('searchModeToggle');
    const searchModeToggleExact = document.getElementById('searchModeToggleAlt');
    
    if (searchModeToggleFuzzy && searchModeToggleExact) {
      // Remove old listeners by cloning
      const newFuzzy = searchModeToggleFuzzy.cloneNode(true);
      const newExact = searchModeToggleExact.cloneNode(true);
      searchModeToggleFuzzy.parentNode.replaceChild(newFuzzy, searchModeToggleFuzzy);
      searchModeToggleExact.parentNode.replaceChild(newExact, searchModeToggleExact);
      
      // Click handler for Fuzzy button
      newFuzzy.addEventListener('click', function() {
        // Always update visual state, regardless of current state
        useFuzzySearch = true;
        newFuzzy.classList.add('active');
        newExact.classList.remove('active');
        newFuzzy.style.background = '#6fc252';
        newFuzzy.style.color = 'white';
        newExact.style.background = 'white';
        newExact.style.color = '#6fc252';
      });
      
      // Click handler for Exact button
      newExact.addEventListener('click', function() {
        // Always update visual state, regardless of current state
        useFuzzySearch = false;
        newExact.classList.add('active');
        newFuzzy.classList.remove('active');
        newExact.style.background = '#6fc252';
        newExact.style.color = 'white';
        newFuzzy.style.background = 'white';
        newFuzzy.style.color = '#6fc252';
      });
    }
    
    // Set up the search location toggle buttons (Anywhere/Incipit)
    const searchLocationAnywhere = document.getElementById('searchLocationToggle');
    const searchLocationIncipit = document.getElementById('searchLocationToggleAlt');
    
    if (searchLocationAnywhere && searchLocationIncipit) {
      // Remove old listeners by cloning
      const newAnywhere = searchLocationAnywhere.cloneNode(true);
      const newIncipit = searchLocationIncipit.cloneNode(true);
      searchLocationAnywhere.parentNode.replaceChild(newAnywhere, searchLocationAnywhere);
      searchLocationIncipit.parentNode.replaceChild(newIncipit, searchLocationIncipit);
      
      // Click handler for Anywhere button
      newAnywhere.addEventListener('click', function() {
        // Always update visual state, regardless of current state
        searchIncipit = false;
        newAnywhere.classList.add('active');
        newIncipit.classList.remove('active');
        newAnywhere.style.background = '#6fc252';
        newAnywhere.style.color = 'white';
        newIncipit.style.background = 'white';
        newIncipit.style.color = '#6fc252';
      });
      
      // Click handler for Incipit button
      newIncipit.addEventListener('click', function() {
        // Always update visual state, regardless of current state
        searchIncipit = true;
        newIncipit.classList.add('active');
        newAnywhere.classList.remove('active');
        newIncipit.style.background = '#6fc252';
        newIncipit.style.color = 'white';
        newAnywhere.style.background = 'white';
        newAnywhere.style.color = '#6fc252';
      });
    }
    
    // Create container for keys
    const container = document.createElement('div');
    container.className = 'piano-keys-container';
    container.id = 'pianoKeysContainer';
    container.style.position = 'relative';
    
    
    const whiteKeyElements = [];
    const blackKeyData = [];
    
    // Create white keys
    pianoKeys.forEach((key, index) => {
      if (key.type === 'white') {
        const keyElement = createPianoKey(key, index);
        container.appendChild(keyElement);
        whiteKeyElements.push(keyElement);
      } else {
        blackKeyData.push({ key, index });
      }
    });
    
    // Add decorative half white key
    const halfKey = document.createElement('div');
    halfKey.className = 'piano-key white half-key';
    halfKey.style.opacity = '0.7';
    halfKey.style.cursor = 'default';
    halfKey.style.pointerEvents = 'none';
    container.appendChild(halfKey);
    
    keyboard.appendChild(container);
    
    // Position black keys
    requestAnimationFrame(() => {
      blackKeyData.forEach(({ key, index }) => {
        const keyElement = createPianoKey(key, index);
        container.appendChild(keyElement);
        
        // Use the shared positioning function
        positionBlackKey(keyElement, whiteKeyElements, container);
      });
    });
    
    isInitialized = true;
    
    // Add resize handler to reposition black keys (only once)
    if (!resizeHandlerAttached) {
      let resizeTimeout;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          repositionBlackKeys();
        }, 100);
      });
      resizeHandlerAttached = true;
    }
  }
  
  // Shared function to position a single black key
  function positionBlackKey(blackKey, whiteKeys, container) {
    const index = parseInt(blackKey.dataset.index);
    const whiteKeyIndices = blackKeyPositions[index];
    
    if (whiteKeyIndices) {
      const [leftIdx, rightIdx] = whiteKeyIndices;
      const leftKey = whiteKeys[leftIdx];
      
      if (leftKey) {
        const leftRect = leftKey.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const leftEdge = leftRect.right - containerRect.left;
        const blackKeyWidth = blackKey.offsetWidth;
        const centerPosition = leftEdge - (blackKeyWidth / 2);
        
        blackKey.style.left = `${centerPosition}px`;
      }
    }
  }
  
  // Reposition all black keys (called on window resize)
  function repositionBlackKeys() {
    const container = document.getElementById('pianoKeysContainer');
    if (!container) return;
    
    const whiteKeys = Array.from(container.querySelectorAll(WHITE_KEY_SELECTOR));
    const blackKeys = Array.from(container.querySelectorAll(BLACK_KEY_SELECTOR));
    
    blackKeys.forEach(blackKey => {
      positionBlackKey(blackKey, whiteKeys, container);
    });
  }
  
  function createPianoKey(key, index) {
    const keyElement = document.createElement('div');
    keyElement.className = `piano-key ${key.type}`;
    keyElement.dataset.note = key.note;
    keyElement.dataset.octave = key.octave;
    keyElement.dataset.index = index;
    
    const label = document.createElement('span');
    label.textContent = key.note;
    // Font size is now handled by CSS clamp() for responsiveness
    keyElement.appendChild(label);
    
    // Click handler
    keyElement.addEventListener('click', function() {
      handleKeyClick(key);
      playNote(key.note, key.octave);
      
      // Visual feedback
      keyElement.classList.add('active');
      setTimeout(() => keyElement.classList.remove('active'), 200);
    });
    
    return keyElement;
  }
  
  function handleKeyClick(key) {
    const pitchClass = pitchClassMap[key.note];
    enteredPitches.push(pitchClass);  // Store pitch class number
    enteredNotes.push(key.note);      // Store note name
    updateDisplay();
  }
  
  function deleteLast() {
    if (enteredPitches.length > 0) {
      enteredPitches.pop();
      enteredNotes.pop();
      updateDisplay();
    }
  }
  
  function clearAll() {
    enteredPitches = [];
    enteredNotes = [];
    updateDisplay();
  }
  
  // Setup event listeners
  function setupEventListeners() {
    
    const deleteBtn = document.getElementById('deletePitchBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', deleteLast);
    
    const clearBtn = document.getElementById('clearPitchesBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAll);
    
    const closeBtn = document.getElementById('closeMelodySearchModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        clearAll();
        const modal = document.getElementById('melodySearchModal');
        if (modal) modal.style.display = 'none';
      });
    }
    
    // Watch for modal opening
    const modal = document.getElementById('melodySearchModal');
    if (modal) {
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const display = window.getComputedStyle(modal).display;
            if (display !== 'none' && ! samplerReady) {
              initializePiano();
              initializePianoSampler();
            }
          }
        });
      });
      
      observer.observe(modal, {
        attributes: true,
        attributeFilter: ['style']
      });
    }
  }
  
  // Keyboard support
  document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('melodySearchModal');
    if (!modal || window.getComputedStyle(modal).display === 'none') return;
    
    if (e.key === 'Backspace') {
      e.preventDefault();
      deleteLast();
      return;
    }
    
    const keyMap = {
      'a': { note: 'C', octave: 4 }, 'w': { note: 'C#', octave: 4 },
      's': { note: 'D', octave: 4 }, 'e': { note: 'D#', octave: 4 },
      'd': { note:  'E', octave: 4 }, 'f': { note: 'F', octave: 4 },
      't': { note: 'F#', octave: 4 }, 'g': { note: 'G', octave: 4 },
      'y': { note: 'G#', octave: 4 }, 'h': { note: 'A', octave: 4 },
      'u': { note: 'A#', octave: 4 }, 'j': { note: 'B', octave: 4 },
      'k': { note:  'C', octave: 5 }, 'o': { note: 'C#', octave: 5 },
      'l': { note:  'D', octave: 5 }, 'p': { note: 'D#', octave: 5 },
      ';': { note: 'E', octave: 5 }, "'": { note: 'F', octave: 5 }
    };
    
    const keyData = keyMap[e.key.toLowerCase()];
    if (keyData) {
      e.preventDefault();
      const pitchClass = pitchClassMap[keyData.note];
      enteredPitches.push(pitchClass);
      enteredNotes.push(keyData.note);
      updateDisplay();
      playNote(keyData.note, keyData.octave);
      
      // Visual feedback
      const keys = document.querySelectorAll('.piano-key');
      keys.forEach(key => {
        if (key.dataset.note === keyData.note && 
            key.dataset.octave == keyData.octave) {
          key.classList.add('active');
          setTimeout(() => key.classList.remove('active'), 200);
        }
      });
    }
  });
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEventListeners);
  } else {
    setupEventListeners();
  }
  
  window.initMelodyPiano = initializePiano;
  
  // Expose search mode state getter
  window.isFuzzySearchMode = function() {
    return useFuzzySearch;
  };
  
  // Expose search location state getter
  window.isIncipitSearchMode = function() {
    return searchIncipit;
  };
  
})();
