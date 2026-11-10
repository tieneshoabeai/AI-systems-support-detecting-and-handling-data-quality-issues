import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three'
import type { IUniform, Object3D } from 'three'
import { ORBIT_RINGS, ORBIT_Y } from '../../../graphics/holographic-core/orbit.config'

export type DecorConcept = 'star-chart' | 'deep-space' | 'off'
export const DECOR_CONCEPT: DecorConcept = 'star-chart'

// Bán kính (trong không gian NDC theo chiều cao màn hình) mà trang trí mờ dần về 0 quanh tâm khung hình.
const CENTER_CLEAR = 0.5

type Shared = { uTime: IUniform<number>; uClear: IUniform<Vector2> }
type DecorProps = { shared: Shared; reducedMotion: boolean }

const RAD = Math.PI / 180
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

function skyPoint(azimuthDeg: number, elevationDeg: number, radius: number, target = new Vector3()) {
  const azimuth = azimuthDeg * RAD
  const elevation = elevationDeg * RAD
  return target
    .set(Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth))
    .multiplyScalar(radius)
}

// Ghi vào object three.js nằm trong helper thuần, giống các file khác, để rule immutability của react-hooks
// không chặn việc gán trong thân hook.
function spin(object: Object3D, radians: number) {
  object.rotation.y += radians
}

function stepShared(shared: Shared, delta: number) {
  shared.uTime.value += delta
}

function resizeShared(shared: Shared, width: number, height: number) {
  shared.uClear.value.y = width / Math.max(height, 1)
}

function disposeObject(root: Object3D) {
  root.traverse(child => {
    if (child instanceof InstancedMesh) child.dispose()
    if (child instanceof Mesh || child instanceof Points || child instanceof LineSegments) {
      child.geometry.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach(material => material.dispose())
    }
  })
}

// ---------------------------------------------------------------------------------------------------
// Điểm sáng dùng chung (nút chòm sao, bụi vũ trụ). Một draw call; trôi + nhấp nháy tính trong vertex shader.
// Đầu ra là linear thô, giống shader sao ở environment (pipeline đi qua EffectComposer, không có OutputPass).
// ---------------------------------------------------------------------------------------------------
const SPARK_VERTEX = /* glsl */ `
  attribute float size;
  attribute float phase;
  attribute vec3 tint;
  uniform float uTime;
  uniform vec2 uClear;
  uniform float uPixelScale;
  uniform float uDrift;
  uniform vec2 uNear;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 moved = position + uDrift * vec3(
      sin(uTime * 0.21 + phase * 6.2831),
      sin(uTime * 0.17 + phase * 4.1),
      cos(uTime * 0.19 + phase * 5.3));
    vec4 view = modelViewMatrix * vec4(moved, 1.0);
    gl_Position = projectionMatrix * view;
    float twinkle = 0.78 + 0.22 * sin(uTime * (0.6 + phase) + phase * 20.0);
    gl_PointSize = clamp(size * twinkle * (uPixelScale / max(-view.z, 1.0)), 1.0, 16.0);
    vec2 ndc = gl_Position.xy / gl_Position.w;
    float clearing = smoothstep(uClear.x, uClear.x + 0.5, length(ndc * vec2(uClear.y, 1.0)));
    float near = smoothstep(uNear.x, uNear.y, -view.z);
    vColor = tint;
    vAlpha = twinkle * clearing * near;
  }
`

const SPARK_FRAGMENT = /* glsl */ `
  uniform float uFlare;
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float core = 1.0 - smoothstep(0.0, 0.5, d);
    vec2 arms = 1.0 - smoothstep(vec2(0.0), vec2(0.07), abs(c));
    float spikes = uFlare * (arms.x + arms.y) * (1.0 - smoothstep(0.05, 0.5, d));
    float alpha = min(1.0, core * core + spikes * 0.7) * vAlpha * uOpacity;
    gl_FragColor = vec4(vColor, alpha);
  }
`

type Spark = { x: number; y: number; z: number; size: number; phase: number; color: Color }

type SparkOptions = {
  pixelScale: number
  drift: number
  flare: number
  opacity: number
  near: readonly [number, number]
}

