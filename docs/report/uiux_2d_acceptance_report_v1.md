# Báo cáo nghiệm thu — khảo sát UI-UX (đợt cập nhật 02/11/2026) và đối chiếu frame preview 2D

Ngày: 02/11/2026
Phạm vi nghiệm thu: **phần 2D** trong `src/frontend/src/views/preview/*` (Home · Workspaces · Projects · Notifications · Global Shell).
Ngoài phạm vi (không đụng): `UI-UX/auth-login/*`, scene 3D `/preview/workspaces-3d`, mọi file thuộc batch của bạn T.

Bản **rev.2** (02/11 13:07) — sau khi nhóm trưởng trả lời 7 câu hỏi: mục 9 chuyển thành bảng đã chốt, thêm **phụ lục A** (vì `UI-UX/home/đặc tả.txt` bị về 0 byte), sửa lại mục 1/2/3/4.4/8/10. **Lỗi trong rev.1**: báo `projects/đặc tả.txt` rỗng do `Format-Table` làm tròn 230 byte → `0 KB`; file đó chưa bao giờ rỗng.

---

## 1. Tóm tắt

| Nội dung | Kết quả |
|---|---|
| Ảnh mockup đã khảo sát | 12/12 (toàn bộ ảnh trong `UI-UX/`, trừ 2 ảnh thuộc `auth-login`) |
| Text đặc tả đã khảo sát | 3 file `đặc tả.txt` (Global Shell · home · projects) |
| Yêu cầu 2D mới / thay đổi hành vi | **10 nhóm yêu cầu** (mục 4) |
| Đạt ở bản hiện tại | 4/10 |
| Chưa đạt (phải code thêm) | 6/10 |
| Ràng buộc shell (sidebar 3 mục, topbar 7 vùng) | **Đạt một phần** — sidebar còn vẽ footer đã chốt bỏ (mục 9 câu 4) |
| Quality gate | lint ✅ · `tsc -b` ✅ · `yarn test` ✅ 385/385 (23 file) |
| Feature 2D mới cần làm | ~4 màn/luồng mới: **Report an Issue**, **Settings → Accounts (3 tab)**, **Hồ sơ cá nhân**, **Notification popover at-chỗ** |
| **Sự cố phát hiện lúc 13:07** | `UI-UX/home/đặc tả.txt` bị **về 0 byte** (12:30 còn 7 dòng) — nội dung đã khôi phục ở **phụ lục A** |

Kết luận: khung shell và các trang dữ liệu vẫn còn dùng được, nhưng **đợt đặc tả mới đổi trục hành vi** — từ "điều hướng sang trang" sang "mọi thứ nằm trong ô/popover" — và mở khóa 3 nút đang tắt (`?`, chuông → chi tiết, menu tài khoản). Đây là thay đổi kiến trúc tương tác, không phải thay đổi thẩm mỹ.

---

## 2. Kiểm kê `UI-UX/` sau cập nhật

| Thư mục / file | Cỡ | Thời gian ghi | Trạng thái với scope 2D |
|---|---|---|---|
| `Global Application Shell/DataVerse Global UI Design Board.png` | 1.88 MB | 02/11 11:39 | **Chuẩn mực chính** — 4 nhóm: 01 Thông báo, 02–03 Báo cáo vấn đề, 04 Tài khoản & Cài đặt |
| `Global Application Shell/a_wide_high_resolution_abstract_sci_fi_space_nebu.png` | 1.70 MB | 02/11 11:39 | Ảnh nền dùng cho **mọi màn** (đã wire, xem mục 5.1) |
| `Global Application Shell/đặc tả.txt` | 2.7 KB · 11 dòng | 02/11 12:29 | **Mới / trọng yếu** — đặc tả hành vi cho 3 nút topbar + ràng buộc shell |
| `home/DataVerse Neon Analytics Dashboard.png` | 1.87 MB | 02/11 11:39 | Màn Home chuẩn mực (đã đối chiếu, mục 4.4) |
| `home/Screenshot from 2026-11-01 15-39-24.png` | 170 KB | 02/11 11:39 | Menu ⋯ của project — **bỏ mục "Sao chép liên kết"** |
| `home/đặc tả.txt` | ~~7 dòng~~ → **0 byte lúc 13:07** | 02/11 12:30 → 13:07 | ⚠ **Mất nội dung sau lần khảo sát đầu** — xem phụ lục A (bản 7 dòng đã ghi lại nguyên văn) |
| `projects/DataVerse_Project_Workspace_Overview_v1.png` | 2.60 MB | 02/11 11:39 | Màn tổng thể Project (scene 3D của T + tab bar dưới) |
| `projects/DataVerse_Project_Actions_Details_v1.png` | 1.35 MB | 02/11 11:39 | **Mới với 2D** — menu ⋯ project + 3 dialog (Thông tin / Thành viên / Xóa) |
| `projects/đặc tả.txt` | 230 byte · 1 dòng | 02/11 12:49 → **13:07** | **Không rỗng** (báo cáo sơ bản ghi nhầm do `Format-Table` làm tròn 230 byte = 0 KB) — quy tắc tab bar 4 mục = cùng hành vi với khối 3D của T |
| `workspaces/DataVerse Workspace Creation with Email Suggestions.png` | 1.80 MB | 02/11 11:39 | **Mới với 2D** — 8 khung: overview, form tạo WS + gợi ý email, thành công, 4 bộ lọc, kết quả lọc |
| `workspaces detail/Neon Workspace Management Panels.png` | 1.55 MB | 02/11 11:39 | **Mới với 2D** — dialog Thông tin Workspace (counter 9/100, 63/500) + Quản lý thành viên (32, phân trang 8 dòng) |
| `workspaces detail/Screenshot from 2026-11-01 16-53-15.png` | 275 KB | 02/11 11:39 | **Mới với 2D** — 4 dialog nhỏ: sửa WS, quản lý TV, xác nhận xóa WS, Tạo Project thành công |
| `workspaces detail/a_detailed_high_fidelity_ui_screenshot_of_the_sam.png` | 1.91 MB | 02/11 11:39 | **Mới với 2D** — trang chi tiết Workspace (stat, 2 biểu đồ, bảng project) + wizard Tạo Project 4 bước |
| `auth-login/*` (2 ảnh) | — | — | **Của T — không khảo sát, không nghiệm thu, không chỉnh** |

