import { StrictMode } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Group } from 'three'
import { createNeonCubeCluster } from '../../graphics/neon-cube/neon-cube.cluster'
import { NeonCubeNodes } from '../../components/graphics/holographic-core/neon-cube-nodes'

const { invalidate } = vi.hoisted(() => ({ invalidate: vi.fn() }))
vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: { invalidate: () => void }) => unknown) => select({ invalidate }),
}))
vi.mock('../../graphics/neon-cube/neon-cube.cluster', () => ({
  createNeonCubeCluster: vi.fn(() => {
    const group = new Group()
    for (const name of ['violet', 'cyan', 'blue', 'orange']) {
      const cube = new Group()
      cube.name = name
      group.add(cube)
    }
    return { group, cubes: [], dispose: vi.fn(() => group.clear()) }
  }),
}))
afterEach(cleanup)

it('keeps four satellites attached after StrictMode replays effects and releases each owned cluster', () => {
  const mounted = render(<StrictMode><NeonCubeNodes /></StrictMode>)
  const clusters: Array<{ group: Group; dispose: () => void }> = vi.mocked(createNeonCubeCluster).mock.results
    .flatMap(result => result.type === 'return' ? [result.value] : [])
  expect(clusters).toHaveLength(2)
  const first = clusters[0]!
  const active = clusters[1]!
  expect(first.dispose).toHaveBeenCalledOnce()
  expect(first.group.parent).toBeNull()
  expect(active.group.children.map(cube => cube.name)).toEqual(['violet', 'cyan', 'blue', 'orange'])
  expect(active.group.parent?.children).toEqual([active.group])
  expect(active.dispose).not.toHaveBeenCalled()
  expect(invalidate).toHaveBeenCalledTimes(2)
  mounted.unmount()
  expect(active.group.parent).toBeNull()
  expect(active.dispose).toHaveBeenCalledOnce()
})
