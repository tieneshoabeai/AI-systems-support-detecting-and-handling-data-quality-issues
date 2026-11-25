import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, NormalBlending, Points, ShaderMaterial } from 'three'
import { expect, it } from 'vitest'
import { applyLightChartAppearance } from '../../graphics/holographic-core/light-chart-appearance'

it('themes only background decorations and restores colors without touching the model', () => {
  const scene = new Group()
  const modelMaterial = new MeshStandardMaterial({ color: '#22caff', emissiveIntensity: 2, metalness: .8, roughness: .15 })
  const geometry = new BufferGeometry()
  geometry.setAttribute('tint', new BufferAttribute(new Float32Array([.8, .7, 1]), 3))
  const lineMaterial = new LineBasicMaterial({ color: '#99ddff', opacity: .25, blending: AdditiveBlending })
  const pointsMaterial = new ShaderMaterial({ uniforms: { uOpacity: { value: .5 } }, blending: AdditiveBlending })
  const modelGeometry = new BufferGeometry()
  const model = new Mesh(modelGeometry, modelMaterial)
  const background = new Group()
  const lineGeometry = new BufferGeometry()
  background.add(new LineSegments(lineGeometry, lineMaterial), new Points(geometry, pointsMaterial))
  scene.add(model, background)
  const originalColor = lineMaterial.color.clone()
  const originalTint = Array.from(geometry.getAttribute('tint').array)
  const modelState = [modelMaterial.color.getHex(), modelMaterial.emissiveIntensity, modelMaterial.metalness, modelMaterial.roughness]
  for (let i = 0; i < 3; i++) {
    const restore = applyLightChartAppearance(background)
    expect(lineMaterial.blending).toBe(NormalBlending)
    expect(lineMaterial.color).not.toEqual(originalColor)
    expect([modelMaterial.color.getHex(), modelMaterial.emissiveIntensity, modelMaterial.metalness, modelMaterial.roughness]).toEqual(modelState)
    restore()
    expect(lineMaterial.color).toEqual(originalColor)
    expect(lineMaterial.blending).toBe(AdditiveBlending)
    expect(lineMaterial.opacity).toBe(.25)
    expect(Array.from(geometry.getAttribute('tint').array)).toEqual(originalTint)
  }
  geometry.dispose(); lineGeometry.dispose(); modelGeometry.dispose()
  modelMaterial.dispose(); lineMaterial.dispose(); pointsMaterial.dispose()
})
