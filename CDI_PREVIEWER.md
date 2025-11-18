# CDI (Cross-Domain Integration) Previewer

## Overview

The CDI Previewer is a comprehensive viewer and editor for DDI-CDI (Data Documentation Initiative - Cross Domain Integration) metadata stored as JSON-LD. It provides professional-grade features for viewing, editing, and validating complex metadata structures against SHACL shapes.

## Features

### Data Display
- **Complete Data Visibility**: Displays ALL nodes and properties in the JSON-LD `@graph`, regardless of SHACL shape definitions
- **Visual Classification**: Properties are color-coded and badged based on their SHACL status:
  - 🔵 Blue border + "OPTIONAL" badge: SHACL-defined optional properties
  - 🔴 Red border + "REQUIRED" badge: SHACL-defined required properties (thick border)
  - 🟡 Yellow border + "EXTRA" badge: Properties not defined in SHACL shapes
  - 🔵 Teal border: Modified/changed properties
  - ❌ Red border: Invalid properties (failing SHACL validation)

### Editing Capabilities
- **Smart Input Types**: Automatically selects appropriate input types based on SHACL datatype constraints:
  - `xsd:integer`, `xsd:decimal`, `xsd:float` → number inputs
  - `xsd:date` → date pickers
  - `xsd:dateTime` → datetime inputs
  - `xsd:anyURI` → URL inputs with monospace font
- **Complex Object Support**: Create nested objects directly from the interface:
  - Properties with `sh:node` or `sh:class` constraints show as `[object]` in dropdown
  - Creates new nodes in the `@graph` with proper `@id` and `@type`
  - Automatically links parent property to new node via JSON-LD references
- **Property Management**:
  - Searchable dropdown listing all SHACL-defined properties not yet in the data
  - "Add Custom Property" button for properties outside the SHACL shape
  - Delete buttons for optional properties and array values (required fields protected)
  - Cardinality enforcement: Properties with `sh:maxCount = 1` removed from dropdown after adding

