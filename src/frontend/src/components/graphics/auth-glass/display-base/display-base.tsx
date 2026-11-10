import { useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeElements } from '@react-three/fiber'
import { AdditiveBlending } from 'three'
import type { Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, SpriteMaterial } from 'three'
import { displayBaseGlints, displayBaseOptions } from '../../../../graphics/auth-glass/display-base/display-base.config'
import type { DisplayBaseFootlights, DisplayBaseOptions } from '../../../../graphics/auth-glass/display-base/display-base.config'
import { createBaseRingGeometry, createBaseTierGeometry } from '../../../../graphics/auth-glass/display-base/display-base.geometry'
import { createBaseFloorFade, createBaseGlint, createBaseGlow } from '../../../../graphics/auth-glass/display-base/display-base.lighting'
import { useBaseEnvironment } from './use-base-environment'

export function DisplayBase({ options = displayBaseOptions, login, register, footlights, turntable, children, low = false }: {
  options?: DisplayBaseOptions
  login?: ReactNode
  register?: ReactNode
  footlights?: DisplayBaseFootlights
  turntable?: Pick<ThreeElements['group'], 'ref' | 'onPointerDown'>
  children?: ReactNode
  low?: boolean
}) {
  const environment = useBaseEnvironment(low)
  const invalidate = useThree(state => state.invalidate)
  const ringMaterial = useRef<MeshBasicMaterial>(null)
  const warmMaterial = useRef<SpriteMaterial>(null)
  const floorGlowMesh = useRef<Mesh<PlaneGeometry, ShaderMaterial>>(null)
  const haloMesh = useRef<Mesh<PlaneGeometry, ShaderMaterial>>(null)
  const { effects } = options
  const motion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), [])
  const resources = useMemo(() => {
    const [upper, middle, lower] = options.tiers
    const tops = [0, -upper.height, -upper.height - middle.height]
    const tiers = options.tiers.map((tier, index) => ({
      ...tier,
      geometry: createBaseTierGeometry(tier, tops[index], options.radialSegments, options.bevelSegments),
    }))
    return {
      tiers,
      ring: createBaseRingGeometry(lower.radius, options.ring, options.radialSegments),
      ringY: tops[2] - lower.height / 2,
      upperRing: effects.upperRing && !low
        ? createBaseRingGeometry(upper.radius, { ...options.ring, tube: options.ring.tube * 0.55 }, options.radialSegments)
        : null,
      inlay: createBaseGlow('inlay', upper.radius - 0.04, 0.30, false, footlights),
      floorFade: createBaseFloorFade(),
      floorGlow: createBaseGlow('floor', 3.1, low ? 0.18 : 0.36, effects.ripples && !low),
      halo: low ? null : createBaseGlow('halo', lower.radius + 0.28, effects.bloomStrength, false),
      glint: low ? null : createBaseGlint(),
    }
  }, [options, effects, footlights, low])

  useEffect(() => () => {
    for (const tier of resources.tiers) tier.geometry.dispose()
    resources.ring.dispose()
    resources.upperRing?.dispose()
    resources.inlay.dispose()
    resources.floorFade.dispose()
    resources.floorGlow.dispose()
    resources.halo?.dispose()
    resources.glint?.dispose()
  }, [resources])

  useEffect(() => {
    const update = () => invalidate()
    motion.addEventListener('change', update)
    return () => motion.removeEventListener('change', update)
  }, [invalidate, motion])

  useFrame(({ clock }) => {
    if (low) return
    const moving = effects.animate && !motion.matches
    const time = moving ? clock.elapsedTime : 0
    if (floorGlowMesh.current) floorGlowMesh.current.material.uniforms.uTime.value = time % 4
    if (haloMesh.current) haloMesh.current.material.uniforms.uTime.value = time
    ringMaterial.current?.color.setScalar(0.93 + 0.07 * Math.cos(time * 1.2))
    if (warmMaterial.current) {
      const opacity = displayBaseGlints[0].opacity
      warmMaterial.current.opacity = moving ? opacity - 0.05 + Math.sin(time * 2.3) * 0.05 : opacity
    }
    if (moving) invalidate()
  })

  const radius = options.tiers[2].radius
  return <group name="DisplayBase">
    <mesh name="floor" position-y={options.floor.y} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[options.floor.size, options.floor.size]} />
      <meshPhysicalMaterial color={options.floor.color} roughness={0.60} metalness={0.24}
        envMap={environment} envMapIntensity={0.15} alphaMap={resources.floorFade} transparent depthWrite={false} />
    </mesh>
    <mesh ref={floorGlowMesh} name="floor-glow" position-y={options.floor.y + 0.004} rotation-x={-Math.PI / 2}
      material={resources.floorGlow} renderOrder={1}>
      <planeGeometry args={[6.2, 6.2]} />
    </mesh>
    <group name="DisplayTurntable" {...turntable}>
    {resources.tiers.map(({ name, geometry, color }) => (
      <mesh key={name} name={name} geometry={geometry}>
        <meshPhysicalMaterial color={color} roughness={0.24} metalness={0.52} specularIntensity={0.34}
          clearcoat={0.48} clearcoatRoughness={0.23} envMap={environment} envMapIntensity={0.24} />
      </mesh>
    ))}
    <mesh name="ring-lower" geometry={resources.ring} position-y={resources.ringY} rotation-x={-Math.PI / 2}>
      <meshBasicMaterial ref={ringMaterial} vertexColors toneMapped={false} />
    </mesh>
    {resources.upperRing && <mesh name="ring-upper" geometry={resources.upperRing} position-y={-0.05} rotation-x={-Math.PI / 2}>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </mesh>}
    <mesh name="top-inlay" position-y={0.003} rotation-x={-Math.PI / 2} material={resources.inlay} renderOrder={2}>
      <planeGeometry args={[(options.tiers[0].radius - 0.04) * 2, (options.tiers[0].radius - 0.04) * 2]} />
    </mesh>
    {resources.halo && <mesh ref={haloMesh} name="ring-halo" position-y={resources.ringY} rotation-x={-Math.PI / 2}
      material={resources.halo} renderOrder={2}>
      <planeGeometry args={[(radius + 0.28) * 2, (radius + 0.28) * 2]} />
    </mesh>}
    {resources.glint && displayBaseGlints.map(({ color, size, opacity }, index) => {
      const step = 2 * Math.PI / displayBaseGlints.length
      const angle = Math.PI / 2 - step / 2 + index * step
      return <sprite key={color} name={`glint-${index + 1}`}
        position={[radius * Math.cos(angle), resources.ringY + 0.05, radius * Math.sin(angle)]}
        scale={[size, size * 1.27, 1]} renderOrder={3}>
        <spriteMaterial ref={index === 0 ? warmMaterial : undefined} map={resources.glint} color={color}
          opacity={opacity} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
    })}
    <group name="socket-login" position={options.sockets.login}>
      <group position-y={-options.sockets.embed}>{login}</group>
    </group>
    <group name="socket-register" position={options.sockets.register}>
      <group position-y={-options.sockets.embed}>{register}</group>
    </group>
    {children}
    </group>
  </group>
}
