import type { CurrentUser, DeviceSession, NotificationPrefs, Person, PreviewNotification, PreviewReport, ProfileInfo, Project, StorageUsage, Workspace } from '../../types/preview/preview.types'

// Nguồn dữ liệu mẫu của batch preview 2D. Đặt ở tầng service để mock store
// (preview-mock.service.ts) và các view cùng đọc một bản, đúng luồng
// View → Hook → Service: view không tự sở hữu bản ghi, sau này chỉ cần thay
// nhánh "đọc mảng cứng" bằng axios mà không đụng vào JSX.
// File này chỉ được route dev-only /preview/* nạp (main.tsx chặn bằng import.meta.env.DEV).

export const people: Record<string, Person> = {
  anh: { id: 'u-anh', name: 'Nguyễn Minh Anh', role: 'Quản trị viên', initials: 'MA' },
  huy: { id: 'u-huy', name: 'Trần Quang Huy', role: 'Data Analyst', initials: 'QH' },
  ha: { id: 'u-ha', name: 'Lê Thu Hà', role: 'Data Engineer', initials: 'TH' },
  dung: { id: 'u-dung', name: 'Phạm Văn Đức', role: 'Data Analyst', initials: 'PD' },
  khoi: { id: 'u-khoi', name: 'Đặng Ngọc Khoa', role: 'Viewer', initials: 'NK' },
  vy: { id: 'u-vy', name: 'Bùi Hồ Thảo Vy', role: 'Editor', initials: 'TV' },
}

const team = [people.anh, people.huy, people.ha, people.dung, people.khoi, people.vy]

export const currentUser: CurrentUser = { name: people.anh.name, role: people.anh.role, initials: people.anh.initials }

export const storageUsage: StorageUsage = { usedLabel: '1.24 TB', totalLabel: '3 TB', percent: 42 }

// Khung "Workspace gần đây" trên Home chứa 24 NÚT một trang nhưng chỉ HÉ 12 (lướt ngay trong
// khung, chủ sở hữu batch duyệt). Với đúng 12 workspace thì khung đầy vừa khít: không có gì để
// lướt, và `pageCount` = 1 nên Pager cũng không vẽ nút lật — hai tính năng đó không tồn tại được
// nếu dữ liệu mẫu ít hơn chính kích thước một trang. Bộ demo phải có hơn 24 không gian.
//
// 16 bản ghi nối đuôi này CŨ HƠN toàn bộ 12 bản ghi phía trên (`updatedAt` ≥ 3 tháng trước, xem
// `ageOf` trong preview-data.ts) nên 12 tên quen thuộc luôn nằm trang 1 và thứ tự "gần đây" của
// chúng không đổi; `favorite: false` để tab 'Yêu thích (3)' giữ nguyên; tên và mô tả không chứa
// 'finance'/'research' để các test tìm kiếm khớp đúng một dòng không thành khớp hai.
// `projects: 0` / `datasets: 0` là THẬT: không có bản ghi mẫu nào trỏ vào các workspace này. View
// suy số từ danh sách project chứ không đọc trường viết tay, nên ở đây phải là số thật để một
// người đọc fixture sau này không bị dẫn dắt sai.
const olderWorkspaceSeeds: readonly { name: string; description: string }[] = [
  { name: 'Kinh doanh miền Bắc', description: 'Doanh số và kênh phân phối các tỉnh phía Bắc.' },
  { name: 'Kinh doanh miền Trung', description: 'Theo dõi đơn hàng và đại lý khu vực miền Trung.' },
  { name: 'Kinh doanh miền Nam', description: 'Thị trường phía Nam, gồm kênh đại lý và bán lẻ.' },
  { name: 'Chuỗi bán lẻ', description: 'Dữ liệu cửa hàng, tồn kho và doanh thu theo ngày.' },
  { name: 'Ngân hàng số', description: 'Giao dịch, thẻ và hạn mức tín dụng của khách hàng.' },
  { name: 'Bảo hiểm nhân thọ', description: 'Hợp đồng, quyền lợi và lịch sử bồi thường.' },
  { name: 'Y tế & Sức khỏe', description: 'Hồ sơ khám chữa bệnh và chi phí điều trị.' },
  { name: 'Giáo dục trực tuyến', description: 'Hành vi học tập và tỷ lệ hoàn thành khóa học.' },
  { name: 'Truyền thông & Nội dung', description: 'Lượt xem, tương tác và hiệu suất bài viết.' },
  { name: 'Nông nghiệp & Thời tiết', description: 'Mùa vụ, thời tiết và sản lượng theo vùng.' },
  { name: 'Logistics & Kho vận', description: 'Lệnh vận chuyển, thời gian giao và chi phí.' },
  { name: 'An toàn thông tin', description: 'Nhật ký bảo mật và cảnh báo sự kiện hệ thống.' },
  { name: 'Đối tác chiến lược', description: 'Dữ liệu chia sẻ theo từng thỏa thuận hợp tác.' },
  { name: 'Trung tâm Điều hành', description: 'Báo cáo tổng hợp cho ban điều hành hằng tuần.' },
  { name: 'Thử nghiệm Mô hình', description: 'Các mô hình đang thử, chưa đưa vào vận hành.' },
  { name: 'Lưu trữ Lạnh', description: 'Dữ liệu lịch sử lưu dài hạn, ít truy cập.' },
  // 12 bản ghi nối thêm: TRANG WORKSPACES cần quá 28 (trần một trang theo yêu cầu chủ batch)
  // nên 28 cũ cho ra đúng MỘT trang — tức là không có nút lật nào để nhìn thấy, chính là triệu
  // chứng "chưa có chuyển trang" mà chủ batch báo. 40 bản ghi → trang 1 đủ 28, trang 2 lẻ 12.
  // Home vẫn đúng hai trang (24 một trang) nên không test nào của Home phải sửa vì số này.
  { name: 'Bán lẻ Đa kênh', description: 'Doanh thu và khách hàng tại các điểm bán.' },
  { name: 'Tín dụng Tiêu dùng', description: 'Dư nợ, nhóm nợ và tỷ lệ quá hạn.' },
  { name: 'Thanh toán Số', description: 'Giao dịch ví điện tử và mã QR.' },
  { name: 'Viễn thông', description: 'Lưu lượng dữ liệu và churn thuê bao.' },
  { name: 'Bảo hiểm Phi nhân thọ', description: 'Bồi thường và rủi ro tài sản.' },
  { name: 'Bất động sản', description: 'Giao dịch, giá và tỷ lệ hấp thụ.' },
  { name: 'Sản xuất Thông minh', description: 'Năng suất dây chuyền và tỷ lệ lỗi.' },
  { name: 'Năng lượng', description: 'Phụ tải, sản lượng và tổn thất điện.' },
  { name: 'Du lịch & Lưu trú', description: 'Đặt phòng, công suất và doanh thu kỳ nghỉ.' },
  { name: 'Ăn uống & F&B', description: 'Doanh thu món, chi nhánh và nguyên liệu.' },
  { name: 'Dược phẩm', description: 'Chuỗi cung thuốc và tồn kho nhà thuốc.' },
  { name: 'Đào tạo Nghề nghiệp', description: 'Học viên, khóa học và tỷ lệ hoàn thành.' },
]

