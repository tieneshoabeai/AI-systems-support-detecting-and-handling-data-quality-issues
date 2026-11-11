import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Camera,
  CanvasTexture,
  Color,
  CylinderGeometry,
  FrontSide,
  EdgesGeometry,
  Euler,
  Group,
  HalfFloatType,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineSegments,
  LinearFilter,
  MathUtils,
  Matrix4,
  Mesh,
  NormalBlending,
  OctahedronGeometry,
  PlaneGeometry,
  Points,
  Quaternion,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  StaticDrawUsage,
  Vector3,
  WebGLCubeRenderTarget,
  WebGLRenderTarget,
} from 'three'
import type { Texture, WebGLRenderer } from 'three'
import { ORBIT_RINGS, ORBIT_Y } from '../../../graphics/holographic-core/orbit.config'
import { NEON_CUBE_CLUSTER_LAYOUT } from '../../../graphics/neon-cube/neon-cube.cluster'

// Deep-field nebula: an equirect sky baked on the GPU once, real star Points above it, a
// rim-fading floor halo and three orbit rings. The sky stays dimmer than the subject and under
// the bloom threshold (1.0); only hero stars and the meteor may bloom.
const STAR_COUNT = 1480
const HERO_STAR_COUNT = 20
const STAR_RADIUS = 55

const disableRaycast = () => {}

function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const SKY_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// The palette is mixed in sRGB (as the CPU bake did) and lifted to linear at the end: the low
// opacities here only read as deep navy on top of the base when mixed in sRGB. Shared by the sky
// bake, the aurora and the drifting dust so additive layers never wash out to grey.
const TO_LINEAR_GLSL = /* glsl */ `
  vec3 toLinear(vec3 srgb) {
    return mix(srgb / 12.92, pow((srgb + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), srgb));
  }
`

// Optional space-crack streaks baked into the sky. The riskiest aesthetic piece; flip to false to
// drop them without touching the rest of the shader.
const CRACKS = true

