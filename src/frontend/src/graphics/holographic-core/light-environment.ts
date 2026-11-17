import { requireDefined } from '../../utils/required-value'
import {
  BackSide, BufferAttribute, BufferGeometry, Camera, Color, CylinderGeometry, EdgesGeometry,
  Euler, FrontSide, Group, HalfFloatType, InstancedMesh, LineBasicMaterial, LineSegments,
  LinearFilter, LinearSRGBColorSpace, MathUtils, Matrix4, Mesh, NormalBlending, OctahedronGeometry,
  PlaneGeometry, Points, Quaternion, RepeatWrapping, Scene, ShaderMaterial, StaticDrawUsage,
  Vector3, WebGLCubeRenderTarget, WebGLRenderTarget,
} from 'three'
import type { WebGLRenderer } from 'three'
import { NEON_CUBE_CLUSTER_LAYOUT } from '../neon-cube/neon-cube.cluster'
import { ORBIT_RINGS, ORBIT_Y } from './orbit.config'
import { LIGHT_ENVIRONMENT as C, lightDisplayTransform, lightSceneColor } from './light-environment.config'

const noRaycast = () => {}
const TAU = Math.PI * 2
const vertex = `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`
const randomSource = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 4294967296
}
// All light shaders output scene-linear HDR. OutputPass alone converts for display.
// Palette inversion keeps ACES from turning the near-white background into grey.
const noise = `
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
      mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
      mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
`
export function bakeLightSky(gl: WebGLRenderer) {
  const uniforms = Object.fromEntries(
    ['horizon', 'middle', 'zenith', 'lavender', 'cyan', 'sun'].map(name => [name, {
      value: new Color(C[name as 'horizon' | 'middle' | 'zenith' | 'lavender' | 'cyan' | 'sun']),
    }]),
  )
  const material = new ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 horizon, middle, zenith, lavender, cyan, sun;
      ${noise}
      ${lightDisplayTransform(gl)}
      void main() {
        float longitude=(vUv.x-.5)*6.2831853;
        float latitude=(vUv.y-.5)*3.14159265;
        vec3 d=vec3(cos(longitude)*cos(latitude),sin(latitude),sin(longitude)*cos(latitude));
        // Art-directed apparent horizon: default camera looks downward ~23 degrees.
        float h=smoothstep(-.65,.05,d.y);
        vec3 color=mix(horizon,middle,smoothstep(0.,.62,h));
        color=mix(color,zenith,smoothstep(.45,1.,h));
        float gas=noise3(d*3.4+vec3(2.1,7.3,1.9))*.7+noise3(d*7.2)*.3;
        color=mix(color,lavender,smoothstep(.47,.78,gas)*.19);
        color=mix(color,cyan,smoothstep(.3,.72,noise3(d*2.7+8.))* .16);
        vec3 sunDir=normalize(vec3(cos(${C.backAzimuth}),-.24,sin(${C.backAzimuth})));
        float glow=exp(-pow(acos(clamp(dot(d,sunDir),-1.,1.))/.38,2.));
        color=mix(color,sun,glow*.68);
        color+=(hash(vec3(gl_FragCoord.xy,17.))-.5)/768.;
        gl_FragColor=vec4(lightScene(color),1.);
      }
    `,
  })
  const geometry = new PlaneGeometry(2, 2)
  const quad = new Mesh(geometry, material)
  quad.raycast = noRaycast
  quad.frustumCulled = false
  const scene = new Scene()
  scene.add(quad)
  const target = new WebGLRenderTarget(1024, 512, {
    type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter,
    wrapS: RepeatWrapping, generateMipmaps: false, depthBuffer: false,
  })
  const cube = new WebGLCubeRenderTarget(C.skyCubeSize, { type: HalfFloatType, generateMipmaps: false })
  const previous = gl.getRenderTarget()
  const xr = gl.xr.enabled
  try {
    gl.xr.enabled = false
    gl.setRenderTarget(target)
    gl.render(scene, new Camera())
    cube.fromEquirectangularTexture(gl, target.texture)
    cube.texture.colorSpace = LinearSRGBColorSpace
    return cube
  } catch (error) { cube.dispose(); throw error }
  finally {
    gl.setRenderTarget(previous)
    gl.xr.enabled = xr
    geometry.dispose(); material.dispose(); target.dispose()
  }
}

export function createLightLayers(gl: Pick<WebGLRenderer, 'toneMapping' | 'toneMappingExposure'>) {
  const group = new Group()
  group.name = 'light-environment-layers'
  group.raycast = noRaycast
  const resources: { dispose(): void }[] = []
  const color = (hex: string) => lightSceneColor(hex, gl)
  const makeMaterial = (fragmentShader: string, uniforms: Record<string, { value: unknown }>, vertexShader = vertex) => {
    const material = new ShaderMaterial({
      vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false,
      toneMapped: false, fog: false, blending: NormalBlending,
    })
    resources.push(material)
    return material
  }
  const addMesh = (geometry: BufferGeometry, material: ShaderMaterial, name: string) => {
    resources.push(geometry)
    const mesh = new Mesh(geometry, material)
    mesh.name = name; mesh.raycast = noRaycast; mesh.frustumCulled = false
    group.add(mesh)
    return mesh
  }
  // Floor, contact shadow, grid and ground glow: one draw call, analytic distance fades.
  const groundMaterial = makeMaterial(`
    varying vec2 vUv; varying vec3 vWorld;
    uniform vec3 uWhite,uBlue,uViolet,uLine,uShadow;
    ${lightDisplayTransform(gl)}
    void main(){
      vec2 p=(vUv-.5)*100.;
      float r=length(p);
      float alpha=1.-smoothstep(8.,30.,r);
      if(alpha<.002) discard;
      vec3 base=mix(uWhite,uBlue,smoothstep(3.,30.,r)*.38);
      float glow=exp(-pow((r-5.)/3.6,2.))*.13;
      base=mix(base,uViolet,glow);
      vec2 grid=abs(fract(p-.5)-.5)/max(fwidth(p),vec2(.001));
      float line=1.-min(min(grid.x,grid.y),1.);
      float gridFade=(1.-smoothstep(5.,27.,r))*.17;
      base=mix(base,uLine,line*gridFade);
      float contact=exp(-dot(p/vec2(1.5,1.5),p/vec2(1.5,1.5)))*.25;
      base=mix(base,uShadow,contact);
      gl_FragColor=vec4(lightScene(base),alpha);
    }`, {
    uWhite: { value: new Color(C.horizon) }, uBlue: { value: new Color(C.middle) },
    uViolet: { value: new Color(C.lavender) }, uLine: { value: new Color(C.line) }, uShadow: { value: new Color(C.shadow) },
  })
  const ground = addMesh(new PlaneGeometry(100, 100), groundMaterial, 'light-ground')
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.08; ground.renderOrder = -6

  // Dark curtain shape reused locally; only light palette/blending differ.
  const auroraTime = { value: 12 }
  const auroraMaterial = makeMaterial(`
  uniform float uTime;
  uniform vec3 uCyan, uViolet;
  varying vec2 vUv;
  varying float vAngle;

  ${lightDisplayTransform(gl)}

  float curtain(float x, float base, float seed) {
    float h = vUv.y - base;
    float rise = max(h, 0.0);
    float fold = sin(13.0 * x + seed + uTime * 0.03);
    float phase = x * 103.0 + 2.4 * fold + rise * (4.0 + 2.0 * fold);
    float rays = smoothstep(0.08, 0.94, 0.5 + 0.32 * sin(phase) + 0.18 * sin(phase * 1.67));
    float lip = exp(-rise * 70.0);
    float veil = exp(-rise * mix(20.0, 8.0, rays));
    return smoothstep(-0.014, 0.006, h) * (0.36 * lip + (0.16 + 0.6 * rays) * veil);
  }

  void main() {
    // Positive x points right in the default camera view.
    float x = mod(${C.backAzimuth} - vAngle + 3.1415926, 6.2831853) - 3.1415926;
    float arc = 1.0 - smoothstep(0.68, 1.12, abs(x));
    if (arc <= 0.0) discard;
    float drift = 0.015 * sin(uTime * 0.045);
    float bend = x + drift;
    float mainBase = 0.26 + 0.40 * smoothstep(0.04, 0.58, bend) + 0.04 * sin(9.0 * bend);
    float violetBase = 0.49 - 0.22 * smoothstep(-0.48, -0.25, x - drift)
      + 0.08 * sin(6.0 * x + drift);
    float cyan = curtain(x, mainBase, 0.0) * 0.48;
    float violet = curtain(x, violetBase, 2.3) * 0.42
      * (1.0 - smoothstep(0.08, 0.52, x));
    float wispBase = 0.14 + 0.12 * sin(5.0 * bend - 1.0);
    float wisp = 0.12 * curtain(x, wispBase, 4.7) * smoothstep(0.18, 0.52, sin(8.0 * x - 1.1));
    float total = cyan + violet + wisp;
    vec3 color = (cyan * uCyan
      + violet * uViolet
      + wisp * mix(uCyan, uViolet, 0.5)) / max(total, 0.001);
    gl_FragColor = vec4(lightScene(color), arc * min(total * 2.8, ${C.auroraOpacity}) * (1.0 - smoothstep(0.84, 1.0, vUv.y)));
    vec4 texel = gl_FragColor;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    gl_FragColor = texel;
  }
`, {
    uTime: auroraTime, uCyan: { value: new Color(C.auroraCyan) }, uViolet: { value: new Color(C.auroraViolet) },
  }, `
  uniform float uTime;
  varying vec2 vUv;
  varying float vAngle;
  void main() {
    vUv = uv;
    vAngle = uv.x * 6.2831853;
    vec3 displaced = position;
    vec2 radial = normalize(position.xz);
    float shift = 0.8 * sin(vAngle * 3.0 + uTime * 0.08 + position.y * 0.35)
      + 0.4 * sin(vAngle * 7.0 - uTime * 0.05);
    displaced.xz += radial * shift * smoothstep(0.0, 0.5, uv.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`)
  auroraMaterial.side = BackSide
  const aurora = addMesh(new CylinderGeometry(30, 30, 12, 96, 12, true), auroraMaterial, 'light-aurora')
  aurora.renderOrder = -5

  const random = randomSource(20261114)
  const dustPositions = new Float32Array(120 * 3)
  const dustPhases = new Float32Array(120)
  for (let i = 0; i < 120; i++) {
    const angle = C.backAzimuth + (random() - .5) * Math.PI * 1.2
    const r = 7 + random() * 23
    dustPositions.set([Math.cos(angle) * r, .4 + random() * 10, Math.sin(angle) * r], i * 3)
    dustPhases[i] = random() * TAU
  }
  const dustGeometry = new BufferGeometry()
  dustGeometry.setAttribute('position', new BufferAttribute(dustPositions, 3))
  dustGeometry.setAttribute('phase', new BufferAttribute(dustPhases, 1))
  resources.push(dustGeometry)
  const dustTime = { value: 12 }
  const dustMaterial = makeMaterial(`
    varying float vAlpha; uniform vec3 uWhite,uBlue;
    void main(){
      float d=length(gl_PointCoord-.5);
      if(d>.5)discard;
      float a=exp(-d*d*19.)*(1.-smoothstep(.35,.5,d));
      gl_FragColor=vec4(mix(uWhite,uBlue,.28),a*vAlpha*.55);
    }`, { uTime: dustTime, uWhite: { value: color(C.sun) }, uBlue: { value: color(C.auroraCyan) } }, `
    attribute float phase; uniform float uTime; varying float vAlpha;
    void main(){
      vec3 p=position+vec3(sin(phase+uTime*.08)*.2,sin(phase+uTime*.055)*.35,0.);
      vec4 v=modelViewMatrix*vec4(p,1.);
      gl_Position=projectionMatrix*v;
      gl_PointSize=clamp(125./max(-v.z,1.),2.,7.);
      vAlpha=.45+.35*sin(phase+uTime*.12);
    }`)
  const dust = new Points(dustGeometry, dustMaterial)
  dust.name = 'light-dust'; dust.raycast = noRaycast; dust.renderOrder = -2; group.add(dust)

  // Ten instanced crystal bodies + a single merged edge buffer = two calls.
  const crystalGeometry = new OctahedronGeometry(1, 0)
  resources.push(crystalGeometry)
  const crystalMaterial = makeMaterial(`
    varying vec3 vNormal,vView;
    uniform vec3 uBody,uRim;
    void main(){
      float f=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),3.);
      gl_FragColor=vec4(mix(uBody,uRim,f),mix(.2,.65,f));
    }`, { uBody: { value: color(C.cyan) }, uRim: { value: color(C.crystalRim) } }, `
    varying vec3 vNormal,vView;
    void main(){
      vec3 s=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
      vNormal=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*(normal/(s*s)));
      vec4 world=modelMatrix*instanceMatrix*vec4(position,1.);
      vView=cameraPosition-world.xyz;
      gl_Position=projectionMatrix*viewMatrix*world;
    }`)
  crystalMaterial.side = FrontSide
  const bodies = new InstancedMesh(crystalGeometry, crystalMaterial, 10)
  bodies.instanceMatrix.setUsage(StaticDrawUsage)
  bodies.name = 'light-crystal-bodies'; bodies.raycast = noRaycast; bodies.frustumCulled = false
  bodies.renderOrder = -4
  const edge = new EdgesGeometry(crystalGeometry)
  const attr = edge.getAttribute('position')
  const edges: number[] = []
  const point = new Vector3()
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const angle = C.backAzimuth + side * MathUtils.degToRad(24 + random() * 28)
    const radius = 16 + random() * 8
    const matrix = new Matrix4().compose(
      new Vector3(Math.cos(angle) * radius, .5 + random() * 2, Math.sin(angle) * radius),
      new Quaternion().setFromEuler(new Euler(random() * .2, random() * TAU, random() * .2)),
      new Vector3(.35 + random() * .3, 1.1 + random() * 1.3, .35 + random() * .3),
    )
    bodies.setMatrixAt(i, matrix)
    for (let j = 0; j < attr.count; j++) { point.fromBufferAttribute(attr, j).applyMatrix4(matrix); edges.push(point.x, point.y, point.z) }
  }
  edge.dispose()
  bodies.instanceMatrix.needsUpdate = true
  const crystals = new Group()
  crystals.name = 'light-crystals'; crystals.raycast = noRaycast
  crystals.add(bodies)
  const makeLines = (positions: number[], name: string, tint: string, opacity: number) => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    const material = new LineBasicMaterial({ color: color(tint), transparent: true, opacity,
      blending: NormalBlending, depthWrite: false, toneMapped: false, fog: false })
    resources.push(geometry, material)
    const line = new LineSegments(geometry, material)
    line.name = name; line.raycast = noRaycast; line.frustumCulled = false
    return line
  }
  const crystalEdges = makeLines(edges, 'light-crystal-edges', C.line, .6)
  crystalEdges.renderOrder = -3
  crystals.add(crystalEdges)
  group.add(crystals)

  const rings: number[] = []
  for (const ring of ORBIT_RINGS) {
    for (let i = 0; i < 160; i++) {
      for (const t of [i / 160 * TAU, (i + 1) / 160 * TAU]) rings.push(Math.cos(t) * ring.radius, ORBIT_Y, Math.sin(t) * ring.radius)
    }
  }
  const orbit = makeLines(rings, 'light-orbit-rings', C.line, .4)
  group.add(orbit)
  const positions = NEON_CUBE_CLUSTER_LAYOUT.map(node => node.position)
  const lines: number[] = []
  for (const [a, b] of [[0, 2], [2, 1], [1, 0], [2, 3], [3, 1]]) lines.push(...positions[requireDefined(a, 'light-environment.ts:320')]!, ...positions[requireDefined(b, 'light-environment.ts:320')]!)
  group.add(makeLines(lines, 'light-constellation', C.line, .45))
  let disposed = false
  return {
    group,
    step(this: void, elapsed: number) {
      auroraTime.value = elapsed
      dustTime.value = elapsed
      crystals.rotation.y = Math.sin(elapsed * .04) * MathUtils.degToRad(4)
      orbit.rotation.y = elapsed * .012
    },
    dispose() {
      if (disposed) return
      disposed = true
      bodies.dispose()
      resources.forEach(resource => resource.dispose())
    },
  }
}

// Imperative Three.js ownership stays outside React render/immutability analysis.
export function attachLightEnvironment(scene: Scene, gl: WebGLRenderer) {
  const layers = createLightLayers(gl)
  let sky: ReturnType<typeof bakeLightSky>
  try { sky = bakeLightSky(gl) }
  catch (error) { layers.dispose(); throw error }
  scene.add(layers.group)
  scene.background = sky.texture
  return {
    step: layers.step,
    dispose() {
      scene.remove(layers.group)
      if (scene.background === sky.texture) scene.background = null
      layers.dispose()
      sky.dispose()
    },
  }
}
