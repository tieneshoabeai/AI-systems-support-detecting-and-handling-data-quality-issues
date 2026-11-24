import { requireDefined } from '../../utils/required-value'
import { useSyncExternalStore } from 'react'
export const pictures = [
  { id: 'network', label: 'Mạng dữ liệu' },
  { id: 'orbits', label: 'Quỹ đạo' },
  { id: 'lattice', label: 'Ma trận' },
  { id: 'flow', label: 'Luồng dữ liệu' },
  { id: 'scan', label: 'Thấu kính' },
  { id: 'branches', label: 'Nhánh kết nối' },
  { id: 'radar', label: 'Radar khám phá' },
  { id: 'waves', label: 'Sóng tín hiệu' },
  { id: 'crystal', label: 'Tinh thể dữ liệu' },
  { id: 'constellation', label: 'Chòm sao' },
]
export const isUploaded = (value: string) => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)
export const imageBase = (value: string) => value.split('|tone:')[0] ?? value
export const imageTone = (value: string) => value.split('|tone:')[1] ?? 'original'
export function imageSource(value: string): string | undefined {
  const base = imageBase(value)
  const tone = imageTone(value)
  if (value.split('|tone:').length > 2 || (tone !== 'original' && !colors.some(color => color === tone))) return undefined
  return pictures.some(picture => base === `picture:${picture.id}`) || isUploaded(requireDefined(base, 'resource-avatar-state.ts:23')) ? base : undefined
}

export async function prepareAvatarUpload(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Chọn ảnh PNG, JPG hoặc WebP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Ảnh quá lớn. Vui lòng chọn ảnh tối đa 5 MB.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Không thể xử lý ảnh trên trình duyệt này.')
    context.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/webp', 0.85)
  } finally { URL.revokeObjectURL(url) }
}

export const motifs = [
  ['workspaces', 'Thư mục'], ['projects', 'Dự án'], ['datasets', 'Dữ liệu'],
  ['chart', 'Biểu đồ'], ['sparkle', 'Ngôi sao'], ['home', 'Ngôi nhà'],
  ['shield', 'Khiên'], ['box', 'Khối hộp'], ['sun', 'Mặt trời'],
  ['moon', 'Mặt trăng'], ['palette', 'Bảng màu'], ['user', 'Cá nhân'],
  ['users', 'Đội nhóm'], ['share', 'Kết nối'], ['activity', 'Nhịp sống'],
  ['file', 'Tài liệu'], ['grid', 'Ô vuông'], ['monitor', 'Máy tính'],
  ['phone', 'Điện thoại'], ['key', 'Chìa khóa'], ['lock', 'Ổ khóa'],
  ['bell', 'Chuông'], ['clock', 'Đồng hồ'], ['star', 'Sao năm cánh'],
] as const
export const colors = ['blue', 'violet', 'green', 'orange', 'pink', 'cyan'] as const
export const colorLabels = ['Xanh dương', 'Tím', 'Xanh lá', 'Cam', 'Hồng', 'Xanh ngọc']

// Hai ô độc lập cho cùng một tài nguyên:
//   · art  — ảnh thư viện (SVG động) hoặc ảnh tải lên; hiện ở thẻ Workspace (CoverArt).
//   · icon — biểu tượng màu; hiện ở ô nhỏ của "Workspace gần đây".
// Trước đây cả hai dùng chung một khóa nên chọn biểu tượng là mất ảnh thẻ (và ngược lại);
// tách khóa là điều kiện để mỗi chỗ hiện đúng thứ người dùng chọn cho nó.
export const artPrefix = 'dataverse.preview.avatar.'
export const iconPrefix = 'dataverse.preview.avatar-icon.'
export const changed = 'dataverse-avatar-change'
export const DEFAULT_ART = 'picture:network'
export const DEFAULT_ICON = 'sparkle:blue'
export type Kind = 'workspace' | 'project'
export type Slot = 'art' | 'icon'
export const keyFor = (kind: Kind, id: string, slot: Slot = 'art') => `${slot === 'icon' ? iconPrefix : artPrefix}${kind}.${id}`
export type ResourceAvatarChoice = { art: string | null; icon?: string | null }

export function saveResourceAvatar(kind: Kind, id: string, { art, icon }: ResourceAvatarChoice) {
  const write = (slot: Slot, value: string | null) => {
    const key = keyFor(kind, id, slot)
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  }
  write('art', art)
  if (icon !== undefined) write('icon', icon)
  window.dispatchEvent(new Event(changed))
}
export const subscribe = (listener: () => void) => {
  window.addEventListener(changed, listener)
  window.addEventListener('storage', listener)
  return () => { window.removeEventListener(changed, listener); window.removeEventListener('storage', listener) }
}
export function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
export function validArt(value: string | null): boolean {
  return Boolean(value && imageSource(value))
}
export function validIcon(value: string | null): boolean {
  if (!value) return false
  const parts = value.split(':')
  if (parts.length !== 2) return false
  const [icon, color] = parts
  return motifs.some(([name]) => name === icon) && colors.some(name => name === color)
}

export function useResourceAvatar(kind: Kind, id: string) {
  const value = useSyncExternalStore(subscribe, () => read(keyFor(kind, id)), () => null)
  return validArt(value) ? value : null
}
export function useResourceIcon(kind: Kind, id: string) {
  const value = useSyncExternalStore(subscribe, () => read(keyFor(kind, id, 'icon')), () => null)
  return validIcon(value) ? value : null
}