**Đã biến mất khỏi `UI-UX/`** (và đó là phát hiện, không phải assumption):

- `DataVerse Global Application Shell Specification.png` — từng là căn cứ ghi trong 4 file mã nguồn/test.
- `UI-UX/structure_ui/` — ảnh của thiết kế sidebar 11 module (đã bị phủ trước đó).
- `UI-UX/workspaces/đặc tả.txt` và `UI-UX/workspaces detail/đặc tả.txt` — **hai thư mục này có ảnh mới nhưng không có file đặc tả**.

---

## 3. Ràng buộc chung áp dụng cho MỌI trang (trích `Global Application Shell/đặc tả.txt` dòng 11; các ràng buộc riêng của `home/đặc tả.txt` nay chỉ còn ở phụ lục A)

| Ràng buộc | Nội dung | Hiện trạng code |
|---|---|---|
| Sidebar | Chỉ **Home · Workspaces · Settings** — **và không có footer** (ring dung lượng / "Không gian hiện tại" đã chốt bỏ, xem mục 9 câu 4) | 🟡 `navItems` đúng (preview-data.ts:245, test `preview-shell.test.tsx:46`) **nhưng shell vẫn đang vẽ footer** (`preview-shell.tsx:159-166`) → phải xóa |
| Topbar | nút thu sidebar · combobox workspace · combobox project · ô tìm kiếm · chuông · nút `?` · menu cá nhân | ✅ đủ 7 vùng, test `preview-shell.test.tsx:123` (nhãn "tám vùng" trong test đã lệch, xem 5.3) |
| Nhãn | **Label tiếng Anh, nội dung tiếng Việt** | ✅ nav để tiếng Anh, thân trang tiếng Việt |
| Nền | ảnh tinh vân cho mọi màn, màn phụ mờ/blur | ✅ `preview.css:144` + blur phân lớp (menu 24px, dialog 30px, toast 18px) |
| Đăng xuất | chuyển sang `auth-login` (của T) | ⏸ nút đang tắt — **đúng**, chưa phải việc của scope 2D |

---

## 4. Đối chiếu yêu cầu mới ↔ hiện trạng (bảng nghiệm thu chính)

Ký hiệu: ✅ đạt · 🟡 một phần · ❌ chưa đạt · 🧊 thuộc T

### 4.1 Nhóm 01 — Nút thông báo (chuông)

| # | Yêu cầu (Global Shell đặc tả dòng 5) | Hiện trạng | bằng chứng |
|---|---|---|---|
| 1 | Mở ra hiện **chỉ thông báo chưa đọc trong một ô** | 🟡 popover hiện **5 bản gần nhất** (lẫn đã đọc), chưa lọc "chưa đọc" | `preview-topbar.tsx:98,110` |
| 2 | "Xem tất cả" nhưng **không hiển thị cả trang** — mọi thứ chỉ trong ô | ❌ popover đang **đổi trang** sang `/preview/notifications` | `preview-topbar.tsx:146`, test `preview-interactions.test.tsx:257` |
| 3 | Trong ô: tab **Tất cả (36) / Chưa đọc (5) / Đã đọc (31)** + tìm kiếm + phễu lọc | ❌ mới có ở màn full-page | `notifications-2d.view.tsx:217` |
| 4 | Chọn nhiều dòng → "Đánh dấu đã đọc" / "Xóa" | ❌ trong popover chưa có | mới ở full-page |
| 5 | Phân trang **36 / 1-10 / 36** trong ô | ❌ | |
| 6 | Chi tiết thông báo **trong ô**, có "Mở Project ↗" + "Đánh dấu đã đọc" | ❌ đang mở full-page | `notifications-2d.view.tsx:110` |

> Hệ quả: `notifications-2d.view.tsx` (302 dòng) phải **tái sử dụng được** làm nội dung trong popover, không viết lại từ đầu. Hướng: tách phần render danh sách/chi tiết khỏi `PreviewShell` thành một `NotificationPanel`, dùng cho cả popover và route full-page.

### 4.2 Nhóm 02–03 — Nút `?` (Báo cáo vấn đề)

