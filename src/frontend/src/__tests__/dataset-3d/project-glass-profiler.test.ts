import { expect, it, vi } from 'vitest'
import { createProjectGlassProfiler } from '../../graphics/holographic-core/project-glass-profiler'

it('discards warmup samples and emits one aggregate with the observed mean and p95', () => {
  const output = vi.spyOn(console, 'info').mockImplementation(() => {})
  const sample = createProjectGlassProfiler()
  for (let i = 0; i < 60; i++) sample(999, true)
  expect(output).not.toHaveBeenCalled()
  for (let i = 1; i <= 59; i++) sample(i, true)
  expect(output).not.toHaveBeenCalled()
  sample(60, true)
  expect(output).toHaveBeenCalledExactlyOnceWith('[ProjectGlass CPU submit]', JSON.stringify({ glass: true, samples: 60, meanMs: 30.5, p95Ms: 57 }))
  sample(999, true)
  expect(output).toHaveBeenCalledTimes(1)
})

it('restarts warmup and discards partial samples when glass mode changes', () => {
  const output = vi.spyOn(console, 'info').mockImplementation(() => {})
  const sample = createProjectGlassProfiler()
  for (let i = 0; i < 90; i++) sample(99, true)
  for (let i = 0; i < 119; i++) sample(2, false)
  expect(output).not.toHaveBeenCalled()
  sample(2, false)
  expect(output).toHaveBeenCalledExactlyOnceWith('[ProjectGlass CPU submit]', JSON.stringify({ glass: false, samples: 60, meanMs: 2, p95Ms: 2 }))
})
