Goals
Make cdi-preview.js clean, robust, and reviewer-friendly.
Ensure all core features work reliably:
View and edit modes (including property suggestions).
Saving back to Dataverse (unchanged → equivalent file, changed → only intentional diffs).
Export JSON-LD with correct MIME type.
SHACL classification and filters (especially CDIF Discovery with Steve’s examples).
Fix CDIF Discovery shapes/previewer behavior so Steve’s examples show blue for CDIF-defined properties, not only for the schema:Dataset type badges. (Status: partially done; dataset targeting and core shapes improved, but Steve’s properties are still mostly EXTRA and need more work.)
Phase 1 – Stabilize current behavior
Fix all runtime errors and obvious bugs

 Fix propertyShapeRef is not defined in getPropertySuggestions.
 Scan for other XAS-specific debug remnants (e.g. if (nodeId === 'xas:485749' ...)) and either:
Remove them, or
Guard behind LOG_LEVEL.DEBUG.
 Confirm there are no other uncaught exceptions in:
Toggling edit mode.
Changing SHACL shape source (DDI vs CDIF).
Loading local files.
Verify editing pipeline end-to-end

 In standalone mode (Load Local File) and Dataverse mode:
Load a simple file (cdif_example.jsonld).
Toggle edit mode.
Edit a scalar, an array element, and add/remove properties.
Export JSON-LD, verify:
With no edits: file is equal modulo normalization (@graph / ordering).
With minimal edit: only expected changes appear.
Load Steve’s examples:
Ensure edit mode renders properties and suggestions (no crash).
Confirm changes are captured by collectChangesFromDOM() and reflected in export.
Verify Dataverse save

 Manually test (or simulate) saveToDataverse:
When there are no .changed rows:
collectChangesFromDOM() should be a no-op; jsonData equals normalized original.
When there are changes:
Only edited properties differ.
 Check mimeType is correct and matches the external tool registration documented in CDI_PREVIEWER.md.
Phase 2 – SHACL / CDIF Discovery correctness (Steve’s examples) – in progress / partial
Confirm SHACL target behavior for CDIF Discovery

 In TTL (CDIF-Discovery-Core-Shapes.ttl), we:
Switched schema.org to HTTPS.
Relaxed sh:SPARQLTarget to select all schema:Dataset nodes.
 Verify at runtime with Steve’s examples:
Console logs show:
Parsed 1 SPARQL target(s)
SPARQL execution complete: ...
Found N schema:Dataset instances
sparqlTargetCache.results includes xas:485749 (or its expanded URI).
Diagnose why Steve’s properties still show as EXTRA

 For Steve’s dataset node:
Log/debug:
Node @type values.
Node’s properties keys (schema:name, schema:identifier, etc.).
For CDIF Discovery shapes:
Inspect cdifd:CDIFDatasetRecommendedShape sh:property list:
Ensure it references the right property shapes (cdifd:nameProperty, cdifd:resourceIdentifierProperty, etc.).
Ensure those shapes have sh:path that can be matched by classifyProperty logic.
 Check if mismatch is due to:
Path naming conventions (e.g., CDIF uses paths like schema:name or custom cdi: paths).
Our classifyProperty matching heuristic not recognizing the CDIF-style sh:path URIs.
 Decide where to fix:
