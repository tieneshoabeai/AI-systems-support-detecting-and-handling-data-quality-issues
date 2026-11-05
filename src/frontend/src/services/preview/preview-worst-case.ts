import type { Person, PreviewNotification, Project, Workspace } from '../../types/preview/preview.types'
import { people } from './preview-fixtures'

// Bộ dữ liệu "trường hợp xấu nhất" cho route dev-only /preview/*. KHÔNG import vào app
// thật: preview-mock.service chỉ nạp nhánh này khi import.meta.env.DEV, production build
// loại toàn bộ thư mục preview.
//
// Mỗi giá trị đều CÓ NGUỒN, không phải ký tự ngẫu nhiên:
//   · trần thông số lấy từ chính API contract: name ≤ 100 và description ≤ 500
//     (backend/src/modules/projects/dto/create-project.dto.ts:8, create-workspace.dto.ts:8)
//   · phần còn lại là naming pattern thật trong workspace của một công ty dữ liệu:
//     tên viết tắt một chữ, tên có emoji, tên không dấu cách, tên tiếng Nhật,
//     tên file sinh tự động, số bản ghi chạm mốc làm tròn.
// Các lỗi cố tình RẢI RA NHIỀU DÒNG thay vì dồn hết vào dòng 1 — người dùng nhìn thấy
// vài dòng đầu tiên trước tiên, nên đó mới là chỗ phải hỏng.

/** Đúng trần `max(500)` của API, cắt giữa chữ như khi người dùng gõ đến ký tự cuối. */
const descCap = (seed: string): string =>
  `${seed} Mở rộng phạm vi thêm cột dẫn xuất và ghi chú vận hành nội bộ. `.repeat(12).trimEnd().slice(0, 500)

/** Đúng trần `max(100)` của API. */
const nameCap = (seed: string): string =>
  `${seed} không gian xử lý dữ liệu chất lượng cao liên vùng tích hợp nguồn mở đa viện`.slice(0, 100)

const roster = [people.anh, people.huy, people.ha, people.dung, people.khoi, people.vy]

/** Người một chữ cái / emoji-first: kiểm cách khung sinh initials từ email (preview-data). */
export const worstPeople: Person[] = [
  { id: 'u-q', name: 'Q', role: 'Owner', initials: 'Q' },
  { id: 'u-emoji', name: '🚀 Phát', role: 'Data Engineer', initials: '🚀P' },
  { id: 'u-long', name: 'Bartholomew Fitzgerald Wiśniewska-Kowalczyk', role: 'Data Governance Lead', initials: 'BF' },
  // Được mời bằng email trước khi hoàn tất hồ sơ: tên thật, role RỖNG → dòng dưới tên
  // trong danh sách thành viên là một trường optional chưa ai điền.
  { id: 'u-norole', name: 'Jo Almeida', role: '', initials: 'JA' },
]

