// melody-player.js - MIDI playback for melody search results with circular progress indicator

class MelodyPlayer {
    constructor() {
        this.currentPlayer = null;
        this.currentButton = null;
        this.animationFrame = null;
        this.verovioToolkit = null;
        this. isPlaying = false;
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
async play(meiFileId, tuneName, button) {
    console.log('=== Melody Player Debug ===');
    console.log('MEI File ID:', meiFileId);
    console.log('Tune Name:', tuneName);
    
    // Validate inputs
    if (!meiFileId || typeof meiFileId !== 'string') {
        console.error('Invalid MEI file ID:', meiFileId);
        alert('Unable to play melody:  Invalid file ID');
        return;
    }

    // If already playing this button, stop it
    if (this.isPlaying && this. currentButton === button) {
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
    this. isPlaying = true;
    this.setPlayingState(true);

    try {
        // Start Tone.js if needed
        if (typeof Tone !== 'undefined') {
            console. log('Starting Tone.js.. .');
            await Tone.start();
            console.log('Tone.js started');
        }

        // Fetch the full MEI file from your server
        console.log('Fetching MEI file.. .');
        const response = await fetch(`/db/tunes/${meiFileId}.xml`); // Adjust path as needed
        if (!response.ok) {
            throw new Error(`Failed to fetch MEI file: ${response.statusText}`);
        }
        
        const meiXML = await response.text();
        console.log('MEI file loaded, length:', meiXML.length);
        
        // Enable incip option to tell Verovio to process the incipit
        this.verovioToolkit.setOptions({
            incip: true,        // Process the <incipCode> in the MEI
            scale: 40,
            pageHeight: 500,
            pageWidth: 500,
            adjustPageHeight: true
        });
        
        console.log('Loading full MEI file into Verovio with incip: true...');
        const loaded = this.verovioToolkit.loadData(meiXML);
        console.log('MEI loaded:', loaded);
        
        console.log('Rendering to MIDI...');
        const base64midi = this.verovioToolkit.renderToMIDI();
        console.log('MIDI rendered, base64 length:', base64midi.length);

        if (!base64midi || base64midi. length < 100) {
            console.error('MIDI data seems too short or empty');
            throw new Error('Failed to generate MIDI from melody');
        }

        // Get or create MIDI player
        let player = document.getElementById('melody-midi-player');
        if (!player) {
            console.log('Creating new MIDI player element...');
            player = document.createElement('midi-player');
            player.id = 'melody-midi-player';
            player.setAttribute('sound-font', 'https://storage.googleapis.com/magentadata/js/soundfonts/salamander');
            player.style.display = 'none';
            document.body. appendChild(player);
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        this.currentPlayer = player;
        
        console.log('Loading MIDI into player...');
        player.src = 'data:audio/midi;base64,' + base64midi;
        
        await new Promise(resolve => setTimeout(resolve, 100));

        if (typeof player.load === 'function') {
            console.log('Calling player.load()...');
            player.load();
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        if (typeof player.start === 'function') {
            console.log('Calling player. start()...');
            player. start();
            console.log('Player started');
            
            // Estimate duration - assume ~30 notes average for an incipit
            const estimatedDuration = 15000; // 15 seconds default
            
            this.startProgressAnimation(player, estimatedDuration);
        }

        // Listen for player end event
        player.addEventListener('ended', () => {
            console. log('Playback ended');
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
