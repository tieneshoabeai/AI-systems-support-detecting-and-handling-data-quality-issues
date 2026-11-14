# Kiểm kê Use Case Báo cáo 01 v1.2

Ngày 14/11/2026 — Under Review. **APPROVED: 64 UC chính thức. OPEN: chưa xác định đủ 64 mã hợp lệ.** Bảng dưới xác định 62 mã; không bổ sung UC giả để lấp 2 mã. Đây không phải bảng hoàn tất 64 mã và không thay tổng chính thức bằng 62.

S01 = 2_feature_catalog_v9.md; S02 = 3_business_workflows_v6.md; S03 = 6_security_authorization_v6.md; S04 = 7_api_contracts_v6.md; đối chiếu thêm Phần 4 ownership và Phần13 mapping3.12. Tất cả trong docs/restructures. WO/WM = Workspace Owner/Member; PO/PM/PV = Project Owner/Member/Viewer; SA = System Admin; SELF = chính người gọi. Mapping Feature ID là truy vết nguồn, không phải quyết định tạo mã mới. UC-24 chưa có mã Feature riêng thống nhất; UC-27 là hành vi khôi phục thuộc phạm vi PROJ-12 nhưng chưa thấy endpoint riêng đầy đủ; UC-63 là luồng hệ thống, không đòi endpoint mới.

