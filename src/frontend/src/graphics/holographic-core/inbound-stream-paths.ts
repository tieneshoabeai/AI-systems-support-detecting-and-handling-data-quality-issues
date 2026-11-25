import { requireDefined } from '../../utils/required-value'
import * as THREE from 'three'

export type InboundPathDefinition = {
  id: string
  groupId: string
  offsetDegrees: number
  azimuthDegrees: number
  startRadius: number
  startHeight: number
  landingRadius: number
  cycleSeconds: number
}

export type InboundPath = {
  id: string
  definition: InboundPathDefinition
  azimuthRadians: number
  length: number
  /** Arc-length uniform 3D samples, LUT_SAMPLES points. */
  points: Float32Array
  tangents: Float32Array
  sampleAt(s: number, position: THREE.Vector3, tangent: THREE.Vector3): void
}

const PARSE_SAMPLES = 1024
const LUT_SAMPLES = 256

const START_RADIUS = 1.45
const START_HEIGHT = 3
// Lanes land on a ring instead of the exact centre so the cap hotspot is not fed by 24 converging
// streaks.
const LANDING_RADIUS = 0.22
const ZIGZAG_AMPLITUDE = 0.075
const ZIGZAG_CYCLES = 5
const ZIGZAG_CORNER_SHARPNESS = 0.85
const ZIGZAG_PEAK = Math.asin(ZIGZAG_CORNER_SHARPNESS)
// Adjacent lanes sit 2 degrees apart and differ by 0.3 s per cycle, so their streaks drift in
// and out of phase instead of running as a rigid train.
const CYCLE_STEP_SECONDS_PER_DEGREE = 0.15

const LANE_GROUPS = [
  { groupId: 'azimuth-0', azimuthDegrees: 0, baseCycleSeconds: 7.35 },
  { groupId: 'azimuth-90', azimuthDegrees: 90, baseCycleSeconds: 6.15 },
  { groupId: 'azimuth-180', azimuthDegrees: 180, baseCycleSeconds: 7.35 },
  { groupId: 'azimuth-270', azimuthDegrees: 270, baseCycleSeconds: 6.15 },
] as const

const LANE_OFFSETS = [-5, -3, -1, 1, 3, 5] as const

function definePath(group: typeof LANE_GROUPS[number], offset: number): InboundPathDefinition {
  return {
    id: `${group.groupId}@${offset > 0 ? '+' : ''}${offset}`,
    groupId: group.groupId,
    offsetDegrees: offset,
    azimuthDegrees: group.azimuthDegrees + offset,
    startRadius: START_RADIUS,
    startHeight: START_HEIGHT,
    landingRadius: LANDING_RADIUS,
    cycleSeconds: group.baseCycleSeconds + offset * CYCLE_STEP_SECONDS_PER_DEGREE,
  }
}

const STREAM_DEFINITIONS = LANE_GROUPS.flatMap(group =>
  LANE_OFFSETS.map(offset => definePath(group, offset)),
)

const bezierPoint = { re: 0, im: 0 }

// Both coordinates of every control point decrease monotonically, so the sampled radius and height
// never reverse: the path cannot loop or dip through the cap on its way to the centre.
function evaluateBezier(definition: InboundPathDefinition, t: number) {
  const inverse = 1 - t
  const b0 = inverse * inverse * inverse
  const b1 = 3 * inverse * inverse * t
  const b2 = 3 * inverse * t * t
  const b3 = t * t * t
  const span = definition.startRadius - definition.landingRadius
  const control1Radius = definition.startRadius - span * 0.55
  const control1Height = definition.startHeight * 0.9
  const control2Radius = definition.landingRadius + Math.max(0.004, span * 0.008)
  const control2Height = Math.max(0.24, definition.startHeight * 0.62)
  bezierPoint.re = b0 * definition.startRadius + b1 * control1Radius + b2 * control2Radius + b3 * definition.landingRadius
  bezierPoint.im = b0 * definition.startHeight + b1 * control1Height + b2 * control2Height
  return bezierPoint
}

