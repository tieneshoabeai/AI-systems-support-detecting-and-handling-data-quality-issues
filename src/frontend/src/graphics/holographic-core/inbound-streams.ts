import * as THREE from 'three'
import { createInboundPaths, type InboundPath } from './inbound-stream-paths'
import { createInboundStreaks } from './inbound-stream-streaks'

const CAP_ANCHOR_Y = 0.05
const GUIDE_SEGMENTS = 160
const GUIDE_RADIUS = 0.0055
const GUIDE_RADIAL_SEGMENTS = 5

export type InboundStreams = {
  root: THREE.Group
  update(elapsedSeconds: number): void
  reset(): void
}

const guideTangent = new THREE.Vector3()

// The guide tube is only there to hint at the lane; the streak mesh is the visual payload.
class InboundGuideCurve extends THREE.Curve<THREE.Vector3> {
  private readonly path: InboundPath

  constructor(path: InboundPath) {
    super()
    this.path = path
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    this.path.sampleAt(t * this.path.length, optionalTarget, guideTangent)
    return optionalTarget
  }
}

export function createInboundStreams(capNode: THREE.Object3D): InboundStreams {
  const root = new THREE.Group()
  root.name = 'inbound-data-streams'
  root.position.set(0, CAP_ANCHOR_Y, 0)
  capNode.add(root)

  const guideMaterial = new THREE.MeshBasicMaterial({
    color: '#2fd6ff',
    transparent: true,
    opacity: 0.11,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })

  const paths = createInboundPaths()
  // Only the four base lanes get a faint guide; the 20 satellites would otherwise read as a
  // solid wall of lines and bury the moving streaks.
  for (const path of paths) {
    if (path.definition.offsetDegrees !== 0) continue
    const guide = new THREE.Mesh(
      new THREE.TubeGeometry(new InboundGuideCurve(path), GUIDE_SEGMENTS, GUIDE_RADIUS, GUIDE_RADIAL_SEGMENTS, false),
      guideMaterial,
    )
    guide.name = 'inbound-stream-guide'
    guide.userData.pathId = path.definition.groupId
    guide.renderOrder = 5
    root.add(guide)
  }

  const streaks = createInboundStreaks(paths)
  for (const mesh of streaks.meshes) root.add(mesh)

  let staticApplied = false

  const reset = () => {
    root.rotation.y = 0
    if (staticApplied) return
    streaks.reset()
    staticApplied = true
  }

  reset()

  return {
    root,
    update(elapsedSeconds) {
      // The cap spins at -2pi/24s; cancelling its yaw keeps the lane bundle pinned to the same
      // screen sides while still following the cap height during the explode.
      root.rotation.y = -capNode.rotation.y
      staticApplied = false
      streaks.update(elapsedSeconds)
    },
    reset,
  }
}
