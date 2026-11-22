import { requireDefined } from '../../../utils/required-value'
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, Color, Float32BufferAttribute, NormalBlending, PMREMGenerator } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { Group, Mesh } from 'three'
import { easeSpin, useDragSpin, useSceneMotion } from '../../../hooks/workspace-3d/use-scene-motion'
import { bindShaderUniforms, setNumberUniform, setPreviewCameraOffset, setPreviewEnvironment, updatePreviewCameraZoom } from '../../../graphics/workspace-3d/preview-scene-runtime'

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  override render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// ---------------------------------------------------------------------------------------------
// Bảng màu đọc từ CHÍNH color system của frame (--pv-* nằm trên [data-preview='2d'] và kế thừa
// xuống <canvas>), nên cảnh 3D tự khớp Light/Dark thay vì giữ một bộ hex riêng như bản cũ:
// trước đây nền sáng vẫn nhận tím #cf187b và xanh #1237c9 của nền tối, lệch hẳn với token.
// Fallback chỉ dùng khi không đọc được CSS (ví dụ môi trường không có layout).
// ---------------------------------------------------------------------------------------------
// `deep*` là các bậc đậm của cùng họ màu: khối hộp lấy bậc đậm làm gốc rồi mới blend lên
// sắc sáng ở đỉnh, nếu chỉ lấy token sáng làm gốc thì bề mặt clearcoat rửa cả cụm thành pastel.
type Palette = {
  blue: string; deep: string; deepest: string; violet: string; violetFill: string
  edge: string; cyan: string; pink: string; green: string; amber: string
}

const darkPalette: Palette = {
  blue: '#2f7cf6', deep: '#1f5fd0', deepest: '#123a7d', violet: '#7c5cff', violetFill: '#6b46e0',
  edge: '#4d92ff', cyan: '#22d3ee', pink: '#f472b6', green: '#34d399', amber: '#fbbf24',
}
const lightPalette: Palette = {
  blue: '#2563eb', deep: '#1e40af', deepest: '#172554', violet: '#6d28d9', violetFill: '#5b21b6',
  edge: '#1d4ed8', cyan: '#0891b2', pink: '#be185d', green: '#047857', amber: '#b45309',
}

function readPalette(element: HTMLElement | null, light: boolean): Palette {
  const base = light ? lightPalette : darkPalette
  if (!element) return base
  const styles = getComputedStyle(element)
  // Chỉ nhận giá trị màu đặc: token dạng rgba()/color-mix() sẽ không đọc được vào Color.
  const read = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim()
    return /^#([0-9a-f]{3,8})$/i.test(value) || /^rgba?\(/.test(value) ? value : fallback
  }
  return {
    blue: read('--pv-blue', base.blue),
    deep: read('--pv-fill-deep', base.deep),
    deepest: read('--pv-blue-deeper', base.deepest),
    violet: read('--pv-violet', base.violet),
    violetFill: read('--pv-violet-fill', base.violetFill),
    edge: read('--pv-blue-edge', base.edge),
    cyan: read('--pv-cyan', base.cyan),
    pink: read('--pv-pink', base.pink),
    green: read('--pv-green', base.green),
    amber: read('--pv-orange', base.amber),
  }
}

function Cube({ position, size, from, to, light, moving, floating = false }: {
  position: [number, number, number]; size: number; from: string; to: string; light: boolean; moving: boolean; floating?: boolean
}) {
  const ref = useRef<Group>(null)
  const time = useRef(position[0] * 2)
  const box = useMemo(() => {
    const geometry = new RoundedBoxGeometry(size, size, size, 3, size * .055)
    const positions = geometry.getAttribute('position')
    const base = new Color(from)
    const secondary = new Color(to)
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
  }, [size, from, to])
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
      {/* Nền sáng: bớt phản chiếu + bớt tự phát sáng để khối hộp không bị "rửa" thành trắng. */}
      <meshPhysicalMaterial vertexColors roughness={light ? .3 : .19} metalness={light ? .28 : .38}
        clearcoat={1} clearcoatRoughness={light ? .18 : .12} envMapIntensity={light ? .42 : 1.15}
        emissive={to} emissiveIntensity={light ? .03 : .05} />
    </mesh>
  </group>
}

