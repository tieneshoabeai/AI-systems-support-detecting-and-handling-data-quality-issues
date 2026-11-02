import * as THREE from 'three'
import type { InboundPath } from './inbound-stream-paths'

export type InboundStreaks = {
  meshes: THREE.Mesh[]
  update(elapsedSeconds: number): void
  reset(): void
}

const STREAKS_PER_LANE = 6
const TUBES_PER_STREAK = 3
const STATIONS = 12
const RINGS = STATIONS + 1
const RADIAL = 6
const VERTICES_PER_LANE = STREAKS_PER_LANE * TUBES_PER_STREAK * RINGS * RADIAL
const INDICES_PER_LANE = STREAKS_PER_LANE * TUBES_PER_STREAK * STATIONS * RADIAL * 6

const STREAK_LENGTH_RATIO = 0.0825
const ABSORB_MIN_LENGTH = 0.2
// A lane-wide shift desynchronises the six lanes from each other; the small per-streak term only
// roughens the train inside one lane, keeping its gaps open.
const LANE_PHASE_JITTER = 0.035
const STREAK_PHASE_JITTER = 0.008

const BODY_EXPONENT = 1.35
const HEAD_EXPONENT = 12
const BODY_LUMA = 0.3
const HEAD_LUMA = 0.8
const HEAD_WHITE = 0.25
const WISP_RADIUS_SCALE = 0.3
const WISP_SPLIT_START = 0.15

const SPAWN_FADE = 0.06
const ABSORB_START = 0.86
const ABSORB_END = 0.995
const VANISH_START = 0.9
const VANISH_END = 1
const STATIC_PHASE_OFFSET = 0.1

type GrainClass = {
  headRadius: number
  tailRadius: number
  spread: number
  brightness: number
  visibleWisps: number
  bodyColor: readonly [number, number, number]
  headColor: readonly [number, number, number]
}

// Six grain sizes, each with a fixed colour. Colours are normalised to the same body/head
// luminance so hue, not brightness, is what distinguishes the classes.
const GRAIN_DEFINITIONS = [
  { headRadius: 0.01, tailRadius: 0.002, spread: 0.01, brightness: 0.78, visibleWisps: 1, hex: '#22d3ee' },
  { headRadius: 0.013, tailRadius: 0.0026, spread: 0.013, brightness: 0.84, visibleWisps: 1, hex: '#38bdf8' },
  { headRadius: 0.016, tailRadius: 0.0032, spread: 0.016, brightness: 0.9, visibleWisps: 1, hex: '#818cf8' },
  { headRadius: 0.021, tailRadius: 0.0038, spread: 0.02, brightness: 0.94, visibleWisps: 2, hex: '#a78bfa' },
  { headRadius: 0.026, tailRadius: 0.0045, spread: 0.024, brightness: 0.98, visibleWisps: 2, hex: '#e879f9' },
  { headRadius: 0.032, tailRadius: 0.0052, spread: 0.028, brightness: 1.02, visibleWisps: 2, hex: '#fb7185' },
] as const

const GRAIN_CLASSES: readonly GrainClass[] = GRAIN_DEFINITIONS.map(definition => {
  const hue = new THREE.Color(definition.hex)
  const luma = 0.2126 * hue.r + 0.7152 * hue.g + 0.0722 * hue.b
  return {
    headRadius: definition.headRadius,
    tailRadius: definition.tailRadius,
    spread: definition.spread,
    brightness: definition.brightness,
    visibleWisps: definition.visibleWisps,
    bodyColor: [hue.r * (BODY_LUMA / luma), hue.g * (BODY_LUMA / luma), hue.b * (BODY_LUMA / luma)],
    headColor: [
      hue.r * (HEAD_LUMA / luma) + HEAD_WHITE,
      hue.g * (HEAD_LUMA / luma) + HEAD_WHITE,
      hue.b * (HEAD_LUMA / luma) + HEAD_WHITE,
    ],
  }
})

const RING_COS = new Float32Array(RADIAL)
const RING_SIN = new Float32Array(RADIAL)
for (let ring = 0; ring < RADIAL; ring++) {
  const angle = (ring / RADIAL) * Math.PI * 2
  RING_COS[ring] = Math.cos(angle)
  RING_SIN[ring] = Math.sin(angle)
}

