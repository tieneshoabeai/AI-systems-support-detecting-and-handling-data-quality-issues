import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three'
import type { Texture } from 'three'
import { createBasePanorama } from '../../../../graphics/auth-glass/display-base/display-base.lighting'

export function useBaseEnvironment(low: boolean) {
  const gl = useThree(state => state.gl)
  const [environment, setEnvironment] = useState<Texture | null>(null)
  useEffect(() => {
    if (low) return
    let dispose: (() => void) | undefined
    const request = requestAnimationFrame(() => {
      const panorama = createBasePanorama()
      const generator = new PMREMGenerator(gl)
      const target = generator.fromEquirectangular(panorama)
      panorama.dispose()
      generator.dispose()
      dispose = () => target.dispose()
      setEnvironment(target.texture)
    })
    return () => {
      cancelAnimationFrame(request)
      dispose?.()
    }
  }, [gl, low])
  return low ? null : environment
}
