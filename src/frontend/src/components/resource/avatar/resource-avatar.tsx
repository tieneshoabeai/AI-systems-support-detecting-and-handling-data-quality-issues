import { useRef, useState } from 'react'
import { Icon as PreviewIcon } from '../../ui/primitives/icon'
import { AdaptiveArt, ArtMotionControl } from '../artwork/adaptive-art'
import { changed, colors, colorLabels, imageBase, imageSource, imageTone, keyFor, motifs, pictures, prepareAvatarUpload, useResourceAvatar, useResourceIcon, DEFAULT_ART, DEFAULT_ICON, isUploaded, type Slot, type Kind } from '../../../hooks/resource/use-resource-avatar'
import './resource-avatar.css'

function ArtWork({ value }: { value: string }) {
  const picture = pictures.find(item => imageBase(value) === `picture:${item.id}`)
  if (picture) return <AdaptiveArt motif={picture.id} tone={imageTone(value)} />
  const src = imageSource(value)
  if (!src) return null
  return <span className={`resource-avatar resource-avatar-image image-tone-${imageTone(value)}`}><img src={src} alt="" /></span>
}
function IconWork({ value }: { value: string }) {
  const [icon = 'workspaces', color = 'blue'] = value.split(':')
  return <span className={`resource-avatar avatar-${color}`} aria-hidden="true"><PreviewIcon name={icon} /></span>
}

// Ảnh đại diện của tài nguyên (thẻ ở trang Workspaces, dải đầu trang chi tiết Project).
export function ResourceAvatar({ kind, id, fallback }: { kind: Kind; id: string; fallback: string }) {
  const value = useResourceAvatar(kind, id)
  return value ? <ArtWork value={value} /> : <PreviewIcon name={fallback} />
}
// Biểu tượng riêng của tài nguyên (ô 40px trong "Workspace gần đây" ở Home).
export function ResourceIconAvatar({ kind, id, fallback }: { kind: Kind; id: string; fallback: string }) {
  const value = useResourceIcon(kind, id)
  return value ? <IconWork value={value} /> : <PreviewIcon name={fallback} />
}
export function SelectedResourceArt({ value }: { value: string }) {
  return <ArtWork value={value} />
}

