/** Factory workspace/project/dataset - cung seed => cung du lieu (quy tac 1-2) */
export function makeWorkspace(seed = 42, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { name: `Workspace ${seed}`, description: `Mo ta seed ${seed}`, ...overrides };
}
export function makeProject(seed = 42, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { name: `Project ${seed}`, description: `Mo ta ${seed}`, ...overrides };
}
export function makeDatasetCsv(seed = 42, rows = 5, cols = 3): string {
  const header = Array.from({ length: cols }, (_, i) => `Cot ${i}`).join(',');
  const lines = [header];
  for (let r = 0; r < rows; r++) lines.push(Array.from({ length: cols }, (_, c) => `v${seed}_${r}_${c}`).join(','));
  return lines.join('
');
}