| # | Yêu cầu (dòng 7) | Hiện trạng |
|---|---|---|
| 1 | Nút `?` bật, mở **2 nút trong ô nhỏ**: Tạo báo cáo mới / Xem tất cả báo cáo | ❌ nút đang `disabled` (`preview-topbar.tsx:297`) |
| 2 | Form tạo: **Loại vấn đề · Tiêu đề · Mô tả chi tiết · Tệp đính kèm (tùy chọn)** | ❌ chưa có |
| 3 | Hủy → về trang home chính; Gửi → toast "Gửi báo cáo thành công" | ❌ |
| 4 | Danh sách: tab Tất cả / Đang xử lý / Cần bổ sung / Đã xử ý, phân trang **6 mục/trang** | ❌ |
| 5 | Chi tiết báo cáo + **trạng thái xử lý**, mã `DV-250120-001`, tải tệp đính kèm | ❌ |
| 6 | **Chỉ trong ô nhỏ, không hiển thị cả trang** | ❌ (ràng buộc cứng) |

Ràng buộc nghiệp vụ: chưa có API reports → làm trên **mock store trong bộ nhớ tab**, kèm Hoàn tác + dòng lý do nhìn thấy, đúng chuẩn `shared-ui.md` mục 6 đã áp dụng cho mọi mutation hiện có.

### 4.3 Nhóm 04 — Menu cá nhân → Settings/Accounts

| # | Yêu cầu (dòng 9) | Hiện trạng |
|---|---|---|
| 1 | Menu hiện **tên · email · chức vụ** | ✅ `preview-topbar.tsx:178` |
| 2 | **Hồ sơ cá nhân**: sửa tên, đơn vị, số điện thoại, giới thiệu; **email + chức vụ khóa**; Hủy / Lưu thay đổi + toast | ❌ item đang `disabled` (`preview-topbar.tsx:161`) |
| 3 | **Cài đặt tài khoản – Bảo mật**: đổi mật khẩu; **bỏ 2FA** (đặc tả ghi rõ "trong ảnh bỏ nha") | ❌ chưa có màn |
| 4 | **Đăng nhập & phiên**: danh sách máy, "Phiên hiện tại", ⋮ → Xem chi tiết / Đăng xuất phiên này, nút **Đăng xuất tất cả phiên trên đầu** | ❌ |
| 5 | **Tùy chọn thông báo**: 5 toggle (hệ thống · dự án & xử lý dữ liệu · chất lượng dữ liệu · workspace & project) | ❌ |
| 6 | Hồ sơ & Cài đặt tài khoản **chuyển sang nhánh "Accounts" của Settings** ở sidebar; nhánh khác để sau | ❌ Settings hiện chỉ báo toast (`preview-shell.tsx:127`) |
| 7 | Đăng xuất → trang auth-login của T | 🧊 giữ nguyên, không xử lý |

Ảnh 4.2 cho chi tiết: avatar + camera badge, các trường có **bút sửa riêng từng dòng**, email & đơn vị có **ổ khóa**.

### 4.4 Màn Home

| # | Yêu cầu | Hiện trạng |
|---|---|---|
| 1 | Hero "CHÀO MỪNG ĐẾN VỚI DataVerse" + 3 bullet (Phân tích thông minh / Đảm bảo chất lượng / Tối ưu quy trình) | 🟡 hero khác bố cục (copy + stage + card universe) |
| 2 | "Tổng quan hoạt động": **5 stat có delta** (12 +20% · 48 +33% · 8 +14% · 26 +8% · 14 +75%) + **donut "Phân bố Project theo trạng thái"** + **bar "Số lượng Project theo Workspace"** + select "30 ngày gần nhất" | 🟡 `homeStatsFor` trả **6 stat, delta rỗng**, không có donut/bar nào trong panel này |
| 3 | **Workspaces gần đây: 3 cột × 4 hàng, cuộn tới đáy thì chuyển trang (24–36 nút/trang)** — con số "3 cột" lấy từ `home/đặc tả.txt`, file này nay đã về 0 byte nên **căn cứ duy nhất còn lại là mockup (5 cột)**; xem mục 9 câu 5 | ❌ hiện `.slice(0, 3)` và **không phân trang** (`home-2d.view.tsx:172`) |
| 4 | Lưới nút workspace dạng **chip lớn** (icon · tên · N Projects · thời gian · `>`), 5 cột trên mockup | 🟡 đang là `mini-card` (ảnh cover + mô tả + 3 project con) — **khác hình thái** |
| 5 | **Projects gần đây: 5 mục, cuộn + chuyển trang trong khung** | 🟡 đúng 5 mục (`slice(0,5)`) nhưng **không phân trang** |
| 6 | Bảng project có cột **# · Tệp dữ liệu** | ❌ thiếu cả 2 cột |
| 7 | Menu ⋯ project: Mở Project · Xem thông tin · Đổi tên · Lưu trữ Project · Xóa Project — **bỏ "Sao chép liên kết"** | ❌ vẫn còn `copy-link` (`preview-menu.ts:76`) |
| 8 | Sidebar footer (ring dung lượng, "Không gian hiện tại") | ❌ **đã chốt: BỎ** (mục 9 câu 4) — code còn tại `preview-shell.tsx:159-166` kèm 2 test `preview-shell.test.tsx:202` / `:213` |

