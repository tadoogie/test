xquery version "3.1";

declare namespace mei = "http://www.music-encoding.org/ns/mei";

(: ~
 : Function to check if a pitch has a flat in the key signature
 : @param $pitch the pitch name (A-G)
 : @param $key-sig-code the key signature code (e.g., "bB", "bBE", etc.)
 : @return true if the pitch is flat in the key signature
 :)
declare function local:is-flat-in-key($pitch as xs:string, $key-sig-code as xs:string) as xs:boolean {
    if (not($key-sig-code) or $pitch = "") then
        false()
    else
        (: Parse key signature character by character :)
        (: Format: bBEA means B, E, and A are flat :)
        let $result := fold-left(
            1 to string-length($key-sig-code),
            map { "accid": "", "found": false() },
            function($acc, $pos) {
                let $char := substring($key-sig-code, $pos, 1)
                return
                    if ($char = "b") then
                        map { "accid": "flat", "found": $acc?found }
                    else if ($char = "x") then
                        map { "accid": "sharp", "found": $acc?found }
                    else if (matches($char, "[A-G]")) then
                        if ($char = $pitch and $acc?accid = "flat") then
                            map { "accid": $acc?accid, "found": true() }
                        else
                            map { "accid": $acc?accid, "found": $acc?found }
                    else
                        $acc
            }
        )
        return $result?found
};

(: ~
 : Function to check if a pitch has a sharp in the key signature
 : @param $pitch the pitch name (A-G)
 : @param $key-sig-code the key signature code (e.g., "xF", "xFC", etc.)
 : @return true if the pitch is sharp in the key signature
 :)
declare function local:is-sharp-in-key($pitch as xs:string, $key-sig-code as xs:string) as xs:boolean {
    if (not($key-sig-code) or $pitch = "") then
        false()
    else
        (: Parse key signature character by character :)
        (: Format: xFC means F and C are sharp :)
        let $result := fold-left(
            1 to string-length($key-sig-code),
            map { "accid": "", "found": false() },
            function($acc, $pos) {
                let $char := substring($key-sig-code, $pos, 1)
                return
                    if ($char = "b") then
                        map { "accid": "flat", "found": $acc?found }
                    else if ($char = "x") then
                        map { "accid": "sharp", "found": $acc?found }
                    else if (matches($char, "[A-G]")) then
                        if ($char = $pitch and $acc?accid = "sharp") then
                            map { "accid": $acc?accid, "found": true() }
                        else
                            map { "accid": $acc?accid, "found": $acc?found }
                    else
                        $acc
            }
        )
        return $result?found
};

(: ~
 : Main function to process plaineAndEasie code and remove redundant accidentals
 : @param $pae-code the complete plaineAndEasie code string
 : @return processed plaineAndEasie code with redundant accidentals removed
 :)
declare function local:process-plaine-easie($pae-code as xs:string) as xs:string {
    (: Extract key signature using regex :)
    let $key-sig-match := analyze-string($pae-code, "\$([^\s@]+)")
    let $key-sig-code := if ($key-sig-match//fn:group[@nr="1"]) then 
                            string($key-sig-match//fn:group[@nr="1"][1])
                         else ""
    
    (: Split into header (up to and including time signature) and melody :)
    let $header-match := analyze-string($pae-code, "^(.*?@[^\s]+\s+)")
    let $header := if ($header-match//fn:group[@nr="1"]) then 
                      string($header-match//fn:group[@nr="1"][1])
                   else ""
    let $melody := substring($pae-code, string-length($header) + 1)
    
    (: Process the melody only, looking for note patterns :)
    (: Pattern: [octave][duration][dots][accidental][pitch] where pitch is A-G :)
    let $melody-result := analyze-string($melody, "([',]*[0-9\.]*)(b|x|n)([A-G])")
    
    let $processed-melody := string-join(
        for $match in $melody-result/*
        return
            typeswitch($match)
                case element(fn:match) return
                    let $prefix := string($match/fn:group[@nr="1"])
                    let $accid := string($match/fn:group[@nr="2"])
                    let $pitch := string($match/fn:group[@nr="3"])
                    
                    (: Check if this accidental matches the key signature :)
                    let $is-redundant := 
                        if ($accid = "b" and local:is-flat-in-key($pitch, $key-sig-code)) then true()
                        else if ($accid = "x" and local:is-sharp-in-key($pitch, $key-sig-code)) then true()
                        else false()
                    
                    return
                        if ($is-redundant) then
                            concat($prefix, $pitch)
                        else
                            string($match)
                default return string($match)
        , "")
    
    (: Reconstruct the full PAE code :)
    return concat($header, $processed-melody)
};

(: Main processing: Process all MEI documents with plaineAndEasie incipCode :)
let $collection-path := "/db/tunes/5.5.5.5/"
let $docs := 
    if (collection-available($collection-path)) then
        collection($collection-path)//mei:mei
    else
        ()

return
    if (empty($docs)) then
        <result>
            <message>No documents found in collection: {$collection-path}</message>
            <note>Please ensure the collection exists and contains MEI files.</note>
        </result>
    else
        for $doc in $docs
        let $uri := document-uri(root($doc))
        
        (: Find the incipCode with plaineAndEasie :)
        let $incipCode := $doc//mei:workList/mei:work/mei:incip/mei:incipCode[@form="plaineAndEasie"]
        
        where exists($incipCode)
        
        return
            let $original := string($incipCode)
            let $processed := local:process-plaine-easie($original)
            
            (: Update the incipCode :)
            return
                if ($original != $processed) then
                    update value $incipCode with $processed
                else
                    ()
