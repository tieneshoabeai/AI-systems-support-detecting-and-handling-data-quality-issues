# 06. LUỒNG NGHIỆP VỤ (BUSINESS FLOWS)

**Nguồn:** [feature_spec_v4](../feature_spec_v4.md), [04_yeu-cau-chuc-nang](04_yeu-cau-chuc-nang.md), [auth-session plan FE](../../src/frontend/.agents/auth-session/implementation-plan.md)
**Ký hiệu làn (swimlane):** `[User]` người dùng · `[FE]` giao diện web · `[BE]` backend API · `[DB]` MongoDB · `[Graph]` Neo4j · `[Storage]` lưu trữ đối tượng · `[Mail]` dịch vụ email · `[Google]` Google Identity.
**Cách dùng để vẽ:** mỗi luồng là một Activity Diagram (làn = ký hiệu trong ngoặc vuông); bước rẽ nhánh `◇` là nút quyết định; luồng lỗi `E<k>` là nhánh thoát từ bước tương ứng. Luồng xử lý chi tiết bên trong từng API xem tại 07.

---

## 6.1. Luồng nghiệp vụ tổng thể

### BF-1. Vòng đời xử lý chất lượng dữ liệu (luồng chính của hệ thống)

```
1. [User] Đăng nhập (BF-2)
2. [User] Tạo hoặc chọn Workspace (UC-3.1 / UC-3.2)
3. [User] Tạo hoặc chọn Project trong Workspace (UC-4.1 / UC-4.2)
4. [User] Tải tệp dữ liệu lên Project (UC-5.1) → hệ thống tạo Dataset + phiên bản v1
5. [User] Khám phá dữ liệu: xem Data Grid, lọc, sắp xếp (UC-6.1); xem thống kê cột để phát hiện lỗi (UC-6.2)
6. ◇ Dữ liệu còn lỗi chất lượng?
   6a. Có  → [User] Chọn phép làm sạch → chạy thử (UC-7.2) → xem trước/sau
            ◇ Kết quả chấp nhận được?
              - Có    → Áp dụng (UC-7.1) → hệ thống tạo phiên bản mới → quay lại bước 5
              - Không → điều chỉnh tham số → chạy thử lại
   6b. Không → sang bước 7
7. ◇ Cần quay lại trạng thái cũ? → Có: xem lịch sử (UC-8.1) → Rollback (UC-8.2) → quay lại bước 5
8. [User] (tùy chọn) Xem đồ thị lineage (UC-8.3), kiểm tra toàn vẹn (UC-8.4)
9. [User] Xem trước dữ liệu sạch (UC-9.3)
10. ◇ Hình thức xuất bản?
    - Tải về → UC-9.1 (tùy chọn mã hóa)
    - Lưu thành Dataset mới → UC-9.2
11. Kết thúc
```

### BF-2. Vòng đời phiên đăng nhập

```
1. [User] Mở ứng dụng
2. [FE] ◇ Có phiên lưu trên trình duyệt?
   - Không → hiển thị trang đăng nhập → bước 3
   - Có    → [FE] gọi lấy hồ sơ (UC-2.1) để xác minh phiên
             ◇ Hợp lệ? Có → vào trang chính (bước 5). Không → xóa phiên cục bộ → bước 3
3. [User] Đăng nhập bằng email (UC-1.2) hoặc Google (UC-1.3)
4. [FE] Lưu access token, refresh token, sessionId; lấy quyền (UC-1.9) → hiển thị menu theo quyền
5. [User] Làm việc bình thường
6. [FE] Access token sắp hết hạn (15 phút) → hiển thị hộp thoại "Tiếp tục phiên / Hủy"
   ◇ Người dùng chọn?
   - Tiếp tục → [FE] gọi làm mới token (UC-1.6) → quay lại bước 5
   - Hủy / Escape / hết thời gian chờ → bước 7
7. [FE] Kết thúc phiên: gọi đăng xuất (UC-1.7); xóa token, thông tin người dùng, cache; khóa bản nháp chưa gửi
8. Quay lại trang đăng nhập

Luồng lỗi:
E1 (bước 6) Refresh token hết hạn / phiên bị thu hồi → 401 → [FE] bước 7 với thông báo "Phiên đã hết hạn"
E2 (bước 6) Tài khoản bị khóa → 403 → [FE] bước 7 với thông báo "Tài khoản đã bị khóa"
E3 (bước 5) Bất kỳ API nào trả 401 do phiên bị thu hồi từ xa (UC-1.8) hoặc đặt lại mật khẩu (UC-1.5) → bước 7
E4 (bước 2) Backend không phản hồi → [FE] hiển thị trạng thái mất kết nối, không xóa phiên, cho thử lại
```

