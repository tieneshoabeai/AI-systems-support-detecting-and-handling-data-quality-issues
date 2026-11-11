import { describe, expect, it, vi } from 'vitest'
import { PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createCubeConnectionFocus } from '../../graphics/holographic-core/cube-connection-focus'
import { CUBE_CONNECTIONS, cubeConnectionOverview } from '../../graphics/holographic-core/cube-connection-paths'
import { cubeFramePoints, cubeLabelFocusPose } from '../../graphics/holographic-core/cube-label-layout'

function setup(onComplete?: (theme: import('../../types/dataset-3d/cube-focus.types').NeonCubeThemeId) => void) {
  const camera = new PerspectiveCamera(34, 16 / 9, 0.1, 200)
  camera.position.set(11.45, 9, 11.45)
  const controls = new OrbitControls(camera, document.createElement('canvas'))
  controls.target.set(0, 2.1, 0.5)
  controls.maxPolarAngle = Math.PI / 2.02
  controls.update()
  const reveal = vi.fn()
  const sequence = createCubeConnectionFocus(camera, controls, reveal, onComplete)
  return { camera, controls, reveal, sequence }
}

describe('cube connection selection sequence', () => {
  it('notifies only after camera/reveal finish, cancels stale selections and supports reduced motion', () => {
    const complete = vi.fn()
    const { controls, sequence } = setup(complete)
    sequence.select('orange', false)
    sequence.update(0.1)
    expect(complete).not.toHaveBeenCalled()
    sequence.select('blue', false)
    for (let i = 0; i < 300; i++) sequence.update(1 / 60)
    expect(complete.mock.calls).toEqual([['blue']])
    sequence.select('blue', false)
    expect(complete).toHaveBeenCalledTimes(2)
    sequence.select('cyan', true)
    expect(complete).toHaveBeenLastCalledWith('cyan')
    sequence.select('orange', false)
    sequence.select(null, false)
    for (let i = 0; i < 300; i++) sequence.update(1 / 60)
    expect(complete).toHaveBeenCalledTimes(3)
    controls.dispose()
  })
  it.each([
    ['cyan', [6.3281, 8.4801, -3.3085], [-6.1702, -3.7577, -4.7532]],
    ['orange', [6.0953, 9.5986, 5.6296], [2.2333, -3.5825, -5.2978]],
    ['blue', [7.3041, 7.8023, 4.7324], [-5.7679, -3.0333, 1.5185]],
    ['violet', [-1.7267, 7.6013, 8.1256], [-4.4095, -3.0719, -5.1973]],
  ] as const)('reaches the user-calibrated connection camera for %s', (theme, position, target) => {
    const { camera, controls, sequence } = setup()
    sequence.select(theme, false)
    for (let i = 0; i < 240 && sequence.stage === 'overview'; i++) sequence.update(1 / 60)
    expect(sequence.stage).toBe('drawing')
    camera.position.toArray().forEach((value, index) => expect(value).toBeCloseTo(position[index], 4))
    controls.target.toArray().forEach((value, index) => expect(value).toBeCloseTo(target[index], 4))
    expect(cubeConnectionOverview(theme).position.toArray()).toEqual([...position])
    controls.dispose()
  })
  it.each([16 / 9, 390 / 844])('keeps the complete cube, base and label inside the final frame at aspect %s', aspect => {
    const camera = new PerspectiveCamera(34, aspect, 0.1, 200)
    for (const { theme } of CUBE_CONNECTIONS) {
      const pose = cubeLabelFocusPose(theme, camera.fov, aspect)!
      camera.position.copy(pose.position)
      camera.lookAt(pose.target)
      camera.updateMatrixWorld()
      for (const corner of cubeFramePoints(theme)) {
        const projected = corner.project(camera)
        expect(Math.abs(projected.x)).toBeLessThanOrEqual(0.861)
        expect(Math.abs(projected.y)).toBeLessThanOrEqual(0.861)
        expect(Math.abs(projected.z)).toBeLessThan(1)
      }
    }
  })
  it('frames first, draws core to cube, then holds the camera and keeps the connection lit', () => {
    const { camera, controls, reveal, sequence } = setup()
    sequence.select('orange', false)
    expect(reveal).toHaveBeenLastCalledWith('orange', 0)
    for (let i = 0; i < 120 && sequence.stage === 'overview'; i++) sequence.update(1 / 60)
    expect(sequence.stage).toBe('drawing')
    const overview = camera.position.clone()
    for (let i = 0; i < 30; i++) sequence.update(1 / 60)
    expect(camera.position.equals(overview)).toBe(true)
    expect(reveal.mock.lastCall?.[1]).toBeGreaterThan(0)
    expect(reveal.mock.lastCall?.[1]).toBeLessThan(1)
    for (let i = 0; i < 240; i++) sequence.update(1 / 60)
    expect(sequence.stage).toBe('focused')
    expect(reveal).toHaveBeenLastCalledWith('orange', 1)
    expect(camera.position.distanceTo(overview)).toBeLessThan(0.001)
    expect(controls.target.distanceTo(cubeConnectionOverview('orange').target)).toBeLessThan(0.001)
    camera.aspect = 390 / 844
    camera.updateProjectionMatrix()
    sequence.update(1 / 60)
    expect(camera.position.distanceTo(overview)).toBeLessThan(0.001)
    expect(controls.enabled).toBe(true)
    sequence.dispose()
    controls.dispose()
  })

  it.each(['overview', 'drawing', 'focused'] as const)('interrupts during %s without jumping or stale camera travel', stage => {
    const { camera, controls, reveal, sequence } = setup()
    const original = camera.position.clone()
    sequence.select('orange', false)
    for (let i = 0; i < 400 && sequence.stage !== stage; i++) sequence.update(1 / 60)
    expect(sequence.stage).toBe(stage)
    const before = camera.position.clone()
    sequence.select('cyan', false)
    expect(camera.position.distanceTo(before)).toBeLessThan(0.00001)
    expect(reveal).toHaveBeenLastCalledWith('cyan', 0)
    for (let i = 0; i < 400; i++) sequence.update(1 / 60)
    expect(sequence.stage).toBe('focused')
    expect(reveal).toHaveBeenLastCalledWith('cyan', 1)
    sequence.select(null, false)
    expect(reveal).toHaveBeenLastCalledWith(null, 0)
    expect(camera.position.distanceTo(original)).toBeLessThan(0.00001)
    controls.dispose()
  })

  it('skips travel and reveal for reduced motion and can clear selection', () => {
    const { camera, controls, reveal, sequence } = setup()
    sequence.select('violet', true)
    expect(sequence.stage).toBe('focused')
    expect(reveal).toHaveBeenLastCalledWith('violet', 1)
    expect(camera.position.distanceTo(cubeConnectionOverview('violet').position)).toBeLessThan(0.001)
    sequence.select(null, true)
    sequence.update(1)
    expect(sequence.stage).toBe('idle')
    expect(reveal).toHaveBeenLastCalledWith(null, 0)
    expect(controls.enabled).toBe(true)
    controls.dispose()
  })

})
