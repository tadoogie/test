xquery version "3.1";

import module namespace file = "http://exist-db.org/xquery/file";
import module namespace process = "http://exist-db.org/xquery/process";
import module namespace util = "http://exist-db.org/xquery/util";
import module namespace xmldb = "http://exist-db.org/xquery/xmldb";

declare namespace mei = "http://www.music-encoding.org/ns/mei";
declare namespace output = "http://www.w3.org/2010/xslt-xquery-serialization";

declare option output:method "html5";
declare option output:media-type "text/html";

(: Configure these paths as needed on the server. :)
declare variable $verovio-bin-candidates := (
    "/usr/local/bin/verovio",
    "/opt/homebrew/bin/verovio",
    "/opt/local/bin/verovio",
    "/usr/bin/verovio",
    "/usr/local/sbin/verovio",
    "/usr/sbin/verovio"
);

declare variable $musescore-bin-candidates := (
    "/usr/bin/mscore",
    "/usr/bin/mscore4",
    "/usr/local/bin/mscore",
    "/usr/local/bin/mscore4",
    "/Applications/MuseScore 4.app/Contents/MacOS/mscore",
    "/Applications/MuseScore 3.app/Contents/MacOS/mscore",
    "/Applications/MuseScore 4.app/Contents/MacOS/MuseScore"
);

(: Optional DBA credentials for MusicXML/MuseScore conversion path. :)
declare variable $dba-user := "admin";
declare variable $dba-password := "cAF2q2MYgnX*m4";

declare function local:safe-file-name($name as xs:string?) as xs:string {
    let $raw := normalize-space($name)
    let $base := if ($raw = "") then "upload.xml" else $raw
    return replace($base, "[^A-Za-z0-9._-]", "_")
};

declare function local:file-base-name($name as xs:string) as xs:string {
    replace($name, "\.[^.]+$", "")
};

declare function local:file-ext($name as xs:string?) as xs:string {
    let $n := lower-case(normalize-space($name))
    return if (contains($n, ".")) then replace($n, "^.*\.([^.]+)$", "$1") else ""
};

declare function local:first-existing-path($candidates as xs:string*) as xs:string? {
    (
        for $p in $candidates
        where file:exists($p)
        return $p
    )[1]
};

