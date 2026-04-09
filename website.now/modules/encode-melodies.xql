xquery version "3.1";

declare namespace mei = "http://www.music-encoding.org/ns/mei";
declare namespace output = "http://www.w3.org/2010/xslt-xquery-serialization";

declare option output:method "xml";
declare option output:indent "yes";

(:Convert pitch name to pitch class (0-11) :)
declare function local:pitch-to-class($pitchName as xs:string, $accid as xs:string?) as xs:integer {
  let $basePitch := switch(lower-case($pitchName))
    case "c" return 0
    case "d" return 2
    case "e" return 4
    case "f" return 5
    case "g" return 7
    case "a" return 9
    case "b" return 11
    default return 0
  
  let $accidentalOffset := 
    if (empty($accid) or $accid = "") then 0
    else switch($accid)
      case "s" return 1
      case "f" return -1
      case "ss" return 2
      case "ff" return -2
      case "n" return 0
      case "x" return 2
      default return 0
  
  return ($basePitch + $accidentalOffset) mod 12
};

(:Convert pitch name + octave to MIDI note number :)
declare function local:pitch-to-midi($pitchName as xs:string, $octave as xs:integer, $accid as xs:string?) as xs:integer {
  let $basePitch := switch(lower-case($pitchName))
    case "c" return 0
    case "d" return 2
    case "e" return 4
    case "f" return 5
    case "g" return 7
    case "a" return 9
    case "b" return 11
    default return 0
  
  let $accidentalOffset := 
    if (empty($accid) or $accid = "") then 0
    else switch($accid)
      case "s" return 1
      case "f" return -1
      case "ss" return 2
      case "ff" return -2
      case "n" return 0
      case "x" return 2
      default return 0
  
  return ($octave + 1) * 12 + $basePitch + $accidentalOffset
};

(:Extract pitch classes from melody :)
declare function local:extract-pitch-classes($doc as node()) as xs:integer* {
  let $notes := $doc//mei:staff[@n="1"]//mei:layer[@n="1"]//mei:note[@pname]
  return
    for $note in $notes
    let $pname := string($note/@pname)
    let $accidGes := string($note/@accid.ges)
    let $accid := string($note/@accid)
    let $accidValue := if ($accidGes != "") then $accidGes else if ($accid != "") then $accid else ""
    return local:pitch-to-class($pname, $accidValue)
};

(:Extract MIDI note numbers from melody :)
declare function local:extract-midi-notes($doc as node()) as xs:integer* {
  let $notes := $doc//mei:staff[@n="1"]//mei:layer[@n="1"]//mei:note[@pname]
  return
    for $note in $notes
    let $pname := string($note/@pname)
    let $octave := xs:integer($note/@oct)
    let $accidGes := string($note/@accid.ges)
    let $accid := string($note/@accid)
    let $accidValue := if ($accidGes != "") then $accidGes else if ($accid != "") then $accid else ""
    return local:pitch-to-midi($pname, $octave, $accidValue)
};

(:Calculate signed intervals from MIDI notes :)
declare function local:calculate-signed-intervals($midiNotes as xs:integer*) as xs:integer* {
  for $i in (2 to count($midiNotes))
  return $midiNotes[$i] - $midiNotes[$i - 1]
};

(:Calculate interval classes (0-6) from signed intervals :)
declare function local:refine-interval-classes($signedIntervals as xs:integer*) as xs:integer* {
  for $interval in $signedIntervals
  let $absInterval := abs($interval) mod 12
  return if ($absInterval > 6) then 12 - $absInterval else $absInterval
};

(:Calculate contour using symbols + up - down = same :)
declare function local:calculate-contour($midiNotes as xs:integer*) as xs:string* {
  for $i in (2 to count($midiNotes))
  let $diff := $midiNotes[$i] - $midiNotes[$i - 1]
  return 
    if ($diff = 0) then "="
    else if ($diff > 0) then "+"
    else "-"
};

