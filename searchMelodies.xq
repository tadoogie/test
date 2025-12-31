xquery version "3.1";
declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare option output:method "json";

(: Get search parameter :)
let $signedinterval := request:get-parameter("signedinterval", "")

(: Only search in /db/tunes/ :)
let $docs := collection('/db/tunes')//mei:mei

(: Search for matching interval patterns :)
let $results :=
  if (string-length($signedinterval) = 0) then
    ()
  else
    let $searchPattern := normalize-space($signedinterval)
    
    for $doc in $docs
    (: Look for incipCode elements with form="signedinterval" :)
    let $intervalCode := $doc//mei:incipCode[@form='signedinterval']
    let $pitchCode := $doc//mei:incipCode[@form='pitchclass']
    
    (: Check if the search pattern appears in the interval code :)
    where $intervalCode and contains(normalize-space(string($intervalCode)), $searchPattern)
    
    (: Extract tune metadata :)
    let $id := string($doc//@xml:id[1])
    let $title := string($doc//mei:title[1])
    
    (: Get the full interval and pitch sequences :)
    let $fullIntervals := normalize-space(string($intervalCode))
    let $fullPitches := normalize-space(string($pitchCode))
    
    (: Extract just the first 15 intervals/pitches for display :)
    let $intervalTokens := tokenize($fullIntervals, '\s+')
    let $pitchTokens := tokenize($fullPitches, '\s+')
    let $intervalDisplay := string-join(subsequence($intervalTokens, 1, 15), ' ')
    let $pitchDisplay := string-join(subsequence($pitchTokens, 1, 15), ' ')
    let $intervalSuffix := if (count($intervalTokens) > 15) then ' ...' else ''
    let $pitchSuffix := if (count($pitchTokens) > 15) then ' ...' else ''
    
    order by $title
    return map {
      "id": $id,
      "label": $title,
      "intervalMatch": concat($intervalDisplay, $intervalSuffix),
      "pitchMatch": concat($pitchDisplay, $pitchSuffix)
    }

return map {
  "results": array { $results },
  "count": count($results)
}