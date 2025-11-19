# Comunica & SHACL Shapes - Complete Explanation

## 1. What is Comunica? (The 1.9MB Library)

**Comunica QueryEngine** (`comunica-query-sparql.v3.2.3.min.js`) is a JavaScript SPARQL query engine that runs in the browser.

### What it DOES:
- ✅ Executes SPARQL 1.1 queries against RDF data
- ✅ Supports `sh:SPARQLTarget` in SHACL shapes
- ✅ Caches which nodes match SPARQL target queries
- ✅ Used ONLY for UI badge classification (BLUE vs YELLOW)

### What it DOES NOT do:
- ❌ No validation capabilities
- ❌ No SHACL constraint checking
- ❌ No `sh:SPARQLConstraint` support for validation
- ❌ Not used for actual data validation

### Current Usage in Your Code:
```javascript
// In cdi-shacl-sparql.js
async function executeSparqlTargets() {
  // 1. Parse data to RDF triples
  const dataStore = await jsonLdToN3Store(jsonData);
  
  // 2. Execute SPARQL queries from shapes
  const bindingsStream = await comunicaEngine.queryBindings(query, {
    sources: [dataStore]
  });
  
  // 3. Cache which nodes matched
  sparqlTargetCache.results[shapeUri] = matchedNodes;
}
```

**Purpose:** When shapes use `sh:SPARQLTarget` instead of `sh:targetClass`, Comunica runs the SPARQL query to find matching nodes, then UI shows BLUE badges for properties of those nodes.

---

## 2. What Does Validation?

**`rdf-validate-shacl`** library does ALL validation:
- ✅ Validates data against SHACL shapes
- ✅ Supports Core SHACL constraints (sh:minCount, sh:maxCount, sh:datatype, etc.)
- ✅ Returns validation reports
- ❌ Does NOT support `sh:SPARQLTarget` (ignores them)
- ❌ Does NOT support `sh:SPARQLConstraint` (throws error if present)

So you have TWO separate libraries:
1. **Comunica** = SPARQL query execution (for finding target nodes)
2. **rdf-validate-shacl** = SHACL validation (checking constraints)

---

## 3. Available SHACL Shape Options

Your app has 4 shape sources (see `SHAPE_URLS` in `core.js`):

| Shape Source | URL | Purpose | Coverage |
|-------------|-----|---------|----------|
| **ddi-cdi-official** ⭐ | `https://ddi-cdi.github.io/.../ddi-cdi.shacl.ttl` | Full DDI-CDI 1.0 shapes | ALL DDI-CDI classes |
| **cdif-discovery** | `https://raw.githubusercontent.com/.../CDIF-Discovery-Core-Shapes.ttl` | Minimal discovery shapes | Dataset, Person, Org only |
| **cdif-discovery-local** | `shapes/CDIF-Discovery-Core-Shapes.ttl` | Local copy (Core SHACL only) | Dataset, Person, Org only |
| **local-fallback** | `shapes/ddi-cdi-official.ttl` | Local copy of full shapes | ALL DDI-CDI classes |

**Default:** `ddi-cdi-official` (selected in dropdown)

---

## 4. Why "Everything Shows as EXTRA"

When you select **"CDIF Discovery Core"** shapes:

### What's Included (5 types):
- ✅ `schema:Dataset`
- ✅ `schema:Person`
- ✅ `schema:Organization`
- ✅ `schema:Role`
- ✅ `rdf:List`

### What's Missing (everything else):
- ❌ `schema:Product`
- ❌ `schema:PropertyValue`
- ❌ `schema:DefinedTerm`
- ❌ `schema:Place`
- ❌ `schema:Thing`
- ❌ All `ddi:*` classes (PhysicalDataSet, InstanceVariable, etc.)
- ❌ All custom domain classes (`cdi4exas:*`, etc.)

**Result:** Anything not in those 5 types shows as EXTRA (yellow badge) because there's no shape to validate against.

---

## 5. Discovery Shapes vs Full Shapes

### CDIF Discovery Shapes (Minimal)
**Purpose:** Extract core metadata for discovery/indexing in Dataverse

**Design:** Intentionally minimal to:
- Reduce file size (~50KB vs 5MB)
- Focus on Dublin Core-like discovery metadata
- Fast loading for Dataverse integration
- Support basic dataset, creator, contributor info

**Use Case:** Dataverse harvesting metadata from deposited files

### DDI-CDI Official Shapes (Complete)
**Purpose:** Full validation of CDI 1.0 documents

**Design:** Comprehensive coverage:
- All DDI-CDI 1.0 classes (~300+ types)
- Complete property constraints
- Complex relationship validation
- Full specification compliance

**Use Case:** CDI document authoring, validation, quality checking

---

