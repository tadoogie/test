function getTunes() {
    
    
    var y = document.getElementById("pstext").value;
    var myString = "option[value='" + y + "']";
    var pData = document.querySelectorAll(myString);
    var x = pData[0].getAttribute("id");
    //var x = document.getElementById("pstext").value;
    var psData = x.split(";");
    var textURI = psData[0];
    var metre = psData[1];
    var suggTune = psData[2];
    var intVerses = psData[3];
    var verses = intVerses.split(" ");
    var urlVariable = encodeURI("getTunes.xq?metre=" + metre + "&suggTune=" + suggTune + "&textURI=" + textURI);
    var tuneQuery = new XMLHttpRequest();


    tuneQuery.open("GET", urlVariable, true);
    tuneQuery.send(); 
    
    tuneQuery.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          var verseQuery = new XMLHttpRequest();
          var urlTextVariable = encodeURI("verseDisplay.xq?textURI=" + textURI);
          
          verseQuery.open("GET", urlTextVariable, true);
          verseQuery.send();
          
          verseQuery.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
            
              document.getElementById("tunes").innerHTML = tuneQuery.responseText;

              document.getElementById("selectVerses").innerHTML = "[Select Verses]"
              document.getElementById("verses").innerHTML = verseQuery.responseText;

              document.getElementById("submit").innerHTML = "<button type='button' class='submitbtn' onclick='renderPsalm()'>View Psalm<br/>&nbsp;</button>";
        
              loadcssfile();
            
            }
          }
        
        }
    }
}

/*function verseGenerator(verses) {
    var a = "";
    var verCount = verses.length;
    var outputHTML = "Verses: ";
    var beginHTML = "<label class='switch'\><input name='stanzas' value='";
    var endHTML = "' type='checkbox' checked='true' /\><span class='slider round'\></span\></label\>";
    
    for (a = 0; a < verCount; a++ ) {
        outputHTML = outputHTML + verses[a] + beginHTML + verses[a] + endHTML;
    }

    return outputHTML;
}*/

function loadcssfile(){
    var fileref=document.createElement("link")
    fileref.setAttribute("rel", "stylesheet");
    fileref.setAttribute("type", "text/css");
    fileref.setAttribute("href", "resources/css/toggle.css");

    document.getElementsByTagName("head")[0].appendChild(fileref);
}

function verseMenu(){
  var selVerses = document.getElementById("indVerses").getElementsByTagName("input");
  var verseList = [];
  for (a = 0; a < selVerses.length; a++){
     if (selVerses[a].checked == true){
       verseList.push(selVerses[a].value); 
     } 
  }

  if (document.getElementById("pstext").value == "Psalm 119"){
    var ps119Array = ["ALEPH", "BETH", "GIMEL", "DALETH", "HE", "VAV", "ZAIN", "HETH", "TETH", "YOD", "CAPH", "LAMED", "MEM", "NUN", "SAMECH", "AIN", "PE", "TSADE", "KOPH", "RES", "SHIN", "TAV"];
    verseList = verseList.filter( function(el){return !ps119Array.includes(el);
    });
  }

  
  var rawList = verseList.join(', ');
  var a = 54;
  if (rawList.length > a){
    if (rawList.charAt(a) == ","){
      var sliceSpot = a;
    }
    else if (rawList.charAt(a) == " "){
      var sliceSpot = a-1;
    }
    else if (rawList.charAt(a+1) == ","){
      var sliceSpot = a+1;
    }
    else{
      while (rawList.charAt(a) !== " "){
        a--;
        }
        var sliceSpot = a-1;
      }
    var formatList = rawList.slice(0, sliceSpot);
    var formatList = formatList + "...";
  } else if (rawList == "") {
    var formatList = "[Select Verses]";
  } else {
    var formatList = rawList;    
  }
  document.getElementById("selectVerses").innerHTML = formatList;
}


function myFunction() {
    document.getElementById("myDropdown").classList.toggle("show");
  }
  
function filterFunction() {
    var input, filter, ul, li, a, i;
    input = document.getElementById("myInput");
    filter = input.value.toUpperCase();
    div = document.getElementById("myDropdown");
    a = div.getElementsByTagName("a");
    for (i = 0; i < a.length; i++) {
      txtValue = a[i].getAttribute("name") || a[i].innerText;
      if (txtValue.toUpperCase().indexOf(filter) > -1) {
        a[i].style.display = "";
      } else {
        a[i].style.display = "none";
      }
    }
}

function toggle(section) {
  var parSelect = document.getElementById("selectAll");
  var selection = section.getAttribute("id");
  var selChecks = document.getElementById(selection).getElementsByTagName("input");

  if (parSelect.checked == true) {
    for (a = 0; a < selChecks.length; a++){
      selChecks[a].checked = true;
    }
    document.getElementById("selectVerses").innerHTML = "All";
  }
  else {
    for (a = 0; a < selChecks.length; a++){
      selChecks[a].checked = false;
    } 
    document.getElementById("selectVerses").innerHTML = "[Select Verses]";
  }
}

function secToggle(section) {
  var selection = section.getAttribute("id")
  var selChecks = document.getElementById(selection).getElementsByTagName("input");

  if (selChecks[0].checked == true) {
    for (a = 0; a < selChecks.length; a++){
      selChecks[a].checked = true;
    }
    verseMenu();
  }
  else {
    for (a = 0; a < selChecks.length; a++){
      selChecks[a].checked = false;
    } 
    verseMenu();
  }
}