Preferred: Adjust TTL so paths for core CDIF discovery properties match the actual JSON-LD (https://schema.org/name, https://schema.org/identifier, etc.).
If needed: Relax/improve classifyProperty matching rules to better map CDIF-style paths to JSON-LD keys (e.g. handle schema:name vs name, and CDIF’s custom naming schemes).
Implement the CDIF fix

 If TTL-only fix possible:
Update CDIF-Discovery-Core-Shapes.ttl paths to match Steve’s schema:* properties.
Re-test Steve’s examples:
Core fields show as blue (OPTIONAL/REQUIRED) instead of EXTRA.
SHACL-only filter leaves those properties visible, not just type badges.
 If code change is also needed:
Carefully adjust classifyProperty to:
Prefer exact URI matches (expanded property URI ↔ sh:path).
Fall back to local-name heuristics as now, but ensure they work with CDIF naming.
Keep changes minimal and well-commented to aid review.
Update documentation for Steve

 Extend CDIF_DISCOVERY_SHAPES_FIX.md to:
Explain the second-level CDIF issue: paths and/or selection rules for properties, not just dataset targeting.
Document any JSON-LD structural assumptions (e.g. use of schema:identifier as literal vs PropertyValue).
Provide concrete TTL diffs Steve can apply upstream.
 Optionally add a short section describing how the previewer uses:
SPARQL targets → node selection.
sh:property + sh:path → classification of fields.
Phase 3 – Refactoring and cleanup for a “great PR”
Structure and readability of cdi-preview.js

 Introduce top-of-file constants for frequently used URIs:
SHACL, RDF, XSD, SCHEMA, CDI, etc.
 Add logical section headers:
// === Logging & Globals ===
// === SHACL & SPARQL Helpers ===
// === JSON-LD & RDF Helpers ===
// === Rendering & UI ===
// === Editing & Persistence ===
 Remove or gate any ad-hoc debug code like node-id-specific logs behind:
if (currentLogLevel >= LOG_LEVEL.DEBUG) { ... } or via log().
Current CDI previewer module structure (implemented)

- `js/cdi-preview/cdi-shacl-sparql.js` – shape parsing, SPARQL target discovery, SPARQL execution, JSON-LD→N3 store conversion.
- `js/cdi-preview/core.js` – Dataverse wiring and initial load: reads external tool params, fetches JSON-LD from Dataverse, calls `normalizeToGraphFormat`, expands JSON-LD, loads SHACL shapes, executes SPARQL targets, then calls `renderData()` and `setupEventHandlers()`.
- `js/cdi-preview/cdi-json-ld-helpers.js` – JSON-LD normalization to `@graph` (`normalizeToGraphFormat`): handles DDI-CDI `DDICDIModels` + `@included`, and falls back to `jsonld.flatten` with a single-object wrapper fallback.
- `js/cdi-preview/render.js` – tree rendering: builds node cards and property rows (`renderData`, `renderNodeTree`, `renderNode`, `renderPropertyTree`, `renderProperty`, `createValueInput`, `highlightText`, etc.).
- `js/cdi-preview/property-suggestions.js` – SHACL-driven property suggestions UI (`getPropertySuggestions`, `createPropertySuggestionsSection`), using `shaclShapesStore`, `sparqlTargetCache`, `getExpandedNodeId`, and the add-property helpers.
- `js/cdi-preview/data-extraction.js` – saving/exporting pipeline (`collectChangesFromDOM`, `updateSaveButton`, `saveChanges`, `saveToDataverse`, `exportData`).
- `js/cdi-preview/validation.js` – SHACL-style validation (`validateData`, `runShaclValidation`, `updatePropertyValidation`) and updates to `#validation-status`.
- `js/cdi-preview/event-handlers.js` – all jQuery event wiring for the toolbar and inputs (`setupEventHandlers`), delegating to `renderData`, `validateData`, `addRootNode`, `saveChanges`, `saveToDataverse`, `exportData`, `loadShaclShapes`, `executeSparqlTargets`, etc.
- `js/cdi-preview/cdi-graph-helpers.js` – graph/tree-level helpers: ID/URI expansion (`getExpandedNodeId`, `getExpandedPropertyUri`), node type discovery (`getAvailableNodeTypes`), and structural editing helpers (`addRootNode`, `createAndAddRootNode`, `addComplexPropertyToNode`, `addPropertyToNode`).

`CdiPreview.html` now loads these modules in order:

1. `cdi-shacl-sparql.js`
2. `core.js`
3. `render.js`
4. `property-suggestions.js`
5. `data-extraction.js`
6. `validation.js`
7. `event-handlers.js`
8. `cdi-graph-helpers.js`

so that all globals and helpers are available when later modules execute.
PR polish

 Keep commit history clean:
Bug fix commits separate from refactor commits.
TTL changes and JS changes separated for clarity.
 In PR description:
Summarize functional fixes (Steve’s examples, edit mode).
Summarize refactors (no behavior change, just structure).
Link to CDIF_DISCOVERY_SHAPES_FIX.md for Steve-facing explanation.
Next: Refactoring for a “great PR”
Steve’s examples are still only partially working under CDIF Discovery (types are recognized, many properties remain EXTRA), so there is more SHACL/CDIF work to do. However, the following refactors are still worthwhile now and should be behavior-preserving:

- Make `cdi-preview.js` smaller and more readable by splitting into focused modules (done) and doing a second-pass tidy inside the main file.
- Avoid code duplication by centralizing shared helpers (logging, constants, JSON-LD/RDF, SHACL/SPARQL).
- Keep runtime behavior the same (no feature changes), focusing on structure and maintainability.