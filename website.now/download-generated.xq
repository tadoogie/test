xquery version "3.1";

import module namespace file="http://exist-db.org/xquery/file";
import module namespace process="http://exist-db.org/xquery/process";
import module namespace xmldb = "http://exist-db.org/xquery/xmldb";
declare namespace output = "http://www.w3.org/2010/xslt-xquery-serialization";

declare variable $job := normalize-space((request:get-parameter("jobId", ()), request:get-parameter("job", ""), "")[1]);
declare variable $name := normalize-space((request:get-parameter("fileName", ()), request:get-parameter("file", ""), "")[1]);
declare variable $all := lower-case(normalize-space((request:get-parameter("all", ()), "")[1]));
declare variable $dba-user := "admin";
declare variable $dba-password := "cAF2q2MYgnX*m4";

declare function local:is-safe-job($v as xs:string) as xs:boolean {
    matches($v, "^[A-Za-z0-9-]+$")
};

declare function local:is-safe-file($v as xs:string) as xs:boolean {
    matches($v, "^[A-Za-z0-9._-]+\.xml$")
};

let $base-dir := "/tmp"
let $out-dir := concat($base-dir, "/digital-splitleaf-tei-", $job, "/out")
let $path := concat($out-dir, "/", $name)
let $login-ok :=
    try {
        xmldb:login("/db", $dba-user, $dba-password)
    } catch * {
        false()
    }
return
    if (not($login-ok)) then
        (
            response:set-status-code(500),
            "DBA login failed."
        )
    else if ($job = "") then
        (
            response:set-status-code(400),
            concat("Missing parameters. jobId='", $job, "'")
        )
    else if (not(local:is-safe-job($job))) then
        (
            response:set-status-code(400),
            concat("Unsafe parameters. jobId='", $job, "'")
        )
    else if ($all = ("1", "true", "yes")) then
        if (not(file:exists($out-dir)) or not(file:is-directory($out-dir))) then
            (
                response:set-status-code(404),
                concat("Output directory not found for jobId='", $job, "'.")
            )
        else
            let $files-from-file-module :=
                for $f in file:list($out-dir)
                where ends-with(lower-case($f), ".xml")
                order by $f
                return $f
            let $ls-exec :=
                process:execute(
                    ("/bin/ls", "-1", $out-dir),
                    <options>
                        <workingDir>{concat($base-dir, "/digital-splitleaf-tei-", $job)}</workingDir>
                        <stdout-encoding>UTF-8</stdout-encoding>
                        <stderr-encoding>UTF-8</stderr-encoding>
                    </options>
                )
            let $ls-stdout := string-join($ls-exec//stdout//text(), "")
            let $files-from-ls :=
                for $line in tokenize($ls-stdout, "\r?\n")
                let $n := normalize-space($line)
                where $n != "" and ends-with(lower-case($n), ".xml")
                order by $n
                return $n
            let $files := distinct-values(($files-from-file-module, $files-from-ls))
            let $archive := concat($base-dir, "/digital-splitleaf-tei-", $job, "/tei-", $job, ".zip")
            let $_cleanup := if (file:exists($archive)) then file:delete($archive) else ()
            let $zip-bin :=
                if (file:exists("/usr/bin/zip")) then "/usr/bin/zip"
                else if (file:exists("/bin/zip")) then "/bin/zip"
                else ""
            let $jar-bin :=
                if (file:exists("/usr/bin/jar")) then "/usr/bin/jar"
                else if (file:exists("/bin/jar")) then "/bin/jar"
                else ""
            return
                if (empty($files)) then
                    (
                        response:set-status-code(404),
                        concat("No generated XML files found for jobId='", $job, "'.")
                    )
                else if ($zip-bin = "" and $jar-bin = "") then
                    (
                        response:set-status-code(500),
                        "ZIP utility not available on server (missing zip and jar)."
                    )
                else
                    let $zip-exec :=
                        if ($zip-bin != "") then
                            process:execute(
                                ($zip-bin, "-q", "-r", $archive, "."),
                                <options>
                                    <workingDir>{$out-dir}</workingDir>
                                    <stdout-encoding>UTF-8</stdout-encoding>
                                    <stderr-encoding>UTF-8</stderr-encoding>
                                </options>
                            )
                        else
                            ()
                    let $zip-exit := string(($zip-exec/@exitCode, $zip-exec//@exitCode)[1])
                    let $zip-ok := ($zip-bin != "" and $zip-exit = "0" and file:exists($archive))
                    let $_cleanup-after-zip := if (not($zip-ok) and file:exists($archive)) then file:delete($archive) else ()
                    let $jar-exec :=
                        if (not($zip-ok) and $jar-bin != "") then
                            process:execute(
                                ($jar-bin, "cf", $archive, "."),
                                <options>
                                    <workingDir>{$out-dir}</workingDir>
                                    <stdout-encoding>UTF-8</stdout-encoding>
                                    <stderr-encoding>UTF-8</stderr-encoding>
                                </options>
                            )
                        else
                            ()
                    let $jar-exit := string(($jar-exec/@exitCode, $jar-exec//@exitCode)[1])
                    let $jar-ok := (not($zip-ok) and $jar-bin != "" and $jar-exit = "0" and file:exists($archive))
                    let $zip-stderr := normalize-space(string-join($zip-exec//stderr//text(), ""))
                    let $jar-stderr := normalize-space(string-join($jar-exec//stderr//text(), ""))
                    return
                        if ($zip-ok or $jar-ok) then
                            response:stream-binary(file:read-binary($archive), "application/zip", concat("tei-", $job, ".zip"))
                        else
                            (
                                response:set-status-code(500),
                                concat(
                                    "Could not create archive for jobId='", $job, "'. ",
                                    "zipExit=", $zip-exit, " zipErr='", $zip-stderr, "'. ",
                                    "jarExit=", $jar-exit, " jarErr='", $jar-stderr, "'."
                                )
                            )
    else if ($name = "") then
        (
            response:set-status-code(400),
            concat("Missing parameters. jobId='", $job, "', fileName='", $name, "'")
        )
    else if (not(local:is-safe-file($name))) then
        (
            response:set-status-code(400),
            concat("Unsafe parameters. fileName='", $name, "'")
        )
    else if (not(file:exists($path)) or file:is-directory($path)) then
        (
            response:set-status-code(404),
            concat("File not found. path='", $path, "'")
        )
    else
        let $binary := file:read-binary($path)
        return response:stream-binary($binary, "application/xml", $name)