function createSparkPoints(
  sparks: readonly Spark[],
  shared: Shared,
  clear: IUniform<Vector2>,
  options: SparkOptions,
  name: string,
) {
  const positions = new Float32Array(sparks.length * 3)
  const sizes = new Float32Array(sparks.length)
  const phases = new Float32Array(sparks.length)
  const tints = new Float32Array(sparks.length * 3)
  sparks.forEach((spark, index) => {
    positions[index * 3] = spark.x
    positions[index * 3 + 1] = spark.y
    positions[index * 3 + 2] = spark.z
    sizes[index] = spark.size
    phases[index] = spark.phase
    tints[index * 3] = spark.color.r
    tints[index * 3 + 1] = spark.color.g
    tints[index * 3 + 2] = spark.color.b
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('size', new BufferAttribute(sizes, 1))
  geometry.setAttribute('phase', new BufferAttribute(phases, 1))
  geometry.setAttribute('tint', new BufferAttribute(tints, 3))
  const material = new ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uClear: clear,
      uPixelScale: { value: options.pixelScale },
      uDrift: { value: options.drift },
      uFlare: { value: options.flare },
      uOpacity: { value: options.opacity },
      uNear: { value: new Vector2(options.near[0], options.near[1]) },
    },
    vertexShader: SPARK_VERTEX,
    fragmentShader: SPARK_FRAGMENT,
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: AdditiveBlending,
  })
  const points = new Points(geometry, material)
  points.name = name
  points.renderOrder = -4
  points.frustumCulled = false
  points.raycast = disableRaycast
  return points
}

function lineSegments(positions: number[], color: string, opacity: number, name: string) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  const material = new LineBasicMaterial({
    color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
  })
  const lines = new LineSegments(geometry, material)
  lines.name = name
  lines.renderOrder = -5
  lines.frustumCulled = false
  lines.raycast = disableRaycast
  return lines
}

// ===================================================================================================
// CONCEPT A — "star-chart": bản đồ sao kỹ thuật. Lưới thiên cầu + chòm sao nối vạch + mặt đồng hồ quỹ đạo.
// Cùng ngôn ngữ linework cyan/tím với phần còn lại của dự án; không có khối lớn nào tranh với core.
// 5 draw call.
// ===================================================================================================
const CONSTELLATIONS = [
  { azimuth: 199, elevation: -12, stars: 6, spread: 8 },
  { azimuth: 249, elevation: -5, stars: 5, spread: 7 },
  { azimuth: 150, elevation: -14, stars: 7, spread: 9 },
  { azimuth: 301, elevation: -12, stars: 6, spread: 8 },
  { azimuth: 95, elevation: 12, stars: 6, spread: 9 },
  { azimuth: 28, elevation: -26, stars: 5, spread: 8 },
] as const

const CELESTIAL_RADIUS = 50

// Lưới: kinh tuyến mỗi 30°, vĩ tuyến mỗi 15°, xích đạo sáng hơn kèm vạch chia độ. Độ sáng mờ dần theo vĩ độ
// bằng màu đỉnh, nên cả lưới chỉ là một LineSegments.
function createCelestialGrid() {
  const positions: number[] = []
  const colors: number[] = []
  const tint = new Color('#4f86e8')
  const a = new Vector3()
  const b = new Vector3()
  const fade = (elevation: number) => 0.25 + 0.75 * Math.exp(-((elevation / 38) ** 2))
  const segment = (az0: number, el0: number, az1: number, el1: number, level: number) => {
    skyPoint(az0, el0, CELESTIAL_RADIUS, a)
    skyPoint(az1, el1, CELESTIAL_RADIUS, b)
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
    const l0 = level * fade(el0)
    const l1 = level * fade(el1)
    colors.push(tint.r * l0, tint.g * l0, tint.b * l0, tint.r * l1, tint.g * l1, tint.b * l1)
  }
  for (let azimuth = 0; azimuth < 360; azimuth += 30) {
    for (let elevation = -75; elevation < 75; elevation += 5) segment(azimuth, elevation, azimuth, elevation + 5, 0.55)
  }
  for (let elevation = -60; elevation <= 60; elevation += 15) {
    if (elevation === 0) continue
    for (let azimuth = 0; azimuth < 360; azimuth += 5) segment(azimuth, elevation, azimuth + 5, elevation, 0.45)
  }
  for (let azimuth = 0; azimuth < 360; azimuth += 3) segment(azimuth, 0, azimuth + 3, 0, 1)
  for (let azimuth = 0; azimuth < 360; azimuth += 5) {
    const major = azimuth % 30 === 0
    const half = major ? 2.4 : 1.1
    segment(azimuth, -half, azimuth, half, major ? 1.2 : 0.8)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  const material = new LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.22, blending: AdditiveBlending,
    depthWrite: false, toneMapped: false, fog: false,
  })
  const grid = new LineSegments(geometry, material)
  grid.name = 'decor-celestial-grid'
  grid.renderOrder = -5
  grid.frustumCulled = false
  grid.raycast = disableRaycast
  return grid
}

