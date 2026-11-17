/** Read a required model/fixture value and fail explicitly if its invariant breaks. */
export const requireDefined = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`Missing required value: ${label}`)
  return value
}
