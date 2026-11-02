import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  PointsMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three'
import type { Group, Scene, Texture } from 'three'

// The reference environment is only a few soft layers: a navy radial wash, a horizon glow,
// sparse dust, vertical light shafts and a faint reflective floor. Everything stays dimmer
// than the subject, but the glow band needs enough presence to read against pure black.
const RAY_PLAN = [
  { x: -6.6, y: 3.8, width: 1.9, height: 8.6, color: '#1f8ce6', opacity: 0.09, phase: 0.4 },
  { x: -2.6, y: 4.2, width: 2.6, height: 9.2, color: '#22d3ff', opacity: 0.075, phase: 2.1 },
  { x: 2.8, y: 3.9, width: 2.0, height: 8.8, color: '#2f7dff', opacity: 0.09, phase: 3.6 },
  { x: 6.6, y: 4.2, width: 1.5, height: 8.0, color: '#22d3ff', opacity: 0.07, phase: 5.2 },
  // Wide veil that sits directly behind the core and lifts the centre of the backdrop.
  { x: 0.2, y: 4.0, width: 3.2, height: 9.4, color: '#2f8fd6', opacity: 0.04, phase: 1.2 },
]

const RAY_DISTANCE = 28

const disableRaycast = () => {}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function toTexture(canvas: HTMLCanvasElement) {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function createBackdropTexture() {
  const width = 1024
  const height = 576
  const canvas = makeCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas is unavailable for the holographic backdrop')
  const centerX = width / 2
  const base = context.createRadialGradient(centerX, height * 0.42, 0, centerX, height * 0.42, width * 0.75)
  base.addColorStop(0, '#04121f')
  base.addColorStop(0.5, '#02101c')
  base.addColorStop(0.75, '#01060d')
  base.addColorStop(1, '#000000')
  context.fillStyle = base
  context.fillRect(0, 0, width, height)

  // Wide elliptical glow behind the pedestal, then a softer horizon core inside it.
  context.save()
  context.translate(width * 0.5, height * 0.68)
  context.scale(2, 0.55)
  const wash = context.createRadialGradient(0, 0, 0, 0, 0, width * 0.5)
  wash.addColorStop(0, 'rgba(16, 120, 160, 0.30)')
  wash.addColorStop(0.55, 'rgba(12, 90, 130, 0.12)')
  wash.addColorStop(1, 'rgba(16, 120, 160, 0)')
  context.fillStyle = wash
  context.fillRect(-width, -height, width * 2, height * 2)
  context.restore()

  context.save()
  context.translate(width * 0.5, height * 0.685)
  context.scale(3, 0.1)
  const core = context.createRadialGradient(0, 0, 0, 0, 0, width * 0.5)
  core.addColorStop(0, 'rgba(110, 210, 240, 0.10)')
  core.addColorStop(1, 'rgba(110, 210, 240, 0)')
  context.fillStyle = core
  context.fillRect(-width, -height, width * 2, height * 2)
  context.restore()

  const veil = context.createLinearGradient(0, 0, width, 0)
  veil.addColorStop(0, 'rgba(30, 110, 170, 0)')
  veil.addColorStop(0.5, 'rgba(30, 110, 170, 0.05)')
  veil.addColorStop(1, 'rgba(30, 110, 170, 0)')
  context.fillStyle = veil
  context.fillRect(0, 0, width, height)
  return toTexture(canvas)
}

// Vertical shaft mask: bright through the middle band, feathered on every edge.
function createRayTexture() {
  const canvas = makeCanvas(64, 256)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas is unavailable for the holographic rays')
  const vertical = context.createLinearGradient(0, 0, 0, 256)
  vertical.addColorStop(0, 'rgba(255, 255, 255, 0)')
  vertical.addColorStop(0.22, 'rgba(255, 255, 255, 0.22)')
  vertical.addColorStop(0.5, 'rgba(255, 255, 255, 0.75)')
  vertical.addColorStop(0.78, 'rgba(255, 255, 255, 0.28)')
  vertical.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = vertical
  context.fillRect(0, 0, 64, 256)
  const horizontal = context.createLinearGradient(0, 0, 64, 0)
  horizontal.addColorStop(0, 'rgba(255, 255, 255, 0)')
  horizontal.addColorStop(0.5, 'rgba(255, 255, 255, 1)')
  horizontal.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.globalCompositeOperation = 'destination-in'
  context.fillStyle = horizontal
  context.fillRect(0, 0, 64, 256)
  return toTexture(canvas)
}

// One radial spill, a restrained perspective grid and two whisper-thin arcs that echo
// the base halo as a floor reflection.
function createGroundTexture() {
  const size = 1024
  const canvas = makeCanvas(size, size)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas is unavailable for the holographic ground')
  const center = size / 2
  const glow = context.createRadialGradient(center, center, 0, center, center, center)
  glow.addColorStop(0, 'rgba(70, 60, 190, 0.30)')
  glow.addColorStop(0.35, 'rgba(48, 40, 140, 0.15)')
  glow.addColorStop(0.75, 'rgba(14, 18, 70, 0)')
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, size, size)

  // The grid lives on its own layer so the radial fade can erase it without dimming the glow.
  const grid = makeCanvas(size, size)
  const gridContext = grid.getContext('2d')
  if (!gridContext) throw new Error('2D canvas is unavailable for the holographic floor grid')
  gridContext.strokeStyle = 'rgba(140, 235, 255, 0.07)'
  gridContext.lineWidth = 1.5
  const step = size * 0.035
  const lines = Math.ceil(center / step)
  for (let index = -lines; index <= lines; index += 1) {
    const position = center + index * step
    gridContext.beginPath()
    gridContext.moveTo(position, 0)
    gridContext.lineTo(position, size)
    gridContext.stroke()
    gridContext.beginPath()
    gridContext.moveTo(0, position)
    gridContext.lineTo(size, position)
    gridContext.stroke()
  }
  const fade = gridContext.createRadialGradient(center, center, 0, center, center, center)
  fade.addColorStop(0, 'rgba(255, 255, 255, 1)')
  fade.addColorStop(0.34, 'rgba(255, 255, 255, 1)')
  fade.addColorStop(0.55, 'rgba(255, 255, 255, 0)')
  fade.addColorStop(1, 'rgba(255, 255, 255, 0)')
  gridContext.globalCompositeOperation = 'destination-in'
  gridContext.fillStyle = fade
  gridContext.fillRect(0, 0, size, size)
  context.drawImage(grid, 0, 0)

  context.strokeStyle = 'rgba(178, 140, 255, 0.16)'
  context.shadowColor = 'rgba(178, 140, 255, 0.5)'
  context.shadowBlur = 6
  context.lineWidth = 3
  for (const radius of [0.258, 0.305]) {
    context.beginPath()
    context.arc(center, center, center * radius, 0, Math.PI * 2)
    context.stroke()
  }
  return toTexture(canvas)
}

