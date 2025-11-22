xquery version "3.1";
declare namespace tei="http://www.tei-c.org/ns/1.0";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare option output:method "json";
declare option output:media-type "application/json";

(: Get search parameters :)
let $query := request:get-parameter("query", "")
let $source := request:get-parameter("source", "")

(: Normalize for accent-insensitive search - remove diacritical marks :)
declare function local:normalize($str as xs:string?) as xs:string {
  if (empty($str) or $str = '') then
    ''
  else
    (: Unicode NFD normalization to separate base characters from combining marks :)
    let $nfd := fn:normalize-unicode($str, 'NFD')
    (: Remove combining diacritical marks (Unicode range 0300-036F) :)
    return fn:replace($nfd, '[\u0300-\u036F]', '')
};

(: Extract snippet with context around match :)
declare function local:extract-snippet($text as xs:string, $query as xs:string, $contextChars as xs:integer) as xs:string {
  let $normalizedText := local:normalize(lower-case($text))
  let $normalizedQuery := local:normalize(lower-case($query))
  
  return
    if (contains($normalizedText, $normalizedQuery)) then
      (: Find the position of the match :)
      let $beforeMatch := substring-before($normalizedText, $normalizedQuery)
      let $matchPos := string-length($beforeMatch) + 1
      let $start := max((1, $matchPos - $contextChars))
      let $end := min((string-length($text), $matchPos + string-length($query) + $contextChars))
      let $snippet := substring($text, $start, $end - $start + 1)
      let $prefix := if ($start > 1) then "..." else ""
      let $suffix := if ($end < string-length($text)) then "..." else ""
      return concat($prefix, $snippet, $suffix)
    else
      ""
};

(: Search through TEI documents :)
let $results :=
  if (string-length($query) = 0) then
    ()
  else
    let $allDocs := 
      if (string-length($source) > 0) then
        collection("/db/texts")[.//tei:editionStmt/tei:edition/tei:title[@type="short"] = $source]
      else
        collection("/db/texts")
    
    for $doc in $allDocs
    let $text := string-join($doc//tei:seg[@type="syl"], " ")
    let $normalizedText := local:normalize(lower-case($text))
    let $normalizedQuery := local:normalize(lower-case($query))
    where contains($normalizedText, $normalizedQuery)
    let $id := string($doc//tei:TEI/@xml:id)
    let $label := string($doc//tei:titleStmt/tei:title)
    let $snippet := local:extract-snippet($text, $query, 40)
    let $mainTitle := string($doc//tei:editionStmt/tei:edition/tei:title[@type="main"])
    let $editionDate := string($doc//tei:editionStmt/tei:edition/tei:date)
    let $sourceInfo := 
      if ($mainTitle != '' and $editionDate != '') then
        concat($mainTitle, " (", $editionDate, ")")
      else if ($mainTitle != '') then
        $mainTitle
      else if ($editionDate != '') then
        $editionDate
      else
        ""
    let $path := document-uri($doc)
    let $metre := string($doc//tei:div/@met)
    let $suggTune := normalize-space(string($doc//tei:notesStmt/tei:note[2]))
    order by $label
    return map {
      "id": $id,
      "label": $label,
      "snippet": $snippet,
      "source": $sourceInfo,
      "path": $path,
      "data": concat($id, ";", $metre, ";", $suggTune)
    }

(: Limit to 50 results for performance :)
let $limitedResults := subsequence($results, 1, 50)

return array { $limitedResults }
