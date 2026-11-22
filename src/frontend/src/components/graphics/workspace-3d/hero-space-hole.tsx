import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide, NormalBlending } from 'three'
import type { Group } from 'three'
import { bindShaderUniforms, setNumberUniform } from '../../../graphics/workspace-3d/preview-scene-runtime'
import { createThickDisk } from './thick-disk'

// ---------------------------------------------------------------------------------------------
// Hố đen / hố trắng dựng bằng HÌNH KHỐI THẬT, không còn một plane shader dán trước camera:
//   · chân trời sự kiện là mặt cầu → xoay cảnh vẫn thấy nó có khối;
//   · đĩa bồi tụ là vành 3D nghiêng, quay chậm quanh trục của chính nó;
//   · vành photon và cung thấu kính là torus/ring nằm trong cùng mặt phẳng đĩa nên khi kéo
//     xoay, chúng lệch phối cảnh theo cảnh chứ không trượt phẳng trên màn hình;
//   · bụi vật chất là các khối cầu nhỏ bay theo quỹ đạo riêng.
// Color system: LIGHT = hố đen (chân trời đen tuyệt đối, đĩa ấm như ảnh tham chiếu),
// DARK = hố trắng (chân trời trắng phát sáng, đĩa lạnh). uMix chạy 0 = dark, 1 = light.
// ---------------------------------------------------------------------------------------------

const SURFACE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }`

const HORIZON_FRAGMENT = `
  uniform float uMix;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 3.2);
    // uMix = 0 (dark) → trắng; uMix = 1 (light) → ĐEN TUYỆT ĐỐI (0,0,0): lõi hố đen không
    // được lẫn chút xanh nào, nếu không nó đọc ra thành một quả cầu xám chứ không phải chân trời.
    vec3 core = mix(vec3(0.975, 0.992, 1.0), vec3(0.0), uMix);
    vec3 rim = mix(vec3(0.42, 0.72, 1.0), vec3(1.0, 0.60, 0.30), uMix);
    // Vành sáng chỉ sống ở rìa: luỹ thừa cao dồn quầng ra đúng silhouette nên tâm vẫn đặc đen.
    float limb = pow(fres, mix(1.0, 2.8, uMix));
    gl_FragColor = vec4(core + rim * limb * mix(0.55, 1.15, uMix), 1.0);
  }`

const LOCAL_VERTEX = `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

