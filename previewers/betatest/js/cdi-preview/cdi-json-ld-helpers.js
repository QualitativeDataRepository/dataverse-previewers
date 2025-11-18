
// Normalize JSON-LD to @graph format used by the editor.
async function normalizeToGraphFormat(data) {
  if (data["@graph"]) {
    log(LOG_LEVEL.DEBUG, "Data already has @graph, no normalization needed");
    hadOriginalGraph = true;
    $("#normalization-notice").hide();
    return data;
  }

  log(LOG_LEVEL.DEBUG, "Data does not have @graph, normalizing...");
  hadOriginalGraph = false;

  if (data["DDICDIModels"] && Array.isArray(data["DDICDIModels"])) {
    log(LOG_LEVEL.DEBUG, "Detected DDI-CDI format with DDICDIModels");

    let graphNodes = [...data["DDICDIModels"]];

    if (data["@included"] && Array.isArray(data["@included"])) {
      log(LOG_LEVEL.DEBUG, "Also merging @included nodes");
      graphNodes = graphNodes.concat(data["@included"]);
    }

    log(LOG_LEVEL.DEBUG, `Combined ${graphNodes.length} nodes into @graph`);
    $("#normalization-notice").show();

    return {
      "@context": data["@context"] || {},
      "@graph": graphNodes,
    };
  }

  try {
    const flattened = await jsonld.flatten(data);

    log(
      LOG_LEVEL.DEBUG,
      "Successfully normalized to @graph format using jsonld.flatten()"
    );
    log(
      LOG_LEVEL.DEBUG,
      `Graph nodes: ${flattened["@graph"] ? flattened["@graph"].length : 0}`
    );

    $("#normalization-notice").show();
    return flattened;
  } catch (error) {
    console.error("Failed to normalize JSON-LD:", error);

    if (data["@id"] || data["@type"]) {
      log(LOG_LEVEL.DEBUG, "Fallback: wrapping single object in @graph");
      $("#normalization-notice").show();
      return {
        "@context": data["@context"] || {},
        "@graph": [data],
      };
    }

    throw new Error(
      "Unable to normalize JSON-LD structure. Please ensure the file is valid JSON-LD."
    );
  }
}
