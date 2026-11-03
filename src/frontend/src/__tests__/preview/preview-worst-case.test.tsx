import { cleanup, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { HomePreviewView } from '../../views/preview/home-2d.view'
import { WorkspacesPreviewView } from '../../views/preview/workspaces-2d.view'
import { ProjectsPreviewView } from '../../views/preview/projects-2d.view'
import { ProjectWorkspaceView } from '../../views/preview/project-workspace-2d.view'
import { NotificationsPreviewView } from '../../views/preview/notifications-2d.view'
import { formatCount, formatDataSize, formatRows, emailForPerson, pluralEn, projectsPerWorkspaceFor } from '../../views/preview/preview-data'
import { people } from '../../services/preview/preview-fixtures'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import { fixtureSets } from '../../services/preview/preview-worst-case'
import { cardByTitle, everyDisabledButtonHasVisibleReason, renderFrame, resetPreviewStore } from './preview-test-kit'

// Suite break-ui: nạp bộ dữ liệu xấu nhất qua ĐÚNG biên mà dữ liệu demo vẫn vào
// (fixtures → seedState → usePreviewSession), không sửa component để tạo lỗi.
// jsdom không đo được ô co giãn hay chữ tràn khỏi khung — phần đó xem bằng mắt ở Cờ dev
// (`?data=worst`). Đây là lưới an toàn cho những lỗi máy bắt được: trang sập, chữ thô bị
// in ra, key trùng, và nút tắt mất lý do khi dữ liệu đổi cấu trúc.

const frameText = (): string => document.body.textContent ?? ''

// Vẽ cả năm màn của frame 2D với bộ dữ liệu đang nạp, trả về text của từng màn.
// id đầu tiên lấy từ chính store: bộ 'empty' không có bản ghi nào nên hai màn chi tiết
// bị bỏ qua có chủ đích — đó cũng là một đường đi hợp lệ của người dùng.
const renderAllFrames = (): string[] => {
  const state = previewMockStore.getState()
  const shots: string[] = []
  const snap = (node: ReactNode): void => {
    renderFrame(node)
    // Bất biến "mọi nút tắt phải có lý do nhìn thấy" phải giữ ở CẢ dữ liệu xấu, không
    // chỉ dữ liệu demo: EmptyHint và note đổi nội dung theo số bản ghi.
    everyDisabledButtonHasVisibleReason()
    shots.push(frameText())
    cleanup()
  }
  snap(<HomePreviewView />)
  snap(<WorkspacesPreviewView />)
  if (state.workspaces[0]) snap(<WorkspacesPreviewView workspaceId={state.workspaces[0].id} />)
  snap(<ProjectsPreviewView />)
  if (state.projects[0]) snap(<ProjectWorkspaceView projectId={state.projects[0].id} />)
  snap(<NotificationsPreviewView notificationId={null} />)
  return shots
}

beforeEach(() => {
  resetPreviewStore()
  previewMockStore.reset('demo')
  window.localStorage.clear()
  window.location.hash = ''
})

afterEach(() => { cleanup(); window.location.hash = '' })

// Timeout tường minh: test này vẽ 30 khung (5 bộ × 6 màn) nên chậm nhất suite. Một mình nó
// hết ~0,8s, nhưng khi 26 file cùng khởi tạo jsdom thì CPU giành nhau và nó đã vượt mức 5s
// mặc định mà không có lỗi nào — một báo động giả. Tăng trần thời gian, KHÔNG bỏ checks.
it('năm màn vẽ được với cả năm bộ dữ liệu, không sập và không in chữ thô', () => {
  for (const set of fixtureSets) {
    previewMockStore.reset(set.id)
    for (const shot of renderAllFrames()) {
      // 'NaN' = một phép tính ăn phải null/undefined; 'undefined' = trường bị bỏ sót
      // khỏi fallback; '[object Object]' = một object được render thẳng.
      expect(shot, `set "${set.id}"`).not.toMatch(/NaN|undefined|\[object Object\]/)
    }
  }
}, 20_000)

it('hai workspace trùng tên không sinh React key trùng trên Home', () => {
  // Bộ 'worst' có hai workspace đều tên "Marketing" — người dùng đổi tên trong frame 2D
  // tạo ra được trạng thái này mà không cần API. Biểu đồ cũ key theo TÊN nên hai cột
  // dính thành một và React cảnh báo "two children with the same key".
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  previewMockStore.reset('worst')
  renderFrame(<HomePreviewView />)
  expect(errors.mock.calls.filter(call => String(call[0]).includes('same key'))).toEqual([])
  errors.mockRestore()

  const bars = projectsPerWorkspaceFor(previewMockStore.getState(), 7)
  expect(bars).toHaveLength(7)
  expect(new Set(bars.map(bar => bar.id)).size).toBe(7)
  expect(bars.filter(bar => bar.label === 'Marketing')).toHaveLength(2)
})

it('một con số chỉ có một cách hiện, kể cả hai bên mốc làm tròn', () => {
  // 999.500 từng in ra '1000K dòng' trong khi 1.000.001 in '1M dòng': hai giá trị sát nhau
  // nhất lại trông như hai đơn vị khác nhau.
  expect(formatRows(999_500)).toBe('1M dòng')
  expect(formatRows(1_000_001)).toBe('1M dòng')
  expect(formatRows(128_400_000)).toBe('128,4M dòng')
  expect(formatRows(240)).toBe('240 dòng')
  expect(formatRows(1)).toBe('1 dòng')
  // `sizeMb` là trường duy nhất lưu dung lượng → mọi giá trị ≥ 1024 phải tự đổi đơn vị.
  expect(formatDataSize(46)).toBe('46 MB')
  expect(formatDataSize(1_024)).toBe('1 GB')
  expect(formatDataSize(12_800)).toBe('12,5 GB')
  expect(formatDataSize(98_304)).toBe('96 GB')
  expect(formatDataSize(1_048_576)).toBe('1 TB')
  expect(formatCount(128_400_000)).toBe('128.400.000')
})

it('danh từ đếm số ít đúng khi số đếm bằng 1', () => {
  expect(pluralEn(1, 'project')).toBe('1 project')
  expect(pluralEn(0, 'project')).toBe('0 projects')
  expect(pluralEn(12, 'project')).toBe('12 projects')

  previewMockStore.reset('one')
  renderFrame(<HomePreviewView />)
  const tileNote = document.querySelector('.ws-tile small')?.textContent ?? ''
  expect(tileNote).toContain('1 project')
  expect(tileNote).not.toContain('1 projects')
})

it('bộ "empty": khung trống nói đúng nguyên nhân, không đổ cho bộ lọc khi chưa gõ gì', () => {
  previewMockStore.reset('empty')
  renderFrame(<HomePreviewView />)
  expect(screen.getByText('Chưa có workspace nào trong dữ liệu mẫu.')).toBeDefined()
  expect(screen.getByText('Chưa có project nào trong dữ liệu mẫu.')).toBeDefined()
  // Câu "khớp “…”" chỉ được xuất hiện khi người dùng thực sự có từ khóa.
  expect(frameText()).not.toMatch(/khớp “”/)

  // Biểu đồ không có bản ghi: vẽ một khung trắng cao bằng biểu đồ có dữ liệu là bug
  // (người đọc tưởng trang đang tải), phải ra lời báo trống.
  expect(screen.getByText('Chưa có project nào trong dữ liệu mẫu.')).toBeDefined()
  expect(document.querySelector('.pv-bars')).toBeNull()
  cleanup()

  renderFrame(<ProjectsPreviewView />)
  expect(screen.getByText('Không có kết quả')).toBeDefined()
  expect(frameText()).toContain('chưa có project nào trong dữ liệu mẫu')
})

it('bộ "worst": project không thành viên hiện lời báo thay vì khối trống', () => {
  previewMockStore.reset('worst')
  const bare = previewMockStore.getState().projects.find(project => project.members.length === 0)
  if (!bare) throw new Error('Bộ "worst" phải còn một project không thành viên để test')

  // Danh sách project: thẻ của project chưa chọn ai phải nói "chưa có thành viên", không để
  // một avatar-stack rỗng — khoảng trống là thứ người đọc đoán là "trang chưa tải xong".
  // Phải đổi phạm vi làm việc về workspace của nó: trang Projects lọc theo selection và
  // reset('worst') chọn workspace đầu tiên, không phải workspace có project rỗng thành viên.
  previewMockStore.selectWorkspace(bare.workspaceId)
  renderFrame(<ProjectsPreviewView />)
  const card = cardByTitle(bare.name)
  expect(within(card).getByText('chưa có thành viên')).toBeDefined()
  expect(card.querySelector('.avatar-stack')).toBeNull()

  // Trang Project Overview của CHÍNH project đó (nó vừa không thành viên vừa chưa nạp tệp).
  // Hai vùng dễ sập thành khoảng trắng là dải dataset và khối tâm 3D: cả hai phải còn chữ, và
  // khối tâm phải mang dấu hiệu "rỗng" để CSS vẽ khác đi, không phải một quả cầu tên trống.
  // Thành viên không còn thành danh sách trên trang này (ảnh vẽ chúng trong thẻ "Thông tin
  // Project" dạng số) nên người role rỗng không còn chỗ để in ra một dòng trắng.
  cleanup()
  renderFrame(<ProjectWorkspaceView projectId={bare.id} />)
  expect(screen.getByText('project chưa có tập dữ liệu — nạp tệp thuộc module Dataset (batch của bạn T)')).toBeDefined()
  expect(document.querySelector('.pj-core.is-empty')).not.toBeNull()
  expect(frameText()).not.toMatch(/undefined|NaN/)
})

it('bộ "worst": hộp thư chịu được tiêu đề dài, id treo và mô tả rỗng', () => {
  previewMockStore.reset('worst')
  renderFrame(<NotificationsPreviewView notificationId="w-nt-nodesc" />)
  expect(screen.getByText('Bản tin này không kèm mô tả chi tiết.')).toBeDefined()
  cleanup()

  // Thông báo SỐNG LÂU HƠN project nó mô tả. Nút "Mở Project" phải tắt và nói lý do,
  // không được đưa người dùng sang một trang "Không tìm thấy project".
  renderFrame(<NotificationsPreviewView notificationId="w-nt-dangling" />)
  const open = screen.getByRole('button', { name: /Mở Project/ })
  expect((open as HTMLButtonElement).disabled).toBe(true)
  const note = document.getElementById(open.getAttribute('aria-describedby') ?? '')
  expect(note?.textContent).toContain('đã bị xóa')
})

it('đổi tên workspace phải đổi luôn tên in trên mọi project của nó', () => {
  // Project lưu một bản sao tên workspace để bảng Projects vẽ được mà không phải join, nên
  // đổi tên workspace phải vá cả hai mảng. Thiếu một vế thì cùng một màn hình hiện hai tên
  // cho cùng một không gian: sai dữ liệu, không phải sai trình bày. Test khoá cả hai đường
  // đổi tên (menu chuột và modal Thông tin Workspace) để thêm đường thứ ba không ai quên.
  previewMockStore.reset('worst')
  const renamed = previewMockStore.getState().workspaces.find(
    workspace => previewMockStore.getState().projects.some(project => project.workspaceId === workspace.id),
  )
  expect(renamed).toBeDefined()
  const siblingIds = previewMockStore.getState().projects
    .filter(project => project.workspaceId === renamed!.id)
    .map(project => project.id)
  expect(siblingIds.length).toBeGreaterThan(0)

  // Đổi tên một workspace chỉ được chạm vào project của nó. Ghi lại tên của các project
  // khác trước khi đổi để chắc chắn lần sửa sau không lan sang không gian bên cạnh.
  const otherNames = new Map(
    previewMockStore.getState().projects
      .filter(project => project.workspaceId !== renamed!.id)
      .map(project => [project.id, project.workspaceName]),
  )

  const expectAllSynced = (name: string): void => {
    const { projects } = previewMockStore.getState()
    for (const project of projects.filter(item => siblingIds.includes(item.id))) {
      expect(project.workspaceName, `project “${project.name}”`).toBe(name)
    }
    for (const project of projects.filter(item => otherNames.has(item.id))) {
      expect(project.workspaceName, `project “${project.name}” của không gian khác`).toBe(otherNames.get(project.id))
    }
  }

  previewMockStore.rename('workspace', renamed!.id, 'Đổi tên bằng menu chuột')
  expectAllSynced('Đổi tên bằng menu chuột')

  previewMockStore.updateWorkspace(renamed!.id, { name: 'Đổi tên bằng modal', description: renamed!.description })
  expectAllSynced('Đổi tên bằng modal')

  renderFrame(<ProjectsPreviewView />)
  expect(frameText()).toContain('Đổi tên bằng modal')
})

it('email suy từ tên giữ nguyên chữ Đ — dấu không được để lại lỗ trống trong ASCII', () => {
  // Person fixture không mang field email, nên ô "Tìm người để thêm vào Workspace" in địa chỉ
  // suy từ tên. 'đ' (U+0111) là codepoint nguyên khối: normalize('NFD') không tách được dấu
  // và bước lọc [^a-z]+ phía sau XÓA PHĂNG cả chữ cái, từng in ra 'pham.van.uc@…' và
  // 'ang.ngoc.khoa@…'. Email thiếu chữ cái là dữ liệu sai chứ không phải trình bày sai.
  expect(emailForPerson(people.dung)).toBe('pham.van.duc@acmecorp.com')
  expect(emailForPerson(people.khoi)).toBe('dang.ngoc.khoa@acmecorp.com')
  // Chiều ngược lại cũng phải giữ: dấu thanh vẫn bị bỏ, tên không có chữ ASCII nào vẫn có fallback.
  expect(emailForPerson(people.vy)).toBe('bui.ho.thao.vy@acmecorp.com')
  expect(emailForPerson({ id: 'u-x', name: '🚀', role: 'Member', initials: 'X' })).toBe('thanh-vien@acmecorp.com')
})