// Mảnh tinh thể đa diện: chất liệu khác hẳn khối hộp (trong, cạnh phẳng, tự xoay) để cụm có
// nhiều "chất" chứ không phải mười lăm chiếc hộp cùng một kiểu.
function Shard({ position, size, color, light, moving, speed, seed }: {
  position: [number, number, number]; size: number; color: string; light: boolean; moving: boolean; speed: number; seed: number
}) {
  const ref = useRef<Mesh>(null)
  const time = useRef(seed)
  useFrame((_, delta) => {
    if (!moving || !ref.current) return
    const step = Math.min(delta, .05)
    time.current += step
    ref.current.rotation.y += step * speed
    ref.current.rotation.x = Math.sin(time.current * .7 + seed) * .5
    ref.current.position.y = position[1] + Math.sin(time.current * .9 + seed) * .12
  })
  return <mesh ref={ref} position={position}>
    <octahedronGeometry args={[size, 0]} />
    <meshPhysicalMaterial color={color} roughness={.08} metalness={light ? .3 : .16} clearcoat={1} flatShading
      transparent opacity={light ? .92 : .66} envMapIntensity={light ? .5 : 1.25}
      emissive={color} emissiveIntensity={light ? .16 : .22} />
  </mesh>
}

const RING_VERTEX = `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

// Vành không còn là nét kẻ đều cộng một hạt: nó có ĐẦU SÁNG kèm đuôi mờ dần theo chiều quay,
// và tuỳ vành có thêm vạch chia như thước đo. Nhờ vậy mắt đọc được hướng và tốc độ quay chứ
// không chỉ thấy một vòng tròn tĩnh — mỗi vành vì thế cũng có "tính cách" riêng.
const RING_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uHead, uTrail, uTicks, uBase, uAlpha, uDir;
  varying vec2 vLocal;
  const float TAU = 6.2831853;
  void main() {
    float a = fract((atan(vLocal.y, vLocal.x) + 3.14159265) / TAU);
    float head = fract((uHead + 3.14159265) / TAU);
    // uDir = ±1 để đuôi luôn nằm SAU đầu, kể cả khi vành quay ngược hoặc vượt mốc 0/1.
    float behind = fract(uDir * (head - a) + 1.0);
    float comet = pow(1.0 - clamp(behind / max(uTrail, 0.001), 0.0, 1.0), 3.0);
    float ticks = uTicks < 0.5 ? 0.0 : step(0.74, fract(a * uTicks));
    float alpha = (uBase + comet * 0.9 + ticks * (0.3 - comet * 0.22)) * uAlpha;
    gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 1.0));
  }`

function OrbitRing({ radius, tilt, color, light, moving, speed, arc = Math.PI * 2, trail = .3, ticks = 0, base = .16 }: {
  radius: number; tilt: [number, number, number]; color: string; light: boolean; moving: boolean
  speed: number; arc?: number; trail?: number; ticks?: number; base?: number
}) {
  const bead = useRef<Group>(null)
  // Pha ban đầu khác nhau để sáu vành không chạy chồng lên nhau một chỗ.
  const angle = useRef(radius)
  const makeUniforms = useCallback((alpha: number, baseValue: number, tickCount: number) => ({
    uColor: { value: new Color(color) },
    uHead: { value: 0 },
    uTrail: { value: trail },
    uTicks: { value: tickCount },
    uBase: { value: baseValue },
    uAlpha: { value: alpha },
    uDir: { value: speed < 0 ? -1 : 1 },
  }), [color, trail, speed])
  const uniforms = useMemo(() => makeUniforms(light ? .95 : 1, base, ticks), [makeUniforms, light, ticks, base])
  // Lớp quầng: cùng shader nhưng ống to hơn, alpha thấp — tạo cảm giác phát sáng dọc vành
  // thay vì một nét kẻ mảnh gần như vô hình trên nền navy.
  const aura = useMemo(() => makeUniforms(light ? .34 : .38, base * 2.2, 0), [makeUniforms, light, base])
  useFrame((_, delta) => {
    if (!moving) return
    angle.current += Math.min(delta, .05) * speed * 1.6
    setNumberUniform(uniforms.uHead, angle.current)
    setNumberUniform(aura.uHead, angle.current)
    if (bead.current) bead.current.position.set(Math.cos(angle.current) * radius, Math.sin(angle.current) * radius, 0)
  })
  return <group rotation={tilt}>
    <mesh>
      <torusGeometry args={[radius, .085, 6, 150, arc]} />
      <shaderMaterial ref={material => bindShaderUniforms(material, aura)} uniforms={aura} vertexShader={RING_VERTEX} fragmentShader={RING_FRAGMENT}
        transparent depthWrite={false} blending={light ? NormalBlending : AdditiveBlending} />
    </mesh>
    <mesh>
      <torusGeometry args={[radius, .026, 8, 150, arc]} />
      <shaderMaterial ref={material => bindShaderUniforms(material, uniforms)} uniforms={uniforms} vertexShader={RING_VERTEX} fragmentShader={RING_FRAGMENT}
        transparent depthWrite={false} blending={light ? NormalBlending : AdditiveBlending} />
    </mesh>
    <group ref={bead} position={[radius, 0, 0]}>
      <mesh><sphereGeometry args={[.05, 10, 8]} /><meshBasicMaterial color={color} /></mesh>
      {/* Quầng quanh đầu sáng: additive ở nền tối, normal ở nền sáng để không thành chấm loé. */}
      <mesh scale={2.6}>
        <sphereGeometry args={[.05, 10, 8]} />
        <meshBasicMaterial color={color} transparent opacity={light ? .26 : .3} depthWrite={false}
          blending={light ? NormalBlending : AdditiveBlending} />
      </mesh>
    </group>
  </group>
}

