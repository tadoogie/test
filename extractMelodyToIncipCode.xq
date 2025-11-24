xquery version "3.1";

(:~
 : MEI Melody Extraction and IncipCode Generation
 : 
 : This module extracts melodies from MEI-encoded music files and generates
 : searchable incipCode representations in multiple formats:
 : - ABC notation
 : - Sol-fa (movable-do solfège)
 : - Interval notation
 : - Contour/direction notation
 :
 : The extracted codes are inserted into the MEI header's <work> element
 : as <incipCode> elements for fast melody searching.
 :
 : @author Generated for melody search functionality
 : @version 1.0
 :)

declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";

(:~
 : Convert a pitch name and octave to MIDI note number for calculations.
 : C4 (middle C) = 60
 :
 : @param $pname Pitch name (c, d, e, f, g, a, b)
 : @param $oct Octave number
 : @param $accid Accidental (s=sharp, f=flat, n=natural, ss=double sharp, ff=double flat)
 : @return MIDI note number
 :)
declare function local:pitch-to-midi($pname as xs:string, $oct as xs:integer, $accid as xs:string?) as xs:integer {
    let $base-pitches := map {
        "c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11
    }
    let $accid-offset := 
        if ($accid = "s") then 1
        else if ($accid = "f") then -1
        else if ($accid = "ss") then 2
        else if ($accid = "ff") then -2
        else 0
    return ($oct + 1) * 12 + $base-pitches($pname) + $accid-offset
};

(:~
 : Get the effective accidental for a note, checking @accid first, then @accid.ges
 :
 : @param $note The note element
 : @return Accidental value or empty string
 :)
declare function local:get-accidental($note as element()) as xs:string? {
    let $accid := $note/@accid
    let $accid-ges := $note/@accid.ges
    return
        if ($accid) then string($accid)
        else if ($accid-ges) then string($accid-ges)
        else ()
};

(:~
 : Extract the highest note from a chord element.
 : The highest note is determined by MIDI pitch value.
 :
 : @param $chord The chord element
 : @return The highest note element within the chord
 :)
declare function local:get-highest-note($chord as element(mei:chord)) as element(mei:note)? {
    let $notes := $chord/mei:note[@pname and @oct]
    return
        if (empty($notes)) then ()
        else
            (for $note in $notes
             let $midi := local:pitch-to-midi(
                 string($note/@pname),
                 xs:integer($note/@oct),
                 local:get-accidental($note)
             )
             order by $midi descending
             return $note)[1]
};

(:~
 : Extract melody notes from the soprano/melody line (staff 1, layer 1).
 : Handles notes, chords (takes highest note), and rests.
 : Returns a sequence of elements representing the melodic content.
 :
 : @param $mei The MEI document
 : @return Sequence of note/rest elements in melodic order
 :)
