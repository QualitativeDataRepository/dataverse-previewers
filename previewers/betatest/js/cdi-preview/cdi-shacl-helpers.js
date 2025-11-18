// SHACL-based UI helpers for the CDI previewer.
//
// This module exposes functions that interpret SHACL shapes for UI purposes:
//  - classifyProperty: determine REQUIRED / OPTIONAL / EXTRA, datatype, enums, etc.
//  - parseRdfList, extractLabelFromUri, getEnumerationValues: helpers for sh:in and enums.
//
// It depends on globals defined elsewhere:
//  - shaclShapesStore, sparqlTargetCache (from core / cdi-shacl-sparql.js)
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

    const firstQuads = shaclShapesStore.getQuads(
      currentNode,
      firstUri,
      null,
      null
    );

    if (firstQuads.length > 0) {
      const valueUri = firstQuads[0].object.value;
      const label = extractLabelFromUri(valueUri);
      values.push({ uri: valueUri, label: label });
    }

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

// Extract a readable label from a URI (used for enums)
function extractLabelFromUri(uri) {
  const parts = uri.split("/").pop().split("#").pop();
  return parts
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// Get enumeration values from a NodeShape that has sh:in
function getEnumerationValues(nodeShapeUri) {
  if (!shaclShapesStore) return null;

  const inQuads = shaclShapesStore.getQuads(
    nodeShapeUri,
    "http://www.w3.org/ns/shacl#in",
    null,
    null
  );

  if (inQuads.length === 0) return null;

  return parseRdfList(inQuads[0].object);
}

// Classify a property based on SHACL shapes and SPARQL targets
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

  const expandedUri = nodeId
    ? getExpandedPropertyUri(nodeId, propertyKey)
    : null;

  let expandedPropertyKey = propertyKey;
  if (propertyKey.includes(":") && jsonData && jsonData["@context"]) {
    const [prefix, localPart] = propertyKey.split(":");
    const context = jsonData["@context"];
    if (context[prefix]) {
      expandedPropertyKey = context[prefix] + localPart;
    }
  }

  try {
    const applicableShapes = new Set();

    if (sparqlTargetCache.enabled && sparqlTargetCache.executed && nodeId) {
      const expandedNodeId = getExpandedNodeId(nodeId);

      for (const [shapeUri, matchedNodes] of Object.entries(
        sparqlTargetCache.results
      )) {
        if (matchedNodes.has(nodeId) || matchedNodes.has(expandedNodeId)) {
          applicableShapes.add(shapeUri);
          log(
            LOG_LEVEL.DEBUG,
            `✓ Node ${nodeId} matched via SPARQL target in shape ${shapeUri}`
          );
        }
      }
      if (applicableShapes.size === 0) {
        log(
          LOG_LEVEL.DEBUG,
          `✗ Node ${nodeId} did NOT match any SPARQL targets`
        );
      }
    }

    nodeTypes.forEach((type) => {
      const typeUri = type.startsWith("http")
        ? type
        : "http://ddialliance.org/Specification/DDI-CDI/1.0/RDF/" + type;

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

    log(
      LOG_LEVEL.DEBUG,
      `Processing ${applicableShapes.size} applicable shape(s) for node ${nodeId}, property ${propertyKey}`
    );

    applicableShapes.forEach((shapeSubject) => {
      const propertyQuads = shaclShapesStore.getQuads(
        shapeSubject,
        "http://www.w3.org/ns/shacl#property",
        null,
        null
      );

      propertyQuads.forEach((propQuad) => {
        const propertyShapeRef = propQuad.object;

        let pathQuads = shaclShapesStore.getQuads(
          propertyShapeRef,
          "http://www.w3.org/ns/shacl#path",
          null,
          null
        );

        if (
          pathQuads.length === 0 &&
          propertyShapeRef.termType === "NamedNode"
        ) {
          log(
            LOG_LEVEL.DEBUG,
            `Resolving property shape reference: ${propertyShapeRef.value}`
          );
          pathQuads = shaclShapesStore.getQuads(
            propertyShapeRef.value,
            "http://www.w3.org/ns/shacl#path",
            null,
            null
          );
        }

        pathQuads.forEach((pathQuad) => {
          let pathsToCheck = [];
          const pathObject = pathQuad.object;

          if (pathObject.termType === "BlankNode") {
            const altPathQuads = shaclShapesStore.getQuads(
              pathObject,
              "http://www.w3.org/ns/shacl#alternativePath",
              null,
              null
            );

            if (altPathQuads.length > 0) {
              const listNode = altPathQuads[0].object;
              const alternatives = parseRdfList(listNode);
              pathsToCheck = alternatives.map((item) => item.uri || item);
              log(
                LOG_LEVEL.DEBUG,
                `Found alternativePath with ${
                  alternatives.length
                } options: ${pathsToCheck.join(", ")}`
              );
            }
          } else {
            pathsToCheck = [pathObject.value];
          }

          pathsToCheck.forEach((path) => {
            const pathName = path.split("/").pop().split("#").pop();

            let shaclPropertyName = pathName;

            if (pathName.includes("-")) {
              const parts = pathName.split("-");
              if (parts.length > 1) {
                shaclPropertyName = parts.slice(1).join("-");
              }
            }

            if (pathName.includes("_")) {
              const parts = pathName.split("_");
              if (parts.length >= 2) {
                shaclPropertyName = parts[1];
              }
            }

            const matches =
              pathName === propertyKey ||
              path === propertyKey ||
              path === expandedPropertyKey ||
              shaclPropertyName === propertyKey ||
              (expandedUri && path === expandedUri) ||
              pathName.endsWith(propertyKey) ||
              pathName.toLowerCase().includes(propertyKey.toLowerCase());

            if (matches) {
              result.isInShape = true;

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

              const maxCountQuads = shaclShapesStore.getQuads(
                propertyShapeRef,
                "http://www.w3.org/ns/shacl#maxCount",
                null,
                null
              );
              if (maxCountQuads.length > 0) {
                result.maxCount = parseInt(maxCountQuads[0].object.value);
              }

              const nodeQuads = shaclShapesStore.getQuads(
                propertyShapeRef,
                "http://www.w3.org/ns/shacl#node",
                null,
                null
              );
              if (nodeQuads.length > 0) {
                result.nodeShape = nodeQuads[0].object.value;
              }

              const classQuads = shaclShapesStore.getQuads(
                propertyShapeRef,
                "http://www.w3.org/ns/shacl#class",
                null,
                null
              );
              if (classQuads.length > 0) {
                result.nodeClass = classQuads[0].object.value;
              }

              const datatypeQuads = shaclShapesStore.getQuads(
                propertyShapeRef,
                "http://www.w3.org/ns/shacl#datatype",
                null,
                null
              );
              if (datatypeQuads.length > 0) {
                result.datatype = datatypeQuads[0].object.value;
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

              const descQuads = shaclShapesStore.getQuads(
                propertyShapeRef,
                "http://www.w3.org/ns/shacl#description",
                null,
                null
              );
              if (descQuads.length > 0) {
                result.description = descQuads[0].object.value;
              }

              const inQuads = shaclShapesStore.getQuads(
                propertyShapeRef,
                "http://www.w3.org/ns/shacl#in",
                null,
                null
              );
              if (inQuads.length > 0) {
                result.allowedValues = parseRdfList(inQuads[0].object);
              }

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
          });
        });
      });
    });
  } catch (err) {
    console.error("Error classifying property:", err);
  }

  return result;
}
