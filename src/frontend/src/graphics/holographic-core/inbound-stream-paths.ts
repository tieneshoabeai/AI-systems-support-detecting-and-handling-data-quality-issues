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
// Adjacent lanes sit 2 degrees apart and differ by 0.3 s per cycle, so their streaks drift in
// and out of phase instead of running as a rigid train.
const CYCLE_STEP_SECONDS_PER_DEGREE = 0.15

const LANE_GROUPS = [
  { groupId: 'left-outer', azimuthDegrees: 119, baseCycleSeconds: 7.2 },
  { groupId: 'left-inner', azimuthDegrees: 151, baseCycleSeconds: 6 },
  { groupId: 'right-outer', azimuthDegrees: 299, baseCycleSeconds: 7.2 },
  { groupId: 'right-inner', azimuthDegrees: 331, baseCycleSeconds: 6 },
] as const

const LANE_OFFSETS = [-4, -2, 0, 2, 4, 6] as const

// The curve lives in the (radius, height) complex plane and is mapped onto a vertical plane per
// azimuth, so the plotted path is planar: no twisting cross-section, no radius loops.
const STREAM_DEFINITIONS: readonly InboundPathDefinition[] = LANE_GROUPS.flatMap(group =>
  LANE_OFFSETS.map(offset => ({
    id: `${group.groupId}@${offset > 0 ? '+' : ''}${offset}`,
    groupId: group.groupId,
    offsetDegrees: offset,
    azimuthDegrees: group.azimuthDegrees + offset,
    startRadius: START_RADIUS,
    startHeight: START_HEIGHT,
    landingRadius: LANDING_RADIUS,
    cycleSeconds: group.baseCycleSeconds + offset * CYCLE_STEP_SECONDS_PER_DEGREE,
  })),
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
  const cos = Math.cos(azimuthRadians)
  const sin = Math.sin(azimuthRadians)

  const raw = new Float32Array((PARSE_SAMPLES + 1) * 3)
  for (let index = 0; index <= PARSE_SAMPLES; index++) {
    const point = evaluateBezier(definition, index / PARSE_SAMPLES)
    raw[index * 3] = point.re * cos
    raw[index * 3 + 1] = point.im
    raw[index * 3 + 2] = point.re * sin
  }

  const cumulative = new Float32Array(PARSE_SAMPLES + 1)
  for (let index = 1; index <= PARSE_SAMPLES; index++) {
    const deltaX = raw[index * 3] - raw[(index - 1) * 3]
    const deltaY = raw[index * 3 + 1] - raw[(index - 1) * 3 + 1]
    const deltaZ = raw[index * 3 + 2] - raw[(index - 1) * 3 + 2]
    cumulative[index] = cumulative[index - 1] + Math.hypot(deltaX, deltaY, deltaZ)
  }
  const length = cumulative[PARSE_SAMPLES]

  const points = new Float32Array(LUT_SAMPLES * 3)
  const step = length / (LUT_SAMPLES - 1)
  let cursor = 0
  for (let index = 0; index < LUT_SAMPLES; index++) {
    const target = index * step
    while (cursor < PARSE_SAMPLES - 1 && cumulative[cursor + 1] < target) cursor++
    const segment = cumulative[cursor + 1] - cumulative[cursor]
    const fraction = segment > 1e-9 ? (target - cumulative[cursor]) / segment : 0
    points[index * 3] = raw[cursor * 3] + (raw[(cursor + 1) * 3] - raw[cursor * 3]) * fraction
    points[index * 3 + 1] = raw[cursor * 3 + 1] + (raw[(cursor + 1) * 3 + 1] - raw[cursor * 3 + 1]) * fraction
    points[index * 3 + 2] = raw[cursor * 3 + 2] + (raw[(cursor + 1) * 3 + 2] - raw[cursor * 3 + 2]) * fraction
  }

  const tangents = new Float32Array(LUT_SAMPLES * 3)
  for (let index = 0; index < LUT_SAMPLES; index++) {
    const previous = Math.max(0, index - 1)
    const next = Math.min(LUT_SAMPLES - 1, index + 1)
    const deltaX = points[next * 3] - points[previous * 3]
    const deltaY = points[next * 3 + 1] - points[previous * 3 + 1]
    const deltaZ = points[next * 3 + 2] - points[previous * 3 + 2]
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
      points[current] + (points[following] - points[current]) * fraction,
      points[current + 1] + (points[following + 1] - points[current + 1]) * fraction,
      points[current + 2] + (points[following + 2] - points[current + 2]) * fraction,
    )
    tangent.set(
      tangents[current] + (tangents[following] - tangents[current]) * fraction,
      tangents[current + 1] + (tangents[following + 1] - tangents[current + 1]) * fraction,
      tangents[current + 2] + (tangents[following + 2] - tangents[current + 2]) * fraction,
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
