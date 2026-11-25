import { useEffect, useRef, useState } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Group, type Object3D } from 'three'
import { createNeonCubeCluster, type NeonCubeCluster } from '../../../graphics/neon-cube/neon-cube.cluster'
import type { NeonCubeThemeId } from '../../../types'

export function NeonCubeNodes({ onFocus }: { onFocus?: (theme: NeonCubeThemeId) => void }) {
  const [host] = useState(() => new Group())
  const clusterRef = useRef<NeonCubeCluster | null>(null)
  const invalidate = useThree(state => state.invalidate)
  useEffect(() => {
    // Each effect setup owns a fresh cluster, including StrictMode effect replay.
    const cluster = createNeonCubeCluster()
    clusterRef.current = cluster
    host.add(cluster.group)
    invalidate()
    return () => {
      clusterRef.current = null
      host.remove(cluster.group)
      cluster.dispose()
    }
  }, [host, invalidate])
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    const cluster = clusterRef.current
    if (!cluster || !onFocus || event.delta > 6) return
    let object: Object3D | null = event.object
    while (object && object.parent !== cluster.group) object = object.parent
    const theme = cluster.cubes.find(cube => cube.group === object)?.theme.id
    if (theme) { event.stopPropagation(); onFocus(theme) }
  }
  return <primitive object={host} onClick={handleClick} />
}
