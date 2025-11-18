// === CDI Previewer: JSON-LD Context Normalization ===
//
// Handles legacy DDI-CDI context URLs and local context resolution.
// Used for internal viewer behavior (expansion, suggestions, SHACL classification).
// Does NOT modify the original data when exporting.

// Legacy DDI-CDI JSON-LD context URL that we want to handle via a local copy
const LEGACY_CDI_CONTEXT_URL =
  "https://ddi-alliance.bitbucket.io/DDI-CDI/DDI-CDI_v1.0-rc1/encoding/json-ld/ddi-cdi.jsonld";

// Map of legacy / external context URLs to local JSON-LD context documents
// NOTE: This is used **only** for internal viewer/editor behavior (expansion,
// suggestions, SHACL classification). We DO NOT rewrite the original data when
// exporting – the source JSON-LD stays as-is.
const LOCAL_CONTEXT_MAP = {
  [LEGACY_CDI_CONTEXT_URL]: "shapes/ddi-cdi.jsonld",
};

// Apply viewer-local context normalization/merging without mutating the
// original data structure. Returns a shallow-cloned object with a
// viewer-specific @context that can then be passed to jsonld.expand/flatten.
function buildViewerContext(data) {
  const originalContext = data["@context"];

  // No @context – nothing we can sensibly do here
  if (!originalContext) return undefined;

  // Helper: convert a single context entry (URL/string or object) into a
  // local, viewer-usable object. For URLs we may substitute a local JSON-LD
  // file if known; for inline objects we keep them as-is.
  function resolveContextEntry(entry) {
    // String: could be a URL or a term
    if (typeof entry === "string") {
      const mapped = LOCAL_CONTEXT_MAP[entry];
      if (mapped) {
        // Use a link to the local JSON-LD context document so that
        // jsonld.js can resolve it via XHR. We intentionally do NOT
        // inline/merge this file; it is large and we want to keep the
        // source file untouched for export.
        return mapped;
      }
      // Unknown string – keep as-is
      return entry;
    }

    // Plain object – use as-is
    if (typeof entry === "object") {
      return entry;
    }

    // Anything else (rare) – keep unchanged
    return entry;
  }

  // Case 1: @context is an array – we want to merge it for the viewer.
  if (Array.isArray(originalContext)) {
    const mergedObject = {};
    const keptUrls = [];

    for (const ctx of originalContext) {
      const resolved = resolveContextEntry(ctx);

      // Keep URLs / strings in a list so that remote/local contexts still
      // participate in expansion if needed.
      if (typeof resolved === "string") {
        keptUrls.push(resolved);
      } else if (resolved && typeof resolved === "object") {
        Object.assign(mergedObject, resolved);
      }
    }

    // If we have at least one object, build a merged array in which the
    // object comes last so that its term mappings are visible to the
    // viewer/UI. Any URL contexts are kept in front.
    if (Object.keys(mergedObject).length > 0) {
      if (keptUrls.length === 0) {
        return mergedObject;
      }
      return [...keptUrls, mergedObject];
    }

    // Fallback: no objects, just URLs – keep them as-is (after mapping).
    return keptUrls.length > 0 ? keptUrls : originalContext;
  }

  // Case 2: single string or object – just resolve once.
  return resolveContextEntry(originalContext);
}

// Normalize JSON-LD to @graph format
async function normalizeToGraphFormat(data) {
  // Check if already has @graph
  if (data["@graph"]) {
    log(LOG_LEVEL.DEBUG, "Data already has @graph, no normalization needed");
    hadOriginalGraph = true;
    $("#normalization-notice").hide();
    return data;
  }

  log(LOG_LEVEL.DEBUG, "Data does not have @graph, normalizing...");
  hadOriginalGraph = false;

  // Special handling for DDI-CDI format with DDICDIModels and @included
  if (data["DDICDIModels"] && Array.isArray(data["DDICDIModels"])) {
    log(LOG_LEVEL.DEBUG, "Detected DDI-CDI format with DDICDIModels");

    // Combine DDICDIModels and @included into @graph
    let graphNodes = [...data["DDICDIModels"]];

    if (data["@included"] && Array.isArray(data["@included"])) {
      log(LOG_LEVEL.DEBUG, "Also merging @included nodes");
      graphNodes = graphNodes.concat(data["@included"]);
    }

    log(LOG_LEVEL.DEBUG, `Combined ${graphNodes.length} nodes into @graph`);

    // Show notice to user
    $("#normalization-notice").show();

    const viewerContext = buildViewerContext(data);

    return {
      // Prefer viewer-specific context if available, otherwise fall back
      // to the original context or an empty object.
      "@context":
        viewerContext !== undefined ? viewerContext : data["@context"] || {},
      "@graph": graphNodes,
    };
  }

  try {
    // Use jsonld.flatten() to convert to @graph format
    // This handles nested structures and extracts all nodes into a flat array
    // Build a viewer-specific copy that keeps the original data intact but
    // normalizes @context for expansion and suggestions.
    const dataForViewer = {
      ...data,
    };

    const viewerContext = buildViewerContext(dataForViewer);
    if (viewerContext !== undefined) {
      dataForViewer["@context"] = viewerContext;
    }

    const flattened = await jsonld.flatten(dataForViewer);

    log(
      LOG_LEVEL.DEBUG,
      "Successfully normalized to @graph format using jsonld.flatten()"
    );
    log(
      LOG_LEVEL.DEBUG,
      `Graph nodes: ${flattened["@graph"] ? flattened["@graph"].length : 0}`
    );

    // Show notice to user
    $("#normalization-notice").show();

    return flattened;
  } catch (error) {
    console.error("Failed to normalize JSON-LD:", error);

    // Fallback: manually wrap in @graph if it's a single object
    if (data["@id"] || data["@type"]) {
      log(LOG_LEVEL.DEBUG, "Fallback: wrapping single object in @graph");
      $("#normalization-notice").show();
      const viewerContext = buildViewerContext(data);

      return {
        "@context":
          viewerContext !== undefined ? viewerContext : data["@context"] || {},
        "@graph": [data],
      };
    }

    // If all else fails, throw error
    throw new Error(
      "Unable to normalize JSON-LD structure. Please ensure the file is valid JSON-LD."
    );
  }
}
