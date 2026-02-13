// melody-player.js - MIDI playback for melody search results with circular progress indicator

class MelodyPlayer {
    constructor() {
        this.currentPlayer = null;
        this.currentButton = null;
        this.animationFrame = null;
        this.verovioToolkit = null;
        this.isPlaying = false;
        
        // Timing constants for player initialization and loading
        this.playerInitDelayMs = 500;    // Wait after creating new player element
        this.audioBufferDelayMs = 200;   // Ensure Web Audio API buffers are ready
        this.pollIntervalMs = 100;       // How often to check if player is ready
        this.maxPollAttempts = 50;       // Maximum polling attempts (5 seconds)
    }

    async initialize() {
        // Wait for Verovio to be ready
        if (typeof verovio === 'undefined') {
            console.error('Verovio not loaded');
            return false;
        }
        
        if (!this.verovioToolkit) {
            await verovio.module. onRuntimeInitialized;
            this.verovioToolkit = new verovio.toolkit();
        }
        return true;
    }

    // Create circular progress play button
    createPlayButton() {
        const button = document.createElement('button');
        button.className = 'melody-play-btn';
        button.setAttribute('aria-label', 'Play melody');
        button.innerHTML = `
            <svg class="play-icon" viewBox="0 0 100 100" width="40" height="40">
                <circle class="play-circle-bg" cx="50" cy="50" r="45" fill="none" stroke="#ddd" stroke-width="3"/>
                <circle class="play-circle-progress" cx="50" cy="50" r="45" fill="none" stroke="#6fc252" stroke-width="3"
                    stroke-dasharray="283" stroke-dashoffset="283" transform="rotate(-90 50 50)"/>
                <g class="play-symbol">
                    <path d="M 38 30 L 38 70 L 68 50 Z" fill="#555"/>
                </g>
                <g class="pause-symbol" style="display: none;">
                    <rect x="35" y="30" width="10" height="40" fill="#555"/>
                    <rect x="55" y="30" width="10" height="40" fill="#555"/>
                </g>
            </svg>
        `;
        return button;
    }

    // Update progress circle
    updateProgress(percent) {
        if (!this.currentButton) return;
        const circle = this.currentButton.querySelector('.play-circle-progress');
        if (circle) {
            const circumference = 283; // 2 * PI * 45
            const offset = circumference - (percent / 100) * circumference;
            circle.style.strokeDashoffset = offset;
        }
    }

    // Toggle play/pause icon
    setPlayingState(isPlaying) {
        if (!this.currentButton) return;
        const playSymbol = this.currentButton.querySelector('.play-symbol');
        const pauseSymbol = this.currentButton.querySelector('.pause-symbol');
        
        if (isPlaying) {
            playSymbol.style. display = 'none';
            pauseSymbol.style.display = 'block';
        } else {
            playSymbol.style.display = 'block';
            pauseSymbol. style.display = 'none';
        }
    }

    // Animation loop for progress
    startProgressAnimation(duration) {
        const startTime = performance.now();
        
        const animate = () => {
            if (!this.isPlaying) {
                this.updateProgress(0);
                return;
            }

            const elapsed = performance.now() - startTime;
            const percent = Math.min((elapsed / duration) * 100, 100);
            this.updateProgress(percent);

            if (percent < 100 && this.isPlaying) {
                this.animationFrame = requestAnimationFrame(animate);
            } else {
                this.stop();
            }
        };

        this.animationFrame = requestAnimationFrame(animate);
    }

    // Stop playback
    stop() {
        this.isPlaying = false;
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        if (this.currentPlayer) {
            try {
                if (typeof this.currentPlayer.stop === 'function') {
                    this.currentPlayer.stop();
                }
            } catch (e) {
                console.warn('Error stopping player:', e);
            }
            this.currentPlayer = null;
        }

        this.setPlayingState(false);
        this.updateProgress(0);
        this.currentButton = null;
    }

