xquery version "3.1";
declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare option output:method "json";

(: Function to find matching note positions for exact matches :)
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

(: Function to find matching note positions based on trigram matches (for fuzzy search) :)
declare function local:find-trigram-match-positions($doc-intervals as xs:string, $search-trigrams as xs:string*, $incipit as xs:boolean) as xs:integer* {
  let $doc-interval-tokens := tokenize($doc-intervals, '\s+')
  let $doc-trigrams := local:generate-trigrams($doc-intervals)
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
    (: Each trigram spans 3 notes at positions i, i+1, i+2 (0-indexed: i-1, i, i+1) :)
    return ($i - 1, $i, $i + 1)
  
  return distinct-values($matching-positions)
};

(: Function to generate trigrams (3-note windows) from a space-separated interval string :)
declare function local:generate-trigrams($intervals as xs:string) as xs:string* {
  let $tokens := tokenize($intervals, '\s+')
  let $count := count($tokens)
  for $i in 1 to ($count - 2)
  return string-join(($tokens[$i], $tokens[$i + 1], $tokens[$i + 2]), ' ')
};

(: Function to check if any trigram from search matches any trigram in document :)
declare function local:matches-trigram($doc-intervals as xs:string, $search-trigrams as xs:string*, $incipit as xs:boolean) as xs:boolean {
  let $doc-trigrams := 
    if ($incipit) then
      (: For incipit search, only use trigrams from the beginning of the melody :)
      let $all-trigrams := local:generate-trigrams($doc-intervals)
      return subsequence($all-trigrams, 1, count($search-trigrams))
    else
      local:generate-trigrams($doc-intervals)
  return some $search-trigram in $search-trigrams satisfies
    some $doc-trigram in $doc-trigrams satisfies $search-trigram = $doc-trigram
};

(: Function to calculate relevance score based on number of matching trigrams :)
declare function local:calculate-relevance($doc-intervals as xs:string, $search-trigrams as xs:string*, $incipit as xs:boolean) as xs:integer {
  let $doc-trigrams := 
    if ($incipit) then
      (: For incipit search, only use trigrams from the beginning of the melody :)
      let $all-trigrams := local:generate-trigrams($doc-intervals)
      return subsequence($all-trigrams, 1, count($search-trigrams))
    else
      local:generate-trigrams($doc-intervals)
  let $matching-count := count(
    for $search-trigram in $search-trigrams
    where some $doc-trigram in $doc-trigrams satisfies $search-trigram = $doc-trigram
    return $search-trigram
  )
  return $matching-count
};

(: Get search parameters :)
let $signedinterval := request:get-parameter("signedinterval", "")
let $incipit := request:get-parameter("incipit", "false")
let $searchIncipit := $incipit = "true"

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
        where $intervalCode and 
              (if ($searchIncipit) then
                starts-with(string($intervalCode), $signedinterval)
              else
                contains(string($intervalCode), $signedinterval))
        let $matchPositions := local:find-match-positions(string($intervalCode), $signedinterval, string($pitchCode))
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
      else
        (: Use trigram matching for 3 or more intervals :)
        for $doc in collection("/db/tunes")//mei:mei
        let $intervalCode := $doc//mei:incipCode[@form="signedinterval"]
        let $pitchCode := $doc//mei:incipCode[@form="pitchclass"]
        let $paeCode := $doc//mei:incipCode[@form="plaineAndEasie"]
        where $intervalCode and local:matches-trigram(string($intervalCode), $search-trigrams, $searchIncipit)
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
        let $relevance := local:calculate-relevance(string($intervalCode), $search-trigrams, $searchIncipit)
        let $matchPositions := local:find-trigram-match-positions(string($intervalCode), $search-trigrams, $searchIncipit)
        order by $relevance descending, $title
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