### 4.5 Màn Workspaces (thư mục `workspaces/`)

| # | Yêu cầu từ mockup | Hiện trạng |
|---|---|---|
| 1 | 5 stat: Tổng Workspace · Tổng Project · Sở hữu · Được chia sẻ · Thành viên (`+12%`) | 🟡 đang 4 stat, thiếu "Thành viên" + delta |
| 2 | Toolbar: **ô tìm riêng "Tìm kiếm Workspace" + 3 select** (quyền sở hữu / vai trò / sắp xếp) + toggle lưới–danh sách | ❌ đang dùng `FilterTabs`; "Bộ lọc" **đang tắt** (`workspaces-2d.view.tsx:248`) |
| 3 | Bộ lọc quyền sở hữu: Tất cả / Workspace sở hữu / Được chia sẻ (khung 4) | ❌ |
| 4 | Bộ lọc vai trò: Owner / Admin / Member / Viewer (khung 5) | ❌ |
| 5 | Sắp xếp: Truy cập · Tạo · Cập nhật gần nhất · Tên A→Z · Z→A (khung 6) | ❌ |
| 6 | Tìm kiếm + kết quả sau lọc (khung 7–8) | 🟡 có tìm qua topbar, không có "chip lọc đang áp dụng" |
| 7 | **Tạo Workspace**: tên · mô tả · thành viên ban đầu + **gợi ý email** (khung 2) → thành công (khung 3) | ❌ nút đang tắt |
| 8 | Phân trang "Hiển thị 1–10 của 12" + **chọn số dòng** | ❌ trang Workspaces chưa có dải phân trang |
| 9 | Dialog **Thông tin Workspace**: counter `9 / 100`, `63 / 500`, block chủ sở hữu/ngày tạo/cập nhật/số TV/số Project | ❌ panel chi tiết đang là tab, không phải dialog có counter |
| 10 | Dialog **Quản lý thành viên**: "32 thành viên", tìm theo tên/email, lọc vai trò, bảng `# · Thành viên · Vai trò · Ngày tham gia · Thao tác`, phân trang 8 | ❌ đang chỉ `memberPreview` 3–4 người + nút tắt |

### 4.6 Màn Project (thư mục `projects/`)

| # | Yêu cầu | Hiện trạng |
|---|---|---|
| 1 | Breadcrumb `Workspaces > Acme Corp > Sales Analytics` + nút **Quay lại** | 🟡 có eyebrow "Cấp 2 · Dự án trong …", không có breadcrumb |
| 2 | Header project: **dataset card** (tên file · MB · dòng · cột) + nút ⋯ | 🟡 thông tin dataset nằm trong body card, không có header card |
| 3 | Tab bar dưới: **Tổng quan · Data View · Data Analysis · Detection** | ❌ chưa có |
| 4 | *đặc tả.txt*: bấm 4 tab này **hành xử như bấm khối 3D của T** (→ `/preview/workspaces-3d`) | ❌ (chỉ có nút "Mở Dataset Universe") |
| 5 | Menu ⋯: **Thông tin Project · Quản lý thành viên · Xóa Project** | ❌ menu hiện có 9 mục, không khớp 3 mục của ảnh |
| 6 | Dialog **Thông tin Project** 3 tab (Thông tin chung / Dataset / Lịch sử hoạt động) + nút **Chỉnh sửa** | 🟡 panel chi tiết có tab tương đương nhưng không phải dialog, không có chế độ chỉnh sửa |
| 7 | Dialog **Quản lý thành viên** (+ Thêm thành viên, bảng vai trò) | ❌ nút "Quản lý thành viên" đang tắt |
| 8 | Dialog **Xác nhận Xóa Project** (nói rõ kèm dataset, không hoàn tác) | 🟡 đã có `preview-dialog.tsx` mode `remove`, nhưng dòng chữ khác ảnh |

### 4.7 Trang chi tiết Workspace (`workspaces detail/`)

| # | Yêu cầu | Hiện trạng |
|---|---|---|
| 1 | Header workspace: Owner chip · Ngày tạo · Cập nhật · Thành viên · ⋮ (Thông tin / Quản lý TV / **Xóa Workspace**) | ❌ chưa có màn chi tiết workspace riêng (đang là panel bên phải) |
| 2 | 4 stat: Tổng Project (+27%) · Chưa xử lý (+50%) · Đang xử lý (+20%) · Đã hoàn thành | ❌ |
| 3 | **Tiến độ Project theo thời gian** (stacked bar Tháng 1–5) | ❌ |
| 4 | **Phân bố trạng thái Project** (donut + %) | 🟡 donut đang nằm ở Home ("Phân bố tập dữ liệu"), khác trục |
| 5 | Toolbar: tìm project · lọc trạng thái · sắp xếp · **Tạo Project** + bảng project phân trang | 🟡 bảng project có nhưng ở tab panel, không phân trang |
| 6 | **Wizard Tạo Project 4 bước**: Thông tin → Import Dataset (drag/drop, CSV/Excel/JSON ≤500MB) → Thêm thành viên (chỉ TV của workspace) → Xác nhận | ❌ |
| 7 | Dialog **Xóa Workspace?** + **Tạo Project thành công** (Xem Project / Tạo Project khác) | ❌ |

