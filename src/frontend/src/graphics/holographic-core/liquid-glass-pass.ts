import { AdditiveBlending, BackSide, Color, DoubleSide, ShaderMaterial, Vector2 } from 'three'
import type { Camera, Scene, Texture, WebGLRenderer, WebGLRenderTarget } from 'three'
import { CopyShader } from 'three/addons/shaders/CopyShader.js'
import { Pass } from 'three/addons/postprocessing/Pass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { CUBE_LABEL_ASPECT } from './cube-label-layout'

export const CUBE_GLASS_LAYER = 1
// Measured in label heights on each side of the glass.
export const CUBE_GLASS_GLOW_PADDING = 0.65

const glassShape = /* glsl */`
  const vec2 halfSize = vec2(${CUBE_LABEL_ASPECT / 2}, 0.5);
  const float radius = 0.2;

  float sdRoundRect(vec2 p) {
    vec2 q = abs(p) - halfSize + radius;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
  }

  float distancePerCssPixel(float distance, float pixelRatio) {
    return max(length(vec2(dFdx(distance), dFdy(distance))) * pixelRatio, 0.00001);
  }
`

export function createGlassFrame() {
  return {
    tBackground: { value: null as Texture | null },
    tSceneDepth: { value: null as Texture | null },
    uBufferSize: { value: new Vector2() },
    uPixelRatio: { value: 1 },
  }
}

export type GlassFrame = ReturnType<typeof createGlassFrame>

export class LiquidGlassPass extends Pass {
  private readonly copy = new ShaderPass(CopyShader)
  private readonly scene: Scene
  private readonly camera: Camera
  private readonly frame: GlassFrame

  constructor(scene: Scene, camera: Camera, frame: GlassFrame) {
    super()
    this.scene = scene
    this.camera = camera
    this.frame = frame
    this.copy.material.depthWrite = false
    this.copy.material.depthTest = false
  }

  override render(
    renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget,
    deltaTime: number, maskActive: boolean,
  ) {
    this.frame.tBackground.value = readBuffer.texture
    this.frame.tSceneDepth.value = readBuffer.depthTexture
    this.frame.uBufferSize.value.set(readBuffer.width, readBuffer.height)
    this.frame.uPixelRatio.value = renderer.getPixelRatio()

    const background = this.scene.background
    const cameraMask = this.camera.layers.mask
    const autoClear = renderer.autoClear
    try {
      renderer.autoClear = false
      renderer.setRenderTarget(writeBuffer)
      renderer.clearDepth()
      this.copy.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive)
      this.camera.layers.set(CUBE_GLASS_LAYER)
      this.scene.background = null
      renderer.render(this.scene, this.camera)
    } finally {
      this.scene.background = background
      this.camera.layers.mask = cameraMask
      renderer.autoClear = autoClear
    }
  }

  override dispose() {
    this.copy.dispose()
    this.frame.tBackground.value = null
    this.frame.tSceneDepth.value = null
  }
}

