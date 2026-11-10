import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, RefObject } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Canvas, useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from 'three'
import { authGlassConfig } from '../../../../graphics/auth-glass/auth-glass.config'
import { createAuthGlassGeometry } from '../../../../graphics/auth-glass/auth-glass.geometry'
import { DisplayBase } from './display-base'
import { displayBaseOptions, displayBaseReviewCamera, displayBaseViews } from '../../../../graphics/auth-glass/display-base/display-base.config'
import type { DisplayBaseOptions, DisplayBaseView } from '../../../../graphics/auth-glass/display-base/display-base.config'
import './display-base.review.css'

const viewLabels: Record<DisplayBaseView, string> = {
  front: 'Trước', left: 'Trái', right: 'Phải', top: 'Trên', low: 'Góc thấp',
}

function BaseReviewScene({ slabs, options, low, stats }: {
  slabs: boolean
  options: DisplayBaseOptions
  low: boolean
  stats: RefObject<HTMLOutputElement | null>
}) {
  const geometry = useMemo(() => createAuthGlassGeometry(), [])
  const footlights = useMemo(() => {
    const { login, register } = options.sockets
    const [loginYaw, registerYaw] = authGlassConfig.panels.map(panel => panel.yaw)
    return {
      panels: [{ x: login[0], z: login[2], yaw: loginYaw }, { x: register[0], z: register[2], yaw: registerYaw }],
      width: authGlassConfig.slab.width,
      depth: authGlassConfig.slab.depth,
    }
  }, [options.sockets])
  useEffect(() => () => geometry.dispose(), [geometry])
  const [login, register] = authGlassConfig.panels.map(({ name, yaw }) => (
    <mesh key={name} name={`${name}-placeholder`} geometry={geometry} rotation-y={yaw}>
      <meshBasicMaterial color="#7ba9ed" opacity={0.25} transparent depthWrite={false} />
    </mesh>
  ))

  useFrame(({ gl, scene, camera }) => {
    gl.render(scene, camera)
    const { calls, triangles } = gl.info.render
    const summary = `${calls} draw calls · ${triangles.toLocaleString('vi-VN')} tam giác`
    const output = stats.current
    if (output && output.textContent !== summary) output.replaceChildren(summary)
  }, 1)

  return <>
    <color attach="background" args={['#030610']} />
    <ambientLight intensity={1.5} />
    <directionalLight position={[-4, 3, 5]} color="#82b9ff" intensity={2.4} />
    <directionalLight position={[2, 2, -5]} color="#a19aff" intensity={0.45} />
    <directionalLight position={[1, 3, 6]} color="#a8caff" intensity={1.05} />
    <DisplayBase options={options} footlights={footlights} low={low} login={slabs ? login : undefined} register={slabs ? register : undefined} />
  </>
}

export function DisplayBaseReview({ view, overlay, slabs }: {
  view: DisplayBaseView
  overlay: boolean
  slabs: boolean
}) {
  const [referenceUrl, setReferenceUrl] = useState<string>()
  const [searchParams] = useSearchParams()
  const stats = useRef<HTMLOutputElement>(null)
  const low = searchParams.get('quality') === 'low'
  const upperRing = searchParams.get('upper') === '1'
  const ripples = searchParams.get('ripples') === '1'
  const animate = searchParams.get('motion') === '1'
  const options = useMemo(() => ({
    ...displayBaseOptions,
    effects: { ...displayBaseOptions.effects, upperRing, ripples, animate },
  }), [upperRing, ripples, animate])
  const { width, height, fov, position, overlayOffset } = displayBaseReviewCamera
  const camera = useMemo(() => {
    const perspective = new PerspectiveCamera(fov, width / height, 0.1, 40)
    perspective.position.set(...position[view])
    perspective.lookAt(0, slabs && !overlay ? 1.5 : 0, 0)
    if (overlay && view === 'front') perspective.setViewOffset(width, height, ...overlayOffset, width, height)
    return perspective
  }, [fov, width, height, position, view, overlay, overlayOffset, slabs])

  useEffect(() => () => {
    if (referenceUrl) URL.revokeObjectURL(referenceUrl)
  }, [referenceUrl])

  function loadReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    setReferenceUrl(file && ['image/jpeg', 'image/png'].includes(file.type) ? URL.createObjectURL(file) : undefined)
  }

  function reviewUrl(nextView: DisplayBaseView, nextOverlay: boolean, nextSlabs: boolean) {
    const next = new URLSearchParams(searchParams)
    next.set('view', nextView)
    if (nextOverlay) next.set('overlay', '1')
    else next.delete('overlay')
    if (nextSlabs) next.set('slabs', '1')
    else next.delete('slabs')
    return `?${next}`
  }

  function toggle(key: string, value: string, enabled: boolean) {
    const next = new URLSearchParams(searchParams)
    if (enabled) next.delete(key)
    else next.set(key, value)
    return `?${next}`
  }

  return <main className="display-base-review">
    <nav className="display-base-review-controls" aria-label="Góc kiểm tra đế 3D">
      <Link to="/auth/login">Về đăng nhập</Link>
      {displayBaseViews.map(option => (
        <Link key={option} to={reviewUrl(option, overlay && option === 'front', slabs)}
          aria-current={option === view ? 'page' : undefined}>{viewLabels[option]}</Link>
      ))}
      <Link to={reviewUrl(view, overlay, !slabs)}>{slabs ? 'Ẩn khối mẫu' : 'Hiện khối mẫu'}</Link>
      <Link to={reviewUrl('front', !overlay, slabs)}>{overlay ? 'Ẩn ảnh mẫu' : 'Chồng ảnh mẫu'}</Link>
      <Link to={toggle('quality', 'low', low)}>{low ? 'Chất lượng đầy đủ' : 'Chất lượng thấp'}</Link>
      {!low && <>
        <Link to={toggle('upper', '1', upperRing)}>{upperRing ? 'Tắt vòng phụ' : 'Bật vòng phụ'}</Link>
        <Link to={toggle('ripples', '1', ripples)}>{ripples ? 'Tắt gợn sáng' : 'Bật gợn sáng'}</Link>
        <Link to={toggle('motion', '1', animate)}>{animate ? 'Tắt chuyển động' : 'Bật chuyển động'}</Link>
      </>}
      {overlay && <label>Ảnh tham chiếu <input type="file" accept="image/jpeg,image/png" onChange={loadReference} /></label>}
    </nav>
    <div className="display-base-review-stage" role="img" aria-label="Đế trưng bày ba tầng">
      <Canvas key={`${view}-${overlay}-${slabs}-${low}`} camera={camera} frameloop="demand" dpr={low ? 1 : [1, 1.5]}>
        <BaseReviewScene slabs={slabs} options={options} low={low} stats={stats} />
      </Canvas>
      {overlay && referenceUrl && <img className="display-base-review-overlay" src={referenceUrl} alt="Ảnh tham chiếu của đế" />}
    </div>
    <output className="display-base-review-stats" ref={stats} />
  </main>
}