---

## 5. Ghi chú kỹ thuật rút ra khi khảo sát

### 5.1 Nền tinh vân (đặc tả dòng 1) — ĐẠT
`preview.css:141-147` đã đặt `url('../../assets/universe-backdrop.png') center / cover` cho toàn frame, phủ bằng 2 lớp gradient để giữ tương phản chữ ≥ 4.5:1 (test `preview-constraints.test.ts:152`). "Màn phụ làm mờ" đạt qua blur phân lớp: popover 24px, dialog 30px, toast 18px, scrim 3px, và có fallback cho `prefers-reduced-transparency`.
⚠ **Không** thêm blur vào sidebar/topbar — đã có chú thích trong CSS giải thích vì sao (tạo containing block làm tooltip `position:fixed` lệch).

### 5.2 Trục tương tác mới: "trong ô" vs "cả trang"
Đây là thay đổi lớn nhất của đợt này. Toàn bộ frame hiện đang thiết kế theo mô hình **popover = lối vào, trang = nội dung**. Đặc tả mới đảo ngược: **popover = nội dung**. kéo theo:
- `notifications-2d.view.tsx` phải tách phần render để dùng làm nội dung popover.
- Cần một primitive "panel có điều hướng nội bộ" (stack list→detail→form trong cùng ô) — chưa tồn tại.
- Route full-page `/preview/notifications` vẫn còn giá trị (F5, chia sẻ link) nhưng **không còn là đích bấm** của chuông.

### 5.3 Reference đã mục
4 vị trí trong mã nguồn/test còn dẫn chứng cứ **không còn tồn tại** trong `UI-UX/`:
`preview-topbar.tsx:9` (Specification.png), `preview-data.ts:236` (Specification.png mục 1), `preview-fixtures.ts:236` ("mục 7 Global Application Shell"), `preview-shell.test.tsx:123` ("tám vùng").
→ Cập nhật chú thích sang `DataVerse Global UI Design Board.png` + `đặc tả.txt` để lần sau không "nghiệm thu theo ảnh ma".

---

## 6. Quality gate (kết quả chạy thật, hồi 02/11 ~13:00)

| Gate | Lệnh | Kết quả |
|---|---|---|
| ESLint | `yarn lint` | ✅ `Done in 16.00s`, 0 warning |
| TypeScript | `npx tsc -b` | ✅ exit 0 |
| Test | `yarn test` | ✅ **23 files / 385 tests passed**, 34.99s |

Test sẽ **phải đổi** khi làm theo đặc tả mới (đây là tín hiệu tốt — chúng đang chốt hành vi cũ):

| Test | Dòng | Nội dung cũ | Hành vi mới buộc đổi |
|---|---|---|---|
| `preview-shell.test.tsx` | 136 | "trợ giúp + Báo cáo vấn đề **còn tắt** kèm lý do" | `?` bật, có luồng Reports |
| `preview-interactions.test.tsx` | 257 | bấm dòng chuông **mở màn chi tiết** (route) | mở chi tiết **trong popover** |
| `preview-interactions.test.tsx` | 274 | "Xem tất cả thông báo" → `hash === '#/preview/notifications'` | chuyển nội dung **trong ô**, không đổi route |
| `preview-interactions.test.tsx` | 241 | menu project có "Sao chép liên kết" và dán ra link đúng | đặc tả bỏ mục này khỏi menu project |
| `preview-shell.test.tsx` | 95 | Settings → toast "chưa có trong batch 2D" | Settings → route `/preview/settings` + tab Accounts |
| *(chưa có test)* | — | Home render 3 workspace, không phân trang | **cần viết mới**: 3 cột × 4 hàng + chuyển trang |

---

## 7. Khảo sát "dữ liệu xấu" (theo quy trình skill `break-ui`)

Phạm vi áp dụng: **Phase 1 (map surface) + Phase 2 (worst case) + Phase 4 (đọc CSS suy hỏng hóc)**. **Chưa** nối toggle Demo/Worst-case (Phase 3) vì đó là thay đổi code, chờ xác nhận ở mục 9.

Giới hạn phương pháp: không có browser trong lần khảo sát này → các mục đánh dấu *(suy từ CSS)* chưa được đo pixel; chỉ các mục có test/`yarn test` che mới là đã kiểm chứng.

