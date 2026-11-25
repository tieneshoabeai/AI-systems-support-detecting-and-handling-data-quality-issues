import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { LiquidGlass } from '@ybouane/liquidglass'
import { authGlassConfig } from '../../../../graphics/auth-glass/auth-glass.config'
import { faceHeight, faceWidth } from '../../../../graphics/auth-glass/auth-glass.form'
import { liquidGlassDefaults } from '../../../../graphics/liquid-glass.config'

const themeDefaults = {
  dark: { tintStrength: 0.08 },
  light: { tintStrength: 0 },
}

const cornerRadius = 18
const { artwork, slab } = authGlassConfig
const pixelsPerUnitX = artwork.pixelsWide / faceWidth
const pixelsPerUnitY = artwork.pixelsHigh / faceHeight
const panelCoverage: CSSProperties & Record<`--login-glass-panel-${string}`, string> = {
  '--login-glass-panel-left': `${-artwork.inset * pixelsPerUnitX}px`,
  '--login-glass-panel-top': `${-artwork.inset * pixelsPerUnitY}px`,
  '--login-glass-panel-width': `${slab.width * pixelsPerUnitX}px`,
  '--login-glass-panel-height': `${slab.height * pixelsPerUnitY}px`,
  '--login-glass-panel-radius': `${slab.cornerRadius * pixelsPerUnitX}px / ${slab.cornerRadius * pixelsPerUnitY}px`,
}

export function LoginGlassSurface({ theme }: { theme: keyof typeof themeDefaults }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const surface = surfaceRef.current
    if (!root || !surface || typeof WebGLRenderingContext === 'undefined') return

    let disposed = false
    let instance: LiquidGlass | undefined
    async function start(root: HTMLDivElement, surface: HTMLDivElement) {
      try {
        const { LiquidGlass } = await import('@ybouane/liquidglass')
        if (disposed) return
        const glass = await LiquidGlass.init({
          root,
          glassElements: [surface],
          defaults: { ...liquidGlassDefaults, ...themeDefaults[theme], cornerRadius },
        })
        if (disposed) {
          glass.destroy()
          return
        }
        instance = glass
      } catch (error) {
        if (!disposed && import.meta.env.DEV) console.warn('Login Liquid Glass could not start.', error)
      }
    }
    void start(root, surface)

    return () => {
      disposed = true
      instance?.destroy()
    }
  }, [theme])

  return <div className="login-glass-surface" data-glass-theme={theme} aria-hidden="true" ref={rootRef} style={panelCoverage}>
    <div className="login-glass-surface-backdrop" />
    <div className="login-glass-surface-effect" ref={surfaceRef} />
  </div>
}
