xquery version "3.1";

declare namespace mei = "http://www.music-encoding.org/ns/mei";

let $collection := "/db/tunes/5.5.5.5"

return
<diagnostics>
  <collection-path>{$collection}</collection-path>
  <collection-exists>{xmldb:collection-available($collection)}</collection-exists>
  <total-resources>{count(xmldb:get-child-resources($collection))}</total-resources>
  
  <first-10-files>
  {
    for $resource in subsequence(xmldb:get-child-resources($collection), 1, 10)
    let $path := $collection || "/" || $resource
    let $doc := doc($path)
    return
      <file>
        <name>{$resource}</name>
        <ends-with-xml>{ends-with($resource, '.xml')}</ends-with-xml>
        <ends-with-mei>{ends-with($resource, '.mei')}</ends-with-mei>
        <doc-exists>{exists($doc)}</doc-exists>
        <has-mei-mei>{exists($doc//mei:mei)}</has-mei-mei>
        <root-element>{name($doc/*)}</root-element>
        <root-namespace>{namespace-uri($doc/*)}</root-namespace>
        <has-workList>{exists($doc//mei:workList)}</has-workList>
        <has-staff-1>{exists($doc//mei:staff[@n="1"])}</has-staff-1>
        <has-layer-1>{exists($doc//mei:staff[@n="1"]//mei:layer[@n="1"])}</has-layer-1>
        <note-count>{count($doc//mei:staff[@n="1"]//mei:layer[@n="1"]//mei:note[@pname])}</note-count>
      </file>
  }
  </first-10-files>
</diagnostics>