// Painted once into an equirect render target by one fragment pass (about a millisecond of GPU,
// nothing on the main thread). A CPU bake at 2048x1024 cost tens of milliseconds and blocked the
// first frames. This is the CPU bake's structure ported to the GPU: broad celadon gas over a
// navy field, a diagonal belt of brighter dust, and only a soft, wide contrast ramp so the gas
// stays gas instead of turning into veins.
let NEBULA_FRAGMENT = /* glsl */ `
  varying vec2 vUv;

  float hash(vec2 p) {
    vec2 hashed = fract(p * vec2(0.1031, 0.1030));
    hashed += dot(hashed, hashed.yx + 33.33);
    return fract((hashed.x + hashed.y) * hashed.x);
  }

  // Value noise on a lattice periodic every "cellsX" cells in x and "cellsY" in y, so the
  // longitude seam at u = 0 stays invisible.
  float valueNoise(vec2 p, vec2 cells) {
    vec2 base = floor(p);
    vec2 f = fract(p);
    vec2 s = f * f * (3.0 - 2.0 * f);
    vec2 corner = mod(base, cells);
    float a = hash(corner);
    float b = hash(mod(corner + vec2(1.0, 0.0), cells));
    float c = hash(mod(corner + vec2(0.0, 1.0), cells));
    float d = hash(mod(corner + vec2(1.0, 1.0), cells));
    return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
  }

  void main() {
    float u = vUv.x;
    float v = vUv.y;
    float latitude = (0.5 - v) * 3.1415926;
    float phase = (u - 0.17) * 6.2831853;
    // Diagonal belt: latitude drifts +-tilt*9° along longitude, crossing the sky as a tilted ring.
    float beltLatitude = 0.5236 + 0.6021 * sin(phase) * 0.1571;
    float belt = exp(-pow((latitude - beltLatitude) / 0.3491, 2.0));
    float halo = exp(-pow((latitude - beltLatitude) / 0.5934, 2.0));
    // Default camera looks down ~30°, so much of the frame samples the lower third of the map.
    float lower = exp(-pow((v - 0.7) / 0.18, 2.0));
    float wipe = 0.45 + 0.55 * cos(phase - 3.1415926);
    float equator = exp(-pow(latitude / 0.9599, 2.0));

    vec3 color = mix(vec3(2.0, 6.0, 15.0), vec3(6.0, 18.0, 52.0), equator) / 255.0;

    // Palette as sRGB; each layer is a broad glow plus its own noise cloud.
    const vec3 NAVY = vec3(11.0, 42.0, 107.0) / 255.0;
    const vec3 VIOLET = vec3(107.0, 70.0, 224.0) / 255.0;
    const vec3 CYAN = vec3(31.0, 184.0, 216.0) / 255.0;
    vec3 tints[3];
    tints[0] = NAVY; tints[1] = VIOLET; tints[2] = CYAN;
    float opacities[3];
    opacities[0] = 0.38; opacities[1] = 0.14; opacities[2] = 0.18;
    float gains[3];
    gains[0] = 1.6; gains[1] = 1.2; gains[2] = 1.7;
    vec2 cells[3];
    cells[0] = vec2(4.0, 3.0); cells[1] = vec2(9.0, 6.0); cells[2] = vec2(11.0, 7.0);

    for (int layer = 0; layer < 3; layer++) {
      vec2 grain = cells[layer];
      float glow = (halo * wipe * 0.55 + lower * 0.22) * opacities[layer] * gains[layer] * 0.55;
      color = mix(color, tints[layer], clamp(glow, 0.0, 1.0));
      float coarse = valueNoise(vec2(u, v) * grain, grain);
      vec2 fine = grain * 3.0;
      float detail = valueNoise(vec2(u, v) * fine + 0.37, fine);
      float cloud = clamp((coarse * 0.7 + detail * 0.3 - 0.44) * 2.8, 0.0, 1.0);
      float density = cloud * opacities[layer] * (0.15 + belt * wipe * gains[layer] + lower * 0.5);
      color = mix(color, tints[layer], clamp(density, 0.0, 1.0));
    }

    // Horizon glow: a thin band hugging latitude 0, tinted between violet and cyan along
    // longitude and pressed a little brighter behind-right to sit under the aurora arc.
    float band = exp(-pow(latitude / 0.12, 2.0));
    vec3 bandHue = mix(VIOLET, CYAN, 0.5 + 0.5 * sin(phase * 1.0 + 1.2));
    color = mix(color, bandHue, clamp(band * 0.07 * (0.6 + 0.4 * wipe), 0.0, 0.07));

    ${CRACKS ? /* glsl */ `
    // Space cracks: at most three thin streaks, each locked to a narrow latitude band in the
    // upper sky and off to the sides, well away from the lower region the default camera reads.
    for (int c = 0; c < 3; c++) {
      float k = float(c);
      float line = abs(fract(u * (7.0 + k * 5.0) + sin(v * (5.0 + k * 3.0)) * 0.15) - 0.5);
      float crack = smoothstep(0.012, 0.0, line);
      float vCenter = 0.68 + 0.12 * k;
      float region = exp(-pow((v - vCenter) / 0.08, 2.0));
      color = mix(color, vec3(177.0, 140.0, 255.0) / 255.0, clamp(crack * region * 0.1, 0.0, 0.1));
    }
    ` : ''}

    gl_FragColor = vec4(toLinear(color), 1.0);
  }
`

NEBULA_FRAGMENT = NEBULA_FRAGMENT.replace('void main() {', `${TO_LINEAR_GLSL}\n  void main() {`)

const SKY_TEXTURE_WIDTH = 1024
const SKY_TEXTURE_HEIGHT = 512

