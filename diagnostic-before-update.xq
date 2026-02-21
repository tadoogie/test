xquery version "3.1";

(:
 : DIAGNOSTIC VERSION - Shows what will be updated without making changes
 : Use this to verify your file is being found and processed
 :)

declare namespace mei = "http://www.music-encoding.org/ns/mei";

(: Change this to match YOUR collection path or specific file :)
let $collection-path := "/db/tunes/8.8.8.8/"

(: Get all MEI documents :)
let $docs := collection($collection-path)//mei:mei

return
<diagnostic>
    <collection-path>{$collection-path}</collection-path>
    <total-mei-files>{count($docs)}</total-mei-files>
    <files>
    {
        for $doc in $docs
        let $uri := document-uri(root($doc))
        let $work := $doc//mei:workList/mei:work[mei:incip]
        let $incip := $work/mei:incip
        let $has-pae := exists($incip/mei:incipCode[@form="plaineAndEasie"])
        let $has-pc := exists($incip/mei:incipCode[@form="pitchclass"])
        let $has-si := exists($incip/mei:incipCode[@form="signedinterval"])
        let $has-contour := exists($incip/mei:incipCode[@form="contour"])
        let $will-process := exists($incip)
        return
        <file>
            <uri>{$uri}</uri>
            <has-work-with-incip>{exists($work)}</has-work-with-incip>
            <has-incip>{exists($incip)}</has-incip>
            <incip-is-empty>{exists($incip) and not(exists($incip/*))}</incip-is-empty>
            <current-incipCodes>
                <plaineAndEasie>{$has-pae}</plaineAndEasie>
                <pitchclass>{$has-pc}</pitchclass>
                <signedinterval>{$has-si}</signedinterval>
                <contour>{$has-contour}</contour>
            </current-incipCodes>
            <will-be-processed>{$will-process}</will-be-processed>
            <reason>
            {
                if (not(exists($work))) then
                    "No work element with incip child found"
                else if (not(exists($incip))) then
                    "incip element not found (WHERE clause filters this out)"
                else if ($will-process) then
                    concat("WILL BE PROCESSED - ", 
                           if (not($has-pae) and not($has-pc) and not($has-si) and not($has-contour)) 
                           then "All 4 incipCodes will be generated"
                           else "plaineAndEasie will be regenerated, missing ones will be generated")
                else
                    "Unknown reason - should be processed"
            }
            </reason>
        </file>
    }
    </files>
    <summary>
        <files-with-incip>{count($docs[.//mei:workList/mei:work[mei:incip]])}</files-with-incip>
        <files-that-will-be-processed>{count($docs[.//mei:workList/mei:work[mei:incip]/mei:incip])}</files-that-will-be-processed>
    </summary>
</diagnostic>
