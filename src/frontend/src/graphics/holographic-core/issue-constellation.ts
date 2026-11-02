import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  CLEAN_LOOP_POINTS,
  CORE_NUCLEUS,
  DETECTION_ANCHOR,
  ISSUE_CONSTELLATION,
  ISSUE_LANES,
  type Vec3,
} from './core-visual-config'

export type IssueConstellation = {
  root: THREE.Group
  update(elapsedSeconds: number, deltaSeconds: number): void
  reset(): void
  setDetached(detached: boolean): void
  dispose(): void
}

type LaneSamples = {
  points: Float32Array
  segments: number
  closed: boolean
}

type ParticleSeed = {
  laneIndex: number
  phase: number
  speed: number
  size: number
  issue: boolean
}

type BeadSeed = {
  angle: number
  radius: number
  yOffset: number
  phase: number
  size: number
  direction: number
}

const IDENTITY_QUATERNION = new THREE.Quaternion()

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function buildLaneSamples(points: readonly Vec3[], closed: boolean, segments: number): LaneSamples {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), closed, 'catmullrom', 0.5)
  const count = closed ? segments : segments + 1
  const array = new Float32Array(count * 3)
  const sample = new THREE.Vector3()
  for (let index = 0; index < count; index += 1) {
    curve.getPoint(index / segments, sample)
    array[index * 3] = sample.x
    array[index * 3 + 1] = sample.y
    array[index * 3 + 2] = sample.z
  }
  return { points: array, segments, closed }
}

function sampleLane(lane: LaneSamples, t: number, target: THREE.Vector3) {
  const wrapped = ((t % 1) + 1) % 1
  const scaled = wrapped * lane.segments
  const i0 = lane.closed ? Math.floor(scaled) % lane.segments : Math.min(Math.floor(scaled), lane.segments - 1)
  const i1 = lane.closed ? (i0 + 1) % lane.segments : i0 + 1
  const blend = scaled - Math.floor(scaled)
  const a = i0 * 3
  const b = i1 * 3
  target.set(
    lane.points[a] + (lane.points[b] - lane.points[a]) * blend,
    lane.points[a + 1] + (lane.points[b + 1] - lane.points[a + 1]) * blend,
    lane.points[a + 2] + (lane.points[b + 2] - lane.points[a + 2]) * blend,
  )
}