function buildPath(definition: InboundPathDefinition): InboundPath {
  const azimuthRadians = THREE.MathUtils.degToRad(definition.azimuthDegrees)

  const raw = new Float32Array((PARSE_SAMPLES + 1) * 3)
  for (let index = 0; index <= PARSE_SAMPLES; index++) {
    const t = index / PARSE_SAMPLES
    const point = evaluateBezier(definition, t)
    // A rounded triangle wave alternates sideways without sharp corners in the streak tubes.
    // The envelope brings the wave back to the lane heading at the start and landing ring.
    const phase = t * Math.PI * 2 * ZIGZAG_CYCLES
    const wave = Math.asin(ZIGZAG_CORNER_SHARPNESS * Math.sin(phase)) / ZIGZAG_PEAK
    const lateralDistance = ZIGZAG_AMPLITUDE * Math.sin(Math.PI * t) * wave
    const heading = azimuthRadians + lateralDistance / point.re
    raw[index * 3] = point.re * Math.cos(heading)
    raw[index * 3 + 1] = point.im
    raw[index * 3 + 2] = point.re * Math.sin(heading)
  }

  const cumulative = new Float32Array(PARSE_SAMPLES + 1)
  for (let index = 1; index <= PARSE_SAMPLES; index++) {
    const deltaX = requireDefined(raw[index * 3], 'inbound-stream-paths.ts:108') - requireDefined(raw[(index - 1) * 3], 'inbound-stream-paths.ts:108')
    const deltaY = requireDefined(raw[index * 3 + 1], 'inbound-stream-paths.ts:109') - requireDefined(raw[(index - 1) * 3 + 1], 'inbound-stream-paths.ts:109')
    const deltaZ = requireDefined(raw[index * 3 + 2], 'inbound-stream-paths.ts:110') - requireDefined(raw[(index - 1) * 3 + 2], 'inbound-stream-paths.ts:110')
    cumulative[index] = requireDefined(cumulative[index - 1], 'inbound-stream-paths.ts:111') + Math.hypot(deltaX, deltaY, deltaZ)
  }
  const length = requireDefined(cumulative[PARSE_SAMPLES], 'stream total length')

  const points = new Float32Array(LUT_SAMPLES * 3)
  const step = length / (LUT_SAMPLES - 1)
  let cursor = 0
  for (let index = 0; index < LUT_SAMPLES; index++) {
    const target = index * step
    while (cursor < PARSE_SAMPLES - 1 && requireDefined(cumulative[cursor + 1], 'inbound-stream-paths.ts:120') < target) cursor++
    const segment = requireDefined(cumulative[cursor + 1], 'inbound-stream-paths.ts:121') - requireDefined(cumulative[cursor], 'inbound-stream-paths.ts:121')
    const fraction = segment > 1e-9 ? (target - requireDefined(cumulative[cursor], 'inbound-stream-paths.ts:122')) / segment : 0
    points[index * 3] = requireDefined(raw[cursor * 3], 'inbound-stream-paths.ts:123') + (requireDefined(raw[(cursor + 1) * 3], 'inbound-stream-paths.ts:123') - requireDefined(raw[cursor * 3], 'inbound-stream-paths.ts:123')) * fraction
    points[index * 3 + 1] = requireDefined(raw[cursor * 3 + 1], 'inbound-stream-paths.ts:124') + (requireDefined(raw[(cursor + 1) * 3 + 1], 'inbound-stream-paths.ts:124') - requireDefined(raw[cursor * 3 + 1], 'inbound-stream-paths.ts:124')) * fraction
    points[index * 3 + 2] = requireDefined(raw[cursor * 3 + 2], 'inbound-stream-paths.ts:125') + (requireDefined(raw[(cursor + 1) * 3 + 2], 'inbound-stream-paths.ts:125') - requireDefined(raw[cursor * 3 + 2], 'inbound-stream-paths.ts:125')) * fraction
  }

  const tangents = new Float32Array(LUT_SAMPLES * 3)
  for (let index = 0; index < LUT_SAMPLES; index++) {
    const previous = Math.max(0, index - 1)
    const next = Math.min(LUT_SAMPLES - 1, index + 1)
    const deltaX = requireDefined(points[next * 3], 'inbound-stream-paths.ts:132') - requireDefined(points[previous * 3], 'inbound-stream-paths.ts:132')
    const deltaY = requireDefined(points[next * 3 + 1], 'inbound-stream-paths.ts:133') - requireDefined(points[previous * 3 + 1], 'inbound-stream-paths.ts:133')
    const deltaZ = requireDefined(points[next * 3 + 2], 'inbound-stream-paths.ts:134') - requireDefined(points[previous * 3 + 2], 'inbound-stream-paths.ts:134')
    const magnitude = Math.hypot(deltaX, deltaY, deltaZ) || 1
    tangents[index * 3] = deltaX / magnitude
    tangents[index * 3 + 1] = deltaY / magnitude
    tangents[index * 3 + 2] = deltaZ / magnitude
  }

  const sampleAt = (s: number, position: THREE.Vector3, tangent: THREE.Vector3) => {
    const clamped = Math.min(length, Math.max(0, s))
    const scaled = (clamped / length) * (LUT_SAMPLES - 1)
    const index = Math.min(LUT_SAMPLES - 2, Math.floor(scaled))
    const fraction = Math.min(1, scaled - index)
    const current = index * 3
    const following = current + 3
    position.set(
      requireDefined(points[current], 'inbound-stream-paths.ts:149') + (requireDefined(points[following], 'inbound-stream-paths.ts:149') - requireDefined(points[current], 'inbound-stream-paths.ts:149')) * fraction,
      requireDefined(points[current + 1], 'inbound-stream-paths.ts:150') + (requireDefined(points[following + 1], 'inbound-stream-paths.ts:150') - requireDefined(points[current + 1], 'inbound-stream-paths.ts:150')) * fraction,
      requireDefined(points[current + 2], 'inbound-stream-paths.ts:151') + (requireDefined(points[following + 2], 'inbound-stream-paths.ts:151') - requireDefined(points[current + 2], 'inbound-stream-paths.ts:151')) * fraction,
    )
    tangent.set(
      requireDefined(tangents[current], 'inbound-stream-paths.ts:154') + (requireDefined(tangents[following], 'inbound-stream-paths.ts:154') - requireDefined(tangents[current], 'inbound-stream-paths.ts:154')) * fraction,
      requireDefined(tangents[current + 1], 'inbound-stream-paths.ts:155') + (requireDefined(tangents[following + 1], 'inbound-stream-paths.ts:155') - requireDefined(tangents[current + 1], 'inbound-stream-paths.ts:155')) * fraction,
      requireDefined(tangents[current + 2], 'inbound-stream-paths.ts:156') + (requireDefined(tangents[following + 2], 'inbound-stream-paths.ts:156') - requireDefined(tangents[current + 2], 'inbound-stream-paths.ts:156')) * fraction,
    ).normalize()
  }

  return {
    id: definition.id,
    definition,
    azimuthRadians,
    length,
    points,
    tangents,
    sampleAt,
  }
}

export function createInboundPaths(): InboundPath[] {
  return STREAM_DEFINITIONS.map(buildPath)
}

export function createInboundGuidePaths(): InboundPath[] {
  return LANE_GROUPS.map(group => buildPath(definePath(group, 0)))
}
