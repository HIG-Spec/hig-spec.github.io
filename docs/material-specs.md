# Material parameter specifications

The Liquid Glass reference is at `/#/materials/liquid-glass`. Every component's Specs tab also has a **材质与液态玻璃** section, and component JSON / Markdown exports include material records.

This adds source parameters to the specifications. It neither implements a glass shader nor changes the geometry preview or the original compressed geometry measurements.

## Source snapshots

| Platform | File | SHA-256 |
| --- | --- | --- |
| iOS / iPadOS | Apple iOS 27 UI Kit.sketch | `465512cb7d9fa591844c32cda133c52ea2e69a143d7cfbb958d5b3ef180b948c` |
| macOS | Apple macOS 27 UI Kit.sketch | `8f83805217d979dc560d008fce66c1c77014f631cccff8978f31baf1d7ef3b28` |

38 shared Liquid Glass style records are included (19 per platform). Names are not primary keys: the macOS file has two different IDs named `Liquid Glass/Light/Regular - Small - Tinted`, and both remain accessible. Another 14 non-glass shared styles are retained only to resolve explicit `layerStyle` replacements correctly.

814 material-bearing source layers in 727 Symbol definitions are directly bound to their original source nodes. Traversing saved Symbol references, including hidden layers, finds material records in 1,164 definitions in this snapshot. These counts are not numbers of distinct runtime controls.

## Parameters retained

Full raw objects for `blurs`, legacy `blur` when present, `fills`, `shadows`, `innerShadows`, `borders`, `contextSettings`, `colorControls`, and `borderOptions` are retained. In particular: `radius`, `saturation`, `brightness`, `distortion`, `depth`, `chromaticAberrationMultiplier`, `skipLightingEffects`, `extraSamplingRegion`, `isCustomGlass`, `isEnabled`, `isProgressive`, and `layeringType`.

Each fill / shadow retains its original array index, enable flag, exact RGBA values, effect opacity and blend-mode enum. Shadow offsets, blur radius and spread are shown separately. Gradient definitions and stops remain available. No array is sorted or filtered at extraction time. There is no inferred cross-array paint ordering.

Missing fields are shown as missing, not zero. Disabled effects remain inspectable but are explicitly labelled disabled. `radius` is a blur parameter, not corner radius. Unitless glass controls are not assigned invented physical units. UI display rounds to at most six decimal places; exports retain the original JSON numeric precision.

## Shared style, local style and instance overrides

Component records read the style actually serialized on each layer. A shared-style ID is retained as a link, not used to overwrite local differences. The viewer compares the local effect arrays with the linked shared preset.

When resolving Symbol instances, scoped `symbolID`, `isVisible`, `layerStyle`, and explicit `color:fill-N`, `color:shadow-N`, `color:border-N` replacements are applied to independent copies. Outer nested overrides take precedence over a nested instance's own defaults. Sources of applied overrides are retained. An unrecognized `fillColor` replacement is retained and marked unresolved rather than guessed.

Missing Symbol targets and cyclic / excessively deep references produce explicit warnings. Four distinct unresolved Symbol IDs exist in the original extracted geometry snapshot; affected component pages report them. Absence of a result is not a claim that all runtime versions lack that material. Non-Symbol Materials showcase canvases are not part of component usage counts.

## Data format

`assets/materials-data.js` contains a gzip/base64-encoded `hig-material-specs/1` JSON snapshot. It contains no font binaries, bitmap previews, SVG artwork or complete Sketch files. `geometryPayloadSHA256` binds it to the original geometry payload; source-file digests are checked as well.

- `styles`: platform, ID, name, `document.json` pointer, recipe index, catalogue flag.
- `recipes`: deduplicated raw material-property objects.
- `bindings`: component index -> `[preorderNodeIndex, recipeIndex, sharedStyleIndexOrNull]` records.
- `sources`: source filenames, SHA-256 and Sketch versions.

Index-based binding reduces transfer size. These indices are only valid with the exact hashed geometry payload; do not reuse them after changing geometry data. Exported component material records expand the indices into node IDs, JSON pointers, reference chains and source metadata.

## Rebuild and test

Obtain your own permitted copies of the matching source files, outside the repository:

```sh
python tools/extract-materials.py --ios '/path/Apple iOS 27 UI Kit.sketch' --macos '/path/Apple macOS 27 UI Kit.sketch'
python tools/apply-material-specs.py
node --test tests/*.test.cjs
```

The extractor uses Python's standard library. It generates a readable local `assets/materials.json` and the compressed browser asset. The integration tool is idempotent and checks that geometry data is unchanged. The existing symbol-rendering regression tests continue to run alongside material-data, provenance, override and export checks.

The original UI Kit and its assets remain subject to their source terms; this parameter reference does not grant additional rights to distribute Apple assets.
