export function recordValue(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected fixture object')
  return value as Record<string, unknown>
}

export function numberList(value: unknown): number[] {
  if (!Array.isArray(value)) throw new Error('Expected numeric fixture list')
  const entries: unknown[] = value
  if (!entries.every((entry): entry is number => typeof entry === 'number')) throw new Error('Expected numeric fixture entries')
  return entries
}
