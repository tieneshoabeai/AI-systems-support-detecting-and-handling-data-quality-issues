import {
  AdditiveBlending, CanvasTexture, Color, DataTexture, EquirectangularReflectionMapping, FloatType,
  RGBAFormat, ShaderMaterial, Vector2, Vector4,
  SRGBColorSpace,
} from 'three'
import type { DisplayBaseFootlights } from './display-base.config'

// Softboxes are baked into a small procedural panorama, scoped to the base.
export function createBasePanorama() {
  const width = 128
  const height = 64
  const pixels = new Float32Array(width * height * 4)
  const lights = [
    { u: 0.24, v: 0.61, w: 0.10, h: 0.075, color: new Color('#90cbff').multiplyScalar(3.2) },
    { u: 0.58, v: 0.43, w: 0.09, h: 0.10, color: new Color('#6342ff').multiplyScalar(2.1) },
    { u: 0.83, v: 0.54, w: 0.035, h: 0.065, color: new Color('#ffba79').multiplyScalar(2.0) },
  ]
  const sample = new Color()
  for (let y = 0; y < height; y++) {
    const v = y / height
    for (let x = 0; x < width; x++) {
      const u = x / width
      sample.setRGB(0.005, 0.010 + v * 0.012, 0.029 + v * 0.038)
      for (const light of lights) {
        const du = (u - light.u) / light.w
        const dv = (v - light.v) / light.h
        const weight = Math.exp(-du * du - dv * dv)
        sample.r += light.color.r * weight
        sample.g += light.color.g * weight
        sample.b += light.color.b * weight
      }
      const i = (y * width + x) * 4
      pixels[i] = sample.r
      pixels[i + 1] = sample.g
      pixels[i + 2] = sample.b
      pixels[i + 3] = 1
    }
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat, FloatType)
  texture.mapping = EquirectangularReflectionMapping
  texture.needsUpdate = true
  return texture
}

export function createBaseGlint() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    glow.addColorStop(0, '#ffffff')
    glow.addColorStop(0.12, '#ffffffb0')
    glow.addColorStop(0.38, '#ffffff45')
    glow.addColorStop(1, '#ffffff00')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, 64, 64)
    ctx.fillStyle = '#ffffffb0'
    ctx.fillRect(17, 31, 30, 2)
    ctx.fillRect(31, 19, 2, 26)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function createBaseFloorFade() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const alpha = ctx.createRadialGradient(32, 32, 19, 32, 32, 32)
    alpha.addColorStop(0, '#fff')
    alpha.addColorStop(0.55, '#aaa')
    alpha.addColorStop(1, '#000')
    ctx.fillStyle = alpha
    ctx.fillRect(0, 0, 64, 64)
  }
  return new CanvasTexture(canvas)
}

export function createBaseGlow(
  kind: 'inlay' | 'floor' | 'halo', radius: number, strength: number, ripples: boolean, footlights?: DisplayBaseFootlights,
) {
  return new ShaderMaterial({
    depthWrite: false,
    transparent: true,
    blending: AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uRadius: { value: radius },
      uStrength: { value: strength },
      uTime: { value: 0 },
      ...(footlights && {
        uFootlights: { value: footlights.panels.map(({ x, z, yaw }) => new Vector4(x, z, Math.cos(yaw), -Math.sin(yaw))) },
        uFootSize: { value: new Vector2(footlights.width / 2, footlights.depth / 2) },
      }),
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uRadius;
      uniform float uStrength;
      uniform float uTime;
      ${footlights ? `uniform vec4 uFootlights[${footlights.panels.length}];
      uniform vec2 uFootSize;` : ''}
      varying vec2 vUv;
      float band(float value, float center, float width) {
        float d = (value - center) / width;
        return exp(-d * d);
      }
      ${footlights ? `
      float footStrip(vec2 point, vec4 foot) {
        vec2 delta = point - foot.xy;
        vec2 axis = foot.zw;
        float along = abs(dot(delta, axis));
        float across = abs(dot(delta, vec2(-axis.y, axis.x)));
        float ends = 1.0 - smoothstep(uFootSize.x - 0.14, uFootSize.x, along);
        return ends * (0.50 * band(across, 0.0, uFootSize.y + 0.10)
          + 0.50 * band(across, uFootSize.y + 0.025, 0.043));
      }` : ''}
      void main() {
        vec2 p = (vUv * 2.0 - 1.0) * uRadius;
        float r = length(p);
        float front = smoothstep(-0.5, 1.5, -p.y);
        vec3 blue = vec3(0.025, 0.22, 0.85);
        vec3 color;
        ${kind === 'inlay' ? `
          float wash = exp(-dot(p * vec2(0.65, 1.5), p * vec2(0.65, 1.5)));
          color = blue * wash * 0.13;
          ${footlights ? `
            vec2 point = vec2(p.x, -p.y);
            for (int i = 0; i < ${footlights.panels.length}; i++) {
              color += vec3(0.045, 0.37, 1.0) * footStrip(point, uFootlights[i]) * 0.82;
            }
          ` : ''}
        ` : kind === 'floor' ? `
          float ringReflection = band(r, uRadius * 0.76, 0.23) * (0.18 + front * 0.36);
          float blueWash = exp(-r * r * 0.31) * 0.15;
          color = blue * (ringReflection + blueWash);
          ${ripples ? `color += blue * (band(r, 2.67 + uTime * 0.05, 0.035)
            + band(r, 2.91 + uTime * 0.05, 0.025)) * (0.12 + 0.08 * sin(uTime));` : ''}
        ` : `
          float ring = band(r, uRadius - 0.28, 0.084);
          float pulse = 0.90 + 0.10 * cos(uTime * 1.2);
          float head = cos(atan(p.y, p.x) - uTime * 0.8);
          float sweep = pow(max(head, 0.0), 32.0) * min(uTime, 1.0) * 0.65;
          vec3 violet = vec3(0.32, 0.07, 0.78);
          color = mix(blue, violet, smoothstep(0.3, 2.5, -p.x)) * ring * (front * 0.6 + 0.4) * (pulse + sweep);
        `}
        float fade = 1.0 - smoothstep(uRadius * 0.88, uRadius, r);
        gl_FragColor = vec4(color * uStrength * fade, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}
