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
- **N3.js**: RDF/Turtle parsing for loading SHACL shapes
- **shacl-engine**: Standards-compliant SHACL validation

### File Structure
```
previewers/betatest/
├── CdiPreview.html          # Main previewer (self-contained)
└── shapes/
    └── CDIF-Discovery-Core-Shapes.ttl  # SHACL shapes
```

## Configuration

### SHACL Shapes Location
The previewer loads SHACL shapes from:
```
shapes/CDIF-Discovery-Core-Shapes.ttl
```

Update this file to modify validation rules, required fields, data types, and property definitions.

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

The previewer expects SHACL shapes to include:

```turtle
# Example property shape
ex:PropertyShape
    a sh:PropertyShape ;
    sh:path ex:propertyName ;
    sh:name "Human Readable Name" ;
    sh:description "Help text for users" ;
    sh:datatype xsd:string ;
    sh:minCount 0 ;  # 0 = optional, 1+ = required
    sh:maxCount 1 ;  # 1 = single value, omit for multiple
    sh:node ex:ComplexObjectShape ;  # For nested objects
    sh:class ex:ClassName ;  # Object type for nested objects
    .

# Target specific classes
ex:NodeShape
    a sh:NodeShape ;
    sh:targetClass ex:Dataset ;
    sh:property ex:PropertyShape ;
    .
```

## Customization

### Styling
Modify the `<style>` section in `CdiPreview.html`:
- `.shacl-defined`: Blue properties (in SHACL)
- `.extra-field`: Yellow properties (not in SHACL)
- `.required`: Thick borders for required
- `.changed`: Teal for modified
- `.invalid`: Red for validation errors

### Behavior
Key JavaScript functions:
- `renderData()`: Main render loop
- `renderNode()`: Individual node rendering
- `renderProperty()`: Property row rendering
- `classifyProperty()`: SHACL classification logic
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
   - se_na2so4-XDI-CDI-CDIF.jsonld (X-ray spectroscopy)
   - FeXAS_Fe_c3d.001-NEXUS-HDF5-cdi-CDIF.jsonld (NEXUS)
   - ESS11-subset_DDICDI.jsonld (large/complete)

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

## Future Enhancements

- [ ] Implement controlled vocabulary dropdowns for `sh:in`
- [ ] Add undo/reset functionality
- [ ] Lock edit mode behind API token verification
- [ ] Full RDF list parsing for allowed values
- [ ] Pagination for large datasets
- [ ] Diff view showing changes before save
- [ ] Bulk import/export of property values

## Troubleshooting

### Previewer shows blank/white screen
- Check browser console for JavaScript errors
- Verify SHACL shapes file is accessible
- Ensure JSON-LD file is valid

### Properties not showing as SHACL-defined
- Check that SHACL shape uses `sh:targetClass` matching the node's `@type`
- Verify property `sh:path` matches property name in data
- Ensure SHACL file is properly loaded (check network tab)

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
