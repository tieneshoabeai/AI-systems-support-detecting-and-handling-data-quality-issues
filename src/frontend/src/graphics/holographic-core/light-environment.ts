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
  const skyColors = ['horizon', 'middle', 'zenith', 'lavender', 'cyan', 'nebulaPearl'] as const
  const uniforms = Object.fromEntries(skyColors.map(name => [name, { value: new Color(C[name]) }]))
  const material = new ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 horizon, middle, zenith, lavender, cyan, nebulaPearl;
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
        vec3 flow=d*vec3(7.,14.,7.);
        flow+=vec3(noise3(d*6.),noise3(d*8.+9.),noise3(d*7.+2.))*2.4;
        float gas=noise3(flow)*.48+noise3(flow*2.7)*.31+noise3(flow*6.3)*.15+noise3(flow*13.)*.06;
        color=mix(color,lavender,smoothstep(.28,.66,gas)*.58);
        color=mix(color,cyan,smoothstep(.32,.73,noise3(d*3.4+8.))*.47);
        float cloudHeight=d.y+.32+.17*sin(longitude*2.4)+(gas-.5)*.42;
        float nebula=exp(-pow(cloudHeight/.19,2.));
        color=mix(color,nebulaPearl,nebula*smoothstep(.20,.71,gas)*.82);
        // A distant pearl-blue moon belongs to the sky, outside the model volume.
        vec3 moonDir=normalize(vec3(-.30,-.22,-.94));
        float moonAngle=acos(clamp(dot(d,moonDir),-1.,1.));
        float moon=1.-smoothstep(.115,.119,moonAngle);
        vec3 tangent=normalize(cross(vec3(0.,1.,0.),moonDir));
        vec3 up=normalize(cross(moonDir,tangent));
        vec2 p=vec2(dot(d,tangent),dot(d,up))/.118;
        float curvature=sqrt(max(0.,1.-dot(p,p)));
        float shade=clamp(.45+.42*dot(vec3(p,curvature),normalize(vec3(-.6,.6,1.))),0.,1.);
        vec3 moonColor=mix(vec3(.40,.51,.76),vec3(.89,.94,1.),shade);
        moonColor=mix(moonColor,lavender,noise3(vec3(p*10.,2.))*.08);
        color=mix(color,moonColor,moon*.32);
        vec3 sunDir=normalize(vec3(cos(${C.backAzimuth}),-.24,sin(${C.backAzimuth})));
        float glow=exp(-pow(acos(clamp(dot(d,sunDir),-1.,1.))/.38,2.));
        color=mix(color,nebulaPearl,glow*.48);
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
      float alpha=(1.-smoothstep(7.,25.,r))*.58;
      if(alpha<.002) discard;
      vec3 base=mix(uWhite,uBlue,smoothstep(3.,30.,r)*.38);
      float glow=exp(-pow((r-5.)/3.6,2.))*.28;
      base=mix(base,uViolet,glow);
      vec2 grid=abs(fract(p-.5)-.5)/max(fwidth(p),vec2(.001));
      float line=1.-min(min(grid.x,grid.y),1.);
      float gridFade=(1.-smoothstep(6.,22.,r))*.25;
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

  // A thin, luminous edge anchors each light-mode ribbon against the pearl sky.
  const auroraTime = { value: 12 }
  const auroraMaterial = makeMaterial(`
  uniform float uTime;
  uniform vec3 uCyan, uViolet;
  varying vec2 vUv;
  varying float vAngle;

  ${lightDisplayTransform(gl)}

  float curtain(float x, float base, float seed) {
    float h = vUv.y - base;
    float fold = sin(15.0 * x + seed + uTime * 0.03);
    float rays = 0.5 + 0.5 * sin(x * 72.0 + 2.4 * fold + h * 19.0);
    float veil = smoothstep(-0.019, 0.012, h) * exp(-max(h, 0.0) * mix(22.0, 10.0, rays));
    float edge = exp(-pow((h - 0.005) / 0.012, 2.0));
    return .57 * veil + .43 * edge;
  }

  void main() {
    // Positive x points right in the default camera view.
    float x = mod(${C.backAzimuth} - vAngle + 3.1415926, 6.2831853) - 3.1415926;
    float arc = 1.0 - smoothstep(0.68, 1.12, abs(x));
    if (arc <= 0.0) discard;
    float drift = 0.015 * sin(uTime * 0.045);
    float bend = x + drift;
    float mainBase = .37 + .28 * smoothstep(-.08, .65, bend) + .065 * sin(5.5 * bend);
    float companion = mainBase + .145 + .048 * sin(7.5 * bend + 1.2);
    float cyan = curtain(x, mainBase, 0.0) * .38;
    float violet = curtain(x, companion, 2.3) * .33 * (1.0 - smoothstep(.24, .85, x));
    float total = cyan + violet;
    vec3 color = (cyan * uCyan + violet * uViolet) / max(total, .001);
    gl_FragColor = vec4(lightScene(color), arc * total * (1.0 - smoothstep(.84, 1.0, vUv.y)));
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
  const dustCount = 120
  const chartCount = 32
  const dustPositions = new Float32Array((dustCount + chartCount * 3) * 3)
  const dustPhases = new Float32Array(dustPositions.length / 3)
  for (let i = 0; i < dustCount; i++) {
    const angle = C.backAzimuth + (random() - .5) * Math.PI * 1.2
    const r = 7 + random() * 23
    dustPositions.set([Math.cos(angle) * r, .4 + random() * 10, Math.sin(angle) * r], i * 3)
    dustPhases[i] = random() * TAU
  }
  // Plot background stars and their connections at render resolution, outside the sky bake.
  const chartRandom = randomSource(4317)
  const chartLines: number[] = []
  for (let i = 0; i < chartCount; i++) {
    const angle = C.backAzimuth + (i % 16 + chartRandom() * .65) / 16 * TAU
    const height = (i < 16 ? -11 : -1) + chartRandom() * 8
    const points = [[-.047, 0], [.008, 1.6], [.071, .4 + chartRandom() * 2]].map(([offset = 0, rise = 0]) =>
      [Math.cos(angle + offset) * 29, height + rise, Math.sin(angle + offset) * 29])
    points.forEach((point, j) => {
      const index = dustCount + i * 3 + j
      dustPositions.set(point, index * 3)
      dustPhases[index] = -1
      const previous = points[j - 1]
      if (previous) chartLines.push(...previous, ...point)
    })
  }
  const dustGeometry = new BufferGeometry()
  dustGeometry.setAttribute('position', new BufferAttribute(dustPositions, 3))
  dustGeometry.setAttribute('phase', new BufferAttribute(dustPhases, 1))
  resources.push(dustGeometry)
  const dustTime = { value: 12 }
  const dustMaterial = makeMaterial(`
    varying float vAlpha,vStar; uniform vec3 uWhite,uBlue,uStar;
    void main(){
      float d=length(gl_PointCoord-.5);
      if(d>.5)discard;
      float a=exp(-d*d*19.)*(1.-smoothstep(.35,.5,d));
      vec4 mote=vec4(mix(uWhite,uBlue,.28),a*vAlpha*.55);
      vec4 star=vec4(uStar,(1.-smoothstep(.22,.5,d))*.83);
      gl_FragColor=mix(mote,star,vStar);
    }`, { uTime: dustTime, uWhite: { value: color(C.sun) }, uBlue: { value: color(C.auroraCyan) },
      uStar: { value: color(C.starBlue) } }, `
    attribute float phase; uniform float uTime; varying float vAlpha,vStar;
    void main(){
      vStar=1.-step(0.,phase);
      vec3 p=position+(1.-vStar)*vec3(sin(phase+uTime*.08)*.2,sin(phase+uTime*.055)*.35,0.);
      vec4 v=modelViewMatrix*vec4(p,1.);
      gl_Position=projectionMatrix*v;
      gl_PointSize=mix(clamp(125./max(-v.z,1.),2.,7.),3.6,vStar);
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
      gl_FragColor=vec4(mix(uBody,uRim,f),mix(.16,.52,f));
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
  const crystalEdges = makeLines(edges, 'light-crystal-edges', C.line, .5)
  crystalEdges.renderOrder = -3
  crystals.add(crystalEdges)
  group.add(crystals)

  const rings: number[] = []
  for (const ring of ORBIT_RINGS) {
    for (let i = 0; i < 160; i++) {
      for (const t of [i / 160 * TAU, (i + 1) / 160 * TAU]) rings.push(Math.cos(t) * ring.radius, ORBIT_Y, Math.sin(t) * ring.radius)
    }
    for (let i = 0; i < 96; i++) {
      const angle = i / 96 * TAU
      const length = i % 8 === 0 ? .23 : .10
      for (const radius of [ring.radius, ring.radius - length]) {
        rings.push(Math.cos(angle) * radius, ORBIT_Y, Math.sin(angle) * radius)
      }
    }
  }
  const orbit = makeLines(rings, 'light-orbit-rings', C.orbit, .52)
  group.add(orbit)
  const positions = NEON_CUBE_CLUSTER_LAYOUT.map(node => node.position)
  const lines = chartLines
  for (const [a, b] of [[0, 2], [2, 1], [1, 0], [2, 3], [3, 1]]) lines.push(...positions[requireDefined(a, 'light-environment.ts:320')]!, ...positions[requireDefined(b, 'light-environment.ts:320')]!)
  group.add(makeLines(lines, 'light-constellation', C.line, .4))
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
