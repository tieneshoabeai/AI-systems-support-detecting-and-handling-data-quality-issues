import { useEffect, useState } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Mesh, type Material, type Object3D, type ShaderMaterial, type Vector2 } from 'three'
import { NEON_CUBE_THEMES } from '../../../graphics/neon-cube/neon-cube.model'
import type { NeonCubeThemeId } from '../../../types/dataset-3d/cube-focus.types'
import { CUBE_LABEL_ASPECT, CUBE_LABEL_LAYOUT } from '../../../graphics/holographic-core/cube-label-layout'
import { createCubeLabelTexture, loadCubeLabelFont } from '../../../graphics/holographic-core/cube-label-texture'
import {
  CUBE_GLASS_GLOW_PADDING, CUBE_GLASS_LAYER, createCubeGlassGlowMaterial, createCubeGlassMaterial,
  type GlassFrame,
} from '../../../graphics/holographic-core/liquid-glass-pass'

const ignoreRaycast = () => {}

function isVisible(object: Object3D | null): boolean {
  return !object || (object.visible && isVisible(object.parent))
}

function writesDepth(material: Material | undefined) {
  return material?.visible && material.depthWrite
}

function isInsideGlass(uv: Vector2 | undefined) {
  if (!uv) return false
  const x = Math.max(Math.abs(uv.x - 0.5) * CUBE_LABEL_ASPECT - (CUBE_LABEL_ASPECT / 2 - 0.2), 0)
  const y = Math.max(Math.abs(uv.y - 0.5) - 0.3, 0)
  return Math.hypot(x, y) <= 0.2
}

function CubeLabel({ layout, frame, onFocus }: {
  layout: (typeof CUBE_LABEL_LAYOUT)[number]
  frame: GlassFrame
  onFocus(theme: NeonCubeThemeId): void
}) {
  const { theme, width, height, roof, center, yaw, front } = layout
  const { scene, raycaster } = useThree()
  const [materials, setMaterials] = useState<{ glass: ShaderMaterial; glow: ShaderMaterial } | null>(null)
  useEffect(() => {
    let active = true
    let dispose = () => {}
    void loadCubeLabelFont().then(() => {
      if (!active) return
      const texture = createCubeLabelTexture(theme)
      if (!texture) return
      const color = NEON_CUBE_THEMES[theme].glow
      const glass = createCubeGlassMaterial(frame, texture, color, height)
      const glow = createCubeGlassGlowMaterial(frame, color)
      dispose = () => {
        glass.dispose()
        glow.dispose()
        texture.dispose()
      }
      setMaterials({ glass, glow })
    })
    return () => { active = false; dispose() }
  }, [frame, height, theme])

  const focusLabel = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 6 || !isInsideGlass(event.uv) || event.ray.direction.dot(front) >= 0) return
    const blocked = raycaster.intersectObjects(scene.children, true).some(hit => {
      if (hit.distance >= event.distance - 0.001 || !(hit.object instanceof Mesh) || !isVisible(hit.object)) return false
      if (hit.object.layers.isEnabled(CUBE_GLASS_LAYER)) return isInsideGlass(hit.uv)
      const material = hit.object.material
      return writesDepth(Array.isArray(material) ? material[hit.face?.materialIndex ?? 0] : material)
    })
    if (blocked) return
    event.stopPropagation()
    onFocus(theme)
  }

  const glow = NEON_CUBE_THEMES[theme].glow
  const glowPadding = 2 * height * CUBE_GLASS_GLOW_PADDING
  const labelCenterY = center.y - roof
  return <group name={`cube-label-${theme}`} position={[center.x, roof, center.z]} rotation-y={yaw}>
    {materials && <>
      <mesh position-y={labelCenterY} layers-mask={1 << CUBE_GLASS_LAYER} material={materials.glass} onClick={focusLabel}>
        <planeGeometry args={[width, height]} />
      </mesh>
      <mesh position-y={labelCenterY} layers-mask={1 << CUBE_GLASS_LAYER} material={materials.glow} raycast={ignoreRaycast}>
        <planeGeometry args={[width + glowPadding, height + glowPadding]} />
      </mesh>
    </>}
    <mesh position-y={0.01} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.078, 0.105, 24]} />
      <meshBasicMaterial color={glow} />
    </mesh>
    <mesh position-y={0.025}>
      <sphereGeometry args={[0.031, 12, 8]} />
      <meshBasicMaterial color={glow} />
    </mesh>
  </group>
}

export function CubeLabels({ frame, onFocus }: { frame: GlassFrame; onFocus(theme: NeonCubeThemeId): void }) {
  const raycaster = useThree(state => state.raycaster)
  useEffect(() => {
    raycaster.layers.enable(CUBE_GLASS_LAYER)
    return () => { raycaster.layers.disable(CUBE_GLASS_LAYER) }
  }, [raycaster])
  return <>{CUBE_LABEL_LAYOUT.map(layout => <CubeLabel key={layout.theme} layout={layout} frame={frame} onFocus={onFocus} />)}</>
}