// three renders only cube textures as a sky that follows the camera; an equirect texture is
// drawn as a flat screen-space image. The painted map is converted to a cubemap once at mount.
function createSkyCubeTarget(gl: WebGLRenderer) {
  // HalfFloat so the pass writes linear light directly (no tone map, no sRGB encode); the cube
  // background shader then applies the renderer's tone map and colour space exactly once.
  const target = new WebGLRenderTarget(SKY_TEXTURE_WIDTH, SKY_TEXTURE_HEIGHT, {
    type: HalfFloatType,
    wrapS: RepeatWrapping,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: false,
  })
  const material = new ShaderMaterial({
    uniforms: {},
    vertexShader: SKY_VERTEX,
    fragmentShader: NEBULA_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  })
  const quad = new Mesh(new PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  const paintScene = new Scene()
  paintScene.add(quad)
  const previousTarget = gl.getRenderTarget()
  gl.setRenderTarget(target)
  gl.render(paintScene, new Camera())
  gl.setRenderTarget(previousTarget)
  quad.geometry.dispose()
  material.dispose()

  const cube = new WebGLCubeRenderTarget(1024)
  cube.fromEquirectangularTexture(gl, target.texture)
  cube.texture.colorSpace = SRGBColorSpace
  target.dispose()
  return cube
}

function Backdrop({ texture }: { texture: Texture }) {
  const scene = useThree(state => state.scene)
  useEffect(() => {
    setSceneBackground(scene, texture)
    return () => setSceneBackground(scene, null)
  }, [scene, texture])
  return null
}

function setSceneBackground(scene: Scene, texture: Texture | null) {
  scene.background = texture
}

const STAR_VERTEX = /* glsl */ `
  attribute float size;
  attribute float amp;
  attribute float phase;
  attribute vec3 tint;
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    float twinkle = 0.82 + 0.18 * sin(uTime * (0.7 + amp * 0.5) + phase);
    gl_Position = projectionMatrix * view;
    gl_PointSize = max(1.0, size * twinkle * (220.0 / max(-view.z, 1.0)));
    vColor = tint * amp;
    vAlpha = 0.55 + 0.45 * twinkle;
  }
`

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, core * core * vAlpha);
    // Same tone map and transfer as the background pass; these includes define functions and
    // must stay outside main(), or the shader fails to compile and the stars silently vanish.
    vec4 texel = gl_FragColor;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    gl_FragColor = texel;
  }
`

type StarField = {
  points: Points
  step(elapsed: number, delta: number, drift: number): void
  dispose(): void
}

// One draw call for every star. Hero stars carry a higher `amp` so a handful of pixels
// cross the 1.0 bloom threshold while the rest of the sky stays under it.
function createStarField(seed: number): StarField {
  const random = createRandom(seed)
  const count = STAR_COUNT + HERO_STAR_COUNT
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const amps = new Float32Array(count)
  const phases = new Float32Array(count)
  const tints = new Float32Array(count * 3)
  const pale = new Color('#cfefff')
  const violet = new Color('#c9b8ff')
  const tint = new Color()
  for (let index = 0; index < count; index += 1) {
    const hero = index >= STAR_COUNT
    const theta = random() * Math.PI * 2
    const y = hero ? 0.1 + random() * 0.85 : -0.3 + random() * 1.3
    const ring = Math.sqrt(Math.max(0, 1 - y * y))
    positions[index * 3] = Math.cos(theta) * ring * STAR_RADIUS
    positions[index * 3 + 1] = y * STAR_RADIUS
    positions[index * 3 + 2] = Math.sin(theta) * ring * STAR_RADIUS
    sizes[index] = hero ? 1.5 + random() * 1.1 : 0.4 + random() * 0.8
    amps[index] = hero ? 1.7 + random() * 0.6 : 0.3 + random() * 0.4
    phases[index] = random() * Math.PI * 2
    tint.copy(pale).lerp(violet, random() * 0.65)
    tints[index * 3] = tint.r
    tints[index * 3 + 1] = tint.g
    tints[index * 3 + 2] = tint.b
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('size', new BufferAttribute(sizes, 1))
  geometry.setAttribute('amp', new BufferAttribute(amps, 1))
  geometry.setAttribute('phase', new BufferAttribute(phases, 1))
  geometry.setAttribute('tint', new BufferAttribute(tints, 3))
  const uniforms = { uTime: { value: 0 } }
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  const points = new Points(geometry, material)
  points.name = 'nebula-stars'
  points.renderOrder = -4
  points.frustumCulled = false
  points.raycast = disableRaycast
  return {
    points,
    // `drift` is 0 under reduced motion, which also freezes the twinkle and the rotation.
    step(elapsed, delta, drift) {
      uniforms.uTime.value = elapsed
      points.rotation.y += delta * drift
    },
    dispose() { geometry.dispose(); material.dispose() },
  }
}

// One draw call for every star. The drift spins the shell slowly; the twinkle lives in the shader.
function NebulaSky({ reducedMotion }: { reducedMotion: boolean }) {
  const field = useMemo(() => createStarField(1997), [])
  useEffect(() => () => field.dispose(), [field])
  useFrame(({ clock }, delta) => {
    // Reduced motion keeps a very slow drift but freezes the twinkle.
    field.step(clock.elapsedTime, delta, reducedMotion ? 0.0006 : 0.004)
  }, -1)
  return <primitive object={field.points} />
}

const BACK_AZIMUTH = Math.PI * 5 / 4

const AURORA_VERTEX = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vAngle;
  void main() {
    vUv = uv;
    vAngle = uv.x * 6.2831853;
    vec3 displaced = position;
    vec2 radial = normalize(position.xz);
    float shift = 0.8 * sin(vAngle * 3.0 + uTime * 0.08 + position.y * 0.35)
      + 0.4 * sin(vAngle * 7.0 - uTime * 0.05);
    displaced.xz += radial * shift * smoothstep(0.0, 0.5, uv.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`

