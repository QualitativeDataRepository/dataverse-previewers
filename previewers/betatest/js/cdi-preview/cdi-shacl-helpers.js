// === CDI Previewer: SHACL-based UI Helpers ===
//
// Interprets SHACL shapes for UI purposes:
//  - classifyProperty: determine REQUIRED / OPTIONAL / EXTRA, datatype, enums, etc.
//  - parseRdfList, extractLabelFromUri, getEnumerationValues: helpers for sh:in and enums.
//
// Depends on globals:
//  - shaclShapesStore (from core / cdi-shacl-loader.js)
//  - jsonData, expandedJsonLd (from core)
//  - getExpandedNodeId, getExpandedPropertyUri (from cdi-graph-helpers.js)
//  - LOG_LEVEL, log (from core)

// Parse RDF list from sh:in to extract enumeration values
function parseRdfList(listNodeOrUri) {
  if (!shaclShapesStore) return [];

  const values = [];
  let currentNode = listNodeOrUri;
  const nilUri = "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil";
  const firstUri = "http://www.w3.org/1999/02/22-rdf-syntax-ns#first";
  const restUri = "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest";

  // Handle both node objects and URI strings
  if (typeof currentNode === "string") {
    currentNode = { value: currentNode };
  }

  let iterations = 0;
  const maxIterations = 100; // Safety limit

  while (
    currentNode &&
    currentNode.value !== nilUri &&
    iterations < maxIterations
  ) {
    iterations++;

    // Get rdf:first (the value at this position)
    const firstQuads = shaclShapesStore.getQuads(
      currentNode,
      firstUri,
      null,
      null
    );

    if (firstQuads.length > 0) {
      const valueUri = firstQuads[0].object.value;
      const label = extractLabelFromUri(valueUri);
      values.push({
        uri: valueUri,
        label: label,
      });
    }

    // Get rdf:rest (pointer to next node in list)
    const restQuads = shaclShapesStore.getQuads(
      currentNode,
      restUri,
      null,
      null
    );

    if (restQuads.length === 0) break;
    currentNode = restQuads[0].object;
  }

  return values;
}

