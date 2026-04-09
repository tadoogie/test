xquery version "3.1";
(:  This grabs the specified verse texts :)

declare namespace tei="http://www.tei-c.org/ns/1.0";

declare variable $teiID := request:get-parameter("teiID", '*');
declare variable $rawVerses := request:get-parameter("selStanzas", '*');
declare variable $psVerses := tokenize($rawVerses,",");

let $folder := substring-before($teiID, '-')
let $filename := substring-after($teiID, concat($folder, '-'))
let $psText := concat('/db/texts/', $folder, '/', $filename, '.xml')

return
<tei xmlns="http://www.tei-c.org/ns/1.0" xml:id="{$teiID}">
    {
    for $tHead in doc($psText)//tei:teiHeader
    return
        $tHead
    }
    <body>
    {
        for $tBody in doc($psText)//tei:lg
        where $tBody/@n = $psVerses
        return 
            $tBody
    }
    </body>
</tei>