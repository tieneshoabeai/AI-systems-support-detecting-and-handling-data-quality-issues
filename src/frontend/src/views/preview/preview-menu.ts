import type { PreviewMenuItem, PreviewTarget, Project, Workspace } from '../../types/preview/preview.types'

// Thực đơn ngữ cảnh cho từng loại bản ghi. Chuột phải, nút ⋯ và dropdown "Thao tác ▾"
// cùng dùng một danh sách ở đây — thêm/bớt một hành động chỉ sửa một chỗ.
//
// NGUYÊN TẮC chủ batch chốt hai lần: menu CHỈ chứa những mục ảnh vẽ và những mục thật sự
// chạy được. Một item "cho đủ bộ" (nhân bản, đặt trạng thái, sao chép liên kết của workspace)
// là một nút chiếm chỗ mà không đưa người dùng tới đâu; item bắt buộc phải tắt thì phải kèm
// lý do nhìn thấy được (describedBy → dải note của trang), còn tốt nhất là bỏ hẳn.
//
// Ảnh "a_detailed_high_fidelity_ui_screenshot_of_the_sam" (workspaces detail) vẽ ⋯ của
// workspace = ĐÚNG BA mục, có vạch ngăn trước mục xóa:
//   Thông tin Workspace · Quản lý thành viên · Xóa Workspace
// Hai mục đầu mở modal của chính workspace (surface cấp phiên, xem PreviewWorkspacePanel);
// mục thứ ba đi qua dialog xác nhận của session. "Mở" không có trong ảnh mà cũng không cần:
// một click trên thẻ đã mở trang chi tiết (preview-card), Enter làm y hệt cho bàn phím.

export type PreviewMenuDescriptor = {
  target: PreviewTarget
  items: PreviewMenuItem[]
  // Dòng lý do hiển thị ngay trong menu khi có item tắt.
  note?: string
}

export const workspaceMenu = (workspace: Workspace): PreviewMenuDescriptor => ({
  target: { kind: 'workspace', id: workspace.id, name: workspace.name },
  items: [
    { id: 'ws-info', label: 'Thông tin Workspace', icon: 'info' },
    { id: 'ws-members', label: 'Quản lý thành viên', icon: 'users' },
    { id: 'remove', label: 'Xóa Workspace', icon: 'trash', tone: 'danger', separatorBefore: true },
  ],
})

export const projectMenu = (project: Project): PreviewMenuDescriptor => ({
  target: { kind: 'project', id: project.id, name: project.name },
  // BỐN mục chủ batch 03/11 chốt cho ⋯ của project (áp cho MỌI ⋯ của project, không riêng Home):
  //   Mở · Xem thông tin · Đổi tên · Xóa.
  // "Lưu trữ Project" đã BỎ theo yêu cầu: project không còn trạng thái do người dùng tự bật/tắt
  // trong frame này. `status` vẫn là field thật của bản ghi (tab lọc "Đã lưu trữ" vẫn đếm đúng),
  // chỉ là không còn nút đổi nó từ menu.
  //
  // Bốn thứ đã RÚT trước đó: 'universe' (3D là batch của T, lối vào nằm trong trang Project
  // Overview), 'duplicate', ba id 'đặt trạng thái X' và 'open-projects'.
  //
  // 'detail' (chỉ chọn tại chỗ) vẫn không có: project đã có TRANG RIÊNG nên một lối 'open'
  // là đủ — bấm dòng, Enter hay item này đều đi tới cùng trang Project Workspace Overview.
  items: [
    { id: 'open', label: 'Mở Project', icon: 'arrow' },
    // Thẻ tóm tắt chỉ tồn tại khi trỏ chuột, nên mở từ menu thì nó cũng phải tự đóng khi
    // bấm ra ngoài — cùng một surface, hai lối vào (xem PreviewInfoRequest).
    { id: 'info', label: 'Xem thông tin', icon: 'info' },
    { id: 'rename', label: 'Đổi tên', icon: 'pencil', separatorBefore: true },
    { id: 'remove', label: 'Xóa Project', icon: 'trash', tone: 'danger', separatorBefore: true },
  ],
})

// ⋯ của THẺ DATASET trên trang Project Workspace (ảnh DataVerse_Project_Actions_Details_v1,
// khung 1 "Menu nút ..."): ĐÚNG BA mục, có vạch ngăn trước mục xóa —
//   Thông tin Project · Quản lý thành viên · Xóa Project
// Đây là menu KHÁC với `projectMenu` ở trên (năm mục, dùng cho thẻ/dòng project ở danh sách và
// chuột phải). Không phải hai bản của một menu bị lệch nhau: ảnh list và ảnh trang project vẽ hai
// chỗ khác nhau, và trang project là nơi duy nhất người ta đứng NGAY BÊN CÁI DATASET mà bấm ⋯.
// "Đổi tên"/"Lưu trữ" không có ở đây vì ảnh không vẽ — vẫn đi được từ ⋯ của dòng project.
export const projectDatasetMenu = (project: Project): PreviewMenuDescriptor => ({
  target: { kind: 'project', id: project.id, name: project.name },
  items: [
    // 'info' = thẻ tóm tắt đã có của frame (hover là thẻ bay ra, bấm là thẻ ở lại cạnh nút ⋯).
    { id: 'info', label: 'Thông tin Project', icon: 'info' },
    // Ảnh vẽ mục này là một chức năng thật, và nó ĐÃ chạy thật (chủ batch 03/11): mở panel
    // "Quản lý thành viên" của project — thêm người từ roster của workspace, đổi vai trò, gỡ.
    { id: 'pj-members', label: 'Quản lý thành viên', icon: 'users' },
    { id: 'remove', label: 'Xóa Project', icon: 'trash', tone: 'danger', separatorBefore: true },
  ],
})
