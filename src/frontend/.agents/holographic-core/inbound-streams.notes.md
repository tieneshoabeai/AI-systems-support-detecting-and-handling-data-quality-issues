# Inbound data streams — notes

Single place to read before tweaking the lane/streak effect. If you change a knob listed here,
update this table and the matching test in `src/__tests__/dataset-3d/`.

## File map

| File | Responsibility |
|---|---|
| `src/graphics/holographic-core/inbound-stream-paths.ts` | Lane table, Bézier with lateral zigzag, arc-length LUT (256), `sampleAt` |
| `src/graphics/holographic-core/inbound-stream-streaks.ts` | 24 streak meshes, particle classes, 3-tube buffer, per-frame write |
| `src/graphics/holographic-core/inbound-streams.ts` | Root anchored to `core-cap`, 4 faint guides, counter-rotation, static reset |
| `holographic-core.model.ts` | Wiring only: create (`createInboundStreams`), `update(elapsedSeconds)`, `resetMotion()` |
| `src/__tests__/dataset-3d/inbound-stream-paths.test.ts` | P1–P4 path math |
| `src/__tests__/dataset-3d/inbound-streams.test.ts` | T1–T10 structure, motion, reset, cap coupling, picking |
| `.agents/holographic-core/captures/capture-inbound.cjs` | Desktop/mobile/reduced-motion captures |

## Current knobs (v4)

All lanes share the same height, radial curve and zigzag profile. Their azimuths and cycle durations differ.

| Knob | Value |
|---|---|
| `LANE_GROUPS` base azimuth | 0° (+X), 90° (+Z), 180° (−X), 270° (−Z) |
| `LANE_OFFSETS` | −5, −3, −1, +1, +3, +5 (degrees) → 24 lanes |
| `START_HEIGHT` | 3.0 (cap-local; world ≈ 5.9 at the rim, intentionally cropped) |
| `START_RADIUS` | 1.45 |
| `LANDING_RADIUS` | 0.22 (ring around the cap hotspot; keeps the centre from burning) |
| Zigzag | 5 rounded triangle cycles, nominal lateral amplitude 0.075 world, tapered to zero at both ends |
| Cycle | `baseCycle + offsetDegrees × 0.15` → 6.6–8.1 s at 0°/180°, 5.4–6.9 s at 90°/270° (0.3 s per 2°) |
| Path length L | ≈ 3.6128 world (all lanes identical) |

Streak rendering — fixed buffer layout, never changes with class.

| Knob | Value |
|---|---|
| `STREAKS_PER_LANE` | 6 |
| `TUBES_PER_STREAK` | 3 (main + 2 wisps; small grains hide the third with zero colour) |
| `STATIONS` / `RINGS` / `RADIAL` | 12 segments / 13 rings / 6 |
| Vertices per lane | 6 × 3 × 13 × 6 = **1404** (24 lanes → 33,696) |
| Indices per lane | 6 × 3 × 12 × 6 × 6 = **7776** |
| `STREAK_LENGTH_RATIO` | 0.0825 L ≈ 0.2981 world (short dash, wide gaps) |
| Grain classes | 6 pairs of head/tail radius, one colour per class (see below) |
| Wisp radius | 0.30 × main tube |
| Jitter | lane-wide ±0.035 cycle + per-streak ±0.008 cycle (deterministic hash) |
| Speed | L / cycle (constant along the arc because the LUT is arc-uniform) |

Grain classes (assigned per streak by `hash01(laneIndex, streak)`, 6 classes repeated across 24 lanes):

| idx | head | tail | spread | brightness | tails | colour |
|---|---|---|---|---|---|---|
| 0 | 0.010 | 0.0020 | 0.010 | 0.78 | 2 | `#22d3ee` cyan |
| 1 | 0.013 | 0.0026 | 0.013 | 0.84 | 2 | `#38bdf8` sky |
| 2 | 0.016 | 0.0032 | 0.016 | 0.90 | 2 | `#818cf8` indigo |
| 3 | 0.021 | 0.0038 | 0.020 | 0.94 | 3 | `#a78bfa` violet |
| 4 | 0.026 | 0.0045 | 0.024 | 0.98 | 3 | `#e879f9` fuchsia |
| 5 | 0.032 | 0.0052 | 0.028 | 1.02 | 3 | `#fb7185` rose |

Colour / envelope.