// Mỗi chòm sao là một chuỗi nút đi bước ngẫu nhiên có seed, nối bằng vạch chừa khe ở hai đầu và thêm một cạnh
// đóng vòng. Nút là điểm sáng có gai chữ thập; nút đầu của mỗi chòm to hơn.
function createConstellations(shared: Shared) {
  const random = createRandom(4242)
  const radius = CELESTIAL_RADIUS - 3
  const linePositions: number[] = []
  const sparks: Spark[] = []
  const a = new Vector3()
  const b = new Vector3()
  const pale = new Color('#cfeaff')
  const violet = new Color('#b9a6ff')
  for (const constellation of CONSTELLATIONS) {
    const nodes: Array<readonly [number, number]> = []
    let azimuth: number = constellation.azimuth
    let elevation: number = constellation.elevation
    for (let index = 0; index < constellation.stars; index += 1) {
      nodes.push([azimuth, elevation])
      azimuth += (random() - 0.35) * constellation.spread * 1.5
      elevation += (random() - 0.5) * constellation.spread * 1.1
    }
    const edge = (from: number, to: number) => {
      const [az0, el0] = nodes[from]!
      const [az1, el1] = nodes[to]!
      skyPoint(az0, el0, radius, a)
      skyPoint(az1, el1, radius, b)
      const start = a.clone().lerp(b, 0.07)
      const end = a.clone().lerp(b, 0.93)
      linePositions.push(start.x, start.y, start.z, end.x, end.y, end.z)
    }
    for (let index = 1; index < nodes.length; index += 1) edge(index - 1, index)
    if (nodes.length >= 5) edge(1, nodes.length - 2)
    nodes.forEach(([az, el], index) => {
      const point = skyPoint(az, el, radius)
      sparks.push({
        x: point.x, y: point.y, z: point.z,
        size: index === 0 ? 1.8 : 0.6 + random() * 0.6,
        phase: random() * Math.PI * 2,
        color: pale.clone().lerp(violet, random() * 0.6),
      })
    })
  }
  const group = new Group()
  group.name = 'decor-constellations'
  group.renderOrder = -1
  group.add(lineSegments(linePositions, '#6fa8ff', 0.28, 'decor-constellation-lines'))
  group.add(createSparkPoints(
    sparks, shared, { value: new Vector2(-1, 1) },
    { pixelScale: 220, drift: 0, flare: 1, opacity: 0.48, near: [0, 1] },
    'decor-constellation-nodes',
  ))
  return group
}

// Mặt đồng hồ trên ba vòng quỹ đạo có sẵn (vạch chia 2.5°, vạch lớn mỗi 30°) và ba vệ tinh mang đuôi hạt.
// Vạch chia là một LineSegments xoay ngược chiều chậm; vệ tinh là một InstancedMesh, 15 ma trận mỗi frame.
const SATELLITE_SPEEDS = [0.11, -0.075, 0.05] as const
const SATELLITE_TRAIL = 5

function createOrbitDial() {
  const root = new Group()
  root.name = 'decor-orbit-dial'
  root.renderOrder = -1
  root.position.y = ORBIT_Y

  const ticks: number[] = []
  for (const ring of ORBIT_RINGS) {
    for (let index = 0; index < 144; index += 1) {
      const angle = (index / 144) * Math.PI * 2
      const outer = ring.radius - 0.04
      const inner = outer - (index % 12 === 0 ? 0.22 : 0.08)
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      ticks.push(cos * outer, 0, sin * outer, cos * inner, 0, sin * inner)
    }
  }
  const tickLines = lineSegments(ticks, '#a98bff', 0.32, 'decor-orbit-ticks')
  root.add(tickLines)

  const beads = new InstancedMesh(
    new OctahedronGeometry(1, 0),
    new MeshBasicMaterial({
      color: '#bff3ff', transparent: true, opacity: 0.5, blending: AdditiveBlending,
      depthWrite: false, toneMapped: false, fog: false,
    }),
    ORBIT_RINGS.length * SATELLITE_TRAIL,
  )
  beads.name = 'decor-satellites'
  beads.instanceMatrix.setUsage(DynamicDrawUsage)
  beads.frustumCulled = false
  beads.renderOrder = -4
  beads.raycast = disableRaycast
  root.add(beads)

  const matrix = new Matrix4()
  const position = new Vector3()
  const scale = new Vector3()
  const identity = new Quaternion()
  function update(elapsed: number, delta: number) {
    spin(tickLines, -delta * 0.02)
    let index = 0
    ORBIT_RINGS.forEach((ring, ringIndex) => {
      const speed = SATELLITE_SPEEDS[ringIndex] ?? 0.05
      for (let trail = 0; trail < SATELLITE_TRAIL; trail += 1) {
        const angle = elapsed * speed + ringIndex * 2.1 - Math.sign(speed) * trail * 0.035
        position.set(Math.cos(angle) * ring.radius, 0, Math.sin(angle) * ring.radius)
        scale.setScalar(0.085 * (1 - trail * 0.17))
        matrix.compose(position, identity, scale)
        beads.setMatrixAt(index, matrix)
        index += 1
      }
    })
    beads.instanceMatrix.needsUpdate = true
  }
  update(0, 0)
  return { root, update }
}