### BF-3. Khôi phục mật khẩu

```
1. [User] Tại trang đăng nhập, chọn "Quên mật khẩu", nhập email
2. [FE] Gửi yêu cầu (UC-1.4)
3. [BE] Luôn trả cùng một thông báo thành công
4. [BE] ◇ Email tồn tại và chưa bị khóa? Có → sinh token (hạn 15 phút) → [Mail] gửi liên kết
5. [User] Mở email, bấm liên kết → [FE] trang đặt lại mật khẩu có sẵn token
6. [User] Nhập mật khẩu mới → [FE] gửi (UC-1.5)
7. [BE] Đổi mật khẩu, đánh dấu token đã dùng, hủy toàn bộ phiên
8. [FE] Thông báo thành công → chuyển về trang đăng nhập

Luồng lỗi:
E1 (bước 7) Token sai / hết hạn / đã dùng → 400 → [FE] báo lỗi, đề nghị yêu cầu liên kết mới (quay lại bước 1)
E2 (bước 6) Mật khẩu mới không đủ độ phức tạp → [FE] báo lỗi tại ô nhập (kiểm tra cả ở FE và BE: 400)
```

### BF-4. Quản trị tài khoản (Admin)

```
1. [Admin] Mở trang quản lý người dùng (chỉ hiển thị khi isAdmin = true)
2. [FE] Lấy danh sách người dùng (UC-2.4), tải thêm bằng nextCursor
3. [Admin] Tìm kiếm / lọc trạng thái → xem chi tiết (UC-2.5)
4. ◇ Hành động?
   - Khóa (UC-2.6) → nhập lý do (tùy chọn) → xác nhận → [BE] khóa + hủy mọi phiên của người đó
   - Mở khóa (UC-2.7) → xác nhận → [BE] mở khóa
5. [FE] Cập nhật trạng thái trong danh sách

Luồng lỗi:
E1 (bước 4) Admin chọn khóa chính mình → 400 → thông báo không được tự khóa
E2 (bước 2) Người gọi không phải Admin → 403 → [FE] chuyển về trang chính
```

### BF-5. Xóa mềm và khôi phục tài nguyên

```
1. [User] Chọn xóa Workspace / Project / Dataset → [FE] hộp thoại xác nhận, nêu rõ phạm vi bị ảnh hưởng
2. ◇ Loại tài nguyên?
   - Workspace (UC-3.5) → [BE] ghi deleted_at cho Workspace, mọi Project và Dataset con
   - Project   (UC-4.5) → [BE] ghi deleted_at cho Project và Dataset (nếu có)
   - Dataset   (UC-5.3) → [BE] ghi deleted_at cho Dataset; Project được giải phóng (hasDataset = false)
3. [FE] Ẩn tài nguyên khỏi danh sách
4. (Khôi phục) [User] Chọn khôi phục Workspace (UC-3.6) hoặc Project (UC-4.6)
5. [BE] Đặt deleted_at = null cho tài nguyên (và Project con nếu là Workspace); Dataset KHÔNG được khôi phục (đã chốt) → người dùng tải lại tệp (UC-5.1)
6. [FE] Hiển thị lại tài nguyên

Luồng lỗi:
E1 (bước 2) Không phải chủ sở hữu → 403
E2 (bước 5) Khôi phục Project khi Workspace cha còn bị xóa → 409 [GIẢ ĐỊNH, xem FR-4.6]
E3 (bước 5) Tên trùng với Workspace/Project đang hoạt động → 409 (đã chốt) → [FE] gợi ý đổi tên bản ghi đang hoạt động rồi khôi phục lại
```