| # | Mức | Trường / nguồn | Giá trị xấu nhất hợp lý | Điều gì xảy ra | Fix (file) |
|---|---|---|---|---|---|
| 1 | Broken | `workspace.name`, `project.name` *(suy từ CSS)* | 100 ký tự không dấu cách (đặc tả đối tác ghi `9 / 100` → trần 100) | `.card-title`/`.row-name` truncate nhưng **không có `title`/tooltip** → không đọc được toàn bộ | thêm `title=` + clamp 2 dòng, `preview-primitives.tsx` |
| 2 | Broken | `project.members` | mảng rỗng `[]` | `.avatar-stack` render rỗng + **`+3` hardcode** (`projects-2d.view.tsx:90`) → hiện "+3" vô nghĩa | bỏ `+3` cứng, suy từ `members.length - shown` |
| 3 | Broken | `dataset.fileName` | `Q3-2026-ban-chinh-thuc-final-v12-so-hop-nhat.csv` | tên file khác nhau ở **giữa** bị cắt đuôi giống hệt nhau | truncate giữa (middle-ellipsis) cho tên file |
| 4 | Ugly | số đếm | `1` | "1 dự án", "12 tập dữ liệu" — tiếng Việt không chia số nhiều, nhưng `+{n}`/`({n})` ghép chuỗi thủ công ở nhiều chỗ → dễ lệch khi thêm đơn vị "người/phiên" | tập trung vào 1 hàm format, `preview-data.ts` |
| 5 | Ugly | `person.name` | " Aleksandra Wiśniewska-Kowalczyk" / tên bắt đầu bằng emoji | `initials` là hằng số viết tay trong fixture (`preview-fixtures.ts:10-15`) → **không suy từ name**, nếu API thật trả tên khác thì avatar nói dối | `Intl.Segmenter` + fallback icon khi nối fixture |
| 6 | Ugly | ngày | `createdAt: '12/03/2024'` vs `updatedAt: '2 giờ trước'` | cùng một bảng 2 kiểu thời gian (đã có chú thích thừa nhận ở `preview-fixtures.ts:99`) — màn chi tiết WS ảnh mới yêu cầu **cả hai** kiểu tuyệt đối (`12/03/2025, 09:30`) | quy ước lại: cột so sánh → tuyệt đối |
| 7 | Fragile | `workspace.description` | 500 ký tự (trần `63 / 500` của ảnh) | `.card-desc` không clamp → thẻ phình, lệch grid row height | `line-clamp: 2` |
| 8 | Fragile | `notification.title` | 120 ký tự | popover chuông rộng cố định → dòng tràn/dồn chữ | đo lại ở 320px + zoom 200% |
| 9 | Fragile | số lớn | `rows: 2_050_000` | `formatRows` ra "2.1M dòng" (mất thông tin) nhưng bảng lại dùng `toLocaleString('en-US')` ở `projects-2d.view.tsx:142` → **hai định dạng cho một con số** trong cùng màn | một hàm format duy nhất |
| 10 | Fragile | danh sách dài | 1.000 workspace (mock 12) | trang Workspaces **không phân trang** → render hết; thêm 24–36 nút/trang ở Home sẽ làm số DOM node tăng gấp đôi | phân trang thật (đã nằm trong yêu cầu 4.4/4.5) |
| 11 | Fragile | phân vị | `tabular-nums` | stat card đổi số khi lọc → chữ nhảy ngang | thêm `font-variant-numeric: tabular-nums` vào token CSS |
| 12 | Fragile | input tiếng Việt | dấu thanh + ký tự dài (`Nguyễn`, `Wiśniewska`) | các ô có `overflow: hidden` + line-height chặt dễ **cắt đỉnh/dấu** | kiểm bằng browser ở zoom 200% |

**Đã chịu được (không cần đụng)** — ghi lại để lần sau không sửa nhầm:
- Nút `disabled` nào cũng có lý do nhìn thấy (`aria-describedby` → note thật), test `preview-views.test.tsx:103` + `preview-notifications.test.tsx:284` đang che.
- Empty state có lối ra (`EmptyHint` + hướng dẫn đổi tab/từ khóa).
- Clipboard bị chặn → nói rõ thay vì im lặng (`use-preview-session.ts:157`).
- id trong URL không tồn tại → trang nói rõ, không trắng (`notifications-2d.view.tsx:196`).
- Toàn bộ mutation có Hoàn tác, số liệu trên tab/stat **suy từ store** chứ không viết tay.
- Scrollbar, sticky panel, thu sidebar ở 820px, Ctrl+K, focus return sau Esc — đều đã có test.

---

## 8. Kế hoạch phần còn lại (2D, theo thứ tự ưu tiên)

| Batch | Việc | Liên quan | Est |
|---|---|---|---|
| **B1 — Shell interaction** | Notification popover "trong ô" (tabs + tìm + bulk + phân trang 36 + detail); bỏ `copy-link` khỏi menu project ở Home; popover chuông lọc "chưa đọc" | 4.1, 4.4#7 | 1,5 ngày |
| **B2 — Report an Issue + dọn shell** | Nút `?` (`name="report"` → icon `?`, bỏ `disabled`, tách khóa icon với nút Trợ giúp); panel 2 chế độ (Tạo mới / Danh sách 6 mỗi trang + tab trạng thái + chi tiết); mock store + undo + toast. **Kèm: xóa sidebar footer** `preview-shell.tsx:159-166` + 2 test, dọn `formatStorageGb`/`storageUsage` | 4.2, 9#3, 9#4 | 2,5 ngày |
| **B3 — Settings → Accounts** | Route `/preview/settings` + nhánh **Accounts** 3 tab (Bảo mật **không 2FA** · Đăng nhập & phiên · Tùy chọn thông báo) + màn Hồ sơ cá nhân (email/chức vụ khóa) | 4.3 | 2 ngày |
| **B4 — Home theo đặc tả** | Workspaces gần đây **lưới + phân trang** (số cột chờ chốt câu 5; đề xuất 5×4=20); Projects gần đây phân trang trong khung; thêm cột `#` và `Tệp dữ liệu`; stat delta + donut + bar | 4.4 | 1,5 ngày |
| **B5 — Workspaces** *(nghiệm thu thuần theo ảnh — đã chốt)* | 3 bộ lọc (quyền sở hữu/vai trò/sắp xếp) + ô tìm riêng; form **Tạo Workspace + gợi ý email**; phân trang; dialog Thông tin (counter) + Quản lý thành viên (bảng + phân trang) | 4.5 | 2,5 ngày |
| **B6 — Project** | Tab bar 4 mục → cùng hành vi với khối 3D (đã xác nhận, `projects/đặc tả.txt` không rỗng); menu ⋯ còn 3 mục; dialog Thông tin/Thành viên/Xóa | 4.6 | 1,5 ngày |
| **B7 — Workspace detail + wizard** *(theo ảnh)* | Màn chi tiết workspace (header, 4 stat, 2 biểu đồ, bảng project phân trang) + **wizard Tạo Project 4 bước** | 4.7 | 3 ngày |
| **B8 — Dọn chứng cứ** | Sửa 4 chú thích dẫn `Specification.png`/`structure_ui`; nhãn "tám vùng" trong test; gate `break-ui` (toggle Demo/Worst-case dev-only) **chờ duyệt câu 7** | 5.3, 7 | 0,5 ngày |