const AURORA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vAngle;

  ${TO_LINEAR_GLSL}

  float curtain(float x, float base, float seed) {
    float h = vUv.y - base;
    float rise = max(h, 0.0);
    float fold = sin(13.0 * x + seed + uTime * 0.03);
    float phase = x * 103.0 + 2.4 * fold + rise * (4.0 + 2.0 * fold);
    float rays = smoothstep(0.08, 0.94, 0.5 + 0.32 * sin(phase) + 0.18 * sin(phase * 1.67));
    float lip = exp(-rise * 70.0);
    float veil = exp(-rise * mix(20.0, 8.0, rays));
    return smoothstep(-0.014, 0.006, h) * (0.36 * lip + (0.16 + 0.6 * rays) * veil);
  }

  void main() {
    // Positive x points right in the default camera view.
    float x = mod(${BACK_AZIMUTH} - vAngle + 3.1415926, 6.2831853) - 3.1415926;
    float arc = 1.0 - smoothstep(0.68, 1.12, abs(x));
    if (arc <= 0.0) discard;
    float drift = 0.015 * sin(uTime * 0.045);
    float bend = x + drift;
    float mainBase = 0.26 + 0.40 * smoothstep(0.04, 0.58, bend) + 0.04 * sin(9.0 * bend);
    float violetBase = 0.49 - 0.22 * smoothstep(-0.48, -0.25, x - drift)
      + 0.08 * sin(6.0 * x + drift);
    float cyan = curtain(x, mainBase, 0.0) * 0.48;
    float violet = curtain(x, violetBase, 2.3) * 0.42
      * (1.0 - smoothstep(0.08, 0.52, x));
    float wispBase = 0.14 + 0.12 * sin(5.0 * bend - 1.0);
    float wisp = 0.12 * curtain(x, wispBase, 4.7) * smoothstep(0.18, 0.52, sin(8.0 * x - 1.1));
    float total = cyan + violet + wisp;
    vec3 color = (cyan * toLinear(vec3(0.12, 0.76, 0.94))
      + violet * toLinear(vec3(0.64, 0.38, 1.0))
      + wisp * toLinear(vec3(0.31, 0.46, 0.86))) / max(total, 0.001);
    gl_FragColor = vec4(color, arc * min(total, 0.50) * (1.0 - smoothstep(0.84, 1.0, vUv.y)));
    vec4 texel = gl_FragColor;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    gl_FragColor = texel;
  }
