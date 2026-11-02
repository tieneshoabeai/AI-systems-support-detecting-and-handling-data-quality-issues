import { describe, expect, it } from 'vitest'
import specRaw from '../../graphics/neon-cube/object-sculpt-spec.json?raw'
import { NEON_CUBE } from '../../graphics/neon-cube/neon-cube.model'

type SpecComponent = {
  id: string
  parent?: string
  dimensions?: { width: number; height: number; depth: number }
  transform?: { position?: [number, number, number] }
  geometryDescriptor?: { openings?: { id: string; width: number; depth: number }[] }
}

type SpecMaterial = {
  id: string
  emissive?: string
  emissiveIntensity?: number
  emissiveLinear?: number[]
  opacity?: number
  blending?: string
  depthWrite?: boolean
  clearcoatRoughness?: number
  localOverrides?: { id: string }[]
}

type SpecRepetition = {
  id: string
  count?: number
  perFaceCount?: number
  faces?: number
  pitch?: number
  gap?: number
  geometry?: { width?: number; height?: number; length?: number }
}

const spec = JSON.parse(specRaw) as {
  componentTree: SpecComponent[]
  materials: SpecMaterial[]
  repetitionSystems: SpecRepetition[]
  referenceCamera: {
    fovDegrees: number
    distance: number
    azimuthDegrees: number
    elevationDegrees: number
    target: [number, number, number]
  }
  performanceBudget: { targetTriangles: number; maxDrawCalls: number }
  qualityContract: { featureGroups: { qualityCriteria: string[] }[] }
  lightingFromPhoto: string[]
}

const components = new Map(spec.componentTree.map((component) => [component.id, component]))
const materials = new Map(spec.materials.map((material) => [material.id, material]))
const repetitions = new Map(spec.repetitionSystems.map((system) => [system.id, system]))

