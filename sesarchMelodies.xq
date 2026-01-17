xquery version "3.1";
declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare option output:method "json";

(: Function to generate trigrams (3-note windows) from a space-separated interval string :)
declare function local:generate-trigrams($intervals as xs:string) as xs:string* {
  let $tokens := tokenize($intervals, '\s+')
  let $count := count($tokens)
  for $i in 1 to ($count - 2)
  return string-join(($tokens[$i], $tokens[$i + 1], $tokens[$i + 2]), ' ')
};

(: Function to check if any trigram from search matches any trigram in document :)
declare function local:matches-trigram($doc-intervals as xs:string, $search-trigrams as xs:string*) as xs:boolean {
  let $doc-trigrams := local:generate-trigrams($doc-intervals)
  return some $search-trigram in $search-trigrams satisfies
    some $doc-trigram in $doc-trigrams satisfies $search-trigram = $doc-trigram
};

(: Get search parameter :)
let $signedinterval := request:get-parameter("signedinterval", "")

(: Search for matching interval patterns using trigrams (3-note n-grams) :)
let $results :=
  if (string-length($signedinterval) = 0) then
    ()
  else
    let $search-trigrams := local:generate-trigrams($signedinterval)
    return
      if (count($search-trigrams) = 0) then
        (: If fewer than 3 intervals provided, fall back to exact substring matching :)
        for $doc in collection("/db/tunes")//mei:mei
        let $intervalCode := $doc//mei:incipCode[@form="signedinterval"]
        let $pitchCode := $doc//mei:incipCode[@form="pitchclass"]
        let $paeCode := $doc//mei:incipCode[@form="plaineAndEasie"]
        where $intervalCode and contains(string($intervalCode), $signedinterval)
        let $docPath := document-uri(root($doc))
        let $fileName := tokenize($docPath, '/')[last()]
        let $workTitle := $doc//mei:workList/mei:work/mei:title/text()
        let $fileTitle := $doc//mei:fileDesc/mei:titleStmt/mei:title/text()
        let $title := if (string-length($workTitle) > 0) then $workTitle else $fileTitle
        let $date := string($doc//mei:editionStmt/mei:edition/mei:date/text())
        let $metre := string($doc//mei:workList/mei:work/mei:otherChar/text())
        let $intervalMatch := string($intervalCode)
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
          "intervalMatch": $intervalMatch,
          "pitchMatch": $pitchMatch,
          "plaineAndEasie": $plaineAndEasie
        }
      else
        (: Use trigram matching for 3 or more intervals :)
        for $doc in collection("/db/tunes")//mei:mei
        let $intervalCode := $doc//mei:incipCode[@form="signedinterval"]
        let $pitchCode := $doc//mei:incipCode[@form="pitchclass"]
        let $paeCode := $doc//mei:incipCode[@form="plaineAndEasie"]
        where $intervalCode and local:matches-trigram(string($intervalCode), $search-trigrams)
        let $docPath := document-uri(root($doc))
        let $fileName := tokenize($docPath, '/')[last()]
        let $workTitle := $doc//mei:workList/mei:work/mei:title/text()
        let $fileTitle := $doc//mei:fileDesc/mei:titleStmt/mei:title/text()
        let $title := if (string-length($workTitle) > 0) then $workTitle else $fileTitle
        let $date := string($doc//mei:editionStmt/mei:edition/mei:date/text())
        let $metre := string($doc//mei:workList/mei:work/mei:otherChar/text())
        let $intervalMatch := string($intervalCode)
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
          "intervalMatch": $intervalMatch,
          "pitchMatch": $pitchMatch,
          "plaineAndEasie": $plaineAndEasie
        }

return map {
  "results": array { $results },
  "count": count($results)
}