const olderCovers: readonly Workspace['cover'][] = ['blue', 'violet', 'green', 'pink', 'orange', 'cyan']
const olderStatuses: readonly Workspace['status'][] = ['active', 'paused', 'archived']
// Đều hơn mọi bản ghi phía trên → xếp sau trên Home, nên các test định vị tile theo tên
// ('Marketing', 'Acme Corp') không bị đẩy sang trang 2.
const olderAges = ['3 tháng trước', '4 tháng trước', '5 tháng trước', '6 tháng trước', '7 tháng trước', '8 tháng trước']

const olderWorkspaces = (): Workspace[] => olderWorkspaceSeeds.map((seed, index) => ({
  id: `ws-old-${String(index + 1).padStart(2, '0')}`,
  name: seed.name, description: seed.description,
  status: olderStatuses[index % olderStatuses.length],
  projects: 0, datasets: 0, members: 2 + (index % 5), storageGb: 18 + index * 7,
  favorite: false, cover: olderCovers[index % olderCovers.length],
  createdAt: `${String(3 + index).padStart(2, '0')}/0${1 + (index % 6)}/2023`,
  updatedAt: olderAges[index % olderAges.length],
  owner: team[index % team.length],
  memberPreview: team.slice(index % 3, (index % 3) + 2),
}))

