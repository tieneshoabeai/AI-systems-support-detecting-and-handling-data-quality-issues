import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { NEON_CUBE, createNeonCubeModel } from '../../graphics/neon-cube/neon-cube.model'

function worldBox(object: THREE.Object3D) {
  object.updateWorldMatrix(true, true)
  return new THREE.Box3().setFromObject(object)
}

function meshByName(group: THREE.Object3D, name: string) {
  const mesh = group.getObjectByName(name)
  expect(mesh).toBeInstanceOf(THREE.Mesh)
  return mesh as THREE.Mesh
}

describe('neon glass cube model', () => {
  const model = createNeonCubeModel()
  const { group, parts, materials } = model

  it('keeps the four primary parts on the approved parent chain', () => {
    expect(parts['base-outer'].parent).toBe(group)
    expect(parts['base-inner'].parent).toBe(parts['base-outer'])
    expect(parts['cube-outer'].parent).toBe(parts['base-inner'])
    expect(parts['cube-inner'].parent).toBe(parts['cube-outer'])
  })

  it('builds the outer platform with a real hole-sized footprint', () => {
    const base = worldBox(meshByName(group, 'base-outer-shell'))
    const size = base.getSize(new THREE.Vector3())
    expect(size.x).toBeCloseTo(2, 1)
    expect(size.z).toBeCloseTo(2, 1)
    expect(size.y).toBeCloseTo(0.16, 2)
    expect(base.min.y).toBeCloseTo(0, 2)
    expect(base.max.y).toBeCloseTo(0.16, 2)
  })

  it('seats the inner platform 0.02 below the outer platform top', () => {
    const slab = worldBox(meshByName(group, 'base-inner-slab'))
    const size = slab.getSize(new THREE.Vector3())
    expect(size.x).toBeCloseTo(1.48, 2)
    expect(size.z).toBeCloseTo(1.48, 2)
    expect(size.y).toBeCloseTo(0.14, 2)
    expect(slab.min.y).toBeCloseTo(0, 2)
    expect(slab.max.y).toBeCloseTo(0.14, 2)
  })

  it('rests the outer cube on the inner platform top at y=0.14', () => {
    const panels = worldBox(parts['panel-grid'])
    const size = panels.getSize(new THREE.Vector3())
    expect(size.x).toBeCloseTo(1.32, 2)
    expect(size.z).toBeCloseTo(1.32, 2)
    expect(size.y).toBeCloseTo(1.32, 2)
    expect(panels.min.y).toBeCloseTo(0.14, 6)
    expect(panels.max.y).toBeCloseTo(1.46, 2)
  })

  it('centres the 0.88 core cube inside the outer cube', () => {
    const core = worldBox(meshByName(group, 'core-cube'))
    const size = core.getSize(new THREE.Vector3())
    expect(size.x).toBeCloseTo(0.88, 3)
    expect(size.y).toBeCloseTo(0.88, 3)
    expect(size.z).toBeCloseTo(0.88, 3)
    const center = core.getCenter(new THREE.Vector3())
    expect(center.x).toBeCloseTo(0, 6)
    expect(center.y).toBeCloseTo(0.8, 6)
    expect(center.z).toBeCloseTo(0, 6)
    expect(NEON_CUBE.coreSide / NEON_CUBE.cubeSide).toBeCloseTo(2 / 3, 4)
    expect((NEON_CUBE.cubeSide - NEON_CUBE.coreSide) / 2).toBeCloseTo(0.22, 6)
    expect(NEON_CUBE.coreBottomY).toBeCloseTo(0.36, 6)
    expect(NEON_CUBE.coreTopY).toBeCloseTo(1.24, 6)
  })

  it('instances exactly 54 panes and surrounds both cubes with rods', () => {
    const panels = parts['panel-grid']
    expect(panels).toBeInstanceOf(THREE.InstancedMesh)
    expect((panels as THREE.InstancedMesh).count).toBe(54)

    const outerEdges = worldBox(parts['cube-edges'])
    const innerEdges = worldBox(parts['inner-edges'])
    expect(outerEdges.getSize(new THREE.Vector3()).x).toBeCloseTo(1.32 + NEON_CUBE.outerEdgeRod, 2)
    expect(innerEdges.getSize(new THREE.Vector3()).x).toBeCloseTo(0.88 + NEON_CUBE.innerEdgeRod, 2)
    expect(innerEdges.min.y).toBeCloseTo(0.8 - 0.44 - NEON_CUBE.innerEdgeRod / 2, 3)
  })

  it('adds emissive corner markers on both top faces', () => {
    const baseCorners = worldBox(parts['corner-markers-base'])
    const baseSize = baseCorners.getSize(new THREE.Vector3())
    expect(baseSize.y).toBeCloseTo(NEON_CUBE.cornerSize, 6)
    expect(baseCorners.max.y).toBeGreaterThan(0.16)
    expect(baseCorners.min.y).toBeLessThan(0.16)
    expect(baseCorners.min.x).toBeCloseTo(-0.955, 3)
    expect(baseCorners.max.x).toBeCloseTo(0.955, 3)

    const cubeCorners = worldBox(parts['corner-markers-cube'])
    const cubeSize = cubeCorners.getSize(new THREE.Vector3())
    expect(cubeSize.x).toBeCloseTo(NEON_CUBE.cubeSide + NEON_CUBE.cornerSize, 3)
    expect(cubeCorners.max.y).toBeCloseTo(1.46 + NEON_CUBE.cornerSize - 0.001, 3)

    for (const id of ['corner-markers-base', 'corner-markers-cube']) {
      const geometry = (parts[id] as THREE.Mesh).geometry
      expect(geometry.getAttribute('position').count).toBe((NEON_CUBE.cornerCount / 2) * 24)
    }
  })

  it('builds four thin uplight sheets from the base top to y=0.60', () => {
    const sheets = worldBox(parts['light-sheets'])
    const size = sheets.getSize(new THREE.Vector3())
    const sheetSpan = 2 * (NEON_CUBE.lightSheetOffset + NEON_CUBE.lightSheetThickness / 2)
    expect(size.x).toBeCloseTo(sheetSpan, 3)
    expect(size.z).toBeCloseTo(sheetSpan, 3)
    expect(size.y).toBeCloseTo(NEON_CUBE.lightSheetHeight, 6)
    expect(sheets.min.y).toBeCloseTo(NEON_CUBE.lightSheetBottomY, 6)
    expect(sheets.max.y).toBeCloseTo(0.6, 6)
    expect((parts['light-sheets'] as THREE.Mesh).geometry.getAttribute('position').count).toBe(
      NEON_CUBE.lightSheetCount * 24,
    )

    const sheet = materials['light-sheet'] as THREE.MeshBasicMaterial
    expect(sheet.map).toBeInstanceOf(THREE.Texture)
    expect(sheet.blending).toBe(THREE.AdditiveBlending)
    expect(sheet.depthWrite).toBe(false)
    expect(sheet.toneMapped).toBe(false)
    expect(sheet.opacity).toBeCloseTo(0.8, 6)
  })

  it('keeps one core halo sprite and no view-dependent corner sprite', () => {
    const sprites: THREE.Sprite[] = []
    group.traverse((object) => {
      if (object instanceof THREE.Sprite) sprites.push(object)
    })
    expect(sprites).toHaveLength(1)
    expect(sprites[0].name).toBe('core-halo')
    expect(group.getObjectByName('front-corner-halo')).toBeUndefined()
  })

  it('uses the reference-matched material flags', () => {
    const panel = materials['glass-panel'] as THREE.MeshPhysicalMaterial
    expect(panel).toBeInstanceOf(THREE.MeshPhysicalMaterial)
    expect(panel.color.getHexString()).toBe('6e1eff')
    expect(panel.emissive.getHexString()).toBe('6e1eff')
    expect(panel.emissiveIntensity).toBeCloseTo(0.9, 6)
    expect(panel.opacity).toBeCloseTo(0.15, 6)
    expect(panel.blending).toBe(THREE.AdditiveBlending)
    expect(panel.depthWrite).toBe(false)
    expect(panel.side).toBe(THREE.DoubleSide)
    expect(panel.clearcoatRoughness).toBeGreaterThanOrEqual(0.4)

    const base = materials['glass-base'] as THREE.MeshPhysicalMaterial
    expect(base.color.getHexString()).toBe('5614c8')
    expect(base.emissiveIntensity).toBeCloseTo(0.85, 6)
    expect(base.opacity).toBeCloseTo(0.88, 6)
    expect(base.depthWrite).toBe(true)

    const innerBase = materials['glass-base-inner'] as THREE.MeshPhysicalMaterial
    expect(innerBase.color.getHexString()).toBe('170528')
    expect(innerBase.emissive.getHexString()).toBe('0a0212')
    expect(innerBase.depthWrite).toBe(true)
    expect(innerBase.opacity).toBeGreaterThan(0.9)

    const neon = materials['neon-edge'] as THREE.MeshBasicMaterial
    expect(neon).toBeInstanceOf(THREE.MeshBasicMaterial)
    expect(neon.blending).toBe(THREE.AdditiveBlending)
    expect(neon.depthWrite).toBe(false)
    expect(neon.toneMapped).toBe(false)

    const rodColors = (parts['cube-edges'] as THREE.Mesh).geometry.getAttribute('color')
    let maxChannel = 0
    for (let index = 0; index < rodColors.count; index += 1) {
      maxChannel = Math.max(maxChannel, rodColors.getX(index), rodColors.getY(index), rodColors.getZ(index))
    }
    expect(maxChannel).toBeGreaterThan(1)

    const core = materials['core-glass'] as THREE.MeshPhysicalMaterial
    expect(core.emissiveIntensity).toBeCloseTo(1.15, 6)

    const glow = materials['glow-sprite'] as THREE.SpriteMaterial
    expect(glow.opacity).toBeCloseTo(0.4, 6)
    expect(glow.blending).toBe(THREE.AdditiveBlending)
  })

  it('stays inside the triangle and draw-call budget', () => {
    expect(model.triangleCount).toBeGreaterThan(0)
    expect(model.triangleCount).toBeLessThanOrEqual(25000)
    expect(model.drawCalls).toBeGreaterThan(0)
    expect(model.drawCalls).toBeLessThanOrEqual(14)
  })

  it('tints every material family from the requested theme', () => {
    const cyan = createNeonCubeModel({ theme: 'cyan' })
    expect(cyan.theme.id).toBe('cyan')
    expect((cyan.materials['glass-panel'] as THREE.MeshPhysicalMaterial).color.getHexString()).toBe('00b8e6')
    expect((cyan.materials['glass-base'] as THREE.MeshPhysicalMaterial).color.getHexString()).toBe('007a99')
    expect((cyan.materials['glass-base-inner'] as THREE.MeshPhysicalMaterial).color.getHexString()).toBe('03232c')
    expect((cyan.materials['core-glass'] as THREE.MeshPhysicalMaterial).color.getHexString()).toBe('00d9ff')
    expect((cyan.materials['glow-sprite'] as THREE.SpriteMaterial).color.getHexString()).toBe('7af7ff')
    const sheetColor = (cyan.materials['light-sheet'] as THREE.MeshBasicMaterial).color
    expect(sheetColor.g).toBeCloseTo(0.95, 6)
    expect(sheetColor.b).toBeCloseTo(1.3, 6)
    expect(() => cyan.dispose()).not.toThrow()
  })

  it('exposes the solved reference camera without baking it into the model', () => {
    expect(NEON_CUBE.camera.fov).toBe(8)
    expect(NEON_CUBE.camera.distance).toBe(20)
    expect(NEON_CUBE.camera.azimuth).toBe(45)
    expect(NEON_CUBE.camera.elevation).toBe(24)
    expect(NEON_CUBE.camera.target[1]).toBeCloseTo(0.6, 6)
    expect(group.rotation.x).toBe(0)
    expect(group.rotation.y).toBe(0)
    expect(group.rotation.z).toBe(0)
  })

  it('disposes every geometry and material without throwing', () => {
    expect(() => model.dispose()).not.toThrow()
  })
})
