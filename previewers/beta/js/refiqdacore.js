$(document).ready(function() {
    startPreview(false);
});

function translateBaseHtmlPage() {
    var refiqdaPreviewText = $.i18n("refiqdaPreviewText");
    $('.refiqdaPreviewText').text(refiqdaPreviewText);
}

var codeMap = new Map();
var sourceMap = new Map();
var zipUrl = '';
var tableWidth = '80%';

function parseData(data) {
//    var data = e.target.result;
    parser = new DOMParser();
    xmlDoc = parser.parseFromString(data, "text/xml");


    var codebook = xmlDoc.getElementsByTagName("Project");
    var codes = xmlDoc.getElementsByTagName("Code");
    if (codes != null) {
        let codeBlock = $('<div/>').width(tableWidth).appendTo($(".preview"));
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


  if (xmlDoc.getElementsByTagName("Sources")[0]) {
    let sources = xmlDoc.getElementsByTagName("Sources")[0].childNodes;
    if (sources != null) {
        let sourceBlock = $('<div/>').width(tableWidth).appendTo($(".preview"));
        sourceBlock.append($("<p>").html("<h2>Sources</h2>"));
        let sourceTable = createTable("Name", "Type", "Selection", "Codes").appendTo(sourceBlock);
        sourceTable.addClass("sourcetable compact stripe");

        for (let source of sources) {
            if (source.nodeName.endsWith("Source")) {
                sourceMap.set(source.getAttribute("guid"), source);
                let selections = getSelections(source);
                if (selections != null && selections.length != 0) {
                    selections.forEach(function(selection) {
                        addRow(sourceTable, createSourceReference(source, zipUrl), source.nodeName, selection.getAttribute("name"), getCodeNames(selection));
                    });
                }
                else {
                    addRow(sourceTable, createSourceReference(source, zipUrl), source.nodeName, "Whole Document", "");
                }
            }

        }
        $(".sourcetable").DataTable();
            //Initial page
            $("a[data-entry-index]").click(downloadFile);
            //For new pages
            $('.sourcetable').on( 'draw.dt', function () {
              $("a[data-entry-index]").off('click');
              $("a[data-entry-index]").click(downloadFile);
            });
    }
}

    if (xmlDoc.getElementsByTagName("Sets")[0]) {
        let sets = xmlDoc.getElementsByTagName("Sets")[0].childNodes;
        if (sets != null) {
            let setBlock = $('<div/>').width(tableWidth).appendTo($(".preview"));
            setBlock.append($("<p>").html("<h2>Sets</h2>"));
            let setTable = createTable("Name", "Sources", "Codes").appendTo(setBlock);
            setTable.addClass("settable compact stripe");

            for (let set of sets) {
                console.log(set.nodeName + set.parentNode.nodeName + set.parentNode.nodeValue);
                let codeNames = '';
                let sourceNames = '';
                if (!set.nodeName.endsWith("#text")) {
                    let members = set.getElementsByTagName("MemberCode");
                    for (let member of members) {
                        let codeId = member.getAttribute('targetGUID');
                        let code = codeMap.get(codeId);
                        if (code != null) {
                            codeNames = codeNames + ' ' + code.getAttribute("name");
                        }
                    }

                    members = set.getElementsByTagName("MemberSource");
                    for (let member of members) {
                        let sourceId = member.getAttribute('targetGUID');
                        let source = sourceMap.get(sourceId);
                        if (source != null) {
                            sourceNames = sourceNames + ' ' + source.getAttribute("name");
                        }
                    }

                    addRow(setTable, set.getAttribute("name"), sourceNames, codeNames);
                }
            }
            $(".settable").DataTable();
        }
    }
    if (xmlDoc.getElementsByTagName("Graphs")[0]) {
        let graphs = xmlDoc.getElementsByTagName("Graphs")[0].childNodes;
        if (graphs != null) {
            let graphBlock = $('<div/>').width(tableWidth).appendTo($(".preview"));
            graphBlock.append($("<p>").html("<h2>Graphs</h2>"));
            let elements = [];
            for (let graph of graphs) {
                if (!graph.nodeName.endsWith("#text")) {
                    let vertexes = graph.getElementsByTagName("Vertex");
                    for (let vertex of vertexes) {
                        var data = {};
                        data.id = vertex.getAttribute("guid");
                        data.name = vertex.getAttribute("name");
                        var gnode = {};

                        gnode.data = data;
                        elements.push(gnode);
                    }
                    let edges = graph.getElementsByTagName("Edge");
                    for (let edge of edges) {
                        var data = {};
                        data.id = edge.getAttribute("guid");
                        data.name = "";
                        data.source = edge.getAttribute("sourceVertex");
                        data.target = edge.getAttribute("targetVertex");
                        var gnode = {};
                        gnode.data = data;
                        elements.push(gnode);
                    }
                }
            }
            let cyContainer = $('<div/>').width("100%").height("400px").attr('id', 'cy').appendTo(graphBlock);
            cyContainer.css("background-color", "aliceblue");
            var cy = cytoscape({
                container: cyContainer, // container to render in
                elements: elements,
                style: [ // the stylesheet for the graph
                    {
                        selector: 'node',
                        style: {
                            'background-color': '#666',
                            'label': 'data(name)'
                        }
                    },

                    {
                        selector: 'edge',
                        style: {
                            'width': 3,
                            'line-color': '#ccc',
                            'target-arrow-color': '#ccc',
                            'target-arrow-shape': 'triangle',
                            'curve-style': 'bezier'
                        }
                    }
                ],

                layout: {
                    name: 'cose',
                    rows: 1
                },
                zoom: 1,
                pan: { x: 0, y: 0 },
            });
        }
    }
}

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
function createSourceReference(source, fileUrl) {
    let path = source.getAttribute("plainTextPath");
    if (!path) {
        path = source.getAttribute("path");
    }
    if(fileUrl) {
        path = path.replace("internal://", "sources/");
        var index = entryMap[path];
        return '<a href="#" data-entry-index="' + index + '">' + source.getAttribute("name") + '<span class="icon glyphicon glyphicon-download-alt"></span></a>';
        
    } else {
            return '<span title="' + path + '">' + source.getAttribute("name") + '</span>';
    }
}