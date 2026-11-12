import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide, NormalBlending } from 'three'
import type { Group, Mesh } from 'three'
import { useSceneMotion } from '../../../hooks/workspace-3d/use-scene-motion'
import { setNumberUniform, updatePreviewCameraZoom } from '../../../graphics/workspace-3d/preview-scene-runtime'
import { HeroSpaceHole } from './hero-space-hole'

class UniverseBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// ---------------------------------------------------------------------------------------------
// Cảnh hero được vẽ hoàn toàn bằng shader (không dùng đèn của Three) để:
//   · khối cầu luôn có vùng sáng/tối nhất quán dù theme đổi — MeshStandardMaterial bị đèn
//     trắng rửa nhạt trên nền sáng, đó chính là lý do bản cũ phải khai hai bảng màu thủ công;
//   · mọi màu đi qua một uniform uMix (0 = dark, 1 = light) nên chuyển theme là lerp mượt,
//     không có cú nhảy màu giữa hai bảng palette.
// Bảng màu lấy đúng hệ token của frame: xanh #2f7cf6, cyan #22d3ee, violet #7c5cff,
// amber #fbbf24, hồng #f472b6, xanh lá #34d399; bản light dùng sắc đậm hơn một bậc để
// không bị chìm vào nền #f3f6fc.
// ---------------------------------------------------------------------------------------------

type Mix = { value: number }

type Palette = { a: string; b: string; rim: string }

type PlanetSpec = {
  size: number
  dark: Palette
  light: Palette
  // bands: dải khí quyển (hành tinh khí), bandScale: độ dày dải, seed: lệch pha bề mặt.
  bands: number
  bandScale: number
  seed: number
  ring?: { dark: string; light: string }
}

type OrbitingSpec = PlanetSpec & {
  orbit: number
  speed: number
  phase: number
  tilt: [number, number, number]
}

// Giữ chuyển động cũ (chín quỹ đạo, hai chiều) nhưng bảng màu đổi sang hệ token của frame.
const planets: readonly OrbitingSpec[] = [
  {
    orbit: 1.5, size: 0.105, speed: 0.42, phase: 0.4, tilt: [0.5, 0.15, 0.2], bands: 0.35, bandScale: 3.4, seed: 1.7,
    dark: { a: '#0b4b45', b: '#5eead4', rim: '#a5fff2' },
    light: { a: '#115e59', b: '#5eead4', rim: '#2dd4bf' },
  },
  {
    orbit: 1.82, size: 0.17, speed: 0.28, phase: 2.3, tilt: [1.05, -0.3, 0.7], bands: 0.7, bandScale: 4.2, seed: 2.9,
    dark: { a: '#3b1f86', b: '#c4b5fd', rim: '#ede9fe' },
    light: { a: '#5b21b6', b: '#c4b5fd', rim: '#8b5cf6' },
    ring: { dark: '#c4b5fd', light: '#7c3aed' },
  },
  {
    orbit: 2.05, size: 0.12, speed: -0.22, phase: 4.1, tilt: [0.35, 0.55, -0.5], bands: 0.22, bandScale: 3, seed: 4.4,
    dark: { a: '#7c3f07', b: '#fcd34d', rim: '#fef3c7' },
    light: { a: '#92400e', b: '#fbbf24', rim: '#f59e0b' },
  },
  {
    orbit: 2.3, size: 0.19, speed: 0.18, phase: 1.2, tilt: [0.8, -0.65, 0.1], bands: 0.55, bandScale: 3.8, seed: 5.6,
    dark: { a: '#123a7d', b: '#7dd3fc', rim: '#e0f2fe' },
    light: { a: '#1e3a8a', b: '#60a5fa', rim: '#38bdf8' },
    ring: { dark: '#7dd3fc', light: '#2563eb' },
  },
  {
    orbit: 1.95, size: 0.085, speed: -0.32, phase: 5.5, tilt: [-0.55, 0.4, 1.1], bands: 0.18, bandScale: 3.2, seed: 0.8,
    dark: { a: '#7a1f4c', b: '#f9a8d4', rim: '#fce7f3' },
    light: { a: '#831843', b: '#f472b6', rim: '#db2777' },
  },
  {
    orbit: 2.52, size: 0.14, speed: 0.14, phase: 3.3, tilt: [0.62, 0.28, -0.42], bands: 0.6, bandScale: 4, seed: 6.2,
    dark: { a: '#0c4f38', b: '#6ee7b7', rim: '#d1fae5' },
    light: { a: '#064e3b', b: '#34d399', rim: '#10b981' },
    ring: { dark: '#6ee7b7', light: '#047857' },
  },
  {
    orbit: 1.63, size: 0.07, speed: -0.46, phase: 0.9, tilt: [-0.2, 0.9, 0.35], bands: 0.1, bandScale: 2.8, seed: 7.3,
    dark: { a: '#6b4a06', b: '#fde68a', rim: '#fffbeb' },
    light: { a: '#78350f', b: '#fcd34d', rim: '#d97706' },
  },
  {
    orbit: 2.68, size: 0.095, speed: -0.1, phase: 5, tilt: [1.25, 0.1, 0.55], bands: 0.3, bandScale: 3.6, seed: 3.7,
    dark: { a: '#3f2378', b: '#d8b4fe', rim: '#f5f3ff' },
    light: { a: '#4c1d95', b: '#c084fc', rim: '#a855f7' },
  },
  {
    orbit: 2.18, size: 0.15, speed: 0.21, phase: 2, tilt: [-0.9, -0.35, -0.15], bands: 0.5, bandScale: 4.4, seed: 8.1,
    dark: { a: '#7c2626', b: '#fca5a5', rim: '#fee2e2' },
    light: { a: '#7f1d1d', b: '#f87171', rim: '#ef4444' },
    ring: { dark: '#fca5a5', light: '#b91c1c' },
  },
]

