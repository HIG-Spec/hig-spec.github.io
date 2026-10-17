# HIG Spec

Component dimensions, spacing, typography and material parameters for iOS / iPadOS and macOS.

**Website:** https://hig-spec.github.io/

## Development

Node.js 22.12 or later is required.

```sh
npm ci
npm run dev
```

The application is a Vue 3 + TypeScript project built with Vite. Application code lives in `src/`; the development HTML entry is `web/index.html`.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run preview` serves the production build at http://localhost:4173. The output is `dist/` and uses hash routes, so component deep links work on a static host without rewrite rules.

## Project structure

```text
src/
  pages/           Component catalogue, specs, materials, typography, sources
  components/      Live preview and reusable parameter panels
  data/            Typed snapshot loader, shared state and hash router
  specs/           Measurements, material resolution and export formats
  rendering/       Geometry, refraction, surface effects and symbols
  styles/          Site styles
public/data/       Versioned, digest-checked geometry and material snapshots
web/               Vite HTML entry
scripts/           Production output and static publishing
tools/            Source extraction and verification
tests/            Data, rendering and browser regression tests
```

Geometry, source material values and the Web preview adapter are separate. Changing the renderer does not change exported specifications. Pages are code-split; catalogue previews render on demand.

## Browser checks

```sh
python -m pip install -r tests/requirements.txt
python -m playwright install --with-deps chromium firefox webkit
# In another terminal: npm run preview
python tests/browser.py --browser chromium
python tests/browser.py --browser firefox
python tests/browser.py --browser webkit
```

Checks exercise the built application over HTTP, including source-state switching, refraction pixel differences, downloads, all component routes, mobile layout and runtime exceptions. Reports and screenshots are written to `test-results/`.

## Static publishing

The repository's existing Pages configuration publishes `main / (root)`. To keep that configuration and its URL, the frontend workflow builds and tests the application, then refreshes **only** the generated root files: `index.html`, `site/`, `data/`, `favicon.svg` and `.nojekyll`. It requests a Pages build after a bot commit. The root HTML is generated, not the development entry.

A non-fast-forward push is never forced. A source build is not published if the branch has advanced while checks ran. Pull requests run checks without publishing. To publish manually after tests:

```sh
npm run build
npm run publish:static
```

Only `dist/` is needed on a different static host. Do not serve the source `web/index.html` as production HTML.

## Source data

The two source snapshots are pinned by SHA-256. Their original artwork, fonts and Sketch archives are not distributed here. Obtain your own permitted copies of the matching design files to regenerate or verify material records:

```sh
python tools/extract-materials.py --ios '/path/Apple iOS 27 UI Kit.sketch' --macos '/path/Apple macOS 27 UI Kit.sketch'
python tools/verify-sources.py --ios '/path/Apple iOS 27 UI Kit.sketch' --macos '/path/Apple macOS 27 UI Kit.sketch'
npm test
```

See [material data](docs/material-specs.md), [Web rendering](docs/rendering.md), and [third-party notices](THIRD_PARTY.md).

This is an independent reference, not an Apple publication. Measurements describe the supplied design-file snapshots rather than a guarantee of native runtime behavior. Apple design assets remain subject to their original terms.
