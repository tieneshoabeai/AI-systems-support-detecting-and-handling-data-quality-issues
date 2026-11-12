import { Vector2, Vector4 } from 'three'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { authGlassConfig } from '../auth-glass/auth-glass.config'
import { CONVEX_LENS_GLSL } from '../convex-lens.glsl'
import { glassMotionRect, readGlassMotion } from './project-glass-motion'

// Runs after scene glass/bloom/output: it refracts the final live scene, not HTML.
export function createProjectGlassPass() {
  const { glass } = authGlassConfig
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uViewport: { value: new Vector2(1, 1) },
      uRect: { value: new Vector4() },
      uRadius: { value: 22 },
      uLight: { value: 0 },
      uIor: { value: glass.ior },
      uThickness: { value: glass.thicknessPixels },
      uChroma: { value: glass.chroma },
      uRim: { value: glass.rimIntensity },
      uOrigin: { value: new Vector4() },
      uMorph: { value: 1 },
      uVisibility: { value: 1 },
      uPointer: { value: new Vector2(.18, .85) },
      uPress: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 uViewport;
      uniform vec4 uRect;
      uniform vec4 uOrigin;
      uniform vec2 uPointer;
      uniform float uMorph, uVisibility, uPress;
      uniform float uRadius, uLight, uIor, uThickness, uChroma, uRim;
      varying vec2 vUv;
      ${CONVEX_LENS_GLSL}
      float roundedBox(vec2 point, vec4 box, float radius) {
        vec2 halfSize = box.zw * 0.5;
        vec2 q = abs(point - box.xy - halfSize) - halfSize + min(radius, min(halfSize.x, halfSize.y));
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - min(radius, min(halfSize.x, halfSize.y));
      }
      float glassDistance(vec2 point) {
        float body = roundedBox(point, uRect, uRadius);
        if (uMorph <= 0.001 || uMorph >= 0.999) return body;
        float seedRadius = min(uOrigin.z, uOrigin.w) * 0.5 * (1.0 - uMorph);
        float seed = length(point - uOrigin.xy - uOrigin.zw * 0.5) - seedRadius;
        float blend = 32.0 * sin(uMorph * 3.14159265);
        float h = max(blend - abs(body - seed), 0.0) / max(blend, 0.001);
        return min(body, seed) - h * h * blend * 0.25;
      }
      vec3 backdrop(vec2 uv) {
        vec2 inset = 0.5 / uViewport;
        return texture2D(tDiffuse, clamp(uv, inset, 1.0 - inset)).rgb;
      }
      vec3 scatteredBackdrop(vec2 uv, float radius) {
        // Distribute taps across the disk to avoid repeated outlines on neon.
        vec3 color = backdrop(uv);
        for (int i = 0; i < 16; i++) {
          float tap = float(i);
          float angle = tap * 2.39996323;
          vec2 offset = vec2(cos(angle), sin(angle)) * sqrt((tap + 0.5) / 16.0) * radius / uViewport;
          color += backdrop(uv + offset);
        }
        return color / 17.0;
      }
      void main() {
        vec4 original = texture2D(tDiffuse, vUv);
        vec2 halfSize = uRect.zw * 0.5;
        vec2 screenPoint = vUv * uViewport;
        float d = glassDistance(screenPoint);
        float aa = max(fwidth(d), 0.65);
        float coverage = (1.0 - smoothstep(-aa, aa, d)) * uVisibility;
        if (coverage <= 0.0) { gl_FragColor = original; return; }
        float inset = max(-d, 0.0);
        // Same broad convex bezel as Login, scaled to the actual panel size.
        float lensWidth = min(halfSize.x, halfSize.y) * 0.5;
        float profile = 1.0 - clamp(inset / max(lensWidth, 1.0), 0.0, 1.0);
        vec2 gradient = vec2(glassDistance(screenPoint + vec2(1.0, 0.0)) - glassDistance(screenPoint - vec2(1.0, 0.0)),
          glassDistance(screenPoint + vec2(0.0, 1.0)) - glassDistance(screenPoint - vec2(0.0, 1.0)));
        vec2 direction = gradient / max(length(gradient), 0.00001);
        vec3 normal = normalize(vec3(convexLensSlope(profile), 0.0, 1.0));
        vec2 travel = direction * min(uThickness, 0.7 * lensWidth) / uViewport;
        float ray = refractedRayX(normal, uIor);
        vec2 uv = vUv + travel * ray;
        float chroma = uChroma * smoothstep(0.08, 0.25, profile);
        // Broad body scattering, a sharper optical rim. Preserve the convex lens.
        float scatteringRadius = mix(8.0, 1.2, smoothstep(0.25, 1.0, profile));
        vec3 color = scatteredBackdrop(uv, scatteringRadius);
        vec3 splitColor = backdrop(uv);
        splitColor.r = backdrop(uv + travel * (refractedRayX(normal, uIor - chroma) - ray)).r;
        splitColor.b = backdrop(uv + travel * (refractedRayX(normal, uIor + chroma) - ray)).b;
        color = mix(color, splitColor, smoothstep(0.45, 1.0, profile) * 0.55);
        // Regular material attenuates the background's contrast and adapts its
        // body tint to local luminance; this never changes pixels outside glass.
        float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
        // Mild saturation lift before adaptive luminance/contrast compression.
        color = mix(vec3(luminance), color, 1.08);
        float bodyLuminance = mix(0.08 + 0.28 * luminance, 0.62 + 0.3 * luminance, uLight);
        // Add a neutral luminance floor instead of amplifying almost-black RGB:
        // multiplicative gain would turn a faint blue backdrop into vivid blue.
        color = max(vec3(0.0), vec3(bodyLuminance) + (color - vec3(luminance)) * mix(0.55, 0.78, uLight));
        vec3 surfaceTint = mix(vec3(0.12, 0.16, 0.21), vec3(0.95, 0.97, 0.99), uLight);
        float bodyWeight = mix(0.2, 0.32, uLight) + smoothstep(0.2, 0.8, luminance) * 0.08;
        color = mix(color, surfaceTint, bodyWeight);
        float thinEdge = 1.0 - smoothstep(0.5, 1.8, inset);
        float innerRim = smoothstep(2.0, 3.0, inset) * (1.0 - smoothstep(4.0, 6.0, inset));
        vec3 surfaceNormal = normalize(vec3(direction * convexLensSlope(profile), 1.0));
        vec3 viewDirection = vec3(0.0, 0.0, 1.0);
        vec3 lightDirection = normalize(vec3((uPointer - 0.5) * 2.0, 1.4));
        float facing = dot(direction, normalize(lightDirection.xy + vec2(0.0001)));
        float f0 = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
        float fresnel = f0 + (1.0 - f0) * pow(1.0 - max(dot(surfaceNormal, viewDirection), 0.0), 5.0);
        float reflection = pow(max(dot(reflect(-lightDirection, surfaceNormal), viewDirection), 0.0), 26.0) * profile;
        float specular = pow(profile, 3.0) * (0.22 + 0.58 * max(facing, 0.0));
        float bevelShade = pow(profile, 2.0) * max(-facing, 0.0) * 0.16;
        color *= 1.0 - bevelShade;
        color += uRim * vec3(0.92, 0.97, 1.0) * (specular * (thinEdge * 0.85 + innerRim * 0.28 + 0.14) + fresnel * profile * 0.65 + reflection * 0.28);
        vec2 localUv = (screenPoint - uRect.xy) / max(uRect.zw, vec2(1.0));
        float touchLight = exp(-dot(localUv - uPointer, localUv - uPointer) * 18.0);
        color += vec3(0.08, 0.1, 0.12) * max(uPress, 0.0) * (0.25 + touchLight);
        gl_FragColor = vec4(mix(original.rgb, color, coverage), original.a);
      }
    `,
  })
}

export function projectGlassRect(canvas: { left: number; top: number; width: number; height: number }, panel: { left: number; top: number; width: number; height: number }) {
  return new Vector4(panel.left - canvas.left, canvas.height - (panel.top - canvas.top) - panel.height, panel.width, panel.height)
}

export function updateProjectGlassPass(pass: ShaderPass, panel: HTMLElement | null | undefined) {
  if (!panel) return
  const motion = readGlassMotion(panel)
  if (!motion?.panel || !motion.origin || !motion.canvas) return
  // Paint HTML from exactly the state sampled by this WebGL frame, rather than
  // a second RAF moving HTML one frame ahead of the refracted surface.
  motion.renderDriven = true
  motion.paint?.()
  const rect = glassMotionRect(motion.panel, motion.origin, motion.progress, motion.reduced ? 0 : motion.pressure)
  const height = motion.canvas.height
  pass.uniforms.uRect.value.set(rect.x, height - rect.y - rect.w, rect.z, rect.w)
  pass.uniforms.uOrigin.value.set(motion.origin.x, height - motion.origin.y - motion.origin.height, motion.origin.width, motion.origin.height)
  pass.uniforms.uMorph.value = motion.progress
  pass.uniforms.uVisibility.value = Math.min(1, motion.progress * 8)
  pass.uniforms.uPointer.value.copy(motion.pointer)
  pass.uniforms.uPress.value = motion.pressure
}

// Three.js resources are imperative; binding lives outside React's render state.
export function bindProjectGlassPass(pass: ShaderPass, canvas: HTMLCanvasElement, panel: HTMLElement | null | undefined, light: boolean) {
  if (!panel) { pass.enabled = false; return }
  const measure = () => {
    const bounds = canvas.getBoundingClientRect()
    const motion = readGlassMotion(panel)
    const rect = panel.getBoundingClientRect()
    pass.uniforms.uViewport.value.set(bounds.width, bounds.height)
    if (!motion) pass.uniforms.uRect.value.copy(projectGlassRect(bounds, rect))
    pass.uniforms.uRadius.value = parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 22
    pass.uniforms.uLight.value = light ? 1 : 0
    pass.enabled = bounds.width > 0 && bounds.height > 0 && rect.width > 0 && rect.height > 0
    panel.toggleAttribute('data-refractive', pass.enabled)
  }
  measure()
  const observer = new ResizeObserver(measure)
  observer.observe(canvas)
  observer.observe(panel)
  window.addEventListener('resize', measure)
  window.addEventListener('scroll', measure, true)
  return () => {
    pass.enabled = false
    const motion = readGlassMotion(panel)
    if (motion) motion.renderDriven = false
    panel.removeAttribute('data-refractive')
    observer.disconnect()
    window.removeEventListener('resize', measure)
    window.removeEventListener('scroll', measure, true)
  }
}