export const worstWorkspaces: readonly Workspace[] = [
  {
    // 1: tên chạm trần 100 ký tự → mô tả 500 ký tự → hai dòng dài nhất cùng lúc.
    id: 'w-ws-cap', name: nameCap('Nghiên cứu địa chất'), status: 'active',
    description: descCap('Không gian liên viện, dữ liệu khoan và địa vật lý.'),
    projects: 999, datasets: 999, members: 6, storageGb: 412, favorite: true, cover: 'blue',
    createdAt: '12/03/2024', updatedAt: 'vừa xong',
    owner: people.anh, memberPreview: roster.slice(0, 3),
  },
  {
    // 2: không có dấu cách nào để ngắt dòng + mô tả RỖNG (optional không người điền).
    id: 'w-ws-unbreak', name: 'northwind-industries-holdings-integration-lab', status: 'active',
    description: '',
    projects: 0, datasets: 0, members: 1, storageGb: 0, favorite: false, cover: 'cyan',
    createdAt: '04/04/2024', updatedAt: '2 giờ trước',
    owner: worstPeople[0], memberPreview: [worstPeople[0]],
  },
  {
    // 3+4: hai workspace TRÙNG TÊN — đổi tên trong frame 2D tạo ra được ngay, không cần API.
    id: 'w-ws-dupe-a', name: 'Marketing', status: 'active',
    description: 'Chiến dịch và kênh trả phí.',
    projects: 1, datasets: 1, members: 2, storageGb: 12, favorite: false, cover: 'orange',
    createdAt: '18/04/2024', updatedAt: '1 ngày trước',
    owner: people.huy, memberPreview: roster.slice(1, 3),
  },
  {
    id: 'w-ws-dupe-b', name: 'Marketing', status: 'paused',
    description: 'Đội thứ hai, cùng tên đặt theo khách hàng.',
    projects: 1, datasets: 0, members: 1284, storageGb: 7, favorite: true, cover: 'pink',
    createdAt: '20/04/2024', updatedAt: '2 ngày trước',
    owner: people.vy, memberPreview: roster.slice(0, 4),
  },
  {
    // 5: emoji đứng đầu + tên không latin → thứ tự A→Z và glyph avatars.
    id: 'w-ws-emoji', name: '🚀 Tăng tốc dữ liệu', status: 'active',
    description: 'Tự động hoá pipeline nạp và làm sạch.',
    projects: 2, datasets: 2, members: 3, storageGb: 88, favorite: false, cover: 'violet',
    createdAt: '22/05/2024', updatedAt: '5 giờ trước',
    owner: worstPeople[1], memberPreview: [worstPeople[1], people.dung],
  },
  {
    id: 'w-ws-jp', name: 'データ分析ワークスペース', status: 'archived',
    description: 'Không gian dữ liệu cho đối tác Nhật Bản.',
    projects: 3, datasets: 3, members: 4, storageGb: 1500, favorite: false, cover: 'green',
    createdAt: '09/06/2024', updatedAt: '1 tuần trước',
    owner: worstPeople[2], memberPreview: roster.slice(2, 6),
  },
  {
    // 6: `updatedAt` là NGÀY TUYỆT ĐỐI trong khi mọi dòng khác là tương đối →
    // hàm sắp "gần đây" không nhận diện được và coi nó cũ nhất.
    id: 'w-ws-absdate', name: 'Operations', status: 'active',
    description: 'Vận hành và tồn kho.',
    projects: 0, datasets: 0, members: 2, storageGb: 52, favorite: false, cover: 'cyan',
    createdAt: '11/08/2024', updatedAt: '12/03/2024 14:32',
    owner: people.khoi, memberPreview: roster.slice(0, 2),
  },
]

// `workspaceName` trên project là BẢN COPY của tên workspace (denormalize). Fixture phải
// lấy đúng tên từ workspace, nếu không một dòng TỰ viết tay sẽ tạo ra một lệch tên mà
// người đọc không phân biệt được với lệch do mutation gây ra.
const workspaceNameOf = (id: string): string => worstWorkspaces.find(item => item.id === id)?.name ?? ''

