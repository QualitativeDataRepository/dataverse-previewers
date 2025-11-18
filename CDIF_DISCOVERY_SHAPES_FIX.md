# CDIF Discovery Core Shapes - SPARQL Removal Fix

## The Problem

The CDIF Discovery Core Shapes file originally contained SPARQL-based constraints that are **not supported by the rdf-validate-shacl library** used in the browser-based CDI previewer. This caused validation errors and prevented the shapes from working properly.

## Root Cause

The original CDIF shapes file had two SPARQL components:

1. **`sh:SPARQLTarget`** (line 12-29): Used SPARQL to select which nodes to validate
2. **`sh:SPARQLConstraint`** (line 166-188): Used SPARQL to validate creator/editor/publisher list structure

The rdf-validate-shacl library only supports **Core SHACL** constraints, not SPARQL-based ones. When these SPARQL components were encountered, validation would fail with:

```
Cannot find validator for constraint component SPARQLConstraintComponent
```

## The Solution

We replaced both SPARQL components with equivalent Core SHACL constraints that work in the browser.

### 1. Replaced sh:SPARQLTarget with sh:targetClass

**Before:**
```turtle
sh:target [
  a sh:SPARQLTarget ;
  sh:select """
    PREFIX schema: <https://schema.org/>
    SELECT DISTINCT ?this
    WHERE {
      ?this a schema:Dataset .
    }
  """ ;
]
```

**After:**
```turtle
sh:targetClass schema:Dataset ;
```

This is simpler, more efficient, and functionally equivalent - it targets all nodes of type `schema:Dataset`.

### 2. Replaced sh:SPARQLConstraint with Core SHACL recursive validation

**Before:**
```turtle
cdifd:responsiblePartyNode
  a sh:NodeShape ;
  sh:targetClass schema:Dataset ;
  sh:sparql [
    a sh:SPARQLConstraint ;
    sh:message "All creators, editors, or publishers..." ;
    sh:select """
      SELECT $this WHERE {
        $this schema:creator|schema:editor|schema:publisher ?list .
        ?list rdf:rest*/rdf:first ?item .
        FILTER NOT EXISTS {
          ?item a ?type .
          FILTER(?type IN (schema:Person, schema:Organization))
        }
      }
    """ ;
  ]
```

**After:**
```turtle
cdifd:responsiblePartyProperty
    sh:or (  
        [ sh:class schema:Person ]
        [ sh:class schema:Organization ]
        [ sh:node cdifd:RDFListOfAgentsShape ]  # Core SHACL replacement
    ) ;

# Core SHACL replacement for SPARQLConstraint - validates RDF list items
cdifd:RDFListOfAgentsShape
  a sh:NodeShape ;
  sh:targetClass rdf:List ;
  sh:property [
    sh:path rdf:first ;
    sh:or (
      [ sh:class schema:Person ]
      [ sh:class schema:Organization ]
    ) ;
    sh:message "All items in the creator/editor/publisher list must be schema:Person or schema:Organization" ;
  ] ;
  sh:property [
    sh:path rdf:rest ;
    sh:or (
      [ sh:hasValue rdf:nil ]
      [ sh:node cdifd:RDFListOfAgentsShape ]  # Recursive validation
    )
  ] .
```

This uses Core SHACL's recursive node validation (`sh:node`) to walk through RDF lists, checking that:
- Each `rdf:first` points to a Person or Organization
- Each `rdf:rest` either ends with `rdf:nil` or continues the list

### 3. Updated namespace to HTTPS

As part of the fix, we also ensured the `schema:` prefix uses HTTPS consistently:

```turtle
@prefix schema: <https://schema.org/> .
```

This matches modern schema.org usage and the `@context` in JSON-LD files.

## Files Changed

### `previewers/betatest/shapes/CDIF-Discovery-Core-Shapes.ttl`
- ✅ Changed all `http://schema.org/` to `https://schema.org/`
- ✅ Replaced `sh:SPARQLTarget` with `sh:targetClass schema:Dataset` (line 12)
- ✅ Replaced `sh:SPARQLConstraint` with Core SHACL recursive list validation (`cdifd:RDFListOfAgentsShape`)
- ✅ Updated `cdifd:responsiblePartyProperty` to use `sh:node` for RDF list validation
- ✅ Result: **No SPARQL dependencies** - works entirely with Core SHACL

## How to Test

The CDIF Discovery shapes are available in the CDI previewer. After pushing to GitHub:

