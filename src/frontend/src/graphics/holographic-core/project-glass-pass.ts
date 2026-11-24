import { Vector4 as UniformVector4 } from 'three'
import { uniformValue } from '../common/typed-objects'
import { Vector2 as UniformVector2 } from 'three'
import { requireDefined } from '../../utils/required-value'
import { Vector2, Vector4 } from 'three'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { authGlassConfig } from '../auth-glass/auth-glass.config'
import { CONVEX_LENS_GLSL } from '../common/convex-lens.glsl'
import { readGlassMotion } from './project-glass-motion'

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
      uContent: { value: 0 },
      uIor: { value: glass.ior },
      uThickness: { value: glass.thicknessPixels },
      uChroma: { value: glass.chroma },
      uRim: { value: glass.rimIntensity },
      uVisibility: { value: 1 },
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
      uniform float uVisibility, uContent;
      uniform float uRadius, uLight, uIor, uThickness, uChroma, uRim;
      varying vec2 vUv;
      ${CONVEX_LENS_GLSL}
      float roundedBox(vec2 point, vec4 box, float radius) {
        vec2 halfSize = box.zw * 0.5;
        vec2 q = abs(point - box.xy - halfSize) - halfSize + min(radius, min(halfSize.x, halfSize.y));
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - min(radius, min(halfSize.x, halfSize.y));
      }
      float glassDistance(vec2 point) {
        return roundedBox(point, uRect, uRadius);
      }
      vec3 backdrop(vec2 uv) {
        vec2 inset = 0.5 / uViewport;
        return texture2D(tDiffuse, clamp(uv, inset, 1.0 - inset)).rgb;
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
        vec2 cornerPosition = abs(screenPoint - (uRect.xy + halfSize));
        vec2 cornerDepth = halfSize - cornerPosition;
        float diagonalBand = 1.0 - smoothstep(24.0, 72.0, abs(cornerDepth.x - cornerDepth.y));
        float nearCorner = 1.0 - smoothstep(128.0, 176.0, max(cornerDepth.x, cornerDepth.y));
        float cornerRegion = diagonalBand * nearCorner;
        float profile = 1.0 - clamp(inset / max(lensWidth, 1.0), 0.0, 1.0);
        vec2 gradient = vec2(glassDistance(screenPoint + vec2(1.0, 0.0)) - glassDistance(screenPoint - vec2(1.0, 0.0)),
          glassDistance(screenPoint + vec2(0.0, 1.0)) - glassDistance(screenPoint - vec2(0.0, 1.0)));
        vec2 direction = gradient / max(length(gradient), 0.00001);
        vec3 normal = normalize(vec3(convexLensSlope(profile), 0.0, 1.0));
        vec2 travel = direction * min(uThickness, 0.7 * lensWidth) / uViewport;
        travel *= 1.0 - cornerRegion;
        float ray = refractedRayX(normal, uIor);
        vec2 uv = vUv + travel * ray;
        float chroma = uChroma * smoothstep(0.08, 0.25, profile);
        // Single backdrop sample; retain the existing optical rim and RGB split.
        vec3 color = backdrop(uv);
        vec3 splitColor = color;
        splitColor.r = backdrop(uv + travel * (refractedRayX(normal, uIor - chroma) - ray)).r;
        splitColor.b = backdrop(uv + travel * (refractedRayX(normal, uIor + chroma) - ray)).b;
        color = mix(color, splitColor, smoothstep(0.45, 1.0, profile) * 0.55);
        // Milky glass lifts the backdrop toward white instead of darkening it.
        float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(color, vec3(luminance), 0.18);
        vec3 surfaceTint = mix(vec3(0.94, 0.97, 1.0), vec3(0.98, 0.99, 1.0), uLight);
        color = mix(color, surfaceTint, mix(0.10, 0.30, uContent));
        // Keep the bezel consistent across backgrounds while leaving the glass live.
        float bezel = 1.0 - smoothstep(1.0, 22.0, inset);
        float thinEdge = 1.0 - smoothstep(0.5, 1.8, inset);
        float innerRim = smoothstep(2.0, 3.0, inset) * (1.0 - smoothstep(4.0, 6.0, inset));
        vec3 surfaceNormal = normalize(vec3(direction * convexLensSlope(profile), 1.0));
        vec3 viewDirection = vec3(0.0, 0.0, 1.0);
        vec3 lightDirection = normalize(vec3(-0.64, 0.7, 1.4));
        float facing = dot(direction, normalize(lightDirection.xy + vec2(0.0001)));
        float f0 = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
        float fresnel = f0 + (1.0 - f0) * pow(1.0 - max(dot(surfaceNormal, viewDirection), 0.0), 5.0);
        float reflection = pow(max(dot(reflect(-lightDirection, surfaceNormal), viewDirection), 0.0), 26.0) * profile;
        float specular = pow(profile, 3.0) * (0.22 + 0.58 * max(facing, 0.0));
        float bevelShade = pow(profile, 2.0) * max(-facing, 0.0) * 0.16;
        color *= 1.0 - bevelShade;
        // A broad convex lip with a narrow highlight follows the rounded outer contour.
        float outerLip = bezel * (.18 + .12 * max(facing, 0.0));
        float curvedHighlight = exp(-pow((inset - 3.2) / 2.8, 2.0));
        float innerReflection = exp(-pow((inset - 15.0) / 5.0, 2.0)) * max(facing, 0.0);
        color = mix(color, surfaceTint, outerLip);
        color += vec3(.56, .77, 1.0) * curvedHighlight * (.20 + .18 * uLight);
        color += vec3(.52, .76, 1.0) * innerReflection * .12;
        color += uRim * vec3(0.92, 0.97, 1.0) * (specular * (thinEdge * 0.85 + innerRim * 0.28 + 0.14) + fresnel * profile * 0.65 + reflection * 0.28);
        gl_FragColor = vec4(mix(original.rgb, color, coverage), original.a);
      }
    `,
  })
}

export function projectGlassRect(canvas: { left: number; top: number; width: number; height: number }, panel: { left: number; top: number; width: number; height: number }) {
  return new Vector4(panel.left - canvas.left, canvas.height - (panel.top - canvas.top) - panel.height, panel.width, panel.height)
}

function measureProjectGlass(pass: ShaderPass, canvas: HTMLCanvasElement, panel: HTMLElement) {
  const viewport = canvas.getBoundingClientRect()
  const rect = panel.getBoundingClientRect()
  uniformValue(requireDefined(pass.uniforms['uViewport'], 'glass viewport'), UniformVector2).set(viewport.width, viewport.height)
  uniformValue(requireDefined(pass.uniforms['uRect'], 'glass rect'), UniformVector4).copy(projectGlassRect(viewport, rect))
  pass.enabled = viewport.width > 0 && viewport.height > 0 && rect.width > 0 && rect.height > 0
  panel.toggleAttribute('data-refractive', pass.enabled)
}

export function updateProjectGlassPass(pass: ShaderPass, canvas: HTMLCanvasElement, panel: HTMLElement | null | undefined, requestFrame: () => void) {
  if (!panel) return
  const motion = readGlassMotion(panel)
  if (!motion) return
  motion.renderDriven = true
  motion.requestFrame = requestFrame
  if (motion.pendingGeometry) {
    const apply = motion.pendingGeometry
    delete motion.pendingGeometry
    apply()
    // Commit the HTML move and sample the real bounds before this frame is drawn.
    measureProjectGlass(pass, canvas, panel)
  }
  motion.paint?.()
  requireDefined(pass.uniforms['uVisibility'], 'project-glass-pass.ts:117').value = motion.progress
  requireDefined(pass.uniforms['uContent'], 'project-glass-pass.ts:118').value = panel.dataset['hasContent'] === 'true' ? 1 : 0
}

// Three.js resources are imperative; binding lives outside React's render state.
export function bindProjectGlassPass(pass: ShaderPass, canvas: HTMLCanvasElement, panel: HTMLElement | null | undefined, light: boolean) {
  if (!panel) { pass.enabled = false; return }
  const measure = () => {
    measureProjectGlass(pass, canvas, panel)
    requireDefined(pass.uniforms['uRadius'], 'project-glass-pass.ts:130').value = parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 22
    requireDefined(pass.uniforms['uLight'], 'project-glass-pass.ts:131').value = light ? 1 : 0
    requireDefined(pass.uniforms['uContent'], 'project-glass-pass.ts:132').value = panel.dataset['hasContent'] === 'true' ? 1 : 0
  }
  measure()
  const observer = new ResizeObserver(measure)
  observer.observe(canvas)
  observer.observe(panel)
  const nav = panel.parentElement?.querySelector('.pj-modules')
  if (nav) observer.observe(nav)
  window.addEventListener('resize', measure)
  window.addEventListener('scroll', measure, true)
  return () => {
    pass.enabled = false
    const motion = readGlassMotion(panel)
    if (motion) {
      motion.renderDriven = false
      delete motion.requestFrame
      const apply = motion.pendingGeometry
      delete motion.pendingGeometry
      apply?.()
    }
    panel.removeAttribute('data-refractive')
    observer.disconnect()
    window.removeEventListener('resize', measure)
    window.removeEventListener('scroll', measure, true)
  }
}
