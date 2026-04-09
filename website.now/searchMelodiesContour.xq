xquery version "3.1";
declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare option output:method "json";

(: Function to find matching character positions for exact matches :)
declare function local:find-contour-match-positions($doc-contour as xs:string, $search-contour as xs:string) as xs:integer* {
  let $normalized-doc := replace($doc-contour, '\s+', '')
  let $normalized-search := replace($search-contour, '\s+', '')
  let $doc-length := string-length($normalized-doc)
  let $search-length := string-length($normalized-search)
  
  (: Find all positions where the pattern starts :)
  for $i in 1 to ($doc-length - $search-length + 1)
  let $doc-substring := substring($normalized-doc, $i, $search-length)
  where $doc-substring = $normalized-search
  (: Return character positions (0-indexed) :)
  return for $j in 0 to ($search-length - 1)
         return $i + $j - 1
};

(: Function to find matching character positions based on trigram matches (for fuzzy search) :)
declare function local:find-contour-trigram-match-positions($doc-contour as xs:string, $search-trigrams as xs:string*, $incipit as xs:boolean) as xs:integer* {
  let $normalized-doc := replace($doc-contour, '\s+', '')
  let $doc-trigrams := local:generate-contour-trigrams($doc-contour)
  let $doc-trigrams-to-use := 
    if ($incipit) then
      subsequence($doc-trigrams, 1, count($search-trigrams))
    else
      $doc-trigrams
  
  (: Find positions of all matching trigrams :)
  let $matching-positions :=
    for $search-trigram in $search-trigrams
    for $i in 1 to count($doc-trigrams-to-use)
    where $doc-trigrams-to-use[$i] = $search-trigram
    (: Each trigram spans 3 characters at positions i, i+1, i+2 (0-indexed: i-1, i, i+1) :)
    return ($i - 1, $i, $i + 1)
  
  return distinct-values($matching-positions)
};

(: Function to generate trigrams (3-character windows) from a contour string :)
declare function local:generate-contour-trigrams($contour as xs:string) as xs:string* {
  let $normalized := replace($contour, '\s+', '')
  let $length := string-length($normalized)
  for $i in 1 to ($length - 2)
  return substring($normalized, $i, 3)
};

(: Function to check if any trigram from search matches any trigram in document :)
declare function local:matches-contour-trigram($doc-contour as xs:string, $search-trigrams as xs:string*, $incipit as xs:boolean) as xs:boolean {
  let $doc-trigrams := 
    if ($incipit) then
      (: For incipit search, only use trigrams from the beginning :)
      let $all-trigrams := local:generate-contour-trigrams($doc-contour)
      return subsequence($all-trigrams, 1, count($search-trigrams))
    else
      local:generate-contour-trigrams($doc-contour)
  return some $search-trigram in $search-trigrams satisfies
    some $doc-trigram in $doc-trigrams satisfies $search-trigram = $doc-trigram
};

(: Function to calculate relevance score based on number of matching trigrams :)
declare function local:calculate-contour-relevance($doc-contour as xs:string, $search-trigrams as xs:string*, $incipit as xs:boolean) as xs:integer {
  let $doc-trigrams := 
    if ($incipit) then
      (: For incipit search, only use trigrams from the beginning :)
      let $all-trigrams := local:generate-contour-trigrams($doc-contour)
      return subsequence($all-trigrams, 1, count($search-trigrams))
    else
      local:generate-contour-trigrams($doc-contour)
  let $matching-count := count(
    for $search-trigram in $search-trigrams
    where some $doc-trigram in $doc-trigrams satisfies $search-trigram = $doc-trigram
    return $search-trigram
  )
  return $matching-count
};

(: Get search parameters :)
let $contour := request:get-parameter("contour", "")
let $incipit := request:get-parameter("incipit", "false")
let $searchIncipit := $incipit = "true"

(: Search for matching contour patterns using trigrams :)
let $results :=
  if (string-length($contour) = 0) then
    ()
  else
    let $normalized-search := replace($contour, '\s+', '')
    let $search-trigrams := local:generate-contour-trigrams($normalized-search)
    return
      if (string-length($normalized-search) < 3) then
        (: If fewer than 3 characters, fall back to exact substring matching :)
        for $doc in collection("/db/tunes")//mei:mei
        let $contourCode := $doc//mei:incipCode[@form="contour"]
        let $pitchCode := $doc//mei:incipCode[@form="pitchclass"]
        let $paeCode := $doc//mei:incipCode[@form="plaineAndEasie"]
        let $contourString := string($contourCode)
        let $normalizedContour := replace($contourString, "\s+", "")
        let $docPath := document-uri(root($doc))
        let $fileName := tokenize($docPath, '/')[last()]
        let $workTitle := $doc//mei:workList/mei:work/mei:title/text()
        let $fileTitle := $doc//mei:fileDesc/mei:titleStmt/mei:title/text()
        let $title := if (string-length($workTitle) > 0) then $workTitle else $fileTitle
        let $date := string($doc//mei:editionStmt/mei:edition/mei:date/text())
        let $metre := string($doc//mei:workList/mei:work/mei:otherChar/text())
        let $contourMatch := string($contourCode)
        let $pitchMatch := string($pitchCode)
        let $plaineAndEasie := string($paeCode)
        let $matchPositions := local:find-contour-match-positions($contourString, $contour)
        where $contourCode and 
              (if ($searchIncipit) then
                starts-with($normalizedContour, $normalized-search)
              else
                contains($normalizedContour, $normalized-search))
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
          "plaineAndEasie": $plaineAndEasie,
          "matchPositions": array { distinct-values($matchPositions) }
        }
      else
        (: Use trigram matching for 3 or more characters :)
        for $doc in collection("/db/tunes")//mei:mei
        let $contourCode := $doc//mei:incipCode[@form="contour"]
        let $pitchCode := $doc//mei:incipCode[@form="pitchclass"]
        let $paeCode := $doc//mei:incipCode[@form="plaineAndEasie"]
        where $contourCode and local:matches-contour-trigram(string($contourCode), $search-trigrams, $searchIncipit)
        let $docPath := document-uri(root($doc))
        let $fileName := tokenize($docPath, '/')[last()]
        let $workTitle := $doc//mei:workList/mei:work/mei:title/text()
        let $fileTitle := $doc//mei:fileDesc/mei:titleStmt/mei:title/text()
        let $title := if (string-length($workTitle) > 0) then $workTitle else $fileTitle
        let $date := string($doc//mei:editionStmt/mei:edition/mei:date/text())
        let $metre := string($doc//mei:workList/mei:work/mei:otherChar/text())
        let $contourMatch := string($contourCode)
        let $pitchMatch := string($pitchCode)
        let $plaineAndEasie := string($paeCode)
        let $relevance := local:calculate-contour-relevance(string($contourCode), $search-trigrams, $searchIncipit)
        let $matchPositions := local:find-contour-trigram-match-positions(string($contourCode), $search-trigrams, $searchIncipit)
        order by $relevance descending, $title
        return map {
          "title": $title,
          "date": $date,
          "metre": $metre,
          "meiFilePath": $docPath,
          "fileName": $fileName,
          "label": $title,
          "contourMatch": $contourMatch,
          "pitchMatch": $pitchMatch,
          "plaineAndEasie": $plaineAndEasie,
          "relevance": $relevance,
          "matchPositions": array { distinct-values($matchPositions) }
        }

(: Limit results to top 20 :)
let $limited-results := subsequence($results, 1, 20)

return map {
  "results": array { $limited-results },
  "count": count($limited-results),
  "totalMatches": count($results)
}