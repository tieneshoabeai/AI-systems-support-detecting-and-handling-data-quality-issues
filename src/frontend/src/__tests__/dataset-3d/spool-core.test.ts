import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { SPOOL_CORE } from '../../graphics/holographic-core/core-visual-config'
import { createSpoolCore } from '../../graphics/holographic-core/spool-core'

function findByName(root: THREE.Object3D, name: string) {
  const found = root.getObjectByName(name)
  expect(found, `thiếu node ${name}`).toBeDefined()
  return found as THREE.Object3D
}

function countDrawables(root: THREE.Object3D) {
  let drawCalls = 0
  let triangles = 0
  root.traverse(object => {
    if (object instanceof THREE.Light) return
    const drawable = object as THREE.Mesh
    if (
      object instanceof THREE.Mesh
      || object instanceof THREE.Line
      || object instanceof THREE.Points
      || object instanceof THREE.Sprite
    ) {
      drawCalls += 1
    }
    if (!(object instanceof THREE.Mesh) || !drawable.geometry) return
    const geometry = drawable.geometry
    const indexCount = geometry.index ? geometry.index.count : geometry.getAttribute('position')?.count ?? 0
    const instances = object instanceof THREE.InstancedMesh ? object.count : 1
    triangles += (indexCount / 3) * instances
  })
  return { drawCalls, triangles }
}