### Validation
- **Real-time SHACL Validation**: 
  - Uses [shacl-engine](https://github.com/jeswr/shacl-engine) for standards-compliant validation
  - Visual indicators show validation status
  - Detailed validation reports available
- **Property Suggestions**: Shows missing SHACL-defined properties with descriptions
- **Constraint Enforcement**: Respects minCount, maxCount, datatype, and pattern constraints

### User Interface
- **Collapsible Nodes**: Click node headers to collapse/expand
- **Search & Filter**: Real-time search across all properties and values with highlighting
- **Bulk Operations**: Collapse All / Expand All buttons
- **Color-Coded Legend**: Visual guide explaining the classification system
- **Tooltips**: Hover help showing property descriptions from SHACL shapes
- **Professional Styling**: Bootstrap-based responsive design

### Data Management
- **Load Local Files**: Standalone mode allows loading JSON-LD files directly from your computer
- **Save to Dataverse**: Direct API integration to save changes back to Dataverse (when launched from Dataverse)
- **Export JSON-LD**: Download modified data as JSON-LD file
- **Change Tracking**: Visual indicators for modified properties
- **View/Edit Modes**: Toggle between viewing and editing

## Technical Architecture

### Libraries Used
- **jQuery 3.7.1**: DOM manipulation and AJAX
- **Bootstrap 3.3.7**: UI components and responsive grid (Dataverse standard)
- **N3.js v1.16.x**: RDF/Turtle parsing for loading SHACL shapes and data conversion
- **jsonld.js**: JSON-LD normalization, expansion, and RDF conversion
- **Comunica v3.2.3**: SPARQL query engine for `sh:SPARQLTarget` support (built locally, ~1.9MB minified)
- **shacl-engine**: Standards-compliant SHACL validation

### Code Quality
- **Standards Compliance**: SPARQL queries execute unmodified per SPARQL 1.1 standards
- **Logging System**: Configurable log levels (ERROR, WARN, INFO, DEBUG) with `?debug=true` URL parameter
- **Production Ready**: Test code removed, debug logging behind feature flag
- **Maintainable**: Separated HTML/CSS/JS structure, ~2,700 lines total

### File Structure
```
previewers/betatest/
├── CdiPreview.html          # Main HTML structure (7.8KB)
├── css/
│   └── cdi-preview.css      # Styles (8.1KB)
├── js/
│   └── cdi-preview.js       # Application logic (129KB)
├── lib/
│   └── comunica-query-sparql.v3.2.3.min.js  # SPARQL engine (1.9MB)
└── shapes/
    └── ddi-cdi-official.ttl  # DDI-CDI official SHACL shapes (fallback)
```

**Benefits of Split Structure:**
- **Maintainability**: Separate concerns (HTML/CSS/JS)
- **Caching**: Browsers cache static assets independently
- **Readability**: Easier to navigate and debug
- **Modularity**: Similar to other previewers (video.js, preview.css pattern)

## Configuration

### SHACL Shapes Location
The previewer can load SHACL shapes from multiple sources (selectable via dropdown):

1. **DDI-CDI 1.0 (Official)** - `https://ddi-cdi.github.io/m2t-ng/DDI-CDI_1-0/encoding/shacl/ddi-cdi.shacl.ttl`
   - Full DDI-CDI class definitions with `sh:targetClass`
   - Best integration with the previewer
   - Works with all CDI types (Activity, DataSet, Variable, etc.)

2. **CDIF Discovery Core** - `https://raw.githubusercontent.com/Cross-Domain-Interoperability-Framework/validation/main/CDIF-Discovery-Core-Shapes.ttl`
   - Cross-domain metadata profile shapes
   - Uses `sh:SPARQLTarget` for root nodes (✅ fully supported)
   - Focuses on schema.org Dataset metadata requirements
   - Property suggestions and SHACL classification work with SPARQL-matched nodes

3. **Local Built-in** - `shapes/ddi-cdi-official.ttl`
   - DDI-CDI official shapes cached locally
   - Fallback when online shapes unavailable
   - Automatically kept in sync with official release

4. **Custom URL** - User-provided SHACL shape URL
   - Enter any accessible Turtle (.ttl) file URL

**Recommendation**: Use "DDI-CDI 1.0 (Official)" for files with DDI-CDI types. Use "CDIF Discovery Core" for schema.org-based metadata. Both shape sources are fully supported with property suggestions and validation.

### Dataverse Integration
The previewer expects these URL parameters:
- `siteUrl`: Dataverse installation base URL
- `fileid`: File ID or path to the JSON-LD file
- `datasetid`: Dataset ID (for saving changes)
- `datasetversion`: Dataset version
- `key`: API key (for authenticated operations)
- `testfile`: (Testing only) Filename in examples/cdi/ directory

### Example URLs
```
# Production use with Dataverse
CdiPreview.html?siteUrl=https://dataverse.example.edu&fileid=123&datasetid=456&datasetversion=1.0

# Standalone mode (no parameters)
https://gdcc.github.io/dataverse-previewers/previewers/betatest/CdiPreview.html
# or
https://erykkul.github.io/dataverse-previewers/previewers/betatest/CdiPreview.html

# Local testing
CdiPreview.html?testfile=SimpleSample.jsonld
```

## Usage Guide

### Standalone Mode (No Dataverse)
1. Open the previewer directly without parameters:
   - GitHub Pages: `https://gdcc.github.io/dataverse-previewers/previewers/betatest/CdiPreview.html`
   - Alternative: `https://erykkul.github.io/dataverse-previewers/previewers/betatest/CdiPreview.html`
2. Click the "Load Local File" button in the toolbar
3. Select a CDI JSON-LD file from your computer
4. The file will be loaded, normalized, and displayed
5. You can edit, validate, and export the data
6. Note: "Save to Dataverse" is disabled in standalone mode (use "Export JSON-LD" instead)

### Viewing Data
1. Load the previewer with a CDI JSON-LD file
2. All nodes from `@graph` are displayed as collapsible cards
3. Properties are color-coded by their SHACL classification
4. Use search box to filter properties
5. Click "Collapse All" / "Expand All" to manage view

### Editing Data
1. Click "Enable Editing" button
2. Modify property values directly in input fields
3. Add new properties:
   - Select from dropdown (SHACL-defined properties)
   - Or click "Add Custom Property" (for extras)
4. Create complex objects:
   - Properties marked `[object]` create new nodes
   - New node scrolls into view automatically
5. Delete optional properties/values using trash icons
6. Required fields cannot be deleted (protected)

### Validation
1. Click "Validate Against SHACL" button
2. View validation results in alert
3. Invalid properties highlighted in red
4. Fix errors and re-validate

### Saving Changes
1. Ensure all required fields are populated
2. Click "Save to Dataverse"
3. Provide API key when prompted
4. Changes saved via Dataverse file replacement API

### Exporting Data
1. Click "Export JSON-LD" button
2. File downloads as `cdi-data.jsonld`
3. Can be re-uploaded to Dataverse manually

## SHACL Shape Requirements

### Supported Target Types

The previewer supports both standard and advanced SHACL targeting mechanisms:

#### 1. **sh:targetClass** (Standard)
Matches nodes by RDF type:
```turtle
ex:NodeShape
    a sh:NodeShape ;
    sh:targetClass ex:Dataset ;
    sh:property ex:PropertyShape ;
    .
```

#### 2. **sh:SPARQLTarget** (Advanced) ✅
Matches nodes using SPARQL SELECT queries:
```turtle
ex:NodeShape
    a sh:NodeShape ;
    sh:target [
        a sh:SPARQLTarget ;
        sh:select """
            PREFIX schema: <https://schema.org/>
            SELECT ?this WHERE {
                ?this a schema:Dataset .
            }
        """ ;
    ] ;
    sh:property ex:PropertyShape ;
    .
```

### SPARQL Target Implementation

**Execution Flow:**

1. **Shape Loading** (`parseSparqlTargets()`)
   - Extracts all `sh:SPARQLTarget` definitions from loaded SHACL shapes
   - Parses `sh:select` query strings from both blank nodes and named nodes
   - Stores mapping: `sparqlTargetCache.queries[shapeUri] = query`

2. **Data Loading** (`jsonLdToN3Store()`)
   - Converts JSON-LD to N-Quads format using jsonld.js
   - Parses N-Quads into N3.Store for RDF querying
   - Store becomes queryable by Comunica SPARQL engine

3. **Query Execution** (`executeSparqlTargets()`)
   - Initializes Comunica QueryEngine on first use
   - Executes all SPARQL SELECT queries in parallel against N3 store
   - Extracts `?this` variable bindings (matched node URIs)
   - Stores results: `sparqlTargetCache.results[shapeUri] = Set<nodeURIs>`
   - Performance: ~60-80ms per dataset, executes once on data load

4. **Property Classification** (`classifyProperty()`)
   - First checks SPARQL target cache for node matches
   - Falls back to `sh:targetClass` matching if no SPARQL match
   - Applies SHACL property constraints from matched shape
   - Returns classification (SHACL-defined vs extra field)

**Key Features:**
- ✅ **Standards Compliant**: SPARQL 1.1 queries executed as-is (no modification)
- ✅ **Performance**: Parallel query execution, results cached
- ✅ **Robust**: Handles both compact (`schema:Dataset`) and expanded URIs (`https://schema.org/Dataset`)
- ✅ **Graceful Fallback**: Falls back to `sh:targetClass` if SPARQL fails
- ✅ **Debug Mode**: Add `?debug=true` to URL to see query execution logs

**Live Example:**
The CDIF Discovery Core shapes use SPARQL targets to match `schema:Dataset` nodes. Load any XAS example file (`se_na2so4-XDI-CDI-CDIF.jsonld` or `FeXAS_Fe_c3d.001-NEXUS-HDF5-cdi-CDIF.jsonld`) with CDIF shapes selected to see SPARQL matching in action.

**Technical Notes:**
- Namespace handling: Data and shapes should use consistent namespaces (e.g., both use `https://schema.org/`)
- Feature flag available: Set `sparqlTargetCache.enabled = false` to disable SPARQL matching
- Logging: Use `?debug=true` URL parameter to see detailed query execution logs

## Customization

### Styling
Modify `css/cdi-preview.css`:
- `.shacl-defined`: Blue properties (in SHACL)
- `.extra-field`: Yellow properties (not in SHACL)
- `.required`: Thick borders for required
- `.changed`: Teal for modified
- `.invalid`: Red for validation errors

### Behavior
Key JavaScript functions in `js/cdi-preview.js`:
- `renderData()`: Main render loop
- `renderNode()`: Individual node rendering  
- `renderProperty()`: Property row rendering
- `classifyProperty()`: SHACL classification logic (checks SPARQL cache then targetClass)
- `executeSparqlTargets()`: Runs SPARQL queries to match nodes to shapes
- `validateData()`: SHACL validation
- `addComplexPropertyToNode()`: Create nested objects

## Testing

### Standalone Testing
1. Open the previewer directly in your browser:
   ```
   https://gdcc.github.io/dataverse-previewers/previewers/betatest/CdiPreview.html
   ```
2. Click "Load Local File" button
3. Select any CDI JSON-LD file from your computer
4. Test editing, validation, and export features

### Local Testing
1. Start a local web server:
   ```bash
   cd dataverse-previewers
   python3 -m http.server 8000
   ```

2. Open the previewer with a test file:
   ```
   http://localhost:8000/previewers/betatest/CdiPreview.html?testfile=SimpleSample.jsonld
   ```

3. Available test files:
   - SimpleSample.jsonld (minimal example)
   - SimpleSample2.jsonld
   - se_na2so4-XDI-CDI-CDIF.jsonld (X-ray spectroscopy, uses schema:Dataset)
   - FeXAS_Fe_c3d.001-NEXUS-HDF5-cdi-CDIF.jsonld (NEXUS HDF5, uses schema:Dataset)
   - ESS11-subset_DDICDI.jsonld (large/complete)

**Note**: The XAS examples (`se_na2so4` and `FeXAS`) use `schema:Dataset` as their root type and work with both DDI-CDI Official and CDIF Discovery Core shapes. When using CDIF shapes, the previewer executes SPARQL queries to match nodes, providing full property suggestions and validation.

### Integration Testing
Test with actual Dataverse instance using curl registration:
```bash
curl -X POST -H 'Content-Type: application/json' \
  http://localhost:8080/api/admin/externalTools \
  -d @cdi-preview-tool.json
```

## Known Limitations

1. **Controlled Vocabularies**: `sh:in` constraints not yet implemented as dropdowns
2. **Undo/Reset**: No undo functionality (reload page to discard changes)
3. **Password Protection**: Edit mode not locked behind authentication
4. **RDF List Parsing**: `sh:in` lists not fully parsed from RDF
5. **Large Files**: Performance may degrade with 100+ nodes
6. **Namespace Consistency**: SHACL shapes and data should use same namespaces (e.g., both `https://schema.org/`)

## Debug Mode

The previewer includes a comprehensive logging system for troubleshooting:

**Enable debug mode** by adding `?debug=true` to the URL:
```
https://example.com/CdiPreview.html?fileid=123&siteUrl=...&debug=true
```

**Log Levels:**
- `ERROR`: Critical errors (always shown)
- `WARN`: Warnings about potential issues (always shown)
- `INFO`: Informational messages like "SPARQL execution complete" (always shown)
- `DEBUG`: Detailed execution logs, query details, node matching (only with `?debug=true`)

**What DEBUG mode shows:**
- SPARQL query execution details
- Node matching results ("✓ Node matched via SPARQL target")
- Property classification logic
- RDF store statistics
- Shape loading details

**Example debug output:**
```
DEBUG: Executing SPARQL for shape https://example.org/shapes#DatasetShape
DEBUG: Created N3 store with 1,234 quads
DEBUG: ✓ Node xas:dataset1 matched via SPARQL target
INFO: SPARQL execution complete: 2 total matches in 64.52ms
```

---

## Future Enhancements

- [x] Support for `sh:SPARQLTarget` in SHACL shapes ✅
- [x] Proper logging system with debug mode ✅
- [x] Standards-compliant SPARQL execution ✅
- [ ] Implement controlled vocabulary dropdowns for `sh:in`
- [ ] Add undo/reset functionality
- [ ] Lock edit mode behind API token verification
- [ ] Full RDF list parsing for allowed values
- [ ] Pagination for large datasets (100+ nodes)
- [ ] Diff view showing changes before save
- [ ] Bulk import/export of property values
- [ ] Namespace auto-detection and harmonization

## Troubleshooting

### Previewer shows blank/white screen
- Check browser console for JavaScript errors
- Verify SHACL shapes file is accessible
- Ensure JSON-LD file is valid

### Properties not showing as SHACL-defined (showing yellow instead of blue)
- **For sh:targetClass shapes**: Check that shape `sh:targetClass` matches the node's `@type`
- **For sh:SPARQLTarget shapes**: Enable debug mode (`?debug=true`) and check console for:
  - "SPARQL execution complete: N total matches" - should show >0 matches
  - "✓ Node {id} matched via SPARQL target" - confirms node was matched
  - If no matches, verify SPARQL query syntax and namespace consistency
- Verify property `sh:path` matches property name in data (check for namespace differences)
- Ensure SHACL file is properly loaded (check network tab)
- **Namespace issues**: Data and shapes must use same namespaces (e.g., both `https://schema.org/` not mixed http/https)

### Validation fails with no details
- Check SHACL shapes syntax in Turtle validator
- Verify node types match shape target classes
- Look for console errors during validation

### Cannot save to Dataverse
- Verify API key is valid and not expired
- Check dataset ID and version are correct
- Ensure user has edit permissions on dataset
- Verify Dataverse API endpoint is accessible

## Support

For issues, questions, or contributions:
- GitHub: [gdcc/dataverse-previewers](https://github.com/gdcc/dataverse-previewers)
- Email: dataverse-dev@googlegroups.com

## License

MIT License - See LICENSE file in repository root
