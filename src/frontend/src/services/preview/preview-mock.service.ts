import type {
  CoverHue, NewProjectInput, NewProjectMemberInput, NewReportInput, NewWorkspaceInput, NewWorkspaceMemberInput, NotificationPrefKey, PreviewMutationResult, PreviewReport, PreviewResourceKind,
  PreviewStoreState, ProfileEdit, Project, Workspace, WorkspaceEdit,
} from '../../types/preview/preview.types'
import { people, seedNotifications, seedNotificationPrefs, seedProfile, seedProjects, seedReports, seedSessions, seedWorkspaces } from './preview-fixtures'
import { fixtureSets, isFixtureSetId, type PreviewFixtureSet, type PreviewFixtureSetId } from './preview-worst-case'

// Mock store của batch preview 2D — chỗ duy nhất được phép "ghi" khi chưa có backend.
//
// Vì sao nằm ở tầng service: view không tự sửa mảng dữ liệu. Sau này nối API thật thì
// chính module này đổi setTimeout thành axios call và giữ nguyên chữ ký Promise,
// hook + view không phải sửa. Rule "không giả lập ACK của server" vẫn được tôn trọng:
// message luôn nói rõ kết quả chỉ là dữ liệu mẫu trong bộ nhớ tab.
//
// Hoàn tác chỉ khôi phục nhóm dữ liệu của chính thao tác đó; không ghi đè
// chỉnh sửa mới hơn hoặc phạm vi người dùng đã chuyển sang.

const mutationLatencyMs = 160

const clone = <T>(value: readonly T[]): T[] => value.map(item => ({ ...item }))

/* ---------- Bộ dữ liệu đang nạp (chỉ có ý nghĩa ở route dev-only) ----------
   Batch break-ui cần xem chính các trang này với dữ liệu xấu nhất mà KHÔNG sửa component:
   dữ liệu phải đi vào đúng biên mà dữ liệu demo vẫn vào — fixtures → seedState(). Vì vậy
   bộ bản ghi chọn theo tham số `?data=worst|empty|one|many` đặt trước hash
   (`/?data=worst#/preview/home`), nên link giữ nguyên trạng thái khi tải lại trang.
   Tham số chọn fixture chỉ có hiệu lực ở DEV. Management hiện vẫn dùng dữ liệu mẫu
   và ghi rõ trên UI; production mở các màn này qua guard của ứng dụng. */
const demoBundle: PreviewFixtureSet = {
  ...fixtureSets[0], workspaces: seedWorkspaces, projects: seedProjects, notifications: seedNotifications,
}
const setData = (set: PreviewFixtureSetId): PreviewFixtureSet =>
  set === 'demo' ? demoBundle : fixtureSets.find(item => item.id === set) ?? demoBundle

const readSetFromUrl = (): PreviewFixtureSetId => {
  if (!import.meta.env.DEV) return 'demo'
  const raw = new URLSearchParams(window.location.search).get('data')
  return isFixtureSetId(raw) ? raw : 'demo'
}

let fixtureSet: PreviewFixtureSetId = readSetFromUrl()

const seedState = (): PreviewStoreState => {
  const { workspaces, projects, notifications } = setData(fixtureSet)
  return {
    workspaces: clone(workspaces),
    projects: clone(projects),
    // Thông báo đi theo cùng bộ với project nó tham chiếu: giữ nguyên seedNotifications khi
    // nạp 'worst' nghĩa là hộp thư liệt kê những project không còn tồn tại ở bộ đó.
    notifications: clone(notifications ?? seedNotifications),
    reports: clone(seedReports),
    profile: { ...seedProfile },
    sessions: clone(seedSessions),
    notificationPrefs: { ...seedNotificationPrefs },
    // Bộ 'empty' không có bản ghi nào: selection phải chịu được mảng rỗng, nếu
    // `workspaces[0].id` sẽ throw ngay lần vẽ đầu và trang sập vì một Cờ dev.
    selection: { workspaceId: workspaces[0]?.id ?? '', projectId: projects.find(item => item.workspaceId === workspaces[0]?.id)?.id ?? '' },
  }
}