// Hành tinh lân cận trôi quanh khối tâm: cùng chất liệu shader, khác kích thước/quỹ đạo.
const drifters: readonly { spec: PlanetSpec; position: [number, number, number]; scale: number }[] = [
  {
    spec: {
      size: 0.2, bands: 0.2, bandScale: 3.1, seed: 2.4,
      dark: { a: '#0f3b5c', b: '#93c5fd', rim: '#dbeafe' },
      light: { a: '#1e40af', b: '#93c5fd', rim: '#60a5fa' },
      ring: { dark: '#bfdbfe', light: '#3b82f6' },
    },
    position: [-1.62, 1.02, 0.2], scale: 0.95,
  },
  {
    spec: {
      size: 0.16, bands: 0.4, bandScale: 3.6, seed: 5.1,
      dark: { a: '#3b1f86', b: '#d8b4fe', rim: '#f3e8ff' },
      light: { a: '#5b21b6', b: '#c4b5fd', rim: '#8b5cf6' },
    },
    position: [1.55, 0.62, -0.1], scale: 0.8,
  },
  {
    spec: {
      size: 0.13, bands: 0.15, bandScale: 2.9, seed: 3.3,
      dark: { a: '#7c3f07', b: '#fcd34d', rim: '#fef3c7' },
      light: { a: '#92400e', b: '#fbbf24', rim: '#f59e0b' },
    },
    position: [-0.9, -1.42, 0.3], scale: 0.75,
  },
  {
    spec: {
      size: 0.18, bands: 0.45, bandScale: 3.9, seed: 6.8,
      dark: { a: '#0c4f38', b: '#86efac', rim: '#dcfce7' },
      light: { a: '#065f46', b: '#4ade80', rim: '#22c55e' },
      ring: { dark: '#86efac', light: '#15803d' },
    },
    position: [1.72, -0.92, 0.1], scale: 0.85,
  },
]

// ---------------------------------------------------------------------------------------------
// Shader nguồn — gom ở một chỗ để đọc như bảng chất liệu, không rải trong JSX.
// ---------------------------------------------------------------------------------------------

const SURFACE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vView;
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }`

// Ánh sáng cố định từ trên-trái-trước. Vùng tối nghiêng lạnh để khối cầu vẫn "tròn" trên
// nền sáng, nơi bóng đổ ấm sẽ bết thành một mảng bẩn.
const PLANET_FRAGMENT = `
  uniform float uMix;
  uniform vec3 uDarkA, uDarkB, uDarkRim, uLightA, uLightB, uLightRim;
  uniform float uBands, uBandScale, uSeed;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vView;

  void main() {
    vec3 baseA = mix(uDarkA, uLightA, uMix);
    vec3 baseB = mix(uDarkB, uLightB, uMix);
    vec3 rim = mix(uDarkRim, uLightRim, uMix);
    vec3 n = normalize(vNormal);
    vec3 p = normalize(vPos);
    vec3 lightDir = normalize(vec3(-0.42, 0.5, 0.76));
    float lit = smoothstep(-0.28, 0.85, dot(n, lightDir));
    float band = sin((p.y * uBandScale + sin(p.x * 2.6 + uSeed) * 0.18 + sin(p.z * 2.1 + uSeed * 1.7) * 0.14) * 6.2831853);
    float grain = sin(p.x * 21.0 + uSeed * 4.0) * sin(p.y * 17.0 - uSeed * 2.0) * sin(p.z * 19.0 + uSeed);
    float tone = clamp(0.5 + band * 0.5 * uBands + grain * 0.05, 0.0, 1.0);
    vec3 surface = mix(baseA, baseB, tone);
    vec3 color = surface * (0.44 + 0.68 * lit);
    color = mix(color * vec3(0.8, 0.87, 1.2), color, lit);
    vec3 halfV = normalize(lightDir + normalize(vView));
    color += vec3(1.0, 0.99, 0.95) * pow(max(dot(n, halfV), 0.0), 40.0) * 0.3;
    float fres = pow(1.0 - clamp(dot(n, normalize(vView)), 0.0, 1.0), 2.8);
    color += rim * fres * (0.14 + 0.6 * lit);
    gl_FragColor = vec4(color, 1.0);
  }`

const HALO_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }`