function StarChartMotion({ shared, sphere, dial }: {
  shared: Shared
  sphere: Group
  dial: ReturnType<typeof createOrbitDial>
}) {
  useFrame((_state, delta) => {
    stepShared(shared, delta)
    spin(sphere, delta * 0.0025)
    dial.update(shared.uTime.value, delta)
  }, -1)
  return null
}

function StarChart({ shared, reducedMotion }: DecorProps) {
  const sphere = useMemo(() => {
    const group = new Group()
    group.name = 'decor-star-chart'
    // Three.js sorts transparent group order before per-object renderOrder.
    group.renderOrder = -1
    // Nghiêng thiên cầu để xích đạo cắt chéo khung hình, cùng nhịp với dải nebula chéo của bầu trời.
    group.rotation.set(-0.23, 0, 0.01)
    group.add(createCelestialGrid(), createConstellations(shared))
    return group
  }, [shared])
  const dial = useMemo(() => createOrbitDial(), [])
  useEffect(() => () => disposeObject(sphere), [sphere])
  useEffect(() => () => disposeObject(dial.root), [dial])
  return <>
    {!reducedMotion && <StarChartMotion shared={shared} sphere={sphere} dial={dial} />}
    <primitive object={sphere} />
    <primitive object={dial.root} />
  </>
}

// ===================================================================================================
// CONCEPT B — "deep-space": không gian sâu kiểu điện ảnh. Hành tinh khí có vành đai ở rìa khung hình, một mặt
// trăng hổ phách (nhắc lại màu cube Detection), vành đai tiểu hành tinh xa phía sau core và bụi vũ trụ có
// thị sai. Nặng hơn A về fragment nhưng vẫn chỉ 4 draw call.
// ===================================================================================================
type PlanetSpec = {
  name: string
  azimuth: number
  elevation: number
  distance: number
  size: number
  ring: number
  tilt: number
  bandFreq: number
  bandA: string
  bandB: string
  atmos: string
  ringColor: string
  light: readonly [number, number, number]
  gain: number
}

const PLANETS: readonly PlanetSpec[] = [
  {
    name: 'gas-giant', azimuth: 203, elevation: -12, distance: 52, size: 14, ring: 1, tilt: -0.38, bandFreq: 13,
    bandA: '#3b2a78', bandB: '#1f78a8', atmos: '#7fd8ff', ringColor: '#a99bff', light: [0.7, 0.55, 0.45], gain: 1.3,
  },
  {
    name: 'amber-moon', azimuth: 254, elevation: -34, distance: 48, size: 5, ring: 0, tilt: 0, bandFreq: 5,
    bandA: '#6a3f22', bandB: '#e0904a', atmos: '#ffb36b', ringColor: '#ffffff', light: [-0.6, 0.5, 0.6], gain: 1.2,
  },
]

// Quad billboard trong vertex shader; toàn bộ hành tinh (thân có dải mây, viền khí quyển, vành đai nghiêng với khe
// Cassini, phần vành đai trước/sau thân) là toán học thuần trong fragment shader, không texture.
const PLANET_VERTEX = /* glsl */ `
  uniform float uSize;
  varying vec2 vP;
  void main() {
    vP = position.xy * 2.0;
    vec4 view = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    view.xy += position.xy * uSize;
    gl_Position = projectionMatrix * view;
  }
`