| UC ID | Tên Use Case | Actor | Feature ID | Module To-Be | Nguồn | Trạng thái |
|---|---|---|---|---|---|---|
| UC-01 | Tạo workspace | User nghiệp vụ đăng nhập | WS-01 | workspaces | S02 UC-01; S01; S03; S04 | Nguồn hiện hành |
| UC-02 | Cập nhật thông tin workspace | WO. | WS-04 | workspaces | S02 UC-02; S01; S03; S04 | Nguồn hiện hành |
| UC-03 | Thêm thành viên workspace | WO. | WS-07 | workspaces | S02 UC-03; S01; S03; S04 | Nguồn hiện hành |
| UC-04 | Xóa thành viên workspace | WO. | WS-07 | workspaces | S02 UC-04; S01; S03; S04 | Nguồn hiện hành |
| UC-05 | Tạo project và chỉ định Project Owner | WO. | PROJ-01 | projects | S02 UC-05; S01; S03; S04 | Nguồn hiện hành |
| UC-06 | Quản lý thành viên project | PO (và WO với toàn quyền quản trị đã chốt). | PROJ-10 / PROJ-11 | projects | S02 UC-06; S01; S03; S04 | Nguồn hiện hành |
| UC-07 | Rời workspace | WM (tự rời) hoặc WO (tự rời). | WS-10 | workspaces | S02 UC-07; S01; S03; S04 | Nguồn hiện hành |
| UC-08 | Import file dữ liệu vào project | WO, PO. | PROJ-13 | datasets | S02 UC-08; S01; S03; S04 | Nguồn hiện hành |
| UC-10 | Nhập hoặc chỉnh sửa tên cột rỗng/trùng | WO, PO, PM. | VIEW-08 | data-view | S02 UC-10; S01; S03; S04 | Nguồn hiện hành |
| UC-12 | Reset Dataset | WO, PO, PM. | VIEW-07 | data-view | S02 UC-12; S01; S03; S04 | Nguồn hiện hành |
| UC-13 | Xem thông tin dataset và schema | WO, WM, PO, PM, PV | FILE-02 / DATA-01 | datasets | S02 UC-13; S01; S03; S04 | Nguồn hiện hành |
| UC-14 | Xem bảng dữ liệu | WO, WM, PO, PM, PV | VIEW-01 | data-view | S02 UC-14; S01; S03; S04 | Nguồn hiện hành |
| UC-15 | Lọc dữ liệu | WO, WM, PO, PM, PV | VIEW-02 | data-view | S02 UC-15; S01; S03; S04 | Nguồn hiện hành |
| UC-16 | Sắp xếp | WO, WM, PO, PM, PV | VIEW-03 | data-view | S02 UC-16; S01; S03; S04 | Nguồn hiện hành |
| UC-17 | Tìm kiếm | WO, WM, PO, PM, PV | VIEW-04 | data-view | S02 UC-17; S01; S03; S04 | Nguồn hiện hành |
| UC-19 | Cấu hình cột phân tích | WO, PO, PM. | ANALYSIS-01 | analysis | S02 UC-19; S01; S03; S04 | Nguồn hiện hành |
| UC-20 | Chạy Data Analysis & Detection | WO, PO, PM. | ANALYSIS-02 / DQ-01–05 | analysis | S02 UC-20; S01; S03; S04 | Nguồn hiện hành |
| UC-21 | Xem trạng thái job AI | WO, WM, PO, PM, PV | AI-01 | ai | S02 UC-21; S01; S03; S04 | Nguồn hiện hành |
| UC-22 | Thử lại AI | WO, PO, PM. | AI-01 | ai | S02 UC-22; S01; S03; S04 | Nguồn hiện hành |
| UC-23 | Tạo Tổng kết | WO, PO, PM. | SUMMARY-01 | summary | S02 UC-23; S01; S03; S04 | Nguồn hiện hành |
| UC-24 | Xem bằng chứng mức ô | WO, WM, PO, PM, PV | Bằng chứng mức ô; chưa có Feature ID riêng thống nhất | analysis | S02 UC-24; S01; S03; mapping cần đối chiếu | OPEN Feature ID |
| UC-25 | Lưu trạng thái project | WO, PO, PM. | PROJ-12 | summary | S02 UC-25; S01; S03; S04 | B APPROVED; cursor OPEN |
| UC-26 | Tải báo cáo PDF | WO, WM, PO, PM, PV | REPORT-01 | reports | S02 UC-26; S01; S03; S04 | PDF; CSV/JSON chưa có UC |
| UC-27 | Khôi phục project | WO, WM, PO, PM, PV | PROJ-12 (khôi phục) | summary | S02 UC-27; S01; S03; mapping cần đối chiếu | B APPROVED; cursor OPEN |
| UC-32 | Đăng ký tài khoản | SELF / khách | AUTH-01 | auth | S02 UC-32; S01; S03; S04 | Nguồn hiện hành |
| UC-33 | Đăng nhập bằng email và mật khẩu | SELF / khách | AUTH-02 | auth | S02 UC-33; S01; S03; S04 | Nguồn hiện hành |
| UC-34 | Đăng nhập bằng Google | SELF / khách | AUTH-03 | auth | S02 UC-34; S01; S03; S04 | Nguồn hiện hành |
| UC-35 | Ghi nhớ đăng nhập | SELF đã đăng nhập | AUTH-04 | client | S02 UC-35; S01; S03; S04 | Nguồn hiện hành |
| UC-36 | Quên mật khẩu | SELF / khách | AUTH-05 | auth | S02 UC-36; S01; S03; S04 | Nguồn hiện hành |
| UC-37 | Đặt lại mật khẩu bằng OTP | SELF / khách | AUTH-06 | auth | S02 UC-37; S01; S03; S04 | Nguồn hiện hành |
| UC-38 | Thay đổi mật khẩu | SELF. | AUTH-07 | auth | S02 UC-38; S01; S03; S04 | Nguồn hiện hành |
| UC-39 | Xem danh sách phiên đăng nhập | SELF. | AUTH-08 | auth | S02 UC-39; S01; S03; S04 | Nguồn hiện hành |
| UC-40 | Xem chi tiết phiên đăng nhập | SELF. | AUTH-09 | auth | S02 UC-40; S01; S03; S04 | Nguồn hiện hành |
| UC-41 | Đăng xuất khỏi thiết bị khác | SELF. | AUTH-10 | auth | S02 UC-41; S01; S03; S04 | Nguồn hiện hành |
| UC-42 | Đăng xuất ở thiết bị hiện tại | SELF. | AUTH-11 | auth | S02 UC-42; S01; S03; S04 | Nguồn hiện hành |
| UC-43 | Làm mới access token | SELF; refresh token | AUTH-12 | auth | S02 UC-43; S01; S03; S04 | Nguồn hiện hành |
| UC-44 | Xem hồ sơ cá nhân | SELF. | USER-01 | users | S02 UC-44; S01; S03; S04 | Nguồn hiện hành |
| UC-45 | Cập nhật hồ sơ cá nhân | SELF. | USER-02 | users | S02 UC-45; S01; S03; S04 | Nguồn hiện hành |
| UC-46 | Xem hồ sơ người dùng (quản trị) | SA. | ADMIN-01 | users | S02 UC-46; S01; S03; S04 | Nguồn hiện hành |
| UC-47 | Xem danh sách workspace | WO, WM. | WS-02 | workspaces | S02 UC-47; S01; S03; S04 | Nguồn hiện hành |
| UC-48 | Xem chi tiết workspace | WO, WM. | WS-03 | workspaces | S02 UC-48; S01; S03; S04 | Nguồn hiện hành |
| UC-49 | Xóa workspace | WO. | WS-05 | workspaces | S02 UC-49; S01; S03; S04 | Nguồn hiện hành |
| UC-50 | Xem danh sách thành viên workspace | WO, WM. | WS-06 | workspaces | S02 UC-50; S01; S03; S04 | Nguồn hiện hành |
| UC-51 | Nhượng quyền Workspace Owner | WO (hiện tại). | WS-09 | workspaces | S02 UC-51; S01; S03; S04 | Nguồn hiện hành |
| UC-52 | Xem danh sách project | WO, WM, PO, PM, PV | PROJ-02 | projects | S02 UC-52; S01; S03; S04 | Nguồn hiện hành |
| UC-53 | Xem thông tin cơ bản project | WO, WM, PO, PM, PV | PROJ-03 | projects | S02 UC-53; S01; S03; S04 | Nguồn hiện hành |
| UC-54 | Cập nhật thông tin cơ bản project | PO, WO. | PROJ-04 | projects | S02 UC-54; S01; S03; S04 | Nguồn hiện hành |
| UC-55 | Xóa project | WO. | PROJ-05 | projects | S02 UC-55; S01; S03; S04 | Nguồn hiện hành |
| UC-56 | Tìm kiếm thành viên trong project | PO, WO. | PROJ-09 | projects | S02 UC-56; S01; S03; S04 | Nguồn hiện hành |
| UC-60 | Xem trung tâm thông báo | SELF. | NOTIF-01 | notifications | S02 UC-60; S01; S03; S04 | D02 APPROVED |
| UC-61 | Xem chi tiết thông báo | SELF. | NOTIF-02 | notifications | S02 UC-61; S01; S03; S04 | D02 APPROVED |
| UC-62 | Bật hoặc tắt thông báo | SELF. | NOTIF-03 | notifications | S02 UC-62; S01; S03; S04 | D02 APPROVED |
| UC-63 | Nhận thông báo từ sự kiện hệ thống | Hệ thống | NOTIF-01–03 (hệ thống tạo) | notifications | S02 UC-63; S01; S03; mapping cần đối chiếu | D02 APPROVED |
| UC-64 | Tạo báo cáo sự cố | SELF. | ISSUE-01 | issues | S02 UC-64; S01; S03; S04 | Nguồn hiện hành |
| UC-65 | Xem danh sách báo cáo của tôi | SELF. | ISSUE-02 | issues | S02 UC-65; S01; S03; S04 | Nguồn hiện hành |
| UC-66 | Xem chi tiết báo cáo | SELF, SA. | ISSUE-03 | issues | S02 UC-66; S01; S03; S04 | Nguồn hiện hành |
| UC-67 | Duyệt báo cáo từ người dùng | SA. | ISSUE-04 | issues | S02 UC-67; S01; S03; S04 | Nguồn hiện hành |
| UC-68 | Nhận xét một phát hiện | WO, WM, PO, PM, PV | FB-01 | feedback | S02 UC-68; S01; S03; S04 | Nguồn hiện hành |
| UC-69 | Nhận xét cả lần phân tích | WO, WM, PO, PM, PV | FB-02 | feedback | S02 UC-69; S01; S03; S04 | Nguồn hiện hành |
| UC-70 | Xem nhận xét của một phát hiện hoặc lần phân tích | WO, WM, PO, PM, PV | FB-03 / FB-04 | feedback | S02 UC-70; S01; S03; S04 | Nguồn hiện hành |
| UC-71 | Sửa hoặc xóa nhận xét của chính mình | SELF; WO/PO chỉ xóa vi phạm | FB-05 | feedback | S02 UC-71; S01; S03; S04 | B APPROVED; schema PROPOSED |
| UC-72 | Xem thống kê chất lượng AI (chỉ số học lại) | WO, PO, PM. | FB-06 | feedback | S02 UC-72; S01; S03; S04 | Nguồn hiện hành |

