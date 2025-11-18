// === CDI Previewer: SHACL Validation Logic (using rdf-validate-shacl) ===

// Runs validation end-to-end on the current jsonData and updates #validation-status
async function validateData() {
  $("#validation-status").html(
    '<span class="label label-info">Validating...</span>'
  );

  try {
    if (!window.CdiShacl || !window.CdiShacl.SHACLValidator || !window.CdiShacl.rdf) {
      throw new Error("SHACL validation engine is not loaded (CdiShacl bundle missing)");
    }

    const { SHACLValidator, rdf } = window.CdiShacl;

    // Prepare shapes dataset from shaclShapesStore (N3.Store -> DatasetCore)
    const shapesDataset = rdf.dataset();
    shaclShapesStore.getQuads(null, null, null, null).forEach((q) => {
      shapesDataset.add(rdf.quad(
        rdf.fromTerm(q.subject),
        rdf.fromTerm(q.predicate),
        rdf.fromTerm(q.object),
        q.graph && q.graph.termType !== "DefaultGraph" ? rdf.fromTerm(q.graph) : rdf.defaultGraph()
      ));
    });

    // Prepare data dataset: convert jsonData to N3 store, then to RDF/JS dataset
    const tempStore = await jsonLdToN3Store(jsonData);
    const dataDataset = rdf.dataset();
    
    tempStore.getQuads(null, null, null, null).forEach((q) => {
      dataDataset.add(rdf.quad(
        rdf.fromTerm(q.subject),
        rdf.fromTerm(q.predicate),
        rdf.fromTerm(q.object),
        q.graph && q.graph.termType !== "DefaultGraph" ? rdf.fromTerm(q.graph) : rdf.defaultGraph()
      ));
    });

    // Run SHACL validation using rdf-validate-shacl
    const validator = new SHACLValidator(shapesDataset, { factory: rdf });
    const report = await validator.validate(dataDataset);

    validationReport = report;

    const violations = [];

    for (const result of report.results) {
      // Map SHACL result to our simple violation structure
      const focusNode = result.focusNode && result.focusNode.value ? result.focusNode.value : null;

      let path = null;
      if (result.path) {
        if (result.path.value) {
          // NamedNode path
          path = result.path.value.split("/").pop().split("#").pop();
        } else if (Array.isArray(result.path)) {
          // Fallback for complex paths: take last named node if available
          const lastSegment = result.path[result.path.length - 1];
          if (lastSegment && lastSegment.value) {
            path = lastSegment.value.split("/").pop().split("#").pop();
          }
        }
      }

      const message = Array.isArray(result.message) && result.message.length > 0
        ? result.message[0].value || String(result.message[0])
        : "SHACL constraint violation";

      if (focusNode && path) {
        violations.push({
          focusNode,
          path,
          message,
        });
      }
    }

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
    console.error("Validation error:", error);
    $("#validation-status").html(
      '<span class="validation-badge invalid">Validation Error: ' +
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