### BF-6. Tải tệp với bản nháp ngoại tuyến (Frontend)

```
1. [User] Chọn tệp để tải lên Project
2. [FE] Kiểm tra sơ bộ phần mở rộng và dung lượng (≤ 50 MB CSV/JSON, ≤ 20 MB XLSX)
3. [FE] Lưu tệp thành bản nháp trong IndexedDB theo tài khoản
4. [FE] ◇ Backend sẵn sàng và phiên còn hạn?
   - Có    → gửi tệp (UC-5.1) → nhận phản hồi thành công → xóa bản nháp
   - Không → giữ bản nháp, hiển thị "Chưa gửi được, sẽ gửi khi có kết nối"
5. [User] Khi có kết nối, mở lại bản nháp và gửi → quay lại bước 4

Luồng lỗi:
E1 (bước 3) Vượt hạn mức bản nháp (50 MiB/tệp, 200 MiB/tài khoản, 500 MiB/ứng dụng) → không lưu, thông báo dung lượng
E2 (bước 4) Backend trả 409 (Project đã có Dataset) hoặc 422 (vượt dòng/cột) → giữ bản nháp, hiển thị lý do; không tự gửi lại
E3 (bước 4) Người dùng đăng xuất khi còn bản nháp → bản nháp bị khóa, chỉ mở lại khi đăng nhập đúng tài khoản
```

---

## 6.2. Luồng use case theo module

Mỗi use case gồm: actor, tiền điều kiện, hậu điều kiện, luồng chính, luồng lỗi. Các lỗi chung áp dụng mọi use case cần đăng nhập, không nhắc lại ở từng use case:
- **EC-1** Access token thiếu/hết hạn → `401` → BF-2 bước 6/7.
- **EC-2** Không có quyền trên tài nguyên → `403` → [FE] thông báo "Bạn không có quyền thực hiện thao tác này".
- **EC-3** Dữ liệu nhập sai định dạng → `400` → [FE] hiển thị lỗi tại trường tương ứng.
- **EC-4** Mất kết nối backend → [FE] thông báo, cho thử lại, không mất dữ liệu đang nhập.

### M1. Xác thực

**UC-1.1 Đăng ký**
- Actor: Guest. Tiền điều kiện: chưa đăng nhập. Hậu điều kiện: tài khoản `DATA_ANALYST` được tạo.
```
1. [User] Mở trang đăng ký, nhập email, mật khẩu, họ tên
2. [FE] Kiểm tra định dạng, độ phức tạp mật khẩu
3. [BE] Chuẩn hóa email, kiểm tra trùng, băm mật khẩu, tạo tài khoản
4. [FE] Thông báo thành công → chuyển sang trang đăng nhập
E1 (3) Email đã tồn tại → 409 → [FE] "Email đã được sử dụng"
```

**UC-1.2 Đăng nhập email** — xem BF-2 bước 3–4.
```
E1 Sai email/mật khẩu → 401 → [FE] "Email hoặc mật khẩu không chính xác"
E2 Tài khoản bị khóa → 403 → [FE] "Tài khoản của bạn đã bị khóa bởi Quản trị viên"
```

**UC-1.3 Đăng nhập Google**
```
1. [User] Bấm "Đăng nhập với Google" → [Google] xác thực, trả ID token cho [FE]
2. [FE] Gửi ID token
3. [BE] Xác minh token với Google → tìm hoặc tạo tài khoản → tạo phiên
4. [FE] Như BF-2 bước 4
E1 (3) Token không hợp lệ → 401. E2 (3) Email Google chưa xác minh → 400. E3 (3) Tài khoản bị khóa → 403
E4 (1) Người dùng đóng cửa sổ Google → [FE] giữ nguyên trang đăng nhập
```

**UC-1.4 / UC-1.5** — xem BF-3. **UC-1.6, UC-1.7** — xem BF-2.

