xquery version "3.1";
(:  This file grabs the texts that suit the selected metre :)

declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace tei="http://www.tei-c.org/ns/1.0";

declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";

declare variable $metre := request:get-parameter("metre", '*');
declare variable $source := request:get-parameter("source", '*');

declare option output:method "html5";
declare option output:media-type "text/html";

<select name="psList"> {
    for $text in collection("/db/texts")
        order by fn:number(fn:substring($text//tei:titleStmt/tei:title/text(), 7))
        where $text//tei:div/@met = $metre 
            and $text//tei:editionStmt/tei:edition/tei:title = $source 
        return 
            <option value="{$text//tei:titleStmt/tei:title/text()}" id="{base-uri($text)};{$text//tei:div/@met};{$text//tei:note[2]};{$text//tei:lg/@n}">{$text//tei:titleStmt/tei:title/text()}</option>}
            
</select>
