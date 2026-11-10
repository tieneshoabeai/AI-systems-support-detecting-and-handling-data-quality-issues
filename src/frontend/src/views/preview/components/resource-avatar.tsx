import { useRef, useState } from 'react'
import { PreviewIcon } from './preview-icons'
import { AdaptiveArt, ArtMotionControl } from './adaptive-art'
import { changed, colors, colorLabels, imageBase, imageSource, imageTone, keyFor, motifs, pictures, prepareAvatarUpload, useResourceAvatar, type Kind } from './resource-avatar-state'
import './resource-avatar.css'

function AvatarArtwork({ value }: { value: string }) {
  const picture = pictures.find(item => imageBase(value) === `picture:${item.id}`)
  if (picture) return <AdaptiveArt motif={picture.id} tone={imageTone(value)} />
  const src = imageSource(value)
  if (src) return <span className={`resource-avatar resource-avatar-image image-tone-${imageTone(value)}`}><img src={src} alt="" /></span>
  const [icon, color] = value.split(':')
  return <span className={`resource-avatar avatar-${color}`} aria-hidden="true"><PreviewIcon name={icon} /></span>
}
export function ResourceAvatar({ kind, id, fallback }: { kind: Kind; id: string; fallback: string }) {
  const value = useResourceAvatar(kind, id)
  return value ? <AvatarArtwork value={value} /> : <PreviewIcon name={fallback} />
}
export function SelectedResourceArt({ value }: { value: string }) {
  return <AvatarArtwork value={value} />
}

export function ResourceAvatarPicker({ kind, id }: { kind: Kind; id: string }) {
  const selected = useResourceAvatar(kind, id)
  const [draft, setDraft] = useState(selected ?? 'sparkle:blue')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const request = useRef(0)
  const [icon, color] = imageSource(draft) ? ['sparkle', 'blue'] : draft.split(':')
  const isImage = Boolean(imageSource(draft))
  const activeColor = isImage ? imageTone(draft) : color
  const choose = (value: string) => { request.current++; setLoading(false); setDraft(value); setMessage('') }
  const upload = async (file: File | undefined) => {
    if (!file) return
    const ticket = ++request.current
    setLoading(true); setMessage('Đang chuẩn bị ảnh…')
    try {
      const value = await prepareAvatarUpload(file)
      if (ticket === request.current) { setDraft(value); setMessage('Ảnh đã sẵn sàng. Bấm Lưu avatar để áp dụng.') }
    } catch (error) {
      if (ticket === request.current) setMessage(error instanceof Error && error.name !== 'EncodingError' ? error.message : 'Không đọc được ảnh. Hãy chọn một ảnh khác.')
    } finally { if (ticket === request.current) setLoading(false) }
  }
  const save = (value: string | null) => {
    try {
      const key = keyFor(kind, id)
      if (value) localStorage.setItem(key, value)
      else localStorage.removeItem(key)
      window.dispatchEvent(new Event(changed))
      setMessage(value ? 'Đã lưu avatar trên trình duyệt này.' : 'Đã khôi phục ảnh mặc định.')
    } catch { setMessage('Không đủ dung lượng hoặc trình duyệt không cho phép lưu. Hãy chọn ảnh khác hoặc xóa bớt dữ liệu đã lưu.') }
  }
  return <details className="resource-avatar-picker" onToggle={event => {
    request.current++; setLoading(false)
    if (event.currentTarget.open) { setDraft(selected ?? 'sparkle:blue'); setMessage('') }
  }}>
    <summary><PreviewIcon name="palette" /> Chọn ảnh đại diện</summary>
    <div className="avatar-picker-body">
      <div className="avatar-picker-intro"><AvatarArtwork value={draft} /><div><strong>Dấu ấn riêng cho {kind === 'workspace' ? 'Workspace' : 'Project'}</strong><p>Chọn ảnh thư viện, tải ảnh từ máy hoặc phối biểu tượng. Lưu riêng trên trình duyệt này.</p></div></div>
      <div className="avatar-library" role="group" aria-label="Ảnh có sẵn">
        {pictures.map(picture => <button type="button" key={picture.id} aria-pressed={imageBase(draft) === `picture:${picture.id}`} onClick={() => choose(`picture:${picture.id}`)}>
          <AdaptiveArt motif={picture.id} /><span>{picture.label}</span>
        </button>)}
      </div>
      <ArtMotionControl />
      <label className="avatar-upload">Tải ảnh từ máy (PNG, JPG, WebP · tối đa 5 MB)
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} />
      </label>
      <div className="avatar-motifs" role="group" aria-label="Biểu tượng avatar">
        {motifs.map(([name, label]) => <button key={name} type="button" aria-label={label} title={label}
          aria-pressed={!imageSource(draft) && icon === name} onClick={() => choose(`${name}:${color}`)}>
          <AvatarArtwork value={`${name}:${color}`} />
        </button>)}
      </div>
      <div className="avatar-colors" role="group" aria-label="Màu avatar">
        {isImage && <button type="button" className="button-secondary" aria-pressed={activeColor === 'original'} onClick={() => choose(imageBase(draft))}>Màu gốc</button>}
        {colors.map((name, index) => <button key={name} type="button" className={`avatar-color avatar-${name}`}
          aria-label={colorLabels[index]} title={colorLabels[index]} aria-pressed={activeColor === name}
          onClick={() => choose(isImage ? `${imageBase(draft)}|tone:${name}` : `${icon}:${name}`)}><PreviewIcon name={activeColor === name ? 'check' : 'palette'} /></button>)}
      </div>
      {isImage && <p className="avatar-tone-note">Minh họa có sẵn tự đổi nền, nét và viền theo Light/Dark. Ảnh tải lên đổi tông toàn ảnh; chọn Màu gốc để giữ nguyên.</p>}
      <div className="avatar-picker-actions"><button type="button" className="button-primary" disabled={loading} onClick={() => save(draft)}>Lưu avatar</button>
        <button type="button" className="button-secondary" onClick={() => { choose('sparkle:blue'); save(null) }}>Ảnh mặc định</button></div>
      <p role="status">{message}</p>
    </div>
  </details>
}