let state: PreviewStoreState = seedState()
const listeners = new Set<() => void>()

const setState = (next: PreviewStoreState): void => {
  state = next
  listeners.forEach(listener => listener())
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getState = (): PreviewStoreState => state

const delay = <T>(result: T): Promise<T> =>
  new Promise(resolve => { window.setTimeout(() => resolve(result), mutationLatencyMs) })

// Mọi mutation cùng khuôn: áp dụng ngay (optimistic) để phản hồi tức thì, rồi mới
// "chờ" — người dùng thấy kết quả ở lần click, không phải sau một vòng chờ giả.
const commit = (mutate: (current: PreviewStoreState) => PreviewStoreState, message: string): Promise<PreviewMutationResult> => {
  const previous = state
  const next = mutate(state)
  const changed = (Object.keys(next) as (keyof PreviewStoreState)[])
    .filter(key => key !== 'selection' && next[key] !== previous[key])
  setState(next)
  let undone = false
  return delay({ message, undo: () => {
    if (undone) return
    if (changed.some(key => state[key] !== next[key])) {
      throw new Error('Dữ liệu liên quan đã thay đổi. Hãy hoàn tác thao tác mới hơn trước.')
    }
    const restored = { ...state }
    for (const key of changed) Object.assign(restored, { [key]: previous[key] })
    if (state.selection === next.selection) restored.selection = previous.selection
    // Không giữ lựa chọn trỏ đến bản ghi vừa bị hoàn tác việc tạo.
    const workspaceId = restored.workspaces.some(item => item.id === restored.selection.workspaceId)
      ? restored.selection.workspaceId : ''
    const project = restored.projects.find(item => item.id === restored.selection.projectId
      && (!workspaceId || item.workspaceId === workspaceId))
    restored.selection = { workspaceId, projectId: project?.id ?? '' }
    undone = true
    setState(restored)
  } })
}

const patchWorkspace = (workspace: Workspace, patch: Partial<Workspace>): Workspace => ({ ...workspace, ...patch })
const patchProject = (project: Project, patch: Partial<Project>): Project => ({ ...project, ...patch })

// Project giữ một bản sao tên workspace (workspaceName) để bảng Projects vẽ được mà
// không phải join. Bản sao đó phải đổi theo khi workspace đổi tên, nếu không cùng một
// màn hình hiện hai tên khác nhau — lỗi dữ liệu, không phải lỗi trình bày.
const renameInProjects = (projects: Project[], workspaceId: string, name: string): Project[] =>
  projects.map(project => project.workspaceId === workspaceId ? patchProject(project, { workspaceName: name }) : project)

const renameWorkspace = (current: PreviewStoreState, id: string, name: string): PreviewStoreState => ({
  ...current,
  workspaces: current.workspaces.map(item => item.id === id ? patchWorkspace(item, { name, updatedAt: 'vừa xong' }) : item),
  projects: renameInProjects(current.projects, id, name),
})

const renameProject = (current: PreviewStoreState, id: string, name: string): PreviewStoreState => ({
  ...current,
  projects: current.projects.map(item => item.id === id ? patchProject(item, { name, updatedAt: 'vừa xong' }) : item),
})

const removeWorkspace = (current: PreviewStoreState, id: string): PreviewStoreState => {
  const workspaces = current.workspaces.filter(item => item.id !== id)
  // Xóa workspace kéo theo project của nó (ranh giới truy cập là workspace). Snapshot
  // undo khôi phục cả hai mảng nên không cần ghi lại quan hệ thủ công.
  const projects = current.projects.filter(item => item.workspaceId !== id)
  const selection = id === current.selection.workspaceId
    ? { workspaceId: workspaces[0]?.id ?? '', projectId: projects.find(item => item.workspaceId === workspaces[0]?.id)?.id ?? '' }
    : current.selection
  return { ...current, workspaces, projects, selection }
}

const removeProject = (current: PreviewStoreState, id: string): PreviewStoreState => {
  const projects = current.projects.filter(item => item.id !== id)
  const selection = id === current.selection.projectId
    ? { ...current.selection, projectId: projects.find(item => !current.selection.workspaceId || item.workspaceId === current.selection.workspaceId)?.id ?? '' }
    : current.selection
  return { ...current, projects, selection }
}

// Hai mutation của màn Thông báo nhận MỘT danh sách id, không nhận một id: nút "Đánh dấu
// đã đọc" ở màn chi tiết, ở dropdown chuông và thanh chọn hàng loạt ở màn danh sách đều
// gọi cùng một hàm — một hành vi một lối vào, khỏi ba bộ logic lệch nhau.
const markRead = (ids: readonly string[]): Promise<PreviewMutationResult> => {
  const wanted = new Set(ids)
  const changed = state.notifications.filter(item => wanted.has(item.id) && item.unread).length
  return commit(
    current => ({
      ...current,
      notifications: current.notifications.map(item => wanted.has(item.id) ? { ...item, unread: false } : item),
    }),
    changed > 0
      ? `Đã đánh dấu ${changed} thông báo là đã đọc`
      : `${ids.length} thông báo đã ở trạng thái đã đọc từ trước.`,
  )
}

const removeMany = (ids: readonly string[]): Promise<PreviewMutationResult> => {
  const wanted = new Set(ids)
  const removed = state.notifications.filter(item => wanted.has(item.id)).length
  return commit(
    current => ({ ...current, notifications: current.notifications.filter(item => !wanted.has(item.id)) }),
    removed > 0 ? `Đã xóa ${removed} thông báo khỏi danh sách mẫu` : 'Không có thông báo nào trùng để xóa.',
  )
}

// Mã công khai kiểu DV-250120-0NN. Bộ đếm bắt đầu sau các bản ghi mẫu để không trùng mã
// đã vẽ trong Design Board; "now" của dữ liệu mẫu là 14:30 20/01/2025 nên mã mới mang
// cùng mốc ngày. createdAt là mốc tuyệt đối (đồng bộ cột "Thời gian tạo" 3.3), còn
// updatedAt là 'vừa xong' (đồng bộ cột "Cập nhật" tương đối — xem ghi chú fixture).
let reportSeq = 100
const nextReportCode = (): string => `DV-250120-${String(++reportSeq).padStart(3, '0')}`

const createReport = (input: NewReportInput): Promise<PreviewMutationResult> => {
  const report: PreviewReport = {
    id: `rp-${Date.now()}`,
    code: nextReportCode(),
    issueType: input.issueType,
    title: input.title.trim(),
    description: input.description.trim(),
    attachment: input.attachment,
    status: 'processing',
    createdAt: '14:30, 20/01/2025',
    updatedAt: 'vừa xong',
  }
  return commit(
    current => ({ ...current, reports: [report, ...current.reports] }),
    `Đã gửi báo cáo “${report.title}” (mã ${report.code}). Cảm ơn bạn đã báo cáo!`,
  )
}

// Project luôn mang theo MỘT tập dữ liệu ngay khi tạo (chủ batch 03/11: "mỗi project phải gắn
// liền với 1 dataset ngay từ đầu"), nên wizard đọc tệp thật bằng parseLocalCsv rồi đưa số đo
// thật qua `input.dataset`; service chỉ đóng gói thành DatasetSummary. `status` là 'queued' vì
// frame này không xử lý tệp — nói 'processed' sẽ là bịa một kết quả chưa xảy ra.
let projectSeq = 100
const coverBySeed: readonly CoverHue[] = ['blue', 'violet', 'green', 'pink', 'orange', 'cyan']

// Mốc 'dd/mm/yyyy HH:mm' khớp kiểu `importedAt` của fixtures.
const nowStamp = (): string => {
  const now = new Date()
  return `${todayLabel()} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`
}

const createProject = (input: NewProjectInput): Promise<PreviewMutationResult> => {
  const workspace = state.workspaces.find(item => item.id === input.workspaceId)
  if (!workspace) return Promise.reject(new Error('Workspace không còn tồn tại. Hãy chọn Workspace khác.'))
  const workspaceMembers = new Set([workspace.owner.id, ...workspace.memberPreview.map(person => person.id)])
  if (input.members.some(person => !workspaceMembers.has(person.id))) {
    return Promise.reject(new Error('Chỉ thành viên của Workspace mới được thêm vào Project.'))
  }
  const name = input.name.trim()
  const seed = [...name].reduce((total, char) => total + char.charCodeAt(0), 0)
  const id = `prj-${++projectSeq}`
  // Dataset dựng TRƯỚC rồi mới ghép vào project: wizard bắt buộc một tệp ngay khi tạo nên bản ghi
  // này không bao giờ null. Đọc tên tệp qua biến riêng thay vì qua `project.dataset` vì field đó
  // vẫn mang kiểu `| null` (fixture có project đời cũ chưa có dataset) — đọc xuyên object là một
  // lỗi biên dịch đúng chứ không phải một cảnh báo thừa.
  const dataset = {
    id: `ds-${projectSeq}`,
    fileName: input.dataset.fileName,
    format: input.dataset.format,
    rows: input.dataset.rows,
    columns: input.dataset.columns,
    sizeMb: input.dataset.sizeMb,
    importedAt: nowStamp(),
    status: 'queued' as const,
  }
  const project: Project = {
    id,
    code: `PRJ-${String(projectSeq).padStart(3, '0')}`,
    name,
    description: input.description.trim(),
    status: 'active',
    workspaceId: input.workspaceId,
    workspaceName: workspace.name,
    cover: coverBySeed[seed % coverBySeed.length],
    dataset,
    members: input.members,
    createdAt: 'hôm nay',
    updatedAt: 'vừa xong',
    owner: people.anh,
  }
  return commit(
    current => ({ ...current, projects: [project, ...current.projects] }),
    `Đã tạo project “${project.name}” trong ${project.workspaceName} kèm ${dataset.fileName}`,
  )
}

// Khung 2 "Tạo Workspace": bản ghi mới vào ĐẦU danh sách, optimistic + Hoàn tác như mọi
// mutation khác. Chủ sở hữu là người dùng hiện tại (people.anh) nên thẻ mới xuất hiện ngay
// trong lọc "Workspace sở hữu" và cộng vào stat "Sở hữu" — không phải một thẻ chết.
const maxMemberPreview = 6
// id đếm tăng dần thay vì Date.now(): hai workspace tạo trong cùng một millisecond (bấm nhanh,
// hoặc script test chạy self) sẽ TRÙNG id — mà id là khóa của selection · Hoàn tác · key danh
// sách, nên trùng là thao tác tác động lên nhầm bản ghi.
let workspaceSeq = 0
const pad2 = (value: number): string => String(value).padStart(2, '0')
// `createdAt` là mốc TUYỆT ĐỐI 'dd/mm/yyyy' đúng kiểu fixture, vì ô "Tạo gần nhất" parse
// ngày từ chuỗi đó. 'hôm nay' sẽ không thắng nổi các workspace 2024 khi so ngày.
const todayLabel = (): string => {
  const now = new Date()
  return `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`
}

const createWorkspace = (input: NewWorkspaceInput): Promise<PreviewMutationResult> => {
  const name = input.name.trim()
  const seed = [...name].reduce((total, char) => total + char.charCodeAt(0), 0)
  // Chủ sở hữu không đồng thời là "thành viên ban đầu": roster suy từ memberPreview + owner
  // (xem workspaceMemberRows), nên để trùng là một người xuất hiện hai dòng.
  const members = input.members.filter(person => person.id !== people.anh.id)
  const workspace: Workspace = {
    id: `ws-new-${++workspaceSeq}`,
    name,
    description: input.description.trim(),
    status: 'active',
    // 0 là THẬT: workspace vừa tạo chưa chứa project/dataset nào. Thẻ và stat đếm từ danh
    // sách project chứ không đọc hai trường viết tay này.
    projects: 0, datasets: 0,
    members: members.length + 1,
    storageGb: 0,
    favorite: false,
    cover: coverBySeed[seed % coverBySeed.length],
    createdAt: todayLabel(),
    updatedAt: 'vừa xong',
    accessedAt: 'vừa xong',
    owner: people.anh,
    // Ảnh chỉ vẽ vài avatar trong stack; phần dư thẻ hiển thị "+N" nên cắt ở 6 là đủ.
    memberPreview: members.slice(0, maxMemberPreview),
  }
  return commit(
    current => ({ ...current, workspaces: [workspace, ...current.workspaces] }),
    `Đã tạo workspace “${workspace.name}” với ${workspace.members} thành viên (gồm chủ sở hữu)`,
  )
}

export const previewMockStore = {
  subscribe,
  getState,

  /** Đổi phạm vi làm việc (combobox Không gian ở topbar). Project chọn theo workspace. */
  selectWorkspace(workspaceId: string): void {
    if (workspaceId && !state.workspaces.some(item => item.id === workspaceId)) return
    const project = state.projects.find(item => item.workspaceId === workspaceId) ?? null
    setState({ ...state, selection: { workspaceId, projectId: project?.id ?? '' } })
  },

  selectProject(projectId: string): void {
    const project = state.projects.find(item => item.id === projectId) ?? null
    if (!project) return
    setState({ ...state, selection: { workspaceId: project.workspaceId, projectId } })
  },

  /** Bỏ chọn project nhưng giữ nguyên workspace: đóng "thanh chi tiết kế bên" trên Home,
      đồng thời là phạm vi "Tất cả dự án" của combobox Dự án trên topbar. */
  clearProject(): void {
    if (!state.selection.projectId) return
    setState({ ...state, selection: { ...state.selection, projectId: '' } })
  },

  toggleFavorite(workspaceId: string): Promise<PreviewMutationResult> {
    const target = state.workspaces.find(item => item.id === workspaceId)
    const next = !target?.favorite
    return commit(current => ({
      ...current,
      workspaces: current.workspaces.map(item => item.id === workspaceId ? patchWorkspace(item, { favorite: next }) : item),
    }), next ? `Đã thêm ${target?.name ?? 'workspace'} vào yêu thích` : `Đã bỏ yêu thích ${target?.name ?? 'workspace'}`)
  },

  rename(kind: PreviewResourceKind, id: string, name: string): Promise<PreviewMutationResult> {
    const trimmed = name.trim()
    const current = kind === 'workspace' ? renameWorkspace(state, id, trimmed) : renameProject(state, id, trimmed)
    return commit(() => current, `Đổi tên thành “${trimmed}”`)
  },

  /** "Lưu thay đổi" ở modal Thông tin Workspace. Gộp tên + mô tả vào MỘT mutation để Hoàn tác
   *  trả lại cả hai cùng lúc (snapshot), thay vì hai lần undo rời nhau. */
  updateWorkspace(id: string, edit: WorkspaceEdit): Promise<PreviewMutationResult> {
    const name = edit.name.trim()
    const target = state.workspaces.find(item => item.id === id)
    return commit(
      current => ({
        ...current,
        workspaces: current.workspaces.map(item => item.id === id
          ? patchWorkspace(item, { name, description: edit.description.trim(), updatedAt: 'vừa xong' })
          : item),
        projects: renameInProjects(current.projects, id, name),
      }),
      `Đã cập nhật thông tin “${name || (target?.name ?? 'workspace')}”`,
    )
  },

  /** "Thêm thành viên" trong modal Quản lý thành viên (ảnh "Neon Workspace Management Panels").
   *  Roster của workspace = chủ sở hữu + `memberPreview`, nên người mới phải vào đủ ba chỗ cùng
   *  lúc: `memberPreview` (dòng trong bảng + avatar trên thẻ), `members` (con số đếm) và
   *  `memberRoles` — vai trò ghi rõ Member, nếu không một workspace đang có đúng một thành viên
   *  preview sẽ phát vị trí thứ hai của cycle và người vừa được mời làm Member mang badge Admin. */
  addWorkspaceMember(input: NewWorkspaceMemberInput): Promise<PreviewMutationResult> {
    const target = state.workspaces.find(item => item.id === input.workspaceId)
    if (!target) return Promise.reject(new Error('workspace không tồn tại'))
    const already = target.owner.id === input.person.id
      || target.memberPreview.some(item => item.id === input.person.id)
    if (already) return Promise.reject(new Error(`${input.person.name} đã là thành viên của ${target.name}`))
    return commit(current => ({
      ...current,
      workspaces: current.workspaces.map(item => item.id === input.workspaceId
        ? patchWorkspace(item, {
          memberPreview: [...item.memberPreview, input.person],
          members: item.members + 1,
          memberRoles: { ...item.memberRoles, [input.person.id]: 'Member' },
          updatedAt: 'vừa xong',
        })
        : item),
    }), `Đã thêm ${input.person.name} vào ${target.name}`)
  },

  /** ⋯ của MỘT DÒNG trong modal Quản lý thành viên workspace: đổi vai trò hoặc gỡ người đó.
   *  Chủ sở hữu KHÔNG đi qua đây — view giữ một dấu "—" ở dòng của họ, vì gỡ owner thì bản ghi
   *  không còn ai quản lý (business rule của workspace, không phải giới hạn giao diện). */
  setWorkspaceMemberRole(workspaceId: string, personId: string, role: string): Promise<PreviewMutationResult> {
    const target = state.workspaces.find(item => item.id === workspaceId)
    if (target?.owner.id === personId) return Promise.reject(new Error('Không thể đổi vai trò của chủ sở hữu Workspace.'))
    const person = target?.memberPreview.find(item => item.id === personId)
    if (!target || !person) return Promise.reject(new Error('thành viên không còn trong Workspace này'))
    return commit(current => ({
      ...current,
      workspaces: current.workspaces.map(item => item.id === workspaceId
        ? patchWorkspace(item, { memberRoles: { ...item.memberRoles, [personId]: role }, updatedAt: 'vừa xong' })
        : item),
    }), `Đã đổi ${person.name} sang vai trò ${role} trong ${target.name}`)
  },

  removeWorkspaceMember(workspaceId: string, personId: string): Promise<PreviewMutationResult> {
    const target = state.workspaces.find(item => item.id === workspaceId)
    if (target?.owner.id === personId) return Promise.reject(new Error('Không thể gỡ chủ sở hữu Workspace.'))
    if (state.projects.some(project => project.workspaceId === workspaceId && project.owner.id === personId)) {
      return Promise.reject(new Error('Không thể gỡ thành viên đang sở hữu Project trong Workspace.'))
    }
    const person = target?.memberPreview.find(item => item.id === personId)
    if (!target || !person) return Promise.reject(new Error('thành viên không còn trong Workspace này'))
    const roles = { ...target.memberRoles }
    delete roles[personId]
    return commit(current => ({
      ...current,
      workspaces: current.workspaces.map(item => item.id === workspaceId
        ? patchWorkspace(item, {
          memberPreview: item.memberPreview.filter(member => member.id !== personId),
          members: Math.max(1, item.members - 1),
          memberRoles: roles,
          updatedAt: 'vừa xong',
        })
        : item),
      projects: current.projects.map(project => project.workspaceId === workspaceId
        && project.members.some(member => member.id === personId)
        ? patchProject(project, { members: project.members.filter(member => member.id !== personId), updatedAt: 'vừa xong' })
        : project),
    }), `Đã gỡ ${person.name} khỏi ${target.name} và các Project thuộc Workspace`)
  },

  /* ---------- Thành viên của PROJECT (⋯ của thẻ dataset → "Quản lý thành viên") ----------
     Project giữ roster thẳng trong `members: Person[]`, vai trò nằm ngay trong `Person.role`
     nên không cần bảng phụ. Nguồn người chọn LUÔN là roster của chính workspace (view chặn),
     đúng ràng buộc nghiệp vụ: chỉ thành viên của workspace mới được chủ sở hữu chọn vào project. */

  addProjectMember({ projectId, person, role }: NewProjectMemberInput): Promise<PreviewMutationResult> {
    const target = state.projects.find(item => item.id === projectId)
    if (!target) return Promise.reject(new Error('project không tồn tại'))
    const workspace = state.workspaces.find(item => item.id === target.workspaceId)
    if (!workspace || (workspace.owner.id !== person.id && !workspace.memberPreview.some(member => member.id === person.id))) {
      return Promise.reject(new Error('Chỉ thành viên của Workspace mới được thêm vào Project.'))
    }
    if (target.owner.id === person.id) return Promise.reject(new Error('Chủ sở hữu luôn thuộc project'))
    if (target.members.some(member => member.id === person.id))
      return Promise.reject(new Error(`${person.name} đã là thành viên của ${target.name}`))
    return commit(current => ({
      ...current,
      projects: current.projects.map(item => item.id === projectId
        ? patchProject(item, { members: [...item.members, { ...person, role }], updatedAt: 'vừa xong' })
        : item),
    }), `Đã thêm ${person.name} vào ${target.name}`)
  },

  setProjectMemberRole(projectId: string, personId: string, role: string): Promise<PreviewMutationResult> {
    const target = state.projects.find(item => item.id === projectId)
    if (target?.owner.id === personId) return Promise.reject(new Error('Không thể đổi vai trò của chủ sở hữu Project.'))
    const person = target?.members.find(item => item.id === personId)
    if (!target || !person) return Promise.reject(new Error('thành viên không còn trong project này'))
    return commit(current => ({
      ...current,
      projects: current.projects.map(item => item.id === projectId
        ? patchProject(item, {
          members: item.members.map(member => member.id === personId ? { ...member, role } : member),
          updatedAt: 'vừa xong',
        })
        : item),
    }), `Đã đổi ${person.name} sang vai trò ${role} trong ${target.name}`)
  },

  removeProjectMember(projectId: string, personId: string): Promise<PreviewMutationResult> {
    const target = state.projects.find(item => item.id === projectId)
    if (target?.owner.id === personId) return Promise.reject(new Error('Không thể gỡ chủ sở hữu Project.'))
    const person = target?.members.find(item => item.id === personId)
    if (!target || !person) return Promise.reject(new Error('thành viên không còn trong project này'))
    return commit(current => ({
      ...current,
      projects: current.projects.map(item => item.id === projectId
        ? patchProject(item, { members: item.members.filter(member => member.id !== personId), updatedAt: 'vừa xong' })
        : item),
    }), `Đã gỡ ${person.name} khỏi ${target.name}`)
  },

  remove(kind: PreviewResourceKind, id: string): Promise<PreviewMutationResult> {
    const target = kind === 'workspace'
      ? state.workspaces.find(item => item.id === id)
      : state.projects.find(item => item.id === id)
    const next = kind === 'workspace' ? removeWorkspace(state, id) : removeProject(state, id)
    return commit(() => next, `Đã xóa ${target?.name ?? 'bản ghi'} khỏi danh sách mẫu`)
  },

  /** Đường đọc duy nhất: một id hay nhiều id cùng đi qua hàm này, nên nút ở màn chi tiết,
   *  nút ở thanh chọn hàng loạt và "Đánh dấu tất cả" không thành ba bộ hành vi lệch nhau.
   *  Mở một thông báo KHÔNG tự đánh dấu đã đọc — Design Board 1.3 đặt nút "Đánh dấu đã đọc"
   *  ngay trong màn chi tiết, nghĩa là vào đến nơi bản ghi vẫn phải còn ở trạng thái chưa đọc. */
  markNotificationsRead: markRead,

  removeNotifications: removeMany,

  /** Nút "Gửi báo cáo" trong ô "?" — thêm bản ghi vào đầu danh sách mẫu, có Hoàn tác. */
  createReport,

  /** Nút "Tạo Project" ở cuối wizard — thêm project (kèm tập dữ liệu vừa nạp) vào đầu danh sách
   *  mẫu, có Hoàn tác. */
  createProject,

  /** Nút "Tạo Workspace" ở đầu trang Workspaces (khung 2 của ảnh) — có Hoàn tác. */
  createWorkspace,

  /** Mốc "Truy cập gần nhất" (ô sắp xếp đầu tiên trong ảnh) phải là số THẬT, nên ghi lại
   *  lúc mở workspace. Đây là thao tác ĐỌC chứ không phải ghi dữ liệu của người dùng: đi
   *  thẳng setState, không toast và không Hoàn tác (hoàn tác một lần xem thì vô nghĩa). */
  touchWorkspace(id: string): void {
    const target = state.workspaces.find(item => item.id === id)
    if (!target || target.accessedAt === 'vừa xong') return
    setState({
      ...state,
      workspaces: state.workspaces.map(item => item.id === id ? patchWorkspace(item, { accessedAt: 'vừa xong' }) : item),
    })
  },

  /* ---------- Tài khoản & Cài đặt cá nhân (Design Board nhóm 04) ---------- */

  /** "Lưu thay đổi" ở màn Hồ sơ (4.2). Chỉ bốn trường editable đi qua đây (email/role khóa),
   *  tên bị bỏ khoảng trắng ở view trước khi gọi. Snapshot undo trả lại nguyên hồ sơ cũ. */
  updateProfile(edit: ProfileEdit): Promise<PreviewMutationResult> {
    return commit(
      current => ({ ...current, profile: { ...current.profile, ...edit } }),
      'Đã lưu thay đổi hồ sơ',
    )
  },

  /** "⋮ → Đăng xuất phiên này" (4.4). Gỡ đúng một phiên khỏi danh sách mẫu, có Hoàn tác. */
  revokeSession(id: string): Promise<PreviewMutationResult> {
    const target = state.sessions.find(item => item.id === id)
    const removed = state.sessions.filter(item => item.id === id).length
    return commit(
      current => ({ ...current, sessions: current.sessions.filter(item => item.id !== id) }),
      removed > 0 ? `Đã đăng xuất phiên trên ${target?.platform ?? 'thiết bị'} · ${target?.browser ?? ''}` : 'Phiên này không còn trong danh sách.',
    )
  },

  /** Nút "Đăng xuất tất cả các phiên khác" ở góc trên màn 4.4. Giữ lại phiên HIỆN TẠI (đăng xuất
   *  chính máy đang xem là tự cắt quyền xem preview), gỡ mọi phiên khác. Có Hoàn tác. */
  revokeOtherSessions(): Promise<PreviewMutationResult> {
    const others = state.sessions.filter(item => !item.current).length
    return commit(
      current => ({ ...current, sessions: current.sessions.filter(item => item.current) }),
      others > 0 ? `Đã đăng xuất ${others} phiên khác (giữ phiên hiện tại)` : 'Không còn phiên nào khác để đăng xuất.',
    )
  },

  /** Một công tắc trong "Tùy chọn thông báo" (4.5). value là trạng thái MỚI sau khi gạt. */
  setNotificationPref(key: NotificationPrefKey, value: boolean): Promise<PreviewMutationResult> {
    return commit(
      current => ({ ...current, notificationPrefs: { ...current.notificationPrefs, [key]: value } }),
      `Đã ${value ? 'bật' : 'tắt'} tùy chọn thông báo`,
    )
  },

  markAllNotificationsRead(): Promise<PreviewMutationResult> {
    return markRead(state.notifications.filter(item => item.unread).map(item => item.id))
  },

  /** Khôi phục dữ liệu mẫu về fixtures ban đầu — test dùng để reset store; trên UI thì bằng tải lại trang.
   *  `set` (dev-only) đổi LUÔN bộ bản ghi đang nạp, nên segmented control chỉ cần gọi đây. */
  reset(set?: PreviewFixtureSetId): PreviewMutationResult {
    const previous = state
    if (set) fixtureSet = set
    setState(seedState())
    return { message: 'Đã khôi phục dữ liệu mẫu ban đầu', undo: () => setState(previous) }
  },

  /** Bộ bản ghi đang nạp, cho segmented control biết nút nào đang được chọn. */
  getFixtureSet(): PreviewFixtureSetId {
    return fixtureSet
  },
}
