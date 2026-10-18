# Component-by-component preview review

Scope: 113 saved variants across 36 families and 50 family/platform pairs. The
review includes all 12 public Tab Bar variants and all six public Notification
variants (including their example canvases). Each listed component rendering was inspected in a local browser; the
production-page capture runs separately in CI; the case IDs are retained in `tests/visual-cases.json`.
This is a review of representative design-file previews, not a claim that all
6,536 definitions are visually identical to native controls.

## Corrections

Symbol instances now **resize frames using their saved pins and Stack sizing**
rather than applying nonuniform scaling to the master's painted pixels. Font
sizes, glyph aspect ratios, corner radii and optical parameters therefore remain
independent of instance width. Fit-width string overrides are measured again.

Presentation flags omitted by the original geometry extraction are retained in
a separate, source-hash-checked metadata snapshot. They govern instance background
visibility, explicit frame clipping, mask chains and vertical text alignment.
They do not change the measured geometry/material snapshots or exported values.

Plain-group shadows use the painted children's contour, not the group's rectangular
bounding box. Source-proven one-line text is not given a false ellipsis merely
because a local fallback font has different advances. Wrapping and font weights
are handled separately from geometry. Unknown source bitmaps are marked as image
slots with an independent neutral placeholder; no Apple artwork/font is bundled.

Plus-darker is still a Web preview adapter, not native vibrancy. The old multiply
fallback erased white foreground text and controls. The preview now uses source-over
for enum 16; the original blend-mode enum and colors remain in the specifications.

## Review ledger

