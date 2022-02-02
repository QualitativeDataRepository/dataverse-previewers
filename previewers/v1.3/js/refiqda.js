$(document).ready(function() {
    startPreview(true);
});

function translateBaseHtmlPage() {
    var refiqdaPreviewText = $.i18n( "refiqdaPreviewText" );
    $( '.refiqdaPreviewText' ).text( refiqdaPreviewText );
}

function writeContentAndData(data, fileUrl, file, title, authors) {
    addStandardPreviewHeader(file,title, authors);
    options = {"stripIgnoreTag":true,
        "stripIgnoreTagBody":['script','head']};  // Custom rules

    parser = new DOMParser();
    xmlDoc = parser.parseFromString(data,"text/xml");


    var codebook = xmlDoc.getElementsByTagName("Project");
    var codes = codebook[0].getElementsByTagName("Code");
        if(codes!=null) {
                let codeBlock=$('<div/>').width("60%").appendTo($(".preview"));
                        codeBlock.append($("<p>").html("Codes"));
let codeTable = createTable("Code", "Color", "Is Codable").appendTo(codeBlock);
                codeTable.addClass("codetable compact stripe");

 for(let code of codes) {
         addRow(codeTable, code.getAttribute("name"), code.getAttribute("color")?code.getAttribute("color"):"black", code.getAttribute("isCodable"));

    }
                $(".codetable").DataTable();
        }
}

        /*
    var sources = codebook[0].getElementsByTagName("TextSource");
    for (let source of sources) {
        $('.preview').append($("<div/>").html("<p>Source: " + source.getAttribute('name') + "</p>"));
    }
    var sets = codebook[0].getElementsByTagName("Set");
    for (let set of sets) {
                let sdiv = $('<p/>');
            sdiv.html("<p>Set: " + set.getAttribute('name') + "</p>");
            $('.preview').append(sdiv);
            var members=set.getElementsByTagName("MemberCode");
            for(let member of members) {
 let foundCode = xmlDoc.querySelector("[guid='" + member.getAttribute('targetGUID') + "']");
                    if(foundCode !== null) {
                    sdiv.append($('<p/>').html(xmlDoc.querySelector("[guid='" + member.getAttribute('targetGUID') + "']").getAttribute('name')));
                    } else {
                    sdiv.append($('<p/>').html("Code with GUID: " + member.getAttribute('targetGUID') + " not found in file"));
            }
    }
            var membersS=set.getElementsByTagName("MemberSource");
            for(let memberS of membersS) {
               let foundSource = xmlDoc.querySelector("[guid='" + memberS.getAttribute('targetGUID') + "']");
                    if(foundSource !== null) {
               sdiv.append($('<p/>').html(xmlDoc.querySelector("[guid='" + memberS.getAttribute('targetGUID') + "']").getAttribute('name')));
                    } else {
                    sdiv.append($('<p/>').html("Source with GUID: " + memberS.getAttribute('targetGUID') + " not found in file"));
            }
            }
}A*/
        function createTable() {
                let table = $("<table/>");
                let tr = $("<tr/>").appendTo($("<thead/>").appendTo(table));
        for (var i=0; i < arguments.length; i++) {
                tr.append($("<th/>").text(arguments[i]));
  }
                let tableBody=$("<tbody/>").appendTo(table);
                return table;
}
function addRow(table) {
let tr = $("<tr/>").appendTo(table.children("tbody"));
        for (var i=1; i < arguments.length; i++) {
                tr.append($("<td/>").html(arguments[i]));
  }
}

