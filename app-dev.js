// --- Globals for metadata and PDF generation ---
// Version 2.2 - With Spinner Debugging (2026-02-10)

// VERSION CHECK - This should appear FIRST in console if file is loaded correctly
console.log('%c═══════════════════════════════════════════════════════════', 'color: #4CAF50; font-weight: bold');
console.log('%c🎵 APP-DEV.JS VERSION 2.2 - LOADED SUCCESSFULLY 🎵', 'color: #4CAF50; font-weight: bold; font-size: 14px');
console.log('%c═══════════════════════════════════════════════════════════', 'color: #4CAF50; font-weight: bold');
console.log('%cIf you see this message, the updated app-dev.js is loaded!', 'color: #2196F3; font-style: italic');
console.log('%cDebugging features: Spinner logs with emoji indicators 🔄✅🎨', 'color: #2196F3');
console.log('%cMinimum spinner display time: 500ms', 'color: #2196F3');
console.log('%c═══════════════════════════════════════════════════════════', 'color: #4CAF50; font-weight: bold');

var globalTitle = '';
var globalTuneTitle = '';
var globalTextSource = '';
var globalTextSourceDate = '';
var globalTuneSource = '';
var globalTuneSourceDate = '';
var globalTeiID = '';
var globalPsTune = '';
var globalSelStanzas = [];

// --- Verovio toolkits, page state, and MIDI highlight state ---
let vrvToolkit, tk_pdf;
let page = 1;
let zoom = 50;
let trInterval = "0";
let timemap = [];
let timemapIdx = 0;
let lastOnsetIdx = 0;
let lastReportedTime = 0; // ms
let highlightRAF = null;
const highlightId = 'data-highlight';
let playbackOnLoad = false;
let currentXmlData = "";
let layerVolumes = {};
let layerMuteStates = {};let noteIdToPage = {};
let measureIdToPage = {};
let pageToLastMeasureTime = {};
const PAGE_TURN_OFFSET = 100;
let pageLoadInProgress = false;
let pageTurnRAF = null;
let debugInterval = null;
let playbackStartTime = null;
let playbackStartOffset = 0;

// --- iOS Detection ---
function isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// --- Comprehensive State Reset Function ---
function resetAppState() {
    console.log('🔄 [RESET] Resetting application state...');
    
    // Stop any ongoing playback
    try {
        const player = document.getElementById('verovio-midi-player');
        if (player && typeof player.stop === "function") {
            player.stop();
        }
    } catch (e) {
        console.error('❌ [RESET] Error stopping player:', e);
    }
    
    // Clear MIDI highlighting
    try {
        stopMidiHighlighting();
    } catch (e) {
        console.error('❌ [RESET] Error stopping highlighting:', e);
    }
    
    // Clear animation frames and intervals
    if (typeof highlightRAF !== 'undefined' && highlightRAF) {
        cancelAnimationFrame(highlightRAF);
        highlightRAF = null;
    }
    if (typeof pageTurnRAF !== 'undefined' && pageTurnRAF) {
        cancelAnimationFrame(pageTurnRAF);
        pageTurnRAF = null;
    }
    if (typeof debugInterval !== 'undefined' && debugInterval) {
        clearInterval(debugInterval);
        debugInterval = null;
    }
    
    // Reset timemap and playback state
    timemapIdx = 0;
    lastReportedTime = 0;
    playbackStartTime = null;
    playbackStartOffset = 0;
    pageLoadInProgress = false;
    
    // Clear highlight elements
    try {
        unHighlightAllElements();
    } catch (e) {
        console.error('❌ [RESET] Error unhighlighting elements:', e);
    }
    
    // Reset page to 1
    if (typeof page !== 'undefined' && page !== 1) {
        page = 1;
    }
    
    // Clear failsafe timeouts (they will be recreated)
    // Note: Individual failsafe timeouts are cleared in their respective functions
    
    console.log('✅ [RESET] State reset complete');
}

// --- iOS AudioContext Resume Helper ---
async function ensureAudioContextResumed() {
    if (!isIOSDevice()) return true;
    
    try {
        const audioContext = Tone.context.rawContext || Tone.context._context;
        if (audioContext && audioContext.state === 'suspended') {
            console.log('🔊 [iOS] AudioContext suspended, attempting to resume...');
            await audioContext.resume();
            console.log('✅ [iOS] AudioContext resumed');
        }
        return true;
    } catch (error) {
        console.error('❌ [iOS] Failed to resume AudioContext:', error);
        return false;
    }
}

// --- DOMContentLoaded: All event handlers and UI set up here ---
document.addEventListener("DOMContentLoaded", () => {
    verovio.module.onRuntimeInitialized = () => {
        vrvToolkit = new verovio.toolkit();
        tk_pdf = new verovio.toolkit();
        // Set flag or call your main setup/render logic here!
        verovioToolkitReady = true;


    // --- PDF modal controls ---
    const paperSizeModal = document.getElementById('paperSizeModal');
    const printPdfButton = document.getElementById('printPDF');
    const cancelPdfButton = document.getElementById('cancelPdfButton');
    const generatePdfButton = document.getElementById('generatePdfButton');

    printPdfButton.addEventListener('click', () => {
        paperSizeModal.style.display = 'flex';
    });
    cancelPdfButton.addEventListener('click', () => {
        paperSizeModal.style.display = 'none';
    });
    generatePdfButton.addEventListener('click', async function() {
        paperSizeModal.style.display = 'none';
        const selectedSizeElement = document.querySelector('input[name="paperSize"]:checked');
        const selectedPaperSize = selectedSizeElement ? selectedSizeElement.value : 'LETTER';
        await generatePDF(selectedPaperSize);
    });

    // --- MIDI playback and highlight controls (mei-friend-inspired) ---
    const playMIDIButton = document.getElementById("playMIDI");
    if (playMIDIButton) {
        playMIDIButton.addEventListener("click", async function() {
            stopMIDIHandler();
            if (typeof midiTempoAdjustment !== 'undefined') {
                vrvToolkit.setOptions({ midiTempoAdjustment: midiTempoAdjustment });
                vrvToolkit.redoLayout();
                setTimemap(vrvToolkit.renderToTimemap({includeMeasures: true}));
            }
            
            await loadAudioAndPlayHandler();
        });
    }
        const pauseMIDIButton = document.getElementById("pauseMIDI");
        if (pauseMIDIButton) {
            pauseMIDIButton.addEventListener("click", stopMIDIHandler);
        }

        // --- MIDI PLAYER EVENT LISTENERS (FOR END/PAUSE AUTOCLEANUP) ---
        const player = document.getElementById('verovio-midi-player');
        if (player) {
            player.addEventListener('ended', function() {
                stopMidiHighlighting();
                // Optionally: enable pagination buttons here if you disable them during playback
            });
            player.addEventListener('pause', function() {
                stopMidiHighlighting();
                // Optionally: enable pagination buttons here if you disable them during playback
            });
        }

    // --- Navigation and Zoom controls ---
    window.addEventListener("resize", debounce(applyZoom, 200));
    const zoomInButton = document.getElementById("zoomIn");
        if (zoomInButton) {
            zoomInButton.addEventListener("click", zoomIn);
        }
    
    const zoomOutButton = document.getElementById("zoomOut");
        if (zoomOutButton) {
            zoomOutButton.addEventListener("click", zoomOut);
        }
    
    // Pagination controls
    const firstPageButton = document.getElementById("firstPage");
        if (firstPageButton) {
            firstPageButton.addEventListener("click", firstPage);
        }
    
    const prevPageButton = document.getElementById("prevPage");
        if (prevPageButton) {
            prevPageButton.addEventListener("click", prevPage);
        }
    
    const nextPageButton = document.getElementById("nextPage");
        if (nextPageButton) {
            nextPageButton.addEventListener("click", nextPage);
        }
    
    const lastPageButton = document.getElementById("lastPage");
        if (lastPageButton) {
            lastPageButton.addEventListener("click", lastPage);
        }
    
    // Transpose controls
    const trUpButton = document.getElementById("trUp");
        if (trUpButton) {
            trUpButton.addEventListener("click", trUp);
        }
    
    const trDownButton = document.getElementById("trDown");
        if (trDownButton) {
            trDownButton.addEventListener("click", trDown);
        }

    // --- Keyboard navigation (arrows, zoom, etc.) ---
    window.addEventListener("keyup", function(event) {
        processBasicEvents(event);
    });

    // --- Respond to window resize with layout/zoom update ---
    window.addEventListener("resize", () => {
        applyZoom();
    });

    // --- Initial file load (or trigger via UI as desired) ---
    //loadFile();

    };
});

