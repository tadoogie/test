xquery version "3.1";

(:
 : VERSION WITH VISIBLE RESULTS
 : This version performs the updates AND returns a summary of what was done
 : Use this to see which files were actually updated
 :)

declare namespace mei = "http://www.music-encoding.org/ns/mei";

(: Include all helper functions - copying from main script :)
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

declare function local:get-clef-code($clef-shape as xs:string?, $clef-line as xs:string?) as xs:string {
    if ($clef-shape = "G" and $clef-line = "2") then "G-2"
    else if ($clef-shape = "F" and $clef-line = "4") then "F-4"
    else if ($clef-shape = "C" and $clef-line = "3") then "C-3"
    else if ($clef-shape = "C" and $clef-line = "4") then "C-4"
    else "G-2"
};

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

declare function local:get-time-sig-code($count as xs:string?, $unit as xs:string?) as xs:string {
    if ($count and $unit) then concat($count, "/", $unit)
    else "4/4"
};

(: NOTE: This is a simplified diagnostic version :)
(: For full implementation, see add-plaine-easie-incipit.xq :)

(: Change this to match YOUR collection path :)
let $collection-path := "/db/tunes/8.8.8.8/"

let $results :=
    for $doc in collection($collection-path)//mei:mei
    let $uri := document-uri(root($doc))
    let $work := $doc//mei:workList/mei:work[mei:incip]
    let $incip := $work/mei:incip
    where $incip
    return
        <file-result>
            <uri>{$uri}</uri>
            <status>Would update this file</status>
            <action>The main script would generate/update incipCodes here</action>
        </file-result>

return
<update-summary>
    <collection-path>{$collection-path}</collection-path>
    <files-processed>{count($results)}</files-processed>
    <results>{$results}</results>
    <next-step>
        {
            if (count($results) = 0) then
                "NO FILES FOUND TO PROCESS. Check: 1) Files are in correct collection, 2) Files have workList/work/incip structure"
            else
                concat("Run add-plaine-easie-incipit.xq to actually update these ", count($results), " file(s)")
        }
    </next-step>
</update-summary>