describe('spool core config', () => {
  it('stacks platform, base, chamber and cap without gaps', () => {
    const { platform, baseGlass, lowerBand, chamber, cap } = SPOOL_CORE
    expect(platform.centerY + platform.thickness / 2).toBeCloseTo(baseGlass.centerY - baseGlass.height / 2, 6)
    expect(baseGlass.centerY + baseGlass.height / 2).toBeCloseTo(lowerBand.centerY - lowerBand.height / 2, 6)
    expect(lowerBand.centerY + lowerBand.height / 2).toBeCloseTo(chamber.centerY - chamber.height / 2, 6)
    expect(chamber.centerY + chamber.height / 2).toBeCloseTo(cap.bottomY, 6)
    expect(cap.bottomY - (chamber.centerY + chamber.height / 2)).toBeCloseTo(0, 6)
    expect(cap.drum.centerY - cap.drum.height / 2).toBeCloseTo(cap.bottomY, 6)
    expect(cap.drum.centerY + cap.drum.height / 2).toBeCloseTo(cap.roof.bottomY, 6)
    expect(cap.roof.topY).toBeCloseTo(SPOOL_CORE.topY, 6)
    expect(cap.lid.centerY + cap.lid.height / 2).toBeCloseTo(SPOOL_CORE.topY, 6)
    expect(cap.lid.centerY - cap.lid.height / 2).toBeLessThan(cap.roof.bottomY)
    expect(cap.topY - cap.bottomY).toBeCloseTo(0.42, 6)
    expect(SPOOL_CORE.nucleus.y).toBeGreaterThan(chamber.centerY - chamber.height / 2)
    expect(SPOOL_CORE.nucleus.y).toBeLessThan(chamber.centerY + chamber.height / 2)
  })

  it('wraps the chamber in a 0.01 glass wall and keeps a capsule nucleus inside', () => {
    const { chamber, nucleus } = SPOOL_CORE
    expect(chamber.height).toBeCloseTo(0.99, 6)
    expect(chamber.wall).toBeCloseTo(0.01, 6)
    expect(nucleus.radius).toBeCloseTo(0.2, 6)
    expect(nucleus.length).toBeCloseTo(0.16, 6)
    const nucleusHeight = nucleus.radius * 2 + nucleus.length
    expect(nucleus.y - nucleusHeight / 2).toBeGreaterThan(chamber.centerY - chamber.height / 2)
    expect(nucleus.y + nucleusHeight / 2).toBeLessThan(chamber.centerY + chamber.height / 2)
  })

  it('floats the backdrop off the glass so nothing shares a depth', () => {
    const { chamber } = SPOOL_CORE
    const inner = chamber.radius - chamber.wall
    const backdropRadius = inner - chamber.backdrop.radiusInset
    const bottom = chamber.centerY - chamber.height / 2
    const top = chamber.centerY + chamber.height / 2
    expect(backdropRadius).toBeLessThan(inner - 0.008)
    // Outside the drifting motes, otherwise a mote behind the axis would pop through the wall.
    expect(backdropRadius).toBeGreaterThan(SPOOL_CORE.particles.chamberRadius + 0.05)
    // The lit region is where the light's cutoff sphere crosses the wall, i.e.
    // |dy| <= sqrt(distance^2 - backdropRadius^2). At distance 1.2 that half-band is 0.76, taller
    // than the wall's own 0.495, so the whole surface is in reach and only the inverse-square
    // falloff shapes it into a pool. If distance ever drops to backdropRadius the squared
    // (1 - (d/cutoff)^4) window zeroes the pool entirely, which is the invisible-light bug P28 fixed.
    const { light } = SPOOL_CORE.nucleus
    expect(light.distance).toBeGreaterThan(backdropRadius)
    expect(Math.sqrt(light.distance ** 2 - backdropRadius ** 2)).toBeGreaterThan(chamber.height / 2)
    expect(bottom + chamber.backdrop.heightInset).toBeGreaterThan(bottom)
    expect(top - chamber.backdrop.heightInset).toBeLessThan(top)
    expect(top - chamber.backdrop.heightInset).toBeLessThan(SPOOL_CORE.cap.bottomY)
  })

  it('splits the cap into lid, roof and wide drum around a through hole', () => {
    const { cap } = SPOOL_CORE
    expect(cap.lid.outerRadius).toBeCloseTo(0.8, 6)
    expect(cap.lid.innerRadius).toBeCloseTo(0.65, 6)
    expect(cap.lid.outerRadius - cap.lid.innerRadius).toBeCloseTo(0.15, 6)
    expect(cap.lid.height).toBeCloseTo(0.2, 6)
    expect(cap.roof.topInner - cap.lid.outerRadius).toBeCloseTo(0.1, 6)
    expect(cap.roof.topOuter - cap.roof.topInner).toBeCloseTo(0.15, 6)
    expect(cap.roof.bottomOuter - cap.roof.bottomInner).toBeCloseTo(0.15, 6)
    expect(cap.roof.topY - cap.roof.bottomY).toBeCloseTo(0.12, 6)
    expect(cap.drum.outerRadius - cap.drum.innerRadius).toBeCloseTo(0.15, 6)
    expect(cap.drum.height).toBeCloseTo(0.3, 6)
    expect(cap.lid.innerRadius).toBeLessThan(cap.drum.innerRadius)
  })

  it('keeps the orbits outside the drum and inside the tower ring', () => {
    const outerMost = Math.max(...SPOOL_CORE.orbits.radii)
    const innerMost = Math.min(...SPOOL_CORE.orbits.radii)
    expect(innerMost - SPOOL_CORE.orbits.tube).toBeGreaterThan(SPOOL_CORE.cap.outerRadius)
    expect(outerMost).toBeLessThan(2.3)
    expect(SPOOL_CORE.orbits.radii).toHaveLength(4)
    expect(SPOOL_CORE.orbits.sphereCount).toBe(8)
  })

  it('keeps the teal palette and particle mix in bounds', () => {
    const [r, g, b] = SPOOL_CORE.palette.iceLinear
    expect(g).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(r)
    expect(SPOOL_CORE.palette.amberLinear[0]).toBeGreaterThan(SPOOL_CORE.palette.amberLinear[1])
    const { chamber, stream, floating, sparks } = SPOOL_CORE.particles
    expect(chamber + stream + floating + sparks).toBe(164)
    expect(stream).toBeGreaterThan(sparks)
  })
})