function setFormFromURLParamsAndTriggerOnchange() {
    const params = new URLSearchParams(window.location.search);

    // Set pssource from URL params
    const psSourceParam = params.get('pssource') || params.get('psSource');
    if (psSourceParam) {
        const psSourceInput = document.getElementById('pssource');
        if (psSourceInput) {
            psSourceInput.value = psSourceParam;
            // Optionally trigger onchange
            if (typeof psSourceInput.onchange === "function" || psSourceInput.hasAttribute("onchange")) {
                psSourceInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    // Set pstext from URL params
    const psTextParam = params.get('pstext');
    if (psTextParam) {
        const psTextSelect = document.getElementById('pstext');
        if (psTextSelect) {
            psTextSelect.value = psTextParam;
            // Optionally trigger onchange
            if (typeof psTextSelect.onchange === "function" || psTextSelect.hasAttribute("onchange")) {
                psTextSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }
}

function applyTuneAndStanzaParameters() {
    const params = new URLSearchParams(window.location.search);

    // Set tune
    const pstuneParam = params.get('pstune');
    if (pstuneParam) {
        const pstuneInput = document.getElementById('pstune');
        if (pstuneInput) {
            pstuneInput.value = pstuneParam;
            // Optionally trigger onchange
            if (typeof pstuneInput.onchange === "function" || pstuneInput.hasAttribute("onchange")) {
                pstuneInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    // Select stanzas (checkboxes)
    const selStanzasParam = params.get('selectVerses') || params.get('selStanzas');
    if (selStanzasParam) {
        const stanzaValues = selStanzasParam.replace(/['"]/g, '').split(',').map(s => s.trim());
        const verseSelectionContainer = document.getElementById('verseSelection');
        if (verseSelectionContainer) {
            const checkboxes = verseSelectionContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = stanzaValues.includes(checkbox.value);
            });
        }
    }
}

function applyStanzaSelectionsFromURL() {
    const params = new URLSearchParams(window.location.search);
    const selStanzasParam = params.get('selectVerses') || params.get('selStanzas');
    if (selStanzasParam) {
        // Clean up the parameter format
        const stanzaValues = selStanzasParam.replace(/['"]/g, '').split(',').map(s => s.trim());

        // Deselect all using your toggle function
        const indVersesDiv = document.getElementById('indVerses');
        const selectAllBox = document.getElementById('selectAll');
        if (indVersesDiv && selectAllBox) {
            selectAllBox.checked = false; // Uncheck "Select All"
            toggle(indVersesDiv);         // Deselect all stanza checkboxes
        }

        // Now, select only those matching stanzaValues
        const checkboxes = indVersesDiv.getElementsByTagName("input");
        for (let a = 0; a < checkboxes.length; a++) {
            if (stanzaValues.includes(checkboxes[a].value)) {
                checkboxes[a].checked = true;
                // Optionally trigger onchange
                if (typeof checkboxes[a].onchange === "function" || checkboxes[a].hasAttribute("onchange")) {
                    checkboxes[a].dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }

        // Optionally, update the display
        if (document.getElementById("selectVerses")) {
            document.getElementById("selectVerses").innerHTML = stanzaValues.join(", ");
        }
    }
}

// --- Call this after all dropdowns/lists are populated ---
// If you use async data loading, call this from a callback or after a Promise resolves.
// For synchronous setup, a short timeout after DOMContentLoaded is sufficient.

function autoRenderPsalmFromURL() {
    setFormFromURLParamsAndTriggerOnchange();

    // Optionally: If all required fields are filled, trigger renderPsalm
    if (
        document.getElementById('pssource')?.value &&
        document.getElementById('pstext')?.value &&
        document.getElementById('pstune')?.value &&
        Array.from(document.getElementsByName('stanzas')).some(cb => cb.checked)
    ) {
        renderPsalm();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // For async dropdown population, replace this with a callback/event!
    setTimeout(autoRenderPsalmFromURL, 800); // Adjust delay as needed for your content
});

// Main function: checks URL and triggers renderPsalm if autoGen is present
async function URLVariableFunction() {
    const params = new URLSearchParams(window.location.search);

    if (!params.has('autoGen')) return;

    let teiID = params.get('teiID') || params.get('teiID');
    let selStanzas = params.get('selStanzas') || params.get('selectVerses') || params.get('stanzas');
    let psTune = params.get('psTune');

    let selStanzasArr = null;
    if (selStanzas) {
        selStanzasArr = selStanzas.replace(/['"]/g, '').split(',').map(s => s.trim());
    }

    renderPsalm({
        teiID: teiID,
        selStanzas: selStanzasArr,
        psTune: psTune,
        autoGen: true
    });
}

// Example: adjust your renderPsalm to accept an argument object
function renderPsalm({ teiID, selStanzas, psTune, autoGen } = {}) {
    // If these variables are provided, use them; else fall back to menu fields
    // ... your custom logic here ...
}

// Call the function on load (after DOM is ready)
document.addEventListener("DOMContentLoaded", () => {
    URLVariableFunction();
});


function setTimemap(tm) {
    timemap = tm || [];
    determineLastOnsetIdx();
    timemapIdx = 0;
}

function determineLastOnsetIdx() {
    let i = timemap.length;
    while (i-- > 0) {
        if ('on' in timemap[i]) {
            lastOnsetIdx = i;
            break;
        }
    }
}

function highlightNote(note, id = '') {
    if (!note) return;
    note.classList.add('currently-playing');
    if (id) note.setAttribute(highlightId, id);
    note.querySelectorAll('g').forEach((g) => g.classList.add('currently-playing'));
}

function unhighlightNote(note) {
    if (!note) return;
    note.classList.remove('currently-playing');
    note.removeAttribute(highlightId);
    note.querySelectorAll('.currently-playing').forEach((g) => g.classList.remove('currently-playing'));
}

function unHighlightAllElements() {
    document.querySelectorAll('.currently-playing').forEach((g) => g.classList.remove('currently-playing'));
}

function getTimeFromTimemap(id) {
    for (let e of timemap) {
        if (e.hasOwnProperty('on') && e.on.includes(id)) {
            return e.tstamp;
        }
    }
    return -1;
}

function getPageForTime(t) {
    // Verovio's timemap entries sometimes include page info
    // Find the last timemap entry <= t that has a 'page' property and return it
    let p = 1;
    for (let i = 0; i < timemap.length; i++) {
        if (timemap[i].tstamp <= t && timemap[i].page !== undefined) {
            p = timemap[i].page;
        }
    }
    return p;
}

function seekMidiPlaybackToTime(t) {
    const player = document.getElementById('verovio-midi-player');
    if (player) {
        if (player.playing) {
            player.stop();
            player.currentTime = t / 1000;
            player.start();
        } else {
            player.currentTime = t / 1000;
        }
    }
    timemapIdx = 0;
    unHighlightAllElements();
}

function highlightNotesAtMidiPlaybackTime(ev = false) {
    const player = document.getElementById('verovio-midi-player');
    let t;
    if (ev && ev.detail && ev.detail.note && ev.detail.note.startTime !== undefined) {
        t = ev.detail.note.startTime * 1000;
    } else if (player) {
        t = player.currentTime * 1000;
    } else {
        return;
    }
    const currentlyHighlightedNotes = Array.from(document.querySelectorAll('g.note.currently-playing'));
    const firstNoteOnPage = document.querySelector('.note');

    // Efficiently advance timemapIdx - WITH SAFETY LIMIT
    if (t < lastReportedTime) timemapIdx = 0;
    lastReportedTime = t;
    
    let iterations = 0;
    const MAX_ITERATIONS = 1000; // Safety limit
    
    while (
        timemap.length > 0 &&
        Math.round(timemap[timemapIdx].tstamp) + 1 < Math.round(t) &&
        timemapIdx < timemap.length - 1 &&
        iterations < MAX_ITERATIONS
    ) {
        timemapIdx++;
        iterations++;
    }

    // Unhighlight notes whose off event has occurred
    let ix = timemapIdx;
    while (ix >= 0 && timemap.length > 0) {
        if ('off' in timemap[ix]) {
            let i = currentlyHighlightedNotes.length - 1;
            while (i >= 0) {
                if (timemap[ix].off.includes(currentlyHighlightedNotes[i].getAttribute(highlightId))) {
                    unhighlightNote(currentlyHighlightedNotes[i]);
                    currentlyHighlightedNotes.splice(i, 1);
                }
                i = Math.min(currentlyHighlightedNotes.length - 1, --i);
            }
        }
        if ('on' in timemap[ix] && firstNoteOnPage && timemap[ix].on.includes(firstNoteOnPage.id)) {
            break;
        }
        ix--;
    }

    // At the last onset, schedule future unhighlights for remaining "off" events
    if (timemapIdx === lastOnsetIdx) {
        let j = timemapIdx;
        while (j++ < timemap.length - 1) {
            if ('off' in timemap[j]) {
                timemap[j].off.forEach((id) => {
                    let note = document.getElementById(id);
                    setTimeout(() => unhighlightNote(note), timemap[j].tstamp - t, note);
                });
            }
            // Stop the player at the end
            if (j === timemap.length - 1) {
                setTimeout(() => player.stop(), timemap[j].tstamp - t, player);
            }
        }
    }

    // Highlight notes at current timemap event
    let closestTimemapTime = timemap[timemapIdx];
    if (closestTimemapTime && 'on' in closestTimemapTime) {
        for (let id of closestTimemapTime['on']) {
            let note = document.getElementById(id);
            if (note) {
                highlightNote(note, id);
                // Schedule unhighlight for notes that end later (only if not immediately followed by another "on")
                for (let i = timemapIdx + 1; i < timemap.length - 1; i++) {
                    if ('off' in timemap[i] && timemap[i].off.includes(id)) {
                        if (!('on' in timemap[i])) {
                            setTimeout(() => unhighlightNote(note), timemap[i].tstamp - t, note);
                        }
                        break;
                    }
                }
            }
        }
    }
}

function pageTurnLoop() {
    const player = document.getElementById('verovio-midi-player');
    
    // Use performance.now() for timing instead of player.currentTime
    let currentTime;
    if (playbackStartTime !== null) {
        currentTime = performance.now() - playbackStartTime + playbackStartOffset;
    } else {
        currentTime = player ? (player.currentTime * 1000) : 0;
    }
    
    // Check for page turn
    if (player && currentTime > 0 && page < vrvToolkit.getPageCount() && !pageLoadInProgress) {
        let currentPageEndTime = pageToLastMeasureTime[page];
        
        if (currentPageEndTime && currentTime >= (currentPageEndTime - PAGE_TURN_OFFSET)) {
            pageLoadInProgress = true;
            
            const currentlyPlaying = Array.from(document.querySelectorAll('g.note.currently-playing'))
                .map(note => note.getAttribute(highlightId) || note.id);
            
            const nextPage = page + 1;
            
            setTimeout(() => {
                page = nextPage;
                loadPage();
                
                currentlyPlaying.forEach(noteId => {
                    const noteOnNewPage = document.getElementById(noteId);
                    if (noteOnNewPage) {
                        highlightNote(noteOnNewPage, noteId);
                    }
                });
                
                pageLoadInProgress = false;
            }, 0);
        }
    }
    
    // ALWAYS call requestAnimationFrame
    pageTurnRAF = requestAnimationFrame(pageTurnLoop);
}

function midiHighlightLoop() {
    const player = document.getElementById('verovio-midi-player');
    if (player && !player.paused && !player.ended) {
        highlightNotesAtMidiPlaybackTime();
        highlightRAF = requestAnimationFrame(midiHighlightLoop);
    } else {
        highlightRAF = null;
    }
}

function startMidiHighlighting() {
    if (highlightRAF) cancelAnimationFrame(highlightRAF);
    if (pageTurnRAF) cancelAnimationFrame(pageTurnRAF);
    if (debugInterval) clearInterval(debugInterval);
    
    // Record the start time
    const player = document.getElementById('verovio-midi-player');
    playbackStartTime = performance.now();
    playbackStartOffset = player ? (player.currentTime * 1000) : 0;
    
    highlightNotesAtMidiPlaybackTime();
    highlightRAF = requestAnimationFrame(midiHighlightLoop);
    pageTurnRAF = requestAnimationFrame(pageTurnLoop);
    
    debugInterval = setInterval(debugPlayerTime, 50);
}

function stopMidiHighlighting() {
    if (highlightRAF) cancelAnimationFrame(highlightRAF);
    if (pageTurnRAF) cancelAnimationFrame(pageTurnRAF);
    if (debugInterval) clearInterval(debugInterval);
    highlightRAF = null;
    pageTurnRAF = null;
    debugInterval = null;
    playbackStartTime = null;
    unHighlightAllElements();
}

function buildNoteIdToPageMap() {
    noteIdToPage = {};
    let pageCount = vrvToolkit.getPageCount();
    for (let p = 1; p <= pageCount; p++) {
        let svg = vrvToolkit.renderToSVG(p, {});
        let tempDiv = document.createElement('div');
        tempDiv.innerHTML = svg;
        let notes = tempDiv.querySelectorAll('g.note[id]');
        notes.forEach(note => {
            noteIdToPage[note.id] = p;
        });
    }
}

function buildMeasureIdToPageMap() {
    measureIdToPage = {};
    pageToLastMeasureTime = {};
    
    let pageCount = vrvToolkit.getPageCount();
    
    for (let p = 1; p <= pageCount; p++) {
        let svg = vrvToolkit.renderToSVG(p, {});
        let tempDiv = document.createElement('div');
        tempDiv.innerHTML = svg;
        
        let measures = tempDiv.querySelectorAll('g.measure[id]');
        let lastMeasureId = null;
        
        measures.forEach(measure => {
            measureIdToPage[measure.id] = p;
            lastMeasureId = measure.id;
        });
        
        // Find the FIRST measure on the NEXT page using measureOn in timemap
        if (p < pageCount && timemap.length > 0) {
            let nextPageSvg = vrvToolkit.renderToSVG(p + 1, {});
            let nextPageDiv = document.createElement('div');
            nextPageDiv.innerHTML = nextPageSvg;
            
            let firstMeasureOnNextPage = nextPageDiv.querySelector('g.measure[id]');
            if (firstMeasureOnNextPage) {
                let nextMeasureId = firstMeasureOnNextPage.id;
                
                // Find when this measure starts in the timemap using measureOn
                let found = false;
                for (let i = 0; i < timemap.length; i++) {
                    if (timemap[i].measureOn && timemap[i].measureOn === nextMeasureId) {
                        pageToLastMeasureTime[p] = timemap[i].tstamp;
                        found = true;
                        break;
                    }
                }
            }
        }
    }
}

function debugPlayerTime() {
    const player = document.getElementById('verovio-midi-player');
    if (player && player.currentTime) {
        const time = player.currentTime * 1000;
    }
}

function applyTempoToVerovio() {
    if (!vrvToolkit || !currentXmlData) return;
    
    // Set the tempo adjustment option in Verovio
    vrvToolkit.setOptions({ midiTempoAdjustment: midiTempoAdjustment });
    
    // Regenerate the layout and timemap
    vrvToolkit.redoLayout();
    setTimemap(vrvToolkit.renderToTimemap({includeMeasures: true}));
    buildNoteIdToPageMap();
    buildMeasureIdToPageMap();
    
    // Re-render the current page
    loadPage();
}

function detectLayers(xmlDoc) {
    const layers = [];
    const layerDefs = xmlDoc.querySelectorAll('layerDef');
    
    layerDefs.forEach((layerDef, index) => {
        const layerId = layerDef.getAttribute('xml:id') || layerDef.getAttribute('id');
        const label = layerDef.getAttribute('label') || `Layer ${index + 1}`;
        const staffN = layerDef.closest('staffDef')?.getAttribute('n') || '1';
        const layerN = layerDef.getAttribute('n') || (index + 1).toString();
        
        layers.push({
            id: layerId,
            staffN: staffN,
            layerN: layerN,
            label: label,
            fullLabel: `${label}`
        });
        
        // Initialize volume to 71% (90/127) if not already set
        if (!layerVolumes[layerId]) {
            layerVolumes[layerId] = 71; // 90/127 ≈ 71%
        }
    });
    
    return layers;
}

function createLayerVolumeControls(layers) {
    const container = document.getElementById('layerVolumeControls');
    if (!container) return;
    
    // Clear existing controls
    container.innerHTML = '';
    
    layers.forEach(layer => {
        const sliderDiv = document.createElement('div');
        sliderDiv.style.margin = '7px 0';
        
        const label = document.createElement('span');
        label.style.color = '#fff';
        label.style.display = 'block';
        label.style.fontSize = '0.9em';
        label.textContent = layer.fullLabel;
        
        // Container for mute button and slider
        const controlsContainer = document.createElement('div');
        controlsContainer.style.display = 'flex';
        controlsContainer.style.alignItems = 'center';
        controlsContainer.style.gap = '10px';
        
        // Mute button
        const muteButton = document.createElement('button');
        muteButton.id = `mute-btn-${layer.id}`;
        muteButton.title = 'Mute'; // Add title attribute
        muteButton.style.background = 'none';
        muteButton.style.border = 'none';
        muteButton.style.cursor = 'pointer';
        muteButton.style.padding = '4px';
        muteButton.style.display = 'flex';
        muteButton.style.alignItems = 'center';
        muteButton.style.justifyContent = 'center';
        
        // Initialize mute state
        layerMuteStates[layer.id] = false;
        
        // Create SVG for unmuted state
        const createUnmutedSVG = () => {
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width: 20px; height: 20px; fill: #fff;">
                <path d="M533.6 96.5C523.3 88.1 508.2 89.7 499.8 100C491.4 110.3 493 125.4 503.3 133.8C557.5 177.8 592 244.8 592 320C592 395.2 557.5 462.2 503.3 506.3C493 514.7 491.5 529.8 499.8 540.1C508.1 550.4 523.3 551.9 533.6 543.6C598.5 490.7 640 410.2 640 320C640 229.8 598.5 149.2 533.6 96.5zM473.1 171C462.8 162.6 447.7 164.2 439.3 174.5C430.9 184.8 432.5 199.9 442.8 208.3C475.3 234.7 496 274.9 496 320C496 365.1 475.3 405.3 442.8 431.8C432.5 440.2 431 455.3 439.3 465.6C447.6 475.9 462.8 477.4 473.1 469.1C516.3 433.9 544 380.2 544 320.1C544 260 516.3 206.3 473.1 171.1zM412.6 245.5C402.3 237.1 387.2 238.7 378.8 249C370.4 259.3 372 274.4 382.3 282.8C393.1 291.6 400 305 400 320C400 335 393.1 348.4 382.3 357.3C372 365.7 370.5 380.8 378.8 391.1C387.1 401.4 402.3 402.9 412.6 394.6C434.1 376.9 448 350.1 448 320C448 289.9 434.1 263.1 412.6 245.5zM80 416L128 416L262.1 535.2C268.5 540.9 276.7 544 285.2 544C304.4 544 320 528.4 320 509.2L320 130.8C320 111.6 304.4 96 285.2 96C276.7 96 268.5 99.1 262.1 104.8L128 224L80 224C53.5 224 32 245.5 32 272L32 368C32 394.5 53.5 416 80 416z"/>
            </svg>`;
        };
        
        // Create SVG for muted state
        const createMutedSVG = () => {
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width: 20px; height: 20px; fill: #ff0000;">
                <path d="M80 416L128 416L262.1 535.2C268.5 540.9 276.7 544 285.2 544C304.4 544 320 528.4 320 509.2L320 130.8C320 111.6 304.4 96 285.2 96C276.7 96 268.5 99.1 262.1 104.8L128 224L80 224C53.5 224 32 245.5 32 272L32 368C32 394.5 53.5 416 80 416zM399 239C389.6 248.4 389.6 263.6 399 272.9L446 319.9L399 366.9C389.6 376.3 389.6 391.5 399 400.8C408.4 410.1 423.6 410.2 432.9 400.8L479.9 353.8L526.9 400.8C536.3 410.2 551.5 410.2 560.8 400.8C570.1 391.4 570.2 376.2 560.8 366.9L513.8 319.9L560.8 272.9C570.2 263.5 570.2 248.3 560.8 239C551.4 229.7 536.2 229.6 526.9 239L479.9 286L432.9 239C423.5 229.6 408.3 229.6 399 239z"/>
            </svg>`;
        };
        
        // Set initial button content
        muteButton.innerHTML = createUnmutedSVG();
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = `layer-volume-${layer.id}`;
        slider.min = '0';
        slider.max = '100';
        slider.value = layerVolumes[layer.id] || '71'; // Default to 71% (90/127)
        
        // Function to update mute button appearance
        const updateMuteButtonAppearance = () => {
            const isMuted = layerMuteStates[layer.id] || parseInt(slider.value) === 0;
            muteButton.innerHTML = isMuted ? createMutedSVG() : createUnmutedSVG();
        };
        
        // Mute button click handler
        muteButton.addEventListener('click', function() {
            layerMuteStates[layer.id] = !layerMuteStates[layer.id];
            
            if (layerMuteStates[layer.id]) {
                // Mute: remember current value and set slider to 0
                muteButton.dataset.previousValue = slider.value;
                slider.value = '0';
                layerVolumes[layer.id] = 0;
            } else {
                // Unmute: restore previous value or default
                const previousValue = muteButton.dataset.previousValue || '71';
                slider.value = previousValue;
                layerVolumes[layer.id] = parseInt(previousValue);
            }
            
            updateMuteButtonAppearance();
        });
        
        // Slider input handler
        slider.addEventListener('input', function() {
            const value = parseInt(this.value);
            layerVolumes[layer.id] = isNaN(value) ? 0 : value;
            
            // Update mute state based on slider value
            if (value === 0) {
                layerMuteStates[layer.id] = true;
            } else {
                layerMuteStates[layer.id] = false;
            }
            
            updateMuteButtonAppearance();
        });
        
        // Initial appearance update
        updateMuteButtonAppearance();
        
        controlsContainer.appendChild(muteButton);
        controlsContainer.appendChild(slider);
        
        sliderDiv.appendChild(label);
        sliderDiv.appendChild(controlsContainer);
        container.appendChild(sliderDiv);
    });
}
function applyLayerVolumes(xmlDoc, layers) {
    layers.forEach(layer => {
        const volumePercent = layerVolumes[layer.id];
        
        // Handle undefined/null values
        const safeVolumePercent = (volumePercent !== undefined && volumePercent !== null) ? volumePercent : 71;
        
        // Convert percentage to MIDI velocity (0-127), ensuring no NaN
        const velocity = Math.max(0, Math.min(127, Math.round((safeVolumePercent / 100) * 127)));
        
        // Find all notes in this specific layer
        const layerElements = xmlDoc.querySelectorAll(`layer[n="${layer.layerN}"]`);
        
        layerElements.forEach(layerElement => {
            // Check if this layer is in the correct staff
            const parentStaff = layerElement.closest('staff');
            if (parentStaff && parentStaff.getAttribute('n') === layer.staffN) {
                const notes = layerElement.querySelectorAll('note');
                notes.forEach(note => {
                    note.setAttribute('vel', velocity.toString());
                });
            }
        });
    });
    
    return xmlDoc;
}

// Helper functions for loading spinner
let spinnerStartTime = null;
const MIN_SPINNER_DISPLAY_TIME = 500; // Minimum time to show spinner in ms

function showLoadingSpinner() {
    console.log('🔄 [SPINNER] showLoadingSpinner() called');
    const container = document.getElementById("svg_output");
    if (!container) {
        console.error('❌ [SPINNER] ERROR: svg_output container not found!');
        return;
    }
    
    container.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <div class="loading-text">Loading...</div>
        </div>
    `;
    spinnerStartTime = Date.now();
    console.log('✅ [SPINNER] Spinner HTML set, start time:', spinnerStartTime);
    
    // Force a reflow to ensure spinner is painted
    container.offsetHeight;
    console.log('🎨 [SPINNER] Forced reflow to ensure paint');
}

function ensureMinimumSpinnerTime(callback) {
    // SIMPLIFIED: No artificial delays - execute callback immediately
    // The spinner shows naturally during processing time
    console.log('✅ [SPINNER] Executing callback immediately (no artificial delay)');
    try {
        callback();
    } catch (error) {
        console.error('❌ [SPINNER] Error in callback:', error);
        // Force remove spinner on error
        const container = document.getElementById("svg_output");
        if (container) {
            container.innerHTML = '<div style="padding: 20px; color: #d32f2f;"><h3>Error Loading Score</h3><p>An error occurred. Please try selecting a different score.</p></div>';
        }
    }
}

function loadDataWithLayerVolumes(data) {
    console.log('📥 [LOAD] loadDataWithLayerVolumes() called, data length:', data?.length || 0);
    
    // Reset app state before loading to prevent state corruption from previous errors
    try {
        resetAppState();
    } catch (error) {
        console.error('❌ [LOAD] Error resetting state:', error);
    }
    
    // Show loading spinner immediately
    showLoadingSpinner();
    
    // Failsafe: force remove spinner after 10 seconds if nothing else does
    const failsafeTimeout = setTimeout(() => {
        console.error('⚠️ [LOAD] FAILSAFE: Forcing spinner removal after 10 seconds');
        const container = document.getElementById("svg_output");
        if (container && container.innerHTML.includes('loading-spinner')) {
            container.innerHTML = `
                <div style="padding: 20px; color: #ff9800;">
                    <h3>Loading Timeout</h3>
                    <p>The score took too long to load. Please try a different selection.</p>
                </div>
            `;
            resetAppState();
        }
    }, 10000); // 10 second failsafe
    
    // Use single requestAnimationFrame to allow spinner to paint, then process immediately
    // This is MUCH faster than setTimeout and more reliable on iOS
    const processData = () => {
        console.log('🚀 [LOAD] Processing starting - Verovio loading');
        const processingStartTime = Date.now();
        
        try {
            // Parse the XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data, 'text/xml');
            
            // Detect layers and create controls
            const layers = detectLayers(xmlDoc);
            createLayerVolumeControls(layers);
            
            // **DON'T apply velocities here - only on play**
            
            // Store the original and layers for later use
            window.currentLayers = layers;
            window.originalXmlData = data; // Store original without velocity modifications
            currentXmlData = data; // Keep original for display
            
            // Proceed with normal Verovio loading (without velocities)
            setOptions();
            vrvToolkit.loadData(data);
            tk_pdf.loadData(data);
            setTimemap(vrvToolkit.renderToTimemap({includeMeasures: true}));
            buildNoteIdToPageMap();
            buildMeasureIdToPageMap();
            page = 1;
            
            const processingTime = Date.now() - processingStartTime;
            console.log(`⚡ [LOAD] Verovio processing completed in ${processingTime}ms`);
            
            // Display content immediately - no artificial delay
            clearTimeout(failsafeTimeout);
            console.log('🖼️ [LOAD] Calling loadPage() to display rendered content');
            loadPage();
            console.log('✅ [LOAD] loadDataWithLayerVolumes() complete');
        } catch (error) {
            clearTimeout(failsafeTimeout);
            console.error('❌ [LOAD] Error loading data with layer volumes:', error);
            console.error('❌ [LOAD] Error stack:', error.stack);
            
            // Reset state to prevent error persistence
            try {
                resetAppState();
            } catch (resetError) {
                console.error('❌ [LOAD] Error during state reset:', resetError);
            }
            
            // Show error message instead of spinner
            const container = document.getElementById("svg_output");
            const errorDetail = isIOSDevice() ? 
                '<p style="font-size: 14px; color: #666;">Try selecting a different score.</p>' :
                '';
            container.innerHTML = `
                <div style="padding: 20px; color: #d32f2f;">
                    <h3>Error Loading Score</h3>
                    <p>An error occurred while processing the music data.</p>
                    ${errorDetail}
                    <p style="margin-top: 15px;">
                        <button onclick="location.reload()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Reload Page
                        </button>
                    </p>
                </div>
            `;
        }
    };
    
    // Use requestAnimationFrame for single paint cycle, or immediate fallback
    if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(processData);
    } else {
        processData();
    }
}
                resetAppState();
            } catch (resetError) {
                console.error('❌ [LOAD] Error during state reset:', resetError);
            }
            
            // Show error message instead of spinner
            const container = document.getElementById("svg_output");
            const errorDetail = isIOSDevice() ? 
                '<p style="font-size: 14px; color: #666;">iOS-specific issue detected. Try selecting a different score or refreshing the page.</p>' :
                '';
            container.innerHTML = `
                <div style="padding: 20px; color: #d32f2f;">
                    <h3>Error Loading Score</h3>
                    <p>An error occurred while processing the music data.</p>
                    ${errorDetail}
                    <p style="margin-top: 15px;">
                        <button onclick="location.reload()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Reload Page
                        </button>
                    </p>
                </div>
            `;
        }
    }, 50); // Small delay to ensure spinner renders
}

function resetLayerVolumesToDefault() {
    if (window.currentLayers) {
        window.currentLayers.forEach(layer => {
            layerVolumes[layer.id] = 71; // 90/127 ≈ 71%
            const slider = document.getElementById(`layer-volume-${layer.id}`);
            if (slider) {
                slider.value = '71';
            }
        });
    }
}

// --- Core Verovio and UI functions (excluding PDF function and after) ---

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function setOptions() {
    let maxWidth = 1150;
    let maxHeight = 900
    let containerWidth = Math.floor(window.innerWidth * 0.85);
    let containerHeight = Math.floor(window.innerHeight * 0.9);
    let pageWidth = Math.min(containerWidth, maxWidth);
    let pageHeight = Math.min(containerHeight, maxHeight);

    let options = {
        pageHeight: pageHeight,
        pageWidth: pageWidth,
        scale: zoom,
        adjustPageHeight: true,
        transpose: trInterval,
        spacingLinear: 0.35,
        scaleToPageSize: true,
        svgAdditionalAttribute: ["note@pname", "note@oct"], 
        lyricWordSpace: 4.0 
    };
    
    vrvToolkit.setOptions(options);
}

function loadData(data) {
    console.log('📥 [LOAD] loadData() called, data length:', data?.length || 0);
    
    // Reset app state before loading
    try {
        resetAppState();
    } catch (error) {
        console.error('❌ [LOAD] Error resetting state:', error);
    }
    
    // Show loading spinner immediately
    showLoadingSpinner();
    
    // Failsafe: force remove spinner after 10 seconds if nothing else does
    const failsafeTimeout = setTimeout(() => {
        console.error('⚠️ [LOAD] FAILSAFE: Forcing spinner removal after 10 seconds');
        const container = document.getElementById("svg_output");
        if (container && container.innerHTML.includes('loading-spinner')) {
            container.innerHTML = `
                <div style="padding: 20px; color: #ff9800;">
                    <h3>Loading Timeout</h3>
                    <p>The score took too long to load. Please try a different selection.</p>
                </div>
            `;
            resetAppState();
        }
    }, 10000); // 10 second failsafe
    
    // Use single requestAnimationFrame to allow spinner to paint, then process immediately
    const processData = () => {
        console.log('🚀 [LOAD] Processing starting - Verovio loading');
        const processingStartTime = Date.now();
        
        try {
            setOptions();
            vrvToolkit.loadData(data);
            tk_pdf.loadData(data);
            setTimemap(vrvToolkit.renderToTimemap({includeMeasures: true}));
            buildNoteIdToPageMap();
            page = 1;
            
            const processingTime = Date.now() - processingStartTime;
            console.log(`⚡ [LOAD] Verovio processing completed in ${processingTime}ms`);
            
            // Display content immediately
            clearTimeout(failsafeTimeout);
            console.log('🖼️ [LOAD] Calling loadPage() to display rendered content');
            loadPage();
            console.log('✅ [LOAD] loadData() complete');
        } catch (error) {
            clearTimeout(failsafeTimeout);
            console.error('❌ [LOAD] Error loading data:', error);
            console.error('❌ [LOAD] Error stack:', error.stack);
            
            // Reset state to prevent error persistence
            try {
                resetAppState();
            } catch (resetError) {
                console.error('❌ [LOAD] Error during state reset:', resetError);
            }
            
            // Show error message instead of spinner
            const container = document.getElementById("svg_output");
            const errorDetail = isIOSDevice() ? 
                '<p style="font-size: 14px; color: #666;">Try selecting a different score.</p>' :
                '';
            container.innerHTML = `
                <div style="padding: 20px; color: #d32f2f;">
                    <h3>Error Loading Score</h3>
                    <p>An error occurred while processing the music data.</p>
                    ${errorDetail}
                    <p style="margin-top: 15px;">
                        <button onclick="location.reload()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Reload Page
                        </button>
                    </p>
                </div>
            `;
        }
    };
    
    // Use requestAnimationFrame for single paint cycle, or immediate fallback
    if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(processData);
    } else {
        processData();
    }
}

function loadPage() {
    let svg = vrvToolkit.renderToSVG(page, {});
    const container = document.getElementById("svg_output");
    container.innerHTML = ""; // Clear old content
    
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = svg; // svg is a string containing the SVG markup
    
    // Extract the SVG node and append it fresh
    const svgNode = tempDiv.querySelector("svg");
    if (svgNode) {
      // Optionally: assign a unique key/id if you want to mimic the React solution
      svgNode.setAttribute("data-key", Date.now()); // or use a random string
      container.appendChild(svgNode);
    } else {
      // fallback: just append all child nodes if not a single SVG root
      while (tempDiv.firstChild) {
        container.appendChild(tempDiv.firstChild);
      }
    }
    unHighlightAllElements();
}

function loadFile() {
    renderPsalm();
    //let fullData = new XMLSerializer().serializeToString(xmlData);
    //loadData(fullData);
}

function nextPage() {
    stopMIDIHandler()
    if (page < vrvToolkit.getPageCount()) {
        page++;
        loadPage();
    }
}
function prevPage() {
     stopMIDIHandler();
    if (page > 1) {
        page--;
        loadPage();
    }
}
function firstPage() {
    stopMIDIHandler();
    page = 1;
    loadPage();
}
function lastPage() {
    stopMIDIHandler();
    page = vrvToolkit.getPageCount();
    loadPage();
}
function applyZoom() {
    setOptions();
    vrvToolkit.redoLayout();
    page = 1;
    loadPage();
}
function zoomOut() {
    if (zoom > 20) {
        zoom -= 5;
        applyZoom();
    }
}
function zoomIn() {
    if (zoom < 80) {
        zoom += 5;
        applyZoom();
    }
}
function trUp() {
    trInterval = String(Number(trInterval) + 1);
    setOptions();
    loadData(currentXmlData);
}
function trDown() {
    trInterval = String(Number(trInterval) - 1);
    setOptions();
    loadData(currentXmlData);
}

function processBasicEvents(event) {
    if (event.ctrlKey && event.keyCode == 37) {
        firstPage();
    } else if (event.keyCode == 37) {
        prevPage();
    } else if (event.ctrlKey && event.keyCode == 39) {
        lastPage();
    } else if (event.keyCode == 39) {
        nextPage();
    } else if ([107, 187, 61].includes(event.keyCode)) {
        zoomIn();
    } else if ([109, 189, 173].includes(event.keyCode)) {
        zoomOut();
    }
}

// --- Helper: always start playback from the MEI that is currently displayed ---
function getBaseMeiForPlayback() {
    try {
        if (tk_pdf && typeof tk_pdf.getMEI === 'function') {
            const mei = tk_pdf.getMEI();
            if (mei && mei.length) return mei;
        }
    } catch (e) {
        // ignore and fall back
    }
    return currentXmlData || window.originalXmlData || '';
}

// --- MIDI control handlers (mei-friend-inspired approach) ---
function stopMIDIHandler() {
    try {
        const player = document.getElementById('verovio-midi-player');
        if (player && typeof player.stop === "function") player.stop();
        stopMidiHighlighting();
    } catch (error) {
        // Silently catch errors - don't let MIDI issues prevent UI interactions
        console.log('⚠️ [MIDI] Error in stopMIDIHandler (non-critical):', error.message);
    }
}

async function loadAudioAndPlayHandler() {
    console.log('🎵 [MIDI] loadAudioAndPlayHandler() called');
    const player = document.getElementById('verovio-midi-player');
    
    if (!player) {
        console.error('❌ [MIDI] Player element not found');
        alert('MIDI player not available.');
        return;
    }
    
    // Stop any existing playback and reset state
    console.log('🛑 [MIDI] Stopping existing playback and resetting state');
    try {
        if (typeof player.stop === "function") player.stop();
        stopMidiHighlighting();
    } catch (error) {
        console.error('❌ [MIDI] Error stopping player:', error);
    }
    
    // Reset to first page before playback starts
    if (page !== 1) {
        page = 1;
        loadPage();
    }
    
    // Reset playback state
    timemapIdx = 0;
    lastReportedTime = 0;
    playbackStartTime = null;
    playbackStartOffset = 0;
    
    // iOS AudioContext handling
    if (isIOSDevice()) {
        console.log('📱 [iOS] Detected iOS device, ensuring AudioContext is resumed');
        const contextResumed = await ensureAudioContextResumed();
        if (!contextResumed) {
            console.error('❌ [iOS] Failed to resume AudioContext');
            alert('Audio playback requires user interaction on iOS. Please try again.');
            return;
        }
    }
    
    // Start Tone.js AudioContext
    try { 
        console.log('🔊 [MIDI] Starting Tone.js AudioContext');
        await Tone.start();
        console.log('✅ [MIDI] Tone.js AudioContext started');
    } catch (error) {
        console.error('❌ [MIDI] Error starting Tone.js:', error);
        if (isIOSDevice()) {
            alert('Audio initialization failed on iOS. Please refresh the page and try again.');
            return;
        }
    }
    
    // Ensure soundfont is loaded
    if (player && !player.soundFont) {
        try {
            console.log('🎹 [MIDI] Loading soundfont...');
            await player.ensureSoundfontLoaded();
            console.log('✅ [MIDI] Soundfont loaded');
        } catch (error) {
            console.error('❌ [MIDI] Soundfont loading failed:', error);
            // Continue anyway, player might work without explicit soundfont load
        }
    }
    
    setOptions();
    if (typeof midiTempoAdjustment !== 'undefined') {
        vrvToolkit.setOptions({ midiTempoAdjustment: midiTempoAdjustment });
    }
    
    const baseMei = getBaseMeiForPlayback();
    
    if (!baseMei) {
        console.error('❌ [MIDI] No score data available');
        alert('No score loaded to play.');
        return;
    }
    
    try {
        if (window.currentLayers && baseMei) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(baseMei, 'text/xml');
            applyLayerVolumes(xmlDoc, window.currentLayers);
            const serializer = new XMLSerializer();
            const modifiedData = serializer.serializeToString(xmlDoc);
            
            vrvToolkit.loadData(modifiedData);
        } else if (baseMei) {
            vrvToolkit.loadData(baseMei);
        }
        
        vrvToolkit.redoLayout();
        setTimemap(vrvToolkit.renderToTimemap({includeMeasures: true}));
        buildNoteIdToPageMap();
        buildMeasureIdToPageMap();
        
        console.log('🎼 [MIDI] Rendering MIDI data...');
        let base64midi = vrvToolkit.renderToMIDI();
        player.src = 'data:audio/midi;base64,' + base64midi;
        console.log('✅ [MIDI] MIDI data rendered and set');
    } catch (error) {
        console.error('❌ [MIDI] Error preparing MIDI:', error);
        alert('Failed to prepare MIDI playback. Please try again or refresh the page.');
        return;
    }
    
    try {
        if (typeof player.load === "function") player.load();
        if (typeof player.stop === "function") player.stop();
        
        setTimeout(() => {
            if (typeof player.start === "function") player.start();
            lastReportedTime = 0;
            timemapIdx = 0;
            highlightNotesAtMidiPlaybackTime();
            startMidiHighlighting();
        }, 1000);
        
    } catch (error) {
        alert('Audio playback encountered an issue. The score is still functional for viewing.');
    }
}

// --- When you load new MEI, update SVG, timemap, and clear highlights. ---
function renderAndDisplayMEI(meiXML) {
    console.log('📥 [RENDER] renderAndDisplayMEI() called, XML length:', meiXML?.length || 0);
    
    // Show loading spinner immediately
    showLoadingSpinner();
    
    // Failsafe: force remove spinner after 10 seconds if nothing else does
    const failsafeTimeout = setTimeout(() => {
        console.error('⚠️ [RENDER] FAILSAFE: Forcing spinner removal after 10 seconds');
        const container = document.getElementById("svg_output");
        if (container && container.innerHTML.includes('loading-spinner')) {
            container.innerHTML = `
                <div style="padding: 20px; color: #ff9800;">
                    <h3>Loading Timeout</h3>
                    <p>The score took too long to load. Please try a different selection.</p>
                </div>
            `;
        }
    }, 10000); // 10 second failsafe
    
    // Use single requestAnimationFrame to allow spinner to paint, then process immediately
    const processData = () => {
        console.log('🚀 [RENDER] Processing starting - Verovio loading');
        const processingStartTime = Date.now();
        
        try {
            vrvToolkit.loadData(meiXML);
            tk_pdf.loadData(meiXML);
            setTimemap(vrvToolkit.renderToTimemap({includeMeasures: true}));
            
            const processingTime = Date.now() - processingStartTime;
            console.log(`⚡ [RENDER] Verovio processing completed in ${processingTime}ms`);
            
            // Display content immediately
            clearTimeout(failsafeTimeout);
            console.log('🖼️ [RENDER] Setting SVG output and unhighlighting elements');
            document.getElementById("svg_output").innerHTML = vrvToolkit.renderToSVG(page);
            unHighlightAllElements();
            console.log('✅ [RENDER] renderAndDisplayMEI() complete');
        } catch (error) {
            clearTimeout(failsafeTimeout);
            console.error('❌ [RENDER] Error rendering MEI:', error);
            // Show error message instead of spinner
            const container = document.getElementById("svg_output");
            container.innerHTML = `
                <div style="padding: 20px; color: #d32f2f;">
                    <h3>Error Loading Score</h3>
                    <p>An error occurred while processing the music data. Please try again.</p>
                </div>
            `;
        }
    };
    
    // Use requestAnimationFrame for single paint cycle, or immediate fallback
    if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(processData);
    } else {
        processData();
    }
}


// --- PDF generation (unchanged from your code) ---
async function generatePDF(selectedPaperSize) {

    if (!tk_pdf || tk_pdf.getMEI() === '') {
        // IMPORTANT: Replace alert() with a custom modal or message box in a real application.
        alert("Verovio PDF toolkit is not ready or no MEI data loaded. Please load a score first.");
        return;
    }

    try {
        const originalPdfOptions = tk_pdf.getOptions();

        const paperSizeOptions = {
            'LETTER': {
                pdfkitSize: 'LETTER',
                pdfKitMargins: { top: 30, bottom: 30, left: 30, right: 30 },
                svgVerticalOffset: -5,
                footerReservedHeight: 40,
                verovioSettings: {
                    pageWidth: 2056,
                    pageHeight: 2661,
                    spacingLinear: 0.4,
                    spacingNonLinear: 0.59,
                    unit: 9
                }
            },
            'A4': {
                pdfkitSize: 'A4',
                pdfKitMargins: { top: 25, bottom: 30, left: 30, right: 30 },
                svgVerticalOffset: -5,
                footerReservedHeight: 40,
                verovioSettings: {
                    pageWidth: 2100,
                    pageHeight: 2970,
                    spacingLinear: 0.4,
                    spacingNonLinear: 0.59,
                    unit: 9
                }
            },
            'A5': {
                pdfkitSize: 'A5',
                pdfKitMargins: { top: 10, bottom: 10, left: 10, right: 10 },
                svgVerticalOffset: 0,
                footerReservedHeight: 20,
                verovioSettings: {
                    pageWidth: 1100,
                    pageHeight: 2100,
                    spacingLinear: 0.4,
                    spacingNonLinear: 0.5,
                    unit: 6
                }
            },
            'STATEMENT': {
                pdfkitSize: [396, 612],
                pdfKitMargins: { top: 10, bottom: 10, left: 20, right: 20 },
                svgVerticalOffset: 0,
                footerReservedHeight: 40,
                verovioSettings: {
                    pageWidth: 1550,
                    pageHeight: 2056,
                    spacingLinear: 0.5,
                    spacingNonLinear: 0.55,
                    unit: 9
                }
            }
        };

        const currentPaperSettings = paperSizeOptions[selectedPaperSize];

        let doc = new PDFDocument({
            size: currentPaperSettings.pdfkitSize,
            layout: 'portrait',
            margins: currentPaperSettings.pdfKitMargins
        });

        const stream = doc.pipe(blobStream());

        stream.on('finish', function() {
            const blob = stream.toBlob('application/pdf');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // PDF filename using the passed parameters
            const pdfFilename = `${globalTitle || 'untitled'}_${globalTuneTitle || 'untitled'}_${selectedPaperSize.toLowerCase()}.pdf`;
            a.download = pdfFilename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        });

        stream.on('error', function(err) {
            // IMPORTANT: Replace alert() with a custom modal or message box.
            alert("An error occurred during PDF creation.");
        });

        const drawableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const drawableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - currentPaperSettings.footerReservedHeight;

        const verovioPageHeightForDrawableArea = (drawableHeight / drawableWidth) * currentPaperSettings.verovioSettings.pageWidth;

        tk_pdf.setOptions({
            font: 'Leipzig', // Ensure this font is embedded or available to PDFKit if not standard
            adjustPageHeight: true,
            footer: 'none', // Verovio's footer is disabled as we're adding our own via PDFKit
            pageWidth: currentPaperSettings.verovioSettings.pageWidth,
            pageHeight: verovioPageHeightForDrawableArea,
            unit: currentPaperSettings.verovioSettings.unit,
            scaleToPageSize: false,
            shrinkToFit: false,
            transpose: trInterval, // Assuming trInterval is a global variable or passed as argument
            spacingLinear: currentPaperSettings.verovioSettings.spacingLinear,
            spacingNonLinear: currentPaperSettings.verovioSettings.spacingNonLinear,
        });

        // Reload data into tk_pdf AFTER setting options to apply transpose.
        // Use tk_pdf.getMEI() to reliably get the current MEI data.
        tk_pdf.loadData(tk_pdf.getMEI());

        const pageCount = tk_pdf.getPageCount();

        // Define logo properties BEFORE the loop
        // IMPORTANT: This base64 string is for a specific image. If your logo changes, update this.
        const logoSrc = 'data:image/png;base64,iVBORw0K...'; // truncated for brevity
        const logoHeight = 25;
        const logoWidth = logoHeight * (100 / 25);
        const gapBetweenLogoAndText = -75;

        const baseFooterY = doc.page.height - doc.page.margins.bottom - (currentPaperSettings.footerReservedHeight / 2);

        for (let i = 1; i <= pageCount; i++) {
            const svgString = tk_pdf.renderToSVG(i);

            if (typeof svgString !== 'string' || svgString.trim() === '' || !svgString.startsWith('<svg')) {
                throw new Error(`Invalid or malformed SVG content for page ${i}.`);
            }

            await SVGtoPDF(doc, svgString, doc.page.margins.left, doc.page.margins.top + currentPaperSettings.svgVerticalOffset, {
                width: drawableWidth,
                height: drawableHeight,
                preserveAspectRatio: 'xMidYMid meet',
                assumeGIsCursive: true
            });

            // --- Footer Content ---
            doc.font('Helvetica');
            doc.fontSize(9);

            const textSourceLineY = baseFooterY - 33;
            doc.text(`Text source: ${globalTextSource} (${globalTextSourceDate})`, doc.page.margins.left, textSourceLineY, {
                align: 'center'
            });

            const tuneSourceLineY = baseFooterY - 23;
            doc.text(`Tune source: ${globalTuneSource} (${globalTuneSourceDate})`, doc.page.margins.left, tuneSourceLineY, {
                align: 'center'
            });

            const copyrightText = "Generated by the Digital Splitleaf (https://splitleaf.org)";
            doc.fontSize(10);

            const copyrightTextWidth = doc.widthOfString(copyrightText);
            const totalCopyrightContentWidth = logoWidth + gapBetweenLogoAndText + copyrightTextWidth;
            const startXForCopyrightBlock = doc.page.margins.left + (drawableWidth - totalCopyrightContentWidth) / 2;

            const logoX = startXForCopyrightBlock;
            const logoY = baseFooterY - (logoHeight / 2);

            try {
                doc.image(logoSrc, logoX, logoY, {
                    height: logoHeight
                });
            } catch (imgError) {}

            const copyrightTextX = logoX + logoWidth + gapBetweenLogoAndText;
            const copyrightTextY = baseFooterY - (doc.currentLineHeight() / 2);

            doc.text(copyrightText, copyrightTextX, copyrightTextY, {
                width: copyrightTextWidth
            });
            // --- End Footer Content ---

            if (i < pageCount) {
                doc.addPage();
            }
        }

        doc.end();
        tk_pdf.setOptions(originalPdfOptions);

    } catch (error) {
        alert("Failed to generate PDF: " + error.message);
    }
}

// --- Utility: recursively change attribute (unchanged) ---
function changeAttributeRecursively(node, attributeName, sequence) {
    for (let i = 0; i < node.childNodes.length; i++) {
        const childNode = node.childNodes[i];
        if (childNode.nodeType === Node.ELEMENT_NODE) {
            let oldID = childNode.getAttribute(attributeName);
            if (oldID === null) {
                oldID = childNode.nodeName + '_' + Date.now();
            }
            let newValue = oldID + sequence;
            childNode.setAttribute(attributeName, newValue);
            let childClass = node.getAttribute("class");
            if (childClass !== "undefined") {
                childNode.setAttribute("class", newValue)
            }
            changeAttributeRecursively(childNode, attributeName, newValue);
        }
    }
}

function findParentNode(xmlDoc, childNode, parentTagName) {
    let currentNode = childNode;
    while (currentNode && currentNode.tagName !== parentTagName) {
        currentNode = currentNode.parentNode;
    }
    return currentNode;
}

function displayMode (xmlDoc, stanzaCount){
    var dupNode = xmlDoc.getElementsByTagName("section")[0];
    var bars = dupNode.getElementsByTagName("measure");

    //Set final bar to double barline
    var barsCount = bars.length;
    bars[barsCount-1].setAttribute("right", "dbl");

    //Identify the measures in the section to be duplicated
    var m = dupNode.getElementsByTagName("measure");

    //Get rid of extra text in MEI section before copying
    var mDir = m[0].getElementsByTagName("dir");
    var mTempo = m[0].getElementsByTagName("tempo");
            
    if (mDir !== "undefined"){
        for (var i=0; i<mDir.length; i++){
        mDir[i].remove();
        } 
    }
    
    if (mTempo !== "undefined"){
        for (var i=0; i<mDir.length; i++){
        mTempo[i].remove();
        } 
    }

    var versesToDelete = Array.from(xmlDoc.querySelectorAll('verse:not([n="1"])'));
        versesToDelete.forEach(verse => {
            // Remove the verse element from its parent node
            verse.parentNode.removeChild(verse);
        });

    for (i=1; i<stanzaCount; i++){
        //Create new version of content to be copied
        var newNode = dupNode.cloneNode(true);

        //Create new section in the MEI document
        var newSection = xmlDoc.createElement("section");
        var parentElement = xmlDoc.getElementsByTagName("score")[0];
        var getAtt = "xml:id";
        var newSectionAtt = xmlDoc.createAttribute(getAtt);
        var oldAtt = newNode.getAttribute(getAtt);

        //Delete verses not needed from the new version
        var versesToDelete = Array.from(newNode.querySelectorAll('verse:not([n="'+(i+1)+'"])'));
        versesToDelete.forEach(verse => {
            // Remove the verse element from its parent node
            verse.parentNode.removeChild(verse);
        });

        //Create a new xml:id attribute for the new section
        if (oldAtt === 'undefined') {
            oldAtt = newNode.nodeName + '_' + Date.now();
        }

        var newAttValue = oldAtt + "A";
        parentElement.appendChild(newSection);
        newSectionAtt.nodeValue = newAttValue;
        parentElement.lastChild.setAttributeNode(newSectionAtt);
        newNode.setAttribute(getAtt, newAttValue);
        
        changeAttributeRecursively(newNode, getAtt, );	


        for (let i = 0; i < newNode.childNodes.length; i++) {
                const childNode = newNode.childNodes[i];
                newNode.appendChild(childNode.cloneNode(true)); 
        }
        
        const targetRoot = xmlDoc.getElementsByTagName("score")[0].lastChild;
        targetRoot.appendChild(newNode);             
    }
    
    var finalBars = xmlDoc.getElementsByTagName("measure");
    var finalBarCount = finalBars.length;
    bars[finalBarCount-1].setAttribute("right", "end");
}


function appendSuffixToIdsAndIdrefs(root, suffix = "A", { skipRoot = true } = {}) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

    const ATTR_XML_ID = "xml:id";
    const idSet = new Set();

    // 1) Collect all original IDs in the subtree (before renaming), optionally skipping the root
    (function collect(node, isRoot) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (!(skipRoot && isRoot)) {
            if (node.hasAttribute(ATTR_XML_ID)) {
                idSet.add(node.getAttribute(ATTR_XML_ID));
            } else if (node.hasAttribute("id")) {
                idSet.add(node.getAttribute("id"));
            }
        }
        for (let i = 0; i < node.children.length; i++) {
            collect(node.children[i], false);
        }
    })(root, true);

    // 2) Rename IDs by appending the suffix
    (function rename(node, isRoot) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (!(skipRoot && isRoot)) {
            if (node.hasAttribute(ATTR_XML_ID)) {
                const oldId = node.getAttribute(ATTR_XML_ID);
                if (oldId) node.setAttribute(ATTR_XML_ID, oldId + suffix);
            } else if (node.hasAttribute("id")) {
                const oldId = node.getAttribute("id");
                if (oldId) node.setAttribute("id", oldId + suffix);
            }
        }
        for (let i = 0; i < node.children.length; i++) {
            rename(node.children[i], false);
        }
    })(root, true);

    // 3) Rewrite IDREF attributes for slurs/ties/spanners
    function rewriteRefAttr(el, attrName) {
        if (!el.hasAttribute(attrName)) return;
        const raw = (el.getAttribute(attrName) || "").trim();
        if (!raw) return;

        // Handles single tokens (e.g., startid, endid) and space-separated lists (plist)
        const tokens = raw.split(/\s+/).map(tok => {
            if (tok.startsWith("#")) {
                const bare = tok.slice(1);
                // Only rewrite if the target existed inside this subtree
                if (idSet.has(bare)) return `#${bare}${suffix}`;
            }
            return tok;
        });
        el.setAttribute(attrName, tokens.join(" "));
    }

    (function rewriteRefs(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        // Typical MEI spanners:
        rewriteRefAttr(node, "startid");
        rewriteRefAttr(node, "endid");
        rewriteRefAttr(node, "plist");

        for (let i = 0; i < node.children.length; i++) {
            rewriteRefs(node.children[i]);
        }
    })(root);
}

function displayMode (xmlDoc, stanzaCount){
    var dupNode = xmlDoc.getElementsByTagName("section")[0];
    var bars = dupNode.getElementsByTagName("measure");

    // final barline to dbl
    var barsCount = bars.length;
    bars[barsCount-1].setAttribute("right", "dbl");

    // Clean text (dir/tempo) from the template section
    var m = dupNode.getElementsByTagName("measure");
    var mDir = m[0].getElementsByTagName("dir");
    var mTempo = m[0].getElementsByTagName("tempo");
    if (mDir !== "undefined"){ for (var i=0; i<mDir.length; i++){ mDir[i].remove(); } }
    if (mTempo !== "undefined"){ for (var i=0; i<mTempo.length; i++){ mTempo[i].remove(); } }

    // Keep only verse n="1" in the template before copying
    Array.from(xmlDoc.querySelectorAll('verse:not([n="1"])')).forEach(v => v.parentNode.removeChild(v));

    for (i=1; i<stanzaCount; i++){
        var newNode = dupNode.cloneNode(true);

        // Keep only the verse that will survive in this duplicate
        Array.from(newNode.querySelectorAll('verse:not([n="'+(i+1)+'"])')).forEach(v => v.parentNode.removeChild(v));

        // Assign new section xml:id by appending "A"
        var parentElement = xmlDoc.getElementsByTagName("score")[0];
        var oldSectionId = newNode.getAttribute("xml:id") || (newNode.nodeName + '_' + Date.now());
        var newSectionId = oldSectionId + "A";
        newNode.setAttribute("xml:id", newSectionId);

        // IMPORTANT: apply the same "A" suffix to all descendant IDs and slur/tie pointers
        appendSuffixToIdsAndIdrefs(newNode, "A", { skipRoot: true });

        // Attach
        parentElement.appendChild(newNode);
    }

    var finalBars = xmlDoc.getElementsByTagName("measure");
    var finalBarCount = finalBars.length;
    bars[finalBarCount-1].setAttribute("right", "end");
}

//Combine the correct portions of the relevant XML files
function renderPsalm(options = {}) {
    // Helper to append suffix to IDs and fix IDREFs for slurs/ties/spanners
    // It follows your "append 'A' to existing ID" approach and rewrites startid/endid/plist accordingly.
    function appendSuffixToIdsAndIdrefs(root, suffix = "A", { skipRoot = true } = {}) {
        if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

        const ATTR_XML_ID = "xml:id";
        const idSet = new Set();

        // 1) Collect original IDs in the subtree (before renaming)
        (function collect(node, isRoot) {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (!(skipRoot && isRoot)) {
                if (node.hasAttribute(ATTR_XML_ID)) {
                    idSet.add(node.getAttribute(ATTR_XML_ID));
                } else if (node.hasAttribute("id")) {
                    idSet.add(node.getAttribute("id"));
                }
            }
            for (let i = 0; i < node.children.length; i++) {
                collect(node.children[i], false);
            }
        })(root, true);

        // 2) Rename IDs by appending the suffix
        (function rename(node, isRoot) {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (!(skipRoot && isRoot)) {
                if (node.hasAttribute(ATTR_XML_ID)) {
                    const oldId = node.getAttribute(ATTR_XML_ID);
                    if (oldId) node.setAttribute(ATTR_XML_ID, oldId + suffix);
                } else if (node.hasAttribute("id")) {
                    const oldId = node.getAttribute("id");
                    if (oldId) node.setAttribute("id", oldId + suffix);
                }
            }
            for (let i = 0; i < node.children.length; i++) {
                rename(node.children[i], false);
            }
        })(root, true);

        // 3) Rewrite IDREF attributes for slurs/ties/spanners
        function rewriteRefAttr(el, attrName) {
            if (!el.hasAttribute(attrName)) return;
            const raw = (el.getAttribute(attrName) || "").trim();
            if (!raw) return;

            const tokens = raw.split(/\s+/).map(tok => {
                if (tok.startsWith("#")) {
                    const bare = tok.slice(1);
                    if (idSet.has(bare)) return `#${bare}${suffix}`;
                }
                return tok;
            });
            el.setAttribute(attrName, tokens.join(" "));
        }

        (function rewriteRefs(node) {
            if (node.nodeType !== Node.ELEMENT_NODE) return;

            rewriteRefAttr(node, "startid");
            rewriteRefAttr(node, "endid");
            rewriteRefAttr(node, "plist");

            for (let i = 0; i < node.children.length; i++) {
                rewriteRefs(node.children[i]);
            }
        })(root);
    }

    const menuToggle = document.getElementById("menutoggle");
    if (menuToggle) {
        menuToggle.classList.remove("test");
        menuToggle.classList.add("hamburger");    
    }
    
    const isAutoGen = options.autoGen === true;

    // --- Get values from options OR DOM ---
    let selStanzas;
    if (isAutoGen && options.selStanzas && Array.isArray(options.selStanzas)) {
        selStanzas = options.selStanzas;
    } else {
        // Get selected verses from verse buttons
        const verseBtns = document.querySelectorAll('.verse-btn[data-selected="true"]');
        selStanzas = [];
        for (let c = 0; c < verseBtns.length; c++) {
            selStanzas.push(verseBtns[c].dataset.verse);
        }
        
        // Filter out Psalm 119 section headers if applicable
        const psTextInput = document.getElementById("pstext");
        if (psTextInput && psTextInput.value === "Psalm 119"){
            const ps119Array = ["ALEPH","BETH","GIMEL","DALETH","HE","VAV","ZAIN","HETH","TETH","YOD","CAPH","LAMED","MEM","NUN","SAMECH","AIN","PE","TSADE","KOPH","RES","SHIN","TAV"];
            selStanzas = selStanzas.filter(function(el){ return !ps119Array.includes(el); });
        }
    }
    if (selStanzas && selStanzas.length > 0) globalSelStanzas = selStanzas;

    let teiID;
    if (isAutoGen && options.teiID) {
        teiID = options.teiID;
    } else {
        const psInput = document.getElementById("pstext");
        if (!psInput || !psInput.dataset.psdata) {
            return;
        }
        const psDataArr = psInput.dataset.psdata.split(';');
        teiID = psDataArr[0];
    }
    if (teiID) globalTeiID = teiID;

    let psTune;
    if (isAutoGen && options.psTune) {
        psTune = options.psTune;
    } else {
        const tuneInput = document.getElementById("pstune");
        if (!tuneInput || !tuneInput.dataset.tuneid) {
            return;
        }
        psTune = tuneInput.dataset.tuneid;
    }
    if (psTune) globalPsTune = psTune;

    // Build text request
    const psText = "getVerses.xq?teiID=" + teiID + "&selStanzas=\"%20," + selStanzas.join(",") + ",%20\"";
    const disOptions = document.getElementById("psMode") !== null ? document.getElementById("psMode").checked : false;

    const xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", psText, true);
    xmlhttp.send(); 
    xmlhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            const myObj = this.responseXML;
            const title = myObj.getElementsByTagName("title")[0].childNodes[0].nodeValue;
            globalTitle = title;
            const author = myObj.getElementsByTagName("author")[0].childNodes[0].nodeValue;
            const textStanzas = myObj.getElementsByTagName("lg").length;
            const textSyll = myObj.getElementsByTagName("lg")[0].getElementsByTagName("seg").length;
            const textLicense = myObj.getElementsByTagName("license")[0].childNodes[0].nodeValue;
            const textLicenseURL = myObj.getElementsByTagName("license")[0].getAttribute("target");
            const textSource = myObj.getElementsByTagName("edition")[0].getElementsByTagName("title")[0].innerHTML;
            globalTextSource = textSource;
            const textSourceDate = myObj.getElementsByTagName("edition")[0].getElementsByTagName("date")[0].innerHTML;
            globalTextSourceDate = textSourceDate;
            
            //Get MEI file
            const xhttp = new XMLHttpRequest();
            xhttp.open("GET", psTune, true);
            xhttp.send();
            xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    const xmlDoc = this.responseXML;
                    const project = xmlDoc.getElementsByTagName("mei")[0];
                    let i, j, k, r = "";
                    let wordPos = [];
                    const tuneMetre = xmlDoc.getElementsByTagName("otherChar")[0].childNodes[0].nodeValue;
                    const tuneLicense = xmlDoc.getElementsByTagName("useRestrict")[0].childNodes[0].nodeValue;
                    const tuneLicenseURL = xmlDoc.getElementsByTagName("useRestrict")[0].getAttribute("auth.uri");
                    const tuneSource = xmlDoc.getElementsByTagName("edition")[0].getElementsByTagName("title")[0].innerHTML;
                    globalTuneSource = tuneSource;
                    const tuneSourceDate = xmlDoc.getElementsByTagName("edition")[0].getElementsByTagName("date")[0].innerHTML;
                    globalTuneSourceDate = tuneSourceDate;
                    const metreLen = tuneMetre.length;
                    const multiMetre = tuneMetre.charAt(metreLen-2);
                    const partMetreCheck = tuneMetre.charAt(metreLen-1);
    
                    let metreMult = 1;
                    if (multiMetre === "D") metreMult = 2;
                    else if (multiMetre === "T") metreMult = 3;
                    else if (multiMetre === "Q") metreMult = 4;
                    
                    //Get notes with verse containers
                    const y = project.getElementsByTagName("verse");
                    let sylCount = y.length;

                    //Get noteIDs for notes with verse containers
                    const containerPos = [];
                    for (i = 0; i < sylCount; i++){
                        containerPos[i] = y[i].parentElement.getAttribute("class");
                    }
                    
                    let partMetreResult = "false";
                    let startRepeat = 0;
                    let repeatSum = 0;
                    if (partMetreCheck === ")"){
                        const startPartMetre = tuneMetre.indexOf("(");
                        let partMetre = tuneMetre.substring(startPartMetre+1, metreLen-1);
                        partMetreResult = "true";
                        partMetre = partMetre.slice(0, -1);
                        const repeatArray = partMetre.split('.');
                        repeatSum = repeatArray.reduce((partialSum, a) => partialSum + Number(a), 0);
                        sylCount = sylCount - repeatSum;
                        startRepeat = sylCount - repeatSum;
                    }
    
                    //Check number of stanzas
                    const stanzaCount = textStanzas/metreMult;
                    const halfStanza = Number.isInteger(stanzaCount);
                    const fullStanza = Math.floor(stanzaCount);
                    
                    //Fill document metadata
                    const xmlTitleStmt = project.getElementsByTagName("titleStmt");
                    const xmlTitle = xmlTitleStmt[0].getElementsByTagName("title");
                    const newTitle = xmlDoc.createTextNode(title);
                    const titlePos = xmlTitle[0];
                    if (typeof titlePos.childNodes[0] !== 'undefined') {
                        titlePos.childNodes[0].nodeValue = title;
                    } else {
                        titlePos.appendChild(newTitle);
                    }
                   
                    const work = project.getElementsByTagName("work");
                    const tuneTitle = work[0].getElementsByTagName("title")[0].childNodes[0].nodeValue;
                    globalTuneTitle = tuneTitle;
                    const subTitle = xmlDoc.createElement("title", project.namespaceURI);
                    const newTune = xmlDoc.createTextNode("Tune: " + tuneTitle);
                    titlePos.parentElement.appendChild(subTitle).appendChild(newTune);
                    titlePos.parentElement.lastElementChild.setAttribute("type","subordinate");
    
                    const xmlAuth = project.getElementsByTagName("persName");
                    const authPos = xmlAuth[0].parentElement;
                    const newPers = xmlDoc.createElement("persName", project.namespaceURI);
                    const authUpdate = "Text by " + author
                    const newAuth = xmlDoc.createTextNode(authUpdate);
                    const lyrDefined = xmlDoc.querySelectorAll("[role='lyricist']");
                    if (lyrDefined === undefined || lyrDefined.length == 0){
                        authPos.appendChild(newPers).appendChild(newAuth);
                        authPos.lastElementChild.setAttribute("role","lyricist");
                    } else {
                        lyrDefined[0].childNodes[0].nodeValue = authUpdate;
                    }
    
                    //Loop through each syllable container in XML
                    for (i = 0; i< sylCount; i++){
                        const thisContainer = project.getElementsByClassName(containerPos[i])
                        const newLyric = myObj.getElementsByTagName("seg");
                        const newLyr = newLyric[i].childNodes[0].nodeValue;
                        const newLyrLen = newLyr.length;
                        const lastChar = newLyr.charAt(newLyrLen-1);
                        const newText = xmlDoc.createTextNode(newLyr);
                        const trimLyr = newLyr.substr(0,newLyrLen-1);
                        const trimText = xmlDoc.createTextNode(trimLyr); 
        
                        if (partMetreResult == "true" && i > startRepeat - 1) {
                            const r = i + repeatSum;
                            const repeatContainer = project.getElementsByClassName(containerPos[r])
                            const repeatLyr = newLyric[r].childNodes[0].nodeValue;

                            if (lastChar == "-"){
                                thisContainer[0].lastElementChild.lastElementChild.textContent = trimText.textContent;
                                repeatContainer[0].lastElementChild.lastElementChild.textContent = trimText.textContent;
                                thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");
                                repeatContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");            
                                if (wordPos == "i" || wordPos == "m"){
                                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                                    repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                                } else {            
                                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                                    repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                                }
                            } else {
                                thisContainer[0].lastElementChild.lastElementChild.textContent = newText.textContent
                                thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
                                thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t");
                                repeatContainer[0].lastElementChild.lastElementChild.textContent = newText.textContent
                                repeatContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
                                repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t");
                            }
                        } else {
                            if (lastChar == "-"){
                                thisContainer[0].lastElementChild.lastElementChild.textContent = trimText.textContent;
                                thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");          
                                if (wordPos == "i" || wordPos == "m"){
                                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                                } else {            
                                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                                }
                            } else {
                                thisContainer[0].lastElementChild.lastElementChild.textContent = newText.textContent;
                                thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
                                thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t")
                            }
                        }
                        //Add xml:id for new <lyr>
                        const newLyrAtt = 'syl_' + Date.now();
                        thisContainer[0].lastElementChild.lastElementChild.setAttribute("xml:id", newLyrAtt + "A");
                        // Update wordPos for next word
                        wordPos = thisContainer[0].lastElementChild.lastElementChild.getAttribute("wordpos");
                    } 
                    
                    let kIndex = i;
                    // If there is more than one stanza  
                    j = 1;
                    if (fullStanza > 1){
                        for (j = 1; j < fullStanza; j++){
                            for (i = 0; i< sylCount; i++){
                                const thisContainer = project.getElementsByClassName(containerPos[i])
                                const newVerse = xmlDoc.createElement("verse", project.namespaceURI);
                                const repeatVerse = newVerse.cloneNode(true);
                                const newSyl = xmlDoc.createElement("syl", project.namespaceURI);
                                const repeatSyl = newSyl.cloneNode(true);
                                const newLyr = myObj.getElementsByTagName("seg")[kIndex].childNodes[0].nodeValue;
                                const newLyrLen = newLyr.length;
                                const lastChar = newLyr.charAt(newLyrLen-1);
                                const newText = xmlDoc.createTextNode(newLyr);
                                const trimLyr = newLyr.substr(0,newLyrLen-1);
                                const trimText = xmlDoc.createTextNode(trimLyr); 
                                thisContainer[0].appendChild(newVerse).setAttribute("n",j+1);
        
                                if (partMetreResult == "true" && i > startRepeat - 1) {
                                    const r = i + repeatSum;
                                    const repeatContainer = project.getElementsByClassName(containerPos[r])
                                    const repeatLyr = myObj.getElementsByTagName("seg")[r].childNodes[0].nodeValue;
                                    repeatContainer[0].appendChild(repeatVerse).setAttribute("n",j+1);
        
                                    if (lastChar == "-"){
                                        thisContainer[0].lastElementChild.appendChild(newSyl).textContent = trimText.textContent;
                                        repeatContainer[0].lastElementChild.appendChild(repeatSyl).textContent = trimText.textContent;
                                        thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");
                                        repeatContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");            
                                        if (wordPos == "i" || wordPos == "m"){
                                            thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m")
                                            repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                                        } else {            
                                            thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                                            repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                                        }
                                    } else {
                                        thisContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent
                                        thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
                                        thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t")
                                        repeatContainer[0].lastElementChild.appendChild(repeatSyl).textContent = newText.textContent
                                        repeatContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
                                        repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t");
                                    }
                                } else {
                                    if (lastChar == "-"){
                                        thisContainer[0].lastElementChild.appendChild(newSyl).textContent = trimText.textContent;
                                        thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");          
                                        if (wordPos == "i" || wordPos == "m"){
                                            thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                                        } else {            
                                            thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                                        }
                                    } else {
                                        thisContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent;
                                        thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
                                        thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t")
                                    }
                                }
                                const newLyrAtt = 'syl_' + Date.now();
                                thisContainer[0].lastElementChild.lastElementChild.setAttribute("xml:id", newLyrAtt);
                                wordPos = thisContainer[0].lastElementChild.lastElementChild.getAttribute("wordpos");
                                kIndex = kIndex + 1;
                            }
                        }
                    } 
    
                    //Is there a half stanza at the end?
                    if (halfStanza === false){
                        const remainder = textStanzas % metreMult;
                        const startCount = textSyll* (metreMult - remainder);
                        j = j + 1;
                        for (i = startCount; i< sylCount; i++){
                            const thisContainer = project.getElementsByClassName(containerPos[i])
                            const newVerse = xmlDoc.createElement("verse", project.namespaceURI);
                            const repeatVerse = newVerse.cloneNode(true);
                            const newSyl = xmlDoc.createElement("syl", project.namespaceURI);
                            const repeatSyl = newSyl.cloneNode(true);
                            const newLyr = myObj.getElementsByTagName("seg")[kIndex].childNodes[0].nodeValue;
                            const newLyrLen = newLyr.length;
                            const lastChar = newLyr.charAt(newLyrLen-1);
                            const newText = xmlDoc.createTextNode(newLyr);
                            const trimLyr = newLyr.substr(0,newLyrLen-1);
                            const trimText = xmlDoc.createTextNode(trimLyr); 
                            thisContainer[0].appendChild(newVerse).setAttribute("n",j);
                            if (partMetreResult == "true" && i > startRepeat-1) {
                                const r = i + repeatSum;
                                const repeatContainer = project.getElementsByClassName(containerPos[r])
                                const repeatLyr = myObj.getElementsByTagName("seg")[r].childNodes[0].nodeValue;
                                repeatContainer[0].appendChild(repeatVerse).setAttribute("n",j);
                                if (lastChar == "-"){
                                    thisContainer[0].lastElementChild.appendChild(newSyl).textContent = trimText.textContent;
                                    repeatContainer[0].lastElementChild.appendChild(repeatSyl).textContent = trimText.textContent;
                                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");
                                    repeatContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");            
                                    if (wordPos == "i" || wordPos == "m"){
                                        thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                                        repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                                    } else {            
                                        thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                                        repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                                    }
                                } else {
                                    thisContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent;
                                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
                                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t")
                                    repeatContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent;
                                    repeatContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
                                    repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t")
                                }
                            } else {
                                if (lastChar == "-"){
                                    thisContainer[0].lastElementChild.appendChild(newSyl).textContent = trimText.textContent;
                                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");          
                                    if (wordPos == "i" || wordPos == "m"){
                                        thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                                    } else {            
                                        thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                                    }
                                } else {
                                    thisContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent;
                                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
                                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t")
                                }
                            }
                            const newLyrAtt = 'syl_' + Date.now();
                            thisContainer[0].lastElementChild.lastElementChild.setAttribute("xml:id", newLyrAtt);
                            wordPos = thisContainer[0].lastElementChild.lastElementChild.getAttribute("wordpos");
                            kIndex = kIndex + 1;
                        }            
                    }            

                    // --- PRESENTATION MODE DUPLICATION (repeats with verse n=1 only) ---
                    if (disOptions == true) {

                        // Final bar to double in the template section
                        const bars = xmlDoc.getElementsByTagName("measure");
                        const barsCount = bars.length;
                        bars[barsCount-1].setAttribute("right", "dbl");

                        // Template for duplication
                        const dupNode = xmlDoc.getElementsByTagName("section")[0].cloneNode(true);

                        // Set n=1 on the original first section
                        const newSectionN = xmlDoc.getElementsByTagName("section")[0];
                        const newSectionAttN = xmlDoc.createAttribute("n");
                        newSectionAttN.nodeValue = 1;
                        newSectionN.setAttributeNode(newSectionAttN);

                        // Clean text (dir/tempo) from template
                        const m = dupNode.getElementsByTagName("measure");
                        const mDir = m[0].getElementsByTagName("dir");
                        const mTempo = m[0].getElementsByTagName("tempo");
                        if (mDir !== "undefined"){
                            for (let i=0; i<mDir.length; i++){ mDir[i].remove(); } 
                        }
                        if (mTempo !== "undefined"){
                            for (let i=0; i<mTempo.length; i++){ mTempo[i].remove(); } 
                        }

                        // Strip all verses except n=1 in the original score
                        const versesToDeleteOrig = Array.from(xmlDoc.querySelectorAll('verse:not([n="1"])'));
                        versesToDeleteOrig.forEach(verse => { verse.remove(); });

                        // Duplicate for each stanza
                        for (i=1; i<stanzaCount; i++){
                            const newNode = dupNode.cloneNode(true);
                            const parentElement = project.getElementsByTagName("score")[0];

                            const getAtt = "xml:id";
                            const getAttN = "n";
                            const newSectionAtt = xmlDoc.createAttribute(getAtt);
                            const newSectionAttN = xmlDoc.createAttribute(getAttN);

                            let oldAtt = newNode.getAttribute(getAtt);
                            if (oldAtt === null) {
                                oldAtt = newNode.nodeName + '_' + Date.now();
                            }

                            const aSequence = "A".repeat(i); // your programmatic suffix pattern
                            const newAttValue = oldAtt + aSequence;
                            newSectionAtt.nodeValue = newAttValue;
                            newSectionAttN.nodeValue = i+1;
                            newNode.setAttributeNode(newSectionAtt);
                            newNode.setAttributeNode(newSectionAttN);

                            // Keep only verse n = i+1 in the duplicate
                            const versesToDelete = Array.from(newNode.querySelectorAll('verse:not([n="'+(i+1)+'"])'));
                            versesToDelete.forEach(verse => { verse.remove(); });
                            
                            // Normalize kept verse numbers to n=1 (display single line)
                            const keptVerses = newNode.querySelectorAll('verse');
                            keptVerses.forEach(verse => { verse.setAttribute('n', '1'); });
                            
                            // IMPORTANT: Append the SAME suffix to all descendant IDs and fix slur/tie IDREFs
                            appendSuffixToIdsAndIdrefs(newNode, aSequence, { skipRoot: true });

                            // Append to score
                            const targetRoot = xmlDoc.getElementsByTagName("score")[0];
                            targetRoot.appendChild(newNode);
                        }
                        
                        // Delete unused measures in the last section (no lyrics)
                        const sections = xmlDoc.getElementsByTagName('section');
                        let lastSection = sections[sections.length - 1];
                        let measuresInLastSection = lastSection.getElementsByTagName('measure');
                        for (let i = measuresInLastSection.length - 1; i >= 0; i--) {
                            const measure = measuresInLastSection[i];
                            const hasLyr = measure.getElementsByTagName('syl').length > 0;
                            if (hasLyr == false) {
                                measure.parentNode.removeChild(measure);         
                            }
                        }
                        
                        // Second pass cleanup (defensive)
                        const allSections = xmlDoc.getElementsByTagName('section');
                        lastSection = allSections[allSections.length - 1];
                        measuresInLastSection = lastSection.getElementsByTagName('measure');
                        for (let i = measuresInLastSection.length - 1; i >= 0; i--) {
                            const measure = measuresInLastSection[i];
                            const hasLyr = measure.getElementsByTagName('syl').length > 0;
                            if (hasLyr == false) {
                                measure.parentNode.removeChild(measure);         
                            }
                        }

                        // Remove unused portion of the first measure in last section
                        const partFirstMeasure = lastSection.getElementsByTagName("measure")[0];
                        const partFirstLayer = partFirstMeasure.getElementsByTagName("layer")[0];
                        const notesInFirstLayer = partFirstLayer.getElementsByTagName("note");
                        let partMeasureDur = 0;

                        // Remove notes in first layer without lyrics while timing
                        for (let i = 0; i < notesInFirstLayer.length; i++){
                            const thisNoteCandidate = notesInFirstLayer[i];
                            const hasLyr = thisNoteCandidate.getElementsByTagName('syl').length > 0;
                            if (hasLyr == false) {
                                let thisCandidateDur = 1/Number(thisNoteCandidate.getAttribute("dur"));
                                const thisCandidateDots = thisNoteCandidate.getAttribute("dots");
                                let addNoteDur = thisCandidateDur;

                                if (thisCandidateDots !== null){
                                    for (let o=0; o < thisCandidateDots; o++){
                                        addNoteDur = addNoteDur/2;
                                        thisCandidateDur = thisCandidateDur + addNoteDur;
                                    }
                                }
                                partMeasureDur = partMeasureDur + thisCandidateDur;
                                thisNoteCandidate.parentNode.removeChild(thisNoteCandidate);
                            } else {
                                break;
                            }   
                        }

                        // Use timestamp to delete unused notes in the other layers
                        const allLayers = partFirstMeasure.getElementsByTagName("layer");
                        for (let i = 1; i < allLayers.length; i++){
                            const notesInLayer = allLayers[i].getElementsByTagName("note");
                            let thisLayerDur = 0;
                            let jx = 0;
                            while (thisLayerDur < partMeasureDur) {
                                const thisCandiadateNote = notesInLayer[jx];
                                let thisCandidateDur = 1/Number(thisCandiadateNote.getAttribute("dur"));
                                const thisCandidateDots = thisCandiadateNote.getAttribute("dots");
                                let addNoteDur = thisCandidateDur;

                                if (thisCandidateDots !== null){
                                    for (let o=0; o < thisCandidateDots; o++){
                                        addNoteDur = addNoteDur/2;
                                        thisCandidateDur = thisCandidateDur + addNoteDur;
                                    }
                                }
                                thisLayerDur = thisLayerDur + thisCandidateDur;
                                jx = jx+1;
                                thisCandiadateNote.parentNode.removeChild(thisCandiadateNote);
                            }
                        }
                        
                        const finalBars = xmlDoc.getElementsByTagName("measure");
                        const finalBarCount = finalBars.length;
                        finalBars[finalBarCount-1].setAttribute("right", "end");
                    } // end presentation mode

                    document.getElementById("controls").style.display = "inline";
                    document.body.classList.add("controls-visible");
                    const textLicenseHTML = "<p><strong>Text Source:</strong>&nbsp;<em>" + textSource + "</em>&nbsp;(" + textSourceDate + ")<br/> <a href='" + textLicenseURL + "' target='_blank'>" + textLicense + "</a></p>"
                    const tuneLicenseHTML = "<p><strong>Tune Source:</strong>&nbsp;<em>" + tuneSource + "</em>&nbsp;(" + tuneSourceDate + ")<br/> <a href='" + tuneLicenseURL + "' target='_blank'>" + tuneLicense + "</a></p>"
                    document.getElementById("textLicense").innerHTML = textLicenseHTML;
                    document.getElementById("tuneLicense").innerHTML = tuneLicenseHTML;
                    
                    currentXmlData = new XMLSerializer().serializeToString(xmlDoc);
                    loadDataWithLayerVolumes(currentXmlData);
                }
            };
        }
    };
}
