xquery version "3.1";

import module namespace file = "http://exist-db.org/xquery/file";
import module namespace process = "http://exist-db.org/xquery/process";
import module namespace util = "http://exist-db.org/xquery/util";
import module namespace xmldb = "http://exist-db.org/xquery/xmldb";

declare namespace output = "http://www.w3.org/2010/xslt-xquery-serialization";
declare namespace err = "http://www.w3.org/2005/xqt-errors";

declare option output:method "html5";
declare option output:media-type "text/html";

(: Update these for your server setup. :)
declare variable $python-bin-candidates := (
    "/opt/digital-splitleaf/tei-generator/venv/bin/python3",
    "/usr/bin/python3",
    "/usr/local/bin/python3",
    "/opt/homebrew/bin/python3"
);
declare variable $tei-script-candidates := (
    "/opt/digital-splitleaf/tei-generator/generate_tei_from_texts.py",
    "/Users/luca/IdeaProjects/splitleaf/generate_tei_from_texts.py"
);
declare variable $dba-user := "admin";
declare variable $dba-password := "cAF2q2MYgnX*m4";

declare function local:safe-file-name($name as xs:string?) as xs:string {
    let $raw := normalize-space($name)
    let $base := if ($raw = "") then "upload.txt" else $raw
    return replace($base, "[^A-Za-z0-9._-]", "_")
};

declare function local:sort-generated-files($names as xs:string*) as xs:string* {
    for $name in distinct-values($names)
    let $lc := lower-case($name)
    let $is-psalm-file := matches($lc, "^ps(?:alm-)?\d+[a-z]?\.xml$")
    let $num :=
        if ($is-psalm-file)
        then xs:integer(replace($lc, "^ps(?:alm-)?(\d+)[a-z]?\.xml$", "$1"))
        else 999999
    let $suffix :=
        if ($is-psalm-file)
        then replace($lc, "^ps(?:alm-)?\d+([a-z]?)\.xml$", "$1")
        else ""
    order by
        (if ($is-psalm-file) then 0 else 1),
        $num,
        $suffix,
        $lc
    return $name
};

declare function local:first-existing-path($candidates as xs:string*) as xs:string? {
    (
        for $p in $candidates
        where file:exists($p)
        return $p
    )[1]
};

let $upload := request:get-uploaded-file-data("textFile")[1]
let $upload-name := request:get-uploaded-file-name("textFile")[1]
let $get-uploaded-file-fn := function-lookup(xs:QName("request:get-uploaded-file"), 1)
let $upload-temp :=
    if (exists($get-uploaded-file-fn))
    then $get-uploaded-file-fn("textFile")[1]
    else ()
let $text-content := request:get-parameter("textContent", ())[1]
let $text-file-name := request:get-parameter("fileName", ())[1]
let $effective-name :=
    if (normalize-space($upload-name) != "") then $upload-name
    else if (normalize-space($text-file-name) != "") then $text-file-name
    else "upload.txt"
return
if (empty($upload) and empty($upload-temp) and empty($text-content)) then
    (
        response:set-status-code(400),
        <html>
            <head>
                <title>TEI Generator</title>
            </head>
            <body>
                <h2>No file uploaded</h2>
                <p>Select a <code>.txt</code> file and submit again.</p>
                <p>
                    <a href="upload-tei.html">Back to upload form</a>
                </p>
            </body>
        </html>
    )
