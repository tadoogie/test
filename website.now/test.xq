xquery version "3.1";
declare namespace tei="http://www.tei-c.org/ns/1.0";
for $i in collection("/db/texts/")//tei:editionStmt/tei:edition/tei:title
return $i