**UC-1.8 / UC-1.10 Quản lý phiên đăng nhập**
- Actor: Authenticated User. Hậu điều kiện: phiên được chọn không còn dùng được.
```
1. [User] Mở trang "Thiết bị đăng nhập"
2. [FE] Lấy danh sách phiên (UC-1.10); đánh dấu phiên hiện tại
3. [User] Chọn một phiên lạ → "Thu hồi" → xác nhận
4. [BE] Kiểm tra phiên thuộc về người dùng → xóa phiên
5. [FE] Bỏ phiên khỏi danh sách
E1 (4) Phiên không tồn tại → 404 → [FE] làm mới danh sách
E2 (3) Chọn thu hồi phiên hiện tại → [FE] xử lý như đăng xuất (BF-2 bước 7)
```

**UC-1.9 Lấy quyền** — gọi tự động sau đăng nhập (BF-2 bước 4).

### M2. Người dùng

**UC-2.1 / UC-2.2 Xem và cập nhật hồ sơ**
```
1. [User] Mở trang hồ sơ → [FE] lấy hồ sơ (UC-2.1)
2. [User] Sửa họ tên / ảnh đại diện → Lưu
3. [BE] Cập nhật (bỏ qua email, vai trò nếu có gửi lên)
4. [FE] Hiển thị thông tin mới
E1 (2) Họ tên < 2 hoặc > 100 ký tự, URL ảnh không hợp lệ → 400
```

**UC-2.3 Đổi mật khẩu**
```
1. [User] Nhập mật khẩu hiện tại, mật khẩu mới, xác nhận mật khẩu mới
2. [FE] Kiểm tra mật khẩu mới = xác nhận, đủ độ phức tạp
3. [BE] So khớp mật khẩu hiện tại → kiểm tra mới ≠ cũ → băm và lưu
4. [FE] Thông báo thành công
E1 (3) Sai mật khẩu hiện tại → 400 "Mật khẩu hiện tại không đúng"
E2 (3) Mật khẩu mới trùng mật khẩu cũ → 400
E3 (2) Xác nhận không khớp → [FE] báo lỗi, không gửi request
```

**UC-2.4 → UC-2.7** — xem BF-4.

### M3. Workspace / M4. Project

**UC-3.1 / UC-4.1 Tạo Workspace / Project**
- Tiền điều kiện (Project): Workspace tồn tại, thuộc người dùng.
```
1. [User] Bấm "Tạo mới", nhập tên, mô tả
2. [FE] Kiểm tra độ dài (tên 3–100 ký tự; mô tả Workspace ≤ 500 ký tự)
3. [BE] Kiểm tra trùng tên (trong phạm vi người dùng với Workspace, trong Workspace với Project) → tạo
4. [FE] Thêm vào danh sách, điều hướng tới tài nguyên mới
E1 (3) Trùng tên → 409 → [FE] "Tên đã tồn tại"
E2 (3) (Project) Workspace không tồn tại/đã xóa → 404
```

**UC-3.2, UC-3.3, UC-4.2, UC-4.3 Xem danh sách / chi tiết**
```
1. [User] Mở trang danh sách (có tìm kiếm, phân trang) → chọn một mục
2. [FE] Lấy chi tiết; với Workspace hiển thị các Project, với Project hiển thị tóm tắt Dataset
E1 (2) Tài nguyên đã xóa/không tồn tại → 404 → [FE] "Không tìm thấy", quay về danh sách
```

**UC-3.4 / UC-4.4 Cập nhật** — giống UC-3.1 bước 1–4 với dữ liệu hiện có điền sẵn.
**UC-3.5, UC-3.6, UC-4.5, UC-4.6 Xóa mềm / khôi phục** — xem BF-5.

### M5. Dataset