export function createCubeGlassMaterial(frame: GlassFrame, texture: Texture, glow: string, height: number) {
  return new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      ...frame,
      tArtwork: { value: texture },
      uGlow: { value: new Color(glow) },
      uTint: { value: new Color('#06223a') },
      uLabelHeight: { value: height },
    },
    vertexShader: /* glsl */`
      varying vec2 vLabelUv;
      varying vec3 vViewPosition;
      varying vec3 vRight;
      varying vec3 vUp;
      varying vec3 vFront;

      void main() {
        vLabelUv = uv;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = viewPosition.xyz;
        vRight = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
        vUp = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
        vFront = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tBackground;
      uniform sampler2D tSceneDepth;
      uniform sampler2D tArtwork;
      uniform vec2 uBufferSize;
      uniform float uPixelRatio;
      uniform vec3 uGlow;
      uniform vec3 uTint;
      uniform float uLabelHeight;
      uniform mat4 projectionMatrix;
      varying vec2 vLabelUv;
      varying vec3 vViewPosition;
      varying vec3 vRight;
      varying vec3 vUp;
      varying vec3 vFront;

      ${glassShape}

      // Derivative of h(t) = (1 - (1 - t)^4)^(1/4).
      float squircleSlope(float t) {
        float u = 1.0 - clamp(t, 0.002, 1.0);
        return u * u * u * pow(max(1.0 - u * u * u * u, 1e-4), -0.75);
      }

      vec2 refractedUv(vec3 incident, vec3 flatNormal, vec3 rimNormal, float ior, float thickness) {
        vec3 ray = refract(incident, rimNormal, 1.0 / ior);
        vec3 flatRay = refract(incident, flatNormal, 1.0 / ior);
        vec2 shift = (ray.xy / max(0.2, -ray.z) - flatRay.xy / max(0.2, -flatRay.z)) * thickness;
        vec4 clip = projectionMatrix * vec4(vViewPosition + vec3(shift, 0.0), 1.0);
        return clip.xy / clip.w * 0.5 + 0.5;
      }

      vec3 sampleBackdrop(vec2 uv, vec2 offset) {
        vec3 center = texture2D(tBackground, uv).rgb;
        vec2 x = vec2(offset.x, 0.0);
        vec2 y = vec2(0.0, offset.y);
        return (center * 4.0
          + texture2D(tBackground, uv - x).rgb + texture2D(tBackground, uv + x).rgb
          + texture2D(tBackground, uv - y).rgb + texture2D(tBackground, uv + y).rgb) / 8.0;
      }

      float softArtworkAlpha(vec2 uv) {
        // Work in label space so the blur follows the printed artwork when orbiting.
        vec2 stepUv = vec2(0.022 / (halfSize.x * 2.0), 0.022);
        float alpha = 0.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            float weight = float((2 - abs(x)) * (2 - abs(y)));
            alpha += weight * texture2D(tArtwork, uv + vec2(float(x), float(y)) * stepUv).a;
          }
        }
        return alpha / 16.0;
      }

      void main() {
        bool rear = !gl_FrontFacing;
        float bezel = rear ? 0.164 : 0.22;
        float thicknessRatio = rear ? 0.235 : 0.36;
        vec2 blurOffset = (rear ? 3.0 : 1.25) * uPixelRatio / uBufferSize;
        vec2 local = (vLabelUv - 0.5) * halfSize * 2.0;
        float distance = sdRoundRect(local);
        float aa = max(fwidth(distance), 0.0005);
        float cssDistance = distance / distancePerCssPixel(distance, uPixelRatio);
        vec2 screenUv = gl_FragCoord.xy / uBufferSize;
        if (distance > aa || gl_FragCoord.z > texture2D(tSceneDepth, screenUv).r + 0.000001) discard;

        vec3 background = texture2D(tBackground, screenUv).rgb;
        vec3 lens = sampleBackdrop(screenUv, blurOffset);
        float fresnel = 0.0;
        float specular = 0.0;
        if (distance > -bezel) {
          vec2 outward = normalize(vec2(
            sdRoundRect(local + vec2(0.001, 0.0)) - sdRoundRect(local - vec2(0.001, 0.0)),
            sdRoundRect(local + vec2(0.0, 0.001)) - sdRoundRect(local - vec2(0.0, 0.001))
          ));
          float slope = (thicknessRatio / bezel) * squircleSlope(-distance / bezel);
          vec3 flatNormal = normalize(rear ? -vFront : vFront);
          vec3 rimNormal = normalize(flatNormal + slope * (outward.x * vRight + outward.y * vUp));
          vec3 incident = normalize(vViewPosition);
          float thickness = uLabelHeight * thicknessRatio;
          lens = vec3(
            sampleBackdrop(refractedUv(incident, flatNormal, rimNormal, 1.47, thickness), blurOffset).r,
            sampleBackdrop(refractedUv(incident, flatNormal, rimNormal, 1.50, thickness), blurOffset).g,
            sampleBackdrop(refractedUv(incident, flatNormal, rimNormal, 1.53, thickness), blurOffset).b
          );
          fresnel = pow(1.0 - dot(flatNormal, rimNormal), 2.0);
          float direction = dot(outward, vec2(-0.707, 0.707));
          specular = fresnel * (0.24 * pow(max(direction, 0.0), 3.0) + 0.08 * pow(max(-direction, 0.0), 3.0));
        }

        float luminance = dot(lens, vec3(0.2126, 0.7152, 0.0722));
        lens = mix(max(mix(vec3(luminance), lens, rear ? 0.9 : 1.25), vec3(0.0)), uTint, rear ? 0.50 : 0.43);
        float inside = 1.0 - smoothstep(-aa, aa, distance);
        float border = rear ? smoothstep(-2.5, -1.5, cssDistance)
          : 1.0 - smoothstep(0.009, 0.019 + aa, abs(distance));
        float glow = (1.0 - smoothstep(0.0, 0.07, abs(distance))) * 0.12;
        vec3 glass = lens + uGlow * (border * (rear ? 0.72 : 0.48) + fresnel * 0.13 + glow) + specular;
        vec4 artwork = rear
          ? vec4(mix(vec3(0.65, 0.78, 0.88), uGlow, 0.22), 0.30 * softArtworkAlpha(vLabelUv))
          : texture2D(tArtwork, vLabelUv);
        gl_FragColor = vec4(mix(background, mix(glass, artwork.rgb, artwork.a), inside), 1.0);
      }
    `,
  })
}

// Add light outside the glass without writing depth or covering other labels.
export function createCubeGlassGlowMaterial(frame: GlassFrame, glow: string) {
  return new ShaderMaterial({
    side: BackSide,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    uniforms: {
      tSceneDepth: frame.tSceneDepth,
      uBufferSize: frame.uBufferSize,
      uPixelRatio: frame.uPixelRatio,
      uGlow: { value: new Color(glow) },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tSceneDepth;
      uniform vec2 uBufferSize;
      uniform float uPixelRatio;
      uniform vec3 uGlow;
      varying vec2 vUv;

      ${glassShape}

      void main() {
        vec2 quadHalfSize = halfSize + ${CUBE_GLASS_GLOW_PADDING};
        vec2 local = (vUv - 0.5) * quadHalfSize * 2.0;
        float distance = sdRoundRect(local);
        float cssDistance = distance / distancePerCssPixel(distance, uPixelRatio);
        vec2 screenUv = gl_FragCoord.xy / uBufferSize;
        if (cssDistance < 0.0 || cssDistance >= 6.0
          || gl_FragCoord.z > texture2D(tSceneDepth, screenUv).r + 0.000001) discard;

        float glow = 1.0 - smoothstep(0.0, 6.0, cssDistance);
        // Fade at the padded geometry boundary when the glass is nearly edge-on.
        vec2 margin = quadHalfSize - abs(local);
        float edge = min(margin.x, margin.y);
        float coverage = smoothstep(0.0, 0.15, edge);
        gl_FragColor = vec4(uGlow, 0.32 * glow * coverage);
      }
    `,
  })
}
