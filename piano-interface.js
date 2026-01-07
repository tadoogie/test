// Piano interface for melody search
(function() {
  // Pitch class mapping (C=1)
  const pitchClassMap = {
    'C':  '1', 'C#': '2', 'D': '3', 'D#': '4', 'E': '5', 'F': '6',
    'F#': '7', 'G': '8', 'G#': '9', 'A': '10', 'A#': '11', 'B': '12'
  };
  
  // Two octaves starting from C
  const pianoKeys = [
    { note: 'C', octave:  4, type: 'white' },
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
    { note: 'C', octave: 5, type:  'white' },
    { note: 'C#', octave: 5, type: 'black' },
    { note: 'D', octave:  5, type: 'white' },
    { note: 'D#', octave: 5, type: 'black' },
    { note: 'E', octave: 5, type: 'white' },
    { note: 'F', octave: 5, type:  'white' },
    { note: 'F#', octave: 5, type: 'black' },
    { note: 'G', octave:  5, type: 'white' },
    { note: 'G#', octave: 5, type: 'black' },
    { note: 'A', octave: 5, type: 'white' },
    { note: 'A#', octave: 5, type: 'black' },
    { note: 'B', octave: 5, type:  'white' },
    { note: 'C', octave: 6, type: 'white' }
  ];
  
  let enteredPitches = [];
  
  // Initialize piano when modal opens
  function initializePiano() {
    const keyboard = document.getElementById('pianoKeyboard');
    if (!keyboard) return;
    
    // Clear existing keys
    keyboard.innerHTML = '';
    
    // Create container for keys
    const container = document.createElement('div');
    container.className = 'piano-keys-container';
    container.style.position = 'relative';
    
    // Create white keys first
    pianoKeys.forEach((key, index) => {
      if (key.type === 'white') {
        const keyElement = createPianoKey(key, index);
        container.appendChild(keyElement);
      }
    });
    
    // Create black keys on top
    pianoKeys.forEach((key, index) => {
      if (key.type === 'black') {
        const keyElement = createPianoKey(key, index);
        container. appendChild(keyElement);
      }
    });
    
    keyboard.appendChild(container);
  }
  
  function createPianoKey(key, index) {
    const keyElement = document.createElement('div');
    keyElement.className = `piano-key ${key.type}`;
    keyElement.dataset.note = key.note;
    keyElement.dataset.octave = key.octave;
    keyElement.dataset.index = index;
    
    // Add note label
    const label = document.createElement('span');
    label.textContent = key.note;
    label.style.fontSize = key.type === 'black' ? '8px' : '10px';
    keyElement.appendChild(label);
    
    // Add click handler
    keyElement.addEventListener('click', function() {
      handleKeyClick(key);
      
      // Visual feedback
      keyElement.classList.add('active');
      setTimeout(() => {
        keyElement.classList.remove('active');
      }, 200);
    });
    
    return keyElement;
  }
  
  function handleKeyClick(key) {
    const pitchClass = pitchClassMap[key.note];
    enteredPitches.push(pitchClass);
    updateDisplay();
  }
  
  function updateDisplay() {
    const input = document.getElementById('melodySearchInput');
    if (input) {
      input.value = enteredPitches.join(' ');
    }
  }
  
  function deleteLast() {
    if (enteredPitches.length > 0) {
      enteredPitches.pop();
      updateDisplay();
    }
  }
  
  function clearAll() {
    enteredPitches = [];
    updateDisplay();
  }
  
  // Event listeners
  document.addEventListener('DOMContentLoaded', function() {
    // Initialize piano when melody search link is clicked
    const melodySearchBtn = document.getElementById('searchMelodyLink'); // Adjust ID as needed
    if (melodySearchBtn) {
      melodySearchBtn.addEventListener('click', initializePiano);
    }
    
    // Delete button
    const deleteBtn = document.getElementById('deletePitchBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', deleteLast);
    }
    
    // Clear button
    const clearBtn = document.getElementById('clearPitchesBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearAll);
    }
    
    // Close button - reset when closing
    const closeBtn = document.getElementById('closeMelodySearchModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        clearAll();
        document.getElementById('melodySearchModal').style.display = 'none';
      });
    }
    
    // Search button - use the entered pitches
    const searchBtn = document.getElementById('executeMelodySearchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', function() {
        const searchValue = enteredPitches.join(' ');
        if (searchValue. length > 0) {
          // Your existing search functionality here
          console.log('Searching for:', searchValue);
          // Call your existing melody search function
        }
      });
    }
  });
  
  // Keyboard support for piano
  document.addEventListener('keydown', function(e) {
    // Only work when melody search modal is open
    const modal = document.getElementById('melodySearchModal');
    if (!modal || modal.style.display === 'none') return;
    
    // Backspace to delete
    if (e.key === 'Backspace') {
      e.preventDefault();
      deleteLast();
    }
    
    // Escape to clear
    if (e.key === 'Escape') {
      clearAll();
    }
    
    // Computer keyboard to piano mapping (optional)
    const keyMap = {
      'a': 'C', 'w': 'C#', 's': 'D', 'e': 'D#', 'd': 'E', 'f': 'F',
      't': 'F#', 'g': 'G', 'y': 'G#', 'h': 'A', 'u': 'A#', 'j': 'B',
      'k': 'C', 'o': 'C#', 'l': 'D', 'p': 'D#', ';': 'E'
    };
    
    if (keyMap[e.key. toLowerCase()]) {
      e.preventDefault();
      const note = keyMap[e.key. toLowerCase()];
      const pitchClass = pitchClassMap[note];
      enteredPitches.push(pitchClass);
      updateDisplay();
      
      // Visual feedback on piano key
      const keys = document.querySelectorAll('. piano-key');
      keys.forEach(key => {
        if (key.dataset.note === note) {
          key.classList. add('active');
          setTimeout(() => key.classList.remove('active'), 200);
        }
      });
    }
  });
  
})();