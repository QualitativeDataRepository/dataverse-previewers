var userMap = new Map();
var codeMap = new Map();
var sourceMap = new Map();
var noteMap = new Map();
var tableWidth = '80%';
var selectedGUIDs = new Array();
var noteDataTable;
var userDataTable;
var codeDataTable;
var sourceDataTable;
var setDataTable;
var tables = new Array();

$(document).ready(function() {
  startPreview(false);
});

function translateBaseHtmlPage() {
  var refiqdaPreviewText = $.i18n("refiqdaPreviewText");
  $('.refiqdaPreviewText').text(refiqdaPreviewText);
}

var zipUrl = '';

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

  // Add a  method that filters results based on whether a GUID exists in the 'Related' hidden column.
  // The idea is that each table puts the GUIDs of all related items (in other tables) in that column so this method
  // becomes a generic way to filter by user, code, source, etc.
  // If there is no filtering or the method is called on the table to filter by, all rows are returned.

  // Check if it hasn't been registered already to avoid duplicates
  if ($.fn.dataTable && !$.fn.dataTable.ext.search.some(fn => fn.name === 'refiqdaFilter')) {
    const refiqdaFilter = function(settings, data, dataIndex) {
      console.log('filtering: ' + dataIndex);
      var filterTerm = $('#filterby');
      if (settings.nTable.id == filterTerm.val() || filterTerm.val() == 'None' || selectedGUIDs.length === 0) {
        return true;
      } else {
        // get current selections - just keep GUIDs and just look for those GUIDs somewhere
        console.log('Deciding');
        console.log(data[0]);
        //console.log($('.notetable tbody tr:eq('+dataIndex+')').html());
        let found = false;
        selectedGUIDs.forEach(guid => {
          console.log("Looking for " + guid);
          
          var rowNode = settings.aoData[dataIndex]?.nTr;
          if (!rowNode) return;
          
          var curGuid = findDataAttribute('data-guid', rowNode.attributes);
          console.log('Examining ' + curGuid);
          // If the current row includes a selected guid in its list of related items (forward/child relationships) then show it
          let matches = findDataAttribute('data-matches', rowNode.attributes);
          console.log('Forward Matching: ' + matches);
          if (matches.includes(guid)) {
            console.log('found'); 
            found = true;
          } else {
            //if the guid for the current row shows up in the list of forward/child relationships for one of the selected items, show it
            let revMatches = $('[data-guid="' + guid + '"]').attr('data-matches');
            if (typeof revMatches === 'undefined') {
              revMatches = '';
            }
            console.log('Rev matches: ' + revMatches);
            console.log('curGUID: ' + curGuid);
            if (revMatches.includes(curGuid)) {
              console.log('rev found');
              found = true;
            }
          }
        });
        return found;
      }
    };
    // Add name property for identification
    refiqdaFilter.name = 'refiqdaFilter';
    $.fn.dataTable.ext.search.push(refiqdaFilter);
  }

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
    userTable.addClass("usertable compact stripe");
    
      // Convert HTMLCollection to array and sort by name
    let usersArray = Array.from(users).sort((a, b) => {
        let nameA = a.getAttribute("name");
        let nameB = b.getAttribute("name");
        return nameA.localeCompare(nameB);
    });
    //Create rows
    for (let user of usersArray) {
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
    //When selections are made, update the array of selected GUIDs and redraw other tables so they get filtered.
    userDataTable.on('select deselect', function(e, dt, type, indexes) {
      if (type === 'row') {
        console.log("clearing sG in user");
        selectedGUIDs = new Array();
        userDataTable.rows({ selected: true }).nodes().to$().each(function(index, element) { 
          selectedGUIDs.push(element.dataset.guid) 
        });
        selectedGUIDs.forEach(guid => { console.log('Added ' + guid); });
        // do something with the ID of the selected items
        tables.filter(function(curTable) { return curTable !== userDataTable }).forEach(table => { table.draw() });
      }
    });
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

    let codeBlock = $('<div/>').width(tableWidth).appendTo($(".preview"));
    codeBlock.append($("<h2/>").html("Codes"));
    // Create table with or without Color column based on whether color attributes exist
    let codeTable;
    if (hasColorAttribute) {
      codeTable = createTable("Codes", "Code", "Description", "Color", "Codable").appendTo(codeBlock);
    } else {
      codeTable = createTable("Codes", "Code", "Description", "Codable").appendTo(codeBlock);
    }
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
      // Add row with or without color based on whether color attributes exist
      let tr;
      if (hasColorAttribute) {
        tr = addRow(codeTable, code.getAttribute("name"), desc, code.getAttribute("color"), code.getAttribute("isCodable"));
      } else {
        tr = addRow(codeTable, code.getAttribute("name"), desc, code.getAttribute("isCodable"));
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
            }
        ];
    }
    
    codeDataTable = new DataTable(".codetable", dataTableConfig);

    tables.push(codeDataTable);
    codeDataTable.on('select deselect', function(e, dt, type, indexes) {
      if (type === 'row') {
        selectedGUIDs = new Array();
        console.log('sg cleared in codes');
        codeDataTable.rows({ selected: true }).nodes().to$().each(function(index, element) { 
          selectedGUIDs.push(element.dataset.guid) 
        });
        selectedGUIDs.forEach(guid => { console.log('Added ' + guid); });
        tables.filter(function(curTable) { return curTable !== codeDataTable }).forEach(table => { table.draw() });
      }
    });
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
              
              let rowData = {
                sourceRef: createSourceReference(source, zipUrl),
                type: selection.nodeName,
                name: selection.getAttribute("name"),
                codes: getCodeNames(selection),
                guid: selection.getAttribute("guid"),
                matches: selectionMatches
              };
              
              // Check if this is a PDFSelection or PlainTextSelection
              if (selection.nodeName === "PDFSelection" || selection.nodeName === "PlainTextSelection") {
                annotationRows.push(rowData);
              } else {
                sourceRows.push(rowData);
              }
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
        
        if (typeof downloadFile === 'function') {
          $("a[data-entry-index]").click(downloadFile);
          $('.annotationtable').on('draw.dt', function() {
            $("a[data-entry-index]").off('click');
            $("a[data-entry-index]").click(downloadFile);
          });
        }
        
        tables.push(annotationDataTable);
        annotationDataTable.on('select deselect', function(e, dt, type, indexes) {
          if (type === 'row') {
            var data = annotationDataTable.rows(indexes).data().toArray().map(row => row.id);
            annotationDataTable[type](indexes).nodes().to$().addClass('custom-selected');
            console.log('uG: ' + annotationDataTable[type](indexes).nodes().to$().attr('data-guid'));
            console.log(annotationDataTable.rows({ selected: true }).count());
            console.log("clearing sG in annotation");
            selectedGUIDs = new Array();
            annotationDataTable.rows({ selected: true }).nodes().to$().each(function(index, element) { selectedGUIDs.push(element.dataset.guid) });
            selectedGUIDs.forEach(guid => { console.log('Added ' + guid); });
            tables.filter(function(curTable) { return curTable !== annotationDataTable }).forEach(table => { table.draw() });
          }
        });
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
        sourceDataTable.on('select deselect', function(e, dt, type, indexes) {
          if (type === 'row') {
            console.log("clearing sG in source");
            selectedGUIDs = new Array();
            sourceDataTable.rows({ selected: true }).nodes().to$().each(function(index, element) { selectedGUIDs.push(element.dataset.guid) });
            selectedGUIDs.forEach(guid => { console.log('Added ' + guid); });
            tables.filter(function(curTable) { return curTable !== sourceDataTable }).forEach(table => { table.draw() });
          }
        });
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
    noteDataTable.on('select deselect', function(e, dt, type, indexes) {
      if (type === 'row') {
        var data = noteDataTable.rows(indexes).data().toArray().map(row => row.id);
        noteDataTable[type](indexes).nodes().to$().addClass('custom-selected');
        console.log('uG: ' + noteDataTable[type](indexes).nodes().to$().attr('data-guid'));
        console.log(noteDataTable.rows({ selected: true }).count());
        console.log("clearing sG in note");
        selectedGUIDs = new Array();
        noteDataTable.rows({ selected: true }).nodes().to$().each(function(index, element) { selectedGUIDs.push(element.dataset.guid) });
        selectedGUIDs.forEach(guid => { console.log('Added ' + guid); });
        // do something with the ID of the selected items
        tables.filter(function(curTable) { return curTable !== noteDataTable }).forEach(table => { table.draw() });
      }
    });
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
    setDataTable.on('select deselect', function(e, dt, type, indexes) {
      if (type === 'row') {
        var data = setDataTable.rows(indexes).data().toArray().map(row => row.id);
        setDataTable[type](indexes).nodes().to$().addClass('custom-selected');
        console.log('uG: ' + setDataTable[type](indexes).nodes().to$().attr('data-guid'));
        console.log(setDataTable.rows({ selected: true }).count());
        console.log("clearing sG in set");
        selectedGUIDs = new Array();
        setDataTable.rows({ selected: true }).nodes().to$().each(function(index, element) { selectedGUIDs.push(element.dataset.guid) });
        selectedGUIDs.forEach(guid => { console.log('Added ' + guid); });
        // do something with the ID of the selected items
        tables.filter(function(curTable) { return curTable !== setDataTable }).forEach(table => { table.draw() });
      }
    });
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
      
      // Destroy and recreate userDataTable
      if (userDataTable) {
        userDataTable.destroy();
      }
      if ($(".usertable").length) {
        userDataTable = new DataTable(".usertable", {
          select: $('#filterby').val() == 'Users',
          order: [[0, 'asc']]
        });
        userDataTable.draw();
      }
      

      // Destroy and recreate codeDataTable
      if (codeDataTable) {
        codeDataTable.destroy();
      }
      if ($(".codetable").length) {
        // Need to check if color column exists before recreating the table
        let hasColorColumn = $('.codetable thead th').length === 4; // 4 columns means Color is present
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
            }
          ];
        }
        codeDataTable = new DataTable(".codetable", codeConfig);
        codeDataTable.draw();
      }
      
      // Destroy and recreate sourceDataTable
      if (sourceDataTable) {
        sourceDataTable.destroy();
      }
      if ($(".sourcetable").length) {
        sourceDataTable = new DataTable(".sourcetable", {
          select: $('#filterby').val() == 'Sources'
        });
        sourceDataTable.draw();
      }

      // Destroy and recreate annotationDataTable
      if (annotationDataTable) {
        annotationDataTable.destroy();
      }
      if ($(".annotationtable").length) {
        annotationDataTable = new DataTable(".annotationtable", {
          select: $('#filterby').val() == 'Annotations'
        });
        annotationDataTable.draw();
      }

      // Destroy and recreate noteDataTable
      if (noteDataTable) {
        noteDataTable.destroy();
      }
      if ($(".notetable").length) {
        noteDataTable = new DataTable(".notetable", {
          select: $('#filterby').val() == 'Notes'
        });
        noteDataTable.draw();
      }
      
      // Destroy and recreate setDataTable
      if (setDataTable) {
        setDataTable.destroy();
      }
      if ($(".settable").length) {
        setDataTable = new DataTable(".settable", {
          select: $('#filterby').val() == 'Sets'
        });
        setDataTable.draw();
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
function addRow(table) {
  let tr = $("<tr/>").appendTo(table.children("tbody"));
  for (var i = 1; i < arguments.length; i++) {
    tr.append($("<td/>").html(arguments[i]));
  }
  return tr;
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
function createSourceReference(source, fileUrl) {
  let path = source.getAttribute("plainTextPath");
  if (!path) {
    path = source.getAttribute("path");
  }
  if (fileUrl) {
    path = path.replace("internal://", "sources/");
    var index = entryMap[path];
    return '<a href="#" data-entry-index="' + index + '">' + source.getAttribute("name") + '<span class="icon glyphicon glyphicon-download-alt"></span></a>';

  } else {
    return '<span title="' + path + '">' + source.getAttribute("name") + '</span>';
  }
}
