xquery version "3.1";
declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare option output:method "json";

(: Get search parameters :)
let $contour := request:get-parameter("contour", "")
let $incipit := request:get-parameter("incipit", "false")
let $searchIncipit := $incipit = "true"

(: Convert contour pattern to spaced version for matching :)
let $contourWithSpaces := 
  if (string-length($contour) = 0) then ""
  else string-join(for $char in string-to-codepoints($contour) 
                    return codepoints-to-string($char), " ")

(: Search for matching contour patterns :)
let $results :=
  if (string-length($contour) = 0) then
    ()
  else
    for $doc in collection("/db/tunes")//mei:mei
    let $contourCode := $doc//mei:incipCode[@form="contour"]
    let $pitchCode := $doc//mei:incipCode[@form="pitchclass"]
    let $paeCode := $doc//mei:incipCode[@form="plaineAndEasie"]
    let $contourString := string($contourCode)
    (: Remove all whitespace from the stored contour for comparison :)
    let $normalizedContour := replace($contourString, "\s+", "")
    where $contourCode and 
          if ($searchIncipit) then
            (starts-with($contourString, $contour) or 
             starts-with($contourString, $contourWithSpaces) or
             starts-with($normalizedContour, $contour))
          else
            (contains($contourString, $contour) or 
             contains($contourString, $contourWithSpaces) or
             contains($normalizedContour, $contour))
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
    let $contourMatch := string($contourCode)
    let $pitchMatch := string($pitchCode)
    let $plaineAndEasie := string($paeCode)
    order by $title
    return map {
      "title": $title,
      "date": $date,
      "metre": $metre,
      "meiFilePath": $docPath,
      "fileName": $fileName,
      "label": $title,
      "contourMatch": $contourMatch,
      "pitchMatch": $pitchMatch,
      "plaineAndEasie": $plaineAndEasie
    }

return map {
  "results": array { $results },
  "count": count($results)
}
