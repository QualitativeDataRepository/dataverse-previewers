# `cdif_example.jsonld` – Minimal CDIF Discovery Example

This file is a **small, readable CDIF Discovery Core example** that mirrors the way we expect CDIF to be used with `schema.org` datasets and the CDIF Discovery Core SHACL shapes.

It is intended as a reference example for Steve and others when aligning shapes and JSON-LD instance documents.

## Structure

The example has a single `schema:Dataset` node:

- `@id`: a stable HTTPS URI for the dataset.
- `@type`: `schema:Dataset`.
- Core CDIF Discovery properties on the dataset:
  - `schema:name` – title of the dataset.
  - `schema:identifier` – local identifier string.
  - `schema:description` – human-readable description (now explicitly shaped as `cdifd:descriptionProperty`).
  - `schema:creator` – a `schema:Person` with `schema:name`.
  - `schema:datePublished` – ISO8601 date string (YYYY-MM-DD).
  - `schema:license` – IRI for the license.
  - `schema:keywords` – array of strings.
  - `schema:url` – landing page URL.
  - `schema:distribution` – a `schema:DataDownload` with `schema:name`, `schema:contentUrl`, `schema:encodingFormat`.

These correspond directly to CDIF Discovery Core shapes in `CDIF-Discovery-Core-Shapes.ttl`:

- `cdifd:resourceIdentifierProperty` – `schema:identifier`.
- `cdifd:nameProperty` – `schema:name`.
- `cdifd:descriptionProperty` – `schema:description`.
- `cdifd:responsiblePartyProperty` – `schema:creator`.
- `cdifd:datePublishedProperty` – `schema:datePublished`.
- `cdifd:rightsProperty` – `schema:license` (via the `license / conditionsOfAccess` alternative path).
- `cdifd:keywordsResourceProperty` – `schema:keywords`.
- `cdifd:getResourceProperty` – `schema:url` / `schema:distribution`.
- `cdifd:distributionProperty` – `schema:distribution`.

Because the example uses `"schema": "http://schema.org/"` in its `@context`, the expanded IRIs are exactly:

- `http://schema.org/name`
- `http://schema.org/identifier`
- `http://schema.org/description`
- etc.

The CDIF shapes now also use **HTTPS schema.org** consistently, so SPARQL and SHACL can match these predicates exactly.

## How the previewer classifies fields

The CDI Previewer does the following:

1. **Normalize to `@graph`** if needed (here the file already has `@graph`).
2. **Expand JSON-LD** to get full IRIs for properties (`http://schema.org/name`, etc.).
3. **Run SPARQL targets** from CDIF Discovery shapes:
   - The `cdifd:CDIFDatasetRecommendedShape` has a `sh:SPARQLTarget` that selects all `schema:Dataset` instances.
4. **Classify properties** for each dataset node:
   - It finds the applicable NodeShape(s) (e.g. `cdifd:CDIFDatasetRecommendedShape`).
   - For each `sh:property` in that NodeShape, it looks at the `sh:path` and compares it to the expanded property URI.
   - If they match, the field is marked **REQUIRED** (if `sh:minCount > 0`) or **OPTIONAL**; otherwise it is **EXTRA**.

For `cdif_example.jsonld`, all of the core fields listed above show up as **blue** (SHACL-defined) in the previewer, with **REQUIRED** or **OPTIONAL** badges according to the CDIF Discovery shapes.

## How this relates to Steve's examples

Steve's richer CDI/XAS examples (`FeXAS_...jsonld`, `se_na2so4-...jsonld`) use the *same* schema.org properties on a `schema:Dataset` node:

- `schema:name`
- `schema:identifier`
- `schema:description`
- `schema:license`
- `schema:distribution`
- `schema:keywords`
- `schema:variableMeasured`
- `schema:subjectOf` / `dcterms:conformsTo`

The CDIF Discovery Core shapes now:

- Use HTTPS `http://schema.org/` everywhere.
- Select all `schema:Dataset` nodes via SPARQL (no root-only filter).
- Include `cdifd:descriptionProperty` for `schema:description`.
- Include `cdifd:variableMeasuredProperty` in the main dataset NodeShape, so `schema:variableMeasured` is SHACL-defined.

That means the **same properties** that are blue in this minimal example are the ones we would *like* to see as blue on Steve's datasets as well:

- Name, identifier, description, license, keywords, distribution, variableMeasured, etc.

## Feedback for Steve

When updating CDIF Discovery shapes and examples, this file demonstrates a few key points:

1. **Use HTTPS schema.org consistently**
   - In JSON-LD contexts: `"schema": "http://schema.org/"`.
   - In SHACL/Turtle: `@prefix schema: <http://schema.org/> .`
   - In SPARQL and `sh:prefixes`: always `http://schema.org/`.

2. **Don't filter out referenced datasets in SPARQL targets**
   - The original `NOT EXISTS { ?s ?p ?this . }` filter excluded datasets that are referenced elsewhere in the graph (which realistic CDI examples do).
   - Removing this filter lets CDIF Discovery target any `schema:Dataset` node, including those linked via `schema:subjectOf`, `schema:about`, etc.

3. **Model core metadata on the dataset using schema.org keys**
   - `schema:name`, `schema:identifier`, `schema:description`, `schema:license`, `schema:keywords`, `schema:distribution`, `schema:variableMeasured`.
   - These align directly with CDIF Discovery property shapes.

4. **Keep examples readable**
   - This file is intentionally small so people can see, at a glance, which properties CDIF Discovery expects and how they map to the SHACL shapes.

If your shapes and examples follow the same patterns as in `cdif_example.jsonld`, the CDI Previewer (and other SHACL engines) will be able to classify fields reliably as CDIF-defined instead of EXTRA.

### Note on small example fixes

While reviewing Steve's FeXAS example (`FeXAS_Fe_c3d.001-NEXUS-HDF5-cdi-CDIF.jsonld`), we also fixed a minor typo where one nested variable had `schame:alternateName` instead of `schema:alternateName`. This is now corrected so that all `schema:alternateName` occurrences use the proper `schema` prefix, matching the "schema": "http://schema.org/" context above.

We have adjusted the CDIF Discovery shapes and previewer so that Steve's dataset *types* are recognized correctly via SPARQL targets and HTTPS schema.org IRIs. However, some of Steve's dataset properties still show up as EXTRA rather than SHACL-defined. The intention of this example and the shapes is clear, but there is still follow-up work needed to get perfect alignment between the CDIF shapes, the previewer classification logic, and Steve's richer CDI/XAS patterns.
