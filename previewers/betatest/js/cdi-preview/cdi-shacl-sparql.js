// === SHACL & SPARQL Helpers ===

// Load SHACL shapes from a URL with fallback to local
async function loadShaclShapes(shapeSource, customUrl = null) {
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
    const response = await fetch(shapeUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const shapesText = await response.text();
    await parseShaclShapes(shapesText);

    log(
      LOG_LEVEL.INFO,
      `Successfully loaded SHACL shapes from ${shapeUrl}, quad count: ${shaclShapesStore.size}`
    );
    currentShapeSource = shapeSource;
    return true;
  } catch (error) {
    console.warn(`Failed to load SHACL shapes from ${shapeUrl}:`, error);

    if (fallbackUrl && shapeSource !== "local-fallback") {
      console.log(`Falling back to local shapes: ${fallbackUrl}`);

      try {
        const fallbackResponse = await fetch(fallbackUrl);

        if (!fallbackResponse.ok) {
          throw new Error(`Fallback failed: HTTP ${fallbackResponse.status}`);
        }

        const fallbackShapesText = await fallbackResponse.text();
        await parseShaclShapes(fallbackShapesText);

        console.log(
          "Successfully loaded fallback SHACL shapes, quad count:",
          shaclShapesStore.size
        );
        currentShapeSource = "local-fallback";
        $("#shape-selector").val("local-fallback");

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
async function parseShaclShapes(shapesText) {
  shaclShapes = shapesText;
  shaclShapesStore = new N3.Store();

  const parser = new N3.Parser();

  return new Promise((resolve, reject) => {
    parser.parse(shapesText, (error, quad) => {
      if (error) {
        reject(error);
      } else if (quad) {
        shaclShapesStore.addQuad(quad);
      } else {
        parseSparqlTargets();
        resolve();
      }
    });
  });
}

// Parse SPARQL targets from loaded SHACL shapes
function parseSparqlTargets() {
  if (!sparqlTargetCache.enabled || !shaclShapesStore) {
    console.log("SPARQL target support disabled or no shapes loaded");
    return;
  }

  sparqlTargetCache.queries = {};
  sparqlTargetCache.results = {};
  sparqlTargetCache.executed = false;

  console.log("Parsing SPARQL targets from SHACL shapes...");

  const SH_TARGET = "http://www.w3.org/ns/shacl#target";
  const SH_SPARQL_TARGET = "http://www.w3.org/ns/shacl#SPARQLTarget";
  const SH_SELECT = "http://www.w3.org/ns/shacl#select";
  const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

  const targetQuads = shaclShapesStore.getQuads(null, SH_TARGET, null, null);

  targetQuads.forEach((quad) => {
    const shapeUri = quad.subject.value;
    const targetNode = quad.object;

    const typeQuads = shaclShapesStore.getQuads(
      targetNode,
      RDF_TYPE,
      SH_SPARQL_TARGET,
      null
    );
    if (typeQuads.length > 0) {
      const selectQuads = shaclShapesStore.getQuads(
        targetNode,
        SH_SELECT,
        null,
        null
      );
      if (selectQuads.length > 0) {
        const sparqlQuery = selectQuads[0].object.value;
        sparqlTargetCache.queries[shapeUri] = sparqlQuery;
        console.log(
          `Found SPARQL target for shape ${shapeUri}:`,
          sparqlQuery.substring(0, 80) + "..."
        );
      }
    }
  });

  const targetCount = Object.keys(sparqlTargetCache.queries).length;
  log(
    LOG_LEVEL.INFO,
    `Parsed ${targetCount} SPARQL target(s) from SHACL shapes`
  );
}

// Execute SPARQL targets against loaded data
async function executeSparqlTargets() {
  if (
    !sparqlTargetCache.enabled ||
    !jsonData ||
    Object.keys(sparqlTargetCache.queries).length === 0
  ) {
    log(LOG_LEVEL.DEBUG, "SPARQL targets: nothing to execute");
    sparqlTargetCache.executed = true;
    return;
  }

  log(LOG_LEVEL.INFO, "Executing SPARQL targets against data...");
  const startTime = performance.now();

  try {
    if (!comunicaEngine) {
      log(LOG_LEVEL.DEBUG, "Initializing Comunica QueryEngine...");
      comunicaEngine = new Comunica.QueryEngine();
    }

    const dataStore = await jsonLdToN3Store(jsonData);
    log(LOG_LEVEL.DEBUG, `Created N3 store with ${dataStore.size} quads`);

    const typeQuads = dataStore.getQuads(
      null,
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      null
    );
    log(
      LOG_LEVEL.DEBUG,
      `Found ${typeQuads.length} type declarations in RDF store`
    );

    const datasetQuadsHttp = dataStore.getQuads(
      null,
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      "http://schema.org/Dataset"
    );
    const datasetQuadsHttps = dataStore.getQuads(
      null,
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      "https://schema.org/Dataset"
    );
    log(
      LOG_LEVEL.DEBUG,
      `Found ${
        datasetQuadsHttp.length + datasetQuadsHttps.length
      } schema:Dataset instances`
    );

    const queryPromises = Object.entries(sparqlTargetCache.queries).map(
      async ([shapeUri, query]) => {
        try {
          log(LOG_LEVEL.DEBUG, `Executing SPARQL for shape ${shapeUri}`);

          const bindingsStream = await comunicaEngine.queryBindings(query, {
            sources: [dataStore],
          });
          const bindings = await bindingsStream.toArray();

          const matchedNodes = new Set();
          bindings.forEach((binding) => {
            const thisVar = binding.get("this");
            if (thisVar) {
              matchedNodes.add(thisVar.value);
              log(LOG_LEVEL.DEBUG, `  Match: ${thisVar.value}`);
            }
          });

          sparqlTargetCache.results[shapeUri] = matchedNodes;
          log(
            LOG_LEVEL.DEBUG,
            `Shape ${shapeUri}: ${matchedNodes.size} node(s) matched`
          );
          if (matchedNodes.size > 0) {
            log(
              LOG_LEVEL.INFO,
              `✓ SPARQL matched nodes: ${Array.from(matchedNodes).join(", ")}`
            );
          } else {
            log(LOG_LEVEL.INFO, "✗ SPARQL found 0 matches");
          }

          return { shapeUri, count: matchedNodes.size };
        } catch (queryError) {
          console.error(
            `Error executing SPARQL for shape ${shapeUri}:`,
            queryError
          );
          sparqlTargetCache.results[shapeUri] = new Set();
          return { shapeUri, count: 0, error: queryError.message };
        }
      }
    );

    const results = await Promise.all(queryPromises);

    const endTime = performance.now();
    const totalMatches = results.reduce((sum, r) => sum + r.count, 0);
    log(
      LOG_LEVEL.INFO,
      `SPARQL execution complete: ${totalMatches} total matches in ${(
        endTime - startTime
      ).toFixed(2)}ms`
    );

    sparqlTargetCache.executed = true;
  } catch (error) {
    console.error("Error executing SPARQL targets:", error);
    sparqlTargetCache.executed = true;
  }
}

// Convert JSON-LD to N3 Store for SPARQL querying
async function jsonLdToN3Store(jsonLdData) {
  const store = new N3.Store();

  try {
    const nquads = await jsonld.toRDF(jsonLdData, {
      format: "application/n-quads",
    });
    const parser = new N3.Parser({ format: "N-Quads" });

    return new Promise((resolve, reject) => {
      parser.parse(nquads, (error, quad) => {
        if (error) {
          reject(error);
        } else if (quad) {
          store.addQuad(quad);
        } else {
          resolve(store);
        }
      });
    });
  } catch (error) {
    console.error("Error converting JSON-LD to N3 Store:", error);
    throw error;
  }
}