function createDustTexture() {
  const size = 32
  const canvas = makeCanvas(size, size)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas is unavailable for the holographic dust')
  const glow = context.createRadialGradient(16, 16, 0, 16, 16, 16)
  glow.addColorStop(0, 'rgba(255, 255, 255, 1)')
  glow.addColorStop(0.35, 'rgba(255, 255, 255, 0.6)')
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, size, size)
  return toTexture(canvas)
}

function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function setSceneBackground(scene: Scene, texture: Texture | null) {
  scene.background = texture
}

function Backdrop({ texture }: { texture: Texture }) {
  const scene = useThree(state => state.scene)
  useEffect(() => {
    setSceneBackground(scene, texture)
    return () => setSceneBackground(scene, null)
  }, [scene, texture])
  return null
}

type DustLayerProps = {
  seed: number
  count: number
  size: number
  opacity: number
  spread: number
  height: number
  speed: number
  map: Texture
  reducedMotion: boolean
}

function DustLayer({ seed, count, size, opacity, spread, height, speed, map, reducedMotion }: DustLayerProps) {
  const geometry = useMemo(() => {
    const random = createRandom(seed)
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const cyan = new Color('#7be9ff')
    const electric = new Color('#2f7dff')
    const tint = new Color()
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (random() - 0.5) * spread * 2
      positions[index * 3 + 1] = -0.4 + random() * height
      positions[index * 3 + 2] = (random() - 0.5) * spread * 2
      tint.copy(cyan).lerp(electric, random())
      colors[index * 3] = tint.r
      colors[index * 3 + 1] = tint.g
      colors[index * 3 + 2] = tint.b
    }
    const value = new BufferGeometry()
    value.setAttribute('position', new BufferAttribute(positions, 3))
    value.setAttribute('color', new BufferAttribute(colors, 3))
    return value
  }, [count, height, seed, spread])

  const phases = useMemo(() => {
    const random = createRandom(seed + 977)
    return Float32Array.from({ length: count }, () => random() * Math.PI * 2)
  }, [count, seed])

  const speedVariation = useMemo(() => {
    const random = createRandom(seed + 1511)
    return Float32Array.from({ length: count }, () => 0.55 + random() * 0.9)
  }, [count, seed])

  const material = useMemo(() => new PointsMaterial({
    map,
    size,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity,
    alphaTest: 0.01,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  }), [map, opacity, size])

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  useFrame(({ clock }, delta) => {
    if (reducedMotion) return
    const attribute = geometry.getAttribute('position') as BufferAttribute
    const array = attribute.array as Float32Array
    const elapsed = clock.elapsedTime
    for (let index = 0; index < count; index += 1) {
      const at = index * 3
      array[at + 1] += delta * speed * speedVariation[index]
      if (array[at + 1] > height - 0.4) array[at + 1] = -0.4
      array[at] += Math.sin(elapsed * 0.18 + phases[index]) * delta * 0.02
      array[at + 2] += Math.cos(elapsed * 0.14 + phases[index]) * delta * 0.02
    }
    attribute.needsUpdate = true
  })

  return <points geometry={geometry} material={material} renderOrder={3} raycast={disableRaycast} frustumCulled={false} />
}

