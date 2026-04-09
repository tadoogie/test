xquery version "3.1";

declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace tei="http://www.tei-c.org/ns/1.0";

declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";

declare option output:method "html5";
declare option output:media-type "text/html";

<html>
    <head>
        <title>Test Interface</title>
         <script src="resources/js/test.js"></script>
        <script src="resources/js/render-test.js"></script>
        <script src="https://www.verovio.org/javascript/app/verovio-app.js"></script>
        <!--<link rel="stylesheet" type="text/css" href="resources/css/style.css" />-->
        <link rel="stylesheet" type="text/css" href="resources/css/nav.css" />
    </head>
    <body>
        <div class="navbar">
            <a href="app.xq">Reset<br/>&#160;</a>
            <div class="navSelect">Text<br/> 
                <datalist id="psList">
                {
                    for $text in collection("/db/texts")
                    order by fn:number(fn:substring($text//tei:titleStmt/tei:title/text(), 7))
                    return
                        <option label="{$text//tei:div/@met}" value="{$text//tei:titleStmt/tei:title/text()}" id="{base-uri($text)};{$text//tei:div/@met};{$text//tei:note[2]};{$text//tei:lg/@n}"/>
                }
                </datalist>
                <input type="text" list="psList" title="Psalm Text" id="pstext" placeholder="Start Typing" onchange="getTunes()"></input>
            </div>
            <div class="navSelect">Tune<br/>
                <span id="tunes">[Select Psalm]</span>
            </div>
            <div class="dropdown">
                <button class="dropbtn">Verses<br/>
                <span id="selectVerses">[Select Psalm]</span><span class="selArrow"><img src="resources/images/arrow.png" width="10px"/></span>
                </button>
                <div class="dropdown-content">
                    <div id="verses"></div>
                </div>
            </div>
            
            <div class="dropdown" id="submit"></div>
        </div>
        <p id="demo"></p>
        <div class="header"></div>
        <div id="app">
            <h1>Getting Started</h1>
            <ol>
                <li>Select the Psalm text you wish to sing by clicking on "Start Typing". Typing into this box will allow you to search by psalm number or by meter.</li>
                <li>Select a tune. When a tune has been suggested for a particular psalm, that is provided by default. However, you may select any other tune from the "Tune" dropdown.</li>
                <li>Select a <strong>minimum of two</strong> verses you wish to sing from the "Verses" section. (NOTE: this is the biblical verses, not the stanzas)</li>
                <li>Click on "View Psalm" to show your text and tune selections</li>
            </ol>
        </div>
        <script src="resources/js/datalist.polyfill.min.js"></script>

    </body>
</html>