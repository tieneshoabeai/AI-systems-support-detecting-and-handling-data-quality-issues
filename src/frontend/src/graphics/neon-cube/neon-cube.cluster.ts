import * as THREE from 'three'
import { createNeonCubeModel } from './neon-cube.model'
import type { NeonCubeModel } from './neon-cube.model'
import type { NeonCubeThemeId } from '../../types/dataset-3d/cube-focus.types'

export type NeonCubeClusterNode = {
  theme: NeonCubeThemeId
  position: readonly [number, number, number]
  scale: number
}

// Layout-only nod to the workspace overview: four cube nodes around the centre core,
// two on a higher orbit and two lower. Positions are scene-space, not the cube model's.
export const NEON_CUBE_CLUSTER_LAYOUT: readonly NeonCubeClusterNode[] = [
  { theme: 'violet', position: [-6, 2.7, 2], scale: 0.75 },
  { theme: 'cyan', position: [2, 2.9, -6], scale: 0.75 },
  { theme: 'blue', position: [-1.2, 1, 6.8], scale: 0.72 },
  { theme: 'orange', position: [6.8, 1.15, -1.2], scale: 0.72 },
]

export type NeonCubeCluster = {
  group: THREE.Group
  cubes: NeonCubeModel[]
  dispose(): void
}

export function createNeonCubeCluster(layout: readonly NeonCubeClusterNode[] = NEON_CUBE_CLUSTER_LAYOUT): NeonCubeCluster {
  const group = new THREE.Group()
  group.name = 'neon-cube-cluster'
  const cubes: NeonCubeModel[] = []
  for (const node of layout) {
    const cube = createNeonCubeModel({ theme: node.theme })
    cube.group.name = `neon-cube-${node.theme}`
    cube.group.position.set(...node.position)
    cube.group.scale.setScalar(node.scale)
    cube.group.rotation.y = Math.atan2(-node.position[0], -node.position[2])
    // Satellites sit inside the core scene's brighter bloom: thin the additive pane
    // stack so the theme colour survives instead of clipping to white.
    const panel = cube.materials['glass-panel'] as THREE.MeshPhysicalMaterial
    panel.opacity *= 0.55
    panel.emissiveIntensity *= 0.55
    const core = cube.materials['core-glass'] as THREE.MeshPhysicalMaterial
    core.emissiveIntensity *= 0.6
    group.add(cube.group)
    cubes.push(cube)
  }
  function dispose() {
    for (const cube of cubes) cube.dispose()
    group.clear()
  }
  return { group, cubes, dispose }
}
