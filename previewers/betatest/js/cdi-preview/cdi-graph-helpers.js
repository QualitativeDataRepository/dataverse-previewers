// Graph and tree helpers for the CDI previewer.
//
// Related responsibilities now live in:
//  - cdi-shacl-sparql.js          (SHACL/SPARQL helpers)
//  - cdi-json-ld-helpers.js       (JSON-LD normalization)
//  - core.js                      (Dataverse wiring and initialization)
//  - render.js                    (tree rendering)

// Expand a compact node ID (e.g., "xas:fe_c3d.001") to full URI (e.g., "http://www.cdi4exas.org/fe_c3d.001").
// Falls back to returning the input unchanged when expansion is not possible.
function getExpandedNodeId(compactNodeId) {
  if (!compactNodeId) return null;

  // If it's already a full URI, return as-is
  if (
    compactNodeId.startsWith("http://") ||
    compactNodeId.startsWith("https://")
  ) {
    return compactNodeId;
  }

  // Try to find the node in the @graph
  if (jsonData && jsonData["@graph"]) {
    const node = jsonData["@graph"].find((n) => n["@id"] === compactNodeId);
    if (node && node["@id"]) {
      // Check if we have expanded JSON-LD
      if (expandedJsonLd && Array.isArray(expandedJsonLd)) {
        const expanded = expandedJsonLd.find((n) => {
          // The expanded @id should be the full URI
          return (
            n["@id"] &&
            (n["@id"] === compactNodeId ||
              n["@id"].endsWith("/" + compactNodeId.split(":").pop()) ||
              n["@id"].endsWith("#" + compactNodeId.split(":").pop()))
          );
        });
        if (expanded && expanded["@id"]) {
          return expanded["@id"];
        }
      }
    }
  }

  // Fallback: try to resolve using context
  if (jsonData && jsonData["@context"]) {
    const context = jsonData["@context"];
    const [prefix, localPart] = compactNodeId.split(":");

    if (prefix && localPart && context[prefix]) {
      const namespace = context[prefix];
      return namespace + localPart;
    }
  }

  return compactNodeId; // Return as-is if we can't expand
}

// Get the expanded URI for a property from the expanded JSON-LD.
function getExpandedPropertyUri(nodeId, propertyKey) {
  if (!expandedJsonLd || !Array.isArray(expandedJsonLd)) {
    return null;
  }

  // Find the node in expanded JSON-LD
  const expandedNode = expandedJsonLd.find((n) => n["@id"] === nodeId);
  if (!expandedNode) {
    return null;
  }

  // Look through all properties to find one that might match
  for (const key in expandedNode) {
    if (key === "@id" || key === "@type") continue;

    // The expanded key is the full URI, extract the local part
    const localPart = key.split("/").pop().split("#").pop();

    // Check if this matches our property key
    if (localPart === propertyKey || key === propertyKey) {
      return key; // Return the full URI
    }
  }

  return null;
}
// Get all available node types from SHACL shapes.
function getAvailableNodeTypes() {
  if (!shaclShapesStore) {
    return [];
  }

  const nodeTypes = new Set();

  try {
    // Find all NodeShapes with sh:targetClass
    const targetClassQuads = shaclShapesStore.getQuads(
      null,
      "http://www.w3.org/ns/shacl#targetClass",
      null,
      null
    );

    targetClassQuads.forEach((quad) => {
      const classUri = quad.object.value;
      // Extract the class name from the URI
      const className = classUri.split("/").pop().split("#").pop();
      nodeTypes.add({
        uri: classUri,
        name: className,
        label: humanizeKey(className),
      });
    });
  } catch (error) {
    console.error("Error getting node types:", error);
  }

  // Convert Set to Array and sort by label
  return Array.from(nodeTypes).sort((a, b) => a.label.localeCompare(b.label));
}