`

type AuroraCurtainField = {
  mesh: Mesh
  step(elapsed: number): void
  dispose(): void
}

// A single open cylinder behind the tower, seen from inside, with the arc and curtain folds
// computed in the shader. One draw call; the sway and shimmer live entirely on the GPU.
function createAuroraCurtain(): AuroraCurtainField {
  const geometry = new CylinderGeometry(30, 30, 12, 96, 12, true)
  const uniforms = { uTime: { value: 0 } }
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: AURORA_VERTEX,
    fragmentShader: AURORA_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: BackSide,
    blending: AdditiveBlending,
    toneMapped: false,
    fog: false,
  })
  const mesh = new Mesh(geometry, material)
  // Frame both upper folds and lower wisps behind the skyline at the review pose.
  mesh.position.y = 0
  mesh.renderOrder = -3
  mesh.frustumCulled = false
  mesh.raycast = disableRaycast
  return {
    mesh,
    step(elapsed) { uniforms.uTime.value = elapsed },
    dispose() { geometry.dispose(); material.dispose() },
  }
}

function AuroraCurtain({ reducedMotion }: { reducedMotion: boolean }) {
  const curtain = useMemo(() => createAuroraCurtain(), [])
  useEffect(() => () => curtain.dispose(), [curtain])
  useFrame(({ clock }) => {
    // Reduced motion freezes the shimmer at a fixed phase rather than toggling the layer.
    curtain.step(reducedMotion ? 12 : clock.elapsedTime)
  }, -1)
  return <primitive object={curtain.mesh} />
}

// One radial spill that fades to black at the rim, so the model floats without a horizon line.
function createGroundTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas is unavailable for the holographic ground')
  const center = size / 2
  const glow = context.createRadialGradient(center, center, 0, center, center, center)
  glow.addColorStop(0, 'rgba(70, 60, 190, 0.30)')
  glow.addColorStop(0.35, 'rgba(48, 40, 140, 0.15)')
  glow.addColorStop(0.68, 'rgba(14, 18, 70, 0.05)')
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, size, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function GroundGlow({ texture }: { texture: Texture }) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} renderOrder={0} raycast={disableRaycast}>
    <circleGeometry args={[12, 72]} />
    <meshBasicMaterial map={texture} transparent opacity={1} blending={AdditiveBlending}
      depthWrite={false} toneMapped={false} fog={false} />
  </mesh>
}

function OrbitRings({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<Group>(null)
  useFrame((_state, delta) => {
    if (reducedMotion || !group.current) return
    group.current.children.forEach((child, index) => {
      child.rotation.z += delta * ORBIT_RINGS[index]!.speed
    })
  })
  return <group ref={group}>
    {ORBIT_RINGS.map(ring => <mesh key={ring.radius} position={[0, ORBIT_Y, 0]}
      rotation={[Math.PI / 2, 0, 0]} renderOrder={1} raycast={disableRaycast}>
      <torusGeometry args={[ring.radius, 0.012, 6, 160]} />
      <meshBasicMaterial color={ring.color} transparent opacity={ring.opacity}
        blending={AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
    </mesh>)}
  </group>
}

// Faint constellation linking the satellite cubes. The amber edge to the orange (Detection)
// cube is the only warm line and the brightest of the set.
function CubeConstellation() {
  const geometries = useMemo(() => {
    const [violet, cyan, blue, orange] = NEON_CUBE_CLUSTER_LAYOUT.map(node => node.position)
    const cool: number[] = []
    const warm: number[] = []
    const edge = (from: readonly number[], to: readonly number[], target: number[]) => target.push(...from, ...to)
    edge(violet!, blue!, cool)
    edge(blue!, cyan!, cool)
    edge(cyan!, violet!, cool)
    edge(blue!, orange!, cool)
    edge(orange!, cyan!, warm)
    const coolGeometry = new BufferGeometry()
    coolGeometry.setAttribute('position', new BufferAttribute(new Float32Array(cool), 3))
    const warmGeometry = new BufferGeometry()
    warmGeometry.setAttribute('position', new BufferAttribute(new Float32Array(warm), 3))
    return [coolGeometry, warmGeometry] as const
  }, [])
  useEffect(() => () => geometries.forEach(geometry => geometry.dispose()), [geometries])
  return <group raycast={disableRaycast}>
    <lineSegments geometry={geometries[0]} raycast={disableRaycast}>
      <lineBasicMaterial color="#7be9ff" transparent opacity={0.07} blending={AdditiveBlending}
        depthWrite={false} toneMapped={false} fog={false} />
    </lineSegments>
    <lineSegments geometry={geometries[1]} raycast={disableRaycast}>
      <lineBasicMaterial color="#ff9a3c" transparent opacity={0.22} blending={AdditiveBlending}
        depthWrite={false} toneMapped={false} fog={false} />
    </lineSegments>
  </group>
}

const CRYSTAL_COUNT = 10
const CRYSTAL_FLANK_DEG = [42, 110] as const // lệch khỏi hướng sau core, chia đều trái/phải

const CRYSTAL_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    // Pháp tuyến đúng cho scale không đều: R·S⁻¹·n.
    vec3 s = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    vNormal = normalize(mat3(modelMatrix) * (mat3(instanceMatrix) * (normal / (s * s))));
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vViewDir = cameraPosition - worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const CRYSTAL_FRAGMENT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  ${TO_LINEAR_GLSL}

  void main() {
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 3.0);
    vec3 core = vec3(6.0, 16.0, 44.0) / 255.0;
    vec3 rim = mix(vec3(107.0, 70.0, 224.0) / 255.0, vec3(31.0, 184.0, 216.0) / 255.0, smoothstep(0.3, 1.0, fresnel));
    vec3 color = mix(core, rim, fresnel) * 0.75;
    gl_FragColor = vec4(toLinear(color), mix(0.04, 0.3, fresnel));
    vec4 texel = gl_FragColor;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    gl_FragColor = texel;
  }
`

type CrystalField = {
  group: Group
  step(delta: number): void
  dispose(): void
}

