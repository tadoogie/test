xquery version "3.1";

declare namespace mei = "http://www.music-encoding.org/ns/mei";

(: ~
 :    Function to convert MEI duration to Plaine and Easie code
 :  @param $dur duration value (1, 2, 4, 8, 16, etc.)
 : @return Plaine and Easie duration code
 :)
declare function local:duration-to-plaine-easie($dur as xs:string) as xs:string {
    switch($dur)
        case "breve" return "0"
        case "1" return "9"
        case "2" return "2"
        case "4" return "4"
        case "8" return "8"
        case "16" return "6"
        case "32" return "3"
        default return "4"
};

(: ~
 :  Function to get clef code
 :  @param $clef-shape clef shape (G, F, C)
 : @param $clef-line clef line
 : @return Plaine and Easie clef code
 :)
declare function local:get-clef-code($clef-shape as xs:string?, $clef-line as xs:string?) as xs:string {
    if ($clef-shape = "G" and $clef-line = "2") then "G-2"
    else if ($clef-shape = "F" and $clef-line = "4") then "F-4"
    else if ($clef-shape = "C" and $clef-line = "3") then "C-3"
    else if ($clef-shape = "C" and $clef-line = "4") then "C-4"
    else "G-2" (: default :)
};

(: ~
 :  Function to get key signature code
 :  @param $key-sig key signature
 : @return Plaine and Easie key signature code
 :)
declare function local:get-key-sig-code($key-sig as xs:string?) as xs:string {
    if (not($key-sig) or $key-sig = "" or $key-sig = "0") then ""
    else if ($key-sig = "1f") then "bB"
    else if ($key-sig = "2f") then "bBE"
    else if ($key-sig = "3f") then "bBEA"
    else if ($key-sig = "4f") then "bBEAD"
    else if ($key-sig = "5f") then "bBEADG"
    else if ($key-sig = "6f") then "bBEADGC"
    else if ($key-sig = "7f") then "bBEADGCF"
    else if ($key-sig = "1s") then "xF"
    else if ($key-sig = "2s") then "xFC"
    else if ($key-sig = "3s") then "xFCG"
    else if ($key-sig = "4s") then "xFCGD"
    else if ($key-sig = "5s") then "xFCGDA"
    else if ($key-sig = "6s") then "xFCGDAE"
    else if ($key-sig = "7s") then "xFCGDAEB"
    else ""
};

(: ~
 :  Function to get time signature code
 : @param $count meter count
 :     @param $unit meter unit
 : @return Plaine and Easie time signature code
 :)
declare function local:get-time-sig-code($count as xs:string?, $unit as xs:string?) as xs:string {
    if ($count and $unit) then concat($count, "/", $unit)
    else "4/4" (:  default :)
};

(: ~
 :  Function to check if an accidental is covered by the key signature
 :  @param $pname pitch name (c, d, e, f, g, a, b)
 :  @param $accid accidental (s, f, n, or empty)
 :  @param $key-sig key signature (e.g., "1f", "2s", "")
 :  @return true if the accidental is covered by the key signature, false otherwise
 :)
declare function local:is-accidental-in-key-sig($pname as xs:string, $accid as xs:string?, $key-sig as xs:string?) as xs:boolean {
    if (not($accid) or $accid = "") then false()
    else if (not($key-sig) or $key-sig = "" or $key-sig = "0") then false()
    else
        let $pname-upper := upper-case($pname)
        return
            if ($key-sig = "1f") then ($accid = "f" and $pname-upper = "B")
            else if ($key-sig = "2f") then ($accid = "f" and ($pname-upper = "B" or $pname-upper = "E"))
            else if ($key-sig = "3f") then ($accid = "f" and ($pname-upper = "B" or $pname-upper = "E" or $pname-upper = "A"))
            else if ($key-sig = "4f") then ($accid = "f" and ($pname-upper = "B" or $pname-upper = "E" or $pname-upper = "A" or $pname-upper = "D"))
            else if ($key-sig = "5f") then ($accid = "f" and ($pname-upper = "B" or $pname-upper = "E" or $pname-upper = "A" or $pname-upper = "D" or $pname-upper = "G"))
            else if ($key-sig = "6f") then ($accid = "f" and ($pname-upper = "B" or $pname-upper = "E" or $pname-upper = "A" or $pname-upper = "D" or $pname-upper = "G" or $pname-upper = "C"))
            else if ($key-sig = "7f") then ($accid = "f" and ($pname-upper = "B" or $pname-upper = "E" or $pname-upper = "A" or $pname-upper = "D" or $pname-upper = "G" or $pname-upper = "C" or $pname-upper = "F"))
            else if ($key-sig = "1s") then ($accid = "s" and $pname-upper = "F")
            else if ($key-sig = "2s") then ($accid = "s" and ($pname-upper = "F" or $pname-upper = "C"))
            else if ($key-sig = "3s") then ($accid = "s" and ($pname-upper = "F" or $pname-upper = "C" or $pname-upper = "G"))
            else if ($key-sig = "4s") then ($accid = "s" and ($pname-upper = "F" or $pname-upper = "C" or $pname-upper = "G" or $pname-upper = "D"))
            else if ($key-sig = "5s") then ($accid = "s" and ($pname-upper = "F" or $pname-upper = "C" or $pname-upper = "G" or $pname-upper = "D" or $pname-upper = "A"))
            else if ($key-sig = "6s") then ($accid = "s" and ($pname-upper = "F" or $pname-upper = "C" or $pname-upper = "G" or $pname-upper = "D" or $pname-upper = "A" or $pname-upper = "E"))
            else if ($key-sig = "7s") then ($accid = "s" and ($pname-upper = "F" or $pname-upper = "C" or $pname-upper = "G" or $pname-upper = "D" or $pname-upper = "A" or $pname-upper = "E" or $pname-upper = "B"))
            else false()
};

