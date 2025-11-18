// === CDI Previewer: Tree Rendering & Node/Property Display ===

// Track which nodes have been rendered to avoid duplicates
let renderedNodes = new Set();

function renderData() {
  console.log(
    "🎨 RENDER START - SPARQL executed:",
    sparqlTargetCache.executed,
    "Cache size:",
    Object.keys(sparqlTargetCache.results).length
  );

  const content = $("#content");
  content.empty();
  renderedNodes.clear(); // Reset for each render

  if (!jsonData || !jsonData["@graph"]) {
    content.html('<div class="alert alert-warning">No data to display</div>');
    return;
  }

  // Build tree structure: find which nodes are referenced by others
  const allNodeIds = new Set(jsonData["@graph"].map((n) => n["@id"]));
  const referencedIds = new Set();

  jsonData["@graph"].forEach((node) => {
    Object.keys(node).forEach((key) => {
      if (key !== "@id" && key !== "@type" && key !== "@context") {
        const value = node[key];
        const refs = extractNodeReferences(value);
        refs.forEach((ref) => referencedIds.add(ref));
      }
    });
  });

  // Root nodes are those not referenced by any other node
  const rootNodes = jsonData["@graph"].filter(
    (n) => !referencedIds.has(n["@id"])
  );

  // Render root nodes (they will recursively render their children)
  rootNodes.forEach((node, index) => {
    const nodeCard = renderNodeTree(node, index, 0);
    content.append(nodeCard);
  });
}

// Extract all @id references from a value (handles arrays, nested objects, and string references)
function extractNodeReferences(value) {
  const refs = [];
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (typeof item === "object" && item["@id"]) {
        refs.push(item["@id"]);
      } else if (typeof item === "string" && isNodeReference(item)) {
        refs.push(item);
      }
    });
  } else if (typeof value === "object" && value !== null && value["@id"]) {
    refs.push(value["@id"]);
  } else if (typeof value === "string" && isNodeReference(value)) {
    refs.push(value);
  }
  return refs;
}

// Check if a string value looks like a node reference
function isNodeReference(str) {
  if (typeof str !== "string") return false;
  // Check if it starts with # or _: (common node ID patterns)
  if (str.startsWith("#") || str.startsWith("_:")) {
    // Verify this ID actually exists in the graph
    return jsonData["@graph"].some((n) => n["@id"] === str);
  }
  return false;
}

function renderNodeTree(node, index, depth) {
  const id = node["@id"] || `_:blank${index}`;
  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];

  // Mark this node as rendered
  renderedNodes.add(id);

  // Only indent depth > 0 with a constant 8px (not cumulative since nodes are nested)
  const card = $("<div>")
    .addClass("node-card tree-node")
    .attr("data-node-id", id);
  if (depth > 0) {
    card.css("margin-left", "8px");
  }

  // Header with collapse functionality
  const header = $("<div>").addClass("node-header");
  const leftSide = $("<div>")
    .css("display", "flex")
    .css("align-items", "center");
  leftSide.append(
    $("<span>")
      .addClass("glyphicon glyphicon-chevron-down collapse-icon")
      .css("margin-right", "10px")
  );
  leftSide.append($("<span>").addClass("node-id").text(id));
  types.forEach((type) => {
    if (type) {
      leftSide.append($("<span>").addClass("node-type").text(type));
    }
  });
  header.append(leftSide);

  // Add click handler to collapse/expand
  header.click(function () {
    card.toggleClass("collapsed");
  });

  card.append(header);

  // Body with properties
  const body = $("<div>").addClass("node-body");
  if (!isEditMode) {
    body.addClass("view-mode");
  }

  // Render all properties except @id and @type
  Object.keys(node).forEach((key) => {
    if (key !== "@id" && key !== "@type" && key !== "@context") {
      const propertyRow = renderPropertyTree(key, node[key], id, types, depth);
      body.append(propertyRow);
    }
  });

  card.append(body);

  // Add property suggestions in edit mode
  if (isEditMode && shaclShapesStore) {
    const suggestions = getPropertySuggestions(node, types);

    if (suggestions.length > 0) {
      const suggestionsSection = createPropertySuggestionsSection(
        suggestions,
        id,
        body
      );
      card.append(suggestionsSection);
    } else {
      // Even with no SHACL suggestions, allow adding custom properties
      const emptySection = $("<div>").addClass("add-property-section");
      emptySection.append(
        $("<h4>")
          .text("Add Properties")
          .css({ "margin-top": "0", "margin-bottom": "10px" })
      );
      const addCustomBtn = $("<button>")
        .addClass("btn btn-default")
        .html(
          '<span class="glyphicon glyphicon-edit"></span> Add Custom Property'
        )
        .click(function () {
          const propName = prompt("Enter custom property name:");
          if (propName) {
            addPropertyToNode(id, propName, "", body);
          }
        });
      emptySection.append(addCustomBtn);
      card.append(emptySection);
    }
  }

  return card;
}

