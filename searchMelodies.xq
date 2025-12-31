xquery version "3.1";
declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare option output:method "json";

(: Get search parameter :)
let $signedinterval := request:get-parameter("signedinterval", "")

(: Search for matching interval patterns :)
let $results :=
  if (string-length($signedinterval) = 0) then
    ()
  else
    for $doc in collection("/db/tunes")//mei:mei
    let $intervalCode := $doc//mei:incipCode[@form="signedinterval"]
    let $pitchCode := $doc//mei:incipCode[@form="pitchclass"]
    where $intervalCode and contains(string($intervalCode), $signedinterval)
    let $id := string($doc//@xml:id[1])
    let $title := string($doc//mei:title[1])
    let $intervalMatch := string($intervalCode)
    let $pitchMatch := string($pitchCode)
    order by $title
    return map {
      "id": $id,
      "label": $title,
      "intervalMatch": $intervalMatch,
      "pitchMatch": $pitchMatch
    }

return map {
  "results": array { $results },
  "count": count($results)
}