xquery version "3.1";

declare namespace tei="http://www.tei-c.org/ns/1.0";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare namespace request="http://exist-db.org/xquery/request";
declare namespace xmldb="http://exist-db.org/xquery/xmldb";

declare option output:method "json";
declare option output:media-type "application/json";

(: Accent-insensitive normalization: strip marks via \p{M} to avoid range regex issues :)
declare function local:normalize($str as xs:string?) as xs:string {
  if (empty($str) or $str = '') then ''
  else
    let $nfd := fn:normalize-unicode($str, 'NFD')
    return fn:replace($nfd, '\p{M}+', '')
};

(: Reconstruct text from syllable segments:
   - If a seg ends with '-', it continues the word (no space).
   - If it doesn’t, insert a space after that syllable.
   Then normalize whitespace. :)
declare function local:reconstruct-text($node as node()) as xs:string {
  let $chunks :=
    for $seg in $node//tei:seg[@type='syl']
    let $t := string($seg)
    let $clean := replace($t, '-+$', '')
    return if (ends-with($t, '-')) then $clean else concat($clean, ' ')
  return normalize-space(string-join($chunks, ''))
};

(: Gather documents from any available collection among common candidates :)
declare function local:collect-docs() as node()* {
  let $base := '/db/apps/splitleaf-demo'
  let $candidates := (
    '/db/texts',
    concat($base, '/texts'),
    concat($base, '/data/texts'),
    concat($base, '/data'),
    $base
  )
  for $p in $candidates
  where xmldb:collection-available($p)
  return collection($p)
};

(: Build a snippet around the first match; we compute position on normalized text,
   but extract from the original reconstructed text for readability. :)
declare function local:build-snippet($text as xs:string, $normText as xs:string, $normQuery as xs:string, $ctx as xs:integer) as xs:string {
  if (contains($normText, $normQuery)) then
    let $before := substring-before($normText, $normQuery)
    let $pos := string-length($before) + 1
    let $start := max((1, $pos - $ctx))
    let $end := min((string-length($text), $pos + string-length($normQuery) + $ctx))
    let $snippetRaw := substring($text, $start, $end - $start + 1)
    return concat(if ($start > 1) then "..." else "", $snippetRaw, if ($end < string-length($text)) then "..." else "")
  else
    ""
};

let $query  := request:get-parameter("query", "")
let $source := request:get-parameter("source", "")

return
  if (string-length(normalize-space($query)) lt 2) then
    array { }  (: Require at least 2 characters :)
  else
    let $docs := local:collect-docs()
    let $normQ := local:normalize(lower-case($query))
    
    (: Tokenize comma-separated sources :)
    let $sourceTokens := 
      if ($source != "") then
        for $token in tokenize($source, ',')
        let $normalized := normalize-space($token)
        where $normalized != ''
        return $normalized
      else
        ()

    let $filteredDocs :=
      if (count($sourceTokens) > 0) then
        $docs[some $token in $sourceTokens 
              satisfies lower-case(.//tei:editionStmt/tei:edition/tei:title[@type="short"]) = lower-case($token)]
      else
        $docs

    let $results :=
      for $doc in $filteredDocs
      let $text := local:reconstruct-text($doc)
      let $normT := local:normalize(lower-case($text))
      where contains($normT, $normQ)
      let $id       := string($doc//tei:TEI/@xml:id)
      let $label    := string($doc//tei:titleStmt/tei:title)
      let $main     := string($doc//tei:editionStmt/tei:edition/tei:title[@type="main"])
      let $date     := string($doc//tei:editionStmt/tei:edition/tei:date)
      let $sourceInfo :=
        if ($main != '' and $date != '') then concat($main, " (", $date, ")")
        else if ($main != '') then $main
        else if ($date != '') then $date
        else ""
      let $metre    := string($doc//tei:div/@met)
      let $suggTune := normalize-space(string($doc//tei:notesStmt/tei:note[2]))
      let $snippet  := local:build-snippet($text, $normT, $normQ, 40)
      order by $label
      return map {
        "id": $id,
        "label": $label,
        "snippet": $snippet,
        "source": $sourceInfo,
        "path": document-uri($doc),
        "data": concat($id, ";", $metre, ";", $suggTune)
      }

    return array { subsequence($results, 1, 50) }
