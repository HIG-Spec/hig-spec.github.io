# Material specifications

Readers access shared materials at `/#/materials/liquid-glass` and component-local effects in each component's **材质** section. JSON, Markdown and Rust exports include material records and their source provenance.

## Snapshots

| Platform     | File                         | SHA-256                                                            |
| ------------ | ---------------------------- | ------------------------------------------------------------------ |
| iOS / iPadOS | Apple iOS 27 UI Kit.sketch   | `465512cb7d9fa591844c32cda133c52ea2e69a143d7cfbb958d5b3ef180b948c` |
| macOS        | Apple macOS 27 UI Kit.sketch | `8f83805217d979dc560d008fce66c1c77014f631cccff8978f31baf1d7ef3b28` |

The geometry contains 6,536 definitions grouped into 36 families. The material snapshot contains 38 shared Liquid Glass catalogue records, 14 supporting shared styles, 214 distinct effect recipes and 2,043 directly bound effect-bearing layers in 1,398 definitions. Effect-bearing layers include ordinary blur/shadow/border support layers: **2,043 is not a count of glass surfaces**.

Names are not primary keys. Both macOS styles named `Liquid Glass/Light/Regular - Small - Tinted` remain distinct by source ID. The iOS Light/Medium blur value of 15 and macOS value of 30 are retained separately.

## Retained data

Full raw objects for `blurs`, legacy `blur`, `fills`, `shadows`, `innerShadows`, `borders`, `contextSettings`, `colorControls` and `borderOptions` remain inspectable. Enabled flags, array order, exact numeric values, gradients and source blend-mode integers are retained. Missing, disabled and zero are distinct states. There is no inferred paint ordering between separate source arrays.

Local serialized styles take precedence over the linked shared preset. Nested `symbolID`, `isVisible`, `layerStyle` and supported explicit color replacements are scoped to their own instance; outer overrides win. Unknown replacements and missing references are reported rather than guessed. Selecting an opaque idle component does not imply that its pressed state lacks glass.

The extractor includes glass layers **and** surrounding effect layers. This restores the Gaussian blur and mixed borders around switch thumbs that were omitted by the old glass-only filter. Original shared material records and the geometry snapshot remain unchanged.

## Format and verification

`public/data/geometry.json.gz` and `materials.json.gz` are independently hashed in `manifest.json`. Material bindings reference component and preorder node indices in that exact geometry snapshot. `store.ts` verifies bytes and source identities before resolving references. JSON exports expand compact indices into source IDs, paths, records and instance chains.

- `styles`: platform, ID, name, source pointer and recipe index.
- `recipes`: deduplicated complete material objects.
- `bindings`: component index → `[nodeIndex, recipeIndex, sharedStyleIndexOrNull]`.
- `sources`: source filenames, versions and SHA-256.

`tools/verify-sources.py` reconstructs the snapshot and checks every bound layer against the original Sketch archive. The standard CI regression suite checks the distributed snapshots without needing or redistributing those archives.

Renderer-specific mappings are in [rendering.md](rendering.md), not stored as official source values.