(:Add incipit codes - handles BOTH workDesc and workList formats :)
declare function local:add-incipit-codes($doc as node(), $pitchClasses as xs:integer*, $intervalClasses as xs:integer*, $signedIntervals as xs:integer*, $contour as xs:string*) as node() {
  let $meiRoot := $doc/mei:mei
  let $meiHeader := $meiRoot/mei:meiHead
  
  (:Check for BOTH old and new formats :)
  let $workList := $meiHeader//mei:workList
  let $workDesc := $meiHeader//mei:workDesc
  
  return
    element {node-name($meiRoot)} {
      $meiRoot/@*,
      for $child in $meiRoot/*
      return
        if ($child instance of element(mei:meiHead)) then
          (:Always create workList structure :)
          local:create-or-update-header($child, $pitchClasses, $intervalClasses, $signedIntervals, $contour)
        else
          $child
    }
};

declare function local:create-or-update-header($header as element(mei:meiHead), $pitchClasses as xs:integer*, $intervalClasses as xs:integer*, $signedIntervals as xs:integer*, $contour as xs:string*) as element(mei:meiHead) {
  let $workList := $header//mei:workList
  let $workDesc := $header//mei:workDesc
  
  return
    element {node-name($header)} {
      $header/@*,
      (:Keep all existing children EXCEPT workDesc and workList :)
      for $child in $header/*
      return
        if ($child instance of element(mei:workList)) then
          (:Update existing workList :)
          local:update-worklist-with-codes($child, $pitchClasses, $intervalClasses, $signedIntervals, $contour)
        else if ($child instance of element(mei:workDesc)) then
          (:Convert workDesc to workList :)
          local:convert-workdesc-to-worklist($child, $pitchClasses, $intervalClasses, $signedIntervals, $contour)
        else
          $child,
      
      (:If neither workList nor workDesc exists, create new workList :)
      if (not($workList) and not($workDesc)) then
        <workList xmlns="http://www.music-encoding.org/ns/mei">
          <work>
            <incip>
              <incipCode form="pitchclass">{string-join($pitchClasses, " ")}</incipCode>
              <incipCode form="intervalclass">{string-join($intervalClasses, " ")}</incipCode>
              <incipCode form="signedinterval">{string-join($signedIntervals, " ")}</incipCode>
              <incipCode form="contour">{string-join($contour, " ")}</incipCode>
            </incip>
          </work>
        </workList>
      else ()
    }
};

declare function local:convert-workdesc-to-worklist($workDesc as element(mei:workDesc), $pitchClasses as xs:integer*, $intervalClasses as xs:integer*, $signedIntervals as xs:integer*, $contour as xs:string*) as element(mei:workList) {
  <workList xmlns="http://www.music-encoding.org/ns/mei">
    {
      for $work in $workDesc/mei:work
      return
        <work>
          {$work/@*}
          {$work/*}
          <incip>
            <incipCode form="pitchclass">{string-join($pitchClasses, " ")}</incipCode>
            <incipCode form="intervalclass">{string-join($intervalClasses, " ")}</incipCode>
            <incipCode form="signedinterval">{string-join($signedIntervals, " ")}</incipCode>
            <incipCode form="contour">{string-join($contour, " ")}</incipCode>
          </incip>
        </work>
    }
  </workList>
};

declare function local:update-worklist-with-codes($workList as element(mei:workList), $pitchClasses as xs:integer*, $intervalClasses as xs:integer*, $signedIntervals as xs:integer*, $contour as xs:string*) as element(mei:workList) {
  element {node-name($workList)} {
    $workList/@*,
    for $work in $workList/mei:work
    return
      element {node-name($work)} {
        $work/@*,
        for $child in $work/*
        return
          if ($child instance of element(mei:incip)) then
            element {node-name($child)} {
              $child/@*,
              $child/*[not(self::mei:incipCode)],
              <incipCode xmlns="http://www.music-encoding.org/ns/mei" form="pitchclass">{string-join($pitchClasses, " ")}</incipCode>,
              <incipCode xmlns="http://www.music-encoding.org/ns/mei" form="intervalclass">{string-join($intervalClasses, " ")}</incipCode>,
              <incipCode xmlns="http://www.music-encoding.org/ns/mei" form="signedinterval">{string-join($signedIntervals, " ")}</incipCode>,
              <incipCode xmlns="http://www.music-encoding.org/ns/mei" form="contour">{string-join($contour, " ")}</incipCode>
            }
          else
            $child,
        if (not($work/mei:incip)) then
          <incip xmlns="http://www.music-encoding.org/ns/mei">
            <incipCode form="pitchclass">{string-join($pitchClasses, " ")}</incipCode>
            <incipCode form="intervalclass">{string-join($intervalClasses, " ")}</incipCode>
            <incipCode form="signedinterval">{string-join($signedIntervals, " ")}</incipCode>
            <incipCode form="contour">{string-join($contour, " ")}</incipCode>
          </incip>
        else ()
      }
  }
};

(:Process collection :)
declare function local:process-collection-recursive($collection as xs:string) {
  <results collection="{$collection}">
  {
    for $resource in xmldb:get-child-resources($collection)
    where ends-with($resource, '.xml') or ends-with($resource, '.mei')
    let $doc := doc($collection || "/" || $resource)
    return
      if ($doc//mei:mei) then
        try {
          let $pitchClasses := local:extract-pitch-classes($doc)
          let $midiNotes := local:extract-midi-notes($doc)
          let $signedIntervals := local:calculate-signed-intervals($midiNotes)
          let $intervalClasses := local:refine-interval-classes($signedIntervals)
          let $contour := local:calculate-contour($midiNotes)
          let $modifiedDoc := local:add-incipit-codes($doc, $pitchClasses, $intervalClasses, $signedIntervals, $contour)
          let $store := xmldb:store($collection, $resource, $modifiedDoc)
          return
            <file path="{$collection}/{$resource}" status="success">
              <pitchClasses>{string-join($pitchClasses, " ")}</pitchClasses>
              <intervalClasses>{string-join($intervalClasses, " ")}</intervalClasses>
              <signedIntervals>{string-join($signedIntervals, " ")}</signedIntervals>
              <contour>{string-join($contour, " ")}</contour>
            </file>
        } catch * {
          <file path="{$collection}/{$resource}" status="error" message="{$err:description}"/>
        }
      else
        <file path="{$collection}/{$resource}" status="skipped" reason="not an MEI file"/>,
    
    for $subcollection in xmldb:get-child-collections($collection)
    return local:process-collection-recursive($collection || "/" || $subcollection)
  }
  </results>
};

(:MAIN EXECUTION :)
let $collection := "/db/tunes/"

return local:process-collection-recursive($collection)