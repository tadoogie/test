xquery version "3.1";
(: This file grabs the number of verses for the selected text :)

declare namespace tei="http://www.tei-c.org/ns/1.0";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";

declare variable $teiID := request:get-parameter("teiID", '*');
(:declare variable $teiID := "1564-Ps10";:)

declare option output:method "html5";
declare option output:media-type "text/html";

(: Construct file path from teiID :)
let $folder := substring-before($teiID, '-')
let $filename := substring-after($teiID, concat($folder, '-'))
let $textURI := concat('/db/texts/', $folder, '/', $filename, '.xml')

return
<div id="verseSelector">
    <p>Select All <label class="switch">
    <input id="selectAll" name="section" value="selectAll" type="checkbox" onclick="toggle(indVerses)" checked="true" />
    <span class="slider round"></span>
</label></p>
<div id="indVerses">
<p>
{

if (($textURI = "/db/texts/1564/Ps119.xml") or ($textURI = "/db/texts/1650/Ps119.xml")) then

        for $s in doc($textURI)//tei:div/tei:div
        let $section := $s/@name/string()
        let $verses := doc($textURI)//tei:lg
        return 
            
            <div id="{$section}"><strong>{$section}</strong>
            <label class="switch">
            <input name="section" value="{$section}" type="checkbox" onclick="secToggle({$section})" checked="true"  />
                        <span class="slider round"></span>
                    </label><br />
            {
                for $v in $s//tei:lg
                where $v/../@name = $section
                let $verse := $v/@n
                return 
                    <span class="verseGroup">{$verse/string()} 
                    <label class="switch">
                        <input name="stanzas" value="{$verse/string()}" type="checkbox" onclick="verseMenu()" checked="true" />
                        <span class="slider round"></span>
                    </label></span>
            }
            </div>
            
else
    for $v in doc($textURI)//tei:lg
    let $verse := $v/@n
    return
            <span class="verseGroup">{$verse/string()}
            <label class="switch">
                <input name="stanzas" value="{$verse/string()}" type="checkbox" onclick="verseMenu()" checked="true" />
                <span class="slider round"></span>
            </label>
            </span>
    }
    <br/>
    </p>
    </div>
    <p class="sidenavSubmenuNote">Select a minimum of two</p>
</div>