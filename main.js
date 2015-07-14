var urls = [];
var environments = [];
var envHeaderIds = [];
var envComponents = [];
var components = [];
var jxhr = [];
var jxhr_d = [];
var artifactsTotal = [];
var numEnv = 0;
var numCols = 0;
var projectToEnv = []; //projectToEnv determines the relationship between projects <-> environments;
var data = [];
var csvContent = "data:text/csv;charset=utf-8,";
var encodedUri = encodeURI(csvContent);

//these can be changed:
var baseEnvId = 0; // by default, the first environment is used as a baseline for comparison
var sourceBaseURL = "http://localhost:5000/env/"; //URL where we can find the release notes/manifests for each environment
var defaultProperties = ["deployed_artifact"]; //artifact properties that will be displayed by default
var excludeProperties = ["iodb_id","cmdb_id","artifact_extension","artifact_name","artifact_type","build_name","git_ssh","deployed_build","deployed_version","maven_path","deployment_id"]; //artifact properties to be excluded when generating display
var projectToEnvURL = "http://localhost:5000/projectToEnv"; //URL for the project - environment mapping
//var projectToEnvURL = "http://localhost:8000/get/projectGroupEnv";
 

function updateUI(project) {
    console.log("Running updateUI()");
    
    var component_count = 0;
    var total_artifacts = 0;
    
    updateHeader(project);
    numEnv = environments.length;
    numCols = numEnv + 1;
    if (baseEnvId > numEnv-1) {
        console.log("Reset baseline environment id to 0");
        baseEnvId = 0;
    }
    
    for (var i = 0; i < numEnv; i++) {
        if (jxhr[i].responseJSON && jxhr[i].responseJSON.results) {
            envComponents.push( jxhr[i].responseJSON.results );
        } else continue;
        var list = [];
        for (var j = 0; j < jxhr[i].responseJSON.results.length; j++) {
            list.push( jxhr[i].responseJSON.results[j].project );
        }
        components[i] = list;
    }
    
    createEnvHeaders();
    
    // ----------------------------------------
    // populate data for each artifact in each
    // environment
    // ----------------------------------------
    component_count = envComponents[baseEnvId].length;
    base_components = envComponents[baseEnvId].sort(compare);
    envComponents[baseEnvId] = base_components;
    
    for (var p = 0; p < component_count; p++) {
        var artifact_count = base_components[p].artifacts.length;
        total_artifacts += artifact_count;
        for (var q = 0; q < artifact_count; q++) {                      //for each artifact
            createRowContainer(p,q,base_components[p].artifacts[q]);    //create the container for the row
            createItemContainers(p,q);                                  //create the containers for the each item/artifact in each environment
            for (var i=0; i<numEnv; i++){
                var itemcontainer_id = "c"+p.toString()+"_a"+q.toString()+"_e"+i.toString();
                if (baseEnvId != i) {
                    var comp_id = getComponentId(i,base_components[p].project); //find the index of the component p in environment i based on the project name; returns -1 if not found
                } else comp_id = p;
                if (comp_id >= 0 && typeof(envComponents[i][comp_id]) !== 'undefined' && envComponents[i][comp_id].hasOwnProperty("artifacts")) {
                    //try {
                        $("#"+itemcontainer_id).empty();
                        if (typeof(envComponents[i][comp_id].artifacts[q])!=='undefined' && typeof(base_components[p].artifacts[q])!=='undefined') {
                            for (var x=0; x < defaultProperties.length; x++) {
                                var key = defaultProperties[x];
                                var value = envComponents[i][comp_id].artifacts[q][key];
                                if (value) {
                                    //$("#"+itemcontainer_id).append("<b>" + key + "</b>: "+JSON.stringify(value,undefined,2).replace(/"/g, "")+"\n");
                                    $("#"+itemcontainer_id).append(JSON.stringify(value,undefined,2).replace(/"/g, "")+"\n");   //populate the cell with default keys and values
                                }
                            }
                            if (envComponents[i][comp_id].artifacts[q]['deployed_artifact'] != "") {   //add classes to visually highlight aligned and misaligned artifacts (artifacts with not enough information will be gray by default)
                                if (base_components[p].artifacts[q]['deployed_artifact'] != envComponents[i][comp_id].artifacts[q]['deployed_artifact']) {
                                    $("#"+itemcontainer_id).addClass( "notAligned" );
                                    $("#"+itemcontainer_id).parent().addClass( "notAligned" );
                                } else {
                                    $("#"+itemcontainer_id).parent().addClass( "baseline" ); //versions are identical
                                }
                            }
                        }
                        if (baseEnvId == i) {
                            $("#"+itemcontainer_id).parent().addClass( "baseline" );
                        }
                    //} catch(err) {
                    //    console.log(err.message);
                    //}
                } else continue;
            }
        }
    }
    artifactsTotal[i] = total_artifacts;
    updateColWidth();
    
    // ----------------------------------------
    // generate csv file
    // ----------------------------------------
    data = [];
    artifactList = [];
    for (var e=0; e < numEnv; e++) {
        if (typeof(envComponents[e])!=='undefined'){
            for (var c=0; c < envComponents[e].length; c++) {
                for (var a=0; a < envComponents[e][c]['artifacts'].length; a++) {
                    var artifact = envComponents[e][c]['artifacts'][a];
                    artifactName = artifact['artifact_name'] + "." + artifact['artifact_type'] + "." + artifact['artifact_extension'];
                    if (artifactList.indexOf(artifactName) == -1) {
                        artifactList.push(artifactName);
                    }
                }
            }
        }
    }

    header = ["artifacts"];
    for (var e = 0; e < numEnv; e++) {
        header.push(environments[e].toString());
    }
    data.push(header);
    
    for (var a=0; a < artifactList.length; a++) {
        csvRow = [];
        csvRow.push(artifactList[a]);
        var nameTypeExt = artifactList[a].split(".");
        for (var e=0; e < numEnv; e++) {
            found = false;
            if (typeof(envComponents[e])!=='undefined'){
                for (var c=0; c < envComponents[e].length; c++) {
                    for (var x=0; x < envComponents[e][c]['artifacts'].length; x++) {
                        var artifact = envComponents[e][c]['artifacts'][x];
                        if (artifact['artifact_name'] == nameTypeExt[0] && artifact['artifact_type'] == nameTypeExt[1] && artifact['artifact_extension'] == nameTypeExt[2]) {
                            csvRow.push(artifact['deployed_artifact'].toString());
                            found = true;
                        }
                    }
                }
            }
            if (!found) {
                csvRow.push("");
            }
        }
        data.push(csvRow);
    }
    //console.log(data);
    csvContent = "data:text/csv;charset=utf-8,";
    data.forEach(function(infoArray, index){
        dataString = infoArray.join(",");
        dataString += "\n";
        csvContent += dataString;
    });
    encodedUri = encodeURI(csvContent);
    
    // ----------------------------------------
    // attach click handlers
    // ----------------------------------------    
    $(".itemcontainer").on('click',function(e) {
        var sel = getSelection().toString();
        if (!sel) {
            var id = e.target.id;
            if (id == "") {
                id = e.currentTarget.children[0].id; //sometimes the toggleClass happens first and event.target.id ends up blank
            }
            if ($(this).hasClass("expanded")){
                resetArtifactDetails(id);
            } else {
                appendArtifactDetails(id);
            }
            $(this).toggleClass("expanded");
        }
    });
    
    $(".itemheader").on('click',function(e) {
        var sel = getSelection().toString();
        if (!sel) {
            var id = e.target.id;
            if (id == "") {
                id = e.currentTarget.children[0].id; //sometimes the toggleClass happens first and event.target.id ends up blank
            }
            if ($(this).hasClass("componentDetails")){
                resetComponentDetails(id);
            } else {
                appendComponentDetails(id);
            }
            $(this).toggleClass("componentDetails");
        }
    });
    
    $(".envHeaderItemContainer").on('click',function(e) {
        var id = e.target.id;
        if (id == "") {
            id = e.currentTarget.children[0].id; //sometimes the toggleClass happens first and event.target.id ends up blank
        }
        setBaselineEnv(id);
        cleanupUI();
        updateUI($("#projectSelector").val());
    });
    
    //blurElement(document.body,0);
}

// ----------------------------------------
// Assign click handlers and events
// ----------------------------------------

$(document).ready(function(){
    $("#loading").hide();
    $("#refresh").click(function(){
            clearServerResp();
            cleanupUI();
            $.when($.getJSON(projectToEnvURL, function(data){   //get project->environment mapping JSON from IIDB
                    console.log("Getting JSON from: " + projectToEnvURL);
                    projectToEnv = data;
                    $("#loading").show();
                    }).error(function() { alert("Error while getting Project-Environment mapping from: " + projectToEnvURL); })
                ).done(function() { // after retrieving project->environment mapping successfully
                $.when(getEnvironments()).done(function() { // parse the JSON and send requests to get the manifest for each environment
                    $.each(urls, function(i, url) {
                        jxhr.push( // jxhr is a list of getJSON promises
                            $.getJSON(url, function(resp) {
                                console.log("Getting JSON from: " + url);
                                return resp;
                            }).complete(function() { jxhr_d[i].resolve(); }) // jxhr_d is a list of deferred objects; resolve them after getJSON completes (regardless of success or failure)
                        );
                    });
                    $.when.apply($,jxhr_d).done(function() { // updateUI dependent on completion (regardless of success or failure) of the multiple getJSON requests
                        updateUI($("#projectSelector").val());
                        $("#loading").hide();
                    });
                });
            });
        }
    );
    $("#csv").click(function() {
        var link = document.createElement("a");
        var filename = "projectEnv_"+getDatetimestamp()+".csv";
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        link.click();
    });
});

function compare(a,b) {
    if (typeof(a)=='undefined' || typeof(b)=='undefined' || typeof(a['artifacts'][0])=='undefined' || typeof(b['artifacts'][0])=='undefined' || typeof(a['artifacts'])=='undefined' || typeof(b['artifacts'])=='undefined') {
        return 0;
    }
    if (a['artifacts'][0].artifact_name < b['artifacts'][0].artifact_name) {
        return -1;
    }
    if (a['artifacts'][0].artifact_name > b['artifacts'][0].artifact_name) {
        return 1;
    }
    return 0;
}

function getDatetimestamp () {
    now = new Date();
    year = "" + now.getFullYear();
    month = "" + (now.getMonth() + 1); if (month.length == 1) { month = "0" + month; }
    day = "" + now.getDate(); if (day.length == 1) { day = "0" + day; }
    hour = "" + now.getHours(); if (hour.length == 1) { hour = "0" + hour; }
    minute = "" + now.getMinutes(); if (minute.length == 1) { minute = "0" + minute; }
    second = "" + now.getSeconds(); if (second.length == 1) { second = "0" + second; }
    return year + month + day + hour + minute + second;
}

function getEnvironments() {
    var d1 = new $.Deferred();
    console.log("Initializing environment variables");
    for (var i=0; i<projectToEnv.length; i++) {
        if (projectToEnv[i].Project.toLowerCase() == $("#projectSelector").val()) {
            environments = projectToEnv[i].Environment;
            break;
        } else {
            environments = ["mock"];
        }
    }
    for (var i = 0; i < environments.length; i++) {
        urls.push( sourceBaseURL + environments[i] );
        var deferred = new $.Deferred();
        jxhr_d.push(deferred);
    }
    
    d1.resolve();
    return d1.promise();
}

function clearServerResp() {
    console.log("Clearing cached server responses");
    jxhr = [];
}

function cleanupUI() {
    console.log("Running cleanupUI()");
    //blurElement(document.body,1);
    numEnv = 0;
    numCols = 0;
    envComponents = [];
    components = [];
    urls = [];
    jxhr_d = [];
    $( ".envHeaderContainer" ).remove();
    $( ".container" ).remove();
    $( ".header" ).empty();
}

function getComponentId(env_id,project_name) {
    x = envComponents[env_id];
    if (typeof(x)!=='undefined') {
        for (var c=0; c<x.length; c++) {
            if (x[c].project == project_name) {
                return c;
            }
        }
    }
    return -1;
    //returns -1 if does not exist
}

function updateHeader(project){
    $("#projectName").html( project );
}

function setBaselineEnv(id) {
    var matches = id.match(/e(\d*)/);
    if (matches[1]) {
        baseEnvId = matches[1];
    }
}

function resetArtifactDetails(itemcontainer_id) {
    var matches = itemcontainer_id.match(/c(\d*)_a(\d*)_e(\d*)/);
    var project_name = envComponents[baseEnvId][matches[1]].project;
    var e = matches[3];
    var c = getComponentId(e,project_name);
    var a = matches[2];
    if (typeof envComponents[e][c] !== 'undefined' && envComponents[e][c].hasOwnProperty("artifacts")) {
        try {
            $("#"+itemcontainer_id).empty();
            for (var x=0; x < defaultProperties.length; x++) {
                var key = defaultProperties[x];
                var value = envComponents[e][c].artifacts[a][key];
                if (value) {
                    //$("#"+itemcontainer_id).append("<b>" + key + "</b>: "+JSON.stringify(value,undefined,2).replace(/"/g, "")+"\n");
                    $("#"+itemcontainer_id).append(JSON.stringify(value,undefined,2).replace(/"/g, "")+"\n");
                }
            }
        } catch(err) {
            console.log(err.message);
        }
    }
}

function appendArtifactDetails(itemcontainer_id) {
    var matches = itemcontainer_id.match(/c(\d*)_a(\d*)_e(\d*)/);
    var project_name = envComponents[baseEnvId][matches[1]].project;
    var e = matches[3];
    var c = getComponentId(e,project_name);
    var a = matches[2];

    if (typeof envComponents[e][c] !== 'undefined' && envComponents[e][c].hasOwnProperty("artifacts")) {
        try {
            var artifact = envComponents[e][c].artifacts[a]
            for (var key in artifact) {
                if (defaultProperties.indexOf(key)==-1) {
                    if (excludeProperties.indexOf(key)==-1) {
                        $("#"+itemcontainer_id).append("<b>" + key + "</b>: " + JSON.stringify(artifact[key],undefined,2).replace(/"/g, "")+"\n");
                    }
                }
            }
        } catch(err) {
            console.log(err.message);
        }
    }
}

function resetComponentDetails(itemcontainer_id) {
    var matches = itemcontainer_id.match(/c(\d*)_a(\d*)_header/);
    //var project_name = envComponents[baseEnvId][matches[1]].project;
    var c = matches[1];
    var a = matches[2];
    
    if (typeof envComponents[baseEnvId][c] !== 'undefined') {
        try {
            $( "#"+itemcontainer_id ).empty();
            var artifact = envComponents[baseEnvId][c].artifacts[a];
            var header_text = artifact.artifact_name + " - " + artifact.artifact_extension;
            $( "#"+itemcontainer_id ).append( header_text );
        } catch(err) {
            console.log(err.message);
        }
    }
}

function appendComponentDetails(itemcontainer_id) {
    var matches = itemcontainer_id.match(/c(\d*)_a(\d*)_header/);
    //var project_name = envComponents[baseEnvId][matches[1]].project;
    var c = matches[1];
    var a = matches[2];

    if (typeof envComponents[baseEnvId][c] !== 'undefined') {
        try {
            var component = envComponents[baseEnvId][c]
            $("#"+itemcontainer_id).empty();
            for (var key in component) {
                if (key != 'artifacts') {
                    if (excludeProperties.indexOf(key)==-1) {
                        $("#"+itemcontainer_id).append("<b>" + key + "</b>: " + JSON.stringify(component[key],undefined,2).replace(/"/g, "")+"\n");
                    }
                }
            }
        } catch(err) {
            console.log(err.message);
        }
    }
}

function createEnvHeaders() {
    $( document.body ).append( "<div class='envHeaderContainer'></div>");
    $( ".envHeaderContainer" ).append( "<div class='itemheader'><div class='itemheadertext'></div></div>" );
    for (var i = 0; i < numEnv; i++) {
        envHeaderIds.push("e"+i.toString());
        numComponents = components[i] ? components[i].length : 0;
        $( ".envHeaderContainer" ).append( $( "<div class='envHeaderItemContainer'><div class='envheader' id='" + envHeaderIds[i] + "' title='artifacts: " + numComponents.toString() + "'>" + environments[i].toLowerCase() + "</div></div>" ) );
        //if (baseEnvId == i) {
        //    $( "#"+envHeaderIds[i]).css("border-bottom","1px solid #bbc8c0");
        //}
    }
}

function createRowContainer(comp_id,artifact_id,artifact) {
    var container_id = "c" + comp_id.toString() + "_a" + artifact_id.toString();
    var header_text = artifact.artifact_name + " - " + artifact.artifact_extension;
    $( document.body ).append( "<div class='container' id='" + container_id + "'></div>" );
    $( "#"+container_id ).append( "<div class='itemheader'><div class='itemheadertext' id='" + container_id + "_header'>" + header_text + "</div></div>");
}

function createItemContainers(comp_id,artifact_id) {
    var container_id = "c" + comp_id.toString() + "_a" + artifact_id.toString();
    for (var i = 0; i < numEnv; i++) {
        $( "#"+container_id ).append( $( "<div class='itemcontainer'><div class='item' id='" + container_id + "_" + envHeaderIds[i] + "'></div></div>") );
    }
}

function updateColWidth() {
    var windowWidth = $(window).width();
    var colWidthPercent = Math.floor((((windowWidth/numCols)*0.88)/windowWidth)*100);
    $(".itemcontainer").width(colWidthPercent.toString()+"%");
    $(".envHeaderItemContainer").width(colWidthPercent.toString()+"%");
    $(".itemheader").width(colWidthPercent.toString()+"%");
}

//cosmetic:
//set the css3 blur to an element
function blurElement(element, size){
    var filterVal = 'blur('+size+'px)';
    $(element)
      .css('filter',filterVal)
      .css('webkitFilter',filterVal)
      .css('mozFilter',filterVal)
      .css('oFilter',filterVal)
      .css('msFilter',filterVal);
}