describe('neon cube sculpt spec', () => {
  it('declares the four primary parts with the approved parent chain', () => {
    expect(components.get('base-outer')?.parent).toBe('root')
    expect(components.get('base-inner')?.parent).toBe('base-outer')
    expect(components.get('cube-outer')?.parent).toBe('base-inner')
    expect(components.get('cube-inner')?.parent).toBe('cube-outer')
  })

  it('keeps the size ordering cube < inner base < hole < outer base', () => {
    const base = components.get('base-outer')!
    const innerBase = components.get('base-inner')!
    const cube = components.get('cube-outer')!
    expect(cube.dimensions!.width).toBeCloseTo(1.32, 6)
    expect(innerBase.dimensions!.width).toBeCloseTo(1.48, 6)
    expect(base.geometryDescriptor!.openings![0].width).toBeCloseTo(1.64, 6)
    expect(base.dimensions!.width).toBeCloseTo(2, 6)
    expect(cube.dimensions!.width).toBeLessThan(innerBase.dimensions!.width)
    expect(innerBase.dimensions!.width).toBeLessThan(base.geometryDescriptor!.openings![0].width)
    expect(base.geometryDescriptor!.openings![0].width).toBeLessThan(base.dimensions!.width)
  })

  it('matches the model constants for the major dimensions', () => {
    expect(components.get('base-outer')!.dimensions!.height).toBeCloseTo(NEON_CUBE.baseHeight, 6)
    expect(components.get('base-inner')!.dimensions!.width).toBeCloseTo(NEON_CUBE.innerBaseSide, 6)
    expect(components.get('base-inner')!.dimensions!.height).toBeCloseTo(NEON_CUBE.innerBaseHeight, 6)
    expect(components.get('cube-outer')!.dimensions!.width).toBeCloseTo(NEON_CUBE.cubeSide, 6)
    expect(components.get('cube-inner')!.dimensions!.width).toBeCloseTo(NEON_CUBE.coreSide, 6)
    expect(NEON_CUBE.coreSide / NEON_CUBE.cubeSide).toBeCloseTo(2 / 3, 3)
  })

  it('counts the pane, seam and rod systems', () => {
    const panels = repetitions.get('glass-panel-grid')!
    const seams = repetitions.get('seam-lattice')!
    expect(panels.count).toBe(NEON_CUBE.paneCount)
    expect(panels.perFaceCount).toBe(9)
    expect(panels.faces).toBe(6)
    expect(panels.geometry!.width).toBeCloseTo(NEON_CUBE.paneSize, 6)
    expect(panels.pitch).toBeCloseTo(NEON_CUBE.panePitch, 6)
    expect(panels.gap).toBeCloseTo(NEON_CUBE.paneGap, 6)
    expect(seams.count).toBe(NEON_CUBE.seamCount)
    expect(seams.geometry!.width).toBeCloseTo(NEON_CUBE.seamBarSize, 6)
    expect(repetitions.get('outer-edge-frame')!.geometry!.width).toBeCloseTo(NEON_CUBE.outerEdgeRod, 6)
    expect(repetitions.get('inner-edge-frame')!.geometry!.width).toBeCloseTo(NEON_CUBE.innerEdgeRod, 6)
  })

  it('records the corner emitters and uplight sheets', () => {
    const corners = repetitions.get('corner-markers')!
    const sheets = repetitions.get('light-sheet-curtain')!
    expect(corners.count).toBe(NEON_CUBE.cornerCount)
    expect(corners.perFaceCount).toBe(4)
    expect(corners.faces).toBe(2)
    expect(corners.geometry!.width).toBeCloseTo(NEON_CUBE.cornerSize, 6)
    expect(components.get('corner-markers-base')?.parent).toBe('base-outer')
    expect(components.get('corner-markers-cube')?.parent).toBe('cube-outer')

    expect(sheets.count).toBe(NEON_CUBE.lightSheetCount)
    expect(sheets.geometry!.width).toBeCloseTo(NEON_CUBE.lightSheetWidth, 6)
    expect(sheets.geometry!.height).toBeCloseTo(NEON_CUBE.lightSheetHeight, 6)
    expect(sheets.geometry!.length).toBeCloseTo(NEON_CUBE.lightSheetThickness, 6)
    expect(components.get('light-sheets')?.parent).toBe('base-outer')
    expect(sheets.geometry!.height).toBeCloseTo(NEON_CUBE.cubeSide / 3, 6)
  })

  it('records the tuned glass and neon material values', () => {
    const panel = materials.get('glass-panel')!
    expect(panel.emissive?.toLowerCase()).toBe('#6e1eff')
    expect(panel.emissiveIntensity).toBeCloseTo(0.9, 6)
    expect(panel.opacity).toBeCloseTo(0.15, 6)
    expect(panel.blending).toBe('additive')
    expect(panel.depthWrite).toBe(false)

    const base = materials.get('glass-base')!
    expect(base.emissive?.toLowerCase()).toBe('#5614c8')
    expect(base.emissiveIntensity).toBeCloseTo(0.85, 6)
    expect(base.opacity).toBeCloseTo(0.88, 6)
    expect(base.depthWrite).toBe(true)

    const neon = materials.get('neon-edge')!
    expect(neon.emissiveLinear).toEqual([1.35, 1.15, 1.85])
    expect(neon.blending).toBe('additive')

    const innerBase = materials.get('glass-base-inner')!
    expect(innerBase.emissive?.toLowerCase()).toBe('#0a0212')
    expect(innerBase.opacity).toBeCloseTo(0.94, 6)
    expect(innerBase.depthWrite).toBe(true)
    expect(components.get('base-inner')?.dimensions?.width).toBeCloseTo(NEON_CUBE.innerBaseSide, 6)

    const lightSheet = materials.get('light-sheet')!
    expect(lightSheet.emissiveLinear).toEqual([0.75, 0.38, 1.35])
    expect(lightSheet.blending).toBe('additive')
    expect(lightSheet.depthWrite).toBe(false)
    expect(lightSheet.opacity).toBeCloseTo(0.8, 6)

    expect(materials.get('core-glass')!.emissiveIntensity).toBeCloseTo(1.15, 6)
    expect(materials.get('glow-sprite')!.opacity).toBeCloseTo(0.4, 6)
    expect(materials.get('glow-sprite')!.localOverrides?.map((entry) => entry.id)).toEqual(['core-halo'])

    for (const material of spec.materials) {
      if (material.clearcoatRoughness !== undefined) {
        expect(material.clearcoatRoughness).toBeGreaterThanOrEqual(0.4)
      }
    }
  })

  it('locks the solved reference camera and shooting budget', () => {
    expect(spec.referenceCamera.fovDegrees).toBe(NEON_CUBE.camera.fov)
    expect(spec.referenceCamera.distance).toBe(NEON_CUBE.camera.distance)
    expect(spec.referenceCamera.azimuthDegrees).toBe(NEON_CUBE.camera.azimuth)
    expect(spec.referenceCamera.elevationDegrees).toBe(NEON_CUBE.camera.elevation)
    expect(spec.referenceCamera.target[1]).toBeCloseTo(NEON_CUBE.camera.target[1], 6)
    expect(spec.performanceBudget.targetTriangles).toBe(25000)
    expect(spec.performanceBudget.maxDrawCalls).toBe(14)
  })

  it('records the tuned bloom and under-base light', () => {
    const criteria = spec.qualityContract.featureGroups.flatMap((group) => group.qualityCriteria).join('\n')
    expect(criteria).toContain('strength 0.05, radius 0.25, threshold 1.00')
    expect(specRaw).toContain('bloom 0.05/0.25/1.00')
    expect(spec.lightingFromPhoto.some((line) => line.includes('(#b23cff, intensity 1.8, distance 3)'))).toBe(true)
    expect(spec.lightingFromPhoto.some((line) => line.includes('FogExp2 #060212 density 0.012'))).toBe(true)
  })
})
