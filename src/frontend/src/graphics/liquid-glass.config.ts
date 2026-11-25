import type { GlassConfig } from '@ybouane/liquidglass'

export const liquidGlassDefaults = {
  blurAmount: 0.25,
  refraction: 1.2,
  chromAberration: 0.05,
  edgeHighlight: 0.3,
  specular: 0,
  fresnel: 1,
  distortion: 0,
  zRadius: 40,
  opacity: 1,
  saturation: 0,
  brightness: -0.05,
  shadowOpacity: 0.3,
  shadowSpread: 10,
  bevelMode: 0.3,
} satisfies Partial<GlassConfig>
