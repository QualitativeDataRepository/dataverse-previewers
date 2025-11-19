# CDIF Discovery Core Shapes for Browser-Based Validation

## Summary

We've created **cdif-core.ttl**, a browser-compatible implementation of the CDIF Discovery SHACL shapes for validating schema.org Dataset metadata. The shapes validate 20 properties (4 mandatory + 16 recommended) and work with the lightweight Core SHACL validator, avoiding the need for a 1.9MB SPARQL engine.

**Quick start:** Select "CDIF Discovery Core" from the shape dropdown in the previewer to validate your CDIF metadata. Properties conforming to the shapes will display with blue "SHACL-defined" badges.

## Background: CDIF Discovery Validation

CDIF Discovery shapes validate schema.org Dataset descriptions to ensure they contain essential metadata for data discovery. The original CDIF Discovery shapes used SPARQL-based SHACL features (`sh:SPARQLTarget`) for hierarchical node selection.

## How to Use

1. Open the CDI previewer with your JSON-LD file
2. Select **"CDIF Discovery Core"** from the shape dropdown
3. Click "Validate"
4. Review results:
   - Red violations: Missing mandatory properties
   - Orange warnings: Missing recommended properties  
   - Blue badges: SHACL-defined properties present
   - Yellow badges: Extra properties not in shapes

## Testing Notes

**Status:** Ready for testing with CDIF Discovery metadata files

**Expected results:**
- Properties like `name`, `identifier`, `license`, `dateModified` should show blue "SHACL-defined" badges
- Missing mandatory properties trigger red violation messages
- Missing recommended properties trigger orange warning messages

**Known good test:** `examples/cdi/se_na2so4-XDI-CDI-CDIF.jsonld` validates correctly with recognized properties

---

## Technical Reference: Why Core SHACL Only?

## Technical Reference: Why Core SHACL Only?

The CDI previewer uses **Core SHACL only** for validation. SPARQL-based SHACL features like `sh:SPARQLTarget` and `sh:SPARQLConstraint` are not supported.

**Important distinction:** The previewer previously used Comunica for executing `sh:SPARQLTarget` queries to identify which nodes to validate, but Comunica does **not perform SHACL validation** - it only executes SPARQL queries. We have not found a JavaScript SHACL validation library that supports SPARQL constraints (`sh:SPARQLConstraint`).

### Bundle Size Comparison

Browser-based applications have strict constraints on bundle size and performance. Even limited SPARQL support for node targeting would require including a full SPARQL query engine in the browser.

**The numbers:**
- **Current setup (Core SHACL only)**: ~400KB total
  - rdf-validate-shacl: ~120KB (Core SHACL validation only)
  - N3.js (RDF parsing): ~150KB
  - jsonld.js (JSON-LD processing): ~130KB
  
- **Previous setup with Comunica**: ~2.3MB total
  - Comunica QueryEngine: **1.9MB** (for `sh:SPARQLTarget` support only)
  - Plus all the Core SHACL libraries above
  - Still no `sh:SPARQLConstraint` validation support

**What we tried:**
- ✅ Comunica can execute SPARQL queries to find nodes matching `sh:SPARQLTarget`
- ❌ Comunica cannot validate SHACL constraints
- ❌ rdf-validate-shacl (the JavaScript SHACL validator) does not support `sh:SPARQLConstraint`
- ❌ No other JavaScript library found that validates SPARQL-based SHACL constraints

Adding Comunica for `sh:SPARQLTarget` support would **increase the download size by 5-6x**, significantly slowing down the page load for all users, just to support hierarchical node targeting that Core SHACL can approximate.

**Technical reality:**
- SPARQL engines are complex (query parsing, optimization, execution)
- Comunica (the leading JavaScript SPARQL engine) is 1.9MB minified
- SHACL validation with SPARQL constraints requires a different tool
- Most SHACL shape files (including DDI-CDI Official) use Core SHACL only
- Core SHACL provides sufficient expressiveness for validation in most cases

**Our decision:** We removed SPARQL support to keep the previewer fast and lightweight. The 1.9MB cost for hierarchical node selection isn't justified when Core SHACL alternatives work well for real-world use cases.

### Conversion Patterns

### Conversion Patterns

When converting SPARQL-based shapes to Core SHACL, use these patterns:

#### Pattern 1: Node Selection with `sh:targetClass`

**Instead of:**
```turtle
sh:target [
  a sh:SPARQLTarget ;
  sh:select """
    PREFIX schema: <http://schema.org/>
    SELECT DISTINCT ?this WHERE {
      ?this a schema:Dataset .
    }
  """ ;
]
```

**Use:**
```turtle
sh:targetClass schema:Dataset ;
```

