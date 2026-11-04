import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { ProceduralModelRuntime } from './generated-core'
import { GAUGE_COLOR, HERO_FORM, HERO_GAUGES, heroGaugeDimensions } from './tower-gauge-config'

// Six stable dimension glyphs. Only the clock hand moves; it indicates a clock, not data age.
export function createTowerCrowns(runtime: ProceduralModelRuntime) {
  const material = new THREE.MeshBasicMaterial({ color: GAUGE_COLOR.edge, toneMapped: false })
  const roots: THREE.Group[] = []
  const geometries: THREE.BufferGeometry[] = []
  let clockHand: THREE.Mesh | null = null
  let disposed = false

  for (const target of HERO_GAUGES) {
    const tower = runtime.meshes[target.towerId]
    tower.geometry.computeBoundingBox()
    const size = tower.geometry.boundingBox!.getSize(new THREE.Vector3())
    const form = heroGaugeDimensions(size.x, size.y, size.z)
    const root = new THREE.Group()
    root.name = `hero-crown-${target.dimension}`
    root.position.y = form.capTopY
    root.raycast = () => {}
    const radius = Math.min(size.x, size.z) * HERO_FORM.capTopRatio * 0.36
    const tube = Math.min(radius * 0.045, form.crownHeight * 0.09)
    const pieces: THREE.BufferGeometry[] = []
    const ring = (r: number, y: number, arc = Math.PI * 2, yaw = 0) => {
      const geometry = new THREE.TorusGeometry(r, tube, 6, 48, arc)
      geometry.rotateX(-Math.PI / 2)
      geometry.rotateY(yaw)
      geometry.translate(0, y, 0)
      pieces.push(geometry)
    }
    const bar = (x: number, y: number, z: number, width: number, height: number, depth: number) => {
      const geometry = new THREE.BoxGeometry(width, height, depth)
      geometry.translate(x, y, z)
      pieces.push(geometry)
    }
    switch (target.dimension) {
      case 'completeness':
        ring(radius, form.crownHeight * 0.4, Math.PI * 7 / 4)
        break
      case 'uniqueness':
        for (const level of [0, 1]) {
          const disc = new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, form.crownHeight * 0.15, 32)
          disc.translate((level ? 1 : -1) * radius * 0.12, form.crownHeight * (level ? 0.72 : 0.25), 0)
          pieces.push(disc)
        }
        break
      case 'validity': {
        const length = radius * 0.6
        for (const x of [-1, 1]) for (const z of [-1, 1]) {
          bar(x * (radius * 0.7 - length / 2), form.crownHeight * 0.4, z * radius * 0.7, length, tube * 2, tube * 2)
          bar(x * radius * 0.7, form.crownHeight * 0.4, z * (radius * 0.7 - length / 2), tube * 2, tube * 2, length)
        }
        break
      }
      case 'accuracy': {
        ring(radius, form.crownHeight * 0.25)
        ring(radius * 0.52, form.crownHeight * 0.25)
        const peg = new THREE.CylinderGeometry(tube * 1.5, tube * 1.5, form.crownHeight * 0.7, 12)
        peg.translate(0, form.crownHeight * 0.45, 0)
        pieces.push(peg)
        break
      }
      case 'consistency':
        ring(radius, form.crownHeight * 0.25, Math.PI)
        ring(radius, form.crownHeight * 0.72, Math.PI, Math.PI)
        break
      case 'timeliness': {
        ring(radius, form.crownHeight * 0.45)
        const handGeometry = new THREE.BoxGeometry(radius * 0.85, tube * 1.4, tube * 1.4)
        handGeometry.translate(radius * 0.85 / 2, 0, 0)
        geometries.push(handGeometry)
        clockHand = new THREE.Mesh(handGeometry, material)
        clockHand.name = 'hero-crown-clock-hand'
        clockHand.position.y = form.crownHeight * 0.45
        clockHand.raycast = () => {}
        root.add(clockHand)
        break
      }
    }
    const geometry = mergeGeometries(pieces, false)
    pieces.forEach(piece => piece.dispose())
    if (!geometry) throw new Error(`Cannot merge crown for ${target.dimension}`)
    geometries.push(geometry)
    const glyph = new THREE.Mesh(geometry, material)
    glyph.name = 'hero-crown-glyph'
    glyph.raycast = () => {}
    root.add(glyph)
    tower.add(root)
    roots.push(root)
  }
  return {
    update(elapsedSeconds: number) {
      if (clockHand && !disposed) clockHand.rotation.y = -elapsedSeconds * Math.PI * 2 / HERO_FORM.clockPeriodSeconds
    },
    reset() {
      if (clockHand && !disposed && clockHand.rotation.y !== 0) clockHand.rotation.y = 0
    },
    dispose() {
      if (disposed) return
      disposed = true
      roots.forEach(root => root.removeFromParent())
      geometries.forEach(geometry => geometry.dispose())
      material.dispose()
    },
  }
}
