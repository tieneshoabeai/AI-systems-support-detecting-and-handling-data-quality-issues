import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { SPOOL_CORE } from './core-visual-config'

export type SpoolCore = {
  parts: {
    top: THREE.Group
    chamber: THREE.Group
    base: THREE.Group
    platform: THREE.Group
    fx: THREE.Group
  }
  selectableMeshes: Map<string, THREE.Mesh>
  update(elapsedSeconds: number, deltaSeconds: number): void
  reset(): void
  setDetached(detached: boolean): void
  setExplode(progress: number): void
  dispose(): void
}

type ParticleKind = 'chamber' | 'floating' | 'spark'

type ParticleSeed = {
  kind: ParticleKind
  x: number
  y: number
  z: number
  phase: number
  size: number
}

const IDENTITY = new THREE.Quaternion()
const tempPosition = new THREE.Vector3()
const tempScale = new THREE.Vector3()
const tempMatrix = new THREE.Matrix4()
const tempColor = new THREE.Color()

function linearMaterial(rgb: readonly [number, number, number], opacity: number) {
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
  material.color.setRGB(rgb[0], rgb[1], rgb[2])
  return material
}

function glowTexture(): THREE.DataTexture {
  const size = 64
  const data = new Uint8Array(size * size * 4)
  const center = (size - 1) / 2
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const radius = Math.hypot(x - center, y - center) / center
      const alpha = Math.round(255 * Math.pow(Math.max(0, 1 - radius), 2.1))
      const offset = (y * size + x) * 4
      data[offset] = 190
      data[offset + 1] = 255
      data[offset + 2] = 255
      data[offset + 3] = alpha
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function ringGeometry(radius: number, tube: number, y: number, radialSegments = 4) {
  const geometry = new THREE.TorusGeometry(radius, tube, radialSegments, 96)
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, y, 0)
  return geometry
}

function mergeRings(rings: THREE.BufferGeometry[], useGroups = false) {
  const merged = mergeGeometries(rings, useGroups)
  rings.forEach(ring => ring.dispose())
  if (!merged) throw new Error('Không gộp được vòng spool')
  return merged
}

function latheBand(points: ReadonlyArray<readonly [number, number]>, segments = 64) {
  return new THREE.LatheGeometry(
    points.map(([radius, y]) => new THREE.Vector2(radius, y)),
    segments,
  )
}

