// Logging levels
const LOG_LEVEL = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Check URL parameter for debug mode
const urlParams = new URLSearchParams(window.location.search);
let currentLogLevel =
  urlParams.get("debug") === "true" ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN;

function log(level, ...args) {
  if (level <= currentLogLevel) {
    switch (level) {
      case LOG_LEVEL.ERROR:
        console.error(...args);
        break;
      case LOG_LEVEL.WARN:
        console.warn(...args);
        break;
      case LOG_LEVEL.INFO:
        console.info(...args);
        break;
      case LOG_LEVEL.DEBUG:
        console.log(...args);
        break;
    }
  }
}

let jsonData = null;
let shaclShapes = null;
let shaclShapesStore = null;
let isEditMode = false;
let originalData = null;
let validationReport = null;
let fileId = null;
let siteUrl = null;
let originalFileName = "cdi-metadata.jsonld"; // Default filename
let expandedJsonLd = null; // Store expanded JSON-LD for property URI lookup
let currentShapeSource = "ddi-cdi-official"; // Track currently loaded shape source
let hadOriginalGraph = true; // Track if original data had @graph (for export preservation)

// Comunica SPARQL engine for sh:SPARQLTarget support
let comunicaEngine = null;

// SPARQL target cache for sh:SPARQLTarget support
const sparqlTargetCache = {
  queries: {}, // shapeUri → SPARQL query string
  results: {}, // shapeUri → Set of matching node URIs
  executed: false,
  enabled: true, // Feature flag for easy disable if needed
};

// SHACL shape URLs
const SHAPE_URLS = {
  "ddi-cdi-official":
    "https://raw.githubusercontent.com/ddi-cdi/ddi-cdi.github.io/main/m2t-ng/DDI-CDI_1-0/encoding/shacl/ddi-cdi.shacl.ttl",
  "cdif-discovery":
    "https://raw.githubusercontent.com/Cross-Domain-Interoperability-Framework/validation/main/CDIF-Discovery-Core-Shapes.ttl",
  "cdif-discovery-local": "shapes/CDIF-Discovery-Core-Shapes.ttl",
  "local-fallback": "shapes/ddi-cdi-official.ttl",
};

// Initialize
$(document).ready(async function () {
  try {
    // Get file URL from query parameters
    const urlParams = new URLSearchParams(window.location.search);
    let fileUrl;
    let datasetMetadataUrl = null;

    // Check if we have a callback parameter (external tool invocation)
    const callbackParam = urlParams.get("callback");
    if (callbackParam) {
      // Decode the callback URL
      const callbackUrl = atob(callbackParam);

      // Fetch the tool parameters from the callback URL
      const paramsResponse = await fetch(callbackUrl);
      if (!paramsResponse.ok) {
        throw new Error(
          `Failed to fetch tool parameters: ${paramsResponse.status}`
        );
      }
      const paramsData = await paramsResponse.json();

      // Extract parameters from the response
      const queryParams = paramsData.data.queryParameters || {};
      fileId = queryParams.fileid;
      siteUrl = queryParams.siteUrl;

      // Get the dataset metadata signed URL if available
      const signedUrls = paramsData.data.signedUrls || [];
      const metadataUrlObj = signedUrls.find(
        (u) => u.name === "getDatasetVersionMetadata"
      );
      if (metadataUrlObj) {
        datasetMetadataUrl = metadataUrlObj.signedUrl;
      }
    } else {
      // Direct parameters (for testing)
      fileId = urlParams.get("fileid");
      siteUrl = urlParams.get("siteUrl");
    }

    // Check required parameters
    if (!fileId || !siteUrl) {
      // Show load local file button instead of error
      $("#load-local-btn").show();
      $("#content").html(`
                        <div class="alert alert-info">
                            <strong>No Dataverse parameters detected.</strong> Use the "Load Local File" button in the top left to select a CDI JSON-LD file from your computer.
                        </div>
                    `);
      setupEventHandlers();
      return;
    }

    // Try to get the original filename from dataset metadata
    try {
      if (datasetMetadataUrl) {
        // Use signed URL from callback
        const metadataResponse = await fetch(datasetMetadataUrl);
        if (metadataResponse.ok) {
          const metadata = await metadataResponse.json();
          // Find the file in the files array by matching fileId
          const files = metadata.data.files || [];
          const fileInfo = files.find(
            (f) => f.dataFile && f.dataFile.id == fileId
          );
          if (fileInfo && fileInfo.dataFile && fileInfo.dataFile.filename) {
            originalFileName = fileInfo.dataFile.filename;
          }
        }
      } else {
        // Fallback: try direct file API
        const metadataResponse = await fetch(`${siteUrl}/api/files/${fileId}`);
        if (metadataResponse.ok) {
          const metadata = await metadataResponse.json();
          if (
            metadata.data &&
            metadata.data.dataFile &&
            metadata.data.dataFile.filename
          ) {
            originalFileName = metadata.data.dataFile.filename;
          }
        }
      }
    } catch (e) {
      console.warn("Could not fetch filename, using default:", e);
    }

    // Load from Dataverse API
    fileUrl = siteUrl + "/api/access/datafile/" + fileId;

    // Load JSON-LD data
    const response = await fetch(fileUrl);

    // Check if response is OK
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check content type
    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.includes("json")) {
      throw new Error(
        `Invalid content type: ${contentType}. This previewer requires JSON-LD files (application/ld+json or application/json).`
      );
    }

    // Try to parse as JSON
    let jsonText;
    try {
      jsonText = await response.text();
      jsonData = JSON.parse(jsonText);
    } catch (parseError) {
      throw new Error(
        `Failed to parse JSON: ${parseError.message}. This file may not be valid JSON-LD.`
      );
    }

    // Normalize to @graph format if needed
    try {
      jsonData = await normalizeToGraphFormat(jsonData);
    } catch (normalizeError) {
      throw new Error(
        `Failed to normalize JSON-LD structure: ${normalizeError.message}`
      );
    }

    // Verify we now have @graph (should always be true after normalization)
    if (!jsonData["@graph"]) {
      throw new Error(
        "Internal error: Normalization did not produce @graph structure."
      );
    }

    originalData = JSON.parse(JSON.stringify(jsonData)); // Deep clone

    // Expand JSON-LD to get full property URIs
    try {
      expandedJsonLd = await jsonld.expand(jsonData);
      console.log("Expanded JSON-LD for property URI mapping");
    } catch (expandError) {
      console.warn("Could not expand JSON-LD:", expandError);
      expandedJsonLd = null;
    }

    // Load SHACL shapes - use the selected shape from dropdown
    try {
      const selectedShape = $("#shape-selector").val() || "ddi-cdi-official";
      await loadShaclShapes(selectedShape);
    } catch (shapeError) {
      console.error("Failed to load SHACL shapes:", shapeError);
      throw new Error(
        `Failed to load validation shapes: ${shapeError.message}`
      );
    }

    // Execute SPARQL targets to match nodes to shapes
    await executeSparqlTargets();

    // Render the data
    renderData();

    // Setup event handlers
    setupEventHandlers();
  } catch (error) {
    console.error("Error loading data:", error);
    $("#load-local-btn").show();
    $("#content").html(`
                    <div class="alert alert-danger">
                        <strong>Error:</strong> Failed to load CDI data. ${error.message}
                    </div>
                `);
    setupEventHandlers();
  }
});