declare function local:extract-melody($mei as document-node()) as element()* {
    (: Get all measures in order :)
    let $measures := $mei//mei:measure
    return
        for $measure in $measures
        (: Target staff 1, layer 1 - the soprano/melody line :)
        let $layer := $measure//mei:staff[@n="1"]/mei:layer[@n="1"]
        return
            if (empty($layer)) then ()
            else
                for $element in $layer/*
                return
                    typeswitch ($element)
                    case element(mei:note) return
                        (: Only include notes with pitch information :)
                        if ($element/@pname and $element/@oct) then $element
                        else ()
                    case element(mei:chord) return
                        (: Take the highest note from the chord :)
                        local:get-highest-note($element)
                    case element(mei:rest) return
                        $element
                    case element(mei:mRest) return
                        (: Measure rest - treat as a single rest :)
                        $element
                    default return ()
};

(:~
 : Convert notes to ABC notation.
 : - Middle C (C4) = C
 : - C5 = c, C6 = c', C3 = C,
 : - Accidentals: ^ for sharp, _ for flat, = for natural
 : - Rests are represented as 'z'
 :
 : @param $notes Sequence of note/rest elements
 : @return ABC notation string
 :)
declare function local:notes-to-abc($notes as element()*) as xs:string {
    let $abc-tokens :=
        for $note in $notes
        return
            typeswitch ($note)
            case element(mei:rest) return "z"
            case element(mei:mRest) return "z"
            case element(mei:note) return
                let $pname := string($note/@pname)
                let $oct := xs:integer($note/@oct)
                let $accid := local:get-accidental($note)
                
                (: Accidental prefix :)
                let $accid-prefix :=
                    if ($accid = "s") then "^"
                    else if ($accid = "f") then "_"
                    else if ($accid = "n") then "="
                    else if ($accid = "ss") then "^^"
                    else if ($accid = "ff") then "__"
                    else ""
                
                (: Pitch letter - uppercase for C4 and below, lowercase for C5 and above :)
                let $letter := 
                    if ($oct < 5) then upper-case($pname)
                    else $pname
                
                (: Octave marks :)
                let $octave-mark :=
                    if ($oct < 4) then
                        string-join(for $i in 1 to (4 - $oct) return ",", "")
                    else if ($oct > 5) then
                        string-join(for $i in 1 to ($oct - 5) return "'", "")
                    else ""
                
                return concat($accid-prefix, $letter, $octave-mark)
            default return ""
    
    return string-join($abc-tokens, " ")
};

(:~
 : Get key signature information from scoreDef.
 : Returns the number of sharps (positive) or flats (negative).
 :
 : @param $mei The MEI document
 : @return Map with 'fifths' (number of sharps/flats), 'mode', and 'raw' (original string)
 :)
declare function local:get-key-signature($mei as document-node()) as map(*) {
    let $keysig := string(($mei//mei:scoreDef/@key.sig, $mei//mei:scoreDef/@keysig)[1])
    return
        if (empty($keysig) or $keysig = "") then
            map { "fifths": 0, "mode": "major", "raw": "0" }
        else
            (: Parse keysig like "2f" (2 flats) or "3s" (3 sharps) or "0" :)
            let $num := if (matches($keysig, "^\d+")) then 
                            xs:integer(replace($keysig, "[^\d]", ""))
                        else 0
            let $type := replace($keysig, "[\d]", "")
            return map {
                "fifths": if ($type = "f") then -$num else $num,
                "mode": "major",
                "raw": $keysig
            }
};

(:~
 : Determine the tonic pitch class based on key signature.
 : Assumes major key for now (could be extended for minor detection).
 :
 : @param $fifths Number of sharps (positive) or flats (negative)
 : @return Tonic pitch class (0-11, where 0=C)
 :)
declare function local:get-tonic($fifths as xs:integer) as xs:integer {
    (: Circle of fifths: each fifth adds 7 semitones mod 12 :)
    (: C=0, G=7, D=2, A=9, E=4, B=11, F#=6 (sharps) :)
    (: C=0, F=5, Bb=10, Eb=3, Ab=8, Db=1, Gb=6 (flats) :)
    let $tonic := ($fifths * 7) mod 12
    return if ($tonic < 0) then $tonic + 12 else $tonic
};

(:~
 : Convert notes to movable-do solfège notation.
 : Uses the key signature to determine the tonic.
 : d=do, r=re, m=mi, f=fa, s=sol, l=la, t=ti
 : Raised tones use ^ prefix, lowered use v prefix.
 : Rests are represented as '-'
 :
 : @param $notes Sequence of note elements
 : @param $keysig Key signature string (e.g., "2f" for 2 flats, "3s" for 3 sharps)
 : @return Solfège notation string
 :)
declare function local:notes-to-solfa($notes as element()*, $keysig as xs:string) as xs:string {
    (: Parse keysig like "2f" (2 flats) or "3s" (3 sharps) or "0" :)
    let $num := if (matches($keysig, "^\d+")) then 
                    xs:integer(replace($keysig, "[^\d]", ""))
                else 0
    let $type := replace($keysig, "[\d]", "")
    let $fifths := if ($type = "f") then -$num else $num
    let $tonic := local:get-tonic($fifths)
    
    (: Solfège syllables for each scale degree :)
    let $solfa := ("d", "r", "m", "f", "s", "l", "t")
    (: Chromatic to diatonic mapping (semitones from tonic -> scale degree 0-6 + alteration) :)
    (: 0=do, 1=^d/vr, 2=re, 3=^r/vm, 4=mi, 5=fa, 6=^f/vs, 7=sol, 8=^s/vl, 9=la, 10=^l/vt, 11=ti :)
    
    let $tokens :=
        for $note in $notes
        return
            typeswitch ($note)
            case element(mei:rest) return "-"
            case element(mei:mRest) return "-"
            case element(mei:note) return
                let $pname := string($note/@pname)
                let $oct := xs:integer($note/@oct)
                let $accid := local:get-accidental($note)
                let $midi := local:pitch-to-midi($pname, $oct, $accid)
                
                (: Get pitch class relative to tonic :)
                let $pc := ($midi mod 12 - $tonic + 12) mod 12
                
                (: Map chromatic pitch class to solfège :)
                return
                    switch ($pc)
                    case 0 return "d"    (: do :)
                    case 1 return "^d"   (: raised do / lowered re :)
                    case 2 return "r"    (: re :)
                    case 3 return "^r"   (: raised re / lowered mi :)
                    case 4 return "m"    (: mi :)
                    case 5 return "f"    (: fa :)
                    case 6 return "^f"   (: raised fa / lowered sol :)
                    case 7 return "s"    (: sol :)
                    case 8 return "^s"   (: raised sol / lowered la :)
                    case 9 return "l"    (: la :)
                    case 10 return "^l"  (: raised la / lowered ti :)
                    case 11 return "t"   (: ti :)
                    default return "?"
            default return ""
    
    return string-join($tokens, " ")
};

(:~
 : Convert notes to interval notation.
 : Format: START:pitch followed by U/D + interval number
 : U = up, D = down, interval = chromatic semitones
 : Rests are represented as '-'
 :
 : @param $notes Sequence of note elements
 : @return Interval notation string
 :)
declare function local:notes-to-intervals($notes as element()*) as xs:string {
    (: Filter out rests for interval calculation :)
    let $pitched-notes := 
        for $note in $notes
        where $note[self::mei:note] and $note/@pname and $note/@oct
        return $note
    
    return
        if (empty($pitched-notes)) then ""
        else
            let $first := $pitched-notes[1]
            let $first-pname := string($first/@pname)
            let $first-oct := xs:integer($first/@oct)
            let $first-accid := local:get-accidental($first)
            
            (: Format starting pitch :)
            let $accid-str := 
                if ($first-accid = "s") then "#"
                else if ($first-accid = "f") then "b"
                else ""
            let $start := concat("START:", upper-case($first-pname), $accid-str, string($first-oct))
            
            (: Calculate intervals :)
            let $intervals :=
                for $note at $pos in $notes
                return
                    typeswitch ($note)
                    case element(mei:rest) return "-"
                    case element(mei:mRest) return "-"
                    case element(mei:note) return
                        (: Find the previous pitched note :)
                        let $prev-pitched := 
                            for $prev in subsequence($notes, 1, $pos - 1)
                            where $prev[self::mei:note] and $prev/@pname and $prev/@oct
                            return $prev
                        return
                            if (empty($prev-pitched)) then
                                (: This is the first pitched note, include in start :)
                                ()
                            else
                                let $prev := $prev-pitched[last()]
                                let $curr-midi := local:pitch-to-midi(
                                    string($note/@pname),
                                    xs:integer($note/@oct),
                                    local:get-accidental($note)
                                )
                                let $prev-midi := local:pitch-to-midi(
                                    string($prev/@pname),
                                    xs:integer($prev/@oct),
                                    local:get-accidental($prev)
                                )
                                let $interval := $curr-midi - $prev-midi
                                let $direction := 
                                    if ($interval > 0) then "U"
                                    else if ($interval < 0) then "D"
                                    else "U"  (: Same note = U0 :)
                                return concat($direction, string(abs($interval)))
                    default return ""
            
            return concat($start, " ", string-join($intervals, " "))
};

(:~
 : Convert notes to contour/direction notation.
 : u = pitch goes up
 : d = pitch goes down
 : r = pitch repeats (same as previous)
 : Rests are represented as '-'
 :
 : @param $notes Sequence of note elements
 : @return Contour notation string
 :)
declare function local:notes-to-contour($notes as element()*) as xs:string {
    let $tokens :=
        for $note at $pos in $notes
        return
            typeswitch ($note)
            case element(mei:rest) return "-"
            case element(mei:mRest) return "-"
            case element(mei:note) return
                (: Find the previous pitched note :)
                let $prev-pitched := 
                    for $prev in subsequence($notes, 1, $pos - 1)
                    where $prev[self::mei:note] and $prev/@pname and $prev/@oct
                    return $prev
                return
                    if (empty($prev-pitched)) then
                        (: First note has no contour direction - skip or use special marker :)
                        ()
                    else
                        let $prev := $prev-pitched[last()]
                        let $curr-midi := local:pitch-to-midi(
                            string($note/@pname),
                            xs:integer($note/@oct),
                            local:get-accidental($note)
                        )
                        let $prev-midi := local:pitch-to-midi(
                            string($prev/@pname),
                            xs:integer($prev/@oct),
                            local:get-accidental($prev)
                        )
                        let $diff := $curr-midi - $prev-midi
                        return
                            if ($diff > 0) then "u"
                            else if ($diff < 0) then "d"
                            else "r"
            default return ""
    
    return string-join($tokens, " ")
};

(:~
 : Create incipCode elements for the extracted melody.
 :
 : @param $notes The extracted melody notes
 : @param $mei The MEI document (for key signature extraction)
 : @return Sequence of incipCode elements
 :)
declare function local:create-incip-codes($notes as element()*, $mei as document-node()) as element()* {
    if (empty($notes)) then ()
    else
        let $keysig := local:get-key-signature($mei)
        return (
            element mei:incipCode {
                attribute type { "abc" },
                local:notes-to-abc($notes)
            },
            element mei:incipCode {
                attribute type { "solfa" },
                local:notes-to-solfa($notes, $keysig("raw"))
            },
            element mei:incipCode {
                attribute type { "interval" },
                local:notes-to-intervals($notes)
            },
            element mei:incipCode {
                attribute type { "contour" },
                local:notes-to-contour($notes)
            }
        )
};

(:~
 : Insert incipCode elements into the MEI header's work element.
 : If incipCode elements already exist with the same types, they are replaced.
 : All existing MEI content is preserved.
 :
 : @param $mei The original MEI document
 : @param $codes The incipCode elements to insert
 : @return Modified MEI document with incipCode elements
 :)
declare function local:insert-incip-codes($mei as document-node(), $codes as element()*) as document-node() {
    if (empty($codes)) then $mei
    else
        copy $result := $mei
        modify (
            let $work := $result//mei:work
            return
                if (empty($work)) then
                    (: Create work element if it doesn't exist :)
                    let $meiHead := $result//mei:meiHead
                    return
                        if (empty($meiHead)) then ()
                        else
                            insert node element mei:work { $codes } as first into $meiHead
                else
                    (: Remove existing incipCode elements with same types :)
                    let $existing := $work/mei:incipCode[@type = ("abc", "solfa", "interval", "contour")]
                    return (
                        if (exists($existing)) then delete nodes $existing else (),
                        insert nodes $codes as first into $work
                    )
        )
        return $result
};

(:~
 : Main function to process an MEI document and add incipCode elements.
 : This is the primary entry point for the module.
 :
 : @param $mei The MEI document to process
 : @return Modified MEI document with incipCode elements added
 :)
declare function local:process-mei($mei as document-node()) as document-node() {
    (: Extract melody from soprano/melody line :)
    let $notes := local:extract-melody($mei)
    
    (: Create incipCode elements :)
    let $codes := local:create-incip-codes($notes, $mei)
    
    (: Insert into document :)
    return local:insert-incip-codes($mei, $codes)
};

(:~
 : Usage example (uncomment to run):
 : let $mei := doc('/db/tunes/agawam.xml')
 : return local:process-mei($mei)
 :)

(: For testing, you can call local:process-mei() with a document :)
(: Example: local:process-mei(doc('path/to/mei-file.xml')) :)
