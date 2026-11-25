import { OrthographicCamera, type Camera, type Scene } from 'three'

// Three.js owns these mutable objects and reads them directly on each draw.
export function setNumberUniform(uniform: { value: number }, value: number): void {
  uniform.value = value
}

export function updatePreviewCameraZoom(camera: Camera, zoom: number): boolean {
  if (!(camera instanceof OrthographicCamera)) return false
  camera.zoom = zoom
  camera.updateProjectionMatrix()
  return true
}

export function setPreviewEnvironment(scene: Scene, environment: Scene['environment']): void {
  scene.environment = environment
}