export const seedWorkspaces: readonly Workspace[] = [
  {
    id: 'ws-acme', name: 'Acme Corp', status: 'active', projects: 12, datasets: 36, members: 8,
    description: 'Không gian làm việc chính cho các dự án dữ liệu của Acme Corp.',
    storageGb: 320, favorite: true, cover: 'blue', createdAt: '12/03/2024', updatedAt: '2 giờ trước',
    owner: people.anh, memberPreview: team.slice(0, 3),
  },
  {
    id: 'ws-marketing', name: 'Marketing', status: 'active', projects: 8, datasets: 24, members: 5,
    description: 'Phân tích dữ liệu marketing và hiệu suất chiến dịch.',
    storageGb: 180, favorite: false, cover: 'orange', createdAt: '04/04/2024', updatedAt: '1 ngày trước',
    owner: people.huy, memberPreview: team.slice(1, 4),
  },
  {
    id: 'ws-finance', name: 'Finance', status: 'active', projects: 6, datasets: 18, members: 4,
    description: 'Phân tích dữ liệu tài chính và báo cáo.',
    storageGb: 96, favorite: false, cover: 'green', createdAt: '18/04/2024', updatedAt: '3 ngày trước',
    // Thứ tự trong memberPreview QUY ĐỊNH vai trò của từng người (xem memberRoleCycle trong
    // preview-data): owner là Owner, phần còn lại luân phiên Member · Admin · Member · Viewer.
    // Để anh ở vị trí số 2 là chủ batch có một workspace Admin — nếu không, ô lọc 'Admin'
    // trong ảnh không bao giờ trả về dòng nào và thành một bộ lọc giả.
    owner: people.ha, memberPreview: [people.huy, people.anh, people.ha],
  },
  {
    id: 'ws-rnd', name: 'Research & Development', status: 'active', projects: 4, datasets: 12, members: 6,
    description: 'Không gian cho các dự án nghiên cứu và phát triển.',
    storageGb: 240, favorite: true, cover: 'violet', createdAt: '22/05/2024', updatedAt: '1 tuần trước',
    owner: people.dung, memberPreview: team.slice(2, 5),
  },
  {
    id: 'ws-operations', name: 'Operations', status: 'active', projects: 5, datasets: 14, members: 3,
    description: 'Quản lý dữ liệu vận hành và quy trình.',
    storageGb: 74, favorite: false, cover: 'cyan', createdAt: '09/06/2024', updatedAt: '2 tuần trước',
    owner: people.khoi, memberPreview: team.slice(0, 2),
  },
  {
    id: 'ws-cs', name: 'Customer Success', status: 'active', projects: 7, datasets: 20, members: 4,
    description: 'Phân tích dữ liệu khách hàng và hỗ trợ.',
    storageGb: 130, favorite: true, cover: 'pink', createdAt: '15/06/2024', updatedAt: '2 tuần trước',
    owner: people.vy, memberPreview: team.slice(1, 4),
  },
  {
    id: 'ws-product', name: 'Product', status: 'active', projects: 9, datasets: 28, members: 5,
    description: 'Phân tích sản phẩm và hành vi người dùng.',
    storageGb: 210, favorite: false, cover: 'blue', createdAt: '01/07/2024', updatedAt: '3 tuần trước',
    owner: people.anh, memberPreview: team.slice(3, 6),
  },
  {
    id: 'ws-dataeng', name: 'Data Engineering', status: 'paused', projects: 10, datasets: 32, members: 6,
    description: 'Quản lý hạ tầng dữ liệu và pipeline.',
    storageGb: 415, favorite: false, cover: 'cyan', createdAt: '20/07/2024', updatedAt: '3 tuần trước',
    // Vị trí số 4 của anh trong roster này là 'Viewer' — cùng lý do với ws-finance ở trên:
    // cả năm ô vai trò trong ảnh phải có ít nhất một bản ghi khớp.
    owner: people.ha, memberPreview: [people.huy, people.dung, people.khoi, people.anh],
  },
  {
    id: 'ws-sales', name: 'Sales Analytics', status: 'active', projects: 6, datasets: 16, members: 4,
    description: 'Phân tích dữ liệu bán hàng và thị trường.',
    storageGb: 88, favorite: false, cover: 'pink', createdAt: '02/08/2024', updatedAt: '1 tháng trước',
    owner: people.dung, memberPreview: team.slice(2, 6),
  },
  {
    id: 'ws-supply', name: 'Supply Chain', status: 'paused', projects: 3, datasets: 9, members: 3,
    description: 'Theo dõi chuỗi cung ứng và tồn kho.',
    storageGb: 52, favorite: false, cover: 'orange', createdAt: '11/08/2024', updatedAt: '1 tháng trước',
    owner: people.khoi, memberPreview: team.slice(1, 3),
  },
  {
    id: 'ws-hr', name: 'People & HR', status: 'archived', projects: 2, datasets: 5, members: 3,
    description: 'Dữ liệu nhân sự và tuyển dụng.',
    storageGb: 24, favorite: false, cover: 'violet', createdAt: '28/08/2024', updatedAt: '2 tháng trước',
    owner: people.vy, memberPreview: team.slice(4, 6),
  },
  {
    id: 'ws-risk', name: 'Risk Management', status: 'archived', projects: 4, datasets: 11, members: 4,
    description: 'Phân tích rủi ro và tuân thủ.',
    storageGb: 66, favorite: false, cover: 'green', createdAt: '05/09/2024', updatedAt: '2 tháng trước',
    owner: people.anh, memberPreview: team.slice(0, 3),
  },
  // 40 = Home hai trang (24 + 16) và trang Workspaces hai trang (28 + 12): cả bốn tính năng
  // "lướt trong khung", "lật trang Home", "lật trang Workspaces" và "số dòng" đều có thật
  // trên dữ liệu demo. Bộ demo mà tụt về ≤ 28 là trang Workspaces lại thành MỘT trang.
  ...olderWorkspaces(),
]