describe('spool core model', () => {
  it('builds the four stack parts with their detail meshes', () => {
    const spool = createSpoolCore()
    expect(spool.parts.top.name).toBe('spool-top')
    expect(spool.parts.chamber.name).toBe('spool-chamber')
    expect(spool.parts.base.name).toBe('spool-base')
    expect(spool.parts.platform.name).toBe('spool-platform')
    expect(spool.parts.fx.name).toBe('spool-fx')

    findByName(spool.parts.top, 'spool-cap-lid')
    findByName(spool.parts.top, 'spool-cap-roof')
    findByName(spool.parts.top, 'spool-cap-drum')
    findByName(spool.parts.top, 'spool-cap-band')
    findByName(spool.parts.top, 'spool-cap-lid-part')
    findByName(spool.parts.top, 'spool-cap-roof-part')
    findByName(spool.parts.top, 'spool-cap-drum-part')
    findByName(spool.parts.top, 'spool-cap-lid-rims')
    findByName(spool.parts.top, 'spool-cap-roof-rims')
    findByName(spool.parts.chamber, 'spool-chamber-glass')
    expect(findByName(spool.parts.chamber, 'spool-chamber-glass')).toBeInstanceOf(THREE.Mesh)
    expect(spool.parts.chamber.getObjectByName('spool-chamber-rings')).toBeUndefined()
    expect(spool.parts.chamber.getObjectByName('spool-chamber-ticks')).toBeUndefined()
    findByName(spool.parts.chamber, 'spool-nucleus')
    expect(findByName(spool.parts.chamber, 'spool-nucleus-glow')).toBeInstanceOf(THREE.Sprite)
    const nucleusLight = findByName(spool.parts.chamber, 'spool-nucleus-light')
    expect(nucleusLight).toBeInstanceOf(THREE.PointLight)
    const light = nucleusLight as THREE.PointLight
    expect(light.distance).toBe(SPOOL_CORE.nucleus.light.distance)
    expect(light.decay).toBe(SPOOL_CORE.nucleus.light.decay)
    // P25 pinned this to the inner glass so the light could not touch it. That also kept it off the
    // backdrop at r 0.930, which is why there was no pool; human signed off on trading glass lift.
    expect(light.distance).toBeGreaterThan(SPOOL_CORE.chamber.radius)
    findByName(spool.parts.base, 'spool-base-glass')
    findByName(spool.parts.base, 'spool-lower-band')
    findByName(spool.parts.base, 'spool-base-rims')
    findByName(spool.parts.platform, 'spool-platform')
    findByName(spool.parts.platform, 'spool-platform-rings')
    findByName(spool.parts.platform, 'spool-platform-reflection')

    const orbitGroup = findByName(spool.parts.fx, 'spool-orbits')
    findByName(orbitGroup, 'spool-orbit-tubes')
    const spheres = orbitGroup.children.find(child => child instanceof THREE.InstancedMesh) as THREE.InstancedMesh
    expect(spheres).toBeInstanceOf(THREE.InstancedMesh)
    expect(spheres.count).toBe(SPOOL_CORE.orbits.sphereCount)

    const particles = spool.parts.fx.children.find(
      child => child instanceof THREE.InstancedMesh && child.count === 164,
    ) as THREE.InstancedMesh
    expect(particles).toBeInstanceOf(THREE.InstancedMesh)
    expect(particles.count).toBe(164)

    spool.dispose()
  })

  it('stands one opaque depth-writing wall behind the chamber', () => {
    const spool = createSpoolCore()
    const backdrop = findByName(spool.parts.chamber, 'spool-chamber-backdrop')
    expect(backdrop).toBeInstanceOf(THREE.Mesh)
    const mesh = backdrop as THREE.Mesh
    const material = mesh.material as THREE.MeshStandardMaterial
    // The whole point: it must not join the transparent bucket, or nothing gains real depth.
    expect(material.transparent).toBe(false)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.BackSide)

    const { chamber } = SPOOL_CORE
    const inner = chamber.radius - chamber.wall
    mesh.geometry.computeBoundingBox()
    const size = mesh.geometry.boundingBox!.getSize(new THREE.Vector3())
    expect(size.x / 2).toBeCloseTo(inner - chamber.backdrop.radiusInset, 6)
    expect(mesh.position.y).toBeCloseTo(chamber.centerY, 6)
    expect(size.y).toBeCloseTo(chamber.height - chamber.backdrop.heightInset * 2, 6)
    expect(size.x / 2).toBeLessThan(inner)

    // It is scenery, not a selectable part.
    expect([...spool.selectableMeshes.values()]).not.toContain(mesh)
    spool.dispose()
  })

  it('ranks the nucleus above its own trim and lands a readable pool on the wall', () => {
    const spool = createSpoolCore()
    const nucleus = findByName(spool.parts.chamber, 'spool-nucleus') as THREE.Mesh
    const trim = findByName(spool.parts.top, 'spool-cap-lid-rims') as THREE.Mesh
    const coreMaterial = nucleus.material as THREE.MeshBasicMaterial
    const trimMaterial = trim.material as THREE.MeshBasicMaterial
    // One shared instance means one shared shader output, which is what left the core without a
    // focal point. The four rims may keep sharing `ice`; the nucleus may not.
    expect(coreMaterial).not.toBe(trimMaterial)
    // Additive blending with toneMapped:false, so what reaches the eye per pixel is color * opacity.
    const perPixel = (material: THREE.MeshBasicMaterial) => material.color.b * material.opacity
    expect(perPixel(coreMaterial) / perPixel(trimMaterial)).toBeGreaterThanOrEqual(1.5)

    const backdrop = findByName(spool.parts.chamber, 'spool-chamber-backdrop') as THREE.Mesh
    const wall = backdrop.material as THREE.MeshStandardMaterial
    // Nothing in this scene ever installs an environment map, so metalness here only discards diffuse.
    expect(wall.metalness).toBe(0)

    // Mirrors three.js getDistanceAttenuation then BRDF_Lambert, read at the wall point nearest the
    // light (same height, so distance is the radius and NdotL is 1). The regression guard: P25's
    // cutoff 0.94 against a 0.930 wall scored 2.6e-5 here, i.e. a light nobody could ever see.
    const radius = SPOOL_CORE.chamber.radius - SPOOL_CORE.chamber.wall - SPOOL_CORE.chamber.backdrop.radiusInset
    const { intensity, distance, decay } = SPOOL_CORE.nucleus.light
    const window = Math.max(0, 1 - (radius / distance) ** 4)
    const pool = (wall.color.b / Math.PI) * intensity * (window * window / radius ** decay)
    // A hotspot, not a wash: clearly above the wall's own glow, still far under the bloom threshold
    // of 1, because a backdrop that blooms would out-shout the thing it exists to frame.
    expect(pool).toBeGreaterThan(0.1)
    expect(pool / (wall.emissive.b * wall.emissiveIntensity)).toBeGreaterThan(2)
    expect(pool).toBeLessThan(1)
    spool.dispose()
  })

  it('maps the three selectable parts onto the old core ids', () => {
    const spool = createSpoolCore()
    expect([...spool.selectableMeshes.keys()].sort()).toEqual([
      'core-cap-drum', 'core-cap-lid', 'core-cap-roof', 'core-lower', 'core-upper',
    ])
    expect(spool.selectableMeshes.get('core-cap-lid')?.name).toBe('spool-cap-lid')
    expect(spool.selectableMeshes.get('core-cap-roof')?.name).toBe('spool-cap-roof')
    expect(spool.selectableMeshes.get('core-cap-drum')?.name).toBe('spool-cap-drum')
    expect(spool.selectableMeshes.get('core-upper')?.name).toBe('spool-chamber-glass')
    expect(spool.selectableMeshes.get('core-lower')?.name).toBe('spool-base-glass')
    spool.dispose()
  })

  it('labels every selectable part with the material it actually renders', () => {
    const spool = createSpoolCore()
    const label = (id: string) => spool.selectableMeshes.get(id)?.userData.sculptComponent.material
    expect(label('core-cap-lid')).toBe('glass')
    expect(label('core-cap-roof')).toBe('dark-glass')
    expect(label('core-cap-drum')).toBe('dark-glass')
    expect(label('core-upper')).toBe('glass')
    expect(label('core-lower')).toBe('glass')
    expect(spool.selectableMeshes.get('core-upper')?.userData.sculptComponent.dimensions).toMatchObject({
      width: 1.9, height: 0.99, depth: 1.9,
    })
    spool.dispose()
  })

  it('lifts every cap layer and the base to its own explode height', () => {
    const spool = createSpoolCore()
    const lidPart = findByName(spool.parts.top, 'spool-cap-lid-part')
    const roofPart = findByName(spool.parts.top, 'spool-cap-roof-part')
    const drumPart = findByName(spool.parts.top, 'spool-cap-drum-part')
    const baseShift = findByName(spool.parts.base, 'spool-base-shift')

    spool.setExplode(1)
    expect(drumPart.position.y).toBeCloseTo(0.16, 6)
    expect(roofPart.position.y).toBeCloseTo(0.36, 6)
    expect(lidPart.position.y).toBeCloseTo(0.7, 6)
    expect(baseShift.position.y).toBeCloseTo(0.12, 6)
    expect(lidPart.position.y).toBeGreaterThan(roofPart.position.y)
    expect(roofPart.position.y).toBeGreaterThan(drumPart.position.y)

    spool.setExplode(2)
    expect(lidPart.position.y).toBeCloseTo(0.7, 6)

    spool.reset()
    for (const part of [lidPart, roofPart, drumPart, baseShift]) expect(part.position.y).toBe(0)
    spool.dispose()
  })

  it('animates, resets deterministically and hides fx while detached', () => {
    const spool = createSpoolCore()
    const orbitGroup = findByName(spool.parts.fx, 'spool-orbits')
    const nucleusLight = findByName(spool.parts.chamber, 'spool-nucleus-light') as THREE.PointLight
    const particles = spool.parts.fx.children.find(
      child => child instanceof THREE.InstancedMesh && child.count === 164,
    ) as THREE.InstancedMesh

    // The light rides the same pulse as the capsule, so core and pool breathe as one object. reset()
    // ran at build time, so sin(0) leaves it at base * 0.9.
    expect(nucleusLight.intensity).toBeCloseTo(SPOOL_CORE.nucleus.light.intensity * 0.9, 6)

    const before = new THREE.Matrix4()
    particles.getMatrixAt(0, before)
    const beforeElements = [...before.elements]

    spool.update(2.5, 1 / 60)
    expect(orbitGroup.rotation.y).toBeGreaterThan(0)
    // sin(2.5 * 1.6) is negative, so the pool has to dip with the capsule rather than hold steady.
    expect(nucleusLight.intensity).toBeLessThan(SPOOL_CORE.nucleus.light.intensity * 0.9)
    expect(nucleusLight.intensity).toBeGreaterThan(SPOOL_CORE.nucleus.light.intensity * 0.8)
    particles.getMatrixAt(0, before)
    expect([...before.elements]).not.toEqual(beforeElements)

    spool.reset()
    expect(orbitGroup.rotation.y).toBe(0)
    expect(nucleusLight.intensity).toBeCloseTo(SPOOL_CORE.nucleus.light.intensity * 0.9, 6)
    particles.getMatrixAt(0, before)
    expect([...before.elements]).toEqual(beforeElements)

    spool.setDetached(true)
    expect(spool.parts.fx.visible).toBe(false)
    spool.setDetached(false)
    expect(spool.parts.fx.visible).toBe(true)

    expect(() => spool.dispose()).not.toThrow()
  })

  it('stays inside the triangle and draw-call budget', () => {
    const spool = createSpoolCore()
    const own = { drawCalls: 0, triangles: 0 }
    for (const part of [spool.parts.top, spool.parts.chamber, spool.parts.base, spool.parts.platform, spool.parts.fx]) {
      const partCounts = countDrawables(part)
      own.drawCalls += partCounts.drawCalls
      own.triangles += partCounts.triangles
    }
    expect(own.drawCalls).toBeLessThanOrEqual(SPOOL_CORE.budget.drawCalls)
    expect(Math.round(own.triangles)).toBeLessThanOrEqual(SPOOL_CORE.budget.triangles)
    spool.dispose()
  })
})
