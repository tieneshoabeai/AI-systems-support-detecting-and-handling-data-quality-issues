import { OrthographicCamera, PerspectiveCamera, Scene, Texture } from 'three'
import { expect, it } from 'vitest'
import { setNumberUniform, setPreviewEnvironment, updatePreviewCameraZoom } from '../../graphics/workspace-3d/scene-runtime'

it('updates the orthographic projection to reflect the requested zoom', () => {
  const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100)
  const before = camera.projectionMatrix.clone()
  expect(updatePreviewCameraZoom(camera, 2)).toBe(true)
  expect(camera.zoom).toBe(2)
  expect(camera.projectionMatrix.equals(before)).toBe(false)
  expect(camera.projectionMatrix.elements[0]).toBeCloseTo(before.elements[0] * 2, 6)
})

it('leaves an unsupported perspective camera unchanged', () => {
  const camera = new PerspectiveCamera()
  const before = camera.projectionMatrix.clone()
  expect(updatePreviewCameraZoom(camera, 3)).toBe(false)
  expect(camera.zoom).toBe(1)
  expect(camera.projectionMatrix.equals(before)).toBe(true)
})

it('applies and clears the scene environment and writes a zero-valued uniform', () => {
  const scene = new Scene()
  const texture = new Texture()
  try {
    setPreviewEnvironment(scene, texture)
    expect(scene.environment).toBe(texture)
    setPreviewEnvironment(scene, null)
    expect(scene.environment).toBeNull()
    const uniform = { value: 1 }
    setNumberUniform(uniform, 0)
    expect(uniform.value).toBe(0)
  } finally { texture.dispose() }
})
