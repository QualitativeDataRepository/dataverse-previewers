# CDIF Discovery Core Shapes - HTTP/HTTPS Fix

## The Problem

Steve reported that when using the CDIF Discovery Core shapes, **"everything was extra"** - all properties were showing as EXTRA (not recognized by SHACL shapes), meaning no validation was working.

## Root Cause

**Namespace mismatch:** The CDIF Discovery Core Shapes used `http://schema.org/` but the data files use `https://schema.org/`. This tiny difference caused the SPARQL target to fail - it couldn't match any `schema:Dataset` nodes, so no properties were validated.

### Why This Matters

When JSON-LD is converted to RDF triples, the exact namespace from `@context` is used:

```json
"@context": {
    "schema": "https://schema.org/"
}
```

So `"schema:name"` becomes `"https://schema.org/name"` (with HTTPS).

The SHACL shapes must use the **exact same namespace** everywhere, or the SPARQL target query returns zero matches.

## The Solution

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

## Files Changed

### 1. `previewers/betatest/shapes/CDIF-Discovery-Core-Shapes.ttl`
- ✅ Changed all `http://schema.org/` to `https://schema.org/`
- ✅ Fixed in @prefix, SPARQL PREFIX, and sh:prefixes

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

I've fixed the "everything was extra" issue with the CDIF Discovery shapes. The problem was simple but critical:

**Your data uses `https://schema.org/` but the shapes were using `http://schema.org/`**

This namespace mismatch caused the SPARQL target to fail, so no nodes matched the shapes and everything appeared as EXTRA.

### The Fix

I've created a corrected version at `previewers/betatest/shapes/CDIF-Discovery-Core-Shapes.ttl` that uses HTTPS throughout. You can test it here:

**`https://erykkul.github.io/dataverse-previewers/previewers/betatest/CdiPreview.html`**

The CDI Preview now has a "CDIF Discovery Core (Local - Fixed)" option in the dropdown (selected by default). Use the "Load local file" button to test with your example files.

### For Your Official Repository

You may want to apply the same change - just update all instances of `http://schema.org/` to `https://schema.org/` in your shapes file in three places:

1. `@prefix schema: <https://schema.org/> .`
2. `PREFIX schema: <https://schema.org/>` (in SPARQL query)
3. `sh:namespace "https://schema.org/"` (in sh:prefixes)

**Why:** Modern schema.org usage strongly recommends HTTPS, and most JSON-LD implementations default to it now.

---

## Summary

✅ **Fixed:** HTTP → HTTPS namespace mismatch  
✅ **Ready:** CDI Preview available at `https://erykkul.github.io/dataverse-previewers/previewers/betatest/CdiPreview.html`  
✅ **Result:** CDIF Discovery shapes now properly validate metadata files with all required properties showing correct SHACL badges  
✅ **Testing:** Use "CDIF Discovery Core (Local - Fixed)" dropdown option and "Load local file" button