**UC-5.1 Tải tệp dữ liệu lên**
- Actor: Data Analyst/Admin. Tiền điều kiện: Project thuộc người dùng và **chưa có Dataset**. Hậu điều kiện: Dataset + phiên bản v1 được tạo; Project `hasDataset = true`.
```
1. [User] Tại Project chưa có Dataset, chọn tệp, (tùy chọn) đặt tên Dataset
2. [FE] Kiểm tra sơ bộ, lưu bản nháp (BF-6), gửi tệp dạng multipart
3. [BE] Kiểm tra ràng buộc 1 Project = 1 Dataset
4. [BE] Đọc tệp dạng luồng: tính SHA-256, làm phẳng JSON, suy luận kiểu cột, đếm dòng/cột
5. [BE]→[DB] Lưu bản ghi dữ liệu, metadata, phiên bản v1 (có version_hash); [Graph] tạo nút v1
6. [BE] Cập nhật Project; trả thông tin Dataset và danh sách cột
7. [FE] Xóa bản nháp; chuyển sang Data Grid (UC-6.1)
E1 (3) Project đã có Dataset → 409 → [FE] gợi ý xóa Dataset hiện tại hoặc tạo Project mới
E2 (4) Sai định dạng / vượt dung lượng → 400
E3 (4) Vượt 100 cột hoặc 200.000 dòng → 422 → [FE] nêu rõ giới hạn bị vượt
E4 (4) Tệp hỏng / không đọc được → 400 [GIẢ ĐỊNH] → không lưu dữ liệu dở dang
```

**UC-5.2 Xem thông tin Dataset**: [FE] lấy thông tin khi mở Project. E1: chưa có/đã xóa → 404 → [FE] hiển thị nút "Tải dữ liệu lên".
**UC-5.3 Xóa Dataset** — xem BF-5.

### M6. Trực quan hóa

**UC-6.1 Khám phá dữ liệu trên Data Grid**
```
1. [User] Mở Dataset → [FE] tải trang đầu (page 1, pageSize mặc định) của phiên bản hiện hành
2. [User] Đổi trang / kích thước trang / sắp xếp cột / gõ từ khóa / thêm bộ lọc / chọn phiên bản cũ để xem
3. [FE] Gửi truy vấn với tham số mới
4. [BE] Truy vấn có chỉ mục → trả dòng và tổng số
5. [FE] Hiển thị; giữ trạng thái lọc/sắp xếp khi đổi trang
E1 (3) pageSize ngoài 10–200 hoặc toán tử lọc không hợp lệ → 400
E2 (4) Dataset bị xóa trong lúc xem → 404 → [FE] quay về Project
E3 (4) Không có dòng khớp → [FE] trạng thái rỗng "Không có dữ liệu phù hợp"
```

**UC-6.2 Xem thống kê cột**
```
1. [User] Chọn một cột trên Data Grid → "Thống kê"
2. [BE] Tính thống kê theo kiểu cột (số / chuỗi)
3. [FE] Hiển thị: tỷ lệ rỗng, giá trị duy nhất; cột số: min/max/mean/median/độ lệch chuẩn + histogram; cột chuỗi: top giá trị + tỷ lệ
4. [User] Dựa vào thống kê nhận diện lỗi (rỗng nhiều, ngoại lai, giá trị không nhất quán) → sang UC-7.2
E1 (2) Cột không tồn tại (đã bị xóa/đổi tên ở phiên bản mới) → 404 [GIẢ ĐỊNH] → [FE] làm mới danh sách cột
```

### M7. Biến đổi dữ liệu

**UC-7.2 → UC-7.1 Chạy thử và áp dụng phép làm sạch**
- Tiền điều kiện: Dataset tồn tại; FE biết `currentVersion`. Hậu điều kiện (UC-7.1): phiên bản mới, `currentVersion` tăng 1, có cạnh lineage.
```
1. [User] Chọn phép làm sạch (6 loại), cột đích, tham số
2. [FE] Gửi chạy thử (UC-7.2)
3. [BE] Áp dụng trên mẫu, không ghi dữ liệu → trả 10 dòng trước/sau + số dòng ước tính bị ảnh hưởng
4. [FE] Hiển thị so sánh trước/sau
5. [User] ◇ Chấp nhận? Không → quay lại bước 1. Có → bấm "Áp dụng"
6. [FE] Gửi thực thi (UC-7.1) kèm currentVersion
7. [BE] Kiểm tra khóa lạc quan → ghi dữ liệu → tạo phiên bản mới (lưu công thức, mã băm) → [Graph] thêm cạnh v_old → v_new → tăng currentVersion
8. [FE] Thông báo số dòng bị ảnh hưởng; làm mới Data Grid ở phiên bản mới
E1 (7) currentVersion lệch (người khác/tab khác đã thay đổi) → 409 → [FE] tải lại phiên bản mới nhất, yêu cầu chạy thử lại
E2 (3)/(7) Tham số không hợp lệ (vd. regex sai, cột không tồn tại) → 400
E3 (7) Lỗi khi ghi giữa chừng → giao dịch hủy, dữ liệu và currentVersion giữ nguyên [GIẢ ĐỊNH theo cơ chế transaction/outbox]
```

