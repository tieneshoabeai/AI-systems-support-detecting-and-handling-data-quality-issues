import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three'
import type { Scene, WebGLRenderer } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

function attachEnvironment(scene: Scene, renderer: WebGLRenderer) {
  const previous = scene.environment
  const room = new RoomEnvironment()
  const generator = new PMREMGenerator(renderer)
  const environment = (() => {
    try { return generator.fromScene(room, 0.04) }
    finally { room.dispose(); generator.dispose() }
  })()
  scene.environment = environment.texture
  return () => {
    if (scene.environment === environment.texture) scene.environment = previous
    environment.dispose()
  }
}

export function HardwareLighting() {
  const { scene, gl, invalidate } = useThree()
  useEffect(() => {
    const dispose = attachEnvironment(scene, gl)
    invalidate()
    return dispose
  }, [scene, gl, invalidate])
  return null
}
