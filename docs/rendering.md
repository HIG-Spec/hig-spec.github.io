# Web preview renderer

## Reference implementations

The following primary sources informed the implementation approach. The renderer is implemented locally; these libraries are not runtime dependencies and their source artwork is not included.

- [kube.io — Liquid Glass in the Browser](https://kube.io/blog/liquid-glass-css-svg/): curved edge profiles and displacement maps, including switch and slider demonstrations. The article distinguishes ordinary SVG filters from its Chrome-specific `backdrop-filter` demo.
- [tomagranate/liquid-glass](https://github.com/tomagranate/liquid-glass): ordinary `feDisplacementMap` filters over an explicit copy of the backdrop, with DOM and texture backends.
- [rdev/liquid-glass-react](https://github.com/rdev/liquid-glass-react): interactive glass surfaces and chromatic aberration controls.
- [MDN — feDisplacementMap](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap): channel-based displacement semantics.
- [Sketch API — Blur](https://developer.sketch.com/reference/api/#blur): source effect fields and their API meanings.

## Scene composition

`scene.ts` walks the saved component layers and resolves nested instances. An enabled `type: 4` effect inserts a glass surface. The SVG reuses the already painted scene behind that surface, clips it to the measured shape and filters it. A signed-distance-field edge profile produces a local displacement texture; red and green encode the two offset axes. The prior scene includes the track beneath a switch thumb, not just a decorative page background.

Refraction uses ordinary SVG filtering, not `backdrop-filter: url(...)` and not a CSS blur-only imitation. The explicit scene avoids dependence on access to arbitrary browser compositing backdrops. No external image, Web font, canvas screenshot library or network texture is required.

The scene also preserves supporting local shadow, Gaussian blur, border and blend effects. These layers must not be omitted just because they are not themselves glass. In the source switch, rendering a blurred border without its blur produces an incorrect heavy black rim.

## Parameters versus rendering units

Tables and exports contain the original Sketch values. The following conversions are **Web preview choices**, not Apple specification values:

| Input                           | Preview interpretation                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| Glass `radius`                  | Gaussian standard deviation = `radius × 0.45`                                                  |
| `distortion`, `depth`           | SVG displacement scale = `2 × min(width, height) × distortion × (0.5 + depth)`                 |
| `saturation`, `brightness`      | SVG color saturation and channel slopes                                                        |
| `chromaticAberrationMultiplier` | Separate RGB displacement scales, up to ±14% of the base scale                                 |
| Edge profile                    | Rounded-rectangle SDF with a 24%-of-short-side edge band                                       |
| Shadow `blurRadius`             | SVG Gaussian standard deviation = `blurRadius / 2`                                             |
| Plus darker / lighter           | Web approximation using multiply / screen, while retaining source enum values 16 / 17 in specs |

`radius = 0` is meaningful: refraction can remain active with no blur. Disabled effects are not enabled just to make a preview look more like glass. Source sizing modes, padding and material floats are never modified to accommodate the renderer.

## Switch and slider states

The supplied iOS switch has an opaque idle thumb and a larger glass thumb in its **Pressed** state. macOS switch variants use **Clicked** states; their numeric prefixes are not consistent across On and Off. The state resolver matches semantic state names rather than inventing one global index.

Holding the switch preview shows the actual saved pressed/clicked variant. Releasing toggles the On/Off source variant. Keyboard Space and Enter toggle the switch. A separate state link lets readers inspect and export the glass variant without holding the pointer down.

Sliders have glass in their saved pressed knob subcomponents. The component material panel links to those source variants; it does not mislabel the entire family as material-free or add a guessed material to every idle slider.

## Boundaries

This is a Web approximation of a design-file preview, not a reimplementation of the native renderer. Complex shape contours, native text shaping, dynamic native layout reflow and all compositing modes are not exact. The original source controls are kept separate from these limitations. The reader interface states this once; extraction mechanics and adapter details stay in developer documentation.

No continuous animation loop runs at rest. Catalogue previews are created as they approach the viewport, and displacement textures use a bounded cache. Changing the preview background, moving it beneath the component or switching source states rerenders the scene.

## Tests

Unit tests render all 6,536 saved definitions structurally and verify finite output and immutable source snapshots. Browser tests compare pixels with displacement enabled and disabled while holding blur constant; the zero-blur switch verifies that the effect is real refraction, not merely frosting. These checks are not a pixel-parity comparison against UIKit or AppKit.