function renderNode(node, index) {
  const id = node["@id"] || `_:blank${index}`;
  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];

  const card = $("<div>").addClass("node-card").attr("data-node-id", id);

  // Header with collapse functionality
  const header = $("<div>").addClass("node-header");
  const leftSide = $("<div>")
    .css("display", "flex")
    .css("align-items", "center");
  leftSide.append(
    $("<span>")
      .addClass("glyphicon glyphicon-chevron-down collapse-icon")
      .css("margin-right", "10px")
  );
  leftSide.append($("<span>").addClass("node-id").text(id));
  types.forEach((type) => {
    if (type) {
      leftSide.append($("<span>").addClass("node-type").text(type));
    }
  });
  header.append(leftSide);

  // Add click handler to collapse/expand
  header.click(function () {
    card.toggleClass("collapsed");
  });

  card.append(header);

  // Body with properties
  const body = $("<div>").addClass("node-body");
  if (!isEditMode) {
    body.addClass("view-mode");
  }

  // Render all properties except @id and @type
  Object.keys(node).forEach((key) => {
    if (key !== "@id" && key !== "@type" && key !== "@context") {
      const propertyRow = renderProperty(key, node[key], id, types);
      body.append(propertyRow);
    }
  });

  card.append(body);

  // Add property suggestions in edit mode
  if (isEditMode && shaclShapesStore) {
    const suggestions = getPropertySuggestions(node, types);

    if (suggestions.length > 0) {
      const suggestionsSection = createPropertySuggestionsSection(
        suggestions,
        id,
        body
      );
      card.append(suggestionsSection);
    } else {
      // Even with no SHACL suggestions, allow adding custom properties
      const emptySection = $("<div>").addClass("add-property-section");
      emptySection.append(
        $("<h4>")
          .text("Add Properties")
          .css({ "margin-top": "0", "margin-bottom": "10px" })
      );
      const addCustomBtn = $("<button>")
        .addClass("btn btn-default")
        .html(
          '<span class="glyphicon glyphicon-edit"></span> Add Custom Property'
        )
        .click(function () {
          const propName = prompt("Enter custom property name:");
          if (propName) {
            addPropertyToNode(id, propName, "", body);
          }
        });
      emptySection.append(addCustomBtn);
      card.append(emptySection);
    }
  }

  return card;
}

function renderPropertyTree(key, value, nodeId, nodeTypes, depth) {
  const container = $("<div>");

  // First render the property itself
  const row = renderProperty(key, value, nodeId, nodeTypes);
  container.append(row);

  // Then check if this property references other nodes
  const refs = extractNodeReferences(value);
  if (refs.length > 0) {
    refs.forEach((refId) => {
      const refNode = jsonData["@graph"].find((n) => n["@id"] === refId);
      if (refNode) {
        // Only render inline if this node hasn't been rendered yet
        if (!renderedNodes.has(refId)) {
          const childCard = renderNodeTree(refNode, 0, depth + 1);
          container.append(childCard);
        } else {
          // Node already rendered elsewhere - show a reference link
          const refLink = $("<div>").addClass("node-reference-link").css({
            "margin-left": "8px",
            padding: "3px",
            "margin-bottom": "2px",
          });

          const jumpBtn = $("<button>")
            .addClass("btn btn-sm btn-default")
            .html(
              `<span class="glyphicon glyphicon-arrow-right"></span> → ${refId}`
            )
            .attr("title", "Click to jump to this node")
            .click(function (e) {
              e.preventDefault();
              const targetCard = $(`.node-card[data-node-id="${refId}"]`);
              if (targetCard.length) {
                targetCard.removeClass("collapsed");
                targetCard[0].scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                targetCard.addClass("highlight");
                setTimeout(() => targetCard.removeClass("highlight"), 2000);
              }
            });

          refLink.append(jumpBtn);
          container.append(refLink);
        }
      }
    });
  }

  return container;
}

