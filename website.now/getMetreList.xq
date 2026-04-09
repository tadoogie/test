xquery version "3.1";
(:  This file grabs the texts that suit the selected metre :)

declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace tei="http://www.tei-c.org/ns/1.0";

declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";

declare variable $source := request:get-parameter("source", '*');

declare option output:method "html5";
declare option output:media-type "text/html";

<div>
    <datalist id="metList">
        <select name="metList">
        {
            for $t in collection("/db/texts")
            group by $met := $t//tei:div/@met
            order by count($t) descending
            where $t//tei:editionStmt/tei:edition/tei:title = $source 
            return
                <option value="{$met}"/>
        }
        </select>
    </datalist>
    <input type="text" list="metList" title="Psalm Metre" id="selMet" placeholder="[Select Metre]" onfocus="this.value=''" onchange="setTexts()"/>
</div>