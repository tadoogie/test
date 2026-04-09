xquery version "3.1";

declare namespace mei="http://www.music-encoding.org/ns/mei";
declare namespace tei="http://www.tei-c.org/ns/1.0";

declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";

declare option output:method "html5";
declare option output:media-type "text/html";

<html>
    <head>
        <title>App Interface</title>
        <script src="https://code.jquery.com/jquery-3.1.1.min.js" type="text/javascript"></script>
        <script src="https://www.verovio.org/javascript/develop/verovio-toolkit.js" type="text/javascript"></script>
        <script type="text/javascript" language="javascript" src="resources/js/midi-player/wildwebmidi.js"></script>
        <script type="text/javascript" language="javascript" src="resources/js/midi-player/midiplayer.js"></script>
        <script src="/resources/js/interface-dev.js" type="text/javascript"></script>
        <script src="/resources/js/app-dev.js" type="text/javascript"></script>
        <link rel="stylesheet" href="resources/css/midiplayer.css" />
        <!--<link rel="stylesheet" type="text/css" href="resources/css/style.css" />-->
<link rel="stylesheet" type="text/css" href="resources/css/nav.css" />
        
    </head>
    <body style="margin: 0px;">
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
        <div style="height: 30px">
            <div id="player" style="z-index: 20; position: absolute; display: none;"></div>
        </div>
        <div class="header"></div>
        <div style="height: 30px;">
            <div id="player" style="z-index: 20; position: absolute; display: none;"></div>
        </div>
        <div id="svg_output"/>
    </body>
</html>
