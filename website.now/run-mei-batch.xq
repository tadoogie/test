xquery version "3.1";

(:
    Digital Splitleaf — batch MEI generator.

    Takes an uploaded zip of MEI files (folders and subfolders allowed) and runs the
    same DS-ready transformation as run-mei-generator.xq on every MEI file in it. The
    work title and metre are read from each file's <anchoredText func="title"> heading
    rather than typed in, and the <anchoredText func="composer"> credit is kept.

    Everything happens in memory: nothing is written to the server or the database.
    The result page lists every file and offers the converted files as a zip whose
    folder mirrors the upload, plus a CSV report.

    Posted to by batch-mei.html.
:)

import module namespace util = "http://exist-db.org/xquery/util";
import module namespace compression = "http://exist-db.org/xquery/compression";

declare namespace mei = "http://www.music-encoding.org/ns/mei";
declare namespace output = "http://www.w3.org/2010/xslt-xquery-serialization";

declare option output:method "html5";
declare option output:media-type "text/html";


(: ========================================================================
   Settings
   ======================================================================== :)

(: Appended to each input file's base name: Tune.mei -> Tune-ds.xml :)
declare variable $output-suffix := "-ds.xml";

(: Only files with these extensions are opened; everything else is listed as ignored. :)
declare variable $input-extensions := ("mei", "xml");

(: Folders that are skipped (macOS zip debris). Dot-folders and dot-files are always skipped. :)
declare variable $skip-folders := ("__MACOSX");

(: Defaults for editionStmt when the form fields are left blank.
   A blank short title repeats the main title. :)
declare variable $default-edition-title := "The Psalter in Metre and Scripture Paraphrases";
declare variable $default-edition-date := "1900";

(: When a tune name is set in capitals ("LES COMMANDEMENS DE DIEU") it is
   title-cased; these words stay lower-case unless they come first. :)
declare variable $title-minor-words := (
    "a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to",
    "de", "des", "du", "la", "le", "der", "von"
);


(: ========================================================================
   Input decoding (unchanged from run-mei-generator.xq)
   ======================================================================== :)

(: Files do not always arrive as UTF-8. sibmei writes UTF-16 with a BOM, which the
   single-argument util:binary-to-string() decodes as UTF-8 and mangles, so parse-xml()
   then fails and the file looks like it is not XML at all. :)
declare variable $input-encodings := ("UTF-8", "UTF-16LE", "UTF-16BE", "UTF-16", "ISO-8859-1");

declare function local:strip-bom($s as xs:string) as xs:string {
    if (starts-with($s, codepoints-to-string(65279)))
    then substring($s, 2)
    else $s
};

(: parse-xml() consumes characters, not bytes, so a declared byte encoding is redundant
   here and some parsers reject it outright ("labelled UTF-16 but has UTF-8 content").
   Drop just the encoding pseudo-attribute and leave the rest of the declaration alone. :)
declare function local:drop-encoding-decl($s as xs:string) as xs:string {
    replace(
        $s,
        '^(<\?xml\s[^?]*?)\s+encoding\s*=\s*("[^"]*"|''[^'']*'')',
        '$1'
    )
};

declare function local:string-to-xml($s as xs:string?) as document-node()? {
    let $clean :=
        if (empty($s)) then ""
        else local:drop-encoding-decl(replace(local:strip-bom($s), "^\s+", ""))
    return
        if ($clean = "") then ()
        else
            try {
                parse-xml($clean)
            } catch * {
                ()
            }
};

(: Decode with each candidate encoding and keep the first that yields a parseable
   document. Returns map { "doc": document-node()?, "encoding": xs:string }. :)
declare function local:binary-to-xml-doc($bin as xs:base64Binary?) as map(*) {
    if (empty($bin)) then
        map { "doc": (), "encoding": "" }
    else
        let $hit :=
            (
                for $enc in $input-encodings
                let $s := try { util:binary-to-string($bin, $enc) } catch * { () }
                let $doc := local:string-to-xml($s)
                where exists($doc/*)
                return map { "doc": $doc, "encoding": $enc }
            )[1]
        return ($hit, map { "doc": (), "encoding": "" })[1]
};

declare function local:root-local-name($doc as document-node()?) as xs:string {
    if (empty($doc) or empty($doc/*)) then "" else local-name($doc/*[1])
};

declare function local:file-base-name($name as xs:string) as xs:string {
    replace($name, "\.[^.]+$", "")
};

declare function local:file-ext($name as xs:string?) as xs:string {
    let $n := lower-case(normalize-space($name))
    return if (contains($n, ".")) then replace($n, "^.*\.([^.]+)$", "$1") else ""
};


(: ========================================================================
   Title and metre from <anchoredText func="title">
   ======================================================================== :)

(: Text of a heading, with <lb/> read as a space. :)
declare function local:heading-text($nodes as node()*) as xs:string {
    normalize-space(string-join(
        for $n in $nodes/descendant-or-self::node()[self::text() or self::mei:lb]
        return if ($n instance of element()) then " " else string($n),
        ""
    ))
};

(: "EARNEST PRAYER" -> "Earnest Prayer", "LES COMMANDEMENS DE DIEU" -> "Les Commandemens de Dieu".
   A name that already contains lower-case letters is left exactly as written. :)
declare function local:title-case($raw as xs:string?) as xs:string {
    let $s := normalize-space($raw)
    return
        if ($s = "" or matches($s, "\p{Ll}")) then $s
        else
            string-join(
                for $word at $w in tokenize($s, " ")
                let $bare := replace(lower-case($word), "[^\p{L}]", "")
                return
                    if ($w > 1 and $bare = $title-minor-words) then lower-case($word)
                    else
                        (: capitalise the first letter, and any letter after - ( / [ or an opening quote :)
                        string-join(
                            for $i in 1 to string-length($word)
                            let $c := substring($word, $i, 1)
                            let $prev := if ($i = 1) then "" else substring($word, $i - 1, 1)
                            return
                                if ($i = 1 or $prev = ("-", "(", "/", "[", '"', "“", "‘"))
                                then upper-case($c)
                                else lower-case($c),
                            ""
                        ),
                " "
            )
};

(: "8 8 8 8 8 8" -> "8.8.8.8.8.8.", "8 6 8 6 D" -> "8.6.8.6. D.",
   "8 8 8 8 D anapaestic" -> "8.8.8.8. D. anapaestic".
   A metre with no numbers at all ("C.M.", "Irregular") is kept as written. :)
declare function local:format-metre($raw as xs:string?) as xs:string {
    let $s := normalize-space($raw)
    return
        if ($s = "") then ""
        else if (not(matches($s, "\d"))) then $s
        else
            let $tokens := tokenize(normalize-space(replace($s, "(\d)[.,]", "$1 ")), " ")
            let $numbers := $tokens[matches(., "^\d+$")]
            let $words :=
                for $t in $tokens[not(matches(., "^\d+$"))]
                return if (matches($t, "^\p{L}$")) then concat($t, ".") else $t
            return normalize-space(concat(string-join($numbers, "."), ". ", string-join($words, " ")))
};

(: Reads the tune heading. The name is the bold <rend>; the metre is whatever else the
   heading holds. If there is no bold <rend>, the trailing run of numbers is taken as
   the metre. Returns map { "found", "count", "title", "metre", "title-raw", "metre-raw" }. :)
declare function local:extract-heading($doc as document-node()) as map(*) {
    let $headings := $doc//mei:anchoredText[@func = "title"]
    let $at := $headings[1]
    return
        if (empty($at)) then
            map { "found": false(), "count": 0, "title": "", "metre": "", "title-raw": "", "metre-raw": "" }
        else
            let $bold := $at//mei:rend[@fontweight = "bold"]
            let $full := local:heading-text($at)
            let $split :=
                if (exists($bold)) then
                    map {
                        "title": string-join(for $b in $bold return local:heading-text($b), " "),
                        "metre": normalize-space(string-join(
                            for $n in $at//node()[self::text() or self::mei:lb]
                                             [not(ancestor::mei:rend[@fontweight = "bold"])]
                            return if ($n instance of element()) then " " else string($n),
                            ""
                        ))
                    }
                else
                    (: plain capturing groups only; name is $1, metre is $2 :)
                    let $re := "^(.+?)\s+(\d{1,2}(([.,]\s*|\s+)\d{1,2})*[.,]?(\s+\S+)*)$"
                    return
                        if (matches($full, $re)) then
                            map { "title": replace($full, $re, "$1"), "metre": replace($full, $re, "$2") }
                        else
                            map { "title": $full, "metre": "" }
            return
                map {
                    "found": true(),
                    "count": count($headings),
                    "title": local:title-case($split?title),
                    "metre": local:format-metre($split?metre),
                    "title-raw": string($split?title),
                    "metre-raw": string($split?metre)
                }
};


(: ========================================================================
   Incipits (unchanged from run-mei-generator.xq)
   ======================================================================== :)

declare function local:get-note-accid($note as element(mei:note)) as xs:string? {
    let $v := string((
        $note/@accid,
        $note/@accid.ges,
        $note/mei:accid[1]/@accid,
        $note/mei:accid[1]/@accid.ges
    )[1])
    return if (normalize-space($v) = "") then () else $v
};

declare function local:pitch-to-midi($pname as xs:string, $oct as xs:string, $accid as xs:string?) as xs:integer {
    let $base :=
        switch(lower-case($pname))
            case "c" return 0
            case "d" return 2
            case "e" return 4
            case "f" return 5
            case "g" return 7
            case "a" return 9
            case "b" return 11
            default return 0
    let $offset :=
        if ($accid = ("s", "ss", "x")) then (if ($accid = "ss" or $accid = "x") then 2 else 1)
        else if ($accid = ("f", "ff")) then (if ($accid = "ff") then -2 else -1)
        else 0
    return ((xs:integer($oct) + 1) * 12) + $base + $offset
};

declare function local:pitch-to-class($pname as xs:string, $accid as xs:string?) as xs:integer {
    local:pitch-to-midi($pname, "4", $accid) mod 12
};

declare function local:get-melody-notes($doc as document-node()) as element(mei:note)* {
    $doc//mei:measure/mei:staff[@n="1"]/mei:layer[@n="1"]//mei:note[@pname][@oct]
};

declare function local:generate-pitchclass($doc as document-node()) as xs:string {
    let $classes :=
        for $n in local:get-melody-notes($doc)
        return local:pitch-to-class(string($n/@pname), local:get-note-accid($n))
    return string-join(for $c in $classes return string($c), " ")
};

declare function local:generate-signedinterval($doc as document-node()) as xs:string {
    let $midi :=
        for $n in local:get-melody-notes($doc)
        return local:pitch-to-midi(string($n/@pname), string($n/@oct), local:get-note-accid($n))
    let $intervals :=
        for $i in 2 to count($midi)
        return $midi[$i] - $midi[$i - 1]
    return
        string-join(
            for $i in $intervals
            return
                if ($i ge 0) then concat("+", string($i))
                else string($i),
            " "
        )
};

declare function local:generate-contour($doc as document-node()) as xs:string {
    let $midi :=
        for $n in local:get-melody-notes($doc)
        return local:pitch-to-midi(string($n/@pname), string($n/@oct), local:get-note-accid($n))
    let $contour :=
        for $i in 2 to count($midi)
        let $d := $midi[$i] - $midi[$i - 1]
        return
            if ($d > 0) then "+"
            else if ($d < 0) then "-"
            else "="
    return string-join($contour, " ")
};

declare function local:duration-to-pae($dur as xs:string) as xs:string {
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

declare function local:get-clef-code($shape as xs:string?, $line as xs:string?) as xs:string {
    if ($shape = "G" and $line = "2") then "G-2"
    else if ($shape = "F" and $line = "4") then "F-4"
    else if ($shape = "C" and $line = "3") then "C-3"
    else if ($shape = "C" and $line = "4") then "C-4"
    else "G-2"
};

declare function local:get-key-sig-code($sig as xs:string?) as xs:string {
    if (not($sig) or $sig = "" or $sig = "0") then ""
    else if ($sig = "1f") then "bB"
    else if ($sig = "2f") then "bBE"
    else if ($sig = "3f") then "bBEA"
    else if ($sig = "4f") then "bBEAD"
    else if ($sig = "5f") then "bBEADG"
    else if ($sig = "6f") then "bBEADGC"
    else if ($sig = "7f") then "bBEADGCF"
    else if ($sig = "1s") then "xF"
    else if ($sig = "2s") then "xFC"
    else if ($sig = "3s") then "xFCG"
    else if ($sig = "4s") then "xFCGD"
    else if ($sig = "5s") then "xFCGDA"
    else if ($sig = "6s") then "xFCGDAE"
    else if ($sig = "7s") then "xFCGDAEB"
    else ""
};

declare function local:is-accidental-in-key-sig($pname as xs:string, $accid as xs:string?, $key-sig as xs:string?) as xs:boolean {
    if (not($accid) or $accid = "" or not($key-sig) or $key-sig = "" or $key-sig = "0") then false()
    else
        let $p := upper-case($pname)
        return
            if ($key-sig = "1f") then ($accid = "f" and $p = "B")
            else if ($key-sig = "2f") then ($accid = "f" and $p = ("B", "E"))
            else if ($key-sig = "3f") then ($accid = "f" and $p = ("B", "E", "A"))
            else if ($key-sig = "4f") then ($accid = "f" and $p = ("B", "E", "A", "D"))
            else if ($key-sig = "5f") then ($accid = "f" and $p = ("B", "E", "A", "D", "G"))
            else if ($key-sig = "6f") then ($accid = "f" and $p = ("B", "E", "A", "D", "G", "C"))
            else if ($key-sig = "7f") then ($accid = "f" and $p = ("B", "E", "A", "D", "G", "C", "F"))
            else if ($key-sig = "1s") then ($accid = "s" and $p = "F")
            else if ($key-sig = "2s") then ($accid = "s" and $p = ("F", "C"))
            else if ($key-sig = "3s") then ($accid = "s" and $p = ("F", "C", "G"))
            else if ($key-sig = "4s") then ($accid = "s" and $p = ("F", "C", "G", "D"))
            else if ($key-sig = "5s") then ($accid = "s" and $p = ("F", "C", "G", "D", "A"))
            else if ($key-sig = "6s") then ($accid = "s" and $p = ("F", "C", "G", "D", "A", "E"))
            else if ($key-sig = "7s") then ($accid = "s" and $p = ("F", "C", "G", "D", "A", "E", "B"))
            else false()
};

declare function local:get-staffdef1($doc as document-node()) as element(mei:staffDef)? {
    ($doc//mei:staffDef[@n = "1"])[1]
};

declare function local:get-clef-shape($staff-def as element(mei:staffDef)?) as xs:string? {
    string((($staff-def/@clef.shape, $staff-def/mei:clef[1]/@shape))[1])
};

declare function local:get-clef-line($staff-def as element(mei:staffDef)?) as xs:string? {
    string((($staff-def/@clef.line, $staff-def/mei:clef[1]/@line))[1])
};

declare function local:get-key-sig($staff-def as element(mei:staffDef)?) as xs:string? {
    string((($staff-def/@keysig, $staff-def/@key.sig, $staff-def/mei:keySig[1]/@sig))[1])
};

declare function local:get-meter-count($staff-def as element(mei:staffDef)?) as xs:string? {
    string((($staff-def/@meter.count, $staff-def/mei:meterSig[1]/@count))[1])
};

declare function local:get-meter-unit($staff-def as element(mei:staffDef)?) as xs:string? {
    string((($staff-def/@meter.unit, $staff-def/mei:meterSig[1]/@unit))[1])
};

declare function local:get-time-sig-code($count as xs:string?, $unit as xs:string?) as xs:string {
    if ($count != "" and $unit != "") then concat($count, "/", $unit) else "4/4"
};

declare function local:get-measure-barline($measure as element(mei:measure)?, $is-last as xs:boolean) as xs:string {
    if (not($measure)) then "/"
    else
        let $right := string($measure/@right)
        let $left := string($measure/@left)
        return
            if ($right = "rptend" and $left = "rptstart") then "://:"
            else if ($right = "rptboth") then "://:"
            else if ($right = "rptend") then "://"
            else if ($left = "rptstart") then "//:"
            else if ($right = "dbl") then "//"
            else if ($right = "end" and $is-last) then "//"
            else "/"
};

declare function local:process-measure-notes($notes as element(mei:note)*, $is-first-measure as xs:boolean, $key-sig as xs:string?) as xs:string* {
    for $note at $pos in $notes
    let $dur := local:duration-to-pae(string($note/@dur))
    let $dots := if ($note/@dots) then xs:integer($note/@dots) else 0
    let $dot-string := string-join(for $i in 1 to $dots return ".", "")
    let $pname := string($note/@pname)
    let $oct := string($note/@oct)
    let $accid := local:get-note-accid($note)

    let $octave-char :=
        switch($oct)
            case "1" return ",,,"
            case "2" return ",,"
            case "3" return ","
            case "4" return if ($pos = 1 and $is-first-measure) then "" else "'"
            case "5" return "''"
            case "6" return "'''"
            case "7" return "''''"
            default return ""

    let $is-first := ($pos = 1 and $is-first-measure)
    let $prev-note := if ($pos > 1) then $notes[$pos - 1] else ()
    let $prev-dur := if ($prev-note) then local:duration-to-pae(string($prev-note/@dur)) else ""
    let $prev-dots := if ($prev-note/@dots) then string($prev-note/@dots) else "0"
    let $curr-dots := string($dots)
    let $dur-part := if ($is-first or $dur != $prev-dur or $curr-dots != $prev-dots) then concat($dur, $dot-string) else ""

    let $accid-char :=
        if ($accid and not(local:is-accidental-in-key-sig($pname, $accid, $key-sig))) then
            if ($accid = "s") then "x"
            else if ($accid = "f") then "b"
            else if ($accid = "n") then "n"
            else ""
        else ""

    return concat($octave-char, $dur-part, $accid-char, upper-case($pname))
};

declare function local:extract-plaine-easie($doc as document-node()) as xs:string {
    let $staff-def := local:get-staffdef1($doc)
    let $clef-code := local:get-clef-code(local:get-clef-shape($staff-def), local:get-clef-line($staff-def))
    let $key-sig := local:get-key-sig($staff-def)
    let $key-code := local:get-key-sig-code($key-sig)
    let $time-code := local:get-time-sig-code(local:get-meter-count($staff-def), local:get-meter-unit($staff-def))

    let $measures := $doc//mei:measure
    let $measure-count := count($measures)

    let $parts :=
        for $m at $i in $measures
        let $is-first := ($i = 1)
        let $is-last := ($i = $measure-count)
        let $notes := $m/mei:staff[@n = "1"]/mei:layer[@n = "1"]//mei:note[@pname][@oct]
        let $note-codes := local:process-measure-notes($notes, $is-first, $key-sig)
        let $bar := if (not($is-last)) then local:get-measure-barline($m, $is-last) else ()
        return (string-join($note-codes, ""), $bar)

    return concat("%", $clef-code, " $", $key-code, " @", $time-code, " ", string-join($parts, ""))
};


(: ========================================================================
   Rewrite (as run-mei-generator.xq, plus the anchoredText rule)
   ======================================================================== :)

declare function local:satb-for-staff($n as xs:string?) as element()* {
    if ($n = "1") then (
        <layerDef xmlns="http://www.music-encoding.org/ns/mei" n="1" xml:id="layerDef1" label="Soprano" instr="#soprano"/>,
        <layerDef xmlns="http://www.music-encoding.org/ns/mei" n="2" xml:id="layerDef2" label="Alto" instr="#alto"/>,
        <instrDef xmlns="http://www.music-encoding.org/ns/mei" xml:id="soprano"/>,
        <instrDef xmlns="http://www.music-encoding.org/ns/mei" xml:id="alto"/>
    )
    else if ($n = "2") then (
        <layerDef xmlns="http://www.music-encoding.org/ns/mei" n="1" xml:id="layerDef3" label="Tenor" instr="#tenor"/>,
        <layerDef xmlns="http://www.music-encoding.org/ns/mei" n="2" xml:id="layerDef4" label="Bass" instr="#bass"/>,
        <instrDef xmlns="http://www.music-encoding.org/ns/mei" xml:id="tenor"/>,
        <instrDef xmlns="http://www.music-encoding.org/ns/mei" xml:id="bass"/>
    )
    else ()
};

declare function local:copy-rewritten($node as element()) as element() {
    element {node-name($node)} {
        $node/@*,
        for $child in $node/node()
        return local:rewrite-node($child)
    }
};

declare function local:rewrite-node($node as node()) as node()* {
    typeswitch($node)
        case document-node() return
            document {
                for $child in $node/node()
                return local:rewrite-node($child)
            }

        case element(mei:staffDef) return
            element {node-name($node)} {
                $node/@*,
                for $child in $node/node()
                return
                    if ($child instance of element(mei:layerDef) or $child instance of element(mei:instrDef)) then ()
                    else local:rewrite-node($child),
                local:satb-for-staff(string($node/@n))
            }

        case element(mei:layerDef) return ()
        case element(mei:instrDef) return ()

        (: Headings: the title heading has moved into workList/work, so it (and any other
           anchoredText) is dropped; the composer credit stays where it was. :)
        case element(mei:anchoredText) return
            if ($node/@func = "composer") then local:copy-rewritten($node) else ()

        (: The page header is still dropped, unless it is where the composer credit lives,
           in which case it is kept holding only that credit. :)
        case element(mei:pgHead) return
            let $composer := $node//mei:anchoredText[@func = "composer"]
            return
                if (empty($composer)) then ()
                else
                    element {node-name($node)} {
                        $node/@*,
                        for $c in $composer return local:copy-rewritten($c)
                    }

        case element(mei:staffGrp) return
            let $is-first-staffgrp := empty($node/preceding::mei:staffGrp)
            let $attrs :=
                if ($is-first-staffgrp) then (
                    $node/@*[local-name(.) != "symbol" and local-name(.) != "bar.thru"],
                    attribute symbol {"bracket"}
                )
                else $node/@*
            return
            element {node-name($node)} {
                $attrs,
                for $child in $node/node()
                return
                    if ($child instance of text() and normalize-space(string($child)) = "") then ()
                    else local:rewrite-node($child)
            }
        case element(mei:grpSym) return
            element {node-name($node)} {
                $node/@*[local-name(.) != "symbol"],
                attribute symbol {"none"},
                for $child in $node/node()
                return local:rewrite-node($child)
            }
        case element(mei:label) return
            if ($node/parent::mei:staffGrp) then ()
            else local:copy-rewritten($node)
        case element(mei:labelAbbr) return
            if ($node/parent::mei:staffGrp) then ()
            else local:copy-rewritten($node)

        case element(mei:syl) return
            element {node-name($node)} {
                $node/@xml:id
            }

        case element(mei:note) return
            let $id := normalize-space(string($node/@xml:id))
            let $current-class := normalize-space(string($node/@class))
            let $class :=
                if ($id != "") then concat("#", $id)
                else if ($current-class != "") then (if (starts-with($current-class, "#")) then $current-class else concat("#", $current-class))
                else concat("#note-", string(count($node/preceding::mei:note) + 1))
            return
                element {node-name($node)} {
                    $node/@*[local-name(.) != "class"],
                    attribute class {$class},
                    for $child in $node/node()
                    return local:rewrite-node($child)
                }

        case element() return local:copy-rewritten($node)

        default return $node
};


(: ========================================================================
   meiHead (as run-mei-generator.xq; edition titles and date now come from the form)
   ======================================================================== :)

declare function local:build-worklist($m as map(*)) as element(mei:workList) {
    <workList xmlns="http://www.music-encoding.org/ns/mei">
        <work>
            <title>{$m?title}</title>
            <otherChar>{$m?metre}</otherChar>
            <incip>
                <incipCode form="plaineAndEasie">{$m?pae}</incipCode>
                <incipCode form="pitchclass">{$m?pc}</incipCode>
                <incipCode form="signedinterval">{$m?si}</incipCode>
                <incipCode form="contour">{$m?contour}</incipCode>
            </incip>
        </work>
    </workList>
};

declare function local:build-mei-head($m as map(*)) as element(mei:meiHead) {
    <meiHead xmlns="http://www.music-encoding.org/ns/mei">
        <fileDesc>
            <titleStmt>
                <title>{$m?title}</title>
                <respStmt>
                    <resp>Composer</resp>
                    <persName role="composer">COMPOSER_NAME</persName>
                </respStmt>
                <respStmt>
                    <resp>General editor</resp>
                    <persName role="editor">Timothy Duguid</persName>
                </respStmt>
            </titleStmt>
            <editionStmt>
                <edition>
                    <title type="main">{$m?edition-title}</title>
                    <title type="short">{$m?edition-short}</title>
                    <date>{$m?edition-date}</date>
                </edition>
            </editionStmt>
            <pubStmt>
                <publisher>Digital Splitleaf</publisher>
                <respStmt>
                    <resp>Archive Creator</resp>
                    <persName>Timothy Duguid</persName>
                </respStmt>
                <availability>
                    <useRestrict auth.uri="https://creativecommons.org/licenses/by-nc/4.0/" auth="Creative Commons">Distributed under a Creative Commons Attribution-NonCommercial 4.0 License</useRestrict>
                </availability>
                <identifier>[ASSIGNED_BY_ADMIN]</identifier>
            </pubStmt>
        </fileDesc>
        <encodingDesc xml:id="encodingdesc-0000000589051729">
            <appInfo xml:id="appinfo-0000001649237046">
                <application xml:id="application-0000001295686782" isodate="2020-01-14T15:48:44" version="2.4.0-dev-274b767-dirty">
                    <name xml:id="name-0000001908634302">Verovio</name>
                    <p xml:id="p-0000001793328337">Transcoded from MusicXML</p>
                </application>
                <application xml:id="{concat('application-', util:uuid())}" isodate="{string(current-dateTime())}" version="1.0">
                    <name xml:id="{concat('name-', util:uuid())}">Digital Splitleaf MEI Generator</name>
                    <name xml:id="{concat('name-', util:uuid())}" role="creator">Luca Guariento</name>
                    <p xml:id="{concat('p-', util:uuid())}">Post-processing: making the MEI file compatible with the Splitleaf Interface</p>
                </application>
            </appInfo>
            <projectDesc>
                <p>This file is part of the <corpName role="distributor">Digital Splitleaf Digital Archive</corpName>.
                    <persName role="creator">Timothy Duguid</persName></p>
            </projectDesc>
        </encodingDesc>
        {local:build-worklist($m)}
    </meiHead>
};

declare function local:inject-worklist($node as node(), $m as map(*)) as node()* {
    typeswitch($node)
        case document-node() return
            document {
                for $child in $node/node()
                return local:inject-worklist($child, $m)
            }

        case element(mei:meiHead) return
            local:build-mei-head($m)

        case element(mei:mei) return
            element {node-name($node)} {
                $node/@*,
                let $children := $node/node()
                let $has-head := some $c in $children satisfies ($c instance of element(mei:meiHead))
                return (
                    for $child in $children
                    return local:inject-worklist($child, $m),
                    if (not($has-head)) then local:build-mei-head($m) else ()
                )
            }

        case element() return
            element {node-name($node)} {
                $node/@*,
                for $child in $node/node()
                return local:inject-worklist($child, $m)
            }

        default return $node
};

(: Same text post-processing as the single-file tool. The meiversion pattern there is
   written with doubled backslashes, which XQuery does not unescape, so it never
   matched; it is corrected here. :)
declare function local:to-ds-text($final-doc as document-node()) as xs:string {
    let $xml-text-raw :=
        serialize(
            $final-doc,
            map {
                "method": "xml",
                "indent": true(),
                "encoding": "UTF-8"
            }
        )
    let $xml-text-unprefixed :=
        replace(
            replace(
                replace(
                    replace(
                        $xml-text-raw,
                        "<(/?)mei:",
                        "<$1"
                    ),
                    'xmlns:mei="http://www.music-encoding.org/ns/mei"',
                    'xmlns="http://www.music-encoding.org/ns/mei"'
                ),
                'meiversion="5\.1\+basic"',
                'meiversion="5.1"'
            ),
            "><",
            concat(">", codepoints-to-string(10), "<")
        )
    let $model-pi-1 := '<?xml-model href="https://music-encoding.org/schema/5.1/mei-all.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>'
    let $model-pi-2 := '<?xml-model href="https://music-encoding.org/schema/5.1/mei-all.rng" type="application/xml" schematypens="http://purl.oclc.org/dsdl/schematron"?>'
    return
        if (contains($xml-text-unprefixed, "<?xml-model")) then $xml-text-unprefixed
        else concat($model-pi-1, $model-pi-2, codepoints-to-string(10), $xml-text-unprefixed)
};

(: One MEI document in, DS-ready text out, plus what was extracted along the way. :)
declare function local:convert($source-doc as document-node(), $base-name as xs:string, $edition as map(*)) as map(*) {
    let $heading := local:extract-heading($source-doc)
    let $stage1 := local:rewrite-node($source-doc)
    let $stage1-doc := document {$stage1/*}
    let $title-fallback :=
        normalize-space(string((
            $stage1-doc//mei:fileDesc//mei:titleStmt/mei:title[normalize-space()][1],
            $base-name
        )[1]))
    let $work-title := if ($heading?title != "") then $heading?title else $title-fallback
    let $metre := if ($heading?metre != "") then $heading?metre else "Unknown"
    let $meta := map {
        "title": $work-title,
        "metre": $metre,
        "pae": local:extract-plaine-easie($stage1-doc),
        "pc": local:generate-pitchclass($stage1-doc),
        "si": local:generate-signedinterval($stage1-doc),
        "contour": local:generate-contour($stage1-doc),
        "edition-title": $edition?title,
        "edition-short": ($edition?short[. != ""], $edition?title)[1],
        "edition-date": $edition?date
    }
    let $final-doc := local:inject-worklist($stage1-doc, $meta)
    let $notes := (
        if (not($heading?found)) then
            concat("No title heading found; title taken from ",
                   if ($work-title = $base-name) then "the file name" else "titleStmt", ".")
        else (),
        if ($heading?count gt 1) then
            concat($heading?count, " title headings found; used the first.")
        else (),
        if ($heading?found and $heading?title = "") then "Title heading is empty." else (),
        if ($metre = "Unknown") then "No metre found; set to 'Unknown'." else ()
    )
    return map {
        "title": $work-title,
        "metre": $metre,
        "heading-raw":
            if ($heading?found) then normalize-space(concat($heading?title-raw, " / ", $heading?metre-raw))
            else "",
        "composer": exists($final-doc//mei:anchoredText[@func = "composer"]),
        "notes": $notes,
        "text": local:to-ds-text($final-doc)
    }
};


(: ========================================================================
   Reading the uploaded zip
   ======================================================================== :)

declare function local:join($a as xs:string, $b as xs:string?) as xs:string {
    if (empty($b) or $b = "") then $a
    else if ($a = "") then $b
    else concat($a, "/", $b)
};

(: Hidden files, dot-folders and macOS "__MACOSX" debris anywhere in the path. :)
declare function local:is-skippable-path($path as xs:string) as xs:boolean {
    some $seg in tokenize($path, "/")[. != ""]
    satisfies (starts-with($seg, ".") or $seg = $skip-folders)
};

declare function local:unzip-filter($path as xs:string, $data-type as xs:string, $param as item()*) as xs:boolean {
    $data-type = "resource" and not(local:is-skippable-path($path))
};

(: Called by compression:unzip for each file in the zip. eXist passes a parsed document
   when the bytes are well-formed XML, otherwise the raw bytes; raw bytes go through the
   same encoding detection as the single-file tool (e.g. UTF-8 labelled as UTF-16).
   $param holds the edition main title, short title and date, in that order.
   eXist checks both callback signatures literally, so their declared types must stay
   exactly as they are here (one map is returned per file). :)
declare function local:unzip-entry($path as xs:string, $data-type as xs:string, $data as item()?, $param as item()*) as item()* {
    let $edition := map { "title": string($param[1]), "short": string($param[2]), "date": string($param[3]) }
    let $name := tokenize($path, "/")[last()]
    let $dir := string-join(tokenize($path, "/")[position() lt last()], "/")
    return
        if (not(local:file-ext($name) = $input-extensions)) then
            map { "path": $path, "out-path": "", "status": "ignored" }
        else
            let $read :=
                if ($data instance of document-node()) then map { "doc": $data }
                else if ($data instance of xs:base64Binary) then local:binary-to-xml-doc($data)
                else map { "doc": () }
            let $root-name := local:root-local-name($read?doc)
            return
                if ($root-name != "mei") then
                    map {
                        "path": $path, "out-path": "", "status": "not-mei",
                        "title": "", "metre": "", "composer": false(), "heading-raw": "",
                        "notes": if ($root-name = "") then "Could not be read as XML."
                                 else concat("Root element is <", $root-name, ">, not <mei>.")
                    }
                else
                    let $base := local:file-base-name($name)
                    let $conv :=
                        try { local:convert($read?doc, $base, $edition) }
                        catch * { map { "error": string($err:description) } }
                    return
                        if (exists($conv?error)) then
                            map {
                                "path": $path, "out-path": "", "status": "failed",
                                "title": "", "metre": "", "composer": false(), "heading-raw": "",
                                "notes": concat("Transformation failed: ", $conv?error)
                            }
                        else
                            map {
                                "path": $path,
                                "out-path": local:join($dir, concat($base, $output-suffix)),
                                "status": "ok",
                                "title": $conv?title,
                                "metre": $conv?metre,
                                "composer": $conv?composer,
                                "heading-raw": $conv?heading-raw,
                                "notes": $conv?notes,
                                "text": $conv?text
                            }
};

(: "SingPsalms/9.8.9.8/x.mei" -> "9.8.9.8/x.mei" when the whole zip sits in one folder. :)
declare function local:strip-top($path as xs:string, $strip as xs:boolean) as xs:string {
    if ($strip and contains($path, "/")) then substring-after($path, "/") else $path
};

declare function local:safe-file-name($name as xs:string) as xs:string {
    replace(normalize-space($name), "[^A-Za-z0-9._-]", "_")
};


(: ========================================================================
   Zip and report
   ======================================================================== :)

declare function local:csv-field($v as xs:anyAtomicType?) as xs:string {
    concat('"', replace(string($v), '"', '""'), '"')
};

declare function local:status-label($status as xs:string) as xs:string {
    switch ($status)
        case "ok" return "Included"
        case "not-mei" return "Not MEI"
        case "ignored" return "Ignored (not .mei or .xml)"
        default return "Failed"
};

(: One row per file in the upload, so files that were left out are visible too.
   Starts with a byte-order mark so Excel reads the accents correctly. :)
declare function local:report-csv($rows as map(*)*) as xs:string {
    let $nl := codepoints-to-string((13, 10))
    let $header :=
        string-join(
            for $h in ("Input", "In zip as", "Status", "Title", "Metre", "Composer kept", "Heading as found", "Notes")
            return local:csv-field($h),
            ","
        )
    let $lines :=
        for $r in $rows
        return
            string-join(
                for $v in (
                    $r?rel,
                    $r?out-rel,
                    local:status-label($r?status),
                    $r?title,
                    $r?metre,
                    if ($r?status != "ok") then "" else if ($r?composer) then "yes" else "none in file",
                    $r?heading-raw,
                    string-join($r?notes[normalize-space()], " ")
                )
                return local:csv-field($v),
                ","
            )
    return concat(codepoints-to-string(65279), string-join(($header, $lines), $nl), $nl)
};

(: Text entries are written by compression:zip in the server's default charset, so the
   UTF-8 bytes are passed as base64 ("binary") to keep the encoding exact. :)
declare function local:zip-entry($name as xs:string, $text as xs:string) as element(entry) {
    <entry name="{$name}" type="binary" method="deflate">{string(util:string-to-binary($text, "UTF-8"))}</entry>
};


(: ========================================================================
   Pages
   ======================================================================== :)

declare function local:page($title as xs:string, $body as node()*) as element(html) {
    <html>
        <head>
            <title>{$title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 0; background: #f6f8fa; color: #1f2937; }}
                main {{ max-width: 72rem; margin: 2rem auto; padding: 0 1rem 2rem 1rem; }}
                .card {{ background: #fff; border: 1px solid #d0d7de; border-radius: 8px; padding: 1rem 1.2rem; margin-top: 1rem; }}
                .ok {{ border-left: 4px solid #2da44e; }}
                .warn {{ border-left: 4px solid #bf8700; }}
                .bad {{ border-left: 4px solid #cf222e; }}
                .button {{ display: inline-block; margin-top: 0.75rem; text-decoration: none; background: #0d6efd; color: #fff; border: 0; border-radius: 6px; padding: 0.5rem 0.8rem; font: inherit; cursor: pointer; }}
                .button.secondary {{ background: #57606a; }}
                code, .mono {{ font-family: Menlo, Consolas, monospace; font-size: 0.9rem; }}
                .table-wrap {{ overflow-x: auto; }}
                table {{ border-collapse: collapse; width: 100%; font-size: 0.92rem; }}
                th, td {{ text-align: left; vertical-align: top; padding: 0.4rem 0.5rem; border-bottom: 1px solid #e5e7eb; }}
                th {{ background: #f6f8fa; }}
                td.path {{ font-family: Menlo, Consolas, monospace; font-size: 0.85rem; word-break: break-all; }}
                .status {{ font-weight: bold; white-space: nowrap; }}
                .s-ok {{ color: #1a7f37; }}
                .s-failed, .s-not-mei {{ color: #cf222e; }}
                .note {{ color: #9a6700; font-size: 0.85rem; }}
                .muted {{ color: #57606a; font-size: 0.85rem; }}
                ul.counts {{ margin: 0.3rem 0 0 0; padding-left: 1.1rem; line-height: 1.6; }}
            </style>
        </head>
        <body>
            <main>
                <h2>{$title}</h2>
                {$body}
                <a class="button secondary" href="batch-mei.html">Back to batch form</a>
            </main>
        </body>
    </html>
};

declare function local:error-page($message as xs:string) {
    (
        response:set-status-code(400),
        local:page("Batch MEI Generator", <section class="card bad"><h3>Nothing was converted</h3><p>{$message}</p></section>)
    )
};

(: The converted zip travels inside the result page and the button turns it back into a
   file in the browser, as the single-file tool does with its XML. :)
declare function local:download-script() as element(script) {
    <script>
        (function () {{
            var btn = document.getElementById('downloadZip');
            var data = document.getElementById('zipData');
            if (!btn || !data) {{ return; }}
            btn.addEventListener('click', function () {{
                var bin = atob(data.textContent.replace(/\s+/g, ''));
                var bytes = new Uint8Array(bin.length);
                for (var i = 0; i !== bin.length; i++) {{ bytes[i] = bin.charCodeAt(i); }}
                var blob = new Blob([bytes], {{ type: 'application/zip' }});
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = btn.getAttribute('data-filename');
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(function () {{ URL.revokeObjectURL(a.href); }}, 1000);
            }});
        }})();
    </script>
};


(: ========================================================================
   Main
   ======================================================================== :)

let $edition-title := (normalize-space(request:get-parameter("editionTitle", ""))[. != ""], $default-edition-title)[1]
let $edition := map {
    "title": $edition-title,
    "short": (normalize-space(request:get-parameter("editionShortTitle", ""))[. != ""], $edition-title)[1],
    "date": (normalize-space(request:get-parameter("editionDate", ""))[. != ""], $default-edition-date)[1]
}

(: Upload handling follows run-mei-generator.xq, which copes with the differences
   between eXist versions in how uploaded files are exposed. :)
let $upload-fields := ("zipFile", "file", "upload")
let $get-uploaded-file-data-2-fn := function-lookup(xs:QName("request:get-uploaded-file-data"), 2)
let $get-uploaded-file-name-2-fn := function-lookup(xs:QName("request:get-uploaded-file-name"), 2)
let $field :=
    (
        for $f in $upload-fields
        let $d := request:get-uploaded-file-data($f)[1]
        let $n := request:get-uploaded-file-name($f)[1]
        where exists($d) or normalize-space(string($n)) != ""
        return $f
    )[1]
let $upload :=
    if (empty($field)) then ()
    else
        (
            request:get-uploaded-file-data($field)[1],
            if (exists($get-uploaded-file-data-2-fn)) then $get-uploaded-file-data-2-fn($field, 1) else ()
        )[1]
let $upload-name :=
    if (empty($field)) then ""
    else
        string((
            request:get-uploaded-file-name($field)[1],
            if (exists($get-uploaded-file-name-2-fn)) then $get-uploaded-file-name-2-fn($field, 1) else (),
            "upload.zip"
        )[1])

return
    if (empty($upload)) then
        local:error-page("No zip file was received. Choose a .zip file and submit again.")
    else

    let $unzipped :=
        try {
            map {
                "entries": compression:unzip(
                    $upload,
                    local:unzip-filter#3, (),
                    local:unzip-entry#4, ($edition?title, $edition?short, $edition?date)
                )
            }
        } catch * {
            map { "error": string($err:description) }
        }
    return
    if (exists($unzipped?error)) then
        local:error-page(concat("Could not open ", $upload-name, " as a zip file: ", $unzipped?error))
    else if (empty($unzipped?entries)) then
        local:error-page(concat($upload-name, " contains no files."))
    else

    let $raw := $unzipped?entries

    (: If everything sits in one top-level folder, that folder becomes the output folder
       ("SingPsalms/…" -> "SingPsalms-ds/…"); otherwise the zip's own name is used. :)
    let $tops := distinct-values(for $r in $raw return tokenize($r?path, "/")[1])
    let $single-top := count($tops) = 1 and (every $r in $raw satisfies contains($r?path, "/"))
    let $root-folder := concat(if ($single-top) then $tops else local:file-base-name($upload-name), "-ds")

    let $rows :=
        for $r in $raw
        order by $r?path
        return
            map:merge((
                $r,
                map {
                    "rel": local:strip-top($r?path, $single-top),
                    "out-rel": if ($r?out-path = "") then "" else local:strip-top($r?out-path, $single-top)
                }
            ))
    let $files := for $r in $rows where $r?status != "ignored" return $r
    let $ignored := for $r in $rows where $r?status = "ignored" return $r
    let $ok := for $r in $files where $r?status = "ok" return $r
    let $n-failed := count($files) - count($ok)
    let $n-noted := count(for $r in $ok where exists($r?notes[normalize-space()]) return $r)

    let $zip :=
        if (empty($ok)) then ()
        else
            compression:zip(
                (
                    for $r in $ok return local:zip-entry(concat($root-folder, "/", $r?out-rel), $r?text),
                    local:zip-entry(concat($root-folder, "-report.csv"), local:report-csv($rows))
                ),
                true()
            )
    let $zip-b64 := if (empty($zip)) then "" else string($zip)
    let $zip-file-name := concat(local:safe-file-name($root-folder), ".zip")

    return local:page(
        "Batch MEI Generator — Result",
        (
            <section class="card {if ($n-failed gt 0 or empty($ok)) then 'warn' else 'ok'}">
                <p><strong>Uploaded: </strong><code>{$upload-name}</code></p>
                <p><strong>Edition: </strong>{concat($edition?title, " (short title: ", $edition?short, "), ", $edition?date)}</p>
                <ul class="counts">
                    <li>{count($files)} MEI/XML file{if (count($files) = 1) then "" else "s"} found</li>
                    <li>{count($ok)} converted</li>
                    {if ($n-failed gt 0) then <li>{$n-failed} could not be converted (left out of the zip)</li> else ()}
                    {if ($n-noted gt 0) then <li>{$n-noted} converted with a note to check (title or metre not found in the heading, etc.)</li> else ()}
                    {if (exists($ignored)) then <li>{count($ignored)} other file{if (count($ignored) = 1) then "" else "s"} ignored (not .mei or .xml)</li> else ()}
                </ul>
                {
                    if (empty($ok)) then <p>Nothing could be converted, so there is no zip to download.</p>
                    else (
                        <button id="downloadZip" class="button" type="button" data-filename="{$zip-file-name}">
                            {concat("Download ", $zip-file-name, " (", max((1, round(string-length($zip-b64) * 0.75 div 1024))), " KB)")}
                        </button>,
                        <p class="muted">The zip holds a folder <code>{$root-folder}/</code> that mirrors your upload, and <code>{$root-folder}-report.csv</code> beside it listing every file.</p>,
                        <script id="zipData" type="text/plain">{$zip-b64}</script>
                    )
                }
            </section>,

            <section class="card">
                <h3>Files</h3>
                <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>Input</th><th>In zip as</th><th>Title</th><th>Metre</th><th>Composer kept</th><th>Status</th></tr>
                    </thead>
                    <tbody>{
                        for $r in $files
                        return
                            <tr>
                                <td class="path">{$r?rel}</td>
                                <td class="path">{if ($r?out-rel = "") then "" else concat($root-folder, "/", $r?out-rel)}</td>
                                <td>{$r?title}{if ($r?heading-raw != "") then <div class="muted">heading: {$r?heading-raw}</div> else ()}</td>
                                <td>{$r?metre}</td>
                                <td>{if ($r?status != "ok") then "" else if ($r?composer) then "yes" else "none in file"}</td>
                                <td>
                                    <span class="status s-{$r?status}">{if ($r?status = "ok") then "OK" else local:status-label($r?status)}</span>
                                    {for $n in $r?notes[normalize-space()] return <div class="note">{$n}</div>}
                                </td>
                            </tr>
                    }</tbody>
                </table>
                </div>
            </section>,

            if (exists($ignored)) then
                <section class="card">
                    <details>
                        <summary>Ignored files ({count($ignored)})</summary>
                        <ul class="mono">{
                            for $e in $ignored return <li>{$e?rel}</li>
                        }</ul>
                    </details>
                </section>
            else (),

            if (exists($ok)) then local:download-script() else ()
        )
    )
