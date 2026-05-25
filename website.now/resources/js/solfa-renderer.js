/*!
 * solfa-renderer.js  –  Tonic sol-fa notation renderer
 *
 * Reads the current combined MEI document (window.originalXmlData) and renders
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
     * Parse an MEI key.sig / keysig string (e.g. "2s", "3F", "0") and return
     * { sharps, flats }.  Comparison is case-insensitive.
     */
    function parseKeySig(sig) {
        if (!sig) return { sharps: 0, flats: 0 };
        const s = sig.trim().toLowerCase();
        if (!s || s === '0') return { sharps: 0, flats: 0 };
        if (s.endsWith('s')) return { sharps: parseInt(s, 10) || 0, flats: 0 };
        if (s.endsWith('f')) return { sharps: 0, flats: parseInt(s, 10) || 0 };
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
     * Returns { text, cls } where text is '' | "|" | "||" …
     * and cls is the CSS class to apply.
     *
     * In Curwen notation:
     *   notes above the reference register → small superscript pipe(s)
     *   notes below the reference register → bold pipe(s) at baseline
     */
    function octaveMarker(oct, refOct) {
        const diff = parseInt(oct, 10) - refOct;
        if (diff > 0) return { text: '|'.repeat(diff), cls: 'solfa-oct-hi' };
        if (diff < 0) return { text: '|'.repeat(-diff), cls: 'solfa-oct-lo' };
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

    /* ── Rhythmic helpers ────────────────────────────────────────────────── */

    /**
     * Convert an MEI duration value + dot count to a count of sixteenth-note
     * units (SSUs).  One SSU = one sixteenth note.
     *
     * @param {string|number} dur  – MEI @dur value: '1','2','4','8','16','breve'
     * @param {string|number} dots – number of augmentation dots (0, 1, or 2)
     * @returns {number} integer SSU count
     */
    function durationToSsu(dur, dots) {
        const BASE = { '1': 16, '2': 8, '4': 4, '8': 2, '16': 1, 'breve': 32, 'long': 64 };
        const base = BASE[String(dur)] || 4; // default: quarter = 4 SSUs
        let total = base;
        let add   = base;
        const n   = parseInt(dots, 10) || 0;
        for (let i = 0; i < n; i++) { add = add / 2; total += add; }
        return Math.round(total);
    }

    /**
     * Return rhythmic parameters for the given meter.
     *
     * @param {string|number} count  – @meter.count (number of beats per bar)
     * @param {string|number} unit   – @meter.unit  (note value of one beat: 2, 4, 8 …)
     * @returns {{ beatsPerBar, ssuPerBeat, tactusAfterBeat }}
     *   beatsPerBar      – number of beat positions in one bar
     *   ssuPerBeat       – SSUs (sixteenth-note units) in one beat
     *   tactusAfterBeat  – 0-based beat index after which '|' replaces ':',
     *                      or -1 if there is no intra-bar tactus mark
     */
    function getMeterInfo(count, unit) {
        const c = parseInt(count, 10) || 4;
        const u = parseInt(unit,  10) || 4;
        const ssuPerBeat  = Math.max(1, Math.round(16 / u)); // 16ths per beat
        const beatsPerBar = c;
        // Tactus = midpoint of bar; only meaningful when there are 4+ beats
        const tactusAfterBeat = (c % 2 === 0 && c >= 4) ? c / 2 : -1;
        return { beatsPerBar, ssuPerBeat, tactusAfterBeat };
    }

    /**
     * Map a bar's note cells onto a fixed beat grid.
     *
     * Each slot is EXACTLY one beat — one table column.  Multiple notes that
     * fall within the same beat are packed into a single slot; their position
     * within the beat is shown via a subPrefix character:
     *   ''  – the note falls on the beat itself (first note in the beat)
     *   '.' – the note falls on the half-beat division
     *   ',' – the note falls on a finer subdivision (quarter-beat, etc.)
     *
     * For a full bar this returns exactly meterInfo.beatsPerBar slots.
     * For a pickup bar (total cell SSUs < full bar SSUs) this returns only
     * the beat slots that contain actual content — no padding with rests —
     * and every slot receives ':' as its beatPrefix.
     *
     * Each slot is one of:
     *   { type:'multi', beatPrefix, notes:[{subPrefix, cell}] }
     *       – one or more notes/rests that START within this beat.
     *   { type:'held',  beatPrefix, slurred }
     *       – a note from a previous beat is still sounding (no new attack).
     *
     * Beat-position prefix characters (beatPrefix) for full bars:
     *   ''  – beat 0 (first beat; bar separator already marks it)
     *   ':' – any other beat start
     *   '|' – bar midpoint (beat beatsPerBar/2 in even meters with ≥ 4 beats)
     *
     * @param {Array}  barCells  – cells with ssuLen from collectCells()
     * @param {object} meterInfo – result of getMeterInfo()
     * @returns {Array} beat-slot items
     */
    function expandToBeatGrid(barCells, meterInfo) {
        const { beatsPerBar, ssuPerBeat, tactusAfterBeat } = meterInfo;

        // Build a timeline: { startSsu, endSsu, cell }
        let curSsu = 0;
        const events = [];
        barCells.forEach(cell => {
            const len = cell.ssuLen || ssuPerBeat;
            events.push({ startSsu: curSsu, endSsu: curSsu + len, cell });
            curSsu += len;
        });

        // A pickup bar has fewer total SSUs than a complete bar.
        const fullBarSsu = beatsPerBar * ssuPerBeat;
        const totalSsu   = events.reduce((s, e) => s + (e.endSsu - e.startSsu), 0);
        const isPickup   = totalSsu < fullBarSsu;

        /**
         * Compute the subPrefix for a note that starts at `offsetInBeat` SSUs
         * from the start of its beat.  Returns '' for on-beat, '.' for
         * half-beat, ',' for finer subdivisions.
         */
        function subPrefixForOffset(offsetInBeat) {
            if (offsetInBeat === 0) return '';
            const half = ssuPerBeat / 2;
            if (offsetInBeat === half) return '.';
            return ',';
        }

        const slots = [];
        for (let beat = 0; beat < beatsPerBar; beat++) {
            const beatStart = beat * ssuPerBeat;
            const beatEnd   = beatStart + ssuPerBeat;

            // Beat-position prefix
            let beatPrefix;
            if (isPickup) {
                beatPrefix = ':'; // pickup beats always get ':'; no "beat 1" in a partial bar
            } else if (beat === 0) {
                beatPrefix = '';  // beat 1 of a full bar has no prefix (bar line marks it)
            } else if (tactusAfterBeat >= 0 && beat === tactusAfterBeat) {
                beatPrefix = '|'; // bar midpoint
            } else {
                beatPrefix = ':'; // ordinary beat
            }

            // All events whose start falls within [beatStart, beatEnd)
            const starting = events.filter(e => e.startSsu >= beatStart && e.startSsu < beatEnd);

            if (starting.length > 0) {
                // Collect sub-notes with subPrefix based on position within beat
                const notes = starting.map(e => ({
                    subPrefix: subPrefixForOffset(e.startSsu - beatStart),
                    cell: e.cell,
                }));
                slots.push({ type: 'multi', beatPrefix, notes });
            } else if (!isPickup) {
                // In a full bar: fill empty beats with held or rest placeholders
                const held = events.find(e => e.startSsu < beatStart && e.endSsu > beatStart);
                if (held && held.cell.type !== 'rest') {
                    slots.push({ type: 'held', beatPrefix, slurred: held.cell.slurred || false });
                } else {
                    slots.push({ type: 'multi', beatPrefix, notes: [{ subPrefix: '', cell: { type: 'rest', ssuLen: ssuPerBeat } }] });
                }
            }
            // In a pickup bar, beats with no content are simply omitted.
        }

        return slots;
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

    /* ── Slur helpers ────────────────────────────────────────────────────── */

    /**
     * Walk the document and return a Set of note xml:id values that are part
     * of at least one slur.
     *
     * Two MEI encoding styles are handled:
     *   1. <slur startid="#x" endid="#y"> elements (anywhere in the document):
     *      all notes in document order between #x and #y (inclusive) are marked.
     *   2. @slur attribute on individual <note> elements ('i', 'm', 't' or
     *      combinations such as 'it').
     *
     * @param {Document} doc – parsed MEI document
     * @returns {Set<string>}
     */
    function buildSlurredNoteIds(doc) {
        const slurredIds = new Set();
        const allNotes   = Array.from(doc.querySelectorAll('note'));

        // Helper: resolve a startid/endid reference ('#foo' or 'foo') to an index
        function noteIndex(ref) {
            const id = ref.replace(/^#/, '');
            return allNotes.findIndex(n =>
                n.getAttribute('xml:id') === id || n.id === id
            );
        }

        // Style 1: <slur startid endid>
        doc.querySelectorAll('slur').forEach(slurEl => {
            const startRef = slurEl.getAttribute('startid') || '';
            const endRef   = slurEl.getAttribute('endid')   || '';
            if (!startRef || !endRef) return;

            const si = noteIndex(startRef);
            const ei = noteIndex(endRef);
            if (si < 0 || ei < 0) return;

            const from = Math.min(si, ei);
            const to   = Math.max(si, ei);
            for (let i = from; i <= to; i++) {
                const id = allNotes[i].getAttribute('xml:id') || allNotes[i].id;
                if (id) slurredIds.add(id);
            }
        });

        // Style 2: @slur attribute ('i', 'm', 't', 'it', 'i1', 't2', etc.)
        allNotes.forEach(n => {
            const slurAttr = n.getAttribute('slur') || '';
            if (/[imt]/i.test(slurAttr)) {
                const id = n.getAttribute('xml:id') || n.id;
                if (id) slurredIds.add(id);
            }
        });

        return slurredIds;
    }

    /* ── Note-cell extraction ────────────────────────────────────────────── */

    /**
     * Build a cell descriptor for an MEI <note> element.
     *
     * @param {Element}      noteEl      – the <note> element
     * @param {number}       refOct      – reference octave for this staff
     * @param {number}       doh         – Doh pitch class (0-11)
     * @param {object}       ksAcc       – key-signature accidentals map
     * @param {string|null}  durOverride – @dur from a parent <chord>, if any
     * @param {string|null}  dotsOverride – @dots from a parent <chord>, if any
     * @param {Set<string>}  slurredIds  – set of note xml:ids that are slurred
     */
    function makeNoteCell(noteEl, refOct, doh, ksAcc, durOverride, dotsOverride, slurredIds) {
        const pname = noteEl.getAttribute('pname');
        if (!pname) return { type: 'rest', ssuLen: durationToSsu(durOverride || '4', dotsOverride || '0') };

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

        // Duration: prefer parent chord's @dur, then the note's own @dur
        const dur  = durOverride  || noteEl.getAttribute('dur')  || '4';
        const dots = dotsOverride || noteEl.getAttribute('dots') || '0';
        const ssuLen = durationToSsu(dur, dots);

        // Slur: check the slurredIds set (from <slur> elements) and the @slur attribute
        const xmlId    = noteEl.getAttribute('xml:id') || noteEl.id || '';
        const slurAttr = noteEl.getAttribute('slur') || '';
        const slurred  = (xmlId && slurredIds && slurredIds.has(xmlId)) || /[imt]/i.test(slurAttr);

        return { type: 'note', solfa: solfaSyl, octMark, text: sylText, con, ssuLen, slurred };
    }

    /**
     * Recursively walk the direct children of a <layer> (including <beam>,
     * <tuplet> containers) and append note-cell objects into `cells`.
     */
    function collectCells(children, cells, refOct, doh, ksAcc, slurredIds) {
        children.forEach(el => {
            const tag = (el.localName || el.tagName || '').toLowerCase();
            if (tag === 'beam' || tag === 'tuplet' || tag === 'ligature') {
                collectCells(Array.from(el.children), cells, refOct, doh, ksAcc, slurredIds);
            } else if (tag === 'rest' || tag === 'space') {
                const dur  = el.getAttribute('dur')  || '4';
                const dots = el.getAttribute('dots') || '0';
                cells.push({ type: 'rest', ssuLen: durationToSsu(dur, dots) });
            } else if (tag === 'mrest' || tag === 'multirest') {
                // Full-measure rest: large SSU so it occupies the whole bar in beat counting
                cells.push({ type: 'rest', ssuLen: 256 });
            } else if (tag === 'note') {
                cells.push(makeNoteCell(el, refOct, doh, ksAcc, null, null, slurredIds));
            } else if (tag === 'chord') {
                // Duration lives on the <chord> element; pitch on the highest <note>
                const chordDur  = el.getAttribute('dur');
                const chordDots = el.getAttribute('dots') || '0';
                const noteEls   = el.querySelectorAll('note');
                const topNote   = noteEls.length > 0 ? noteEls[noteEls.length - 1] : null;
                if (topNote) cells.push(makeNoteCell(topNote, refOct, doh, ksAcc, chordDur, chordDots, slurredIds));
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

        /* Key signature: check scoreDef first, then first staffDef.
         *
         * Priority order:
         *   1. @keysig attribute directly on <scoreDef>  (combined-MEI format, no dot)
         *   2. @key.sig attribute on <scoreDef> or first <staffDef>  (dotted MEI format)
         *   3. Child <keySig sig="..."> element of <scoreDef> or first <staffDef>
         *
         * All attribute lookups are case-insensitive so '2F'/'2f' both work.
         * Missing, empty, or '0' values all default to C major / a minor. */
        const scoreDef  = doc.querySelector('scoreDef');
        const staffDefs = Array.from(doc.querySelectorAll('staffDef'));
        const firstSD   = staffDefs[0] || null;

        /** Case-insensitive getAttribute helper. */
        function getAttrCI(el, name) {
            if (!el) return '';
            // Try exact name first, then uppercase variant (XML is case-sensitive,
            // but the authoring tool may vary capitalisation).
            const v = el.getAttribute(name) || el.getAttribute(name.toLowerCase()) || el.getAttribute(name.toUpperCase());
            return v || '';
        }

        function getKeySigAttr(el, attr) {
            if (!el) return '';
            const v = getAttrCI(el, attr);
            if (v) return v;
            // Fall back to the child <keySig> element (e.g. <keySig sig="1f" mode="major"/>)
            const childAttr = attr.replace('key.', '');
            // Use getElementsByTagName to avoid any :scope CSS-selector compatibility issues.
            const keySigEls = el.getElementsByTagName('keySig');
            const keySigEl  = keySigEls && keySigEls[0];
            return (keySigEl && getAttrCI(keySigEl, childAttr)) || '';
        }

        // Primary: bare @keysig / @keymode attributes on <scoreDef> (combined-MEI format)
        const keySig = getAttrCI(scoreDef, 'keysig') ||
                       getKeySigAttr(scoreDef, 'key.sig') ||
                       getKeySigAttr(firstSD,   'key.sig') || '0';
        const modeAttr = getAttrCI(scoreDef, 'keymode') ||
                         getKeySigAttr(scoreDef, 'key.mode') ||
                         getKeySigAttr(firstSD,   'key.mode') || 'major';
        const isMinor  = modeAttr.toLowerCase() === 'minor';

        const doh    = computeDoh(keySig);
        const ksAcc  = buildKeySigAccids(keySig);

        /* Collect note IDs that are part of a slur */
        const slurredIds = buildSlurredNoteIds(doc);

        /* Discover voice parts */
        const voices = discoverVoices(doc, staffDefs);
        if (voices.length === 0) {
            return '<div class="solfa-error">No voice parts found in the score.</div>';
        }

        /* Meter: @meter.count and @meter.unit on scoreDef/staffDef, or a child <meterSig @count @unit> */
        function getMeterAttr(el, attr) {
            return (el && (el.getAttribute(attr) || el.getAttribute(attr.replace('.', '')) || '')) || '';
        }
        function getMeterSigAttr(el, childAttr) {
            if (!el) return '';
            const meterSigEls = el.getElementsByTagName('meterSig');
            const meterSigEl  = meterSigEls && meterSigEls[0];
            return (meterSigEl && getAttrCI(meterSigEl, childAttr)) || '';
        }
        const meterCount = getMeterAttr(scoreDef, 'meter.count') || getMeterAttr(firstSD, 'meter.count') ||
                           getMeterSigAttr(scoreDef, 'count')    || getMeterSigAttr(firstSD, 'count')    || '4';
        const meterUnit  = getMeterAttr(scoreDef, 'meter.unit')  || getMeterAttr(firstSD, 'meter.unit')  ||
                           getMeterSigAttr(scoreDef, 'unit')     || getMeterSigAttr(firstSD, 'unit')      || '4';
        const meterInfo  = getMeterInfo(meterCount, meterUnit);

        /* Build a lookup key and pre-allocate bar arrays per voice */
        function voiceKey(staffN, layerN) { return staffN + ':' + layerN; }
        const voiceIndex = {};
        const voiceBars  = voices.map((v, i) => {
            voiceIndex[voiceKey(v.staffN, v.layerN)] = i;
            return [];
        });

        /* Walk all measures and collect note cells per voice, one array per bar */
        const allMeasures = Array.from(doc.querySelectorAll('measure'));

        allMeasures.forEach(measure => {
            Array.from(measure.querySelectorAll('staff')).forEach(staffEl => {
                const staffN = staffEl.getAttribute('n') || '1';
                Array.from(staffEl.querySelectorAll('layer')).forEach(layerEl => {
                    const layerN = layerEl.getAttribute('n') || '1';
                    const key    = voiceKey(staffN, layerN);
                    const vi     = voiceIndex[key];
                    if (vi === undefined) return;

                    const barCells = [];
                    collectCells(Array.from(layerEl.children), barCells, voices[vi].refOct, doh, ksAcc, slurredIds);
                    voiceBars[vi].push(barCells);
                });
            });
        });

        /* Convert per-bar cell arrays into flat display-item arrays.
         * Each bar contributes exactly meterInfo.beatsPerBar beat-slot items.
         * Beat-position prefix characters are embedded inside each slot. */
        const voiceItems = voiceBars.map(bars => {
            const items = [];
            bars.forEach((barCells, bi) => {
                if (bi > 0) items.push({ type: 'bar' });
                expandToBeatGrid(barCells, meterInfo).forEach(cell => items.push(cell));
            });
            return items;
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
            const items = voiceItems[vi];
            if (items.length === 0) return; // skip voices with no content

            /* ---- Sol-fa (pitch) row ---- */
            H.push('<tr class="solfa-row-pitch">');
            H.push('<th class="solfa-label" rowspan="2" scope="row">' + esc(voice.label) + '</th>');
            items.forEach(item => {
                if (item.type === 'bar') {
                    H.push('<td class="solfa-bar" aria-hidden="true">&#x7c;</td>');
                } else if (item.type === 'held') {
                    const pre  = item.beatPrefix
                        ? '<span class="solfa-beat-pre" aria-hidden="true">' + esc(item.beatPrefix) + '</span>'
                        : '';
                    const dash = item.slurred ? '<u class="solfa-slur">\u2013</u>' : '\u2013';
                    H.push('<td class="solfa-cell solfa-held">' + pre + dash + '</td>');
                } else {
                    // type === 'multi': one or more notes/rests at this position
                    const beatPre = item.beatPrefix
                        ? '<span class="solfa-beat-pre" aria-hidden="true">' + esc(item.beatPrefix) + '</span>'
                        : '';
                    let inner = beatPre;
                    item.notes.forEach(({ subPrefix, cell }, ni) => {
                        if (ni > 0) inner += ' '; // space separator (rare: two notes at identical SSU)
                        const subPre = subPrefix
                            ? '<span class="solfa-beat-pre" aria-hidden="true">' + esc(subPrefix) + '</span>'
                            : '';
                        if (cell.type === 'rest') {
                            inner += subPre + '<span class="solfa-rest">\u2013</span>';
                        } else {
                            let noteContent = '<span class="solfa-syl">' + esc(cell.solfa) + '</span>';
                            if (cell.octMark && cell.octMark.text) {
                                noteContent += '<span class="' + esc(cell.octMark.cls) + '" aria-hidden="true">' +
                                               esc(cell.octMark.text) + '</span>';
                            }
                            if (cell.slurred) {
                                inner += subPre + '<u class="solfa-slur">' + noteContent + '</u>';
                            } else {
                                inner += subPre + noteContent;
                            }
                        }
                    });
                    H.push('<td class="solfa-cell">' + inner + '</td>');
                }
            });
            H.push('</tr>');

            /* ---- Text (lyric) row ---- */
            H.push('<tr class="solfa-row-text">');
            items.forEach(item => {
                if (item.type === 'bar') {
                    H.push('<td class="solfa-bar"></td>');
                } else if (item.type === 'held') {
                    H.push('<td class="solfa-cell"></td>');
                } else {
                    // type === 'multi': use lyric from first note in the beat
                    const firstNote = item.notes.find(n => n.cell.type !== 'rest');
                    if (firstNote) {
                        const dash = (firstNote.cell.con === 'd') ? '-' : '';
                        H.push('<td class="solfa-cell solfa-word">' + esc(firstNote.cell.text || '') + dash + '</td>');
                    } else {
                        H.push('<td class="solfa-cell"></td>');
                    }
                }
            });
            H.push('</tr>');

            /* Vertical spacer between voice parts (not after the last one) */
            if (vi < voices.length - 1) {
                H.push('<tr class="solfa-spacer" aria-hidden="true">');
                H.push('<td class="solfa-label"></td>');
                items.forEach(item => {
                    if (item.type === 'bar') {
                        H.push('<td class="solfa-bar"></td>');
                    } else {
                        H.push('<td></td>');
                    }
                });
                H.push('</tr>');
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

        const xml = global.originalXmlData;
        if (!xml) {
            // No score loaded yet — record the preference so that when Go is
            // clicked and the MEI is ready, loadDataWithLayerVolumes will call
            // loadSolfaView() automatically.
            global.globalSolfaMode = true;
            syncNotationToggle(true);
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
