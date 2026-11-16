/** Validate the object shape used by request/storage assertions. */
export function jsonObject(source: unknown): Record<string, unknown> {
  if (typeof source !== 'string') throw new Error('Expected JSON text')
  const value: unknown = JSON.parse(source)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object')
  return value as Record<string, unknown>
}