function VolumetricRays({ texture, reducedMotion }: { texture: Texture; reducedMotion: boolean }) {
  const group = useRef<Group>(null)
  const forward = useMemo(() => new Vector3(), [])
  useFrame(({ camera, clock }) => {
    const holder = group.current
    if (!holder) return
    camera.getWorldDirection(forward)
    holder.position.copy(camera.position).addScaledVector(forward, RAY_DISTANCE)
    holder.quaternion.copy(camera.quaternion)
    if (reducedMotion) return
    holder.children.forEach((child, index) => {
      child.position.x = RAY_PLAN[index].x + Math.sin(clock.elapsedTime * 0.12 + RAY_PLAN[index].phase) * 0.35
    })
  })
  return <group ref={group} renderOrder={-5}>
    {RAY_PLAN.map(ray => <mesh key={ray.color + ray.x} position={[ray.x, ray.y, 0]}
      renderOrder={-5} raycast={disableRaycast} frustumCulled={false}>
      <planeGeometry args={[ray.width, ray.height]} />
      <meshBasicMaterial map={texture} color={ray.color} transparent opacity={ray.opacity}
        blending={AdditiveBlending} depthWrite={false} depthTest={false} side={DoubleSide}
        toneMapped={false} fog={false} />
    </mesh>)}
  </group>
}

function GroundGlow({ texture }: { texture: Texture }) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} renderOrder={0} raycast={disableRaycast}>
    <circleGeometry args={[12, 72]} />
    <meshBasicMaterial map={texture} transparent opacity={1} blending={AdditiveBlending}
      depthWrite={false} toneMapped={false} fog={false} />
  </mesh>
}

export function HolographicEnvironment({ reducedMotion }: { reducedMotion: boolean }) {
  const textures = useMemo(() => ({
    backdrop: createBackdropTexture(),
    ray: createRayTexture(),
    ground: createGroundTexture(),
    dust: createDustTexture(),
  }), [])

  useEffect(() => () => {
    textures.backdrop.dispose()
    textures.ray.dispose()
    textures.ground.dispose()
    textures.dust.dispose()
  }, [textures])

  return <>
    <Backdrop texture={textures.backdrop} />
    <VolumetricRays texture={textures.ray} reducedMotion={reducedMotion} />
    <GroundGlow texture={textures.ground} />
    <DustLayer seed={17} count={120} size={0.05} opacity={0.5} spread={12} height={9.4} speed={0.1} map={textures.dust} reducedMotion={reducedMotion} />
    <DustLayer seed={41} count={80} size={0.022} opacity={1} spread={10} height={8.6} speed={0.16} map={textures.dust} reducedMotion={reducedMotion} />
    <DustLayer seed={73} count={14} size={0.09} opacity={0.22} spread={13} height={10} speed={0.07} map={textures.dust} reducedMotion={reducedMotion} />
  </>
}