export const worstProjects: readonly Project[] = [
  {
    id: 'w-prj-cap', code: 'PRJ-W001', name: nameCap('Báo cáo chất lượng dữ liệu'), status: 'active',
    description: descCap('Đo lường độ đầy đủ và trùng lặp theo từng nguồn.'),
    workspaceId: 'w-ws-cap', workspaceName: workspaceNameOf('w-ws-cap'), cover: 'violet',
    members: [...roster, worstPeople[3]], createdAt: '12/03/2024 10:30', updatedAt: 'vừa xong', owner: worstPeople[2],
    dataset: {
      id: 'w-ds-long', fileName: 'Q3-report-2026-FINAL-v12-cleaned-11-01T09-14-22Z.parquet',
      format: 'Parquet', rows: 999_500, columns: 1, sizeMb: 12_800,
      importedAt: '12/03/2024 14:32', status: 'failed',
    },
  },
  {
    // 2: project MỘT thành viên và project KHÔNG thành viên nào (wizard cho phép bỏ trống
    // bước Thành viên) → số avatar, dấu "+N" và cụm "Members (n)".
    id: 'w-prj-one', code: 'PRJ-W002', name: 'A', status: 'paused',
    description: 'Dự án thử nghiệm đặt tên một chữ cái.',
    workspaceId: 'w-ws-dupe-a', workspaceName: workspaceNameOf('w-ws-dupe-a'), cover: 'blue',
    members: [people.huy], createdAt: '18/03/2024 09:10', updatedAt: '1 ngày trước', owner: worstPeople[0],
    dataset: {
      id: 'w-ds-one', fileName: 'a.csv', format: 'CSV', rows: 1, columns: 1, sizeMb: 0,
      importedAt: '18/03/2024 09:10', status: 'queued',
    },
  },
  {
    id: 'w-prj-nomembers', code: 'PRJ-W003', name: 'Open Questions', status: 'active',
    description: 'Chưa chọn thành viên, chưa nạp tệp.',
    workspaceId: 'w-ws-dupe-b', workspaceName: workspaceNameOf('w-ws-dupe-b'), cover: 'pink',
    members: [], createdAt: '20/04/2024 08:00', updatedAt: '2 ngày trước', owner: people.vy,
    dataset: null,
  },
  {
    // 3: số bản ghi lọt giữa mốc làm tròn của formatRows (999.500 → "1000K dòng"),
    // dung lượng vượt 1000 MB nhưng không escalation sang GB.
    id: 'w-prj-round', code: 'PRJ-W004', name: 'Churn Pilot', status: 'processing',
    description: 'Mô hình dự báo rời bỏ, chạy thử quý 4.',
    workspaceId: 'w-ws-unbreak', workspaceName: workspaceNameOf('w-ws-unbreak'), cover: 'cyan',
    members: roster.slice(0, 2), createdAt: '02/04/2024 14:05', updatedAt: '6 giờ trước', owner: people.ha,
    dataset: {
      id: 'w-ds-round', fileName: 'churn_pilot_2026_11_v2.csv', format: 'CSV',
      rows: 999_500, columns: 240, sizeMb: 1_024, importedAt: '03/04/2024 09:15', status: 'processing',
    },
  },
  {
    id: 'w-prj-huge', code: 'PRJ-W005', name: 'Telemetry Archive', status: 'completed',
    description: 'Kho dữ liệu telemetry lớn nhất của khách hàng Nhật.',
    workspaceId: 'w-ws-jp', workspaceName: workspaceNameOf('w-ws-jp'), cover: 'green',
    members: roster.slice(1, 5), createdAt: '21/04/2024 08:20', updatedAt: '1 tuần trước', owner: worstPeople[1],
    dataset: {
      id: 'w-ds-huge', fileName: 'telemetry_events.json', format: 'JSON',
      rows: 128_400_000, columns: 512, sizeMb: 98_304, importedAt: '22/04/2024 13:45', status: 'processed',
    },
  },
  {
    id: 'w-prj-emoji', code: 'PRJ-W006', name: '🚀 Growth Lab', status: 'archived',
    description: 'Thử nghiệm tăng trưởng, đã đóng.',
    workspaceId: 'w-ws-emoji', workspaceName: workspaceNameOf('w-ws-emoji'), cover: 'orange',
    members: [worstPeople[1]], createdAt: '06/05/2024 11:15', updatedAt: '2 tuần trước', owner: worstPeople[1],
    dataset: {
      id: 'w-ds-emoji', fileName: '🚀growth.json', format: 'JSON', rows: 1_250_000, columns: 14,
      sizeMb: 46, importedAt: '07/05/2024 16:00', status: 'processed',
    },
  },
  {
    // 7: ngày tuyệt đối ở cả hai cột mốc → cột "Last Updated" trộn hai kiểu định dạng.
    id: 'w-prj-absdate', code: 'PRJ-W007', name: 'Nightly Backfill', status: 'active',
    description: 'Chạy đêm, đồng bộ nguồn mở.',
    workspaceId: 'w-ws-absdate', workspaceName: workspaceNameOf('w-ws-absdate'), cover: 'blue',
    members: [worstPeople[3], ...roster.slice(3, 6)], createdAt: '28/04/2024 09:30', updatedAt: '01/11/2026 03:00',
    owner: people.dung, dataset: null,
  },
]

