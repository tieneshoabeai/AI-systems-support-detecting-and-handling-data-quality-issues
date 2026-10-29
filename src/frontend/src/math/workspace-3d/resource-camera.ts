import { Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import type { PositionedResource, ResourceLayout } from '../../types/workspace-3d/resource-map.types'

export type CameraPose = { position: Vector3; target: Vector3 }
export const overviewDirection = () => new Vector3(0.35, 0.95, 1.2).normalize()

// Three.js owns this mutable renderer object; this is not React application state.
export function updateCameraProjection(camera: PerspectiveCamera, aspect: number, far: number) {
  camera.aspect = aspect
  camera.far = far
  camera.updateProjectionMatrix()
}

export function nodeCorners(node: PositionedResource): Vector3[] {
  const width = 2
  return [-width, width].flatMap(x => [-0.8, 1.8].flatMap(y => [-1.6, 2.5].map(z =>
    new Vector3(...node.position).add(new Vector3(x, y, z)))))
}

export function fitPose(nodes: PositionedResource[], target: Vector3, direction: Vector3, fov: number, aspect: number): CameraPose {
  const forward = direction.clone().normalize()
  if (forward.lengthSq() === 0) forward.copy(overviewDirection())
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), forward).normalize()
  const up = new Vector3().crossVectors(forward, right)
  const tangent = Math.tan(fov * Math.PI / 360)
  let distance = 4
  for (const node of nodes) for (const corner of nodeCorners(node)) {
    corner.sub(target)
    const depth = corner.dot(forward)
    distance = Math.max(distance, Math.abs(corner.dot(up)) / tangent + depth,
      Math.abs(corner.dot(right)) / (tangent * Math.max(0.1, aspect)) + depth)
  }
  return { target: target.clone(), position: forward.multiplyScalar(distance * 1.18).add(target) }
}

export function overviewPose(layout: ResourceLayout, fov: number, aspect: number): CameraPose {
  return fitPose(layout.nodes, new Vector3(...layout.center), overviewDirection(), fov, aspect)
}

export function clampTarget(target: Vector3, layout: ResourceLayout): Vector3 {
  const margin = 5
  const xs = layout.nodes.map(node => node.position[0])
  const zs = layout.nodes.map(node => node.position[2])
  return new Vector3(Math.max(Math.min(0, ...xs) - margin, Math.min(Math.max(0, ...xs) + margin, target.x)), 0,
    Math.max(Math.min(0, ...zs) - margin, Math.min(Math.max(0, ...zs) + margin, target.z)))
}

export function panPose(pose: CameraPose, direction: 'left' | 'right' | 'forward' | 'back', layout: ResourceLayout): CameraPose {
  const forward = pose.target.clone().sub(pose.position).setY(0).normalize()
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0))
  const step = Math.max(0.8, pose.position.distanceTo(pose.target) * 0.12)
  const offset = (direction === 'left' || direction === 'right' ? right : forward)
    .multiplyScalar(step * (direction === 'left' || direction === 'back' ? -1 : 1))
  const target = clampTarget(pose.target.clone().add(offset), layout)
  return { target, position: pose.position.clone().add(target.clone().sub(pose.target)) }
}
