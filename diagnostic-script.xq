xquery version "3.1";

(: Diagnostic script to help identify why files aren't being processed :)
(: Run this in eXide to check your database structure :)

declare namespace mei = "http://www.music-encoding.org/ns/mei";

(: Change this path to match your database :)
let $collection-path := "/db/tunes/8.8.8.8/"

return
<diagnostic-report>
    <collection-path>{$collection-path}</collection-path>
    <collection-exists>{xmldb:collection-available($collection-path)}</collection-exists>
    
    <total-documents>{count(collection($collection-path))}</total-documents>
    <mei-documents>{count(collection($collection-path)//mei:mei)}</mei-documents>
    
    <documents-with-incip>{count(collection($collection-path)//mei:mei[.//mei:incip])}</documents-with-incip>
    
    <documents-with-worklist>{count(collection($collection-path)//mei:mei[.//mei:workList])}</documents-with-worklist>
    
    <documents-with-work-incip>{count(collection($collection-path)//mei:mei[.//mei:workList/mei:work[mei:incip]])}</documents-with-work-incip>
    
    <sample-files>
    {
        for $doc in collection($collection-path)//mei:mei[.//mei:incip][position() le 5]
        let $uri := document-uri(root($doc))
        let $work := $doc//mei:workList/mei:work[mei:incip]
        let $incip := $work/mei:incip
        let $has-pae := exists($incip/mei:incipCode[@form="plaineAndEasie"])
        let $has-pc := exists($incip/mei:incipCode[@form="pitchclass"])
        let $has-si := exists($incip/mei:incipCode[@form="signedinterval"])
        let $has-contour := exists($incip/mei:incipCode[@form="contour"])
        return
            <sample-file>
                <uri>{$uri}</uri>
                <has-incip>{exists($incip)}</has-incip>
                <has-plaineAndEasie>{$has-pae}</has-plaineAndEasie>
                <has-pitchclass>{$has-pc}</has-pitchclass>
                <has-signedinterval>{$has-si}</has-signedinterval>
                <has-contour>{$has-contour}</has-contour>
                <will-be-processed-new-logic>{exists($incip)}</will-be-processed-new-logic>
                <will-be-processed-old-logic>{not($has-pae) or not($has-pc) or not($has-si) or not($has-contour)}</will-be-processed-old-logic>
            </sample-file>
    }
    </sample-files>
    
    <summary>
        <message>
        {
            let $total := count(collection($collection-path)//mei:mei)
            let $with-incip := count(collection($collection-path)//mei:mei[.//mei:workList/mei:work[mei:incip]])
            return
                if ($total = 0) then
                    "NO MEI DOCUMENTS FOUND. Check if the collection path is correct."
                else if ($with-incip = 0) then
                    concat($total, " MEI documents found, but NONE have workList/work/incip structure. Files need to have this structure to be processed.")
                else
                    concat($with-incip, " out of ", $total, " MEI documents will be processed with the updated script.")
        }
        </message>
    </summary>
</diagnostic-report>
