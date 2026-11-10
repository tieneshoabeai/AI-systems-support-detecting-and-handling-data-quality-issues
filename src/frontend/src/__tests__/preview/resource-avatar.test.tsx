import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { ResourceAvatar, ResourceAvatarPicker } from '../../views/preview/components/resource-avatar'
import { prepareAvatarUpload } from '../../views/preview/components/resource-avatar-state'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

it('saves a selection, updates other views and keeps workspace/project choices separate', () => {
  const view = render(<><ResourceAvatarPicker kind="workspace" id="same" />
    <div data-testid="workspace"><ResourceAvatar kind="workspace" id="same" fallback="workspaces" /></div>
    <div data-testid="project"><ResourceAvatar kind="project" id="same" fallback="projects" /></div></>)
  fireEvent.click(screen.getByRole('button', { name: 'Mặt trăng', hidden: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Tím', hidden: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Lưu avatar', hidden: true }))
  expect(screen.getByTestId('workspace').querySelector('.avatar-violet')).not.toBeNull()
  expect(screen.getByTestId('project').querySelector('.resource-avatar')).toBeNull()
  view.unmount()
  render(<ResourceAvatarPicker kind="workspace" id="same" />)
  expect(screen.getByRole('button', { name: 'Mặt trăng', hidden: true }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Ảnh mặc định', hidden: true }))
  expect(localStorage.getItem('dataverse.preview.avatar.workspace.same')).toBeNull()
})

it('ignores corrupt stored choices', () => {
  localStorage.setItem('dataverse.preview.avatar.project.invalid', 'unknown:red')
  const { container } = render(<ResourceAvatar kind="project" id="invalid" fallback="projects" />)
  expect(container.querySelector('.resource-avatar')).toBeNull()
  expect(container.querySelector('svg')).not.toBeNull()
})

it('preserves saved picture IDs while rendering adaptive artwork', () => {
  render(<><ResourceAvatarPicker kind="project" id="png" /><div data-testid="result"><ResourceAvatar kind="project" id="png" fallback="projects" /></div></>)
  fireEvent.click(screen.getByRole('button', { name: 'Quỹ đạo', hidden: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Lưu avatar', hidden: true }))
  expect(localStorage.getItem('dataverse.preview.avatar.project.png')).toBe('picture:orbits')
  expect(screen.getByTestId('result').querySelector('[data-motif="orbits"] svg')).not.toBeNull()
})

it('rejects non-image and oversized uploads before decoding', async () => {
  await expect(prepareAvatarUpload(new File(['text'], 'file.txt', { type: 'text/plain' }))).rejects.toThrow('PNG')
  await expect(prepareAvatarUpload(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).rejects.toThrow('5 MB')
})

it('changes an image tone without replacing it with an icon and restores the original', () => {
  render(<><ResourceAvatarPicker kind="project" id="tone" /><div data-testid="toned"><ResourceAvatar kind="project" id="tone" fallback="projects" /></div></>)
  fireEvent.click(screen.getByRole('button', { name: 'Quỹ đạo', hidden: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Tím', hidden: true }))
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
