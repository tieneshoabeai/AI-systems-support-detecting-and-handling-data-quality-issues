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

// Generated from ObjectSculptSpec target: Layered Holographic Data Core
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createLayeredHolographicDataCoreModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Layered Holographic Data Core";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40, "aspect": 1.3, "orientation": {"yaw": 0.5585993153435624, "pitch": 0.2933817310353657, "roll": 0}, "positionHint": [5, 2.5, 8], "lookAtProposal": [0, -0.35, 0], "note": "Unsolved camera proposal only. Fit the projected outer ellipse and frame corner landmarks at 468x360; do not claim calibration or use ROI boundary as exact silhouette.", "orientationUnits": "radians", "status": "initial-camera-hypothesis-not-calibrated", "acceptance": {"viewportPx": [468, 360], "fitOrder": ["outer-band ellipse ratio", "assembly screen bounds", "cap center", "rear frame corners"], "requireOverlay": true, "referenceSilhouetteAuthority": "visible feature landmarks, not the polygon ROI edge", "evidenceRequiredBeforeClaimingSolved": "reference-aligned browser screenshot and landmark error report", "calibrationDeferredUntil": "blockout camera review"}}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["cyan-contour"] = createSculptMaterial(
    "cyan-contour",
    {"id": "cyan-contour", "name": "Cyan luminous geometry carrier", "type": "physical", "shaderModel": "MeshPhysicalMaterial; matte emission-dominant alpha carrier supported by current generator", "baseColor": "#22CFFF", "emissive": "#22CFFF", "emissiveIntensity": 1.4, "albedo": {"dominant": "#22CFFF", "secondary": ["#328FFF"], "samplingNotes": "Display palette proposal from observed blue/cyan/violet families; not measured physical albedo or sampled exact RGB."}, "roughness": 0.85, "metalness": 0, "transmission": 0, "thickness": 0, "clearcoat": 0, "specularF0": 0.02, "envMapIntensity": 0, "opacity": 0.4, "transparent": true, "doubleSided": true, "textureless": {"declared": true, "evidence": ["reference-original.png: synthetic hologram shows luminous contours and grids; no resolvable physical grain, pores, dirt, scratches, print, or relief on this carrier surface.", "material-evidence.json: cap, contour strips and anchored highlight geometry. All observed grids, outline marks and highlights are assigned to separate geometric systems; this declaration applies to the uniform carrier material, not to a claim that the scene has no detail.", "repetitionSystems and renderLayerContract preserve the required surface detail as geometry, with no image texture sampling."]}, "localOverrides": [{"id": "cap-and-node", "region": "cap and lower node submeshes", "emissiveIntensity": 1.4, "realization": "separate geometry/material instances; not a bitmap mask"}], "materialEvidence": {"path": "material-evidence.json", "scope": "representation and applicability evidence; not physical PBR recovery", "numericParameters": "artistic starting values awaiting render review"}, "notes": "Roughness is a real scalar consumed by the generator's physical material, suppressing surface gloss. No fictitious roughness/AO maps, texture resolution or physical transmission.", "runtimeLimitations": ["depthWrite=false, additive blending and localOverrides are NOT confirmed generator outputs; inspect generated materials before look-dev acceptance.", "Emission on its own does not create bloom; bloom is a separate later pass."], "rendererIntent": {"depthWrite": false, "blending": "NormalBlending on filled carriers; selective additive blending only on dedicated lines after visual review"}},
    options
  );
  materialMap["frame-fill"] = createSculptMaterial(
    "frame-fill",
    {"id": "frame-fill", "name": "Faint blue projected faces", "type": "physical", "shaderModel": "MeshPhysicalMaterial; matte emission-dominant alpha carrier supported by current generator", "baseColor": "#147ACB", "emissive": "#147ACB", "emissiveIntensity": 0.7, "albedo": {"dominant": "#147ACB", "secondary": ["#15BFFF"], "samplingNotes": "Display palette proposal from observed blue/cyan/violet families; not measured physical albedo or sampled exact RGB."}, "roughness": 0.85, "metalness": 0, "transmission": 0, "thickness": 0, "clearcoat": 0, "specularF0": 0.02, "envMapIntensity": 0, "opacity": 0.08, "transparent": true, "doubleSided": true, "textureless": {"declared": true, "evidence": ["reference-original.png: synthetic hologram shows luminous contours and grids; no resolvable physical grain, pores, dirt, scratches, print, or relief on this carrier surface.", "material-evidence.json: faint planar faces only; edges and grids are separate geometry. All observed grids, outline marks and highlights are assigned to separate geometric systems; this declaration applies to the uniform carrier material, not to a claim that the scene has no detail.", "repetitionSystems and renderLayerContract preserve the required surface detail as geometry, with no image texture sampling."]}, "localOverrides": [{"id": "rear-fade", "region": "rear frame face submeshes", "opacity": 0.04, "realization": "clone material scalar on named rear face submeshes"}], "materialEvidence": {"path": "material-evidence.json", "scope": "representation and applicability evidence; not physical PBR recovery", "numericParameters": "artistic starting values awaiting render review"}, "notes": "Roughness is a real scalar consumed by the generator's physical material, suppressing surface gloss. No fictitious roughness/AO maps, texture resolution or physical transmission.", "runtimeLimitations": ["depthWrite=false, additive blending and localOverrides are NOT confirmed generator outputs; inspect generated materials before look-dev acceptance.", "Emission on its own does not create bloom; bloom is a separate later pass."], "rendererIntent": {"depthWrite": false, "blending": "NormalBlending on filled carriers; selective additive blending only on dedicated lines after visual review"}},
    options
  );
  materialMap["violet-band"] = createSculptMaterial(
    "violet-band",
    {"id": "violet-band", "name": "Violet projected annular carrier", "type": "physical", "shaderModel": "MeshPhysicalMaterial; matte emission-dominant alpha carrier supported by current generator", "baseColor": "#8B4FE8", "emissive": "#8B4FE8", "emissiveIntensity": 1.1, "albedo": {"dominant": "#8B4FE8", "secondary": ["#C36AF0"], "samplingNotes": "Display palette proposal from observed blue/cyan/violet families; not measured physical albedo or sampled exact RGB."}, "roughness": 0.85, "metalness": 0, "transmission": 0, "thickness": 0, "clearcoat": 0, "specularF0": 0.02, "envMapIntensity": 0, "opacity": 0.2, "transparent": true, "doubleSided": true, "textureless": {"declared": true, "evidence": ["reference-original.png: synthetic hologram shows luminous contours and grids; no resolvable physical grain, pores, dirt, scratches, print, or relief on this carrier surface.", "material-evidence.json: uniform thin band faces; bright and dim arcs use separate geometry. All observed grids, outline marks and highlights are assigned to separate geometric systems; this declaration applies to the uniform carrier material, not to a claim that the scene has no detail.", "repetitionSystems and renderLayerContract preserve the required surface detail as geometry, with no image texture sampling."]}, "localOverrides": [{"id": "orbit-accent", "region": "selected orbit arc submeshes", "color": "#C36AF0", "realization": "named arc geometry with its own material scalar; no texture image"}], "materialEvidence": {"path": "material-evidence.json", "scope": "representation and applicability evidence; not physical PBR recovery", "numericParameters": "artistic starting values awaiting render review"}, "notes": "Roughness is a real scalar consumed by the generator's physical material, suppressing surface gloss. No fictitious roughness/AO maps, texture resolution or physical transmission.", "runtimeLimitations": ["depthWrite=false, additive blending and localOverrides are NOT confirmed generator outputs; inspect generated materials before look-dev acceptance.", "Emission on its own does not create bloom; bloom is a separate later pass."], "rendererIntent": {"depthWrite": false, "blending": "NormalBlending on filled carriers; selective additive blending only on dedicated lines after visual review"}},
    options
  );
  materialMap["base"] = createSculptMaterial(
    "base",
    {"id": "base", "name": "Blue projected core volume", "type": "physical", "shaderModel": "MeshPhysicalMaterial; matte emission-dominant alpha carrier supported by current generator", "baseColor": "#1959F0", "emissive": "#1959F0", "emissiveIntensity": 0.8, "albedo": {"dominant": "#1959F0", "secondary": ["#14BFFF"], "samplingNotes": "Display palette proposal from observed blue/cyan/violet families; not measured physical albedo or sampled exact RGB."}, "roughness": 0.85, "metalness": 0, "transmission": 0, "thickness": 0, "clearcoat": 0, "specularF0": 0.02, "envMapIntensity": 0, "opacity": 0.32, "transparent": true, "doubleSided": true, "textureless": {"declared": true, "evidence": ["reference-original.png: synthetic hologram shows luminous contours and grids; no resolvable physical grain, pores, dirt, scratches, print, or relief on this carrier surface.", "material-evidence.json: uniform blue core and lower-layer surfaces; grid is separate geometry. All observed grids, outline marks and highlights are assigned to separate geometric systems; this declaration applies to the uniform carrier material, not to a claim that the scene has no detail.", "repetitionSystems and renderLayerContract preserve the required surface detail as geometry, with no image texture sampling."]}, "localOverrides": [{"id": "blue-density", "region": "main core body submesh", "opacity": 0.38, "realization": "per-submesh scalar, not a noise field"}], "materialEvidence": {"path": "material-evidence.json", "scope": "representation and applicability evidence; not physical PBR recovery", "numericParameters": "artistic starting values awaiting render review"}, "notes": "Roughness is a real scalar consumed by the generator's physical material, suppressing surface gloss. No fictitious roughness/AO maps, texture resolution or physical transmission.", "runtimeLimitations": ["depthWrite=false, additive blending and localOverrides are NOT confirmed generator outputs; inspect generated materials before look-dev acceptance.", "Emission on its own does not create bloom; bloom is a separate later pass."], "rendererIntent": {"depthWrite": false, "blending": "NormalBlending on filled carriers; selective additive blending only on dedicated lines after visual review"}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_core_body_0 = null;
  const endpoint_core_body_0 = makeAttachmentEndpoint(attachment_core_body_0);
  const node_core_body_0 = new THREE.Group();
  node_core_body_0.name = "Main blue cylindrical core__pivot";
  node_core_body_0.scale.set(1, 1, 1);
  if (endpoint_core_body_0) {
    node_core_body_0.position.copy(endpoint_core_body_0.start);
    node_core_body_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_core_body_0.position.set(0.0, 0.0, 0.0);
    node_core_body_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_core_body_0.userData.sculptComponent = {"id": "core-body", "name": "Main blue cylindrical core", "level": "macro", "role": "body", "importance": 1, "confidence": 0.8, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Visible curved upright body has circular upper footprint and discrete caps; no organic continuous sculpt is inferred.", "semanticId": "core-body", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 89, 240, 0.38)", "secondaryAlbedo": "rgba(20, 195, 255, 0.15)", "materialClass": "unknown", "materialClassConfidence": 0, "note": "Schema has no hologram material class. Use explicit emission and alpha contract, not physical glass. RGB/alpha are artistic starting proposals.", "materialModel": "emission-dominant holographic projection; not physical glass"}, "geometryDescriptor": {"topologyIntent": "Closed cylinder, radius 0.9 and height 1.8; separate contour and grid layers are deferred", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 1.8, "height": 1.8, "depth": 1.8, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-core", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "core-top", "localPosition": [0, 0.9, 0], "localRotation": [0, 0, 0]}], "collider": {"type": "none", "notes": "No physics or collision behavior is authorized for the projection concept."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-body", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base"}}, "material": "base", "materialLayers": ["base"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "core-body.blue-density", "kind": "emissive", "description": "Colored volume denser than surrounding frames; not clear glass", "evidenceRefs": ["full-object"]}, {"id": "core-body.curved-grid", "kind": "linework", "description": "Horizontal rings and vertical meridians; dimmer than main contour", "proposal": {"horizontalSpacing": 0.18, "meridianCount": 24}, "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_core_body_0.userData.actionProfile = {"animationRole": "static-core", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "core-top", "localPosition": [0, 0.9, 0], "localRotation": [0, 0, 0]}], "collider": {"type": "none", "notes": "No physics or collision behavior is authorized for the projection concept."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-body", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_core_body_0);
  nodes["core-body"] = node_core_body_0;
  const mesh_core_body_0Geometry = endpoint_core_body_0
    ? new THREE.CylinderGeometry(endpoint_core_body_0.endRadius, endpoint_core_body_0.baseRadius, endpoint_core_body_0.length, 16, 6)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8);
  if (!endpoint_core_body_0) {
    mesh_core_body_0Geometry.scale(1.8, 1.8, 1.8);
  }
  const mesh_core_body_0 = new THREE.Mesh(
    mesh_core_body_0Geometry,
    materialMap["base"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_core_body_0.name = "Main blue cylindrical core";
  if (endpoint_core_body_0) {
    mesh_core_body_0.position.copy(endpoint_core_body_0.midpoint);
    mesh_core_body_0.quaternion.copy(endpoint_core_body_0.quaternion);
  }
  mesh_core_body_0.castShadow = options.castShadow ?? true;
  mesh_core_body_0.receiveShadow = options.receiveShadow ?? true;
  mesh_core_body_0.userData.sculptComponent = {"id": "core-body", "name": "Main blue cylindrical core", "level": "macro", "role": "body", "importance": 1, "confidence": 0.8, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Visible curved upright body has circular upper footprint and discrete caps; no organic continuous sculpt is inferred.", "semanticId": "core-body", "colorMaterialRecipe": {"dominantAlbedo": "rgba(25, 89, 240, 0.38)", "secondaryAlbedo": "rgba(20, 195, 255, 0.15)", "materialClass": "unknown", "materialClassConfidence": 0, "note": "Schema has no hologram material class. Use explicit emission and alpha contract, not physical glass. RGB/alpha are artistic starting proposals.", "materialModel": "emission-dominant holographic projection; not physical glass"}, "geometryDescriptor": {"topologyIntent": "Closed cylinder, radius 0.9 and height 1.8; separate contour and grid layers are deferred", "edgeTreatment": {"type": "none", "bevelRadius": 0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 1.8, "height": 1.8, "depth": 1.8, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static-core", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "core-top", "localPosition": [0, 0.9, 0], "localRotation": [0, 0, 0]}], "collider": {"type": "none", "notes": "No physics or collision behavior is authorized for the projection concept."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "core-body", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base"}}, "material": "base", "materialLayers": ["base"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "core-body.blue-density", "kind": "emissive", "description": "Colored volume denser than surrounding frames; not clear glass", "evidenceRefs": ["full-object"]}, {"id": "core-body.curved-grid", "kind": "linework", "description": "Horizontal rings and vertical meridians; dimmer than main contour", "proposal": {"horizontalSpacing": 0.18, "meridianCount": 24}, "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_core_body_0.add(mesh_core_body_0);
  meshes["core-body"] = mesh_core_body_0;
  colliders["core-body"] = {"type": "none", "notes": "No physics or collision behavior is authorized for the projection concept."};
  destructionGroups["core-body"] ??= [];
  destructionGroups["core-body"].push(node_core_body_0);
  const socket_core_body_core_top_0 = new THREE.Object3D();
  socket_core_body_core_top_0.name = "core-top";
  socket_core_body_core_top_0.position.set(0.0, 0.9, 0.0);
  socket_core_body_core_top_0.rotation.set(0.0, 0.0, 0.0);
  socket_core_body_core_top_0.userData.socket = {"id": "core-top", "localPosition": [0, 0.9, 0], "localRotation": [0, 0, 0]};
  node_core_body_0.add(socket_core_body_core_top_0);
  sockets["core-body:core-top"] = socket_core_body_core_top_0;

  const attachment_core_cap_1 = {"parentId": "core-body", "parentSocket": "core-top", "localStart": [0, 0.88, 0], "localEnd": [0, 0.92, 0], "baseRadius": 0.92, "endRadius": 0.92, "contactType": "overlap", "overlap": 0.02, "gapTolerance": 0.001, "evidenceRefs": ["full-object"], "note": "Proposed cap interval [0.88,0.92] overlaps core top at 0.9 by 0.02; this is geometric contact, not a claim of physical glass construction."};
  const endpoint_core_cap_1 = makeAttachmentEndpoint(attachment_core_cap_1);
  const node_core_cap_1 = new THREE.Group();
  node_core_cap_1.name = "Luminous top cap__pivot";
  node_core_cap_1.scale.set(1, 1, 1);
  if (endpoint_core_cap_1) {
    node_core_cap_1.position.copy(endpoint_core_cap_1.start);
    node_core_cap_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_core_cap_1.position.set(0.0, 0.88, 0.0);
    node_core_cap_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_core_cap_1.userData.sculptComponent = {"id": "core-cap", "name": "Luminous top cap", "level": "meso", "role": "cap", "parent": "core-body", "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Visible upper ellipse is a discrete closed circular surface, not an open tube mouth.", "confidence": 0.85, "importance": 1, "attachment": {"parentId": "core-body", "parentSocket": "core-top", "localStart": [0, 0.88, 0], "localEnd": [0, 0.92, 0], "baseRadius": 0.92, "endRadius": 0.92, "contactType": "overlap", "overlap": 0.02, "gapTolerance": 0.001, "evidenceRefs": ["full-object"], "note": "Proposed cap interval [0.88,0.92] overlaps core top at 0.9 by 0.02; this is geometric contact, not a claim of physical glass construction."}, "dimensions": {"width": 1.84, "height": 0.04, "depth": 1.84, "units": "relative", "confidence": 0.65}, "transform": {"position": [0, 0.88, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Thin closed circular cap overlapping core by 0.02", "uvStrategy": "radial procedural", "normalStrategy": "analytic cylinder normals"}, "material": "cyan-contour", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 220, 255, 0.65)", "secondaryAlbedo": "rgba(30, 110, 255, 0.3)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-cap", "pivot": {"mode": "attachment-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "core-cap.cap-contour", "kind": "emissive", "description": "Bright rim plus subdued concentric marks; no black hollow mouth"}], "evidenceRefs": ["full-object"]};
  node_core_cap_1.userData.actionProfile = {"animationRole": "static-cap", "pivot": {"mode": "attachment-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "collider": {"type": "none"}, "destruction": {"breakable": false}};
  (nodes["core-body"] ?? root).add(node_core_cap_1);
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
  mesh_core_cap_1.name = "Luminous top cap";
  if (endpoint_core_cap_1) {
    mesh_core_cap_1.position.copy(endpoint_core_cap_1.midpoint);
    mesh_core_cap_1.quaternion.copy(endpoint_core_cap_1.quaternion);
  }
  mesh_core_cap_1.castShadow = options.castShadow ?? true;
  mesh_core_cap_1.receiveShadow = options.receiveShadow ?? true;
  mesh_core_cap_1.userData.sculptComponent = {"id": "core-cap", "name": "Luminous top cap", "level": "meso", "role": "cap", "parent": "core-body", "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Visible upper ellipse is a discrete closed circular surface, not an open tube mouth.", "confidence": 0.85, "importance": 1, "attachment": {"parentId": "core-body", "parentSocket": "core-top", "localStart": [0, 0.88, 0], "localEnd": [0, 0.92, 0], "baseRadius": 0.92, "endRadius": 0.92, "contactType": "overlap", "overlap": 0.02, "gapTolerance": 0.001, "evidenceRefs": ["full-object"], "note": "Proposed cap interval [0.88,0.92] overlaps core top at 0.9 by 0.02; this is geometric contact, not a claim of physical glass construction."}, "dimensions": {"width": 1.84, "height": 0.04, "depth": 1.84, "units": "relative", "confidence": 0.65}, "transform": {"position": [0, 0.88, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Thin closed circular cap overlapping core by 0.02", "uvStrategy": "radial procedural", "normalStrategy": "analytic cylinder normals"}, "material": "cyan-contour", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 220, 255, 0.65)", "secondaryAlbedo": "rgba(30, 110, 255, 0.3)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-cap", "pivot": {"mode": "attachment-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "core-cap.cap-contour", "kind": "emissive", "description": "Bright rim plus subdued concentric marks; no black hollow mouth"}], "evidenceRefs": ["full-object"]};
  node_core_cap_1.add(mesh_core_cap_1);
  meshes["core-cap"] = mesh_core_cap_1;
  colliders["core-cap"] = {"type": "none"};

  const attachment_lower_shell_2 = null;
  const endpoint_lower_shell_2 = makeAttachmentEndpoint(attachment_lower_shell_2);
  const node_lower_shell_2 = new THREE.Group();
  node_lower_shell_2.name = "Lower overlapping blue layer__pivot";
  node_lower_shell_2.scale.set(1, 1, 1);
  if (endpoint_lower_shell_2) {
    node_lower_shell_2.position.copy(endpoint_lower_shell_2.start);
    node_lower_shell_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_lower_shell_2.position.set(0.0, -0.98, 0.0);
    node_lower_shell_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_lower_shell_2.userData.sculptComponent = {"id": "lower-shell", "name": "Lower overlapping blue layer", "level": "meso", "role": "body", "parent": null, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Lower visible curved band has a discrete circular footprint. It is an independent projected layer, not a mechanical child appendage.", "confidence": 0.65, "importance": 0.9, "dimensions": {"width": 2.3, "height": 0.48, "depth": 2.3, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, -0.98, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Short cylinder overlapping main core by 0.16; not a floating shelf", "uvStrategy": "cylindrical procedural", "normalStrategy": "analytic"}, "material": "base", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 90, 230, 0.3)", "secondaryAlbedo": "rgba(20, 190, 255, 0.12)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-layer", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "lower-shell.layer-gaps", "kind": "contour", "description": "Unequal height layers with dark intervals; exact visible count unresolved"}], "evidenceRefs": ["full-object"]};
  node_lower_shell_2.userData.actionProfile = {"animationRole": "static-layer", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}};
  (nodes["root"] ?? root).add(node_lower_shell_2);
  nodes["lower-shell"] = node_lower_shell_2;
  const mesh_lower_shell_2Geometry = endpoint_lower_shell_2
    ? new THREE.CylinderGeometry(endpoint_lower_shell_2.endRadius, endpoint_lower_shell_2.baseRadius, endpoint_lower_shell_2.length, 16, 6)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8);
  if (!endpoint_lower_shell_2) {
    mesh_lower_shell_2Geometry.scale(2.3, 0.48, 2.3);
  }
  const mesh_lower_shell_2 = new THREE.Mesh(
    mesh_lower_shell_2Geometry,
    materialMap["base"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lower_shell_2.name = "Lower overlapping blue layer";
  if (endpoint_lower_shell_2) {
    mesh_lower_shell_2.position.copy(endpoint_lower_shell_2.midpoint);
    mesh_lower_shell_2.quaternion.copy(endpoint_lower_shell_2.quaternion);
  }
  mesh_lower_shell_2.castShadow = options.castShadow ?? true;
  mesh_lower_shell_2.receiveShadow = options.receiveShadow ?? true;
  mesh_lower_shell_2.userData.sculptComponent = {"id": "lower-shell", "name": "Lower overlapping blue layer", "level": "meso", "role": "body", "parent": null, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Lower visible curved band has a discrete circular footprint. It is an independent projected layer, not a mechanical child appendage.", "confidence": 0.65, "importance": 0.9, "dimensions": {"width": 2.3, "height": 0.48, "depth": 2.3, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, -0.98, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Short cylinder overlapping main core by 0.16; not a floating shelf", "uvStrategy": "cylindrical procedural", "normalStrategy": "analytic"}, "material": "base", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 90, 230, 0.3)", "secondaryAlbedo": "rgba(20, 190, 255, 0.12)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-layer", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "lower-shell.layer-gaps", "kind": "contour", "description": "Unequal height layers with dark intervals; exact visible count unresolved"}], "evidenceRefs": ["full-object"]};
  node_lower_shell_2.add(mesh_lower_shell_2);
  meshes["lower-shell"] = mesh_lower_shell_2;
  colliders["lower-shell"] = {"type": "none"};

  const attachment_lower_shell_secondary_3 = null;
  const endpoint_lower_shell_secondary_3 = makeAttachmentEndpoint(attachment_lower_shell_secondary_3);
  const node_lower_shell_secondary_3 = new THREE.Group();
  node_lower_shell_secondary_3.name = "Lowest curved layer__pivot";
  node_lower_shell_secondary_3.scale.set(1, 1, 1);
  if (endpoint_lower_shell_secondary_3) {
    node_lower_shell_secondary_3.position.copy(endpoint_lower_shell_secondary_3.start);
    node_lower_shell_secondary_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_lower_shell_secondary_3.position.set(0.0, -1.34, 0.0);
    node_lower_shell_secondary_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_lower_shell_secondary_3.userData.sculptComponent = {"id": "lower-shell-secondary", "name": "Lowest curved layer", "level": "meso", "role": "body", "parent": null, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "A wider low circular layer appears under the core. Independent projection separated by a deliberate gap, not a physical attachment.", "confidence": 0.55, "dimensions": {"width": 2.6, "height": 0.19, "depth": 2.6, "units": "relative", "confidence": 0.45}, "transform": {"position": [0, -1.34, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Low circular volume with a deliberate gap from layer above", "uvStrategy": "cylindrical procedural", "normalStrategy": "analytic"}, "material": "base", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 80, 230, 0.2)", "secondaryAlbedo": "rgba(20, 170, 255, 0.12)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-layer", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [], "evidenceRefs": ["full-object"]};
  node_lower_shell_secondary_3.userData.actionProfile = {"animationRole": "static-layer", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}};
  (nodes["root"] ?? root).add(node_lower_shell_secondary_3);
  nodes["lower-shell-secondary"] = node_lower_shell_secondary_3;
  const mesh_lower_shell_secondary_3Geometry = endpoint_lower_shell_secondary_3
    ? new THREE.CylinderGeometry(endpoint_lower_shell_secondary_3.endRadius, endpoint_lower_shell_secondary_3.baseRadius, endpoint_lower_shell_secondary_3.length, 16, 6)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8);
  if (!endpoint_lower_shell_secondary_3) {
    mesh_lower_shell_secondary_3Geometry.scale(2.6, 0.19, 2.6);
  }
  const mesh_lower_shell_secondary_3 = new THREE.Mesh(
    mesh_lower_shell_secondary_3Geometry,
    materialMap["base"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lower_shell_secondary_3.name = "Lowest curved layer";
  if (endpoint_lower_shell_secondary_3) {
    mesh_lower_shell_secondary_3.position.copy(endpoint_lower_shell_secondary_3.midpoint);
    mesh_lower_shell_secondary_3.quaternion.copy(endpoint_lower_shell_secondary_3.quaternion);
  }
  mesh_lower_shell_secondary_3.castShadow = options.castShadow ?? true;
  mesh_lower_shell_secondary_3.receiveShadow = options.receiveShadow ?? true;
  mesh_lower_shell_secondary_3.userData.sculptComponent = {"id": "lower-shell-secondary", "name": "Lowest curved layer", "level": "meso", "role": "body", "parent": null, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "A wider low circular layer appears under the core. Independent projection separated by a deliberate gap, not a physical attachment.", "confidence": 0.55, "dimensions": {"width": 2.6, "height": 0.19, "depth": 2.6, "units": "relative", "confidence": 0.45}, "transform": {"position": [0, -1.34, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Low circular volume with a deliberate gap from layer above", "uvStrategy": "cylindrical procedural", "normalStrategy": "analytic"}, "material": "base", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 80, 230, 0.2)", "secondaryAlbedo": "rgba(20, 170, 255, 0.12)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-layer", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [], "evidenceRefs": ["full-object"]};
  node_lower_shell_secondary_3.add(mesh_lower_shell_secondary_3);
  meshes["lower-shell-secondary"] = mesh_lower_shell_secondary_3;
  colliders["lower-shell-secondary"] = {"type": "none"};

  const endpoint_frame_rear_4 = makeAttachmentEndpoint(null);
  const node_frame_rear_4 = new THREE.Group();
  node_frame_rear_4.name = "Highest rear cuboid frame__pivot";
  node_frame_rear_4.scale.set(1, 1, 1);
  if (endpoint_frame_rear_4) {
    node_frame_rear_4.position.copy(endpoint_frame_rear_4.start);
    node_frame_rear_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_frame_rear_4.position.set(0.0, -0.02, -0.7);
    node_frame_rear_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_frame_rear_4.userData.sculptComponent = {"id": "frame-rear", "name": "Highest rear cuboid frame", "level": "macro", "role": "frame", "parent": null, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Straight vertical edges and planar top corners define a cuboid frame.", "confidence": 0.8, "importance": 1, "dimensions": {"width": 0.8, "height": 3.25, "depth": 0.7, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, -0.02, -0.7], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Cuboid edge frame; blockout box must become edge-only with faint faces in structural pass", "uvStrategy": "box-local grid", "normalStrategy": "flat faces"}, "renderIntent": {"mode": "edges-and-faint-faces", "solidBoxIsFinal": false}, "material": "frame-fill", "colorMaterialRecipe": {"dominantAlbedo": "rgba(15, 120, 220, 0.08)", "secondaryAlbedo": "rgba(15, 190, 255, 0.12)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "frame-rear.rear-outline", "kind": "contour", "description": "Highest stepped rear outline"}, {"id": "frame-rear.depth-fade", "kind": "contour", "description": "Rear lines are fainter than front cyan contours"}], "evidenceRefs": ["full-object"]};
  node_frame_rear_4.userData.actionProfile = {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "collider": {"type": "none"}, "destruction": {"breakable": false}};
  (nodes["root"] ?? root).add(node_frame_rear_4);
  nodes["frame-rear"] = node_frame_rear_4;
  const mesh_frame_rear_4Geometry = endpoint_frame_rear_4
    ? new THREE.CylinderGeometry(endpoint_frame_rear_4.endRadius, endpoint_frame_rear_4.baseRadius, endpoint_frame_rear_4.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_frame_rear_4) {
    mesh_frame_rear_4Geometry.scale(0.8, 3.25, 0.7);
  }
  const mesh_frame_rear_4 = new THREE.Mesh(
    mesh_frame_rear_4Geometry,
    materialMap["frame-fill"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_frame_rear_4.name = "Highest rear cuboid frame";
  if (endpoint_frame_rear_4) {
    mesh_frame_rear_4.position.copy(endpoint_frame_rear_4.midpoint);
    mesh_frame_rear_4.quaternion.copy(endpoint_frame_rear_4.quaternion);
  }
  mesh_frame_rear_4.castShadow = options.castShadow ?? true;
  mesh_frame_rear_4.receiveShadow = options.receiveShadow ?? true;
  mesh_frame_rear_4.userData.sculptComponent = {"id": "frame-rear", "name": "Highest rear cuboid frame", "level": "macro", "role": "frame", "parent": null, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Straight vertical edges and planar top corners define a cuboid frame.", "confidence": 0.8, "importance": 1, "dimensions": {"width": 0.8, "height": 3.25, "depth": 0.7, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, -0.02, -0.7], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Cuboid edge frame; blockout box must become edge-only with faint faces in structural pass", "uvStrategy": "box-local grid", "normalStrategy": "flat faces"}, "renderIntent": {"mode": "edges-and-faint-faces", "solidBoxIsFinal": false}, "material": "frame-fill", "colorMaterialRecipe": {"dominantAlbedo": "rgba(15, 120, 220, 0.08)", "secondaryAlbedo": "rgba(15, 190, 255, 0.12)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "frame-rear.rear-outline", "kind": "contour", "description": "Highest stepped rear outline"}, {"id": "frame-rear.depth-fade", "kind": "contour", "description": "Rear lines are fainter than front cyan contours"}], "evidenceRefs": ["full-object"]};
  node_frame_rear_4.add(mesh_frame_rear_4);
  meshes["frame-rear"] = mesh_frame_rear_4;
  colliders["frame-rear"] = {"type": "none"};

  const endpoint_frame_left_5 = makeAttachmentEndpoint(null);
  const node_frame_left_5 = new THREE.Group();
  node_frame_left_5.name = "Left tall stepped frame__pivot";
  node_frame_left_5.scale.set(1, 1, 1);
  if (endpoint_frame_left_5) {
    node_frame_left_5.position.copy(endpoint_frame_left_5.start);
    node_frame_left_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_frame_left_5.position.set(-1.05, -0.25, 0.1);
    node_frame_left_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_frame_left_5.userData.sculptComponent = {"id": "frame-left", "name": "Left tall stepped frame", "level": "meso", "role": "frame", "parent": null, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rectilinear lateral outline differs from curved core.", "confidence": 0.75, "dimensions": {"width": 0.85, "height": 2.65, "depth": 0.68, "units": "relative", "confidence": 0.5}, "transform": {"position": [-1.05, -0.25, 0.1], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Cuboid edge cage with faint planar grid, no thick bevel", "uvStrategy": "box-local", "normalStrategy": "flat"}, "renderIntent": {"mode": "edges-and-faint-faces"}, "material": "frame-fill", "colorMaterialRecipe": {"dominantAlbedo": "rgba(15, 130, 230, 0.1)", "secondaryAlbedo": "rgba(15, 210, 255, 0.15)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "frame-left.step-outline", "kind": "contour", "description": "Tall lateral step contrasted with shorter outer frame"}], "evidenceRefs": ["full-object"]};
  node_frame_left_5.userData.actionProfile = {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}};
  (nodes["root"] ?? root).add(node_frame_left_5);
  nodes["frame-left"] = node_frame_left_5;
  const mesh_frame_left_5Geometry = endpoint_frame_left_5
    ? new THREE.CylinderGeometry(endpoint_frame_left_5.endRadius, endpoint_frame_left_5.baseRadius, endpoint_frame_left_5.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_frame_left_5) {
    mesh_frame_left_5Geometry.scale(0.85, 2.65, 0.68);
  }
  const mesh_frame_left_5 = new THREE.Mesh(
    mesh_frame_left_5Geometry,
    materialMap["frame-fill"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_frame_left_5.name = "Left tall stepped frame";
  if (endpoint_frame_left_5) {
    mesh_frame_left_5.position.copy(endpoint_frame_left_5.midpoint);
    mesh_frame_left_5.quaternion.copy(endpoint_frame_left_5.quaternion);
  }
  mesh_frame_left_5.castShadow = options.castShadow ?? true;
  mesh_frame_left_5.receiveShadow = options.receiveShadow ?? true;
  mesh_frame_left_5.userData.sculptComponent = {"id": "frame-left", "name": "Left tall stepped frame", "level": "meso", "role": "frame", "parent": null, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rectilinear lateral outline differs from curved core.", "confidence": 0.75, "dimensions": {"width": 0.85, "height": 2.65, "depth": 0.68, "units": "relative", "confidence": 0.5}, "transform": {"position": [-1.05, -0.25, 0.1], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Cuboid edge cage with faint planar grid, no thick bevel", "uvStrategy": "box-local", "normalStrategy": "flat"}, "renderIntent": {"mode": "edges-and-faint-faces"}, "material": "frame-fill", "colorMaterialRecipe": {"dominantAlbedo": "rgba(15, 130, 230, 0.1)", "secondaryAlbedo": "rgba(15, 210, 255, 0.15)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "frame-left.step-outline", "kind": "contour", "description": "Tall lateral step contrasted with shorter outer frame"}], "evidenceRefs": ["full-object"]};
  node_frame_left_5.add(mesh_frame_left_5);
  meshes["frame-left"] = mesh_frame_left_5;
  colliders["frame-left"] = {"type": "none"};

  const endpoint_frame_left_outer_6 = makeAttachmentEndpoint(null);
  const node_frame_left_outer_6 = new THREE.Group();
  node_frame_left_outer_6.name = "Left low outer frame__pivot";
  node_frame_left_outer_6.scale.set(1, 1, 1);
  if (endpoint_frame_left_outer_6) {
    node_frame_left_outer_6.position.copy(endpoint_frame_left_outer_6.start);
    node_frame_left_outer_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_frame_left_outer_6.position.set(-1.65, -0.8, 0.35);
    node_frame_left_outer_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_frame_left_outer_6.userData.sculptComponent = {"id": "frame-left-outer", "name": "Left low outer frame", "level": "meso", "role": "frame", "parent": null, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "A lower rectangular outline appears beyond the tall lateral frame.", "confidence": 0.6, "dimensions": {"width": 0.7, "height": 1.55, "depth": 0.85, "units": "relative", "confidence": 0.4}, "transform": {"position": [-1.65, -0.8, 0.35], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Low edge cage; distinct depth offset", "uvStrategy": "box-local", "normalStrategy": "flat"}, "renderIntent": {"mode": "edges-and-faint-faces"}, "material": "frame-fill", "colorMaterialRecipe": {"dominantAlbedo": "rgba(15, 130, 230, 0.07)", "secondaryAlbedo": "rgba(15, 210, 255, 0.1)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [], "evidenceRefs": ["full-object"]};
  node_frame_left_outer_6.userData.actionProfile = {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}};
  (nodes["root"] ?? root).add(node_frame_left_outer_6);
  nodes["frame-left-outer"] = node_frame_left_outer_6;
  const mesh_frame_left_outer_6Geometry = endpoint_frame_left_outer_6
    ? new THREE.CylinderGeometry(endpoint_frame_left_outer_6.endRadius, endpoint_frame_left_outer_6.baseRadius, endpoint_frame_left_outer_6.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_frame_left_outer_6) {
    mesh_frame_left_outer_6Geometry.scale(0.7, 1.55, 0.85);
  }
  const mesh_frame_left_outer_6 = new THREE.Mesh(
    mesh_frame_left_outer_6Geometry,
    materialMap["frame-fill"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_frame_left_outer_6.name = "Left low outer frame";
  if (endpoint_frame_left_outer_6) {
    mesh_frame_left_outer_6.position.copy(endpoint_frame_left_outer_6.midpoint);
    mesh_frame_left_outer_6.quaternion.copy(endpoint_frame_left_outer_6.quaternion);
  }
  mesh_frame_left_outer_6.castShadow = options.castShadow ?? true;
  mesh_frame_left_outer_6.receiveShadow = options.receiveShadow ?? true;
  mesh_frame_left_outer_6.userData.sculptComponent = {"id": "frame-left-outer", "name": "Left low outer frame", "level": "meso", "role": "frame", "parent": null, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "A lower rectangular outline appears beyond the tall lateral frame.", "confidence": 0.6, "dimensions": {"width": 0.7, "height": 1.55, "depth": 0.85, "units": "relative", "confidence": 0.4}, "transform": {"position": [-1.65, -0.8, 0.35], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Low edge cage; distinct depth offset", "uvStrategy": "box-local", "normalStrategy": "flat"}, "renderIntent": {"mode": "edges-and-faint-faces"}, "material": "frame-fill", "colorMaterialRecipe": {"dominantAlbedo": "rgba(15, 130, 230, 0.07)", "secondaryAlbedo": "rgba(15, 210, 255, 0.1)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [], "evidenceRefs": ["full-object"]};
  node_frame_left_outer_6.add(mesh_frame_left_outer_6);
  meshes["frame-left-outer"] = mesh_frame_left_outer_6;
  colliders["frame-left-outer"] = {"type": "none"};

  const endpoint_frame_right_7 = makeAttachmentEndpoint(null);
  const node_frame_right_7 = new THREE.Group();
  node_frame_right_7.name = "Right tall stepped frame__pivot";
  node_frame_right_7.scale.set(1, 1, 1);
  if (endpoint_frame_right_7) {
    node_frame_right_7.position.copy(endpoint_frame_right_7.start);
    node_frame_right_7.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_frame_right_7.position.set(1.1, -0.13, -0.15);
    node_frame_right_7.rotation.set(0.0, 0.0, 0.0);
  }
  node_frame_right_7.userData.sculptComponent = {"id": "frame-right", "name": "Right tall stepped frame", "level": "meso", "role": "frame", "parent": null, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Visible upright rectangular faces behind orbit.", "confidence": 0.7, "dimensions": {"width": 0.7, "height": 2.8, "depth": 0.85, "units": "relative", "confidence": 0.45}, "transform": {"position": [1.1, -0.13, -0.15], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Edge cage with sparse planar grid", "uvStrategy": "box-local", "normalStrategy": "flat"}, "renderIntent": {"mode": "edges-and-faint-faces"}, "material": "frame-fill", "colorMaterialRecipe": {"dominantAlbedo": "rgba(15, 130, 230, 0.08)", "secondaryAlbedo": "rgba(15, 210, 255, 0.12)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "frame-right.planar-grid", "kind": "linework", "description": "Sparse grid follows planar face, not global uniform wireframe"}], "evidenceRefs": ["full-object"]};
  node_frame_right_7.userData.actionProfile = {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}};
  (nodes["root"] ?? root).add(node_frame_right_7);
  nodes["frame-right"] = node_frame_right_7;
  const mesh_frame_right_7Geometry = endpoint_frame_right_7
    ? new THREE.CylinderGeometry(endpoint_frame_right_7.endRadius, endpoint_frame_right_7.baseRadius, endpoint_frame_right_7.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_frame_right_7) {
    mesh_frame_right_7Geometry.scale(0.7, 2.8, 0.85);
  }
  const mesh_frame_right_7 = new THREE.Mesh(
    mesh_frame_right_7Geometry,
    materialMap["frame-fill"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_frame_right_7.name = "Right tall stepped frame";
  if (endpoint_frame_right_7) {
    mesh_frame_right_7.position.copy(endpoint_frame_right_7.midpoint);
    mesh_frame_right_7.quaternion.copy(endpoint_frame_right_7.quaternion);
  }
  mesh_frame_right_7.castShadow = options.castShadow ?? true;
  mesh_frame_right_7.receiveShadow = options.receiveShadow ?? true;
  mesh_frame_right_7.userData.sculptComponent = {"id": "frame-right", "name": "Right tall stepped frame", "level": "meso", "role": "frame", "parent": null, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Visible upright rectangular faces behind orbit.", "confidence": 0.7, "dimensions": {"width": 0.7, "height": 2.8, "depth": 0.85, "units": "relative", "confidence": 0.45}, "transform": {"position": [1.1, -0.13, -0.15], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Edge cage with sparse planar grid", "uvStrategy": "box-local", "normalStrategy": "flat"}, "renderIntent": {"mode": "edges-and-faint-faces"}, "material": "frame-fill", "colorMaterialRecipe": {"dominantAlbedo": "rgba(15, 130, 230, 0.08)", "secondaryAlbedo": "rgba(15, 210, 255, 0.12)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "frame-right.planar-grid", "kind": "linework", "description": "Sparse grid follows planar face, not global uniform wireframe"}], "evidenceRefs": ["full-object"]};
  node_frame_right_7.add(mesh_frame_right_7);
  meshes["frame-right"] = mesh_frame_right_7;
  colliders["frame-right"] = {"type": "none"};

  const endpoint_frame_right_outer_8 = makeAttachmentEndpoint(null);
  const node_frame_right_outer_8 = new THREE.Group();
  node_frame_right_outer_8.name = "Right low outer frame__pivot";
  node_frame_right_outer_8.scale.set(1, 1, 1);
  if (endpoint_frame_right_outer_8) {
    node_frame_right_outer_8.position.copy(endpoint_frame_right_outer_8.start);
    node_frame_right_outer_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_frame_right_outer_8.position.set(1.75, -0.85, 0.1);
    node_frame_right_outer_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_frame_right_outer_8.userData.sculptComponent = {"id": "frame-right-outer", "name": "Right low outer frame", "level": "meso", "role": "frame", "parent": null, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Low rectilinear boundary extends beyond core on the right.", "confidence": 0.55, "dimensions": {"width": 0.8, "height": 1.4, "depth": 0.7, "units": "relative", "confidence": 0.4}, "transform": {"position": [1.75, -0.85, 0.1], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Low cuboid edge cage", "uvStrategy": "box-local", "normalStrategy": "flat"}, "renderIntent": {"mode": "edges-and-faint-faces"}, "material": "frame-fill", "colorMaterialRecipe": {"dominantAlbedo": "rgba(15, 130, 230, 0.07)", "secondaryAlbedo": "rgba(15, 210, 255, 0.1)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [], "evidenceRefs": ["full-object"]};
  node_frame_right_outer_8.userData.actionProfile = {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}};
  (nodes["root"] ?? root).add(node_frame_right_outer_8);
  nodes["frame-right-outer"] = node_frame_right_outer_8;
  const mesh_frame_right_outer_8Geometry = endpoint_frame_right_outer_8
    ? new THREE.CylinderGeometry(endpoint_frame_right_outer_8.endRadius, endpoint_frame_right_outer_8.baseRadius, endpoint_frame_right_outer_8.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_frame_right_outer_8) {
    mesh_frame_right_outer_8Geometry.scale(0.8, 1.4, 0.7);
  }
  const mesh_frame_right_outer_8 = new THREE.Mesh(
    mesh_frame_right_outer_8Geometry,
    materialMap["frame-fill"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_frame_right_outer_8.name = "Right low outer frame";
  if (endpoint_frame_right_outer_8) {
    mesh_frame_right_outer_8.position.copy(endpoint_frame_right_outer_8.midpoint);
    mesh_frame_right_outer_8.quaternion.copy(endpoint_frame_right_outer_8.quaternion);
  }
  mesh_frame_right_outer_8.castShadow = options.castShadow ?? true;
  mesh_frame_right_outer_8.receiveShadow = options.receiveShadow ?? true;
  mesh_frame_right_outer_8.userData.sculptComponent = {"id": "frame-right-outer", "name": "Right low outer frame", "level": "meso", "role": "frame", "parent": null, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Low rectilinear boundary extends beyond core on the right.", "confidence": 0.55, "dimensions": {"width": 0.8, "height": 1.4, "depth": 0.7, "units": "relative", "confidence": 0.4}, "transform": {"position": [1.75, -0.85, 0.1], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Low cuboid edge cage", "uvStrategy": "box-local", "normalStrategy": "flat"}, "renderIntent": {"mode": "edges-and-faint-faces"}, "material": "frame-fill", "colorMaterialRecipe": {"dominantAlbedo": "rgba(15, 130, 230, 0.07)", "secondaryAlbedo": "rgba(15, 210, 255, 0.1)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-frame", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [], "evidenceRefs": ["full-object"]};
  node_frame_right_outer_8.add(mesh_frame_right_outer_8);
  meshes["frame-right-outer"] = mesh_frame_right_outer_8;
  colliders["frame-right-outer"] = {"type": "none"};

  const endpoint_orbit_violet_9 = makeAttachmentEndpoint(null);
  const node_orbit_violet_9 = new THREE.Group();
  node_orbit_violet_9.name = "Dominant violet annular band__pivot";
  node_orbit_violet_9.scale.set(1, 1, 1);
  if (endpoint_orbit_violet_9) {
    node_orbit_violet_9.position.copy(endpoint_orbit_violet_9.start);
    node_orbit_violet_9.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_orbit_violet_9.position.set(0.0, -0.58, 0.0);
    node_orbit_violet_9.rotation.set(0.0, 0.0, 0.0);
  }
  node_orbit_violet_9.userData.sculptComponent = {"id": "orbit-violet", "name": "Dominant violet annular band", "level": "macro", "role": "band", "parent": null, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Wide planar annular footprint with neighboring contours, not a round-section thick torus.", "confidence": 0.85, "importance": 1, "dimensions": {"width": 5.5, "height": 0.055, "depth": 5.5, "units": "relative", "confidence": 0.65}, "transform": {"position": [0, -0.58, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular radial profile revolving around Y", "uvStrategy": "angular-radial", "normalStrategy": "profile normals", "latheProfile": {"points": [[0.47818181818181815, -0.5], [0.5, -0.5], [0.5, 0.5], [0.47818181818181815, 0.5], [0.47818181818181815, -0.5]], "segments": 64}, "profileCoordinateContract": "Unit profile: outer radius 0.5, vertical range [-0.5,0.5]. Generator applies component dimensions once. latheProfile is the actual supported field."}, "material": "violet-band", "colorMaterialRecipe": {"dominantAlbedo": "rgba(130, 70, 240, 0.25)", "secondaryAlbedo": "rgba(220, 80, 245, 0.45)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-orbit-first-review", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "orbit-violet.band-contours", "kind": "emissive", "description": "Two main rims and one dim adjacent contour; nonuniform violet brightness"}], "evidenceRefs": ["full-object"]};
  node_orbit_violet_9.userData.actionProfile = {"animationRole": "static-orbit-first-review", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}};
  (nodes["root"] ?? root).add(node_orbit_violet_9);
  nodes["orbit-violet"] = node_orbit_violet_9;
  const mesh_orbit_violet_9Geometry = endpoint_orbit_violet_9
    ? new THREE.CylinderGeometry(endpoint_orbit_violet_9.endRadius, endpoint_orbit_violet_9.baseRadius, endpoint_orbit_violet_9.length, 16, 6)
    : buildLatheGeometry({"points": [[0.47818181818181815, -0.5], [0.5, -0.5], [0.5, 0.5], [0.47818181818181815, 0.5], [0.47818181818181815, -0.5]], "segments": 64});
  if (!endpoint_orbit_violet_9) {
    mesh_orbit_violet_9Geometry.scale(5.5, 0.055, 5.5);
  }
  const mesh_orbit_violet_9 = new THREE.Mesh(
    mesh_orbit_violet_9Geometry,
    materialMap["violet-band"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_orbit_violet_9.name = "Dominant violet annular band";
  if (endpoint_orbit_violet_9) {
    mesh_orbit_violet_9.position.copy(endpoint_orbit_violet_9.midpoint);
    mesh_orbit_violet_9.quaternion.copy(endpoint_orbit_violet_9.quaternion);
  }
  mesh_orbit_violet_9.castShadow = options.castShadow ?? true;
  mesh_orbit_violet_9.receiveShadow = options.receiveShadow ?? true;
  mesh_orbit_violet_9.userData.sculptComponent = {"id": "orbit-violet", "name": "Dominant violet annular band", "level": "macro", "role": "band", "parent": null, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Wide planar annular footprint with neighboring contours, not a round-section thick torus.", "confidence": 0.85, "importance": 1, "dimensions": {"width": 5.5, "height": 0.055, "depth": 5.5, "units": "relative", "confidence": 0.65}, "transform": {"position": [0, -0.58, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Closed rectangular radial profile revolving around Y", "uvStrategy": "angular-radial", "normalStrategy": "profile normals", "latheProfile": {"points": [[0.47818181818181815, -0.5], [0.5, -0.5], [0.5, 0.5], [0.47818181818181815, 0.5], [0.47818181818181815, -0.5]], "segments": 64}, "profileCoordinateContract": "Unit profile: outer radius 0.5, vertical range [-0.5,0.5]. Generator applies component dimensions once. latheProfile is the actual supported field."}, "material": "violet-band", "colorMaterialRecipe": {"dominantAlbedo": "rgba(130, 70, 240, 0.25)", "secondaryAlbedo": "rgba(220, 80, 245, 0.45)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-orbit-first-review", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "orbit-violet.band-contours", "kind": "emissive", "description": "Two main rims and one dim adjacent contour; nonuniform violet brightness"}], "evidenceRefs": ["full-object"]};
  node_orbit_violet_9.add(mesh_orbit_violet_9);
  meshes["orbit-violet"] = mesh_orbit_violet_9;
  colliders["orbit-violet"] = {"type": "none"};

  const endpoint_orbit_cyan_10 = makeAttachmentEndpoint(null);
  const node_orbit_cyan_10 = new THREE.Group();
  node_orbit_cyan_10.name = "Lower cyan annular band__pivot";
  node_orbit_cyan_10.scale.set(1, 1, 1);
  if (endpoint_orbit_cyan_10) {
    node_orbit_cyan_10.position.copy(endpoint_orbit_cyan_10.start);
    node_orbit_cyan_10.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_orbit_cyan_10.position.set(0.0, -1.22, 0.0);
    node_orbit_cyan_10.rotation.set(0.0, 0.0, 0.0);
  }
  node_orbit_cyan_10.userData.sculptComponent = {"id": "orbit-cyan", "name": "Lower cyan annular band", "level": "meso", "role": "band", "parent": null, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Lower circular contour system has shallow annular surfaces.", "confidence": 0.65, "dimensions": {"width": 5.9, "height": 0.035, "depth": 5.9, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, -1.22, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Thin lower annulus", "uvStrategy": "angular-radial", "normalStrategy": "profile normals", "latheProfile": {"points": [[0.4813559322033898, -0.5], [0.5, -0.5], [0.5, 0.5], [0.4813559322033898, 0.5], [0.4813559322033898, -0.5]], "segments": 64}, "profileCoordinateContract": "Unit profile: outer radius 0.5, vertical range [-0.5,0.5]. Generator applies component dimensions once. latheProfile is the actual supported field."}, "material": "cyan-contour", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 160, 245, 0.15)", "secondaryAlbedo": "rgba(30, 220, 255, 0.3)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-orbit", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "orbit-cyan.lower-contours", "kind": "contour", "description": "Multiple low cyan contours with gaps and depth fade"}], "evidenceRefs": ["full-object"]};
  node_orbit_cyan_10.userData.actionProfile = {"animationRole": "static-orbit", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}};
  (nodes["root"] ?? root).add(node_orbit_cyan_10);
  nodes["orbit-cyan"] = node_orbit_cyan_10;
  const mesh_orbit_cyan_10Geometry = endpoint_orbit_cyan_10
    ? new THREE.CylinderGeometry(endpoint_orbit_cyan_10.endRadius, endpoint_orbit_cyan_10.baseRadius, endpoint_orbit_cyan_10.length, 16, 6)
    : buildLatheGeometry({"points": [[0.4813559322033898, -0.5], [0.5, -0.5], [0.5, 0.5], [0.4813559322033898, 0.5], [0.4813559322033898, -0.5]], "segments": 64});
  if (!endpoint_orbit_cyan_10) {
    mesh_orbit_cyan_10Geometry.scale(5.9, 0.035, 5.9);
  }
  const mesh_orbit_cyan_10 = new THREE.Mesh(
    mesh_orbit_cyan_10Geometry,
    materialMap["cyan-contour"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_orbit_cyan_10.name = "Lower cyan annular band";
  if (endpoint_orbit_cyan_10) {
    mesh_orbit_cyan_10.position.copy(endpoint_orbit_cyan_10.midpoint);
    mesh_orbit_cyan_10.quaternion.copy(endpoint_orbit_cyan_10.quaternion);
  }
  mesh_orbit_cyan_10.castShadow = options.castShadow ?? true;
  mesh_orbit_cyan_10.receiveShadow = options.receiveShadow ?? true;
  mesh_orbit_cyan_10.userData.sculptComponent = {"id": "orbit-cyan", "name": "Lower cyan annular band", "level": "meso", "role": "band", "parent": null, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Lower circular contour system has shallow annular surfaces.", "confidence": 0.65, "dimensions": {"width": 5.9, "height": 0.035, "depth": 5.9, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, -1.22, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Thin lower annulus", "uvStrategy": "angular-radial", "normalStrategy": "profile normals", "latheProfile": {"points": [[0.4813559322033898, -0.5], [0.5, -0.5], [0.5, 0.5], [0.4813559322033898, 0.5], [0.4813559322033898, -0.5]], "segments": 64}, "profileCoordinateContract": "Unit profile: outer radius 0.5, vertical range [-0.5,0.5]. Generator applies component dimensions once. latheProfile is the actual supported field."}, "material": "cyan-contour", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 160, 245, 0.15)", "secondaryAlbedo": "rgba(30, 220, 255, 0.3)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-orbit", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "orbit-cyan.lower-contours", "kind": "contour", "description": "Multiple low cyan contours with gaps and depth fade"}], "evidenceRefs": ["full-object"]};
  node_orbit_cyan_10.add(mesh_orbit_cyan_10);
  meshes["orbit-cyan"] = mesh_orbit_cyan_10;
  colliders["orbit-cyan"] = {"type": "none"};

  const endpoint_orbit_cyan_inner_11 = makeAttachmentEndpoint(null);
  const node_orbit_cyan_inner_11 = new THREE.Group();
  node_orbit_cyan_inner_11.name = "Inner lower cyan contour__pivot";
  node_orbit_cyan_inner_11.scale.set(1, 1, 1);
  if (endpoint_orbit_cyan_inner_11) {
    node_orbit_cyan_inner_11.position.copy(endpoint_orbit_cyan_inner_11.start);
    node_orbit_cyan_inner_11.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_orbit_cyan_inner_11.position.set(0.0, -1.08, 0.0);
    node_orbit_cyan_inner_11.rotation.set(0.0, 0.0, 0.0);
  }
  node_orbit_cyan_inner_11.userData.sculptComponent = {"id": "orbit-cyan-inner", "name": "Inner lower cyan contour", "level": "meso", "role": "band", "parent": null, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Adjacent inner ellipse contributes to layered lower orbit.", "confidence": 0.55, "dimensions": {"width": 4.8, "height": 0.025, "depth": 4.8, "units": "relative", "confidence": 0.4}, "transform": {"position": [0, -1.08, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Adjacent thin annulus at unequal vertical spacing", "uvStrategy": "angular-radial", "normalStrategy": "profile normals", "latheProfile": {"points": [[0.48958333333333337, -0.5], [0.5, -0.5], [0.5, 0.5], [0.48958333333333337, 0.5], [0.48958333333333337, -0.5]], "segments": 64}, "profileCoordinateContract": "Unit profile: outer radius 0.5, vertical range [-0.5,0.5]. Generator applies component dimensions once. latheProfile is the actual supported field."}, "material": "cyan-contour", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 140, 240, 0.1)", "secondaryAlbedo": "rgba(30, 210, 255, 0.2)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-orbit", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [], "evidenceRefs": ["full-object"]};
  node_orbit_cyan_inner_11.userData.actionProfile = {"animationRole": "static-orbit", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}};
  (nodes["root"] ?? root).add(node_orbit_cyan_inner_11);
  nodes["orbit-cyan-inner"] = node_orbit_cyan_inner_11;
  const mesh_orbit_cyan_inner_11Geometry = endpoint_orbit_cyan_inner_11
    ? new THREE.CylinderGeometry(endpoint_orbit_cyan_inner_11.endRadius, endpoint_orbit_cyan_inner_11.baseRadius, endpoint_orbit_cyan_inner_11.length, 16, 6)
    : buildLatheGeometry({"points": [[0.48958333333333337, -0.5], [0.5, -0.5], [0.5, 0.5], [0.48958333333333337, 0.5], [0.48958333333333337, -0.5]], "segments": 64});
  if (!endpoint_orbit_cyan_inner_11) {
    mesh_orbit_cyan_inner_11Geometry.scale(4.8, 0.025, 4.8);
  }
  const mesh_orbit_cyan_inner_11 = new THREE.Mesh(
    mesh_orbit_cyan_inner_11Geometry,
    materialMap["cyan-contour"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_orbit_cyan_inner_11.name = "Inner lower cyan contour";
  if (endpoint_orbit_cyan_inner_11) {
    mesh_orbit_cyan_inner_11.position.copy(endpoint_orbit_cyan_inner_11.midpoint);
    mesh_orbit_cyan_inner_11.quaternion.copy(endpoint_orbit_cyan_inner_11.quaternion);
  }
  mesh_orbit_cyan_inner_11.castShadow = options.castShadow ?? true;
  mesh_orbit_cyan_inner_11.receiveShadow = options.receiveShadow ?? true;
  mesh_orbit_cyan_inner_11.userData.sculptComponent = {"id": "orbit-cyan-inner", "name": "Inner lower cyan contour", "level": "meso", "role": "band", "parent": null, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Adjacent inner ellipse contributes to layered lower orbit.", "confidence": 0.55, "dimensions": {"width": 4.8, "height": 0.025, "depth": 4.8, "units": "relative", "confidence": 0.4}, "transform": {"position": [0, -1.08, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Adjacent thin annulus at unequal vertical spacing", "uvStrategy": "angular-radial", "normalStrategy": "profile normals", "latheProfile": {"points": [[0.48958333333333337, -0.5], [0.5, -0.5], [0.5, 0.5], [0.48958333333333337, 0.5], [0.48958333333333337, -0.5]], "segments": 64}, "profileCoordinateContract": "Unit profile: outer radius 0.5, vertical range [-0.5,0.5]. Generator applies component dimensions once. latheProfile is the actual supported field."}, "material": "cyan-contour", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 140, 240, 0.1)", "secondaryAlbedo": "rgba(30, 210, 255, 0.2)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-orbit", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [], "evidenceRefs": ["full-object"]};
  node_orbit_cyan_inner_11.add(mesh_orbit_cyan_inner_11);
  meshes["orbit-cyan-inner"] = mesh_orbit_cyan_inner_11;
  colliders["orbit-cyan-inner"] = {"type": "none"};

  const attachment_platform_12 = null;
  const endpoint_platform_12 = makeAttachmentEndpoint(attachment_platform_12);
  const node_platform_12 = new THREE.Group();
  node_platform_12.name = "Low projection platform__pivot";
  node_platform_12.scale.set(1, 1, 1);
  if (endpoint_platform_12) {
    node_platform_12.position.copy(endpoint_platform_12.start);
    node_platform_12.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_platform_12.position.set(0.0, -1.7, 0.0);
    node_platform_12.rotation.set(0.0, 0.0, 0.0);
  }
  node_platform_12.userData.sculptComponent = {"id": "platform", "name": "Low projection platform", "level": "macro", "role": "platform", "parent": null, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Low circular foundation is an independent projected surface, not a physical glass pedestal attached to the core.", "confidence": 0.65, "dimensions": {"width": 4.6, "height": 0.045, "depth": 4.6, "units": "relative", "confidence": 0.45}, "transform": {"position": [0, -1.7, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Thin closed circular carrier for low radial traces", "uvStrategy": "radial procedural", "normalStrategy": "analytic"}, "material": "frame-fill", "colorMaterialRecipe": {"dominantAlbedo": "rgba(15, 80, 230, 0.08)", "secondaryAlbedo": "rgba(15, 190, 255, 0.15)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-platform", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "platform.radial-traces", "kind": "linework", "description": "Sparse technical paths extending outward with intentional dark gaps"}], "evidenceRefs": ["full-object"]};
  node_platform_12.userData.actionProfile = {"animationRole": "static-platform", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}};
  (nodes["root"] ?? root).add(node_platform_12);
  nodes["platform"] = node_platform_12;
  const mesh_platform_12Geometry = endpoint_platform_12
    ? new THREE.CylinderGeometry(endpoint_platform_12.endRadius, endpoint_platform_12.baseRadius, endpoint_platform_12.length, 16, 6)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8);
  if (!endpoint_platform_12) {
    mesh_platform_12Geometry.scale(4.6, 0.045, 4.6);
  }
  const mesh_platform_12 = new THREE.Mesh(
    mesh_platform_12Geometry,
    materialMap["frame-fill"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_platform_12.name = "Low projection platform";
  if (endpoint_platform_12) {
    mesh_platform_12.position.copy(endpoint_platform_12.midpoint);
    mesh_platform_12.quaternion.copy(endpoint_platform_12.quaternion);
  }
  mesh_platform_12.castShadow = options.castShadow ?? true;
  mesh_platform_12.receiveShadow = options.receiveShadow ?? true;
  mesh_platform_12.userData.sculptComponent = {"id": "platform", "name": "Low projection platform", "level": "macro", "role": "platform", "parent": null, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Low circular foundation is an independent projected surface, not a physical glass pedestal attached to the core.", "confidence": 0.65, "dimensions": {"width": 4.6, "height": 0.045, "depth": 4.6, "units": "relative", "confidence": 0.45}, "transform": {"position": [0, -1.7, 0], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Thin closed circular carrier for low radial traces", "uvStrategy": "radial procedural", "normalStrategy": "analytic"}, "material": "frame-fill", "colorMaterialRecipe": {"dominantAlbedo": "rgba(15, 80, 230, 0.08)", "secondaryAlbedo": "rgba(15, 190, 255, 0.15)", "materialClass": "unknown", "materialClassConfidence": 0, "materialModel": "emission-dominant holographic projection; not physical glass"}, "actionProfile": {"animationRole": "static-platform", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "platform.radial-traces", "kind": "linework", "description": "Sparse technical paths extending outward with intentional dark gaps"}], "evidenceRefs": ["full-object"]};
  node_platform_12.add(mesh_platform_12);
  meshes["platform"] = mesh_platform_12;
  colliders["platform"] = {"type": "none"};

  const endpoint_lower_node_13 = makeAttachmentEndpoint(null);
  const node_lower_node_13 = new THREE.Group();
  node_lower_node_13.name = "Localized cyan lower node__pivot";
  node_lower_node_13.scale.set(1, 1, 1);
  if (endpoint_lower_node_13) {
    node_lower_node_13.position.copy(endpoint_lower_node_13.start);
    node_lower_node_13.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_lower_node_13.position.set(0.0, 0.16, 1.1);
    node_lower_node_13.rotation.set(0.0, 0.0, 0.0);
  }
  node_lower_node_13.userData.sculptComponent = {"id": "lower-node", "name": "Localized cyan lower node", "level": "micro", "role": "highlight", "parent": "platform", "primitive": "sphere", "topologyClass": "material-only", "topologyRationale": "Bright point reads as emission, not independently measured physical hardware.", "confidence": 0.7, "dimensions": {"width": 0.09, "height": 0.09, "depth": 0.09, "units": "relative", "confidence": 0.4}, "transform": {"position": [0, 0.16, 1.1], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Small emissive point carrier; no arbitrary particle field", "uvStrategy": "generated", "normalStrategy": "smooth"}, "material": "cyan-contour", "actionProfile": {"animationRole": "static-highlight", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "lower-node.node-glow", "kind": "emissive", "description": "One reference-anchored cyan hotspot; bloom remains bounded"}], "evidenceRefs": ["full-object"]};
  node_lower_node_13.userData.actionProfile = {"animationRole": "static-highlight", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}};
  (nodes["platform"] ?? root).add(node_lower_node_13);
  nodes["lower-node"] = node_lower_node_13;
  const mesh_lower_node_13Geometry = endpoint_lower_node_13
    ? new THREE.CylinderGeometry(endpoint_lower_node_13.endRadius, endpoint_lower_node_13.baseRadius, endpoint_lower_node_13.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_lower_node_13) {
    mesh_lower_node_13Geometry.scale(0.09, 0.09, 0.09);
  }
  const mesh_lower_node_13 = new THREE.Mesh(
    mesh_lower_node_13Geometry,
    materialMap["cyan-contour"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lower_node_13.name = "Localized cyan lower node";
  if (endpoint_lower_node_13) {
    mesh_lower_node_13.position.copy(endpoint_lower_node_13.midpoint);
    mesh_lower_node_13.quaternion.copy(endpoint_lower_node_13.quaternion);
  }
  mesh_lower_node_13.castShadow = options.castShadow ?? true;
  mesh_lower_node_13.receiveShadow = options.receiveShadow ?? true;
  mesh_lower_node_13.userData.sculptComponent = {"id": "lower-node", "name": "Localized cyan lower node", "level": "micro", "role": "highlight", "parent": "platform", "primitive": "sphere", "topologyClass": "material-only", "topologyRationale": "Bright point reads as emission, not independently measured physical hardware.", "confidence": 0.7, "dimensions": {"width": 0.09, "height": 0.09, "depth": 0.09, "units": "relative", "confidence": 0.4}, "transform": {"position": [0, 0.16, 1.1], "rotation": [0, 0, 0]}, "geometryDescriptor": {"topologyIntent": "Small emissive point carrier; no arbitrary particle field", "uvStrategy": "generated", "normalStrategy": "smooth"}, "material": "cyan-contour", "actionProfile": {"animationRole": "static-highlight", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0]}, "collider": {"type": "none"}, "destruction": {"breakable": false}}, "localFeatures": [{"id": "lower-node.node-glow", "kind": "emissive", "description": "One reference-anchored cyan hotspot; bloom remains bounded"}], "evidenceRefs": ["full-object"]};
  node_lower_node_13.add(mesh_lower_node_13);
  meshes["lower-node"] = mesh_lower_node_13;
  colliders["lower-node"] = {"type": "none"};

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": false, "normalOrBumpRequired": false, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["glass transmission and white studio reflection", "fabricated physical roughness/normal/AO maps", "uniform neon brightness", "textureless declarations without geometric realization of all observed patterns", "claiming exact PBR or camera recovery"], "textureApplicability": "Required map channels and texture-resolution floors remain unchanged for textured surfaces. This subject uses the validator's explicit per-material textureless declaration because all technical marks are geometric and carriers have no observed physical texture detail.", "requiredObservedSignals": ["blue volume density", "cyan contour hierarchy", "violet band accents", "geometric grid density", "rear depth fade", "dark inter-layer gaps"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only opaque blockout", "flat value range", "invented studio floor reflection", "bloom hiding geometry"]}, "screenshotReview": ["Neutral opaque blockout for shape only", "Reference-matched emission/alpha layers for color and depth", "Bloom disabled comparison before selective bloom", "Four orbit views for assembly integrity; only source camera for fidelity"]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createLayeredHolographicDataCoreLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Layered Holographic Data Core look-dev lights";
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
  lights.userData.lightingFromPhoto = [{"id": "reference-emission", "type": "emissive-scene", "observed": "Blue core, cyan cap and nodes, violet ring; no physical studio light can be recovered", "confidence": 0.75}, {"id": "neutral-review-key", "type": "directional", "proposal": true, "position": [3, 5, 4], "intensity": 2, "color": "#FFFFFF", "purpose": "Neutral opaque blockout only"}, {"id": "neutral-review-fill", "type": "ambient", "proposal": true, "intensity": 0.35, "color": "#FFFFFF", "purpose": "Keep occluded frame structure readable during geometry review"}, {"id": "reference-environment", "type": "environment", "proposal": true, "background": "#031127", "exposure": 1, "toneMapping": "pending-runtime-selection", "contactShadow": "not inferred; do not add reflective studio floor", "bloom": "off during blockout, bounded selective highlights only after geometry review", "contact shadow": "none: free-space projected hologram, no opaque ground or physical contact receiver; this is a deliberate behavior, not missing setup"}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": false, "normalOrBumpRequired": false, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["glass transmission and white studio reflection", "fabricated physical roughness/normal/AO maps", "uniform neon brightness", "textureless declarations without geometric realization of all observed patterns", "claiming exact PBR or camera recovery"], "textureApplicability": "Required map channels and texture-resolution floors remain unchanged for textured surfaces. This subject uses the validator's explicit per-material textureless declaration because all technical marks are geometric and carriers have no observed physical texture detail.", "requiredObservedSignals": ["blue volume density", "cyan contour hierarchy", "violet band accents", "geometric grid density", "rear depth fade", "dark inter-layer gaps"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only opaque blockout", "flat value range", "invented studio floor reflection", "bloom hiding geometry"]}, "screenshotReview": ["Neutral opaque blockout for shape only", "Reference-matched emission/alpha layers for color and depth", "Bloom disabled comparison before selective bloom", "Four orbit views for assembly integrity; only source camera for fidelity"]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createLayeredHolographicDataCoreEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
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
export function frameLayeredHolographicDataCoreCamera(
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
export function createLayeredHolographicDataCorePresentationComposer(
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

export function configureLayeredHolographicDataCoreRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createLayeredHolographicDataCoreInspectControls(
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