// 'many': cận trên THỰC TẾ của một tài khoản doanh nghiệp (40 không gian · 200 project).
// Danh sách đã phân trang nên đây không phải bài toán virtualize — nó kiểm hai thứ:
// thanh phân trang vẽ bao nhiêu nút số, và biểu đồ "Projects per Workspace" cắt ở top 5
// có nói rõ phần bị cắt hay không.
const manyWorkspaces = (): Workspace[] => Array.from({ length: 40 }, (_unused, index) => {
  const owner = roster[index % roster.length]
  return {
    id: `m-ws-${index}`, name: `Khu vực dữ liệu ${index + 1}`, status: index % 7 === 0 ? 'archived' : 'active',
    description: `Không gian mẫu thứ ${index + 1} trong bộ dữ liệu lớn.`,
    projects: 5, datasets: 5, members: (index % 9) + 1, storageGb: 20 + index,
    favorite: index % 5 === 0, cover: (['blue', 'violet', 'green', 'pink', 'orange', 'cyan'] as const)[index % 6],
    createdAt: '12/03/2024', updatedAt: `${index + 1} giờ trước`,
    owner, memberPreview: roster.slice(0, (index % 4) + 1),
  }
})

const manyProjects = (): Project[] => manyWorkspaces().flatMap((workspace, index) =>
  Array.from({ length: 5 }, (_unused, slot) => ({
    id: `m-prj-${index}-${slot}`, code: `PRJ-M${index}${slot}`,
    name: `${workspace.name} · luồng ${slot + 1}`, status: slot === 4 ? 'completed' : 'active',
    description: workspace.description,
    workspaceId: workspace.id, workspaceName: workspace.name, cover: workspace.cover,
    members: roster.slice(0, slot + 1), createdAt: workspace.createdAt, updatedAt: workspace.updatedAt,
    owner: workspace.owner,
    dataset: slot === 0 ? null : {
      id: `m-ds-${index}-${slot}`, fileName: `source_${index + 1}_${slot + 1}.csv`, format: 'CSV' as const,
      rows: 10_000 * (index + 1) + slot, columns: 12 + slot, sizeMb: 30 + index,
      importedAt: '12/03/2024 14:32', status: 'processed' as const,
    },
  })),
)

// 'one': một workspace · một project · MỌI số đếm đúng 1 — chỗ nhãn số nhiều và dấu "+N"
// lộ ra. Project đơn phải thuộc về workspace đơn, nếu không tile sẽ ghi "0 projects" ngay
// cạnh bảng liệt kê chính nó: bộ đếm lệch nhau làm mất nghĩa của cả trạng thái này.
const singleWorkspace: Workspace = { ...worstWorkspaces[1], projects: 1 }
export const oneWorkspace: readonly Workspace[] = [singleWorkspace]
export const oneProject: readonly Project[] = [{
  ...worstProjects[1],
  workspaceId: singleWorkspace.id,
  workspaceName: singleWorkspace.name,
  members: [worstPeople[0]],
}]

// Thông báo: tiêu đề và mô tả do MÁY SINH, không có trần độ dài ở bất kỳ đâu (chưa có
// Reports/Notifications API nên cũng không có DTO để đối chiếu) → unbounded, kiểm bằng
// câu dài nhất mà một batch thật có thể in ra, kèm một token không có chỗ ngắt (đường dẫn
// tệp). Hai dòng cuối là hai lỗi hay ship nhất: MỘT từ cho tiêu đề, và mô tả RỖNG.
const noticeContextFor = (projectId: string | null): string => {
  if (projectId === null) return 'DataVerse'
  const name = worstProjects.find(item => item.id === projectId)?.name
  return name ? `Project ${name}` : `Project ⚠ id "${projectId}" không tồn tại trong fixture`
}

