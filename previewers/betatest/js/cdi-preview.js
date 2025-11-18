        // Logging levels
        const LOG_LEVEL = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        
        // Check URL parameter for debug mode
        const urlParams = new URLSearchParams(window.location.search);
        let currentLogLevel = urlParams.get('debug') === 'true' ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN;
        
        function log(level, ...args) {
            if (level <= currentLogLevel) {
                switch(level) {
                    case LOG_LEVEL.ERROR: console.error(...args); break;
                    case LOG_LEVEL.WARN: console.warn(...args); break;
                    case LOG_LEVEL.INFO: console.info(...args); break;
                    case LOG_LEVEL.DEBUG: console.log(...args); break;
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
        let originalFileName = 'cdi-metadata.jsonld'; // Default filename
        let expandedJsonLd = null; // Store expanded JSON-LD for property URI lookup
        let currentShapeSource = 'ddi-cdi-official'; // Track currently loaded shape source
        let hadOriginalGraph = true; // Track if original data had @graph (for export preservation)
        
        // Comunica SPARQL engine for sh:SPARQLTarget support
        let comunicaEngine = null;
        
        // SPARQL target cache for sh:SPARQLTarget support
        const sparqlTargetCache = {
            queries: {},      // shapeUri → SPARQL query string
            results: {},      // shapeUri → Set of matching node URIs
            executed: false,
            enabled: true     // Feature flag for easy disable if needed
        };
        
        // SHACL shape URLs
        const SHAPE_URLS = {
            'ddi-cdi-official': 'https://raw.githubusercontent.com/ddi-cdi/ddi-cdi.github.io/main/m2t-ng/DDI-CDI_1-0/encoding/shacl/ddi-cdi.shacl.ttl',
            'cdif-discovery': 'https://raw.githubusercontent.com/Cross-Domain-Interoperability-Framework/validation/main/CDIF-Discovery-Core-Shapes.ttl',
            'cdif-discovery-local': 'shapes/CDIF-Discovery-Core-Shapes.ttl',
            'local-fallback': 'shapes/ddi-cdi-official.ttl'
        };

        // Load SHACL shapes from a URL with fallback to local
        async function loadShaclShapes(shapeSource, customUrl = null) {
            let shapeUrl;
            let fallbackUrl = SHAPE_URLS['local-fallback'];
            
            // Determine the URL based on the shape source
            if (shapeSource === 'custom' && customUrl) {
                shapeUrl = customUrl;
            } else if (SHAPE_URLS[shapeSource]) {
                shapeUrl = SHAPE_URLS[shapeSource];
            } else {
                console.error('Unknown shape source:', shapeSource);
                shapeUrl = SHAPE_URLS['local-fallback'];
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
                
                // Parse into N3 store
                await parseShaclShapes(shapesText);
                
                log(LOG_LEVEL.INFO, `Successfully loaded SHACL shapes from ${shapeUrl}, quad count: ${shaclShapesStore.size}`);
                currentShapeSource = shapeSource;
                
                return true;
                
            } catch (error) {
                console.warn(`Failed to load SHACL shapes from ${shapeUrl}:`, error);
                
                // Try fallback if not already using local
                if (fallbackUrl && shapeSource !== 'local-fallback') {
                    console.log(`Falling back to local shapes: ${fallbackUrl}`);
                    
                    try {
                        const fallbackResponse = await fetch(fallbackUrl);
                        
                        if (!fallbackResponse.ok) {
                            throw new Error(`Fallback failed: HTTP ${fallbackResponse.status}`);
                        }
                        
                        const fallbackShapesText = await fallbackResponse.text();
                        await parseShaclShapes(fallbackShapesText);
                        
                        console.log(`Successfully loaded fallback SHACL shapes, quad count:`, shaclShapesStore.size);
                        currentShapeSource = 'local-fallback';
                        
                        // Update dropdown to reflect fallback
                        $('#shape-selector').val('local-fallback');
                        
                        // Show user notification
                        alert(`Note: Could not load shapes from ${shapeUrl}.\nUsing local built-in shapes instead.\n\nError: ${error.message}`);
                        
                        return true;
                        
                    } catch (fallbackError) {
                        console.error('Fallback also failed:', fallbackError);
                        throw new Error(`Failed to load both primary and fallback shapes: ${error.message}`);
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
                parser.parse(shapesText, (error, quad, prefixes) => {
                    if (error) {
                        reject(error);
                    } else if (quad) {
                        shaclShapesStore.addQuad(quad);
                    } else {
                        // Parsing complete, now parse SPARQL targets
                        parseSparqlTargets();
                        resolve();
                    }
                });
            });
        }
        
        // Parse SPARQL targets from loaded SHACL shapes
        function parseSparqlTargets() {
            if (!sparqlTargetCache.enabled || !shaclShapesStore) {
                console.log('SPARQL target support disabled or no shapes loaded');
                return;
            }
            
            // Clear previous cache
            sparqlTargetCache.queries = {};
            sparqlTargetCache.results = {};
            sparqlTargetCache.executed = false;
            
            console.log('Parsing SPARQL targets from SHACL shapes...');
            
            const SH_TARGET = 'http://www.w3.org/ns/shacl#target';
            const SH_SPARQL_TARGET = 'http://www.w3.org/ns/shacl#SPARQLTarget';
            const SH_SELECT = 'http://www.w3.org/ns/shacl#select';
            const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
            
            // Find all shapes that have sh:target
            const targetQuads = shaclShapesStore.getQuads(null, SH_TARGET, null, null);
            
            targetQuads.forEach(quad => {
                const shapeUri = quad.subject.value;
                const targetNode = quad.object; // Keep as Term object to handle blank nodes
                
                // Check if this target is a SPARQLTarget
                const typeQuads = shaclShapesStore.getQuads(
                    targetNode,
                    RDF_TYPE,
                    SH_SPARQL_TARGET,
                    null
                );
                
                if (typeQuads.length > 0) {
                    // This is a SPARQL target, get the select query
                    const selectQuads = shaclShapesStore.getQuads(
                        targetNode,
                        SH_SELECT,
                        null,
                        null
                    );
                    
                    if (selectQuads.length > 0) {
                        const sparqlQuery = selectQuads[0].object.value;
                        sparqlTargetCache.queries[shapeUri] = sparqlQuery;
                        console.log(`Found SPARQL target for shape ${shapeUri}:`, sparqlQuery.substring(0, 80) + '...');
                    }
                }
            });
            
            const targetCount = Object.keys(sparqlTargetCache.queries).length;
            log(LOG_LEVEL.INFO, `Parsed ${targetCount} SPARQL target(s) from SHACL shapes`);
        }
        
        // Execute SPARQL targets against loaded data
        async function executeSparqlTargets() {
            if (!sparqlTargetCache.enabled || !jsonData || Object.keys(sparqlTargetCache.queries).length === 0) {
                log(LOG_LEVEL.DEBUG, 'SPARQL targets: nothing to execute');
                sparqlTargetCache.executed = true;
                return;
            }
            
            log(LOG_LEVEL.INFO, 'Executing SPARQL targets against data...');
            const startTime = performance.now();
            
            try {
                // Initialize Comunica engine if not already done
                if (!comunicaEngine) {
                    log(LOG_LEVEL.DEBUG, 'Initializing Comunica QueryEngine...');
                    comunicaEngine = new Comunica.QueryEngine();
                }
                
                // Convert JSON-LD to N3 Store for querying
                const dataStore = await jsonLdToN3Store(jsonData);
                log(LOG_LEVEL.DEBUG, `Created N3 store with ${dataStore.size} quads`);
                
                // Log data store statistics at DEBUG level
                const typeQuads = dataStore.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', null);
                log(LOG_LEVEL.DEBUG, `Found ${typeQuads.length} type declarations in RDF store`);
                
                const datasetQuadsHttp = dataStore.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://schema.org/Dataset');
                const datasetQuadsHttps = dataStore.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'https://schema.org/Dataset');
                log(LOG_LEVEL.DEBUG, `Found ${datasetQuadsHttp.length + datasetQuadsHttps.length} schema:Dataset instances`);
                
                // Execute all SPARQL queries in parallel
                const queryPromises = Object.entries(sparqlTargetCache.queries).map(async ([shapeUri, query]) => {
                    try {
                        log(LOG_LEVEL.DEBUG, `Executing SPARQL for shape ${shapeUri}`);
                        
                        // Execute the SPARQL query as-is (per SPARQL 1.1 standards)
                        // If namespace mismatches occur, they should be fixed in the SHACL shapes
                        const bindingsStream = await comunicaEngine.queryBindings(query, {
                            sources: [dataStore]
                        });
                        
                        const bindings = await bindingsStream.toArray();
                        
                        // Extract the ?this variable bindings
                        const matchedNodes = new Set();
                        bindings.forEach(binding => {
                            const thisVar = binding.get('this');
                            if (thisVar) {
                                matchedNodes.add(thisVar.value);
                                log(LOG_LEVEL.DEBUG, `  Match: ${thisVar.value}`);
                            }
                        });
                        
                        sparqlTargetCache.results[shapeUri] = matchedNodes;
                        log(LOG_LEVEL.DEBUG, `Shape ${shapeUri}: ${matchedNodes.size} node(s) matched`);
                        if (matchedNodes.size > 0) {
                            log(LOG_LEVEL.INFO, `✓ SPARQL matched nodes: ${Array.from(matchedNodes).join(', ')}`);
                        } else {
                            log(LOG_LEVEL.INFO, `✗ SPARQL found 0 matches`);
                        }
                        
                        return { shapeUri, count: matchedNodes.size };
                        
                    } catch (queryError) {
                        console.error(`Error executing SPARQL for shape ${shapeUri}:`, queryError);
                        sparqlTargetCache.results[shapeUri] = new Set();
                        return { shapeUri, count: 0, error: queryError.message };
                    }
                });
                
                const results = await Promise.all(queryPromises);
                
                const endTime = performance.now();
                const totalMatches = results.reduce((sum, r) => sum + r.count, 0);
                log(LOG_LEVEL.INFO, `SPARQL execution complete: ${totalMatches} total matches in ${(endTime - startTime).toFixed(2)}ms`);
                
                sparqlTargetCache.executed = true;
                
            } catch (error) {
                console.error('Error executing SPARQL targets:', error);
                sparqlTargetCache.executed = true; // Mark as executed even on error to avoid retries
            }
        }
        
        // Convert JSON-LD to N3 Store for SPARQL querying
        async function jsonLdToN3Store(jsonLdData) {
            const store = new N3.Store();
            
            try {
                // Convert JSON-LD to N-Quads format
                const nquads = await jsonld.toRDF(jsonLdData, { format: 'application/n-quads' });
                
                // Parse N-Quads into N3 store
                const parser = new N3.Parser({ format: 'N-Quads' });
                
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
                console.error('Error converting JSON-LD to N3 Store:', error);
                throw error;
            }
        }

        // Normalize JSON-LD to @graph format
        async function normalizeToGraphFormat(data) {
            // Check if already has @graph
            if (data['@graph']) {
                log(LOG_LEVEL.DEBUG, 'Data already has @graph, no normalization needed');
                hadOriginalGraph = true;
                $('#normalization-notice').hide();
                return data;
            }
            
            log(LOG_LEVEL.DEBUG, 'Data does not have @graph, normalizing...');
            hadOriginalGraph = false;
            
            // Special handling for DDI-CDI format with DDICDIModels and @included
            if (data['DDICDIModels'] && Array.isArray(data['DDICDIModels'])) {
                log(LOG_LEVEL.DEBUG, 'Detected DDI-CDI format with DDICDIModels');
                
                // Combine DDICDIModels and @included into @graph
                let graphNodes = [...data['DDICDIModels']];
                
                if (data['@included'] && Array.isArray(data['@included'])) {
                    log(LOG_LEVEL.DEBUG, 'Also merging @included nodes');
                    graphNodes = graphNodes.concat(data['@included']);
                }
                
                log(LOG_LEVEL.DEBUG, `Combined ${graphNodes.length} nodes into @graph`);
                
                // Show notice to user
                $('#normalization-notice').show();
                
                return {
                    '@context': data['@context'] || {},
                    '@graph': graphNodes
                };
            }
            
            try {
                // Use jsonld.flatten() to convert to @graph format
                // This handles nested structures and extracts all nodes into a flat array
                const flattened = await jsonld.flatten(data);
                
                log(LOG_LEVEL.DEBUG, 'Successfully normalized to @graph format using jsonld.flatten()');
                log(LOG_LEVEL.DEBUG, `Graph nodes: ${flattened['@graph'] ? flattened['@graph'].length : 0}`);
                
                // Show notice to user
                $('#normalization-notice').show();
                
                return flattened;
                
            } catch (error) {
                console.error('Failed to normalize JSON-LD:', error);
                
                // Fallback: manually wrap in @graph if it's a single object
                if (data['@id'] || data['@type']) {
                    log(LOG_LEVEL.DEBUG, 'Fallback: wrapping single object in @graph');
                    $('#normalization-notice').show();
                    return {
                        '@context': data['@context'] || {},
                        '@graph': [data]
                    };
                }
                
                // If all else fails, throw error
                throw new Error('Unable to normalize JSON-LD structure. Please ensure the file is valid JSON-LD.');
            }
        }

        // Initialize
        $(document).ready(async function() {
            try {
                // Get file URL from query parameters
                const urlParams = new URLSearchParams(window.location.search);
                let fileUrl;
                let datasetMetadataUrl = null;
                
                // Check if we have a callback parameter (external tool invocation)
                const callbackParam = urlParams.get('callback');
                if (callbackParam) {
                    // Decode the callback URL
                    const callbackUrl = atob(callbackParam);
                    
                    // Fetch the tool parameters from the callback URL
                    const paramsResponse = await fetch(callbackUrl);
                    if (!paramsResponse.ok) {
                        throw new Error(`Failed to fetch tool parameters: ${paramsResponse.status}`);
                    }
                    const paramsData = await paramsResponse.json();
                    
                    // Extract parameters from the response
                    const queryParams = paramsData.data.queryParameters || {};
                    fileId = queryParams.fileid;
                    siteUrl = queryParams.siteUrl;
                    
                    // Get the dataset metadata signed URL if available
                    const signedUrls = paramsData.data.signedUrls || [];
                    const metadataUrlObj = signedUrls.find(u => u.name === 'getDatasetVersionMetadata');
                    if (metadataUrlObj) {
                        datasetMetadataUrl = metadataUrlObj.signedUrl;
                    }
                } else {
                    // Direct parameters (for testing)
                    fileId = urlParams.get('fileid');
                    siteUrl = urlParams.get('siteUrl');
                }
                
                // Check required parameters
                if (!fileId || !siteUrl) {
                    // Show load local file button instead of error
                    $('#load-local-btn').show();
                    $('#content').html(`
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
                            const fileInfo = files.find(f => f.dataFile && f.dataFile.id == fileId);
                            if (fileInfo && fileInfo.dataFile && fileInfo.dataFile.filename) {
                                originalFileName = fileInfo.dataFile.filename;
                            }
                        }
                    } else {
                        // Fallback: try direct file API
                        const metadataResponse = await fetch(`${siteUrl}/api/files/${fileId}`);
                        if (metadataResponse.ok) {
                            const metadata = await metadataResponse.json();
                            if (metadata.data && metadata.data.dataFile && metadata.data.dataFile.filename) {
                                originalFileName = metadata.data.dataFile.filename;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Could not fetch filename, using default:', e);
                }
                
                // Load from Dataverse API
                fileUrl = siteUrl + '/api/access/datafile/' + fileId;
                
                // Load JSON-LD data
                const response = await fetch(fileUrl);
                
                // Check if response is OK
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                // Check content type
                const contentType = response.headers.get('content-type');
                if (contentType && !contentType.includes('json')) {
                    throw new Error(`Invalid content type: ${contentType}. This previewer requires JSON-LD files (application/ld+json or application/json).`);
                }
                
                // Try to parse as JSON
                let jsonText;
                try {
                    jsonText = await response.text();
                    jsonData = JSON.parse(jsonText);
                } catch (parseError) {
                    throw new Error(`Failed to parse JSON: ${parseError.message}. This file may not be valid JSON-LD.`);
                }
                
                // Normalize to @graph format if needed
                try {
                    jsonData = await normalizeToGraphFormat(jsonData);
                } catch (normalizeError) {
                    throw new Error(`Failed to normalize JSON-LD structure: ${normalizeError.message}`);
                }
                
                // Verify we now have @graph (should always be true after normalization)
                if (!jsonData['@graph']) {
                    throw new Error('Internal error: Normalization did not produce @graph structure.');
                }
                
                originalData = JSON.parse(JSON.stringify(jsonData)); // Deep clone
                
                // Expand JSON-LD to get full property URIs
                try {
                    expandedJsonLd = await jsonld.expand(jsonData);
                    console.log('Expanded JSON-LD for property URI mapping');
                } catch (expandError) {
                    console.warn('Could not expand JSON-LD:', expandError);
                    expandedJsonLd = null;
                }
                
                // Load SHACL shapes - use the selected shape from dropdown
                try {
                    const selectedShape = $('#shape-selector').val() || 'ddi-cdi-official';
                    await loadShaclShapes(selectedShape);
                } catch (shapeError) {
                    console.error('Failed to load SHACL shapes:', shapeError);
                    throw new Error(`Failed to load validation shapes: ${shapeError.message}`);
                }
                
                // Execute SPARQL targets to match nodes to shapes
                await executeSparqlTargets();
                
                // Render the data
                renderData();
                
                // Setup event handlers
                setupEventHandlers();
                
            } catch (error) {
                console.error('Error loading data:', error);
                $('#load-local-btn').show();
                $('#content').html(`
                    <div class="alert alert-danger">
                        <strong>Error:</strong> Failed to load CDI data. ${error.message}
                    </div>
                `);
                setupEventHandlers();
            }
        });

        // Track which nodes have been rendered to avoid duplicates
        let renderedNodes = new Set();
        
        function renderData() {
            console.log('🎨 RENDER START - SPARQL executed:', sparqlTargetCache.executed, 'Cache size:', Object.keys(sparqlTargetCache.results).length);
            
            const content = $('#content');
            content.empty();
            renderedNodes.clear(); // Reset for each render
            
            if (!jsonData || !jsonData['@graph']) {
                content.html('<div class="alert alert-warning">No data to display</div>');
                return;
            }
            
            // Build tree structure: find which nodes are referenced by others
            const allNodeIds = new Set(jsonData['@graph'].map(n => n['@id']));
            const referencedIds = new Set();
            
            jsonData['@graph'].forEach(node => {
                Object.keys(node).forEach(key => {
                    if (key !== '@id' && key !== '@type' && key !== '@context') {
                        const value = node[key];
                        const refs = extractNodeReferences(value);
                        refs.forEach(ref => referencedIds.add(ref));
                    }
                });
            });
            
            // Root nodes are those not referenced by any other node
            const rootNodes = jsonData['@graph'].filter(n => !referencedIds.has(n['@id']));
            
            // Render root nodes (they will recursively render their children)
            rootNodes.forEach((node, index) => {
                const nodeCard = renderNodeTree(node, index, 0);
                content.append(nodeCard);
            });
        }
        
        // Extract all @id references from a value (handles arrays, nested objects, and string references)
        function extractNodeReferences(value) {
            const refs = [];
            if (Array.isArray(value)) {
                value.forEach(item => {
                    if (typeof item === 'object' && item['@id']) {
                        refs.push(item['@id']);
                    } else if (typeof item === 'string' && isNodeReference(item)) {
                        refs.push(item);
                    }
                });
            } else if (typeof value === 'object' && value !== null && value['@id']) {
                refs.push(value['@id']);
            } else if (typeof value === 'string' && isNodeReference(value)) {
                refs.push(value);
            }
            return refs;
        }
        
        // Check if a string value looks like a node reference
        function isNodeReference(str) {
            if (typeof str !== 'string') return false;
            // Check if it starts with # or _: (common node ID patterns)
            if (str.startsWith('#') || str.startsWith('_:')) {
                // Verify this ID actually exists in the graph
                return jsonData['@graph'].some(n => n['@id'] === str);
            }
            return false;
        }
        
        function renderNodeTree(node, index, depth) {
            const id = node['@id'] || `_:blank${index}`;
            const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
            
            // Mark this node as rendered
            renderedNodes.add(id);
            
            // Only indent depth > 0 with a constant 8px (not cumulative since nodes are nested)
            const card = $('<div>').addClass('node-card tree-node').attr('data-node-id', id);
            if (depth > 0) {
                card.css('margin-left', '8px');
            }
            
            // Header with collapse functionality
            const header = $('<div>').addClass('node-header');
            const leftSide = $('<div>').css('display', 'flex').css('align-items', 'center');
            leftSide.append($('<span>').addClass('glyphicon glyphicon-chevron-down collapse-icon').css('margin-right', '10px'));
            leftSide.append($('<span>').addClass('node-id').text(id));
            types.forEach(type => {
                if (type) {
                    leftSide.append($('<span>').addClass('node-type').text(type));
                }
            });
            header.append(leftSide);
            
            // Add click handler to collapse/expand
            header.click(function() {
                card.toggleClass('collapsed');
            });
            
            card.append(header);
            
            // Body with properties
            const body = $('<div>').addClass('node-body');
            if (!isEditMode) {
                body.addClass('view-mode');
            }
            
            // Render all properties except @id and @type
            Object.keys(node).forEach(key => {
                if (key !== '@id' && key !== '@type' && key !== '@context') {
                    const propertyRow = renderPropertyTree(key, node[key], id, types, depth);
                    body.append(propertyRow);
                }
            });
            
            card.append(body);
            
            // Add property suggestions in edit mode
            if (isEditMode && shaclShapesStore) {
                const suggestions = getPropertySuggestions(node, types);

                if (suggestions.length > 0) {
                    const suggestionsSection = createPropertySuggestionsSection(suggestions, id, body);
                    card.append(suggestionsSection);
                } else {
                    // Even with no SHACL suggestions, allow adding custom properties
                    const emptySection = $('<div>').addClass('add-property-section');
                    emptySection.append($('<h4>').text('Add Properties').css({'margin-top': '0', 'margin-bottom': '10px'}));
                    const addCustomBtn = $('<button>')
                        .addClass('btn btn-default')
                        .html('<span class="glyphicon glyphicon-edit"></span> Add Custom Property')
                        .click(function() {
                            const propName = prompt('Enter custom property name:');
                            if (propName) {
                                addPropertyToNode(id, propName, '', body);
                            }
                        });
                    emptySection.append(addCustomBtn);
                    card.append(emptySection);
                }
            }
            
            return card;
        }

        function renderNode(node, index) {
            const id = node['@id'] || `_:blank${index}`;
            const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
            
            const card = $('<div>').addClass('node-card').attr('data-node-id', id);
            
            // Header with collapse functionality
            const header = $('<div>').addClass('node-header');
            const leftSide = $('<div>').css('display', 'flex').css('align-items', 'center');
            leftSide.append($('<span>').addClass('glyphicon glyphicon-chevron-down collapse-icon').css('margin-right', '10px'));
            leftSide.append($('<span>').addClass('node-id').text(id));
            types.forEach(type => {
                if (type) {
                    leftSide.append($('<span>').addClass('node-type').text(type));
                }
            });
            header.append(leftSide);
            
            // Add click handler to collapse/expand
            header.click(function() {
                card.toggleClass('collapsed');
            });
            
            card.append(header);
            
            // Body with properties
            const body = $('<div>').addClass('node-body');
            if (!isEditMode) {
                body.addClass('view-mode');
            }
            
            // Render all properties except @id and @type
            Object.keys(node).forEach(key => {
                if (key !== '@id' && key !== '@type' && key !== '@context') {
                    const propertyRow = renderProperty(key, node[key], id, types);
                    body.append(propertyRow);
                }
            });
            
            card.append(body);
            
            // Add property suggestions in edit mode
            if (isEditMode && shaclShapesStore) {
                const suggestions = getPropertySuggestions(node, types);

                if (suggestions.length > 0) {
                    const suggestionsSection = createPropertySuggestionsSection(suggestions, id, body);
                    card.append(suggestionsSection);
                } else {
                    // Even with no SHACL suggestions, allow adding custom properties
                    const emptySection = $('<div>').addClass('add-property-section');
                    emptySection.append($('<h4>').text('Add Properties').css({'margin-top': '0', 'margin-bottom': '10px'}));
                    const addCustomBtn = $('<button>')
                        .addClass('btn btn-default')
                        .html('<span class="glyphicon glyphicon-edit"></span> Add Custom Property')
                        .click(function() {
                            const propName = prompt('Enter custom property name:');
                            if (propName) {
                                addPropertyToNode(id, propName, '', body);
                            }
                        });
                    emptySection.append(addCustomBtn);
                    card.append(emptySection);
                }
            }
            
            return card;
        }
        
        function renderPropertyTree(key, value, nodeId, nodeTypes, depth) {
            const container = $('<div>');
            
            // First render the property itself
            const row = renderProperty(key, value, nodeId, nodeTypes);
            container.append(row);
            
            // Then check if this property references other nodes
            const refs = extractNodeReferences(value);
            if (refs.length > 0) {
                refs.forEach(refId => {
                    const refNode = jsonData['@graph'].find(n => n['@id'] === refId);
                    if (refNode) {
                        // Only render inline if this node hasn't been rendered yet
                        if (!renderedNodes.has(refId)) {
                            const childCard = renderNodeTree(refNode, 0, depth + 1);
                            container.append(childCard);
                        } else {
                            // Node already rendered elsewhere - show a reference link
                            const refLink = $('<div>')
                                .addClass('node-reference-link')
                                .css({
                                    'margin-left': '8px',
                                    'padding': '3px',
                                    'margin-bottom': '2px'
                                });
                            
                            const jumpBtn = $('<button>')
                                .addClass('btn btn-sm btn-default')
                                .html(`<span class="glyphicon glyphicon-arrow-right"></span> → ${refId}`)
                                .attr('title', 'Click to jump to this node')
                                .click(function(e) {
                                    e.preventDefault();
                                    const targetCard = $(`.node-card[data-node-id="${refId}"]`);
                                    if (targetCard.length) {
                                        targetCard.removeClass('collapsed');
                                        targetCard[0].scrollIntoView({behavior: 'smooth', block: 'center'});
                                        targetCard.addClass('highlight');
                                        setTimeout(() => targetCard.removeClass('highlight'), 2000);
                                    }
                                });
                            
                            refLink.append(jumpBtn);
                            container.append(refLink);
                        }
                    }
                });
            }
            
            return container;
        }

        function renderProperty(key, value, nodeId, nodeTypes) {
            const row = $('<div>').addClass('property-row').attr('data-property', key).attr('data-node-id', nodeId);
            
            // Classify property using SHACL (pass nodeId for URI expansion)
            const classification = classifyProperty(nodeTypes || [], key, nodeId);
            
            // Apply CSS classes based on classification
            if (classification.isInShape) {
                row.addClass('shacl-defined');
            } else {
                row.addClass('extra-field');
            }
            
            if (classification.isRequired) {
                row.addClass('required');
            }
            
            // Add property badge
            const badge = $('<span>').addClass('property-badge');
            if (classification.isRequired) {
                badge.addClass('required').text('REQUIRED');
            } else if (classification.isInShape) {
                badge.addClass('optional').text('OPTIONAL');
            } else {
                badge.addClass('extra').text('EXTRA');
            }
            row.append(badge);
            
            // Add tooltip icon if there's a description
            if (classification.description) {
                const tooltip = $('<span>')
                    .addClass('tooltip-icon glyphicon glyphicon-question-sign')
                    .attr('title', classification.description)
                    .css({'margin-left': '5px', 'cursor': 'help'});
                badge.after(tooltip);
            }
            
            // Label
            const label = $('<div>').addClass('property-label').text(humanizeKey(key));
            const path = $('<div>').addClass('property-path').text(key);
            row.append(label, path);
            
            // Value
            const valueContainer = $('<div>').addClass('property-value');
            
            if (Array.isArray(value)) {
                // Array of values
                value.forEach((val, idx) => {
                    const valDiv = $('<div>').addClass('array-value');
                    valDiv.append(createValueInput(key, val, nodeId, idx, classification));
                    
                    // Add delete button in edit mode
                    if (isEditMode) {
                        const deleteBtn = $('<button>')
                            .addClass('btn btn-xs delete-btn')
                            .html('<span class="glyphicon glyphicon-trash"></span>')
                            .click(function() {
                                if (confirm('Delete this value?')) {
                                    valDiv.remove();
                                    row.addClass('changed');
                                    updateSaveButton();
                                }
                            });
                        valDiv.append(deleteBtn);
                    }
                    
                    valueContainer.append(valDiv);
                });
                if (isEditMode) {
                    const addBtn = $('<button>')
                        .addClass('btn btn-sm btn-default add-value-btn')
                        .html('<span class="glyphicon glyphicon-plus"></span> Add Value')
                        .click(function() {
                            const newValDiv = $('<div>').addClass('array-value');
                            newValDiv.append(createValueInput(key, '', nodeId, value.length, classification));
                            
                            // Add delete button for the new value
                            const deleteBtn = $('<button>')
                                .addClass('btn btn-xs delete-btn')
                                .html('<span class="glyphicon glyphicon-trash"></span>')
                                .css({'margin-left': '10px'})
                                .click(function() {
                                    newValDiv.addClass('deleted').fadeOut(300, function() {
                                        $(this).remove();
                                    });
                                    updateSaveButton();
                                });
                            newValDiv.append(deleteBtn);
                            
                            $(this).before(newValDiv);
                            updateSaveButton();
                        });
                    valueContainer.append(addBtn);
                }
            } else {
                // Single value
                valueContainer.append(createValueInput(key, value, nodeId, null, classification));
                
                // Add delete button in edit mode (for non-required fields only)
                if (isEditMode && !classification.isRequired) {
                    const deleteBtn = $('<button>')
                        .addClass('btn btn-xs delete-btn')
                        .html('<span class="glyphicon glyphicon-trash"></span>')
                        .css({'margin-left': '10px'})
                        .click(function() {
                            if (confirm('Delete this property?')) {
                                row.addClass('deleted').fadeOut(300, function() {
                                    $(this).remove();
                                });
                                updateSaveButton();
                            }
                        });
                    valueContainer.append(deleteBtn);
                }
            }
            
            // Add description as info text if available
            if (classification.description && isEditMode) {
                const infoText = $('<div>')
                    .addClass('property-info')
                    .text(classification.description);
                valueContainer.append(infoText);
            }
            
            row.append(valueContainer);
            return row;
        }

        function createValueInput(key, value, nodeId, arrayIndex, classification) {
            // Check if value is a reference to another node (has @id)
            if (typeof value === 'object' && value !== null && value['@id']) {
                const refId = value['@id'];
                const refContainer = $('<div>').addClass('reference-container');
                
                // Create a clickable button to jump to the referenced node
                const jumpBtn = $('<button>')
                    .addClass('btn btn-sm btn-info reference-btn')
                    .html(`<span class="glyphicon glyphicon-arrow-right"></span> ${refId}`)
                    .attr('title', 'Click to jump to this node')
                    .click(function(e) {
                        e.preventDefault();
                        const targetCard = $(`.node-card[data-node-id="${refId}"]`);
                        if (targetCard.length) {
                            targetCard.removeClass('collapsed');
                            targetCard[0].scrollIntoView({behavior: 'smooth', block: 'center'});
                            targetCard.addClass('highlight');
                            setTimeout(() => targetCard.removeClass('highlight'), 2000);
                        } else {
                            alert('Referenced node not found: ' + refId);
                        }
                    });
                
                refContainer.append(jumpBtn);
                return refContainer;
            }
            
            // Check if string value is a node reference (like "#Sample_Key")
            if (typeof value === 'string' && isNodeReference(value)) {
                const refContainer = $('<div>').addClass('reference-container');
                
                const jumpBtn = $('<button>')
                    .addClass('btn btn-sm btn-info reference-btn')
                    .html(`<span class="glyphicon glyphicon-arrow-right"></span> ${value}`)
                    .attr('title', 'Click to jump to this node')
                    .click(function(e) {
                        e.preventDefault();
                        const targetCard = $(`.node-card[data-node-id="${value}"]`);
                        if (targetCard.length) {
                            targetCard.removeClass('collapsed');
                            targetCard[0].scrollIntoView({behavior: 'smooth', block: 'center'});
                            targetCard.addClass('highlight');
                            setTimeout(() => targetCard.removeClass('highlight'), 2000);
                        } else {
                            alert('Referenced node not found: ' + value);
                        }
                    });
                
                refContainer.append(jumpBtn);
                return refContainer;
            }
            
            // Simple value (string, number, etc.) or complex object without @id
            const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            
            if (isEditMode) {
                // Check if this property has enumeration values (controlled vocabulary)
                if (classification && classification.allowedValues && classification.allowedValues.length > 0) {
                    // Create a dropdown select element
                    const select = $('<select>')
                        .addClass('form-control')
                        .attr('data-original', valueStr);
                    
                    // Add empty option if field is not required
                    if (!classification.isRequired) {
                        select.append($('<option>').val('').text('-- Select --'));
                    }
                    
                    // Add enumeration options
                    classification.allowedValues.forEach(enumValue => {
                        const option = $('<option>')
                            .val(enumValue.uri)
                            .text(enumValue.label);
                        
                        // Check if this is the current value (match by URI or local part)
                        const valueUri = valueStr.startsWith('http') ? valueStr : null;
                        const valueLocalPart = valueStr.split('/').pop().split('#').pop();
                        const enumLocalPart = enumValue.uri.split('/').pop().split('#').pop();
                        
                        if (valueUri === enumValue.uri || valueLocalPart === enumLocalPart || valueStr === enumValue.label) {
                            option.attr('selected', 'selected');
                        }
                        
                        select.append(option);
                    });
                    
                    // Mark as changed when selection changes
                    select.on('change', function() {
                        $(this).closest('.property-row').addClass('changed');
                        updateSaveButton();
                    });
                    
                    return select;
                }
                
                // Not an enumeration - render regular input based on type
                const inputType = classification ? classification.inputType : 'text';
                
                let input;
                if (valueStr.length > 50) {
                    input = $('<textarea>').val(valueStr);
                } else {
                    input = $('<input>').attr('type', inputType).val(valueStr);
                }
                
                input.attr('data-original', valueStr);
                input.on('input', function() {
                    // Mark as changed
                    $(this).closest('.property-row').addClass('changed');
                    updateSaveButton();
                });
                
                return input;
            } else {
                // View mode - show as read-only text
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // For complex objects, create a nested expandable section
                    const nestedContainer = $('<div>').addClass('nested-object').css({
                        'margin-left': '20px',
                        'border-left': '2px solid #ddd',
                        'padding-left': '10px',
                        'margin-top': '5px'
                    });
                    
                    Object.keys(value).forEach(nestedKey => {
                        if (nestedKey === '@id' || nestedKey === '@type') return; // Skip JSON-LD metadata for cleaner display
                        
                        const nestedRow = $('<div>').addClass('property-row nested-property').css({
                            'margin-bottom': '8px',
                            'display': 'flex',
                            'align-items': 'center'
                        });
                        
                        const nestedLabel = $('<div>').addClass('property-key').css({
                            'font-weight': '500',
                            'min-width': '150px',
                            'color': '#555'
                        }).text(humanizeKey(nestedKey.replace('schema:', '')));
                        
                        const nestedValueDiv = $('<div>').addClass('property-value').css({
                            'flex': '1'
                        });
                        
                        const nestedValue = value[nestedKey];
                        if (typeof nestedValue === 'object' && nestedValue !== null) {
                            nestedValueDiv.text(JSON.stringify(nestedValue));
                        } else {
                            nestedValueDiv.text(String(nestedValue));
                        }
                        
                        nestedRow.append(nestedLabel, nestedValueDiv);
                        nestedContainer.append(nestedRow);
                    });
                    
                    return nestedContainer;
                } else {
                    // For simple values, show as regular text
                    return $('<div>').addClass('value-display').text(valueStr);
                }
            }
        }

        function humanizeKey(key) {
            // Convert camelCase or snake_case to human readable
            return key
                .replace(/([A-Z])/g, ' $1')
                .replace(/_/g, ' ')
                .replace(/^./, str => str.toUpperCase())
                .trim();
        }
        
        // Expand a compact node ID (e.g., "xas:fe_c3d.001") to full URI (e.g., "http://www.cdi4exas.org/fe_c3d.001")
        function getExpandedNodeId(compactNodeId) {
            if (!compactNodeId) return null;
            
            // If it's already a full URI, return as-is
            if (compactNodeId.startsWith('http://') || compactNodeId.startsWith('https://')) {
                return compactNodeId;
            }
            
            // Try to find the node in the @graph
            if (jsonData && jsonData['@graph']) {
                const node = jsonData['@graph'].find(n => n['@id'] === compactNodeId);
                if (node && node['@id']) {
                    // Check if we have expanded JSON-LD
                    if (expandedJsonLd && Array.isArray(expandedJsonLd)) {
                        const expanded = expandedJsonLd.find(n => {
                            // The expanded @id should be the full URI
                            return n['@id'] && (
                                n['@id'] === compactNodeId || 
                                n['@id'].endsWith('/' + compactNodeId.split(':').pop()) ||
                                n['@id'].endsWith('#' + compactNodeId.split(':').pop())
                            );
                        });
                        if (expanded && expanded['@id']) {
                            return expanded['@id'];
                        }
                    }
                }
            }
            
            // Fallback: try to resolve using context
            if (jsonData && jsonData['@context']) {
                const context = jsonData['@context'];
                const [prefix, localPart] = compactNodeId.split(':');
                
                if (prefix && localPart && context[prefix]) {
                    const namespace = context[prefix];
                    return namespace + localPart;
                }
            }
            
            return compactNodeId; // Return as-is if we can't expand
        }
        
        // Get the expanded URI for a property from the expanded JSON-LD
        function getExpandedPropertyUri(nodeId, propertyKey) {
            if (!expandedJsonLd || !Array.isArray(expandedJsonLd)) {
                return null;
            }
            
            // Find the node in expanded JSON-LD
            const expandedNode = expandedJsonLd.find(n => n['@id'] === nodeId);
            if (!expandedNode) {
                return null;
            }
            
            // Look through all properties to find one that might match
            for (const key in expandedNode) {
                if (key === '@id' || key === '@type') continue;
                
                // The expanded key is the full URI, extract the local part
                const localPart = key.split('/').pop().split('#').pop();
                
                // Check if this matches our property key
                if (localPart === propertyKey || key === propertyKey) {
                    return key; // Return the full URI
                }
            }
            
            return null;
        }
        
        // Parse RDF list from sh:in to extract enumeration values
        function parseRdfList(listNodeOrUri) {
            if (!shaclShapesStore) return [];
            
            const values = [];
            let currentNode = listNodeOrUri;
            const nilUri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil';
            const firstUri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
            const restUri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest';
            
            // Handle both node objects and URI strings
            if (typeof currentNode === 'string') {
                currentNode = { value: currentNode };
            }
            
            let iterations = 0;
            const maxIterations = 100; // Safety limit
            
            while (currentNode && currentNode.value !== nilUri && iterations < maxIterations) {
                iterations++;
                
                // Get rdf:first (the value at this position)
                const firstQuads = shaclShapesStore.getQuads(
                    currentNode,
                    firstUri,
                    null,
                    null
                );
                
                if (firstQuads.length > 0) {
                    const valueUri = firstQuads[0].object.value;
                    const label = extractLabelFromUri(valueUri);
                    values.push({ 
                        uri: valueUri, 
                        label: label 
                    });
                }
                
                // Get rdf:rest (pointer to next node in list)
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
        
        // Extract a readable label from a URI
        function extractLabelFromUri(uri) {
            // Extract the local part after last / or #
            const parts = uri.split('/').pop().split('#').pop();
            // Convert camelCase to Title Case with spaces
            return parts
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())
                .trim();
        }
        
        // Get enumeration values from a NodeShape that has sh:in
        function getEnumerationValues(nodeShapeUri) {
            if (!shaclShapesStore) return null;
            
            // Query for sh:in on this NodeShape
            const inQuads = shaclShapesStore.getQuads(
                nodeShapeUri,
                'http://www.w3.org/ns/shacl#in',
                null,
                null
            );
            
            if (inQuads.length === 0) return null;
            
            // Parse the RDF list
            return parseRdfList(inQuads[0].object);
        }
        
        // Classify a property based on SHACL shapes
        function classifyProperty(nodeTypes, propertyKey, nodeId = null) {
            log(LOG_LEVEL.DEBUG, `Classifying property "${propertyKey}" for node "${nodeId}"`);
            
            const result = {
                isInShape: false,
                isRequired: false,
                datatype: null,
                description: '',
                allowedValues: null,
                pattern: null,
                inputType: 'text',
                minCount: 0,
                maxCount: null,
                nodeShape: null,
                nodeClass: null
            };
            
            if (!shaclShapesStore || nodeTypes.length === 0) return result;
            
            // Try to get the expanded URI for this property
            const expandedUri = nodeId ? getExpandedPropertyUri(nodeId, propertyKey) : null;
            
            // Also try to expand the property key if it's in compact form (e.g., "schema:name")
            let expandedPropertyKey = propertyKey;
            if (propertyKey.includes(':') && jsonData && jsonData['@context']) {
                const [prefix, localPart] = propertyKey.split(':');
                const context = jsonData['@context'];
                if (context[prefix]) {
                    expandedPropertyKey = context[prefix] + localPart;
                }
            }
            
            try {
                // Collect all shape URIs that might apply to this node
                const applicableShapes = new Set();
                
                // 1. Check SPARQL target cache first (if enabled and executed)
                if (sparqlTargetCache.enabled && sparqlTargetCache.executed && nodeId) {
                    // Expand the node ID to full URI for comparison
                    const expandedNodeId = getExpandedNodeId(nodeId);
                    
                    for (const [shapeUri, matchedNodes] of Object.entries(sparqlTargetCache.results)) {
                        // Check both compact and expanded forms
                        if (matchedNodes.has(nodeId) || matchedNodes.has(expandedNodeId)) {
                            applicableShapes.add(shapeUri);
                            log(LOG_LEVEL.DEBUG, `✓ Node ${nodeId} matched via SPARQL target in shape ${shapeUri}`);
                        }
                    }
                    if (applicableShapes.size === 0) {
                        log(LOG_LEVEL.DEBUG, `✗ Node ${nodeId} did NOT match any SPARQL targets`);
                    }
                }
                
                // 2. Also check sh:targetClass (traditional method)
                nodeTypes.forEach(type => {
                    const typeUri = type.startsWith('http') ? type : 'http://ddialliance.org/Specification/DDI-CDI/1.0/RDF/' + type;
                    
                    const targetClassQuads = shaclShapesStore.getQuads(
                        null,
                        'http://www.w3.org/ns/shacl#targetClass',
                        typeUri,
                        null
                    );
                    
                    targetClassQuads.forEach(quad => {
                        applicableShapes.add(quad.subject.value);
                    });
                });
                
                // Now process all applicable shapes
                log(LOG_LEVEL.DEBUG, `Processing ${applicableShapes.size} applicable shape(s) for node ${nodeId}, property ${propertyKey}`);
                
                applicableShapes.forEach(shapeSubject => {
                    // Get all sh:property predicates
                    const propertyQuads = shaclShapesStore.getQuads(
                        shapeSubject,
                        'http://www.w3.org/ns/shacl#property',
                        null,
                        null
                    );
                    
                    if (nodeId === 'xas:485749' && propertyKey === 'name') {
                        console.log(`  Shape ${shapeSubject} has ${propertyQuads.length} property definition(s)`);
                    }
                    
                    propertyQuads.forEach(propQuad => {
                        const propertyShapeRef = propQuad.object;
                        
                        // Property shape might be a direct node or a reference to another shape
                        // Try to get sh:path directly from this node
                        let pathQuads = shaclShapesStore.getQuads(
                            propertyShapeRef,
                            'http://www.w3.org/ns/shacl#path',
                            null,
                            null
                        );
                        
                        // If no path found and it's a URI reference (not blank node), 
                        // it might be referencing a named property shape definition
                        if (pathQuads.length === 0 && propertyShapeRef.termType === 'NamedNode') {
                            console.log(`  Resolving property shape reference: ${propertyShapeRef.value}`);
                            // This is a reference like cdifd:nameProperty
                            // The referenced shape should have the actual sh:path
                            pathQuads = shaclShapesStore.getQuads(
                                propertyShapeRef.value,
                                'http://www.w3.org/ns/shacl#path',
                                null,
                                null
                            );
                            if (pathQuads.length > 0) {
                                console.log(`    → Found path: ${pathQuads[0].object.value}`);
                            } else {
                                console.log(`    → No path found for reference`);
                            }
                        }
                            
                            pathQuads.forEach(pathQuad => {
                                let pathsToCheck = [];
                                const pathObject = pathQuad.object;
                                
                                // Check if this is a blank node (complex path like sh:alternativePath)
                                if (pathObject.termType === 'BlankNode') {
                                    // Check for sh:alternativePath
                                    const altPathQuads = shaclShapesStore.getQuads(
                                        pathObject,
                                        'http://www.w3.org/ns/shacl#alternativePath',
                                        null,
                                        null
                                    );
                                    
                                    if (altPathQuads.length > 0) {
                                        // sh:alternativePath points to an RDF list
                                        const listNode = altPathQuads[0].object;
                                        const alternatives = parseRdfList(listNode);
                                        // Extract just the URIs from the parsed list
                                        pathsToCheck = alternatives.map(item => item.uri || item);
                                        log(LOG_LEVEL.DEBUG, `Found alternativePath with ${alternatives.length} options: ${pathsToCheck.join(', ')}`);
                                    }
                                } else {
                                    // Simple path (direct URI)
                                    pathsToCheck = [pathObject.value];
                                }
                                
                                // Check each path option
                                pathsToCheck.forEach(path => {
                                const pathName = path.split('/').pop().split('#').pop();
                                
                                // SHACL paths are like: cdi:WideDataSet-name or cdi:DataSet_isStructuredBy_DataStructure
                                // Extract the property part after the class name and hyphen/underscore
                                let shaclPropertyName = pathName;
                                
                                // Remove class prefix if present (e.g., "WideDataSet-name" -> "name")
                                if (pathName.includes('-')) {
                                    const parts = pathName.split('-');
                                    if (parts.length > 1) {
                                        shaclPropertyName = parts.slice(1).join('-');
                                    }
                                }
                                
                                // Also check for underscore patterns (e.g., "DataSet_isStructuredBy_DataStructure")
                                if (pathName.includes('_')) {
                                    const parts = pathName.split('_');
                                    // The middle part is usually the property name
                                    if (parts.length >= 2) {
                                        shaclPropertyName = parts[1];
                                    }
                                }
                                
                                // Check if this matches our property using multiple strategies
                                const matches = pathName === propertyKey ||  // Exact match with full path name
                                              path === propertyKey ||  // Exact match with full URI
                                              path === expandedPropertyKey ||  // Match with expanded property key (e.g., schema:name → https://schema.org/name)
                                              shaclPropertyName === propertyKey ||  // Match extracted property name
                                              (expandedUri && path === expandedUri) ||  // Match with expanded URI if available
                                              pathName.endsWith(propertyKey) ||  // Ends with property key
                                              pathName.toLowerCase().includes(propertyKey.toLowerCase());  // Contains property key (case insensitive)
                                
                                if (matches) {
                                    result.isInShape = true;
                                    
                                    // Check sh:minCount for required
                                    const minCountQuads = shaclShapesStore.getQuads(
                                        propertyShapeRef,
                                        'http://www.w3.org/ns/shacl#minCount',
                                        null,
                                        null
                                    );
                                    if (minCountQuads.length > 0) {
                                        result.minCount = parseInt(minCountQuads[0].object.value);
                                        result.isRequired = result.minCount > 0;
                                    }
                                    
                                    // Check sh:maxCount for cardinality
                                    const maxCountQuads = shaclShapesStore.getQuads(
                                        propertyShapeRef,
                                        'http://www.w3.org/ns/shacl#maxCount',
                                        null,
                                        null
                                    );
                                    if (maxCountQuads.length > 0) {
                                        result.maxCount = parseInt(maxCountQuads[0].object.value);
                                    }
                                    
                                    // Check sh:node for complex objects
                                    const nodeQuads = shaclShapesStore.getQuads(
                                        propertyShapeRef,
                                        'http://www.w3.org/ns/shacl#node',
                                        null,
                                        null
                                    );
                                    if (nodeQuads.length > 0) {
                                        result.nodeShape = nodeQuads[0].object.value;
                                    }
                                    
                                    // Check sh:class for object type
                                    const classQuads = shaclShapesStore.getQuads(
                                        propertyShapeRef,
                                        'http://www.w3.org/ns/shacl#class',
                                        null,
                                        null
                                    );
                                    if (classQuads.length > 0) {
                                        result.nodeClass = classQuads[0].object.value;
                                    }
                                    
                                    // Get sh:datatype
                                    const datatypeQuads = shaclShapesStore.getQuads(
                                        propertyShapeRef,
                                        'http://www.w3.org/ns/shacl#datatype',
                                        null,
                                        null
                                    );
                                    if (datatypeQuads.length > 0) {
                                        result.datatype = datatypeQuads[0].object.value;
                                        
                                        // Determine input type based on datatype
                                        const dt = result.datatype.toLowerCase();
                                        if (dt.includes('integer') || dt.includes('int') || dt.includes('decimal') || dt.includes('double') || dt.includes('float')) {
                                            result.inputType = 'number';
                                        } else if (dt.includes('date') && !dt.includes('datetime')) {
                                            result.inputType = 'date';
                                        } else if (dt.includes('datetime')) {
                                            result.inputType = 'datetime-local';
                                        } else if (dt.includes('anyuri')) {
                                            result.inputType = 'url';
                                        }
                                    }
                                    
                                    // Get sh:description
                                    const descQuads = shaclShapesStore.getQuads(
                                        propertyShapeRef,
                                        'http://www.w3.org/ns/shacl#description',
                                        null,
                                        null
                                    );
                                    if (descQuads.length > 0) {
                                        result.description = descQuads[0].object.value;
                                    }
                                    
                                    // Get sh:in (allowed values) - direct enumeration on property
                                    const inQuads = shaclShapesStore.getQuads(
                                        propertyShapeRef,
                                        'http://www.w3.org/ns/shacl#in',
                                        null,
                                        null
                                    );
                                    if (inQuads.length > 0) {
                                        // Parse RDF list to get enumeration values
                                        result.allowedValues = parseRdfList(inQuads[0].object);
                                    }
                                    
                                    // Check if sh:node references an enumeration shape
                                    if (result.nodeShape && !result.allowedValues) {
                                        const nodeShapeUri = result.nodeShape.startsWith('http') || result.nodeShape.startsWith('#') 
                                            ? result.nodeShape 
                                            : '#' + result.nodeShape;
                                        const enumValues = getEnumerationValues(nodeShapeUri);
                                        if (enumValues && enumValues.length > 0) {
                                            result.allowedValues = enumValues;
                                        }
                                    }
                                    
                                    // Get sh:pattern
                                    const patternQuads = shaclShapesStore.getQuads(
                                        propertyShapeRef,
                                        'http://www.w3.org/ns/shacl#pattern',
                                        null,
                                        null
                                    );
                                    if (patternQuads.length > 0) {
                                        result.pattern = patternQuads[0].object.value;
                                    }
                                }
                            }); // end pathsToCheck.forEach
                            }); // end pathQuads.forEach
                    }); // end propertyQuads.forEach
                }); // end applicableShapes.forEach
            } catch (err) {
                console.error('Error classifying property:', err);
            }
            
            return result;
        }
        // Get all available node types from SHACL shapes
        function getAvailableNodeTypes() {
            if (!shaclShapesStore) {
                return [];
            }
            
            const nodeTypes = new Set();
            
            try {
                // Find all NodeShapes with sh:targetClass
                const targetClassQuads = shaclShapesStore.getQuads(
                    null,
                    'http://www.w3.org/ns/shacl#targetClass',
                    null,
                    null
                );
                
                targetClassQuads.forEach(quad => {
                    const classUri = quad.object.value;
                    // Extract the class name from the URI
                    const className = classUri.split('/').pop().split('#').pop();
                    nodeTypes.add({
                        uri: classUri,
                        name: className,
                        label: humanizeKey(className)
                    });
                });
            } catch (error) {
                console.error('Error getting node types:', error);
            }
            
            // Convert Set to Array and sort by label
            return Array.from(nodeTypes).sort((a, b) => a.label.localeCompare(b.label));
        }
        
        // Add a new root node to the graph
        function addRootNode() {
            const availableTypes = getAvailableNodeTypes();
            
            if (availableTypes.length === 0) {
                // No SHACL shapes loaded, allow custom type
                const customType = prompt('Enter node type (e.g., DataSet, Study, Variable):');
                if (!customType) return;
                
                createAndAddRootNode(customType);
                return;
            }
            
            // Create a modal-like selection interface using Bootstrap modal
            const modalHtml = `
                <div class="modal fade" id="addRootNodeModal" tabindex="-1" role="dialog">
                    <div class="modal-dialog" role="document">
                        <div class="modal-content">
                            <div class="modal-header">
                                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                                <h4 class="modal-title">
                                    <span class="glyphicon glyphicon-plus-sign"></span>
                                    Add New Root Node
                                </h4>
                            </div>
                            <div class="modal-body">
                                <div class="form-group">
                                    <label for="nodeTypeSelect"><strong>Select Node Type:</strong></label>
                                    <select id="nodeTypeSelect" class="form-control" size="10" style="height: 300px;">
                                        ${availableTypes.map(type => 
                                            `<option value="${type.name}">${type.label}</option>`
                                        ).join('')}
                                    </select>
                                    <small class="help-block">Select a type from the available SHACL shapes</small>
                                </div>
                                <div class="form-group">
                                    <label for="customNodeType"><strong>Or enter custom type:</strong></label>
                                    <input type="text" id="customNodeType" class="form-control" placeholder="e.g., DataSet, Study, Variable">
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary" id="confirmAddRootNode">
                                    <span class="glyphicon glyphicon-plus"></span> Add Node
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal if any
            $('#addRootNodeModal').remove();
            
            // Add modal to body
            $('body').append(modalHtml);
            
            // Show modal
            $('#addRootNodeModal').modal('show');
            
            // Handle confirm button
            $('#confirmAddRootNode').off('click').on('click', function() {
                const customType = $('#customNodeType').val().trim();
                const selectedType = $('#nodeTypeSelect').val();
                
                const nodeType = customType || selectedType;
                
                if (!nodeType) {
                    alert('Please select or enter a node type');
                    return;
                }
                
                $('#addRootNodeModal').modal('hide');
                createAndAddRootNode(nodeType);
            });
            
            // Handle Enter key in custom type input
            $('#customNodeType').on('keypress', function(e) {
                if (e.which === 13) { // Enter key
                    e.preventDefault();
                    $('#confirmAddRootNode').click();
                }
            });
            
            // Handle double-click on list item
            $('#nodeTypeSelect').on('dblclick', function() {
                $('#confirmAddRootNode').click();
            });
        }
        
        // Create and add a root node with the specified type
        function createAndAddRootNode(nodeType) {
            // Generate unique ID
            const timestamp = Date.now();
            const newNodeId = `#NewNode_${nodeType}_${timestamp}`;
            
            // Create new node
            const newNode = {
                '@id': newNodeId,
                '@type': nodeType
            };
            
            // Add to graph
            if (!jsonData['@graph']) {
                jsonData['@graph'] = [];
            }
            jsonData['@graph'].push(newNode);
            
            // Re-render
            renderData();
            
            // Mark as changed
            updateSaveButton();
            
            // Scroll to new node and highlight it
            setTimeout(() => {
                const newCard = $(`.node-card[data-node-id="${newNodeId}"]`);
                if (newCard.length) {
                    newCard[0].scrollIntoView({behavior: 'smooth', block: 'center'});
                    newCard.addClass('highlight');
                    setTimeout(() => newCard.removeClass('highlight'), 2000);
                }
            }, 100);
            
            console.log('Added new root node:', newNode);
        }
        
        function getPropertySuggestions(node, types) {
            if (!shaclShapesStore || types.length === 0) {
                return [];
            }
            
            const suggestions = [];
            const existingProperties = Object.keys(node).filter(k => k !== '@id' && k !== '@type' && k !== '@context');
            
            // Collect all applicable shape URIs
            const applicableShapes = new Set();
            
            // 1. Check SPARQL target cache first (if enabled and executed)
            if (sparqlTargetCache.enabled && sparqlTargetCache.executed && node['@id']) {
                for (const [shapeUri, matchedNodes] of Object.entries(sparqlTargetCache.results)) {
                    if (matchedNodes.has(node['@id'])) {
                        applicableShapes.add(shapeUri);
                    }
                }
            }
            
            // 2. Also check sh:targetClass (traditional method)
            types.forEach(type => {
                // Look for NodeShapes with sh:targetClass matching this type
                const targetClassQuads = shaclShapesStore.getQuads(
                    null,
                    'http://www.w3.org/ns/shacl#targetClass',
                    type.startsWith('http') ? type : 'http://ddialliance.org/Specification/DDI-CDI/1.0/RDF/' + type,
                    null
                );
                
                targetClassQuads.forEach(quad => {
                    applicableShapes.add(quad.subject.value);
                });
            });
            
            // Now process all applicable shapes
            applicableShapes.forEach(shapeSubject => {
                // Get all sh:property predicates for this shape
                const propertyQuads = shaclShapesStore.getQuads(
                    shapeSubject,
                    'http://www.w3.org/ns/shacl#property',
                    null,
                    null
                );
                
                propertyQuads.forEach(propQuad => {
                    const propertyShape = propQuad.object.value;
                        
                        // Get sh:path for this property
                        const pathQuads = shaclShapesStore.getQuads(
                            propertyShapeRef,
                            'http://www.w3.org/ns/shacl#path',
                            null,
                            null
                        );
                        
                        pathQuads.forEach(pathQuad => {
                            const path = pathQuad.object.value;
                            const pathName = path.split('/').pop().split('#').pop();
                            
                            // Check if this property already exists
                            if (!existingProperties.includes(pathName) && !existingProperties.includes(path)) {
                                // Get sh:name for human-readable label
                                const nameQuads = shaclShapesStore.getQuads(
                                    propertyShapeRef,
                                    'http://www.w3.org/ns/shacl#name',
                                    null,
                                    null
                                );
                                
                                const label = nameQuads.length > 0 
                                    ? nameQuads[0].object.value 
                                    : humanizeKey(pathName);
                                
                                // Get minCount
                                const minCountQuads = shaclShapesStore.getQuads(
                                    propertyShapeRef,
                                    'http://www.w3.org/ns/shacl#minCount',
                                    null,
                                    null
                                );
                                const required = minCountQuads.length > 0 && parseInt(minCountQuads[0].object.value) > 0;
                                
                                // Get maxCount
                                const maxCountQuads = shaclShapesStore.getQuads(
                                    propertyShapeRef,
                                    'http://www.w3.org/ns/shacl#maxCount',
                                    null,
                                    null
                                );
                                const maxCount = maxCountQuads.length > 0 ? parseInt(maxCountQuads[0].object.value) : null;
                                
                                // Check if it's a complex object (sh:node or sh:class)
                                const nodeQuads = shaclShapesStore.getQuads(
                                    propertyShapeRef,
                                    'http://www.w3.org/ns/shacl#node',
                                    null,
                                    null
                                );
                                const classQuads = shaclShapesStore.getQuads(
                                    propertyShapeRef,
                                    'http://www.w3.org/ns/shacl#class',
                                    null,
                                    null
                                );
                                const isComplex = nodeQuads.length > 0 || classQuads.length > 0;
                                
                                // Get the class from sh:class or find it from sh:node's targetClass or sh:in
                                let nodeClass = null;
                                if (classQuads.length > 0) {
                                    nodeClass = classQuads[0].object.value;
                                } else if (nodeQuads.length > 0) {
                                    // sh:node points to another NodeShape (might be a blank node)
                                    // Use the actual node object, not just the value
                                    const nodeShapeNode = nodeQuads[0].object;
                                    
                                    // Try to get targetClass (using the node object, not string)
                                    const targetClassQuads = shaclShapesStore.getQuads(
                                        nodeShapeNode,
                                        'http://www.w3.org/ns/shacl#targetClass',
                                        null,
                                        null
                                    );
                                    
                                    if (targetClassQuads.length > 0) {
                                        nodeClass = targetClassQuads[0].object.value;
                                    } else {
                                        // If no targetClass, look for sh:property -> sh:path rdf:type -> sh:in
                                        // This handles inline blank node shapes with sh:in constraints
                                        const propertyConstraints = shaclShapesStore.getQuads(
                                            nodeShapeNode,
                                            'http://www.w3.org/ns/shacl#property',
                                            null,
                                            null
                                        );
                                        
                                        for (const propQuad of propertyConstraints) {
                                            const propShape = propQuad.object;
                                            
                                            // Check if this is a type constraint (sh:path rdf:type)
                                            const pathQuads = shaclShapesStore.getQuads(
                                                propShape,
                                                'http://www.w3.org/ns/shacl#path',
                                                'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
                                                null
                                            );
                                            
                                            if (pathQuads.length > 0) {
                                                // Found rdf:type constraint, look for sh:in
                                                const inQuads = shaclShapesStore.getQuads(
                                                    propShape,
                                                    'http://www.w3.org/ns/shacl#in',
                                                    null,
                                                    null
                                                );
                                                
                                                if (inQuads.length > 0) {
                                                    // sh:in points to an RDF list, get the first item
                                                    let listNode = inQuads[0].object;  // Use object, not value!
                                                    
                                                    const firstQuads = shaclShapesStore.getQuads(
                                                        listNode,
                                                        'http://www.w3.org/1999/02/22-rdf-syntax-ns#first',
                                                        null,
                                                        null
                                                    );
                                                    
                                                    if (firstQuads.length > 0) {
                                                        nodeClass = firstQuads[0].object.value;
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                
                                // Get description
                                const descQuads = shaclShapesStore.getQuads(
                                    propertyShapeRef,
                                    'http://www.w3.org/ns/shacl#description',
                                    null,
                                    null
                                );
                                const description = descQuads.length > 0 ? descQuads[0].object.value : '';
                                
                                suggestions.push({
                                    path: pathName,
                                    fullPath: path,
                                    label: label,
                                    required: required,
                                    maxCount: maxCount,
                                    isComplex: isComplex,
                                    nodeClass: nodeClass,
                                    description: description
                                });
                            }
                        });
                });
            });
            
            // Remove duplicates
            const unique = [];
            const seen = new Set();
            suggestions.forEach(s => {
                if (!seen.has(s.path)) {
                    seen.add(s.path);
                    unique.push(s);
                }
            });
            
            return unique;
        }
        function createPropertySuggestionsSection(suggestions, nodeId, bodyElement) {
            const section = $('<div>').addClass('add-property-section');
            section.append($('<h4>').text('Add Properties').css({'margin-top': '0', 'margin-bottom': '10px'}));
            
            // Sort: required first, then alphabetically
            suggestions.sort((a, b) => {
                if (a.required && !b.required) return -1;
                if (!a.required && b.required) return 1;
                return a.label.localeCompare(b.label);
            });
            
            // Control row with dropdown and buttons
            const controlRow = $('<div>').addClass('add-property-controls');
            
            // Searchable dropdown
            const dropdownWrapper = $('<div>').addClass('property-dropdown-wrapper');
            const dropdown = $('<select>').addClass('property-dropdown');
            dropdown.append($('<option>').val('').text('-- Select a property to add --'));
            
            suggestions.forEach(suggestion => {
                const option = $('<option>')
                    .val(suggestion.path)
                    .attr('data-required', suggestion.required)
                    .attr('data-complex', suggestion.isComplex)
                    .attr('data-max-count', suggestion.maxCount || '')
                    .attr('data-node-class', suggestion.nodeClass || '')
                    .attr('data-description', suggestion.description)
                    .data('suggestion', suggestion);
                
                let text = suggestion.label;
                if (suggestion.required) text = '⚠ ' + text + ' (REQUIRED)';
                if (suggestion.isComplex) text = text + ' [object]';
                if (suggestion.maxCount === 1) text = text + ' (max 1)';
                
                option.text(text);
                dropdown.append(option);
            });
            
            dropdownWrapper.append(dropdown);
            controlRow.append(dropdownWrapper);
            
            // Add button
            const addBtn = $('<button>')
                .addClass('btn btn-primary')
                .html('<span class="glyphicon glyphicon-plus"></span> Add Property')
                .click(function() {
                    const selectedPath = dropdown.val();
                    if (!selectedPath) {
                        alert('Please select a property first');
                        return;
                    }
                    
                    const selectedOption = dropdown.find('option:selected');
                    const suggestion = selectedOption.data('suggestion');
                    
                    if (suggestion.isComplex) {
                        // Always create a separate node and reference it
                        addComplexPropertyToNode(nodeId, suggestion, bodyElement);
                    } else {
                        // Add simple property with empty string as initial value
                        addPropertyToNode(nodeId, suggestion.path, '', bodyElement);
                    }
                    
                    // Remove from dropdown if maxCount = 1
                    if (suggestion.maxCount === 1) {
                        selectedOption.remove();
                    }
                    
                    dropdown.val('');
                });
            
            controlRow.append(addBtn);
            
            // Add Custom Property button
            const addCustomBtn = $('<button>')
                .addClass('btn btn-default')
                .html('<span class="glyphicon glyphicon-edit"></span> Add Custom Property')
                .click(function() {
                    const propName = prompt('Enter custom property name:');
                    if (propName) {
                        addPropertyToNode(nodeId, propName, '', bodyElement);
                    }
                });
            
            controlRow.append(addCustomBtn);
            
            section.append(controlRow);
            
            // Description area (shows when property is selected)
            const descArea = $('<div>')
                .addClass('property-info')
                .css({'margin-top': '10px', 'display': 'none'});
            section.append(descArea);
            
            // Show description on selection change
            dropdown.on('change', function() {
                const selectedOption = $(this).find('option:selected');
                const description = selectedOption.attr('data-description');
                if (description) {
                    descArea.text(description).show();
                } else {
                    descArea.hide();
                }
            });
            
            return section;
        }
        
        function addComplexPropertyToNode(nodeId, suggestion, bodyElement) {
            // Create a new node in the @graph
            const newNodeId = `_:${suggestion.path}_${Date.now()}`;
            
            // Extract class name from full URI or use the short name
            let className = suggestion.nodeClass || 'Object';
            
            // If it's a full URI, extract just the class name
            if (className.includes('/') || className.includes('#')) {
                className = className.split('/').pop().split('#').pop();
            }
            
            const newNode = {
                '@id': newNodeId,
                '@type': className
            };
            
            // Add to graph
            if (!jsonData['@graph']) {
                jsonData['@graph'] = [];
            }
            jsonData['@graph'].push(newNode);
            
            // Add reference to parent node
            const parentNode = jsonData['@graph'].find(n => n['@id'] === nodeId);
            if (parentNode) {
                if (suggestion.maxCount === 1) {
                    parentNode[suggestion.path] = {'@id': newNodeId};
                } else {
                    if (!parentNode[suggestion.path]) {
                        parentNode[suggestion.path] = [];
                    }
                    if (Array.isArray(parentNode[suggestion.path])) {
                        parentNode[suggestion.path].push({'@id': newNodeId});
                    } else {
                        parentNode[suggestion.path] = [parentNode[suggestion.path], {'@id': newNodeId}];
                    }
                }
            }
            
            // Re-render everything
            renderData();
            updateSaveButton();
            
            // Scroll to new node
            setTimeout(() => {
                const newCard = $(`.node-card[data-node-id="${newNodeId}"]`);
                if (newCard.length) {
                    newCard[0].scrollIntoView({behavior: 'smooth', block: 'center'});
                    newCard.addClass('changed');
                }
            }, 100);
        }
        
        function addPropertyToNode(nodeId, propertyKey, initialValue, bodyElement) {
            // Add the property to the data and get node types
            let nodeTypes = [];
            jsonData['@graph'].forEach(node => {
                if (node['@id'] === nodeId) {
                    node[propertyKey] = initialValue;
                    nodeTypes = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
                }
            });
            
            // Re-render just this node's body with proper classification
            const propertyRow = renderProperty(propertyKey, initialValue, nodeId, nodeTypes);
            bodyElement.append(propertyRow);
            
            // Mark as changed
            propertyRow.addClass('changed');
            updateSaveButton();
        }

        function setupEventHandlers() {
            // Load local file button
            $('#load-local-btn').off('click').click(function() {
                $('#local-file-input').click();
            });
            
            $('#local-file-input').off('change').on('change', async function(event) {
                const file = event.target.files && event.target.files[0];
                if (!file) return;
                
                try {
                    const fileText = await file.text();
                    let parsedData = JSON.parse(fileText);
                    
                    // Set filename for export
                    originalFileName = file.name;
                    
                    // Normalize to @graph format
                    jsonData = await normalizeToGraphFormat(parsedData);
                    
                    if (!jsonData['@graph']) {
                        throw new Error('Failed to normalize JSON-LD structure.');
                    }
                    
                    originalData = JSON.parse(JSON.stringify(jsonData));
                    
                    // Expand JSON-LD
                    try {
                        expandedJsonLd = await jsonld.expand(jsonData);
                    } catch (expandError) {
                        console.warn('Could not expand JSON-LD:', expandError);
                        expandedJsonLd = null;
                    }
                    
                    // Load SHACL shapes if not already loaded
                    if (!shaclShapesStore) {
                        try {
                            await loadShaclShapes('ddi-cdi-official');
                        } catch (shapeError) {
                            console.error('Failed to load SHACL shapes:', shapeError);
                        }
                    }
                    
                    // Execute SPARQL targets to match nodes to shapes
                    await executeSparqlTargets();
                    
                    // Render the data
                    renderData();
                    
                    $('#content').prepend(`
                        <div class="alert alert-success" style="margin-bottom: 10px;">
                            <strong>Loaded:</strong> ${file.name}
                        </div>
                    `);
                    
                } catch (error) {
                    console.error('Error loading local file:', error);
                    alert('Failed to load file: ' + error.message);
                }
                
                // Reset input so same file can be selected again
                $(this).val('');
            });
            
            // Toggle edit mode
            $('#toggle-edit-btn').click(function() {
                isEditMode = !isEditMode;
                
                if (isEditMode) {
                    $(this).html('<span class="glyphicon glyphicon-eye-open"></span> View Mode')
                           .removeClass('btn-primary').addClass('btn-warning');
                    $('#save-btn').removeClass('hidden');
                    $('#add-root-node-btn').removeClass('hidden');
                    
                    // Auto-validate when entering edit mode
                    validateData();
                } else {
                    $(this).html('<span class="glyphicon glyphicon-edit"></span> Enable Editing')
                           .removeClass('btn-warning').addClass('btn-primary');
                    $('#save-btn').addClass('hidden');
                    $('#add-root-node-btn').addClass('hidden');
                }
                
                renderData();
            });
            
            // Add Root Node
            $('#add-root-node-btn').click(function() {
                addRootNode();
            });
            
            // Save changes
            $('#save-btn').click(function() {
                // Validate before saving
                const savedValidationStatus = $('#validation-status').html();
                validateData();
                
                // Check if validation passed
                setTimeout(() => {
                    if (validationReport && !validationReport.conforms) {
                        if (!confirm('Data has validation errors. Save anyway?')) {
                            return;
                        }
                    }
                    saveChanges();
                }, 500);
            });
            
            // Confirm save button in modal
            $('#confirmSaveBtn').click(function() {
                saveToDataverse();
            });
            
            // Allow Enter key in API token input to trigger save
            $('#apiTokenInput').keypress(function(e) {
                if (e.which === 13) { // Enter key
                    e.preventDefault();
                    saveToDataverse();
                }
            });
            
            // Validate
            $('#validate-btn').click(function() {
                validateData();
            });
            
            // Export
            $('#export-btn').click(function() {
                exportData();
            });
            
            // Collapse all
            $('#collapse-all-btn').click(function() {
                $('.node-card').addClass('collapsed');
            });
            
            // Expand all
            $('#expand-all-btn').click(function() {
                $('.node-card').removeClass('collapsed');
            });
            
            // Toggle SHACL-only filter
            $('#filter-shacl-btn').click(function() {
                const btn = $(this);
                $('body').toggleClass('filter-shacl-only');
                
                if ($('body').hasClass('filter-shacl-only')) {
                    btn.addClass('active');
                    btn.html('<span class="glyphicon glyphicon-filter"></span> Show All');
                    
                    // Hide nodes that have no SHACL-defined properties visible
                    $('.node-card').each(function() {
                        const card = $(this);
                        const visibleProps = card.find('.property-row:not(.extra-field)').length;
                        if (visibleProps === 0) {
                            card.addClass('hidden-by-filter');
                        }
                    });
                } else {
                    btn.removeClass('active');
                    btn.html('<span class="glyphicon glyphicon-filter"></span> Show SHACL Only');
                    
                    // Show all nodes again
                    $('.node-card').removeClass('hidden-by-filter');
                }
            });
            
            // Search functionality
            $('#search-input').on('input', function() {
                const searchTerm = $(this).val().toLowerCase();
                
                if (searchTerm === '') {
                    // Show all
                    $('.node-card').removeClass('hidden-by-search');
                    $('.search-highlight').contents().unwrap();
                } else {
                    // Filter nodes and properties
                    $('.node-card').each(function() {
                        const card = $(this);
                        const nodeId = card.find('.node-id').text().toLowerCase();
                        const nodeType = card.find('.node-type').text().toLowerCase();
                        const propertyTexts = card.find('.property-label, .property-path, .value-display').map(function() {
                            return $(this).text().toLowerCase();
                        }).get().join(' ');
                        
                        const matches = nodeId.includes(searchTerm) || 
                                      nodeType.includes(searchTerm) ||
                                      propertyTexts.includes(searchTerm);
                        
                        if (matches) {
                            card.removeClass('hidden-by-search').removeClass('collapsed');
                            highlightText(card, searchTerm);
                        } else {
                            card.addClass('hidden-by-search');
                        }
                    });
                }
            });
            
            // Shape selector change handler
            $('#shape-selector').on('change', async function() {
                const selectedSource = $(this).val();
                
                if (selectedSource === 'custom') {
                    // Show custom URL input
                    $('#custom-shape-url').show();
                    return; // Wait for user to enter URL and press Enter
                } else {
                    // Hide custom URL input
                    $('#custom-shape-url').hide().val('');
                    
                    // Load the selected shape
                    try {
                        $('#validation-status').html('<span class="label label-info">Loading shapes...</span>');
                        await loadShaclShapes(selectedSource);
                        
                        // Execute SPARQL targets if data is loaded
                        if (jsonData) {
                            await executeSparqlTargets();
                            
                            // Re-render to apply new shape classifications
                            renderData();
                        }
                        
                        // Re-validate if in edit mode
                        if (isEditMode) {
                            validateData();
                        } else {
                            $('#validation-status').html('<span class="label label-success">Shapes loaded</span>');
                            setTimeout(() => {
                                $('#validation-status').html('');
                            }, 2000);
                        }
                    } catch (error) {
                        console.error('Error loading shape:', error);
                        $('#validation-status').html('<span class="validation-badge invalid">Shape load failed</span>');
                    }
                }
            });
            
            // Custom shape URL input handler
            $('#custom-shape-url').on('keypress', async function(e) {
                if (e.which === 13) { // Enter key
                    e.preventDefault();
                    const customUrl = $(this).val().trim();
                    
                    if (!customUrl) {
                        alert('Please enter a valid URL');
                        return;
                    }
                    
                    try {
                        $('#validation-status').html('<span class="label label-info">Loading custom shapes...</span>');
                        await loadShaclShapes('custom', customUrl);
                        
                        // Execute SPARQL targets if data is loaded
                        if (jsonData) {
                            await executeSparqlTargets();
                        }
                        
                        // Re-render to apply new shape classifications
                        renderData();
                        
                        // Re-validate if in edit mode
                        if (isEditMode) {
                            validateData();
                        } else {
                            $('#validation-status').html('<span class="label label-success">Custom shapes loaded</span>');
                            setTimeout(() => {
                                $('#validation-status').html('');
                            }, 2000);
                        }
                    } catch (error) {
                        console.error('Error loading custom shape:', error);
                        $('#validation-status').html('<span class="validation-badge invalid">Custom shape load failed</span>');
                        alert(`Failed to load custom SHACL shape from:\n${customUrl}\n\nError: ${error.message}`);
                    }
                }
            });
        }
        
        function highlightText(element, searchTerm) {
            // Remove previous highlights
            element.find('.search-highlight').contents().unwrap();
            
            // Highlight matching text
            element.find('.property-label, .property-path, .value-display, .node-id').each(function() {
                const $this = $(this);
                const text = $this.text();
                const lowerText = text.toLowerCase();
                const index = lowerText.indexOf(searchTerm);
                
                if (index >= 0) {
                    const before = text.substring(0, index);
                    const match = text.substring(index, index + searchTerm.length);
                    const after = text.substring(index + searchTerm.length);
                    
                    $this.html(
                        document.createTextNode(before).textContent +
                        '<span class="search-highlight">' + document.createTextNode(match).textContent + '</span>' +
                        document.createTextNode(after).textContent
                    );
                }
            });
        }

        function updateSaveButton() {
            const hasChanges = $('.property-row.changed').length > 0;
            $('#save-btn').prop('disabled', !hasChanges);
        }

        function collectChangesFromDOM() {
            // Only update jsonData if we're in edit mode and have actual changes
            if (!isEditMode) {
                console.log('collectChangesFromDOM: Not in edit mode, skipping');
                return; // Don't modify data in view mode
            }
            
            // Check if there are any actual changes
            const hasChanges = $('.property-row.changed').length > 0;
            console.log('collectChangesFromDOM: Found', hasChanges, 'changed rows');
            if (!hasChanges) {
                return; // No changes, keep original jsonData unchanged
            }
            
            // Update only the changed properties in jsonData, preserve everything else
            $('.node-card').each(function() {
                const $card = $(this);
                const nodeId = $card.find('.node-id').first().text();
                
                // Find the node in jsonData
                const node = jsonData['@graph'].find(n => n['@id'] === nodeId);
                if (!node) {
                    console.warn('collectChangesFromDOM: Node not found:', nodeId);
                    return; // Skip if not found
                }
                
                // Only update properties that have changed IN THIS NODE (not nested nodes)
                // Use children().find() to get only direct properties, not nested node properties
                $card.children('.node-body').find('.property-row.changed').each(function() {
                    const key = $(this).attr('data-property');
                    const inputs = $(this).find('input, textarea, select');
                    
                    console.log('collectChangesFromDOM: Updating', nodeId, key, 'with', inputs.length, 'inputs');
                    
                    if (inputs.length === 1) {
                        // Single value
                        const input = inputs.eq(0);
                        let val = input.val();
                        
                        console.log('collectChangesFromDOM: Old value:', node[key], '-> New value:', val);
                        
                        try {
                            val = JSON.parse(val);
                        } catch (e) {
                            // Keep as string if not valid JSON
                        }
                        node[key] = val;
                    } else if (inputs.length > 1) {
                        // Array of values
                        const values = [];
                        inputs.each(function() {
                            let val = $(this).val();
                            try {
                                val = JSON.parse(val);
                            } catch (e) {
                                // Keep as string
                            }
                            values.push(val);
                        });
                        console.log('collectChangesFromDOM: Old value:', node[key], '-> New value:', values);
                        node[key] = values;
                    }
                });
            });
            
            console.log('collectChangesFromDOM: Complete. Updated jsonData:', jsonData);
            // jsonData['@graph'] is already updated in place - no need to replace it
        }
        
        function saveChanges() {
            // First, collect any changes from the DOM
            collectChangesFromDOM();
            
            // Clear API token input and show modal
            $('#apiTokenInput').val('');
            $('#saveModal').modal('show');
        }
        
        async function saveToDataverse() {
            const apiToken = $('#apiTokenInput').val().trim();
            
            if (!apiToken) {
                alert('Please enter your API token.');
                return;
            }
            
            // Close the modal and show loading
            $('#saveModal').modal('hide');
            
            try {
                // Prepare the data as JSON-LD string
                const jsonldString = JSON.stringify(jsonData, null, 2);
                
                // Use the exact MIME type that matches the external tool registration
                // Note: Dataverse's replace API strips spaces from MIME type parameters
                const mimeType = 'application/ld+json;profile="http://www.w3.org/ns/json-ld#flattened http://www.w3.org/ns/json-ld#compacted https://ddialliance.org/specification/ddi-cdi/1.0"';
                const blob = new Blob([jsonldString], { type: mimeType });
                
                // Create form data
                const formData = new FormData();
                formData.append('file', blob, originalFileName);
                formData.append('jsonData', JSON.stringify({
                    description: 'Updated CDI metadata',
                    categories: ['Data'],
                    forceReplace: true
                }));
                
                // Show saving indicator
                $('#save-btn').prop('disabled', true).html('<span class="glyphicon glyphicon-refresh spinning"></span> Saving...');
                
                // Call Dataverse API to replace file
                const response = await fetch(`${siteUrl}/api/files/${fileId}/replace`, {
                    method: 'POST',
                    headers: {
                        'X-Dataverse-key': apiToken
                    },
                    body: formData
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API error: ${response.status} - ${errorText}`);
                }
                
                const result = await response.json();
                
                if (result.status === 'OK') {
                    $('.property-row').removeClass('changed');
                    updateSaveButton();
                } else {
                    throw new Error('Unexpected response: ' + JSON.stringify(result));
                }
                
            } catch (error) {
                console.error('Save error:', error);
                alert('✗ Failed to save to Dataverse:\n' + error.message + '\n\nPlease check:\n- Your API token is valid\n- You have write access to this dataset\n- The dataset is accessible');
            } finally {
                // Reset button
                $('#save-btn').prop('disabled', false).html('<span class="glyphicon glyphicon-floppy-disk"></span> Save Changes');
            }
        }

        async function validateData() {
            $('#validation-status').html('<span class="label label-info">Validating...</span>');
            
            try {
                // Convert JSON-LD to N3 Store using jsonld library
                const dataStore = new N3.Store();
                
                // Create a local copy without @context
                const dataForValidation = JSON.parse(JSON.stringify(jsonData));
                
                // Remove @context to avoid remote fetching - we'll use local namespace mapping
                if (dataForValidation['@context']) {
                    delete dataForValidation['@context'];
                }
                
                // Add a minimal local context for basic processing
                dataForValidation['@context'] = {
                    "@vocab": "http://ddialliance.org/Specification/DDI-CDI/1.0/RDF/"
                };
                
                // Custom document loader that prevents remote fetching
                const documentLoader = jsonld.documentLoaders.xhr();
                const customLoader = async (url) => {
                    console.log('Skipping remote context fetch:', url);
                    // Return empty context for any remote URLs
                    return {
                        contextUrl: null,
                        document: { "@context": {} },
                        documentUrl: url
                    };
                };
                
                // Expand with custom loader
                const expanded = await jsonld.expand(dataForValidation, {
                    documentLoader: customLoader
                });
                
                // Convert expanded JSON-LD to N-Quads
                const nquads = await jsonld.toRDF(expanded, {
                    format: 'application/n-quads',
                    documentLoader: customLoader
                });
                

                
                // Parse the N-Quads into the store
                const parser = new N3.Parser({ format: 'N-Quads' });
                
                parser.parse(nquads, (error, quad, prefixes) => {
                    if (error) {
                        console.error('Parse error:', error);
                        $('#validation-status').html(
                            '<span class="validation-badge invalid">Parse Error: ' + error.message + '</span>'
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
                console.error('Validation error:', error);
                $('#validation-status').html(
                    '<span class="validation-badge invalid">Validation Error: ' + error.message + '</span>'
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
                    N3.DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                    N3.DataFactory.namedNode('http://www.w3.org/ns/shacl#NodeShape'),
                    null
                );
                
                // For each node in data, check against its shape
                for (const node of jsonData['@graph'] || []) {
                    const nodeId = N3.DataFactory.namedNode(node['@id']);
                    const nodeType = node['@type'];
                    
                    if (!nodeType) continue;
                    
                    // Find matching shape by target class
                    const targetClassPred = N3.DataFactory.namedNode('http://www.w3.org/ns/shacl#targetClass');
                    const nodeTypeTerm = N3.DataFactory.namedNode(nodeType);
                    
                    for (const shape of nodeShapes) {
                        const targetClasses = shaclShapesStore.getObjects(shape, targetClassPred, null);
                        
                        if (targetClasses.some(tc => tc.equals(nodeTypeTerm))) {
                            // Check properties for this shape
                            const propertyPred = N3.DataFactory.namedNode('http://www.w3.org/ns/shacl#property');
                            const propertyShapes = shaclShapesStore.getObjects(shape, propertyPred, null);
                            
                            for (const propShape of propertyShapes) {
                                const path = shaclShapesStore.getObjects(propShape, N3.DataFactory.namedNode('http://www.w3.org/ns/shacl#path'), null)[0];
                                const minCount = shaclShapesStore.getObjects(propShape, N3.DataFactory.namedNode('http://www.w3.org/ns/shacl#minCount'), null)[0];
                                const maxCount = shaclShapesStore.getObjects(propShape, N3.DataFactory.namedNode('http://www.w3.org/ns/shacl#maxCount'), null)[0];
                                
                                if (path && minCount) {
                                    const pathStr = path.value.split('/').pop().split('#').pop();
                                    const minCountVal = parseInt(minCount.value);
                                    const actualCount = node[pathStr] ? (Array.isArray(node[pathStr]) ? node[pathStr].length : 1) : 0;
                                    
                                    if (actualCount < minCountVal) {
                                        violations.push({
                                            focusNode: node['@id'],
                                            path: pathStr,
                                            message: `Required property '${pathStr}' is missing (minCount: ${minCountVal}, actual: ${actualCount})`
                                        });
                                    }
                                }
                                
                                if (path && maxCount) {
                                    const pathStr = path.value.split('/').pop().split('#').pop();
                                    const maxCountVal = parseInt(maxCount.value);
                                    const actualCount = node[pathStr] ? (Array.isArray(node[pathStr]) ? node[pathStr].length : 1) : 0;
                                    
                                    if (actualCount > maxCountVal) {
                                        violations.push({
                                            focusNode: node['@id'],
                                            path: pathStr,
                                            message: `Property '${pathStr}' exceeds maxCount (maxCount: ${maxCountVal}, actual: ${actualCount})`
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
                
                const report = {
                    conforms: violations.length === 0,
                    results: violations
                };
                
                validationReport = report;
                

                
                // Update UI
                if (report.conforms) {
                    $('#validation-status').html(
                        '<span class="validation-badge valid">' +
                        '<span class="glyphicon glyphicon-ok-circle"></span> Valid' +
                        '</span>'
                    );
                } else {
                    $('#validation-status').html(
                        '<span class="validation-badge invalid">' +
                        '<span class="glyphicon glyphicon-exclamation-sign"></span> ' +
                        violations.length + ' violation(s)' +
                        '</span>'
                    );
                }
                
                // Update property rows with validation results
                updatePropertyValidation(violations);
                
            } catch (error) {
                console.error('SHACL validation error:', error);
                $('#validation-status').html(
                    '<span class="validation-badge invalid">Validation Engine Error: ' + error.message + '</span>'
                );
            }
        }
        
        function updatePropertyValidation(violations) {
            // Clear previous validation states
            $('.property-row').removeClass('invalid').find('.validation-message').remove();
            
            // Group violations by focus node and path
            violations.forEach(violation => {
                if (violation.focusNode && violation.path) {
                    const nodeId = violation.focusNode;
                    const path = violation.path;
                    
                    // Find matching property row
                    const propertyRow = $(`.property-row[data-node-id="${nodeId}"][data-property="${path}"]`);
                    
                    if (propertyRow.length > 0) {
                        propertyRow.addClass('invalid');
                        
                        // Add validation message
                        const message = violation.message || 'Validation failed';
                        const msgDiv = $('<div>').addClass('validation-message').text(message);
                        propertyRow.append(msgDiv);
                    }
                }
            });
        }

        function exportData() {
            // Collect any changes from DOM before exporting
            collectChangesFromDOM();
            
            const dataStr = JSON.stringify(jsonData, null, 2);
            // Use the exact MIME type that matches the external tool registration
            // Note: Dataverse's replace API strips spaces from MIME type parameters
            const mimeType = 'application/ld+json;profile="http://www.w3.org/ns/json-ld#flattened http://www.w3.org/ns/json-ld#compacted https://ddialliance.org/specification/ddi-cdi/1.0"';
            const blob = new Blob([dataStr], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'cdi-data.jsonld';
            a.click();
            
            URL.revokeObjectURL(url);
        }
