// T10 for the towers: a pointer ray dropped on each of the 14 active towers must meet that tower's glass
// volume first and resolve to that tower's part id, while every decoration hanging off it stays
// transparent to the ray. This is the half of I6 that the fingerprint cannot state: it hashes
// `raycast.toString()` per object, so it pins *which* objects are inert, but nothing before this
// file ever fired a ray and checked what a click would actually return.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createHolographicCoreProductModel } from '../../graphics/holographic-core/holographic-core.model'
import { TOWER_IDS } from '../../graphics/holographic-core/tower-config'
import type { HolographicPartInfo } from '../../types/dataset-3d/holographic-part.types'

type TowerRuntime = {
  nodes: Record<string, THREE.Object3D>
  meshes: Record<string, THREE.Mesh>
}

type ModelApi = ReturnType<typeof createHolographicCoreProductModel>

// Dropped vertically onto the tower's own footprint centre. Deliberately not a radial ray: tower-04
// and tower-15 sit on the same ~346° bearing, so a ray travelling inward would meet the ring tower
// first and say nothing about the one it was aimed at. Three units above the node centre clears the
// tallest roof (3.75), and the origin comes from world coordinates because detach moves the nodes.
function dropRay(api: ModelApi, runtime: TowerRuntime, id: string) {
  api.model.updateMatrixWorld(true)
  const centre = runtime.nodes[id].getWorldPosition(new THREE.Vector3())
  return new THREE.Raycaster(new THREE.Vector3(centre.x, centre.y + 3, centre.z), new THREE.Vector3(0, -1, 0))
}

function createFixture() {
  const api = createHolographicCoreProductModel()
  return { api, runtime: api.model.userData.sculptRuntime as TowerRuntime }
}

function firstPick(api: ModelApi, runtime: TowerRuntime, id: string): { hit: THREE.Object3D | undefined; part: HolographicPartInfo | null } {
  const hits = dropRay(api, runtime, id).intersectObject(api.model, true)
  return { hit: hits[0]?.object, part: hits[0] ? api.resolvePart(hits[0].object) : null }
}

describe('tower pointer picking', () => {
  it('is closed for every tower id in the config', () => {
    // The loop below would silently test fewer towers if the two lists ever drifted apart.
    const { runtime } = createFixture()
    expect(TOWER_IDS).toHaveLength(14)
    expect(Object.keys(runtime.meshes).filter(id => id.startsWith('tower-')).sort()).toEqual([...TOWER_IDS].sort())
    for (const id of ['tower-05', 'tower-06', 'tower-11', 'tower-15']) {
      expect(TOWER_IDS).not.toContain(id)
      expect(runtime.meshes[id]).toBeUndefined()
      expect(runtime.nodes[id]).toBeUndefined()
    }
    const sceneTowerIds = new Set<string>()
    runtime.nodes.root.traverse(object => {
      const id = object.userData.sculptComponent?.id as string | undefined
      if (id?.startsWith('tower-')) sceneTowerIds.add(id)
    })
    expect([...sceneTowerIds].sort()).toEqual([...TOWER_IDS].sort())
    for (const id of TOWER_IDS) expect(runtime.meshes[id], `${id} mesh`).toBeDefined()
  })

  it('lands on the aimed tower from above while attached', () => {
    const { api, runtime } = createFixture()
    for (const id of TOWER_IDS) {
      const { hit, part } = firstPick(api, runtime, id)
      expect(hit, `${id} first hit`).toBe(runtime.meshes[id])
      expect(part?.id, `${id} resolves`).toBe(id)
    }
  })

  // handleClick ignores every click while attached, so the exploded pose is the only state where a
  // pointer pick has ever reached the panel. Detach moves each tower radially outward and up, which
  // is why the ray is aimed from the node's *world* position rather than a stored layout number.
  it('still lands on the aimed tower after the explode', () => {
    const { api, runtime } = createFixture()
    api.setDetached(true)
    api.snapDetach()
    for (const id of TOWER_IDS) {
      const { hit, part } = firstPick(api, runtime, id)
      expect(hit, `${id} first hit`).toBe(runtime.meshes[id])
      expect(part?.id, `${id} resolves`).toBe(id)
    }
  })

  // Nothing inside a tower node may answer the pointer: floor frames, window panels, corner posts,
  // roof outlines, the solid core, the plinth, the rising particle trails and the selection contour
  // are all decoration, and one of them catching the ray first would shadow the tower it decorates.
  it('keeps every decoration inside a tower inert', () => {
    const { api, runtime } = createFixture()
    for (const id of TOWER_IDS) {
      const glass = runtime.meshes[id]
      const decorations: THREE.Object3D[] = []
      runtime.nodes[id].traverse(object => { if (object !== glass && object !== runtime.nodes[id]) decorations.push(object) })
      expect(decorations.length, `${id} has children to neutralise`).toBeGreaterThan(3)
      for (const object of decorations) {
        expect(dropRay(api, runtime, id).intersectObject(object, true), `${id} ${object.name || object.type}`).toHaveLength(0)
      }
    }
  })
})
