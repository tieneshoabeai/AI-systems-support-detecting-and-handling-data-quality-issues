#!/usr/bin/env node
// Semantic checks the generic schema validator cannot express.
// The validator proves the spec is well-formed; this proves it says what the
// reference measures. Fails closed: any failed assertion exits 1.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const specPath =
  process.argv[2] ??
  fileURLToPath(new URL("../../src/graphics/neon-cube/object-sculpt-spec.json", import.meta.url));

const failures = [];
const checks = [];

function check(label, condition, detail = "") {
  checks.push({ label, ok: Boolean(condition), detail });
  if (!condition) failures.push(detail ? `${label}: ${detail}` : label);
}

function near(a, b, tolerance = 1e-6) {
  return typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tolerance;
}

function section(title) {
  process.stdout.write(`\n${title}\n`);
}

function report() {
  for (const item of checks) {
    process.stdout.write(`  ${item.ok ? "ok  " : "FAIL"} ${item.label}${item.ok || !item.detail ? "" : ` -> ${item.detail}`}\n`);
  }
}

let spec;
try {
  spec = JSON.parse(readFileSync(specPath, "utf8"));
} catch (error) {
  process.stderr.write(`cannot read spec ${specPath}: ${error.message}\n`);
  process.exit(2);
}

const components = new Map((spec.componentTree ?? []).map((c) => [c.id, c]));
const materials = new Map((spec.materials ?? []).map((m) => [m.id, m]));
const repetitions = new Map((spec.repetitionSystems ?? []).map((r) => [r.id, r]));
const evidenceIds = new Set((spec.viewEvidence ?? []).map((v) => v.id));

function component(id) {
  return components.get(id);
}

function worldY(id) {
  const stack = [];
  let current = component(id);
  while (current) {
    stack.push(current);
    current = current.parent ? component(current.parent) : null;
  }
  return stack.reverse().reduce((sum, node) => sum + (node.transform?.position?.[1] ?? 0), 0);
}

