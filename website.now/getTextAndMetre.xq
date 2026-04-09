xquery version "3.1";
(:  Combined: loads texts and metres from matching source :)

declare namespace tei="http://www.tei-c.org/ns/1.0";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";

declare variable $source := request:get-parameter("source", '*');
declare variable $defaultMetre := request:get-parameter("defaultMetre", '');

declare option output:method "html5";
declare option output:media-type "text/html";

(: Map the source to its folder :)
let $folder :=
  if ($source = "1564 Psalm Buik") then "/db/texts/1564"
  else if ($source = "1650 Scottish Metrical") then "/db/texts/1650"
  else "/db/texts" (: fallback if unknown source :)

(: Only scan the relevant folder :)
let $sorted :=
  for $text in collection($folder)
  let $title := $text/tei:TEI/tei:teiHeader/tei:fileDesc/tei:titleStmt/tei:title/text()
  order by fn:number(fn:substring($title, 7))
  return $text

(: Psalm text list :)
let $psListJs := concat(
  "[",
  string-join(
    for $text in $sorted
    let $label := $text/tei:TEI/tei:teiHeader/tei:fileDesc/tei:titleStmt/tei:title/text()
    let $teiID := string($text/tei:TEI/@xml:id)
    let $metre := $text//tei:div/@met
    let $tune := $text//tei:notesStmt/tei:note[2]/text()
    let $stanzas := string-join($text//tei:lg/@n, ",")
    return concat(
      '{"label":"', replace($label, '"', '\\"'),
      '","data":"', replace($teiID, '"', '\\"'), ';',
      replace($metre, '"', '\\"'), ';',
      replace($tune, '"', '\\"'), ';',
      $stanzas, '"}'
    ),
    ","
  ),
  "]"
)

let $psLabelsJs := concat(
  "[",
  string-join(
    for $text in $sorted
    let $label := $text/tei:TEI/tei:teiHeader/tei:fileDesc/tei:titleStmt/tei:title/text()
    return concat('"', replace($label, '"', '\\"'), '"'),
    ","
  ),
  "]"
)

(: Metre list :)
let $metreList :=
  for $t in collection("/db/texts")
  group by $met := $t//tei:div/@met
  order by count($t) descending
  where $t//tei:editionStmt/tei:edition/tei:title = $source 
  return map {
    "label": $met,
    "id": $met
  }

let $metreListJs := concat(
  "[",
  string-join(
    for $item in $metreList
    return concat('{"label":"', replace($item("label"), '"', '\\"'), '","id":"', replace($item("id"), '"', '\\"'), '"}'),
    ","
  ),
  "]"
)

let $metreLabelsJs := concat(
  "[",
  string-join(
    for $item in $metreList
    return concat('"', replace($item("label"), '"', '\\"'), '"'),
    ","
  ),
  "]"
)

return
<div id="textAndMetre">
   <div class="menu-item" style="margin-top:0px">
      <span class="menuHead">Text:</span>
      <br/>
      <!-- Psalm Text List -->
      <div id="psTextList">
        <textarea id="psListData" style="display:none;">{ $psListJs }</textarea>
        <textarea id="psLabelsData" style="display:none;">{ $psLabelsJs }</textarea>
        <input type="text"
               title="Psalm Text"
               id="pstext"
               placeholder="Select Psalm..."
               autocomplete="off"
               onfocus="this.value=''"  />
      </div>
  </div>
  <!-- Metre List -->
  <div class="menu-item">
      <span class="menuHead">Metre:</span>
      <br/>
      <div id="psMetreList">
        <textarea id="psMetreListData" style="display:none;">{ $metreListJs }</textarea>
        <textarea id="psMetreLabelsData" style="display:none;">{ $metreLabelsJs }</textarea>
        <input type="text"
               title="Psalm Metre"
               id="selMet"
               placeholder="Select Metre..."
               autocomplete="off"
               value="{ $defaultMetre }" />
      </div>
  </div>
</div>