const HALO_FRAGMENT = `
  uniform float uMix;
  uniform float uAlpha;
  uniform vec3 uDark, uLight;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 3.0);
    gl_FragColor = vec4(mix(uDark, uLight, uMix), fres * uAlpha);
  }`

const LOCAL_VERTEX = `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

// Vành đai: tan dần ở hai mép + vân đồng tâm, phối màu theo theme.
const RING_FRAGMENT = `
  uniform float uMix, uSeed, uInner, uOuter;
  uniform vec3 uDarkA, uDarkB, uLightA, uLightB;
  varying vec2 vLocal;
  void main() {
    float r = length(vLocal);
    float edge = smoothstep(uInner, uInner + 0.012, r) * (1.0 - smoothstep(uOuter - 0.014, uOuter, r));
    float strata = 0.6 + 0.4 * sin(r * 190.0 + uSeed);
    float lightFall = 0.55 + 0.45 * sin(atan(vLocal.y, vLocal.x) + 1.1);
    float alpha = edge * strata * lightFall * 0.82;
    vec3 color = mix(mix(uDarkA, uDarkB, strata), mix(uLightA, uLightB, strata), uMix);
    gl_FragColor = vec4(color, alpha);
  }`

// Quỹ đạo là một vệt sáng chạy dọc đường tròn thay vì nét kẻ đều — mắt đọc được hướng quay.
const ORBIT_FRAGMENT = `
  uniform float uMix, uPhase;
  uniform vec3 uDark, uLight;
  varying vec2 vLocal;
  void main() {
    float angle = atan(vLocal.y, vLocal.x);
    float trail = 0.5 + 0.5 * sin(angle + uPhase);
    float baseAlpha = mix(0.34, 0.46, uMix);
    float alpha = (0.14 + 0.6 * pow(trail, 2.6)) * baseAlpha;
    gl_FragColor = vec4(mix(uDark, uLight, uMix), alpha);
  }`

const GLOBE_FRAGMENT = `
  uniform float uMix, uSeed;
  uniform vec3 uDarkA, uDarkB, uDarkRim, uLightA, uLightB, uLightRim;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vView;

  void main() {
    vec3 baseA = mix(uDarkA, uLightA, uMix);
    vec3 baseB = mix(uDarkB, uLightB, uMix);
    vec3 rim = mix(uDarkRim, uLightRim, uMix);
    vec3 n = normalize(vNormal);
    vec3 p = normalize(vPos);
    vec3 lightDir = normalize(vec3(-0.46, 0.42, 0.78));
    float lit = smoothstep(-0.32, 0.9, dot(n, lightDir));
    float surfacePattern = sin(p.x * 3.3 + uSeed) * sin(p.y * 4.1 - uSeed * 0.8) * sin(p.z * 3.7 + uSeed * 1.6);
    float land = smoothstep(0.0, 0.55, surfacePattern);
    vec3 surface = mix(mix(baseA, baseB, smoothstep(-0.9, 0.9, p.y)), baseB * 1.15, land * 0.5);
    vec3 color = surface * (0.52 + 0.56 * lit);
    color = mix(color * vec3(0.78, 0.86, 1.24), color, lit);
    vec3 halfV = normalize(lightDir + normalize(vView));
    color += vec3(0.9, 0.98, 1.0) * pow(max(dot(n, halfV), 0.0), 26.0) * 0.45;
    float fres = pow(1.0 - clamp(dot(n, normalize(vView)), 0.0, 1.0), 2.2);
    color += rim * fres * (0.3 + 0.8 * lit);
    gl_FragColor = vec4(color, 1.0);
  }`

const SCREEN_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

// Hào quang phía sau khối tâm (mặt phẳng hướng về camera).
const BACKLIGHT_FRAGMENT = `
  uniform float uMix;
  uniform vec3 uDarkA, uDarkB, uLightA, uLightB;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float glow = exp(-d * d * 5.0) * 0.75 + exp(-pow((d - 0.52) * 5.4, 2.0)) * 0.3;
    float alpha = glow * mix(0.62, 0.3, uMix);
    vec3 color = mix(mix(uDarkA, uDarkB, smoothstep(0.1, 0.9, d)), mix(uLightA, uLightB, smoothstep(0.1, 0.9, d)), uMix);
    gl_FragColor = vec4(color, alpha);
  }`

const NEBULA_FRAGMENT = `
  uniform float uMix, uAlpha;
  uniform vec3 uDarkA, uDarkB, uLightA, uLightB;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d1 = length((p - vec2(-0.18, 0.08)) * vec2(0.9, 1.25));
    float d2 = length((p - vec2(0.26, -0.16)) * vec2(1.3, 0.9));
    float blob = exp(-d1 * d1 * 4.2) + 0.65 * exp(-d2 * d2 * 6.5);
    float alpha = blob * uAlpha;
    if (alpha < 0.004) discard;
    vec3 color = mix(mix(uDarkA, uDarkB, smoothstep(0.0, 1.0, d1)), mix(uLightA, uLightB, smoothstep(0.0, 1.0, d1)), uMix);
    gl_FragColor = vec4(color, alpha);
  }`

// Nhân quasar: gradient theo fresnel (giữa sáng, rìa đậm) thay cho "hố đen" đĩa đặc.
const CORE_FRAGMENT = `
  uniform float uMix;
  uniform vec3 uDarkIn, uDarkOut, uLightIn, uLightOut;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 1.35);
    vec3 color = mix(mix(uDarkIn, uDarkOut, fres), mix(uLightIn, uLightOut, fres), uMix);
    gl_FragColor = vec4(color, 1.0);
  }`

// Cung sáng của đĩa bồi tụ: nhiều cung lệch pha + tan hai đầu.
const ARC_FRAGMENT = `
  uniform float uMix, uPhase, uSegments, uPower, uAlpha;
  uniform vec3 uDarkA, uDarkB, uLightA, uLightB;
  varying vec2 vLocal;
  void main() {
    float angle = atan(vLocal.y, vLocal.x);
    float arc = pow(0.5 + 0.5 * sin(angle * uSegments + uPhase), uPower);
    vec3 color = mix(mix(uDarkA, uDarkB, arc), mix(uLightA, uLightB, arc), uMix);
    gl_FragColor = vec4(color, arc * uAlpha);
  }`

const FLAT_VERTEX = `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

