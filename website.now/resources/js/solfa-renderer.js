/*!
 * solfa-renderer.js  –  Tonic sol-fa notation renderer
 *
 * Reads the current combined MEI document (window.currentXmlData) and renders
 * a tonic sol-fa table for each voice part into #svg_output.
 *
 * Layout: two rows per voice part
 *   Row 1 – sol-fa syllable (d / r / m / f / s / l / t + chromatic variants)
 *   Row 2 – lyric text syllable (from verse n="1")
 *
 * Doh is always the major-key tonic (= relative major tonic for minor keys).
 * For minor-key pieces, the tonic note is labelled "La" in the heading.
 */
(function (global) {
    'use strict';

    /* ── Pitch constants ─────────────────────────────────────────────────── */

    /** Base pitch class (0-11) for each diatonic pitch name (natural) */
    const PNAME_PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

    /** Semitone adjustment for MEI accidental codes */
    const ACCID_DELTA = { s: 1, f: -1, ss: 2, ff: -2, su: 1, fu: -1, n: 0, x: 2, bb: -2 };

    /** Order of sharps in key signatures: F C G D A E B */
    const SHARPS_ORDER = ['f', 'c', 'g', 'd', 'a', 'e', 'b'];

    /** Order of flats in key signatures: B E A D G C F */
    const FLATS_ORDER = ['b', 'e', 'a', 'd', 'g', 'c', 'f'];

    /**
     * Major-key tonic pitch class indexed by number of sharps (0-7).
     * C=0, G=7, D=2, A=9, E=4, B=11, F#=6, C#=1
     */
    const DOH_SHARPS = [0, 7, 2, 9, 4, 11, 6, 1];

    /**
     * Major-key tonic pitch class indexed by number of flats (0-7).
     * C=0, F=5, Bb=10, Eb=3, Ab=8, Db=1, Gb=6, Cb=11
     */
    const DOH_FLATS = [0, 5, 10, 3, 8, 1, 6, 11];

    /**
     * Semitones from Doh down to La (the tonic of a minor key).
     * In tonic sol-fa: La is always 3 semitones below Doh (a minor third down).
     */
    const LA_BELOW_DOH = 3;

    /**
     * Chromatic sol-fa syllables, indexed 0-11 semitones above Doh.
     * Ascending chromatic names are used for altered pitches.
     */
    const CHROMATIC = ['d', 'di', 'r', 'ri', 'm', 'f', 'fi', 's', 'si', 'l', 'li', 't'];

    /** Display names for major keys – sharps */
    const MAJOR_SHARP_NAMES = ['C', 'G', 'D', 'A', 'E', 'B', 'F\u266f', 'C\u266f'];
    /** Display names for major keys – flats */
    const MAJOR_FLAT_NAMES  = ['C', 'F', 'B\u266d', 'E\u266d', 'A\u266d', 'D\u266d', 'G\u266d', 'C\u266d'];
    /** Display names for minor keys – sharps */
    const MINOR_SHARP_NAMES = ['A', 'E', 'B', 'F\u266f', 'C\u266f', 'G\u266f', 'D\u266f', 'A\u266f'];
    /** Display names for minor keys – flats */
    const MINOR_FLAT_NAMES  = ['A', 'D', 'G', 'C', 'F', 'B\u266d', 'E\u266d', 'A\u266d'];

    /* All 12 pitch-class note names (for La calculation in minor keys) */
    const ALL_NOTE_NAMES = ['C', 'C\u266f', 'D', 'E\u266d', 'E', 'F', 'F\u266f', 'G', 'A\u266d', 'A', 'B\u266d', 'B'];

    /* ── Internal helpers ────────────────────────────────────────────────── */

    /**
     * Parse an MEI key.sig string (e.g. "2s", "3f", "0") and return
     * { sharps, flats }.
     */
    function parseKeySig(sig) {
        if (!sig || sig === '0') return { sharps: 0, flats: 0 };
        if (sig.endsWith('s')) return { sharps: parseInt(sig, 10) || 0, flats: 0 };
        if (sig.endsWith('f')) return { sharps: 0, flats: parseInt(sig, 10) || 0 };
        return { sharps: 0, flats: 0 };
    }

    /**
     * Return the pitch-class (0-11) of Doh for the given key signature.
     * Doh is always the major-key tonic; for a minor key the key signature
     * identifies the relative major, so Doh is unchanged.
     */
    function computeDoh(sig) {
        const { sharps, flats } = parseKeySig(sig);
        if (sharps) return DOH_SHARPS[Math.min(sharps, 7)];
        if (flats)  return DOH_FLATS [Math.min(flats,  7)];
        return 0; // C
    }

    /**
     * Build an object mapping each pitch name ('c'..'b') to its semitone
     * adjustment for the given key signature (0, +1 for sharps, -1 for flats).
     */
    function buildKeySigAccids(sig) {
        const { sharps, flats } = parseKeySig(sig);
        const acc = {};
        if (sharps) SHARPS_ORDER.slice(0, sharps).forEach(p => { acc[p] =  1; });
        if (flats)  FLATS_ORDER .slice(0, flats) .forEach(p => { acc[p] = -1; });
        return acc;
    }

    /**
     * Convert a note element's pname + accidental to a pitch class (0-11),
     * taking the key signature into account.
     *
     * @param {string}  pname   – 'c' | 'd' | 'e' | 'f' | 'g' | 'a' | 'b'
     * @param {string}  accid   – MEI accidental code (e.g. 's','f','n') or ''
     * @param {object}  ksAcc   – map { pname: semitoneAdjust } from key sig
     * @returns {number} pitch class 0-11, or -1 if pname unknown
     */
    function noteToPitchClass(pname, accid, ksAcc) {
        const p = (pname || '').toLowerCase();
        let v = PNAME_PC[p];
        if (v === undefined) return -1;

        // Apply key-signature accidental
        if (ksAcc[p] !== undefined) v += ksAcc[p];

        // A note-level accidental overrides the key signature for this note
        if (accid) {
            if (ksAcc[p] !== undefined) v -= ksAcc[p]; // undo key-sig first
            v += (ACCID_DELTA[(accid || '').toLowerCase()] || 0);
        }

        return ((v % 12) + 12) % 12;
    }

    /**
     * Map a pitch class to its sol-fa syllable given the Doh pitch class.
     */
    function toSolfa(pitchClass, doh) {
        const interval = ((pitchClass - (doh % 12) + 12) % 12);
        return CHROMATIC[interval] || '?';
    }

    /**
     * Compute the octave marker for a note relative to a reference octave.
     * Returns { text, cls } where text is '' | "'" | "''" | "," | ",,"
     * and cls is the CSS class to apply.
     *
     * In Curwen notation:
     *   notes above the reference register → superscript prime(s)
     *   notes below the reference register → subscript comma(s)
     */
    function octaveMarker(oct, refOct) {
        const diff = parseInt(oct, 10) - refOct;
        if (diff > 0) return { text: "'".repeat(diff), cls: 'solfa-oct-hi' };
        if (diff < 0) return { text: ','.repeat(-diff), cls: 'solfa-oct-lo' };
        return { text: '', cls: '' };
    }

    /**
     * Build a human-readable key name, e.g. "G major", "B♭ minor".
     */
    function buildKeyName(sig, mode) {
        const { sharps, flats } = parseKeySig(sig);
        const minor = mode && mode.toLowerCase() === 'minor';
        let names, idx;
        if (sharps)     { names = minor ? MINOR_SHARP_NAMES : MAJOR_SHARP_NAMES; idx = sharps; }
        else if (flats) { names = minor ? MINOR_FLAT_NAMES  : MAJOR_FLAT_NAMES;  idx = flats;  }
        else            { return minor ? 'A minor' : 'C major'; }
        return (names[Math.min(idx, 7)] || '?') + '\u00a0' + (minor ? 'minor' : 'major');
    }

    /**
     * Return the letter name of Doh for the given key signature.
     */
    function dohLetterName(sig) {
        const { sharps, flats } = parseKeySig(sig);
        if (sharps) return MAJOR_SHARP_NAMES[Math.min(sharps, 7)];
        if (flats)  return MAJOR_FLAT_NAMES [Math.min(flats,  7)];
        return 'C';
    }

    /** Minimal HTML entity escaping */
    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* ── Voice discovery ─────────────────────────────────────────────────── */

    /**
     * Inspect the MEI document and return an array of voice descriptor objects:
     *   { staffN, layerN, label, refOct }
     *
     * A voice corresponds to one <layer> inside one <staff>.  We use
     * <staffDef>/<layerDef> labels where available; otherwise fall back to the
     * combination of staff number and layer number seen in the first measure.
     */
    function discoverVoices(doc, staffDefs) {
        const voices = [];

        staffDefs.forEach(sd => {
            const staffN = sd.getAttribute('n') || '1';

            // Determine reference octave from the clef shape
            const clefEl = sd.querySelector('clef');
            const shape  = clefEl ? (clefEl.getAttribute('shape') || '').toUpperCase() : '';
            const refOct = (shape === 'F') ? 3 : 4;

            // Label for the whole staff (used when there is only one layer)
            const sdLabelEl = sd.querySelector('label');
            const sdLabel   = (sdLabelEl && sdLabelEl.textContent.trim()) ||
                              sd.getAttribute('label') || '';

            // Prefer explicit <layerDef> children
            const layerDefs = Array.from(sd.querySelectorAll('layerDef'));
            if (layerDefs.length > 0) {
                layerDefs.forEach(ld => {
                    const layerN  = ld.getAttribute('n') || '1';
                    const ldLabelEl = ld.querySelector('label');
                    const label   = (ldLabelEl && ldLabelEl.textContent.trim()) ||
                                    ld.getAttribute('label') ||
                                    sdLabel ||
                                    'Staff\u00a0' + staffN + '\u00a0Layer\u00a0' + layerN;
                    voices.push({ staffN, layerN, label, refOct });
                });
                return;
            }

            // No layerDef – discover layer numbers from the first measure
            const firstMeasure = doc.querySelector('measure');
            const layerNums    = new Set();
            if (firstMeasure) {
                const staffEl = firstMeasure.querySelector('staff[n="' + staffN + '"]');
                if (staffEl) {
                    staffEl.querySelectorAll('layer').forEach(l => {
                        layerNums.add(l.getAttribute('n') || '1');
                    });
                }
            }
            if (layerNums.size === 0) layerNums.add('1');

            layerNums.forEach(ln => {
                const label = layerNums.size === 1
                    ? (sdLabel || 'Voice\u00a0' + (voices.length + 1))
                    : (sdLabel ? sdLabel + '\u00a0(' + ln + ')' : 'Staff\u00a0' + staffN + '\u00a0Layer\u00a0' + ln);
                voices.push({ staffN, layerN: ln, label, refOct });
            });
        });

        return voices;
    }

    /* ── Note-cell extraction ────────────────────────────────────────────── */

    /**
     * Build a cell descriptor for an MEI <note> element.
     */
    function makeNoteCell(noteEl, refOct, doh, ksAcc) {
        const pname = noteEl.getAttribute('pname');
        if (!pname) return { type: 'rest' }; // safety fallback

        const accidAttr  = noteEl.getAttribute('accid');
        const accidChild = noteEl.querySelector('accid');
        const accid = accidAttr || (accidChild && accidChild.getAttribute('accid')) || '';

        const oct        = noteEl.getAttribute('oct') || '4';
        const pc         = noteToPitchClass(pname, accid, ksAcc);
        const solfaSyl   = (pc >= 0) ? toSolfa(pc, doh) : '?';
        const octMark    = octaveMarker(oct, refOct);

        // Prefer verse n="1" for the lyric; fall back to the first verse
        const verse1  = noteEl.querySelector('verse[n="1"]') || noteEl.querySelector('verse');
        const sylEl   = verse1 ? verse1.querySelector('syl') : null;
        const sylText = sylEl ? sylEl.textContent.trim() : '';
        const con     = sylEl ? (sylEl.getAttribute('con') || '') : '';

        return { type: 'note', solfa: solfaSyl, octMark, text: sylText, con };
    }

    /**
     * Recursively walk the direct children of a <layer> (including <beam>,
     * <tuplet> containers) and append note-cell objects into `cells`.
     */
    function collectCells(children, cells, refOct, doh, ksAcc) {
        children.forEach(el => {
            const tag = (el.localName || el.tagName || '').toLowerCase();
            if (tag === 'beam' || tag === 'tuplet' || tag === 'ligature') {
                collectCells(Array.from(el.children), cells, refOct, doh, ksAcc);
            } else if (tag === 'rest' || tag === 'mrest' || tag === 'multirest' || tag === 'space') {
                cells.push({ type: 'rest' });
            } else if (tag === 'note') {
                cells.push(makeNoteCell(el, refOct, doh, ksAcc));
            } else if (tag === 'chord') {
                // MEI orders chord notes from lowest to highest pitch;
                // take the last child note (highest pitch, i.e. the treble voice)
                const noteEls = el.querySelectorAll('note');
                const topNote = noteEls.length > 0 ? noteEls[noteEls.length - 1] : null;
                if (topNote) cells.push(makeNoteCell(topNote, refOct, doh, ksAcc));
            }
            // Other elements (slur, tie, dynam, tempo, dir, etc.) are ignored
        });
    }

    /* ── Main renderer ───────────────────────────────────────────────────── */

    /**
     * Render tonic sol-fa notation from a combined MEI XML string and return
     * an HTML string suitable for insertion into #svg_output.
     *
     * @param {string} meiXml – serialised MEI document
     * @returns {string} HTML
     */
    function renderSolfa(meiXml) {
        if (!meiXml) {
            return '<div class="solfa-error">No score loaded. Please select a text and tune first, then click Go.</div>';
        }

        /* Parse XML */
        let doc;
        try {
            const parser = new DOMParser();
            doc = parser.parseFromString(meiXml, 'text/xml');
            if (doc.querySelector('parsererror')) throw new Error('XML parse error');
        } catch (e) {
            return '<div class="solfa-error">Could not parse the score data.</div>';
        }

        /* Key signature: check scoreDef first, then first staffDef */
        const scoreDef  = doc.querySelector('scoreDef');
        const staffDefs = Array.from(doc.querySelectorAll('staffDef'));
        const firstSD   = staffDefs[0] || null;

        const keySig = (scoreDef  && scoreDef .getAttribute('key.sig'))  ||
                       (firstSD   && firstSD  .getAttribute('key.sig'))  || '0';
        const modeAttr = (scoreDef && scoreDef.getAttribute('key.mode')) ||
                         (firstSD  && firstSD .getAttribute('key.mode')) || 'major';
        const isMinor  = modeAttr.toLowerCase() === 'minor';

        const doh    = computeDoh(keySig);
        const ksAcc  = buildKeySigAccids(keySig);

        /* Discover voice parts */
        const voices = discoverVoices(doc, staffDefs);
        if (voices.length === 0) {
            return '<div class="solfa-error">No voice parts found in the score.</div>';
        }

        /* Build a lookup key and pre-allocate cell arrays */
        function voiceKey(staffN, layerN) { return staffN + ':' + layerN; }
        const voiceIndex = {};
        const voiceCells = voices.map((v, i) => {
            voiceIndex[voiceKey(v.staffN, v.layerN)] = i;
            return [];
        });

        /* Walk all measures and collect note cells per voice */
        const allMeasures     = Array.from(doc.querySelectorAll('measure'));
        const firstMeasureSet = new Set(); // tracks which voices have had their first measure

        allMeasures.forEach(measure => {
            Array.from(measure.querySelectorAll('staff')).forEach(staffEl => {
                const staffN = staffEl.getAttribute('n') || '1';
                Array.from(staffEl.querySelectorAll('layer')).forEach(layerEl => {
                    const layerN = layerEl.getAttribute('n') || '1';
                    const key    = voiceKey(staffN, layerN);
                    const vi     = voiceIndex[key];
                    if (vi === undefined) return;

                    const cells  = voiceCells[vi];
                    const refOct = voices[vi].refOct;

                    /* Insert barline separator before every measure except the first */
                    if (firstMeasureSet.has(key)) {
                        cells.push({ type: 'bar' });
                    }
                    firstMeasureSet.add(key);

                    collectCells(Array.from(layerEl.children), cells, refOct, doh, ksAcc);
                });
            });
        });

        /* Title from MEI header */
        const titleEl = doc.querySelector('titleStmt > title') || doc.querySelector('title');
        const title   = titleEl ? titleEl.textContent.trim() : '';

        /* Heading: fundamental note and whether it is Doh or La */
        const fundamental = isMinor ? 'La' : 'Doh';
        const fundamentalNote = isMinor
            ? ALL_NOTE_NAMES[((doh - LA_BELOW_DOH) % 12 + 12) % 12]  // La = LA_BELOW_DOH semitones below Doh
            : dohLetterName(keySig);

        /* Build HTML */
        const H = [];
        H.push('<div class="solfa-output">');

        if (title) H.push('<h2 class="solfa-title">' + esc(title) + '</h2>');

        H.push(
            '<p class="solfa-meta">Key:\u00a0<strong>' + esc(buildKeyName(keySig, modeAttr)) + '</strong>' +
            '\u2003' + esc(fundamental) + '\u00a0=\u00a0<strong>' + esc(fundamentalNote) + '</strong></p>'
        );

        H.push('<div class="solfa-scroll">');
        H.push('<table class="solfa-table" role="presentation">');

        voices.forEach((voice, vi) => {
            const cells = voiceCells[vi];
            if (cells.length === 0) return; // skip voices with no content

            /* ---- Sol-fa row ---- */
            H.push('<tr class="solfa-row-pitch">');
            H.push('<th class="solfa-label" rowspan="2" scope="row">' + esc(voice.label) + '</th>');
            cells.forEach(c => {
                if (c.type === 'bar') {
                    H.push('<td class="solfa-bar" aria-hidden="true">&#x7c;</td>');
                } else if (c.type === 'rest') {
                    H.push('<td class="solfa-cell solfa-rest">&#x2013;</td>');
                } else {
                    let inner = '<span class="solfa-syl">' + esc(c.solfa) + '</span>';
                    if (c.octMark.text) {
                        inner += '<span class="' + esc(c.octMark.cls) + '" aria-hidden="true">' +
                                 esc(c.octMark.text) + '</span>';
                    }
                    H.push('<td class="solfa-cell">' + inner + '</td>');
                }
            });
            H.push('</tr>');

            /* ---- Text row ---- */
            H.push('<tr class="solfa-row-text">');
            cells.forEach(c => {
                if (c.type === 'bar') {
                    H.push('<td class="solfa-bar"></td>');
                } else if (c.type === 'rest') {
                    H.push('<td class="solfa-cell"></td>');
                } else {
                    const dash = (c.con === 'd') ? '-' : '';
                    H.push('<td class="solfa-cell solfa-word">' + esc(c.text) + dash + '</td>');
                }
            });
            H.push('</tr>');

            /* Vertical spacer between voice parts (not after the last one) */
            if (vi < voices.length - 1) {
                H.push('<tr class="solfa-spacer" aria-hidden="true"><td colspan="' + (cells.length + 1) + '"></td></tr>');
            }
        });

        H.push('</table>');
        H.push('</div>'); // solfa-scroll
        H.push('</div>'); // solfa-output

        return H.join('\n');
    }

    /* ── Public interface ────────────────────────────────────────────────── */

    /**
     * Sync the sidenav Notation toggle buttons to reflect the current state.
     * @param {boolean} solfaActive – true when sol-fa view is active
     */
    function syncNotationToggle(solfaActive) {
        const staffBtn = document.getElementById('notationStaff');
        const solfaBtn = document.getElementById('notationSolfa');
        if (!staffBtn || !solfaBtn) return;
        if (solfaActive) {
            staffBtn.classList.remove('active');
            staffBtn.style.background = '#666';
            solfaBtn.classList.add('active');
            solfaBtn.style.background = '#6fc252';
        } else {
            solfaBtn.classList.remove('active');
            solfaBtn.style.background = '#666';
            staffBtn.classList.add('active');
            staffBtn.style.background = '#6fc252';
        }
    }

    /**
     * Render the current score as tonic sol-fa and display it in #svg_output.
     * Called by the "Sol-fa" button in the sidenav Options panel.
     */
    global.loadSolfaView = function () {
        const container = document.getElementById('svg_output');
        if (!container) return;

        const xml = global.currentXmlData;
        if (!xml) {
            alert('Please select a text and tune first, then click Go to generate the score before switching to Sol-fa view.');
            syncNotationToggle(false); // reset toggle back to Staff
            return;
        }

        global.globalSolfaMode = true;
        container.innerHTML = renderSolfa(xml);

        const controls = document.getElementById('controls');
        if (controls) controls.classList.add('solfa-mode');

        syncNotationToggle(true);
    };

    /**
     * Return to the Verovio staff-notation view.
     */
    global.exitSolfaView = function () {
        global.globalSolfaMode = false;

        const controls = document.getElementById('controls');
        if (controls) controls.classList.remove('solfa-mode');

        syncNotationToggle(false);

        // Re-render the staff notation via the existing loadPage() function
        if (typeof loadPage === 'function') {
            loadPage();
        }
    };

    /**
     * Toggle between sol-fa and staff notation views.
     */
    global.toggleSolfaView = function () {
        if (global.globalSolfaMode) {
            global.exitSolfaView();
        } else {
            global.loadSolfaView();
        }
    };

    /** Exposed for testing or external use */
    global.renderSolfa = renderSolfa;

}(window));
