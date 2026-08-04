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
     * Map a note to its sol-fa syllable, marking chromatic alterations the
     * way Curwen notation does: lowered scale degrees take an 'a' (d->da,
     * r->ra, m->ma...), raised ones take an 'e' (d->de, r->re, m->me...).
     *
     * Which of the two a note's accidental means depends on which diatonic
     * degree it's altering, and that's determined by the note's *letter*,
     * not by its final sounding pitch - two enharmonically identical notes
     * (F# vs Gb) are different alterations of different degrees (raised Fah
     * vs lowered Soh) and must not collapse to the same syllable. So this
     * first finds the note's diatonic syllable from its letter name via the
     * key signature alone (ignoring this note's own accidental - that's
     * always exactly one of d/r/m/f/s/l/t, since the key signature by
     * definition maps every letter onto a diatonic scale degree), then
     * compares that to the note's actual sounding pitch class to see
     * whether its own accidental raised or lowered it from there.
     *
     * @param {string} pname  – 'c' | 'd' | 'e' | 'f' | 'g' | 'a' | 'b'
     * @param {string} accid  – MEI accidental code (e.g. 's','f','n') or ''
     * @param {number} doh    – Doh pitch class (0-11)
     * @param {object} ksAcc  – key-signature accidentals map
     */
    function toSolfaWithAccidental(pname, accid, doh, ksAcc) {
        const diatonicPc  = noteToPitchClass(pname, '', ksAcc); // key sig only, no note-level accid
        const diatonicSyl = toSolfa(diatonicPc, doh);
        if (!accid) return diatonicSyl;

        const actualPc = noteToPitchClass(pname, accid, ksAcc);
        let diff = actualPc - diatonicPc;
        if (diff > 6) diff -= 12;   // shorter wraparound direction
        if (diff < -6) diff += 12;

        if (diff > 0) return diatonicSyl + 'e'; // raised
        if (diff < 0) return diatonicSyl + 'a'; // lowered
        return diatonicSyl; // accidental didn't actually change the pitch (e.g. a redundant courtesy mark)
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

        // Prefer the gestural accidental (@accid.ges) over the visual one
        // (@accid): standard notation only displays an accidental on the
        // first altered note in a bar, with later notes of the same pitch
        // silently carrying it for the rest of the bar - so a later note's
        // @accid is often absent even though it still sounds altered. This
        // encoding always stamps @accid.ges with the note's true sounding
        // adjustment (even when it just restates the key signature), so
        // reading that instead correctly catches every altered note, not
        // just the one where the accidental is actually drawn. Falling back
        // to the visual @accid covers data that doesn't carry accid.ges.
        const accidGesAttr  = noteEl.getAttribute('accid.ges');
        const accidVisAttr  = noteEl.getAttribute('accid');
        const accidChild    = noteEl.querySelector('accid');
        const accidChildGes = accidChild && accidChild.getAttribute('accid.ges');
        const accidChildVis = accidChild && accidChild.getAttribute('accid');
        const accid = accidGesAttr || accidChildGes || accidVisAttr || accidChildVis || '';

        const oct        = noteEl.getAttribute('oct') || '4';
        const pc         = noteToPitchClass(pname, accid, ksAcc);
        const solfaSyl   = (pc >= 0) ? toSolfaWithAccidental(pname, accid, doh, ksAcc) : '?';
        const octMark    = octaveMarker(pc, oct, doh, refOct);

        // Collect every verse on this note, keyed by verse number, so multiple
        // stanzas can each be rendered on their own lyric line.
        const verses = {};
        Array.prototype.forEach.call(noteEl.querySelectorAll('verse'), function (v) {
            const vn = v.getAttribute('n') || '1';
            const sy = v.querySelector('syl');
            verses[vn] = {
                text: sy ? sy.textContent.trim() : '',
                con:  sy ? (sy.getAttribute('con') || '') : ''
            };
        });
        // Verse 1 (or the first present) drives the legacy single-line fields.
        const primaryKey = verses['1'] ? '1' : Object.keys(verses)[0];
        const primary    = (primaryKey && verses[primaryKey]) || { text: '', con: '' };
        const sylText = primary.text;
        const con     = primary.con;

        // Duration: prefer parent chord's @dur, then the note's own @dur
        const dur  = durOverride  || noteEl.getAttribute('dur')  || '4';
        const dots = dotsOverride || noteEl.getAttribute('dots') || '0';
        const ssuLen = durationToSsu(dur, dots);

        // Slur: check the slurredIds set (from <slur> elements) and the @slur attribute
        const xmlId    = noteEl.getAttribute('xml:id') || noteEl.id || '';
        const slurAttr = noteEl.getAttribute('slur') || '';
        const slurred  = (xmlId && slurredIds && slurredIds.has(xmlId)) || /[imt]/i.test(slurAttr);

        return { type: 'note', id: xmlId, solfa: solfaSyl, octMark, text: sylText, con, verses, ssuLen, slurred };
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
            /* Lyrics use the site's sans stack so they read distinctly from the
               monospace sol-fa. Setting it on the cell too means the ch-based
               min-width below resolves in this same font. */
            '.solfa-cell.solfa-word,.solfa-word-part{' +
                'font-family:\'Open Sans\',Verdana,Tahoma,Arial,sans-serif;' +
            '}' +
            /* Each lyric syllable is its own inline-block so it can be measured and
               slid under its note by alignLyrics(). Before that pass runs (or with
               JS off) syllables simply sit left-to-right, kept apart by a margin. */
            '.solfa-word-part{display:inline-block;white-space:nowrap;}' +
            '.solfa-word-part + .solfa-word-part{margin-left:0.3em;}' +
            /* Each note+marker is an inline-block so alignLyrics can shift it
               under its syllable. */
            '.solfa-notegroup{display:inline-block;}' +
            /* Paginate instead of scroll: clip the viewport; paginateSolfa moves
               the plane one page at a time. (overflow:hidden keeps the container
               at content height, so only the horizontal overflow is clipped.) */
            '.solfa-scroll{overflow:hidden;}' +
            '.solfa-plane{transition:transform 0.15s ease;}' +
            /* Playback highlight: red, matching Verovio's currently-playing. */
            '.solfa-playing,.solfa-playing .solfa-syl{color:#ff0000;}' +
            /* Give every measure line breathing room on both sides so notes and
               lyrics sit clear of it; the columns widen to make the space. The
               next-cell selector works because barlines are the previous cell's
               right border (there is no separate barline cell). */
            '.solfa-table td.solfa-bar-end{padding-right:0.55em;}' +
            '.solfa-table td.solfa-bar-end + td{padding-left:0.55em;}' +
            /* Double bar (MEI @right="dbl"): two thin lines, e.g. a section end.
               Wider padding than a single line, since the mark itself is thicker. */
            '.solfa-table td.solfa-bar-dbl{position:relative;padding-right:0.85em;}' +
            '.solfa-table td.solfa-bar-dbl + td{padding-left:0.85em;}' +
            '.solfa-table td.solfa-bar-dbl::after{' +
                'content:"";position:absolute;top:0;bottom:0;right:0;width:4px;pointer-events:none;' +
                'background:linear-gradient(to right,' +
                    '#333 0,#333 1.5px,' +           /* first thin line */
                    'transparent 1.5px,transparent 2.5px,' + /* gap */
                    '#333 2.5px,#333 4px);' +        /* second thin line */
            '}' +
            /* Final (end-of-piece) barline (MEI @right="end"): a thin inner line
               and a thicker outer line at the last cell's right edge, drawn per row
               so it runs the full height of the system. */
            '.solfa-table td.solfa-bar-final{position:relative;padding-right:0.85em;}' +
            '.solfa-table td.solfa-bar-final::after{' +
                'content:"";position:absolute;top:0;bottom:0;right:0;width:5px;pointer-events:none;' +
                'background:linear-gradient(to right,' +
                    '#333 0,#333 1.5px,' +           /* thin inner line */
                    'transparent 1.5px,transparent 3px,' + /* gap */
                    '#333 3px,#333 5px);' +          /* thick outer line */
            '}';

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
     * Slide each lyric syllable under its note after layout.
     *
     * The lyric row cannot line up with the sol-fa row by CSS alone: the note
     * sits after a beat prefix that renders at a different font size in the two
     * rows, so no fixed spacer can match it, and a beat may hold several notes of
     * unequal width. Instead each syllable carries its note's id, so here we
     * measure the note's sol-fa letter and translate the syllable so it is
     * centred under that letter. A syllable is never pulled left over its
     * neighbour: within each lyric row the syllables are placed left to right and
     * clamped to at least a small gap past the previous one, which keeps
     * subdivided beats (two close syllables) legible instead of overlapping.
     *
     * Measurement is batched (reset, then read, then write) to avoid layout
     * thrash, and the pass is idempotent, so it is safe to re-run on resize,
     * after fonts load, and before printing.
     *
     * @param {Element} root – container holding the rendered sol-fa
     */
    function alignLyrics(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return;
        const GAP  = 4;   // px minimum gap between adjacent items
        const EDGE = 4;   // px minimum clearance from a barline

        // Reset every previous shift (note groups and syllables) so we measure
        // natural positions this pass.
        Array.prototype.forEach.call(root.querySelectorAll('.solfa-notegroup'), function (g) { g.style.transform = ''; });
        Array.prototype.forEach.call(root.querySelectorAll('.solfa-word-part'),  function (p) { p.style.transform = ''; });

        // Stanza rows that actually carry lyrics.
        const stanzaRows = Array.prototype.filter.call(
            root.querySelectorAll('.solfa-row-text'),
            function (row) { return row.querySelector('.solfa-word-part[data-note-id]'); }
        );
        if (!stanzaRows.length) return;

        // Group stanza rows by the pitch row (voice) whose notes they set, so each
        // voice is solved independently. All stanzas of a voice share its notes, so
        // the notes must spread to fit the WIDEST stanza; each stanza then anchors
        // under them.
        const byPitch = [];   // [{ pitchRow, rows: [...] }]
        stanzaRows.forEach(function (row) {
            const wp   = row.querySelector('.solfa-word-part[data-note-id]');
            const note = wp ? document.getElementById('solfa-note-' + wp.getAttribute('data-note-id')) : null;
            const pr   = note ? note.closest('.solfa-row-pitch') : null;
            if (!pr) return;
            let entry = null;
            for (let i = 0; i < byPitch.length; i++) { if (byPitch[i].pitchRow === pr) { entry = byPitch[i]; break; } }
            if (!entry) { entry = { pitchRow: pr, rows: [] }; byPitch.push(entry); }
            entry.rows.push(row);
        });

        byPitch.forEach(function (voice) {
            const pitchRow = voice.pitchRow;
            const rows     = voice.rows;

            // Barlines for this voice, each with the drawn width of its line, so a
            // lyric clears the actual mark rather than a notional hairline. A
            // single line is a 1.5px right border; a double bar draws ~4px and a
            // final bar ~5px inward from the cell's right edge (see the injected
            // CSS), so those need correspondingly more room.
            const rowRect  = pitchRow.getBoundingClientRect();
            const barlines = Array.prototype.map.call(
                pitchRow.querySelectorAll('td.solfa-bar-end, td.solfa-bar-dbl, td.solfa-bar-final'),
                function (td) {
                    const w = td.classList.contains('solfa-bar-final') ? 5
                            : td.classList.contains('solfa-bar-dbl')   ? 4
                            : 1.5;
                    return { x: td.getBoundingClientRect().right, w: w };
                }
            );
            // Right bound: the leftmost barline at or after x, pulled back by the
            // line's width plus the standard clearance.
            function rightBoundFor(x) {
                let b = rowRect.right;
                for (let i = 0; i < barlines.length; i++) {
                    const bl = barlines[i];
                    if (bl.x >= x - 1) {
                        const edge = bl.x - bl.w;      // where the drawn mark begins
                        if (edge < b) b = edge;
                    }
                }
                return b;
            }
            // Left bound: the rightmost barline at or before x. The mark sits in
            // the previous cell, so the next cell starts clear of it already.
            function leftBoundFor(x) {
                let b = rowRect.left;
                for (let i = 0; i < barlines.length; i++) {
                    if (barlines[i].x <= x + 1 && barlines[i].x > b) b = barlines[i].x;
                }
                return b;
            }

            // Per-stanza lookup: note id -> its word-part in that stanza row.
            const rowMaps = rows.map(function (r) {
                const m = {};
                Array.prototype.forEach.call(r.querySelectorAll('.solfa-word-part[data-note-id]'),
                    function (wp) { m[wp.getAttribute('data-note-id')] = wp; });
                return m;
            });

            // Ordered list of syllable-bearing notes, each with every stanza's
            // syllable and the widest of them.
            const seq = [];
            Array.prototype.forEach.call(pitchRow.querySelectorAll('.solfa-notegroup'), function (group) {
                const note = group.querySelector('.solfa-note[data-note-id]');
                if (!note) return;
                const id = note.getAttribute('data-note-id');
                const sylParts = [];
                let maxW = 0;
                rowMaps.forEach(function (m) {
                    const wp = m[id];
                    if (!wp) return;
                    const wr = wp.getBoundingClientRect();
                    sylParts.push({ wp: wp, left: wr.left });
                    if (wr.width > maxW) maxW = wr.width;
                });
                if (!sylParts.length) return;   // note with no lyric: leave it in place
                const glyph = note.querySelector('.solfa-syl') || note;
                const gr    = glyph.getBoundingClientRect();
                const cell  = note.closest('td');
                const cr    = cell ? cell.getBoundingClientRect() : gr;
                seq.push({
                    group: group, glyphLeft: gr.left, maxW: Math.max(maxW, gr.width), sylParts: sylParts,
                    leftBound:  leftBoundFor(cr.left)  + EDGE,
                    rightBound: rightBoundFor(cr.right) - EDGE,
                });
            });

            // Target x for each note: keep natural order, don't let the widest
            // stanza's syllable overlap the previous note's slot, and keep it
            // inside the barlines (the hard constraint).
            let prevRight = -Infinity;
            seq.forEach(function (it) {
                let T = Math.max(it.glyphLeft, prevRight + GAP, it.leftBound);
                const maxT = it.rightBound - it.maxW;   // widest stanza stays inside the line
                if (T > maxT) T = maxT;
                if (T < it.leftBound) T = it.leftBound;
                it.T = T;
                prevRight = T + it.maxW;
            });

            // Apply: move each note group to its target, and every stanza's
            // syllable for that note to the same x, so all stanzas line up under it
            // and the note sits above them (opening the "m .,m" space where a later
            // note in a subdivided beat has to travel to reach its word).
            seq.forEach(function (it) {
                const dNote = it.T - it.glyphLeft;
                if (Math.abs(dNote) > 0.5) it.group.style.transform = 'translateX(' + dNote + 'px)';
                it.sylParts.forEach(function (sp) {
                    const dSyl = it.T - sp.left;
                    if (Math.abs(dSyl) > 0.5) sp.wp.style.transform = 'translateX(' + dSyl + 'px)';
                });
            });
        });
    }

    /* ── Pagination ──────────────────────────────────────────────────────── */
    /*
     * The sol-fa is one wide table inside .solfa-plane, clipped by .solfa-scroll
     * (overflow hidden, injected below). Rather than scroll, we translate the
     * plane to show one page at a time, a page being the run of whole measures
     * that fits the viewport width — the same idea as Verovio's paging. The
     * first / prev / next controls drive it (wired at the end of this file).
     */
    let solfaPageOffsets = [0];   // x-offset (px, within the plane) of each page start
    let solfaPageIndex   = 0;

    function solfaEls(container) {
        const root = container || document.getElementById('svg_output');
        if (!root || typeof root.querySelector !== 'function') return null;
        const scroll = root.querySelector('.solfa-scroll');
        const plane  = root.querySelector('.solfa-plane');
        return (scroll && plane) ? { scroll: scroll, plane: plane } : null;
    }

    /** Translate the plane so page k sits at the left edge of the viewport. */
    function showSolfaPage(k, plane) {
        if (!plane) { const e = solfaEls(); plane = e ? e.plane : null; }
        if (!plane || !solfaPageOffsets.length) return;
        if (k < 0) k = 0;
        if (k >= solfaPageOffsets.length) k = solfaPageOffsets.length - 1;
        solfaPageIndex = k;
        plane.style.transform = 'translateX(' + (-solfaPageOffsets[k]) + 'px)';
    }

    /** Recompute page boundaries for the current layout and re-show the page. */
    function paginateSolfa(container) {
        const els = solfaEls(container);
        if (!els) { solfaPageOffsets = [0]; solfaPageIndex = 0; return; }

        const W = els.scroll.clientWidth;
        if (!W) { solfaPageOffsets = [0]; showSolfaPage(0, els.plane); return; }

        // Measure boundaries relative to the plane's own left edge (so the current
        // page transform, which shifts both, does not matter): the start (0), each
        // barline (bar-end right), and the plane's right edge. Columns are shared,
        // so the first pitch row's bar-ends give the x-positions for every row.
        const planeLeft = els.plane.getBoundingClientRect().left;
        const bounds = [0];
        const pitchRow = els.plane.querySelector('.solfa-row-pitch');
        if (pitchRow) {
            Array.prototype.forEach.call(pitchRow.querySelectorAll('td.solfa-bar-end, td.solfa-bar-dbl, td.solfa-bar-final'), function (td) {
                bounds.push(td.getBoundingClientRect().right - planeLeft);
            });
        }
        bounds.push(els.plane.scrollWidth);
        bounds.sort(function (a, b) { return a - b; });

        // Pack whole measures into pages no wider than the viewport. A single
        // measure wider than the viewport gets its own (overflowing) page.
        const offsets = [bounds[0]];
        let start = bounds[0];
        for (let i = 1; i < bounds.length; i++) {
            if (bounds[i] - start > W + 1 && bounds[i - 1] > start) {
                start = bounds[i - 1];
                offsets.push(start);
            }
        }
        solfaPageOffsets = offsets;
        if (solfaPageIndex >= offsets.length) solfaPageIndex = offsets.length - 1;
        if (solfaPageIndex < 0) solfaPageIndex = 0;
        showSolfaPage(solfaPageIndex, els.plane);
    }

    /* ── Zoom ────────────────────────────────────────────────────────────── */
    /*
     * Zoom scales one base font-size on .solfa-output. Everything below it —
     * pitch (1.15em), lyrics (0.82em), rhythm markers, octave marks, and the
     * ch-based column widths — is relative, so it all scales together; re-running
     * the layout passes then realigns and re-paginates at the new size. Each step
     * is 4px on the base. The first / prev / next... zoom controls are wired at
     * the end of this file.
     */
    let solfaZoomStep   = 0;      // each step = +/- 4px on the base font size
    let solfaBaseFontPx = null;   // the un-zoomed base, captured once

    function applySolfaZoomSize(container) {
        const root = container || document.getElementById('svg_output');
        if (!root || typeof root.querySelector !== 'function') return;
        const output = root.querySelector('.solfa-output');
        if (!output) return;
        if (solfaBaseFontPx == null && typeof window !== 'undefined' && window.getComputedStyle) {
            solfaBaseFontPx = parseFloat(window.getComputedStyle(output).fontSize) || 16;
        }
        const base = solfaBaseFontPx || 16;
        let px = base + solfaZoomStep * 4;
        if (px < 8)  px = 8;
        if (px > 60) px = 60;
        output.style.fontSize = px + 'px';
    }

    /** Run the post-layout passes: zoom size, lyric alignment, slurs, pagination. */
    function refreshSolfaOverlays(container) {
        applySolfaZoomSize(container);   // set the current zoom size before measuring
        alignLyrics(container);
        drawSlurOverlays(container);
        paginateSolfa(container);
    }

    /* ── Playback highlighting ───────────────────────────────────────────── */
    /*
     * Highlight the sounding sol-fa syllable(s) and their lyrics during MIDI
     * playback, in sync with Verovio. The app drives Verovio's highlighter every
     * animation frame from a timemap (playback time -> note ids); we augment that
     * (below) to also highlight the sol-fa. Because every sol-fa note span, held
     * continuation cell, and lyric syllable carries data-note-id = the MEI xml:id,
     * one lookup per id lights the syllable and all its stanzas' words together,
     * and a held note stays lit through its sustain.
     */
    let solfaHlMap    = null;          // Map<xml:id, Element[]> for the current render
    let solfaHlFor    = null;          // the .solfa-output the map was built for
    let solfaHlActive = new Set();     // xml:ids currently highlighted
    let solfaTimemap  = null;          // captured from setTimemap() (see augment below)

    // The timemap: prefer the copy we capture from the app's setTimemap() call
    // (robust, no cross-script variable access), and fall back to the shared
    // global if for some reason we have not captured one yet.
    function currentTimemap() {
        if (solfaTimemap && solfaTimemap.length) return solfaTimemap;
        try {
            if (typeof timemap !== 'undefined' && timemap && timemap.length) return timemap;
        } catch (e) { /* timemap not reachable */ }
        return null;
    }

    function buildSolfaHlMap() {
        const out = document.querySelector('#svg_output .solfa-output');
        if (!out) { solfaHlMap = null; solfaHlFor = null; solfaHlActive = new Set(); return; }
        if (out === solfaHlFor && solfaHlMap) return;   // still current
        const map = new Map();
        Array.prototype.forEach.call(out.querySelectorAll('[data-note-id]'), function (el) {
            const id = el.getAttribute('data-note-id');
            if (!map.has(id)) map.set(id, []);
            map.get(id).push(el);
        });
        solfaHlMap    = map;
        solfaHlFor    = out;
        solfaHlActive = new Set();
    }

    function setSolfaId(id, on) {
        const els = solfaHlMap && solfaHlMap.get(id);
        if (!els) return;
        for (let i = 0; i < els.length; i++) {
            if (on) els[i].classList.add('solfa-playing');
            else    els[i].classList.remove('solfa-playing');
        }
    }

    /** Highlight the notes sounding at playback time t (ms), un-highlight the rest. */
    function highlightSolfaAtTime(t) {
        const tm = currentTimemap();
        if (!tm) return;
        buildSolfaHlMap();
        if (!solfaHlMap) return;

        // Notes sounding at t: turned on at some tstamp <= t and not yet off.
        const sounding = new Set();
        for (let i = 0; i < tm.length; i++) {
            const e = tm[i];
            if (e.tstamp > t) break;                 // timemap is time-ordered
            if (e.off) e.off.forEach(function (id) { sounding.delete(id); });
            if (e.on)  e.on .forEach(function (id) { sounding.add(id); });
        }

        // Diff against what is currently lit.
        solfaHlActive.forEach(function (id) { if (!sounding.has(id)) setSolfaId(id, false); });
        sounding.forEach(function (id) { if (!solfaHlActive.has(id)) setSolfaId(id, true); });
        solfaHlActive = sounding;

        // Auto-advance the page to follow playback (like Verovio's page turns).
        followSolfaPage(sounding);
    }

    /**
     * During playback, turn to the sol-fa page holding the furthest-progressed
     * sounding note, so the notation follows the music. The rightmost sounding
     * note is the leading edge, and the moment a note on the next page sounds the
     * page turns to it. Sol-fa pages are independent of Verovio's, so this is
     * driven by the notes themselves, not by Verovio's page number.
     */
    function followSolfaPage(sounding) {
        if (!solfaPageOffsets || solfaPageOffsets.length <= 1) return;  // single page
        const els = solfaEls();
        if (!els) return;
        const planeLeft = els.plane.getBoundingClientRect().left;   // reflects the page transform
        let maxX = -Infinity;
        sounding.forEach(function (id) {
            const el = document.getElementById('solfa-note-' + id);
            if (!el) return;
            const x = el.getBoundingClientRect().left - planeLeft;  // natural offset within the plane
            if (x > maxX) maxX = x;
        });
        if (maxX === -Infinity) return;   // no sounding note is drawn in the sol-fa
        let k = 0;
        for (let i = 0; i < solfaPageOffsets.length; i++) {
            if (solfaPageOffsets[i] <= maxX + 1) k = i;
        }
        if (k !== solfaPageIndex) showSolfaPage(k, els.plane);
    }

    /** Clear every sol-fa playback highlight (called when playback stops). */
    function clearSolfaHighlights() {
        const out = document.querySelector('#svg_output .solfa-output');
        if (out) {
            Array.prototype.forEach.call(out.querySelectorAll('.solfa-playing'),
                function (el) { el.classList.remove('solfa-playing'); });
        }
        solfaHlActive = new Set();
    }

    /**
     * Schedule the post-layout passes after layout, after fonts load, and
     * register one-time resize / print redraw handlers.
     */
    function scheduleSlurOverlays(container) {
        if (!container) return;

        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(function () { refreshSolfaOverlays(container); });
        } else {
            refreshSolfaOverlays(container);
        }

        if (typeof document !== 'undefined' && document.fonts && document.fonts.ready &&
            typeof document.fonts.ready.then === 'function') {
            document.fonts.ready.then(function () { refreshSolfaOverlays(container); });
        }

        if (!global.__solfaOverlayListeners && typeof window !== 'undefined' && window.addEventListener) {
            global.__solfaOverlayListeners = true;
            let rafId = null;
            const redraw = function () {
                const c = document.getElementById('svg_output');
                if (c && global.globalSolfaMode) refreshSolfaOverlays(c);
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
    /**
     * Parse an MEI document and compute everything needed to lay out the
     * sol-fa notation - voices, per-voice beat-grid items, barline types,
     * slur pairs, verse numbers, and key/title info - without building any
     * output format. Shared by renderSolfa (HTML view) and the PDF export,
     * so both always read the score exactly the same way.
     *
     * @param {string} meiXml
     * @returns {{error:string}|{error:null, doc:Document, slurPairs:Array,
     *   verseNums:string[], voices:Array, voiceItems:Array, measureRight:string[],
     *   finalBarType:string, barlineClass:Function, title:string,
     *   fundamental:string, fundamentalNote:string, keyDisplayName:string,
     *   hasPickup:boolean, meterInfo:Object}}
     */
    function buildSolfaModel(meiXml) {
        if (!meiXml) {
            return { error: 'No score loaded. Please select a text and tune first, then click Go.' };
        }

        /* Parse XML */
        let doc;
        try {
            const parser = new DOMParser();
            doc = parser.parseFromString(meiXml, 'text/xml');
            if (doc.querySelector('parsererror')) throw new Error('XML parse error');
        } catch (e) {
            return { error: 'Could not parse the score data.' };
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

        /* Collect the distinct verse (stanza) numbers present, in numeric order,
           so each stanza can be rendered on its own lyric line. */
        const verseNums = [];
        (function () {
            const seen = {};
            Array.prototype.forEach.call(doc.querySelectorAll('verse'), function (v) {
                const vn = v.getAttribute('n') || '1';
                if (!seen[vn]) { seen[vn] = true; verseNums.push(vn); }
            });
            verseNums.sort(function (a, b) { return (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0); });
            if (!verseNums.length) verseNums.push('1');
        })();

        /* Discover voice parts */
        const voices = discoverVoices(doc, staffDefs);
        if (voices.length === 0) {
            return { error: 'No voice parts found in the score.' };
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

        /* Barline type at the right of each measure, from MEI @right. This drives
         * whether a measure boundary is drawn as a single line, a double bar
         * (dbl), or a final/end bar (end). Absent maps to a single line, except
         * the very last measure, which defaults to a final bar by convention.
         *
         * Presentation Mode (see app-dev.js) repeats the tune once per stanza by
         * duplicating the whole <section>, one per stanza, all flattened here into
         * one continuous voice. The join between one stanza's repeat and the next
         * should always read as a double bar, but relying solely on @right="dbl"
         * being present on the right measure is fragile: the half-stanza measure
         * trimming that runs as part of that duplication can end up shortening a
         * section so its last measure is no longer the one that was tagged. So the
         * boundary is derived directly from the <section> elements themselves -
         * the true final measure of the piece keeps whatever @right it carries
         * (normally "end"), and the last measure of every earlier section is
         * forced to a double bar regardless of its own @right attribute. A
         * single-section score (Presentation Mode off) is unaffected. */
        const measureRight = allMeasures.map(m => (m.getAttribute('right') || '').toLowerCase());

        const sectionEls = Array.from(doc.querySelectorAll('section'));
        if (sectionEls.length > 1) {
            sectionEls.forEach((sectionEl, si) => {
                if (si === sectionEls.length - 1) return; // final section: leave its true end bar alone
                const sectionMeasures = Array.from(sectionEl.querySelectorAll('measure'));
                const lastOfSection = sectionMeasures[sectionMeasures.length - 1];
                if (!lastOfSection) return;
                const idx = allMeasures.indexOf(lastOfSection);
                if (idx !== -1) measureRight[idx] = 'dbl';
            });
        }

        const finalBarType = measureRight.length ? measureRight[measureRight.length - 1] : '';

        function barlineClass(type, isLast) {
            if (type === 'dbl') return 'solfa-bar-dbl';                             // double bar
            if (type === 'end' || type === 'rptend' || type === 'rptboth') return 'solfa-bar-final'; // final bar
            if (type === 'single') return 'solfa-bar-end';                          // explicit single
            return isLast ? 'solfa-bar-final' : 'solfa-bar-end';                    // absent: last -> final
        }

        /* Convert per-bar cell arrays into flat display-item arrays.
         * Each bar contributes exactly meterInfo.beatsPerBar beat-slot items.
         * Beat-position prefix characters are embedded inside each slot. */
        const voiceItems = voiceBars.map(bars => {
            const items = [];
            bars.forEach((barCells, bi) => {
                if (bi > 0) items.push({ type: 'bar', barType: measureRight[bi - 1] || '' });
                expandToBeatGrid(barCells, meterInfo).forEach(cell => items.push(cell));
            });
            return items;
        });

        /* Title from MEI header. The tune name is a second, "subordinate"
         * <title> in the same titleStmt (added by app-dev.js's MEI/TEI
         * combination step as e.g. "Tune: Eden"), separate from the main
         * text title. */
        const titleEl = doc.querySelector('titleStmt > title') || doc.querySelector('title');
        const title   = titleEl ? titleEl.textContent.trim() : '';
        const tuneTitleEl = doc.querySelector('titleStmt > title[type="subordinate"]');
        const tuneTitle   = tuneTitleEl ? tuneTitleEl.textContent.trim() : '';

        /* Heading: fundamental note (Doh, or La for minor) and key name.
         *
         * The score can be transposed via the Verovio transpose control (semitones
         * in the shared global trInterval). In movable-doh sol-fa the syllables and
         * octave marks are transposition-invariant, so the notation itself does not
         * change — only this label moves: the sounding key, and Doh (or La) with
         * it, shift by trInterval. At trInterval 0 we keep the exact key-signature
         * spelling; once transposed we name the shifted pitch class from a neutral
         * table (a sensible enharmonic default rather than Verovio's exact
         * respelling). trInterval is read defensively: it is undefined outside the
         * app (e.g. in tests), in which case there is no transposition. */
        const trSemis = (function () {
            if (typeof trInterval !== 'undefined' && trInterval != null) {
                const v = parseInt(trInterval, 10);
                return isNaN(v) ? 0 : v;
            }
            return 0;
        })();
        const laPc        = ((doh - LA_BELOW_DOH) % 12 + 12) % 12;
        const baseTonicPc = isMinor ? laPc : doh;
        const fundamental = isMinor ? 'La' : 'Doh';

        let fundamentalNote, keyDisplayName;
        if (trSemis === 0) {
            fundamentalNote = isMinor ? ALL_NOTE_NAMES[laPc] : dohLetterName(keySig);
            keyDisplayName  = buildKeyName(keySig, modeAttr);
        } else {
            const tPc = ((baseTonicPc + trSemis) % 12 + 12) % 12;
            fundamentalNote = ALL_NOTE_NAMES[tPc];
            keyDisplayName  = ALL_NOTE_NAMES[tPc] + '\u00a0' + (isMinor ? 'minor' : 'major');
        }

        /* Detect pickup: if the first beat of the first voice has beatPrefix ':',
         * the piece begins with an anacrusis (pickup bar). */
        const _firstVoiceItems = voiceItems.find(it => it.length > 0) || [];
        const hasPickup = _firstVoiceItems.length > 0 && _firstVoiceItems[0].beatPrefix === ':';

        return {
            error: null, doc, slurPairs, verseNums, voices, voiceItems, measureRight,
            finalBarType, barlineClass, title, tuneTitle, fundamental, fundamentalNote,
            keyDisplayName, hasPickup, meterInfo
        };
    }

    function renderSolfa(meiXml) {
        const model = buildSolfaModel(meiXml);
        if (model.error) {
            return '<div class="solfa-error">' + esc(model.error) + '</div>';
        }
        const {
            slurPairs, verseNums, voices, voiceItems, finalBarType,
            barlineClass, title, tuneTitle, fundamental, fundamentalNote, keyDisplayName, hasPickup
        } = model;

        /* Build HTML */
        const H = [];
        H.push('<div class="solfa-output">');

        if (title) H.push('<h2 class="solfa-title">' + esc(title) + '</h2>');
        if (tuneTitle) H.push('<h3 class="solfa-tune-title">' + esc(tuneTitle) + '</h3>');

        H.push(
            '<p class="solfa-meta">Key:\u00a0<strong>' + esc(keyDisplayName) + '</strong>' +
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
            // Map each measure-boundary cell to its barline class, taken from the
            // MEI @right carried on the bar items; the last cell of the piece takes
            // the final barline.
            const barClassAt = {};
            items.forEach((it, idx) => {
                if (it.type === 'bar') barClassAt[idx - 1] = barlineClass(it.barType, false);
            });
            let finalIdx = -1;
            for (let i = items.length - 1; i >= 0; i--) { if (items[i].type !== 'bar') { finalIdx = i; break; } }
            if (finalIdx >= 0) barClassAt[finalIdx] = barlineClass(finalBarType, true);

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
                const barEnd = barClassAt[idx] ? (' ' + barClassAt[idx]) : '';
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
                        // Each note travels with its rhythm marker inside a
                        // notegroup. alignLyrics may shift the group so the note
                        // sits under its (wider) syllable; the shift opens the
                        // space between the previous note and this marker, e.g.
                        // "m .,m" instead of "m.,m".
                        if (cell.type === 'rest') {
                            inner += '<span class="solfa-notegroup">' + subPre +
                                     '<span class="solfa-rest">\u2013</span></span>';
                        } else {
                            let noteContent = '<span class="solfa-syl">' + esc(cell.solfa) + '</span>';
                            if (cell.octMark && cell.octMark.text) {
                                noteContent += '<span class="' + esc(cell.octMark.cls) + '" aria-hidden="true">' +
                                               esc(cell.octMark.text) + '</span>';
                            }
                            // The note span carries its MEI xml:id (prefixed so it is
                            // valid and cannot collide with Verovio's SVG ids) so
                            // slur startid/endid resolve to the DOM, playback can
                            // highlight the sounding note, and the lyric/note
                            // alignment can pair them. A beat can hold more than one
                            // note, which is why the id lives on the note span.
                            let noteSpan;
                            if (cell.id) {
                                cellNoteIds.push(cell.id);
                                noteSpan = '<span class="solfa-note" id="solfa-note-' + esc(cell.id) +
                                           '" data-note-id="' + esc(cell.id) + '">' + noteContent + '</span>';
                            } else {
                                noteSpan = noteContent;
                            }
                            inner += '<span class="solfa-notegroup">' + subPre + noteSpan + '</span>';
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

            /* ---- Text (lyric) rows: one per stanza ---- */
            verseNums.forEach((vn) => {
                // Skip the row entirely if this voice has no words for this stanza
                // (e.g. inner SATB parts that carry no lyric).
                let hasAny = false;
                items.forEach((item) => {
                    if (item.type !== 'multi') return;
                    item.notes.forEach(({ cell }) => {
                        if (cell.type === 'rest' || !cell.verses) return;
                        const v = cell.verses[vn];
                        if (v && v.text) hasAny = true;
                    });
                });
                if (!hasAny) return;

                H.push('<tr class="solfa-row-text" data-verse="' + esc(vn) + '">');
                items.forEach((item, idx) => {
                    if (item.type === 'bar') return;
                    const barEnd = barClassAt[idx] ? (' ' + barClassAt[idx]) : '';
                    const barStart = (!hasPickup && idx === 0) ? ' solfa-bar-start' : '';
                    if (item.type === 'held') {
                        H.push('<td class="solfa-cell' + barEnd + barStart + '"></td>');
                    } else {
                        // One lyric span per syllable in this stanza, each tagged
                        // with its note id so the post-layout pass aligns it under
                        // that note. Notes without a syllable in this stanza (or a
                        // melisma) contribute nothing.
                        let inner = '';
                        let charCount = 0;
                        let sylCount  = 0;
                        item.notes.forEach(({ cell }) => {
                            if (cell.type === 'rest') return;
                            const v = (cell.verses && cell.verses[vn]) || null;
                            const t = v ? v.text : '';
                            if (!t) return;
                            const dash = (v.con === 'd') ? '-' : '';
                            charCount += t.length + dash.length;
                            sylCount  += 1;
                            const idAttr = cell.id ? ' data-note-id="' + esc(cell.id) + '"' : '';
                            inner += '<span class="solfa-word-part"' + idAttr + '>' + esc(t) + dash + '</span>';
                        });
                        if (inner) {
                            // Reserve column width from this stanza's lyric length
                            // in ch units. With the sans lyric font this is an
                            // estimate rather than exact (characters vary in width),
                            // but it only sets the initial column size: the actual
                            // placement is measured at runtime by alignLyrics, so a
                            // rough reservation is fine. The +2 gives a little slack.
                            const units = charCount + Math.max(0, sylCount - 1) + 2;
                            const widthStyle = ' style="min-width:' + units + 'ch"';
                            H.push('<td class="solfa-cell solfa-word' + barEnd + barStart + '"' + widthStyle + '>' + inner + '</td>');
                        } else {
                            H.push('<td class="solfa-cell' + barEnd + barStart + '"></td>');
                        }
                    }
                });
                H.push('</tr>');
            });

            /* Vertical spacer between voice parts (not after the last one) */
            if (vi < voices.length - 1) {
                H.push('<tr class="solfa-spacer" aria-hidden="true">');
                items.forEach((item, idx) => {
                    if (item.type === 'bar') {
                        return; // barline rendered via right border on preceding cell
                    }
                    const barEnd = barClassAt[idx] ? (' ' + barClassAt[idx]) : '';
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
        solfaPageIndex = 0;   // start each newly rendered score on page 1

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

    /** Exposed so the PDF export can lay out the same voices/items/barlines
     *  without duplicating the MEI parsing logic. */
    global.buildSolfaModel = buildSolfaModel;

    /** Exposed so callers that insert renderSolfa() output themselves can draw
     *  (or redraw) the measured slur underlines. */
    global.drawSolfaSlurOverlays = drawSlurOverlays;

    /** Exposed so callers can re-run lyric alignment (e.g. after a layout change). */
    global.alignSolfaLyrics = alignLyrics;

    /** Exposed so callers can (re)compute / jump sol-fa pages directly. */
    global.paginateSolfa = paginateSolfa;
    global.solfaShowPage = function (k) { showSolfaPage(k); };

    /** Exposed so callers can drive sol-fa zoom directly (dir = +1 / -1 / 0=reapply). */
    global.solfaZoom = function (dir) {
        if (dir > 0 && solfaZoomStep < 10) solfaZoomStep++;
        else if (dir < 0 && solfaZoomStep > -2) solfaZoomStep--;
        refreshSolfaOverlays(document.getElementById('svg_output'));
    };

    /*
     * Wire the existing first / prev / next (and last) page controls and the
     * zoom in / out controls to sol-fa when sol-fa mode is active; otherwise fall
     * through to the original Verovio handlers. The controls call these as globals
     * via inline onclick, so replacing the globals is sufficient; app-dev.js loads
     * first (both scripts are deferred and run in order), so the originals exist.
     */
    (function () {
        if (typeof window === 'undefined') return;
        function wrap(name, handler) {
            const orig = window[name];
            window[name] = function () {
                if (global.globalSolfaMode) { return handler.call(this, orig); }
                if (typeof orig === 'function') return orig.apply(this, arguments);
            };
        }
        wrap('firstPage', function () { showSolfaPage(0); });
        wrap('prevPage',  function () { showSolfaPage(solfaPageIndex - 1); });
        wrap('nextPage',  function () { showSolfaPage(solfaPageIndex + 1); });
        wrap('lastPage',  function () { showSolfaPage(solfaPageOffsets.length - 1); });
        wrap('zoomIn',    function () { global.solfaZoom(1); });
        wrap('zoomOut',   function () { global.solfaZoom(-1); });

        // loadPage() is what paints the Verovio SVG into #svg_output, and it runs
        // asynchronously from loadData (a requestAnimationFrame later), which is
        // why a transpose click was painting Verovio over the sol-fa. Intercept it:
        // in sol-fa mode, render the sol-fa instead of the Verovio SVG. This covers
        // the async transpose paint and any other Verovio render attempt while
        // sol-fa is showing; in Verovio mode it falls through untouched.
        wrap('loadPage', function () {
            if (typeof global.loadSolfaView === 'function') global.loadSolfaView();
        });

        // Transpose keeps its full Verovio behaviour (it retunes the loaded data,
        // which is what a later audio-playback step will read), then we re-render
        // the sol-fa. The notation is unchanged by transposition; only its Doh /
        // key label moves, which renderSolfa picks up from the updated trInterval.
        function transposeThenRefreshSolfa(orig) {
            if (typeof orig === 'function') orig();               // Verovio transpose (display + playback)
            if (typeof global.loadSolfaView === 'function') global.loadSolfaView(); // restore sol-fa with new Doh
        }
        wrap('trUp',   function (orig) { transposeThenRefreshSolfa(orig); });
        wrap('trDown', function (orig) { transposeThenRefreshSolfa(orig); });

        // Playback highlighting. The app calls highlightNotesAtMidiPlaybackTime()
        // every animation frame during MIDI playback and unHighlightAllElements()
        // when it stops. We *augment* both (run the original, then add sol-fa
        // behaviour) rather than replace them, so Verovio highlighting is untouched
        // and the sol-fa lights up from the same timemap and the same clock.
        function augment(name, extra) {
            const orig = window[name];
            window[name] = function () {
                let r;
                try { if (typeof orig === 'function') r = orig.apply(this, arguments); } catch (e) {}
                try { extra.apply(this, arguments); } catch (e) {}
                return r;
            };
        }

        // Capture the timemap whenever the app sets it, rather than relying on
        // reading its module-level variable across scripts.
        augment('setTimemap', function (tm) { solfaTimemap = (tm && tm.length) ? tm : []; });

        // Current playback time (ms). The app's page-turn loop was deliberately
        // switched from player.currentTime (unreliable) to a performance.now clock
        // seeded at playback start; we use that same clock, falling back to
        // player.currentTime only if it is unavailable.
        function solfaPlaybackTime() {
            try {
                if (typeof playbackStartTime !== 'undefined' && playbackStartTime !== null) {
                    const off = (typeof playbackStartOffset !== 'undefined') ? playbackStartOffset : 0;
                    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                    return now - playbackStartTime + off;
                }
            } catch (e) { /* fall through */ }
            const player = document.getElementById('verovio-midi-player');
            return player ? player.currentTime * 1000 : 0;
        }

        augment('highlightNotesAtMidiPlaybackTime', function () {
            if (!global.globalSolfaMode) return;
            highlightSolfaAtTime(solfaPlaybackTime());
        });
        augment('unHighlightAllElements', function () { clearSolfaHighlights(); });
    })();

    /** Exposed so playback code / tests can drive sol-fa highlighting directly. */
    global.highlightSolfaAtTime = highlightSolfaAtTime;
    global.clearSolfaHighlights = clearSolfaHighlights;

}(window));

