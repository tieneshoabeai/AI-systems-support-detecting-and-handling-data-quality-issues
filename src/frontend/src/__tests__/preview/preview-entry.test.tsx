import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const homeProbe = vi.hoisted(() => vi.fn())
vi.mock('../../views/preview/home-2d.view', () => ({ HomePreviewView: () => { homeProbe(); return <p>frame home</p> } }))
vi.mock('../../views/preview/workspaces-2d.view', () => ({ WorkspacesPreviewView: () => <p>frame workspaces</p> }))
vi.mock('../../views/preview/projects-2d.view', () => ({ ProjectsPreviewView: () => <p>frame projects</p> }))
// Trang Project Workspace Overview (nhánh có id) cũng mock lại để test route chứng minh
// entry truyền đúng projectId xuống view, chứ không chỉ "có dựng frame".
vi.mock('../../views/preview/project-workspace-2d.view', () => ({
  ProjectWorkspaceView: ({ projectId }: { projectId: string }) => <p>{`frame project ${projectId}`}</p>,
}))
// Màn Thông báo dùng MỘT URL cho hai trạng thái, nên mock phải báo lại id nó nhận được
// — nếu không test route chi tiết chỉ chứng minh "có dựng frame", không chứng minh đúng bản ghi.
vi.mock('../../views/preview/notifications-2d.view', () => ({
  NotificationsPreviewView: ({ notificationId }: { notificationId: string | null }) =>
    <p>{notificationId ? `frame notification ${notificationId}` : 'frame notifications'}</p>,
}))
// Màn Settings (nhóm 04) cũng mock lại để test route chứng minh entry truyền đúng mục con
// 'settingsSection' xuống view, chứ không chỉ "có dựng frame".
vi.mock('../../views/preview/settings-2d.view', () => ({
  SettingsPreviewView: ({ section }: { section: string | null }) =>
    <p>{section ? `frame settings ${section}` : 'frame settings'}</p>,
}))

import { Preview2DEntry } from '../../views/preview/preview-entry'
import { is2DPreviewUrl, normalizePreviewHash } from '../../views/preview/preview-url'
import { previewMockStore } from '../../services/preview/preview-mock.service'

// Route preview dev-only: mỗi URL /preview/<section> dựng đúng frame,
// và Home (frame nặng nhất) chỉ dựng khi thực sự cần.

const openUrl = (url: string): void => { window.history.replaceState({}, '', url) }

// PreviewSessionProvider ghi phạm vi đã đọc từ URL xuống mock store (singleton cấp
// module), nên mỗi test phải bắt đầu từ fixture gốc — nếu không id do test trước để
// lại sẽ làm route của test sau nhảy sai.
beforeEach(() => { homeProbe.mockClear(); previewMockStore.reset(); window.localStorage.clear(); openUrl('/') })
afterEach(() => { cleanup(); openUrl('/') })

it('mở /preview/workspaces thì dựng frame workspaces, không dựng home', () => {
  openUrl('/preview/workspaces')
  render(<Preview2DEntry />)
  expect(screen.getByText('frame workspaces')).toBeDefined()
  expect(homeProbe).not.toHaveBeenCalled()
})

it('mở /preview/projects dựng danh sách; thêm id thì dựng trang Project đúng bản ghi', () => {
  openUrl('/preview/projects')
  const { unmount } = render(<Preview2DEntry />)
  expect(screen.getByText('frame projects')).toBeDefined()
  unmount()

  openUrl('/preview/projects/ws-acme/prj-sales')
  render(<Preview2DEntry />)
  expect(screen.getByText('frame project prj-sales')).toBeDefined()
})

it('/preview/notifications dựng hộp thư, thêm id thì dựng màn chi tiết đúng bản ghi', () => {
  openUrl('/preview/notifications')
  const { unmount } = render(<Preview2DEntry />)
  expect(screen.getByText('frame notifications')).toBeDefined()
  expect(homeProbe).not.toHaveBeenCalled()
  unmount()

  openUrl('/preview/notifications/nt-02')
  render(<Preview2DEntry />)
  expect(screen.getByText('frame notification nt-02')).toBeDefined()
})