| Knob | Value |
|---|---|
| Body colour | per grain class, luma-normalised to 0.30 |
| Head colour | per grain class, luma-normalised to 0.80 + 0.25 white → head vertex luma ≈ 1.05–1.38 (was 1.75–2.14) |
| Body / head exponent | 1.35 / 12 (longer visible tail, more compact bright head) |
| Spawn fade | headT 0 → 0.06 |
| Cruise | 0.06 → 0.86 |
| Absorb (length shrinks to 20%) | 0.86 → 0.995 |
| Vanish (brightness → 0) | 0.90 → 1.0 |
| Static pose (reduced motion) | phase `k/6 + 0.10 + jitter` |

Composition.

| Knob | Value |
|---|---|
| Root | name `inbound-data-streams`, child of `core-cap`, local y 0.05 |
| Guides | 4 centre paths at the group azimuths, tube radius 0.0055, opacity 0.11, renderOrder 5 |
| Streaks | 24 meshes, renderOrder 7, additive, opacity 0.36, `depthWrite=false`, `toneMapped=false` |
| Counter-rotation | `root.rotation.y = -cap.rotation.y` every update |

## Quick tweaks

- Raise/lower the whole bundle: `START_HEIGHT` in `inbound-stream-paths.ts`.
- Move lanes in/out: `START_RADIUS`; landing ring: `LANDING_RADIUS` (0.22, must stay inside cap 0.92).
- Slower/faster: scale the `LANE_GROUPS` base cycles (7.35 / 6.15) or `CYCLE_STEP_SECONDS_PER_DEGREE`.
- Zigzag: tune `ZIGZAG_AMPLITUDE` for width and `ZIGZAG_CYCLES` for bend count.
- More/less chaos: change `CYCLE_STEP_SECONDS_PER_DEGREE` (0.15) or `LANE_PHASE_JITTER`.
- More/less density per lane: `STREAKS_PER_LANE` (+ its use in `createStreakProfiles` and the test constants).
- Grain sizes/colours: the `GRAIN_DEFINITIONS` table (`headRadius`, `tailRadius`, `spread`, `brightness`, `hex`).
- Brightness: `BODY_LUMA` / `HEAD_LUMA` / material `opacity` (keep head vertex luma below 1.5).
- Longer/shorter dashes: `STREAK_LENGTH_RATIO` (keep < spacing 1/6 minus jitter).
- Move later: edit `LANE_GROUPS` base cycles.

## Verify

```bash
npx tsc -b
npx eslint src/graphics/holographic-core src/__tests__/dataset-3d
npx vitest run src/__tests__/dataset-3d/inbound-stream-paths.test.ts src/__tests__/dataset-3d/inbound-streams.test.ts
```

Full suite: `npx vitest run`. Known flake `workspace-3d/local-csv-viewer.test.tsx` — rerun that file once
before reporting a failure.

Capture (dev server must be running on 5173):

```bash
NODE_PATH=/Users/mac/.npm/_npx/e41f203b7505f1fb/node_modules \
  node .agents/holographic-core/captures/capture-inbound.cjs
```

Writes `desktop-attached-{a,b}.png` (0.4 s apart), `desktop-exploded-{a,b}.png`, `mobile-attached.png`,
`reduced-{a,b}.png` into the same folder.

## History

- v1: 4 lanes only (outer H 1.4 / R 3.35, inner H 0.3 / R 2.75), 6 streaks of 468 verts, single tube,
  uniform phases → read as a neat train.
- v2: 24 lanes (4 groups × 6 offsets), H 3 / R 1.45, 3 tubes per streak (1404 verts), size classes,
  lane-wide phase offset and per-lane cycle differences → streaks overlap and overtake each other.
- v3: cycles ×1.5 (outer 6.6–8.1 s, inner 5.4–6.9 s), six grain classes with six cool hues,
  landing ring 0.22, dash 0.0825 L with a longer/thinner tail, ~45% dimmer. Centre hotspot is no
  longer fed by the streams.
- v4: cardinal azimuths, symmetric lane offsets, and a lateral zigzag along the same Bézier.

## Known issues

- The rim starts at ≈ 5.9 world and is cropped by the camera, by design for this round.
- Streams land in four clusters on the 0.22 ring; the model's own centre hotspot at 0.05 is
  untouched and stays visible, but is no longer fed by the streams.
- Additive overlap still whitens lane crossings; lower `HEAD_LUMA` or opacity before changing the
  model/scene bloom.
- Camera framing can crop the outer ends of the streams, especially on mobile.
- 24 lanes = 28 draw calls and ~0.8 MB of attribute writes per frame; acceptable but not free.