function renderProperty(key, value, nodeId, nodeTypes) {
  const row = $("<div>")
    .addClass("property-row")
    .attr("data-property", key)
    .attr("data-node-id", nodeId);

  // Classify property using SHACL (pass nodeId for URI expansion)
  const classification = classifyProperty(nodeTypes || [], key, nodeId);

  // Apply CSS classes based on classification
  if (classification.isInShape) {
    row.addClass("shacl-defined");
  } else {
    row.addClass("extra-field");
  }

  if (classification.isRequired) {
    row.addClass("required");
  }

  // Add property badge
  const badge = $("<span>").addClass("property-badge");
  if (classification.isRequired) {
    badge.addClass("required").text("REQUIRED");
  } else if (classification.isInShape) {
    badge.addClass("optional").text("OPTIONAL");
  } else {
    badge.addClass("extra").text("EXTRA");
  }
  row.append(badge);

  // Add tooltip icon if there's a description
  if (classification.description) {
    const tooltip = $("<span>")
      .addClass("tooltip-icon glyphicon glyphicon-question-sign")
      .attr("title", classification.description)
      .css({ "margin-left": "5px", cursor: "help" });
    badge.after(tooltip);
  }

  // Label
  const label = $("<div>").addClass("property-label").text(humanizeKey(key));
  const path = $("<div>").addClass("property-path").text(key);
  row.append(label, path);

  // Value
  const valueContainer = $("<div>").addClass("property-value");

  // Helper: render a nested object value using a small inline node card
  function renderInlineObject(val) {
    if (!val || typeof val !== "object" || Array.isArray(val)) return null;

    const inlineCard = $("<div>")
      .addClass("node-card inline-node-card")
      .css({
        "margin-top": "5px",
        "margin-bottom": "5px",
      });

    const header = $("<div>").addClass("node-header");
    const leftSide = $("<div>")
      .css("display", "flex")
      .css("align-items", "center");

    leftSide.append(
      $("<span>")
        .addClass("glyphicon glyphicon-chevron-down collapse-icon")
        .css("margin-right", "10px")
    );

    const nestedId = val["@id"];
    if (nestedId) {
      leftSide.append($("<span>").addClass("node-id").text(nestedId));
    }

    const nestedTypes = Array.isArray(val["@type"])
      ? val["@type"]
      : val["@type"]
      ? [val["@type"]]
      : [];
    nestedTypes.forEach((t) => {
      if (t) {
        leftSide.append($("<span>").addClass("node-type").text(t));
      }
    });

    header.append(leftSide);
    header.click(function () {
      inlineCard.toggleClass("collapsed");
    });

    inlineCard.append(header);

    const body = $("<div>").addClass("node-body");
    if (!isEditMode) {
      body.addClass("view-mode");
    }

    Object.keys(val).forEach((k) => {
      if (k === "@id" || k === "@type" || k === "@context") return;
      const nestedRow = renderProperty(k, val[k], nestedId || nodeId, nestedTypes);
      body.append(nestedRow);
    });

    inlineCard.append(body);
    return inlineCard;
  }

  if (Array.isArray(value)) {
    // Array of values
    value.forEach((val, idx) => {
      const valDiv = $("<div>").addClass("array-value");

      // Try to render nested objects (like schema:Role) as inline node cards
      const inlineCard = renderInlineObject(val);
      if (inlineCard) {
        valDiv.append(inlineCard);
      } else {
        valDiv.append(createValueInput(key, val, nodeId, idx, classification));
      }

      // Add delete button in edit mode
      if (isEditMode) {
        const deleteBtn = $("<button>")
          .addClass("btn btn-xs delete-btn")
          .html('<span class="glyphicon glyphicon-trash"></span>')
          .click(function () {
            if (confirm("Delete this value?")) {
              valDiv.remove();
              row.addClass("changed");
              updateSaveButton();
            }
          });
        valDiv.append(deleteBtn);
      }

      valueContainer.append(valDiv);
    });
    if (isEditMode) {
      const addBtn = $("<button>")
        .addClass("btn btn-sm btn-default add-value-btn")
        .html('<span class="glyphicon glyphicon-plus"></span> Add Value')
        .click(function () {
          const newValDiv = $("<div>").addClass("array-value");
          newValDiv.append(
            createValueInput(key, "", nodeId, value.length, classification)
          );

          // Add delete button for the new value
          const deleteBtn = $("<button>")
            .addClass("btn btn-xs delete-btn")
            .html('<span class="glyphicon glyphicon-trash"></span>')
            .css({ "margin-left": "10px" })
            .click(function () {
              newValDiv.addClass("deleted").fadeOut(300, function () {
                $(this).remove();
              });
              updateSaveButton();
            });
          newValDiv.append(deleteBtn);

          $(this).before(newValDiv);
          updateSaveButton();
        });
      valueContainer.append(addBtn);
    }
  } else {
    // Single value
    const inlineCard = renderInlineObject(value);
    if (inlineCard) {
      valueContainer.append(inlineCard);
    } else {
      valueContainer.append(
        createValueInput(key, value, nodeId, null, classification)
      );
    }

    // Add delete button in edit mode (for non-required fields only)
    if (isEditMode && !classification.isRequired) {
      const deleteBtn = $("<button>")
        .addClass("btn btn-xs delete-btn")
        .html('<span class="glyphicon glyphicon-trash"></span>')
        .css({ "margin-left": "10px" })
        .click(function () {
          if (confirm("Delete this property?")) {
            row.addClass("deleted").fadeOut(300, function () {
              $(this).remove();
            });
            updateSaveButton();
          }
        });
      valueContainer.append(deleteBtn);
    }
  }

  // Add description as info text if available
  if (classification.description && isEditMode) {
    const infoText = $("<div>")
      .addClass("property-info")
      .text(classification.description);
    valueContainer.append(infoText);
  }

  row.append(valueContainer);
  return row;
}

