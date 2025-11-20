// === CDI Previewer: Property Suggestions ===
//
// Generates property suggestions based on SHACL shapes and node types.

function getPropertySuggestions(node, types) {
  if (!shaclShapesStore || types.length === 0) {
    return [];
  }

  const suggestions = [];
  const existingProperties = Object.keys(node).filter(
    (k) => k !== "@id" && k !== "@type" && k !== "@context"
  );

  // Collect all applicable shape URIs
  const applicableShapes = new Set();

  // Check sh:targetClass (Core SHACL method)
  types.forEach((type) => {
    let typeUri;

    if (type.startsWith("http")) {
      // Already a full URI
      typeUri = type;
    } else if (type.includes(":")) {
      // Compact form like "schema:Dataset" - expand using context
      const context = jsonData && jsonData["@context"];
      if (context) {
        const expanded = expandCompactIri(context, type);
        if (expanded) {
          typeUri = expanded;
        } else {
          // Could not expand - skip this type
          return;
        }
      } else {
        // No context - skip
        return;
      }
    } else {
      // No prefix, assume DDI-CDI namespace
      typeUri = "http://ddialliance.org/Specification/DDI-CDI/1.0/RDF/" + type;
    }

    // Look for NodeShapes with sh:targetClass matching this type
    const targetClassQuads = shaclShapesStore.getQuads(
      null,
      "http://www.w3.org/ns/shacl#targetClass",
      typeUri,
      null
    );

    targetClassQuads.forEach((quad) => {
      applicableShapes.add(quad.subject.value);
    });
  });

  // Now process all applicable shapes
  applicableShapes.forEach((shapeSubject) => {
    // Get all sh:property predicates for this shape
    const propertyQuads = shaclShapesStore.getQuads(
      shapeSubject,
      "http://www.w3.org/ns/shacl#property",
      null,
      null
    );

    propertyQuads.forEach((propQuad) => {
      // The object is the property shape node (may be blank node or named node)
      const propertyShapeRef = propQuad.object;

      // Get sh:path for this property
      let pathQuads = shaclShapesStore.getQuads(
        propertyShapeRef,
        "http://www.w3.org/ns/shacl#path",
        null,
        null
      );

      // If no path found and it's a named node reference (not blank node),
      // it might be referencing a named property shape definition
      if (
        pathQuads.length === 0 &&
        propertyShapeRef.termType === "NamedNode"
      ) {
        // This is a reference like cdifd:nameProperty
        // The referenced shape should have the actual sh:path
        pathQuads = shaclShapesStore.getQuads(
          propertyShapeRef,
          "http://www.w3.org/ns/shacl#path",
          null,
          null
        );
      }

      pathQuads.forEach((pathQuad) => {
        const path = pathQuad.object.value;
        const pathName = path.split("/").pop().split("#").pop();

        // Check if this property already exists
        if (
          !existingProperties.includes(pathName) &&
          !existingProperties.includes(path)
        ) {
          // Get sh:name for human-readable label
          const nameQuads = shaclShapesStore.getQuads(
            propertyShapeRef,
            "http://www.w3.org/ns/shacl#name",
            null,
            null
          );

          const label =
            nameQuads.length > 0
              ? nameQuads[0].object.value
              : humanizeKey(pathName);

          // Get minCount
          const minCountQuads = shaclShapesStore.getQuads(
            propertyShapeRef,
            "http://www.w3.org/ns/shacl#minCount",
            null,
            null
          );
          const required =
            minCountQuads.length > 0 &&
            parseInt(minCountQuads[0].object.value) > 0;

          // Get maxCount
          const maxCountQuads = shaclShapesStore.getQuads(
            propertyShapeRef,
            "http://www.w3.org/ns/shacl#maxCount",
            null,
            null
          );
          const maxCount =
            maxCountQuads.length > 0
              ? parseInt(maxCountQuads[0].object.value)
              : null;

          // Check if it's a complex object (sh:node or sh:class)
          const nodeQuads = shaclShapesStore.getQuads(
            propertyShapeRef,
            "http://www.w3.org/ns/shacl#node",
            null,
            null
          );
          const classQuads = shaclShapesStore.getQuads(
            propertyShapeRef,
            "http://www.w3.org/ns/shacl#class",
            null,
            null
          );
          const isComplex = nodeQuads.length > 0 || classQuads.length > 0;

          // Get the class from sh:class or find it from sh:node's targetClass or sh:in
          let nodeClass = null;
          if (classQuads.length > 0) {
            nodeClass = classQuads[0].object.value;
          } else if (nodeQuads.length > 0) {
            // sh:node points to another NodeShape (might be a blank node)
            // Use the actual node object, not just the value
            const nodeShapeNode = nodeQuads[0].object;

            // Try to get targetClass (using the node object, not string)
            const targetClassQuads = shaclShapesStore.getQuads(
              nodeShapeNode,
              "http://www.w3.org/ns/shacl#targetClass",
              null,
              null
            );

            if (targetClassQuads.length > 0) {
              nodeClass = targetClassQuads[0].object.value;
            } else {
              // If no targetClass, look for sh:property -> sh:path rdf:type -> sh:in
              // This handles inline blank node shapes with sh:in constraints
              const propertyConstraints = shaclShapesStore.getQuads(
                nodeShapeNode,
                "http://www.w3.org/ns/shacl#property",
                null,
                null
              );

              for (const propQuad of propertyConstraints) {
                const propShape = propQuad.object;

                // Check if this is a type constraint (sh:path rdf:type)
                const pathQuads = shaclShapesStore.getQuads(
                  propShape,
                  "http://www.w3.org/ns/shacl#path",
                  "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                  null
                );

                if (pathQuads.length > 0) {
                  // Found rdf:type constraint, look for sh:in
                  const inQuads = shaclShapesStore.getQuads(
                    propShape,
                    "http://www.w3.org/ns/shacl#in",
                    null,
                    null
                  );

                  if (inQuads.length > 0) {
                    // sh:in points to an RDF list, get the first item
                    let listNode = inQuads[0].object; // Use object, not value!

                    const firstQuads = shaclShapesStore.getQuads(
                      listNode,
                      "http://www.w3.org/1999/02/22-rdf-syntax-ns#first",
                      null,
                      null
                    );

                    if (firstQuads.length > 0) {
                      nodeClass = firstQuads[0].object.value;
                      break;
                    }
                  }
                }
              }
            }
          }

          // Get description
          const descQuads = shaclShapesStore.getQuads(
            propertyShapeRef,
            "http://www.w3.org/ns/shacl#description",
            null,
            null
          );
          const description =
            descQuads.length > 0 ? descQuads[0].object.value : "";

          suggestions.push({
            path: pathName,
            fullPath: path,
            label: label,
            required: required,
            maxCount: maxCount,
            isComplex: isComplex,
            nodeClass: nodeClass,
            description: description,
          });
        }
      });
    });
  });

  // Remove duplicates
  const unique = [];
  const seen = new Set();
  suggestions.forEach((s) => {
    if (!seen.has(s.path)) {
      seen.add(s.path);
      unique.push(s);
    }
  });

  return unique;
}