const FLAT_FRAGMENT = `
  uniform float uMix, uAlpha;
  uniform vec3 uDark, uLight;
  void main() {
    gl_FragColor = vec4(mix(uDark, uLight, uMix), uAlpha);
  }`

const STAR_VERTEX = `
  attribute float size;
  uniform float ratio;
  varying float phase;
  void main() {
    phase = position.x * 2.7 + position.y * 3.1;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * ratio;
  }`

const STAR_FRAGMENT = `
  uniform float time, uMix;
  uniform vec3 uDark, uLight;
  varying float phase;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float core = exp(-d * d * 150.0);
    float halo = exp(-d * d * 18.0) * 0.4;
    float rays = (exp(-abs(p.x) * 90.0) + exp(-abs(p.y) * 90.0)) * max(0.0, 1.0 - d * 2.0) * 0.2;
    float alpha = (core + halo + rays) * (0.7 + 0.3 * sin(time * 0.8 + phase));
    alpha *= mix(1.0, 0.72, uMix);
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(mix(uDark, uLight, uMix), min(alpha, 1.0));
  }`

// ---------------------------------------------------------------------------------------------
// Thành phần cảnh
// ---------------------------------------------------------------------------------------------

// Lerp uMix mỗi frame. Khi tạm dừng chuyển động frameloop là 'demand' nên useFrame không chạy;
// lúc đó đổi theme phải gán thẳng + invalidate, nếu không cảnh đứng nguyên ở theme cũ.
function useThemeMix(light: boolean, moving: boolean) {
  // Chụp theme lúc mount để cảnh mở ra đúng tông ngay, không "trôi" từ dark sang light.
  const [mix] = useState<Mix>(() => ({ value: light ? 1 : 0 }))
  const { invalidate } = useThree()
  useFrame((_, delta) => {
    const target = light ? 1 : 0
    const step = Math.min(delta, 0.05)
    const next = mix.value + (target - mix.value) * (1 - Math.exp(-step * 4.5))
    if (Math.abs(target - next) < 0.002) {
      if (mix.value !== target) {
        setNumberUniform(mix, target)
        invalidate()
      }
      return
    }
    setNumberUniform(mix, next)
  })
  useEffect(() => {
    if (moving) return
    setNumberUniform(mix, light ? 1 : 0)
    invalidate()
  }, [light, moving, mix, invalidate])
  return mix
}

function OrbitPath({ radius, tilt, dark, light, phase, mix }: {
  radius: number
  tilt?: [number, number, number]
  dark: string
  light: string
  phase: number
  mix: Mix
}) {
  const uniforms = useMemo(() => ({
    uMix: mix,
    uDark: { value: new Color(dark) },
    uLight: { value: new Color(light) },
    uPhase: { value: phase },
  }), [mix, dark, light, phase])
  return <mesh rotation={tilt ?? [0, 0, 0]}>
    <ringGeometry args={[radius - 0.006, radius + 0.006, 180]} />
    <shaderMaterial uniforms={uniforms} vertexShader={LOCAL_VERTEX} fragmentShader={ORBIT_FRAGMENT}
      transparent depthWrite={false} side={DoubleSide} />
  </mesh>
}

