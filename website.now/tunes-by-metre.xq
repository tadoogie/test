xquery version "3.1";

(:~
 : Splitleaf Syllable Editor — tune list by metre.
 :
 : Lists every tune (MEI file) in /db/tunes/{metre}/ so the syllable
 : editor's tune-suggestion dropdown can be populated from your real
 : collection instead of sample data.
 :
 : Deploy at a URL the client can GET (e.g.
 : /exist/apps/splitleaf/tunes-by-metre.xql) and point TUNE_LIST_ENDPOINT
 : in the editor's JS at that path.
 :
 : REQUEST: GET ?metre=8.6.8.6   (no trailing dot — matches the folder name,
 :          not the TEI met="8.6.8.6." attribute, which does have one)
 :
 : RESPONSE, application/json:
 :   { "tunes": [ { "name": "...", "idno": "...", "filename": "..." }, ... ] }
 : — sorted by name, one entry per MEI file found in that metre's folder.
 :
 : CONFIDENCE NOTE: confirmed against two real sample files (agawam.xml,
 : hampton.xml). Tune name comes from workList/work/title — NOT
 : fileDesc/titleStmt/title, which both samples leave as a literal,
 : unused placeholder ("Title"). Identifier comes from fileDesc/pubStmt/
 : identifier, one per file, no @type needed. Both confirmed consistent
 : across both samples, so this should be solid — but if a future tune
 : file doesn't follow this, local:tune-name()/local:tune-idno() below
 : are the only two places that need touching.
 :)

declare namespace response = "http://exist-db.org/xquery/response";
declare namespace request = "http://exist-db.org/xquery/request";
declare namespace mei = "http://www.music-encoding.org/ns/mei";

declare variable $local:TUNES-ROOT := "/db/tunes";

(: ------------------------------------------------------------------ :)
(: Confirmed against real MEI samples — see CONFIDENCE NOTE above.     :)
(: ------------------------------------------------------------------ :)
declare function local:tune-name($mei-doc as document-node()) as xs:string? {
    let $name := $mei-doc//mei:workList/mei:work/mei:title[1]/text()
    return if (exists($name)) then normalize-space($name) else ()
};

declare function local:tune-idno($mei-doc as document-node()) as xs:string? {
    let $idno := $mei-doc//mei:fileDesc/mei:pubStmt/mei:identifier[1]/text()
    return if (exists($idno)) then normalize-space($idno) else ()
};

(: ------------------------------------------------------------------ :)
(: Entry point.                                                       :)
(: ------------------------------------------------------------------ :)
declare function local:handle-request() as xs:string {
    let $metre := request:get-parameter("metre", "")
    return
        if ($metre = "") then
            error(xs:QName("local:bad-request"), "Missing 'metre' query parameter.")
        else
            let $collection-path := $local:TUNES-ROOT || "/" || $metre
            return
                if (not(xmldb:collection-available($collection-path))) then
                    (: Not an error — just means no tunes filed under this metre yet. :)
                    serialize(map { "tunes": array {} }, map { "method": "json" })
                else
                    let $tunes :=
                        for $doc-uri in xmldb:get-child-resources($collection-path)
                        let $mei-doc := doc($collection-path || "/" || $doc-uri)
                        let $name := local:tune-name($mei-doc)
                        let $idno := local:tune-idno($mei-doc)
                        where exists($name) and exists($idno)
                        order by $name
                        return map { "name": $name, "idno": $idno, "filename": $doc-uri }
                    return serialize(map { "tunes": array { $tunes } }, map { "method": "json" })
};

try {
    response:set-header("Content-Type", "application/json"),
    local:handle-request()
} catch * {
    (
        response:set-status-code(if ($err:code = xs:QName("local:bad-request")) then 400 else 500),
        response:set-header("Content-Type", "application/json"),
        serialize(map { "error": $err:description }, map { "method": "json" })
    )
}
