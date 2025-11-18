function updateSaveButton() {
  const hasChanges = $(".property-row.changed").length > 0;
  $("#save-btn").prop("disabled", !hasChanges);
}

function collectChangesFromDOM() {
  // Only update jsonData if we're in edit mode and have actual changes
  if (!isEditMode) {
    console.log("collectChangesFromDOM: Not in edit mode, skipping");
    return; // Don't modify data in view mode
  }

  // Check if there are any actual changes
  const hasChanges = $(".property-row.changed").length > 0;
  console.log("collectChangesFromDOM: Found", hasChanges, "changed rows");
  if (!hasChanges) {
    return; // No changes, keep original jsonData unchanged
  }

  // Update only the changed properties in jsonData, preserve everything else
  $(".node-card").each(function () {
    const $card = $(this);
    const nodeId = $card.find(".node-id").first().text();

    // Find the node in jsonData
    const node = jsonData["@graph"].find((n) => n["@id"] === nodeId);
    if (!node) {
      console.warn("collectChangesFromDOM: Node not found:", nodeId);
      return; // Skip if not found
    }

    // Only update properties that have changed IN THIS NODE (not nested nodes)
    // Use children().find() to get only direct properties, not nested node properties
    $card
      .children(".node-body")
      .find(".property-row.changed")
      .each(function () {
        const key = $(this).attr("data-property");
        const inputs = $(this).find("input, textarea, select");

        console.log(
          "collectChangesFromDOM: Updating",
          nodeId,
          key,
          "with",
          inputs.length,
          "inputs"
        );

        if (inputs.length === 1) {
          // Single value
          const input = inputs.eq(0);
          let val = input.val();

          console.log(
            "collectChangesFromDOM: Old value:",
            node[key],
            "-> New value:",
            val
          );

          try {
            val = JSON.parse(val);
          } catch (e) {
            // Keep as string if not valid JSON
          }
          node[key] = val;
        } else if (inputs.length > 1) {
          // Array of values
          const values = [];
          inputs.each(function () {
            let val = $(this).val();
            try {
              val = JSON.parse(val);
            } catch (e) {
              // Keep as string
            }
            values.push(val);
          });
          console.log(
            "collectChangesFromDOM: Old value:",
            node[key],
            "-> New value:",
            values
          );
          node[key] = values;
        }
      });
  });

  console.log("collectChangesFromDOM: Complete. Updated jsonData:", jsonData);
  // jsonData['@graph'] is already updated in place - no need to replace it
}

function saveChanges() {
  // First, collect any changes from the DOM
  collectChangesFromDOM();

  // Clear API token input and show modal
  $("#apiTokenInput").val("");
  $("#saveModal").modal("show");
}

async function saveToDataverse() {
  const apiToken = $("#apiTokenInput").val().trim();

  if (!apiToken) {
    alert("Please enter your API token.");
    return;
  }

  // Close the modal and show loading
  $("#saveModal").modal("hide");

  try {
    // Prepare the data as JSON-LD string
    const jsonldString = JSON.stringify(jsonData, null, 2);

    // Use the exact MIME type that matches the external tool registration
    // Note: Dataverse's replace API strips spaces from MIME type parameters
    const mimeType =
      'application/ld+json;profile="http://www.w3.org/ns/json-ld#flattened http://www.w3.org/ns/json-ld#compacted https://ddialliance.org/specification/ddi-cdi/1.0"';
    const blob = new Blob([jsonldString], { type: mimeType });

    // Create form data
    const formData = new FormData();
    formData.append("file", blob, originalFileName);
    formData.append(
      "jsonData",
      JSON.stringify({
        description: "Updated CDI metadata",
        categories: ["Data"],
        forceReplace: true,
      })
    );

    // Show saving indicator
    $("#save-btn")
      .prop("disabled", true)
      .html(
        '<span class="glyphicon glyphicon-refresh spinning"></span> Saving...'
      );

    // Call Dataverse API to replace file
    const response = await fetch(`${siteUrl}/api/files/${fileId}/replace`, {
      method: "POST",
      headers: {
        "X-Dataverse-key": apiToken,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.status === "OK") {
      $(".property-row").removeClass("changed");
      updateSaveButton();
    } else {
      throw new Error("Unexpected response: " + JSON.stringify(result));
    }
  } catch (error) {
    console.error("Save error:", error);
    alert(
      "✗ Failed to save to Dataverse:\n" +
        error.message +
        "\n\nPlease check:\n- Your API token is valid\n- You have write access to this dataset\n- The dataset is accessible"
    );
  } finally {
    // Reset button
    $("#save-btn")
      .prop("disabled", false)
      .html(
        '<span class="glyphicon glyphicon-floppy-disk"></span> Save Changes'
      );
  }
}

function exportData() {
  // Collect any changes from DOM before exporting
  collectChangesFromDOM();

  const dataStr = JSON.stringify(jsonData, null, 2);
  // Use the exact MIME type that matches the external tool registration
  // Note: Dataverse's replace API strips spaces from MIME type parameters
  const mimeType =
    'application/ld+json;profile="http://www.w3.org/ns/json-ld#flattened http://www.w3.org/ns/json-ld#compacted https://ddialliance.org/specification/ddi-cdi/1.0"';
  const blob = new Blob([dataStr], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "cdi-data.jsonld";
  a.click();

  URL.revokeObjectURL(url);
}
