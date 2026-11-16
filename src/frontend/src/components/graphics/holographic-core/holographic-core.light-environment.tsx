import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { attachLightEnvironment } from '../../../graphics/holographic-core/light-environment'

export function LightEnvironment({ reducedMotion }: { reducedMotion: boolean }) {
  const gl = useThree(state => state.gl)
  const scene = useThree(state => state.scene)
  const active = useRef<ReturnType<typeof attachLightEnvironment> | null>(null)
  // Allocate only in the committed effect: StrictMode discarded renders own no GPU resources.
  useEffect(() => {
    const environment = attachLightEnvironment(scene, gl)
    active.current = environment
    return () => {
      active.current = null
      environment.dispose()
    }
  }, [gl, scene])
  useFrame(({ clock }) => { active.current?.step(reducedMotion ? 12 : clock.elapsedTime) }, -1)
  return null
}
