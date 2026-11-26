# Airfield handover

Concept taken: **Short-field departure**. A plane poised on a continuous runway,
with an arched hangar and a tapered control tower. The pointer raises the plane
and nearby ground with a bounded distance falloff. The slider sets lift to
12 / 25 / 38 world units. Source: `airfield.js` (154 lines).

Rules leaned on: 01 fixed rest-plane picking; 03 bounded reach; 04 one stroke
highlight; 05 a composed rest pose; 06 opaque, ordered solids; 09 rounded solids
with dim creases. Motion also uses the default kernel springs and registration.

Tour (viewBox coordinates): runway approach **[100,194]**, plane/takeoff
**[183,211]**, near runway end **[238,272]**, then **null** to return to rest.
The fallback executes those stops and reads `runway → plane → runway → rest`.
The animated lap has not been judged in a browser.

## Checks actually run

```sh
node /home/hatch/workspace/projects/makefun/work/hairline/skills/hairline-create/build.mjs airfield.js
node /home/hatch/workspace/projects/makefun/work/hairline/skills/hairline-create/validate.mjs hairline-airfield.html
HAIRLINE_LOOK_CACHE="$PWD/.hairline-look-cache" node /home/hatch/workspace/projects/makefun/work/hairline/skills/hairline-create/look.mjs airfield.js --answer 18,32,17 --edge 76,44,4
node check-airfield.cjs
python3 render-airfield-check.py
```

Build and static validation pass, including the unchanged kernel and bench.
`look.mjs` exits **2**, not 0: it cannot launch a browser. Direct diagnosis of
the installed Chromium reports `Operation not permitted` during startup. The
environment browser launcher also fails on `unshare: Operation not permitted`.
No engine, bench, browser installation, or global configuration was changed.

**The figure was not looked at in a browser.** No official look sheet exists.
`airfield-check/static-sheet.png` is an inspected **static geometry review**,
made with librsvg from the actual kernel's geometry and a minimal node adapter.
It is not a substitute for a passing browser look. The adapter replaces only
the input/loop plumbing during tests, so it cannot test the real browser loop.

## look.md fallback answers

These answers concern source and static previews; browser-dependent claims
remain unverified. Line numbers below refer to `airfield.js`.

| Item | Answer and evidence |
| --- | --- |
| 1. Reads at 240px | Yes in the static preview: continuous runway and centre marks (37–41), tower shaft/cab/roof (45–54), hangar barrel and mouth (60–72), aircraft wings/body/canopy/tail (81–96). |
| 2. Composed rest | Yes: unequal ground rest heights (33), tall rear tower, low hangar, plane at rest height 8 (13), one bright fuselage (117). |
| 3. Distance response | Yes in code and preview: squared falloff, zero beyond 92 world units (110), separate ground targets (113), aircraft target (116). |
| 4. No flicker | Yes for the simulated springs: all nine saved states settle and stop rewriting paths. Picking uses fixed z planes 12/44/20/3 (124–131), never current spring positions. Actual browser input/loop unverified. |
| 5. Rounded hierarchy | Yes in code and preview: rounded prisms (15–17), tapered rounded rings (19–24), filleted hangar hull (72), filleted wings (83). Creases use kernel `solid`/`put`. |
| 6. Honest occlusion | Yes in the inspected states: land diagonal order (29–31), opaque solids, continuous foreground runway moved after apron (78), aircraft last (80). |
| 7. One highlight | Yes: fallback asserts exactly one `hi` path in all nine states; retarget transfers it between fuselage, selected ground, cab, and hangar (114–118). |
| 8. Read-out | Yes in simulation: `rest`, `plane`, `runway`, `tower`, `hangar`; tour also returns to `rest` (119). |
| 9. Frame | Yes for all static previews, including both slider ends at world [76,44,4], maximum aircraft lift, and maximum tower lift. The raster ink bounds across these states are x 77–723, y 78–589 in an 800×640 preview, well inside the stage. Camera extrema are explicit (10–11); strength is clamped (144). Browser measurement unverified. |
| 10. Themes | Yes in the static palette previews. Figure uses kernel classes only; actual browser theme application unverified. |
| 11. No words | Yes: no drawing text; runway marks and propeller are physical features. Static validator passes. |
| 12. Clean page | No browser verification. Figure evaluation and geometry simulation complete without errors or invalid path numbers; build/parse/static validation pass. Browser console and bench integration remain unverified. |
| 13. Empty state | Not applicable. |
| 14. Source likeness | Not applicable; no source SVG. |

The fallback also verifies unchanged geometry after settling, teardown empties
the SVG, expected read-outs, one highlight per state, and no NaN/Infinity in
any saved path. It does not verify offscreen sleep, reduced-motion media queries,
real pointer events, CSS stroke transitions, or the complete bench layout.

## Vendored deliverable

`game/vendor/hairline-airfield.html` is a byte-for-byte copy of the built page,
with no edits after copying. Open it with `?play=1` to judge whether the lap tells
the departure story. Edit only `airfield.js` for future changes, then rebuild,
rerun the browser look in a browser-capable environment, and recopy the result.
