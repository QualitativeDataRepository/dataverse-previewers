# Why the CDI Previewer Doesn't Support SPARQL

## Overview

The CDI previewer uses **Core SHACL only** for validation. SPARQL-based SHACL features like `sh:SPARQLTarget` and `sh:SPARQLConstraint` are not supported in the browser-based application.

## Technical Details

Browser-based applications have strict constraints on bundle size and performance. Supporting SPARQL features like `sh:SPARQLTarget` and `sh:SPARQLConstraint` would require including a full SPARQL query engine in the browser.

**The numbers:**
- **Current setup (Core SHACL only)**: ~400KB total
  - rdf-validate-shacl: ~120KB
  - N3.js (RDF parsing): ~150KB
  - jsonld.js (JSON-LD processing): ~130KB
  
- **With SPARQL support**: ~2.3MB total
  - Comunica QueryEngine: **1.9MB** (just for SPARQL!)
  - Plus all the Core SHACL libraries above

Adding SPARQL would **increase the download size by 5-6x**, significantly slowing down the page load for all users, just to support a niche feature that Core SHACL can handle equally well.

**Technical reality:**
- SPARQL engines are complex (query parsing, optimization, execution)
- Comunica (the leading JavaScript SPARQL engine) is 1.9MB minified
- Most SHACL shape files (including DDI-CDI Official) use Core SHACL only
- Core SHACL provides sufficient expressiveness for validation

**Our decision:** We've removed SPARQL support from the CDI previewer to keep it fast and lightweight for all users.

## Core SHACL Alternatives to SPARQL Features

If you have SHACL shapes that use SPARQL features, here are the Core SHACL patterns that achieve the same goals:

### 1. Node Selection: Use `sh:targetClass` instead of `sh:SPARQLTarget`

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

This is simpler, more efficient, and functionally equivalent.

### 2. RDF List Validation: Use `sh:node` with recursion instead of `sh:SPARQLConstraint`

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

## Current Shape Options

The CDI previewer provides three shape selection options:

1. **DDI-CDI Official (Default)** - Full DDI-CDI 1.0 shapes from ddi-cdi.github.io
   - 300+ types covered
   - Core SHACL only (no SPARQL)
   - Comprehensive validation

2. **Local Fallback** - Embedded backup shapes
   - Used if online shapes fail to load
   - Core SHACL only

3. **Custom URL** - Load shapes from any URL
   - Must use Core SHACL only
   - SPARQL features will not work