// Đĩa dùng hình học dày (createThickDisk) nên cần biết vertex nào thuộc thành đĩa.
const DISK_VERTEX = `
  attribute float aEdge;
  varying vec2 vLocal;
  varying float vEdge;
  void main() {
    vLocal = position.xy;
    vEdge = aEdge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

// Đĩa bồi tụ: vân khí chảy theo góc + bán kính, nóng ở vành trong, nguội dần ra ngoài.
// Doppler beaming làm nửa quay về phía người xem sáng gắt hơn — dấu hiệu "đang quay".
const DISK_FRAGMENT = `
  uniform float uMix, uTime;
  uniform vec3 uHotDark, uHotLight, uCoolDark, uCoolLight;
  varying vec2 vLocal;
  varying float vEdge;
  void main() {
    float r = length(vLocal);
    if (r < 0.001) discard;
    float angle = atan(vLocal.y, vLocal.x);
    float inner = 0.34;
    float outer = 1.22;
    float band = smoothstep(inner, inner + 0.035, r) * (1.0 - smoothstep(outer - 0.34, outer, r));
    float filaments = 0.55
      + 0.27 * sin(angle * 5.0 + uTime * 0.55 - r * 26.0)
      + 0.14 * sin(angle * 13.0 - uTime * 0.9 - r * 61.0)
      + 0.06 * sin(angle * 29.0 + uTime * 1.25 - r * 118.0);
    float heat = clamp((outer - r) / (outer - inner), 0.0, 1.0);
    float beaming = 0.34 + 0.66 * pow(clamp(0.5 - vLocal.x / (r * 2.0), 0.0, 1.0), 1.5);
    vec3 hot = mix(uHotDark, uHotLight, uMix);
    vec3 cool = mix(uCoolDark, uCoolLight, uMix);
    vec3 color = mix(cool, hot, pow(heat, 1.35));
    color *= 0.72 + 0.58 * filaments;
    // Thành đĩa sáng hơn hai mặt: nhìn nghiêng thấy đúng bề dày, không phải một ellipse phẳng.
    color *= 1.0 + 0.9 * vEdge;
    float alpha = clamp(band * (0.52 + 0.78 * filaments) * beaming * (1.0 + 0.75 * vEdge), 0.0, 1.0);
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(color, alpha);
  }`

const PHOTON_FRAGMENT = `
  uniform float uMix, uTime;
  uniform vec3 uWarmDark, uWarmLight;
  varying vec2 vLocal;
  void main() {
    float r = length(vLocal);
    if (r < 0.001) discard;
    float angle = atan(vLocal.y, vLocal.x);
    float ring = exp(-pow((r - 0.326) / 0.011, 2.0));
    float doppler = 0.45 + 0.55 * sin(angle - 2.1 + uTime * 0.16);
    vec3 color = mix(uWarmDark, uWarmLight, uMix);
    float alpha = ring * (0.5 + 0.5 * doppler);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }`

// Ảnh bị bẻ cong của nửa xa đĩa: cung vắt qua đỉnh chân trời, dẹt theo trục dọc.
const LENS_FRAGMENT = `
  uniform float uMix, uTime;
  varying vec2 vLocal;
  void main() {
    float r = length(vLocal);
    if (r < 0.001) discard;
    float angle = atan(vLocal.y, vLocal.x);
    float arc = smoothstep(0.0, 0.85, sin(angle)) * exp(-pow((r - 0.44) / 0.09, 2.0));
    float ripple = 0.6 + 0.4 * sin(angle * 4.0 - uTime * 1.1);
    vec3 warm = mix(vec3(0.52, 0.78, 1.0), vec3(1.0, 0.52, 0.22), uMix);
    gl_FragColor = vec4(warm, arc * ripple * 0.7);
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
  uniform vec3 uDark, uLight;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 3.4);
    gl_FragColor = vec4(mix(uDark, uLight, uMix), fres * mix(0.5, 0.3, uMix));
  }`

const FLAT_VERTEX = `
  void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

