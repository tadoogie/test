xquery version "3.1";

declare namespace output = "http://www.w3.org/2010/xslt-xquery-serialization";
declare option output:method "html5";
declare option output:media-type "text/plain";

string-join((
  concat("method=", request:get-method()),
  concat("content-type=", request:get-header("Content-Type")),
  concat("param-names=", string-join(request:get-parameter-names(), ",")),
  concat("uploaded-name=", string-join(request:get-uploaded-file-name("textFile"), ",")),
  concat("uploaded-count=", count(request:get-uploaded-file-data("textFile")))
), codepoints-to-string(10))