| Family              | Inspected / change                                                                                                                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buttons             | Both platforms, light/dark; preserved label widths, font weight and parent corners.                                                                                                                                                                              |
| Switches            | Both platforms; idle and existing pressed regression retained. Explicit overflow stays visible.                                                                                                                                                                  |
| Segmented controls  | Both platforms, light/dark; selected glyphs and captions no longer squeezed with the slot.                                                                                                                                                                       |
| Date/time pickers   | Light/dark compact calendar; seven columns aligned, two-digit overrides reflow, month and time captions retained.                                                                                                                                                |
| Text fields         | Both platforms; baseline and focus ring remain independent of label dimensions.                                                                                                                                                                                  |
| Sliders             | Both platforms; full linear examples, local knob dimensions and existing pressed-state tests retained.                                                                                                                                                           |
| Steppers            | Both platforms; child rectangles clipped by the source capsule, value and arrows remain readable.                                                                                                                                                                |
| Checkboxes          | macOS light/dark; fixed disappearing white dark-mode ink and preserved complete label.                                                                                                                                                                           |
| Radio buttons       | macOS light/dark; same foreground fix, round control remains circular.                                                                                                                                                                                           |
| Search fields       | macOS light/dark; lens, caret and clear button are no longer horizontally stretched.                                                                                                                                                                             |
| Combo boxes         | macOS light/dark; text, control corners and disclosure glyph retain their own sizes.                                                                                                                                                                             |
| Pop-up buttons      | macOS light/dark; readable value and correct glyph proportions.                                                                                                                                                                                                  |
| Menus               | iPhone and macOS complete examples, light/dark; no longer default to text-selection handles or an isolated submenu row.                                                                                                                                          |
| Tab bars            | All 12 public variants; removed non-instance canvas fill, preserved fixed glyphs, selected tabs, spacing and search/keyboard composition.                                                                                                                        |
| Sidebars            | Both platforms, light/dark; inspected source row and complete macOS hierarchy. Saved example-only colors are retained.                                                                                                                                           |
| Toolbars            | Both platforms, light/dark; title is not stretched, complete phone navigation example replaces oversized default iPad example.                                                                                                                                   |
| Page controls       | Light/dark; original dot sizes and selection retained.                                                                                                                                                                                                           |
| Disclosure controls | Light/dark; glyph and background dimensions remain independent.                                                                                                                                                                                                  |
| Scrollbars          | Light/dark; source vertical bar retained.                                                                                                                                                                                                                        |
| Lists               | Complete grouped-table examples, light/dark; rounded outer clipping and saved swipe/action rows retained.                                                                                                                                                        |
| Forms               | macOS full example; label wrapping and controls reviewed. The yellow example canvas is present in the source, not a missing screenshot.                                                                                                                          |
| Alerts              | Both platforms, light/dark; message wraps, buttons stay readable; macOS default is the actual alert rather than the modal overlay.                                                                                                                               |
| Action sheets       | Full iPhone sample; captions and source disabled action appearance retained.                                                                                                                                                                                     |
| Sheets              | Light/dark; clipped content and title layout corrected. Empty content and modal overlay are authored source placeholders.                                                                                                                                        |
| Popovers            | Both platforms, light/dark; iPad group shadow no longer creates a sharp rectangular hole; pointer/body contour retained.                                                                                                                                         |
| Dialogs             | macOS save example; field values/buttons reviewed. Whole-desktop example canvas remains intentional.                                                                                                                                                             |
| Windows             | Both platforms, light/dark; fixed title scaling and clipping of overflowing sidebar rows. The light sidebar example has a saved BG layer above its rows; see known source limitations below. iPad family contains window controls, not a complete window master. |
| Progress indicators | Both platforms, light/dark; source spinner shapes and saved colors retained.                                                                                                                                                                                     |
| Color wells/pickers | Both platforms, light/dark; iPad title, grid, segments and opacity captions reflow without glyph scaling.                                                                                                                                                        |
| Notifications       | All six public variants; 80×80 background master becomes 344×78 with a 20pt corner, not an elliptical stretched corner. Text/icon/thumbnail slots stay distinct.                                                                                                 |
| Tooltips            | Source text and small box reviewed.                                                                                                                                                                                                                              |
| Group boxes         | Source blank container reviewed; no fabricated title or content.                                                                                                                                                                                                 |
| Image wells         | Source image slot reviewed; no invented Apple asset.                                                                                                                                                                                                             |
| Activity views      | Light/dark; clipped contact/action layout reviewed; image assets explicitly represented as slots.                                                                                                                                                                |
| Keyboards           | Full iPhone light/dark/search compositions reviewed; default is the full keyboard rather than a Previous arrow.                                                                                                                                                  |
| Arrow buttons       | Light/dark; independently sized arrow and circular surface reviewed.                                                                                                                                                                                             |

## Reproduction and checks

```sh
python tools/extract-render-metadata.py --ios '/path/Apple iOS 27 UI Kit.sketch' --macos '/path/Apple macOS 27 UI Kit.sketch'
npm test
npm run build
# Serve dist, then:
python tests/visual-review.py --browser chromium
python tests/visual-review.py --browser firefox
python tests/visual-review.py --browser webkit
```

The browser review captures each case from the actual built app, with additional
checks for notification corner geometry, Tab Bar captions/background, visible dark
foreground ink, complete dates, clipping pixels and mobile layout. Existing
material/interaction/export tests still run. Native optical parity, native font
shaping, bitmapped artwork and every possible content override are not certified
by these tests. Never relabel a generated screenshot as an Apple/native reference.

## Known source/preview limitations found during inspection

- `Windows/Light/Default + Title + Sidebar/Active` serializes its opaque,
  background-blurred BG after the Sidebar instance. The preview preserves that
  order; this sample therefore obscures the rows, unlike its Dark counterpart.
  It is not marked as a verified native appearance and has not been silently
  reordered by name. The standalone sidebar examples remain inspectable.
- Some named Dark/Light example canvases deliberately contain contrary-appearance
  sample instances. Names and colors are preserved rather than normalized.
- Dark Glass button label alpha, the dark large spinner's black fill, demo
  shape icons and unbundled photo/icon slots come from the source records; they
  are not native asset fidelity claims. Optical blend adapters remain approximate.