const samplePosition = new THREE.Vector3()
const sampleTangent = new THREE.Vector3()

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function fract(value: number) {
  return ((value % 1) + 1) % 1
}

function hash01(a: number, b: number) {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return value - Math.floor(value)
}

type StreakProfile = {
  jitter: number
  bodyColor: readonly [number, number, number]
  headColor: readonly [number, number, number]
  visibleWisps: number
  headRadius: number
  tailRadius: number
  spread: number
  brightness: number
}

type Lane = {
  path: InboundPath
  mesh: THREE.Mesh
  positions: Float32Array
  colors: Float32Array
  positionAttribute: THREE.BufferAttribute
  colorAttribute: THREE.BufferAttribute
  sideX: number
  sideZ: number
  profiles: StreakProfile[]
}

function createStreakProfiles(laneIndex: number): StreakProfile[] {
  const profiles: StreakProfile[] = []
  const lanePhase = (hash01(laneIndex + 17, 3) - 0.5) * 2 * LANE_PHASE_JITTER
  for (let streak = 0; streak < STREAKS_PER_LANE; streak++) {
    const classIndex = Math.min(
      GRAIN_CLASSES.length - 1,
      Math.floor(hash01(laneIndex + 1, streak + 1) * GRAIN_CLASSES.length),
    )
    const grain = GRAIN_CLASSES[classIndex]
    profiles.push({
      jitter: lanePhase + (hash01(laneIndex + 31, streak + 7) - 0.5) * 2 * STREAK_PHASE_JITTER,
      bodyColor: grain.bodyColor,
      headColor: grain.headColor,
      visibleWisps: grain.visibleWisps,
      headRadius: grain.headRadius,
      tailRadius: grain.tailRadius,
      spread: grain.spread,
      brightness: grain.brightness,
    })
  }
  return profiles
}

function buildIndices() {
  const indices = new Uint16Array(INDICES_PER_LANE)
  let cursor = 0
  for (let streak = 0; streak < STREAKS_PER_LANE; streak++) {
    for (let tube = 0; tube < TUBES_PER_STREAK; tube++) {
      const tubeOffset = (streak * TUBES_PER_STREAK + tube) * RINGS * RADIAL
      for (let station = 0; station < STATIONS; station++) {
        const stationOffset = tubeOffset + station * RADIAL
        for (let radial = 0; radial < RADIAL; radial++) {
          const nextRadial = (radial + 1) % RADIAL
          const lower = stationOffset + radial
          const lowerNext = stationOffset + nextRadial
          const upper = lower + RADIAL
          const upperNext = lowerNext + RADIAL
          indices[cursor++] = lower
          indices[cursor++] = upper
          indices[cursor++] = lowerNext
          indices[cursor++] = lowerNext
          indices[cursor++] = upper
          indices[cursor++] = upperNext
        }
      }
    }
  }
  return indices
}