// 10 tinh thể xa ở hai cánh phía sau. Vị trí dựng một lần, 2 draw call (thân + viền).
function createCrystalField(seed: number): CrystalField {
  const random = createRandom(seed)
  const geometry = new OctahedronGeometry(1, 0)
  const material = new ShaderMaterial({
    vertexShader: CRYSTAL_VERTEX,
    fragmentShader: CRYSTAL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    blending: NormalBlending,
    toneMapped: false,
    fog: false,
  })
  const mesh = new InstancedMesh(geometry, material, CRYSTAL_COUNT)
  mesh.renderOrder = -3
  mesh.frustumCulled = false
  mesh.raycast = disableRaycast
  mesh.instanceMatrix.setUsage(StaticDrawUsage)

  const matrices: Matrix4[] = []
  const matrix = new Matrix4()
  const position = new Vector3()
  const scale = new Vector3()
  const quaternion = new Quaternion()
  const euler = new Euler()
  for (let index = 0; index < CRYSTAL_COUNT; index += 1) {
    const side = index % 2 === 0 ? -1 : 1
    const theta = BACK_AZIMUTH + side * MathUtils.degToRad(MathUtils.lerp(CRYSTAL_FLANK_DEG[0], CRYSTAL_FLANK_DEG[1], random()))
    const radius = MathUtils.lerp(18, 28, random())
    position.set(Math.cos(theta) * radius, 0.5 + random() * 8.5, Math.sin(theta) * radius)
    const width = 0.3 + random() * 0.35
    scale.set(width, 1.1 + random() * 1.3, width)
    euler.set(random() * 0.3 - 0.15, random() * Math.PI * 2, random() * 0.3 - 0.15)
    quaternion.setFromEuler(euler)
    matrix.compose(position, quaternion, scale)
    mesh.setMatrixAt(index, matrix)
    matrices.push(matrix.clone())
  }
  mesh.instanceMatrix.needsUpdate = true

  const edges = new EdgesGeometry(geometry, 1)
  const edgePositions: number[] = []
  const edgeAttribute = edges.getAttribute('position')
  const vertex = new Vector3()
  for (const instanceMatrix of matrices) {
    for (let i = 0; i < edgeAttribute.count; i += 1) {
      vertex.fromBufferAttribute(edgeAttribute, i).applyMatrix4(instanceMatrix)
      edgePositions.push(vertex.x, vertex.y, vertex.z)
    }
  }
  edges.dispose()
  const edgeGeometry = new BufferGeometry()
  edgeGeometry.setAttribute('position', new BufferAttribute(new Float32Array(edgePositions), 3))
  const edgeMaterial = new LineBasicMaterial({
    color: '#8a5bff', transparent: true, opacity: 0.12, blending: AdditiveBlending,
    depthWrite: false, toneMapped: false, fog: false,
  })
  const edgesLine = new LineSegments(edgeGeometry, edgeMaterial)
  edgesLine.renderOrder = -2
  edgesLine.frustumCulled = false
  edgesLine.raycast = disableRaycast

  const group = new Group()
  group.add(mesh)
  group.add(edgesLine)
  let elapsed = 0
  return {
    group,
    // Chỉ lắc ±4° quanh vị trí gốc: tinh thể không bao giờ trôi sang phía camera.
    step(delta) {
      elapsed += delta
      group.rotation.y = Math.sin(elapsed * 0.04) * MathUtils.degToRad(4)
    },
    dispose() {
      geometry.dispose(); material.dispose(); edgeGeometry.dispose(); edgeMaterial.dispose()
    },
  }
}

function CrystalField({ reducedMotion }: { reducedMotion: boolean }) {
  const field = useMemo(() => createCrystalField(2026), [])
  useEffect(() => () => field.dispose(), [field])
  useFrame((_state, delta) => {
    if (!reducedMotion) field.step(delta)
  }, -1)
  return <primitive object={field.group} />
}

const METEOR_WAIT_SECONDS = [15, 25] as const
const METEOR_FLIGHT_SECONDS = 0.85
const METEOR_TRAIL = 7

type MeteorTrail = {
  line: Line
  update(camera: Camera, elapsed: number, delta: number): void
  dispose(): void
}

