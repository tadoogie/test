function renderPsalm(){

  //import 'https://www.verovio.org/javascript/app/verovio-app.js';

 /* const options = {
            defaultView: 'responsive', // default is 'responsive', alternative is 'document'
            defaultZoom: 3, // 0-7, default is 4
            enableResponsive: true, // default is true
            enableDocument: true // default is true
        } */

        //document.getElementById("confirm").innerHTML = "How to use the Verovio App";
        //document.getElementById("confirm").innerHTML = "Verovio is loading...";

        //Get verse texts
var selBoxes = document.getElementsByName("stanzas");
var selStanzas = [];
var c; 
for (c=0; c<selBoxes.length; c++) {
  if (selBoxes[c].checked) {
      selStanzas.push(selBoxes[c].value);
      }
    }

var y = document.getElementById("pstext").value;
var myString = "option[value='" + y + "']";
var pData = document.getElementById("psList").querySelectorAll(myString);
var x = pData[0].getAttribute("id");
var psTxtData = x.split(";");
var psText = "getVerses.xq?textURI=" + psTxtData[0] + "&selStanzas=\"1\," + selStanzas + ",6\"";

var b = document.getElementById("pstune").value;
var myTune = "option[value='" + b + "']";
var tData = document.getElementById("pstunes").querySelectorAll(myTune);
var c = tData[0].getAttribute("id");
var psTunData = c.split(";");
var psTune = psTunData[0];

var xmlhttp = new XMLHttpRequest();

xmlhttp.open("GET", psText, true);
xmlhttp.send(); 

xmlhttp.onreadystatechange = function() {
  if (this.readyState == 4 && this.status == 200) {
    var myObj = this.responseXML;
    var title = myObj.getElementsByTagName("title")[0].childNodes[0].nodeValue;
    var author = myObj.getElementsByTagName("author")[0].childNodes[0].nodeValue;
    var textStanzas = myObj.getElementsByTagName("lg").length;
    var textSyll = myObj.getElementsByTagName("lg")[0].getElementsByTagName("seg").length

    //Get MEI file
    var xhttp = new XMLHttpRequest();

    xhttp.open("GET", psTune, true);
    xhttp.send();

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        var xmlDoc = this.responseXML;
        var project = xmlDoc.getElementsByTagName("mei")[0];
        var y = project.getElementsByTagName("verse");
        var sylCount = y.length;
        var i, j, k, r = "";
        var wordPos = "";
        var tuneMetre = xmlDoc.getElementsByTagName("otherChar")[0].childNodes[0].nodeValue;
        var metreLen = tuneMetre.length;
        var multiMetre = tuneMetre.charAt(metreLen-2);
        var partMetreCheck = tuneMetre.charAt(metreLen-1);

        if (multiMetre === "D"){
          var metreMult = 2;
        } else if (multiMetre === "T"){
          var metreMult = 3;
        } else if (multiMetre === "Q"){
          var metreMult = 4;
        } else {
          var metreMult = 1;
        }

        //Get notes with verse containers
        var containerPos = [];
        for (i = 0; i <sylCount; i++){
          containerPos[i] = y[i].parentElement.getAttribute("class");
        }

        if (partMetreCheck === ")"){
            var startPartMetre = tuneMetre.indexOf("(");
            var partMetre = tuneMetre.substring(startPartMetre+1, metreLen-1);
            var partMetreResult = "true";
            var partMetre = partMetre.slice(0, -1);
            var repeatArray = partMetre.split('.');
            var repeatSum = repeatArray.reduce((partialSum, a) => partialSum + Number(a), 0);
            var sylCount = sylCount - repeatSum;
            var startRepeat = sylCount - repeatSum;
  
          } else {
            var partMetreResult = "false"
          }
        
        var stanzaCount = textStanzas/metreMult;
        var xmlTitleStmt = project.getElementsByTagName("titleStmt");
        var xmlTitle = xmlTitleStmt[0].getElementsByTagName("title");
        var newTitle = xmlDoc.createTextNode(title);
        var titlePos = xmlTitle[0];
        
        if (typeof titlePos.childNodes[0] !== 'undefined') {
          titlePos.childNodes[0].nodeValue = title;
        } else {
          titlePos.appendChild(newTitle);
        }
       
        var work = project.getElementsByTagName("work");
        var tuneTitle = work[0].getElementsByTagName("title")[0].childNodes[0].nodeValue;
        var subTitle = xmlDoc.createElement("title", project.namespaceURI);
        var newTune = xmlDoc.createTextNode("Tune: " + tuneTitle);
        titlePos.parentElement.appendChild(subTitle).appendChild(newTune);
        titlePos.parentElement.lastElementChild.setAttribute("type","subordinate");

        var xmlAuth = project.getElementsByTagName("persName");
        var authPos = xmlAuth[0].parentElement;
        var newPers = xmlDoc.createElement("persName", project.namespaceURI);
        var authUpdate = "Text by " + author
        var newAuth = xmlDoc.createTextNode(authUpdate);
        var lyrDefined = xmlDoc.querySelectorAll("[role='lyricist']");

        if (lyrDefined === undefined || lyrDefined.length == 0){
          authPos.appendChild(newPers).appendChild(newAuth);
          authPos.lastElementChild.setAttribute("role","lyricist");
        } else {
          lyrDefined[0].childNodes[0].nodeValue = authUpdate;
        }

        j = 0

        //Loop through each syllable container in XML
        for (i = 0; i< sylCount; i++){

          //Ready first stanza to fill existing syllable containers 
          var thisContainer = project.getElementsByClassName(containerPos[i])
          var newLyric = myObj.getElementsByTagName("seg");
          var newLyr = newLyric[i].childNodes[0].nodeValue;
          var newLyrLen = newLyr.length;
          var lastChar = newLyr.charAt(newLyrLen-1);
          var newText = xmlDoc.createTextNode(newLyr);
	    var r = i + repeatSum;
          var repeatContainer = project.getElementsByClassName(containerPos[r])
	    var repeatLyr = newLyric[r].childNodes[0].nodeValue;
	    var trimLyr = newLyr.substr(0,newLyrLen-1);
          var trimText = xmlDoc.createTextNode(trimLyr); 

          if (partMetreResult == "true" && i > startRepeat - 1) {
		if (lastChar == "-"){
              //Add new lyr element with trimmed lyric text
              thisContainer[0].lastElementChild.lastElementChild.textContent = newText.textContent;
              repeatContainer[0].lastElementChild.lastElementChild.textContent = newText.textContent;

              //Add appropriate connector attribute for new lyr element
              thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");
              repeatContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");            

                 //Test if the syllable is in an initial or middle position
                 if (wordPos == "i" || wordPos == "m"){
                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                    repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                 } else {            
                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                    repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                 }
              }  else {
              thisContainer[0].lastElementChild.lastElementChild.textContent = newText.textContent
              thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
              thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t");

              repeatContainer[0].lastElementChild.lastElementChild.textContent = newText.textContent
              repeatContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
              repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t");
              }
	   } else {
		if (lastChar == "-"){
              //Add new lyr element with trimmed lyric text
              thisContainer[0].lastElementChild.lastElementChild.textContent = newText.textContent;

              //Add appropriate connector attribute for new lyr element
              thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");          

                 //Test if the syllable is in an initial or middle position
                 if (wordPos == "i" || wordPos == "m"){
                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                 } else {            
                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                 }
              }  else {
              thisContainer[0].lastElementChild.lastElementChild.textContent = newText.textContent;
              thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
              thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t")
              }
	   }
	   //Update the WordPos with the latest WordPos for the next word
          wordPos = thisContainer[0].lastElementChild.lastElementChild.getAttribute("wordpos");
	}
        
        var k = i;

        var halfStanza = Number.isInteger(stanzaCount);
        fullStanza = Math.floor(stanzaCount);

        // If there is more than one stanza  
        j = 1;
        
        if (fullStanza > 1){

          //Loop through each stanza for each note
          for (j = 1; j < fullStanza; j++){
              
              //Loop through each syllable container
              for (i = 0; i< sylCount; i++){

          		//Ready first stanza to fill existing syllable containers 
          		var thisContainer = project.getElementsByClassName(containerPos[i])
	    		var newVerse = xmlDoc.createElement("verse", project.namespaceURI);
	    		var newSyl = xmlDoc.createElement("syl", project.namespaceURI);
          		var newLyr = newLyric[k].childNodes[0].nodeValue;
          		var newLyrLen = newLyr.length;
         		var lastChar = newLyr.charAt(newLyrLen-1);
          		var newText = xmlDoc.createTextNode(newLyr);
	    		var r = i + repeatSum;
          		var repeatContainer = project.getElementsByClassName(containerPos[r])
	    		var repeatLyr = newLyric[r].childNodes[0].nodeValue;
	    		var trimLyr = newLyr.substr(0,newLyrLen-1);
          		var trimText = xmlDoc.createTextNode(trimLyr); 

	    		//Create new verse element with n attribute
          		thisContainer[0].appendChild(newVerse).setAttribute("n",j+1);

          		if (partMetreResult == "true" && i > startRepeat - 1) {
		  
		  		//Create new verse element with n attribute
		  		repeatContainer[0].appendChild(newVerse).setAttribute("n",j+1);

				if (lastChar == "-"){

		  			//Add new lyr element with trimmed lyric text
              			thisContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent;
              			repeatContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent;

              			//Add appropriate connector attribute for new lyr element
              			thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");
              			repeatContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");            

                 			//Test if the syllable is in an initial or middle position
                 			if (wordPos == "i" || wordPos == "m"){
                    			thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m")
                    			repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                 			} else {            
                    			thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                    			repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                 			}
              		}  else {
              			thisContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent
              			thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
              			thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t")

             			repeatContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent
              			repeatContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
              			repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t");
              		}
	   		} else {
				if (lastChar == "-"){
              			//Add new lyr element with trimmed lyric text
              			thisContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent;

              			//Add appropriate connector attribute for new lyr element
              			thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");          

                 			//Test if the syllable is in an initial or middle position
                 			if (wordPos == "i" || wordPos == "m"){
                    			thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                 			} else {            
                    			thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                 			}
              		}  else {
              			thisContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent;
              			thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
              			thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t")
              		}
	   		}
	   
			//Update the WordPos with the latest WordPos for the next word
          		wordPos = thisContainer[0].lastElementChild.lastElementChild.getAttribute("wordpos");
			
            	//Update the syllable counter
            	k = k + 1;
		}
                                  
          }
      } 

          
          //Is there a half stanza at the end?
          if (halfStanza === false){

              var remainder = textStanzas % metreMult;

              //Set the starting container for the final half stanza
              startCount = textSyll* (metreMult - remainder);

              j = j + 1;

              for (i = startCount; i< sylCount; i++){

          //Ready first stanza to fill existing syllable containers 
          var thisContainer = project.getElementsByClassName(containerPos[i])
	    var newVerse = xmlDoc.createElement("verse", project.namespaceURI);
	    var newSyl = xmlDoc.createElement("syl", project.namespaceURI);
          var newLyr = newLyric[k].childNodes[0].nodeValue;
          var newLyrLen = newLyr.length;
          var lastChar = newLyr.charAt(newLyrLen-1);
          var newText = xmlDoc.createTextNode(newLyr);
	    var r = i + repeatSum;
          var repeatContainer = project.getElementsByClassName(containerPos[r])
	    var repeatLyr = newLyric[r].childNodes[0].nodeValue;
	    var trimLyr = newLyr.substr(0,newLyrLen-1);
          var trimText = xmlDoc.createTextNode(trimLyr); 

	    //Create new verse element with n attribute
          thisContainer[0].appendChild(newVerse).setAttribute("n",j);

          if (partMetreResult == "true" && i > startRepeat-1) {

		  //Create new verse element with n attribute
          	  repeatContainer[0].appendChild(newVerse).setAttribute("n",j);

		  if (lastChar == "-"){
              //Add new lyr element with trimmed lyric text
              thisContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent;
              repeatContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent;

              //Add appropriate connector attribute for new lyr element
              thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");
              repeatContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");            

                 //Test if the syllable is in an initial or middle position
                 if (wordPos == "i" || wordPos == "m"){
                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                    repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                 } else {            
                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                    repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                 }
              }  else {
              thisContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent;
              thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
              thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t")

              repeatContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent;
              repeatContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
              repeatContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t")
              }
	   } else {
		if (lastChar == "-"){
              //Add new lyr element with trimmed lyric text
              thisContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent;

              //Add appropriate connector attribute for new lyr element
              thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","d");          

                 //Test if the syllable is in an initial or middle position
                 if (wordPos == "i" || wordPos == "m"){
                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","m");
                 } else {            
                    thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","i");
                 }
              }  else {
              thisContainer[0].lastElementChild.appendChild(newSyl).textContent = newText.textContent;
              thisContainer[0].lastElementChild.lastElementChild.setAttribute("con","s")
              thisContainer[0].lastElementChild.lastElementChild.setAttribute("wordpos","t")
              }
	   }
	   //Update the WordPos with the latest WordPos for the next word
          wordPos = thisContainer[0].lastElementChild.lastElementChild.getAttribute("wordpos");
		
		//Update the syllable counter
                  k = k + 1;	
}             
          }            

      /*var xmlText = new XMLSerializer().serializeToString(xmlDoc);*/
      var xmlText = xmlDoc;
      return xmlText;
      }
    };
  }
};