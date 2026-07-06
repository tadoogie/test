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
     * Compute the octave marker for a note relative to the home octave of Doh.
     * Returns { text, cls } where text is '' | "|" | "||" …
     * and cls is the CSS class to apply.
     *
     * In Curwen notation:
     *   notes above the home register → small superscript pipe(s)
     *   notes below the home register → bold pipe(s) at baseline
     *
     * The home octave starts at Doh (e.g. G4 when Doh=G, refOct=4) and spans
     * up 11 semitones to the note just below the next Doh (e.g. F#5).
     * The comparison is therefore based on absolute semitone pitch rather than
     * the raw @oct integer, so that the octave boundary aligns with Doh's pitch
     * rather than with C.
     *
     * @param {number} notePc  – note pitch class (0-11), already accounting for accidentals
     * @param {string} noteOct – note @oct attribute value (e.g. "4")
     * @param {number} doh     – Doh pitch class (0-11) for this staff
     * @param {number} refOct  – octave in which Doh sits on this staff
     */
    function octaveMarker(notePc, noteOct, doh, refOct) {
        if (notePc < 0) return { text: '', cls: '' };
        const noteAbsPitch = notePc + parseInt(noteOct, 10) * 12;
        const dohAbsPitch  = doh   + refOct * 12;
        const diff = Math.floor((noteAbsPitch - dohAbsPitch) / 12);
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
         * Represent one beat's rhythm as tonic sol-fa sub-pulse tokens.
         *
         * The pulse is divided by recursive binary halving, and a divider is
         * shown only as deep as the notes require:
         *   '.'  first level  – half-pulse
         *   ','  deeper levels – quarter-pulse and finer
         * A region filled by a single sounding note yields just that note; a
         * region whose note is only sustaining (it attacked earlier) yields a
         * blank, so the dividers around it still mark the metric grid. This is
         * what turns a dotted-quarter + eighth in a half-note pulse into
         * "m .,m": the first half is one sustained note, and the second half
         * splits into a sustain (blank) then the eighth-note attack.
         *
         * Returns an array of { subPrefix, cell } where subPrefix is the
         * (possibly multi-character) run of dividers preceding the note's attack.
         */
        function subdivideBeat(beatStart, beatEnd) {
            // Map in-beat attack offsets (notes and rests) to their cell.
            const attackAt = {};
            events.forEach(e => {
                if (e.startSsu >= beatStart && e.startSsu < beatEnd) {
                    attackAt[e.startSsu] = e.cell;
                }
            });
            const offsets = Object.keys(attackAt).map(Number);

            // Recursively tokenise the pulse into notes, blanks, and dividers.
            const tokens = [];
            (function rec(start, end, depth) {
                let interior = false;
                for (let i = 0; i < offsets.length; i++) {
                    if (offsets[i] > start && offsets[i] < end) { interior = true; break; }
                }
                if (!interior) {
                    if (Object.prototype.hasOwnProperty.call(attackAt, start)) {
                        tokens.push({ cell: attackAt[start] });
                    } else {
                        tokens.push({ blank: true }); // note sustaining from earlier
                    }
                    return;
                }
                const mid = (start + end) / 2;
                rec(start, mid, depth + 1);
                tokens.push({ div: depth === 0 ? '.' : ',' });
                rec(mid, end, depth + 1);
            })(beatStart, beatEnd, 0);

            // Collapse to { subPrefix, cell }: dividers accumulate onto the next
            // attacking note; a sustain (blank) emits nothing but keeps pending
            // dividers so the grid still reads correctly.
            const notes = [];
            let pending = '';
            tokens.forEach(t => {
                if (t.div)        pending += t.div;
                else if (t.blank) { /* keep pending, emit nothing */ }
                else { notes.push({ subPrefix: pending, cell: t.cell }); pending = ''; }
            });
            return notes;
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
                // Build the beat's sub-pulse structure (dividers + notes).
                const notes = subdivideBeat(beatStart, beatEnd);
                slots.push({ type: 'multi', beatPrefix, notes });
            } else if (!isPickup) {
                // In a full bar: fill empty beats with held or rest placeholders
                const held = events.find(e => e.startSsu < beatStart && e.endSsu > beatStart);
                if (held && held.cell.type !== 'rest') {
                    slots.push({ type: 'held', beatPrefix, slurred: held.cell.slurred || false, id: held.cell.id || '' });
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

        // Index every note by its id for O(1) endpoint lookup.
        const noteById = {};
        allNotes.forEach(n => {
            const id = n.getAttribute('xml:id') || n.id;
            if (id) noteById[id] = n;
        });

        // Walk ancestors to the enclosing <layer> without relying on
        // Element.closest(), which is not dependable on XML documents in
        // every browser.
        function closestLayer(el) {
            let cur = el;
            while (cur && cur.nodeType === 1) {
                if ((cur.localName || cur.tagName || '').toLowerCase() === 'layer') return cur;
                cur = cur.parentNode;
            }
            return null;
        }

        const stripHash = ref => (ref || '').replace(/^#/, '');

        // Style 1: <slur startid endid>.
        //
        // The span between the endpoints is filled *within the start note's own
        // <layer>*, not across a flat document-order list of every note. MEI
        // orders notes measure -> staff -> layer, so in a multi-voice score a
        // slur that crosses a barline would, in global order, sweep in the other
        // staff's notes that sit between the two ids. Scoping the fill to the
        // start note's layer keeps the underline on the correct voice.
        doc.querySelectorAll('slur').forEach(slurEl => {
            const startId = stripHash(slurEl.getAttribute('startid'));
            const endId   = stripHash(slurEl.getAttribute('endid'));
            if (!startId || !endId) return;

            const startNote = noteById[startId];
            const endNote   = noteById[endId];
            if (!startNote) return;

            // Always mark the explicit endpoints.
            slurredIds.add(startId);
            if (endNote) slurredIds.add(endId);

            // Fill the interior only when both endpoints live in the same layer.
            const layer = closestLayer(startNote);
            if (layer && endNote && closestLayer(endNote) === layer) {
                const layerNotes = Array.from(layer.querySelectorAll('note'));
                const si = layerNotes.indexOf(startNote);
                const ei = layerNotes.indexOf(endNote);
                if (si >= 0 && ei >= 0) {
                    const from = Math.min(si, ei);
                    const to   = Math.max(si, ei);
                    for (let i = from; i <= to; i++) {
                        const id = layerNotes[i].getAttribute('xml:id') || layerNotes[i].id;
                        if (id) slurredIds.add(id);
                    }
                }
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
        const octMark    = octaveMarker(pc, oct, doh, refOct);

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

        return { type: 'note', id: xmlId, solfa: solfaSyl, octMark, text: sylText, con, ssuLen, slurred };
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

    /* ── Slur-underline styles ───────────────────────────────────────────── */

    /**
     * Inject the slur-underline CSS once, so the renderer is drop-in and does
     * not depend on an edit to app.html.
     *
     * Two layers are defined:
     *
     *   1. The measured overlay (primary). One <div class="solfa-slur-line"> is
     *      drawn per slur run by drawSlurOverlays(), positioned over the plane
     *      that wraps the table. Because it is a single element per run, it can
     *      never show an internal seam, and it spans beat markers and barlines
     *      without gaps. This is what you normally see.
     *
     *   2. A per-cell CSS fallback (::after segments) for the case where the
     *      overlay pass has not run, e.g. if renderSolfa() output is inserted
     *      without calling drawSlurOverlays(). Once the overlay runs it adds the
     *      class "slur-js" to the plane, which switches these segments off so the
     *      two layers never both paint.
     *
     * If you would rather keep all styling in app.html, delete this function and
     * its call and move the rules below into the existing <style> block there.
     */
    function ensureSlurStyles() {
        if (typeof document === 'undefined' || !document.head) return;
        if (document.getElementById('solfa-slur-runstyle')) return;

        const css =
            /* Positioning context for the overlay lines; as wide as the table. */
            '.solfa-plane{position:relative;width:max-content;}' +
            /* A little room under the syllables for the underline. */
            '.solfa-row-pitch .solfa-cell{position:relative;padding-bottom:4px;}' +
            /* The measured overlay line: one solid bar per run. */
            '.solfa-slur-line{' +
                'position:absolute;' +
                'height:1.5px;' +
                'background:#111;' +
                'pointer-events:none;' +
            '}' +
            /* CSS fallback segments, shown only until the overlay marks the plane
               with .slur-js. Overlap neighbours by ~1px so the fallback is as
               continuous as CSS allows. */
            '.solfa-plane:not(.slur-js) .solfa-cell.is-slur::after{' +
                'content:"";' +
                'position:absolute;' +
                'left:-1px;' +
                'right:-1px;' +
                'bottom:2px;' +
                'height:1.5px;' +
                'background:currentColor;' +
                'pointer-events:none;' +
            '}' +
            '.solfa-plane:not(.slur-js) .solfa-cell.solfa-slur-start::after{left:0.3em;}' +
            '.solfa-plane:not(.slur-js) .solfa-cell.solfa-slur-end::after{right:0.3em;}' +
            '.solfa-plane:not(.slur-js) .solfa-cell.solfa-slur-single::after{left:0.3em;right:0.3em;}' +
            /* Invisible copy of a beat/sub-pulse prefix, used in the lyric row to
               push a later syllable under its note without showing the marker. */
            '.solfa-pre-spacer{visibility:hidden;}';

        const styleEl = document.createElement('style');
        styleEl.id = 'solfa-slur-runstyle';
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    /**
     * Draw one continuous underline per slur run by measuring the tagged cells
     * after layout. Cells carrying the same data-slur-run value belong to one
     * run; the line spans from the left of the run's first syllable to the right
     * of its last. Positions are measured relative to the enclosing
     * .solfa-plane, which scrolls with the table, so the lines track it.
     *
     * Safe to call repeatedly: it clears its own previous lines first. Because
     * it depends on layout metrics (and web fonts can shift them), it is called
     * on the next animation frame after render, again on document.fonts.ready,
     * and on resize / before printing.
     *
     * Underline ranges are resolved primarily from the slur endpoints: each
     * <slur startid endid> is emitted on the plane as a data-slur-pairs entry,
     * and because every note carries its xml:id (id="solfa-note-<id>"), the two
     * endpoints resolve straight to their cells and the run is the cells between
     * them in that row. Attribute-style slurs (@slur="i|m|t"), which have no
     * endpoints, fall back to grouping the is-slur cells by their data-slur-run
     * id. Either way one continuous line is drawn per run.
     *
     * @param {Element} root – container that holds the rendered sol-fa (usually
     *                         #svg_output)
     */
    function drawSlurOverlays(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return;

        Array.prototype.forEach.call(root.querySelectorAll('.solfa-plane'), function (plane) {
            // Switch the CSS fallback off now that we are drawing the overlay.
            plane.classList.add('slur-js');

            // Remove any lines from a previous pass before re-measuring.
            Array.prototype.forEach.call(plane.querySelectorAll('.solfa-slur-line'), function (el) { el.remove(); });

            const base = plane.getBoundingClientRect();

            // Draw one line spanning an ordered list of cells (>= 1).
            function drawForCells(cells) {
                if (!cells || !cells.length) return;
                const firstCell = cells[0];
                const lastCell  = cells[cells.length - 1];

                // Anchor on the syllable glyphs so the line sits under the notes,
                // not under a leading beat marker; fall back to the whole cell.
                const startEl = firstCell.querySelector('.solfa-syl') || firstCell;
                const endSyls = lastCell.querySelectorAll('.solfa-syl');
                const endEl   = endSyls.length ? endSyls[endSyls.length - 1] : lastCell;

                const sr = startEl.getBoundingClientRect();
                const er = endEl.getBoundingClientRect();
                const left  = sr.left  - base.left;
                const right = er.right - base.left;
                if (right <= left) return;

                const top = Math.max(sr.bottom, er.bottom) - base.top + 2;

                const line = document.createElement('div');
                line.className = 'solfa-slur-line';
                line.style.left  = left + 'px';
                line.style.top   = top + 'px';
                line.style.width = (right - left) + 'px';
                plane.appendChild(line);
            }

            // Collect the inclusive run of <td>s between two cells in one row,
            // in visual order, regardless of which endpoint came first.
            function cellsBetween(a, b) {
                if (a === b) return [a];
                if (a.parentNode !== b.parentNode) return null;
                for (let dir = 0; dir < 2; dir++) {
                    const from = dir === 0 ? a : b;
                    const to   = dir === 0 ? b : a;
                    const out  = [from];
                    let cur = from.nextElementSibling;
                    while (cur) {
                        if (cur.tagName === 'TD') out.push(cur);
                        if (cur === to) return out;
                        cur = cur.nextElementSibling;
                    }
                }
                return null;
            }

            // Which cell holds a given note id.
            function cellForNote(id) {
                const el = document.getElementById('solfa-note-' + id);
                return el ? el.closest('td') : null;
            }

            // ---- Primary: resolve runs from the slur endpoint pairs. ----
            const coveredRuns = {};
            let pairs = [];
            try { pairs = JSON.parse(plane.getAttribute('data-slur-pairs') || '[]'); }
            catch (e) { pairs = []; }

            pairs.forEach(function (pair) {
                const startTd = cellForNote(pair[0]);
                const endTd   = cellForNote(pair[1]);
                if (!startTd || !endTd) return;          // fall back via classes
                const cells = cellsBetween(startTd, endTd);
                if (!cells) return;
                drawForCells(cells);
                cells.forEach(function (td) {
                    const r = td.getAttribute('data-slur-run');
                    if (r) coveredRuns[r] = true;         // don't redraw in fallback
                });
            });

            // ---- Fallback: group any remaining is-slur cells by run id. ----
            const runs = {};
            const order = [];
            Array.prototype.forEach.call(plane.querySelectorAll('td[data-slur-run]'), function (td) {
                const id = td.getAttribute('data-slur-run');
                if (coveredRuns[id]) return;
                if (!runs[id]) { runs[id] = []; order.push(id); }
                runs[id].push(td);
            });
            order.forEach(function (id) { drawForCells(runs[id]); });
        });
    }

    /**
     * Schedule the overlay pass after layout, after fonts load, and register
     * one-time resize / print redraw handlers.
     */
    function scheduleSlurOverlays(container) {
        if (!container) return;

        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(function () { drawSlurOverlays(container); });
        } else {
            drawSlurOverlays(container);
        }

        if (typeof document !== 'undefined' && document.fonts && document.fonts.ready &&
            typeof document.fonts.ready.then === 'function') {
            document.fonts.ready.then(function () { drawSlurOverlays(container); });
        }

        if (!global.__solfaOverlayListeners && typeof window !== 'undefined' && window.addEventListener) {
            global.__solfaOverlayListeners = true;
            let rafId = null;
            const redraw = function () {
                const c = document.getElementById('svg_output');
                if (c && global.globalSolfaMode) drawSlurOverlays(c);
            };
            window.addEventListener('resize', function () {
                if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
                rafId = (typeof requestAnimationFrame === 'function')
                    ? requestAnimationFrame(redraw)
                    : (redraw(), null);
            });
            window.addEventListener('beforeprint', redraw);
        }
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

        /* Make sure the slur run-underline CSS is present. */
        ensureSlurStyles();

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

        /* Collect the raw <slur> endpoint pairs so the overlay can resolve each
           underline straight from startid/endid to the matching cells. */
        const slurPairs = [];
        Array.prototype.forEach.call(doc.querySelectorAll('slur'), function (slurEl) {
            const s = (slurEl.getAttribute('startid') || '').replace(/^#/, '');
            const e = (slurEl.getAttribute('endid')   || '').replace(/^#/, '');
            if (s && e) slurPairs.push([s, e]);
        });

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

        /* Detect pickup: if the first beat of the first voice has beatPrefix ':',
         * the piece begins with an anacrusis (pickup bar). */
        const _firstVoiceItems = voiceItems.find(it => it.length > 0) || [];
        const hasPickup = _firstVoiceItems.length > 0 && _firstVoiceItems[0].beatPrefix === ':';

        /* Build HTML */
        const H = [];
        H.push('<div class="solfa-output">');

        if (title) H.push('<h2 class="solfa-title">' + esc(title) + '</h2>');

        H.push(
            '<p class="solfa-meta">Key:\u00a0<strong>' + esc(buildKeyName(keySig, modeAttr)) + '</strong>' +
            '\u2003' + esc(fundamental) + '\u00a0=\u00a0<strong>' + esc(fundamentalNote) + '</strong></p>'
        );

        H.push('<div class="solfa-brace-wrap">');
        H.push('<div class="solfa-brace-col" aria-hidden="true">');
        H.push('<svg class="solfa-brace" xmlns="http://www.w3.org/2000/svg" viewBox="125 -1580.7 495 2659.1" preserveAspectRatio="none">');
        H.push('<g stroke="currentColor" fill="currentColor" stroke-width="0" transform="matrix(1 0 0 -1 0 0)">');
        H.push('<path stroke-width="1" d="M618 -943L612 -949H582L568 -943Q472 -903 411 -841T332 -703Q327 -682 327 -653T325 -350Q324 -28 323 -18Q317 24 301 61T264 124T221 171T179 205T147 225T132 234Q130 238 130 250Q130 255 130 258T131 264T132 267T134 269T139 272T144 275Q207 308 256 367Q310 436 323 519Q324 529 325 851Q326 1124 326 1154T332 1205Q369 1358 566 1443L582 1450H612L618 1444V1429Q618 1413 616 1411L608 1406Q599 1402 585 1393T552 1372T515 1343T479 1305T449 1257T429 1200Q425 1180 425 1152T423 851Q422 579 422 549T416 498Q407 459 388 424T346 364T297 318T250 284T214 264T197 254L188 251L205 242Q290 200 345 138T416 3Q421 -18 421 -48T423 -349Q423 -397 423 -472Q424 -677 428 -694Q429 -697 429 -699Q434 -722 443 -743T465 -782T491 -816T519 -845T548 -868T574 -886T595 -899T610 -908L616 -910Q618 -912 618 -928V-943Z"/>');
        H.push('</g>');
        H.push('</svg>');
        H.push('</div>');
        H.push('<div class="solfa-scroll">');
        // The plane wraps the table and is the positioning context for the
        // measured slur-underline overlay. It is as wide as the table
        // (max-content) and lives inside the scroll, so overlay lines scroll
        // with the notation.
        H.push('<div class="solfa-plane" data-slur-pairs="' + esc(JSON.stringify(slurPairs)) + '">');
        H.push('<table class="solfa-table" role="presentation">');

        voices.forEach((voice, vi) => {
            const items = voiceItems[vi];
            if (items.length === 0) return; // skip voices with no content

            /* ---- Sol-fa (pitch) row ---- */
            // Pre-compute which item indices immediately precede a bar marker
            // (those beat cells get a right border to form the measure barline)
            const barEndSet = new Set();
            items.forEach((it, idx) => { if (it.type === 'bar') barEndSet.add(idx - 1); });

            // Group consecutive slurred cells into runs and record each cell's
            // role (start | mid | end | single) so the underline can be drawn
            // once per run on the cells, rather than per glyph. A cell counts as
            // slurred when it is a slurred held continuation or a beat holding at
            // least one slurred note. Bar items carry no cell, so they are
            // filtered out first; two slurred beats separated only by a barline
            // are therefore treated as adjacent, and the line continues across
            // the bar as a slur should.
            function itemIsSlurred(it) {
                if (it.type === 'held')  return !!it.slurred;
                if (it.type === 'multi') return it.notes.some(n => n.cell && n.cell.slurred);
                return false;
            }
            const rendered = [];
            items.forEach((it, idx) => { if (it.type !== 'bar') rendered.push({ idx, slur: itemIsSlurred(it) }); });
            const slurRole  = {};
            const slurRunId = {};
            let   runCounter = 0;
            let   curRunId   = null;
            rendered.forEach((x, k) => {
                if (!x.slur) { curRunId = null; return; }
                const prev = k > 0 && rendered[k - 1].slur;
                const next = k < rendered.length - 1 && rendered[k + 1].slur;
                slurRole[x.idx] = (!prev && !next) ? 'single' : (!prev ? 'start' : (!next ? 'end' : 'mid'));
                if (!prev) curRunId = 'v' + vi + 'r' + (runCounter++);
                slurRunId[x.idx] = curRunId;
            });
            // Class fragment drives the CSS fallback; the data attribute lets the
            // measured overlay group each run's cells and draw one line for it.
            function slurClass(idx) {
                return slurRole[idx] ? ' is-slur solfa-slur-' + slurRole[idx] : '';
            }
            function slurData(idx) {
                return slurRunId[idx] ? ' data-slur-run="' + slurRunId[idx] + '"' : '';
            }

            H.push('<tr class="solfa-row-pitch">');
            items.forEach((item, idx) => {
                if (item.type === 'bar') {
                    return; // barline is rendered as a right border on the preceding beat cell
                }
                const barEnd = barEndSet.has(idx) ? ' solfa-bar-end' : '';
                const barStart = (!hasPickup && idx === 0) ? ' solfa-bar-start' : '';
                if (item.type === 'held') {
                    const pre  = item.beatPrefix
                        ? '<span class="solfa-beat-pre" aria-hidden="true">' + esc(item.beatPrefix) + '</span>'
                        : '';
                    const dash = '\u2013';
                    // A held cell continues an earlier note; carry that note's id
                    // (data-note-id) so playback highlighting can light the whole
                    // sustain, and so slur logic can span across it if needed.
                    const heldId = item.id ? ' data-note-id="' + esc(item.id) + '"' : '';
                    H.push('<td class="solfa-cell solfa-held' + barEnd + barStart + slurClass(idx) + '"' +
                           slurData(idx) + heldId + '>' + pre + dash + '</td>');
                } else {
                    // type === 'multi': one or more notes/rests at this position
                    const beatPre = item.beatPrefix
                        ? '<span class="solfa-beat-pre" aria-hidden="true">' + esc(item.beatPrefix) + '</span>'
                        : '';
                    let inner = beatPre;
                    const cellNoteIds = [];
                    item.notes.forEach(({ subPrefix, cell }) => {
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
                            // Wrap each note in a span that carries its MEI xml:id.
                            // The unique id (prefixed so it is valid and cannot
                            // collide with Verovio's SVG ids) lets slur startid/
                            // endid resolve straight to the DOM, and lets playback
                            // highlight the sounding note. A beat can hold more than
                            // one note, which is why the id lives on the note span
                            // rather than the cell.
                            if (cell.id) {
                                cellNoteIds.push(cell.id);
                                inner += subPre + '<span class="solfa-note" id="solfa-note-' + esc(cell.id) +
                                         '" data-note-id="' + esc(cell.id) + '">' + noteContent + '</span>';
                            } else {
                                inner += subPre + noteContent;
                            }
                        }
                    });
                    // List every note id in this cell for quick cell-level lookup.
                    const cellIdsAttr = cellNoteIds.length
                        ? ' data-note-ids="' + esc(cellNoteIds.join(' ')) + '"'
                        : '';
                    H.push('<td class="solfa-cell' + barEnd + barStart + slurClass(idx) + '"' +
                           slurData(idx) + cellIdsAttr + '>' + inner + '</td>');
                }
            });
            H.push('</tr>');

            /* ---- Text (lyric) row ---- */
            H.push('<tr class="solfa-row-text">');
            items.forEach((item, idx) => {
                if (item.type === 'bar') {
                    return; // barline rendered via right border on preceding cell
                }
                const barEnd = barEndSet.has(idx) ? ' solfa-bar-end' : '';
                const barStart = (!hasPickup && idx === 0) ? ' solfa-bar-start' : '';
                if (item.type === 'held') {
                    H.push('<td class="solfa-cell' + barEnd + barStart + '"></td>');
                } else {
                    // Render EVERY syllable in the beat, not just the first. A
                    // subdivided beat can carry more than one syllable (e.g. two
                    // eighth notes on two words); taking only the first dropped the
                    // rest. Notes without a syllable (a melisma continuation)
                    // contribute nothing. Each note's sub-pulse prefix is mirrored
                    // as an invisible spacer so syllables sit roughly under their
                    // notes, and the beat stays one column, so the grid shared with
                    // every other voice is left untouched.
                    const texted = item.notes.filter(n => n.cell.type !== 'rest' && (n.cell.text || '') !== '');
                    if (texted.length === 0) {
                        H.push('<td class="solfa-cell' + barEnd + barStart + '"></td>');
                    } else if (texted.length === 1) {
                        // Single syllable: unchanged rendering.
                        const c = texted[0].cell;
                        const dash = (c.con === 'd') ? '-' : '';
                        H.push('<td class="solfa-cell solfa-word' + barEnd + barStart + '">' +
                               esc(c.text) + dash + '</td>');
                    } else {
                        // Multiple syllables in one beat.
                        let inner = '';
                        item.notes.forEach(({ subPrefix, cell }) => {
                            if (cell.type === 'rest') return;
                            const spacer = subPrefix
                                ? '<span class="solfa-beat-pre solfa-pre-spacer" aria-hidden="true">' + esc(subPrefix) + '</span>'
                                : '';
                            const t = cell.text || '';
                            if (t) {
                                const dash = (cell.con === 'd') ? '-' : '';
                                inner += spacer + '<span class="solfa-word-part">' + esc(t) + dash + '</span>';
                            } else {
                                inner += spacer;
                            }
                        });
                        H.push('<td class="solfa-cell solfa-word' + barEnd + barStart + '">' + inner + '</td>');
                    }
                }
            });
            H.push('</tr>');

            /* Vertical spacer between voice parts (not after the last one) */
            if (vi < voices.length - 1) {
                H.push('<tr class="solfa-spacer" aria-hidden="true">');
                items.forEach((item, idx) => {
                    if (item.type === 'bar') {
                        return; // barline rendered via right border on preceding cell
                    }
                    const barEnd = barEndSet.has(idx) ? ' solfa-bar-end' : '';
                    const barStart = (!hasPickup && idx === 0) ? ' solfa-bar-start' : '';
                    const cls = (barEnd || barStart) ? ' class="' + (barEnd + barStart).trim() + '"' : '';
                    H.push('<td' + cls + '></td>');
                });
                H.push('</tr>');
            }
        });

        H.push('</table>');
        H.push('</div>'); // solfa-plane
        H.push('</div>'); // solfa-scroll
        H.push('</div>'); // solfa-brace-wrap
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

        // Draw the continuous slur underlines once the table has laid out.
        scheduleSlurOverlays(container);
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

    /** Exposed so callers that insert renderSolfa() output themselves can draw
     *  (or redraw) the measured slur underlines. */
    global.drawSolfaSlurOverlays = drawSlurOverlays;

}(window));