// `updatedAt` là CHUỖI hiển thị, không phải mốc thời gian thật (mock chưa có API). Đã đo
// trên màn: cùng một cột "Cập nhật" mà một dòng ghi '12/03/2024 14:32', các dòng còn lại
// ghi '1 ngày trước' thì người đọc không so sánh được hai dòng với nhau — và dòng tuyệt đối
// lại đứng đầu danh sách "gần đây" dù trông cũ nhất. Một cột một kiểu: tương đối cho mọi
// `updatedAt`; ngày tuyệt đối chỉ dành cho `createdAt`/`importedAt` (mốc sự kiện).
export const seedProjects: readonly Project[] = [
  {
    id: 'prj-sales', code: 'PRJ-001', name: 'Sales Analytics', status: 'active',
    description: 'Phân tích dữ liệu bán hàng và thị trường cho khu vực Đông Nam Á.',
    workspaceId: 'ws-acme', workspaceName: 'Acme Corp', cover: 'blue', members: team.slice(0, 3),
    createdAt: '12/03/2024 10:30', updatedAt: '2 giờ trước', owner: people.anh,
    dataset: { id: 'ds-sales', fileName: 'sales_data.csv', format: 'CSV', rows: 1_250_000, columns: 24, sizeMb: 245, importedAt: '12/03/2024 14:32', status: 'processed' },
  },
  {
    id: 'prj-marketing', code: 'PRJ-002', name: 'Marketing Insight', status: 'active',
    description: 'Phân tích hiệu quả chiến dịch marketing và hành vi khách hàng.',
    workspaceId: 'ws-acme', workspaceName: 'Acme Corp', cover: 'violet', members: team.slice(1, 4),
    createdAt: '18/03/2024 09:10', updatedAt: '1 ngày trước', owner: people.huy,
    dataset: { id: 'ds-marketing', fileName: 'marketing_campaigns.csv', format: 'CSV', rows: 850_000, columns: 18, sizeMb: 168, importedAt: '19/03/2024 08:00', status: 'processed' },
  },
  {
    id: 'prj-customer', code: 'PRJ-003', name: 'Customer 360', status: 'paused',
    description: 'Hợp nhất dữ liệu khách hàng từ nhiều nguồn và xây dựng chân dung khách hàng.',
    workspaceId: 'ws-acme', workspaceName: 'Acme Corp', cover: 'cyan', members: team.slice(0, 4),
    createdAt: '25/03/2024 16:40', updatedAt: '2 ngày trước', owner: people.ha,
    dataset: { id: 'ds-customer', fileName: 'customer_data.csv', format: 'CSV', rows: 2_400_000, columns: 32, sizeMb: 420, importedAt: '26/03/2024 11:20', status: 'processing' },
  },
  {
    id: 'prj-finance', code: 'PRJ-004', name: 'Finance Data', status: 'active',
    description: 'Phân tích dữ liệu tài chính và báo cáo hiệu suất kinh doanh.',
    workspaceId: 'ws-acme', workspaceName: 'Acme Corp', cover: 'green', members: team.slice(2, 5),
    createdAt: '02/04/2024 14:05', updatedAt: '3 ngày trước', owner: people.dung,
    dataset: { id: 'ds-finance', fileName: 'finance_data.parquet', format: 'Parquet', rows: 980_000, columns: 28, sizeMb: 310, importedAt: '03/04/2024 09:15', status: 'processed' },
  },
  {
    id: 'prj-product', code: 'PRJ-005', name: 'Product Analysis', status: 'active',
    description: 'Phân tích hiệu suất sản phẩm và nhu cầu thị trường.',
    workspaceId: 'ws-acme', workspaceName: 'Acme Corp', cover: 'blue', members: team.slice(0, 3),
    createdAt: '10/04/2024 10:00', updatedAt: '5 ngày trước', owner: people.khoi,
    dataset: { id: 'ds-product', fileName: 'product_data.csv', format: 'CSV', rows: 1_800_000, columns: 26, sizeMb: 380, importedAt: '11/04/2024 15:30', status: 'processed' },
  },
  {
    id: 'prj-research', code: 'PRJ-006', name: 'Research Hub', status: 'completed',
    description: 'Nghiên cứu và phát triển dữ liệu mới cho các dự án tương lai.',
    workspaceId: 'ws-acme', workspaceName: 'Acme Corp', cover: 'violet', members: team.slice(1, 3),
    createdAt: '21/04/2024 08:20', updatedAt: '1 tuần trước', owner: people.vy,
    dataset: { id: 'ds-research', fileName: 'research_data.csv', format: 'CSV', rows: 650_000, columns: 20, sizeMb: 120, importedAt: '22/04/2024 13:45', status: 'processed' },
  },
  {
    id: 'prj-hr', code: 'PRJ-007', name: 'HR Analytics', status: 'active',
    description: 'Phân tích dữ liệu nhân sự và tuyển dụng.',
    workspaceId: 'ws-acme', workspaceName: 'Acme Corp', cover: 'pink', members: team.slice(3, 6),
    createdAt: '28/04/2024 09:30', updatedAt: '1 tuần trước', owner: people.anh,
    dataset: { id: 'ds-hr', fileName: 'hr_data.csv', format: 'CSV', rows: 420_000, columns: 18, sizeMb: 95, importedAt: '29/04/2024 10:10', status: 'processed' },
  },
  {
    id: 'prj-supply', code: 'PRJ-008', name: 'Supply Chain', status: 'active',
    description: 'Phân tích chuỗi cung ứng và vận hành.',
    workspaceId: 'ws-acme', workspaceName: 'Acme Corp', cover: 'cyan', members: team.slice(0, 4),
    createdAt: '06/05/2024 11:15', updatedAt: '2 tuần trước', owner: people.huy,
    dataset: { id: 'ds-supply', fileName: 'supply_chain.csv', format: 'CSV', rows: 1_100_000, columns: 22, sizeMb: 210, importedAt: '07/05/2024 16:00', status: 'queued' },
  },
  {
    id: 'prj-risk', code: 'PRJ-009', name: 'Risk Management', status: 'archived',
    description: 'Phân tích rủi ro và tuân thủ.',
    workspaceId: 'ws-acme', workspaceName: 'Acme Corp', cover: 'orange', members: team.slice(2, 4),
    createdAt: '14/05/2024 13:50', updatedAt: '1 tháng trước', owner: people.ha,
    dataset: { id: 'ds-risk', fileName: 'risk_data.csv', format: 'CSV', rows: 350_000, columns: 16, sizeMb: 80, importedAt: '15/05/2024 09:40', status: 'processed' },
  },
  {
    id: 'prj-growth', code: 'PRJ-010', name: 'Growth Experiments', status: 'active',
    description: 'Thử nghiệm A/B và đo lường tăng trưởng.',
    workspaceId: 'ws-acme', workspaceName: 'Acme Corp', cover: 'green', members: team.slice(1, 5),
    createdAt: '23/05/2024 10:05', updatedAt: '1 tháng trước', owner: people.dung,
    dataset: { id: 'ds-growth', fileName: 'growth_experiments.json', format: 'JSON', rows: 210_000, columns: 14, sizeMb: 46, importedAt: '24/05/2024 08:30', status: 'processed' },
  },
  {
    id: 'prj-quality', code: 'PRJ-011', name: 'Data Quality Audit', status: 'paused',
    description: 'Kiểm toán chất lượng dữ liệu và phả hệ nguồn gốc.',
    workspaceId: 'ws-acme', workspaceName: 'Acme Corp', cover: 'violet', members: team.slice(0, 2),
    createdAt: '02/06/2024 15:20', updatedAt: '2 tháng trước', owner: people.khoi,
    dataset: { id: 'ds-quality', fileName: 'quality_audit.xlsx', format: 'Excel', rows: 120_000, columns: 12, sizeMb: 28, importedAt: '03/06/2024 09:00', status: 'failed' },
  },
  {
    id: 'prj-empty', code: 'PRJ-012', name: 'Open Questions', status: 'active',
    description: 'Dự án mới, chưa nạp tập dữ liệu.',
    workspaceId: 'ws-acme', workspaceName: 'Acme Corp', cover: 'blue', members: team.slice(4, 6),
    createdAt: '11/06/2024 08:00', updatedAt: '2 tháng trước', owner: people.vy,
    dataset: null,
  },
  // 12 project đầu thuộc Acme Corp để trang Projects khớp mockup ("các dự án trong
  // workspace Acme Corp"). Các bản ghi sau ở workspace khác để combobox Không gian ở
  // topbar và mục "Dự án gần đây" của trang Workspaces có nội dung thật khi đổi scope.
  {
    id: 'prj-attribution', code: 'PRJ-013', name: 'Campaign Attribution', status: 'active',
    description: 'Xác định kênh marketing tạo chuyển đổi thực tế.',
    workspaceId: 'ws-marketing', workspaceName: 'Marketing', cover: 'orange', members: team.slice(1, 3),
    createdAt: '20/04/2024 09:00', updatedAt: '4 giờ trước', owner: people.huy,
    dataset: { id: 'ds-attribution', fileName: 'campaign_attribution.csv', format: 'CSV', rows: 540_000, columns: 19, sizeMb: 102, importedAt: '20/04/2024 16:20', status: 'processed' },
  },
  {
    id: 'prj-loyalty', code: 'PRJ-014', name: 'Loyalty Program', status: 'processing',
    description: 'Đo lường hiệu quả chương trình khách hàng thân thiết.',
    workspaceId: 'ws-marketing', workspaceName: 'Marketing', cover: 'pink', members: team.slice(2, 4),
    createdAt: '14/05/2024 10:40', updatedAt: '6 giờ trước', owner: people.vy,
    dataset: null,
  },
  {
    id: 'prj-budget', code: 'PRJ-015', name: 'Budget Variance', status: 'active',
    description: 'So sánh ngân sách và chi phí thực tế theo quý.',
    workspaceId: 'ws-finance', workspaceName: 'Finance', cover: 'green', members: team.slice(0, 2),
    createdAt: '08/04/2024 13:15', updatedAt: '1 ngày trước', owner: people.ha,
    dataset: { id: 'ds-budget', fileName: 'budget_variance.xlsx', format: 'Excel', rows: 96_000, columns: 15, sizeMb: 22, importedAt: '08/04/2024 15:00', status: 'processed' },
  },
  {
    id: 'prj-churn', code: 'PRJ-016', name: 'Churn Prediction', status: 'paused',
    description: 'Dự báo khách hàng có nguy cơ rời bỏ.',
    workspaceId: 'ws-cs', workspaceName: 'Customer Success', cover: 'violet', members: team.slice(3, 5),
    createdAt: '02/05/2024 08:45', updatedAt: '3 ngày trước', owner: people.dung,
    dataset: { id: 'ds-churn', fileName: 'churn_signals.csv', format: 'CSV', rows: 310_000, columns: 21, sizeMb: 64, importedAt: '02/05/2024 11:30', status: 'queued' },
  },
  {
    id: 'prj-adoption', code: 'PRJ-017', name: 'Feature Adoption', status: 'active',
    description: 'Theo dõi mức độ sử dụng tính năng theo nhóm người dùng.',
    workspaceId: 'ws-product', workspaceName: 'Product', cover: 'cyan', members: team.slice(1, 4),
    createdAt: '25/05/2024 09:20', updatedAt: '5 ngày trước', owner: people.khoi,
    dataset: { id: 'ds-adoption', fileName: 'feature_adoption.json', format: 'JSON', rows: 175_000, columns: 13, sizeMb: 39, importedAt: '25/05/2024 14:10', status: 'processed' },
  },
  {
    id: 'prj-lab', code: 'PRJ-018', name: 'Lab Instrument Logs', status: 'completed',
    description: 'Hợp nhất nhật ký thiết bị phòng thí nghiệm.',
    workspaceId: 'ws-rnd', workspaceName: 'Research & Development', cover: 'blue', members: team.slice(4, 6),
    createdAt: '17/06/2024 16:00', updatedAt: '1 tuần trước', owner: people.anh,
    dataset: { id: 'ds-lab', fileName: 'instrument_logs.parquet', format: 'Parquet', rows: 2_050_000, columns: 11, sizeMb: 480, importedAt: '17/06/2024 18:30', status: 'processed' },
  },
]

