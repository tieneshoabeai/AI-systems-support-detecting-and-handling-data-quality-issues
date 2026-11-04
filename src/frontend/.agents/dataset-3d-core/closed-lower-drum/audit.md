# Closed lower drum — 2026-11-04

Human approved matching core-lower to core-cap-drum dimensions and body material,
with full glass closures on both ends. Keep bottom Y=0.52; height 0.3 gives centre
0.67 and top 0.82. Extend lowerBand to 0.82–0.99 (height 0.17, centre 0.905), leaving
the chamber and upper cap in place.

## Geometry and materials

baseGlass now declares innerRadius 1.02, radius 1.17, height 0.3, centre 0.67.
The single selectable spool-base-glass mesh retains ID core-lower and the original
baseShift pivot. Material group 0 uses the exact shared darkGlass instance of the
upper drum for inner/outer vertical walls. Group 1 uses the existing glass instance
for two full-radius CircleGeometry discs. There is no central opening, and no
coplanar dark annulus beneath the glass. Inside remains hollow. Both cyan rim
radii follow the new outer radius. Metadata identifies the mixed materials.

There is one additional material draw (budget 20 → 21); no extra selectable part
or explode offset is introduced. Source geometry inputs are disposed by mergeRings.

## Verification

- New ray test hits the top glass at Y=0.82 and bottom glass at Y=0.52 from centre
  to near rim, and the inner dark wall at radius 1.02 from inside. A ray outside
  radius 1.17 misses. Both material identities and group indices are checked.
- Test checks exact agreement with upper drum dimensions, contiguous layers and
  unchanged explode/reset behaviour (base moves +0.12).
- Clearance helper now includes both full discs and inner wall of this lower
  part; generator and gate use the same coreSurfaceGap function.
- All orbit and fourteen tower clearance lines remain byte-identical to the
  before snapshot. All fourteen retained tower subtrees remain unchanged after
  normalizing tree paths and material ordinals.
- Lower part sampled surface gap: 0.073697; lowerBand: 0.114147.
- TypeScript, scoped ESLint, build and diff whitespace checks passed. Build
  retains its existing large-chunk warning.
- Complete Dataset 3D suite: 88 passed / 2 failed, 90 total, 26.17 seconds.
  The new lower-drum test and closure-distance test passed.

## Existing unrelated deviations preserved

At turn start, outerGlass material was already #bcc2c0ff / opacity 0.2 /
roughness 0.1 / lightMapIntensity 0.3, and backdrop insets were 0.001.
These were preserved. Three.js warns that the eight-digit hex is invalid and
falls back to white. Two existing spool tests still expect the preceding
white-glass settings and backdrop spacing, so they fail. Neither those product
values nor their existing assertions were changed to hide these failures.
The regenerated snapshot records current source, including these preceding
edits; snapshot equality does not certify their validity.

Outer chamber glass still intersects orbit rings 1–3; no orbit change or acceptance
is included. The six-surface legacy clearance gate still excludes that outer wall.
Browser capture completed: all fifteen image hashes match the manifest, browser
console errors zero (the invalid-colour warning above remains). Actual clicks
select tower-01, tower-10 and core-cap-drum at all three camera positions.
Normal and detached closeups were visually inspected. GL attached: 413 calls /
373430 triangles; detached: 405 / 365604; animated: 427 / 373444.
