Goals
Make cdi-preview.js clean, robust, and reviewer-friendly.
Ensure all core features work reliably:
View and edit modes (including property suggestions).
Saving back to Dataverse (unchanged → equivalent file, changed → only intentional diffs).
Export JSON-LD with correct MIME type.
SHACL classification and filters (especially CDIF Discovery with Steve’s examples).
Fix CDIF Discovery shapes/previewer behavior so Steve’s examples show blue for CDIF-defined properties, not only for the schema:Dataset type badges.
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
Phase 2 – SHACL / CDIF Discovery correctness (Steve’s examples)
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
Optional file split (if you want to go that far)

 Plan a minimal, non-bundler split:
js/cdi-consts.js – URIs, logging, globals.
js/cdi-shacl.js – shape parsing, SPARQL targets, classifyProperty, getPropertySuggestions, getAvailableNodeTypes.
js/cdi-jsonld.js – normalization, expansion, N3 conversion.
js/cdi-ui.js – render, event handlers, search/filter, highlight.
 Use a simple global namespace (window.CDI = { ... }) to avoid tooling changes.
 Update CdiPreview.html to load scripts in the right order.
 Re-run all tests from Phase 1 and 2 to ensure no behavior changes.
PR polish

 Keep commit history clean:
Bug fix commits separate from refactor commits.
TTL changes and JS changes separated for clarity.
 In PR description:
Summarize functional fixes (Steve’s examples, edit mode).
Summarize refactors (no behavior change, just structure).
Link to CDIF_DISCOVERY_SHAPES_FIX.md for Steve-facing explanation.
Next: Fixing Steve’s examples showing as EXTRA
Given your latest observation:

With SHACL-only filter on, you see:
The dataset node xas:485749 with blue type badges for schema:Dataset and schema:Product.
But no properties under it; everything else still classified as EXTRA when the filter is off.
This tells us:

The SPARQL target + sh:targetClass matching is working:
We’re correctly treating xas:485749 as a CDIF dataset node.
The property-level classification is failing:
classifyProperty is not finding the CDIF property shapes for things like schema:name, schema:identifier, schema:license, etc., when applied to this node.
Given that:

First, I’ll align how CDIF property sh:path IRIs relate to the actual JSON-LD keys in Steve’s files (very likely a path naming mismatch).
If possible, I’ll fix that purely in CDIF-Discovery-Core-Shapes.ttl so Steve doesn’t have to change his data.
If the shapes are already correct but encoded in a way our heuristic doesn’t handle, I’ll minimally improve classifyProperty’s matching logic (without broad changes) so CDIF-style sh:path URIs map to Steve’s schema:* properties.
Once that’s done, Steve’s dataset node should show:

Blue REQUIRED/OPTIONAL badges for the expected CDIF discovery fields, and
The SHACL-only filter should leave those properties visible, not just an “empty” node with type badges.