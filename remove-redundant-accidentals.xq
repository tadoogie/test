xquery version "3.1";

declare namespace mei = "http://www.music-encoding.org/ns/mei";

(: Check if a pitch has a flat in the key signature :)
declare function local:is-flat-in-key($pitch as xs:string, $key-sig-code as xs:string) as xs:boolean {
    if (not($key-sig-code) or $pitch = "") then false()
    else
        let $result := fold-left(
            1 to string-length($key-sig-code),
            map { "accid": "", "found": false() },
            function($acc, $pos) {
                let $char := substring($key-sig-code, $pos, 1)
                return
                    if ($char = "b") then map { "accid": "flat", "found": $acc?found }
                    else if ($char = "x") then map { "accid": "sharp", "found": $acc?found }
                    else if (matches($char, "[A-G]")) then
                        if ($char = $pitch and $acc?accid = "flat") then map { "accid": $acc?accid, "found": true() }
                        else map { "accid": $acc?accid, "found": $acc?found }
                    else $acc
            }
        )
        return $result?found
};

(: Check if a pitch has a sharp in the key signature :)
declare function local:is-sharp-in-key($pitch as xs:string, $key-sig-code as xs:string) as xs:boolean {
    if (not($key-sig-code) or $pitch = "") then false()
    else
        let $result := fold-left(
            1 to string-length($key-sig-code),
            map { "accid": "", "found": false() },
            function($acc, $pos) {
                let $char := substring($key-sig-code, $pos, 1)
                return
                    if ($char = "b") then map { "accid": "flat", "found": $acc?found }
                    else if ($char = "x") then map { "accid": "sharp", "found": $acc?found }
                    else if (matches($char, "[A-G]")) then
                        if ($char = $pitch and $acc?accid = "sharp") then map { "accid": $acc?accid, "found": true() }
                        else map { "accid": $acc?accid, "found": $acc?found }
                    else $acc
            }
        )
        return $result?found
};

(: Process plaineAndEasie code and remove redundant accidentals :)
declare function local:process-plaine-easie($pae-code as xs:string) as xs:string {
    let $key-sig-match := analyze-string($pae-code, "\$([^\s@]+)")
    let $key-sig-code := if ($key-sig-match//fn:group[@nr="1"]) then string($key-sig-match//fn:group[@nr="1"][1]) else ""
    let $header-match := analyze-string($pae-code, "^(.*?@[^\s]+\s+)")
    let $header := if ($header-match//fn:group[@nr="1"]) then string($header-match//fn:group[@nr="1"][1]) else ""
    let $melody := substring($pae-code, string-length($header) + 1)
    let $melody-result := analyze-string($melody, "([',]*[0-9\.]*)(b|x|n)([A-G])")
    let $processed-melody := string-join(
        for $match in $melody-result/*
        return
            typeswitch($match)
                case element(fn:match) return
                    let $prefix := string($match/fn:group[@nr="1"])
                    let $accid := string($match/fn:group[@nr="2"])
                    let $pitch := string($match/fn:group[@nr="3"])
                    let $is-redundant := 
                        if ($accid = "b" and local:is-flat-in-key($pitch, $key-sig-code)) then true()
                        else if ($accid = "x" and local:is-sharp-in-key($pitch, $key-sig-code)) then true()
                        else false()
                    return if ($is-redundant) then concat($prefix, $pitch) else string($match)
                default return string($match)
        , "")
    return concat($header, $processed-melody)
};

(: Process all MEI documents in the collection :)
for $doc in collection("/db/tunes/5.5.5.5/")//mei:mei
let $incipCode := $doc//mei:incipCode[@form="plaineAndEasie"]
where exists($incipCode)
return
    let $original := string($incipCode)
    let $processed := local:process-plaine-easie($original)
    return
        if ($original != $processed) then
            update value $incipCode with $processed
        else ()