function createPropertySuggestionsSection(suggestions, nodeId, bodyElement) {
  const section = $("<div>").addClass("add-property-section");
  section.append(
    $("<h4>")
      .text("Add Properties")
      .css({ "margin-top": "0", "margin-bottom": "10px" })
  );

  // Sort: required first, then alphabetically
  suggestions.sort((a, b) => {
    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    return a.label.localeCompare(b.label);
  });

  // Control row with dropdown and buttons
  const controlRow = $("<div>").addClass("add-property-controls");

  // Searchable dropdown
  const dropdownWrapper = $("<div>").addClass("property-dropdown-wrapper");
  const dropdown = $("<select>").addClass("property-dropdown");
  dropdown.append($("<option>").val("").text("-- Select a property to add --"));

  suggestions.forEach((suggestion) => {
    const option = $("<option>")
      .val(suggestion.path)
      .attr("data-required", suggestion.required)
      .attr("data-complex", suggestion.isComplex)
      .attr("data-max-count", suggestion.maxCount || "")
      .attr("data-node-class", suggestion.nodeClass || "")
      .attr("data-description", suggestion.description)
      .data("suggestion", suggestion);

    let text = suggestion.label;
    if (suggestion.required) text = "⚠ " + text + " (REQUIRED)";
    if (suggestion.isComplex) text = text + " [object]";
    if (suggestion.maxCount === 1) text = text + " (max 1)";

    option.text(text);
    dropdown.append(option);
  });

  dropdownWrapper.append(dropdown);
  controlRow.append(dropdownWrapper);

  // Add button
  const addBtn = $("<button>")
    .addClass("btn btn-primary")
    .html('<span class="glyphicon glyphicon-plus"></span> Add Property')
    .click(function () {
      const selectedPath = dropdown.val();
      if (!selectedPath) {
        alert("Please select a property first");
        return;
      }

      const selectedOption = dropdown.find("option:selected");
      const suggestion = selectedOption.data("suggestion");

      if (suggestion.isComplex) {
        // Always create a separate node and reference it
        addComplexPropertyToNode(nodeId, suggestion, bodyElement);
      } else {
        // Add simple property with empty string as initial value
        addPropertyToNode(nodeId, suggestion.path, "", bodyElement);
      }

      // Remove from dropdown if maxCount = 1
      if (suggestion.maxCount === 1) {
        selectedOption.remove();
      }

      dropdown.val("");
    });

  controlRow.append(addBtn);

  // Add Custom Property button
  const addCustomBtn = $("<button>")
    .addClass("btn btn-default")
    .html('<span class="glyphicon glyphicon-edit"></span> Add Custom Property')
    .click(function () {
      const propName = prompt("Enter custom property name:");
      if (propName) {
        addPropertyToNode(nodeId, propName, "", bodyElement);
      }
    });

  controlRow.append(addCustomBtn);

  section.append(controlRow);

  // Description area (shows when property is selected)
  const descArea = $("<div>")
    .addClass("property-info")
    .css({ "margin-top": "10px", display: "none" });
  section.append(descArea);

  // Show description on selection change
  dropdown.on("change", function () {
    const selectedOption = $(this).find("option:selected");
    const description = selectedOption.attr("data-description");
    if (description) {
      descArea.text(description).show();
    } else {
      descArea.hide();
    }
  });

  return section;
}
