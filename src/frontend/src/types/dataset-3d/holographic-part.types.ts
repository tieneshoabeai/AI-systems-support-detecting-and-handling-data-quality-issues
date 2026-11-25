export type HolographicPartDimensions = {
  width: number
  height: number
  depth: number
  units: string
}

export type HolographicPartInfo = {
  id: string
  name: string
  role: string
  material: string
  level: string
  dimensions: HolographicPartDimensions
}

export type HolographicPartComponent = {
  id: string
  name?: string
  role?: string
  material?: string
  level?: string
  dimensions?: Partial<HolographicPartDimensions>
}

export const NON_SELECTABLE_PART_IDS = new Set(['front-loop-light', 'cap-center-light'])