### M8. Phiên bản & nguồn gốc

**UC-8.1 / UC-8.2 Xem lịch sử và rollback**
```
1. [User] Mở tab "Lịch sử phiên bản" → [FE] lấy lịch sử (UC-8.1)
2. [User] Chọn một phiên bản cũ → (tùy chọn) xem dữ liệu phiên bản đó qua UC-6.1 với tham số version
3. [User] Bấm "Quay về phiên bản này" → [FE] hộp thoại xác nhận
4. [BE] Kiểm tra phiên bản đích hợp lệ → đặt currentVersion = phiên bản đích
5. [FE] Làm mới Data Grid và lịch sử
E1 (4) Phiên bản đích không hợp lệ (≥ currentVersion hoặc không tồn tại) → 400/404
```

**UC-8.3 Xem đồ thị lineage**
```
1. [User] Mở tab "Nguồn gốc dữ liệu"
2. [BE] Đọc đồ thị từ Neo4j → trả nút và cạnh
3. [FE] Vẽ đồ thị (nút = phiên bản, cạnh = phép biến đổi); bấm nút để xem chi tiết phiên bản
E1 (2) Neo4j chưa đồng bộ kịp (outbox đang xử lý) → [FE] hiển thị đồ thị hiện có kèm thông báo "Đang đồng bộ" [GIẢ ĐỊNH]
```

**UC-8.4 Kiểm tra toàn vẹn**
```
1. [User] Bấm "Kiểm tra toàn vẹn"
2. [BE] Tính lại mã băm từ v1 → currentVersion, so sánh với giá trị đã lưu
3. ◇ Chuỗi hợp lệ?
   - Có    → [FE] huy hiệu "Toàn vẹn" + số phiên bản đã kiểm tra
   - Không → [FE] cảnh báo đỏ, chỉ rõ phiên bản bị đứt gãy (brokenVersion)
```

### M9. Xuất bản

**UC-9.3 → UC-9.1 Xem trước và tải tệp**
```
1. [User] Bấm "Xuất dữ liệu" → [FE] lấy xem trước (UC-9.3, 20 dòng)
2. [User] Chọn phiên bản, định dạng (CSV/XLSX/JSON), ◇ có mã hóa? Có → nhập mật khẩu (≥ 8 ký tự)
3. [FE] Gửi yêu cầu tải (UC-9.1)
4. [BE] Đọc dữ liệu theo lô 1.000 dòng → ghi ra luồng (qua AES-256-GCM nếu mã hóa)
5. [FE] Trình duyệt lưu tệp `{tên}_v{phiên bản}.{định dạng}[.enc]`
E1 (2) Bật mã hóa mà thiếu mật khẩu hoặc < 8 ký tự → 400 (FE chặn trước)
E2 (3) Định dạng không hỗ trợ → 400
E3 (4) Mất kết nối giữa chừng → tệp tải về không hoàn chỉnh; [FE] cho tải lại
```

**UC-9.2 Lưu thành Dataset mới**
```
1. [User] Chọn "Lưu thành Dataset mới", chọn phiên bản, nhập tên mới, chọn Project đích
2. [FE] Chỉ liệt kê Project đích chưa có Dataset (hasDataset = false)
3. [BE] Kiểm tra quyền đọc nguồn + quyền ghi đích → kiểm tra Project đích trống → sao chép dữ liệu → tạo Dataset mới (v1)
4. [FE] Thông báo thành công, cho mở Dataset mới
E1 (3) Project đích đã có Dataset → 409
E2 (3) Không có quyền trên Project đích → 403
E3 (1) Tên mới < 3 hoặc > 100 ký tự → 400
```