// Thông báo hệ thống (mục 7 UI-UX/Global Application Shell + nhóm 01 của Design Board).
// Chưa có API notifications nên toàn bộ vòng đời đọc/đánh dấu/xóa chỉ sống trong mock store.
//
// Nhãn "Project …" KHÔNG viết tay: dẫn ra từ chính seedProjects theo projectId. Trước đây
// fixture ghi "Project Customer Insights" trong khi projectId trỏ tới bản ghi tên
// "Customer 360" — hai chữ trong cùng một bản ghi cãi nhau, và màn chi tiết thì mở project
// theo id nên người dùng đến nơi lại thấy một cái tên khác. id sai giờ lộ ra ngay bằng
// dấu ⚠ thay vì im lặng đẹp đẽ.
const noticeContext = (projectId: string | null): string => {
  if (projectId === null) return 'DataVerse'
  const name = seedProjects.find(item => item.id === projectId)?.name
  return name ? `Project ${name}` : `Project ⚠ id "${projectId}" không tồn tại trong fixture`
}

// Mốc "bây giờ" giả định của bộ dữ liệu mẫu: 14:30, 20/01/2025. Nhãn tương đối (at) dùng
// cho dropdown, mốc tuyệt đối (atFull) dùng cho màn chi tiết — hai cái phải chỉ cùng một
// thời điểm, nếu không cùng một thông báo sẽ nói "2 phút trước" ở chỗ này và
// "16:05, 12/03/2024" ở chỗ kia.
export const seedNotifications: readonly PreviewNotification[] = [
  {
    id: 'nt-01', tone: 'ok', kind: 'processing', title: 'Phân tích dữ liệu hoàn tất',
    context: noticeContext('prj-sales'), at: '2 phút trước', atFull: '14:28, 20/01/2025', unread: true, projectId: 'prj-sales',
    description: 'Luồng phân tích trên sales_data.csv (1.250.000 dòng, 24 cột) đã chạy xong. Không có lỗi chặn quy trình; dữ liệu sẵn sàng cho Data View.',
  },
  {
    id: 'nt-02', tone: 'warn', kind: 'quality', title: 'Có 12 vấn đề chất lượng dữ liệu',
    context: noticeContext('prj-customer'), at: '18 phút trước', atFull: '14:10, 20/01/2025', unread: true, projectId: 'prj-customer',
    description: 'Quy tắc làm sạch phát hiện 12 vấn đề trên customer_data.csv: 7 bản ghi trùng, 4 số điện thoại sai định dạng, 1 cột trống ở 3% số dòng.',
  },
  {
    id: 'nt-03', tone: 'upload', kind: 'import', title: 'Import dữ liệu thành công',
    context: noticeContext('prj-attribution'), at: '45 phút trước', atFull: '13:45, 20/01/2025', unread: true, projectId: 'prj-attribution',
    description: 'campaign_attribution.csv (540.000 dòng, 19 cột) đã nạp xong và được lập chỉ mục. Bản gốc vẫn lưu để đối chiếu khi cần.',
  },
  {
    id: 'nt-04', tone: 'info', kind: 'member', title: 'Phạm Văn Đức thêm bạn vào dự án',
    context: noticeContext('prj-churn'), at: '1 giờ trước', atFull: '13:30, 20/01/2025', unread: true, projectId: 'prj-churn',
    description: 'Bạn vào dự án với quyền Editor: sửa được quy tắc làm sạch và tạo bản xuất, nhưng không quản lý được thành viên.',
  },
  {
    id: 'nt-05', tone: 'info', kind: 'processing', title: 'Batch làm sạch đang chạy',
    context: noticeContext('prj-loyalty'), at: '2 giờ trước', atFull: '12:30, 20/01/2025', unread: true, projectId: 'prj-loyalty',
    description: '1.480/2.000 dòng đã xử lý. Dự án chưa có tập dữ liệu chính nên batch chạy trên tệp nạp tạm; tiến độ thật sẽ về từ module Versions.',
  },
  {
    id: 'nt-06', tone: 'ok', kind: 'export', title: 'Bản xuất Excel đã sẵn sàng',
    context: noticeContext('prj-finance'), at: '3 giờ trước', atFull: '11:30, 20/01/2025', unread: false, projectId: 'prj-finance',
    description: 'q4_finance_report.xlsx gồm 3 sheet đã tạo xong và giữ được 30 ngày. Hàng đợi tải nằm ở module Exports.',
  },
  {
    id: 'nt-07', tone: 'warn', kind: 'quality', title: 'Ba quy tắc làm sạch thất bại',
    context: noticeContext('prj-quality'), at: '4 giờ trước', atFull: '10:24, 20/01/2025', unread: false, projectId: 'prj-quality',
    description: 'quality_audit.xlsx ở trạng thái Lỗi: ba quy tắc không áp dụng được vì kiểu cột đổi sau lần nạp gần nhất. Dự án đang Tạm dừng chờ xử lý.',
  },
  {
    id: 'nt-08', tone: 'upload', kind: 'import', title: 'Đã nạp tệp tồn kho mới',
    context: noticeContext('prj-supply'), at: '6 giờ trước', atFull: '08:15, 20/01/2025', unread: false, projectId: 'prj-supply',
    description: 'supply_chain.csv (1.100.000 dòng) đang trong hàng đợi xử lý. Ba dòng thiếu mã kho đã được đánh dấu để rà soát thủ công.',
  },
  {
    id: 'nt-09', tone: 'info', kind: 'system', title: 'Cập nhật phiên bản hệ thống',
    context: noticeContext(null), at: '1 ngày trước', atFull: '16:20, 19/01/2025', unread: false, projectId: null,
    description: 'DataVerse 0.9.3 nâng công cụ phát hiện vấn đề chất lượng dữ liệu và sửa lỗi hiển thị bảng. Không ảnh hưởng tới dữ liệu của bạn.',
  },
  {
    id: 'nt-10', tone: 'ok', kind: 'processing', title: 'Phân tích chiến dịch hoàn tất',
    context: noticeContext('prj-marketing'), at: '1 ngày trước', atFull: '09:05, 19/01/2025', unread: false, projectId: 'prj-marketing',
    description: 'marketing_campaigns.csv đã qua 6 quy tắc làm sạch, 18 cột được chuẩn hóa. Kết quả sẵn sàng cho Data View mới.',
  },
  {
    id: 'nt-11', tone: 'warn', kind: 'quality', title: 'Cột doanh thu có 213 giá trị ngoại lệ',
    context: noticeContext('prj-product'), at: '2 ngày trước', atFull: '17:40, 18/01/2025', unread: false, projectId: 'prj-product',
    description: 'product_data.csv có 213 giá trị âm ở cột total_revenue. Cần chọn quy tắc làm sạch trước khi xuất báo cáo cho khách hàng.',
  },
  {
    id: 'nt-12', tone: 'upload', kind: 'import', title: 'Import dữ liệu nhân sự',
    context: noticeContext('prj-hr'), at: '3 ngày trước', atFull: '11:12, 17/01/2025', unread: false, projectId: 'prj-hr',
    description: 'hr_data.csv (420.000 dòng) nạp xong. Thông tin cá nhân ở 3 cột đã được che theo chính sách mask của workspace.',
  },
  {
    id: 'nt-13', tone: 'ok', kind: 'export', title: 'Xuất kèm sơ đồ dòng dữ liệu',
    context: noticeContext('prj-research'), at: '4 ngày trước', atFull: '15:55, 16/01/2025', unread: false, projectId: 'prj-research',
    description: 'research_data.csv được xuất kèm lineage graph định dạng JSON. Dự án đã Hoàn thành nên bản xuất là snapshot đóng băng.',
  },
  {
    id: 'nt-14', tone: 'info', kind: 'member', title: 'Bùi Hồ Thảo Vy mời 2 thành viên mới',
    context: noticeContext('prj-growth'), at: '6 ngày trước', atFull: '08:20, 14/01/2025', unread: false, projectId: 'prj-growth',
    description: 'growth_experiments.json hiện có thêm 2 Editor. Bạn nhận thông báo này vì đang là thành viên của dự án.',
  },
  {
    id: 'nt-15', tone: 'info', kind: 'system', title: 'Preview tự khôi phục dữ liệu mẫu',
    context: noticeContext(null), at: '1 tuần trước', atFull: '09:40, 13/01/2025', unread: false, projectId: null,
    description: 'Khung preview 2D chỉ sửa bộ nhớ của tab: tải lại trang sẽ đưa danh sách về 16 thông báo ban đầu. Đây là thông báo minh họa, không gắn project nào.',
  },
  {
    id: 'nt-16', tone: 'ok', kind: 'processing', title: 'Kiểm toán rủi ro hoàn tất',
    context: noticeContext('prj-risk'), at: '2 tuần trước', atFull: '14:05, 06/01/2025', unread: false, projectId: 'prj-risk',
    description: 'risk_data.csv (350.000 dòng) xử lý xong trước khi dự án chuyển sang Lưu trữ. Bản ghi kiểm toán vẫn còn để đối chiếu.',
  },
]

