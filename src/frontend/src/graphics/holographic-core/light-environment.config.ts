import { ACESFilmicToneMapping, Color, Matrix3, Vector3 } from 'three'
import type { WebGLRenderer } from 'three'

// Display-space swatches. Tune these; conversion stays local to light assets.
export const LIGHT_ENVIRONMENT = {
  horizon: '#c4dbf5',
  middle: '#adcbed',
  zenith: '#8fb8e6',
  lavender: '#b9c3ec',
  cyan: '#93cae8',
  nebulaPearl: '#d9e9fa',
  sun: '#fffdf8',
  starBlue: '#487ec8',
  auroraCyan: '#398dbb',
  auroraViolet: '#7665bc',
  line: '#547bb7',
  orbit: '#5a68b8',
  crystalRim: '#8b83ce',
  shadow: '#8d9fb6',
  backAzimuth: Math.PI * 5 / 4,
  fogDensity: .0035,
  skyCubeSize: 512,
  bloomStrength: .08,
  bloomThreshold: 16,
} as const

// Inverse of three r186 ACES input/output matrices and RRTAndODTFit.
// This is palette preparation, not a change to renderer tone mapping or dark mode.
const inputInverse = new Matrix3().set(
  .59719, .35458, .04823, .076, .90834, .01566, .0284, .13383, .83777,
).invert()
const outputInverse = new Matrix3().set(
  1.60475, -.53108, -.07367, -.10208, 1.10813, -.00605, -.00327, -.07276, 1.07602,
).invert()
function inverseFit(y: number) {
  const a = .983729 * y - 1
  const b = .432951 * y - .0245786
  const c = .238081 * y + .000090537
  return (-b - Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a)
}
export function lightSceneColor(hex: string, renderer: Pick<WebGLRenderer, 'toneMapping' | 'toneMappingExposure'>): Color {
  const color = new Color(hex)
  if (renderer.toneMapping !== ACESFilmicToneMapping) return color
  const value = new Vector3(color.r, color.g, color.b).applyMatrix3(outputInverse)
  value.set(inverseFit(value.x), inverseFit(value.y), inverseFit(value.z))
    .applyMatrix3(inputInverse).multiplyScalar(.6 / Math.max(.001, renderer.toneMappingExposure))
  // Saturated pastels can need signed scene-linear channels before ACES's gamut
  // matrices. Half-float targets preserve them; clamping here would grey the cyan.
  return color.setRGB(value.x, value.y, value.z)
}

// Interpolate in display-linear space first. Interpolating compensated HDR
// whites directly would pull blue gradients toward the shoulder of ACES.
export function lightDisplayTransform(renderer: Pick<WebGLRenderer, 'toneMapping' | 'toneMappingExposure'>) {
  if (renderer.toneMapping !== ACESFilmicToneMapping) return 'vec3 lightScene(vec3 c) { return c; }'
  const floats = (values: number[]) => values.map(v => Number.isInteger(v) ? v.toFixed(1) : String(v)).join(',')
  return `vec3 lightScene(vec3 color) {
    vec3 y = mat3(${floats(outputInverse.elements)}) * clamp(color, 0.0, 1.0);
    vec3 a = .983729*y-1.0, b = .432951*y-.0245786, c = .238081*y+.000090537;
    vec3 fitted = (-b-sqrt(max(vec3(0.0),b*b-4.0*a*c)))/(2.0*a);
    return mat3(${floats(inputInverse.elements)}) * fitted * ${(.6 / Math.max(.001, renderer.toneMappingExposure)).toFixed(8)};
  }`
}