const SCREEN_VERTEX = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

const GLOW_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - .5) * 2.0;
    float d = length(p);
    float core = exp(-d * d * 3.4);
    float ring = exp(-pow((d - .62) * 4.6, 2.0)) * .4;
    float alpha = (core + ring) * uAlpha;
    if (alpha < .004) discard;
    gl_FragColor = vec4(uColor, alpha);
  }`

function Scene({ light, moving }: { light: boolean; moving: boolean }) {
  const { camera, size, invalidate, gl, scene } = useThree()
  const palette = useMemo(() => readPalette(gl.domElement, light), [gl, light])
  // Kéo trên canvas để xoay cụm khối; không zoom nên con lăn vẫn dành cho trang.
  const spin = useDragSpin(gl.domElement, invalidate)
  const cluster = useRef<Group>(null)
  const particles = useRef<Group>(null)
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
    const zoom = Math.min(size.width / 7.2, size.height / 4.7)
    if (!updatePreviewCameraZoom(camera, zoom)) return
    // Khối chữ của hero chiếm 51% bề ngang bên trái. Giữ cụm ở tâm khung thì nửa trái của
    // nó nằm dưới chữ — đó chính là cảm giác "cảnh bị lệch". Dịch camera sang trái để nội
    // dung trượt sang phải, vào đúng vùng còn nhìn thấy; kẹp offset theo bán kính vành lớn
    // nhất (3.85) để không cắt mất vành ngoài cùng. Màn hẹp thì không dịch (chữ chiếm cả khung).
    const visibleWidth = size.width / zoom
    const halfCluster = 3.85 / visibleWidth
    const offset = size.width / Math.max(size.height, 1) > 1.35
      ? Math.max(0, Math.min(0.2, 0.47 - halfCluster))
      : 0
    if (setPreviewCameraOffset(camera, -offset * visibleWidth, 0)) invalidate()
  }, [camera, size, invalidate])
  useFrame((_, delta) => {
    const step = Math.min(delta, .05)
    // Tay kéo chạy cả khi cảnh đang tạm dừng (người dùng chủ động kéo thì phải có phản hồi);
    // góc kéo cộng thêm vào nhịp lắc nhẹ nên lúc không chạm vào cảnh vẫn "thở" như trước.
    easeSpin(spin, delta)
    if (cluster.current) {
      cluster.current.rotation.y = -.6 + spin.current.x + (moving ? Math.sin(elapsed.current * .4) * .22 : 0)
      cluster.current.rotation.x = .38 + spin.current.y
    }
    if (!moving) return
    elapsed.current += step
    if (particles.current) {
      particles.current.rotation.z -= step * .14
      // Bụi là khối 3D thật: nghiêng theo cả hai trục kéo, không trượt phẳng trên màn hình.
      particles.current.rotation.y = spin.current.x * .5
      particles.current.rotation.x = spin.current.y * .5
    }
    if (cluster.current) cluster.current.position.y = -.05 + Math.sin(elapsed.current * .8) * .1
  })

  // Quầng sau cụm: nền tối dùng tím đậm + additive để khối hộp tách khỏi nền; nền sáng dùng
  // xanh nhạt với NormalBlending để không thành một mảng bẩn trên giấy trắng.
  const glow = useMemo(() => ({
    uColor: { value: new Color(light ? palette.blue : palette.violet) },
    uAlpha: { value: light ? .44 : .7 },
  }), [light, palette])

  const cubeTones: { position: [number, number, number]; size: number; from: string; to: string; floating?: boolean }[] = [
    { position: [-.55, -.65, 0], size: 1, from: palette.deep, to: palette.blue },
    { position: [.55, -.65, 0], size: 1, from: palette.violetFill, to: palette.pink },
    { position: [0, .43, -.12], size: 1.18, from: palette.deepest, to: palette.cyan },
    { position: [-.85, -.7, 1.12], size: .65, from: palette.violetFill, to: palette.violet },
    { position: [.9, -.72, 1.1], size: .58, from: palette.deep, to: palette.cyan },
    { position: [1.85, .6, -.1], size: .56, from: palette.violet, to: palette.pink, floating: true },
    { position: [-1.8, .1, -.3], size: .38, from: palette.deepest, to: palette.edge, floating: true },
    { position: [-1.3, 1.65, -.65], size: .22, from: palette.cyan, to: palette.blue, floating: true },
    { position: [1.5, -1.05, 1.3], size: .26, from: palette.violetFill, to: palette.deep, floating: true },
    { position: [-2.5, -.8, -.2], size: .5, from: palette.deep, to: palette.violet, floating: true },
    { position: [2.3, 1.25, -.9], size: .36, from: palette.deepest, to: palette.violet, floating: true },
    { position: [-2.1, 1.25, .1], size: .48, from: palette.violetFill, to: palette.pink, floating: true },
    { position: [2.6, -.4, -.7], size: .65, from: palette.deep, to: palette.edge, floating: true },
    { position: [.65, 1.65, -.6], size: .3, from: palette.green, to: palette.cyan, floating: true },
    { position: [1.6, 1.95, .7], size: .34, from: palette.amber, to: palette.pink, floating: true },
    // Vòng ngoài: khung hero rộng ~9 × 4.7 đơn vị (camera ortho), cụm lõi chỉ chiếm giữa nên
    // hai bên và trên/dưới từng là mảng trống. Những khối nhỏ dưới đây lấp vùng rìa và làm
    // bố cục có tầng (gần to · xa nhỏ) thay vì một cục duy nhất ở giữa.
    { position: [-3.15, .95, -.6], size: .42, from: palette.deep, to: palette.edge, floating: true },
    { position: [3.2, -1.05, -.4], size: .38, from: palette.violetFill, to: palette.pink, floating: true },
    { position: [-3.0, -1.35, -.9], size: .3, from: palette.deepest, to: palette.cyan, floating: true },
    { position: [2.95, 1.7, -.8], size: .3, from: palette.deep, to: palette.violet, floating: true },
    { position: [-2.6, 2.0, -.7], size: .26, from: palette.violet, to: palette.pink, floating: true },
    { position: [.1, 2.15, -1.0], size: .28, from: palette.deepest, to: palette.edge, floating: true },
    { position: [-.2, -1.95, .9], size: .24, from: palette.cyan, to: palette.blue, floating: true },
    { position: [1.95, -1.8, .6], size: .3, from: palette.violetFill, to: palette.violet, floating: true },
  ]
  const shards: { position: [number, number, number]; size: number; color: string; speed: number; seed: number }[] = [
    { position: [-1.15, .95, .78], size: .3, color: palette.cyan, speed: .5, seed: .7 },
    { position: [1.25, 1.15, .92], size: .24, color: palette.green, speed: -.42, seed: 2.1 },
    { position: [-.2, 1.55, .88], size: .2, color: palette.amber, speed: .6, seed: 3.4 },
    { position: [1.95, -.9, .45], size: .28, color: palette.violet, speed: -.35, seed: 4.2 },
    { position: [-2.25, .55, .95], size: .22, color: palette.pink, speed: .48, seed: 5.6 },
    { position: [.35, -1.42, 1.5], size: .3, color: palette.blue, speed: -.55, seed: 6.3 },
    { position: [-3.25, .3, .55], size: .26, color: palette.pink, speed: .44, seed: 7.1 },
    { position: [3.15, .75, .5], size: .22, color: palette.green, speed: -.5, seed: 8.4 },
    { position: [2.2, 2.05, .3], size: .18, color: palette.amber, speed: .62, seed: 9.2 },
    { position: [-2.0, -1.95, .8], size: .2, color: palette.cyan, speed: -.38, seed: 10.5 },
  ]

  return <>
    <mesh position={[0, 0, -2.4]} scale={[7.4, 5, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial ref={material => bindShaderUniforms(material, glow)} uniforms={glow} vertexShader={SCREEN_VERTEX} fragmentShader={GLOW_FRAGMENT}
        transparent depthWrite={false} blending={light ? NormalBlending : AdditiveBlending} />
    </mesh>
    {/* Nền sáng không được "đốt" khối hộp: tổng cường độ thấp hơn hẳn nền tối, nếu không bề mặt
        clearcoat bị cháy trắng và mọi sắc màu trong palette đều bạc đi. */}
    <ambientLight intensity={light ? .3 : .22} />
    <directionalLight position={[-3, 6, 4]} intensity={light ? 1.55 : 2.8} color={light ? '#ffffff' : '#e3f2ff'} />
    <directionalLight position={[2, 1, -3]} intensity={light ? .95 : 2} color={palette.cyan} />
    <pointLight position={[3, 1, 2]} intensity={light ? 5.5 : 12} color={palette.violet} />
    <group ref={particles}>
      {Array.from({ length: 84 }, (_, i) => {
        const angle = i * 2.39996
        // Bán kính trải tới ~4 đơn vị: trường hạt phủ cả vùng rìa của khung hero.
        const radius = 1.7 + (i % 12) * .2
        // Vài hạt là vệt dài, phần còn lại là điểm — trường hạt không còn đều tăm tắp.
        const streak = i % 4 === 0
        const color = [palette.cyan, palette.violet, palette.pink, palette.blue][i % 4]
        return <mesh key={i} position={[Math.cos(angle) * radius * 1.2, Math.sin(angle) * radius * .65, -2.6 + (i % 7) * .38]}
          rotation={[0, 0, angle]}>
          <boxGeometry args={[streak ? .09 : .025, .025, .025]} />
          <meshBasicMaterial color={color ?? '#ffffff'} transparent opacity={light ? .62 : .65} />
        </mesh>
      })}
    </group>
    <group ref={cluster} rotation={[.38, -.6, 0]} position={[0, -.05, 0]}>
      {cubeTones.map((cube, index) => <Cube key={index} {...cube} light={light} moving={moving} />)}
      {shards.map((shard, index) => <Shard key={`shard-${index}`} {...shard} light={light} moving={moving} />)}
      <group position={[0, -1.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        {/* Sáu vành, mỗi vành một tính cách: thước chia vạch, đuôi dài, đuôi ngắn, vành lớn
            mờ quay chậm. Tất cả dùng chung một shader nên vẫn đồng nhất về vật liệu. */}
        <OrbitRing radius={1.8} tilt={[0, 0, 0]} color={palette.cyan} light={light} moving={moving} speed={.45} ticks={48} trail={.22} base={.14} />
        <OrbitRing radius={2.2} tilt={[.28, .18, 0]} color={palette.violet} light={light} moving={moving} speed={-.3} arc={Math.PI * 1.4} trail={.55} base={.12} />
        <OrbitRing radius={2.55} tilt={[-.22, .3, 0]} color={palette.pink} light={light} moving={moving} speed={.22} arc={Math.PI * 1.25} ticks={18} trail={.3} base={.15} />
        <OrbitRing radius={2.95} tilt={[.12, -.24, 0]} color={palette.blue} light={light} moving={moving} speed={-.16} trail={.16} base={.13} />
        {/* Hai vành lớn gần như chạm mép khung: vẽ tiếp phần trống ở trên/dưới cụm lõi. */}
        <OrbitRing radius={3.45} tilt={[.34, -.1, 0]} color={palette.cyan} light={light} moving={moving} speed={.12} arc={Math.PI * 1.1} trail={.6} base={.1} />
        <OrbitRing radius={3.85} tilt={[-.3, .22, 0]} color={palette.violet} light={light} moving={moving} speed={-.09} arc={Math.PI * 1.35} ticks={72} trail={.4} base={.08} />
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
    const observer = new IntersectionObserver(([entry]) => setVisible(requireDefined(entry, 'workspace-universe.tsx:136').isIntersecting))
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
