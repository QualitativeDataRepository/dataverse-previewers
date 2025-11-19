# CDI (Cross-Domain Integration) Previewer

## Overview

The CDI Previewer is a comprehensive viewer and editor for DDI-CDI (Data Documentation Initiative - Cross Domain Integration) metadata stored as JSON-LD. It provides professional-grade features for viewing, editing, and validating complex metadata structures against SHACL shapes.

## Features

### Data Display
- **Complete Data Visibility**: Displays ALL nodes and properties in the JSON-LD `@graph`, regardless of SHACL shape definitions
- **Visual Classification**: Properties are color-coded with badges based on their SHACL status:
  - 🔵 Blue badge "SHACL-defined": Properties defined in loaded SHACL shapes
  - 🟡 Yellow badge "EXTRA": Properties not defined in SHACL shapes
  - Red text: Required properties that are missing
  - Teal border: Modified/changed properties

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
  - Uses [rdf-validate-shacl](https://github.com/zazuko/rdf-validate-shacl) for Core SHACL validation
  - Visual indicators show validation status
  - Detailed validation reports available
  - **Note**: Only Core SHACL features supported (no `sh:SPARQLConstraint`)
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
- **N3.js v1.16.x**: RDF/Turtle parsing for loading SHACL shapes
- **jsonld.js**: JSON-LD normalization, expansion, and RDF conversion
- **rdf-validate-shacl**: Core SHACL validation (no SPARQL support)

### Code Quality
- **Lightweight**: ~400KB total bundle (N3.js ~150KB, jsonld.js ~130KB, rdf-validate-shacl ~120KB)
- **Core SHACL Only**: No SPARQL engine needed, keeping the previewer fast
- **Logging System**: Configurable log levels (ERROR, WARN, INFO, DEBUG) with `?debug=true` URL parameter
- **Production Ready**: Test code removed, debug logging behind feature flag
- **Maintainable**: Separated HTML/CSS/JS structure

### File Structure
```
previewers/betatest/
├── CdiPreview.html          # Main HTML structure
├── css/
│   └── cdi-preview.css      # Styles
├── js/
│   └── cdi-preview/
│       ├── core.js          # Core initialization and config
│       ├── render.js        # UI rendering logic
│       ├── edit.js          # Editing functionality
│       ├── validation.js    # SHACL validation
│       ├── cdi-shacl-loader.js    # Shape loading
│       └── cdi-shacl-helpers.js   # Property classification
└── shapes/
    ├── ddi-cdi-official.ttl      # DDI-CDI official SHACL shapes (fallback)
    └── cdif-core.ttl             # CDIF Discovery Core shapes (local)
```

**Benefits of Split Structure:**
- **Maintainability**: Separate concerns (HTML/CSS/JS)
- **Caching**: Browsers cache static assets independently
- **Readability**: Easier to navigate and debug
- **Modularity**: Similar to other previewers (video.js, preview.css pattern)

## Configuration

### SHACL Shapes Location
The previewer can load SHACL shapes from multiple sources (selectable via dropdown):

1. **DDI-CDI Official (Default)** - `https://ddi-cdi.github.io/m2t-ng/DDI-CDI_1-0/encoding/shacl/ddi-cdi.shacl.ttl`
   - Full DDI-CDI 1.0 class definitions with `sh:targetClass`
   - 300+ types covered
   - Best for full DDI-CDI metadata files

2. **CDIF Discovery Core** - Local built-in shapes (`shapes/cdif-core.ttl`)
   - Browser-compatible Core SHACL shapes for schema.org Dataset validation
   - 20 properties (4 mandatory + 16 recommended)
   - Converted from SPARQL-based shapes to Core SHACL
   - Best for CDIF Discovery metadata files

3. **Local Fallback** - `shapes/ddi-cdi-official.ttl`
   - DDI-CDI official shapes cached locally
   - Used when online shapes unavailable

4. **Custom URL** - User-provided SHACL shape URL
   - Enter any accessible Turtle (.ttl) file URL
   - **Must use Core SHACL only** (no `sh:SPARQLTarget` or `sh:SPARQLConstraint`)

**Recommendation**: Use "DDI-CDI Official" for files with DDI-CDI types. Use "CDIF Discovery Core" for schema.org Dataset validation.

**Important**: Only Core SHACL features are supported. SPARQL-based features like `sh:SPARQLTarget` and `sh:SPARQLConstraint` are not supported. See [CDIF_DISCOVERY_SHAPES_FIX.md](CDIF_DISCOVERY_SHAPES_FIX.md) for conversion patterns.

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

The previewer supports standard Core SHACL targeting mechanisms:

#### sh:targetClass (Standard)
Matches nodes by RDF type:
```turtle
ex:NodeShape
    a sh:NodeShape ;
    sh:targetClass ex:Dataset ;
    sh:property ex:PropertyShape ;
    .
```

#### sh:targetSubjectsOf
Matches nodes that have a specific property:
```turtle
ex:NodeShape
    a sh:NodeShape ;
    sh:targetSubjectsOf schema:about ;
    sh:property ex:PropertyShape ;
    .
```

**Note**: SPARQL-based targets (`sh:SPARQLTarget`) are **not supported**. If you have shapes using SPARQL features, see [CDIF_DISCOVERY_SHAPES_FIX.md](CDIF_DISCOVERY_SHAPES_FIX.md) for Core SHACL conversion patterns.

## Customization

### Styling
Modify `css/cdi-preview.css`:
- `.badge-shacl`: Blue badges for SHACL-defined properties
- `.badge-extra`: Yellow badges for extra properties
- `.changed`: Teal border for modified properties
- `.required-missing`: Red text for missing required properties

### Behavior
Key JavaScript functions:
- `renderData()`: Main render loop (in `render.js`)
- `renderNode()`: Individual node rendering (in `render.js`)
- `renderProperty()`: Property row rendering (in `render.js`)
- `classifyProperty()`: SHACL classification logic (in `cdi-shacl-helpers.js`)
- `validateData()`: SHACL validation (in `validation.js`)
- `addComplexPropertyToNode()`: Create nested objects (in `edit.js`)

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

**Note**: The XAS examples (`se_na2so4` and `FeXAS`) use `schema:Dataset` as their root type and work with both DDI-CDI Official and CDIF Discovery Core shapes.

### Integration Testing
Test with actual Dataverse instance using curl registration:
```bash
curl -X POST -H 'Content-Type: application/json' \
  http://localhost:8080/api/admin/externalTools \
  -d @cdi-preview-tool.json
```

## Known Limitations

1. **SPARQL Features**: `sh:SPARQLTarget` and `sh:SPARQLConstraint` not supported (Core SHACL only)
2. **Controlled Vocabularies**: `sh:in` constraints not yet implemented as dropdowns
3. **Undo/Reset**: No undo functionality (reload page to discard changes)
4. **Password Protection**: Edit mode not locked behind authentication
5. **RDF List Parsing**: `sh:in` lists not fully parsed from RDF
6. **Large Files**: Performance may degrade with 100+ nodes
7. **Namespace Consistency**: SHACL shapes and data should use same namespaces (e.g., both `http://schema.org/`)

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
- Shape loading details
- Property classification logic
- Validation results
- Data structure information

**Example debug output:**
```
DEBUG: Loaded SHACL shapes from cdif-core.ttl
DEBUG: Found 3 node shapes with 20 property shapes
DEBUG: Classifying property 'schema:name' for node xas:dataset1
INFO: Validation complete: 4 violations found
```

---

## Future Enhancements

- [x] Modular code structure with separate files ✅
- [x] Core SHACL validation support ✅
- [x] Property classification with badges ✅
- [ ] Implement controlled vocabulary dropdowns for `sh:in`
- [ ] Add undo/reset functionality
- [ ] Lock edit mode behind API token verification
- [ ] Full RDF list parsing for allowed values
- [ ] Pagination for large datasets (100+ nodes)
- [ ] Diff view showing changes before save
- [ ] Bulk import/export of property values

## Troubleshooting

### Previewer shows blank/white screen
- Check browser console for JavaScript errors
- Verify SHACL shapes file is accessible
- Ensure JSON-LD file is valid

### Properties not showing as SHACL-defined (showing yellow instead of blue)
- Check that shape `sh:targetClass` or `sh:targetSubjectsOf` matches the node's `@type` or properties
- Verify property `sh:path` matches property name in data (check for namespace differences)
- Ensure SHACL file is properly loaded (check network tab)
- **Namespace issues**: Data and shapes must use same namespaces (e.g., both `http://schema.org/` not mixed http/https)
- Enable debug mode (`?debug=true`) to see classification details in console

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
