xquery version "3.1";

declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare namespace request="http://exist-db.org/xquery/request";
declare namespace xmldb="http://exist-db.org/xquery/xmldb";

declare option output:method "json";
declare option output:media-type "application/json";

(: Gather MEI documents from any available collection :)
declare function local:collect-mei-docs() as node()* {
  let $base := '/db/apps/splitleaf-demo'
  let $candidates := (
    '/db/mei',
    '/db/tunes',
    concat($base, '/mei'),
    concat($base, '/tunes'),
    concat($base, '/data/mei'),
    concat($base, '/data/tunes'),
    concat($base, '/data'),
    $base
  )
  for $p in $candidates
  where xmldb:collection-available($p)
  return collection($p)//mei:mei
};

let $signedinterval := request:get-parameter("signedinterval", "")

return
  if (string-length(normalize-space($signedinterval)) eq 0) then
    []
  else
    let $docs := local:collect-mei-docs()
    let $searchPattern := normalize-space($signedinterval)
    
    (: Search for matching interval patterns :)
    let $results :=
      for $doc in $docs
      (: Look for incipCode elements with form="signedinterval" :)
      let $intervalCode := $doc//mei:incipCode[@form='signedinterval']
      let $pitchCode := $doc//mei:incipCode[@form='pitchclass']
      
      (: Check if the search pattern appears in the interval code :)
      where $intervalCode and contains(normalize-space(data($intervalCode)), $searchPattern)
      
      (: Extract tune metadata :)
      let $id := data(($doc//@xml:id)[1])
      let $title := data(($doc//mei:title)[1])
      
      (: Get the full interval and pitch sequences :)
      let $fullIntervals := normalize-space(data($intervalCode))
      let $fullPitches := normalize-space(data($pitchCode))
      
      (: Extract just the first 15 intervals/pitches for display :)
      let $intervalTokens := tokenize($fullIntervals, '\s+')
      let $pitchTokens := tokenize($fullPitches, '\s+')
      let $intervalDisplay := string-join(subsequence($intervalTokens, 1, 15), ' ')
      let $pitchDisplay := string-join(subsequence($pitchTokens, 1, 15), ' ')
      let $intervalSuffix := if (count($intervalTokens) > 15) then ' ...' else ''
      let $pitchSuffix := if (count($pitchTokens) > 15) then ' ...' else ''
      
      order by $title
      return map {
        'id': if ($id) then $id else '',
        'label': if ($title) then $title else 'Untitled',
        'intervalMatch': concat($intervalDisplay, $intervalSuffix),
        'pitchMatch': concat($pitchDisplay, $pitchSuffix)
      }
    
    return array { subsequence($results, 1, 50) }