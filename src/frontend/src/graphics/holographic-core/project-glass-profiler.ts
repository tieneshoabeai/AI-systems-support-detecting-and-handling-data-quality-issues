// Opt-in dev diagnostics via ?glassPerf=1; no sampling/logging in production.
export function createProjectGlassProfiler() {
  let current: boolean | null = null
  let warmup = 0
  const samples: number[] = []
  return (duration: number, glass: boolean) => {
    if (glass !== current) { current = glass; warmup = 0; samples.length = 0 }
    if (warmup < 60) { warmup++; return }
    if (samples.length >= 60) return
    samples.push(duration)
    if (samples.length !== 60) return
    const sorted = samples.slice().sort((a, b) => a - b)
    console.info('[ProjectGlass CPU submit]', JSON.stringify({
      glass, samples: samples.length,
      meanMs: Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(2)),
      p95Ms: Number(sorted[Math.ceil(sorted.length * .95) - 1].toFixed(2)),
    }))
  }
}
