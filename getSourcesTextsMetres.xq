xquery version "3.1";
declare namespace tei="http://www.tei-c.org/ns/1.0";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare option output:method "json";

let $sources :=
  for $src in distinct-values(collection("/db/texts")//tei:editionStmt/tei:edition/tei:title[@type="short"])
  let $texts :=
    for $text in collection("/db/texts")[.//tei:editionStmt/tei:edition/tei:title[@type="short"] = $src]
    let $label := string($text//tei:titleStmt/tei:title)
    let $id := string($text//tei:TEI/@xml:id)
    let $metre := string($text//tei:div/@met)
    (: suggested tune: second <note> inside notesStmt (if present) :)
    let $sugg := normalize-space(string($text//tei:notesStmt/tei:note[2]))
    (: sections: for psalms like Psalm 119 that have subsectioning (tei:div/tei:div @name) :)
    let $sections :=
      for $sec in $text//tei:div/tei:div
      let $name := string($sec/@name)
      let $verses := for $lg in $sec//tei:lg[@n] return string($lg/@n)
      return map { "name": $name, "verses": $verses }
    (: flat verses (fallback) :)
    let $verses := for $lg in $text//tei:lg[@n] return string($lg/@n)
    return map {
      "label": $label,
      "id": $id,
      "metre": $metre,
      "suggTune": $sugg,
      "sections": $sections,
      "verses": $verses
    }
  return map {"label": $src, "texts": $texts}

let $metres :=
  for $m in distinct-values(collection("/db/texts")//tei:div/@met)
  return string($m)

return map {
  "sources": $sources,
  "metres": $metres
}