export function createSpoolCore(): SpoolCore {
  const parts = {
    top: new THREE.Group(),
    chamber: new THREE.Group(),
    base: new THREE.Group(),
    platform: new THREE.Group(),
    fx: new THREE.Group(),
  }
  parts.top.name = 'spool-top'
  parts.chamber.name = 'spool-chamber'
  parts.base.name = 'spool-base'
  parts.platform.name = 'spool-platform'
  parts.fx.name = 'spool-fx'

  const texture = glowTexture()
  const selectableMeshes = new Map<string, THREE.Mesh>()

  const glass = new THREE.MeshPhysicalMaterial({
    color: '#0a3b45',
    emissive: '#0b6a70',
    emissiveIntensity: SPOOL_CORE.palette.glass.emissiveIntensity,
    transparent: true,
    opacity: 0.42,
    roughness: 0.08,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const darkGlass = new THREE.MeshPhysicalMaterial({
    color: '#06232a',
    emissive: '#0a4a50',
    emissiveIntensity: 0.18,
    transparent: true,
    opacity: 0.88,
    roughness: 0.1,
    metalness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const lowerBody = darkGlass.clone()
  lowerBody.color.set(SPOOL_CORE.palette.lowerBody.color)
  lowerBody.emissive.set(SPOOL_CORE.palette.lowerBody.emissive)
  lowerBody.emissiveIntensity = SPOOL_CORE.palette.lowerBody.emissiveIntensity
  lowerBody.opacity = SPOOL_CORE.palette.lowerBody.opacity
  const metal = new THREE.MeshStandardMaterial({
    color: SPOOL_CORE.palette.metal.color,
    emissive: SPOOL_CORE.palette.metal.emissive,
    emissiveIntensity: SPOOL_CORE.palette.metal.emissiveIntensity,
    roughness: 0.38,
    metalness: 0.78,
  })
  // `ice` is deliberately shared by the four rim rings (cap lid, cap roof, base) so they read as one
  // machined band of trim. The nucleus used to share it too, which meant it was the same shader
  // output per pixel as the trim and could never be the focal point. `nucleusHot` is its own.
  const ice = linearMaterial(SPOOL_CORE.palette.iceLinear, 0.9)
  const nucleusHot = linearMaterial(SPOOL_CORE.palette.nucleusHotLinear, 0.95)
  const platformRing = linearMaterial(SPOOL_CORE.palette.platformLinear, 0.55)
  const orbitGlass = linearMaterial([0.06, 1.15, 1.05], 0.45)
  const orbitSphere = linearMaterial([0.4, 1.85, 1.75], 0.9)

  // --- Cap: lid ring, symmetric sloped roof and wide drum, all open through the centre. ---
  // Each cap layer is its own pivot so the exploded view can lift them to distinct heights.
  const { cap } = SPOOL_CORE
  const capExplode = { drum: 0.16, roof: 0.36, lid: 0.7 }
  const baseExplode = 0.12
  const drumPart = new THREE.Group()
  drumPart.name = 'spool-cap-drum-part'
  const roofPart = new THREE.Group()
  roofPart.name = 'spool-cap-roof-part'
  const lidPart = new THREE.Group()
  lidPart.name = 'spool-cap-lid-part'
  parts.top.add(drumPart, roofPart, lidPart)

  const lidBottom = cap.lid.centerY - cap.lid.height / 2
  const lidTop = cap.lid.centerY + cap.lid.height / 2
  const innerLidBottom = cap.innerLid.centerY - cap.innerLid.height / 2
  const innerLidTop = cap.innerLid.centerY + cap.innerLid.height / 2
  // Two disconnected hollow bands, one glass material and one explode pivot. Merging keeps
  // the 19-drawable core budget and one selectable lid id without filling either hole/gap.
  const lid = new THREE.Mesh(
    mergeRings([
      latheBand([
        [cap.lid.innerRadius, lidBottom],
        [cap.lid.outerRadius, lidBottom],
        [cap.lid.outerRadius, lidTop],
        [cap.lid.innerRadius, lidTop],
        [cap.lid.innerRadius, lidBottom],
      ]),
      latheBand([
        [cap.innerLid.innerRadius, innerLidBottom],
        [cap.innerLid.outerRadius, innerLidBottom],
        [cap.innerLid.outerRadius, innerLidTop],
        [cap.innerLid.innerRadius, innerLidTop],
        [cap.innerLid.innerRadius, innerLidBottom],
      ]),
    ]),
    glass,
  )
  lid.name = 'spool-cap-lid'
  lid.renderOrder = 4
  lid.userData.sculptComponent = {
    id: 'core-cap-lid', name: 'Cap lid rings', role: 'projected-part', material: 'glass',
    level: 'meso', dimensions: {
      width: cap.lid.outerRadius * 2,
      height: Math.max(lidTop, innerLidTop) - Math.min(lidBottom, innerLidBottom),
      depth: cap.lid.outerRadius * 2, units: 'relative',
    },
  }
  lidPart.add(lid)
  selectableMeshes.set('core-cap-lid', lid)

  // The roof bottom is inset by 2 mm so the coplanar drum top face does not z-fight.
  const roofTopY = cap.roof.topY
  const roofBottomY = cap.roof.bottomY + 0.002
  const roof = new THREE.Mesh(
    latheBand([
      [cap.roof.topInner, roofTopY],
      [cap.roof.topOuter, roofTopY],
      [cap.roof.bottomOuter, roofBottomY],
      [cap.roof.bottomInner, roofBottomY],
      [cap.roof.topInner, roofTopY],
    ]),
    darkGlass,
  )
  roof.name = 'spool-cap-roof'
  roof.renderOrder = 3
  roof.userData.sculptComponent = {
    id: 'core-cap-roof', name: 'Cap sloped roof', role: 'projected-part', material: 'dark-glass',
    level: 'meso', dimensions: {
      width: cap.roof.topOuter * 2, height: cap.roof.topY - cap.roof.bottomY,
      depth: cap.roof.topOuter * 2, units: 'relative',
    },
  }
  roofPart.add(roof)
  selectableMeshes.set('core-cap-roof', roof)

  const drum = new THREE.Mesh(
    latheBand([
      [cap.drum.innerRadius, cap.drum.centerY - cap.drum.height / 2],
      [cap.drum.outerRadius, cap.drum.centerY - cap.drum.height / 2],
      [cap.drum.outerRadius, cap.drum.centerY + cap.drum.height / 2],
      [cap.drum.innerRadius, cap.drum.centerY + cap.drum.height / 2],
      [cap.drum.innerRadius, cap.drum.centerY - cap.drum.height / 2],
    ]),
    darkGlass,
  )
  drum.name = 'spool-cap-drum'
  drum.renderOrder = 4
  drum.userData.sculptComponent = {
    id: 'core-cap-drum', name: 'Cap wide drum', role: 'projected-part', material: 'dark-glass',
    level: 'meso', dimensions: {
      width: cap.drum.outerRadius * 2, height: cap.drum.height, depth: cap.drum.outerRadius * 2, units: 'relative',
    },
  }
  drumPart.add(drum)
  selectableMeshes.set('core-cap-drum', drum)

  const capBand = new THREE.Mesh(
    new THREE.CylinderGeometry(cap.neck.radius + 0.004, cap.neck.radius + 0.004, cap.neck.height, 96, 1, true),
    metal,
  )
  capBand.position.y = cap.neck.centerY
  capBand.name = 'spool-cap-band'
  drumPart.add(capBand)

  const lidRims = new THREE.Mesh(
    mergeRings([
      ringGeometry(cap.lid.innerRadius + 0.006, 0.004, lidTop - 0.004),
      ringGeometry(cap.lid.outerRadius - 0.006, 0.004, lidTop - 0.004),
    ]),
    ice,
  )
  lidRims.name = 'spool-cap-lid-rims'
  lidRims.renderOrder = 7
  lidRims.raycast = () => {}
  lidPart.add(lidRims)

  const roofRims = new THREE.Mesh(
    mergeRings([
      ringGeometry(cap.roof.topInner + 0.006, 0.004, roofTopY - 0.004),
      ringGeometry(cap.roof.topOuter - 0.006, 0.004, roofTopY - 0.004),
      ringGeometry(cap.roof.bottomOuter - 0.004, 0.004, cap.roof.bottomY + 0.004),
      ringGeometry(cap.roof.bottomInner + 0.004, 0.003, cap.roof.bottomY + 0.004),
    ]),
    ice,
  )
  roofRims.name = 'spool-cap-roof-rims'
  roofRims.renderOrder = 7
  roofRims.raycast = () => {}
  roofPart.add(roofRims)

  // --- Chamber: concentric shells share a pivot and pick id, with separate material groups. ---
  const { chamber } = SPOOL_CORE
  const chamberInner = chamber.radius - chamber.wall
  // A uniform baked diffuse fill keeps the milky wall neutral under the blue ambient light.
  // It lights only this material and adds no emission or scene-wide light.
  const outerGlassFill = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  outerGlassFill.channel = 0
  outerGlassFill.needsUpdate = true
  const outerGlass = new THREE.MeshPhysicalMaterial({
    ...chamber.outerGlass.material,
    lightMap: outerGlassFill,
    emissive: '#000000', emissiveIntensity: 0,
    transparent: true, metalness: 0,
    clearcoat: 0, side: THREE.DoubleSide, depthWrite: false,
  })
  const chamberGlass = new THREE.Mesh(
    mergeRings([
      latheBand([
        [chamberInner, -chamber.height / 2],
        [chamber.radius, -chamber.height / 2],
        [chamber.radius, chamber.height / 2],
        [chamberInner, chamber.height / 2],
        [chamberInner, -chamber.height / 2],
      ]),
      latheBand([
        [chamber.outerGlass.innerRadius, -chamber.height / 2],
        [chamber.outerGlass.outerRadius, -chamber.height / 2],
        [chamber.outerGlass.outerRadius, chamber.height / 2],
        [chamber.outerGlass.innerRadius, chamber.height / 2],
        [chamber.outerGlass.innerRadius, -chamber.height / 2],
      ]),
    ], true),
    [glass, outerGlass],
  )
  chamberGlass.position.y = chamber.centerY
  chamberGlass.name = 'spool-chamber-glass'
  chamberGlass.renderOrder = 3
  chamberGlass.userData.sculptComponent = {
    id: 'core-upper', name: 'Spool chamber', role: 'projected-part', material: 'glass',
    level: 'macro', dimensions: { width: chamber.outerGlass.outerRadius * 2, height: chamber.height, depth: chamber.outerGlass.outerRadius * 2, units: 'relative' },
  }
  parts.chamber.add(chamberGlass)
  selectableMeshes.set('core-upper', chamberGlass)

  // Opaque far wall, just inside the glass. Because it is the only depth writer in the chamber it
  // lands in the opaque pass, so real depth sorting replaces the renderOrder guesswork behind it.
  // BackSide draws only the arc the camera cannot see through, which keeps the near rim open.
  // The insets are what keep its rim edges from landing exactly on the glass rims, which P25 pinned.
  const backdropRadius = chamberInner - chamber.backdrop.radiusInset
  const backdropHeight = chamber.height - chamber.backdrop.heightInset * 2
  const backdrop = new THREE.Mesh(
    new THREE.CylinderGeometry(
      backdropRadius, backdropRadius, backdropHeight, 48, 1, true,
    ),
    new THREE.MeshStandardMaterial({
      color: SPOOL_CORE.palette.wall.color,
      emissive: SPOOL_CORE.palette.wall.emissive,
      emissiveIntensity: SPOOL_CORE.palette.wall.emissiveIntensity,
      roughness: SPOOL_CORE.palette.wall.roughness,
      metalness: SPOOL_CORE.palette.wall.metalness,
      side: THREE.BackSide,
    }),
  )
  backdrop.position.y = chamber.centerY
  backdrop.name = 'spool-chamber-backdrop'
  backdrop.raycast = () => {}
  parts.chamber.add(backdrop)

  const { nucleus: nucleusConfig } = SPOOL_CORE
  const nucleus = new THREE.Mesh(
    new THREE.CapsuleGeometry(nucleusConfig.radius, nucleusConfig.length, 8, 24),
    nucleusHot,
  )
  nucleus.position.y = nucleusConfig.y
  nucleus.name = 'spool-nucleus'
  parts.chamber.add(nucleus)

  const glowWidth = nucleusConfig.radius * 2 + 0.6
  const glowHeight = nucleusConfig.radius * 2 + nucleusConfig.length + 0.6
  const nucleusSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }))
  nucleusSprite.position.y = nucleusConfig.y
  nucleusSprite.scale.set(glowWidth, glowHeight, 1)
  nucleusSprite.name = 'spool-nucleus-glow'
  nucleusSprite.renderOrder = 8
  nucleusSprite.raycast = () => {}
  parts.chamber.add(nucleusSprite)

  // The range has to reach past the backdrop at r 0.930, which means it cannot stop at the glass the
  // way P25 wanted: three.js squares the (1 - (d/cutoff)^4) window, so a cutoff that sits on top of
  // the target radius delivers nothing at all. 1.2 puts ~0.12 of pool on the wall.
  const nucleusLight = new THREE.PointLight(
    nucleusConfig.light.color,
    nucleusConfig.light.intensity,
    nucleusConfig.light.distance,
    nucleusConfig.light.decay,
  )
  nucleusLight.position.y = nucleusConfig.y
  nucleusLight.name = 'spool-nucleus-light'
  parts.chamber.add(nucleusLight)

  // --- Base: drum-sized hollow walls, closed at both ends by full glass discs. ---
  const { baseGlass, lowerRoof } = SPOOL_CORE
  // The shift group keeps the explode offset separate from the local offset attach() bakes in.
  const baseShift = new THREE.Group()
  baseShift.name = 'spool-base-shift'
  parts.base.add(baseShift)
  const baseHalfHeight = baseGlass.height / 2
  const baseWalls = mergeRings([
    latheBand([[baseGlass.radius, -baseHalfHeight], [baseGlass.radius, baseHalfHeight]]),
    latheBand([[baseGlass.innerRadius, baseHalfHeight], [baseGlass.innerRadius, -baseHalfHeight]]),
    // Inverted roof, closed all the way to the axis at both ends. Merge into the
    // drum's dark material group so the whole lower assembly keeps one pick id.
    latheBand([
      [0, lowerRoof.bottomY - baseGlass.centerY],
      [lowerRoof.bottomRadius, lowerRoof.bottomY - baseGlass.centerY],
      [lowerRoof.topRadius, lowerRoof.topY - baseGlass.centerY],
      [0, lowerRoof.topY - baseGlass.centerY],
      [0, lowerRoof.bottomY - baseGlass.centerY],
    ]),
  ])
  // Only the vertical walls use darkGlass. Full-radius discs avoid either a central
  // hole or coplanar overlap with dark annular end faces.
  const baseTop = new THREE.CircleGeometry(baseGlass.radius, 64)
  baseTop.rotateX(-Math.PI / 2)
  baseTop.translate(0, baseHalfHeight, 0)
  const baseBottom = new THREE.CircleGeometry(baseGlass.radius, 64)
  baseBottom.rotateX(Math.PI / 2)
  baseBottom.translate(0, -baseHalfHeight, 0)
  const baseShell = new THREE.Mesh(
    mergeRings([baseWalls, mergeRings([baseTop, baseBottom])], true),
    [lowerBody, glass],
  )
  baseShell.position.y = baseGlass.centerY
  baseShell.name = 'spool-base-glass'
  baseShell.renderOrder = 2
  baseShell.userData.sculptComponent = {
    id: 'core-lower', name: 'Closed lower drum and inverted roof', role: 'projected-part', material: 'dark-glass + glass',
    level: 'macro', dimensions: {
      width: baseGlass.radius * 2,
      height: baseGlass.centerY + baseHalfHeight - lowerRoof.bottomY,
      depth: baseGlass.radius * 2, units: 'relative',
    },
  }
  baseShift.add(baseShell)
  selectableMeshes.set('core-lower', baseShell)

  const lowerBand = new THREE.Mesh(
    new THREE.CylinderGeometry(SPOOL_CORE.lowerBand.radius, SPOOL_CORE.lowerBand.radius, SPOOL_CORE.lowerBand.height, 64, 1, true),
    metal,
  )
  lowerBand.position.y = SPOOL_CORE.lowerBand.centerY
  lowerBand.name = 'spool-lower-band'
  baseShift.add(lowerBand)

  const baseRims = new THREE.Mesh(
    mergeRings([
      ringGeometry(baseGlass.radius - 0.005, 0.005, baseGlass.centerY + baseGlass.height / 2 - 0.012, 6),
      ringGeometry(baseGlass.radius - 0.005, 0.004, baseGlass.centerY - baseGlass.height / 2 + 0.012, 6),
    ]),
    ice,
  )
  baseRims.name = 'spool-base-rims'
  baseRims.renderOrder = 7
  baseRims.raycast = () => {}
  baseShift.add(baseRims)

  // --- Platform: glass disc, engraved rings, faked mirror glow (no extra render pass). ---
  const { platform } = SPOOL_CORE
  const platformDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(platform.radius, platform.radius, platform.thickness, 96),
    new THREE.MeshPhysicalMaterial({
      color: '#06222b', metalness: 0.5, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.12,
      transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false,
    }),
  )
  platformDisc.position.y = platform.centerY
  platformDisc.name = 'spool-platform'
  platformDisc.renderOrder = 1
  parts.platform.add(platformDisc)

  const platformRings = new THREE.Mesh(
    mergeRings(platform.ringRadii.map(radius => ringGeometry(radius, 0.004, platform.centerY + platform.thickness / 2 + 0.003))),
    platformRing,
  )
  platformRings.name = 'spool-platform-rings'
  platformRings.renderOrder = 6
  platformRings.raycast = () => {}
  parts.platform.add(platformRings)

  const reflection = new THREE.Mesh(
    new THREE.CircleGeometry(platform.radius * 0.92, 64),
    new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity: 0.22, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }),
  )
  reflection.rotation.x = -Math.PI / 2
  reflection.position.y = platform.centerY - platform.thickness / 2 - 0.002
  reflection.name = 'spool-platform-reflection'
  reflection.renderOrder = 2
  reflection.raycast = () => {}
  parts.platform.add(reflection)

  // --- Orbits: four tilted glass ellipses, merged, plus embedded glow spheres. ---
  const orbitGroup = new THREE.Group()
  orbitGroup.name = 'spool-orbits'
  const orbitGeometries: THREE.BufferGeometry[] = []
  const euler = new THREE.Euler()
  const rotation = new THREE.Matrix4()
  const spherePositions: THREE.Vector3[] = []
  SPOOL_CORE.orbits.radii.forEach((radius, index) => {
    const geometry = new THREE.TorusGeometry(radius, SPOOL_CORE.orbits.tube, 4, 128)
    geometry.rotateX(Math.PI / 2)
    geometry.scale(1, 1, SPOOL_CORE.orbits.flatten)
    euler.set(SPOOL_CORE.orbits.tiltX[index], SPOOL_CORE.orbits.yaw[index], 0)
    rotation.makeRotationFromEuler(euler)
    geometry.applyMatrix4(rotation)
    geometry.translate(0, SPOOL_CORE.orbits.centerY, 0)
    orbitGeometries.push(geometry)
    for (let bead = 0; bead < 2; bead += 1) {
      const angle = 0.7 + bead * 2.9 + index * 0.8
      const point = new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius * SPOOL_CORE.orbits.flatten,
      ).applyMatrix4(rotation)
      point.y += SPOOL_CORE.orbits.centerY
      spherePositions.push(point)
    }
  })
  const orbitMesh = new THREE.Mesh(mergeGeometries(orbitGeometries, false) ?? new THREE.BufferGeometry(), orbitGlass)
  orbitGeometries.forEach(geometry => geometry.dispose())
  orbitMesh.name = 'spool-orbit-tubes'
  orbitMesh.renderOrder = 6
  orbitMesh.raycast = () => {}
  orbitGroup.add(orbitMesh)

  const orbitSpheres = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 8),
    orbitSphere,
    spherePositions.length,
  )
  orbitSpheres.instanceMatrix.setUsage(THREE.StaticDrawUsage)
  orbitSpheres.frustumCulled = false
  orbitSpheres.renderOrder = 8
  orbitSpheres.raycast = () => {}
  spherePositions.forEach((point, index) => {
    tempMatrix.compose(point, IDENTITY, tempScale.setScalar(SPOOL_CORE.orbits.sphereRadius))
    orbitSpheres.setMatrixAt(index, tempMatrix)
  })
  orbitSpheres.instanceMatrix.needsUpdate = true
  orbitGroup.add(orbitSpheres)
  parts.fx.add(orbitGroup)

  // --- Particles: chamber motes, floating motes and amber sparks in one draw. ---
  const seeds: ParticleSeed[] = []
  const chamberRadius = SPOOL_CORE.particles.chamberRadius
  for (let index = 0; index < SPOOL_CORE.particles.chamber; index += 1) {
    const u = (index * 0.6180339887) % 1
    const angle = index * 2.3999632297
    const radius = Math.sqrt(u) * chamberRadius
    seeds.push({
      kind: 'chamber',
      x: Math.cos(angle) * radius,
      y: chamber.centerY - chamber.height / 2 + 0.06 + ((index * 0.7548776662) % 1) * (chamber.height - 0.12),
      z: Math.sin(angle) * radius,
      phase: (index * 0.37) % (Math.PI * 2),
      size: SPOOL_CORE.particles.sizes.chamber * (0.7 + 0.6 * ((index * 0.41) % 1)),
    })
  }
  for (let index = 0; index < SPOOL_CORE.particles.floating; index += 1) {
    const angle = index * 2.3999632297 + 0.9
    const radius = 1.14 + ((index * 0.6180339887) % 1) * 0.48
    seeds.push({
      kind: 'floating',
      x: Math.cos(angle) * radius,
      y: 0.95 + ((index * 0.7548776662) % 1) * 1.2,
      z: Math.sin(angle) * radius,
      phase: (index * 0.61) % (Math.PI * 2),
      size: SPOOL_CORE.particles.sizes.floating * (0.7 + 0.6 * ((index * 0.29) % 1)),
    })
  }
  for (let index = 0; index < SPOOL_CORE.particles.sparks; index += 1) {
    const angle = index * 2.3999632297
    const radius = 0.34 * Math.sqrt((index * 0.6180339887) % 1)
    seeds.push({
      kind: 'spark',
      x: 1.48 + Math.cos(angle) * radius,
      y: 1.5 + ((index * 0.7548776662) % 1) * 0.6,
      z: -0.78 + Math.sin(angle) * radius,
      phase: (index * 0.83) % (Math.PI * 2),
      size: SPOOL_CORE.particles.sizes.spark * (0.8 + 0.5 * ((index * 0.47) % 1)),
    })
  }

  const particleGeometry = new THREE.OctahedronGeometry(1, 0)
  const particleMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
  const particles = new THREE.InstancedMesh(particleGeometry, particleMaterial, seeds.length)
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  particles.frustumCulled = false
  particles.renderOrder = 9
  particles.raycast = () => {}
  seeds.forEach((seed, index) => {
    if (seed.kind === 'spark') tempColor.setRGB(...SPOOL_CORE.palette.amberLinear)
    else tempColor.setRGB(0.15, 1.4, 1.3)
    particles.setColorAt(index, tempColor)
  })
  if (particles.instanceColor) particles.instanceColor.needsUpdate = true
  parts.fx.add(particles)

  function applyParticles(elapsedSeconds: number) {
    seeds.forEach((seed, index) => {
      let scale = seed.size
      if (seed.kind === 'chamber') {
        tempPosition.set(
          seed.x + Math.sin(elapsedSeconds * 0.5 + seed.phase) * 0.02,
          seed.y + Math.sin(elapsedSeconds * 0.7 + seed.phase * 1.3) * 0.03,
          seed.z + Math.cos(elapsedSeconds * 0.45 + seed.phase) * 0.02,
        )
        scale *= 0.85 + Math.sin(elapsedSeconds * 1.5 + seed.phase) * 0.15
      } else if (seed.kind === 'floating') {
        const angle = Math.atan2(seed.z, seed.x) + elapsedSeconds * 0.06
        const radius = Math.hypot(seed.x, seed.z)
        tempPosition.set(
          Math.cos(angle) * radius,
          seed.y + Math.sin(elapsedSeconds * 0.8 + seed.phase) * 0.05,
          Math.sin(angle) * radius,
        )
        scale *= 0.8 + Math.sin(elapsedSeconds * 1.2 + seed.phase) * 0.2
      } else {
        tempPosition.set(
          seed.x + Math.sin(elapsedSeconds * 1.4 + seed.phase) * 0.03,
          seed.y + Math.sin(elapsedSeconds * 0.9 + seed.phase * 1.7) * 0.05,
          seed.z + Math.cos(elapsedSeconds * 1.1 + seed.phase) * 0.02,
        )
        scale *= 0.75 + Math.sin(elapsedSeconds * 3 + seed.phase) * 0.25
      }
      tempMatrix.compose(tempPosition, IDENTITY, tempScale.setScalar(scale))
      particles.setMatrixAt(index, tempMatrix)
    })
    particles.instanceMatrix.needsUpdate = true
  }

  function applyNucleus(elapsedSeconds: number) {
    const pulse = 0.9 + Math.sin(elapsedSeconds * 1.6) * 0.1
    nucleus.scale.setScalar(pulse)
    nucleusSprite.scale.set(glowWidth * pulse, glowHeight * pulse, 1)
    nucleusSprite.material.opacity = 0.45 + pulse * 0.12
    // A core that beats while its light does not reads as two different objects.
    nucleusLight.intensity = nucleusConfig.light.intensity * pulse
  }

  function applyExplode(progress: number) {
    const amount = THREE.MathUtils.clamp(progress, 0, 1)
    drumPart.position.y = capExplode.drum * amount
    roofPart.position.y = capExplode.roof * amount
    lidPart.position.y = capExplode.lid * amount
    baseShift.position.y = baseExplode * amount
  }

  function reset() {
    orbitGroup.rotation.y = 0
    applyExplode(0)
    applyParticles(0)
    applyNucleus(0)
  }

  reset()

  return {
    parts,
    selectableMeshes,
    update(elapsedSeconds) {
      if (!parts.fx.visible) {
        applyNucleus(elapsedSeconds)
        return
      }
      orbitGroup.rotation.y = elapsedSeconds * 0.05
      applyParticles(elapsedSeconds)
      applyNucleus(elapsedSeconds)
    },
    reset,
    setDetached(detached) {
      parts.fx.visible = !detached
    },
    setExplode: applyExplode,
    dispose() {
      texture.dispose()
      outerGlassFill.dispose()
    },
  }
}