function hexToHsl(hex) {
  const text = String(hex).replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(text)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(text.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

function collectHexColors(node, out = []) {
  if (typeof node === "string") {
    for (const match of node.matchAll(/#[0-9a-fA-F]{6}\b/g)) out.push(match[0]);
  } else if (Array.isArray(node)) {
    for (const item of node) collectHexColors(item, out);
  } else if (node && typeof node === "object") {
    for (const value of Object.values(node)) collectHexColors(value, out);
  }
  return out;
}

// ---------------------------------------------------------------------------
section("identity and schema");
check("targetName", spec.targetName === "Neon Glass Cube", String(spec.targetName));
check("targetId", spec.targetId === "neon-glass-cube", String(spec.targetId));
check("schemaVersion 2.1", spec.schemaVersion === "2.1", String(spec.schemaVersion));
check("suitability pass", spec.suitability === "pass", String(spec.suitability));
check("source image present", typeof spec.sourceImage === "string" && spec.sourceImage.endsWith("reference.png"));

// ---------------------------------------------------------------------------
section("four primary parts and parent chain");
const primaryParts = ["base-outer", "base-inner", "cube-outer", "cube-inner"];
for (const id of primaryParts) {
  check(`part ${id} exists`, Boolean(component(id)));
}
check("root is the only parentless component", spec.componentTree.filter((c) => c.parent === null).length === 1);
check("base-outer -> root", component("base-outer")?.parent === "root", component("base-outer")?.parent);
check("base-inner -> base-outer", component("base-inner")?.parent === "base-outer", component("base-inner")?.parent);
check("cube-outer -> base-inner", component("cube-outer")?.parent === "base-inner", component("cube-outer")?.parent);
check("cube-inner -> cube-outer", component("cube-inner")?.parent === "cube-outer", component("cube-inner")?.parent);
for (const id of ["cube-outer", "cube-inner"]) {
  const d = component(id)?.dimensions ?? {};
  check(`${id} is a true cube`, near(d.width, d.height) && near(d.width, d.depth), `${d.width}x${d.height}x${d.depth}`);
}

// ---------------------------------------------------------------------------
section("measured proportions");
const outer = component("base-outer");
const inner = component("base-inner");
const cube = component("cube-outer");
const core = component("cube-inner");
const baseSide = outer.dimensions.width;
const holeSide = outer.geometryDescriptor.profile2D.hole.size[0];
const openingSide = outer.geometryDescriptor.openings[0].width;
const innerSide = inner.dimensions.width;
const cubeSide = cube.dimensions.width;
const coreSide = core.dimensions.width;

check("base side is 2.00 scale reference", near(baseSide, 2.0, 1e-9), String(baseSide));
check("opening is 1.64", near(holeSide, 1.64, 1e-9), String(holeSide));
check("opening listed twice consistently", near(holeSide, openingSide, 1e-9), `${holeSide} vs ${openingSide}`);
check("inner platform is 1.48", near(innerSide, 1.48, 1e-9), String(innerSide));
check("outer cube is 1.32", near(cubeSide, 1.32, 1e-9), String(cubeSide));
check("core cube is 0.88", near(coreSide, 0.88, 1e-9), String(coreSide));
check(
  "1.32 < 1.48 < 1.64 < 2.00",
  cubeSide < innerSide && innerSide < holeSide && holeSide < baseSide,
  `${cubeSide} / ${innerSide} / ${holeSide} / ${baseSide}`,
);
check("ring gap (hole - inner)/2 = 0.08", near((holeSide - innerSide) / 2, 0.08, 1e-9));
check("cube clearance (inner - cube)/2 = 0.08", near((innerSide - cubeSide) / 2, 0.08, 1e-9));
check("cube-to-hole-wall (hole - cube)/2 = 0.16", near((holeSide - cubeSide) / 2, 0.16, 1e-9));
check("core clearance (cube - core)/2 = 0.22", near((cubeSide - coreSide) / 2, 0.22, 1e-9));
check("core ratio core/cube = 0.667", Math.abs(coreSide / cubeSide - 0.667) <= 0.002, String(coreSide / cubeSide));
check("cube/base ratio = 0.66", Math.abs(cubeSide / baseSide - 0.66) <= 0.001, String(cubeSide / baseSide));
check(
  "platform thickness/base = 0.08",
  Math.abs(outer.dimensions.height / baseSide - 0.08) <= 0.001,
  String(outer.dimensions.height / baseSide),
);

// ---------------------------------------------------------------------------
section("vertical contact measurements");
const outerTopSocket = outer.actionProfile.sockets.find((s) => s.id === "top-center");
const innerTopSocket = inner.actionProfile.sockets.find((s) => s.id === "top-center");
const cubeCenterSocket = cube.actionProfile.sockets.find((s) => s.id === "center");

const outerTop = worldY("base-outer") + outer.dimensions.height;
const innerTop = worldY("base-inner") + innerTopSocket.localPosition[1];
const cubeBottom = worldY("cube-outer");
const cubeTop = cubeBottom + cube.dimensions.height;
const coreCenter = worldY("cube-inner");
const cubeCenter = cubeBottom + cubeCenterSocket.localPosition[1];

check("outer top is y=0.16", near(outerTop, 0.16, 1e-9), String(outerTop));
check("outer top-center socket matches geometry", near(outerTopSocket.localPosition[1], outer.dimensions.height, 1e-9));
check("inner top-center socket at local y=0.14", near(innerTopSocket.localPosition[1], 0.14, 1e-9));
check("inner top is y=0.14", near(innerTop, 0.14, 1e-9), String(innerTop));
check(
  "inner slab is 0.14 seated on the floor",
  near(inner.dimensions.height, 0.14, 1e-9) &&
    near(inner.attachment.localStart[1], 0, 1e-9) &&
    near(inner.attachment.localEnd[1], 0.14, 1e-9) &&
    near(inner.attachment.localEnd[1] - inner.attachment.localStart[1], inner.dimensions.height, 1e-9),
  `${inner.attachment.localStart[1]}..${inner.attachment.localEnd[1]} h=${inner.dimensions.height}`,
);
check("inner slab does not sink below the floor", near(inner.attachment.embedDepth, 0, 1e-9), String(inner.attachment.embedDepth));
check("platform step is 0.02", near(outerTop - innerTop, 0.02, 1e-9), String(outerTop - innerTop));
check("cube bottom is y=0.14", near(cubeBottom, 0.14, 1e-9), String(cubeBottom));
check("cube rests exactly on inner top", near(innerTop - cubeBottom, 0, 1e-9), String(innerTop - cubeBottom));
check("attachment embedDepth matches the 0.001 seat", near(cube.attachment.embedDepth, 0.001, 1e-9));
check("cube top is y=1.46", near(cubeTop, 1.46, 1e-9), String(cubeTop));
check("root height is 1.46", near(component("root").dimensions.height, 1.46, 1e-9));
check("model height/base width = 0.73", Math.abs(cubeTop / baseSide - 0.73) <= 0.001, String(cubeTop / baseSide));
check("core is centred in the outer cube", near(coreCenter, cubeCenter, 1e-9), `${coreCenter} vs ${cubeCenter}`);
check("core does not touch the outer glass (0.22 clearance)", near(core.attachment.gapTolerance, 0.22, 1e-9));
check("core bottom is y=0.36", near(coreCenter - coreSide / 2, 0.36, 1e-9), String(coreCenter - coreSide / 2));
check("core top is y=1.24", near(coreCenter + coreSide / 2, 1.24, 1e-9), String(coreCenter + coreSide / 2));

// ---------------------------------------------------------------------------
section("repetition counts");
const panels = repetitions.get("glass-panel-grid");
const seams = repetitions.get("seam-lattice");
const outerEdges = repetitions.get("outer-edge-frame");
const innerEdges = repetitions.get("inner-edge-frame");
check("54 panes (6 faces x 9)", panels?.count === 54 && panels.perFaceCount === 9 && panels.faces === 6);
check("panel lattice builds geometry", panels?.buildsGeometry === true && panels.realization === "instanced-mesh");
check("pane pitch 0.436 and gap 0.012", near(panels?.pitch, 0.436, 1e-9) && near(panels?.gap, 0.012, 1e-9));
check("24 seam bars (6 faces x 4)", seams?.count === 24 && seams.perFaceCount === 4 && seams.faces === 6);
check("12 outer edge rods", outerEdges?.count === 12);
check("12 inner edge rods", innerEdges?.count === 12);
check("seam rods are 0.006 thick", near(seams?.geometry?.width, 0.006, 1e-9) && near(seams?.geometry?.height, 0.006, 1e-9));
check("outer rods are 0.010 thick", near(outerEdges?.geometry?.width, 0.01, 1e-9) && near(outerEdges?.geometry?.height, 0.01, 1e-9));
check("inner rods are 0.007 thick", near(innerEdges?.geometry?.width, 0.007, 1e-9) && near(innerEdges?.geometry?.height, 0.007, 1e-9));
const corners = repetitions.get("corner-markers");
const sheets = repetitions.get("light-sheet-curtain");
check("8 corner markers (4 base + 4 cube)", corners?.count === 8 && corners.perFaceCount === 4 && corners.faces === 2);
check(
  "corner markers are 0.03 cubes",
  near(corners?.geometry?.width, 0.03, 1e-9) && near(corners?.geometry?.height, 0.03, 1e-9) && near(corners?.geometry?.length, 0.03, 1e-9),
);
check("corner-markers-base is a child of base-outer", component("corner-markers-base")?.parent === "base-outer");
check("corner-markers-cube is a child of cube-outer", component("corner-markers-cube")?.parent === "cube-outer");
check(
  "base corner emitters sit on the y=0.16 top face",
  near(worldY("corner-markers-base"), 0.16, 1e-9),
  String(worldY("corner-markers-base")),
);
check(
  "cube corner emitters sit on the y=1.46 top face",
  near(worldY("corner-markers-cube"), 1.46, 1e-9),
  String(worldY("corner-markers-cube")),
);
check("4 light sheets", sheets?.count === 4 && sheets.faces === 4 && sheets.buildsGeometry === true);
check(
  "light sheets are 2.00 x 0.44 x 0.004",
  near(sheets?.geometry?.width, 2, 1e-9) && near(sheets?.geometry?.height, 0.44, 1e-9) && near(sheets?.geometry?.length, 0.004, 1e-9),
);
check("light-sheets is a child of base-outer", component("light-sheets")?.parent === "base-outer");
check(
  "light sheets stand from y=0.16 to y=0.60",
  near(worldY("light-sheets"), 0.16, 1e-9) && near(worldY("light-sheets") + sheets.geometry.height, 0.6, 1e-9),
);
check("panel-grid is a child of cube-outer", component("panel-grid")?.parent === "cube-outer");
check("seam-grid is a child of cube-outer", component("seam-grid")?.parent === "cube-outer");
check("cube-edges is a child of cube-outer", component("cube-edges")?.parent === "cube-outer");
check("inner-edges is a child of cube-inner", component("inner-edges")?.parent === "cube-inner");
check("rim-outer/rim-hole are children of base-outer", component("rim-outer")?.parent === "base-outer" && component("rim-hole")?.parent === "base-outer");
check("rim-inner is a child of base-inner", component("rim-inner")?.parent === "base-inner");
check("three emissive rims use the tube primitive", ["rim-outer", "rim-hole", "rim-inner"].every((id) => component(id)?.primitive === "tube"));
check("rim tubes sit above their platform tops", near(worldY("rim-outer"), 0.16, 1e-9) && near(worldY("rim-hole"), 0.16, 1e-9) && near(worldY("rim-inner"), 0.14, 1e-9));
check(
  "rim diameters follow platform sizes",
  near(component("rim-outer").dimensions.width, baseSide, 1e-9) &&
    near(component("rim-hole").dimensions.width, holeSide, 1e-9) &&
    near(component("rim-inner").dimensions.width, innerSide, 1e-9),
);

// ---------------------------------------------------------------------------
section("camera");
const camera = spec.referenceCamera;
check("fov 8 (long lens)", near(camera.fovDegrees, 8, 1e-9), String(camera.fovDegrees));
check("azimuth 45", near(camera.azimuthDegrees, 45, 1e-9), String(camera.azimuthDegrees));
check("elevation 24", near(camera.elevationDegrees, 24, 1e-9), String(camera.elevationDegrees));
check("distance 20", near(camera.distance, 20, 1e-9), String(camera.distance));
const az = (camera.azimuthDegrees * Math.PI) / 180;
const el = (camera.elevationDegrees * Math.PI) / 180;
const target = camera.target;
const derived = [
  target[0] + camera.distance * Math.cos(el) * Math.sin(az),
  target[1] + camera.distance * Math.sin(el),
  target[2] + camera.distance * Math.cos(el) * Math.cos(az),
];
check(
  "positionHint matches azimuth/elevation/distance",
  camera.positionHint.every((value, index) => near(value, derived[index], 0.01)),
  `hint=${JSON.stringify(camera.positionHint)} derived=${derived.map((v) => v.toFixed(3)).join(", ")}`,
);

// ---------------------------------------------------------------------------
section("performance budget");
const budget = spec.performanceBudget;
check("targetTriangles 25000", budget.targetTriangles === 25000, String(budget.targetTriangles));
check("maxDrawCalls 14", budget.maxDrawCalls === 14, String(budget.maxDrawCalls));
check("fpsTarget 60", budget.fpsTarget === 60 && spec.qualityTargets.fpsTarget === 60);
check("textureSize 1024", budget.textureSize === 1024, String(budget.textureSize));
check("5 review viewpoints", (spec.qualityTargets.reviewViewpoints ?? []).length === 5);

// ---------------------------------------------------------------------------
section("palette: violet 250-315 or neutral");
const colorSource = { materials: spec.materials, lighting: spec.lightingFromPhoto, background: spec.qualityContract?.featureGroups };
const colors = [...new Set(collectHexColors(colorSource))];
const offPalette = colors
  .map((hex) => ({ hex, hsl: hexToHsl(hex) }))
  .filter(({ hsl }) => hsl && !(hsl.h >= 250 && hsl.h <= 315) && !(hsl.s < 0.08) && !(hsl.l < 0.03));
check("all material/lighting colours inside hue 250-315 or neutral", offPalette.length === 0, offPalette.map((c) => `${c.hex} h=${c.hsl.h.toFixed(1)}`).join(", "));

// ---------------------------------------------------------------------------
section("material engine flags");
const glassPanel = materials.get("glass-panel");
const glassBase = materials.get("glass-base");
const neon = materials.get("neon-edge");
const coreGlass = materials.get("core-glass");
const glow = materials.get("glow-sprite");
check("glass-panel is additive, non-depth-writing, double sided", glassPanel.blending === "additive" && glassPanel.depthWrite === false && glassPanel.side === "DoubleSide");
check("glass-panel opacity 0.15", near(glassPanel.opacity, 0.15, 1e-9), String(glassPanel.opacity));
check("glass-panel emissive violet #6e1eff at 0.9", glassPanel.emissive.toUpperCase() === "#6E1EFF" && near(glassPanel.emissiveIntensity, 0.9, 1e-9), `${glassPanel.emissive} x${glassPanel.emissiveIntensity}`);
check("glass-panel clearcoat on with roughness >= floor", glassPanel.clearcoat === 1 && glassPanel.clearcoatRoughness >= 0.0525);
check("glass-base writes depth and is semi-opaque", glassBase.depthWrite === true && glassBase.opacity > 0.5 && glassBase.opacity < 0.9, String(glassBase.opacity));
check("glass-base emissive violet #5614c8 at 0.85", glassBase.emissive.toUpperCase() === "#5614C8" && near(glassBase.emissiveIntensity, 0.85, 1e-9), `${glassBase.emissive} x${glassBase.emissiveIntensity}`);
check("neon-edge is HDR additive basic", neon.type === "basic" && neon.blending === "additive" && neon.depthWrite === false && neon.toneMapped === false);
check("neon-edge linear RGB exceeds 1.0", neon.emissiveLinear.every((v) => v > 1.0), JSON.stringify(neon.emissiveLinear));
check("neon-edge has >= 5 local overrides", (neon.localOverrides ?? []).length >= 5);
check("core-glass is depth-writing with tuned emissive 1.15", coreGlass.depthWrite === true && near(coreGlass.emissiveIntensity, 1.15, 1e-9), String(coreGlass.emissiveIntensity));
check("glow-sprite halo opacity 0.4", near(glow.opacity, 0.4, 1e-9), String(glow.opacity));
check("glow-sprite is a utility sprite", glow.type === "sprite" && glow.qualityTier === "utility");

const innerBase = materials.get("glass-base-inner");
const lightSheet = materials.get("light-sheet");
check("glass-base-inner exists and writes depth", Boolean(innerBase) && innerBase.depthWrite === true);
check(
  "glass-base-inner is darker than glass-base",
  Boolean(innerBase) && innerBase.baseColor.toUpperCase() === "#170528" && innerBase.emissive.toUpperCase() === "#0A0212" && innerBase.opacity > 0.9,
  innerBase ? `${innerBase.baseColor} / ${innerBase.emissive} / ${innerBase.opacity}` : "missing",
);
check(
  "inner slab material is assigned to base-inner",
  component("base-inner")?.material === "glass-base-inner" && component("base-inner")?.materialLayers?.includes("glass-base-inner"),
  component("base-inner")?.material,
);
check(
  "light-sheet is additive, non-depth-writing, FrontSide and utility",
  Boolean(lightSheet) && lightSheet.type === "basic" && lightSheet.blending === "additive" && lightSheet.depthWrite === false && lightSheet.side === "FrontSide" && lightSheet.qualityTier === "utility",
);
check(
  "light-sheet HDR violet linear values",
  Boolean(lightSheet) && near(lightSheet.emissiveLinear[0], 0.75, 1e-9) && near(lightSheet.emissiveLinear[1], 0.38, 1e-9) && near(lightSheet.emissiveLinear[2], 1.35, 1e-9),
  JSON.stringify(lightSheet?.emissiveLinear),
);
check(
  "no material uses transmission/thickness/attenuation",
  [...materials.values()].every((m) => m.transmission === undefined && m.thickness === undefined && m.attenuationDistance === undefined),
);
check(
  "no material sets both ior and reflectivity",
  [...materials.values()].every((m) => !(m.ior !== undefined && m.reflectivity !== undefined)),
);
check(
  "no sheen without sheenColor",
  [...materials.values()].every((m) => !(typeof m.sheen === "number" && m.sheen > 0 && !m.sheenColor)),
);
check(
  "clearcoatRoughness never below three's 0.0525 clamp",
  [...materials.values()].every((m) => m.clearcoatRoughness === undefined || m.clearcoatRoughness >= 0.0525),
);
check(
  "clearcoat roughness >= 0.4 avoids mirror punctual highlights",
  [...materials.values()].every((m) => m.clearcoatRoughness === undefined || m.clearcoatRoughness >= 0.4),
);
const specText = JSON.stringify(spec);
check(
  "spec records tuned bloom 0.05/0.25/1.00",
  specText.includes("strength 0.05, radius 0.25, threshold 1.00") && specText.includes("bloom 0.05/0.25/1.00"),
);
check(
  "spec records key (-2.6, 3.4, 2.8) and core lights",
  specText.includes("front-left-high at (-2.6, 3.4, 2.8) (#b07bff, intensity 1.5") &&
    specText.includes("#ff5ce0 point at the core centre (0, 0.80, 0), intensity 1.5,"),
);
check("spec records under-base intensity 1.8", specText.includes("(#b23cff, intensity 1.8, distance 3)"));

// ---------------------------------------------------------------------------
section("attachment contracts");
for (const [id, comp] of components) {
  if (!comp.attachment) continue;
  const a = comp.attachment;
  const suspended = a.contactType === "suspended";
  const seatedLoose = a.contactType === "seated-in-opening";
  const resting = a.contactType === "rest";
  const anchored =
    (typeof a.embedDepth === "number" && a.embedDepth > 0) ||
    (typeof a.overlap === "number" && a.overlap > 0) ||
    (suspended && near(a.embedDepth, 0, 1e-9)) ||
    (seatedLoose && near(a.embedDepth, 0, 1e-9)) ||
    (resting && near(a.embedDepth, 0, 1e-9));
  check(
    `${id} attachment is complete`,
    typeof a.parentSocket === "string" &&
      Array.isArray(a.localStart) &&
      a.localStart.length === 3 &&
      Array.isArray(a.localEnd) &&
      a.localEnd.length === 3 &&
      typeof a.contactType === "string" &&
      typeof a.gapTolerance === "number" &&
      a.gapTolerance >= 0 &&
      anchored,
    JSON.stringify(a),
  );
}
for (const id of primaryParts) {
  check(`${id} declares a pivot`, typeof component(id).actionProfile?.pivot?.mode === "string");
  check(`${id} declares a collider`, typeof component(id).actionProfile?.collider?.type === "string");
  check(`${id} declares at least one socket`, (component(id).actionProfile?.sockets ?? []).length >= 1 && component(id).actionProfile.sockets.every((s) => s.id));
}

// ---------------------------------------------------------------------------
section("detail inventory");
const inventory = spec.preSpecAssessment.detailInventory;
const linkKeys = new Set();
for (const comp of spec.componentTree) {
  linkKeys.add(comp.id);
  for (const feature of comp.localFeatures ?? []) {
    linkKeys.add(feature.id);
    linkKeys.add(`${comp.id}/${feature.id}`);
  }
}
for (const material of spec.materials) {
  linkKeys.add(material.id);
  for (const override of material.localOverrides ?? []) {
    linkKeys.add(override.id);
    linkKeys.add(`${material.id}/${override.id}`);
  }
}
check("targetMinDetails 12", inventory.targetMinDetails === 12, String(inventory.targetMinDetails));
check("enumerated details meet the target", inventory.details.length >= inventory.targetMinDetails, `${inventory.details.length}/${inventory.targetMinDetails}`);
const unresolved = inventory.details.filter((detail) => !linkKeys.has(detail.mapsTo?.ref));
check("every detail maps to a component.localFeatures or material.localOverrides entry", unresolved.length === 0, unresolved.map((d) => `${d.id} -> ${d.mapsTo?.ref}`).join(", "));
check("every detail carries view evidence", inventory.details.every((detail) => (detail.evidenceRefs ?? []).length > 0));

// ---------------------------------------------------------------------------
section("evidence refs");
const danglingRefs = [];
for (const comp of spec.componentTree) {
  for (const ref of comp.evidenceRefs ?? []) if (!evidenceIds.has(ref)) danglingRefs.push(`${comp.id}:${ref}`);
  for (const feature of comp.localFeatures ?? []) {
    for (const ref of feature.evidenceRefs ?? []) if (!evidenceIds.has(ref)) danglingRefs.push(`${comp.id}/${feature.id}:${ref}`);
  }
}
for (const material of spec.materials) {
  for (const override of material.localOverrides ?? []) {
    for (const ref of override.evidenceRefs ?? []) if (!evidenceIds.has(ref)) danglingRefs.push(`${material.id}/${override.id}:${ref}`);
  }
}
check("all evidence refs resolve to viewEvidence ids", danglingRefs.length === 0, danglingRefs.join(", "));
check("at least 4 evidence views", evidenceIds.size >= 4, String(evidenceIds.size));

// ---------------------------------------------------------------------------
section("feature review targets");
const passCritical = new Map();
const passImportant = new Map();
const targetIds = new Set();
const componentRefs = new Set(spec.componentTree.map((c) => c.id));
const badTargets = [];
for (const target of spec.featureReviewTargets ?? []) {
  if (targetIds.has(target.id)) badTargets.push(`duplicate ${target.id}`);
  targetIds.add(target.id);
  for (const pass of target.passIds ?? []) {
    if (target.tier === "critical") passCritical.set(pass, (passCritical.get(pass) ?? 0) + 1);
    if (target.tier === "important") passImportant.set(pass, (passImportant.get(pass) ?? 0) + 1);
  }
  for (const ref of target.componentRefs ?? []) if (!componentRefs.has(ref)) badTargets.push(`${target.id}: unknown ${ref}`);
  for (const ref of target.evidenceRefs ?? []) if (!evidenceIds.has(ref)) badTargets.push(`${target.id}: unknown evidence ${ref}`);
}
check("feature targets are internally consistent", badTargets.length === 0, badTargets.join(", "));
const overCritical = [...passCritical].filter(([, count]) => count > 5);
const overImportant = [...passImportant].filter(([, count]) => count > 3);
check("<= 5 critical targets per pass", overCritical.length === 0, overCritical.map(([p, n]) => `${p}=${n}`).join(", "));
check("<= 3 important targets per pass", overImportant.length === 0, overImportant.map(([p, n]) => `${p}=${n}`).join(", "));

// ---------------------------------------------------------------------------
section("textureless declarations");
const textureFields = ["normal", "bump", "displacement", "surfaceFrequencyBands", "textureProjection", "textureResolution", "referencePbr"];
for (const material of spec.materials) {
  if (material.textureless?.declared !== true) {
    if (material.qualityTier !== "utility") {
      check(`${material.id} is either textureless-with-evidence or a utility material`, false, "no textureless declaration");
    }
    continue;
  }
  check(`${material.id} textureless evidence is present`, (material.textureless.evidence ?? []).some((e) => typeof e === "string" && e.trim()));
  const offenders = textureFields.filter((field) => material[field] !== undefined);
  check(`${material.id} textureless conflicts with no texture field`, offenders.length === 0, offenders.join(", "));
}

// ---------------------------------------------------------------------------
section("pipeline and procedure");
const pipeline = spec.sculptPipeline;
check("8 locked passes in order", (pipeline.passOrder ?? []).length === 8 && pipeline.passGateMode === "locked-sequential");
check("spec starts at blockout with nothing completed", pipeline.currentPass === "blockout" && pipeline.completedPasses.length === 0);
check("no review history claimed", (spec.reviewHistory ?? []).length === 0);
check("procedural strategy has >= 5 steps", (spec.proceduralStrategy ?? []).length >= 5);
check("build passes cover every primary part", (spec.buildPasses ?? []).length === 8 && spec.buildPasses[0].id === "blockout");
check("silhouette states total height 1.46", String(spec.silhouette?.boundingShape ?? "").includes("1.46"));
check("stress-test risk register is populated or consciously empty", Array.isArray(spec.risks));

// ---------------------------------------------------------------------------
section("result");
report();
process.stdout.write(
  `\n${failures.length === 0 ? "PASS" : "FAIL"}: ${checks.length - failures.length}/${checks.length} semantic checks passed\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