function createMeteorTrail(): MeteorTrail {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(6), 3))
  const material = new LineBasicMaterial({
    color: '#d8f6ff', transparent: true, opacity: 0, blending: AdditiveBlending,
    depthWrite: false, toneMapped: false, fog: false,
  })
  const line = new Line(geometry, material)
  line.name = 'meteor-trail'
  line.renderOrder = 2
  line.frustumCulled = false
  line.raycast = disableRaycast
  const state = { next: 6, progress: -1, from: [0, 0, 0], to: [0, 0, 0] }

  function update(camera: Camera, elapsed: number, delta: number) {
    if (state.progress < 0 && elapsed >= state.next) {
      const azimuth = Math.random() * Math.PI * 2
      const elevation = MathUtils.lerp(0.35, 0.75, Math.random())
      const distance = 38
      const start = [
        camera.position.x + Math.cos(azimuth) * Math.cos(elevation) * distance,
        Math.max(6, camera.position.y + Math.sin(elevation) * distance),
        camera.position.z + Math.sin(azimuth) * Math.cos(elevation) * distance,
      ]
      const heading = azimuth + Math.PI * 0.5 + (Math.random() - 0.5) * 0.6
      state.from = start
      state.to = [start[0] + Math.cos(heading) * METEOR_TRAIL, start[1] - METEOR_TRAIL * 0.35, start[2] + Math.sin(heading) * METEOR_TRAIL]
      state.progress = 0
    }
    if (state.progress < 0) return
    state.progress += delta / METEOR_FLIGHT_SECONDS
    const t = state.progress
    if (t >= 1) {
      state.progress = -1
      state.next = elapsed + MathUtils.lerp(METEOR_WAIT_SECONDS[0], METEOR_WAIT_SECONDS[1], Math.random())
      material.opacity = 0
      return
    }
    const attribute = geometry.getAttribute('position') as BufferAttribute
    const tail = Math.max(0, t - 0.14)
    attribute.setXYZ(0,
      MathUtils.lerp(state.from[0]!, state.to[0]!, t),
      MathUtils.lerp(state.from[1]!, state.to[1]!, t),
      MathUtils.lerp(state.from[2]!, state.to[2]!, t))
    attribute.setXYZ(1,
      MathUtils.lerp(state.from[0]!, state.to[0]!, tail),
      MathUtils.lerp(state.from[1]!, state.to[1]!, tail),
      MathUtils.lerp(state.from[2]!, state.to[2]!, tail))
    attribute.needsUpdate = true
    material.opacity = Math.sin(Math.PI * Math.min(1, t * 1.2)) * 0.85
  }

  return {
    line,
    update,
    dispose() { geometry.dispose(); material.dispose() },
  }
}

// A shooting star every 15–25 s on a dome above the camera so it never crosses the model.
// Unmounted entirely under reduced motion.
function Meteor() {
  const trail = useMemo(() => createMeteorTrail(), [])
  useEffect(() => () => trail.dispose(), [trail])
  useFrame(({ camera, clock }, delta) => trail.update(camera, clock.elapsedTime, delta))
  return <primitive object={trail.line} />
}

const DUST_COUNT = 160

const DUST_VERTEX = /* glsl */ `
  attribute float size;
  attribute float phase;
  attribute vec3 tint;
  attribute float amp;
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 pos = position;
    float travel = fract(phase / 6.2831853 + uTime * 0.012 * (0.6 + amp));
    pos.y = position.y + travel * 6.0;
    pos.x += sin(uTime * 0.2 + phase) * 0.25;
    pos.z += cos(uTime * 0.17 + phase) * 0.25;
    vec4 view = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp(size * 55.0 / max(-view.z, 1.0), 1.5, 4.5);
    vColor = tint;
    vAlpha = sin(travel * 3.14159) * (0.6 + 0.4 * sin(uTime * 0.5 + phase));
  }
`

const DUST_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float core = 1.0 - smoothstep(0.05, 0.5, d);
    gl_FragColor = vec4(vColor, core * core * vAlpha * 0.45);
    vec4 texel = gl_FragColor;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    gl_FragColor = texel;
  }
