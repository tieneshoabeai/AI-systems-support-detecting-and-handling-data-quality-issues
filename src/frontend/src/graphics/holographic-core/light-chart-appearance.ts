import { LineBasicMaterial, MeshBasicMaterial, NormalBlending, ShaderMaterial, type Object3D } from 'three'
import { isDrawable } from '../common/typed-objects'

// Apply only to the background star chart, never the product model or satellites.
export function applyLightChartAppearance(background: Object3D): () => void {
  const restores: Array<() => void> = []
  background.traverse(object => {
    if (!isDrawable(object)) return
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const { blending, opacity } = material
      material.blending = NormalBlending
      material.opacity = Math.min(.65, opacity * 1.4)
      material.needsUpdate = true
      restores.push(() => { material.blending = blending; material.opacity = opacity; material.needsUpdate = true })
      if (material instanceof MeshBasicMaterial || material instanceof LineBasicMaterial) {
        const original = material.color.clone()
        material.color.set('#5075b5')
        restores.push(() => material.color.copy(original))
      }
      if (material instanceof ShaderMaterial) {
        const uniform: { value: unknown } | undefined = material.uniforms['uOpacity']
        if (uniform && typeof uniform.value === 'number') {
          const original = uniform.value
          uniform.value = Math.min(1, original * 1.5)
          restores.push(() => { uniform.value = original })
        }
      }
    }
    const tint = object.geometry.getAttribute('tint')
    if (tint) {
      const original = new Float32Array(tint.count * 3)
      for (let index = 0; index < tint.count; index++) {
        const r = tint.getX(index), g = tint.getY(index), b = tint.getZ(index)
        original.set([r, g, b], index * 3)
        tint.setXYZ(index, r * .18, g * .26, b * .48)
      }
      tint.needsUpdate = true
      restores.push(() => {
        for (let index = 0; index < tint.count; index++) tint.setXYZ(index, original[index * 3]!, original[index * 3 + 1]!, original[index * 3 + 2]!)
        tint.needsUpdate = true
      })
    }
  })
  return () => restores.reverse().forEach(restore => restore())
}
