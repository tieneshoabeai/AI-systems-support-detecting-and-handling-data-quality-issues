# Inverted closed lower roof — 2026-11-04

Human approved adding the upside-down counterpart of core-cap-roof beneath the
lower drum, fully closed rather than annular. Top: radius 1.17 at Y=0.52; bottom:
radius 1.05 at Y=0.40; height 0.12. Platform thickness remains 0.05 but centre
moves 0.495 → 0.375, with bounds 0.35–0.40, so it meets the new roof.

The roof is merged into material group 0 of spool-base-glass, sharing the exact
darkGlass instance used by the upper roof. It retains core-lower picking,
baseShift/explode/reset and the existing two material groups. No separate
selectable ID or material draw is added; triangle budget remains unchanged.
Core-lower metadata now covers the complete 0.40–0.82 assembly (height 0.42).
Both drum glass discs from the preceding change remain intact.

lowerRoof is declared in core-visual-config.ts. All platform layers derive their
height from platform.centerY, so disc, engraving rings and reflection move together.
No tower, chamber, upper cap or orbit values are changed.

## Verification

- Ray tests confirm a full bottom roof face at Y=0.40, full top at 0.52,
  and sloped wall at r=1.11 when Y=0.46, all with dark material index 0.
- Drum test still verifies glass on both drum faces, selecting material-index-1
  hits because a ray from below now meets the new roof first.
- Platform mesh bounds (excluding decorative rings/reflection) are 0.35–0.40.
- Existing lower explode/reset checks include the new roof automatically.
- Clearance includes a seventh core surface, lower-roof, using distance to the
  sloped meridian segment and full end discs. Two analytic sample checks cover
  the roof slope and both closures.
- All existing non-platform clearance rows remain byte-identical to the before
  snapshot, including all fourteen towers and all orbit rows.
- New roof gap: 0.287715; lowered platform gap: 0.457334.
- Complete suite: 90 passed / 2 failed, 92 total, 28.18 seconds. New roof tests pass.
- TypeScript compilation, scoped ESLint and production build pass. Existing build
  large-chunk warning remains.

The two existing failures are unchanged: backdrop inset 0.001 differs from the
old spacing assertion; outer-glass #bcc2c0ff is invalid in Three.js and the
material settings differ from earlier test expectations. Those values and
assertions are preserved. The earlier outer-glass/orbit intersections remain;
this change does not accept or resolve them.

Browser capture completed: fifteen image hashes match the manifest; zero console
errors (the existing invalid-colour warning remains). Real clicks select tower-01,
tower-10 and core-cap-drum at all three camera positions. Detached closeup was
visually inspected. GL attached/detached: 413 calls / 374454 triangles; animated:
427 / 374468. Draw count is unchanged. Before fingerprint/clearance snapshots are
kept in this directory as review evidence.
