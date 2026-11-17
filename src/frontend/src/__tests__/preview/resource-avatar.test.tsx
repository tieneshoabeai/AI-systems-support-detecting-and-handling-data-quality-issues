import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { ResourceAvatar, ResourceAvatarPicker, ResourceIconAvatar } from '../../views/preview/components/resource-avatar'
import { prepareAvatarUpload } from '../../views/preview/components/resource-avatar-state'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const artColors = () => within(screen.getByRole('group', { name: 'Màu ảnh đại diện' }))
const iconColors = () => within(screen.getByRole('group', { name: 'Màu biểu tượng' }))

it('giữ ảnh thẻ Workspace và biểu tượng "gần đây" là hai lựa chọn độc lập', () => {
  const view = render(<><ResourceAvatarPicker kind="workspace" id="same" />
    <div data-testid="card"><ResourceAvatar kind="workspace" id="same" fallback="workspaces" /></div>
    <div data-testid="recent"><ResourceIconAvatar kind="workspace" id="same" fallback="workspaces" /></div>
    <div data-testid="project"><ResourceAvatar kind="project" id="same" fallback="projects" /></div></>)

  // Ảnh thẻ: SVG động "Quỹ đạo" tông tím.
  fireEvent.click(screen.getByRole('button', { name: 'Quỹ đạo', hidden: true }))
  fireEvent.click(artColors().getByRole('button', { name: 'Tím', hidden: true }))
  // Biểu tượng: "Mặt trăng" nền cam — không được kéo theo ảnh thẻ.
  fireEvent.click(screen.getByRole('button', { name: 'Mặt trăng', hidden: true }))
  fireEvent.click(iconColors().getByRole('button', { name: 'Cam', hidden: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Lưu avatar', hidden: true }))

  expect(localStorage.getItem('dataverse.preview.avatar.workspace.same')).toBe('picture:orbits|tone:violet')
  expect(localStorage.getItem('dataverse.preview.avatar-icon.workspace.same')).toBe('moon:orange')
  expect(screen.getByTestId('card').querySelector('[data-motif="orbits"].art-tone-violet')).not.toBeNull()
  expect(screen.getByTestId('recent').querySelector('.avatar-orange svg')).not.toBeNull()
  // Cùng id nhưng khác kind (project) vẫn trống: khóa tách theo kind.
  expect(screen.getByTestId('project').querySelector('.resource-avatar')).toBeNull()

  view.unmount()
  render(<ResourceAvatarPicker kind="workspace" id="same" />)
  expect(screen.getByRole('button', { name: 'Mặt trăng', hidden: true }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'Quỹ đạo', hidden: true }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Ảnh mặc định', hidden: true }))
  expect(localStorage.getItem('dataverse.preview.avatar.workspace.same')).toBeNull()
  expect(localStorage.getItem('dataverse.preview.avatar-icon.workspace.same')).toBeNull()
})

it('bỏ qua lựa chọn hỏng ở cả hai ô', () => {
  localStorage.setItem('dataverse.preview.avatar.project.invalid', 'unknown:red')
  localStorage.setItem('dataverse.preview.avatar-icon.workspace.invalid', 'moon:red')
  const { container } = render(<>
    <ResourceAvatar kind="project" id="invalid" fallback="projects" />
    <div data-testid="recent"><ResourceIconAvatar kind="workspace" id="invalid" fallback="workspaces" /></div>
  </>)
  expect(container.querySelector('.resource-avatar')).toBeNull()
  expect(container.querySelector('svg')).not.toBeNull()
  expect(screen.getByTestId('recent').querySelector('.resource-avatar')).toBeNull()
})

it('preserves saved picture IDs while rendering adaptive artwork', () => {
  render(<><ResourceAvatarPicker kind="project" id="png" /><div data-testid="result"><ResourceAvatar kind="project" id="png" fallback="projects" /></div></>)
  fireEvent.click(screen.getByRole('button', { name: 'Quỹ đạo', hidden: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Lưu avatar', hidden: true }))
  expect(localStorage.getItem('dataverse.preview.avatar.project.png')).toBe('picture:orbits')
  // Project không có chỗ hiện biểu tượng nên không ghi khóa icon.
  expect(localStorage.getItem('dataverse.preview.avatar-icon.project.png')).toBeNull()
  expect(screen.getByTestId('result').querySelector('[data-motif="orbits"] svg')).not.toBeNull()
})

it('rejects non-image and oversized uploads before decoding', async () => {
  await expect(prepareAvatarUpload(new File(['text'], 'file.txt', { type: 'text/plain' }))).rejects.toThrow('PNG')
  await expect(prepareAvatarUpload(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).rejects.toThrow('5 MB')
})

it('changes an image tone without replacing it with an icon and restores the original', () => {
  render(<><ResourceAvatarPicker kind="project" id="tone" /><div data-testid="toned"><ResourceAvatar kind="project" id="tone" fallback="projects" /></div></>)
  fireEvent.click(screen.getByRole('button', { name: 'Quỹ đạo', hidden: true }))
  fireEvent.click(artColors().getByRole('button', { name: 'Tím', hidden: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Lưu avatar', hidden: true }))
  expect(screen.getByTestId('toned').querySelector('.art-tone-violet svg')).not.toBeNull()
  expect(localStorage.getItem('dataverse.preview.avatar.project.tone')).toBe('picture:orbits|tone:violet')
  fireEvent.click(screen.getByRole('button', { name: 'Màu gốc', hidden: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Lưu avatar', hidden: true }))
  expect(screen.getByTestId('toned').querySelector('.art-tone-original svg')).not.toBeNull()
})

it('lets users pause all library animations', () => {
  render(<ResourceAvatarPicker kind="workspace" id="motion" />)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Chuyển động minh họa', hidden: true }))
  expect(document.querySelector('[data-motion="on"]')).toBeNull()
  expect(localStorage.getItem('dataverse.preview.art-motion')).toBe('off')
})
