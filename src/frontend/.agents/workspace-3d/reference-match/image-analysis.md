# Reference match — image observations and quality contract

Approved by user on 28/10/2026. Reference: attached `codex-clipboard-18cdbc0b-31e9-4713-ac56-127fdde12ba5.png` (359×503). Three distinct mechanical objects must be admitted separately; the entire graphic contains multiple subjects, labels and a legend and is not a single-object silhouette reference.

## Observations before inference

- Domain: object, geometric hard-surface, repeated modules, static props with selectable roots and fixed pipe sockets. No skeleton or articulated rig needed.
- Hub: radially symmetric low annular base; elevated hexagonal center; silver perimeter rails/caps; dark seams; repeated screws; green transparent-looking center panels/vertical light ribs; inset green top; two visible radial front pipe connectors.
- Project: upright cuboid with broad rounded shoulders; raised top and bottom caps; three narrow rounded vertical recesses on front; inset dark side ventilation grille; horizontal seams; small base indicators and fasteners. The two copies share geometry; one has green accents, the other blue.
- Dataset: low elongated cartridge; chamfered corner/edge guards; broad dark rectangular front window with four horizontal colored ribs; light silver top panel with narrow inset marks; small indicator near a corner. Green/blue follow the branch in the reference.
- Pipes: transparent outer walls, bright inner paths, socket collars at both ends, continuous bends without corners. The hub sockets are on its front quadrants, not one common point at its center. Project input is behind/above the front output socket; exact hidden socket location is uncertain.
- PBR observations: broad neutral silver faces with narrow white highlights and darker bevels; dark gaskets/recesses; colored inserts and limited green/blue glow. Inference: conductive silver-like shell (metalness around 0.85–1, roughness around 0.18–0.30), dielectric glass/plastic windows and emissive inner strips. These are authored estimates, not measured metal alloy or recovered BRDF.
- Assembly: selected socket to selected socket, with a collar bridging tube and shell; feet contact floor; inset panels sit within surrounding frames. Do not model the whole object as a single generic primitive.

## Reference regions (source pixels, right/bottom exclusive)

| Target | Crop | Confidence |
|---|---|---|
| Workspace hub | x=89..280, y=36..166 | Macro silhouette high; tiny hardware moderate |
| Project green | x=28..146, y=189..317 | Front/side silhouette high; rear unknown |
| Dataset green | x=24..153, y=350..427 | Top/front high; underside unknown |

Analysis crops retain original pixels, no upscaling or invented detail. Decorative labels, legend and opposite branch are excluded from individual model references. Complete scene remains the authority for relative size, green/blue branch relationships and camera composition.

Project automatic RGB foreground segmentation failed coherence (0.5235 < 0.60) because the silver enclosure resembles the gray background. Keep that failed result in project-admission.json. A separate alpha-only polygon segmentation is recorded in project-mask.json; project-masked-reference.png preserves source RGB values and only masks outside the observed enclosure outline. It is a conditional hand annotation, not an exact silhouette measurement or newly synthesized view. Re-run admission on that input and retain its result separately.

## Conditional suitability and limits

Conditional: each cropped target is a readable static mechanical prop. Low resolution and one view prevent exact fastener count, back-face detail or glass optical recovery. Hidden faces will reuse observed construction language and be recorded as inferred. No logo/pattern projection is needed: silver shells and plain colored windows use procedural materials; no printed patterned finish is visible. No claim of pixel-identical reconstruction or measured manufacturing dimensions.

## Quality contract before code

- Three distinct silhouette systems: annular hub/hex core, upright rounded equipment module, horizontal chamfered cartridge.
- At least 3 macro assemblies per type; explicit shell, gasket/recess and signal/window material families; repeated hardware and ventilation/rib systems separate from the primary shell.
- Identity blockers: solid disk replacing the hub annulus, square non-rounded project shoulders, missing side ventilation, missing cartridge window/ribs, floating connectors, one common hub pipe origin, all branches forced to the same accent, or wide-angle distant framing that makes the devices unreadable.
- Keep ID-based selection, parentId layout, label budgets and DOM fallback. Color denotes branch presentation only, never backend processing status.
- Review fixed reference-like camera plus meaningful orbit views; compare the attached scene and per-object crops. Static tests/build do not prove fidelity. Gate failures remain failures, not converted to a passing visual score.
- Implementation source must be changed only with apply_patch/edit per user instruction; pipeline scripts may manage local evidence/state, not overwrite product TypeScript. Generated factories must not overwrite existing refinements.

## Planned passes

Blockout proportions → structure/annular frames and real recesses → bevels/hardware/vents → PBR/window/glow → lighting/camera → pipe socket placement and selection → cleanup and 6/30-resource verification. State/gates control reconstruction progress; no early completion claim.