## Hai mã chưa xác định trong tổng chính thức

| Khoảng trống | UC ID / Tên / Actor / Feature / Module | Trạng thái |
|---|---|---|
| Mã còn thiếu thứ nhất | Chưa xác định từ nguồn, không cấp số UC mới | OPEN — cần người dùng xác nhận |
| Mã còn thiếu thứ hai | Chưa xác định từ nguồn, không cấp số UC mới | OPEN — cần người dùng xác nhận |

## Phân loại ngoài 62 mã đã xác định

72 mã gốc trừ 8 mã bị gỡ rõ trong workflow (09,11,18,28,29,30,58,59) cho 64 tiêu đề. Hai mã bổ sung của tập đếm này là UC-31 và UC-57:

| UC | Nguồn giữ | Nguồn loại / mâu thuẫn | Xử lý |
|---|---|---|---|
| UC-31 Xuất CSV LEGACY | S02 mục3.7 | Phần 4 mục3.1, Phần 7 mục3.14, Phần13 mục6.1 loại exports | LEGACY ngoài nghiệm thu; D05 cấm tự tái sử dụng |
| UC-57 Lịch sử hoạt động project | S02 UC-57, S03 ma trận | S01 PROJ-06 và mục3.32.1/3.40 gỡ lịch sử project | OPEN ánh xạ; không tự phục hồi tính năng đã gỡ |

Không dùng chức năng xóa notification hoặc xuất CSV/JSON để tạo hai mã mới khi chưa phê duyệt định danh. Không đưa UC-09/58 trở lại. Cần người dùng cung cấp/chốt chính xác hai mã hợp lệ hoặc giải quyết cách phân loại UC-57; mọi thay đổi định danh/phạm vi phải có xác nhận riêng.