else
    let $job-id := util:uuid()
    let $safe-name := local:safe-file-name($effective-name)
    let $work-dir := concat("/tmp/digital-splitleaf-tei-", $job-id)
    let $out-dir := concat($work-dir, "/out")
    let $in-path := concat($work-dir, "/", $safe-name)
    let $login-ok :=
        try {
            xmldb:login("/db", $dba-user, $dba-password)
        } catch * {
            false()
        }
    let $python-bin := if ($login-ok) then local:first-existing-path($python-bin-candidates) else ()
    let $tei-script := if ($login-ok) then local:first-existing-path($tei-script-candidates) else ()
    let $_mk-work := if ($login-ok and not(file:exists($work-dir))) then file:mkdir($work-dir) else ()
    let $_mk-out := if ($login-ok and not(file:exists($out-dir))) then file:mkdir($out-dir) else ()
    let $_write :=
        if (not($login-ok)) then ()
        else if (exists($upload))
        then file:serialize-binary($upload, $in-path)
        else if (exists($upload-temp))
        then file:serialize-binary(file:read-binary($upload-temp), $in-path)
        else file:serialize(
            text {$text-content},
            $in-path,
            <output:serialization-parameters>
                <output:method>text</output:method>
                <output:encoding>UTF-8</output:encoding>
            </output:serialization-parameters>
        )
    let $runtime-error :=
        if (empty($python-bin)) then concat("Python binary not found. Checked: ", string-join($python-bin-candidates, ", "))
        else if (empty($tei-script)) then concat("TEI generator script not found. Checked: ", string-join($tei-script-candidates, ", "))
        else ""
    let $exec-result :=
        if (not($login-ok) or $runtime-error != "") then map { "ok": false(), "exec": (), "error": $runtime-error }
        else
            try {
                map {
                    "ok": true(),
                    "exec": process:execute(
                        ($python-bin, $tei-script, $in-path, $out-dir),
                        <options>
                            <workingDir>{$work-dir}</workingDir>
                            <stdout-encoding>UTF-8</stdout-encoding>
                            <stderr-encoding>UTF-8</stderr-encoding>
                        </options>
                    ),
                    "error": ""
                }
            } catch * {
                map {
                    "ok": false(),
                    "exec": (),
                    "error": concat("Process execution failed: ", $err:description)
                }
            }
    let $exec := $exec-result?exec
    let $exit-code := string(($exec/@exitCode, $exec//@exitCode)[1])
    let $stdout := normalize-space(string-join($exec//stdout//text(), ""))
    let $stderr := normalize-space(string-join(($exec//stderr//text(), $exec-result?error), " "))
    let $files-from-file-module :=
        try {
            for $f in file:list($out-dir)
            where ends-with(lower-case($f), ".xml")
            order by $f
            return $f
        } catch * {
            ()
        }
    let $ls-exec :=
        if (not($login-ok) or empty($exec)) then ()
        else process:execute(
            ("/bin/ls", "-1", $out-dir),
            <options>
                <workingDir>{$work-dir}</workingDir>
                <stdout-encoding>UTF-8</stdout-encoding>
                <stderr-encoding>UTF-8</stderr-encoding>
            </options>
        )
    let $ls-stdout := string-join($ls-exec//stdout//text(), "")
    let $files-from-ls :=
        for $line in tokenize($ls-stdout, "\r?\n|\s+")
        let $name := normalize-space($line)
        where $name != "" and ends-with(lower-case($name), ".xml")
        order by $name
        return $name
    let $raw-files := distinct-values(($files-from-file-module, $files-from-ls))
    let $files :=
        local:sort-generated-files(
            for $raw in $raw-files
            let $expanded := replace($raw, "\.xml", ".xml|")
            for $part in tokenize($expanded, "\|")
            let $name := normalize-space($part)
            where $name != "" and ends-with(lower-case($name), ".xml")
            return $name
        )
    let $ls-stderr := normalize-space(string-join($ls-exec//stderr//text(), ""))
    return
        if (not($login-ok)) then
            (
                response:set-status-code(500),
                <html>
                    <head>
                        <title>TEI Generator</title>
                    </head>
                    <body>
                        <h2>DBA login failed</h2>
                        <p>Configured admin credentials could not authenticate.</p>
                        <p>
                            <a href="upload-tei.html">Back to upload form</a>
                        </p>
                    </body>
                </html>
            )
        else
        <html>
            <head>
                <title>TEI Generator Result</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <style>
                    body {{
                        font-family: Arial, sans-serif;
                        margin: 0;
                        background: #f6f8fa;
                        color: #1f2937;
                    }}
                    main {{
                        max-width: 56rem;
                        margin: 2rem auto;
                        padding: 0 1rem 2rem 1rem;
                    }}
                    .card {{
                        background: #ffffff;
                        border: 1px solid #d0d7de;
                        border-radius: 8px;
                        padding: 1rem 1.2rem;
                        margin-top: 1rem;
                    }}
                    .summary-grid {{
                        display: grid;
                        grid-template-columns: 1fr;
                        gap: 0.5rem;
                    }}
                    .k {{
                        font-weight: 700;
                        margin-right: 0.35rem;
                    }}
                    .success {{
                        border-left: 4px solid #2da44e;
                    }}
                    .warn {{
                        border-left: 4px solid #bf8700;
                    }}
                    .mono {{
                        font-family: Menlo, Consolas, monospace;
                        font-size: 0.93rem;
                        background: #f6f8fa;
                        border: 1px solid #d0d7de;
                        border-radius: 6px;
                        padding: 0.75rem;
                        overflow-x: auto;
                        white-space: pre-wrap;
                    }}
                    ul {{
                        margin: 0.5rem 0 0 0;
                        padding-left: 1.25rem;
                    }}
                    li {{
                        margin: 0.2rem 0;
                    }}
                    a.button {{
                        display: inline-block;
                        margin-top: 0.75rem;
                        text-decoration: none;
                        background: #0d6efd;
                        color: #fff;
                        border-radius: 6px;
                        padding: 0.5rem 0.8rem;
                    }}
                </style>
            </head>
            <body>
                <main>
                    <h2>TEI Generator Result</h2>

                    <section class="card summary-grid">
                        <div>
                            <span class="k">Exit code:</span>
                            <span>{if ($exit-code = "") then "unknown" else $exit-code}</span>
                        </div>
                        <div>
                            <span class="k">Input file:</span>
                            <span>{$safe-name}</span>
                        </div>
                        <div>
                            <span class="k">Output directory:</span>
                            <span>{$out-dir}</span>
                        </div>
                    </section>

                    {
                        if (exists($files)) then
                            <section class="card success">
                                <h3>Generated files ({count($files)})</h3>
                                <a class="button" href="{concat('download-generated.xq?jobId=', encode-for-uri($job-id), '&amp;all=true')}" download="{concat('tei-', $job-id, '.zip')}">Download all (.zip)</a>
                                <ul>
                                    {
                                        for $f in $files
                                        return
                                            <li>
                                                <a href="{concat('download-generated.xq?jobId=', encode-for-uri($job-id), '&amp;fileName=', encode-for-uri($f))}" download="{$f}">{$f}</a>
                                            </li>
                                    }
                                </ul>
                            </section>
                        else
                            <section class="card warn">
                                <p>No XML files were found in the output directory.</p>
                            </section>
                    }

                    {
                        if ($ls-stderr != "") then
                            <section class="card">
                                <h3>ls stderr</h3>
                                <div class="mono">{$ls-stderr}</div>
                            </section>
                        else ()
                    }

                    {
                        if ($stdout != "") then
                            <section class="card">
                                <h3>stdout</h3>
                                <div class="mono">{$stdout}</div>
                            </section>
                        else ()
                    }

                    {
                        if ($stderr != "") then
                            <section class="card">
                                <h3>stderr</h3>
                                <div class="mono">{$stderr}</div>
                            </section>
                        else ()
                    }

                    <a class="button" href="upload-tei.html">Back to upload form</a>
                </main>
            </body>
        </html>