// Extract a readable label from a URI
function extractLabelFromUri(uri) {
  // Extract the local part after last / or #
  const parts = uri.split("/").pop().split("#").pop();
  // Convert camelCase to Title Case with spaces
  return parts
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// Get enumeration values from a NodeShape that has sh:in
function getEnumerationValues(nodeShapeUri) {
  if (!shaclShapesStore) return null;

  // Query for sh:in on this NodeShape
  const inQuads = shaclShapesStore.getQuads(
    nodeShapeUri,
    "http://www.w3.org/ns/shacl#in",
    null,
    null
  );

  if (inQuads.length === 0) return null;

  // Parse the RDF list
  return parseRdfList(inQuads[0].object);
}

// Classify a property based on SHACL shapes
function classifyProperty(nodeTypes, propertyKey, nodeId = null) {
  log(
    LOG_LEVEL.DEBUG,
    `Classifying property "${propertyKey}" for node "${nodeId}"`
  );

  const result = {
    isInShape: false,
    isRequired: false,
    datatype: null,
    description: "",
    allowedValues: null,
    pattern: null,
    inputType: "text",
    minCount: 0,
    maxCount: null,
    nodeShape: null,
    nodeClass: null,
  };

  if (!shaclShapesStore || nodeTypes.length === 0) return result;

  // Try to get the expanded URI for this property
  const expandedUri = nodeId
    ? getExpandedPropertyUri(nodeId, propertyKey)
    : null;

  // Also try to expand the property key if it's in compact form (e.g., "schema:name")
  let expandedPropertyKey = propertyKey;
  if (propertyKey.includes(":") && jsonData && jsonData["@context"]) {
    const expanded = expandCompactIri(jsonData["@context"], propertyKey);
    if (expanded) {
      expandedPropertyKey = expanded;
      log(LOG_LEVEL.DEBUG, `Expanded property ${propertyKey} → ${expandedPropertyKey}`);
    }
  }

  try {
    // Collect all shape URIs that might apply to this node
    const applicableShapes = new Set();

    // Check sh:targetClass (Core SHACL method)
    nodeTypes.forEach((type) => {
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
            log(LOG_LEVEL.DEBUG, `✓ Expanded type ${type} to ${typeUri}`);
          } else {
            // Could not resolve - this may be normal for external ontologies
            // that aren't in our context (e.g., prov:Entity)
            // Don't treat it as an error, just skip this type
            log(
              LOG_LEVEL.DEBUG,
              `Could not expand ${type} - prefix not in context (may be from external ontology)`
            );
            return; // Skip this type
          }
        } else {
          // No context available - skip
          return;
        }
      } else {
        // No prefix, assume DDI-CDI namespace
        typeUri =
          "http://ddialliance.org/Specification/DDI-CDI/1.0/RDF/" + type;
      }

      const targetClassQuads = shaclShapesStore.getQuads(
        null,
        "http://www.w3.org/ns/shacl#targetClass",
        typeUri,
        null
      );

      if (targetClassQuads.length === 0) {
        // Debug: show what targetClass values ARE in the shapes (deduplicated per session)
        if (!window._loggedMissingTypes) {
          window._loggedMissingTypes = new Set();
        }

        if (!window._loggedMissingTypes.has(typeUri)) {
          window._loggedMissingTypes.add(typeUri);
          const allTargets = shaclShapesStore.getQuads(
            null,
            "http://www.w3.org/ns/shacl#targetClass",
            null,
            null
          );
          const targetValues = [
            ...new Set(allTargets.map((q) => q.object.value)),
          ];
          log(
            LOG_LEVEL.INFO,
            `No shape for type: ${typeUri}\n  Available targets: ${targetValues
              .slice(0, 5)
              .join(", ")}${targetValues.length > 5 ? "..." : ""}`
          );
        }
      } else {
        log(
          LOG_LEVEL.DEBUG,
          `✓ Found ${targetClassQuads.length} shape(s) targeting ${typeUri}`
        );
      }

      targetClassQuads.forEach((quad) => {
        applicableShapes.add(quad.subject.value);
      });
    });

    // Now process all applicable shapes
    log(
      LOG_LEVEL.DEBUG,
      `Processing ${applicableShapes.size} applicable shape(s) for node ${nodeId}, property ${propertyKey}`
    );

    applicableShapes.forEach((shapeSubject) => {
      // Get all sh:property predicates
      const propertyQuads = shaclShapesStore.getQuads(
        shapeSubject,
        "http://www.w3.org/ns/shacl#property",
        null,
        null
      );

      if (
        currentLogLevel >= LOG_LEVEL.DEBUG &&
        nodeId === "xas:485749" &&
        propertyKey === "name"
      ) {
        console.log(
          `  Shape ${shapeSubject} has ${propertyQuads.length} property definition(s)`
        );
      }

      propertyQuads.forEach((propQuad) => {
        const propertyShapeRef = propQuad.object;

        // Property shape might be a direct node or a reference to another shape
        // Try to get sh:path directly from this node
        let pathQuads = shaclShapesStore.getQuads(
          propertyShapeRef,
          "http://www.w3.org/ns/shacl#path",
          null,
          null
        );

        // If no path found and it's a URI reference (not blank node),
        // it might be referencing a named property shape definition
        if (
          pathQuads.length === 0 &&
          propertyShapeRef.termType === "NamedNode"
        ) {
          console.log(
            `  Resolving property shape reference: ${propertyShapeRef.value}`
          );
          // This is a reference like cdifd:nameProperty
          // The referenced shape should have the actual sh:path
          pathQuads = shaclShapesStore.getQuads(
            propertyShapeRef,
            "http://www.w3.org/ns/shacl#path",
            null,
            null
          );
          if (pathQuads.length > 0) {
            console.log(`    → Found path: ${pathQuads[0].object.value}`);
          } else {
            console.log(`    → No path found for reference`);
          }
        }

        pathQuads.forEach((pathQuad) => {
          let pathsToCheck = [];
          const pathObject = pathQuad.object;

          // Check if this is a blank node (complex path like sh:alternativePath)
          if (pathObject.termType === "BlankNode") {
            // Check for sh:alternativePath
            const altPathQuads = shaclShapesStore.getQuads(
              pathObject,
              "http://www.w3.org/ns/shacl#alternativePath",
              null,
              null
            );

            if (altPathQuads.length > 0) {
              // sh:alternativePath points to an RDF list
              const listNode = altPathQuads[0].object;
              const alternatives = parseRdfList(listNode);
              // Extract just the URIs from the parsed list
              pathsToCheck = alternatives.map((item) => item.uri || item);
              log(
                LOG_LEVEL.DEBUG,
                `Found alternativePath with ${
                  alternatives.length
                } options: ${pathsToCheck.join(", ")}`
              );
            }
          } else {
            // Simple path (direct URI)
            pathsToCheck = [pathObject.value];
          }

          // Check each path option
          pathsToCheck.forEach((path) => {
            const pathName = path.split("/").pop().split("#").pop();

            // SHACL paths are like: cdi:WideDataSet-name or cdi:DataSet_isStructuredBy_DataStructure
            // Extract the property part after the class name and hyphen/underscore
            let shaclPropertyName = pathName;

            // Remove class prefix if present (e.g., "WideDataSet-name" -> "name")
            if (pathName.includes("-")) {
              const parts = pathName.split("-");
              if (parts.length > 1) {
                shaclPropertyName = parts.slice(1).join("-");
              }
            }

            // Also check for underscore patterns (e.g., "DataSet_isStructuredBy_DataStructure")
            if (pathName.includes("_")) {
              const parts = pathName.split("_");
              // The middle part is usually the property name
              if (parts.length >= 2) {
                shaclPropertyName = parts[1];
              }
            }

            // Check if this matches our property using multiple strategies
            const matches =
              pathName === propertyKey || // Exact match with full path name
              path === propertyKey || // Exact match with full URI
              path === expandedPropertyKey || // Match with expanded property key (e.g., schema:name → http://schema.org/name)
              shaclPropertyName === propertyKey || // Match extracted property name
              (expandedUri && path === expandedUri) || // Match with expanded URI if available
              pathName.endsWith(propertyKey) || // Ends with property key
              pathName.toLowerCase().includes(propertyKey.toLowerCase()); // Contains property key (case insensitive)

            if (matches) {
              result.isInShape = true;

              // Check sh:minCount for required
              const minCountQuads = shaclShapesStore.getQuads(
                propertyShapeRef,
                "http://www.w3.org/ns/shacl#minCount",
                null,
                null
              );
              if (minCountQuads.length > 0) {
                result.minCount = parseInt(minCountQuads[0].object.value);
                result.isRequired = result.minCount > 0;
              }

              // Check sh:maxCount for cardinality
              const maxCountQuads = shaclShapesStore.getQuads(
                propertyShapeRef,
                "http://www.w3.org/ns/shacl#maxCount",
                null,
                null
              );
              if (maxCountQuads.length > 0) {
                result.maxCount = parseInt(maxCountQuads[0].object.value);
              }

              // Check sh:node for complex objects
              const nodeQuads = shaclShapesStore.getQuads(
                propertyShapeRef,
                "http://www.w3.org/ns/shacl#node",
                null,
                null
              );
              if (nodeQuads.length > 0) {
                result.nodeShape = nodeQuads[0].object.value;
              }

              // Check sh:class for object type
              const classQuads = shaclShapesStore.getQuads(
                propertyShapeRef,
                "http://www.w3.org/ns/shacl#class",
                null,
                null
              );
              if (classQuads.length > 0) {
                result.nodeClass = classQuads[0].object.value;
              }

              // Get sh:datatype
              const datatypeQuads = shaclShapesStore.getQuads(
                propertyShapeRef,
                "http://www.w3.org/ns/shacl#datatype",
                null,
                null
              );
              if (datatypeQuads.length > 0) {
                result.datatype = datatypeQuads[0].object.value;

                // Determine input type based on datatype
                const dt = result.datatype.toLowerCase();
                if (
                  dt.includes("integer") ||
                  dt.includes("int") ||
                  dt.includes("decimal") ||
                  dt.includes("double") ||
                  dt.includes("float")
                ) {
                  result.inputType = "number";
                } else if (dt.includes("date") && !dt.includes("datetime")) {
                  result.inputType = "date";
                } else if (dt.includes("datetime")) {
                  result.inputType = "datetime-local";
                } else if (dt.includes("anyuri")) {
                  result.inputType = "url";
                }
              }

              // Get sh:description
              const descQuads = shaclShapesStore.getQuads(
                propertyShapeRef,
                "http://www.w3.org/ns/shacl#description",
                null,
                null
              );
              if (descQuads.length > 0) {
                result.description = descQuads[0].object.value;
              }

              // Get sh:in (allowed values) - direct enumeration on property
              const inQuads = shaclShapesStore.getQuads(
                propertyShapeRef,
                "http://www.w3.org/ns/shacl#in",
                null,
                null
              );
              if (inQuads.length > 0) {
                // Parse RDF list to get enumeration values
                result.allowedValues = parseRdfList(inQuads[0].object);
              }

              // Check if sh:node references an enumeration shape
              if (result.nodeShape && !result.allowedValues) {
                const nodeShapeUri =
                  result.nodeShape.startsWith("http") ||
                  result.nodeShape.startsWith("#")
                    ? result.nodeShape
                    : "#" + result.nodeShape;
                const enumValues = getEnumerationValues(nodeShapeUri);
                if (enumValues && enumValues.length > 0) {
                  result.allowedValues = enumValues;
                }
              }

              // Get sh:pattern
              const patternQuads = shaclShapesStore.getQuads(
                propertyShapeRef,
                "http://www.w3.org/ns/shacl#pattern",
                null,
                null
              );
              if (patternQuads.length > 0) {
                result.pattern = patternQuads[0].object.value;
              }
            }
          }); // end pathsToCheck.forEach
        }); // end pathQuads.forEach
      }); // end propertyQuads.forEach
    }); // end applicableShapes.forEach
  } catch (err) {
    console.error("Error classifying property:", err);
  }

  return result;
}
