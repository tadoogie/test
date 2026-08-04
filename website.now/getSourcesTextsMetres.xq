xquery version "3.1";
declare namespace tei="http://www.tei-c.org/ns/1.0";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare option output:method "json";
declare option output:json-node-output-method "xml";

let $sources :=
  for $src in distinct-values(collection("/db/texts")//tei:editionStmt/tei:edition/tei:title[@type="short"])
  let $texts :=
    array {
      for $text in collection("/db/texts")[.//tei:editionStmt/tei:edition/tei:title[@type="short"] = $src]
      let $label := string($text//tei:titleStmt/tei:title)
      let $id := string($text//tei:TEI/@xml:id)
      let $metre := string($text//tei:div/@met)
      let $sugg := normalize-space(string($text//tei:notesStmt/tei:note[2]))
      let $sections :=
        array {
          for $sec in $text//tei:div/tei:div
          let $name := string($sec/@name)
          let $verses := array { for $lg in $sec//tei:lg[@n] return string($lg/@n) }
          return map { "name": $name, "verses": $verses }
        }
      let $verses := array { for $lg in $text//tei:lg[@n] return string($lg/@n) }
      return map {
        "label": $label,
        "id": $id,
        "metre": $metre,
        "suggTune": $sugg,
        "sections": $sections,
        "verses": $verses
      }
    }
  order by $src
  return map {"label": $src, "texts": $texts}

let $metres :=
  array {
    for $m in distinct-values(collection("/db/texts")//tei:div/@met)
    return string($m)
  }

return map {
  "sources": array { $sources },
  "metres": $metres
}