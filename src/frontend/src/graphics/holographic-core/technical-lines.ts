import * as THREE from 'three'

export const CYAN = '#17d7ff'

export function addTechnicalLine(parent: THREE.Object3D, positions: number[], opacity: number, color = CYAN) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const lines = new THREE.LineSegments(geometry, material)
  lines.name = 'technical-linework'
  lines.renderOrder = 6
  parent.add(lines)
}

const ROD_UP = new THREE.Vector3(0, 1, 0)
const rodMidpoint = new THREE.Vector3()
const rodDirection = new THREE.Vector3()
const rodQuaternion = new THREE.Quaternion()
const rodScale = new THREE.Vector3()

// LineBasicMaterial ignores linewidth on most GPUs, so structural lines are box rods in one instanced draw.
export function addTechnicalRods(
  parent: THREE.Object3D,
  positions: number[],
  options: { thickness: number; opacity: number; name: string; color?: string; blending?: THREE.Blending },
) {
  const count = positions.length / 6
  const material = new THREE.MeshBasicMaterial({
    color: options.color ?? CYAN,
    transparent: true,
    opacity: options.opacity,
    depthWrite: false,
    blending: options.blending ?? THREE.AdditiveBlending,
    toneMapped: false,
  })
  const rods = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, count)
  const matrix = new THREE.Matrix4()
  for (let index = 0; index < count; index += 1) {
    const offset = index * 6
    const x1 = positions[offset]
    const y1 = positions[offset + 1]
    const z1 = positions[offset + 2]
    const x2 = positions[offset + 3]
    const y2 = positions[offset + 4]
    const z2 = positions[offset + 5]
    rodMidpoint.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2)
    rodDirection.set(x2 - x1, y2 - y1, z2 - z1)
    const length = rodDirection.length()
    if (length === 0) continue
    rodQuaternion.setFromUnitVectors(ROD_UP, rodDirection.divideScalar(length))
    rodScale.set(options.thickness, length, options.thickness)
    matrix.compose(rodMidpoint, rodQuaternion, rodScale)
    rods.setMatrixAt(index, matrix)
  }
  rods.instanceMatrix.needsUpdate = true
  rods.name = options.name
  rods.renderOrder = 6
  rods.frustumCulled = false
  rods.raycast = () => {}
  parent.add(rods)
  return rods
}
