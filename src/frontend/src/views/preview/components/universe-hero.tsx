import { lazy, Suspense, useState } from 'react'
import type { ReactNode } from 'react'
import { usePreviewSession } from '../preview-session-context'
import { PreviewIcon } from './preview-icons'
import '../home-hero.css'

const HomeUniverse = lazy(() => import('../../../components/graphics/workspace-3d/home-universe'))
const heroValues = [
  { icon: 'chart', title: 'Phân tích dữ liệu thông minh', caption: 'Khám phá insight nhanh chóng.' },
  { icon: 'shield', title: 'Đảm bảo chất lượng dữ liệu', caption: 'Phát hiện và xử lý vấn đề hiệu quả.' },
  { icon: 'sparkle', title: 'Tối ưu quy trình xử lý', caption: 'Làm việc trong không gian Project linh hoạt.' },
] as const

export type UniverseHeroProps = { scene?: ReactNode; headingId?: string }

// Shared welcome section: one scene, pause control and color-scheme behavior.
export function UniverseHero({ scene, headingId = 'hero-title' }: UniverseHeroProps) {
  const { appearance } = usePreviewSession()
  const [paused, setPaused] = useState(false)
  const fallback = <div className="hero-cosmos" aria-hidden="true">
    <span className="cosmos-orbit cosmos-orbit-one" /><span className="cosmos-orbit cosmos-orbit-two" />
    <span className="cosmos-orbit cosmos-orbit-three" /><span className="cosmos-planet" />
    <span className="cosmos-satellite cosmos-satellite-one" /><span className="cosmos-satellite cosmos-satellite-two" />
  </div>
  return <section className="hero universe-hero" aria-labelledby={headingId}>
    <div className="hero-copy">
      <span className="eyebrow">Chào mừng đến với DataVerse</span>
      <h1 id={headingId} tabIndex={-1}>Khám phá <span>vũ trụ dữ liệu</span> của bạn</h1>
      <p>Một không gian để kết nối đội nhóm, khám phá dữ liệu và tìm ra những điều có ý nghĩa.</p>
    </div>
    <div className="hero-stage">
      {scene ?? <div className="hero-stage-placeholder" role="img" aria-label="Minh họa vũ trụ dữ liệu">
        <Suspense fallback={fallback}><HomeUniverse paused={paused} fallback={fallback} light={appearance.resolved === 'light'} /></Suspense>
      </div>}
    </div>
    {!scene && <button type="button" className="hero-motion-button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>
      <PreviewIcon name={paused ? 'processing' : 'pause'} />{paused ? 'Tiếp tục chuyển động' : 'Dừng chuyển động'}
    </button>}
    <ul className="hero-values">
      {heroValues.map(value => <li key={value.title}>
        <span className="hero-value-icon" aria-hidden="true"><PreviewIcon name={value.icon} /></span>
        <span className="hero-value-text"><strong>{value.title}</strong><small>{value.caption}</small></span>
      </li>)}
    </ul>
  </section>
}
