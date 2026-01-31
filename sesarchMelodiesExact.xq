xquery version "3.1";
declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare option output:method "json";

(: Function to find matching note positions in the melody :)
declare function local:find-match-positions($doc-intervals as xs:string, $search-intervals as xs:string, $doc-pitchclasses as xs:string) as xs:integer* {
  let $doc-interval-tokens := tokenize($doc-intervals, '\s+')
  let $search-interval-tokens := tokenize($search-intervals, '\s+')
  let $doc-length := count($doc-interval-tokens)
  let $search-length := count($search-interval-tokens)
  
  (: Find all positions where the pattern starts :)
  for $i in 1 to ($doc-length - $search-length + 1)
  let $doc-substring := string-join(subsequence($doc-interval-tokens, $i, $search-length), ' ')
  where $doc-substring = $search-intervals
  (: Return note positions (0-indexed) - the first note of the match and all subsequent notes in the pattern :)
  return for $j in 0 to $search-length
         return $i + $j - 1
};

(: Get search parameters :)
let $signedinterval := request:get-parameter("signedinterval", "")
let $incipit := request:get-parameter("incipit", "false")
let $searchIncipit := $incipit = "true"

(: Search for matching interval patterns :)
let $results : =
  if (string-length($signedinterval) = 0) then
    ()
  else
    for $doc in collection("/db/tunes")//mei:mei
    let $intervalCode := $doc//mei:incipCode[@form="signedinterval"]
    let $pitchCode := $doc//mei:incipCode[@form="pitchclass"]
    let $paeCode := $doc//mei:incipCode[@form="plaineAndEasie"]
    (: Get the actual document path :)
    let $docPath := document-uri(root($doc))
    let $fileName := tokenize($docPath, '/')[last()]
    (: Try multiple paths to get the title :)
    let $workTitle := $doc//mei:workList/mei:work/mei:title/text()
    let $fileTitle := $doc//mei:fileDesc/mei:titleStmt/mei:title/text()
    let $title := if (string-length($workTitle) > 0) then $workTitle else $fileTitle
    (: Get the date :)
    let $date := string($doc//mei:editionStmt/mei:edition/mei:date/text())
    (: Get the metre from otherChar :)
    let $metre := string($doc//mei:workList/mei:work/mei:otherChar/text())
    let $intervalMatch := string($intervalCode)
    let $pitchMatch := string($pitchCode)
    let $plaineAndEasie := string($paeCode)
    let $matchPositions := local:find-match-positions(string($intervalCode), $signedinterval, string($pitchCode))
    where $intervalCode and 
          (if ($searchIncipit) then
            starts-with(string($intervalCode), $signedinterval)
          else
            contains(string($intervalCode), $signedinterval))
    order by $title
    return map {
      "title": $title,
      "date": $date,
      "metre": $metre,
      "meiFilePath": $docPath,
      "fileName": $fileName,
      "label": $title,
      "intervalMatch": $intervalMatch,
      "pitchMatch": $pitchMatch,
      "plaineAndEasie": $plaineAndEasie,
      "matchPositions": array { distinct-values($matchPositions) }
    }

return map {
  "results": array { $results },
  "count": count($results)
}
