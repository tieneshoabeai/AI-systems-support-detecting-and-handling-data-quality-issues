import { Color, MeshPhysicalMaterial, ShaderMaterial, Vector2, Vector4 } from 'three'
import { authGlassConfig } from './auth-glass.config'

const { slab, glass } = authGlassConfig

export function createAuthBackdropMaterial() {
  return new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      tPageBackdrop: { value: null },
      uPageBackdropUv: { value: new Vector4(0, 0, 1, 1) },
      uPageBackdropBase: { value: new Color('#02040c') },
      uHasPageBackdrop: { value: false },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.999, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tPageBackdrop;
      uniform vec4 uPageBackdropUv;
      uniform vec3 uPageBackdropBase;
      uniform bool uHasPageBackdrop;
      float orb(vec2 p, vec2 center, vec2 scale) {
        vec2 delta = (p - center) * scale;
        return exp(-dot(delta, delta));
      }
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      void main() {
        vec2 uv = vUv;
        vec3 color = vec3(0.0010, 0.0017, 0.0042);
        color += vec3(0.005, 0.019, 0.071) * orb(uv, vec2(0.29, 0.46), vec2(4.1, 3.0));
        color += vec3(0.003, 0.031, 0.049) * orb(uv, vec2(0.75, 0.68), vec2(5.6, 4.5));
        color += vec3(0.026, 0.006, 0.067) * orb(uv, vec2(0.24, 0.20), vec2(5.8, 4.3));
        vec2 grid = uv * vec2(80.0, 84.0);
        vec2 cell = floor(grid);
        vec2 center = vec2(hash(cell), hash(cell + 32.0)) * 0.55 + 0.225;
        float particle = (1.0 - smoothstep(0.035, 0.11, length(fract(grid) - center)));
        color += vec3(0.027, 0.053, 0.083) * particle * step(0.965, hash(cell + 9.0));
        if (uHasPageBackdrop) {
          vec4 backdrop = texture2D(tPageBackdrop, uPageBackdropUv.xy + uv * uPageBackdropUv.zw);
          color = mix(uPageBackdropBase, backdrop.rgb, backdrop.a);
        }
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}

export function createAuthLensMaterial() {
  return new ShaderMaterial({
    toneMapped: false,
    uniforms: {
      tBackdrop: { value: null },
      uViewport: { value: new Vector2(1, 1) },
      uUvPerPixel: { value: new Vector2(1, 1) },
      uLightDir: { value: new Vector2(-0.6, 0.8) },
      uHalfSize: { value: new Vector2(slab.width / 2, slab.height / 2) },
      uCorner: { value: slab.cornerRadius },
      uLensWidth: { value: glass.lensWidth },
      uThickness: { value: glass.thicknessPixels },
      uIor: { value: glass.ior },
      uBlurPixels: { value: glass.blurPixels },
      uChroma: { value: glass.chroma },
      uSaturation: { value: glass.saturation },
      uTint: { value: glass.tint },
      uDebug: { value: 0 },
      uRim: { value: glass.rimIntensity },
    },
    vertexShader: `
      varying vec3 vLocal;
      varying vec3 vLocalNormal;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      varying vec3 vAxisX;
      varying vec3 vAxisY;
      void main() {
        vLocal = position;
        vLocalNormal = normal;
        vViewNormal = normalMatrix * normal;
        vAxisX = modelViewMatrix[0].xyz;
        vAxisY = modelViewMatrix[1].xyz;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D tBackdrop;
      uniform vec2 uViewport;
      uniform vec2 uUvPerPixel;
      uniform vec2 uLightDir;
      uniform vec2 uHalfSize;
      uniform float uCorner;
      uniform float uLensWidth;
      uniform float uThickness;
      uniform float uIor;
      uniform float uBlurPixels;
      uniform float uChroma;
      uniform float uSaturation;
      uniform float uTint;
      uniform int uDebug;
      uniform float uRim;
      uniform mat4 projectionMatrix;
      varying vec3 vLocal;
      varying vec3 vLocalNormal;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      varying vec3 vAxisX;
      varying vec3 vAxisY;

      float roundedDistance(vec2 p) {
        vec2 q = abs(p) - uHalfSize + uCorner;
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - uCorner;
      }

      float refractedRayX(vec3 lensNormal, float ior) {
        return refract(vec3(0.0, 0.0, -1.0), lensNormal, 1.0 / ior).x;
      }

      vec3 diskBlur(vec2 uv, vec2 redOffset, vec2 blueOffset, bool splitChannels) {
        if (uBlurPixels <= 0.0) {
          vec3 color = texture2D(tBackdrop, uv).rgb;
          if (splitChannels) {
            color.r = texture2D(tBackdrop, uv + redOffset).r;
            color.b = texture2D(tBackdrop, uv + blueOffset).b;
          }
          return color;
        }
        vec3 color = vec3(0.0);
        vec2 radiusUv = uBlurPixels * uUvPerPixel;
        for (int i = 0; i < 16; i++) {
          float tap = float(i);
          float angle = tap * 2.39996323;
          vec2 sampleUv = uv + vec2(cos(angle), sin(angle)) * sqrt((tap + 0.5) / 16.0) * radiusUv;
          vec3 sampleColor = texture2D(tBackdrop, sampleUv).rgb;
          if (splitChannels) {
            sampleColor.r = texture2D(tBackdrop, sampleUv + redOffset).r;
            sampleColor.b = texture2D(tBackdrop, sampleUv + blueOffset).b;
          }
          color += sampleColor;
        }
        return color / 16.0;
      }

      void main() {
        vec2 p = vLocal.xy - vec2(0.0, uHalfSize.y);
        float d = roundedDistance(p);
        float inset = max(-d, 0.0);
        float profile = 1.0 - clamp(inset / uLensWidth, 0.0, 1.0);
        // Follow the round corner at the rim, then blend neighboring edge
        // directions inside the slab where the nearest edge switches abruptly.
        float normalReach = max(uCorner, inset + 0.08);
        vec2 gradient = sign(p) * max(abs(p) - uHalfSize + normalReach, 0.0);
        vec2 direction = gradient / max(length(gradient), 0.00001);
        vec3 outward = direction.x * vAxisX + direction.y * vAxisY;
        float fresnel = pow(1.0 - abs(dot(normalize(vViewNormal), normalize(vViewPosition))), 3.0);
        float face = abs(normalize(vLocalNormal).z);
        float side = 1.0 - face;
        bool rear = vLocalNormal.z < -0.35;
        vec2 uv = gl_FragCoord.xy / uViewport;
        // Project the edge direction through the panel's perspective camera.
        vec4 outwardClip = projectionMatrix * vec4(outward, 0.0);
        float clipW = (projectionMatrix * vec4(vViewPosition, 1.0)).w;
        vec2 uvPerWorld = 0.5 * (outwardClip.xy - (2.0 * uv - 1.0) * outwardClip.w) / clipW;
        vec2 pixelsPerWorld = uvPerWorld / uUvPerPixel;
        float projectedScale = length(pixelsPerWorld);
        vec2 edgeDirection = pixelsPerWorld / max(projectedScale, 0.0001);

        // Regularize the circular slope at the outer rim and ease into the flat center.
        float slope = smoothstep(0.0, 0.15, profile) * profile / sqrt(1.0 - 0.75 * profile * profile);
        vec3 lensNormal = normalize(vec3(slope, 0.0, 1.0));
        // Bound ray travel relative to the projected bezel to avoid folded samples.
        float thickness = min(uThickness, 0.7 * uLensWidth * projectedScale);
        vec2 travel = edgeDirection * thickness * uUvPerPixel;
        float greenRay = refractedRayX(lensNormal, uIor);
        vec2 offset = travel * greenRay;
        float chroma = rear ? 0.0 : uChroma * smoothstep(0.08, 0.25, profile);
        bool splitChannels = chroma > 0.0 && thickness > 0.0;

        if (uDebug != 0) {
          vec3 diagnostic = vec3(clamp(0.5 - d / uLensWidth, 0.0, 1.0));
          if (uDebug == 2) diagnostic = normalize(vec3(edgeDirection * slope, 1.0)) * 0.5 + 0.5;
          if (uDebug == 3) diagnostic = vec3(0.5 + 0.5 * offset / uUvPerPixel / max(uThickness, 1.0), 0.5);
          gl_FragColor = vec4(diagnostic, 1.0);
          return;
        }

        vec2 redOffset = vec2(0.0);
        vec2 blueOffset = vec2(0.0);
        if (splitChannels) {
          redOffset = travel * (refractedRayX(lensNormal, uIor - chroma) - greenRay);
          blueOffset = travel * (refractedRayX(lensNormal, uIor + chroma) - greenRay);
        }
        // The render target clamps out-of-range samples to its edge.
        vec3 background = diskBlur(uv + offset, redOffset, blueOffset, splitChannels);

        if (rear) {
          background = mix(background, vec3(0.031, 0.046, 0.074), 0.43);
        } else {
          float luminance = dot(background, vec3(0.2126, 0.7152, 0.0722));
          background = mix(max(mix(vec3(luminance), background, uSaturation), vec3(0.0)), vec3(1.0), uTint);
        }

        vec2 light = normalize(uLightDir);
        float facing = dot(edgeDirection, light);
        float specular = pow(profile, 3.0) * (0.15 + 0.5 * abs(facing));
        // The vertical wall sits at the SDF contour for its entire thickness.
        // Limit the white rim there so it doesn't fill that whole wall.
        specular *= mix(0.18, 1.0, smoothstep(0.0, 0.8, face));
        float thinEdge = 1.0 - smoothstep(0.006, 0.022, inset);
        float innerRim = smoothstep(0.018, 0.038, inset) * (1.0 - smoothstep(0.04, 0.068, inset));
        float glint = pow(profile, 4.0) * fresnel;
        vec3 brand = mix(vec3(0.35, 0.14, 0.84), vec3(0.12, 0.65, 0.92), clamp(0.5 + p.y * 0.23, 0.0, 1.0));
        vec3 color = background + uRim * (
          vec3(0.92, 0.97, 1.0) * specular * (thinEdge * 0.66 + innerRim * 0.18 + glint * 0.24) +
          brand * (thinEdge * 0.09 + side * 0.17 + glint * 0.09)
        );
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}

export function createAuthFallbackMaterial() {
  return new MeshPhysicalMaterial({
    color: '#f5faff',
    transmission: 0.96,
    roughness: 0.18,
    ior: 1.4,
    thickness: slab.depth,
    clearcoat: 1,
    dispersion: 0,
  })
}