const PLANET_FRAGMENT = /* glsl */ `
  uniform vec3 uBandA;
  uniform vec3 uBandB;
  uniform vec3 uAtmos;
  uniform vec3 uRingColor;
  uniform vec3 uLight;
  uniform float uBandFreq;
  uniform float uRing;
  uniform float uTilt;
  uniform float uGain;
  varying vec2 vP;
  void main() {
    const float R = 0.4;
    float d = length(vP);
    float body = smoothstep(R, R - 0.015, d);
    vec3 n = vec3(vP / R, 0.0);
    n.z = sqrt(max(1.0 - dot(n.xy, n.xy), 0.0));
    float lit = pow(clamp(dot(n, uLight) * 0.5 + 0.5, 0.0, 1.0), 1.6);
    float band = 0.5 + 0.5 * sin(n.y * uBandFreq + sin(n.y * 4.0 + n.x * 2.5) * 1.4);
    vec3 planet = mix(uBandA, uBandB, band) * (0.1 + 0.9 * lit);
    planet += uAtmos * pow(1.0 - n.z, 3.0) * (0.2 + 0.8 * lit);
    planet *= uGain;

    float c = cos(uTilt);
    float s = sin(uTilt);
    vec2 q = vec2(c * vP.x + s * vP.y, -s * vP.x + c * vP.y);
    float ringR = length(vec2(q.x, q.y / 0.27));
    float ringBand = smoothstep(0.55, 0.57, ringR) * smoothstep(0.97, 0.93, ringR);
    float groove = 1.0 - 0.85 * smoothstep(0.012, 0.0, abs(ringR - 0.77));
    float stripes = 0.55 + 0.25 * sin(ringR * 90.0) + 0.2 * sin(ringR * 37.0);
    float ringAlpha = uRing * ringBand * groove * stripes * 0.75;
    vec3 ringCol = uRingColor * uGain;

    // Premultiplied: vành sau nằm dưới thân, vành trước nằm trên thân.
    vec4 acc = vec4(planet * body, body);
    float back = q.y >= 0.0 ? ringAlpha : 0.0;
    acc += vec4(ringCol * back, back) * (1.0 - acc.a);
    float front = q.y < 0.0 ? ringAlpha : 0.0;
    acc = vec4(ringCol * front, front) + acc * (1.0 - front);
    if (acc.a < 0.004) discard;
    gl_FragColor = vec4(acc.rgb / acc.a, acc.a);
  }
`

