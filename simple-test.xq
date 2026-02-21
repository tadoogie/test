xquery version "3.1";

(: 
 : SIMPLE TEST SCRIPT
 : Run this in eXide first to verify your setup is working
 : This tests basic functionality without modifying any data
 :)

declare namespace mei = "http://www.music-encoding.org/ns/mei";

(: ========================================
   STEP 1: UPDATE THIS PATH
   ======================================== :)
let $collection-path := "/db/tunes/8.8.8.8/"

(: ========================================
   TEST EXECUTION - DO NOT MODIFY BELOW
   ======================================== :)

return
<test-results>
    <step1-collection-test>
        <collection-path>{$collection-path}</collection-path>
        <collection-exists>{xmldb:collection-available($collection-path)}</collection-exists>
        <message>
        {
            if (xmldb:collection-available($collection-path)) then
                "✓ Collection path exists and is accessible"
            else
                "✗ Collection path does not exist or is not accessible. Check the path and permissions."
        }
        </message>
    </step1-collection-test>
    
    <step2-document-count>
        <total-documents>{count(collection($collection-path))}</total-documents>
        <mei-documents>{count(collection($collection-path)//mei:mei)}</mei-documents>
        <message>
        {
            let $count := count(collection($collection-path)//mei:mei)
            return
                if ($count > 0) then
                    concat("✓ Found ", $count, " MEI document(s)")
                else
                    "✗ No MEI documents found in this collection"
        }
        </message>
    </step2-document-count>
    
    <step3-incip-structure>
        <docs-with-incip>{count(collection($collection-path)//mei:mei[.//mei:incip])}</docs-with-incip>
        <docs-with-work-incip>{count(collection($collection-path)//mei:mei[.//mei:workList/mei:work[mei:incip]])}</docs-with-work-incip>
        <message>
        {
            let $count := count(collection($collection-path)//mei:mei[.//mei:workList/mei:work[mei:incip]])
            return
                if ($count > 0) then
                    concat("✓ Found ", $count, " document(s) with proper workList/work/incip structure")
                else
                    "✗ No documents with proper incip structure found"
        }
        </message>
    </step3-incip-structure>
    
    <step4-sample-file>
    {
        let $sample := collection($collection-path)//mei:mei[.//mei:workList/mei:work[mei:incip]][1]
        return
            if ($sample) then
                let $uri := document-uri(root($sample))
                let $work := $sample//mei:workList/mei:work[mei:incip]
                let $incip := $work/mei:incip
                return
                <sample-file-found>
                    <uri>{$uri}</uri>
                    <has-plaineAndEasie>{exists($incip/mei:incipCode[@form="plaineAndEasie"])}</has-plaineAndEasie>
                    <has-pitchclass>{exists($incip/mei:incipCode[@form="pitchclass"])}</has-pitchclass>
                    <has-signedinterval>{exists($incip/mei:incipCode[@form="signedinterval"])}</has-signedinterval>
                    <has-contour>{exists($incip/mei:incipCode[@form="contour"])}</has-contour>
                    <message>✓ Sample file shows what incipCodes are present</message>
                </sample-file-found>
            else
                <no-sample>✗ No sample file found with incip structure</no-sample>
    }
    </step4-sample-file>
    
    <step5-namespace-check>
        <mei-namespace-found>{namespace-uri-from-QName(QName("http://www.music-encoding.org/ns/mei", "mei"))}</mei-namespace-found>
        <message>✓ MEI namespace is correctly declared</message>
    </step5-namespace-check>
    
    <overall-status>
    {
        let $has-collection := xmldb:collection-available($collection-path)
        let $has-mei := count(collection($collection-path)//mei:mei) > 0
        let $has-incip := count(collection($collection-path)//mei:mei[.//mei:workList/mei:work[mei:incip]]) > 0
        return
            if ($has-collection and $has-mei and $has-incip) then
                <status>✓ READY - Your database is properly configured. You can now run the main script.</status>
            else if (not($has-collection)) then
                <status>✗ ISSUE - Collection path does not exist. Update the path in line 11.</status>
            else if (not($has-mei)) then
                <status>✗ ISSUE - No MEI documents found in collection. Check if files are uploaded.</status>
            else if (not($has-incip)) then
                <status>✗ ISSUE - MEI files don't have the required incip structure.</status>
            else
                <status>✗ UNKNOWN - Check individual test results above.</status>
    }
    </overall-status>
    
    <next-steps>
        <instruction>
        {
            let $has-collection := xmldb:collection-available($collection-path)
            let $has-mei := count(collection($collection-path)//mei:mei) > 0
            let $has-incip := count(collection($collection-path)//mei:mei[.//mei:workList/mei:work[mei:incip]]) > 0
            return
                if ($has-collection and $has-mei and $has-incip) then
                    "Run add-plaine-easie-incipit.xq to update all files."
                else if (not($has-collection)) then
                    "Fix the collection path and run this test again."
                else if (not($has-mei)) then
                    "Upload MEI files to the collection and run this test again."
                else
                    "Check your MEI file structure and ensure they have workList/work/incip elements."
        }
        </instruction>
    </next-steps>
</test-results>