function createGlowTexture(): THREE.DataTexture {
  const size = 64
  const data = new Uint8Array(size * size * 4)
  const center = (size - 1) / 2
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const radius = Math.hypot(x - center, y - center) / center
      const alpha = Math.round(255 * Math.pow(Math.max(0, 1 - radius), 2.2))
      const offset = (y * size + x) * 4
      data[offset] = 255
      data[offset + 1] = 170
      data[offset + 2] = 70
      data[offset + 3] = alpha
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

export function createIssueConstellation(): IssueConstellation {
  const root = new THREE.Group()
  root.name = 'issue-constellation'

  const disposables: Array<{ dispose(): void }> = []
  const particlePosition = new THREE.Vector3()
  const particleScale = new THREE.Vector3()
  const particleMatrix = new THREE.Matrix4()
  const beadPosition = new THREE.Vector3()
  const beadScale = new THREE.Vector3()
  const beadMatrix = new THREE.Matrix4()
  const color = new THREE.Color()

  // 1. Horizontal nucleus bands: three thin HDR rings merged into one draw call.
  const bandGeometries = CORE_NUCLEUS.bands.map(band => {
    const geometry = new THREE.TorusGeometry(band.radius, band.tube, 6, 64)
    geometry.rotateX(Math.PI / 2)
    geometry.translate(0, band.y, 0)
    const count = geometry.getAttribute('position').count
    const colors = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = band.linear[0]
      colors[index * 3 + 1] = band.linear[1]
      colors[index * 3 + 2] = band.linear[2]
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return geometry
  })
  const bandGeometry = mergeGeometries(bandGeometries, false)
  for (const geometry of bandGeometries) geometry.dispose()
  if (!bandGeometry) throw new Error('Không gộp được geometry dải nucleus')
  const bandMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
  const bands = new THREE.Mesh(bandGeometry, bandMaterial)
  bands.name = 'nucleus-bands'
  bands.renderOrder = 7
  bands.raycast = () => {}
  root.add(bands)
  disposables.push(bandGeometry, bandMaterial)

  // 2. Record beads: two counter-rotating rings of tiny octahedra around the nucleus.
  const beadSeeds: BeadSeed[] = []
  CORE_NUCLEUS.beadRings.forEach((ring, ringIndex) => {
    for (let index = 0; index < ring.count; index += 1) {
      beadSeeds.push({
        angle: (index / ring.count) * Math.PI * 2 + ringIndex * 0.31,
        radius: ring.radius,
        yOffset: (index % 2 === 0 ? 1 : -1) * 0.05 + (ringIndex === 1 ? -0.02 : 0),
        phase: (index / ring.count) * Math.PI * 2 + ringIndex,
        size: CORE_NUCLEUS.beadSize * (0.85 + 0.3 * ((index * 0.37 + ringIndex * 0.61) % 1)),
        direction: ring.direction,
      })
    }
  })
  const beadGeometry = new THREE.OctahedronGeometry(1, 0)
  const beadMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
  const beads = new THREE.InstancedMesh(beadGeometry, beadMaterial, beadSeeds.length)
  beads.name = 'nucleus-beads'
  beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  beads.frustumCulled = false
  beads.renderOrder = 8
  beads.raycast = () => {}
  beadSeeds.forEach((_seed, index) => {
    const tone = CORE_NUCLEUS.beadPalette[index % CORE_NUCLEUS.beadPalette.length]
    color.setRGB(tone[0], tone[1], tone[2])
    beads.setColorAt(index, color)
  })
  if (beads.instanceColor) beads.instanceColor.needsUpdate = true
  root.add(beads)
  disposables.push(beadGeometry, beadMaterial)

  // 3. Lane geometry: three issue lanes plus one closed clean loop, vertex-coloured in one draw.
  const issueLanes = ISSUE_LANES.map(lane => buildLaneSamples(
    [lane.start, lane.controls[0], lane.controls[1], lane.end],
    false,
    ISSUE_CONSTELLATION.laneSegments,
  ))
  const cleanLane = buildLaneSamples(CLEAN_LOOP_POINTS, true, ISSUE_CONSTELLATION.laneSegments)
  const lanes = [...issueLanes, cleanLane]
  const lanePositions: number[] = []
  const laneColors: number[] = []
  const laneColorBanks = [
    ISSUE_CONSTELLATION.laneColors.issue,
    ISSUE_CONSTELLATION.laneColors.issue,
    ISSUE_CONSTELLATION.laneColors.issue,
    ISSUE_CONSTELLATION.laneColors.clean,
  ]
  lanes.forEach((lane, laneIndex) => {
    const laneColor = laneColorBanks[laneIndex]
    const count = lane.closed ? lane.segments : lane.segments + 1
    for (let index = 0; index < lane.segments; index += 1) {
      const next = lane.closed ? (index + 1) % count : index + 1
      if (next >= count) continue
      lanePositions.push(
        lane.points[index * 3], lane.points[index * 3 + 1], lane.points[index * 3 + 2],
        lane.points[next * 3], lane.points[next * 3 + 1], lane.points[next * 3 + 2],
      )
      laneColors.push(laneColor[0], laneColor[1], laneColor[2], laneColor[0], laneColor[1], laneColor[2])
    }
  })
  const laneGeometry = new THREE.BufferGeometry()
  laneGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lanePositions, 3))
  laneGeometry.setAttribute('color', new THREE.Float32BufferAttribute(laneColors, 3))
  const laneMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: ISSUE_CONSTELLATION.laneOpacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
  const laneLines = new THREE.LineSegments(laneGeometry, laneMaterial)
  laneLines.name = 'constellation-lanes'
  laneLines.renderOrder = 6
  laneLines.frustumCulled = false
  laneLines.raycast = () => {}
  root.add(laneLines)
  disposables.push(laneGeometry, laneMaterial)

  // 4. Particles: 18 issue motes across the three lanes and 30 clean motes on the loop.
  const particleSeeds: ParticleSeed[] = []
  ISSUE_LANES.forEach((lane, laneIndex) => {
    for (let index = 0; index < ISSUE_CONSTELLATION.issueParticlesPerLane; index += 1) {
      particleSeeds.push({
        laneIndex,
        phase: (lane.phaseOffset + index / ISSUE_CONSTELLATION.issueParticlesPerLane) % 1,
        speed: lane.speed,
        size: ISSUE_CONSTELLATION.particleSize.issue * (0.85 + 0.3 * ((index * 0.41 + laneIndex * 0.23) % 1)),
        issue: true,
      })
    }
  })
  for (let index = 0; index < ISSUE_CONSTELLATION.cleanParticleCount; index += 1) {
    particleSeeds.push({
      laneIndex: 3,
      phase: index / ISSUE_CONSTELLATION.cleanParticleCount,
      speed: ISSUE_CONSTELLATION.cleanSpeed,
      size: ISSUE_CONSTELLATION.particleSize.clean * (0.8 + 0.4 * ((index * 0.618) % 1)),
      issue: false,
    })
  }
  const particleGeometry = new THREE.OctahedronGeometry(1, 0)
  const particleMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
  const particles = new THREE.InstancedMesh(particleGeometry, particleMaterial, particleSeeds.length)
  particles.name = 'constellation-particles'
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  particles.frustumCulled = false
  particles.renderOrder = 9
  particles.raycast = () => {}
  particleSeeds.forEach((seed, index) => {
    const palette = seed.issue ? ISSUE_CONSTELLATION.issuePalette : ISSUE_CONSTELLATION.cleanPalette
    const tone = palette[index % palette.length]
    color.setRGB(tone[0], tone[1], tone[2])
    particles.setColorAt(index, color)
  })
  if (particles.instanceColor) particles.instanceColor.needsUpdate = true
  root.add(particles)
  disposables.push(particleGeometry, particleMaterial)

  // 5. Detection beacon: an amber ring facing the nucleus plus a soft sprite.
  const [beaconX, beaconY, beaconZ] = DETECTION_ANCHOR.center
  const beaconRingGeometry = new THREE.TorusGeometry(
    ISSUE_CONSTELLATION.beacon.ringRadius,
    ISSUE_CONSTELLATION.beacon.ringTube,
    6,
    64,
  )
  const beaconRingMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
  beaconRingMaterial.color.setRGB(...ISSUE_CONSTELLATION.beacon.ringLinear)
  const beaconRing = new THREE.Mesh(beaconRingGeometry, beaconRingMaterial)
  beaconRing.name = 'detection-beacon-ring'
  beaconRing.position.set(beaconX, beaconY, beaconZ)
  beaconRing.lookAt(0, beaconY, 0)
  beaconRing.renderOrder = 9
  beaconRing.raycast = () => {}
  root.add(beaconRing)

  const glowTexture = createGlowTexture()
  const beaconSpriteMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
  beaconSpriteMaterial.color.setRGB(1.4, 0.75, 0.3)
  const beaconSprite = new THREE.Sprite(beaconSpriteMaterial)
  beaconSprite.name = 'detection-beacon-sprite'
  beaconSprite.position.set(beaconX, beaconY, beaconZ)
  beaconSprite.scale.setScalar(ISSUE_CONSTELLATION.beacon.spriteSize)
  beaconSprite.renderOrder = 9
  beaconSprite.raycast = () => {}
  root.add(beaconSprite)
  disposables.push(beaconRingGeometry, beaconRingMaterial, beaconSpriteMaterial, glowTexture)

  let beaconLevel = ISSUE_CONSTELLATION.beacon.baseLevel
  let staticApplied = false

  function syncBeads(elapsedSeconds: number) {
    beadSeeds.forEach((seed, index) => {
      const angle = seed.angle + elapsedSeconds * CORE_NUCLEUS.beadOrbitSpeed * seed.direction
      const radius = seed.radius + Math.sin(elapsedSeconds * 0.6 + seed.phase) * 0.012
      beadPosition.set(
        Math.cos(angle) * radius,
        CORE_NUCLEUS.centerY + seed.yOffset + Math.sin(elapsedSeconds * 0.9 + seed.phase) * 0.02,
        Math.sin(angle) * radius,
      )
      beadScale.setScalar(seed.size * (0.9 + Math.sin(elapsedSeconds * 1.2 + seed.phase) * 0.1))
      beadMatrix.compose(beadPosition, IDENTITY_QUATERNION, beadScale)
      beads.setMatrixAt(index, beadMatrix)
    })
    beads.instanceMatrix.needsUpdate = true
  }

  function applyParticles(elapsedSeconds: number) {
    let arrival = 0
    particleSeeds.forEach((seed, index) => {
      const lane = lanes[seed.laneIndex]
      const progress = (seed.phase + elapsedSeconds * seed.speed) % 1
      sampleLane(lane, progress, particlePosition)
      let scale = seed.size
      if (seed.issue) {
        const fade = ISSUE_CONSTELLATION.edgeFade
        scale *= smoothstep(0, fade, progress) * smoothstep(0, fade, 1 - progress)
        if (progress > 0.9) arrival = Math.max(arrival, smoothstep(0.9, 1, progress))
      } else {
        scale *= 0.9 + Math.sin(elapsedSeconds * 1.7 + seed.phase * Math.PI * 2) * 0.1
      }
      particleScale.setScalar(scale)
      particleMatrix.compose(particlePosition, IDENTITY_QUATERNION, particleScale)
      particles.setMatrixAt(index, particleMatrix)
    })
    particles.instanceMatrix.needsUpdate = true
    return arrival
  }

  function applyBeacon() {
    beaconRing.scale.setScalar(1 + beaconLevel * 0.18)
    beaconRingMaterial.opacity = 0.2 + beaconLevel * 0.6
    beaconSpriteMaterial.opacity = 0.12 + beaconLevel * 0.4
  }

  function reset() {
    if (staticApplied) return
    beaconLevel = ISSUE_CONSTELLATION.beacon.baseLevel
    syncBeads(0)
    applyParticles(0)
    applyBeacon()
    staticApplied = true
  }

  reset()

  return {
    root,
    update(elapsedSeconds, deltaSeconds) {
      if (!root.visible) return
      staticApplied = false
      syncBeads(elapsedSeconds)
      const arrival = applyParticles(elapsedSeconds)
      const target = Math.max(ISSUE_CONSTELLATION.beacon.baseLevel, arrival)
      const blend = 1 - Math.exp(-Math.min(deltaSeconds, 0.1) * ISSUE_CONSTELLATION.beacon.smoothing)
      beaconLevel += (target - beaconLevel) * blend
      applyBeacon()
    },
    reset,
    setDetached(detached) {
      root.visible = !detached
    },
    dispose() {
      root.clear()
      disposables.forEach(disposable => disposable.dispose())
    },
  }
}