function PlanetMesh({ planet, mix }: { planet: PlanetSpec; mix: Mix }) {
  const surface = useMemo(() => ({
    uMix: mix,
    uDarkA: { value: new Color(planet.dark.a) },
    uDarkB: { value: new Color(planet.dark.b) },
    uDarkRim: { value: new Color(planet.dark.rim) },
    uLightA: { value: new Color(planet.light.a) },
    uLightB: { value: new Color(planet.light.b) },
    uLightRim: { value: new Color(planet.light.rim) },
    uBands: { value: planet.bands },
    uBandScale: { value: planet.bandScale },
    uSeed: { value: planet.seed },
  }), [mix, planet])

  const halo = useMemo(() => ({
    uMix: mix,
    uDark: { value: new Color(planet.dark.rim) },
    uLight: { value: new Color(planet.light.rim) },
    uAlpha: { value: 0.5 },
  }), [mix, planet])

  const ring = useMemo(() => planet.ring ? {
    uMix: mix,
    uDarkA: { value: new Color(planet.ring.dark) },
    uDarkB: { value: new Color(planet.dark.rim) },
    uLightA: { value: new Color(planet.ring.light) },
    uLightB: { value: new Color(planet.light.rim) },
    uSeed: { value: planet.seed * 3.1 },
    uInner: { value: planet.size * 1.5 },
    uOuter: { value: planet.size * 2.05 },
  } : null, [mix, planet])

  return <>
    <mesh>
      <sphereGeometry args={[planet.size, 32, 22]} />
      <shaderMaterial uniforms={surface} vertexShader={SURFACE_VERTEX} fragmentShader={PLANET_FRAGMENT} />
    </mesh>
    <mesh scale={1.25}>
      <sphereGeometry args={[planet.size, 20, 14]} />
      <shaderMaterial uniforms={halo} vertexShader={HALO_VERTEX} fragmentShader={HALO_FRAGMENT}
        transparent depthWrite={false} blending={AdditiveBlending} />
    </mesh>
    {planet.ring && ring && <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[planet.size * 1.5, planet.size * 2.05, 96]} />
      <shaderMaterial uniforms={ring} vertexShader={LOCAL_VERTEX} fragmentShader={RING_FRAGMENT}
        transparent depthWrite={false} side={DoubleSide} />
    </mesh>}
  </>
}

function OrbitingPlanet({ planet, moving, mix }: { planet: OrbitingSpec; moving: boolean; mix: Mix }) {
  const carrier = useRef<Group>(null)
  useFrame((_, delta) => {
    if (!moving || !carrier.current) return
    carrier.current.rotation.z += Math.min(delta, 0.05) * planet.speed
  })
  return <group rotation={planet.tilt}>
    <OrbitPath radius={planet.orbit} dark={planet.dark.rim} light={planet.light.rim} phase={planet.phase} mix={mix} />
    <group ref={carrier} rotation={[0, 0, planet.phase]}>
      <group position={[planet.orbit, 0, 0]} rotation={[0.28, 0, 0.2]}>
        <PlanetMesh planet={planet} mix={mix} />
      </group>
    </group>
  </group>
}

function FloatingPlanet({ planet, position, moving, mix, scale = 1 }: {
  planet: PlanetSpec
  position: [number, number, number]
  moving: boolean
  mix: Mix
  scale?: number
}) {
  const group = useRef<Group>(null)
  const clock = useRef(planet.seed)
  useFrame((_, delta) => {
    if (!moving || !group.current) return
    const step = Math.min(delta, 0.05)
    clock.current += step
    group.current.position.y = position[1] + Math.sin(clock.current * 0.55 + planet.seed) * 0.1
    group.current.position.x = position[0] + Math.cos(clock.current * 0.38 + planet.seed) * 0.06
  })
  return <group ref={group} position={position} rotation={[0.25, 0, -0.2]} scale={scale}>
    <PlanetMesh planet={planet} mix={mix} />
  </group>
}

const nodePositions: readonly [number, number, number][] = Array.from({ length: 26 }, (_, i) => {
  const y = 1 - (i / 25) * 2
  const ringRadius = Math.sqrt(Math.max(0, 1 - y * y))
  const angle = i * 2.399
  return [Math.cos(angle) * ringRadius * 1.08, y * 1.08, Math.sin(angle) * ringRadius * 1.08]
})