// Báo cáo vấn đề của chính người dùng (Design Board nhóm 02–03). Khác thông báo: đây là
// thứ user TỰ gửi, nên có vòng đời xử lý (Đang xử lý / Cần bổ sung / Đã xử lý / Đã đóng).
// Chưa có API Reports/Feedback nên bản ghi chỉ sống trong mock store; "Tạo báo cáo mới"
// thêm một dòng vào đầu danh sách và có Hoàn tác.
//
// Tám bản ghi chia đúng bộ tab mockup 3.2: 3 Đang xử lý · 1 Cần bổ sung · 4 Đã xử lý
// (= 8 tất cả). Bốn dòng đầu lấy nguyên văn từ bảng trong ảnh (mã, tiêu đề, loại, trạng
// thái, ngày) để đối chiếu được; bốn dòng sau bổ sĩ số cho phân trang 6/trang có nghĩa.
export const seedReports: readonly PreviewReport[] = [
  {
    id: 'rp-01', code: 'DV-250120-001', issueType: 'system', status: 'processing',
    title: 'Không thể tải dữ liệu trong Project',
    description: 'Khi truy cập Project "Sales Analytics", hệ thống hiển thị lỗi và không thể tải danh sách dữ liệu. Vấn đề xảy ra từ 10:15 ngày 20/01/2025.',
    attachment: { name: 'screenshot_error.png', sizeLabel: '1.2 MB' },
    createdAt: '20/01/2025, 10:30', updatedAt: '2 giờ trước',
  },
  {
    id: 'rp-02', code: 'DV-250118-007', issueType: 'feature', status: 'needs-info',
    title: 'Lỗi hiển thị biểu đồ',
    description: 'Biểu đồ cột trong Data View vẽ tràn khung khi có hơn 12 nhóm. Cần team hỗ trợ gửi lại ảnh chụp ở kích cửa sổ cụ thể để tái hiện.',
    attachment: null,
    createdAt: '18/01/2025, 14:22', updatedAt: '2 ngày trước',
  },
  {
    id: 'rp-03', code: 'DV-250115-005', issueType: 'suggestion', status: 'resolved',
    title: 'Đề xuất cải tiến tốc độ xử lý',
    description: 'Nên cho phép chạy quy tắc làm sạch trên một phạm vi dòng đã lọc thay vì toàn bộ tập, để xem nhanh kết quả trước khi áp dụng.',
    attachment: null,
    createdAt: '16/01/2025, 09:18', updatedAt: '4 ngày trước',
  },
  {
    id: 'rp-04', code: 'DV-250112-003', issueType: 'system', status: 'resolved',
    title: 'Không nhận được thông báo',
    description: 'Chuông không kêu khi batch làm sạch hoàn tất. Nguyên nhân do bật chế độ chỉ báo lỗi; đã hướng dẫn bật lại trong Cài đặt thông báo.',
    attachment: null,
    createdAt: '12/01/2025, 16:40', updatedAt: '1 tuần trước',
  },
  {
    id: 'rp-05', code: 'DV-250110-002', issueType: 'data', status: 'processing',
    title: 'Số liệu trùng lặp khi xuất báo cáo',
    description: 'Bản xuất CSV của q4_finance_report có 213 dòng lặp. Đang đối chiếu giữa bảng gốc và tệp xuất để xác định bước sinh bản lặp.',
    attachment: { name: 'duplicate_rows_sample.csv', sizeLabel: '48 KB' },
    createdAt: '10/01/2025, 08:05', updatedAt: '1 tuần trước',
  },
  {
    id: 'rp-06', code: 'DV-250108-011', issueType: 'feature', status: 'processing',
    title: 'Nút Hoàn tác không hiện trên toast',
    description: 'Sau khi đổi trạng thái project, toast báo thành công nhưng không kèm nút Hoàn tác như các thao tác khác. Đang xác nhận lại trên diện rộng.',
    attachment: null,
    createdAt: '08/01/2025, 13:50', updatedAt: '2 tuần trước',
  },
  {
    id: 'rp-07', code: 'DV-250106-004', issueType: 'system', status: 'resolved',
    title: 'Trang vũ trụ dữ liệu tải chậm',
    description: 'Scene 3D mất hơn 10 giây để dựng trên máy đồ hoạ tích hợp. Đã ghi nhận và chuyển nhóm hiệu năng xử lý.',
    attachment: null,
    createdAt: '06/01/2025, 17:20', updatedAt: '2 tuần trước',
  },
  {
    id: 'rp-08', code: 'DV-250103-009', issueType: 'suggestion', status: 'resolved',
    title: 'Thêm bộ lọc theo định dạng tệp',
    description: 'Đề xuất cho phép lọc danh sách tập dữ liệu theo CSV/Parquet/Excel/JSON. Đã đưa vào lộ trình batch Dataset.',
    attachment: null,
    createdAt: '03/01/2025, 10:00', updatedAt: '3 tuần trước',
  },
]