`

type LightDustField = {
  points: Points
  step(elapsed: number): void
  dispose(): void
}

// A slow drift of luminous motes around the base. One draw call; the rise, sway and fade all run
// in the vertex shader off a single uTime uniform.
function createLightDust(seed: number): LightDustField {
  const random = createRandom(seed)
  const positions = new Float32Array(DUST_COUNT * 3)
  const sizes = new Float32Array(DUST_COUNT)
  const phases = new Float32Array(DUST_COUNT)
  const tints = new Float32Array(DUST_COUNT * 3)
  const amps = new Float32Array(DUST_COUNT)
  const violet = new Color('#b18cff')
  const cyan = new Color('#7be9ff')
  const tint = new Color()
  for (let index = 0; index < DUST_COUNT; index += 1) {
    const radius = Math.sqrt(MathUtils.lerp(64, 324, random()))
    const theta = BACK_AZIMUTH + MathUtils.degToRad((random() * 2 - 1) * 100)
    positions[index * 3] = Math.cos(theta) * radius
    positions[index * 3 + 1] = random() * 8
    positions[index * 3 + 2] = Math.sin(theta) * radius
    sizes[index] = 0.6 + random() * 0.8
    phases[index] = random() * Math.PI * 2
    tint.copy(violet).lerp(cyan, random())
    tints[index * 3] = tint.r
    tints[index * 3 + 1] = tint.g
    tints[index * 3 + 2] = tint.b
    amps[index] = 0.25 + random() * 0.2
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('size', new BufferAttribute(sizes, 1))
  geometry.setAttribute('phase', new BufferAttribute(phases, 1))
  geometry.setAttribute('tint', new BufferAttribute(tints, 3))
  geometry.setAttribute('amp', new BufferAttribute(amps, 1))
  const uniforms = { uTime: { value: 0 } }
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: DUST_VERTEX,
    fragmentShader: DUST_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    fog: false,
  })
  const points = new Points(geometry, material)
  points.renderOrder = -1
  points.frustumCulled = false
  points.raycast = disableRaycast
  return {
    points,
    step(elapsed) { uniforms.uTime.value = elapsed },
    dispose() { geometry.dispose(); material.dispose() },
  }
}

function LightDust({ reducedMotion }: { reducedMotion: boolean }) {
  const field = useMemo(() => createLightDust(77), [])
  useEffect(() => () => field.dispose(), [field])
  useFrame(({ clock }) => {
    field.step(reducedMotion ? 12 : clock.elapsedTime)
  }, -1)
  return <primitive object={field.points} />
}

function createSkyDrift(backgroundRotation: Euler) {
  return {
    step(delta: number, reducedMotion: boolean) {
      backgroundRotation.y += delta * (reducedMotion ? 0.0012 : 0.004)
    },
  }
}

function LightEnvironment() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 512
    const context = canvas.getContext('2d')!
    const gradient = context.createLinearGradient(0, 0, 0, 512)
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(0.55, '#edf5fc')
    gradient.addColorStop(1, '#dce9f5')
    context.fillStyle = gradient
    context.fillRect(0, 0, 32, 512)
    const result = new CanvasTexture(canvas)
    result.colorSpace = SRGBColorSpace
    return result
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return <>
    <Backdrop texture={texture} />
    <mesh rotation-x={-Math.PI / 2} position-y={-0.08}>
      <planeGeometry args={[160, 160]} />
      <meshBasicMaterial color="#eff5fb" toneMapped={false} />
    </mesh>
    <gridHelper args={[100, 100, '#a1b9cf', '#c2d3e3']} position-y={-0.06} />
  </>
}

export function HolographicEnvironment({ reducedMotion, colorMode = 'dark' }: { reducedMotion: boolean; colorMode?: 'light' | 'dark' }) {
  return colorMode === 'light' ? <LightEnvironment /> : <DarkEnvironment reducedMotion={reducedMotion} />
}

function DarkEnvironment({ reducedMotion }: { reducedMotion: boolean }) {
  const gl = useThree(state => state.gl)
  const scene = useThree(state => state.scene)
  const sky = useMemo(() => createSkyCubeTarget(gl), [gl])
  const drift = useMemo(() => createSkyDrift(scene.backgroundRotation), [scene])
  const ground = useMemo(() => createGroundTexture(), [])
  useEffect(() => () => {
    sky.dispose()
    ground.dispose()
  }, [ground, sky])
  useFrame((_state, delta) => drift.step(delta, reducedMotion), -1)
  return <>
    <Backdrop texture={sky.texture} />
    <NebulaSky reducedMotion={reducedMotion} />
    <AuroraCurtain reducedMotion={reducedMotion} />
    <CrystalField reducedMotion={reducedMotion} />
    <LightDust reducedMotion={reducedMotion} />
    <GroundGlow texture={ground} />
    <OrbitRings reducedMotion={reducedMotion} />
    <CubeConstellation />
    {!reducedMotion && <Meteor />}
  </>
}
