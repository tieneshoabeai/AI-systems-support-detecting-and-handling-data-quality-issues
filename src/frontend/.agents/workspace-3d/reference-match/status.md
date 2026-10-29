# Reference reconstruction status — 28/10/2026

**Incomplete. Project and Dataset pipelines are hard-stopped at blockout, 3/3 correction actions. No gate was lowered, forced or recorded as passed when failed.** The user must choose whether to authorize another bounded correction budget or a different review policy. Do not reset/reinitialize the states to evade the stop.

## Completed evidence work

- Read intake, quality-contract, local-search, topology and complete review/self-correction contracts.
- Separated the attached 359×503 graphic into three single-object analysis crops. Conditional input: low resolution, one view, unseen back/underside. No synthesized view replaces the reference.
- Admission passed for hub/cartridge. Project RGB segmentation fragmented the silver body; a separate, documented hand-annotated alpha mask preserved original RGB and passed admission. Later workspace/cartridge masks diagnose foreground framing; these conditional low-resolution annotations are not exact ground-truth geometry.
- Three assessed/spec JSON files pass strict schema/quality validation after mapping observed details and material evidence. That validation is not a visual pass, not proof that all component transforms are correct, and not an approved product factory.
- Material-region reports exceed extraction threshold, but this is only the tool's inference confidence. The first shell extraction was rejected by visual inspection because it selected a green fitting. Subsequent regions preserve source RGB with an explicit sampling margin. No extracted roughness or normal maps were silently applied to product materials.

## Product changes actually made in this batch

Only `src/graphics/workspace-3d/resource-hardware.tsx` changed relative to the prior C implementation:

1. RoundedBoxGeometry segments 2 → 4.
2. Hub solid circular plates replaced by extruded annular profiles with real interior holes. Outer radius 1.75/1.70, inner radius 1.05/1.10; separate central support preserves the annular negative space.
3. Hub main core height 1.32 → 1.10; core center Y 0.39 → 0.28; upper cap Y 1.07 → 0.85; top insert Y 1.16 → 0.94; vertical strip height 1.12 → 0.90.

```ts
const hole = new Path()
hole.absarc(0, 0, inner, 0, Math.PI * 2, true)
shape.holes.push(hole)
```

This removes real geometry from the annular profile; it is not a dark disc pretending to be a hole. Existing color, labels, identity, data/layout and interactions remain from batch C. Full silver lookdev, project ventilation, cartridge detailing, branch color propagation and pipe sockets have **not** been completed. Do not describe this as “matches the reference”.

## Capture and diagnostic provenance

- `.agents/workspace-3d/reference-match/review.html` and `review-scene.tsx` are internal test artifacts importing the actual product model and lighting. They do not enter the production build. They provide independent per-object views without a new product UI.
- Actual browser WebGL PNGs are exported through the harness Capture model button. Initial project capture clipped the top; the next capture reduces zoom and retains the full silhouette.
- Camera changed from direction [0.55,0.65,1] to [0.46,0.40,1] to reduce elevation toward the reference.
- Aligned renders use **uniform scale and translation only** to match reference framing. No anisotropic stretch, silhouette warping or painted repair. Raw PNGs are retained with the alignment reports. The fourth hub alignment uses the same procedure; raw bounding box [103,155,497,425], uniform scale 0.4814814815, centered in the 191×130 reference canvas.
- Product models currently use no texture maps; the same capture is valid map-stripped evidence for this blockout. This is not a future material-pass approval.

## Latest Tier 1 results

| Model | Render | IoU | Aspect delta | Result |
|---|---|---:|---:|---|
| Hub | workspace-blockout-aligned-4.png | 0.9016 | 0.0045 | Tier 1 passed; multi-angle and visual acceptance still pending |
| Project | project-blockout-aligned-3.png | 0.8231 | 0.0191 | Failed IoU < 0.85; stopped 3/3 |
| Dataset | dataset-blockout-aligned-3.png | 0.8264 | 0.0398 | Failed IoU < 0.85; stopped 3/3 |

IoU is a silhouette metric, not a whole-model fidelity score. No AI visual acceptance score was assigned to failed hard-gate renders. No structural, material, interaction or completion gates were marked passed. Future passes must not be implemented until the blocking workflow is resolved explicitly.

## Verification / handoff

- Existing full suite: 277/277 passed after product geometry edits. Production build passed; preview/reference harness remains absent from production artifacts.
- Lint initially found the internal Review component had no export; fixed by exporting the component. The lint rerun and git diff --check both passed (exit 0).
- No backend changes, dependency changes, commits, resets or reverts. Earlier user changes remain intact. All auxiliary artifacts stay under `.agents/workspace-3d/reference-match/`.
- Source and evidence should be reviewed in Codex. Pipeline stop is a skill quality gate, not an app crash or backend failure.