function DataGlobe({ moving, light, mix }: { moving: boolean; light: boolean; mix: Mix }) {
  const shell = useRef<Group>(null)
  useFrame((_, delta) => {
    if (!moving || !shell.current) return
    shell.current.rotation.y += Math.min(delta, 0.05) * 0.16
  })

  const surface = useMemo(() => ({
    uMix: mix,
    uSeed: { value: 2.2 },
    uDarkA: { value: new Color('#081d3f') },
    uDarkB: { value: new Color('#2f7cf6') },
    uDarkRim: { value: new Color('#7fe9ff') },
    uLightA: { value: new Color('#1e3a8a') },
    uLightB: { value: new Color('#3b82f6') },
    uLightRim: { value: new Color('#67e8f9') },
  }), [mix])

  const backlight = useMemo(() => ({
    uMix: mix,
    uDarkA: { value: new Color('#38bdf8') },
    uDarkB: { value: new Color('#6366f1') },
    uLightA: { value: new Color('#818cf8') },
    uLightB: { value: new Color('#22d3ee') },
  }), [mix])

  const halo = useMemo(() => ({
    uMix: mix,
    uDark: { value: new Color('#67e8f9') },
    uLight: { value: new Color('#6366f1') },
    uAlpha: { value: 0.5 },
  }), [mix])

  return <group>
    <mesh position={[0, 0, -1.6]} scale={[3.6, 3.6, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial uniforms={backlight} vertexShader={SCREEN_VERTEX} fragmentShader={BACKLIGHT_FRAGMENT}
        transparent depthWrite={false} blending={light ? NormalBlending : AdditiveBlending} />
    </mesh>
    <OrbitPath radius={1.34} tilt={[1.2, 0.24, 0.24]} dark="#7fdcff" light="#3b82f6" phase={0.7} mix={mix} />
    <OrbitPath radius={1.6} tilt={[-0.78, 0.42, -0.3]} dark="#7fdcff" light="#3b82f6" phase={3.2} mix={mix} />
    <group ref={shell}>
      <mesh>
        <sphereGeometry args={[1.05, 64, 48]} />
        <shaderMaterial uniforms={surface} vertexShader={SURFACE_VERTEX} fragmentShader={GLOBE_FRAGMENT} />
      </mesh>
      <mesh scale={1.04}>
        <icosahedronGeometry args={[1.05, 2]} />
        <meshBasicMaterial color={light ? '#dbeafe' : '#9ae6ff'} wireframe transparent
          opacity={light ? 0.34 : 0.22} depthWrite={false} />
      </mesh>
      {nodePositions.map((position, index) => <mesh key={index} position={position}>
        <sphereGeometry args={[0.026, 8, 6]} />
        <meshBasicMaterial color={light ? '#f0f9ff' : '#c8f7ff'} transparent opacity={0.9} />
      </mesh>)}
    </group>
    <mesh scale={1.24}>
      <sphereGeometry args={[1.05, 40, 28]} />
      <shaderMaterial uniforms={halo} vertexShader={HALO_VERTEX} fragmentShader={HALO_FRAGMENT}
        transparent depthWrite={false} blending={light ? NormalBlending : AdditiveBlending} />
    </mesh>
  </group>
}

const singularityArcs = [
  { radius: 0.42, thickness: 0.024, segments: 1, speed: 0.2, phase: 0.4, alpha: 0.8 },
  { radius: 0.5, thickness: 0.028, segments: 2, speed: -0.14, phase: 2.2, alpha: 0.64 },
  { radius: 0.59, thickness: 0.032, segments: 1, speed: 0.15, phase: 4.1, alpha: 0.56 },
  { radius: 0.69, thickness: 0.036, segments: 3, speed: -0.1, phase: 1.1, alpha: 0.46 },
  { radius: 0.8, thickness: 0.042, segments: 2, speed: 0.08, phase: 5.3, alpha: 0.36 },
]

function HaloPlanet({ moving, light, mix }: { moving: boolean; light: boolean; mix: Mix }) {
  const disk = useRef<Group>(null)
  const sparks = useRef<Group>(null)
  const coreHalo = useRef<Mesh>(null)
  const clock = useRef(0)

  const aura = useMemo(() => ({
    uMix: mix,
    uDarkA: { value: new Color('#8b5cf6') },
    uDarkB: { value: new Color('#22d3ee') },
    uLightA: { value: new Color('#a855f7') },
    uLightB: { value: new Color('#0891b2') },
  }), [mix])

  const core = useMemo(() => ({
    uMix: mix,
    uDarkIn: { value: new Color('#ffffff') },
    uDarkOut: { value: new Color('#8b5cf6') },
    uLightIn: { value: new Color('#7e22ce') },
    uLightOut: { value: new Color('#e9d5ff') },
  }), [mix])

  const coreGlow = useMemo(() => ({
    uMix: mix,
    uDark: { value: new Color('#a78bfa') },
    uLight: { value: new Color('#c084fc') },
    uAlpha: { value: 0.55 },
  }), [mix])

  const photon = useMemo(() => ({
    uMix: mix,
    uDark: { value: new Color('#fde68a') },
    uLight: { value: new Color('#f59e0b') },
    uAlpha: { value: 0.95 },
  }), [mix])

  const arcs = useMemo(() => singularityArcs.map((arc, index) => ({
    uMix: mix,
    uPhase: { value: arc.phase },
    uSegments: { value: arc.segments },
    uPower: { value: 2.6 },
    uAlpha: { value: arc.alpha },
    uDarkA: { value: new Color(index % 2 === 0 ? '#67e8f9' : '#c4b5fd') },
    uDarkB: { value: new Color(index % 2 === 0 ? '#22d3ee' : '#8b5cf6') },
    uLightA: { value: new Color(index % 2 === 0 ? '#0891b2' : '#7c3aed') },
    uLightB: { value: new Color(index % 2 === 0 ? '#0e7490' : '#c026d3') },
  })), [mix])

  const sparkTint = useMemo(() => ({
    uMix: mix,
    uDark: { value: new Color('#e0f2fe') },
    uLight: { value: new Color('#7c3aed') },
    uAlpha: { value: 0.9 },
  }), [mix])

  useFrame((_, delta) => {
    if (!moving) return
    const step = Math.min(delta, 0.05)
    clock.current += step
    disk.current?.children.forEach((child, index) => {
      child.rotation.z += step * singularityArcs[index].speed
    })
    if (sparks.current) sparks.current.rotation.z -= step * 0.3
    if (coreHalo.current) coreHalo.current.scale.setScalar(1.55 + Math.sin(clock.current * 1.4) * 0.06)
  })

  return <group>
    <mesh position={[0, 0, -0.3]} scale={[2.9, 2.9, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial uniforms={aura} vertexShader={SCREEN_VERTEX} fragmentShader={BACKLIGHT_FRAGMENT}
        transparent depthWrite={false} blending={light ? NormalBlending : AdditiveBlending} />
    </mesh>
    <mesh scale={1.55} ref={coreHalo}>
      <sphereGeometry args={[0.3, 32, 24]} />
      <shaderMaterial uniforms={coreGlow} vertexShader={HALO_VERTEX} fragmentShader={HALO_FRAGMENT}
        transparent depthWrite={false} blending={light ? NormalBlending : AdditiveBlending} />
    </mesh>
    <mesh>
      <sphereGeometry args={[0.3, 40, 30]} />
      <shaderMaterial uniforms={core} vertexShader={SURFACE_VERTEX} fragmentShader={CORE_FRAGMENT} />
    </mesh>
    <mesh rotation={[0, 0, 0]}>
      <torusGeometry args={[0.335, 0.011, 8, 120]} />
      <shaderMaterial uniforms={photon} vertexShader={FLAT_VERTEX} fragmentShader={FLAT_FRAGMENT}
        transparent depthWrite={false} blending={light ? NormalBlending : AdditiveBlending} />
    </mesh>
    <group rotation={[0.78, 0.14, -0.26]}>
      <group ref={disk}>
        {singularityArcs.map((arc, index) => <mesh key={index}>
          <ringGeometry args={[arc.radius, arc.radius + arc.thickness, 128]} />
          <shaderMaterial uniforms={arcs[index]} vertexShader={LOCAL_VERTEX} fragmentShader={ARC_FRAGMENT}
            transparent depthWrite={false} blending={light ? NormalBlending : AdditiveBlending} />
        </mesh>)}
      </group>
      <group ref={sparks}>
        {Array.from({ length: 26 }, (_, index) => {
          const radius = 0.45 + (index % 5) * 0.07
          const angle = index * 2.399
          return <mesh key={index} position={[Math.cos(angle) * radius, Math.sin(angle) * radius, (index % 3) * 0.012]}>
            <sphereGeometry args={[0.014, 6, 5]} />
            <shaderMaterial uniforms={sparkTint} vertexShader={FLAT_VERTEX} fragmentShader={FLAT_FRAGMENT}
              transparent depthWrite={false} blending={light ? NormalBlending : AdditiveBlending} />
          </mesh>
        })}
      </group>
    </group>
  </group>
}

function Starfield({ width, height, mix, moving }: { width: number; height: number; mix: Mix; moving: boolean }) {
  const { gl } = useThree()
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    ratio: { value: 1 },
    uMix: mix,
    uDark: { value: new Color('#dcf3ff') },
    uLight: { value: new Color('#2f4f7a') },
  }), [mix])

  const stars = useMemo(() => {
    const count = 260
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = Math.sin(index * 127.1 + 0.7) * width * 0.5
      positions[index * 3 + 1] = Math.cos(index * 73.7 + 1.3) * height * 0.48
      positions[index * 3 + 2] = -1 - ((index * 37) % 100) / 50
      sizes[index] = index % 13 === 0 ? 16 : index % 4 === 0 ? 8 : 4
    }
    return { positions, sizes }
  }, [width, height])

  useLayoutEffect(() => { setNumberUniform(uniforms.ratio, gl.getPixelRatio()) }, [gl, uniforms])
  useFrame((_, delta) => {
    if (moving) setNumberUniform(uniforms.time, uniforms.time.value + Math.min(delta, 0.05))
  })

  return <points frustumCulled={false}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[stars.positions, 3]} />
      <bufferAttribute attach="attributes-size" args={[stars.sizes, 1]} />
    </bufferGeometry>
    <shaderMaterial uniforms={uniforms} vertexShader={STAR_VERTEX} fragmentShader={STAR_FRAGMENT}
      transparent depthWrite={false} />
  </points>
}

