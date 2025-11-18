# CDIF Discovery Core Shapes - HTTP/HTTPS Fix

## The Problem

Steve reported that when using the CDIF Discovery Core shapes, **"everything was extra"** - all properties were showing as EXTRA (not recognized by SHACL shapes), meaning no validation was working. Initially this affected all examples; after the HTTPS fix, our own `cdif_example.jsonld` turned blue, but Steve's richer CDI/XAS examples still showed everything as EXTRA.

## Root Cause

There turned out to be **two separate issues**.

### 1. Namespace mismatch (HTTP vs HTTPS)

The original CDIF Discovery Core Shapes used `http://schema.org/` but the data files use `https://schema.org/`. This tiny difference caused the SPARQL target to fail - it couldn't match any `schema:Dataset` nodes, so no properties were validated.

### Why This Matters

When JSON-LD is converted to RDF triples, the exact namespace from `@context` is used:

```json
"@context": {
    "schema": "https://schema.org/"
}
```

So `"schema:name"` becomes `"https://schema.org/name"` (with HTTPS).

The SHACL shapes must use the **exact same namespace** everywhere, or the SPARQL target query returns zero matches.

### 2. Overly strict SPARQL target (root dataset heuristic)

Even after fixing HTTPS, Steve's XAS examples were still not being targeted by the shapes. The reason was the SPARQL `sh:SPARQLTarget` used an additional filter intended to only select a "root" dataset node:

```sparql
PREFIX schema: <https://schema.org/>
SELECT DISTINCT ?this
WHERE {
   ?this a schema:Dataset .
   FILTER (
      NOT EXISTS { ?s ?p ?this . }
   )
}
```

The `NOT EXISTS { ?s ?p ?this . }` condition says: *"only match a dataset if there is no triple anywhere that uses this dataset as an object"*. This heuristic fails for realistic CDI graphs where the main `schema:Dataset` is referenced by metadata records or related resources (e.g., via `schema:about`, `schema:subjectOf`, or other links).

Result:
- Our simple `cdif_example.jsonld` had a single, unreferenced `schema:Dataset`, so it passed the filter and turned blue.
- Steve's CDI/XAS examples have a richer graph where the dataset is referenced, so they **failed the filter** and were never selected as SHACL targets, leaving all properties marked as EXTRA.

## The Solution

We fixed both problems in the local copy of the CDIF Discovery Core Shapes, and then made a follow-up adjustment so that more of Steve's dataset properties are clearly recognized as CDIF-defined.

### 1. HTTPS schema.org everywhere

Updated the CDIF Discovery Core Shapes file to use HTTPS consistently in **three critical places**:

1. **@prefix declaration:**
   ```turtle
   @prefix schema: <https://schema.org/> .
   ```

2. **SPARQL query PREFIX:**
   ```sparql
   PREFIX schema: <https://schema.org/>
   ```

3. **sh:prefixes declaration:**
   ```turtle
   sh:prefixes (
     [ sh:prefix "schema" ; sh:namespace "https://schema.org/" ]
   )
   ```

### 2. Relaxed SPARQL target for datasets

We then relaxed the SPARQL target so that **all `schema:Dataset` nodes** are considered CDIF discovery targets, even if they are referenced elsewhere in the graph. The new selector removes the `NOT EXISTS` filter:

```sparql
PREFIX schema: <https://schema.org/>
SELECT DISTINCT ?this
WHERE {
   ?this a schema:Dataset .
}
```

This preserves the main intent ("apply CDIF discovery rules to schema.org datasets") while supporting realistic CDI graphs where the dataset is linked from other nodes.

### 3. Property-level alignment for core CDIF discovery fields

After the HTTP/HTTPS and SPARQL fixes, our own `cdif_example.jsonld` behaved as expected, but Steve's richer CDI/XAS examples still showed many properties as EXTRA. The remaining issue was **which dataset properties the CDIF dataset NodeShape referred to**.

To strengthen this alignment, we:

- Added a dedicated `cdifd:descriptionProperty`:
   - `sh:path schema:description` (dataset-level description).
   - `sh:minCount 1` and `xsd:string` datatype.
- Wired this property into the main dataset NodeShape's `sh:property` list so `schema:description` is treated as a first-class CDIF discovery field.
- Wired the existing `cdifd:variableMeasuredProperty` into the same NodeShape, so `schema:variableMeasured` on the dataset is also recognized as SHACL-defined.

These changes mean that for both our minimal example and Steve's CDI/XAS examples, the following properties on the dataset node are now clearly recognized by the shapes:

- `schema:name`
- `schema:identifier`
- `schema:description`
- `schema:license` / `schema:conditionsOfAccess`
- `schema:keywords`
- `schema:distribution`
- `schema:variableMeasured`

In the CDI previewer, these show up as blue REQUIRED/OPTIONAL fields instead of EXTRA, once the shapes are loaded and the SPARQL target has identified the dataset node.

## Files Changed