    // Wait for MIDI player to be ready for playback
    async waitForPlayerReady(player) {
        return new Promise((resolve) => {
            let attempts = 0;
            
            const checkReady = () => {
                attempts++;
                
                // Check if player has duration (indicates MIDI is loaded)
                if (player.duration > 0) {
                    resolve();
                } else if (attempts >= this.maxPollAttempts) {
                    console.warn('Player load timeout - proceeding anyway');
                    resolve();
                } else {
                    setTimeout(checkReady, this.pollIntervalMs);
                }
            };
            
            checkReady();
        });
    }

    // Play melody from Plain and Easy code
    async play(paeCode, tuneName, button) {
        // Validate inputs
        if (!paeCode || typeof paeCode !== 'string') {
            console.error('Invalid PAE code:', paeCode);
            alert('Unable to play melody: Invalid PAE code');
            return;
        }

        // If already playing this button, stop it
        if (this.isPlaying && this.currentButton === button) {
            this.stop();
            return;
        }

        // Stop any other playing melody
        if (this.isPlaying) {
            this.stop();
        }

        // Initialize if needed
        const initialized = await this.initialize();
        if (!initialized) {
            console.error('Failed to initialize Verovio');
            return;
        }

        this.currentButton = button;
        this.isPlaying = true;
        this.setPlayingState(true);

        try {
            // Start Tone.js if needed
            if (typeof Tone !== 'undefined') {
                await Tone.start();
            }

            // Set Verovio to accept PAE input directly (no MEI wrapper needed)
            this.verovioToolkit.setOptions({
                inputFrom: 'pae',   // Tell Verovio to expect Plain and Easy code directly
                scale: 40,
                pageHeight: 500,
                pageWidth: 500,
                adjustPageHeight: true
            });

            const loaded = this.verovioToolkit.loadData(paeCode);
            
            if (loaded === 0 || !loaded) {
                console.error('Verovio failed to load PAE data');
                throw new Error('Verovio failed to load PAE data');
            }
            
            const base64midi = this.verovioToolkit.renderToMIDI();

            if (!base64midi || base64midi.length < 100) {
                console.error('MIDI data seems too short or empty');
                throw new Error('Failed to generate MIDI from melody');
            }

            // Get or create MIDI player
            let player = document.getElementById('melody-midi-player');
            if (!player) {
                player = document.createElement('midi-player');
                player.id = 'melody-midi-player';
                player.setAttribute('sound-font', 'https://storage.googleapis.com/magentadata/js/soundfonts/salamander');
                player.style.display = 'none';
                document.body.appendChild(player);
                
                // Wait for player element to initialize (Web Component registration, etc.)
                await new Promise(resolve => setTimeout(resolve, this.playerInitDelayMs));
            }

            this.currentPlayer = player;
            
            // Set the MIDI source
            player.src = 'data:audio/midi;base64,' + base64midi;
            
            // Call load if available
            if (typeof player.load === 'function') {
                player.load();
            }
            
            // Wait for the player to fully load the MIDI data
            await this.waitForPlayerReady(player);

            // Additional delay to ensure Web Audio API buffers are fully ready
            await new Promise(resolve => setTimeout(resolve, this.audioBufferDelayMs));

            if (typeof player.start === 'function') {
                player.start();
                
                // Estimate duration - assume ~30 notes average for an incipit
                const estimatedDuration = 15000; // 15 seconds default
                
                this.startProgressAnimation(estimatedDuration);
            }

            // Listen for player end event
            player.addEventListener('ended', () => {
                if (this.currentPlayer === player) {
                    this.stop();
                }
            }, { once: true });

        } catch (error) {
            console.error('Error playing melody:', error);
            console.error('Stack:', error.stack);
            this.stop();
            alert('Unable to play melody. Check console for details.');
        }
    }
}

// Create global instance
window.melodyPlayer = new MelodyPlayer();

// CSS styles for the play button (inject into document)
const style = document.createElement('style');
style.textContent = `
.melody-play-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.1s ease;
}

.melody-play-btn:hover {
    transform: scale(1.1);
}

.melody-play-btn:active {
    transform: scale(0.95);
}

.melody-play-btn: focus {
    outline: 2px solid #89cb72;
    outline-offset: 2px;
    border-radius: 50%;
}

.play-circle-progress {
    transition: stroke-dashoffset 0.1s linear;
}
`;
document.head.appendChild(style);