Tổng ~15 ngày công. Sau hồi 13:07, **câu 1–4 và 6 đã chốt → B1–B3 không còn bị chặn**; chỉ còn câu 5 (số cột Home, chặn B4 một dòng CSS) và câu 7 (chặn B8 một phần). B1 vẫn nên làm trước vì nó là trục hành vi mà các batch sau chiếu theo.

---

## 9. Câu hỏi — cập nhật sau khi nhóm trưởng trả lời (02/11, hồi 13:07)

| # | Câu hỏi | Kết luận | Ảnh hưởng tới code |
|---|---|---|---|
| 1 | `projects/đặc tả.txt` rỗng? | **Nhóm trưởng nói không rỗng — đúng.** File có 230 byte / 1 dòng. Báo cáo sơ bản của tôi ghi "0 byte" là **lỗi của tôi**: `Format-Table` làm tròn 230 byte thành `0 KB`. Đã sửa lại ở mục 2. | Không đổi yêu cầu: tab bar 4 mục → cùng hành vi `openUniverse()` |
| 2 | `workspaces/` + `workspaces detail/` không có `đặc tả.txt`? | **Chốt: nghiệm thu thuần theo ảnh.** 5 ảnh trong 2 thư mục đó là chuẩn mực, không chờ text. | B5/B6/B7 làm theo ảnh; mọi suy diễn ngoài ảnh phải ghi chú thích ngay trong code |
| 3 | Nút báo cáo: `?` / chữ / icon tài liệu? | **Chốt: icon `?`** (+ tooltip + `aria-label`). | `preview-topbar.tsx:294` đổi `name="report"` → `name="help"` và bỏ `disabled` (giữ `aria-label="Báo cáo vấn đề"`). **Cảnh báo va chạm icon**: nút "Trợ giúp" ở dòng 298 **đã dùng `name="help"`**, và `preview-icons` sẽ cần `?` cho cả hai → phải tách thành hai khóa (vd `help` = `?` cho Trợ giúp, `report-issue` cũng render `?` nhưng khác aria-label), nếu không test `getByLabelText` sẽ khớp nhầm. Việc này thuộc B2, không phải sửa icon một chiều | 
| 4 | Sidebar footer (ring dung lượng + "Không gian hiện tại")? | **Chốt: BỎ.** | Xóa cả khối `.sidebar-workspace` + `.sidebar-storage` (`preview-shell.tsx:159-166`). **Test phải xóa**: `preview-shell.test.tsx:202-211` (dòng 209 còn quơ `.storage-ring`) và `:213-220` — **không xóa trắng** mà chuyển 2 assertion còn giá trị sang nơi khác: "phạm vi bỏ chọn → combobox báo 'Tất cả không gian'" (dòng 219) vẫn đúng, chỉ phần `.sidebar-workspace-value` (218) là bỏ. `formatStorageGb`/`storageUsage` (`preview-data.ts:66`) +chú thích "3072 = mức trần mẫu của gói lưu trữ" thành code chết → `tsc -b` + lint sẽ báo, dọn luôn |
| 5 | Lưới Workspaces gần đây mấy cột? | **Vẫn mở** — và nay **mất căn cứ text** vì `home/đặc tả.txt` về 0 byte (phụ lục A). Chỉ còn mockup = **5 cột**. Đề xuất: **5 cột × 4 hàng = 20 nút/trang**, select "Số dòng" 12/20/36 (khớp đúng mockup + khớp cơ chế phân trang đã có ở trang Projects). | `home-2d.view.tsx:172` `.slice(0, 3)` → grid + `page`/`perPage` |
| 6 | "Phân trang trong ô" vs "chuyển trang"? | **Không mâu thuẫn**: quy tắc "chỉ trong ô" áp cho **popover** (thông báo, báo cáo); còn Home là **trang thật** nên phân trang tại chỗ trong panel là đúng. | B1 (popover) và B4 (Home phân trang) là hai phạm vi riêng, không cào bằng |
| 7 | break-ui Phase 3 (toggle Demo/Worst-case)? | **Chưa trả lời** — vẫn chờ. | Tạm chưa nối; chỉ giữ bảng phát hiện mục 7 |