## 6. Can You Remove Comunica?

### Current State:
- Local CDIF Discovery shapes = Core SHACL only (no `sh:SPARQLTarget`)
- Online CDIF Discovery shapes = Has `sh:SPARQLTarget` (needs Comunica)
- DDI-CDI Official shapes = Unknown (need to check)

### To Remove Comunica (1.9MB savings):

**Option A: Use Core SHACL shapes only**
```javascript
// Set this flag in core.js
sparqlTargetCache.enabled = false;
```
Then remove:
- `lib/comunica-query-sparql.v3.2.3.min.js`
- `executeSparqlTargets()` function
- SPARQL-related code in `cdi-shacl-sparql.js`

**Option B: Keep for online shapes**
- Keep Comunica if users load online CDIF Discovery shapes
- Use conditionally: only load if shape has SPARQLTarget
- Lazy-load the library when needed

---

## 7. How to Load Missing Types

### Quick Fix: Use Full DDI-CDI Shapes
Your app already defaults to this! Just make sure it's selected:

```html
<select id="shape-selector">
  <option value="ddi-cdi-official" selected>DDI-CDI 1.0 (Official)</option>
  ...
</select>
```

### Add Custom Schema.org Shapes
If you need shapes for `schema:Product`, `schema:PropertyValue`, etc., create a new shape file:

```turtle
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix schema: <http://schema.org/> .

schema:ProductShape a sh:NodeShape ;
    sh:targetClass schema:Product ;
    sh:property [
        sh:path schema:name ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
    ] ;
    sh:property [
        sh:path schema:description ;
        sh:datatype xsd:string ;
    ] .

schema:PropertyValueShape a sh:NodeShape ;
    sh:targetClass schema:PropertyValue ;
    sh:property [
        sh:path schema:name ;
        sh:minCount 1 ;
    ] ;
    sh:property [
        sh:path schema:value ;
        sh:minCount 1 ;
    ] .
```

Then add to `SHAPE_URLS`:
```javascript
"schema-org-extended": "shapes/schema-org-extended.ttl"
```

---

## 8. Recommendations

### For Production Use:

**Option 1: Full DDI-CDI Shapes (Current Default) ✅**
- Use `ddi-cdi-official` 
- Covers all DDI-CDI types
- Complete validation
- Larger file size (~5MB) but comprehensive

**Option 2: Discovery + Full Combo**
- Use CDIF Discovery for Dataverse integration
- Use DDI-CDI Official for full document editing
- Let users switch based on use case

**Option 3: Remove Comunica**
- If no shapes use `sh:SPARQLTarget`, remove Comunica
- Save 1.9MB bundle size
- Lose online CDIF Discovery shape support (but local works)

### My Recommendation:
1. ✅ **Keep default as `ddi-cdi-official`** (you already do this)
2. ✅ **Remove Comunica** if DDI-CDI Official shapes don't use SPARQLTarget
3. ✅ **Keep Discovery shapes as option** for lightweight Dataverse use
4. ✅ **Document the difference** between Discovery vs Full shapes

---

## 9. Action Items

### To Verify:
```bash
# Check if DDI-CDI Official shapes use SPARQLTarget
curl -s "https://ddi-cdi.github.io/m2t-ng/DDI-CDI_1-0/encoding/shacl/ddi-cdi.shacl.ttl" | grep -i sparqltarget
```

If no SPARQLTarget found → **Remove Comunica safely**

### To Remove Comunica:
1. Set `sparqlTargetCache.enabled = false` in `core.js`
2. Remove script tag from `CdiPreview.html`:
   ```html
   <!-- DELETE THIS LINE -->
   <script src="lib/comunica-query-sparql.v3.2.3.min.js"></script>
   ```
3. Remove unused functions from `cdi-shacl-sparql.js`:
   - `executeSparqlTargets()`
   - `jsonLdToN3Store()`
4. Remove SPARQL cache checks from:
   - `cdi-shacl-helpers.js` (lines 141-161)
   - `property-suggestions.js` (lines 14-24)

**Savings:** ~1.9MB minified JavaScript

---

## Summary

| Library | Size | Purpose | Can Remove? |
|---------|------|---------|-------------|
| **Comunica** | 1.9MB | Execute SPARQL queries for `sh:SPARQLTarget` | ✅ Yes, if no SPARQLTarget in shapes |
| **rdf-validate-shacl** | ~100KB | Validate data against SHACL shapes | ❌ No, core validation |
| **N3.js** | ~200KB | Parse RDF Turtle/N-Quads | ❌ No, needed for shapes |
| **jsonld.js** | ~100KB | Process JSON-LD context | ❌ No, needed for data |

**Total Potential Savings:** 1.9MB (if Comunica removed)