// Add a new root node to the graph
function addRootNode() {
  const availableTypes = getAvailableNodeTypes();

  if (availableTypes.length === 0) {
    // No SHACL shapes loaded, allow custom type
    const customType = prompt(
      "Enter node type (e.g., DataSet, Study, Variable):"
    );
    if (!customType) return;

    createAndAddRootNode(customType);
    return;
  }

  // Create a modal-like selection interface using Bootstrap modal
  const modalHtml = `
                <div class="modal fade" id="addRootNodeModal" tabindex="-1" role="dialog">
                    <div class="modal-dialog" role="document">
                        <div class="modal-content">
                            <div class="modal-header">
                                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                                <h4 class="modal-title">
                                    <span class="glyphicon glyphicon-plus-sign"></span>
                                    Add New Root Node
                                </h4>
                            </div>
                            <div class="modal-body">
                                <div class="form-group">
                                    <label for="nodeTypeSelect"><strong>Select Node Type:</strong></label>
                                    <select id="nodeTypeSelect" class="form-control" size="10" style="height: 300px;">
                                        ${availableTypes
                                          .map(
                                            (type) =>
                                              `<option value="${type.name}">${type.label}</option>`
                                          )
                                          .join("")}
                                    </select>
                                    <small class="help-block">Select a type from the available SHACL shapes</small>
                                </div>
                                <div class="form-group">
                                    <label for="customNodeType"><strong>Or enter custom type:</strong></label>
                                    <input type="text" id="customNodeType" class="form-control" placeholder="e.g., DataSet, Study, Variable">
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary" id="confirmAddRootNode">
                                    <span class="glyphicon glyphicon-plus"></span> Add Node
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

  // Remove existing modal if any
  $("#addRootNodeModal").remove();

  // Add modal to body
  $("body").append(modalHtml);

  // Show modal
  $("#addRootNodeModal").modal("show");

  // Handle confirm button
  $("#confirmAddRootNode")
    .off("click")
    .on("click", function () {
      const customType = $("#customNodeType").val().trim();
      const selectedType = $("#nodeTypeSelect").val();

      const nodeType = customType || selectedType;

      if (!nodeType) {
        alert("Please select or enter a node type");
        return;
      }

      $("#addRootNodeModal").modal("hide");
      createAndAddRootNode(nodeType);
    });

  // Handle Enter key in custom type input
  $("#customNodeType").on("keypress", function (e) {
    if (e.which === 13) {
      // Enter key
      e.preventDefault();
      $("#confirmAddRootNode").click();
    }
  });

  // Handle double-click on list item
  $("#nodeTypeSelect").on("dblclick", function () {
    $("#confirmAddRootNode").click();
  });
}

// Create and add a root node with the specified type
function createAndAddRootNode(nodeType) {
  // Generate unique ID
  const timestamp = Date.now();
  const newNodeId = `#NewNode_${nodeType}_${timestamp}`;

  // Create new node
  const newNode = {
    "@id": newNodeId,
    "@type": nodeType,
  };

  // Add to graph
  if (!jsonData["@graph"]) {
    jsonData["@graph"] = [];
  }
  jsonData["@graph"].push(newNode);

  // Re-render
  renderData();

  // Mark as changed
  updateSaveButton();

  // Scroll to new node and highlight it
  setTimeout(() => {
    const newCard = $(`.node-card[data-node-id="${newNodeId}"]`);
    if (newCard.length) {
      newCard[0].scrollIntoView({ behavior: "smooth", block: "center" });
      newCard.addClass("highlight");
      setTimeout(() => newCard.removeClass("highlight"), 2000);
    }
  }, 100);

  log(LOG_LEVEL.INFO, "Added new root node:", newNode);
}

function addComplexPropertyToNode(nodeId, suggestion, bodyElement) {
  // Create a new node in the @graph
  const newNodeId = `_:${suggestion.path}_${Date.now()}`;

  // Extract class name from full URI or use the short name
  let className = suggestion.nodeClass || "Object";

  // If it's a full URI, extract just the class name
  if (className.includes("/") || className.includes("#")) {
    className = className.split("/").pop().split("#").pop();
  }

  const newNode = {
    "@id": newNodeId,
    "@type": className,
  };

  // Add to graph
  if (!jsonData["@graph"]) {
    jsonData["@graph"] = [];
  }
  jsonData["@graph"].push(newNode);

  // Add reference to parent node
  const parentNode = jsonData["@graph"].find((n) => n["@id"] === nodeId);
  if (parentNode) {
    if (suggestion.maxCount === 1) {
      parentNode[suggestion.path] = { "@id": newNodeId };
    } else {
      if (!parentNode[suggestion.path]) {
        parentNode[suggestion.path] = [];
      }
      if (Array.isArray(parentNode[suggestion.path])) {
        parentNode[suggestion.path].push({ "@id": newNodeId });
      } else {
        parentNode[suggestion.path] = [
          parentNode[suggestion.path],
          { "@id": newNodeId },
        ];
      }
    }
  }

  // Re-render everything
  renderData();
  updateSaveButton();

  // Scroll to new node
  setTimeout(() => {
    const newCard = $(`.node-card[data-node-id="${newNodeId}"]`);
    if (newCard.length) {
      newCard[0].scrollIntoView({ behavior: "smooth", block: "center" });
      newCard.addClass("changed");
    }
  }, 100);
}

function addPropertyToNode(nodeId, propertyKey, initialValue, bodyElement) {
  // Add the property to the data and get node types
  let nodeTypes = [];
  jsonData["@graph"].forEach((node) => {
    if (node["@id"] === nodeId) {
      node[propertyKey] = initialValue;
      nodeTypes = Array.isArray(node["@type"])
        ? node["@type"]
        : [node["@type"]];
    }
  });

  // Re-render just this node's body with proper classification
  const propertyRow = renderProperty(
    propertyKey,
    initialValue,
    nodeId,
    nodeTypes
  );
  bodyElement.append(propertyRow);

  // Mark as changed
  propertyRow.addClass("changed");
  updateSaveButton();
}
