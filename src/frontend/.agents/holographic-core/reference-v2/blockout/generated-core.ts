import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

function buildLatheGeometry(profile: { points: [number, number][]; segments?: number }): THREE.LatheGeometry {
  const points = profile.points.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y));
  return new THREE.LatheGeometry(points, profile.segments ?? 24);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Holographic Orbital Data Core v2
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createHolographicOrbitalDataCoreV2Model(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Holographic Orbital Data Core v2";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "status": "initial-hypothesis-only", "fovDegrees": 40, "aspect": 1.3, "orientation": {"yaw": 0.7853981633974483, "pitch": 0.3490658503988659, "roll": 0}, "orientationUnits": "radians", "positionHint": [5, 3.7436582079968796, 5], "lookAtProposal": [0, 1.17, 0], "note": "Only the primary image is a quantitative appearance target. Position and look-at are initial framing hypotheses; later browser overlays must establish camera alignment."}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["blue-volume"] = createSculptMaterial(
    "blue-volume",
    {"id": "blue-volume", "name": "core cylindrical faces", "type": "physical", "shaderModel": "Generator-supported MeshPhysicalMaterial: matte, emission-dominant alpha carrier", "baseColor": "#155CEB", "emissive": "#155CEB", "emissiveIntensity": 0.9, "opacity": 0.32, "transparent": true, "doubleSided": true, "roughness": 0.85, "metalness": 0, "transmission": 0, "thickness": 0, "clearcoat": 0, "specularF0": 0.02, "envMapIntensity": 0, "albedo": {"dominant": "#155CEB", "secondary": ["#168FEF"], "samplingNotes": "Display color proposal from primary image color families, not sampled physical albedo."}, "textureless": {"declared": true, "evidence": ["reference-primary.png and zones: no physical grain, scratches, pores, or tactile relief is resolved on this uniform luminous carrier.", "material-evidence-formal.json: geometric grids, contour paths, glyph instances and per-submesh scalar changes carry the observed detail; this carrier declaration does not remove scene patterns.", "All technical details remain assigned to localFeatures, repetitionSystems and renderLayerContract; if maps/shader sampling replace them, re-review material applicability."]}, "localOverrides": [{"id": "blue-volume.local-density", "region": "core cylindrical faces", "realization": "separate named submesh material scalars; not a bitmap mask", "proposedAlphaRange": [0.16, 0.44799999999999995], "note": "Runtime inspection required; stock generator does not establish localOverride emission."}], "materialEvidence": {"path": "material-evidence-formal.json", "status": "specification evidence only; not runtime accepted", "physicalPbrRecovered": false}, "rendererIntent": {"depthWrite": false, "blending": "normal on faces; selective additive lines only after bloom-off review"}, "runtimeLimitations": ["Generator material class is physical regardless of a basic label.", "Per-submesh alpha, depthWrite and blend intent require separate runtime verification.", "Emission does not itself create bloom."]},
    options
  );
  materialMap["cyan-contour"] = createSculptMaterial(
    "cyan-contour",
    {"id": "cyan-contour", "name": "caps, thin contour carriers and localized highlights", "type": "physical", "shaderModel": "Generator-supported MeshPhysicalMaterial: matte, emission-dominant alpha carrier", "baseColor": "#29D9FF", "emissive": "#29D9FF", "emissiveIntensity": 1.5, "opacity": 0.48, "transparent": true, "doubleSided": true, "roughness": 0.85, "metalness": 0, "transmission": 0, "thickness": 0, "clearcoat": 0, "specularF0": 0.02, "envMapIntensity": 0, "albedo": {"dominant": "#29D9FF", "secondary": ["#71EBFF"], "samplingNotes": "Display color proposal from primary image color families, not sampled physical albedo."}, "textureless": {"declared": true, "evidence": ["reference-primary.png and zones: no physical grain, scratches, pores, or tactile relief is resolved on this uniform luminous carrier.", "material-evidence-formal.json: geometric grids, contour paths, glyph instances and per-submesh scalar changes carry the observed detail; this carrier declaration does not remove scene patterns.", "All technical details remain assigned to localFeatures, repetitionSystems and renderLayerContract; if maps/shader sampling replace them, re-review material applicability."]}, "localOverrides": [{"id": "cyan-contour.local-density", "region": "caps, thin contour carriers and localized highlights", "realization": "separate named submesh material scalars; not a bitmap mask", "proposedAlphaRange": [0.24, 0.65], "note": "Runtime inspection required; stock generator does not establish localOverride emission."}], "materialEvidence": {"path": "material-evidence-formal.json", "status": "specification evidence only; not runtime accepted", "physicalPbrRecovered": false}, "rendererIntent": {"depthWrite": false, "blending": "normal on faces; selective additive lines only after bloom-off review"}, "runtimeLimitations": ["Generator material class is physical regardless of a basic label.", "Per-submesh alpha, depthWrite and blend intent require separate runtime verification.", "Emission does not itself create bloom."]},
    options
  );
  materialMap["violet-band"] = createSculptMaterial(
    "violet-band",
    {"id": "violet-band", "name": "base-registered violet band and selected lower accents", "type": "physical", "shaderModel": "Generator-supported MeshPhysicalMaterial: matte, emission-dominant alpha carrier", "baseColor": "#9B58F6", "emissive": "#9B58F6", "emissiveIntensity": 1.2, "opacity": 0.26, "transparent": true, "doubleSided": true, "roughness": 0.85, "metalness": 0, "transmission": 0, "thickness": 0, "clearcoat": 0, "specularF0": 0.02, "envMapIntensity": 0, "albedo": {"dominant": "#9B58F6", "secondary": ["#C57BFF"], "samplingNotes": "Display color proposal from primary image color families, not sampled physical albedo."}, "textureless": {"declared": true, "evidence": ["reference-primary.png and zones: no physical grain, scratches, pores, or tactile relief is resolved on this uniform luminous carrier.", "material-evidence-formal.json: geometric grids, contour paths, glyph instances and per-submesh scalar changes carry the observed detail; this carrier declaration does not remove scene patterns.", "All technical details remain assigned to localFeatures, repetitionSystems and renderLayerContract; if maps/shader sampling replace them, re-review material applicability."]}, "localOverrides": [{"id": "violet-band.local-density", "region": "base-registered violet band and selected lower accents", "realization": "separate named submesh material scalars; not a bitmap mask", "proposedAlphaRange": [0.13, 0.364], "note": "Runtime inspection required; stock generator does not establish localOverride emission."}], "materialEvidence": {"path": "material-evidence-formal.json", "status": "specification evidence only; not runtime accepted", "physicalPbrRecovered": false}, "rendererIntent": {"depthWrite": false, "blending": "normal on faces; selective additive lines only after bloom-off review"}, "runtimeLimitations": ["Generator material class is physical regardless of a basic label.", "Per-submesh alpha, depthWrite and blend intent require separate runtime verification.", "Emission does not itself create bloom."]},
    options
  );
  materialMap["blue-face"] = createSculptMaterial(
    "blue-face",
    {"id": "blue-face", "name": "tower faces, annular base wall and sector faces", "type": "physical", "shaderModel": "Generator-supported MeshPhysicalMaterial: matte, emission-dominant alpha carrier", "baseColor": "#1161D5", "emissive": "#1161D5", "emissiveIntensity": 0.65, "opacity": 0.1, "transparent": true, "doubleSided": true, "roughness": 0.85, "metalness": 0, "transmission": 0, "thickness": 0, "clearcoat": 0, "specularF0": 0.02, "envMapIntensity": 0, "albedo": {"dominant": "#1161D5", "secondary": ["#1BA8F5"], "samplingNotes": "Display color proposal from primary image color families, not sampled physical albedo."}, "textureless": {"declared": true, "evidence": ["reference-primary.png and zones: no physical grain, scratches, pores, or tactile relief is resolved on this uniform luminous carrier.", "material-evidence-formal.json: geometric grids, contour paths, glyph instances and per-submesh scalar changes carry the observed detail; this carrier declaration does not remove scene patterns.", "All technical details remain assigned to localFeatures, repetitionSystems and renderLayerContract; if maps/shader sampling replace them, re-review material applicability."]}, "localOverrides": [{"id": "blue-face.local-density", "region": "tower faces, annular base wall and sector faces", "realization": "separate named submesh material scalars; not a bitmap mask", "proposedAlphaRange": [0.05, 0.13999999999999999], "note": "Runtime inspection required; stock generator does not establish localOverride emission."}], "materialEvidence": {"path": "material-evidence-formal.json", "status": "specification evidence only; not runtime accepted", "physicalPbrRecovered": false}, "rendererIntent": {"depthWrite": false, "blending": "normal on faces; selective additive lines only after bloom-off review"}, "runtimeLimitations": ["Generator material class is physical regardless of a basic label.", "Per-submesh alpha, depthWrite and blend intent require separate runtime verification.", "Emission does not itself create bloom."]},
    options
  );
  materialMap["field-fill"] = createSculptMaterial(
    "field-fill",
    {"id": "field-fill", "name": "very faint deck and inner projection carrier; no opaque interior floor", "type": "physical", "shaderModel": "Generator-supported MeshPhysicalMaterial: matte, emission-dominant alpha carrier", "baseColor": "#1558E0", "emissive": "#1558E0", "emissiveIntensity": 0.45, "opacity": 0.035, "transparent": true, "doubleSided": true, "roughness": 0.85, "metalness": 0, "transmission": 0, "thickness": 0, "clearcoat": 0, "specularF0": 0.02, "envMapIntensity": 0, "albedo": {"dominant": "#1558E0", "secondary": ["#159DE8"], "samplingNotes": "Display color proposal from primary image color families, not sampled physical albedo."}, "textureless": {"declared": true, "evidence": ["reference-primary.png and zones: no physical grain, scratches, pores, or tactile relief is resolved on this uniform luminous carrier.", "material-evidence-formal.json: geometric grids, contour paths, glyph instances and per-submesh scalar changes carry the observed detail; this carrier declaration does not remove scene patterns.", "All technical details remain assigned to localFeatures, repetitionSystems and renderLayerContract; if maps/shader sampling replace them, re-review material applicability."]}, "localOverrides": [{"id": "field-fill.local-density", "region": "very faint deck and inner projection carrier; no opaque interior floor", "realization": "separate named submesh material scalars; not a bitmap mask", "proposedAlphaRange": [0.0175, 0.049], "note": "Runtime inspection required; stock generator does not establish localOverride emission."}], "materialEvidence": {"path": "material-evidence-formal.json", "status": "specification evidence only; not runtime accepted", "physicalPbrRecovered": false}, "rendererIntent": {"depthWrite": false, "blending": "normal on faces; selective additive lines only after bloom-off review"}, "runtimeLimitations": ["Generator material class is physical regardless of a basic label.", "Per-submesh alpha, depthWrite and blend intent require separate runtime verification.", "Emission does not itself create bloom."]},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_core_upper_0 = null;
  const endpoint_core_upper_0 = makeAttachmentEndpoint(attachment_core_upper_0);
  const node_core_upper_0 = new THREE.Group();
  node_core_upper_0.name = "Upper narrow core__pivot";
  node_core_upper_0.scale.set(1, 1, 1);
  if (endpoint_core_upper_0) {
    node_core_upper_0.position.copy(endpoint_core_upper_0.start);
    node_core_upper_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_core_upper_0.position.set(0.0, 1.9, 0.0);
    node_core_upper_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_core_upper_0.userData.sculptComponent = {"id": "core-upper", "name": "Upper narrow core", "level": "macro", "role": "projected-part", "importance": 1, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Discrete geometric carrier observed in the primary reference.", "parent": null, "dimensions": {"width": 1.8, "height": 1.2, "depth": 1.8, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 1.9, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Discrete geometric carrier observed in the primary reference.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-volume", "materialLayers": ["blue-volume"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "core-top", "localPosition": [0, 0.6, 0], "localRotation": [0, 0, 0]}], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-volume"}}, "localFeatures": [{"id": "core-upper.upper-grid", "description": "Horizontal and vertical grid on a colored cylindrical carrier, dimmer than main contours.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-upper", "memberComponentRefs": ["core-upper"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "core-upper.blue-volume", "description": "Saturated blue fill remains visible; no clear colorless glass.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-upper", "memberComponentRefs": ["core-upper"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_core_upper_0.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "core-top", "localPosition": [0, 0.6, 0], "localRotation": [0, 0, 0]}], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-volume"}};
  (nodes["root"] ?? root).add(node_core_upper_0);
  nodes["core-upper"] = node_core_upper_0;
  const mesh_core_upper_0Geometry = endpoint_core_upper_0
    ? new THREE.CylinderGeometry(endpoint_core_upper_0.endRadius, endpoint_core_upper_0.baseRadius, endpoint_core_upper_0.length, 16, 6)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8);
  if (!endpoint_core_upper_0) {
    mesh_core_upper_0Geometry.scale(1.8, 1.2, 1.8);
  }
  const mesh_core_upper_0 = new THREE.Mesh(
    mesh_core_upper_0Geometry,
    materialMap["blue-volume"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_core_upper_0.name = "Upper narrow core";
  if (endpoint_core_upper_0) {
    mesh_core_upper_0.position.copy(endpoint_core_upper_0.midpoint);
    mesh_core_upper_0.quaternion.copy(endpoint_core_upper_0.quaternion);
  }
  mesh_core_upper_0.castShadow = options.castShadow ?? true;
  mesh_core_upper_0.receiveShadow = options.receiveShadow ?? true;
  mesh_core_upper_0.userData.sculptComponent = {"id": "core-upper", "name": "Upper narrow core", "level": "macro", "role": "projected-part", "importance": 1, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Discrete geometric carrier observed in the primary reference.", "parent": null, "dimensions": {"width": 1.8, "height": 1.2, "depth": 1.8, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 1.9, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Discrete geometric carrier observed in the primary reference.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-volume", "materialLayers": ["blue-volume"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "core-top", "localPosition": [0, 0.6, 0], "localRotation": [0, 0, 0]}], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-volume"}}, "localFeatures": [{"id": "core-upper.upper-grid", "description": "Horizontal and vertical grid on a colored cylindrical carrier, dimmer than main contours.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-upper", "memberComponentRefs": ["core-upper"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "core-upper.blue-volume", "description": "Saturated blue fill remains visible; no clear colorless glass.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-upper", "memberComponentRefs": ["core-upper"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_core_upper_0.add(mesh_core_upper_0);
  meshes["core-upper"] = mesh_core_upper_0;
  colliders["core-upper"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["core-upper"] ??= [];
  destructionGroups["core-upper"].push(node_core_upper_0);
  const socket_core_upper_core_top_0 = new THREE.Object3D();
  socket_core_upper_core_top_0.name = "core-top";
  socket_core_upper_core_top_0.position.set(0.0, 0.6, 0.0);
  socket_core_upper_core_top_0.rotation.set(0.0, 0.0, 0.0);
  socket_core_upper_core_top_0.userData.socket = {"id": "core-top", "localPosition": [0, 0.6, 0], "localRotation": [0, 0, 0]};
  node_core_upper_0.add(socket_core_upper_core_top_0);
  sockets["core-upper:core-top"] = socket_core_upper_core_top_0;

  const attachment_core_cap_1 = {"parentId": "core-upper", "parentSocket": "core-top", "localStart": [0, 0.58, 0], "localEnd": [0, 0.62, 0], "baseRadius": 0.92, "endRadius": 0.92, "contactType": "overlap", "overlap": 0.02, "gapTolerance": 0.001, "evidenceRefs": ["primary"], "note": "Parent-centered endpoints imply world Y [2.48,2.52]; overlap upper body's top 2.5 by 0.02."};
  const endpoint_core_cap_1 = makeAttachmentEndpoint(attachment_core_cap_1);
  const node_core_cap_1 = new THREE.Group();
  node_core_cap_1.name = "Closed luminous upper cap__pivot";
  node_core_cap_1.scale.set(1, 1, 1);
  if (endpoint_core_cap_1) {
    node_core_cap_1.position.copy(endpoint_core_cap_1.start);
    node_core_cap_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_core_cap_1.position.set(0.0, 0.58, 0.0);
    node_core_cap_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_core_cap_1.userData.sculptComponent = {"id": "core-cap", "name": "Closed luminous upper cap", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Discrete geometric carrier observed in the primary reference.", "parent": "core-upper", "dimensions": {"width": 1.84, "height": 0.04, "depth": 1.84, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.58, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Discrete geometric carrier observed in the primary reference.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "cyan-contour", "materialLayers": ["cyan-contour"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 217, 255, 0.48)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "attachment-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-cap", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}}, "localFeatures": [{"id": "core-cap.cap-radial-grid", "description": "Concentric circles and radial spokes, not an open cup.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-cap", "memberComponentRefs": ["core-cap"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "core-cap.cap-center-light", "description": "Small intense cyan center with lower intensity toward the rim.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-cap", "memberComponentRefs": ["core-cap", "cap-center-light"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false, "ownerScope": "Reference-detail implementation responsibility; does not imply physical transform ownership."}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "attachment": {"parentId": "core-upper", "parentSocket": "core-top", "localStart": [0, 0.58, 0], "localEnd": [0, 0.62, 0], "baseRadius": 0.92, "endRadius": 0.92, "contactType": "overlap", "overlap": 0.02, "gapTolerance": 0.001, "evidenceRefs": ["primary"], "note": "Parent-centered endpoints imply world Y [2.48,2.52]; overlap upper body's top 2.5 by 0.02."}};
  node_core_cap_1.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "attachment-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-cap", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}};
  (nodes["core-upper"] ?? root).add(node_core_cap_1);
  nodes["core-cap"] = node_core_cap_1;
  const mesh_core_cap_1Geometry = endpoint_core_cap_1
    ? new THREE.CylinderGeometry(endpoint_core_cap_1.endRadius, endpoint_core_cap_1.baseRadius, endpoint_core_cap_1.length, 16, 6)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8);
  if (!endpoint_core_cap_1) {
    mesh_core_cap_1Geometry.scale(1.84, 0.04, 1.84);
  }
  const mesh_core_cap_1 = new THREE.Mesh(
    mesh_core_cap_1Geometry,
    materialMap["cyan-contour"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_core_cap_1.name = "Closed luminous upper cap";
  if (endpoint_core_cap_1) {
    mesh_core_cap_1.position.copy(endpoint_core_cap_1.midpoint);
    mesh_core_cap_1.quaternion.copy(endpoint_core_cap_1.quaternion);
  }
  mesh_core_cap_1.castShadow = options.castShadow ?? true;
  mesh_core_cap_1.receiveShadow = options.receiveShadow ?? true;
  mesh_core_cap_1.userData.sculptComponent = {"id": "core-cap", "name": "Closed luminous upper cap", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Discrete geometric carrier observed in the primary reference.", "parent": "core-upper", "dimensions": {"width": 1.84, "height": 0.04, "depth": 1.84, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.58, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Discrete geometric carrier observed in the primary reference.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "cyan-contour", "materialLayers": ["cyan-contour"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 217, 255, 0.48)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "attachment-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-cap", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}}, "localFeatures": [{"id": "core-cap.cap-radial-grid", "description": "Concentric circles and radial spokes, not an open cup.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-cap", "memberComponentRefs": ["core-cap"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "core-cap.cap-center-light", "description": "Small intense cyan center with lower intensity toward the rim.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-cap", "memberComponentRefs": ["core-cap", "cap-center-light"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false, "ownerScope": "Reference-detail implementation responsibility; does not imply physical transform ownership."}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "attachment": {"parentId": "core-upper", "parentSocket": "core-top", "localStart": [0, 0.58, 0], "localEnd": [0, 0.62, 0], "baseRadius": 0.92, "endRadius": 0.92, "contactType": "overlap", "overlap": 0.02, "gapTolerance": 0.001, "evidenceRefs": ["primary"], "note": "Parent-centered endpoints imply world Y [2.48,2.52]; overlap upper body's top 2.5 by 0.02."}};
  node_core_cap_1.add(mesh_core_cap_1);
  meshes["core-cap"] = mesh_core_cap_1;
  colliders["core-cap"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["core-cap"] ??= [];
  destructionGroups["core-cap"].push(node_core_cap_1);

  const attachment_core_lower_2 = null;
  const endpoint_core_lower_2 = makeAttachmentEndpoint(attachment_core_lower_2);
  const node_core_lower_2 = new THREE.Group();
  node_core_lower_2.name = "Lower narrow core__pivot";
  node_core_lower_2.scale.set(1, 1, 1);
  if (endpoint_core_lower_2) {
    node_core_lower_2.position.copy(endpoint_core_lower_2.start);
    node_core_lower_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_core_lower_2.position.set(0.0, 0.825, 0.0);
    node_core_lower_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_core_lower_2.userData.sculptComponent = {"id": "core-lower", "name": "Lower narrow core", "level": "macro", "role": "projected-part", "importance": 1, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Discrete geometric carrier observed in the primary reference.", "parent": null, "dimensions": {"width": 1.8, "height": 0.9500000000000001, "depth": 1.8, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.825, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Discrete geometric carrier observed in the primary reference.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-volume", "materialLayers": ["blue-volume"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-lower", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-volume"}}, "localFeatures": [{"id": "core-lower.lower-grid", "description": "Regular cylindrical grid and localized data blocks; no evenly spaced floating shelves.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-lower", "memberComponentRefs": ["core-lower"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_core_lower_2.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-lower", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-volume"}};
  (nodes["root"] ?? root).add(node_core_lower_2);
  nodes["core-lower"] = node_core_lower_2;
  const mesh_core_lower_2Geometry = endpoint_core_lower_2
    ? new THREE.CylinderGeometry(endpoint_core_lower_2.endRadius, endpoint_core_lower_2.baseRadius, endpoint_core_lower_2.length, 16, 6)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8);
  if (!endpoint_core_lower_2) {
    mesh_core_lower_2Geometry.scale(1.8, 0.9500000000000001, 1.8);
  }
  const mesh_core_lower_2 = new THREE.Mesh(
    mesh_core_lower_2Geometry,
    materialMap["blue-volume"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_core_lower_2.name = "Lower narrow core";
  if (endpoint_core_lower_2) {
    mesh_core_lower_2.position.copy(endpoint_core_lower_2.midpoint);
    mesh_core_lower_2.quaternion.copy(endpoint_core_lower_2.quaternion);
  }
  mesh_core_lower_2.castShadow = options.castShadow ?? true;
  mesh_core_lower_2.receiveShadow = options.receiveShadow ?? true;
  mesh_core_lower_2.userData.sculptComponent = {"id": "core-lower", "name": "Lower narrow core", "level": "macro", "role": "projected-part", "importance": 1, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Discrete geometric carrier observed in the primary reference.", "parent": null, "dimensions": {"width": 1.8, "height": 0.9500000000000001, "depth": 1.8, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.825, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Discrete geometric carrier observed in the primary reference.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-volume", "materialLayers": ["blue-volume"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-lower", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-volume"}}, "localFeatures": [{"id": "core-lower.lower-grid", "description": "Regular cylindrical grid and localized data blocks; no evenly spaced floating shelves.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-lower", "memberComponentRefs": ["core-lower"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_core_lower_2.add(mesh_core_lower_2);
  meshes["core-lower"] = mesh_core_lower_2;
  colliders["core-lower"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["core-lower"] ??= [];
  destructionGroups["core-lower"].push(node_core_lower_2);

  const endpoint_core_mid_collar_3 = makeAttachmentEndpoint(null);
  const node_core_mid_collar_3 = new THREE.Group();
  node_core_mid_collar_3.name = "Broad open middle collar__pivot";
  node_core_mid_collar_3.scale.set(1, 1, 1);
  if (endpoint_core_mid_collar_3) {
    node_core_mid_collar_3.position.copy(endpoint_core_mid_collar_3.start);
    node_core_mid_collar_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_core_mid_collar_3.position.set(0.0, 1.18, 0.0);
    node_core_mid_collar_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_core_mid_collar_3.userData.sculptComponent = {"id": "core-mid-collar", "name": "Broad open middle collar", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": null, "dimensions": {"width": 2.9, "height": 0.22, "depth": 2.9, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 1.18, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.31551724137931036, -0.5], [0.5, -0.5], [0.5, 0.5], [0.31551724137931036, 0.5], [0.31551724137931036, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 0.915, "outerRadius": 1.45, "worldCenterY": 1.18, "worldHeight": 0.22}}, "material": "cyan-contour", "materialLayers": ["cyan-contour"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 217, 255, 0.48)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-mid-collar", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}}, "localFeatures": [{"id": "core-mid-collar.mid-annulus", "description": "Preserve open center around the core; do not use a wider solid cylinder that hides the core.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-mid-collar", "memberComponentRefs": ["core-mid-collar"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "core-mid-collar.mid-rim", "description": "Bright upper/front contour and subdued rear contour.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-mid-collar", "memberComponentRefs": ["core-mid-collar"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_core_mid_collar_3.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-mid-collar", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}};
  (nodes["root"] ?? root).add(node_core_mid_collar_3);
  nodes["core-mid-collar"] = node_core_mid_collar_3;
  const mesh_core_mid_collar_3Geometry = endpoint_core_mid_collar_3
    ? new THREE.CylinderGeometry(endpoint_core_mid_collar_3.endRadius, endpoint_core_mid_collar_3.baseRadius, endpoint_core_mid_collar_3.length, 16, 6)
    : buildLatheGeometry({"points": [[0.31551724137931036, -0.5], [0.5, -0.5], [0.5, 0.5], [0.31551724137931036, 0.5], [0.31551724137931036, -0.5]], "segments": 96});
  if (!endpoint_core_mid_collar_3) {
    mesh_core_mid_collar_3Geometry.scale(2.9, 0.22, 2.9);
  }
  const mesh_core_mid_collar_3 = new THREE.Mesh(
    mesh_core_mid_collar_3Geometry,
    materialMap["cyan-contour"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_core_mid_collar_3.name = "Broad open middle collar";
  if (endpoint_core_mid_collar_3) {
    mesh_core_mid_collar_3.position.copy(endpoint_core_mid_collar_3.midpoint);
    mesh_core_mid_collar_3.quaternion.copy(endpoint_core_mid_collar_3.quaternion);
  }
  mesh_core_mid_collar_3.castShadow = options.castShadow ?? true;
  mesh_core_mid_collar_3.receiveShadow = options.receiveShadow ?? true;
  mesh_core_mid_collar_3.userData.sculptComponent = {"id": "core-mid-collar", "name": "Broad open middle collar", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": null, "dimensions": {"width": 2.9, "height": 0.22, "depth": 2.9, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 1.18, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.31551724137931036, -0.5], [0.5, -0.5], [0.5, 0.5], [0.31551724137931036, 0.5], [0.31551724137931036, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 0.915, "outerRadius": 1.45, "worldCenterY": 1.18, "worldHeight": 0.22}}, "material": "cyan-contour", "materialLayers": ["cyan-contour"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 217, 255, 0.48)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-mid-collar", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}}, "localFeatures": [{"id": "core-mid-collar.mid-annulus", "description": "Preserve open center around the core; do not use a wider solid cylinder that hides the core.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-mid-collar", "memberComponentRefs": ["core-mid-collar"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "core-mid-collar.mid-rim", "description": "Bright upper/front contour and subdued rear contour.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-mid-collar", "memberComponentRefs": ["core-mid-collar"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_core_mid_collar_3.add(mesh_core_mid_collar_3);
  meshes["core-mid-collar"] = mesh_core_mid_collar_3;
  colliders["core-mid-collar"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["core-mid-collar"] ??= [];
  destructionGroups["core-mid-collar"].push(node_core_mid_collar_3);

  const endpoint_core_lower_collar_4 = makeAttachmentEndpoint(null);
  const node_core_lower_collar_4 = new THREE.Group();
  node_core_lower_collar_4.name = "Lower open collar__pivot";
  node_core_lower_collar_4.scale.set(1, 1, 1);
  if (endpoint_core_lower_collar_4) {
    node_core_lower_collar_4.position.copy(endpoint_core_lower_collar_4.start);
    node_core_lower_collar_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_core_lower_collar_4.position.set(0.0, 0.44, 0.0);
    node_core_lower_collar_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_core_lower_collar_4.userData.sculptComponent = {"id": "core-lower-collar", "name": "Lower open collar", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": null, "dimensions": {"width": 2.64, "height": 0.07, "depth": 2.64, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.44, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.34659090909090906, -0.5], [0.5, -0.5], [0.5, 0.5], [0.34659090909090906, 0.5], [0.34659090909090906, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 0.915, "outerRadius": 1.32, "worldCenterY": 0.44, "worldHeight": 0.07}}, "material": "violet-band", "materialLayers": ["violet-band"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(155, 88, 246, 0.26)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-lower-collar", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "violet-band"}}, "localFeatures": [{"id": "core-lower-collar.lower-rim", "description": "Lower circular rim with cyan and restrained violet accents.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-lower-collar", "memberComponentRefs": ["core-lower-collar"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_core_lower_collar_4.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-lower-collar", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "violet-band"}};
  (nodes["root"] ?? root).add(node_core_lower_collar_4);
  nodes["core-lower-collar"] = node_core_lower_collar_4;
  const mesh_core_lower_collar_4Geometry = endpoint_core_lower_collar_4
    ? new THREE.CylinderGeometry(endpoint_core_lower_collar_4.endRadius, endpoint_core_lower_collar_4.baseRadius, endpoint_core_lower_collar_4.length, 16, 6)
    : buildLatheGeometry({"points": [[0.34659090909090906, -0.5], [0.5, -0.5], [0.5, 0.5], [0.34659090909090906, 0.5], [0.34659090909090906, -0.5]], "segments": 96});
  if (!endpoint_core_lower_collar_4) {
    mesh_core_lower_collar_4Geometry.scale(2.64, 0.07, 2.64);
  }
  const mesh_core_lower_collar_4 = new THREE.Mesh(
    mesh_core_lower_collar_4Geometry,
    materialMap["violet-band"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_core_lower_collar_4.name = "Lower open collar";
  if (endpoint_core_lower_collar_4) {
    mesh_core_lower_collar_4.position.copy(endpoint_core_lower_collar_4.midpoint);
    mesh_core_lower_collar_4.quaternion.copy(endpoint_core_lower_collar_4.quaternion);
  }
  mesh_core_lower_collar_4.castShadow = options.castShadow ?? true;
  mesh_core_lower_collar_4.receiveShadow = options.receiveShadow ?? true;
  mesh_core_lower_collar_4.userData.sculptComponent = {"id": "core-lower-collar", "name": "Lower open collar", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": null, "dimensions": {"width": 2.64, "height": 0.07, "depth": 2.64, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.44, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.34659090909090906, -0.5], [0.5, -0.5], [0.5, 0.5], [0.34659090909090906, 0.5], [0.34659090909090906, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 0.915, "outerRadius": 1.32, "worldCenterY": 0.44, "worldHeight": 0.07}}, "material": "violet-band", "materialLayers": ["violet-band"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(155, 88, 246, 0.26)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-lower-collar", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "violet-band"}}, "localFeatures": [{"id": "core-lower-collar.lower-rim", "description": "Lower circular rim with cyan and restrained violet accents.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-lower-collar", "memberComponentRefs": ["core-lower-collar"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_core_lower_collar_4.add(mesh_core_lower_collar_4);
  meshes["core-lower-collar"] = mesh_core_lower_collar_4;
  colliders["core-lower-collar"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["core-lower-collar"] ??= [];
  destructionGroups["core-lower-collar"].push(node_core_lower_collar_4);

  const attachment_core_foot_5 = null;
  const endpoint_core_foot_5 = makeAttachmentEndpoint(attachment_core_foot_5);
  const node_core_foot_5 = new THREE.Group();
  node_core_foot_5.name = "Low core projection__pivot";
  node_core_foot_5.scale.set(1, 1, 1);
  if (endpoint_core_foot_5) {
    node_core_foot_5.position.copy(endpoint_core_foot_5.start);
    node_core_foot_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_core_foot_5.position.set(0.0, 0.22499999999999998, 0.0);
    node_core_foot_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_core_foot_5.userData.sculptComponent = {"id": "core-foot", "name": "Low core projection", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Discrete geometric carrier observed in the primary reference.", "parent": null, "dimensions": {"width": 1.92, "height": 0.24999999999999997, "depth": 1.92, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.22499999999999998, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Discrete geometric carrier observed in the primary reference.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-volume", "materialLayers": ["blue-volume"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-foot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-volume"}}, "localFeatures": [{"id": "core-foot.foot-uncertainty", "description": "Approximate low volume only; do not invent mechanical housing or a broad solid pedestal.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-foot", "memberComponentRefs": ["core-foot"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_core_foot_5.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-foot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-volume"}};
  (nodes["root"] ?? root).add(node_core_foot_5);
  nodes["core-foot"] = node_core_foot_5;
  const mesh_core_foot_5Geometry = endpoint_core_foot_5
    ? new THREE.CylinderGeometry(endpoint_core_foot_5.endRadius, endpoint_core_foot_5.baseRadius, endpoint_core_foot_5.length, 16, 6)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8);
  if (!endpoint_core_foot_5) {
    mesh_core_foot_5Geometry.scale(1.92, 0.24999999999999997, 1.92);
  }
  const mesh_core_foot_5 = new THREE.Mesh(
    mesh_core_foot_5Geometry,
    materialMap["blue-volume"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_core_foot_5.name = "Low core projection";
  if (endpoint_core_foot_5) {
    mesh_core_foot_5.position.copy(endpoint_core_foot_5.midpoint);
    mesh_core_foot_5.quaternion.copy(endpoint_core_foot_5.quaternion);
  }
  mesh_core_foot_5.castShadow = options.castShadow ?? true;
  mesh_core_foot_5.receiveShadow = options.receiveShadow ?? true;
  mesh_core_foot_5.userData.sculptComponent = {"id": "core-foot", "name": "Low core projection", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Discrete geometric carrier observed in the primary reference.", "parent": null, "dimensions": {"width": 1.92, "height": 0.24999999999999997, "depth": 1.92, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.22499999999999998, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Discrete geometric carrier observed in the primary reference.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-volume", "materialLayers": ["blue-volume"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-foot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-volume"}}, "localFeatures": [{"id": "core-foot.foot-uncertainty", "description": "Approximate low volume only; do not invent mechanical housing or a broad solid pedestal.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "core-foot", "memberComponentRefs": ["core-foot"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_core_foot_5.add(mesh_core_foot_5);
  meshes["core-foot"] = mesh_core_foot_5;
  colliders["core-foot"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["core-foot"] ??= [];
  destructionGroups["core-foot"].push(node_core_foot_5);

  const endpoint_tower_01_back_high_6 = makeAttachmentEndpoint(null);
  const node_tower_01_back_high_6 = new THREE.Group();
  node_tower_01_back_high_6.name = "Highest rear cuboid tower__pivot";
  node_tower_01_back_high_6.scale.set(1, 1, 1);
  if (endpoint_tower_01_back_high_6) {
    node_tower_01_back_high_6.position.copy(endpoint_tower_01_back_high_6.start);
    node_tower_01_back_high_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tower_01_back_high_6.position.set(-1.449569, 1.775, -1.449569);
    node_tower_01_back_high_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_tower_01_back_high_6.userData.sculptComponent = {"id": "tower-01-back-high", "name": "Highest rear cuboid tower", "level": "macro", "role": "projected-part", "importance": 1, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.76, "height": 2.65, "depth": 0.76, "units": "relative", "confidence": 0.6}, "transform": {"position": [-1.449569, 1.775, -1.449569], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-01-back-high", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-01-back-high.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}, {"id": "tower-assembly.tallest-rear", "description": "One broad highest tower appears behind the core in the primary view.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "tower-assembly", "memberComponentRefs": ["tower-01-back-high", "tower-02", "tower-03", "tower-04", "tower-05", "tower-06", "tower-07", "tower-08", "tower-09"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "tower-assembly.height-hierarchy", "description": "Unequal medium and low tower groups surround the core.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "tower-assembly", "memberComponentRefs": ["tower-01-back-high", "tower-02", "tower-03", "tower-04", "tower-05", "tower-06", "tower-07", "tower-08", "tower-09"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "tower-assembly.radial-order", "description": "Place columns around the core, not as five boxes in a flat row.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "tower-assembly", "memberComponentRefs": ["tower-01-back-high", "tower-02", "tower-03", "tower-04", "tower-05", "tower-06", "tower-07", "tower-08", "tower-09"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "tower-assembly.tower-grid", "description": "Face-aligned sparse grid follows each cuboid.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "tower-assembly", "memberComponentRefs": ["tower-01-back-high", "tower-02", "tower-03", "tower-04", "tower-05", "tower-06", "tower-07", "tower-08", "tower-09"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "tower-assembly.tower-data", "description": "Localized vertical clusters of small luminous rectangles and ticks.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "tower-assembly", "memberComponentRefs": ["tower-01-back-high", "tower-02", "tower-03", "tower-04", "tower-05", "tower-06", "tower-07", "tower-08", "tower-09"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "light-hierarchy.depth-fade", "description": "Rear grid and columns remain weaker than foreground contours.", "status": "required-before-relevant-pass-acceptance", "kind": "emissive", "evidenceRefs": ["primary"], "sourceFamily": "light-hierarchy", "memberComponentRefs": ["tower-01-back-high", "tower-02", "tower-03", "tower-04", "tower-05", "tower-06", "tower-07", "tower-08", "tower-09"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false, "ownerScope": "Reference-detail implementation responsibility; does not imply physical transform ownership."}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 225, "radius": 2.05, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_01_back_high_6.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-01-back-high", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["root"] ?? root).add(node_tower_01_back_high_6);
  nodes["tower-01-back-high"] = node_tower_01_back_high_6;
  const mesh_tower_01_back_high_6Geometry = endpoint_tower_01_back_high_6
    ? new THREE.CylinderGeometry(endpoint_tower_01_back_high_6.endRadius, endpoint_tower_01_back_high_6.baseRadius, endpoint_tower_01_back_high_6.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_tower_01_back_high_6) {
    mesh_tower_01_back_high_6Geometry.scale(0.76, 2.65, 0.76);
  }
  const mesh_tower_01_back_high_6 = new THREE.Mesh(
    mesh_tower_01_back_high_6Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tower_01_back_high_6.name = "Highest rear cuboid tower";
  if (endpoint_tower_01_back_high_6) {
    mesh_tower_01_back_high_6.position.copy(endpoint_tower_01_back_high_6.midpoint);
    mesh_tower_01_back_high_6.quaternion.copy(endpoint_tower_01_back_high_6.quaternion);
  }
  mesh_tower_01_back_high_6.castShadow = options.castShadow ?? true;
  mesh_tower_01_back_high_6.receiveShadow = options.receiveShadow ?? true;
  mesh_tower_01_back_high_6.userData.sculptComponent = {"id": "tower-01-back-high", "name": "Highest rear cuboid tower", "level": "macro", "role": "projected-part", "importance": 1, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.76, "height": 2.65, "depth": 0.76, "units": "relative", "confidence": 0.6}, "transform": {"position": [-1.449569, 1.775, -1.449569], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-01-back-high", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-01-back-high.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}, {"id": "tower-assembly.tallest-rear", "description": "One broad highest tower appears behind the core in the primary view.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "tower-assembly", "memberComponentRefs": ["tower-01-back-high", "tower-02", "tower-03", "tower-04", "tower-05", "tower-06", "tower-07", "tower-08", "tower-09"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "tower-assembly.height-hierarchy", "description": "Unequal medium and low tower groups surround the core.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "tower-assembly", "memberComponentRefs": ["tower-01-back-high", "tower-02", "tower-03", "tower-04", "tower-05", "tower-06", "tower-07", "tower-08", "tower-09"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "tower-assembly.radial-order", "description": "Place columns around the core, not as five boxes in a flat row.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "tower-assembly", "memberComponentRefs": ["tower-01-back-high", "tower-02", "tower-03", "tower-04", "tower-05", "tower-06", "tower-07", "tower-08", "tower-09"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "tower-assembly.tower-grid", "description": "Face-aligned sparse grid follows each cuboid.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "tower-assembly", "memberComponentRefs": ["tower-01-back-high", "tower-02", "tower-03", "tower-04", "tower-05", "tower-06", "tower-07", "tower-08", "tower-09"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "tower-assembly.tower-data", "description": "Localized vertical clusters of small luminous rectangles and ticks.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "tower-assembly", "memberComponentRefs": ["tower-01-back-high", "tower-02", "tower-03", "tower-04", "tower-05", "tower-06", "tower-07", "tower-08", "tower-09"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "light-hierarchy.depth-fade", "description": "Rear grid and columns remain weaker than foreground contours.", "status": "required-before-relevant-pass-acceptance", "kind": "emissive", "evidenceRefs": ["primary"], "sourceFamily": "light-hierarchy", "memberComponentRefs": ["tower-01-back-high", "tower-02", "tower-03", "tower-04", "tower-05", "tower-06", "tower-07", "tower-08", "tower-09"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false, "ownerScope": "Reference-detail implementation responsibility; does not imply physical transform ownership."}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 225, "radius": 2.05, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_01_back_high_6.add(mesh_tower_01_back_high_6);
  meshes["tower-01-back-high"] = mesh_tower_01_back_high_6;
  colliders["tower-01-back-high"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["tower-01-back-high"] ??= [];
  destructionGroups["tower-01-back-high"].push(node_tower_01_back_high_6);

  const endpoint_tower_02_7 = makeAttachmentEndpoint(null);
  const node_tower_02_7 = new THREE.Group();
  node_tower_02_7.name = "Radial cuboid tower 02__pivot";
  node_tower_02_7.scale.set(1, 1, 1);
  if (endpoint_tower_02_7) {
    node_tower_02_7.position.copy(endpoint_tower_02_7.start);
    node_tower_02_7.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tower_02_7.position.set(0.0, 1.425, -1.93);
    node_tower_02_7.rotation.set(0.0, 0.0, 0.0);
  }
  node_tower_02_7.userData.sculptComponent = {"id": "tower-02", "name": "Radial cuboid tower 02", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.48, "height": 1.95, "depth": 0.48, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 1.425, -1.93], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-02", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-02.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 180, "radius": 1.93, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_02_7.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-02", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["root"] ?? root).add(node_tower_02_7);
  nodes["tower-02"] = node_tower_02_7;
  const mesh_tower_02_7Geometry = endpoint_tower_02_7
    ? new THREE.CylinderGeometry(endpoint_tower_02_7.endRadius, endpoint_tower_02_7.baseRadius, endpoint_tower_02_7.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_tower_02_7) {
    mesh_tower_02_7Geometry.scale(0.48, 1.95, 0.48);
  }
  const mesh_tower_02_7 = new THREE.Mesh(
    mesh_tower_02_7Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tower_02_7.name = "Radial cuboid tower 02";
  if (endpoint_tower_02_7) {
    mesh_tower_02_7.position.copy(endpoint_tower_02_7.midpoint);
    mesh_tower_02_7.quaternion.copy(endpoint_tower_02_7.quaternion);
  }
  mesh_tower_02_7.castShadow = options.castShadow ?? true;
  mesh_tower_02_7.receiveShadow = options.receiveShadow ?? true;
  mesh_tower_02_7.userData.sculptComponent = {"id": "tower-02", "name": "Radial cuboid tower 02", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.48, "height": 1.95, "depth": 0.48, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 1.425, -1.93], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-02", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-02.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 180, "radius": 1.93, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_02_7.add(mesh_tower_02_7);
  meshes["tower-02"] = mesh_tower_02_7;
  colliders["tower-02"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["tower-02"] ??= [];
  destructionGroups["tower-02"].push(node_tower_02_7);

  const endpoint_tower_03_8 = makeAttachmentEndpoint(null);
  const node_tower_03_8 = new THREE.Group();
  node_tower_03_8.name = "Radial cuboid tower 03__pivot";
  node_tower_03_8.scale.set(1, 1, 1);
  if (endpoint_tower_03_8) {
    node_tower_03_8.position.copy(endpoint_tower_03_8.start);
    node_tower_03_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tower_03_8.position.set(1.272719, 1.3, -1.516768);
    node_tower_03_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_tower_03_8.userData.sculptComponent = {"id": "tower-03", "name": "Radial cuboid tower 03", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.45, "height": 1.7, "depth": 0.45, "units": "relative", "confidence": 0.6}, "transform": {"position": [1.272719, 1.3, -1.516768], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-03", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-03.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 140, "radius": 1.98, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_03_8.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-03", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["root"] ?? root).add(node_tower_03_8);
  nodes["tower-03"] = node_tower_03_8;
  const mesh_tower_03_8Geometry = endpoint_tower_03_8
    ? new THREE.CylinderGeometry(endpoint_tower_03_8.endRadius, endpoint_tower_03_8.baseRadius, endpoint_tower_03_8.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_tower_03_8) {
    mesh_tower_03_8Geometry.scale(0.45, 1.7, 0.45);
  }
  const mesh_tower_03_8 = new THREE.Mesh(
    mesh_tower_03_8Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tower_03_8.name = "Radial cuboid tower 03";
  if (endpoint_tower_03_8) {
    mesh_tower_03_8.position.copy(endpoint_tower_03_8.midpoint);
    mesh_tower_03_8.quaternion.copy(endpoint_tower_03_8.quaternion);
  }
  mesh_tower_03_8.castShadow = options.castShadow ?? true;
  mesh_tower_03_8.receiveShadow = options.receiveShadow ?? true;
  mesh_tower_03_8.userData.sculptComponent = {"id": "tower-03", "name": "Radial cuboid tower 03", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.45, "height": 1.7, "depth": 0.45, "units": "relative", "confidence": 0.6}, "transform": {"position": [1.272719, 1.3, -1.516768], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-03", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-03.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 140, "radius": 1.98, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_03_8.add(mesh_tower_03_8);
  meshes["tower-03"] = mesh_tower_03_8;
  colliders["tower-03"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["tower-03"] ??= [];
  destructionGroups["tower-03"].push(node_tower_03_8);

  const endpoint_tower_04_9 = makeAttachmentEndpoint(null);
  const node_tower_04_9 = new THREE.Group();
  node_tower_04_9.name = "Radial cuboid tower 04__pivot";
  node_tower_04_9.scale.set(1, 1, 1);
  if (endpoint_tower_04_9) {
    node_tower_04_9.position.copy(endpoint_tower_04_9.start);
    node_tower_04_9.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tower_04_9.position.set(2.012313, 1.05, -0.176055);
    node_tower_04_9.rotation.set(0.0, 0.0, 0.0);
  }
  node_tower_04_9.userData.sculptComponent = {"id": "tower-04", "name": "Radial cuboid tower 04", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.42, "height": 1.2, "depth": 0.42, "units": "relative", "confidence": 0.6}, "transform": {"position": [2.012313, 1.05, -0.176055], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-04", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-04.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 95, "radius": 2.02, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_04_9.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-04", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["root"] ?? root).add(node_tower_04_9);
  nodes["tower-04"] = node_tower_04_9;
  const mesh_tower_04_9Geometry = endpoint_tower_04_9
    ? new THREE.CylinderGeometry(endpoint_tower_04_9.endRadius, endpoint_tower_04_9.baseRadius, endpoint_tower_04_9.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_tower_04_9) {
    mesh_tower_04_9Geometry.scale(0.42, 1.2, 0.42);
  }
  const mesh_tower_04_9 = new THREE.Mesh(
    mesh_tower_04_9Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tower_04_9.name = "Radial cuboid tower 04";
  if (endpoint_tower_04_9) {
    mesh_tower_04_9.position.copy(endpoint_tower_04_9.midpoint);
    mesh_tower_04_9.quaternion.copy(endpoint_tower_04_9.quaternion);
  }
  mesh_tower_04_9.castShadow = options.castShadow ?? true;
  mesh_tower_04_9.receiveShadow = options.receiveShadow ?? true;
  mesh_tower_04_9.userData.sculptComponent = {"id": "tower-04", "name": "Radial cuboid tower 04", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.42, "height": 1.2, "depth": 0.42, "units": "relative", "confidence": 0.6}, "transform": {"position": [2.012313, 1.05, -0.176055], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-04", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-04.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 95, "radius": 2.02, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_04_9.add(mesh_tower_04_9);
  meshes["tower-04"] = mesh_tower_04_9;
  colliders["tower-04"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["tower-04"] ??= [];
  destructionGroups["tower-04"].push(node_tower_04_9);

  const endpoint_tower_05_10 = makeAttachmentEndpoint(null);
  const node_tower_05_10 = new THREE.Group();
  node_tower_05_10.name = "Radial cuboid tower 05__pivot";
  node_tower_05_10.scale.set(1, 1, 1);
  if (endpoint_tower_05_10) {
    node_tower_05_10.position.copy(endpoint_tower_05_10.start);
    node_tower_05_10.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tower_05_10.position.set(1.589155, 0.875, 1.112738);
    node_tower_05_10.rotation.set(0.0, 0.0, 0.0);
  }
  node_tower_05_10.userData.sculptComponent = {"id": "tower-05", "name": "Radial cuboid tower 05", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.36, "height": 0.85, "depth": 0.36, "units": "relative", "confidence": 0.6}, "transform": {"position": [1.589155, 0.875, 1.112738], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-05", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-05.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 55, "radius": 1.94, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_05_10.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-05", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["root"] ?? root).add(node_tower_05_10);
  nodes["tower-05"] = node_tower_05_10;
  const mesh_tower_05_10Geometry = endpoint_tower_05_10
    ? new THREE.CylinderGeometry(endpoint_tower_05_10.endRadius, endpoint_tower_05_10.baseRadius, endpoint_tower_05_10.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_tower_05_10) {
    mesh_tower_05_10Geometry.scale(0.36, 0.85, 0.36);
  }
  const mesh_tower_05_10 = new THREE.Mesh(
    mesh_tower_05_10Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tower_05_10.name = "Radial cuboid tower 05";
  if (endpoint_tower_05_10) {
    mesh_tower_05_10.position.copy(endpoint_tower_05_10.midpoint);
    mesh_tower_05_10.quaternion.copy(endpoint_tower_05_10.quaternion);
  }
  mesh_tower_05_10.castShadow = options.castShadow ?? true;
  mesh_tower_05_10.receiveShadow = options.receiveShadow ?? true;
  mesh_tower_05_10.userData.sculptComponent = {"id": "tower-05", "name": "Radial cuboid tower 05", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.36, "height": 0.85, "depth": 0.36, "units": "relative", "confidence": 0.6}, "transform": {"position": [1.589155, 0.875, 1.112738], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-05", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-05.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 55, "radius": 1.94, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_05_10.add(mesh_tower_05_10);
  meshes["tower-05"] = mesh_tower_05_10;
  colliders["tower-05"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["tower-05"] ??= [];
  destructionGroups["tower-05"].push(node_tower_05_10);

  const endpoint_tower_06_11 = makeAttachmentEndpoint(null);
  const node_tower_06_11 = new THREE.Group();
  node_tower_06_11.name = "Radial cuboid tower 06__pivot";
  node_tower_06_11.scale.set(1, 1, 1);
  if (endpoint_tower_06_11) {
    node_tower_06_11.position.copy(endpoint_tower_06_11.start);
    node_tower_06_11.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tower_06_11.position.set(0.512462, 0.95, 1.912533);
    node_tower_06_11.rotation.set(0.0, 0.0, 0.0);
  }
  node_tower_06_11.userData.sculptComponent = {"id": "tower-06", "name": "Radial cuboid tower 06", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.4, "height": 1, "depth": 0.4, "units": "relative", "confidence": 0.6}, "transform": {"position": [0.512462, 0.95, 1.912533], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-06", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-06.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 15, "radius": 1.98, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_06_11.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-06", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["root"] ?? root).add(node_tower_06_11);
  nodes["tower-06"] = node_tower_06_11;
  const mesh_tower_06_11Geometry = endpoint_tower_06_11
    ? new THREE.CylinderGeometry(endpoint_tower_06_11.endRadius, endpoint_tower_06_11.baseRadius, endpoint_tower_06_11.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_tower_06_11) {
    mesh_tower_06_11Geometry.scale(0.4, 1.0, 0.4);
  }
  const mesh_tower_06_11 = new THREE.Mesh(
    mesh_tower_06_11Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tower_06_11.name = "Radial cuboid tower 06";
  if (endpoint_tower_06_11) {
    mesh_tower_06_11.position.copy(endpoint_tower_06_11.midpoint);
    mesh_tower_06_11.quaternion.copy(endpoint_tower_06_11.quaternion);
  }
  mesh_tower_06_11.castShadow = options.castShadow ?? true;
  mesh_tower_06_11.receiveShadow = options.receiveShadow ?? true;
  mesh_tower_06_11.userData.sculptComponent = {"id": "tower-06", "name": "Radial cuboid tower 06", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.4, "height": 1, "depth": 0.4, "units": "relative", "confidence": 0.6}, "transform": {"position": [0.512462, 0.95, 1.912533], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-06", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-06.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 15, "radius": 1.98, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_06_11.add(mesh_tower_06_11);
  meshes["tower-06"] = mesh_tower_06_11;
  colliders["tower-06"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["tower-06"] ??= [];
  destructionGroups["tower-06"].push(node_tower_06_11);

  const endpoint_tower_07_12 = makeAttachmentEndpoint(null);
  const node_tower_07_12 = new THREE.Group();
  node_tower_07_12.name = "Radial cuboid tower 07__pivot";
  node_tower_07_12.scale.set(1, 1, 1);
  if (endpoint_tower_07_12) {
    node_tower_07_12.position.copy(endpoint_tower_07_12.start);
    node_tower_07_12.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tower_07_12.position.set(-1.01, 1.1, 1.749371);
    node_tower_07_12.rotation.set(0.0, 0.0, 0.0);
  }
  node_tower_07_12.userData.sculptComponent = {"id": "tower-07", "name": "Radial cuboid tower 07", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.42, "height": 1.3, "depth": 0.42, "units": "relative", "confidence": 0.6}, "transform": {"position": [-1.01, 1.1, 1.749371], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-07", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-07.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 330, "radius": 2.02, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_07_12.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-07", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["root"] ?? root).add(node_tower_07_12);
  nodes["tower-07"] = node_tower_07_12;
  const mesh_tower_07_12Geometry = endpoint_tower_07_12
    ? new THREE.CylinderGeometry(endpoint_tower_07_12.endRadius, endpoint_tower_07_12.baseRadius, endpoint_tower_07_12.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_tower_07_12) {
    mesh_tower_07_12Geometry.scale(0.42, 1.3, 0.42);
  }
  const mesh_tower_07_12 = new THREE.Mesh(
    mesh_tower_07_12Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tower_07_12.name = "Radial cuboid tower 07";
  if (endpoint_tower_07_12) {
    mesh_tower_07_12.position.copy(endpoint_tower_07_12.midpoint);
    mesh_tower_07_12.quaternion.copy(endpoint_tower_07_12.quaternion);
  }
  mesh_tower_07_12.castShadow = options.castShadow ?? true;
  mesh_tower_07_12.receiveShadow = options.receiveShadow ?? true;
  mesh_tower_07_12.userData.sculptComponent = {"id": "tower-07", "name": "Radial cuboid tower 07", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.42, "height": 1.3, "depth": 0.42, "units": "relative", "confidence": 0.6}, "transform": {"position": [-1.01, 1.1, 1.749371], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-07", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-07.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 330, "radius": 2.02, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_07_12.add(mesh_tower_07_12);
  meshes["tower-07"] = mesh_tower_07_12;
  colliders["tower-07"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["tower-07"] ??= [];
  destructionGroups["tower-07"].push(node_tower_07_12);

  const endpoint_tower_08_13 = makeAttachmentEndpoint(null);
  const node_tower_08_13 = new THREE.Group();
  node_tower_08_13.name = "Radial cuboid tower 08__pivot";
  node_tower_08_13.scale.set(1, 1, 1);
  if (endpoint_tower_08_13) {
    node_tower_08_13.position.copy(endpoint_tower_08_13.start);
    node_tower_08_13.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tower_08_13.position.set(-1.893215, 1.35, 0.507285);
    node_tower_08_13.rotation.set(0.0, 0.0, 0.0);
  }
  node_tower_08_13.userData.sculptComponent = {"id": "tower-08", "name": "Radial cuboid tower 08", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.46, "height": 1.8, "depth": 0.46, "units": "relative", "confidence": 0.6}, "transform": {"position": [-1.893215, 1.35, 0.507285], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-08", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-08.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 285, "radius": 1.96, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_08_13.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-08", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["root"] ?? root).add(node_tower_08_13);
  nodes["tower-08"] = node_tower_08_13;
  const mesh_tower_08_13Geometry = endpoint_tower_08_13
    ? new THREE.CylinderGeometry(endpoint_tower_08_13.endRadius, endpoint_tower_08_13.baseRadius, endpoint_tower_08_13.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_tower_08_13) {
    mesh_tower_08_13Geometry.scale(0.46, 1.8, 0.46);
  }
  const mesh_tower_08_13 = new THREE.Mesh(
    mesh_tower_08_13Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tower_08_13.name = "Radial cuboid tower 08";
  if (endpoint_tower_08_13) {
    mesh_tower_08_13.position.copy(endpoint_tower_08_13.midpoint);
    mesh_tower_08_13.quaternion.copy(endpoint_tower_08_13.quaternion);
  }
  mesh_tower_08_13.castShadow = options.castShadow ?? true;
  mesh_tower_08_13.receiveShadow = options.receiveShadow ?? true;
  mesh_tower_08_13.userData.sculptComponent = {"id": "tower-08", "name": "Radial cuboid tower 08", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.46, "height": 1.8, "depth": 0.46, "units": "relative", "confidence": 0.6}, "transform": {"position": [-1.893215, 1.35, 0.507285], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-08", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-08.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 285, "radius": 1.96, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_08_13.add(mesh_tower_08_13);
  meshes["tower-08"] = mesh_tower_08_13;
  colliders["tower-08"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["tower-08"] ??= [];
  destructionGroups["tower-08"].push(node_tower_08_13);

  const endpoint_tower_09_14 = makeAttachmentEndpoint(null);
  const node_tower_09_14 = new THREE.Group();
  node_tower_09_14.name = "Radial cuboid tower 09__pivot";
  node_tower_09_14.scale.set(1, 1, 1);
  if (endpoint_tower_09_14) {
    node_tower_09_14.position.copy(endpoint_tower_09_14.start);
    node_tower_09_14.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tower_09_14.position.set(-1.80421, 1.425, -0.656679);
    node_tower_09_14.rotation.set(0.0, 0.0, 0.0);
  }
  node_tower_09_14.userData.sculptComponent = {"id": "tower-09", "name": "Radial cuboid tower 09", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.46, "height": 1.95, "depth": 0.46, "units": "relative", "confidence": 0.6}, "transform": {"position": [-1.80421, 1.425, -0.656679], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-09", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-09.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 250, "radius": 1.92, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_09_14.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-09", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["root"] ?? root).add(node_tower_09_14);
  nodes["tower-09"] = node_tower_09_14;
  const mesh_tower_09_14Geometry = endpoint_tower_09_14
    ? new THREE.CylinderGeometry(endpoint_tower_09_14.endRadius, endpoint_tower_09_14.baseRadius, endpoint_tower_09_14.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_tower_09_14) {
    mesh_tower_09_14Geometry.scale(0.46, 1.95, 0.46);
  }
  const mesh_tower_09_14 = new THREE.Mesh(
    mesh_tower_09_14Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tower_09_14.name = "Radial cuboid tower 09";
  if (endpoint_tower_09_14) {
    mesh_tower_09_14.position.copy(endpoint_tower_09_14.midpoint);
    mesh_tower_09_14.quaternion.copy(endpoint_tower_09_14.quaternion);
  }
  mesh_tower_09_14.castShadow = options.castShadow ?? true;
  mesh_tower_09_14.receiveShadow = options.receiveShadow ?? true;
  mesh_tower_09_14.userData.sculptComponent = {"id": "tower-09", "name": "Radial cuboid tower 09", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "parent": null, "dimensions": {"width": 0.46, "height": 1.95, "depth": 0.46, "units": "relative", "confidence": 0.6}, "transform": {"position": [-1.80421, 1.425, -0.656679], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Unequal-height cuboid with planar faces and crisp edge contours around the core.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tower-09", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "tower-09.face-grid", "kind": "linework", "realization": "separate local-face line geometry; coordinate-specific density", "pass": "structural-pass"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "layoutParameters": {"angleDegrees": 250, "radius": 1.92, "bottomY": 0.45, "sourceCountClaim": false, "approvedDesignInstance": true}, "renderIntent": {"blockout": "neutral 3D edge cage and visible top footprint; no opaque box hiding core", "materialPass": "faint colored faces plus separate edges, planar grids and data glyph instances", "stockSolidBoxIsFinal": false}};
  node_tower_09_14.add(mesh_tower_09_14);
  meshes["tower-09"] = mesh_tower_09_14;
  colliders["tower-09"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["tower-09"] ??= [];
  destructionGroups["tower-09"].push(node_tower_09_14);

  const endpoint_base_shell_15 = makeAttachmentEndpoint(null);
  const node_base_shell_15 = new THREE.Group();
  node_base_shell_15.name = "Curved annular base wall__pivot";
  node_base_shell_15.scale.set(1, 1, 1);
  if (endpoint_base_shell_15) {
    node_base_shell_15.position.copy(endpoint_base_shell_15.start);
    node_base_shell_15.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_base_shell_15.position.set(0.0, 0.225, 0.0);
    node_base_shell_15.rotation.set(0.0, 0.0, 0.0);
  }
  node_base_shell_15.userData.sculptComponent = {"id": "base-shell", "name": "Curved annular base wall", "level": "macro", "role": "projected-part", "importance": 1, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": null, "dimensions": {"width": 6.2, "height": 0.45, "depth": 6.2, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.225, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.34677419354838707, -0.5], [0.5, -0.5], [0.5, 0.5], [0.34677419354838707, 0.5], [0.34677419354838707, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 2.15, "outerRadius": 3.1, "worldCenterY": 0.225, "worldHeight": 0.45}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-shell", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-shell.vertical-wall", "description": "Preserve a curved wall with height; not a single flat disk.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "base-shell", "memberComponentRefs": ["base-shell"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "base-shell.wall-grid", "description": "Cylindrical rows/meridians and localized data rectangles.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "base-shell", "memberComponentRefs": ["base-shell"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "light-hierarchy.blue-cyan-violet", "description": "Blue fills, cyan structural lines and restrained violet accents remain separate roles.", "status": "required-before-relevant-pass-acceptance", "kind": "emissive", "evidenceRefs": ["primary"], "sourceFamily": "light-hierarchy", "memberComponentRefs": ["core-upper", "core-cap", "core-lower", "core-mid-collar", "core-lower-collar", "core-foot", "tower-01-back-high", "tower-02", "tower-03", "tower-04", "tower-05", "tower-06", "tower-07", "tower-08", "tower-09", "base-shell", "base-deck", "base-sector-01", "base-sector-02", "base-sector-03", "base-sector-04", "base-sector-05", "base-sector-06", "base-sector-07", "base-sector-08", "orbit-violet", "base-rim-outer-top", "base-rim-outer-bottom", "base-rim-inner-top", "inner-projection-field", "cap-center-light", "front-loop-light"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false, "ownerScope": "Reference-detail implementation responsibility; does not imply physical transform ownership."}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_shell_15.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-shell", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["root"] ?? root).add(node_base_shell_15);
  nodes["base-shell"] = node_base_shell_15;
  const mesh_base_shell_15Geometry = endpoint_base_shell_15
    ? new THREE.CylinderGeometry(endpoint_base_shell_15.endRadius, endpoint_base_shell_15.baseRadius, endpoint_base_shell_15.length, 16, 6)
    : buildLatheGeometry({"points": [[0.34677419354838707, -0.5], [0.5, -0.5], [0.5, 0.5], [0.34677419354838707, 0.5], [0.34677419354838707, -0.5]], "segments": 96});
  if (!endpoint_base_shell_15) {
    mesh_base_shell_15Geometry.scale(6.2, 0.45, 6.2);
  }
  const mesh_base_shell_15 = new THREE.Mesh(
    mesh_base_shell_15Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_shell_15.name = "Curved annular base wall";
  if (endpoint_base_shell_15) {
    mesh_base_shell_15.position.copy(endpoint_base_shell_15.midpoint);
    mesh_base_shell_15.quaternion.copy(endpoint_base_shell_15.quaternion);
  }
  mesh_base_shell_15.castShadow = options.castShadow ?? true;
  mesh_base_shell_15.receiveShadow = options.receiveShadow ?? true;
  mesh_base_shell_15.userData.sculptComponent = {"id": "base-shell", "name": "Curved annular base wall", "level": "macro", "role": "projected-part", "importance": 1, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": null, "dimensions": {"width": 6.2, "height": 0.45, "depth": 6.2, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.225, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.34677419354838707, -0.5], [0.5, -0.5], [0.5, 0.5], [0.34677419354838707, 0.5], [0.34677419354838707, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 2.15, "outerRadius": 3.1, "worldCenterY": 0.225, "worldHeight": 0.45}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-shell", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-shell.vertical-wall", "description": "Preserve a curved wall with height; not a single flat disk.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "base-shell", "memberComponentRefs": ["base-shell"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "base-shell.wall-grid", "description": "Cylindrical rows/meridians and localized data rectangles.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "base-shell", "memberComponentRefs": ["base-shell"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "light-hierarchy.blue-cyan-violet", "description": "Blue fills, cyan structural lines and restrained violet accents remain separate roles.", "status": "required-before-relevant-pass-acceptance", "kind": "emissive", "evidenceRefs": ["primary"], "sourceFamily": "light-hierarchy", "memberComponentRefs": ["core-upper", "core-cap", "core-lower", "core-mid-collar", "core-lower-collar", "core-foot", "tower-01-back-high", "tower-02", "tower-03", "tower-04", "tower-05", "tower-06", "tower-07", "tower-08", "tower-09", "base-shell", "base-deck", "base-sector-01", "base-sector-02", "base-sector-03", "base-sector-04", "base-sector-05", "base-sector-06", "base-sector-07", "base-sector-08", "orbit-violet", "base-rim-outer-top", "base-rim-outer-bottom", "base-rim-inner-top", "inner-projection-field", "cap-center-light", "front-loop-light"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false, "ownerScope": "Reference-detail implementation responsibility; does not imply physical transform ownership."}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_shell_15.add(mesh_base_shell_15);
  meshes["base-shell"] = mesh_base_shell_15;
  colliders["base-shell"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["base-shell"] ??= [];
  destructionGroups["base-shell"].push(node_base_shell_15);

  const endpoint_base_deck_16 = makeAttachmentEndpoint(null);
  const node_base_deck_16 = new THREE.Group();
  node_base_deck_16.name = "Upper annular deck__pivot";
  node_base_deck_16.scale.set(1, 1, 1);
  if (endpoint_base_deck_16) {
    node_base_deck_16.position.copy(endpoint_base_deck_16.start);
    node_base_deck_16.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_base_deck_16.position.set(0.0, 0.225, 0.0);
    node_base_deck_16.rotation.set(0.0, 0.0, 0.0);
  }
  node_base_deck_16.userData.sculptComponent = {"id": "base-deck", "name": "Upper annular deck", "level": "macro", "role": "projected-part", "importance": 1, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": "base-shell", "dimensions": {"width": 6.2, "height": 0.015, "depth": 6.2, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.225, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.34677419354838707, -0.5], [0.5, -0.5], [0.5, 0.5], [0.34677419354838707, 0.5], [0.34677419354838707, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 2.15, "outerRadius": 3.1, "worldCenterY": 0.45, "worldHeight": 0.015}}, "material": "field-fill", "materialLayers": ["field-fill"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-deck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "field-fill"}}, "localFeatures": [{"id": "base-deck.annular-deck", "description": "Keep outer deck distinct from the inner projection field; no opaque full disk.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "base-deck", "memberComponentRefs": ["base-deck"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "base-deck.deck-grid", "description": "Concentric paths and radial divisions on the deck.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "base-deck", "memberComponentRefs": ["base-deck"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_deck_16.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-deck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "field-fill"}};
  (nodes["base-shell"] ?? root).add(node_base_deck_16);
  nodes["base-deck"] = node_base_deck_16;
  const mesh_base_deck_16Geometry = endpoint_base_deck_16
    ? new THREE.CylinderGeometry(endpoint_base_deck_16.endRadius, endpoint_base_deck_16.baseRadius, endpoint_base_deck_16.length, 16, 6)
    : buildLatheGeometry({"points": [[0.34677419354838707, -0.5], [0.5, -0.5], [0.5, 0.5], [0.34677419354838707, 0.5], [0.34677419354838707, -0.5]], "segments": 96});
  if (!endpoint_base_deck_16) {
    mesh_base_deck_16Geometry.scale(6.2, 0.015, 6.2);
  }
  const mesh_base_deck_16 = new THREE.Mesh(
    mesh_base_deck_16Geometry,
    materialMap["field-fill"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_deck_16.name = "Upper annular deck";
  if (endpoint_base_deck_16) {
    mesh_base_deck_16.position.copy(endpoint_base_deck_16.midpoint);
    mesh_base_deck_16.quaternion.copy(endpoint_base_deck_16.quaternion);
  }
  mesh_base_deck_16.castShadow = options.castShadow ?? true;
  mesh_base_deck_16.receiveShadow = options.receiveShadow ?? true;
  mesh_base_deck_16.userData.sculptComponent = {"id": "base-deck", "name": "Upper annular deck", "level": "macro", "role": "projected-part", "importance": 1, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": "base-shell", "dimensions": {"width": 6.2, "height": 0.015, "depth": 6.2, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.225, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.34677419354838707, -0.5], [0.5, -0.5], [0.5, 0.5], [0.34677419354838707, 0.5], [0.34677419354838707, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 2.15, "outerRadius": 3.1, "worldCenterY": 0.45, "worldHeight": 0.015}}, "material": "field-fill", "materialLayers": ["field-fill"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-deck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "field-fill"}}, "localFeatures": [{"id": "base-deck.annular-deck", "description": "Keep outer deck distinct from the inner projection field; no opaque full disk.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "base-deck", "memberComponentRefs": ["base-deck"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "base-deck.deck-grid", "description": "Concentric paths and radial divisions on the deck.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "base-deck", "memberComponentRefs": ["base-deck"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_deck_16.add(mesh_base_deck_16);
  meshes["base-deck"] = mesh_base_deck_16;
  colliders["base-deck"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["base-deck"] ??= [];
  destructionGroups["base-deck"].push(node_base_deck_16);

  const endpoint_base_sector_01_17 = makeAttachmentEndpoint(null);
  const node_base_sector_01_17 = new THREE.Group();
  node_base_sector_01_17.name = "Radial annular sector 1__pivot";
  node_base_sector_01_17.scale.set(1, 1, 1);
  if (endpoint_base_sector_01_17) {
    node_base_sector_01_17.position.copy(endpoint_base_sector_01_17.start);
    node_base_sector_01_17.rotation.set(-1.5707963267948966, 0.0, 0.0);
  } else {
    node_base_sector_01_17.position.set(0.0, -0.225, 2.651508670788841);
    node_base_sector_01_17.rotation.set(-1.5707963267948966, 0.0, 0.0);
  }
  node_base_sector_01_17.userData.sculptComponent = {"id": "base-sector-01", "name": "Radial annular sector 1", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.3306348212336596, "height": 1.0969826584223181, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, -0.225, 2.651508670788841], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[-0.5, -0.4362545277129616], [-0.43825223289603815, -0.4511530146954097], [-0.3762041096028368, -0.4640857494026201], [-0.31389815480472816, -0.47504386838422796], [-0.2513770698908791, -0.4840198614928542], [-0.1886837036898917, -0.49100757703118325], [-0.12586102310335648, -0.4960022259680285], [-0.06295208365848463, -0.49900038522049767], [0, -0.5], [0.06295208365848463, -0.49900038522049767], [0.12586102310335648, -0.4960022259680285], [0.1886837036898917, -0.49100757703118325], [0.2513770698908791, -0.4840198614928542], [0.31389815480472816, -0.47504386838422796], [0.3762041096028368, -0.4640857494026201], [0.43825223289603815, -0.4511530146954097], [0.5, -0.4362545277129616], [0.3359375, 0.5], [0.2944507189770256, 0.4899900790586674], [0.25276213613940596, 0.4813008979272606], [0.2109003227594267, 0.47393841173649254], [0.16889396883293437, 0.4679076663666345], [0.12677186341664598, 0.46321279498931967], [0.08456287489756763, 0.4598570152348765], [0.042295931208044354, 0.45784262698712413], [0, 0.4571710108071459], [-0.042295931208044354, 0.45784262698712413], [-0.08456287489756763, 0.4598570152348765], [-0.12677186341664598, 0.46321279498931967], [-0.16889396883293437, 0.4679076663666345], [-0.2109003227594267, 0.47393841173649254], [-0.25276213613940596, 0.4813008979272606], [-0.2944507189770256, 0.4899900790586674], [-0.3359375, 0.5]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 0, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [-0.6653174106168298, 0, 2.103017341577682], "max": [0.6653174106168298, 0.5, 3.2]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-01", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-01.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}, {"id": "base-sector-panels.radial-sectors", "description": "Preserve visible wedge-like sector footprints and local protrusions; not tangential rectangular tiles.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "base-sector-panels", "memberComponentRefs": ["base-sector-01", "base-sector-02", "base-sector-03", "base-sector-04", "base-sector-05", "base-sector-06", "base-sector-07", "base-sector-08"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_01_17.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-01", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["base-shell"] ?? root).add(node_base_sector_01_17);
  nodes["base-sector-01"] = node_base_sector_01_17;
  const mesh_base_sector_01_17Geometry = endpoint_base_sector_01_17
    ? new THREE.CylinderGeometry(endpoint_base_sector_01_17.endRadius, endpoint_base_sector_01_17.baseRadius, endpoint_base_sector_01_17.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.5, -0.4362545277129616], [-0.43825223289603815, -0.4511530146954097], [-0.3762041096028368, -0.4640857494026201], [-0.31389815480472816, -0.47504386838422796], [-0.2513770698908791, -0.4840198614928542], [-0.1886837036898917, -0.49100757703118325], [-0.12586102310335648, -0.4960022259680285], [-0.06295208365848463, -0.49900038522049767], [0, -0.5], [0.06295208365848463, -0.49900038522049767], [0.12586102310335648, -0.4960022259680285], [0.1886837036898917, -0.49100757703118325], [0.2513770698908791, -0.4840198614928542], [0.31389815480472816, -0.47504386838422796], [0.3762041096028368, -0.4640857494026201], [0.43825223289603815, -0.4511530146954097], [0.5, -0.4362545277129616], [0.3359375, 0.5], [0.2944507189770256, 0.4899900790586674], [0.25276213613940596, 0.4813008979272606], [0.2109003227594267, 0.47393841173649254], [0.16889396883293437, 0.4679076663666345], [0.12677186341664598, 0.46321279498931967], [0.08456287489756763, 0.4598570152348765], [0.042295931208044354, 0.45784262698712413], [0, 0.4571710108071459], [-0.042295931208044354, 0.45784262698712413], [-0.08456287489756763, 0.4598570152348765], [-0.12677186341664598, 0.46321279498931967], [-0.16889396883293437, 0.4679076663666345], [-0.2109003227594267, 0.47393841173649254], [-0.25276213613940596, 0.4813008979272606], [-0.2944507189770256, 0.4899900790586674], [-0.3359375, 0.5]], "depth": 1});
  if (!endpoint_base_sector_01_17) {
    mesh_base_sector_01_17Geometry.scale(1.3306348212336596, 1.0969826584223181, 0.5);
  }
  const mesh_base_sector_01_17 = new THREE.Mesh(
    mesh_base_sector_01_17Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_sector_01_17.name = "Radial annular sector 1";
  if (endpoint_base_sector_01_17) {
    mesh_base_sector_01_17.position.copy(endpoint_base_sector_01_17.midpoint);
    mesh_base_sector_01_17.quaternion.copy(endpoint_base_sector_01_17.quaternion);
  }
  mesh_base_sector_01_17.castShadow = options.castShadow ?? true;
  mesh_base_sector_01_17.receiveShadow = options.receiveShadow ?? true;
  mesh_base_sector_01_17.userData.sculptComponent = {"id": "base-sector-01", "name": "Radial annular sector 1", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.3306348212336596, "height": 1.0969826584223181, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, -0.225, 2.651508670788841], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[-0.5, -0.4362545277129616], [-0.43825223289603815, -0.4511530146954097], [-0.3762041096028368, -0.4640857494026201], [-0.31389815480472816, -0.47504386838422796], [-0.2513770698908791, -0.4840198614928542], [-0.1886837036898917, -0.49100757703118325], [-0.12586102310335648, -0.4960022259680285], [-0.06295208365848463, -0.49900038522049767], [0, -0.5], [0.06295208365848463, -0.49900038522049767], [0.12586102310335648, -0.4960022259680285], [0.1886837036898917, -0.49100757703118325], [0.2513770698908791, -0.4840198614928542], [0.31389815480472816, -0.47504386838422796], [0.3762041096028368, -0.4640857494026201], [0.43825223289603815, -0.4511530146954097], [0.5, -0.4362545277129616], [0.3359375, 0.5], [0.2944507189770256, 0.4899900790586674], [0.25276213613940596, 0.4813008979272606], [0.2109003227594267, 0.47393841173649254], [0.16889396883293437, 0.4679076663666345], [0.12677186341664598, 0.46321279498931967], [0.08456287489756763, 0.4598570152348765], [0.042295931208044354, 0.45784262698712413], [0, 0.4571710108071459], [-0.042295931208044354, 0.45784262698712413], [-0.08456287489756763, 0.4598570152348765], [-0.12677186341664598, 0.46321279498931967], [-0.16889396883293437, 0.4679076663666345], [-0.2109003227594267, 0.47393841173649254], [-0.25276213613940596, 0.4813008979272606], [-0.2944507189770256, 0.4899900790586674], [-0.3359375, 0.5]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 0, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [-0.6653174106168298, 0, 2.103017341577682], "max": [0.6653174106168298, 0.5, 3.2]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-01", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-01.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}, {"id": "base-sector-panels.radial-sectors", "description": "Preserve visible wedge-like sector footprints and local protrusions; not tangential rectangular tiles.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "base-sector-panels", "memberComponentRefs": ["base-sector-01", "base-sector-02", "base-sector-03", "base-sector-04", "base-sector-05", "base-sector-06", "base-sector-07", "base-sector-08"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_01_17.add(mesh_base_sector_01_17);
  meshes["base-sector-01"] = mesh_base_sector_01_17;
  colliders["base-sector-01"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["base-sector-01"] ??= [];
  destructionGroups["base-sector-01"].push(node_base_sector_01_17);

  const endpoint_base_sector_02_18 = makeAttachmentEndpoint(null);
  const node_base_sector_02_18 = new THREE.Group();
  node_base_sector_02_18.name = "Radial annular sector 2__pivot";
  node_base_sector_02_18.scale.set(1, 1, 1);
  if (endpoint_base_sector_02_18) {
    node_base_sector_02_18.position.copy(endpoint_base_sector_02_18.start);
    node_base_sector_02_18.rotation.set(-1.5707963267948966, 0.0, 0.0);
  } else {
    node_base_sector_02_18.position.set(1.9273598713538325, -0.225, 1.9273598713538327);
    node_base_sector_02_18.rotation.set(-1.5707963267948966, 0.0, 0.0);
  }
  node_base_sector_02_18.userData.sculptComponent = {"id": "base-sector-02", "name": "Radial annular sector 2", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.5127718921430486, "height": 1.5127718921430489, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [1.9273598713538325, -0.225, 1.9273598713538327], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[-0.12197143552446303, -0.5000000000000001], [-0.07592678961773443, -0.4692339512145659], [-0.030703283329861317, -0.4372731368698964], [0.013668089406911344, -0.40413946131166495], [0.05715691867010903, -0.3698556327060357], [0.09973339938847085, -0.3344451474766194], [0.1413683517688544, -0.2979322742011986], [0.1820332412946106, -0.2603420369792582], [0.22170019828171536, -0.22170019828171547], [0.26034203697925806, -0.18203324129461074], [0.2979322742011985, -0.14136835176885423], [0.3344451474766199, -0.0997333993884704], [0.36985563270603594, -0.05715691867010917], [0.4041394613116651, -0.013668089406911195], [0.4372731368698966, 0.03070328332986146], [0.46923395121456607, 0.07592678961773455], [0.5, 0.12197143552446287], [-0.08211294175700143, 0.49999999999999994], [-0.102783880784715, 0.4690637535314168], [-0.12425755292253986, 0.43867921024425205], [-0.14651924118822646, 0.40886719418673284], [-0.16955368853263358, 0.37964813702552186], [-0.19334510829614757, 0.3510420640428729], [-0.21787719502807115, 0.32306858041230246], [-0.2431331356615624, 0.29574685776218484], [-0.2690956210364739, 0.2690956210364739], [-0.2957468577621849, 0.24313313566156236], [-0.32306858041230235, 0.21787719502807112], [-0.3510420640428727, 0.19334510829614782], [-0.3796481370255219, 0.16955368853263356], [-0.40886719418673273, 0.14651924118822657], [-0.43867921024425194, 0.12425755292253998], [-0.46906375353141677, 0.10278388078471512], [-0.5, 0.08211294175700141]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 45, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [1.1709739252823081, 0, 1.1709739252823084], "max": [2.683745817425357, 0.5, 2.6837458174253572]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-02", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-02.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_02_18.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-02", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["base-shell"] ?? root).add(node_base_sector_02_18);
  nodes["base-sector-02"] = node_base_sector_02_18;
  const mesh_base_sector_02_18Geometry = endpoint_base_sector_02_18
    ? new THREE.CylinderGeometry(endpoint_base_sector_02_18.endRadius, endpoint_base_sector_02_18.baseRadius, endpoint_base_sector_02_18.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.12197143552446303, -0.5000000000000001], [-0.07592678961773443, -0.4692339512145659], [-0.030703283329861317, -0.4372731368698964], [0.013668089406911344, -0.40413946131166495], [0.05715691867010903, -0.3698556327060357], [0.09973339938847085, -0.3344451474766194], [0.1413683517688544, -0.2979322742011986], [0.1820332412946106, -0.2603420369792582], [0.22170019828171536, -0.22170019828171547], [0.26034203697925806, -0.18203324129461074], [0.2979322742011985, -0.14136835176885423], [0.3344451474766199, -0.0997333993884704], [0.36985563270603594, -0.05715691867010917], [0.4041394613116651, -0.013668089406911195], [0.4372731368698966, 0.03070328332986146], [0.46923395121456607, 0.07592678961773455], [0.5, 0.12197143552446287], [-0.08211294175700143, 0.49999999999999994], [-0.102783880784715, 0.4690637535314168], [-0.12425755292253986, 0.43867921024425205], [-0.14651924118822646, 0.40886719418673284], [-0.16955368853263358, 0.37964813702552186], [-0.19334510829614757, 0.3510420640428729], [-0.21787719502807115, 0.32306858041230246], [-0.2431331356615624, 0.29574685776218484], [-0.2690956210364739, 0.2690956210364739], [-0.2957468577621849, 0.24313313566156236], [-0.32306858041230235, 0.21787719502807112], [-0.3510420640428727, 0.19334510829614782], [-0.3796481370255219, 0.16955368853263356], [-0.40886719418673273, 0.14651924118822657], [-0.43867921024425194, 0.12425755292253998], [-0.46906375353141677, 0.10278388078471512], [-0.5, 0.08211294175700141]], "depth": 1});
  if (!endpoint_base_sector_02_18) {
    mesh_base_sector_02_18Geometry.scale(1.5127718921430486, 1.5127718921430489, 0.5);
  }
  const mesh_base_sector_02_18 = new THREE.Mesh(
    mesh_base_sector_02_18Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_sector_02_18.name = "Radial annular sector 2";
  if (endpoint_base_sector_02_18) {
    mesh_base_sector_02_18.position.copy(endpoint_base_sector_02_18.midpoint);
    mesh_base_sector_02_18.quaternion.copy(endpoint_base_sector_02_18.quaternion);
  }
  mesh_base_sector_02_18.castShadow = options.castShadow ?? true;
  mesh_base_sector_02_18.receiveShadow = options.receiveShadow ?? true;
  mesh_base_sector_02_18.userData.sculptComponent = {"id": "base-sector-02", "name": "Radial annular sector 2", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.5127718921430486, "height": 1.5127718921430489, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [1.9273598713538325, -0.225, 1.9273598713538327], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[-0.12197143552446303, -0.5000000000000001], [-0.07592678961773443, -0.4692339512145659], [-0.030703283329861317, -0.4372731368698964], [0.013668089406911344, -0.40413946131166495], [0.05715691867010903, -0.3698556327060357], [0.09973339938847085, -0.3344451474766194], [0.1413683517688544, -0.2979322742011986], [0.1820332412946106, -0.2603420369792582], [0.22170019828171536, -0.22170019828171547], [0.26034203697925806, -0.18203324129461074], [0.2979322742011985, -0.14136835176885423], [0.3344451474766199, -0.0997333993884704], [0.36985563270603594, -0.05715691867010917], [0.4041394613116651, -0.013668089406911195], [0.4372731368698966, 0.03070328332986146], [0.46923395121456607, 0.07592678961773455], [0.5, 0.12197143552446287], [-0.08211294175700143, 0.49999999999999994], [-0.102783880784715, 0.4690637535314168], [-0.12425755292253986, 0.43867921024425205], [-0.14651924118822646, 0.40886719418673284], [-0.16955368853263358, 0.37964813702552186], [-0.19334510829614757, 0.3510420640428729], [-0.21787719502807115, 0.32306858041230246], [-0.2431331356615624, 0.29574685776218484], [-0.2690956210364739, 0.2690956210364739], [-0.2957468577621849, 0.24313313566156236], [-0.32306858041230235, 0.21787719502807112], [-0.3510420640428727, 0.19334510829614782], [-0.3796481370255219, 0.16955368853263356], [-0.40886719418673273, 0.14651924118822657], [-0.43867921024425194, 0.12425755292253998], [-0.46906375353141677, 0.10278388078471512], [-0.5, 0.08211294175700141]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 45, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [1.1709739252823081, 0, 1.1709739252823084], "max": [2.683745817425357, 0.5, 2.6837458174253572]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-02", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-02.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_02_18.add(mesh_base_sector_02_18);
  meshes["base-sector-02"] = mesh_base_sector_02_18;
  colliders["base-sector-02"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["base-sector-02"] ??= [];
  destructionGroups["base-sector-02"].push(node_base_sector_02_18);

  const endpoint_base_sector_03_19 = makeAttachmentEndpoint(null);
  const node_base_sector_03_19 = new THREE.Group();
  node_base_sector_03_19.name = "Radial annular sector 3__pivot";
  node_base_sector_03_19.scale.set(1, 1, 1);
  if (endpoint_base_sector_03_19) {
    node_base_sector_03_19.position.copy(endpoint_base_sector_03_19.start);
    node_base_sector_03_19.rotation.set(-1.5707963267948966, 0.0, 0.0);
  } else {
    node_base_sector_03_19.position.set(2.651508670788841, -0.225, 4.996003610813204e-16);
    node_base_sector_03_19.rotation.set(-1.5707963267948966, 0.0, 0.0);
  }
  node_base_sector_03_19.userData.sculptComponent = {"id": "base-sector-03", "name": "Radial annular sector 3", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.0969826584223181, "height": 1.3306348212336596, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [2.651508670788841, -0.225, 4.996003610813204e-16], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[0.4362545277129612, -0.5], [0.4511530146954097, -0.43825223289603765], [0.4640857494026201, -0.37620410960283657], [0.47504386838422796, -0.3138981548047281], [0.4840198614928542, -0.2513770698908787], [0.49100757703118325, -0.18868370368989146], [0.4960022259680285, -0.12586102310335645], [0.49900038522049767, -0.06295208365848423], [0.5, 2.2820451439578083e-16], [0.49900038522049767, 0.06295208365848469], [0.4960022259680285, 0.12586102310335637], [0.49100757703118325, 0.1886837036898919], [0.4840198614928546, 0.25137706989087916], [0.47504386838422835, 0.31389815480472805], [0.4640857494026197, 0.37620410960283757], [0.4511530146954097, 0.43825223289603865], [0.4362545277129616, 0.5], [-0.5, 0.33593750000000006], [-0.4899900790586674, 0.29445071897702607], [-0.4813008979272606, 0.25276213613940657], [-0.47393841173649254, 0.21090032275942677], [-0.4679076663666341, 0.16889396883293456], [-0.46321279498931967, 0.12677186341664623], [-0.4598570152348765, 0.08456287489756767], [-0.45784262698712413, 0.04229593120804452], [-0.4571710108071459, 2.7652277266564013e-16], [-0.45784262698712413, -0.042295931208043966], [-0.4598570152348765, -0.08456287489756747], [-0.46321279498931967, -0.12677186341664567], [-0.4679076663666345, -0.168893968832934], [-0.47393841173649254, -0.21090032275942658], [-0.4813008979272606, -0.2527621361394057], [-0.4899900790586674, -0.29445071897702524], [-0.5, -0.33593749999999983]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 90, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [2.103017341577682, 0, -0.6653174106168293], "max": [3.2, 0.5, 0.6653174106168303]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-03", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-03.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_03_19.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-03", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["base-shell"] ?? root).add(node_base_sector_03_19);
  nodes["base-sector-03"] = node_base_sector_03_19;
  const mesh_base_sector_03_19Geometry = endpoint_base_sector_03_19
    ? new THREE.CylinderGeometry(endpoint_base_sector_03_19.endRadius, endpoint_base_sector_03_19.baseRadius, endpoint_base_sector_03_19.length, 16, 6)
    : buildExtrudeGeometry({"points": [[0.4362545277129612, -0.5], [0.4511530146954097, -0.43825223289603765], [0.4640857494026201, -0.37620410960283657], [0.47504386838422796, -0.3138981548047281], [0.4840198614928542, -0.2513770698908787], [0.49100757703118325, -0.18868370368989146], [0.4960022259680285, -0.12586102310335645], [0.49900038522049767, -0.06295208365848423], [0.5, 2.2820451439578083e-16], [0.49900038522049767, 0.06295208365848469], [0.4960022259680285, 0.12586102310335637], [0.49100757703118325, 0.1886837036898919], [0.4840198614928546, 0.25137706989087916], [0.47504386838422835, 0.31389815480472805], [0.4640857494026197, 0.37620410960283757], [0.4511530146954097, 0.43825223289603865], [0.4362545277129616, 0.5], [-0.5, 0.33593750000000006], [-0.4899900790586674, 0.29445071897702607], [-0.4813008979272606, 0.25276213613940657], [-0.47393841173649254, 0.21090032275942677], [-0.4679076663666341, 0.16889396883293456], [-0.46321279498931967, 0.12677186341664623], [-0.4598570152348765, 0.08456287489756767], [-0.45784262698712413, 0.04229593120804452], [-0.4571710108071459, 2.7652277266564013e-16], [-0.45784262698712413, -0.042295931208043966], [-0.4598570152348765, -0.08456287489756747], [-0.46321279498931967, -0.12677186341664567], [-0.4679076663666345, -0.168893968832934], [-0.47393841173649254, -0.21090032275942658], [-0.4813008979272606, -0.2527621361394057], [-0.4899900790586674, -0.29445071897702524], [-0.5, -0.33593749999999983]], "depth": 1});
  if (!endpoint_base_sector_03_19) {
    mesh_base_sector_03_19Geometry.scale(1.0969826584223181, 1.3306348212336596, 0.5);
  }
  const mesh_base_sector_03_19 = new THREE.Mesh(
    mesh_base_sector_03_19Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_sector_03_19.name = "Radial annular sector 3";
  if (endpoint_base_sector_03_19) {
    mesh_base_sector_03_19.position.copy(endpoint_base_sector_03_19.midpoint);
    mesh_base_sector_03_19.quaternion.copy(endpoint_base_sector_03_19.quaternion);
  }
  mesh_base_sector_03_19.castShadow = options.castShadow ?? true;
  mesh_base_sector_03_19.receiveShadow = options.receiveShadow ?? true;
  mesh_base_sector_03_19.userData.sculptComponent = {"id": "base-sector-03", "name": "Radial annular sector 3", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.0969826584223181, "height": 1.3306348212336596, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [2.651508670788841, -0.225, 4.996003610813204e-16], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[0.4362545277129612, -0.5], [0.4511530146954097, -0.43825223289603765], [0.4640857494026201, -0.37620410960283657], [0.47504386838422796, -0.3138981548047281], [0.4840198614928542, -0.2513770698908787], [0.49100757703118325, -0.18868370368989146], [0.4960022259680285, -0.12586102310335645], [0.49900038522049767, -0.06295208365848423], [0.5, 2.2820451439578083e-16], [0.49900038522049767, 0.06295208365848469], [0.4960022259680285, 0.12586102310335637], [0.49100757703118325, 0.1886837036898919], [0.4840198614928546, 0.25137706989087916], [0.47504386838422835, 0.31389815480472805], [0.4640857494026197, 0.37620410960283757], [0.4511530146954097, 0.43825223289603865], [0.4362545277129616, 0.5], [-0.5, 0.33593750000000006], [-0.4899900790586674, 0.29445071897702607], [-0.4813008979272606, 0.25276213613940657], [-0.47393841173649254, 0.21090032275942677], [-0.4679076663666341, 0.16889396883293456], [-0.46321279498931967, 0.12677186341664623], [-0.4598570152348765, 0.08456287489756767], [-0.45784262698712413, 0.04229593120804452], [-0.4571710108071459, 2.7652277266564013e-16], [-0.45784262698712413, -0.042295931208043966], [-0.4598570152348765, -0.08456287489756747], [-0.46321279498931967, -0.12677186341664567], [-0.4679076663666345, -0.168893968832934], [-0.47393841173649254, -0.21090032275942658], [-0.4813008979272606, -0.2527621361394057], [-0.4899900790586674, -0.29445071897702524], [-0.5, -0.33593749999999983]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 90, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [2.103017341577682, 0, -0.6653174106168293], "max": [3.2, 0.5, 0.6653174106168303]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-03", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-03.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_03_19.add(mesh_base_sector_03_19);
  meshes["base-sector-03"] = mesh_base_sector_03_19;
  colliders["base-sector-03"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["base-sector-03"] ??= [];
  destructionGroups["base-sector-03"].push(node_base_sector_03_19);

  const endpoint_base_sector_04_20 = makeAttachmentEndpoint(null);
  const node_base_sector_04_20 = new THREE.Group();
  node_base_sector_04_20.name = "Radial annular sector 4__pivot";
  node_base_sector_04_20.scale.set(1, 1, 1);
  if (endpoint_base_sector_04_20) {
    node_base_sector_04_20.position.copy(endpoint_base_sector_04_20.start);
    node_base_sector_04_20.rotation.set(-1.5707963267948966, 0.0, 0.0);
  } else {
    node_base_sector_04_20.position.set(1.9273598713538322, -0.225, -1.927359871353833);
    node_base_sector_04_20.rotation.set(-1.5707963267948966, 0.0, 0.0);
  }
  node_base_sector_04_20.userData.sculptComponent = {"id": "base-sector-04", "name": "Radial annular sector 4", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.5127718921430489, "height": 1.5127718921430495, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [1.9273598713538322, -0.225, -1.927359871353833], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[0.5000000000000001, -0.12197143552446325], [0.4692339512145662, -0.07592678961773511], [0.43727313686989666, -0.03070328332986174], [0.4041394613116652, 0.013668089406911043], [0.36985563270603633, 0.057156918670108414], [0.33444514747661996, 0.0997333993884702], [0.2979322742011989, 0.14136835176885404], [0.2603420369792588, 0.1820332412946099], [0.22170019828171575, 0.22170019828171492], [0.18203324129461074, 0.26034203697925795], [0.14136835176885484, 0.29793227420119806], [0.09973339938847127, 0.33444514747661913], [0.05715691867011005, 0.36985563270603516], [0.013668089406911048, 0.4041394613116649], [-0.030703283329860873, 0.4372731368698957], [-0.07592678961773353, 0.46923395121456496], [-0.12197143552446302, 0.5], [-0.49999999999999994, -0.08211294175700139], [-0.4690637535314161, -0.10278388078471552], [-0.4386792102442516, -0.12425755292254022], [-0.408867194186733, -0.14651924118822637], [-0.37964813702552125, -0.16955368853263394], [-0.3510420640428723, -0.19334510829614787], [-0.323068580412302, -0.21787719502807146], [-0.29574685776218473, -0.2431331356615624], [-0.26909562103647355, -0.26909562103647405], [-0.24313313566156178, -0.2957468577621852], [-0.21787719502807082, -0.32306858041230246], [-0.19334510829614737, -0.3510420640428729], [-0.16955368853263314, -0.37964813702552214], [-0.1465192411882263, -0.4088671941867328], [-0.12425755292253969, -0.43867921024425216], [-0.10278388078471468, -0.46906375353141705], [-0.08211294175700128, -0.5]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 135, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [1.170973925282308, 0, -2.6837458174253577], "max": [2.683745817425357, 0.5, -1.1709739252823081]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-04", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-04.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_04_20.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-04", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["base-shell"] ?? root).add(node_base_sector_04_20);
  nodes["base-sector-04"] = node_base_sector_04_20;
  const mesh_base_sector_04_20Geometry = endpoint_base_sector_04_20
    ? new THREE.CylinderGeometry(endpoint_base_sector_04_20.endRadius, endpoint_base_sector_04_20.baseRadius, endpoint_base_sector_04_20.length, 16, 6)
    : buildExtrudeGeometry({"points": [[0.5000000000000001, -0.12197143552446325], [0.4692339512145662, -0.07592678961773511], [0.43727313686989666, -0.03070328332986174], [0.4041394613116652, 0.013668089406911043], [0.36985563270603633, 0.057156918670108414], [0.33444514747661996, 0.0997333993884702], [0.2979322742011989, 0.14136835176885404], [0.2603420369792588, 0.1820332412946099], [0.22170019828171575, 0.22170019828171492], [0.18203324129461074, 0.26034203697925795], [0.14136835176885484, 0.29793227420119806], [0.09973339938847127, 0.33444514747661913], [0.05715691867011005, 0.36985563270603516], [0.013668089406911048, 0.4041394613116649], [-0.030703283329860873, 0.4372731368698957], [-0.07592678961773353, 0.46923395121456496], [-0.12197143552446302, 0.5], [-0.49999999999999994, -0.08211294175700139], [-0.4690637535314161, -0.10278388078471552], [-0.4386792102442516, -0.12425755292254022], [-0.408867194186733, -0.14651924118822637], [-0.37964813702552125, -0.16955368853263394], [-0.3510420640428723, -0.19334510829614787], [-0.323068580412302, -0.21787719502807146], [-0.29574685776218473, -0.2431331356615624], [-0.26909562103647355, -0.26909562103647405], [-0.24313313566156178, -0.2957468577621852], [-0.21787719502807082, -0.32306858041230246], [-0.19334510829614737, -0.3510420640428729], [-0.16955368853263314, -0.37964813702552214], [-0.1465192411882263, -0.4088671941867328], [-0.12425755292253969, -0.43867921024425216], [-0.10278388078471468, -0.46906375353141705], [-0.08211294175700128, -0.5]], "depth": 1});
  if (!endpoint_base_sector_04_20) {
    mesh_base_sector_04_20Geometry.scale(1.5127718921430489, 1.5127718921430495, 0.5);
  }
  const mesh_base_sector_04_20 = new THREE.Mesh(
    mesh_base_sector_04_20Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_sector_04_20.name = "Radial annular sector 4";
  if (endpoint_base_sector_04_20) {
    mesh_base_sector_04_20.position.copy(endpoint_base_sector_04_20.midpoint);
    mesh_base_sector_04_20.quaternion.copy(endpoint_base_sector_04_20.quaternion);
  }
  mesh_base_sector_04_20.castShadow = options.castShadow ?? true;
  mesh_base_sector_04_20.receiveShadow = options.receiveShadow ?? true;
  mesh_base_sector_04_20.userData.sculptComponent = {"id": "base-sector-04", "name": "Radial annular sector 4", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.5127718921430489, "height": 1.5127718921430495, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [1.9273598713538322, -0.225, -1.927359871353833], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[0.5000000000000001, -0.12197143552446325], [0.4692339512145662, -0.07592678961773511], [0.43727313686989666, -0.03070328332986174], [0.4041394613116652, 0.013668089406911043], [0.36985563270603633, 0.057156918670108414], [0.33444514747661996, 0.0997333993884702], [0.2979322742011989, 0.14136835176885404], [0.2603420369792588, 0.1820332412946099], [0.22170019828171575, 0.22170019828171492], [0.18203324129461074, 0.26034203697925795], [0.14136835176885484, 0.29793227420119806], [0.09973339938847127, 0.33444514747661913], [0.05715691867011005, 0.36985563270603516], [0.013668089406911048, 0.4041394613116649], [-0.030703283329860873, 0.4372731368698957], [-0.07592678961773353, 0.46923395121456496], [-0.12197143552446302, 0.5], [-0.49999999999999994, -0.08211294175700139], [-0.4690637535314161, -0.10278388078471552], [-0.4386792102442516, -0.12425755292254022], [-0.408867194186733, -0.14651924118822637], [-0.37964813702552125, -0.16955368853263394], [-0.3510420640428723, -0.19334510829614787], [-0.323068580412302, -0.21787719502807146], [-0.29574685776218473, -0.2431331356615624], [-0.26909562103647355, -0.26909562103647405], [-0.24313313566156178, -0.2957468577621852], [-0.21787719502807082, -0.32306858041230246], [-0.19334510829614737, -0.3510420640428729], [-0.16955368853263314, -0.37964813702552214], [-0.1465192411882263, -0.4088671941867328], [-0.12425755292253969, -0.43867921024425216], [-0.10278388078471468, -0.46906375353141705], [-0.08211294175700128, -0.5]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 135, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [1.170973925282308, 0, -2.6837458174253577], "max": [2.683745817425357, 0.5, -1.1709739252823081]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-04", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-04.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_04_20.add(mesh_base_sector_04_20);
  meshes["base-sector-04"] = mesh_base_sector_04_20;
  colliders["base-sector-04"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["base-sector-04"] ??= [];
  destructionGroups["base-sector-04"].push(node_base_sector_04_20);

  const endpoint_base_sector_05_21 = makeAttachmentEndpoint(null);
  const node_base_sector_05_21 = new THREE.Group();
  node_base_sector_05_21.name = "Radial annular sector 5__pivot";
  node_base_sector_05_21.scale.set(1, 1, 1);
  if (endpoint_base_sector_05_21) {
    node_base_sector_05_21.position.copy(endpoint_base_sector_05_21.start);
    node_base_sector_05_21.rotation.set(-1.5707963267948966, 0.0, 0.0);
  } else {
    node_base_sector_05_21.position.set(3.885780586188048e-16, -0.225, -2.651508670788841);
    node_base_sector_05_21.rotation.set(-1.5707963267948966, 0.0, 0.0);
  }
  node_base_sector_05_21.userData.sculptComponent = {"id": "base-sector-05", "name": "Radial annular sector 5", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.3306348212336587, "height": 1.0969826584223181, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [3.885780586188048e-16, -0.225, -2.651508670788841], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[0.5, 0.4362545277129616], [0.4382522328960388, 0.4511530146954097], [0.37620410960283696, 0.4640857494026197], [0.3138981548047281, 0.47504386838422796], [0.25137706989087966, 0.4840198614928542], [0.18868370368989182, 0.49100757703118325], [0.12586102310335623, 0.4960022259680285], [0.06295208365848504, 0.49900038522049767], [2.486720665614697e-18, 0.5], [-0.06295208365848502, 0.49900038522049767], [-0.12586102310335623, 0.4960022259680285], [-0.18868370368989182, 0.49100757703118325], [-0.2513770698908786, 0.4840198614928546], [-0.31389815480472805, 0.47504386838422835], [-0.37620410960283696, 0.4640857494026201], [-0.43825223289603765, 0.4511530146954097], [-0.5, 0.4362545277129616], [-0.3359375000000001, -0.5], [-0.2944507189770254, -0.4899900790586674], [-0.2527621361394062, -0.4813008979272606], [-0.21090032275942674, -0.47393841173649254], [-0.16889396883293414, -0.4679076663666341], [-0.12677186341664615, -0.46321279498931967], [-0.08456287489756756, -0.4598570152348765], [-0.04229593120804472, -0.45784262698712413], [-9.414979587410402e-17, -0.4571710108071459], [0.042295931208044535, -0.45784262698712413], [0.08456287489756735, -0.4598570152348765], [0.12677186341664598, -0.46321279498931967], [0.16889396883293467, -0.4679076663666345], [0.21090032275942655, -0.47393841173649254], [0.252762136139406, -0.4813008979272606], [0.29445071897702596, -0.4899900790586674], [0.3359374999999999, -0.5]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 180, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [-0.665317410616829, 0, -3.2], "max": [0.6653174106168298, 0.5, -2.103017341577682]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-05", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-05.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_05_21.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-05", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["base-shell"] ?? root).add(node_base_sector_05_21);
  nodes["base-sector-05"] = node_base_sector_05_21;
  const mesh_base_sector_05_21Geometry = endpoint_base_sector_05_21
    ? new THREE.CylinderGeometry(endpoint_base_sector_05_21.endRadius, endpoint_base_sector_05_21.baseRadius, endpoint_base_sector_05_21.length, 16, 6)
    : buildExtrudeGeometry({"points": [[0.5, 0.4362545277129616], [0.4382522328960388, 0.4511530146954097], [0.37620410960283696, 0.4640857494026197], [0.3138981548047281, 0.47504386838422796], [0.25137706989087966, 0.4840198614928542], [0.18868370368989182, 0.49100757703118325], [0.12586102310335623, 0.4960022259680285], [0.06295208365848504, 0.49900038522049767], [2.486720665614697e-18, 0.5], [-0.06295208365848502, 0.49900038522049767], [-0.12586102310335623, 0.4960022259680285], [-0.18868370368989182, 0.49100757703118325], [-0.2513770698908786, 0.4840198614928546], [-0.31389815480472805, 0.47504386838422835], [-0.37620410960283696, 0.4640857494026201], [-0.43825223289603765, 0.4511530146954097], [-0.5, 0.4362545277129616], [-0.3359375000000001, -0.5], [-0.2944507189770254, -0.4899900790586674], [-0.2527621361394062, -0.4813008979272606], [-0.21090032275942674, -0.47393841173649254], [-0.16889396883293414, -0.4679076663666341], [-0.12677186341664615, -0.46321279498931967], [-0.08456287489756756, -0.4598570152348765], [-0.04229593120804472, -0.45784262698712413], [-9.414979587410402e-17, -0.4571710108071459], [0.042295931208044535, -0.45784262698712413], [0.08456287489756735, -0.4598570152348765], [0.12677186341664598, -0.46321279498931967], [0.16889396883293467, -0.4679076663666345], [0.21090032275942655, -0.47393841173649254], [0.252762136139406, -0.4813008979272606], [0.29445071897702596, -0.4899900790586674], [0.3359374999999999, -0.5]], "depth": 1});
  if (!endpoint_base_sector_05_21) {
    mesh_base_sector_05_21Geometry.scale(1.3306348212336587, 1.0969826584223181, 0.5);
  }
  const mesh_base_sector_05_21 = new THREE.Mesh(
    mesh_base_sector_05_21Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_sector_05_21.name = "Radial annular sector 5";
  if (endpoint_base_sector_05_21) {
    mesh_base_sector_05_21.position.copy(endpoint_base_sector_05_21.midpoint);
    mesh_base_sector_05_21.quaternion.copy(endpoint_base_sector_05_21.quaternion);
  }
  mesh_base_sector_05_21.castShadow = options.castShadow ?? true;
  mesh_base_sector_05_21.receiveShadow = options.receiveShadow ?? true;
  mesh_base_sector_05_21.userData.sculptComponent = {"id": "base-sector-05", "name": "Radial annular sector 5", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.3306348212336587, "height": 1.0969826584223181, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [3.885780586188048e-16, -0.225, -2.651508670788841], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[0.5, 0.4362545277129616], [0.4382522328960388, 0.4511530146954097], [0.37620410960283696, 0.4640857494026197], [0.3138981548047281, 0.47504386838422796], [0.25137706989087966, 0.4840198614928542], [0.18868370368989182, 0.49100757703118325], [0.12586102310335623, 0.4960022259680285], [0.06295208365848504, 0.49900038522049767], [2.486720665614697e-18, 0.5], [-0.06295208365848502, 0.49900038522049767], [-0.12586102310335623, 0.4960022259680285], [-0.18868370368989182, 0.49100757703118325], [-0.2513770698908786, 0.4840198614928546], [-0.31389815480472805, 0.47504386838422835], [-0.37620410960283696, 0.4640857494026201], [-0.43825223289603765, 0.4511530146954097], [-0.5, 0.4362545277129616], [-0.3359375000000001, -0.5], [-0.2944507189770254, -0.4899900790586674], [-0.2527621361394062, -0.4813008979272606], [-0.21090032275942674, -0.47393841173649254], [-0.16889396883293414, -0.4679076663666341], [-0.12677186341664615, -0.46321279498931967], [-0.08456287489756756, -0.4598570152348765], [-0.04229593120804472, -0.45784262698712413], [-9.414979587410402e-17, -0.4571710108071459], [0.042295931208044535, -0.45784262698712413], [0.08456287489756735, -0.4598570152348765], [0.12677186341664598, -0.46321279498931967], [0.16889396883293467, -0.4679076663666345], [0.21090032275942655, -0.47393841173649254], [0.252762136139406, -0.4813008979272606], [0.29445071897702596, -0.4899900790586674], [0.3359374999999999, -0.5]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 180, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [-0.665317410616829, 0, -3.2], "max": [0.6653174106168298, 0.5, -2.103017341577682]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-05", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-05.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_05_21.add(mesh_base_sector_05_21);
  meshes["base-sector-05"] = mesh_base_sector_05_21;
  colliders["base-sector-05"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["base-sector-05"] ??= [];
  destructionGroups["base-sector-05"].push(node_base_sector_05_21);

  const endpoint_base_sector_06_22 = makeAttachmentEndpoint(null);
  const node_base_sector_06_22 = new THREE.Group();
  node_base_sector_06_22.name = "Radial annular sector 6__pivot";
  node_base_sector_06_22.scale.set(1, 1, 1);
  if (endpoint_base_sector_06_22) {
    node_base_sector_06_22.position.copy(endpoint_base_sector_06_22.start);
    node_base_sector_06_22.rotation.set(-1.5707963267948966, 0.0, 0.0);
  } else {
    node_base_sector_06_22.position.set(-1.9273598713538327, -0.225, -1.9273598713538327);
    node_base_sector_06_22.rotation.set(-1.5707963267948966, 0.0, 0.0);
  }
  node_base_sector_06_22.userData.sculptComponent = {"id": "base-sector-06", "name": "Radial annular sector 6", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.512771892143049, "height": 1.5127718921430493, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [-1.9273598713538327, -0.225, -1.9273598713538327], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[0.12197143552446314, 0.49999999999999994], [0.0759267896177344, 0.46923395121456546], [0.0307032833298616, 0.4372731368698962], [-0.013668089406911194, 0.4041394613116648], [-0.057156918670109455, 0.3698556327060356], [-0.09973339938847038, 0.3344451474766196], [-0.14136835176885423, 0.29793227420119855], [-0.18203324129461013, 0.2603420369792584], [-0.22170019828171514, 0.2217001982817154], [-0.2603420369792582, 0.18203324129461068], [-0.2979322742011983, 0.1413683517688548], [-0.33444514747661847, 0.09973339938847155], [-0.3698556327060363, 0.05715691867010857], [-0.40413946131166456, 0.013668089406911778], [-0.437273136869896, -0.030703283329861157], [-0.4692339512145658, -0.07592678961773454], [-0.5, -0.12197143552446327], [0.0821129417570014, -0.5000000000000001], [0.1027838807847151, -0.4690637535314167], [0.12425755292254012, -0.43867921024425177], [0.14651924118822685, -0.40886719418673245], [0.16955368853263325, -0.3796481370255222], [0.19334510829614823, -0.3510420640428719], [0.21787719502807137, -0.3230685804123021], [0.2431331356615623, -0.2957468577621848], [0.269095621036474, -0.26909562103647366], [0.2957468577621851, -0.243133135661562], [0.3230685804123024, -0.21787719502807107], [0.35104206404287286, -0.19334510829614762], [0.37964813702552164, -0.16955368853263367], [0.4088671941867328, -0.14651924118822654], [0.4386792102442521, -0.12425755292253965], [0.4690637535314166, -0.10278388078471525], [0.5, -0.08211294175700139]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 225, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [-2.6837458174253572, 0, -2.6837458174253572], "max": [-1.1709739252823081, 0.5, -1.170973925282308]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-06", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-06.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_06_22.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-06", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["base-shell"] ?? root).add(node_base_sector_06_22);
  nodes["base-sector-06"] = node_base_sector_06_22;
  const mesh_base_sector_06_22Geometry = endpoint_base_sector_06_22
    ? new THREE.CylinderGeometry(endpoint_base_sector_06_22.endRadius, endpoint_base_sector_06_22.baseRadius, endpoint_base_sector_06_22.length, 16, 6)
    : buildExtrudeGeometry({"points": [[0.12197143552446314, 0.49999999999999994], [0.0759267896177344, 0.46923395121456546], [0.0307032833298616, 0.4372731368698962], [-0.013668089406911194, 0.4041394613116648], [-0.057156918670109455, 0.3698556327060356], [-0.09973339938847038, 0.3344451474766196], [-0.14136835176885423, 0.29793227420119855], [-0.18203324129461013, 0.2603420369792584], [-0.22170019828171514, 0.2217001982817154], [-0.2603420369792582, 0.18203324129461068], [-0.2979322742011983, 0.1413683517688548], [-0.33444514747661847, 0.09973339938847155], [-0.3698556327060363, 0.05715691867010857], [-0.40413946131166456, 0.013668089406911778], [-0.437273136869896, -0.030703283329861157], [-0.4692339512145658, -0.07592678961773454], [-0.5, -0.12197143552446327], [0.0821129417570014, -0.5000000000000001], [0.1027838807847151, -0.4690637535314167], [0.12425755292254012, -0.43867921024425177], [0.14651924118822685, -0.40886719418673245], [0.16955368853263325, -0.3796481370255222], [0.19334510829614823, -0.3510420640428719], [0.21787719502807137, -0.3230685804123021], [0.2431331356615623, -0.2957468577621848], [0.269095621036474, -0.26909562103647366], [0.2957468577621851, -0.243133135661562], [0.3230685804123024, -0.21787719502807107], [0.35104206404287286, -0.19334510829614762], [0.37964813702552164, -0.16955368853263367], [0.4088671941867328, -0.14651924118822654], [0.4386792102442521, -0.12425755292253965], [0.4690637535314166, -0.10278388078471525], [0.5, -0.08211294175700139]], "depth": 1});
  if (!endpoint_base_sector_06_22) {
    mesh_base_sector_06_22Geometry.scale(1.512771892143049, 1.5127718921430493, 0.5);
  }
  const mesh_base_sector_06_22 = new THREE.Mesh(
    mesh_base_sector_06_22Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_sector_06_22.name = "Radial annular sector 6";
  if (endpoint_base_sector_06_22) {
    mesh_base_sector_06_22.position.copy(endpoint_base_sector_06_22.midpoint);
    mesh_base_sector_06_22.quaternion.copy(endpoint_base_sector_06_22.quaternion);
  }
  mesh_base_sector_06_22.castShadow = options.castShadow ?? true;
  mesh_base_sector_06_22.receiveShadow = options.receiveShadow ?? true;
  mesh_base_sector_06_22.userData.sculptComponent = {"id": "base-sector-06", "name": "Radial annular sector 6", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.512771892143049, "height": 1.5127718921430493, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [-1.9273598713538327, -0.225, -1.9273598713538327], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[0.12197143552446314, 0.49999999999999994], [0.0759267896177344, 0.46923395121456546], [0.0307032833298616, 0.4372731368698962], [-0.013668089406911194, 0.4041394613116648], [-0.057156918670109455, 0.3698556327060356], [-0.09973339938847038, 0.3344451474766196], [-0.14136835176885423, 0.29793227420119855], [-0.18203324129461013, 0.2603420369792584], [-0.22170019828171514, 0.2217001982817154], [-0.2603420369792582, 0.18203324129461068], [-0.2979322742011983, 0.1413683517688548], [-0.33444514747661847, 0.09973339938847155], [-0.3698556327060363, 0.05715691867010857], [-0.40413946131166456, 0.013668089406911778], [-0.437273136869896, -0.030703283329861157], [-0.4692339512145658, -0.07592678961773454], [-0.5, -0.12197143552446327], [0.0821129417570014, -0.5000000000000001], [0.1027838807847151, -0.4690637535314167], [0.12425755292254012, -0.43867921024425177], [0.14651924118822685, -0.40886719418673245], [0.16955368853263325, -0.3796481370255222], [0.19334510829614823, -0.3510420640428719], [0.21787719502807137, -0.3230685804123021], [0.2431331356615623, -0.2957468577621848], [0.269095621036474, -0.26909562103647366], [0.2957468577621851, -0.243133135661562], [0.3230685804123024, -0.21787719502807107], [0.35104206404287286, -0.19334510829614762], [0.37964813702552164, -0.16955368853263367], [0.4088671941867328, -0.14651924118822654], [0.4386792102442521, -0.12425755292253965], [0.4690637535314166, -0.10278388078471525], [0.5, -0.08211294175700139]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 225, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [-2.6837458174253572, 0, -2.6837458174253572], "max": [-1.1709739252823081, 0.5, -1.170973925282308]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-06", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-06.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_06_22.add(mesh_base_sector_06_22);
  meshes["base-sector-06"] = mesh_base_sector_06_22;
  colliders["base-sector-06"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["base-sector-06"] ??= [];
  destructionGroups["base-sector-06"].push(node_base_sector_06_22);

  const endpoint_base_sector_07_23 = makeAttachmentEndpoint(null);
  const node_base_sector_07_23 = new THREE.Group();
  node_base_sector_07_23.name = "Radial annular sector 7__pivot";
  node_base_sector_07_23.scale.set(1, 1, 1);
  if (endpoint_base_sector_07_23) {
    node_base_sector_07_23.position.copy(endpoint_base_sector_07_23.start);
    node_base_sector_07_23.rotation.set(-1.5707963267948966, 0.0, 0.0);
  } else {
    node_base_sector_07_23.position.set(-2.651508670788841, -0.225, -1.942890293094024e-15);
    node_base_sector_07_23.rotation.set(-1.5707963267948966, 0.0, 0.0);
  }
  node_base_sector_07_23.userData.sculptComponent = {"id": "base-sector-07", "name": "Radial annular sector 7", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.0969826584223181, "height": 1.3306348212336587, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [-2.651508670788841, -0.225, -1.942890293094024e-15], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[-0.4362545277129612, 0.5], [-0.4511530146954097, 0.4382522328960378], [-0.4640857494026197, 0.37620410960283596], [-0.47504386838422796, 0.31389815480472705], [-0.4840198614928546, 0.2513770698908776], [-0.49100757703118325, 0.18868370368989187], [-0.4960022259680285, 0.12586102310335626], [-0.49900038522049767, 0.06295208365848402], [-0.5, -1.018355906428926e-15], [-0.49900038522049767, -0.06295208365848605], [-0.4960022259680285, -0.1258610231033583], [-0.49100757703118364, -0.1886837036898918], [-0.4840198614928546, -0.2513770698908796], [-0.47504386838422796, -0.31389815480473116], [-0.4640857494026201, -0.37620410960283795], [-0.4511530146954097, -0.4382522328960398], [-0.4362545277129616, -0.5], [0.4999999999999996, -0.33593750000000044], [0.4899900790586674, -0.29445071897702724], [0.4813008979272606, -0.25276213613940723], [0.47393841173649254, -0.21090032275942922], [0.4679076663666341, -0.1688939688329352], [0.4632127949893192, -0.1267718634166465], [0.4598570152348765, -0.08456287489756933], [0.45784262698712413, -0.04229593120804579], [0.4571710108071459, -1.163310681238504e-15], [0.45784262698712413, 0.04229593120804346], [0.4598570152348765, 0.084562874897567], [0.46321279498931967, 0.1267718634166456], [0.4679076663666341, 0.1688939688329329], [0.47393841173649254, 0.21090032275942547], [0.4813008979272606, 0.2527621361394049], [0.4899900790586674, 0.29445071897702485], [0.5, 0.3359374999999995]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 270, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [-3.2, 0, -0.6653174106168314], "max": [-2.103017341577682, 0.5, 0.6653174106168275]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-07", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-07.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_07_23.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-07", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["base-shell"] ?? root).add(node_base_sector_07_23);
  nodes["base-sector-07"] = node_base_sector_07_23;
  const mesh_base_sector_07_23Geometry = endpoint_base_sector_07_23
    ? new THREE.CylinderGeometry(endpoint_base_sector_07_23.endRadius, endpoint_base_sector_07_23.baseRadius, endpoint_base_sector_07_23.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.4362545277129612, 0.5], [-0.4511530146954097, 0.4382522328960378], [-0.4640857494026197, 0.37620410960283596], [-0.47504386838422796, 0.31389815480472705], [-0.4840198614928546, 0.2513770698908776], [-0.49100757703118325, 0.18868370368989187], [-0.4960022259680285, 0.12586102310335626], [-0.49900038522049767, 0.06295208365848402], [-0.5, -1.018355906428926e-15], [-0.49900038522049767, -0.06295208365848605], [-0.4960022259680285, -0.1258610231033583], [-0.49100757703118364, -0.1886837036898918], [-0.4840198614928546, -0.2513770698908796], [-0.47504386838422796, -0.31389815480473116], [-0.4640857494026201, -0.37620410960283795], [-0.4511530146954097, -0.4382522328960398], [-0.4362545277129616, -0.5], [0.4999999999999996, -0.33593750000000044], [0.4899900790586674, -0.29445071897702724], [0.4813008979272606, -0.25276213613940723], [0.47393841173649254, -0.21090032275942922], [0.4679076663666341, -0.1688939688329352], [0.4632127949893192, -0.1267718634166465], [0.4598570152348765, -0.08456287489756933], [0.45784262698712413, -0.04229593120804579], [0.4571710108071459, -1.163310681238504e-15], [0.45784262698712413, 0.04229593120804346], [0.4598570152348765, 0.084562874897567], [0.46321279498931967, 0.1267718634166456], [0.4679076663666341, 0.1688939688329329], [0.47393841173649254, 0.21090032275942547], [0.4813008979272606, 0.2527621361394049], [0.4899900790586674, 0.29445071897702485], [0.5, 0.3359374999999995]], "depth": 1});
  if (!endpoint_base_sector_07_23) {
    mesh_base_sector_07_23Geometry.scale(1.0969826584223181, 1.3306348212336587, 0.5);
  }
  const mesh_base_sector_07_23 = new THREE.Mesh(
    mesh_base_sector_07_23Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_sector_07_23.name = "Radial annular sector 7";
  if (endpoint_base_sector_07_23) {
    mesh_base_sector_07_23.position.copy(endpoint_base_sector_07_23.midpoint);
    mesh_base_sector_07_23.quaternion.copy(endpoint_base_sector_07_23.quaternion);
  }
  mesh_base_sector_07_23.castShadow = options.castShadow ?? true;
  mesh_base_sector_07_23.receiveShadow = options.receiveShadow ?? true;
  mesh_base_sector_07_23.userData.sculptComponent = {"id": "base-sector-07", "name": "Radial annular sector 7", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.0969826584223181, "height": 1.3306348212336587, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [-2.651508670788841, -0.225, -1.942890293094024e-15], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[-0.4362545277129612, 0.5], [-0.4511530146954097, 0.4382522328960378], [-0.4640857494026197, 0.37620410960283596], [-0.47504386838422796, 0.31389815480472705], [-0.4840198614928546, 0.2513770698908776], [-0.49100757703118325, 0.18868370368989187], [-0.4960022259680285, 0.12586102310335626], [-0.49900038522049767, 0.06295208365848402], [-0.5, -1.018355906428926e-15], [-0.49900038522049767, -0.06295208365848605], [-0.4960022259680285, -0.1258610231033583], [-0.49100757703118364, -0.1886837036898918], [-0.4840198614928546, -0.2513770698908796], [-0.47504386838422796, -0.31389815480473116], [-0.4640857494026201, -0.37620410960283795], [-0.4511530146954097, -0.4382522328960398], [-0.4362545277129616, -0.5], [0.4999999999999996, -0.33593750000000044], [0.4899900790586674, -0.29445071897702724], [0.4813008979272606, -0.25276213613940723], [0.47393841173649254, -0.21090032275942922], [0.4679076663666341, -0.1688939688329352], [0.4632127949893192, -0.1267718634166465], [0.4598570152348765, -0.08456287489756933], [0.45784262698712413, -0.04229593120804579], [0.4571710108071459, -1.163310681238504e-15], [0.45784262698712413, 0.04229593120804346], [0.4598570152348765, 0.084562874897567], [0.46321279498931967, 0.1267718634166456], [0.4679076663666341, 0.1688939688329329], [0.47393841173649254, 0.21090032275942547], [0.4813008979272606, 0.2527621361394049], [0.4899900790586674, 0.29445071897702485], [0.5, 0.3359374999999995]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 270, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [-3.2, 0, -0.6653174106168314], "max": [-2.103017341577682, 0.5, 0.6653174106168275]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-07", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-07.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_07_23.add(mesh_base_sector_07_23);
  meshes["base-sector-07"] = mesh_base_sector_07_23;
  colliders["base-sector-07"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["base-sector-07"] ??= [];
  destructionGroups["base-sector-07"].push(node_base_sector_07_23);

  const endpoint_base_sector_08_24 = makeAttachmentEndpoint(null);
  const node_base_sector_08_24 = new THREE.Group();
  node_base_sector_08_24.name = "Radial annular sector 8__pivot";
  node_base_sector_08_24.scale.set(1, 1, 1);
  if (endpoint_base_sector_08_24) {
    node_base_sector_08_24.position.copy(endpoint_base_sector_08_24.start);
    node_base_sector_08_24.rotation.set(-1.5707963267948966, 0.0, 0.0);
  } else {
    node_base_sector_08_24.position.set(-1.9273598713538327, -0.225, 1.9273598713538322);
    node_base_sector_08_24.rotation.set(-1.5707963267948966, 0.0, 0.0);
  }
  node_base_sector_08_24.userData.sculptComponent = {"id": "base-sector-08", "name": "Radial annular sector 8", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.5127718921430497, "height": 1.51277189214305, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [-1.9273598713538327, -0.225, 1.9273598713538322], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[-0.5000000000000001, 0.12197143552446366], [-0.4692339512145656, 0.07592678961773494], [-0.4372731368698961, 0.030703283329861584], [-0.40413946131166467, -0.013668089406911332], [-0.36985563270603555, -0.05715691867010942], [-0.3344451474766189, -0.0997333993884712], [-0.29793227420119933, -0.14136835176885354], [-0.26034203697925834, -0.18203324129461002], [-0.22170019828171533, -0.221700198281715], [-0.18203324129461063, -0.2603420369792583], [-0.14136835176885387, -0.29793227420119867], [-0.09973339938847181, -0.3344451474766186], [-0.057156918670109726, -0.36985563270603516], [-0.013668089406911775, -0.4041394613116646], [0.030703283329860855, -0.43727313686989605], [0.07592678961773436, -0.4692339512145655], [0.12197143552446324, -0.5], [0.49999999999999994, 0.08211294175700107], [0.46906375353141644, 0.1027838807847149], [0.4386792102442515, 0.12425755292253975], [0.4088671941867323, 0.14651924118822646], [0.3796481370255212, 0.16955368853263375], [0.3510420640428717, 0.19334510829614798], [0.3230685804123024, 0.21787719502807068], [0.2957468577621847, 0.2431331356615619], [0.26909562103647355, 0.26909562103647366], [0.24313313566156192, 0.29574685776218496], [0.2178771950280704, 0.3230685804123025], [0.19334510829614784, 0.35104206404287175], [0.1695536885326336, 0.37964813702552125], [0.14651924118822648, 0.40886719418673256], [0.12425755292253962, 0.4386792102442517], [0.10278388078471491, 0.46906375353141666], [0.08211294175700108, 0.5]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 315, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [-2.6837458174253577, 0, 1.1709739252823073], "max": [-1.170973925282308, 0.5, 2.6837458174253572]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-08", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-08.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_08_24.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-08", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}};
  (nodes["base-shell"] ?? root).add(node_base_sector_08_24);
  nodes["base-sector-08"] = node_base_sector_08_24;
  const mesh_base_sector_08_24Geometry = endpoint_base_sector_08_24
    ? new THREE.CylinderGeometry(endpoint_base_sector_08_24.endRadius, endpoint_base_sector_08_24.baseRadius, endpoint_base_sector_08_24.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.5000000000000001, 0.12197143552446366], [-0.4692339512145656, 0.07592678961773494], [-0.4372731368698961, 0.030703283329861584], [-0.40413946131166467, -0.013668089406911332], [-0.36985563270603555, -0.05715691867010942], [-0.3344451474766189, -0.0997333993884712], [-0.29793227420119933, -0.14136835176885354], [-0.26034203697925834, -0.18203324129461002], [-0.22170019828171533, -0.221700198281715], [-0.18203324129461063, -0.2603420369792583], [-0.14136835176885387, -0.29793227420119867], [-0.09973339938847181, -0.3344451474766186], [-0.057156918670109726, -0.36985563270603516], [-0.013668089406911775, -0.4041394613116646], [0.030703283329860855, -0.43727313686989605], [0.07592678961773436, -0.4692339512145655], [0.12197143552446324, -0.5], [0.49999999999999994, 0.08211294175700107], [0.46906375353141644, 0.1027838807847149], [0.4386792102442515, 0.12425755292253975], [0.4088671941867323, 0.14651924118822646], [0.3796481370255212, 0.16955368853263375], [0.3510420640428717, 0.19334510829614798], [0.3230685804123024, 0.21787719502807068], [0.2957468577621847, 0.2431331356615619], [0.26909562103647355, 0.26909562103647366], [0.24313313566156192, 0.29574685776218496], [0.2178771950280704, 0.3230685804123025], [0.19334510829614784, 0.35104206404287175], [0.1695536885326336, 0.37964813702552125], [0.14651924118822648, 0.40886719418673256], [0.12425755292253962, 0.4386792102442517], [0.10278388078471491, 0.46906375353141666], [0.08211294175700108, 0.5]], "depth": 1});
  if (!endpoint_base_sector_08_24) {
    mesh_base_sector_08_24Geometry.scale(1.5127718921430497, 1.51277189214305, 0.5);
  }
  const mesh_base_sector_08_24 = new THREE.Mesh(
    mesh_base_sector_08_24Geometry,
    materialMap["blue-face"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_sector_08_24.name = "Radial annular sector 8";
  if (endpoint_base_sector_08_24) {
    mesh_base_sector_08_24.position.copy(endpoint_base_sector_08_24.midpoint);
    mesh_base_sector_08_24.quaternion.copy(endpoint_base_sector_08_24.quaternion);
  }
  mesh_base_sector_08_24.castShadow = options.castShadow ?? true;
  mesh_base_sector_08_24.receiveShadow = options.receiveShadow ?? true;
  mesh_base_sector_08_24.userData.sculptComponent = {"id": "base-sector-08", "name": "Radial annular sector 8", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "parent": "base-shell", "dimensions": {"width": 1.5127718921430497, "height": 1.51277189214305, "depth": 0.5, "units": "relative", "confidence": 0.6}, "transform": {"position": [-1.9273598713538327, -0.225, 1.9273598713538322], "rotation": [-1.5707963267948966, 0, 0]}, "geometryDescriptor": {"topologyIntent": "A bounded annular wedge with curved inner/outer edges; separate from the continuous annular wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "profile2D": {"points": [[-0.5000000000000001, 0.12197143552446366], [-0.4692339512145656, 0.07592678961773494], [-0.4372731368698961, 0.030703283329861584], [-0.40413946131166467, -0.013668089406911332], [-0.36985563270603555, -0.05715691867010942], [-0.3344451474766189, -0.0997333993884712], [-0.29793227420119933, -0.14136835176885354], [-0.26034203697925834, -0.18203324129461002], [-0.22170019828171533, -0.221700198281715], [-0.18203324129461063, -0.2603420369792583], [-0.14136835176885387, -0.29793227420119867], [-0.09973339938847181, -0.3344451474766186], [-0.057156918670109726, -0.36985563270603516], [-0.013668089406911775, -0.4041394613116646], [0.030703283329860855, -0.43727313686989605], [0.07592678961773436, -0.4692339512145655], [0.12197143552446324, -0.5], [0.49999999999999994, 0.08211294175700107], [0.46906375353141644, 0.1027838807847149], [0.4386792102442515, 0.12425755292253975], [0.4088671941867323, 0.14651924118822646], [0.3796481370255212, 0.16955368853263375], [0.3510420640428717, 0.19334510829614798], [0.3230685804123024, 0.21787719502807068], [0.2957468577621847, 0.2431331356615619], [0.26909562103647355, 0.26909562103647366], [0.24313313566156192, 0.29574685776218496], [0.2178771950280704, 0.3230685804123025], [0.19334510829614784, 0.35104206404287175], [0.1695536885326336, 0.37964813702552125], [0.14651924118822648, 0.40886719418673256], [0.12425755292253962, 0.4386792102442517], [0.10278388078471491, 0.46906375353141666], [0.08211294175700108, 0.5]], "depth": 1}, "profileCoordinateContract": "Local XY profile spans [-0.5,0.5] independently; stock extrude uses local Z [0,1], NOT centered. Scale by local dimensions (dx,dz,worldHeight), then rotate X=-pi/2: local Z maps to world +Y. Node Y is the sector bottom relative to base-shell.", "sectorParameters": {"angleCenterDegrees": 315, "angularWidthDegrees": 24, "innerRadius": 2.15, "outerRadius": 3.2, "arcSegments": 16, "bottomY": 0, "topY": 0.5}, "expectedWorldBounds": {"min": [-2.6837458174253577, 0, 1.1709739252823073], "max": [-1.170973925282308, 0.5, 2.6837458174253572]}}, "material": "blue-face", "materialLayers": ["blue-face"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-sector-08", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "blue-face"}}, "localFeatures": [{"id": "base-sector-08.wedge-footprint", "kind": "contour", "realization": "extruded sampled annular sector, not a rectangular tile", "pass": "blockout"}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_sector_08_24.add(mesh_base_sector_08_24);
  meshes["base-sector-08"] = mesh_base_sector_08_24;
  colliders["base-sector-08"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["base-sector-08"] ??= [];
  destructionGroups["base-sector-08"].push(node_base_sector_08_24);

  const endpoint_orbit_violet_25 = makeAttachmentEndpoint(null);
  const node_orbit_violet_25 = new THREE.Group();
  node_orbit_violet_25.name = "Violet loop registered to base__pivot";
  node_orbit_violet_25.scale.set(1, 1, 1);
  if (endpoint_orbit_violet_25) {
    node_orbit_violet_25.position.copy(endpoint_orbit_violet_25.start);
    node_orbit_violet_25.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_orbit_violet_25.position.set(0.0, 0.52, 0.0);
    node_orbit_violet_25.rotation.set(0.0, 0.0, 0.0);
  }
  node_orbit_violet_25.userData.sculptComponent = {"id": "orbit-violet", "name": "Violet loop registered to base", "level": "macro", "role": "projected-part", "importance": 1, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": null, "dimensions": {"width": 5.1899999999999995, "height": 0.018, "depth": 5.1899999999999995, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.52, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.4749518304431599, -0.5], [0.5, -0.5], [0.5, 0.5], [0.4749518304431599, 0.5], [0.4749518304431599, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 2.465, "outerRadius": 2.5949999999999998, "worldCenterY": 0.52, "worldHeight": 0.018}}, "material": "violet-band", "materialLayers": ["violet-band"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(155, 88, 246, 0.26)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "orbit-violet", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "violet-band"}}, "localFeatures": [{"id": "orbit-violet.violet-loop", "description": "One dominant violet loop registered to the base rather than an unrelated floating orbital halo.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "orbit-violet", "memberComponentRefs": ["orbit-violet"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "orbit-violet.orbit-contrast", "description": "Selected cyan/white peaks with violet segments, not uniform white neon.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "orbit-violet", "memberComponentRefs": ["orbit-violet"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_orbit_violet_25.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "orbit-violet", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "violet-band"}};
  (nodes["root"] ?? root).add(node_orbit_violet_25);
  nodes["orbit-violet"] = node_orbit_violet_25;
  const mesh_orbit_violet_25Geometry = endpoint_orbit_violet_25
    ? new THREE.CylinderGeometry(endpoint_orbit_violet_25.endRadius, endpoint_orbit_violet_25.baseRadius, endpoint_orbit_violet_25.length, 16, 6)
    : buildLatheGeometry({"points": [[0.4749518304431599, -0.5], [0.5, -0.5], [0.5, 0.5], [0.4749518304431599, 0.5], [0.4749518304431599, -0.5]], "segments": 96});
  if (!endpoint_orbit_violet_25) {
    mesh_orbit_violet_25Geometry.scale(5.1899999999999995, 0.018, 5.1899999999999995);
  }
  const mesh_orbit_violet_25 = new THREE.Mesh(
    mesh_orbit_violet_25Geometry,
    materialMap["violet-band"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_orbit_violet_25.name = "Violet loop registered to base";
  if (endpoint_orbit_violet_25) {
    mesh_orbit_violet_25.position.copy(endpoint_orbit_violet_25.midpoint);
    mesh_orbit_violet_25.quaternion.copy(endpoint_orbit_violet_25.quaternion);
  }
  mesh_orbit_violet_25.castShadow = options.castShadow ?? true;
  mesh_orbit_violet_25.receiveShadow = options.receiveShadow ?? true;
  mesh_orbit_violet_25.userData.sculptComponent = {"id": "orbit-violet", "name": "Violet loop registered to base", "level": "macro", "role": "projected-part", "importance": 1, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": null, "dimensions": {"width": 5.1899999999999995, "height": 0.018, "depth": 5.1899999999999995, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.52, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.4749518304431599, -0.5], [0.5, -0.5], [0.5, 0.5], [0.4749518304431599, 0.5], [0.4749518304431599, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 2.465, "outerRadius": 2.5949999999999998, "worldCenterY": 0.52, "worldHeight": 0.018}}, "material": "violet-band", "materialLayers": ["violet-band"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(155, 88, 246, 0.26)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "orbit-violet", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "violet-band"}}, "localFeatures": [{"id": "orbit-violet.violet-loop", "description": "One dominant violet loop registered to the base rather than an unrelated floating orbital halo.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "orbit-violet", "memberComponentRefs": ["orbit-violet"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}, {"id": "orbit-violet.orbit-contrast", "description": "Selected cyan/white peaks with violet segments, not uniform white neon.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "orbit-violet", "memberComponentRefs": ["orbit-violet"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_orbit_violet_25.add(mesh_orbit_violet_25);
  meshes["orbit-violet"] = mesh_orbit_violet_25;
  colliders["orbit-violet"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["orbit-violet"] ??= [];
  destructionGroups["orbit-violet"].push(node_orbit_violet_25);

  const endpoint_base_rim_outer_top_26 = makeAttachmentEndpoint(null);
  const node_base_rim_outer_top_26 = new THREE.Group();
  node_base_rim_outer_top_26.name = "base-rim-outer-top__pivot";
  node_base_rim_outer_top_26.scale.set(1, 1, 1);
  if (endpoint_base_rim_outer_top_26) {
    node_base_rim_outer_top_26.position.copy(endpoint_base_rim_outer_top_26.start);
    node_base_rim_outer_top_26.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_base_rim_outer_top_26.position.set(0.0, 0.225, 0.0);
    node_base_rim_outer_top_26.rotation.set(0.0, 0.0, 0.0);
  }
  node_base_rim_outer_top_26.userData.sculptComponent = {"id": "base-rim-outer-top", "name": "base-rim-outer-top", "level": "micro", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": "base-shell", "dimensions": {"width": 6.218, "height": 0.018, "depth": 6.218, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.225, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.49710517851399166, -0.5], [0.5, -0.5], [0.5, 0.5], [0.49710517851399166, 0.5], [0.49710517851399166, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 3.091, "outerRadius": 3.109, "worldCenterY": 0.45, "worldHeight": 0.018}}, "material": "cyan-contour", "materialLayers": ["cyan-contour"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 217, 255, 0.48)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-rim-outer-top", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}}, "localFeatures": [{"id": "base-rim-system.rim-layers", "description": "Separate circular contours across different radii and heights.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "base-rim-system", "memberComponentRefs": ["base-rim-outer-top", "base-rim-outer-bottom", "base-rim-inner-top"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_rim_outer_top_26.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-rim-outer-top", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}};
  (nodes["base-shell"] ?? root).add(node_base_rim_outer_top_26);
  nodes["base-rim-outer-top"] = node_base_rim_outer_top_26;
  const mesh_base_rim_outer_top_26Geometry = endpoint_base_rim_outer_top_26
    ? new THREE.CylinderGeometry(endpoint_base_rim_outer_top_26.endRadius, endpoint_base_rim_outer_top_26.baseRadius, endpoint_base_rim_outer_top_26.length, 16, 6)
    : buildLatheGeometry({"points": [[0.49710517851399166, -0.5], [0.5, -0.5], [0.5, 0.5], [0.49710517851399166, 0.5], [0.49710517851399166, -0.5]], "segments": 96});
  if (!endpoint_base_rim_outer_top_26) {
    mesh_base_rim_outer_top_26Geometry.scale(6.218, 0.018, 6.218);
  }
  const mesh_base_rim_outer_top_26 = new THREE.Mesh(
    mesh_base_rim_outer_top_26Geometry,
    materialMap["cyan-contour"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_rim_outer_top_26.name = "base-rim-outer-top";
  if (endpoint_base_rim_outer_top_26) {
    mesh_base_rim_outer_top_26.position.copy(endpoint_base_rim_outer_top_26.midpoint);
    mesh_base_rim_outer_top_26.quaternion.copy(endpoint_base_rim_outer_top_26.quaternion);
  }
  mesh_base_rim_outer_top_26.castShadow = options.castShadow ?? true;
  mesh_base_rim_outer_top_26.receiveShadow = options.receiveShadow ?? true;
  mesh_base_rim_outer_top_26.userData.sculptComponent = {"id": "base-rim-outer-top", "name": "base-rim-outer-top", "level": "micro", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": "base-shell", "dimensions": {"width": 6.218, "height": 0.018, "depth": 6.218, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.225, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.49710517851399166, -0.5], [0.5, -0.5], [0.5, 0.5], [0.49710517851399166, 0.5], [0.49710517851399166, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 3.091, "outerRadius": 3.109, "worldCenterY": 0.45, "worldHeight": 0.018}}, "material": "cyan-contour", "materialLayers": ["cyan-contour"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 217, 255, 0.48)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-rim-outer-top", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}}, "localFeatures": [{"id": "base-rim-system.rim-layers", "description": "Separate circular contours across different radii and heights.", "status": "required-before-relevant-pass-acceptance", "kind": "contour", "evidenceRefs": ["primary"], "sourceFamily": "base-rim-system", "memberComponentRefs": ["base-rim-outer-top", "base-rim-outer-bottom", "base-rim-inner-top"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_rim_outer_top_26.add(mesh_base_rim_outer_top_26);
  meshes["base-rim-outer-top"] = mesh_base_rim_outer_top_26;
  colliders["base-rim-outer-top"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["base-rim-outer-top"] ??= [];
  destructionGroups["base-rim-outer-top"].push(node_base_rim_outer_top_26);

  const endpoint_base_rim_outer_bottom_27 = makeAttachmentEndpoint(null);
  const node_base_rim_outer_bottom_27 = new THREE.Group();
  node_base_rim_outer_bottom_27.name = "base-rim-outer-bottom__pivot";
  node_base_rim_outer_bottom_27.scale.set(1, 1, 1);
  if (endpoint_base_rim_outer_bottom_27) {
    node_base_rim_outer_bottom_27.position.copy(endpoint_base_rim_outer_bottom_27.start);
    node_base_rim_outer_bottom_27.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_base_rim_outer_bottom_27.position.set(0.0, -0.225, 0.0);
    node_base_rim_outer_bottom_27.rotation.set(0.0, 0.0, 0.0);
  }
  node_base_rim_outer_bottom_27.userData.sculptComponent = {"id": "base-rim-outer-bottom", "name": "base-rim-outer-bottom", "level": "micro", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": "base-shell", "dimensions": {"width": 6.218, "height": 0.018, "depth": 6.218, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, -0.225, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.49710517851399166, -0.5], [0.5, -0.5], [0.5, 0.5], [0.49710517851399166, 0.5], [0.49710517851399166, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 3.091, "outerRadius": 3.109, "worldCenterY": 0, "worldHeight": 0.018}}, "material": "cyan-contour", "materialLayers": ["cyan-contour"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 217, 255, 0.48)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-rim-outer-bottom", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}}, "localFeatures": [], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_rim_outer_bottom_27.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-rim-outer-bottom", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}};
  (nodes["base-shell"] ?? root).add(node_base_rim_outer_bottom_27);
  nodes["base-rim-outer-bottom"] = node_base_rim_outer_bottom_27;
  const mesh_base_rim_outer_bottom_27Geometry = endpoint_base_rim_outer_bottom_27
    ? new THREE.CylinderGeometry(endpoint_base_rim_outer_bottom_27.endRadius, endpoint_base_rim_outer_bottom_27.baseRadius, endpoint_base_rim_outer_bottom_27.length, 16, 6)
    : buildLatheGeometry({"points": [[0.49710517851399166, -0.5], [0.5, -0.5], [0.5, 0.5], [0.49710517851399166, 0.5], [0.49710517851399166, -0.5]], "segments": 96});
  if (!endpoint_base_rim_outer_bottom_27) {
    mesh_base_rim_outer_bottom_27Geometry.scale(6.218, 0.018, 6.218);
  }
  const mesh_base_rim_outer_bottom_27 = new THREE.Mesh(
    mesh_base_rim_outer_bottom_27Geometry,
    materialMap["cyan-contour"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_rim_outer_bottom_27.name = "base-rim-outer-bottom";
  if (endpoint_base_rim_outer_bottom_27) {
    mesh_base_rim_outer_bottom_27.position.copy(endpoint_base_rim_outer_bottom_27.midpoint);
    mesh_base_rim_outer_bottom_27.quaternion.copy(endpoint_base_rim_outer_bottom_27.quaternion);
  }
  mesh_base_rim_outer_bottom_27.castShadow = options.castShadow ?? true;
  mesh_base_rim_outer_bottom_27.receiveShadow = options.receiveShadow ?? true;
  mesh_base_rim_outer_bottom_27.userData.sculptComponent = {"id": "base-rim-outer-bottom", "name": "base-rim-outer-bottom", "level": "micro", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": "base-shell", "dimensions": {"width": 6.218, "height": 0.018, "depth": 6.218, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, -0.225, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.49710517851399166, -0.5], [0.5, -0.5], [0.5, 0.5], [0.49710517851399166, 0.5], [0.49710517851399166, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 3.091, "outerRadius": 3.109, "worldCenterY": 0, "worldHeight": 0.018}}, "material": "cyan-contour", "materialLayers": ["cyan-contour"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 217, 255, 0.48)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-rim-outer-bottom", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}}, "localFeatures": [], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_rim_outer_bottom_27.add(mesh_base_rim_outer_bottom_27);
  meshes["base-rim-outer-bottom"] = mesh_base_rim_outer_bottom_27;
  colliders["base-rim-outer-bottom"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["base-rim-outer-bottom"] ??= [];
  destructionGroups["base-rim-outer-bottom"].push(node_base_rim_outer_bottom_27);

  const endpoint_base_rim_inner_top_28 = makeAttachmentEndpoint(null);
  const node_base_rim_inner_top_28 = new THREE.Group();
  node_base_rim_inner_top_28.name = "base-rim-inner-top__pivot";
  node_base_rim_inner_top_28.scale.set(1, 1, 1);
  if (endpoint_base_rim_inner_top_28) {
    node_base_rim_inner_top_28.position.copy(endpoint_base_rim_inner_top_28.start);
    node_base_rim_inner_top_28.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_base_rim_inner_top_28.position.set(0.0, 0.23, 0.0);
    node_base_rim_inner_top_28.rotation.set(0.0, 0.0, 0.0);
  }
  node_base_rim_inner_top_28.userData.sculptComponent = {"id": "base-rim-inner-top", "name": "base-rim-inner-top", "level": "micro", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": "base-shell", "dimensions": {"width": 4.318, "height": 0.018, "depth": 4.318, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.23, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.4958314034275128, -0.5], [0.5, -0.5], [0.5, 0.5], [0.4958314034275128, 0.5], [0.4958314034275128, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 2.141, "outerRadius": 2.159, "worldCenterY": 0.455, "worldHeight": 0.018}}, "material": "cyan-contour", "materialLayers": ["cyan-contour"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 217, 255, 0.48)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-rim-inner-top", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}}, "localFeatures": [], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_rim_inner_top_28.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-rim-inner-top", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}};
  (nodes["base-shell"] ?? root).add(node_base_rim_inner_top_28);
  nodes["base-rim-inner-top"] = node_base_rim_inner_top_28;
  const mesh_base_rim_inner_top_28Geometry = endpoint_base_rim_inner_top_28
    ? new THREE.CylinderGeometry(endpoint_base_rim_inner_top_28.endRadius, endpoint_base_rim_inner_top_28.baseRadius, endpoint_base_rim_inner_top_28.length, 16, 6)
    : buildLatheGeometry({"points": [[0.4958314034275128, -0.5], [0.5, -0.5], [0.5, 0.5], [0.4958314034275128, 0.5], [0.4958314034275128, -0.5]], "segments": 96});
  if (!endpoint_base_rim_inner_top_28) {
    mesh_base_rim_inner_top_28Geometry.scale(4.318, 0.018, 4.318);
  }
  const mesh_base_rim_inner_top_28 = new THREE.Mesh(
    mesh_base_rim_inner_top_28Geometry,
    materialMap["cyan-contour"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_rim_inner_top_28.name = "base-rim-inner-top";
  if (endpoint_base_rim_inner_top_28) {
    mesh_base_rim_inner_top_28.position.copy(endpoint_base_rim_inner_top_28.midpoint);
    mesh_base_rim_inner_top_28.quaternion.copy(endpoint_base_rim_inner_top_28.quaternion);
  }
  mesh_base_rim_inner_top_28.castShadow = options.castShadow ?? true;
  mesh_base_rim_inner_top_28.receiveShadow = options.receiveShadow ?? true;
  mesh_base_rim_inner_top_28.userData.sculptComponent = {"id": "base-rim-inner-top", "name": "base-rim-inner-top", "level": "micro", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": "base-shell", "dimensions": {"width": 4.318, "height": 0.018, "depth": 4.318, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.23, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.4958314034275128, -0.5], [0.5, -0.5], [0.5, 0.5], [0.4958314034275128, 0.5], [0.4958314034275128, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 2.141, "outerRadius": 2.159, "worldCenterY": 0.455, "worldHeight": 0.018}}, "material": "cyan-contour", "materialLayers": ["cyan-contour"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 217, 255, 0.48)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-rim-inner-top", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}}, "localFeatures": [], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_base_rim_inner_top_28.add(mesh_base_rim_inner_top_28);
  meshes["base-rim-inner-top"] = mesh_base_rim_inner_top_28;
  colliders["base-rim-inner-top"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["base-rim-inner-top"] ??= [];
  destructionGroups["base-rim-inner-top"].push(node_base_rim_inner_top_28);

  const endpoint_inner_projection_field_29 = makeAttachmentEndpoint(null);
  const node_inner_projection_field_29 = new THREE.Group();
  node_inner_projection_field_29.name = "Faint inner polar projection field__pivot";
  node_inner_projection_field_29.scale.set(1, 1, 1);
  if (endpoint_inner_projection_field_29) {
    node_inner_projection_field_29.position.copy(endpoint_inner_projection_field_29.start);
    node_inner_projection_field_29.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_inner_projection_field_29.position.set(0.0, 0.225, 0.0);
    node_inner_projection_field_29.rotation.set(0.0, 0.0, 0.0);
  }
  node_inner_projection_field_29.userData.sculptComponent = {"id": "inner-projection-field", "name": "Faint inner polar projection field", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "lathe", "topologyClass": "material-only", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": "base-shell", "dimensions": {"width": 4.3, "height": 0.006, "depth": 4.3, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.225, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.22325581395348837, -0.5], [0.5, -0.5], [0.5, 0.5], [0.22325581395348837, 0.5], [0.22325581395348837, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 0.96, "outerRadius": 2.15, "worldCenterY": 0.45, "worldHeight": 0.006}}, "material": "field-fill", "materialLayers": ["field-fill"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "inner-projection-field", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "field-fill"}}, "localFeatures": [{"id": "inner-projection-field.inner-grid", "description": "Keep the interior as a faint projected field; the reference does not prove an empty physical through-hole or a solid opaque floor.", "status": "required-before-relevant-pass-acceptance", "kind": "emissive", "evidenceRefs": ["primary"], "sourceFamily": "inner-projection-field", "memberComponentRefs": ["inner-projection-field"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "renderIntent": {"blockout": "open radial/concentric line field only, no opaque filled carrier", "materialPass": "faint optional face carrier plus independent polar grid", "physicalFloorClaimed": false, "physicalThroughHoleClaimed": false}};
  node_inner_projection_field_29.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "inner-projection-field", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "field-fill"}};
  (nodes["base-shell"] ?? root).add(node_inner_projection_field_29);
  nodes["inner-projection-field"] = node_inner_projection_field_29;
  const mesh_inner_projection_field_29Geometry = endpoint_inner_projection_field_29
    ? new THREE.CylinderGeometry(endpoint_inner_projection_field_29.endRadius, endpoint_inner_projection_field_29.baseRadius, endpoint_inner_projection_field_29.length, 16, 6)
    : buildLatheGeometry({"points": [[0.22325581395348837, -0.5], [0.5, -0.5], [0.5, 0.5], [0.22325581395348837, 0.5], [0.22325581395348837, -0.5]], "segments": 96});
  if (!endpoint_inner_projection_field_29) {
    mesh_inner_projection_field_29Geometry.scale(4.3, 0.006, 4.3);
  }
  const mesh_inner_projection_field_29 = new THREE.Mesh(
    mesh_inner_projection_field_29Geometry,
    materialMap["field-fill"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_inner_projection_field_29.name = "Faint inner polar projection field";
  if (endpoint_inner_projection_field_29) {
    mesh_inner_projection_field_29.position.copy(endpoint_inner_projection_field_29.midpoint);
    mesh_inner_projection_field_29.quaternion.copy(endpoint_inner_projection_field_29.quaternion);
  }
  mesh_inner_projection_field_29.castShadow = options.castShadow ?? true;
  mesh_inner_projection_field_29.receiveShadow = options.receiveShadow ?? true;
  mesh_inner_projection_field_29.userData.sculptComponent = {"id": "inner-projection-field", "name": "Faint inner polar projection field", "level": "meso", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "lathe", "topologyClass": "material-only", "topologyRationale": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "parent": "base-shell", "dimensions": {"width": 4.3, "height": 0.006, "depth": 4.3, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.225, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular annular profile with a genuinely open center; not a filled cylinder or thick round torus.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals", "latheProfile": {"points": [[0.22325581395348837, -0.5], [0.5, -0.5], [0.5, 0.5], [0.22325581395348837, 0.5], [0.22325581395348837, -0.5]], "segments": 96}, "profileCoordinateContract": "Outer normalized radius 0.5 and unit height [-0.5,0.5]; component dimensions are applied exactly once.", "authoringParameters": {"innerRadius": 0.96, "outerRadius": 2.15, "worldCenterY": 0.45, "worldHeight": 0.006}}, "material": "field-fill", "materialLayers": ["field-fill"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(21, 92, 235, 0.20)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "inner-projection-field", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "field-fill"}}, "localFeatures": [{"id": "inner-projection-field.inner-grid", "description": "Keep the interior as a faint projected field; the reference does not prove an empty physical through-hole or a solid opaque floor.", "status": "required-before-relevant-pass-acceptance", "kind": "emissive", "evidenceRefs": ["primary"], "sourceFamily": "inner-projection-field", "memberComponentRefs": ["inner-projection-field"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout", "renderIntent": {"blockout": "open radial/concentric line field only, no opaque filled carrier", "materialPass": "faint optional face carrier plus independent polar grid", "physicalFloorClaimed": false, "physicalThroughHoleClaimed": false}};
  node_inner_projection_field_29.add(mesh_inner_projection_field_29);
  meshes["inner-projection-field"] = mesh_inner_projection_field_29;
  colliders["inner-projection-field"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["inner-projection-field"] ??= [];
  destructionGroups["inner-projection-field"].push(node_inner_projection_field_29);

  const endpoint_cap_center_light_30 = makeAttachmentEndpoint(null);
  const node_cap_center_light_30 = new THREE.Group();
  node_cap_center_light_30.name = "Cap center highlight carrier__pivot";
  node_cap_center_light_30.scale.set(1, 1, 1);
  if (endpoint_cap_center_light_30) {
    node_cap_center_light_30.position.copy(endpoint_cap_center_light_30.start);
    node_cap_center_light_30.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_cap_center_light_30.position.set(0.0, 0.05, 0.0);
    node_cap_center_light_30.rotation.set(0.0, 0.0, 0.0);
  }
  node_cap_center_light_30.userData.sculptComponent = {"id": "cap-center-light", "name": "Cap center highlight carrier", "level": "micro", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "sphere", "topologyClass": "material-only", "topologyRationale": "Discrete geometric carrier observed in the primary reference.", "parent": "core-cap", "dimensions": {"width": 0.04, "height": 0.04, "depth": 0.04, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.05, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Discrete geometric carrier observed in the primary reference.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "cyan-contour", "materialLayers": ["cyan-contour"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 217, 255, 0.48)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cap-center-light", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}}, "localFeatures": [{"id": "light-hierarchy.hotspots", "description": "Reference-anchored cap-center and selected front ring intersections.", "status": "required-before-relevant-pass-acceptance", "kind": "emissive", "evidenceRefs": ["primary"], "sourceFamily": "light-hierarchy", "memberComponentRefs": ["cap-center-light", "front-loop-light"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false, "ownerScope": "Reference-detail implementation responsibility; does not imply physical transform ownership."}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_cap_center_light_30.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cap-center-light", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}};
  (nodes["core-cap"] ?? root).add(node_cap_center_light_30);
  nodes["cap-center-light"] = node_cap_center_light_30;
  const mesh_cap_center_light_30Geometry = endpoint_cap_center_light_30
    ? new THREE.CylinderGeometry(endpoint_cap_center_light_30.endRadius, endpoint_cap_center_light_30.baseRadius, endpoint_cap_center_light_30.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_cap_center_light_30) {
    mesh_cap_center_light_30Geometry.scale(0.04, 0.04, 0.04);
  }
  const mesh_cap_center_light_30 = new THREE.Mesh(
    mesh_cap_center_light_30Geometry,
    materialMap["cyan-contour"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cap_center_light_30.name = "Cap center highlight carrier";
  if (endpoint_cap_center_light_30) {
    mesh_cap_center_light_30.position.copy(endpoint_cap_center_light_30.midpoint);
    mesh_cap_center_light_30.quaternion.copy(endpoint_cap_center_light_30.quaternion);
  }
  mesh_cap_center_light_30.castShadow = options.castShadow ?? true;
  mesh_cap_center_light_30.receiveShadow = options.receiveShadow ?? true;
  mesh_cap_center_light_30.userData.sculptComponent = {"id": "cap-center-light", "name": "Cap center highlight carrier", "level": "micro", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "sphere", "topologyClass": "material-only", "topologyRationale": "Discrete geometric carrier observed in the primary reference.", "parent": "core-cap", "dimensions": {"width": 0.04, "height": 0.04, "depth": 0.04, "units": "relative", "confidence": 0.6}, "transform": {"position": [0, 0.05, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Discrete geometric carrier observed in the primary reference.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "cyan-contour", "materialLayers": ["cyan-contour"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 217, 255, 0.48)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cap-center-light", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}}, "localFeatures": [{"id": "light-hierarchy.hotspots", "description": "Reference-anchored cap-center and selected front ring intersections.", "status": "required-before-relevant-pass-acceptance", "kind": "emissive", "evidenceRefs": ["primary"], "sourceFamily": "light-hierarchy", "memberComponentRefs": ["cap-center-light", "front-loop-light"], "realization": "Required geometric paths, glyph instances or named submesh scalar; see renderLayerContract", "runtimeImplemented": false, "ownerScope": "Reference-detail implementation responsibility; does not imply physical transform ownership."}], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_cap_center_light_30.add(mesh_cap_center_light_30);
  meshes["cap-center-light"] = mesh_cap_center_light_30;
  colliders["cap-center-light"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["cap-center-light"] ??= [];
  destructionGroups["cap-center-light"].push(node_cap_center_light_30);

  const endpoint_front_loop_light_31 = makeAttachmentEndpoint(null);
  const node_front_loop_light_31 = new THREE.Group();
  node_front_loop_light_31.name = "Front loop highlight carrier__pivot";
  node_front_loop_light_31.scale.set(1, 1, 1);
  if (endpoint_front_loop_light_31) {
    node_front_loop_light_31.position.copy(endpoint_front_loop_light_31.start);
    node_front_loop_light_31.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_front_loop_light_31.position.set(1.788980156401965, 0.0, 1.788980156401965);
    node_front_loop_light_31.rotation.set(0.0, 0.0, 0.0);
  }
  node_front_loop_light_31.userData.sculptComponent = {"id": "front-loop-light", "name": "Front loop highlight carrier", "level": "micro", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "sphere", "topologyClass": "material-only", "topologyRationale": "Discrete geometric carrier observed in the primary reference.", "parent": "orbit-violet", "dimensions": {"width": 0.04, "height": 0.04, "depth": 0.04, "units": "relative", "confidence": 0.6}, "transform": {"position": [1.788980156401965, 0, 1.788980156401965], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Discrete geometric carrier observed in the primary reference.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "cyan-contour", "materialLayers": ["cyan-contour"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 217, 255, 0.48)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "front-loop-light", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}}, "localFeatures": [], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_front_loop_light_31.userData.actionProfile = {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "front-loop-light", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}};
  (nodes["orbit-violet"] ?? root).add(node_front_loop_light_31);
  nodes["front-loop-light"] = node_front_loop_light_31;
  const mesh_front_loop_light_31Geometry = endpoint_front_loop_light_31
    ? new THREE.CylinderGeometry(endpoint_front_loop_light_31.endRadius, endpoint_front_loop_light_31.baseRadius, endpoint_front_loop_light_31.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_front_loop_light_31) {
    mesh_front_loop_light_31Geometry.scale(0.04, 0.04, 0.04);
  }
  const mesh_front_loop_light_31 = new THREE.Mesh(
    mesh_front_loop_light_31Geometry,
    materialMap["cyan-contour"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_front_loop_light_31.name = "Front loop highlight carrier";
  if (endpoint_front_loop_light_31) {
    mesh_front_loop_light_31.position.copy(endpoint_front_loop_light_31.midpoint);
    mesh_front_loop_light_31.quaternion.copy(endpoint_front_loop_light_31.quaternion);
  }
  mesh_front_loop_light_31.castShadow = options.castShadow ?? true;
  mesh_front_loop_light_31.receiveShadow = options.receiveShadow ?? true;
  mesh_front_loop_light_31.userData.sculptComponent = {"id": "front-loop-light", "name": "Front loop highlight carrier", "level": "micro", "role": "projected-part", "importance": 0.8, "confidence": 0.75, "primitive": "sphere", "topologyClass": "material-only", "topologyRationale": "Discrete geometric carrier observed in the primary reference.", "parent": "orbit-violet", "dimensions": {"width": 0.04, "height": 0.04, "depth": 0.04, "units": "relative", "confidence": 0.6}, "transform": {"position": [1.788980156401965, 0, 1.788980156401965], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Discrete geometric carrier observed in the primary reference.", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated local coordinates; no bitmap texture authored", "normalStrategy": "primitive analytic or recomputed normals"}, "material": "cyan-contour", "materialLayers": ["cyan-contour"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 217, 255, 0.48)", "secondaryAlbedo": "rgba(27, 168, 245, 0.10)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "synthetic holographic emission, not physical glass"}, "actionProfile": {"animationRole": "static-projection", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "notes": "No physics behavior authorized."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "front-loop-light", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cyan-contour"}}, "localFeatures": [], "deformations": [], "joints": [], "seams": [], "evidenceRefs": ["primary"], "fidelityTier": "blockout"};
  node_front_loop_light_31.add(mesh_front_loop_light_31);
  meshes["front-loop-light"] = mesh_front_loop_light_31;
  colliders["front-loop-light"] = {"type": "none", "notes": "No physics behavior authorized."};
  destructionGroups["front-loop-light"] ??= [];
  destructionGroups["front-loop-light"].push(node_front_loop_light_31);

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": false, "normalOrBumpRequired": false, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["physical glass refraction", "white studio highlights", "fabricated roughness/normal/AO maps", "textureless declarations that erase data glyphs or grids", "uniform glow"], "textureApplicability": "Per-material evidence-backed textureless carrier exception is used. Independent map-channel rules remain in force if any carrier later acquires sampled texture detail.", "requiredObservedSignals": ["colored blue fill", "cyan grid hierarchy", "violet loop accents", "local data glyphs", "rear depth fade"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only neutral blockout", "invented reflective floor", "bloom concealing silhouette or pattern gaps"]}, "screenshotReview": ["Neutral map-stripped geometry before colored look-dev", "Primary-matched color/alpha review with bloom off", "Selective bloom only after plain emission is accepted", "Structural orbit views with source limitations stated"]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createHolographicOrbitalDataCoreV2LookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Holographic Orbital Data Core v2 look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"id": "primary-emission", "type": "emission-observation", "observed": "Blue volumes, cyan outlines and a violet base loop; no physical light rig or PBR recovery established."}, {"id": "neutral-key", "type": "directional", "proposal": true, "position": [3, 5, 4], "intensity": 2.8, "color": "#FFFFFF", "purpose": "Neutral geometry review only."}, {"id": "neutral-fill", "type": "ambient", "proposal": true, "intensity": 0.9, "color": "#FFFFFF", "purpose": "Readable neutral edge cages and masses."}, {"id": "emission-environment", "type": "environment", "proposal": true, "background": "#000000", "exposure": 1, "toneMapping": "ACESFilmic proposed; inspect runtime", "contact shadow": "none for the projected scene; no physical ground receiver or reflective studio floor", "bloom": "disabled for blockout and diagnostic captures"}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": false, "normalOrBumpRequired": false, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["physical glass refraction", "white studio highlights", "fabricated roughness/normal/AO maps", "textureless declarations that erase data glyphs or grids", "uniform glow"], "textureApplicability": "Per-material evidence-backed textureless carrier exception is used. Independent map-channel rules remain in force if any carrier later acquires sampled texture detail.", "requiredObservedSignals": ["colored blue fill", "cyan grid hierarchy", "violet loop accents", "local data glyphs", "rear depth fade"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only neutral blockout", "invented reflective floor", "bloom concealing silhouette or pattern gaps"]}, "screenshotReview": ["Neutral map-stripped geometry before colored look-dev", "Primary-matched color/alpha review with bloom off", "Selective bloom only after plain emission is accepted", "Structural orbit views with source limitations stated"]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createHolographicOrbitalDataCoreV2Environment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameHolographicOrbitalDataCoreV2Camera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createHolographicOrbitalDataCoreV2PresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureHolographicOrbitalDataCoreV2Renderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createHolographicOrbitalDataCoreV2InspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}

