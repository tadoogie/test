xquery version "3.1";
declare namespace tei = "http://www.tei-c.org/ns/1.0";

(: Get unique, ordered "short" edition titles :)
let $sources :=
  for $i in collection("/db/texts")//tei:editionStmt/tei:edition/tei:title
  group by $d := $i/text()
  where $i/@type = "short"
  order by $d
  return $d

return
  '[
    ' || string-join(
      for $s in $sources
      return '"' || replace($s, '"', '\\"') || '"',
      ", "
    )
  || ']'