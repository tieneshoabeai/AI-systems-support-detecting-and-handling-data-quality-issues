import { createContext, useContext } from 'react'
import type { PreviewAppearance } from '../../types'

export const PreviewAppearanceContext = createContext<PreviewAppearance | null>(null)

export function usePreviewAppearance(): PreviewAppearance {
  const appearance = useContext(PreviewAppearanceContext)
  if (!appearance) throw new Error('Preview appearance requires its provider.')
  return appearance
}