1. Visit: **`https://erykkul.github.io/dataverse-previewers/previewers/betatest/CdiPreview.html`**
2. The shapes dropdown includes two CDIF options:
   - "CDIF Discovery Core (Online)" - original version from GitHub (has SPARQL, won't work)
   - "CDIF Discovery Core (Local - Fixed)" - our fixed version (Core SHACL only)
3. Click "Load local file" button
4. Select one of the example files from your local `examples/cdi/` folder:
   - `SimpleSample.jsonld`
   - `se_na2so4-XDI-CDI-CDIF.jsonld`
   - `FeXAS_Fe_c3d.001-NEXUS-HDF5-cdi-CDIF.jsonld`
5. Verify the results match the expected behavior below

## Expected Results

### ✅ With the Fix (Local - Fixed):

- **No SPARQL errors** - validation runs successfully
- Properties that are defined in CDIF shapes show **BLUE badges** (SHACL Defined)
- Properties not in CDIF shapes show **YELLOW badges** (EXTRA - in data but not validated)
- SHACL violations appear in the collapsible "Validation Details" panel
- RDF list validation works correctly for creator/editor/publisher lists

### ❌ Without the Fix (Online version):

- Error message: "The selected SHACL shapes contain SPARQL constraints, which are not supported in the browser"
- Suggestion to use DDI-CDI Official shapes instead
- No validation occurs

## Technical Details

### Why Core SHACL Instead of SPARQL?

The **rdf-validate-shacl** library (used for browser-based validation) only supports Core SHACL constraints. SPARQL-based constraints require a SPARQL engine, which would significantly increase bundle size and complexity.

Core SHACL provides sufficient expressiveness for most validation tasks:
- `sh:targetClass` for node selection (instead of `sh:SPARQLTarget`)
- `sh:node` with recursion for list validation (instead of `sh:SPARQLConstraint`)
- `sh:or`, `sh:class`, `sh:path`, etc. for property constraints

### RDF List Validation Pattern

The recursive pattern we used for validating RDF lists is a standard Core SHACL technique:

```turtle
cdifd:RDFListOfAgentsShape
  a sh:NodeShape ;
  sh:targetClass rdf:List ;
  sh:property [
    sh:path rdf:first ;
    sh:or ( [ sh:class schema:Person ] [ sh:class schema:Organization ] )
  ] ;
  sh:property [
    sh:path rdf:rest ;
    sh:or (
      [ sh:hasValue rdf:nil ]           # End of list
      [ sh:node cdifd:RDFListOfAgentsShape ]  # Continue recursively
    )
  ] .
```

This validates:
1. The `rdf:first` of each list node is a Person or Organization
2. The `rdf:rest` either ends with `rdf:nil` or continues to another list node
3. Recursion handles lists of any length

## For Steve

Hi Steve,

I've fixed the SPARQL constraint issue with the CDIF Discovery shapes. The problem was that your shapes file contained two SPARQL-based components (`sh:SPARQLTarget` and `sh:SPARQLConstraint`) that aren't supported by the rdf-validate-shacl library we use in the browser.

### The Fix

I've created a corrected version at `previewers/betatest/shapes/CDIF-Discovery-Core-Shapes.ttl` that uses **only Core SHACL constraints**. You can test it here:

**`https://erykkul.github.io/dataverse-previewers/previewers/betatest/CdiPreview.html`**

The CDI Preview now has both versions in the dropdown:
- "CDIF Discovery Core (Online)" - original version (has SPARQL, won't work)
- "CDIF Discovery Core (Local - Fixed)" - Core SHACL only (works in browser)

Use the "Load local file" button to test with your example files.

### Changes Made

1. **Replaced `sh:SPARQLTarget`** with `sh:targetClass schema:Dataset`
   - Simpler and functionally equivalent
   - Targets all `schema:Dataset` nodes for validation

2. **Replaced `sh:SPARQLConstraint`** with Core SHACL recursive validation
   - Created `cdifd:RDFListOfAgentsShape` that validates RDF lists
   - Uses `sh:node` recursion to check each list item is Person or Organization
   - Works for lists of any length

3. **Updated to HTTPS**
   - Changed `http://schema.org/` to `https://schema.org/` throughout
   - Matches modern schema.org recommendations

### For Your Official Repository

If you want to make your official shapes file browser-compatible, you can apply the same changes. The key patterns are:

**Node Selection:**
```turtle
# Instead of sh:SPARQLTarget
sh:targetClass schema:Dataset ;
```

**RDF List Validation:**
```turtle
# Instead of sh:SPARQLConstraint for lists
cdifd:RDFListOfAgentsShape
  a sh:NodeShape ;
  sh:targetClass rdf:List ;
  sh:property [
    sh:path rdf:first ;
    sh:or ( [ sh:class schema:Person ] [ sh:class schema:Organization ] )
  ] ;
  sh:property [
    sh:path rdf:rest ;
    sh:or (
      [ sh:hasValue rdf:nil ]
      [ sh:node cdifd:RDFListOfAgentsShape ]  # Recursive
    )
  ] .
```

These Core SHACL patterns work in both browser and server environments, while SPARQL constraints only work where a full SPARQL engine is available.

---

## Summary

✅ **Fixed:** Removed SPARQL dependencies from CDIF Discovery shapes  
✅ **Added:** Core SHACL equivalents for all SPARQL functionality  
✅ **Result:** CDIF shapes now work in browser-based validation  
✅ **Testing:** Available at `https://erykkul.github.io/dataverse-previewers/previewers/betatest/CdiPreview.html`  
✅ **Compatible:** Works with rdf-validate-shacl library (Core SHACL only)
