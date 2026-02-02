
var userMap = new Map();
var codeMap = new Map();
var sourceMap = new Map();
var noteMap = new Map();
var tableWidth = '90%';
var selectedGUIDs = new Array();
var noteDataTable;
var userDataTable;
var codeDataTable;
var sourceDataTable;
var setDataTable;
var tables = new Array();

var textSourceCache = new Map(); // Cache for loaded text files

$(document).ready(function() {
  startPreview(false);
});

function translateBaseHtmlPage() {
  var refiqdaPreviewText = $.i18n("refiqdaPreviewText");
  $('.refiqdaPreviewText').text(refiqdaPreviewText);
}

function addSelectAllAndUnselectButtons(dataTable, tableContainer, tableId) {
  // Add "Unselect All" button next to the table title
  const unselectAllButton = $('<button>Unselect All</button>')
    .addClass('unselect-all-btn')
    .hide()
    .on('click', function() {
      dataTable.rows({ selected: true }).deselect();
    });
  tableContainer.find('h2').first().append(unselectAllButton);

  // Add "Select All" checkbox to the table header
  const selectAllCheckbox = $('<input type="checkbox" title="Select all rows in this table" />');
  $('#' + tableId + ' thead tr').prepend($('<th class="select-all">').append(selectAllCheckbox));
  $('#' + tableId + ' tbody tr').prepend($('<td class="select-all">')); // Placeholder for alignment

  selectAllCheckbox.on('click', function() {
    if (this.checked) {
      dataTable.rows().select();
    } else {
      dataTable.rows().deselect();
    }
  });

  // Show/hide "Unselect All" button and manage "Select All" checkbox state
  dataTable.on('select deselect', function() {
    const selectedRows = dataTable.rows({ selected: true }).count();
    const totalRows = dataTable.rows().count();

    if (selectedRows > 0) {
      unselectAllButton.show();
    } else {
      unselectAllButton.hide();
    }

    selectAllCheckbox.prop('checked', selectedRows === totalRows);
  });
}

var zipUrl = '';

//zipUrl is set in refiqdpx.js - the zip file case
function isZipMode() {
    return typeof zipUrl !== 'undefined' && zipUrl !== null && zipUrl !== '';
}

var wait;
var cy;




function findDataAttribute(name, attrNamedNodeMap) {
  let attr = attrNamedNodeMap[name];
  if (typeof attr !== 'undefined') {
    return attr.nodeValue;
  }
  return '';
}

// Start parsing project file
// This function just adds a loading icon and initial text to the page and then calls parseData2
function parseData(data) {
  $('#waiting').remove();
  wait = $('<div/>').attr('id', 'waiting');
  $('<img/>').width('15%').attr('src', 'images/Loading_icon.gif').appendTo(wait);
    $('<span/>').text('Found Project File. Parsing Contents...').appendTo(wait);
  wait.appendTo($('.preview'));

  new Promise((resolve) => setTimeout(resolve, 500)).then(() => { parseData2(data) });
}

