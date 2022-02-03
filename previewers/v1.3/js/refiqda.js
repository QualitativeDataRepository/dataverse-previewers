
$(document).ready(function() {
    startPreview(true);
});

function translateBaseHtmlPage() {
    var refiqdaPreviewText = $.i18n("refiqdaPreviewText");
    $('.refiqdaPreviewText').text(refiqdaPreviewText);
}
var codeMap = new Map();
function writeContentAndData(data, fileUrl, file, title, authors) {
    addStandardPreviewHeader(file, title, authors);
    options = {
        "stripIgnoreTag": true,
        "stripIgnoreTagBody": ['script', 'head']
    };  // Custom rules

    parser = new DOMParser();
    xmlDoc = parser.parseFromString(data, "text/xml");


    var codebook = xmlDoc.getElementsByTagName("Project");
    //    var codes = codebook[0].getElementsByTagName("Code");
    var codes = xmlDoc.getElementsByTagName("Code");
    if (codes != null) {
        let codeBlock = $('<div/>').width("60%").appendTo($(".preview"));
        codeBlock.append($("<p>").html("Codes"));
        let codeTable = createTable("Code", "Color", "Codable").appendTo(codeBlock);
        codeTable.addClass("codetable compact stripe");

        for (let code of codes) {
            addRow(codeTable, code.getAttribute("name"), code.getAttribute("color"), code.getAttribute("isCodable"));
            codeMap.set(code.getAttribute("guid"), code);

        }
        $(".codetable").DataTable({
            "columnDefs": [
                {
                    // The `data` parameter refers to the data for the cell (defined by the
                    // `data` option, which defaults to the column being worked with, in
                    // this case `data: 0`.
                    "render": function(data, type, row) {
                        return '<span class="colortile" style="background-color:' + data + '">&nbsp;</span>';
                    },
                    "targets": 1
                },
                {
                    // The `data` parameter refers to the data for the cell (defined by the
                    // `data` option, which defaults to the column being worked with, in
                    // this case `data: 0`.
                    "render": function(data, type, row) {
                        return '<input class="codable" disabled type="checkbox" checked="' + data + '"/>';
                    },
                    "width": "20%",
                    "targets": 2
                },
            ]
        });
    }


    let sources = xmlDoc.getElementsByTagName("Sources")[0].childNodes;
    if (sources != null) {
        let sourceBlock = $('<div/>').width("60%").appendTo($(".preview"));
        sourceBlock.append($("<p>").html("<h2>Sources</h2>"));
        let sourceTable = createTable("Name", "Type", "Selection", "Codes").appendTo(sourceBlock);
        sourceTable.addClass("sourcetable compact stripe");

        for (let source of sources) {
            if (source.nodeName.endsWith("Source")) {

                let selections = getSelections(source);
                if (selections != null && selections.length != 0) {
                    selections.forEach(function(selection) {
                        addRow(sourceTable, source.getAttribute("name"), source.nodeName, selection.getAttribute("name"), getCodeNames(selection));
                    });
                }
                else {
                    addRow(sourceTable, source.getAttribute("name"), source.nodeName, "Whole Document", "");
                }
            }

        }
        $(".sourcetable").DataTable();
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
    for (var i = 0; i < arguments.length; i++) {
        tr.append($("<th/>").text(arguments[i]));
    }
    let tableBody = $("<tbody/>").appendTo(table);
    return table;
}
function addRow(table) {
    let tr = $("<tr/>").appendTo(table.children("tbody"));
    for (var i = 1; i < arguments.length; i++) {
        tr.append($("<td/>").html(arguments[i]));
    }
}
function getSelections(source) {
    let children = source.getElementsByTagName("*");
    let selections = [];
    for (let child of children) {
        if (child.nodeName.endsWith("Selection")) {
            console.log(child.getAttribute("name"));
            selections.push(child);
        }
    }
    return selections;

}

function getCodeNames(selection) {
    let codeNames = '';
    let codings = selection.getElementsByTagName("Coding");
    if (codings != null) {
        for (let coding of codings) {
            let codeId = coding.getElementsByTagName("CodeRef")[0].getAttribute("targetGUID");
            let code = codeMap.get(codeId);
            if (code != null) {
                codeNames = codeNames + ' ' + code.getAttribute("name");
            }
        }
    }
    return codeNames;
}
