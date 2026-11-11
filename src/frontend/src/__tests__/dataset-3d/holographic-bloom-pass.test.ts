import { afterEach, expect, it, vi } from 'vitest'
import { Vector2, WebGLRenderTarget } from 'three'
import type { WebGLRenderer } from 'three'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { HolographicBloomPass } from '../../graphics/holographic-core/holographic-bloom-pass'

afterEach(() => vi.restoreAllMocks())

it('outputs the original base before adding bloom, with the same route for screen and glass', () => {
  const events: string[] = []
  const baseOutput = vi.spyOn(OutputPass.prototype, 'render').mockImplementation(() => { events.push('output-base') })
  const bloom = vi.spyOn(UnrealBloomPass.prototype, 'render').mockImplementation(function (this: UnrealBloomPass) {
    expect(this.renderToScreen).toBe(false)
    events.push('bloom')
  })
  let expectedScreen = false
  const composite = vi.spyOn(ShaderPass.prototype, 'render').mockImplementation(function (this: ShaderPass) {
    expect(this.renderToScreen).toBe(expectedScreen)
    events.push('add')
  })
  const pass = new HolographicBloomPass(new Vector2(400, 300), .4, .45, 1)
  const input = new WebGLRenderTarget(800, 600)
  const output = new WebGLRenderTarget(800, 600)
  const renderer = {} as WebGLRenderer
  for (const toScreen of [true, false]) {
    events.length = 0
    expectedScreen = toScreen
    pass.renderToScreen = toScreen
    pass.render(renderer, output, input, 0, false)
    expect(events).toEqual(['output-base', 'bloom', 'add'])
    expect(pass.needsSwap).toBe(true)
    const base = baseOutput.mock.lastCall?.[1]
    expect(base?.width).toBe(800)
    expect(base?.height).toBe(600)
    expect(composite.mock.lastCall?.[2]).toBe(base)
    expect(pass.renderToScreen).toBe(toScreen)
  }
  expect(bloom).toHaveBeenCalledTimes(2)
  pass.dispose()
  input.dispose()
  output.dispose()
})