### Hệ quả của việc `home/đặc tả.txt` về 0 byte
Ba yêu cầu 2D **chỉ tồn tại trong file đó**, không có trong ảnh:
1. Lưới Workspaces gần đây **có phân trang** (24–36 nút/trang) — mockup chỉ vẽ 20 nút, không vẽ dải phân trang.
2. Projects gần đây **5 mục + chuyển trang trong khung** — mockup vẽ **10 dòng**, nếu tin ảnh là đi sai đặc tả.
3. Menu ⋯ project **bỏ "Sao chép liên kết"** — ảnh `Screenshot from 2026-11-01 15-39-24.png` vẫn **còn** mục này, text mới là thứ bắt bỏ.
→ Đã mô tả lại các yêu cầu ở **phụ lục A** (kèm mức độ chắc chắn của từng dòng); đề nghị nhóm trưởng **paste lại vào file** (tôi không tự ghi đè vì bạn ấy đang mở file này).

---

## 10. Kết luận nghiệm thu

- **Đạt có kiểm chứng**: quality gate (lint/type/385 test), ràng buộc shell (sidebar 3 mục, topbar 7 vùng, nhãn EN/nội dung VI), nền tinh vân + blur phân lớp + reduced-transparency, toàn bộ nút tắt đều có lý do nhìn thấy, mock store + Hoàn tác nhất quán.
- **Chưa đạt**: 6/10 nhóm yêu cầu mới (4.1 → 4.7), trong đó **3 nhóm là thay đổi hành vi cốt lõi** (popover-at-chỗ, `?`/Reports, Settings→Accounts) — không thể coi là "polish".
- **Rủi ro lớn nhất**: (a) hiểu nhầm "chỉ trong ô" thành điều hướng trang như hiện tại; (b) chú thích trong code đang tham chiếu ảnh đã bị xóa; (c) `UI-UX/home/đặc tả.txt` bị về 0 byte **sau** lần khảo sát đầu → 3 yêu cầu chỉ còn căn cứ ở phụ lục A; (d) `UI-UX/` không được git track nên mọi mất mát text đều **không có lối về** (recycle bin và local history đều trống).
- **Boundary với batch T**: không sửa `auth-login`, không sửa scene 3D `/preview/workspaces-3d`; riêng tab bar 4 mục ở màn Project chỉ **nối hành vi** vào `openUniverse()` đã tồn tại, không đụng phần của T.

Báo cáo này tự tạo/ghi tại `docs/report/uiux_2d_acceptance_report_v1.md`.

---

## Phụ lục A — Khôi phục `UI-UX/home/đặc tả.txt`

File này còn 7 dòng lúc **02/11 12:30** (tôi đã đọc trong phiên khảo sát đầu), đến **02/11 13:07** thì còn **0 byte**. `UI-UX/` không được git track, không có trong recycle bin, không có local history của editor.

**Minh bạch về mức độ khôi phục** — tôi không giữ bản nguyên văn toàn file, chỉ giữ các **yêu cầu** đã rút ra từ nó (bản ghi đầy đủ nằm trong mục 4.4). Phần phục hồi được chắc chắn:

```text
- Phần Workspaces gần đây sẽ trải thành 3 cột và 4 hàng mỗi trang. Cho phép người dùng
  cuộn tới cùng thì chuyển trang được. Số trang mỗi lần hiển thị từ 24 - 36 nút phân trang
- Phần Projects gần đây hiển thị 5 mục, cũng cuộn và chuyển trang ngay trong khung đó
- menu ⋯ của project cũng làm theo ảnh nhưng bỏ nút "Sao chép liên kết"
```

Ba dòng trên khớp 1-1 với hàng 3, 5, 7 của mục 4.4. Bốn dòng còn lại của bản gốc **không phục hồi được**, nhưng dấu vết của chúng còn trong mục 4.4:

| Dòng gốc (suy lại) | Evidence trong báo cáo | Cần làm gì |
|---|---|---|
| Mô tả **lưới nút workspace dạng chip** (icon · tên · N Projects · thời gian · `>`), 5 cột trên mockup | hàng 4 mục 4.4 | Chốt số cột (câu 5 mục 9) |
| Ghi chú về **ảnh nền** tinh vân cho mọi màn | mục 5.1 | Đã code xong, không còn mở |
| Ghi chú về **sidebar / thứ tự ưu tiên** | hàng 8 mục 4.4 ("Sidebar footer: mockup không vẽ → cần quyết định giữ/bỏ") | **Rất có thể đây chính là dòng trả lời cho câu 4** — nhóm trưởng đã ghi "bỏ footer" trong file, nên mới chốt BỎ. Nếu đúng thì câu 4 không phải quyết định mới, mà là thi hành đặc tả |

→ Đề nghị nhóm trưởng **paste lại nội dung vào `UI-UX/home/đặc tả.txt`** (tôi không tự ghi đè vì bạn ấy đang mở file này). Ràng buộc mới rút ra: **text đặc tả phải được git track hoặc copy vào `docs/`**, nếu không mỗi lần ghi đè nhầm là mất vĩnh viễn (xem mục 10, rủi ro d).
