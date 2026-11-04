# Tower 15 removal and milky outer glass — 2026-11-04

Human approved removing tower-15 and giving only the outer chamber wall a pale,
milky material: color #e2e8e6, opacity 0.65, roughness 0.6, no emission.

The scene now has fourteen towers: six hero and eight context. Tower-15 and its
Consistency/sliceB display binding are removed. Source data still supplies all
eighteen quality scores. Remaining IDs, layout and scores are unchanged.

## Glass implementation

The existing two annular walls remain one chamber mesh with two geometry groups:
group 0 uses the original inner glass; group 1 uses the new outer material.
Both keep the core-upper selectable ID and the existing chamber pivot. Outer
radii remain 1.14/1.17, height 1.32, bottom 0.99 and top 2.31.
No nucleus, cap or particle material changes.

The first browser pass showed that white albedo alone was still tinted dark blue
by the scene ambient light. A uniform 1×1 white DataTexture light map now supplies
neutral baked diffuse fill only to the outer material (intensity 1, UV channel 0).
Emission remains zero, roughness/opacity stay as approved, and no scene-wide
lighting changes. The texture is disposed with the spool.

mergeRings now optionally preserves material groups; all other callers retain
the previous default. The logical per-material draw budget changes 19 → 20,
with no new triangles. The budget test now counts material groups rather than
assuming every drawable always needs one draw.

Tests verify both material assignments, unchanged hollow geometry and rays
hitting each wall with the correct material index. Tower scene/picking tests
exclude 15 alongside 05/06/11.

## Audit and limits

The before snapshots are retained here as review evidence. A read-only comparison
confirmed that clearance changes only remove the tower-15 row. All fourteen
remaining swept tower gaps are non-negative; the minimum is 0.127814 at tower-01.
All fourteen retained tower subtrees are unchanged after normalizing tree paths
and material ordinals.

The clearance test no longer exempts tower-15. Its measurement harness now chooses
the nearest remaining tower for the report instead of hard-coding 15, and handles
an empty nearby raster set without pretending that it measured a surface gap.

The outer glass still intersects rings 1–3. This material-only change does not
resolve or accept those intersections. The legacy six-surface core clearance
gate does not measure the outer annular wall; see chamber-double/preflight.json
and the pending orbit-adjustment plan.

## Validation

- Complete Dataset 3D suite after neutral diffuse fill: 12 files / 88 tests passed, 68.05 seconds.
- TypeScript compilation and scoped ESLint passed.
- Production build passed with the existing large-chunk warning.
- Baseline fingerprint and clearance were regenerated with the existing harness.
- Browser capture and visual inspection are pending.