// Reads the project file and walks through the XML creating tables for all the entry types
// Also adds a filter by choice box
function parseData2(data) {

  parser = new DOMParser();
  xmlDoc = parser.parseFromString(data, "text/xml");


    //Add a Filter By option
  let filterBlock = $('<div/>').width(tableWidth).appendTo($(".preview"));
  filterBlock.append($("<h2/>").html("Enable Filtering By"));
  filterBlock.append($("<p/>").html("Select a table and then select entries in that table to filter the other tables."));
  filterBlock.append($('<select/>').prop('id', 'filterby'));
  $('#filterby').append($('<option/>').prop('value', 'None').text('No Filtering'));
  //As tables are created, they will be added to the option list here

  //User table
  var users = xmlDoc.getElementsByTagName("User");
  if (users != null && users.length > 0) {
    $('#filterby').append($('<option/>').prop('value', 'Users').text('Users'));

    let userBlock = $('<div/>').width(tableWidth).appendTo($(".preview"));
    userBlock.append($("<h2>").html("Users"));
    //Users only has a "Name" column
    let userTable = createTable("Users", "Name").appendTo(userBlock);
    userTable.attr('id', 'usertable');
    userTable.addClass("usertable compact stripe");

    //Create rows
    for (let user of users) {
      console.log("adding user row");
      let tr = addRow(userTable, user.getAttribute("name"));
      tr.attr('data-guid', user.getAttribute("guid"));
      userMap.set(user.getAttribute("guid"), user);
    }
    console.log('Done with users');

    userDataTable = new DataTable(".usertable", {
      //Allow table rows to be selectable if this is the filter by table
      select: $('#filterby').val() == 'Users',
      order: [[0, 'asc']]
    });
    //Draw to set order
    userDataTable.draw();
    tables.push(userDataTable);
  }

  console.log("Starting codes");
  var codes = xmlDoc.getElementsByTagName("Code");
  if (codes != null  && codes.length > 0) {
    $('#filterby').append($('<option/>').prop('value', 'Codes').text('Codes'));

    // Check if any codes have a color attribute
    let hasColorAttribute = false;
    for (let code of codes) {
      if (code.getAttribute("color")) {
        hasColorAttribute = true;
        break;
      }
    }

    // Count code usage across all CodeRef elements
    let codeUsageMap = new Map();
    let allCodeRefs = xmlDoc.getElementsByTagName("CodeRef");
    for (let codeRef of allCodeRefs) {
      let targetGUID = codeRef.getAttribute("targetGUID");
      if (targetGUID) {
        codeUsageMap.set(targetGUID, (codeUsageMap.get(targetGUID) || 0) + 1);
      }
    }

    let codeBlock = $('<div/>').width(tableWidth).appendTo($(".preview"));
    codeBlock.append($("<h2/>").html("Codes"));
    // Create table with or without Color column based on whether color attributes exist
    let codeTable;
    if (hasColorAttribute) {
      codeTable = createTable("Codes", "Code", "Description", "Color", "Codable", "# of Uses").appendTo(codeBlock);
    } else {
      codeTable = createTable("Codes", "Code", "Description", "Codable", "# of Uses").appendTo(codeBlock);
    }
    codeTable.attr('id', 'codetable');
    codeTable.addClass("codetable compact stripe");

    for (let code of codes) {
      let desc = code.getElementsByTagName("Description");
      if (desc[0] != null) {
        desc = desc[0].childNodes[0];
        console.log(desc);
      } else {
        desc = "";
      }
      console.log("adding code row");
      
      // Get usage count for this code
      let codeGuid = code.getAttribute("guid");
      let usageCount = codeUsageMap.get(codeGuid) || 0;
      
      // Add row with or without color based on whether color attributes exist
      let tr;
      if (hasColorAttribute) {
        tr = addRow(codeTable, code.getAttribute("name"), desc, code.getAttribute("color"), code.getAttribute("isCodable"), usageCount);
      } else {
        tr = addRow(codeTable, code.getAttribute("name"), desc, code.getAttribute("isCodable"), usageCount);
      }
      tr.attr('data-guid', code.getAttribute("guid"));
      //Currently codes don't appear to have forward links to other data types, so no data-matches attribute
      tr.attr('data-matches', '');
      codeMap.set(code.getAttribute("guid"), code);
    }

    // Configure DataTable with conditional columnDefs
    let dataTableConfig = {
        select: $('#filterby').val() == 'Codes'
    };

    if (hasColorAttribute) {
        dataTableConfig.columnDefs = [
            {
                render: function(data, type, row) {
                    // Check if data is already HTML (to avoid double-rendering)
                    if (type === 'display' && typeof data === 'string' && !data.includes('<span')) {
                        return '<span class="colortile" style="display:block;background-color:' + data + '">&nbsp;</span>';
                    }
                    return data;
                },
                targets: 2
            },
            {
                render: function(data, type, row) {
                    // Check if data is already HTML (to avoid double-rendering)
                    if (type === 'display' && typeof data === 'string' && !data.includes('<input')) {
                        return '<input class="codable" disabled type="checkbox"' + (data === 'true' ? ' checked' : '') + '/>';
                    }
                    return data;
                },
                width: "20%",
                targets: 3
            },
            {
                // Right-align the usage count column
                className: "dt-right",
                targets: 4
            }
        ];
    } else {
        dataTableConfig.columnDefs = [
            {
                render: function(data, type, row) {
                    // Check if data is already HTML (to avoid double-rendering)
                    if (type === 'display' && typeof data === 'string' && !data.includes('<input')) {
                        return '<input class="codable" disabled type="checkbox"' + (data === 'true' ? ' checked' : '') + '/>';
                    }
                    return data;
                },
                width: "20%",
                targets: 2
            },
            {
                // Right-align the usage count column
                className: "dt-right",
                targets: 3
            }
        ];
    }

    codeDataTable = new DataTable(".codetable", dataTableConfig);

    tables.push(codeDataTable);
  }


  if (xmlDoc.getElementsByTagName("Sources")[0]) {
    let sources = xmlDoc.getElementsByTagName("Sources")[0].childNodes;
    if (sources != null && sources.length > 0) {

      // First pass: collect annotations and whole documents separately
      let annotationRows = [];
      let sourceRows = [];

      for (let source of sources) {
        if (source.nodeName.endsWith("Source")) {
          sourceMap.set(source.getAttribute("guid"), source);

          let sourceMatches = source.getAttribute("creatingUser") + source.getAttribute("modifyingUser");
          let selections = getSelections(source);

          if (selections != null && selections.length != 0) {
              selections.forEach(function(selection) {
                  let selectionMatches = sourceMatches + selection.getAttribute("creatingUser") + selection.getAttribute("modifyingUser");
                  selectionMatches = selectionMatches + getCodeRelatedGUIDs(selection);

                  // Get position information for PlainTextSelection
                  let selectionName = selection.getAttribute("name");
                  let startPos = selection.getAttribute("startPosition");
                  let endPos = selection.getAttribute("endPosition");
                  let plainTextPath = source.getAttribute("plainTextPath");
                  let sourceGuid = source.getAttribute("guid");

                  // Create tooltip-enabled name if we have position data
                  let displayName = selectionName;
                  if (startPos && endPos && plainTextPath && (selection.nodeName === "PlainTextSelection" || selection.nodeName === "PDFSelection")) {
                      if (selection.nodeName === "PDFSelection") {
                          let page = selection.getAttribute("page");
                          let firstX = selection.getAttribute("firstX");
                          let firstY = selection.getAttribute("firstY");
                          let secondX = selection.getAttribute("secondX");
                          let secondY = selection.getAttribute("secondY");
                          displayName = createPdfSelectionWithTooltip(selectionName, page, firstX, firstY, secondX, secondY, sourceGuid);
                      } else {
                          displayName = createSelectionWithTooltip(selectionName, startPos, endPos, plainTextPath, sourceGuid);
                      }
                  }

                  annotationRows.push({
                      sourceRef: createSourceReference(source),
                      type: source.nodeName,
                      name: displayName,
                      codes: getCodeNames(selection),
                      guid: selection.getAttribute("guid"),
                      matches: selectionMatches
                  });
              });
          }

          // Add whole document entry to sources
          sourceRows.push({
            sourceRef: createSourceReference(source, zipUrl),
            type: source.nodeName,
            name: "Whole Document",
            codes: "",
            guid: source.getAttribute("guid"),
            matches: sourceMatches
          });
        }
      }


      // Create Annotations table if there are any annotations
      if (annotationRows.length > 0) {
          $('#filterby').append($('<option/>').prop('value', 'Annotations').text('Annotations'));

          let annotationBlock = $('<div/>').width(tableWidth).appendTo($(".preview"));
          annotationBlock.append($("<h2/>").html("Annotations"));
          let annotationTable = createTable("Annotations", "Filename", "Type", "Selection", "Codes").appendTo(annotationBlock);
          annotationTable.addClass("annotationtable compact stripe");

          annotationRows.forEach(function(rowData) {
              let tr = addRow(annotationTable, rowData.sourceRef, rowData.type, rowData.name, rowData.codes);
              tr.attr('data-guid', rowData.guid);
              tr.attr('data-matches', rowData.matches);
          });

          var annotationDataTable = new DataTable(".annotationtable", {
              select: $('#filterby').val() == 'Annotations'
          });

          // Initialize tooltips after table is created (ONLY for annotations table)
          initializeExcerptTooltips();
          initializePdfCoordTooltips();

          if (typeof downloadFile === 'function') {
              $("a[data-entry-index]").click(downloadFile);
              $('.annotationtable').on('draw.dt', function() {
                  $("a[data-entry-index]").off('click');
                  $("a[data-entry-index]").click(downloadFile);
                  // Reinitialize tooltips after redraw (ONLY for annotations)
                  initializeExcerptTooltips();
                  initializePdfCoordTooltips();
              });
          }

          tables.push(annotationDataTable);
      }

      // Create Sources table if there are any sources
      if (sourceRows.length > 0) {
        $('#filterby').append($('<option/>').prop('value', 'Sources').text('Sources'));

        let sourceBlock = $('<div/>').width(tableWidth).appendTo($(".preview"));
        sourceBlock.append($("<h2/>").html("Sources"));
        let sourceTable = createTable("Sources", "Filename", "Type", "Selection", "Codes").appendTo(sourceBlock);
        sourceTable.addClass("sourcetable compact stripe");

        sourceRows.forEach(function(rowData) {
          let tr = addRow(sourceTable, rowData.sourceRef, rowData.type, rowData.name, rowData.codes);
          tr.attr('data-guid', rowData.guid);
          tr.attr('data-matches', rowData.matches);
        });

        sourceDataTable = new DataTable(".sourcetable", {
          select: $('#filterby').val() == 'Sources'
        });

        if (typeof downloadFile === 'function') {
          $("a[data-entry-index]").click(downloadFile);
          $('.sourcetable').on('draw.dt', function() {
            $("a[data-entry-index]").off('click');
            $("a[data-entry-index]").click(downloadFile);
          });
        }

        tables.push(sourceDataTable);
      }

    }
  }


  var notes = xmlDoc.getElementsByTagName("Note");

  if (notes != null && notes.length > 0) {
    $('#filterby').append($('<option/>').prop('value', 'Notes').text('Notes'));
    let noteBlock = $('<div/>').width(tableWidth).appendTo($(".preview"));
    noteBlock.append($("<h2/>").html("Notes"));
    let noteTable = createTable("Notes", "Name", "Content", "Description", "Authors").appendTo(noteBlock);
    noteTable.addClass("notetable compact stripe");

    for (let note of notes) {
      let ptc = note.getElementsByTagName("PlainTextContent");
      if (ptc[0] != null) {
        ptc = ptc[0].childNodes[0];
      }
      let desc = note.getElementsByTagName("Description");
      if (desc[0] != null) {
        desc = desc[0].childNodes[0];
      }
      let matches = '';
      if (note.getAttribute("creatingUser")) {
        matches = matches + note.getAttribute("creatingUser");
      }
      if (note.getAttribute("modifyingUser")) {
        matches = matches + note.getAttribute("modifyingUser");
      }

      let tr = addRow(noteTable, note.getAttribute("name"), ptc, desc, userMap.get(note.getAttribute("creatingUser")).getAttribute("name"));
      tr.attr('data-guid', note.getAttribute("guid"));
      tr.attr('data-matches', matches);

      noteMap.set(note.getAttribute("guid"), note);

    }

    noteDataTable = new DataTable(".notetable", {
      select: $('#filterby').val() == 'Notes'
      //columnDefs:[{target:0,visible:false,seachable:false}]
    });
    tables.push(noteDataTable);
  }

  let sets = xmlDoc.getElementsByTagName("Set");
  if (sets != null && sets.length > 0) {
    $('#filterby').append($('<option/>').prop('value', 'Sets').text('Sets'));
    let setBlock = $('<div/>').width(tableWidth).appendTo($(".preview"));
    setBlock.append($("<h2/>").html("Sets"));
    let setTable = createTable("Sets", "Name", "Sources", "Codes").appendTo(setBlock);
    setTable.addClass("settable compact stripe");

    for (let set of sets) {
      console.log(set.nodeName + set.parentNode.nodeName + set.parentNode.nodeValue);
      let codeNames = '';
      let sourceNames = '';
      let matches = '';

        let members = set.getElementsByTagName("MemberCode");
        for (let member of members) {
          let codeId = member.getAttribute('targetGUID');
          let code = codeMap.get(codeId);
          if (code != null) {
            codeNames = codeNames + ' ' + code.getAttribute("name");
          }
          matches += codeId;
        }

        members = set.getElementsByTagName("MemberSource");
        for (let member of members) {
          let sourceId = member.getAttribute('targetGUID');
          let source = sourceMap.get(sourceId);
          if (source != null) {
            sourceNames = sourceNames + ' ' + source.getAttribute("name");
          }
          matches += sourceId;
        }

        let tr = addRow(setTable, set.getAttribute("name"), sourceNames, codeNames);
        tr.attr('data-matches', matches);
        tr.attr('data-guid', set.getAttribute('guid'));
    }
    setDataTable = new DataTable(".settable", {
      select: $('#filterby').val() == 'Sets'
    });
    tables.push(setDataTable);
  }

    let graphs = xmlDoc.getElementsByTagName("Graph");
    if (graphs != null && graphs.length > 0) {
      let graphBlock = $('<div/>').width(tableWidth).appendTo($(".preview"));
      graphBlock.append($("<h2/>").html("Graphs").append($('<span/>').attr('id', 'reset').text('Reset').addClass('btn btn-default')));

      let elements = [];
      for (let graph of graphs) {
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
      let cyContainer = $('<div/>').width("100%").height("400px").attr('id', 'cy').appendTo(graphBlock);
      cyContainer.css("background-color", "aliceblue");
      cy = cytoscape({
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
      $('#reset').click(function() { cy.fit() });
  }

$("#filterby")
  .change(function() {
    var str = "";
    $("#filterby option:selected").each(function() {
      console.log('Changed to ' + $(this).text());

      // Clear selections when changing filter
      selectedGUIDs = [];
        tables=new Array();

      // Destroy and recreate userDataTable
      if (userDataTable) {
        userDataTable.destroy();
        //Also remove event handlers
        $(".usertable").off('select.dt deselect.dt');
      }
      if ($(".usertable").length) {
        userDataTable = new DataTable(".usertable", {
          select: $('#filterby').val() == 'Users',
          order: [[0, 'asc']]
        });
        attachFilterHandler(userDataTable);
        userDataTable.draw();
        tables.push(userDataTable);
      }


      // Destroy and recreate codeDataTable
      if (codeDataTable) {
        codeDataTable.destroy();
        $(".codetable").off('select.dt deselect.dt');
      }
      if ($(".codetable").length) {
        // Need to check if color column exists before recreating the table
        let hasColorColumn = $('.codetable thead th').length === 5; // 5 columns means Color is present plus # of Uses
        let codeConfig = {
          select: $('#filterby').val() == 'Codes'
        };
        if (hasColorColumn) {
          codeConfig.columnDefs = [
            {
              "render": function(data, type, row) {
                // Check if data is already HTML (to avoid double-rendering)
                if (type === 'display' && typeof data === 'string' && !data.includes('<span')) {
                  return '<span class="colortile" style="display:block;background-color:' + data + '">&nbsp;</span>';
                }
                return data;
              },
              "targets": 2
            },
            {
              "render": function(data, type, row) {
                if (type === 'display' && typeof data === 'string' && !data.includes('<input')) {
                  return '<input class="codable" disabled type="checkbox"' + (data === 'true' ? ' checked' : '') + '/>';
                }
                return data;
              },
              "width": "20%",
              "targets": 3
            },
            {
              // Right-align the usage count column
              className: "dt-right",
              targets: 4
            }
          ];
        } else {
          // No color column, so Codable is at index 2
          codeConfig.columnDefs = [
            {
              "render": function(data, type, row) {
                if (type === 'display' && typeof data === 'string' && !data.includes('<input')) {
                  return '<input class="codable" disabled type="checkbox"' + (data === 'true' ? ' checked' : '') + '/>';
                }
                return data;
              },
              "width": "20%",
              "targets": 2
            },
            {
              // Right-align the usage count column
              className: "dt-right",
              targets: 3
            }
          ];
        }
        codeDataTable = new DataTable(".codetable", codeConfig);
        attachFilterHandler(codeDataTable);
        codeDataTable.draw();
        tables.push(codeDataTable);
      }

      // Destroy and recreate sourceDataTable
      if (sourceDataTable) {
        sourceDataTable.destroy();
        $(".sourcetable").off('select.dt deselect.dt');
      }
      if ($(".sourcetable").length) {
        sourceDataTable = new DataTable(".sourcetable", {
          select: $('#filterby').val() == 'Sources'
        });
        attachFilterHandler(sourceDataTable);
        sourceDataTable.draw();
        tables.push(sourceDataTable);
      }

      // Destroy and recreate annotationDataTable
      if (annotationDataTable) {
        annotationDataTable.destroy();
        $(".annotationtable").off('select.dt deselect.dt');
      }
      if ($(".annotationtable").length) {
        annotationDataTable = new DataTable(".annotationtable", {
          select: $('#filterby').val() == 'Annotations'
        });
        attachFilterHandler(annotationDataTable);
        annotationDataTable.draw();
        tables.push(annotationDataTable);
      }

      // Destroy and recreate noteDataTable
      if (noteDataTable) {
        noteDataTable.destroy();
        $(".notetable").off('select.dt deselect.dt');
      }
      if ($(".notetable").length) {
        noteDataTable = new DataTable(".notetable", {
          select: $('#filterby').val() == 'Notes'
        });
        attachFilterHandler(noteDataTable);
        noteDataTable.draw();
        tables.push(noteDataTable);
      }

      // Destroy and recreate setDataTable
      if (setDataTable) {
        setDataTable.destroy();
        $(".settable").off('select.dt deselect.dt');
      }
      if ($(".settable").length) {
        setDataTable = new DataTable(".settable", {
          select: $('#filterby').val() == 'Sets'
        });
        attachFilterHandler(setDataTable);
        setDataTable.draw();
        tables.push(setDataTable);
      }
    });
  });


  $('#waiting').remove();
}

function createTable() {
  let table = $("<table/>");
  table.prop('id', arguments[0]);
  let tr = $("<tr/>").appendTo($("<thead/>").appendTo(table));
  for (var i = 1; i < arguments.length; i++) {
    tr.append($("<th/>").text(arguments[i]));
  }
  let tableBody = $("<tbody/>").appendTo(table);
  return table;
}

function addRow(table, ...values) {
  let tr = $('<tr/>');
  values.forEach(function(value) {
    let td = $('<td/>');
    // Check if value is a jQuery object
    if (value instanceof jQuery) {
      td.append(value);
    } else {
      td.html(value || '');
    }
    td.appendTo(tr);
  });
  tr.appendTo(table);
  return tr;
}

// Helper function to attach the filtering logic
function attachFilterHandler(dataTable) {
  //When selections are made, update the array of selected GUIDs and redraw other tables so they get filtered.
  dataTable.on('select deselect', function(e, dt, type, indexes) {
    if (type === 'row') {
      selectedGUIDs = new Array();
      dataTable.rows({ selected: true }).nodes().to$().each(function(index, element) {
        selectedGUIDs.push(element.dataset.guid);
      });
      // Filter all other tables using the CURRENT `tables` array
      tables.filter(curTable => curTable !== dataTable).forEach(table => {
        table.search.fixed('refiqdaFilter', selectedGUIDs.length === 0 ? null : createRefiqdaFilterFunction(table));
        table.draw();
      });
    }
  });
}

  // Add a  method that filters results based on whether a GUID exists in the 'Related' hidden column.
  // The idea is that each table puts the GUIDs of all related items (in other tables) in that column so this method
  // becomes a generic way to filter by user, code, source, etc.
  // If there is no filtering or the method is called on the table to filter by, all rows are returned.

function createRefiqdaFilterFunction(dataTable) {
  return function(searchStr, data, index) {
    // console.log('Filtering: ' + index);

    if (selectedGUIDs.length === 0) {
      return true;
    }

    var rowNode = dataTable.row(index).node();
    
    if (!rowNode) {
      console.log('No row node found for index: ' + index);
      return true;
    }

    var curGuid = $(rowNode).attr('data-guid');
    var matches = $(rowNode).attr('data-matches') || '';

    let found = false;
    for (let guid of selectedGUIDs) {
      if (!guid) continue;
      
      if (matches.includes(guid)) {
        found = true;
        break;
      }
      let revMatches = $('[data-guid="' + guid + '"]').attr('data-matches') || '';
      if (revMatches.includes(curGuid)) {
        found = true;
        break;
      }
    }
    // console.log('Result: ' + found);
    return found;
  };
}

function getSelections(source) {
  let children = source.getElementsByTagName("*");
  let selections = [];
  for (let child of children) {
    if (child.nodeName.endsWith("Selection")) {
      //    console.log(child.getAttribute("name"));
      selections.push(child);
    }
  }
  return selections;
}

function getCodeRelatedGUIDs(selection) {
  let codeGUIDs = '';
  let codings = selection.getElementsByTagName("Coding");
  if (codings != null) {
    for (let coding of codings) {
      let codeId = coding.getElementsByTagName("CodeRef")[0].getAttribute("targetGUID");
      let userId = coding.getAttribute('creatingUser');
      codeGUIDs = codeGUIDs + codeId + userId;
    }
  }
  return codeGUIDs;
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

// Update the createSelectionWithTooltip function to use a simpler data structure
function createSelectionWithTooltip(selectionName, startPos, endPos, plainTextPath, sourceGuid) {
    // Create a span with data attributes that we'll use for the tooltip
    let spanHtml = '<span class="selection-with-excerpt" ' +
        'data-start="' + startPos + '" ' +
        'data-end="' + endPos + '" ' +
        'data-path="' + plainTextPath + '" ' +
        'data-source-guid="' + sourceGuid + '">' +
        selectionName +
        '</span>';
    
    return spanHtml;
}

function createPdfSelectionWithTooltip(selectionName, page, firstX, firstY, secondX, secondY, sourceGuid) {
    // Create a span with data attributes for the tooltip
    let spanHtml = '<span class="selection-with-pdf-coords" ' +
        'data-page="' + page + '" ' +
        'data-first-x="' + firstX + '" ' +
        'data-first-y="' + firstY + '" ' +
        'data-second-x="' + secondX + '" ' +
        'data-second-y="' + secondY + '" ' +
        'data-source-guid="' + sourceGuid + '">' +
        selectionName +
        '</span>';
    
    return spanHtml;
}

function formatPdfCoordsTooltip(page, firstX, firstY, secondX, secondY) {
    return `
        <div style="padding: 8px; font-family: sans-serif;">
            Page: ${page}<br>
            From: (${firstX}, ${firstY})<br>
            To: (${secondX}, ${secondY})
        </div>
    `;
}

function initializePdfCoordTooltips() {
    $('.selection-with-pdf-coords').each(function() {
        const $span = $(this);
        // Check if tooltip has already been initialized
        if ($span.data('tooltip-initialized')) {
            return;
        }
        $span.data('tooltip-initialized', true);

        const page = $span.data('page');
        const firstX = $span.data('first-x');
        const firstY = $span.data('first-y');
        const secondX = $span.data('second-x');
        const secondY = $span.data('second-y');

        // Add the class that triggers the tooltip CSS
        $span.addClass('selection-tooltip');

        // Format the content for the tooltip
        const tooltipHtml = formatPdfCoordsTooltip(page, firstX, firstY, secondX, secondY);

        // Create and append the tooltip content element
        const $tooltipContent = $('<div class="tooltip-content"></div>').html(tooltipHtml);
        $span.append($tooltipContent);
    });
}

function createSourceReference(source) {
    let sourceName = source.getAttribute("name");
    let plainTextPath = source.getAttribute("plainTextPath");
    
    if (isZipMode()) {
        // In zip mode, create a link that uses the zip entry
        if (typeof entryMap !== 'undefined' && plainTextPath && entryMap[plainTextPath] !== undefined) {
            let entryIndex = entryMap[plainTextPath];
            return '<a href="#" data-entry-index="' + entryIndex + '">' + sourceName + '</a>';
        } else {
            // No link if file not found in zip
            return sourceName;
        }
    } else {
        // In non-zip mode, create a direct link to the file if it exists
        if (plainTextPath) {
            return '<a href="' + plainTextPath + '" target="_blank">' + sourceName + '</a>';
        } else {
            return sourceName;
        }
    }
}

function formatExcerptTooltip(excerpt, startPos, endPos) {
    //const maxLength = 300; // Increased since we're getting exact excerpts
    let displayExcerpt = excerpt;
    
    // Trim whitespace
    displayExcerpt = displayExcerpt.trim();
    
    //if (displayExcerpt.length > maxLength) {
    //    displayExcerpt = displayExcerpt.substring(0, maxLength) + '...';
    //}
    
    // Escape HTML to prevent injection, but preserve line breaks
    displayExcerpt = displayExcerpt
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    
    return `
        <div style="padding: 8px; font-family: sans-serif;">
            <div style="font-weight: bold; margin-bottom: 6px; font-size: 11px; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 4px;">
                Text Excerpt (Position ${startPos}-${endPos})
            </div>
            <div style="font-size: 13px; line-height: 1.5; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word;">
                "${displayExcerpt}"
            </div>
        </div>
    `;
}

// Update the initializeExcerptTooltips function with better error handling
function initializeExcerptTooltips() {
    // Destroy any existing Tippy instances to avoid duplicates
    $('.selection-with-excerpt, .selection-with-pdf-coords').each(function() {
        if (this._tippy) {
            this._tippy.destroy();
        }
    });

    // Initialize Tippy for all selection elements
    tippy('.selection-with-excerpt, .selection-with-pdf-coords', {
        content: 'Loading...',
        allowHTML: true,
        interactive: true,
        theme: 'light-border',
        maxWidth: 450,
        placement: 'top',
        trigger: 'mouseenter focus',
        delay: [200, 0], // 200ms delay on show, 0ms on hide
        onShow(instance) {
            const element = instance.reference;
            
            // If content is already loaded, show it immediately
            if (element.getAttribute('data-tooltip-loaded') === 'true') {
                return; // Content already set, just show the tooltip
            }

            if (element.classList.contains('selection-with-pdf-coords')) {
                // Handle PDF coordinate tooltips
                const page = element.getAttribute('data-page');
                const firstX = element.getAttribute('data-first-x');
                const firstY = element.getAttribute('data-first-y');
                const secondX = element.getAttribute('data-second-x');
                const secondY = element.getAttribute('data-second-y');

                const formattedContent = formatPdfCoordsTooltip(page, firstX, firstY, secondX, secondY);
                instance.setContent(formattedContent);
                element.setAttribute('data-tooltip-loaded', 'true');

            } else if (element.classList.contains('selection-with-excerpt')) {
                // Handle text excerpt tooltips
                const startPos = parseInt(element.getAttribute('data-start'));
                const endPos = parseInt(element.getAttribute('data-end'));
                const plainTextPath = element.getAttribute('data-path');
                const sourceGuid = element.getAttribute('data-source-guid');

                // Set loading state
                instance.setContent('<div style="padding: 8px;"><em>Loading excerpt...</em></div>');

                // Load the excerpt asynchronously
                loadTextExcerpt(plainTextPath, startPos, endPos, sourceGuid)
                    .then(excerpt => {
                        if (excerpt) {
                            const formattedContent = formatExcerptTooltip(excerpt, startPos, endPos);
                            instance.setContent(formattedContent);
                            element.setAttribute('data-tooltip-loaded', 'true');
                        } else {
                            instance.setContent('<div style="padding: 8px; color: #999;"><em>Could not load excerpt</em></div>');
                        }
                    })
                    .catch(error => {
                        console.error('Error loading excerpt:', error);
                        instance.setContent(`<div style="padding: 8px; color: #d32f2f;"><em>Error: ${error.message || 'Could not load excerpt'}</em></div>`);
                    });
            }
        },
        onHidden(instance) {
            // Optional: Clear loading state when hidden
            // This allows the tooltip to reload if shown again
            // Remove this if you want to keep cached content
            // instance.reference.removeAttribute('data-tooltip-loaded');
        }
    });
}

// Function to load text excerpt from file
async function loadTextExcerpt(plainTextPath, startPos, endPos, sourceGuid) {
    try {
        // Check cache first - cache the full text to avoid repeated zip reads
        if (textSourceCache.has(sourceGuid)) {
            const fullText = textSourceCache.get(sourceGuid);
            return fullText.substring(startPos, endPos);
        }

        // For zip mode, use the fetchTextExcerpt function from refiqdpx.js
        if (isZipMode() && typeof fetchTextExcerpt === 'function') {
            // fetchTextExcerpt already handles the substring extraction
            let bagPath = plainTextPath.replace("internal://","sources/");
            const excerpt = await fetchTextExcerpt(bagPath, startPos, endPos);
            
            // Note: We're not caching here because fetchTextExcerpt is efficient
            // and only fetches the bytes we need. If you want to cache full files
            // for multiple excerpts from the same file, you'd need to modify
            // fetchTextExcerpt to optionally return the full text
            return excerpt;
        } else {
            // Fallback for non-zip mode (direct file access)
            const response = await fetch(plainTextPath);
            if (!response.ok) {
                console.warn('Could not load file:', plainTextPath);
                return null;
            }
            const fileContent = await response.text();
            
            // Cache the full text for future excerpts from the same file
            textSourceCache.set(sourceGuid, fileContent);
            
            // Return the excerpt
            return fileContent.substring(startPos, endPos);
        }
    } catch (error) {
        console.error('Error loading text excerpt:', error);
        return null;
    }
}