it('/preview/settings dựng màn Cài đặt, thêm mục con thì truyền đúng settingsSection', () => {
  openUrl('/preview/settings')
  const { unmount } = render(<Preview2DEntry />)
  expect(screen.getByText('frame settings')).toBeDefined()
  expect(homeProbe).not.toHaveBeenCalled()
  unmount()

  // Segment sau 'settings' là MỤC CON Accounts (profile/security/sessions/notifications), không
  // phải workspaceId → view phải nhận đúng 'sessions' để mở sẵn đúng màn, không bao giờ về Home.
  openUrl('/preview/settings/sessions')
  render(<Preview2DEntry />)
  expect(screen.getByText('frame settings sessions')).toBeDefined()
})

it('hash route cũng chọn đúng frame (shell điều hướng bằng #/preview/<section>)', () => {
  openUrl('/#/preview/workspaces')
  render(<Preview2DEntry />)
  expect(screen.getByText('frame workspaces')).toBeDefined()
  expect(homeProbe).not.toHaveBeenCalled()
})

it('URL preview khác fallback về home, dải báo dữ liệu mẫu chỉ là ngữ cảnh tĩnh', () => {
  openUrl('/preview')
  render(<Preview2DEntry />)
  expect(screen.getByText('frame home')).toBeDefined()
  expect(document.querySelector('.preview-demo-strip')!.textContent).toContain('dữ liệu mẫu')
  // Dải tĩnh KHÔNG được là live region: vùng sống duy nhất phải là toaster, nếu không
  // máy đọc màn hình sẽ lặp lại cùng một câu sau mỗi toast.
  const live = screen.getAllByRole('status')
  expect(live).toHaveLength(1)
  expect(live[0].classList.contains('preview-toaster')).toBe(true)
})

it('is2DPreviewUrl nhận diện pathname + hash nhưng chừa route 3D của T', () => {
  expect(is2DPreviewUrl('/preview/home')).toBe(true)
  expect(is2DPreviewUrl('/#/preview/workspaces')).toBe(true)
  expect(is2DPreviewUrl('/#/preview/notifications/nt-02')).toBe(true)
  expect(is2DPreviewUrl('/workspaces')).toBe(false)
  expect(is2DPreviewUrl('/auth/login')).toBe(false)
  expect(is2DPreviewUrl('/preview/workspaces-3d')).toBe(false)
})

// '#/preview/homes' (gõ nhầm, không có section nào tên đó) parse ra null → readPreviewRoute rơi
// về Home, màn hình hiện Home trong khi URL nói chỗ khác. Để nguyên URL là gửi một lời hứa sai
// (copy link, F5, history). Test đi qua component thật vì chính effect của entry gọi normalize
// TRƯỚC khi vẽ.
it('hash preview không parse được bị viết lại về đúng màn đang vẽ', () => {
  openUrl('/#/preview/homes')
  render(<Preview2DEntry />)
  expect(screen.getByText('frame home')).toBeDefined()
  expect(window.location.hash).toBe('#/preview/home')
})

it('hash hợp lệ (kể cả id chi tiết) không bị đụng tới', () => {
  openUrl('/#/preview/projects/ws-dataeng/prj-sales')
  render(<Preview2DEntry />)
  expect(window.location.hash).toBe('#/preview/projects/ws-dataeng/prj-sales')
})

// Route 3D của T chọn bằng PATHNAME và mang hash riêng '#project=…'; main.tsx không đọc
// hash khi quyết định route nên không được sửa vào phần của họ. Hash ngoài '#/preview/'
// (neo của trang khác) cũng nằm ngoài phạm vi hàm này.
it('hash của trang 3D và hash ngoài preview được để yên', () => {
  openUrl('/preview/workspaces-3d')
  window.location.hash = '#project=prj-sales'
  normalizePreviewHash()
  expect(window.location.hash).toBe('#project=prj-sales')
  openUrl('/auth/login')
  window.location.hash = '#section-2'
  normalizePreviewHash()
  expect(window.location.hash).toBe('#section-2')
})

// '#/preview/workspaces-3d' nghe như trang của T nhưng không phải: của T nằm ở pathname.
// Ai gõ tay hash này khi đang ở frame 2D thì nội dung là Home → URL phải sửa theo.
it('#/preview/workspaces-3d trong frame 2D quy về Home vì không có màn nào ở đó', () => {
  openUrl('/#/preview/workspaces-3d')
  normalizePreviewHash()
  expect(window.location.hash).toBe('#/preview/home')
})
