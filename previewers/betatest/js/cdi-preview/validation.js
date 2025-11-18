// === CDI Previewer: SHACL Validation Logic ===

// Runs validation end-to-end on the current jsonData and updates #validation-status
async function validateData() {
  $("#validation-status").html(
    '<span class="label label-info">Validating...</span>'
  );

  try {
    // Convert JSON-LD to N3 Store using jsonld library
    const dataStore = new N3.Store();

    // Create a local copy without @context
    const dataForValidation = JSON.parse(JSON.stringify(jsonData));

    // Remove @context to avoid remote fetching - we'll use local namespace mapping
    if (dataForValidation["@context"]) {
      delete dataForValidation["@context"];
    }

    // Add a minimal local context for basic processing
    dataForValidation["@context"] = {
      "@vocab": "http://ddialliance.org/Specification/DDI-CDI/1.0/RDF/",
    };

    // Custom document loader that prevents remote fetching
    const documentLoader = jsonld.documentLoaders.xhr();
    const customLoader = async (url) => {
      console.log("Skipping remote context fetch:", url);
      // Return empty context for any remote URLs
      return {
        contextUrl: null,
        document: { "@context": {} },
        documentUrl: url,
      };
    };

    // Expand with custom loader
    const expanded = await jsonld.expand(dataForValidation, {
      documentLoader: customLoader,
    });

    // Convert expanded JSON-LD to N-Quads
    const nquads = await jsonld.toRDF(expanded, {
      format: "application/n-quads",
      documentLoader: customLoader,
    });

    // Parse the N-Quads into the store
    const parser = new N3.Parser({ format: "N-Quads" });

    parser.parse(nquads, (error, quad, prefixes) => {
      if (error) {
        console.error("Parse error:", error);
        $("#validation-status").html(
          '<span class="validation-badge invalid">Parse Error: ' +
            error.message +
            "</span>"
        );
        return;
      }

      if (quad) {
        dataStore.addQuad(quad);
      } else {
        // Parsing complete, run validation

        runShaclValidation(dataStore);
      }
    });
  } catch (error) {
    console.error("Validation error:", error);
    $("#validation-status").html(
      '<span class="validation-badge invalid">Validation Error: ' +
        error.message +
        "</span>"
    );
  }
}

async function runShaclValidation(dataStore) {
  try {
    // Simple SHACL validation - check required properties and cardinality
    const violations = [];
    const warnings = [];

    // Get all node shapes
    const nodeShapes = shaclShapesStore.getSubjects(
      N3.DataFactory.namedNode(
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
      ),
      N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#NodeShape"),
      null
    );

    // For each node in data, check against its shape
    for (const node of jsonData["@graph"] || []) {
      const nodeId = N3.DataFactory.namedNode(node["@id"]);
      const nodeType = node["@type"];

      if (!nodeType) continue;

      // Find matching shape by target class
      const targetClassPred = N3.DataFactory.namedNode(
        "http://www.w3.org/ns/shacl#targetClass"
      );
      const nodeTypeTerm = N3.DataFactory.namedNode(nodeType);

      for (const shape of nodeShapes) {
        const targetClasses = shaclShapesStore.getObjects(
          shape,
          targetClassPred,
          null
        );

        if (targetClasses.some((tc) => tc.equals(nodeTypeTerm))) {
          // Check properties for this shape
          const propertyPred = N3.DataFactory.namedNode(
            "http://www.w3.org/ns/shacl#property"
          );
          const propertyShapes = shaclShapesStore.getObjects(
            shape,
            propertyPred,
            null
          );

          for (const propShape of propertyShapes) {
            const path = shaclShapesStore.getObjects(
              propShape,
              N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#path"),
              null
            )[0];
            const minCount = shaclShapesStore.getObjects(
              propShape,
              N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#minCount"),
              null
            )[0];
            const maxCount = shaclShapesStore.getObjects(
              propShape,
              N3.DataFactory.namedNode("http://www.w3.org/ns/shacl#maxCount"),
              null
            )[0];

            if (path && minCount) {
              const pathStr = path.value.split("/").pop().split("#").pop();
              const minCountVal = parseInt(minCount.value);
              const actualCount = node[pathStr]
                ? Array.isArray(node[pathStr])
                  ? node[pathStr].length
                  : 1
                : 0;

              if (actualCount < minCountVal) {
                violations.push({
                  focusNode: node["@id"],
                  path: pathStr,
                  message: `Required property '${pathStr}' is missing (minCount: ${minCountVal}, actual: ${actualCount})`,
                });
              }
            }

            if (path && maxCount) {
              const pathStr = path.value.split("/").pop().split("#").pop();
              const maxCountVal = parseInt(maxCount.value);
              const actualCount = node[pathStr]
                ? Array.isArray(node[pathStr])
                  ? node[pathStr].length
                  : 1
                : 0;

              if (actualCount > maxCountVal) {
                violations.push({
                  focusNode: node["@id"],
                  path: pathStr,
                  message: `Property '${pathStr}' exceeds maxCount (maxCount: ${maxCountVal}, actual: ${actualCount})`,
                });
              }
            }
          }
        }
      }
    }

    const report = {
      conforms: violations.length === 0,
      results: violations,
    };

    validationReport = report;

    // Update UI
    if (report.conforms) {
      $("#validation-status").html(
        '<span class="validation-badge valid">' +
          '<span class="glyphicon glyphicon-ok-circle"></span> Valid' +
          "</span>"
      );
    } else {
      $("#validation-status").html(
        '<span class="validation-badge invalid">' +
          '<span class="glyphicon glyphicon-exclamation-sign"></span> ' +
          violations.length +
          " violation(s)" +
          "</span>"
      );
    }

    // Update property rows with validation results
    updatePropertyValidation(violations);
  } catch (error) {
    console.error("SHACL validation error:", error);
    $("#validation-status").html(
      '<span class="validation-badge invalid">Validation Engine Error: ' +
        error.message +
        "</span>"
    );
  }
}

function updatePropertyValidation(violations) {
  // Clear previous validation states
  $(".property-row")
    .removeClass("invalid")
    .find(".validation-message")
    .remove();

  // Group violations by focus node and path
  violations.forEach((violation) => {
    if (violation.focusNode && violation.path) {
      const nodeId = violation.focusNode;
      const path = violation.path;

      // Find matching property row
      const propertyRow = $(
        `.property-row[data-node-id="${nodeId}"][data-property="${path}"]`
      );

      if (propertyRow.length > 0) {
        propertyRow.addClass("invalid");

        // Add validation message
        const message = violation.message || "Validation failed";
        const msgDiv = $("<div>").addClass("validation-message").text(message);
        propertyRow.append(msgDiv);
      }
    }
  });
}