function Nebula({ mix, light, position, scale }: {
  mix: Mix
  light: boolean
  position: [number, number, number]
  scale: [number, number]
}) {
  const uniforms = useMemo(() => ({
    uMix: mix,
    uAlpha: { value: light ? 0.3 : 0.45 },
    uDarkA: { value: new Color('#8b5cf6') },
    uDarkB: { value: new Color('#0891b2') },
    uLightA: { value: new Color('#c4b5fd') },
    uLightB: { value: new Color('#99f6e4') },
  }), [mix, light])
  return <mesh position={position} scale={[scale[0], scale[1], 1]}>
    <planeGeometry args={[1, 1]} />
    <shaderMaterial uniforms={uniforms} vertexShader={SCREEN_VERTEX} fragmentShader={NEBULA_FRAGMENT}
      transparent depthWrite={false} blending={light ? NormalBlending : AdditiveBlending} />
  </mesh>
}

function Universe({ moving, light }: { moving: boolean; light: boolean }) {
  const mix = useThemeMix(light, moving)
  const { size, camera, invalidate } = useThree()
  // Camera trực giao giữ hình cầu tròn đều ở mép banner rất rộng.
  const viewport = { width: size.width / Math.max(size.height, 1) * 5.4, height: 5.4 }
  useLayoutEffect(() => {
    if (updatePreviewCameraZoom(camera, Math.max(size.height, 1) / 5.4)) invalidate()
  }, [camera, size.width, size.height, invalidate])

  const scale = Math.min(0.84, viewport.width / 9.6, viewport.height / 6.4)
  const compact = viewport.width < viewport.height * 1.35

  return <>
    <Nebula mix={mix} light={light} position={[viewport.width * 0.3, viewport.height * 0.04, -4]}
      scale={[viewport.width * 0.8, viewport.height * 1.35]} />
    <Nebula mix={mix} light={light} position={[viewport.width * 0.6, viewport.height * -0.26, -4]}
      scale={[viewport.width * 0.46, viewport.height * 0.85]} />
    <group position={[viewport.width * 0.25, viewport.height * -0.015, 0]} scale={scale}>
      <DataGlobe moving={moving} light={light} mix={mix} />
      {planets.map((planet, index) => <OrbitingPlanet key={index} planet={planet} moving={moving} mix={mix} />)}
      {drifters.map((drifter, index) => <FloatingPlanet key={`drifter-${index}`} planet={drifter.spec}
        position={drifter.position} moving={moving} mix={mix} scale={drifter.scale} />)}
    </group>
    <group position={[viewport.width * (compact ? 0.14 : 0.088), viewport.height * (compact ? 0.26 : 0.29), 0]}
      scale={compact ? 0.62 : 0.86}>
      <HaloPlanet moving={moving} light={light} mix={mix} />
    </group>
    <group position={[viewport.width * (compact ? 0.05 : -0.025), viewport.height * -0.19, 0.8]} scale={compact ? 0.62 : 0.95}>
      <HeroSpaceHole moving={moving} mix={mix} />
    </group>
    {[
      { index: 2, x: -.30, y: .34, scale: 1.45 },
      { index: 5, x: -.23, y: -.24, scale: 1.35 },
      { index: 7, x: .39, y: .35, scale: 1.65 },
      { index: 8, x: .43, y: -.31, scale: 1.25 },
    ].map(({ index, x, y, scale: planetScale }) => <FloatingPlanet key={`outer-${index}`}
      planet={planets[index]} position={[viewport.width * x, viewport.height * y, 0.25]}
      moving={moving} mix={mix} scale={compact ? planetScale * .65 : planetScale} />)}
    <group position={[viewport.width * .39, viewport.height * .35, .25]} scale={compact ? .65 : 1}>
      <OrbitingPlanet planet={{ ...planets[6], orbit: .34, size: .035, speed: .65, tilt: [.7, .2, .4] }} moving={moving} mix={mix} />
    </group>
    <Starfield width={viewport.width} height={viewport.height} mix={mix} moving={moving} />
  </>
}

export default function HomeUniverse({ fallback, paused, light }: { fallback: ReactNode; paused: boolean; light: boolean }) {
  const { moving } = useSceneMotion()
  const host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [lost, setLost] = useState(false)
  useEffect(() => {
    if (!host.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
  const active = moving && !paused && visible
  if (typeof WebGL2RenderingContext === 'undefined' || lost) return fallback
  return <UniverseBoundary fallback={fallback}>
    <div ref={host} className="home-universe-canvas" aria-hidden="true">
      <Canvas orthographic dpr={[1, 1.5]} frameloop={active ? 'always' : 'demand'} camera={{ position: [0, 0, 8], zoom: 90, near: 0.1, far: 30 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }} fallback={fallback}
        onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', () => setLost(true), { once: true }) }}>
        <Universe moving={active} light={light} />
      </Canvas>
    </div>
  </UniverseBoundary>
}
