# Remove towers 05, 06 and 11 — 2026-11-04

Human confirmed removal of the three complete context towers. Fifteen towers remain:
six heroes and nine context towers. Remaining IDs, layout, dimensions, palette,
crowns and orbit parameters are unchanged.

## Implementation

- Remove 05/06 from ORIGINAL_TOWERS, 11 from OUTER_TOWERS and 06 from detail marks.
- Remove their three sliceA gauge bindings without reallocating them.
- Remove inactive generated tower nodes before any material, architecture, picking
  or detach setup; release their individually owned geometry and remove mesh/node,
  collider and destruction-group registry entries. Keep shared materials.
- Preserve the source's eighteen scores (six dimensions × three scopes).
  Validation checks that full contract independently of visible gauge bindings.
- Test fixtures explicitly enumerate the fifteen remaining IDs, preserving
  independent layout and clearance checks. Context color tests now exercise
  completeness/sliceB on tower-01 rather than the removed tower-05.

## Baseline audit

The two before-*.ndjson files preserve the preceding accepted snapshots.
Read-only comparisons against the regenerated snapshots confirmed:

- All fifteen retained tower subtrees are unchanged after normalizing tree paths
  and material-group ordinals.
- Every orbit row and all fifteen retained tower clearance rows are byte-identical.
- No fingerprint or clearance entry remains for 05, 06 or 11.
- Fifteen browser capture hashes match the manifest; browser console errors: zero.
- Actual browser clicks still select tower-01, tower-10 and core-cap-drum from
  each of the three capture camera positions.
- Attached/detached GL measurement: 419 calls and 374294 triangles per frame.
  The animated measurement returned zero and is invalid; it is not evidence of
  performance or animation correctness.

The historical fingerprint moment name selected-18 is retained for compatibility;
its current contents deliberately enumerate fifteen remaining towers.

## Earlier core work included in the current baseline

Before tower removal, the authorized chamber extension was already in the source:
height 0.99 → 1.32, bottom 0.99, center 1.65, top 2.31; outer glass radii 1.14/1.17.
The complete cap moved up 0.33 (top 2.73). The new snapshot records those changes,
so its core subtree differs from the preceding accepted snapshot independently
of tower removal.

Outer-glass collision is NOT accepted or resolved by this baseline update.
The six-surface legacy clearance gate does not include the new annular outer wall.
The separate chamber-double/preflight.json measurement records intersections
with rings 1–3; ring 4 clears. Human selected keeping the glass and preparing an
orbit-adjustment plan before acceptance. No orbit adjustment is included here.
The pre-existing tower-15 orbit intersection also remains.

## Validation

TypeScript compilation, scoped ESLint, production build and diff whitespace checks passed.
Build retains its existing large-chunk warning.
An initial run against the old fingerprint failed as expected; after regeneration,
87/88 tests passed while browser capture was running, with one crown test timing
out at the unchanged five-second limit. The complete rerun without browser capture
passed all 88 tests in 12 files (100.09 seconds); the timeout was not raised.