const SPARK_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uAlpha;
  void main() { gl_FragColor = vec4(uColor, uAlpha); }`

const sparkOrbits = Array.from({ length: 26 }, (_, index) => ({
  radius: 0.46 + (index % 7) * 0.093,
  angle: index * 2.399,
  speed: 0.3 + (index % 5) * 0.12,
  size: index % 6 === 0 ? 0.014 : 0.0075,
  height: ((index % 5) - 2) * 0.006,
}))

export function HeroSpaceHole({ mix, light, moving }: { mix: { value: number }; light: boolean; moving: boolean }) {
  const disk = useRef<Group>(null)
  const sparks = useRef<Group>(null)
  const clock = useRef(0)
  const diskGeometry = useMemo(() => createThickDisk(0.34, 1.22, 0.072, 220), [])

  const horizon = useMemo(() => ({ uMix: mix }), [mix])

  const diskUniforms = useMemo(() => ({
    uMix: mix,
    uTime: { value: 0 },
    uHotDark: { value: new Color('#ffffff') },
    uHotLight: { value: new Color('#fff1d2') },
    uCoolDark: { value: new Color('#3f7fe0') },
    uCoolLight: { value: new Color('#b8441f') },
  }), [mix])

  const photon = useMemo(() => ({
    uMix: mix,
    uTime: { value: 0 },
    uWarmDark: { value: new Color('#d9ecff') },
    uWarmLight: { value: new Color('#ffd9a0') },
  }), [mix])

  const lens = useMemo(() => ({ uMix: mix, uTime: { value: 0 } }), [mix])

  const halo = useMemo(() => ({
    uMix: mix,
    uDark: { value: new Color('#8ec6ff') },
    uLight: { value: new Color('#ff9d5c') },
  }), [mix])

  const spark = useMemo(() => ({
    uColor: { value: new Color(light ? '#ffbe78' : '#cfe7ff') },
    uAlpha: { value: 0.9 },
  }), [light])

  useFrame((_, delta) => {
    if (!moving) return
    const step = Math.min(delta, 0.05)
    clock.current += step
    setNumberUniform(diskUniforms.uTime, clock.current)
    setNumberUniform(photon.uTime, clock.current)
    setNumberUniform(lens.uTime, clock.current)
    // Đĩa quay quanh trục của chính nó: kéo cảnh vẫn thấy đây là vật thể 3D.
    if (disk.current) disk.current.rotation.z = clock.current * 0.075
    if (sparks.current) sparks.current.children.forEach((child, index) => {
      const orbit = sparkOrbits[index]
      if (!orbit) return
      const angle = orbit.angle + clock.current * orbit.speed
      child.position.set(Math.cos(angle) * orbit.radius, Math.sin(angle) * orbit.radius, orbit.height)
    })
  })

  const blend = light ? NormalBlending : AdditiveBlending

  return <group>
    <mesh scale={2.5}>
      <sphereGeometry args={[0.3, 32, 24]} />
      <shaderMaterial ref={material => bindShaderUniforms(material, halo)} uniforms={halo} vertexShader={HALO_VERTEX} fragmentShader={HALO_FRAGMENT}
        transparent depthWrite={false} blending={blend} />
    </mesh>

    <mesh>
      <sphereGeometry args={[0.3, 48, 36]} />
      <shaderMaterial ref={material => bindShaderUniforms(material, horizon)} uniforms={horizon} vertexShader={SURFACE_VERTEX} fragmentShader={HORIZON_FRAGMENT} />
    </mesh>

    <mesh rotation={[0, 0, 0]}>
      <ringGeometry args={[0.31, 0.34, 180]} />
      <shaderMaterial ref={material => bindShaderUniforms(material, photon)} uniforms={photon} vertexShader={LOCAL_VERTEX} fragmentShader={PHOTON_FRAGMENT}
        transparent depthWrite={false} side={DoubleSide} blending={blend} />
    </mesh>

    {/* Đặt cung thấu kính RA SAU mặt cầu chân trời: phần chồng lên lõi bị depth test cắt,
        nhờ vậy lõi đen không bị phủ một lớp sắc cam mờ. */}
    <mesh position={[0, 0.02, -0.05]} scale={[1, 0.62, 1]}>
      <ringGeometry args={[0.33, 0.53, 160]} />
      <shaderMaterial ref={material => bindShaderUniforms(material, lens)} uniforms={lens} vertexShader={LOCAL_VERTEX} fragmentShader={LENS_FRAGMENT}
        transparent depthWrite={false} side={DoubleSide} blending={blend} />
    </mesh>

    {/* Đĩa nghiêng như ảnh tham chiếu: nhìn gần như ngang, hơi chếch sang phải. */}
    <group rotation={[1.16, 0.12, -0.3]}>
      <group ref={disk}>
        <mesh geometry={diskGeometry}>
          <shaderMaterial ref={material => bindShaderUniforms(material, diskUniforms)} uniforms={diskUniforms} vertexShader={DISK_VERTEX} fragmentShader={DISK_FRAGMENT}
            transparent depthWrite={false} side={DoubleSide} blending={blend} />
        </mesh>
        <group ref={sparks}>
          {sparkOrbits.map((orbit, index) => <mesh key={index}
            position={[Math.cos(orbit.angle) * orbit.radius, Math.sin(orbit.angle) * orbit.radius, orbit.height]}>
            <sphereGeometry args={[orbit.size, 6, 5]} />
            <shaderMaterial ref={material => bindShaderUniforms(material, spark)} uniforms={spark} vertexShader={FLAT_VERTEX} fragmentShader={SPARK_FRAGMENT}
              transparent depthWrite={false} blending={blend} />
          </mesh>)}
        </group>
      </group>
    </group>
  </group>
}
