xquery version "3.1";
declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare option output:method "json";

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
      "plaineAndEasie": $plaineAndEasie
    }

return map {
  "results": array { $results },
  "count": count($results)
}
