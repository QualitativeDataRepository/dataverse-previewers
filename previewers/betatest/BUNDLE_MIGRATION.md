# CDI Previewer - Bundle Integration

## Changes Made (November 2025)

### ✅ Migrated to Single Bundle Architecture

**What changed:**
- Replaced 10+ individual JavaScript files with a single optimized bundle
- Updated to use custom shacl-engine with SPARQL target support
- Simplified HTML file to use single script tag

### 📦 New Files

1. **`lib/cdi-viewer.bundle.min.js`** (1.2 MB)
   - Complete CDI viewer application
   - Includes: N3.js, JSON-LD library, shacl-engine (with SPARQL targets)
   - Minified and optimized for production
   - Expects jQuery and Bootstrap to be loaded externally

2. **`shapes/cdif-core.ttl`** (Updated)
   - CDIF Discovery shapes with SPARQL target support
   - Validates only root-level datasets (not nested ones)
   - Uses `sh:SPARQLTarget` for advanced node selection

3. **`css/cdi-preview.css`** (Updated)
   - Latest styling for the viewer

4. **`test-cdi-bundle.html`**
   - Test page to verify bundle loads correctly
   - Can test with example CDI files

### 🗑️ Removed Files

- `js/cdi-preview/` folder (10 files) - now bundled
- `lib/rdf-validate-shacl.bundle.min.js` - replaced with shacl-engine

### 📝 Modified Files

- **`CdiPreview.html`**
  - Removed individual script tags
  - Added single `<script src="lib/cdi-viewer.bundle.min.js"></script>`
  - Removed external CDN links for N3.js and JSON-LD (now bundled)

## How to Update the Bundle

When the cdi-viewer source is updated:

```bash
# Build in cdi-viewer project
cd /path/to/cdi-viewer
npm run build

# Copy to dataverse-previewers
cp dist/cdi-viewer.bundle.js /path/to/dataverse-previewers/previewers/betatest/lib/cdi-viewer.bundle.min.js

# Copy updated shapes if changed
cp shapes/cdif-core.ttl /path/to/dataverse-previewers/previewers/betatest/shapes/cdif-core.ttl

# Copy CSS if changed
cp css/cdi-preview.css /path/to/dataverse-previewers/previewers/betatest/css/cdi-preview.css
```

## Testing

1. **Test page:** Open `test-cdi-bundle.html` in a browser
2. **Full previewer:** Open `CdiPreview.html` with a CDI JSON-LD file
3. **With Dataverse:** Test with `?fileUrl=...` or `?fileid=...&siteUrl=...` parameters

## Key Features Now Available

✅ **SPARQL Target Support** - Validates only root datasets using SPARQL queries
✅ **Property Recognition** - Blue badges for SHACL-defined properties
✅ **Faster Loading** - Single bundle, fewer HTTP requests
✅ **Offline Capable** - No external CDN dependencies for core functionality
✅ **Easier Deployment** - Just copy one bundle file

## Bundle Contents

The `cdi-viewer.bundle.min.js` includes:

- **JSON-LD processor** - For expanding/compacting JSON-LD
- **N3.js parser** - For parsing Turtle SHACL shapes
- **shacl-engine** - Modified version with SPARQL target support
- **All viewer modules** - Validation, rendering, editing, suggestions
- **RDF utilities** - Dataset manipulation, term handling

**External dependencies (not bundled):**
- jQuery 3.6.0
- Bootstrap 3.3.7

These must be loaded before the bundle.

## Size Comparison

**Before:**
- 10 individual JS files: ~200 KB (uncompressed)
- External CDN dependencies: ~300 KB (N3.js + JSON-LD)
- rdf-validate-shacl: ~800 KB
- **Total:** ~1.3 MB + HTTP overhead (12 requests)

**After:**
- 1 bundle: 1.2 MB
- **Total:** 1.2 MB (1 request)

**Benefits:**
- Fewer HTTP requests → faster loading
- No CDN dependencies → works offline
- All code versioned together → easier updates

## Troubleshooting

### Bundle doesn't load
- Check browser console for errors
- Verify jQuery and Bootstrap are loaded first
- Check file path is correct: `lib/cdi-viewer.bundle.min.js`

### Validation doesn't work
- Check if SHACL shapes file exists: `shapes/cdif-core.ttl`
- Verify network requests show shapes loading successfully
- Check console for SPARQL target execution logs

### Properties show as "EXTRA" instead of "SHACL-defined"
- Verify namespace in JSON-LD matches shapes (http:// not https://)
- Check if shape has `sh:targetClass` or `sh:target` for the node type
- Enable debug logging to see shape matching details
