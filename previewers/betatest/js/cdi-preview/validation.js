// === CDI Previewer: SHACL Validation Logic (using rdf-validate-shacl) ===

// Runs validation end-to-end on the current jsonData and updates #validation-status
async function validateData() {
  $("#validation-status").html(
    '<span class="label label-info">Validating...</span>'
  );

  try {
    if (
      !window.CdiShacl ||
      !window.CdiShacl.SHACLValidator ||
      !window.CdiShacl.rdf
    ) {
      throw new Error(
        "SHACL validation engine is not loaded (CdiShacl bundle missing)"
      );
    }

    const { SHACLValidator, rdf } = window.CdiShacl;

    // Prepare shapes dataset from shaclShapesStore (N3.Store -> DatasetCore)
    const shapesDataset = rdf.dataset();
    shaclShapesStore.getQuads(null, null, null, null).forEach((q) => {
      shapesDataset.add(
        rdf.quad(
          rdf.fromTerm(q.subject),
          rdf.fromTerm(q.predicate),
          rdf.fromTerm(q.object),
          q.graph && q.graph.termType !== "DefaultGraph"
            ? rdf.fromTerm(q.graph)
            : rdf.defaultGraph()
        )
      );
    });

    // Prepare data dataset: convert jsonData to N3 store, then to RDF/JS dataset
    const tempStore = await jsonLdToN3Store(jsonData);
    const dataDataset = rdf.dataset();

    tempStore.getQuads(null, null, null, null).forEach((q) => {
      dataDataset.add(
        rdf.quad(
          rdf.fromTerm(q.subject),
          rdf.fromTerm(q.predicate),
          rdf.fromTerm(q.object),
          q.graph && q.graph.termType !== "DefaultGraph"
            ? rdf.fromTerm(q.graph)
            : rdf.defaultGraph()
        )
      );
    });

    // Run SHACL validation using rdf-validate-shacl
    const validator = new SHACLValidator(shapesDataset, { factory: rdf });
    const report = await validator.validate(dataDataset);

    validationReport = report;

    const violations = [];

    for (const result of report.results) {
      // Map SHACL result to our simple violation structure
      const focusNode =
        result.focusNode && result.focusNode.value
          ? result.focusNode.value
          : null;

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

      const message =
        Array.isArray(result.message) && result.message.length > 0
          ? result.message[0].value || String(result.message[0])
          : "SHACL constraint violation";

      violations.push({
        focusNode: focusNode || "unknown",
        path: path || "unknown",
        message,
        severity: result.severity ? result.severity.value : null,
      });
    }

    // Log violations to console for debugging
    if (violations.length > 0) {
      console.log("Validation violations:");
      violations.forEach((v, i) => {
        console.log(`  ${i + 1}. ${v.focusNode}`);
        console.log(`     Property: ${v.path}`);
        console.log(`     Message: ${v.message}`);
      });
    }

    // Update UI
    if (report.conforms) {
      $("#validation-status").html(
        '<span class="validation-badge valid">' +
          '<span class="glyphicon glyphicon-ok-circle"></span> Valid' +
          "</span>"
      );
      $("#validation-details").empty();
    } else {
      $("#validation-status").html(
        '<span class="validation-badge invalid">' +
          '<span class="glyphicon glyphicon-exclamation-sign"></span> ' +
          violations.length +
          " violation(s)" +
          "</span>" +
          '<button id="toggle-violations-btn" class="btn btn-sm btn-default" style="margin-left: 10px;">' +
          '<span class="glyphicon glyphicon-chevron-down"></span> Show Details' +
          "</button>"
      );

      // Show violations list (initially hidden)
      let detailsHtml =
        '<div class="validation-violations" style="display: none;"><h4>Validation Violations:</h4><ul>';
      violations.forEach((v, i) => {
        const nodeId = v.focusNode.split("/").pop();
        detailsHtml += `<li><strong>${nodeId}</strong> - ${v.path}: ${v.message}</li>`;
      });
      detailsHtml += "</ul></div>";
      $("#validation-details").html(detailsHtml);

      // Add toggle handler
      $("#toggle-violations-btn").click(function () {
        const $details = $(".validation-violations");
        const $btn = $(this);
        const $icon = $btn.find(".glyphicon");

        if ($details.is(":visible")) {
          $details.slideUp(200);
          $icon
            .removeClass("glyphicon-chevron-up")
            .addClass("glyphicon-chevron-down");
          $btn.html(
            '<span class="glyphicon glyphicon-chevron-down"></span> Show Details'
          );
        } else {
          $details.slideDown(200);
          $icon
            .removeClass("glyphicon-chevron-down")
            .addClass("glyphicon-chevron-up");
          $btn.html(
            '<span class="glyphicon glyphicon-chevron-up"></span> Hide Details'
          );
        }
      });
    }

    // Update property rows with validation results
    updatePropertyValidation(violations);
  } catch (error) {
    console.error("Validation error:", error);

    let errorMsg = error.message;

    // Special handling for SPARQL constraint errors
    if (error.message.includes("SPARQLConstraintComponent")) {
      errorMsg =
        "The selected SHACL shapes contain SPARQL constraints, which are not supported in the browser. " +
        "Please use Core SHACL-compatible shapes (e.g., 'DDI-CDI 1.0 (Official)' or 'CDIF Discovery Core').";
    }

    $("#validation-status").html(
      '<span class="validation-badge invalid">Validation Error: ' +
        errorMsg +
        "</span>"
    );
    $("#validation-details").empty();
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