export const worstNotifications: readonly PreviewNotification[] = [
  {
    id: 'w-nt-long', tone: 'warn', kind: 'quality',
    title: 'Không áp dụng được 3 quy tắc làm sạch trên Q3-report-2026-FINAL-v12-cleaned-11-01T09-14-22Z.parquet vì kiểu cột đổi sau lần nạp gần nhất',
    context: noticeContextFor('w-prj-cap'), at: 'vừa xong', atFull: '14:30, 20/01/2025',
    unread: true, projectId: 'w-prj-cap',
    description: 'normalize_phone · trim_ws · dedupe_key. Hàng đợi sẽ thử lại sau 15 phút; xem chi tiết ở module Clean Rules để tắt quy tắc đang xung đột với kiểu cột mới của tệp nguồn.',
  },
  {
    // id tham chiếu một project không còn (xóa ở backend / đổi bộ dữ liệu): khung đã có
    // dấu ⚠ trong context, nhưng nút "Mở project" vẫn đi theo id chết.
    id: 'w-nt-dangling', tone: 'info', kind: 'system',
    title: 'Bản xuất đã sẵn sàng cho một project đã bị xóa',
    context: noticeContextFor('prj-sales'), at: '2 giờ trước', atFull: '12:30, 20/01/2025',
    unread: true, projectId: 'prj-sales',
    description: 'Bản ghi thông báo sống lâu hơn project nó mô tả. Đây là trường hợp bắt buộc phải chịu được khi danh sách dữ liệu thay đổi.',
  },
  {
    id: 'w-nt-one', tone: 'ok', kind: 'processing',
    title: 'OK', context: noticeContextFor('w-prj-one'), at: '1 phút trước', atFull: '14:29, 20/01/2025',
    unread: true, projectId: 'w-prj-one',
    description: 'Hoàn tất.',
  },
  {
    // MÔ TẢ RỖNG: màn chi tiết vẽ một hàng "Mô tả chi tiết" với nội dung trống nếu component
    // không bỏ qua trường rỗng.
    id: 'w-nt-nodesc', tone: 'upload', kind: 'import',
    title: 'Đã nạp telemetry_events.json', context: noticeContextFor('w-prj-huge'),
    at: '1 tuần trước', atFull: '09:40, 13/01/2025', unread: false, projectId: 'w-prj-huge',
    description: '',
  },
  {
    id: 'w-nt-cjk', tone: 'info', kind: 'member',
    title: '🚀 Wiśniewska-Kowalczyk thêm データ分析 vào dự án', context: noticeContextFor('w-prj-emoji'),
    at: '3 ngày trước', atFull: '11:12, 17/01/2025', unread: false, projectId: 'w-prj-emoji',
    description: 'Quyền Editor cho hai thành viên mới, áp dụng ngay lần đăng nhập kế tiếp.',
  },
]

// 'many' cũng phải phủ chuông: hộp thư đầy (124 dòng · 120 chưa đọc) kiểm ô đếm ở
// eyebrow và phân trang của màn Thông báo, còn dropdown thì luôn chỉ năm dòng.
const manyNotifications = (projects: readonly Project[]): PreviewNotification[] =>
  Array.from({ length: 120 }, (_unused, index) => {
    const project = projects[index % projects.length]
    return {
      id: `m-nt-${index}`, tone: (['ok', 'warn', 'upload', 'info'] as const)[index % 4],
      kind: (['processing', 'quality', 'import', 'member', 'export', 'system'] as const)[index % 6],
      title: `Luồng xử lý #${index + 1} hoàn tất`, context: `Project ${project.name}`,
      at: `${index + 1} giờ trước`, atFull: `${String(23 - (index % 24)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}, 20/01/2025`,
      unread: true, projectId: project.id,
      description: `Thông báo mẫu thứ ${index + 1} trong bộ dữ liệu lớn, dùng để kiểm phân trang và bộ đếm chưa đọc.`,
    }
  })

export type PreviewFixtureSetId = 'demo' | 'worst' | 'empty' | 'one' | 'many'

export type PreviewFixtureSet = {
  id: PreviewFixtureSetId
  label: string
  workspaces: readonly Workspace[]
  projects: readonly Project[]
  /** Bộ thông báo đi kèm. thiếu → mock store dùng seedNotifications (dữ liệu demo). */
  notifications?: readonly PreviewNotification[]
}

/** Thứ tự này là thứ tự các nút trên segmented control (dev-only). */
export const fixtureSets: readonly PreviewFixtureSet[] = [
  { id: 'demo', label: 'Demo data', workspaces: [], projects: [] },
  { id: 'worst', label: 'Worst case', workspaces: worstWorkspaces, projects: worstProjects, notifications: worstNotifications },
  { id: 'empty', label: 'Empty', workspaces: [], projects: [] },
  { id: 'one', label: 'One', workspaces: oneWorkspace, projects: oneProject },
  { id: 'many', label: '40 ws · 200 project', workspaces: manyWorkspaces(), projects: manyProjects(), notifications: manyNotifications(manyProjects()) },
]

export const isFixtureSetId = (value: string | null): value is PreviewFixtureSetId =>
  fixtureSets.some(set => set.id === value)