(: Uploads do not always arrive as UTF-8. sibmei writes UTF-16 with a BOM, which the
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

declare function local:binary-to-xml($path as xs:string) as document-node()? {
    local:binary-to-xml-doc(file:read-binary($path))?doc
};

declare function local:root-local-name($doc as document-node()?) as xs:string {
    if (empty($doc) or empty($doc/*)) then "" else local-name($doc/*[1])
};

declare function local:stdout($exec as node()?) as xs:string {
    normalize-space(string-join($exec//stdout//text(), ""))
};

declare function local:stderr($exec as node()?) as xs:string {
    normalize-space(string-join($exec//stderr//text(), ""))
};

declare function local:exit-code($exec as node()?) as xs:string {
    string(($exec/@exitCode, $exec//@exitCode)[1])
};

declare function local:run-convert-musicxml-to-mei($input as xs:string, $output as xs:string, $work-dir as xs:string) as map(*) {
    let $verovio := local:first-existing-path($verovio-bin-candidates)
    let $checked := string-join($verovio-bin-candidates, ", ")
    return
        if (empty($verovio)) then
            map {
                "ok": false(),
                "step": "musicxml->mei",
                "message": concat("No Verovio binary found. Checked: ", $checked, ". Update $verovio-bin-candidates in run-mei-generator.xq."),
                "stdout": "",
                "stderr": ""
            }
        else
            let $exec := process:execute(
                ($verovio, "-t", "mei", "-o", $output, $input),
                <options>
                    <workingDir>{$work-dir}</workingDir>
                    <stdout-encoding>UTF-8</stdout-encoding>
                    <stderr-encoding>UTF-8</stderr-encoding>
                </options>
            )
            let $ok := (local:exit-code($exec) = "0" and file:exists($output))
            return
                map {
                    "ok": $ok,
                    "step": "musicxml->mei",
                    "message": if ($ok) then "Converted MusicXML to MEI." else "MusicXML to MEI conversion failed.",
                    "stdout": local:stdout($exec),
                    "stderr": local:stderr($exec)
                }
};

declare function local:run-convert-musescore-to-musicxml($input as xs:string, $output as xs:string, $work-dir as xs:string) as map(*) {
    let $mscore := local:first-existing-path($musescore-bin-candidates)
    let $checked := string-join($musescore-bin-candidates, ", ")
    return
        if (empty($mscore)) then
            map {
                "ok": false(),
                "step": "musescore->musicxml",
                "message": concat("No MuseScore CLI binary found. Checked: ", $checked, ". Update $musescore-bin-candidates in run-mei-generator.xq."),
                "stdout": "",
                "stderr": ""
            }
        else
            let $exec := process:execute(
                ($mscore, "-o", $output, $input),
                <options>
                    <workingDir>{$work-dir}</workingDir>
                    <stdout-encoding>UTF-8</stdout-encoding>
                    <stderr-encoding>UTF-8</stderr-encoding>
                </options>
            )
            let $ok := (local:exit-code($exec) = "0" and file:exists($output))
            return
                map {
                    "ok": $ok,
                    "step": "musescore->musicxml",
                    "message": if ($ok) then "Converted MuseScore to MusicXML." else "MuseScore to MusicXML conversion failed.",
                    "stdout": local:stdout($exec),
                    "stderr": local:stderr($exec)
                }
};

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
        case element(mei:pgHead) return ()
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
            else
                element {node-name($node)} {
                    $node/@*,
                    for $child in $node/node()
                    return local:rewrite-node($child)
                }
        case element(mei:labelAbbr) return
            if ($node/parent::mei:staffGrp) then ()
            else
                element {node-name($node)} {
                    $node/@*,
                    for $child in $node/node()
                    return local:rewrite-node($child)
                }

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

        case element() return
            element {node-name($node)} {
                $node/@*,
                for $child in $node/node()
                return local:rewrite-node($child)
            }

        default return $node
};

declare function local:build-worklist($title as xs:string, $metre as xs:string, $pae as xs:string, $pc as xs:string, $si as xs:string, $contour as xs:string) as element(mei:workList) {
    <workList xmlns="http://www.music-encoding.org/ns/mei">
        <work>
            <title>{$title}</title>
            <otherChar>{$metre}</otherChar>
            <incip>
                <incipCode form="plaineAndEasie">{$pae}</incipCode>
                <incipCode form="pitchclass">{$pc}</incipCode>
                <incipCode form="signedinterval">{$si}</incipCode>
                <incipCode form="contour">{$contour}</incipCode>
            </incip>
        </work>
    </workList>
};

declare function local:build-mei-head($title as xs:string, $metre as xs:string, $pae as xs:string, $pc as xs:string, $si as xs:string, $contour as xs:string) as element(mei:meiHead) {
    <meiHead xmlns="http://www.music-encoding.org/ns/mei">
        <fileDesc>
            <titleStmt>
                <title>{$title}</title>
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
                    <title type="main">The Psalter in Metre and Scripture Paraphrases</title>
                    <title type="short">The Psalter in Metre and Scripture Paraphrases</title>
                    <date>1900</date>
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
        {local:build-worklist($title, $metre, $pae, $pc, $si, $contour)}
    </meiHead>
};

declare function local:inject-worklist($node as node(), $title as xs:string, $metre as xs:string, $pae as xs:string, $pc as xs:string, $si as xs:string, $contour as xs:string) as node()* {
    typeswitch($node)
        case document-node() return
            document {
                for $child in $node/node()
                return local:inject-worklist($child, $title, $metre, $pae, $pc, $si, $contour)
            }

        case element(mei:meiHead) return
            local:build-mei-head($title, $metre, $pae, $pc, $si, $contour)

        case element(mei:mei) return
            element {node-name($node)} {
                $node/@*,
                let $children := $node/node()
                let $has-head := some $c in $children satisfies ($c instance of element(mei:meiHead))
                return (
                    for $child in $children
                    return local:inject-worklist($child, $title, $metre, $pae, $pc, $si, $contour),
                    if (not($has-head)) then local:build-mei-head($title, $metre, $pae, $pc, $si, $contour) else ()
                )
            }

        case element() return
            element {node-name($node)} {
                $node/@*,
                for $child in $node/node()
                return local:inject-worklist($child, $title, $metre, $pae, $pc, $si, $contour)
            }

        default return $node
};

let $upload-fields := ("musicFile", "file", "upload", "textFile")
let $get-uploaded-file-data-2-fn := function-lookup(xs:QName("request:get-uploaded-file-data"), 2)
let $get-uploaded-file-name-2-fn := function-lookup(xs:QName("request:get-uploaded-file-name"), 2)
let $get-uploaded-file-fn := function-lookup(xs:QName("request:get-uploaded-file"), 1)
let $selected-upload-field :=
    (
        for $f in $upload-fields
        let $d := request:get-uploaded-file-data($f)[1]
        let $d2 :=
            if (exists($get-uploaded-file-data-2-fn))
            then $get-uploaded-file-data-2-fn($f, 1)
            else ()
        let $n := request:get-uploaded-file-name($f)[1]
        let $n2 :=
            if (exists($get-uploaded-file-name-2-fn))
            then $get-uploaded-file-name-2-fn($f, 1)
            else ()
        let $t :=
            if (exists($get-uploaded-file-fn))
            then $get-uploaded-file-fn($f)[1]
            else ()
        where exists($d) or exists($d2) or exists($t) or normalize-space(string(($n, $n2)[1])) != ""
        return $f
    )[1]
let $upload :=
    if ($selected-upload-field != "")
    then
        let $d1 := request:get-uploaded-file-data($selected-upload-field)[1]
        let $d2 :=
            if (exists($get-uploaded-file-data-2-fn))
            then $get-uploaded-file-data-2-fn($selected-upload-field, 1)
            else ()
        return ($d1, $d2)[1]
    else ()
let $upload-name :=
    if ($selected-upload-field != "")
    then
        let $n1 := request:get-uploaded-file-name($selected-upload-field)[1]
        let $n2 :=
            if (exists($get-uploaded-file-name-2-fn))
            then $get-uploaded-file-name-2-fn($selected-upload-field, 1)
            else ()
        return string(($n1, $n2, "upload.xml")[1])
    else ""
let $upload-temp :=
    if ($selected-upload-field != "" and exists($get-uploaded-file-fn))
    then $get-uploaded-file-fn($selected-upload-field)[1]
    else ()
let $upload-text :=
    if ($selected-upload-field != "")
    then request:get-parameter($selected-upload-field, "")[1]
    else ""
let $work-title-param := normalize-space(request:get-parameter("workTitle", ""))
let $metre-param := normalize-space(request:get-parameter("metre", ""))
return
if (empty($upload) and empty($upload-temp) and normalize-space($upload-text) = "") then
    let $param-names := request:get-parameter-names()
    let $param-list := string-join($param-names, ", ")
    let $content-type := request:get-header("Content-Type")
    let $upload-debug :=
        string-join(
            for $f in $upload-fields
            let $n := request:get-uploaded-file-name($f)[1]
            return concat($f, "=", if (normalize-space($n) = "") then "(empty)" else $n),
            "; "
        )
    return (
        response:set-status-code(400),
        <html>
            <head><title>MEI Generator</title></head>
            <body>
                <h2>No file uploaded</h2>
                <p>Select a music file and submit again.</p>
                <p>Expected upload field names: <code>musicFile</code>, <code>file</code>, <code>upload</code>, or <code>textFile</code>.</p>
                <p><strong>Request Content-Type:</strong> {if ($content-type != "") then $content-type else "(missing)"}</p>
                <p><strong>request:get-parameter-names():</strong> {if ($param-list != "") then $param-list else "(none)"}</p>
                <p><strong>request:get-uploaded-file-name() check:</strong> {$upload-debug}</p>
                <p><strong>request:get-parameter(musicFile) length:</strong> {string-length(request:get-parameter("musicFile", ""))}</p>
                <p><a href="upload-mei.html">Back to upload form</a></p>
            </body>
        </html>
    )
else
    let $job-id := util:uuid()
    let $safe-name := local:safe-file-name($upload-name)
    let $base-name := local:file-base-name($safe-name)
    let $ext := local:file-ext($safe-name)
    let $input-decode :=
        if (exists($upload)) then
            local:binary-to-xml-doc($upload)
        else if (exists($upload-temp)) then
            local:binary-to-xml-doc(file:read-binary($upload-temp))
        else if (normalize-space($upload-text) != "") then
            map { "doc": local:string-to-xml($upload-text), "encoding": "UTF-8" }
        else
            map { "doc": (), "encoding": "" }
    let $input-doc := $input-decode?doc
    let $input-encoding := string($input-decode?encoding)
    let $root-name := local:root-local-name($input-doc)
    let $is-mei := ($root-name = "mei")
    let $is-musicxml := ($root-name = ("score-partwise", "score-timewise") or $ext = ("musicxml", "mxl"))
    let $is-musescore := ($root-name = "museScore" or $ext = ("mscz", "mscx"))
    let $needs-conversion := ($is-musicxml or $is-musescore)
    let $creds-configured := (normalize-space($dba-user) != "" and normalize-space($dba-password) != "")
    let $login-ok :=
        if ($needs-conversion and $creds-configured) then
            try {
                xmldb:login("/db", $dba-user, $dba-password)
            } catch * {
                false()
            }
        else false()

    let $work-dir := concat("/tmp/digital-splitleaf-mei-", $job-id)
    let $in-dir := concat($work-dir, "/in")
    let $tmp-dir := concat($work-dir, "/tmp")
    let $in-path := concat($in-dir, "/", $safe-name)
    let $musicxml-path := concat($tmp-dir, "/", $base-name, ".musicxml")
    let $converted-mei-path := concat($tmp-dir, "/", $base-name, ".mei")

    let $_mk1 := if ($needs-conversion and $login-ok and not(file:exists($work-dir))) then file:mkdir($work-dir) else ()
    let $_mk2 := if ($needs-conversion and $login-ok and not(file:exists($in-dir))) then file:mkdir($in-dir) else ()
    let $_mk3 := if ($needs-conversion and $login-ok and not(file:exists($tmp-dir))) then file:mkdir($tmp-dir) else ()

    let $_write-conversion-input :=
        if ($needs-conversion and $login-ok) then
            if (exists($upload)) then file:serialize-binary($upload, $in-path)
            else if (exists($upload-temp)) then file:serialize-binary(file:read-binary($upload-temp), $in-path)
            else
                file:serialize(
                    text {$upload-text},
                    $in-path,
                    <output:serialization-parameters>
                        <output:method>text</output:method>
                        <output:encoding>UTF-8</output:encoding>
                    </output:serialization-parameters>
                )
        else ()

    let $conv1 :=
        if (not($needs-conversion)) then
            map { "ok": true(), "message": "Skipped.", "stderr": "" }
        else if (not($login-ok)) then
            map { "ok": false(), "message": "DBA login required for conversion.", "stderr": "" }
        else if ($is-musescore) then
            local:run-convert-musescore-to-musicxml($in-path, $musicxml-path, $work-dir)
        else
            map { "ok": true(), "message": "Skipped.", "stderr": "" }

    let $conv2 :=
        if ($is-mei) then
            map { "ok": true(), "message": "Skipped.", "stderr": "" }
        else if (not($needs-conversion)) then
            map { "ok": false(), "message": "Unsupported file type.", "stderr": "" }
        else if (not($login-ok)) then
            map { "ok": false(), "message": "DBA login required for conversion.", "stderr": "" }
        else if ($is-musescore) then
            if ($conv1?ok) then local:run-convert-musicxml-to-mei($musicxml-path, $converted-mei-path, $work-dir)
            else map { "ok": false(), "message": "MuseScore to MusicXML conversion failed.", "stderr": string($conv1?stderr) }
        else if ($is-musicxml) then
            local:run-convert-musicxml-to-mei($in-path, $converted-mei-path, $work-dir)
        else
            map { "ok": false(), "message": "Unsupported file type.", "stderr": "" }

    let $source-doc :=
        if ($is-mei) then $input-doc
        else if ($conv2?ok) then local:binary-to-xml($converted-mei-path)
        else ()
    let $has-source-mei := exists($source-doc) and local:root-local-name($source-doc) = "mei"
    let $stage1 := if ($has-source-mei) then local:rewrite-node($source-doc) else ()
    let $stage1-doc := if ($has-source-mei) then document {$stage1/*} else ()
    let $title-fallback := normalize-space(string(($stage1-doc//mei:fileDesc//mei:titleStmt/mei:title[1], $base-name)[1]))
    let $work-title := if ($work-title-param != "") then $work-title-param else $title-fallback
    let $metre := if ($metre-param != "") then $metre-param else "Unknown"
    let $pae := if ($has-source-mei) then local:extract-plaine-easie($stage1-doc) else ""
    let $pc := if ($has-source-mei) then local:generate-pitchclass($stage1-doc) else ""
    let $si := if ($has-source-mei) then local:generate-signedinterval($stage1-doc) else ""
    let $contour := if ($has-source-mei) then local:generate-contour($stage1-doc) else ""
    let $final-doc :=
        if ($has-source-mei) then
            local:inject-worklist(document {$stage1/*}, $work-title, $metre, $pae, $pc, $si, $contour)
        else ()
    let $out-name := concat($base-name, "-ds.xml")
    let $status-ok := $has-source-mei
    let $xml-text-raw :=
        if ($status-ok) then
            serialize(
                $final-doc,
                map {
                    "method": "xml",
                    "indent": true(),
                    "encoding": "UTF-8"
                }
            )
        else ""
    let $xml-text-unprefixed :=
        if ($xml-text-raw = "") then ""
        else
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
                    'meiversion="5\\.1\\+basic"',
                    'meiversion="5.1"'
                ),
                "><",
                concat(">", codepoints-to-string(10), "<")
            )
    let $model-pi-1 := '<?xml-model href="https://music-encoding.org/schema/5.1/mei-all.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>'
    let $model-pi-2 := '<?xml-model href="https://music-encoding.org/schema/5.1/mei-all.rng" type="application/xml" schematypens="http://purl.oclc.org/dsdl/schematron"?>'
    let $xml-text :=
        if ($xml-text-unprefixed = "") then ""
        else if (contains($xml-text-unprefixed, "<?xml-model")) then $xml-text-unprefixed
        else concat($model-pi-1, $model-pi-2, codepoints-to-string(10), $xml-text-unprefixed)
    return
        <html>
            <head>
                <title>MEI Generator Result</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 0; background: #f6f8fa; color: #1f2937; }}
                    main {{ max-width: 56rem; margin: 2rem auto; padding: 0 1rem 2rem 1rem; }}
                    .card {{ background: #fff; border: 1px solid #d0d7de; border-radius: 8px; padding: 1rem 1.2rem; margin-top: 1rem; }}
                    .ok {{ border-left: 4px solid #2da44e; }}
                    .warn {{ border-left: 4px solid #bf8700; }}
                    .mono {{ font-family: Menlo, Consolas, monospace; font-size: 0.93rem; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 0.75rem; white-space: pre-wrap; }}
                    textarea.mono {{ width: 100%; min-height: 18rem; resize: vertical; box-sizing: border-box; }}
                    .button {{ display: inline-block; margin-top: 0.75rem; text-decoration: none; background: #0d6efd; color: #fff; border-radius: 6px; padding: 0.5rem 0.8rem; }}
                </style>
            </head>
            <body>
                <main>
                    <h2>MEI Generator Result</h2>

                    <section class="card">
                        <p><strong>Input file:</strong> {$safe-name}</p>
                        <p><strong>Detected root:</strong> {if ($root-name != "") then $root-name else "(not XML)"}</p>
                        <p><strong>Detected encoding:</strong> {if ($input-encoding != "") then $input-encoding else "(none matched)"}</p>
                    </section>

                    {
                        if ($status-ok) then
                            <section class="card ok">
                                <h3>Generated DS-ready MEI</h3>
                                <p>File: {$out-name}</p>
                                <button id="downloadBtn" class="button" type="button">Download XML</button>
                                <textarea id="xmlOutput" class="mono">{$xml-text}</textarea>
                            </section>
                        else
                            <section class="card warn">
                                <h3>Generation failed</h3>
                                <p>{
                                    if ($root-name = "" and not($needs-conversion)) then
                                        concat(
                                            "Uploaded file could not be parsed as XML. Tried these encodings: ",
                                            string-join($input-encodings, ", "),
                                            ". Check that the file is well-formed XML."
                                        )
                                    else if (not($is-mei or $is-musicxml or $is-musescore)) then
                                        "Unsupported file type. Upload MEI, MusicXML, or MuseScore."
                                    else if ($needs-conversion and not($creds-configured)) then
                                        "MusicXML/MuseScore conversion requires DBA credentials. Set $dba-user and $dba-password in run-mei-generator.xq."
                                    else if ($needs-conversion and not($login-ok)) then
                                        "DBA login failed for conversion. Check $dba-user and $dba-password."
                                    else if ($is-musescore and not($conv1?ok)) then
                                        concat("MuseScore conversion failed: ", string($conv1?message))
                                    else if ($needs-conversion and not($conv2?ok)) then
                                        concat("MusicXML conversion failed: ", string($conv2?message))
                                    else if ($is-mei and empty($source-doc)) then
                                        "Uploaded file could not be parsed as XML/MEI."
                                    else
                                        "Unable to generate output from source MEI."
                                }</p>
                            </section>
                    }

                    {
                        if (normalize-space(string($conv1?stderr)) != "") then
                            <section class="card">
                                <h3>MuseScore Converter stderr</h3>
                                <div class="mono">{string($conv1?stderr)}</div>
                            </section>
                        else ()
                    }

                    {
                        if (normalize-space(string($conv2?stderr)) != "") then
                            <section class="card">
                                <h3>MusicXML Converter stderr</h3>
                                <div class="mono">{string($conv2?stderr)}</div>
                            </section>
                        else ()
                    }

                    {
                        if ($status-ok) then
                            <section class="card">
                                <h3>Generated metadata</h3>
                                <p><strong>Title:</strong> {$work-title}</p>
                                <p><strong>Metre:</strong> {$metre}</p>
                                <p><strong>Incipit forms:</strong> plaineAndEasie, pitchclass, signedinterval, contour</p>
                            </section>
                        else ()
                    }

                    <a class="button" href="upload-mei.html">Back to upload form</a>
                </main>
                {
                    if ($status-ok) then
                        <script>
                            const btn = document.getElementById('downloadBtn');
                            const ta = document.getElementById('xmlOutput');
                            if (btn &amp;&amp; ta) {{
                                btn.addEventListener('click', function() {{
                                    const blob = new Blob([ta.value], {{ type: 'application/xml;charset=utf-8' }});
                                    const a = document.createElement('a');
                                    a.href = URL.createObjectURL(blob);
                                    a.download = '{ $out-name }';
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    URL.revokeObjectURL(a.href);
                                }});
                            }}
                        </script>
                    else ()
                }
            </body>
        </html>
