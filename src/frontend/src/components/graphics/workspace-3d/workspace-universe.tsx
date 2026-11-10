import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Color, Float32BufferAttribute, PMREMGenerator } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { Group } from 'three'
import { useSceneMotion } from '../../../hooks/workspace-3d/use-scene-motion'
import { setPreviewEnvironment, updatePreviewCameraZoom } from '../../../graphics/workspace-3d/preview-scene-runtime'

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}
function Cube({ position, size, color, accent = '#6220de', light, moving, floating = false }: {
  position: [number, number, number]; size: number; color: string; accent?: string; light: boolean; moving: boolean; floating?: boolean
}) {
  const ref = useRef<Group>(null)
  const time = useRef(position[0] * 2)
  const box = useMemo(() => {
    const geometry = new RoundedBoxGeometry(size, size, size, 3, size * .055)
    const positions = geometry.getAttribute('position')
    const base = new Color(color)
    const secondary = new Color(accent)
    const mixed = new Color()
    const colors = new Float32Array(positions.count * 3)
    // Diagonal color blend continues across faces; bevels catch the reflection lights.
    for (let i = 0; i < positions.count; i++) {
      const blend = Math.max(0, Math.min(1, .45 + positions.getX(i) / size * .55 - positions.getY(i) / size * .6))
      mixed.copy(base).lerp(secondary, blend)
      mixed.toArray(colors, i * 3)
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    return geometry
  }, [size, color, accent])
  useEffect(() => () => box.dispose(), [box])
  useFrame((_, delta) => {
    if (!moving || !floating || !ref.current) return
    time.current += Math.min(delta, .05)
    ref.current.position.x = position[0] + Math.cos(time.current * .65) * .23
    ref.current.position.y = position[1] + Math.sin(time.current * 1.1) * .25
    ref.current.position.z = position[2] + Math.sin(time.current * .65) * .3
    ref.current.rotation.y += Math.min(delta, .05) * .5
    ref.current.rotation.x = Math.sin(time.current * .8) * .28
  })
  return <group ref={ref} position={position}>
    <mesh geometry={box}>
      <meshPhysicalMaterial vertexColors roughness={.19} metalness={.38}
        clearcoat={1} clearcoatRoughness={.12} envMapIntensity={light ? .85 : 1.1}
        emissive={color} emissiveIntensity={light ? .015 : .045} />
    </mesh>
  </group>
}
function Scene({ light, moving }: { light: boolean; moving: boolean }) {
  const { camera, size, invalidate, gl, scene } = useThree()
  const rings = useRef<Group>(null)
  const cluster = useRef<Group>(null)
  const sparks = useRef<Group>(null)
  const elapsed = useRef(0)
  useEffect(() => {
    const room = new RoomEnvironment()
    const generator = new PMREMGenerator(gl)
    const reflection = generator.fromScene(room, .04)
    const previous = scene.environment
    setPreviewEnvironment(scene, reflection.texture)
    room.dispose()
    generator.dispose()
    invalidate()
    return () => {
      setPreviewEnvironment(scene, previous)
      reflection.dispose()
    }
  }, [gl, scene, invalidate])
  useLayoutEffect(() => {
    if (updatePreviewCameraZoom(camera, Math.min(size.width / 7.2, size.height / 4.7))) invalidate()
  }, [camera, size, invalidate])
  useFrame((_, delta) => {
    if (!moving) return
    const step = Math.min(delta, .05)
    elapsed.current += step
    if (rings.current) rings.current.rotation.z += step * .45
    if (sparks.current) sparks.current.rotation.z -= step * .14
    if (cluster.current) {
      cluster.current.rotation.y = -.6 + Math.sin(elapsed.current * .4) * .22
      cluster.current.position.y = -.05 + Math.sin(elapsed.current * .8) * .1
    }
  })
  const cyan = light ? '#073bc5' : '#1049df'
  return <>
    <ambientLight intensity={light ? .35 : .22} />
    <directionalLight position={[-3, 6, 4]} intensity={2.8} color="#e3f2ff" />
    <directionalLight position={[2, 1, -3]} intensity={2} color="#32bfff" />
    <pointLight position={[3, 1, 2]} intensity={12} color="#b58aff" />
    <group ref={sparks}>
      {Array.from({ length: 44 }, (_, i) => {
        const angle = i * 2.39996
        const radius = 1.7 + (i % 9) * .17
        return <mesh key={i} position={[Math.cos(angle) * radius * 1.2, Math.sin(angle) * radius * .65, -1.8]} rotation={[0, 0, angle]}>
          <boxGeometry args={[i % 4 === 0 ? .09 : .025, .025, .025]} />
          <meshBasicMaterial color={light ? '#4c75d8' : i % 3 === 0 ? '#b992ff' : '#6aeaff'} transparent opacity={.65} />
        </mesh>
      })}
    </group>
    <group ref={cluster} rotation={[.38, -.6, 0]} position={[0, -.05, 0]}>
      <Cube position={[-.55, -.65, 0]} size={1} color={cyan} light={light} moving={moving} />
      <Cube position={[.55, -.65, 0]} size={1} color="#4c12b8" accent="#cf187b" light={light} moving={moving} />
      <Cube position={[0, .43, -.12]} size={1.18} color="#0085c7" accent="#1237c9" light={light} moving={moving} />
      <Cube position={[-.85, -.7, 1.12]} size={.65} color="#6b16c8" accent="#cd217e" light={light} moving={moving} />
      <Cube position={[.9, -.72, 1.1]} size={.58} color={cyan} light={light} moving={moving} />
      <Cube position={[1.85, .6, -.1]} size={.56} color="#651aca" accent="#c72793" light={light} moving={moving} floating />
      <Cube position={[-1.8, .1, -.3]} size={.38} color={cyan} light={light} moving={moving} floating />
      <Cube position={[-1.3, 1.65, -.65]} size={.22} color="#008da9" accent="#1445c6" light={light} moving={moving} floating />
      <Cube position={[1.5, -1.05, 1.3]} size={.26} color="#7220d4" light={light} moving={moving} floating />
      <Cube position={[-2.5, -.8, -.2]} size={.5} color="#1044ce" light={light} moving={moving} floating />
      <Cube position={[2.3, 1.25, -.9]} size={.36} color="#008db7" accent="#153fc7" light={light} moving={moving} floating />
      <Cube position={[-2.1, 1.25, .1]} size={.48} color="#5614ca" accent="#be247d" light={light} moving={moving} floating />
      <Cube position={[2.6, -.4, -.7]} size={.65} color="#2937c8" light={light} moving={moving} floating />
      <Cube position={[.65, 1.65, -.6]} size={.3} color="#0099b2" accent="#1741ce" light={light} moving={moving} floating />
      <group position={[0, -1.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <group ref={rings}>{[1.8, 2.2, 2.55].map((radius, i) => <mesh key={radius} rotation={[0, 0, i]}>
          <torusGeometry args={[radius, .018, 6, 100, Math.PI * 1.5]} /><meshBasicMaterial color={i === 1 ? '#9670ff' : '#22bdff'} transparent opacity={light ? .55 : .8} />
        </mesh>)}</group>
      </group>
    </group>
  </>
}
export default function WorkspaceUniverse({ light, paused, fallback }: { light: boolean; paused: boolean; fallback: ReactNode }) {
  const { moving } = useSceneMotion()
  const host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [lost, setLost] = useState(false)
  useEffect(() => {
    if (!host.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(host.current); return () => observer.disconnect()
  }, [])
  if (typeof WebGL2RenderingContext === 'undefined' || lost) return fallback
  const active = moving && visible && !paused
  return <Boundary fallback={fallback}><div ref={host} className="workspace-canvas">
    <Canvas orthographic camera={{ position: [0, 0, 8], zoom: 70 }} dpr={[1, 1.5]} frameloop={active ? 'always' : 'demand'}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }} fallback={fallback}
      onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', () => setLost(true), { once: true })}>
      <Scene light={light} moving={active} />
    </Canvas>
  </div></Boundary>
}
