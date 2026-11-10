import { useEffect, useMemo } from 'react'
import type { RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { SRGBColorSpace, Texture } from 'three'
import pageBackground from '../../../assets/background.svg'
import { createAuthBackdropMaterial } from '../../../graphics/auth-glass/auth-glass.materials'

export function AuthGlassBackdrop({ pageElement }: { pageElement?: RefObject<HTMLElement | null> }) {
  const canvas = useThree(state => state.gl.domElement)
  const invalidate = useThree(state => state.invalidate)
  const material = useMemo(() => createAuthBackdropMaterial(), [])

  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    const page = pageElement?.current
    if (!page) return
    const image = new Image()
    const texture = new Texture(image)
    texture.colorSpace = SRGBColorSpace
    const uniforms = material.uniforms

    function updateCrop() {
      if (!page || !image.naturalWidth || !image.naturalHeight) return
      const pageBounds = page.getBoundingClientRect()
      const canvasBounds = canvas.getBoundingClientRect()
      if (!pageBounds.width || !pageBounds.height || !canvasBounds.width || !canvasBounds.height) return

      // Mirror CSS background-size: cover and background-position: center.
      const scale = Math.max(pageBounds.width / image.naturalWidth, pageBounds.height / image.naturalHeight)
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      const left = (pageBounds.width - width) / 2
      const top = (pageBounds.height - height) / 2
      uniforms.uPageBackdropUv.value.set(
        (canvasBounds.left - pageBounds.left - left) / width,
        1 - (canvasBounds.bottom - pageBounds.top - top) / height,
        canvasBounds.width / width,
        canvasBounds.height / height,
      )
      invalidate()
    }

    function showBackdrop() {
      texture.needsUpdate = true
      uniforms.tPageBackdrop.value = texture
      uniforms.uHasPageBackdrop.value = true
      updateCrop()
    }

    const observer = new ResizeObserver(updateCrop)
    observer.observe(page)
    observer.observe(canvas)
    window.addEventListener('resize', updateCrop)
    image.addEventListener('load', showBackdrop)
    image.src = pageBackground

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateCrop)
      image.removeEventListener('load', showBackdrop)
      uniforms.tPageBackdrop.value = null
      uniforms.uHasPageBackdrop.value = false
      texture.dispose()
    }
  }, [canvas, invalidate, material, pageElement])

  return <mesh name="Backdrop" frustumCulled={false} renderOrder={-100} material={material}>
    <planeGeometry args={[2, 2]} />
  </mesh>
}
