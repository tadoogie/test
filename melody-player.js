// melody-player.js - MIDI playback for melody search results with circular progress indicator

class MelodyPlayer {
    constructor() {
        this.currentPlayer = null;
        this.currentButton = null;
        this.animationFrame = null;
        this.verovioToolkit = null;
        this.isPlaying = false;
        this.playerReady = false;
        
        // Pre-initialize player on construction
        this.ensurePlayerReady();
    }

    async initialize() {
        // Wait for Verovio to be ready
        if (typeof verovio === 'undefined') {
            console.error('Verovio not loaded');
            return false;
        }
        
        if (!this.verovioToolkit) {
            await verovio.module.onRuntimeInitialized;
            this.verovioToolkit = new verovio.toolkit();
        }
        return true;
    }

    // Pre-create and initialize MIDI player to avoid delays during playback
    async ensurePlayerReady() {
        if (this.playerReady) {
            return;
        }

        try {
            // Start Tone.js early if available
            if (typeof Tone !== 'undefined') {
                await Tone.start();
                console.log('✓ Tone.js pre-initialized');
            }

            // Create MIDI player element if it doesn't exist
            let player = document.getElementById('melody-midi-player');
            if (!player) {
                console.log('Pre-creating MIDI player element...');
                player = document.createElement('midi-player');
                player.id = 'melody-midi-player';
                player.setAttribute('sound-font', 'https://storage.googleapis.com/magentadata/js/soundfonts/salamander');
                player.style.display = 'none';
                document.body.appendChild(player);
                
                // Wait for player to be ready
                await new Promise(resolve => setTimeout(resolve, 500));
                console.log('✓ MIDI player pre-created and ready');
            }
            
            this.playerReady = true;
        } catch (error) {
            console.warn('Error pre-initializing player:', error);
        }
    }

    // Create MEI with Plain and Easy incipit
    createMEIWithIncipit(paeCode, tuneName = 'Melody') {
        const mei = `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.1">
    <meiHead>
        <fileDesc>
            <titleStmt>
                <title>${this.escapeXml(tuneName)}</title>
            </titleStmt>
            <pubStmt></pubStmt>
        </fileDesc>
        <workList>
            <work>
                <title>${this.escapeXml(tuneName)}</title>
                <incip>
                    <incipCode form="plaineAndEasie">${this.escapeXml(paeCode)}</incipCode>
                </incip>
            </work>
        </workList>
    </meiHead>
    <music>
        <body></body>
    </music>
</mei>`;
        return mei;
    }

    escapeXml(unsafe) {
        if (! unsafe) return '';
        return unsafe. replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
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

    // Play melody from Plain and Easy code
   // Replace the play method in melody-player.js:
async play(paeCode, tuneName, button) {
    console.log('=== Melody Player Debug ===');
    console.log('PAE Code:', paeCode);
    console.log('Tune Name:', tuneName);
    
    // Validate inputs
    if (!paeCode || typeof paeCode !== 'string') {
        console.error('Invalid PAE code:', paeCode);
        alert('Unable to play melody: Melody data is not available');
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
        // Ensure player is pre-initialized
        await this.ensurePlayerReady();

        // Pass PAE directly to Verovio (it natively supports PAE format)
        console.log('Loading PAE directly into Verovio...');
        console.log('PAE to load:', paeCode);
        
        // Set Verovio options for PAE rendering
        this.verovioToolkit.setOptions({
            scale: 40,
            pageHeight: 500,
            pageWidth: 500,
            adjustPageHeight: true
        });
        
        // Load PAE data directly - Verovio can parse PAE natively
        const loaded = this.verovioToolkit.loadData(paeCode);
        console.log('loadData returned:', loaded);
        
        if (loaded === 0 || !loaded) {
            console.error('❌ Verovio loadData failed - returned:', loaded);
            throw new Error('Verovio failed to load PAE data');
        }
        
        console.log('✓ PAE loaded successfully into Verovio');
        
        console.log('Rendering to MIDI...');
        const base64midi = this.verovioToolkit.renderToMIDI();
        console.log('MIDI rendered, base64 length:', base64midi.length);

        if (!base64midi || base64midi.length < 100) {
            console.error('MIDI data seems too short or empty');
            throw new Error('Failed to generate MIDI from melody');
        }

        // Get the pre-created MIDI player
        const player = document.getElementById('melody-midi-player');
        if (!player) {
            throw new Error('MIDI player not available');
        }

        this.currentPlayer = player;
        
        // Load MIDI data and wait for it to be ready
        console.log('Loading MIDI into player...');
        player.src = 'data:audio/midi;base64,' + base64midi;
        
        // Wait for player to load the MIDI data
        await new Promise((resolve, reject) => {
            const loadHandler = () => {
                console.log('✓ Player loaded MIDI data');
                resolve();
            };
            const errorHandler = (e) => {
                console.error('Player load error:', e);
                reject(new Error('Failed to load MIDI'));
            };
            
            // Set up listeners
            player.addEventListener('load', loadHandler, { once: true });
            player.addEventListener('error', errorHandler, { once: true });
            
            // Call load if available
            if (typeof player.load === 'function') {
                player.load();
            }
            
            // Fallback timeout in case load event doesn't fire
            setTimeout(() => {
                player.removeEventListener('load', loadHandler);
                player.removeEventListener('error', errorHandler);
                resolve();
            }, 1000);
        });

        // Start playback immediately - player is now ready
        if (typeof player.start === 'function') {
            console.log('Starting playback...');
            player.start();
            console.log('✓ Playback started');
            
            // Estimate duration - assume ~30 notes average for an incipit
            const estimatedDuration = 15000; // 15 seconds default
            
            this.startProgressAnimation(estimatedDuration);
        }

        // Listen for player end event
        player.addEventListener('ended', () => {
            console.log('Playback ended');
            if (this.currentPlayer === player) {
                this.stop();
            }
        }, { once: true });

    } catch (error) {
        console.error('Error playing melody:', error);
        console.error('Stack:', error.stack);
        this.stop();
        alert('Unable to play melody.  Check console for details.');
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