This is simpler, more efficient, and functionally equivalent for most cases.

#### Pattern 2: RDF List Validation with `sh:node`

**Instead of:**
```turtle
sh:sparql [
  a sh:SPARQLConstraint ;
  sh:select """
    SELECT $this WHERE {
      $this schema:creator ?list .
      ?list rdf:rest*/rdf:first ?item .
      FILTER NOT EXISTS { ?item a ?type }
    }
  """ ;
]
```

**Use:**
```turtle
# Validate RDF list structure recursively
ex:RDFListOfAgentsShape
  a sh:NodeShape ;
  sh:targetClass rdf:List ;
  sh:property [
    sh:path rdf:first ;
    sh:or (
      [ sh:class schema:Person ]
      [ sh:class schema:Organization ]
    ) ;
  ] ;
  sh:property [
    sh:path rdf:rest ;
    sh:or (
      [ sh:hasValue rdf:nil ]                    # End of list
      [ sh:node ex:RDFListOfAgentsShape ]        # Continue recursively
    )
  ] .
```

This Core SHACL pattern validates lists of any length and works in both browser and server environments.

## CDIF Discovery Core Shapes

We created **cdif-core.ttl** as a browser-compatible alternative to the SPARQL-based CDIF Discovery shapes. This file is available in the previewer as the "CDIF Discovery Core" option.

### What We Converted

**Original CDIF Discovery shapes** (rules.shacl):
- Used `sh:SPARQLTarget` to select nodes hierarchically
- 2 shapes: `CDIFDatasetMandatoryShape` and `CDIFMetaMetadataShape`
- 4 mandatory properties: `identifier`, `name`, `license` or `conditionsOfAccess`, `dateModified`

**Our Core SHACL version** (previewers/betatest/shapes/cdif-core.ttl):
- Converted `sh:SPARQLTarget` to `sh:targetClass schema:Dataset` and `sh:targetSubjectsOf schema:about`
- Added `CDIFDatasetRecommendedShape` with 16 additional properties
- **Total: 20 properties validated:**
  - **4 mandatory (severity: Violation):** `identifier`, `name`, `license`/`conditionsOfAccess`, `dateModified`
  - **16 recommended (severity: Warning):** `url`, `description`, `contributor`, `creator`, `keywords`, `distribution`, `measurementTechnique`, `variableMeasured`, `subjectOf`, `startDate`, `location`, `mainEntity`, `additionalProperty`, `relatedLink`, `additionalType`, `email`

### Key Technical Fixes

1. **Namespace correction:** Used `http://schema.org/` (not `https://`)
   - schema.org's canonical namespace uses http:// protocol
   - This fixed property recognition in the UI (properties now show as "SHACL-defined" instead of "EXTRA")
   - All example files updated to use consistent http:// namespace

2. **Property classification bug fix:** Fixed array context handling in `cdi-shacl-helpers.js`
   - **Problem:** Code only checked `context[prefix]` directly, which failed when `@context` is an array
   - **Solution:** Iterate through array contexts to find prefix mappings
   - **Result:** Properties now correctly classified with blue badges (SHACL-defined) vs yellow badges (EXTRA)

### Trade-offs

**Benefits of Core SHACL approach:**
- ✅ **Fast loading:** ~400KB vs 2.3MB (5-6x smaller)
- ✅ **Enhanced coverage:** Expanded from 4 to 20 properties
- ✅ **Browser compatibility:** Works everywhere without heavyweight dependencies
- ✅ **Maintainability:** Simple, readable SHACL patterns
- ✅ **Validation quality:** Same mandatory property checking

**Limitations compared to SPARQL approach:**
- Direct class targeting (`sh:targetClass schema:Dataset`) instead of hierarchical selection
- Dataset subclasses (e.g., `schema:MedicalDataset`) would need explicit shapes
- In practice: This rarely matters since most files use `schema:Dataset` directly

**Bottom line:** The Core SHACL version provides equivalent validation for real-world use cases while being dramatically faster to load.

## Current Shape Options

The CDI previewer provides four shape selection options:

1. **DDI-CDI Official (Default)** - Full DDI-CDI 1.0 shapes from ddi-cdi.github.io
   - 300+ types covered
   - Core SHACL only (no SPARQL)
   - Comprehensive validation

2. **CDIF Discovery Core** - Browser-compatible CDIF Discovery shapes
   - 20 schema.org properties (4 mandatory + 16 recommended)
   - Converted from SPARQL-based shapes
   - Lightweight and fast

3. **Local Fallback** - Embedded backup shapes
   - Used if online shapes fail to load
   - Core SHACL only

4. **Custom URL** - Load shapes from any URL
   - Must use Core SHACL only
   - SPARQL features will not work
