import { useSyncExternalStore } from 'react'
import './adaptive-art.css'

const event = 'dataverse-art-motion'
const key = 'dataverse.preview.art-motion'
const subscribe = (listener: () => void) => {
  window.addEventListener(event, listener); window.addEventListener('storage', listener)
  return () => { window.removeEventListener(event, listener); window.removeEventListener('storage', listener) }
}
const read = () => { try { return localStorage.getItem(key) !== 'off' } catch { return false } }
function useMotion() { return useSyncExternalStore(subscribe, read, () => false) }
export function ArtMotionControl() {
  const enabled = useMotion()
  return <label className="art-motion-control"><input type="checkbox" checked={enabled} onChange={event => {
    try { localStorage.setItem(key, event.target.checked ? 'on' : 'off'); window.dispatchEvent(new Event('dataverse-art-motion')) } catch { /* Storage unavailable: artwork stays still. */ }
  }} /> Chuyển động minh họa</label>
}

export function AdaptiveArt({ motif, tone = 'original' }: { motif: string; tone?: string }) {
  const motion = useMotion()
  return <span className={`resource-avatar adaptive-art art-tone-${tone}`} data-motif={motif} data-motion={motion ? 'on' : 'off'} aria-hidden="true">
    <svg viewBox="0 0 240 160" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <g className="art-guide"><path d="M20 40H220M20 80H220M20 120H220M60 20V140M120 20V140M180 20V140" /></g>
      {motif === 'orbits' ? <g className="art-orbit"><ellipse cx="120" cy="80" rx="80" ry="34" /><ellipse cx="120" cy="80" rx="80" ry="34" transform="rotate(60 120 80)" /><ellipse cx="120" cy="80" rx="80" ry="34" transform="rotate(-60 120 80)" /><circle className="art-node" cx="200" cy="80" r="6" /><circle className="art-node" cx="80" cy="50" r="5" /></g>
        : motif === 'lattice' ? <g className="art-float">{[0, 1, 2].flatMap(row => [0, 1, 2].map(col => <rect key={`${row}-${col}`} className={(row + col) % 2 ? 'art-tile' : ''} x={60 + col * 44} y={24 + row * 40} width="32" height="28" rx="7" />))}</g>
        : motif === 'scan' ? <><g className="art-tile"><rect x="48" y="35" width="112" height="84" rx="12" />{[0, 1, 2].map(n => <path key={n} d={`M64 ${55 + n * 22}h66`} />)}</g><g className="art-scan"><circle cx="132" cy="73" r="32" /><path strokeWidth="9" d="m156 97 30 30" /><path className="art-signal" d="M110 73h44" /></g></>
        : motif === 'flow' ? <><path className="art-path" d="M38 80H202" />{[0, 1, 2].map(n => <rect key={n} className="art-tile" x={30 + n * 72} y="56" width="38" height="48" rx="9" />)}<circle className="art-travel art-node" cx="48" cy="80" r="6" /></>
        : motif === 'branches' ? <><path className="art-path" d="M48 80H100Q120 80 120 48V36H188M120 80H188M120 80V124H188" /><circle className="art-node" cx="48" cy="80" r="13" />{[36, 80, 124].map(y => <rect className="art-tile" key={y} x="176" y={y - 12} width="24" height="24" rx="7" />)}</>
        : motif === 'radar' ? <><circle cx="120" cy="80" r="55" /><circle cx="120" cy="80" r="36" /><circle cx="120" cy="80" r="17" /><path className="art-guide" d="M65 80h110M120 25v110" /><g className="art-radar"><path className="art-tile" d="M120 80V25A55 55 0 0 1 159 41Z" /><path d="M120 80V25" /></g><circle className="art-node" cx="145" cy="58" r="5" /><circle className="art-node" cx="93" cy="103" r="4" /></>
        : motif === 'waves' ? <><path className="art-guide" d="M34 80H206" />{[28, 48, 72, 96, 72, 48, 28].map((height, n) => <rect key={n} className="art-wave art-tile" style={{ animationDelay: `${n * -0.24}s` }} x={47 + n * 22} y={80 - height / 2} width="14" height={height} rx="7" />)}</>
        : motif === 'crystal' ? <><ellipse className="art-guide" cx="120" cy="132" rx="48" ry="9" /><g className="art-crystal"><path className="art-tile" d="m120 24 46 36-12 47-34 25-34-25-12-47Z" /><path d="m120 24-16 42 16 66 16-66Zm-46 36 30 6 32 0 30-6M86 107l18-41m32 0 18 41" /><path className="art-node" d="m120 55 4 7 8 4-8 4-4 7-4-7-8-4 8-4Z" /></g></>
        : motif === 'constellation' ? <><path className="art-path" d="m44 102 37-56 48 30 42-43 26 76-68-33-32 49-53-23" />{[[44, 102], [81, 46], [129, 76], [171, 33], [197, 109], [97, 125]].map(([x, y], n) => <g key={n} className="art-star" style={{ animationDelay: `${n * -0.6}s`, transformOrigin: `${x}px ${y}px` }}><circle className="art-tile" cx={x} cy={y} r="10" /><path className="art-node" d={`M${x} ${y - 6}l2 4 4 2-4 2-2 4-2-4-4-2 4-2Z`} /></g>)}</>
        : <><path className="art-path" d="M120 80 55 40M120 80 185 40M120 80 55 120M120 80 185 120" />{[[55, 40], [185, 40], [55, 120], [185, 120]].map(([x, y]) => <rect key={`${x}-${y}`} className="art-tile art-float" x={x - 15} y={y - 12} width="30" height="24" rx="7" />)}</>}
      {['network', 'orbits'].includes(motif) && <g className="art-core"><circle className="art-tile" cx="120" cy="80" r="19" /><circle className="art-node" cx="120" cy="80" r="6" /></g>}
    </svg>
  </span>
}