(: ~
 : Function to determine barline type for a measure
 :   @param $measure MEI measure element
 :   @param $is-last whether this is the last measure
 :  @return Plaine and Easie barline code
 :)
declare function local:get-measure-barline($measure as element()?, $is-last as xs:boolean) as xs:string {
    if (not($measure)) then "/"
    else
        let $right := string($measure/@right)
        let $left := string($measure/@left)
        return
            (:  Check for repeat barlines :)
            if ($right = "rptend" and $left = "rptstart") then "://:"
            else if ($right = "rptboth") then "://:"
            else if ($right = "rptend") then "://"
            else if ($left = "rptstart") then "//:"
            else if ($right = "dbl") then "//"
            else if ($right = "end" and $is-last) then "//"
            else "/"
};

(: ~
 :  Function to process notes in a measure
 :  @param $notes sequence of note elements
 :  @param $first-note-in-piece whether the first note is the first in the entire piece
 :  @param $key-sig key signature (e.g., "1f", "2s", "")
 : @return sequence of PAE note codes
 :)
declare function local:process-notes($notes as element()*, $first-note-in-piece as xs:boolean, $key-sig as xs:string?) as xs:string* {
    for $note at $pos in $notes
    let $dur := local:duration-to-plaine-easie(string($note/@dur))
    let $dots := if ($note/@dots) then string($note/@dots) else ""
    let $dot-string := string-join(for $i in 1 to xs:integer(if ($dots != "") then $dots else 0) return ".", "")
    let $pname := string($note/@pname)
    let $oct := string($note/@oct)
    let $accid := if ($note/@accid) then string($note/@accid) 
                  else if ($note/@accid.ges) then string($note/@accid.ges)
                  else if ($note/mei:accid/@accid) then string($note/mei:accid/@accid)
                  else ()
    
    (:   Determine octave marker for Verovio system :)
    let $octave-char := 
        switch($oct)
            case "1" return ",,,"
            case "2" return ",,"
            case "3" return ","
            case "4" return if ($pos = 1 and $first-note-in-piece) then "" else "'"
            case "5" return "''"
            case "6" return "'''"
            case "7" return "''''"
            default return ""
    
    (: Determine if we need to include duration :)
    let $is-first := ($pos = 1 and $first-note-in-piece)
    let $prev-note := if ($pos > 1) then $notes[$pos - 1] else ()
    let $prev-dur := if ($prev-note) then local:duration-to-plaine-easie(string($prev-note/@dur)) else ""
    let $prev-dots := if ($prev-note/@dots) then string($prev-note/@dots) else ""
    
    (:  Only include duration if it changes from previous note :)
    let $dur-and-dots := if ($is-first or $dur != $prev-dur or $dots != $prev-dots) then 
                            concat($dur, $dot-string)
                         else ""
    
    let $pitch-upper := upper-case($pname)
    
    (: Only include accidental if it's NOT covered by the key signature :)
    let $accid-char := 
        if ($accid and not(local:is-accidental-in-key-sig($pname, $accid, $key-sig))) then
            if ($accid = "s") then "x"
            else if ($accid = "f") then "b"
            else if ($accid = "n") then "n"
            else ""
        else ""
    
    (:  Order: octave + duration+dots + accidental + pitch :)
    return concat($octave-char, $dur-and-dots, $accid-char, $pitch-upper)
};

(: ~
 :  Function to extract melody from staff 1, layer 1 and convert to Plaine and Easie
 :  @param $doc MEI document
 :  @return Plaine and Easie code string
 :)
declare function local:extract-melody($doc as node()) as xs:string {
    (:    Get clef, key signature, and time signature from first staff :)
    let $staff-def := $doc//mei:staffDef[@n="1"][1]
    let $clef := $staff-def/mei:clef[1]
    let $clef-code := local:get-clef-code(string($clef/@shape), string($clef/@line))
    let $key-sig := string($staff-def/mei:keySig[1]/@sig)
    let $key-sig-code := local:get-key-sig-code($key-sig)
    let $meter-sig := $staff-def/mei:meterSig[1]
    let $time-sig-code := local:get-time-sig-code(string($meter-sig/@count), string($meter-sig/@unit))
    
    (: Get all measures :)
    let $measures := $doc//mei:measure
    let $total-measures := count($measures)
    
    (: Process each measure :)
    let $melody-parts := 
        for $measure at $measure-pos in $measures
        let $is-first-measure := ($measure-pos = 1)
        let $is-last-measure := ($measure-pos = $total-measures)
        
        (: Get notes from staff 1, layer 1 in this measure :)
        let $notes := $measure//mei:staff[@n="1"]//mei:layer[@n="1"]//mei:note
        
        (: Process notes with key signature :)
        let $note-codes := local:process-notes($notes, $is-first-measure, $key-sig)
        
        (:  Get barline (except after the last measure) :)
        let $barline := if (not($is-last-measure)) then 
                           local:get-measure-barline($measure, $is-last-measure)
                        else ()
        
        return (string-join($note-codes, ""), $barline)
    
    (: Join all parts :)
    let $melody-string := string-join($melody-parts, "")
    
    (: Construct full Plaine and Easie code with % $ @ format :)
    return concat("%", $clef-code, " $", $key-sig-code, " @", $time-sig-code, " ", $melody-string)
};

(: ~
 :  Function to convert pitch name and accidental to MIDI note number
 :  @param $pname pitch name (c, d, e, f, g, a, b)
 :  @param $oct octave
 :  @param $accid accidental (s, f, n, or empty)
 :  @return MIDI note number
 :)
declare function local:pitch-to-midi($pname as xs:string, $oct as xs:string, $accid as xs:string?) as xs:integer {
    let $base-pitch := 
        switch(lower-case($pname))
            case "c" return 0
            case "d" return 2
            case "e" return 4
            case "f" return 5
            case "g" return 7
            case "a" return 9
            case "b" return 11
            default return 0
    let $accid-offset : =
        if ($accid = "s") then 1
        else if ($accid = "f") then -1
        else 0
    return (xs:integer($oct) * 12) + $base-pitch + $accid-offset
};

(:  ~
 :  Function to get pitch class (0-11, C=0)
 :  @param $midi MIDI note number
 :  @return pitch class
 :)
declare function local:midi-to-pitch-class($midi as xs:integer) as xs:integer {
    $midi mod 12
};

(: ~
 :  Function to extract all notes from staff 1, layer 1
 :  @param $doc MEI document
 :  @return sequence of note elements
 :)
declare function local:get-all-notes($doc as node()) as element()* {
    $doc//mei:measure//mei:staff[@n="1"]//mei:layer[@n="1"]//mei:note
};

(: ~
 :  Function to generate pitch class sequence
 :  @param $doc MEI document
 :  @return pitch class string (space-delimited)
 :)
declare function local:generate-pitch-class($doc as node()) as xs:string {
    let $notes := local:get-all-notes($doc)
    let $pitch-classes : =
        for $note in $notes
        let $pname := string($note/@pname)
        let $oct := string($note/@oct)
        let $accid := if ($note/@accid) then string($note/@accid) 
                      else if ($note/@accid.ges) then string($note/@accid.ges)
                      else if ($note/mei:accid/@accid) then string($note/mei:accid/@accid)
                      else ()
        let $midi := local:pitch-to-midi($pname, $oct, $accid)
        let $pc := local:midi-to-pitch-class($midi)
        return string($pc)
    return string-join($pitch-classes, " ")
};

(: ~
 :   Function to generate signed interval sequence
 :  @param $doc MEI document
 :  @return signed interval string (space-delimited)
 :)
declare function local:generate-signed-interval($doc as node()) as xs:string {
    let $notes := local:get-all-notes($doc)
    let $intervals :=
        for $note at $pos in $notes
        return
            if ($pos = 1) then ()
            else
                let $prev-note := $notes[$pos - 1]
                let $pname := string($note/@pname)
                let $oct := string($note/@oct)
                let $accid := if ($note/@accid) then string($note/@accid) 
                              else if ($note/@accid.ges) then string($note/@accid.ges)
                              else if ($note/mei:accid/@accid) then string($note/mei:accid/@accid)
                              else ()
                let $prev-pname := string($prev-note/@pname)
                let $prev-oct := string($prev-note/@oct)
                let $prev-accid := if ($prev-note/@accid) then string($prev-note/@accid) 
                                   else if ($prev-note/@accid.ges) then string($prev-note/@accid.ges)
                                   else if ($prev-note/mei:accid/@accid) then string($prev-note/mei:accid/@accid)
                                   else ()
                let $curr-midi := local:pitch-to-midi($pname, $oct, $accid)
                let $prev-midi := local:pitch-to-midi($prev-pname, $prev-oct, $prev-accid)
                let $interval := $curr-midi - $prev-midi
                return 
                    if ($interval >= 0) then concat("+", string($interval))
                    else string($interval)
    return string-join($intervals, " ")
};

(: ~
 :  Function to generate contour sequence
 :  @param $doc MEI document
 :   @return contour string (space-delimited, using + - =)
 :)
declare function local:generate-contour($doc as node()) as xs:string {
    let $notes := local:get-all-notes($doc)
    let $contours :=
        for $note at $pos in $notes
        return
            if ($pos = 1) then ()
            else
                let $prev-note := $notes[$pos - 1]
                let $pname := string($note/@pname)
                let $oct := string($note/@oct)
                let $accid := if ($note/@accid) then string($note/@accid) 
                              else if ($note/@accid.ges) then string($note/@accid.ges)
                              else if ($note/mei:accid/@accid) then string($note/mei:accid/@accid)
                              else ()
                let $prev-pname := string($prev-note/@pname)
                let $prev-oct := string($prev-note/@oct)
                let $prev-accid := if ($prev-note/@accid) then string($prev-note/@accid) 
                                   else if ($prev-note/@accid.ges) then string($prev-note/@accid.ges)
                                   else if ($prev-note/mei:accid/@accid) then string($prev-note/mei:accid/@accid)
                                   else ()
                let $curr-midi := local:pitch-to-midi($pname, $oct, $accid)
                let $prev-midi := local:pitch-to-midi($prev-pname, $prev-oct, $prev-accid)
                let $interval := $curr-midi - $prev-midi
                return 
                    if ($interval > 0) then "+"
                    else if ($interval < 0) then "-"
                    else "="
    return string-join($contours, " ")
};

(: ~
 :  Main processing:  Update/add incipCode elements to each MEI document
 :  - Always regenerates plaineAndEasie to apply corrected accidental logic
 :  - Generates missing pitchclass, signedinterval, and contour codes
 :)
for $doc in collection("/db/tunes/5.5.5.5/")//mei:mei
let $uri := document-uri(root($doc))

(: Find the work element containing incipCodes :)
let $work := $doc//mei:workList/mei:work[mei:incip]
let $incip := $work/mei:incip

(: Check which incipCodes are missing :)
let $has-pae := exists($incip/mei:incipCode[@form="plaineAndEasie"])
let $has-pc := exists($incip/mei:incipCode[@form="pitchclass"])
let $has-si := exists($incip/mei:incipCode[@form="signedinterval"])
let $has-contour := exists($incip/mei:incipCode[@form="contour"])

(: Process all files to ensure plaineAndEasie uses corrected accidental logic :)
(: Note: plaineAndEasie will always be regenerated, others only if missing :)
where $incip

return
    let $existing-incipCodes := $incip/mei:incipCode
    
    (: Always regenerate plaineAndEasie to apply corrected accidental logic :)
    let $pae-incipit := 
        let $melody := local:extract-melody($doc)
        return <incipCode xmlns="http://www.music-encoding.org/ns/mei" form="plaineAndEasie">{$melody}</incipCode>
    
    let $pc-incipit : =
        if (not($has-pc)) then
            let $pc-data := local:generate-pitch-class($doc)
            return <incipCode xmlns="http://www.music-encoding.org/ns/mei" form="pitchclass">{$pc-data}</incipCode>
        else
            $incip/mei:incipCode[@form="pitchclass"]
    
    let $si-incipit :=
        if (not($has-si)) then
            let $si-data := local:generate-signed-interval($doc)
            return <incipCode xmlns="http://www.music-encoding.org/ns/mei" form="signedinterval">{$si-data}</incipCode>
        else
            $incip/mei:incipCode[@form="signedinterval"]
    
    let $contour-incipit : =
        if (not($has-contour)) then
            let $contour-data := local:generate-contour($doc)
            return <incipCode xmlns="http://www.music-encoding.org/ns/mei" form="contour">{$contour-data}</incipCode>
        else
            $incip/mei:incipCode[@form="contour"]
    
    (:  Reconstruct incip element with all incipCodes :)
    let $new-incip := 
        <incip xmlns="http://www.music-encoding.org/ns/mei">
            {$pae-incipit}
            {$pc-incipit}
            {$si-incipit}
            {$contour-incipit}
        </incip>
    
    return
        update replace $incip with $new-incip