/* ---------- Tài khoản & Cài đặt cá nhân (Design Board nhóm 04) ---------- */

// Hồ sơ của ĐÚNG người dùng mẫu (people.anh) để avatar/tên ở sidebar, topbar và menu tài
// khoản là một bản duy nhất. email + role chỉ đọc (khớp accountInfo); ba trường còn lại
// (organization/phone/bio) sửa được — đúng đặc tả dòng 9. Ảnh mockup vẽ "Alex Carter /
// Data Analyst" nhưng frame này nhất quán dùng Nguyễn Minh Anh nên giữ người dùng mẫu.
export const seedProfile: ProfileInfo = {
  name: people.anh.name,
  email: 'minh.anh@dataverse.io',
  role: people.anh.role,
  organization: 'Đội Phân tích Kinh doanh',
  phone: '+84 90 123 4567',
  bio: 'Chuyên phân tích dữ liệu và xây dựng báo cáo.',
}

// Hai phiên đúng như ảnh 4.4 ("Các phiên đang hoạt động (2)"): một là máy ĐANG xem preview
// (current, không tự đăng xuất được), một là máy khác để nút "⋮ → đăng xuất phiên này" có
// tác dụng thật trên dữ liệu mẫu. startedAt là mốc tuyệt đối (cột "Đăng nhập lúc" trong ảnh).
export const seedSessions: readonly DeviceSession[] = [
  {
    id: 'ses-current', platform: 'Windows', browser: 'Chrome', icon: 'monitor',
    location: 'Hà Nội, Việt Nam', current: true, startedAt: '20/01/2025, 08:05', ip: '113.161.44.20',
  },
  {
    id: 'ses-mobile', platform: 'iPhone', browser: 'Safari', icon: 'phone',
    location: 'TP. Hồ Chí Minh, Việt Nam', current: false, startedAt: '15/01/2025, 09:10', ip: '42.112.23.87',
  },
]

// Ảnh 4.5 vẽ cả bốn công tắc đang BẬT. Trạng thái chỉ sống trong mock store (chưa có API
// notification preference) nên bật/tắt là mutation optimistic kèm Hoàn tác, tải lại về bật hết.
export const seedNotificationPrefs: NotificationPrefs = {
  system: true, projects: true, quality: true, workspace: true,
}