export function ResourceAvatarPicker({ kind, id }: { kind: Kind; id: string }) {
  const selectedArt = useResourceAvatar(kind, id)
  const selectedIcon = useResourceIcon(kind, id)
  // Biểu tượng chỉ có chỗ hiện ở "Workspace gần đây" (Home), nên với Project thì không bày
  // một ô chọn không ảnh hưởng tới đâu cả.
  const withIcon = kind === 'workspace'
  const [draftArt, setDraftArt] = useState(selectedArt ?? DEFAULT_ART)
  const [draftIcon, setDraftIcon] = useState(selectedIcon ?? DEFAULT_ICON)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const request = useRef(0)
  const uploaded = isUploaded(imageBase(draftArt))
  const artColor = imageTone(draftArt)
  const [iconName, iconColor] = draftIcon.split(':')

  const chooseArt = (value: string) => { request.current++; setLoading(false); setDraftArt(value); setMessage('') }
  const chooseIcon = (value: string) => { request.current++; setLoading(false); setDraftIcon(value); setMessage('') }
  // Đổi màu ảnh = đổi tông của chính ảnh đang chọn (không thay bằng biểu tượng); "Màu gốc"
  // bỏ hậu tố tông để ảnh/SVG trở lại bảng màu mặc định.
  const chooseArtColor = (color: string | null) => chooseArt(color ? `${imageBase(draftArt)}|tone:${color}` : imageBase(draftArt))

  const upload = async (file: File | undefined) => {
    if (!file) return
    const ticket = ++request.current
    setLoading(true); setMessage('Đang chuẩn bị ảnh…')
    try {
      const value = await prepareAvatarUpload(file)
      if (ticket === request.current) { setDraftArt(value); setMessage('Ảnh đã sẵn sàng. Bấm Lưu avatar để áp dụng.') }
    } catch (error) {
      if (ticket === request.current) setMessage(error instanceof Error && error.name !== 'EncodingError' ? error.message : 'Không đọc được ảnh. Hãy chọn một ảnh khác.')
    } finally { if (ticket === request.current) setLoading(false) }
  }

  const write = (slot: Slot, value: string | null) => {
    const key = keyFor(kind, id, slot)
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  }
  const save = () => {
    try {
      write('art', draftArt)
      if (withIcon) write('icon', draftIcon)
      window.dispatchEvent(new Event(changed))
      setMessage('Đã lưu ảnh đại diện trên trình duyệt này.')
    } catch { setMessage('Không đủ dung lượng hoặc trình duyệt không cho phép lưu. Hãy chọn ảnh khác hoặc xóa bớt dữ liệu đã lưu.') }
  }
  const reset = () => {
    try {
      write('art', null)
      if (withIcon) write('icon', null)
      window.dispatchEvent(new Event(changed))
      setDraftArt(DEFAULT_ART); setDraftIcon(DEFAULT_ICON)
      setMessage('Đã khôi phục ảnh mặc định.')
    } catch { setMessage('Không bỏ được ảnh đã lưu trên trình duyệt này.') }
  }

  return <details className="resource-avatar-picker" onToggle={event => {
    request.current++; setLoading(false)
    if (event.currentTarget.open) {
      setDraftArt(selectedArt ?? DEFAULT_ART); setDraftIcon(selectedIcon ?? DEFAULT_ICON); setMessage('')
    }
  }}>
    <summary><PreviewIcon name="palette" /> Chọn ảnh đại diện</summary>
    <div className="avatar-picker-body">
      <div className="avatar-picker-intro">
        <span className="avatar-slot-preview"><ArtWork value={draftArt} /><small>Thẻ Workspace</small></span>
        {withIcon && <span className="avatar-slot-preview avatar-slot-preview-icon"><IconWork value={draftIcon} /><small>Gần đây</small></span>}
        <div>
          <strong>Dấu ấn riêng cho {kind === 'workspace' ? 'Workspace' : 'Project'}</strong>
          <p>Ảnh (SVG động hoặc tải lên) dùng cho thẻ {kind === 'workspace' ? 'Workspace' : 'Project'}
            {withIcon ? '; biểu tượng dùng riêng cho danh sách Workspace gần đây.' : '.'} Hai lựa chọn lưu độc lập trên trình duyệt này.</p>
        </div>
      </div>

      <section className="avatar-picker-section" aria-label="Ảnh đại diện">
        <h3>Ảnh đại diện</h3>
        <p className="avatar-section-note">Hiện trên thẻ ở trang Workspaces và phần đầu trang chi tiết.</p>
        <div className="avatar-library" role="group" aria-label="Ảnh có sẵn">
          {pictures.map(picture => <button type="button" key={picture.id} aria-pressed={imageBase(draftArt) === `picture:${picture.id}`}
            onClick={() => chooseArt(`picture:${picture.id}`)}>
            <AdaptiveArt motif={picture.id} /><span>{picture.label}</span>
          </button>)}
        </div>
        <ArtMotionControl />
        <label className="avatar-upload">Tải ảnh từ máy (PNG, JPG, WebP · tối đa 5 MB)
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} />
        </label>
        <div className="avatar-colors" role="group" aria-label="Màu ảnh đại diện">
          <button type="button" className="button-secondary avatar-original" aria-pressed={artColor === 'original'}
            onClick={() => chooseArtColor(null)}>Màu gốc</button>
          {colors.map((name, index) => <button key={name} type="button" className={`avatar-color avatar-${name}`}
            aria-label={colorLabels[index]} title={colorLabels[index]} aria-pressed={artColor === name}
            onClick={() => chooseArtColor(name)}><PreviewIcon name={artColor === name ? 'check' : 'palette'} /></button>)}
        </div>
        <p className="avatar-tone-note">Màu áp cho cả SVG động lẫn ảnh tải lên: SVG đổi nền, nét và viền theo theme;
          ảnh tải lên đổi tông toàn ảnh. Chọn Màu gốc để giữ nguyên.</p>
        {uploaded && <p className="avatar-tone-note">Ảnh này đang là bản tải lên đã nén (tối đa 512px) — bấm Lưu avatar để áp dụng.</p>}
      </section>

      {withIcon && <section className="avatar-picker-section" aria-label="Biểu tượng">
        <h3>Biểu tượng</h3>
        <p className="avatar-section-note">Chỉ hiện ở ô nhỏ trong "Workspace gần đây" trên trang Home — không thay ảnh đại diện ở trên.</p>
        <div className="avatar-motifs" role="group" aria-label="Biểu tượng avatar">
          {motifs.map(([name, label]) => <button key={name} type="button" aria-label={label} title={label}
            aria-pressed={iconName === name} onClick={() => chooseIcon(`${name}:${iconColor}`)}>
            <IconWork value={`${name}:${iconColor}`} />
          </button>)}
        </div>
        <div className="avatar-colors" role="group" aria-label="Màu biểu tượng">
          {colors.map((name, index) => <button key={name} type="button" className={`avatar-color avatar-${name}`}
            aria-label={colorLabels[index]} title={colorLabels[index]} aria-pressed={iconColor === name}
            onClick={() => chooseIcon(`${iconName}:${name}`)}><PreviewIcon name={iconColor === name ? 'check' : 'palette'} /></button>)}
        </div>
      </section>}

      <div className="avatar-picker-actions">
        <button type="button" className="button-primary" disabled={loading} onClick={save}>Lưu avatar</button>
        <button type="button" className="button-secondary" onClick={reset}>Ảnh mặc định</button>
      </div>
      <p role="status">{message}</p>
    </div>
  </details>
}
