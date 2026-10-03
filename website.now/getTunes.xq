xquery version "3.1";
(:  This file grabs the tunes that suit the meter for the selected text :)
declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace tei="http://www.tei-c.org/ns/1.0";

declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";

declare variable $metre := request:get-parameter("metre", '*');
declare variable $textURI := request:get-parameter("textURI", '*');
declare variable $doubleMetre := string-join(($metre, " D."));
declare variable $tripleMetre := string-join(($metre, " T."));
declare variable $complexMetre := string-join(($metre, "(.*)"));
declare variable $suggDataRaw := request:get-parameter("suggData", "");

declare option output:method "html5";
declare option output:media-type "text/html";

(: Resolve one {target, idno, scope} suggestion item (from the parsed
   suggData JSON) directly against its tune document, addressed by the
   db path encoded in its target URI - no collection scan needed. Returns
   an empty sequence if the tune can't be found, so a broken/stale link
   just degrades to "no button" rather than an error. :)
declare function local:resolve-suggestion($item as map(*)) as map(*)? {
  let $target := $item("target")
  let $path := if (starts-with($target, "https://splitleaf.org"))
               then substring-after($target, "https://splitleaf.org")
               else $target
  let $tuneDoc := try { doc($path) } catch * { () }
  return
    if (exists($tuneDoc)) then
      map {
        "idno": $item("idno"),
        "scope": normalize-space($item("scope")),
        "path": $path,
        "title": ($tuneDoc//mei:work/mei:title/text())[1],
        "date": ($tuneDoc//mei:edition/mei:date/text())[1]
      }
    else ()
};

(: Build tune list :)
let $tuneList :=
  for $tune in collection("/db/tunes")
  let $tune-path := string(base-uri($tune))
  let $tune-path-abs := if (starts-with($tune-path, "/")) then $tune-path else concat("/", $tune-path)
  (: mei:otherChar/mei:work/mei:title/mei:edition/mei:date are each expected
     to be single elements, but nothing enforces that in the data - a tune
     with an accidentally duplicated element here (two <title>s, two
     <date>s, etc.) would make its text() a multi-item sequence. Several
     places below (order by, concat, substring-before) require zero-or-one
     items and throw a type error otherwise - and since a FLWOR's where/order
     by runs across the whole collection, a single malformed tune throws for
     every metre that tune happens to match, not just its own. (...)[1] takes
     just the first value if there happen to be more than one, so malformed
     data degrades gracefully instead of taking down the query. :)
  let $otherChar := ($tune//mei:otherChar/text())[1]
  where $otherChar = $metre
     or $otherChar = $doubleMetre
     or $otherChar = $tripleMetre
     or $otherChar = $complexMetre
     or fn:substring-before($otherChar, "(") = $metre
  order by ($tune//mei:work/mei:title/text())[1] collation "http://www.w3.org/2013/collation/UCA?numeric=yes"
  return
    map {
      "label": concat(($tune//mei:work/mei:title/text())[1], " (", ($tune//mei:edition/mei:date/text())[1], ")"),
      "id": $tune-path-abs
      (: The above only works for the test server. The line below is for the production server :)
      (: "id": base-uri($tune) :)
    }

let $tuneListJs := concat(
  "[",
  string-join(
    for $item in $tuneList
    return concat(
      '{"label":"', replace($item("label"), '"', '\\"'), '","id":"', replace($item("id"), '"', '\\"'), '"}'
    ),
    ","
  ),
  "]"
)

let $tuneLabelsJs := concat(
  "[",
  string-join(
    for $item in $tuneList
    return concat('"', replace($item("label"), '"', '\\"'), '"'),
    ","
  ),
  "]"
)

(: Parse the suggData param (a JSON array of {target, idno, scope}) and
   resolve each entry against its tune document. :)
let $suggArray :=
  if (normalize-space($suggDataRaw) != "") then
    try { parse-json($suggDataRaw) } catch * { array {} }
  else
    array {}

let $suggItems :=
  for $item in $suggArray?*
  let $resolved := local:resolve-suggestion($item)
  where exists($resolved)
  return $resolved

let $suggCount := count($suggItems)
let $suggLabel := if ($suggCount > 1) then "Suggested tunes:" else "Suggested tune:"

return
<span>
  <textarea id="pstuneListData" style="display:none;">{$tuneListJs}</textarea>
  <textarea id="pstuneLabelsData" style="display:none;">{$tuneLabelsJs}</textarea>
  
  {
    (: Output one suggested-tune button per resolved suggestion :)
    if ($suggCount > 0) then
      <span id="pstuneSuggestion">
        <span style="display: block; margin-bottom: 4px; margin-left:8px; margin-top: 10px; font-size:1.1em">{$suggLabel}</span>
        {
          for $s in $suggItems
          let $label := concat($s("title"), " (", $s("date"), ")")
          return
            <span class="tune-suggestion-item" style="display: block;">
              <button type="button" class="verse-btn tune-btn" data-label="{$label}" data-tuneid="{$s("path")}" data-idno="{$s("idno")}" style="width: 100%; display: block;">
                <span class="tune-title" style="display: block;">{$s("title")}</span>
                {
                  if ($s("scope") != "") then
                    <span class="tune-scope">{$s("scope")}</span>
                  else ()
                }
                <span class="tune-date" style="display: block;">{$s("date")}</span>
              </button>
            </span>
        }
      </span>
    else ()
  }
  
  {
    (: Output "Select a different tune:" label :)
    <span id="pstuneFilterLabel" style="display: block; margin-bottom: 4px; margin-top: 20px; margin-left: 8px; font-size: 1.1em">Select a different tune:</span>
  }
  
  <input type="text"
         title="Psalm Tune"
         id="pstune"
         placeholder="[Type here to filter tunes]"
         autocomplete="off"
         style="margin-left: 2px"/>

</span>
