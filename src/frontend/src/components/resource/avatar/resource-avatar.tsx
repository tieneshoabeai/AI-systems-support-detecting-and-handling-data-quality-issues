import { useRef, useState } from 'react'
import { Icon as PreviewIcon } from '../../ui/primitives/icon'
import { AdaptiveArt, ArtMotionControl } from '../artwork/adaptive-art'
import { colors, colorLabels, imageBase, imageSource, imageTone, motifs, pictures, prepareAvatarUpload, saveResourceAvatar, useResourceAvatar, useResourceIcon, DEFAULT_ART, DEFAULT_ICON, type Kind, type ResourceAvatarChoice } from '../../../hooks/resource/use-resource-avatar'
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
  const [revision, setRevision] = useState(0)
  return <details className="resource-avatar-picker" onToggle={event => {
    if (event.currentTarget.open) setRevision(value => value + 1)
  }}>
    <summary><PreviewIcon name="palette" /> Chọn ảnh đại diện</summary>
    <ResourceAvatarEditor key={revision} kind={kind} initial={{ art: selectedArt, icon: selectedIcon }}
      onSave={choice => saveResourceAvatar(kind, id, choice)} />
  </details>
}

export function ResourceAvatarEditor({ kind, initial, onSave, staged = false }: {
  kind: Kind
  initial: ResourceAvatarChoice
  onSave: (choice: ResourceAvatarChoice) => void
  staged?: boolean
}) {
  // Biểu tượng chỉ có chỗ hiện ở "Workspace gần đây" (Home), nên với Project thì không bày
  // một ô chọn không ảnh hưởng tới đâu cả.
  const withIcon = kind === 'workspace'
  const [draftArt, setDraftArt] = useState(initial.art ?? DEFAULT_ART)
  const [draftIcon, setDraftIcon] = useState(initial.icon ?? DEFAULT_ICON)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const request = useRef(0)
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
      if (ticket === request.current) { setDraftArt(value); setMessage('Ảnh đã sẵn sàng để áp dụng.') }
    } catch (error) {
      if (ticket === request.current) setMessage(error instanceof Error && error.name !== 'EncodingError' ? error.message : 'Không đọc được ảnh. Hãy chọn một ảnh khác.')
    } finally { if (ticket === request.current) setLoading(false) }
  }

  const save = () => {
    try {
      onSave({ art: draftArt, ...(withIcon ? { icon: draftIcon } : {}) })
      setMessage('Đã lưu ảnh đại diện trên trình duyệt này.')
    } catch { setMessage('Không đủ dung lượng hoặc trình duyệt không cho phép lưu. Hãy chọn ảnh khác hoặc xóa bớt dữ liệu đã lưu.') }
  }
  const reset = () => {
    request.current++
    setLoading(false)
    try {
      onSave({ art: null, ...(withIcon ? { icon: null } : {}) })
      setDraftArt(DEFAULT_ART); setDraftIcon(DEFAULT_ICON)
      setMessage('Đã khôi phục ảnh mặc định.')
    } catch { setMessage('Không bỏ được ảnh đã lưu trên trình duyệt này.') }
  }

  return <div className="avatar-picker-body">
      <div className="avatar-picker-intro">
        <span className="avatar-slot-preview"><ArtWork value={draftArt} /><small>{kind === 'workspace' ? 'Thẻ Workspace' : 'Thẻ Project'}</small></span>
        {withIcon && <span className="avatar-slot-preview avatar-slot-preview-icon"><IconWork value={draftIcon} /><small>Workspace gần đây</small></span>}
        <div>
          <strong>Xem trước</strong>
          <p>Ảnh đại diện và biểu tượng được lưu trên trình duyệt này.</p>
        </div>
      </div>

      <section className="avatar-picker-section" aria-label="Ảnh đại diện">
        <h3>Ảnh đại diện</h3>
        <p className="avatar-section-note">Hiện trên thẻ và ở đầu trang chi tiết.</p>
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
      </section>

      {withIcon && <section className="avatar-picker-section" aria-label="Biểu tượng">
        <h3>Biểu tượng</h3>
        <p className="avatar-section-note">Hiện trong mục Workspace gần đây trên trang Home.</p>
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
        <button type="button" className="button-primary" disabled={loading} onClick={save}>{staged ? 'Dùng ảnh này' : 'Lưu avatar'}</button>
        <button type="button" className="button-secondary" onClick={reset}>Ảnh mặc định</button>
      </div>
      <p role="status">{message}</p>
    </div>
}
