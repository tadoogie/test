xquery version "3.1";

import module namespace sm="http://exist-db.org/xquery/securitymanager";

(: 1. PROLOG SECTION: All declarations must happen first :)
declare function local:fix-permissions($collection as xs:string) {
    (: Fix the collection itself :)
    sm:chmod(xs:anyURI($collection), "rwxr-xr-x"),
    
    (: Fix all resources inside :)
    for $resource in xmldb:get-child-resources($collection)
    let $resource-path := $collection || "/" || $resource
    return sm:chmod(xs:anyURI($resource-path), "rwxr-xr-x"),
    
    (: Recurse into sub-collections :)
    for $sub-coll in xmldb:get-child-collections($collection)
    return local:fix-permissions($collection || "/" || $sub-coll)
};

(: 2. BODY SECTION: The executing expression goes at the very end :)
let $app-collection := "/db/apps/digital-splitleaf" (: <-- Change to your actual app folder name :)
return 
    local:fix-permissions($app-collection)