function createPlanet(spec: PlanetSpec) {
  const material = new ShaderMaterial({
    uniforms: {
      uSize: { value: spec.size },
      uBandA: { value: new Color(spec.bandA) },
      uBandB: { value: new Color(spec.bandB) },
      uAtmos: { value: new Color(spec.atmos) },
      uRingColor: { value: new Color(spec.ringColor) },
      uLight: { value: new Vector3(...spec.light).normalize() },
      uBandFreq: { value: spec.bandFreq },
      uRing: { value: spec.ring },
      uTilt: { value: spec.tilt },
      uGain: { value: spec.gain },
    },
    vertexShader: PLANET_VERTEX,
    fragmentShader: PLANET_FRAGMENT,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new Mesh(new PlaneGeometry(1, 1), material)
  skyPoint(spec.azimuth, spec.elevation, spec.distance, mesh.position)
  mesh.name = `decor-${spec.name}`
  mesh.renderOrder = -3
  mesh.frustumCulled = false
  mesh.raycast = disableRaycast
  return mesh
}

// Đá được tô sáng bằng một đèn giả trong shader (không dính vào point light của scene) và tự mờ về 0 khi chiếu
// vào vùng giữa màn hình. Vị trí tĩnh; cả group xoay chậm.
const ROCK_VERTEX = /* glsl */ `
  uniform vec2 uClear;
  varying vec3 vNormal;
  varying float vFade;
  varying float vSeed;
  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    vNormal = normalize(mat3(m) * normal);
    vSeed = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    vec4 clip = projectionMatrix * viewMatrix * (m * vec4(position, 1.0));
    gl_Position = clip;
    vec2 ndc = clip.xy / clip.w;
    vFade = smoothstep(uClear.x, uClear.x + 0.5, length(ndc * vec2(uClear.y, 1.0)));
  }
`

const ROCK_FRAGMENT = /* glsl */ `
  uniform vec3 uLight;
  uniform vec3 uBase;
  uniform vec3 uFill;
  varying vec3 vNormal;
  varying float vFade;
  varying float vSeed;
  void main() {
    vec3 n = normalize(vNormal);
    float key = max(dot(n, uLight), 0.0);
    float fill = max(-n.y, 0.0);
    vec3 color = uBase * (0.1 + 0.9 * key) * (0.75 + 0.5 * vSeed) + uFill * fill * 0.22;
    gl_FragColor = vec4(color, 0.92 * vFade);
  }
`

const BELT_COUNT = 140
const DUST_COUNT = 420

function createAsteroidBelt(shared: Shared) {
  const random = createRandom(7311)
  const material = new ShaderMaterial({
    uniforms: {
      uClear: shared.uClear,
      uLight: { value: new Vector3(0.5, 0.7, 0.4).normalize() },
      uBase: { value: new Color('#6d5fb8') },
      uFill: { value: new Color('#1fb8d8') },
    },
    vertexShader: ROCK_VERTEX,
    fragmentShader: ROCK_FRAGMENT,
    transparent: true,
    depthWrite: false,
  })
  const belt = new InstancedMesh(new IcosahedronGeometry(1, 0), material, BELT_COUNT)
  belt.name = 'decor-asteroid-belt'
  belt.frustumCulled = false
  belt.renderOrder = -2
  belt.raycast = disableRaycast
  const matrix = new Matrix4()
  const position = new Vector3()
  const scale = new Vector3()
  const quaternion = new Quaternion()
  const euler = new Euler()
  for (let index = 0; index < BELT_COUNT; index += 1) {
    // Hai cung đá dày hơn, phần còn lại thưa, để vành đai không đều như một cái vòng.
    let angle: number
    do angle = random() * Math.PI * 2
    while (random() > 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(angle * 2 + 1)))
    const radius = 28 + Math.pow(random(), 1.4) * 14
    position.set(Math.cos(angle) * radius, -1.5 + (random() - 0.5) * 7, Math.sin(angle) * radius)
    const base = 0.12 + Math.pow(random(), 3) * 0.55
    scale.set(base * (0.7 + random() * 0.6), base * (0.6 + random() * 0.5), base * (0.7 + random() * 0.6))
    quaternion.setFromEuler(euler.set(random() * 6.283, random() * 6.283, random() * 6.283))
    matrix.compose(position, quaternion, scale)
    belt.setMatrixAt(index, matrix)
  }
  belt.instanceMatrix.needsUpdate = true
  return belt
}

function createDust(shared: Shared) {
  const random = createRandom(9001)
  const tints = ['#8f7bff', '#5fdcff', '#cfe6ff'].map(hex => new Color(hex))
  const sparks: Spark[] = []
  for (let index = 0; index < DUST_COUNT; index += 1) {
    const angle = random() * Math.PI * 2
    const radius = 8 + random() * 26
    sparks.push({
      x: Math.cos(angle) * radius,
      y: -6 + random() * 20,
      z: Math.sin(angle) * radius,
      size: 1.2 + random() * 2.6,
      phase: random() * Math.PI * 2,
      color: tints[Math.floor(random() * tints.length)]!.clone().multiplyScalar(0.5 + random() * 0.5),
    })
  }
  return createSparkPoints(
    sparks, shared, shared.uClear,
    { pixelScale: 38, drift: 0.4, flare: 0, opacity: 0.55, near: [4, 11] },
    'decor-dust',
  )
}

function DeepSpace({ shared, reducedMotion }: DecorProps) {
  const scene = useMemo(() => {
    const root = new Group()
    root.name = 'decor-deep-space'
    const belt = new Group()
    belt.name = 'decor-belt-pivot'
    belt.add(createAsteroidBelt(shared))
    root.add(...PLANETS.map(createPlanet), belt, createDust(shared))
    return { root, belt }
  }, [shared])
  useEffect(() => () => disposeObject(scene.root), [scene])
  // Hành tinh đứng yên theo khung hình; chỉ vành đai đá xoay.
  useFrame((_state, delta) => {
    if (!reducedMotion) {
      stepShared(shared, delta)
      spin(scene.belt, delta * 0.004)
    }
  }, -1)
  return <primitive object={scene.root} />
}

const DECOR_COMPONENTS = { 'star-chart': StarChart, 'deep-space': DeepSpace, off: null }

export function HolographicDecor({ reducedMotion }: { reducedMotion: boolean }) {
  const { width, height } = useThree(state => state.size)
  const shared = useMemo<Shared>(() => ({
    uTime: { value: 0 },
    uClear: { value: new Vector2(CENTER_CLEAR, 16 / 9) },
  }), [])
  useEffect(() => resizeShared(shared, width, height), [shared, width, height])
  const Concept = DECOR_COMPONENTS[DECOR_CONCEPT]
  return Concept && <Concept shared={shared} reducedMotion={reducedMotion} />
}
