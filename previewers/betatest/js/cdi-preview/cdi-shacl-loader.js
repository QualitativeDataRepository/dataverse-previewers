// === SHACL Shape Loading (Core SHACL Only) ===

// Load SHACL shapes from a URL with fallback to local
async function loadShapes(shapeSource, customUrl = null) {
  let shapeUrl;
  let fallbackUrl = SHAPE_URLS["local-fallback"];

  // Determine the URL based on the shape source
  if (shapeSource === "custom" && customUrl) {
    shapeUrl = customUrl;
  } else if (SHAPE_URLS[shapeSource]) {
    shapeUrl = SHAPE_URLS[shapeSource];
  } else {
    console.error("Unknown shape source:", shapeSource);
    shapeUrl = SHAPE_URLS["local-fallback"];
    fallbackUrl = null; // Already using fallback
  }

  console.log(`Loading SHACL shapes from: ${shapeUrl}`);

  try {
    // Try loading from the specified URL
    const response = await fetch(shapeUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const shapesText = await response.text();

    // Parse into N3 store (Core SHACL only)
    await parseShapes(shapesText);

    log(
      LOG_LEVEL.INFO,
      `Successfully loaded SHACL shapes from ${shapeUrl}, quad count: ${shaclShapesStore.size}`
    );
    currentShapeSource = shapeSource;

    return true;
  } catch (error) {
    console.warn(`Failed to load SHACL shapes from ${shapeUrl}:`, error);

    // Try fallback if not already using local
    if (fallbackUrl && shapeSource !== "local-fallback") {
      console.log(`Falling back to local shapes: ${fallbackUrl}`);

      try {
        const fallbackResponse = await fetch(fallbackUrl);

        if (!fallbackResponse.ok) {
          throw new Error(`Fallback failed: HTTP ${fallbackResponse.status}`);
        }

        const fallbackShapesText = await fallbackResponse.text();
        await parseShapes(fallbackShapesText);

        console.log(
          `Successfully loaded fallback SHACL shapes, quad count:`,
          shaclShapesStore.size
        );
        currentShapeSource = "local-fallback";

        // Update dropdown to reflect fallback
        $("#shape-selector").val("local-fallback");

        // Show user notification
        alert(
          `Note: Could not load shapes from ${shapeUrl}.\nUsing local built-in shapes instead.\n\nError: ${error.message}`
        );

        return true;
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        throw new Error(
          `Failed to load both primary and fallback shapes: ${error.message}`
        );
      }
    } else {
      throw error;
    }
  }
}

// Parse SHACL shapes text into N3 store
async function parseShapes(shapesText) {
  shaclShapes = shapesText;
  shaclShapesStore = new N3.Store();

  const parser = new N3.Parser();

  return new Promise((resolve, reject) => {
    parser.parse(shapesText, (error, quad, prefixes) => {
      if (error) {
        reject(error);
      } else if (quad) {
        shaclShapesStore.addQuad(quad);
      } else {
        // Parsing complete
        log(LOG_LEVEL.DEBUG, "SHACL shapes parsed successfully");
        resolve();
      }
    });
  });
}

// Convert JSON-LD to N3 Store for validation
async function jsonLdToN3Store(jsonLdData) {
  const store = new N3.Store();

  try {
    // Custom document loader to redirect broken/old DDI-CDI context URLs
    const customLoader = async (url) => {
      // Map of known DDI-CDI context URLs to working GitHub URL
      const DDI_CDI_URLS = [
        "http://ddialliance.org/Specification/DDI-CDI/1.0/RDF/",
        "https://ddi-alliance.bitbucket.io/DDI-CDI/DDI-CDI_v1.0-rc1/encoding/json-ld/ddi-cdi.jsonld",
        "https://docs.ddialliance.org/DDI-CDI/1.0/model/encoding/json-ld/ddi-cdi.jsonld",
        "https://ddi-cdi.github.io/m2t-ng/DDI-CDI_1-0/encoding/json-ld/ddi-cdi.jsonld",
      ];

      const WORKING_URL =
        "https://ddi-cdi.github.io/m2t-ng/DDI-CDI_1-0/encoding/json-ld/ddi-cdi.jsonld";

      // If this is a DDI-CDI context URL, use the working GitHub URL
      if (DDI_CDI_URLS.includes(url)) {
        const response = await fetch(WORKING_URL);
        if (!response.ok) {
          throw new Error(`Failed to load DDI-CDI context: ${response.status}`);
        }
        const doc = await response.json();
        return {
          contextUrl: null,
          document: doc,
          documentUrl: url,
        };
      }

      // For other URLs, fetch normally
      const response = await fetch(url, {
        headers: { Accept: "application/ld+json, application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const doc = await response.json();
      return {
        contextUrl: null,
        document: doc,
        documentUrl: url,
      };
    };

    // Convert JSON-LD to N-Quads format
    // Need base URI to resolve relative # identifiers
    const nquads = await jsonld.toRDF(jsonLdData, {
      format: "application/n-quads",
      base: "http://example.org/data",
      documentLoader: customLoader,
    });

    // Parse N-Quads into N3 store
    const parser = new N3.Parser({ format: "N-Quads" });

    return new Promise((resolve, reject) => {
      parser.parse(nquads, (error, quad, prefixes) => {
        if (error) {
          reject(error);
        } else if (quad) {
          store.addQuad(quad);
        } else {
          // Parsing complete
          resolve(store);
        }
      });
    });
  } catch (error) {
    console.error("Error converting JSON-LD to N3 Store:", error);
    throw error;
  }
}
