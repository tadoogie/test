xquery version "3.1";

declare variable $lgType := "verse";

for $line at $pos in fn:unparsed-text-lines ("db/texts/1564.csv")
    let $columns := fn:tokenize
    ($line, ";")
    
    return <lg type="verse" n="{$pos}">{
        for $column in $columns
        let $syls := tokenize ($column, "\|")
        return <l> {
            for $syl at $sylPos in $syls
            return <seg type="syl" n="{$sylPos}">{$syl}</seg>
            }</l>
    }</lg>
    
