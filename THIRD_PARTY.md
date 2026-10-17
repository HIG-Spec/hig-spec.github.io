# Third-party notices

## Source measurements

Apple UI Kit archives, fonts, bitmap previews and original symbol artwork are not bundled with this project. Extracted measurements refer to user-supplied snapshots. Apple names and design assets remain subject to their original rights and terms; this repository does not grant permission to redistribute them.

## Symbol name metadata

The codepoint-to-symbol-name metadata is derived from [marcbouchenoire/symbolist](https://github.com/marcbouchenoire/symbolist). Its MIT license is retained in [docs/symbolist-LICENSE.txt](docs/symbolist-LICENSE.txt). The SVG illustrations used in the preview are independent approximations, not redistributed Apple font glyphs. Unmapped symbols remain explicitly marked.

## Frontend dependencies

Vue, Vite, the Vue Vite plugin, TypeScript, vue-tsc, Node type definitions and Prettier are pinned in `package-lock.json`. Their original licenses accompany their installed packages. Browser tests use Playwright, pinned in `tests/requirements.txt`.

## Rendering research

[docs/rendering.md](docs/rendering.md) identifies the primary articles and projects consulted for the displacement-map technique. The site uses its own scene renderer and parameter adapter, not those projects' source assets or runtime libraries.