function createValueInput(key, value, nodeId, arrayIndex, classification) {
  // Check if value is a reference to another node (has @id)
  if (typeof value === "object" && value !== null && value["@id"]) {
    const refId = value["@id"];
    const refContainer = $("<div>").addClass("reference-container");

    // Create a clickable button to jump to the referenced node
    const jumpBtn = $("<button>")
      .addClass("btn btn-sm btn-info reference-btn")
      .html(`<span class="glyphicon glyphicon-arrow-right"></span> ${refId}`)
      .attr("title", "Click to jump to this node")
      .click(function (e) {
        e.preventDefault();
        const targetCard = $(`.node-card[data-node-id="${refId}"]`);
        if (targetCard.length) {
          targetCard.removeClass("collapsed");
          targetCard[0].scrollIntoView({ behavior: "smooth", block: "center" });
          targetCard.addClass("highlight");
          setTimeout(() => targetCard.removeClass("highlight"), 2000);
        } else {
          alert("Referenced node not found: " + refId);
        }
      });

    refContainer.append(jumpBtn);
    return refContainer;
  }

  // Check if string value is a node reference (like "#Sample_Key")
  if (typeof value === "string" && isNodeReference(value)) {
    const refContainer = $("<div>").addClass("reference-container");

    const jumpBtn = $("<button>")
      .addClass("btn btn-sm btn-info reference-btn")
      .html(`<span class="glyphicon glyphicon-arrow-right"></span> ${value}`)
      .attr("title", "Click to jump to this node")
      .click(function (e) {
        e.preventDefault();
        const targetCard = $(`.node-card[data-node-id="${value}"]`);
        if (targetCard.length) {
          targetCard.removeClass("collapsed");
          targetCard[0].scrollIntoView({ behavior: "smooth", block: "center" });
          targetCard.addClass("highlight");
          setTimeout(() => targetCard.removeClass("highlight"), 2000);
        } else {
          alert("Referenced node not found: " + value);
        }
      });

    refContainer.append(jumpBtn);
    return refContainer;
  }

  // Simple value (string, number, etc.) or complex object without @id
  const valueStr =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  if (isEditMode) {
    // Check if this property has enumeration values (controlled vocabulary)
    if (
      classification &&
      classification.allowedValues &&
      classification.allowedValues.length > 0
    ) {
      // Create a dropdown select element
      const select = $("<select>")
        .addClass("form-control")
        .attr("data-original", valueStr);

      // Add empty option if field is not required
      if (!classification.isRequired) {
        select.append($("<option>").val("").text("-- Select --"));
      }

      // Add enumeration options
      classification.allowedValues.forEach((enumValue) => {
        const option = $("<option>").val(enumValue.uri).text(enumValue.label);

        // Check if this is the current value (match by URI or local part)
        const valueUri = valueStr.startsWith("http") ? valueStr : null;
        const valueLocalPart = valueStr.split("/").pop().split("#").pop();
        const enumLocalPart = enumValue.uri.split("/").pop().split("#").pop();

        if (
          valueUri === enumValue.uri ||
          valueLocalPart === enumLocalPart ||
          valueStr === enumValue.label
        ) {
          option.attr("selected", "selected");
        }

        select.append(option);
      });

      // Mark as changed when selection changes
      select.on("change", function () {
        $(this).closest(".property-row").addClass("changed");
        updateSaveButton();
      });

      return select;
    }

    // Not an enumeration - render regular input based on type
    const inputType = classification ? classification.inputType : "text";

    let input;
    if (valueStr.length > 50) {
      input = $("<textarea>").val(valueStr);
    } else {
      input = $("<input>").attr("type", inputType).val(valueStr);
    }

    input.attr("data-original", valueStr);
    input.on("input", function () {
      // Mark as changed
      $(this).closest(".property-row").addClass("changed");
      updateSaveButton();
    });

    return input;
  } else {
    // View mode - show as read-only text
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // For complex objects, create a nested expandable section
      const nestedContainer = $("<div>").addClass("nested-object").css({
        "margin-left": "20px",
        "border-left": "2px solid #ddd",
        "padding-left": "10px",
        "margin-top": "5px",
      });

      Object.keys(value).forEach((nestedKey) => {
        if (nestedKey === "@id" || nestedKey === "@type") return; // Skip JSON-LD metadata for cleaner display

        const nestedRow = $("<div>")
          .addClass("property-row nested-property")
          .css({
            "margin-bottom": "8px",
            display: "flex",
            "align-items": "center",
          });

        const nestedLabel = $("<div>")
          .addClass("property-key")
          .css({
            "font-weight": "500",
            "min-width": "150px",
            color: "#555",
          })
          .text(humanizeKey(nestedKey.replace("schema:", "")));

        const nestedValueDiv = $("<div>").addClass("property-value").css({
          flex: "1",
        });

        const nestedValue = value[nestedKey];
        if (typeof nestedValue === "object" && nestedValue !== null) {
          nestedValueDiv.text(JSON.stringify(nestedValue));
        } else {
          nestedValueDiv.text(String(nestedValue));
        }

        nestedRow.append(nestedLabel, nestedValueDiv);
        nestedContainer.append(nestedRow);
      });

      return nestedContainer;
    } else {
      // For simple values, show as regular text
      return $("<div>").addClass("value-display").text(valueStr);
    }
  }
}

function humanizeKey(key) {
  // Convert camelCase or snake_case to human readable
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function highlightText(element, searchTerm) {
  // Remove previous highlights
  element.find(".search-highlight").contents().unwrap();

  // Highlight matching text
  element
    .find(".property-label, .property-path, .value-display, .node-id")
    .each(function () {
      const $this = $(this);
      const text = $this.text();
      const lowerText = text.toLowerCase();
      const index = lowerText.indexOf(searchTerm);

      if (index >= 0) {
        const before = text.substring(0, index);
        const match = text.substring(index, index + searchTerm.length);
        const after = text.substring(index + searchTerm.length);

        $this.html(
          document.createTextNode(before).textContent +
            '<span class="search-highlight">' +
            document.createTextNode(match).textContent +
            "</span>" +
            document.createTextNode(after).textContent
        );
      }
    });
}
