import { Vector2, Vector4 } from 'three'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { authGlassConfig } from '../auth-glass/auth-glass.config'
import { CONVEX_LENS_GLSL } from '../convex-lens.glsl'

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
      uniform float uRadius, uLight, uIor, uThickness, uChroma, uRim;
      varying vec2 vUv;
      ${CONVEX_LENS_GLSL}
      vec3 backdrop(vec2 uv) {
        vec2 inset = 0.5 / uViewport;
        return texture2D(tDiffuse, clamp(uv, inset, 1.0 - inset)).rgb;
      }
      void main() {
        vec4 original = texture2D(tDiffuse, vUv);
        vec2 halfSize = uRect.zw * 0.5;
        vec2 p = vUv * uViewport - uRect.xy - halfSize;
        float radius = min(uRadius, min(halfSize.x, halfSize.y));
        vec2 q = abs(p) - halfSize + radius;
        float d = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
        float aa = max(fwidth(d), 0.65);
        float coverage = 1.0 - smoothstep(-aa, aa, d);
        if (coverage <= 0.0) { gl_FragColor = original; return; }
        float inset = max(-d, 0.0);
        // Same broad convex bezel as Login, scaled to the actual panel size.
        float lensWidth = min(halfSize.x, halfSize.y) * 0.5;
        float profile = 1.0 - clamp(inset / max(lensWidth, 1.0), 0.0, 1.0);
        float normalReach = max(radius, inset + 1.0);
        vec2 gradient = sign(p) * max(abs(p) - halfSize + normalReach, 0.0);
        vec2 direction = gradient / max(length(gradient), 0.00001);
        vec3 normal = normalize(vec3(convexLensSlope(profile), 0.0, 1.0));
        vec2 travel = direction * min(uThickness, 0.7 * lensWidth) / uViewport;
        float ray = refractedRayX(normal, uIor);
        vec2 uv = vUv + travel * ray;
        float chroma = uChroma * smoothstep(0.08, 0.25, profile);
        vec3 color = backdrop(uv);
        color.r = backdrop(uv + travel * (refractedRayX(normal, uIor - chroma) - ray)).r;
        color.b = backdrop(uv + travel * (refractedRayX(normal, uIor + chroma) - ray)).b;
        color = mix(color, mix(vec3(0.025, 0.06, 0.1), vec3(1.0), uLight), 0.035);
        float thinEdge = 1.0 - smoothstep(0.5, 1.8, inset);
        float innerRim = smoothstep(2.0, 3.0, inset) * (1.0 - smoothstep(4.0, 6.0, inset));
        float facing = abs(dot(direction, normalize(vec2(-0.6, 0.8))));
        float specular = pow(profile, 3.0) * (0.15 + 0.5 * facing);
        color += uRim * vec3(0.92, 0.97, 1.0) * specular * (thinEdge * 0.66 + innerRim * 0.18);
        gl_FragColor = vec4(mix(original.rgb, color, coverage), original.a);
      }
    `,
  })
}

export function projectGlassRect(canvas: { left: number; top: number; width: number; height: number }, panel: { left: number; top: number; width: number; height: number }) {
  return new Vector4(panel.left - canvas.left, canvas.height - (panel.top - canvas.top) - panel.height, panel.width, panel.height)
}

// Three.js resources are imperative; binding lives outside React's render state.
export function bindProjectGlassPass(pass: ShaderPass, canvas: HTMLCanvasElement, panel: HTMLElement | null | undefined, light: boolean) {
  if (!panel) { pass.enabled = false; return }
  const measure = () => {
    const bounds = canvas.getBoundingClientRect()
    const rect = panel.getBoundingClientRect()
    pass.uniforms.uViewport.value.set(bounds.width, bounds.height)
    pass.uniforms.uRect.value.copy(projectGlassRect(bounds, rect))
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
    panel.removeAttribute('data-refractive')
    observer.disconnect()
    window.removeEventListener('resize', measure)
    window.removeEventListener('scroll', measure, true)
  }
}
