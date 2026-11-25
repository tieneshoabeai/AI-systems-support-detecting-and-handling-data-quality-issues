import type { ReactNode } from 'react'
import { PreviewAppearanceContext } from '../../hooks/preview/preview-appearance-context'
import { usePreviewColorScheme } from '../../hooks/preview/use-preview-color-scheme'

export function PreviewAppearanceProvider({ children }: { children: ReactNode }) {
  const appearance = usePreviewColorScheme()
  return <PreviewAppearanceContext.Provider value={appearance}>{children}</PreviewAppearanceContext.Provider>
}