function writeLane(lane: Lane, elapsedSeconds: number | null) {
  const { path, positions, colors, profiles } = lane
  const cycle = path.definition.cycleSeconds
  const baseLength = path.length * STREAK_LENGTH_RATIO
  for (let streak = 0; streak < STREAKS_PER_LANE; streak++) {
    const profile = profiles[streak]
    const headT = elapsedSeconds === null
      ? fract(streak / STREAKS_PER_LANE + STATIC_PHASE_OFFSET + profile.jitter)
      : fract(elapsedSeconds / cycle + streak / STREAKS_PER_LANE + profile.jitter)
    const absorb = smoothstep(ABSORB_START, ABSORB_END, headT)
    const visibleLength = baseLength * (1 - (1 - ABSORB_MIN_LENGTH) * absorb)
    const headDistance = headT * path.length
    const tailDistance = Math.max(0, headDistance - visibleLength)
    const brightness = smoothstep(0, SPAWN_FADE, headT)
      * (1 - smoothstep(VANISH_START, VANISH_END, headT))
      * profile.brightness
    const streakOffset = streak * TUBES_PER_STREAK * RINGS * RADIAL

    for (let tube = 0; tube < TUBES_PER_STREAK; tube++) {
      const visible = tube <= profile.visibleWisps
      const tubeOffset = (streakOffset + tube * RINGS * RADIAL) * 3
      for (let station = 0; station <= STATIONS; station++) {
        const profileT = station / STATIONS
        path.sampleAt(tailDistance + (headDistance - tailDistance) * profileT, samplePosition, sampleTangent)

        const mainRadius = profile.tailRadius
          + (profile.headRadius - profile.tailRadius) * Math.pow(profileT, 1.2)
        const radius = tube === 0 ? mainRadius : mainRadius * WISP_RADIUS_SCALE
        // Wisps hug the bright head and peel off toward the dim tail, so the front stays a single
        // point of light while the trail frays into two or three filaments.
        const lateral = tube === 0
          ? 0
          : (tube === 1 ? 1 : -1) * profile.spread * smoothstep(WISP_SPLIT_START, 1, 1 - profileT)

        // The path is planar, so a constant plane normal gives a stable cross-section with no twist.
        const upX = sampleTangent.y * lane.sideZ
        const upY = sampleTangent.z * lane.sideX - sampleTangent.x * lane.sideZ
        const upZ = -sampleTangent.y * lane.sideX

        const body = Math.pow(profileT, BODY_EXPONENT) * brightness
        const head = Math.pow(profileT, HEAD_EXPONENT) * brightness
        const red = visible ? profile.bodyColor[0] * body + profile.headColor[0] * head : 0
        const green = visible ? profile.bodyColor[1] * body + profile.headColor[1] * head : 0
        const blue = visible ? profile.bodyColor[2] * body + profile.headColor[2] * head : 0

        const centerX = samplePosition.x + lateral * lane.sideX
        const centerZ = samplePosition.z + lateral * lane.sideZ
        const vertexOffset = tubeOffset + station * RADIAL * 3
        for (let ring = 0; ring < RADIAL; ring++) {
          const offset = vertexOffset + ring * 3
          const ringCos = RING_COS[ring]
          const ringSin = RING_SIN[ring]
          positions[offset] = centerX + radius * (ringCos * lane.sideX + ringSin * upX)
          positions[offset + 1] = samplePosition.y + radius * ringSin * upY
          positions[offset + 2] = centerZ + radius * (ringCos * lane.sideZ + ringSin * upZ)
          colors[offset] = red
          colors[offset + 1] = green
          colors[offset + 2] = blue
        }
      }
    }
  }

  lane.positionAttribute.needsUpdate = true
  lane.colorAttribute.needsUpdate = true
}

function createLane(path: InboundPath, material: THREE.MeshBasicMaterial, laneIndex: number): Lane {
  const positions = new Float32Array(VERTICES_PER_LANE * 3)
  const colors = new Float32Array(VERTICES_PER_LANE * 3)
  const positionAttribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)
  const colorAttribute = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', positionAttribute)
  geometry.setAttribute('color', colorAttribute)
  geometry.setIndex(new THREE.BufferAttribute(buildIndices(), 1))

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'inbound-stream-streaks'
  mesh.userData.pathId = path.id
  mesh.frustumCulled = false
  mesh.renderOrder = 7

  return {
    path,
    mesh,
    positions,
    colors,
    positionAttribute,
    colorAttribute,
    sideX: -Math.sin(path.azimuthRadians),
    sideZ: Math.cos(path.azimuthRadians),
    profiles: createStreakProfiles(laneIndex),
  }
}

function createStreakMaterial() {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    // 24 additive lanes overlap near the landing ring; at full opacity the bundle saturates into a
    // solid beam. Scaling the contribution keeps individual dashes and their gaps readable.
    opacity: 0.36,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  })
}

export function createInboundStreaks(paths: readonly InboundPath[]): InboundStreaks {
  const material = createStreakMaterial()
  const lanes = paths.map((path, index) => createLane(path, material, index))

  return {
    meshes: lanes.map(lane => lane.mesh),
    update(elapsedSeconds) {
      for (const lane of lanes) writeLane(lane, elapsedSeconds)
    },
    reset() {
      for (const lane of lanes) writeLane(lane, null)
    },
  }
}