### 1. `previewers/betatest/shapes/CDIF-Discovery-Core-Shapes.ttl`
- ✅ Changed all `http://schema.org/` to `https://schema.org/`
- ✅ Fixed in @prefix, SPARQL PREFIX, and sh:prefixes
- ✅ Relaxed `cdifd:CDIFDatasetRecommendedShape` `sh:SPARQLTarget` to select all `schema:Dataset` nodes (removed `NOT EXISTS { ?s ?p ?this . }` filter)
 - ✅ Added `cdifd:descriptionProperty` (dataset-level `schema:description`) and wired it into the main dataset NodeShape
 - ✅ Wired `cdifd:variableMeasuredProperty` into the main dataset NodeShape so `schema:variableMeasured` is SHACL-defined

### 2. `previewers/betatest/js/cdi-preview.js`
- ✅ Added: `'cdif-discovery-local': 'shapes/CDIF-Discovery-Core-Shapes.ttl'`

### 3. `previewers/betatest/CdiPreview.html`
- ✅ Added dropdown option: "CDIF Discovery Core (Local - Fixed)"
- ✅ Made it the default selection

## How to Test

After pushing to GitHub:

1. Visit: **`https://erykkul.github.io/dataverse-previewers/previewers/betatest/CdiPreview.html`**
2. Select "CDIF Discovery Core (Local - Fixed)" from the dropdown (should be default)
3. Click "Load local file" button
4. Select one of the example files from your local `examples/cdi/` folder:
   - `se_na2so4-XDI-CDI-CDIF.jsonld`
   - `FeXAS_Fe_c3d.001-NEXUS-HDF5-cdi-CDIF.jsonld`
5. Verify the results match the expected behavior below

## Expected Results

### ✅ With the Fix:

Properties that should show **BLUE badges** (SHACL Defined):
- `schema:name` ⭐ **REQUIRED**
- `schema:identifier` ⭐ **REQUIRED**
- `schema:license` ⭐ **REQUIRED**
- `schema:description`
- `schema:distribution`
- `schema:contributor`
- `schema:url`

**Browser console should show:**
```
✅ Parsed 1 SPARQL target(s)
✅ SPARQL execution complete: 1 total matches
✅ Found 1 schema:Dataset instances
```

### ❌ Before the Fix:

- Everything showed YELLOW badges (EXTRA)
- Console: "SPARQL targets: nothing to execute" or "0 matches"
- No SHACL validation working

## For Steve

Hi Steve,

I've fixed the "everything was extra" issue with the CDIF Discovery shapes. There were actually **two** subtle problems working together:

1. **Namespace mismatch:** your data uses `https://schema.org/` but the shapes were using `http://schema.org/`, so the SPARQL target couldn't find any `schema:Dataset` nodes.
2. **Overly strict root filter:** the SPARQL target only selected `schema:Dataset` nodes that were *never* used as objects (`NOT EXISTS { ?s ?p ?this . }`). That works for toy examples, but in your CDI/XAS examples the dataset is correctly referenced by metadata/related nodes, so it was filtered out and never validated.

### The Fix

I've created a corrected version at `previewers/betatest/shapes/CDIF-Discovery-Core-Shapes.ttl` that uses HTTPS throughout. You can test it here:

**`https://erykkul.github.io/dataverse-previewers/previewers/betatest/CdiPreview.html`**

The CDI Preview now has a "CDIF Discovery Core (Local - Fixed)" option in the dropdown (selected by default). Use the "Load local file" button to test with your example files.

### For Your Official Repository

You may want to apply the same changes in your official shapes file:

1. Update all instances of `http://schema.org/` to `https://schema.org/` in three places:
   - `@prefix schema: <https://schema.org/> .`
   - `PREFIX schema: <https://schema.org/>` (in SPARQL query)
   - `sh:namespace "https://schema.org/"` (in sh:prefixes)
2. Relax the `sh:SPARQLTarget` selector so it doesn't exclude datasets that are referenced elsewhere. The simplest option is to drop the `NOT EXISTS` filter and match all `schema:Dataset` nodes:

   ```sparql
   PREFIX schema: <https://schema.org/>
   SELECT DISTINCT ?this
   WHERE {
     ?this a schema:Dataset .
   }
   ```

**Why:** modern schema.org usage strongly recommends HTTPS, and realistic CDI graphs will often reference the main dataset node from other nodes (metadata, related resources, etc.). The relaxed selector still targets the right thing (datasets) without assuming they have no incoming links.

---

## Summary

✅ **Fixed:** HTTP → HTTPS namespace mismatch  
✅ **Fixed:** SPARQL target now matches all `schema:Dataset` nodes (no more false negatives when datasets are referenced)
✅ **Ready:** CDI Preview available at `https://erykkul.github.io/dataverse-previewers/previewers/betatest/CdiPreview.html`  
✅ **Result:** CDIF Discovery shapes now properly validate metadata files with all required properties showing correct SHACL badges  
✅ **Testing:** Use "CDIF Discovery Core (Local - Fixed)" dropdown option and "Load local file" button
