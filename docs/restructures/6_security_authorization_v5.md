# 6. Xác thực, phân quyền và bảo vệ dữ liệu

- **Version:** v5
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-05 (v5)
- **Trạng thái:** Mô hình vai trò đầy đủ đã chốt (5 vai trò: `SYS-ADMIN` + 4 vai trò nghiệp vụ), ma trận quyền cho toàn bộ **66 use case**, chính sách phiên/token, chính sách đăng ký, chính sách audit log, và ranh giới bảo vệ dữ liệu đã được xác nhận. **v5 bổ sung:** quyền cho nhóm nhận xét kết quả `UC-68`→`UC-72` (mục 3.5b), quyền kết nối **Socket.IO** (mục 3.18), chính sách bảo mật cho **AI chạy nội bộ** (mục 3.19) và quy tắc bảo vệ dữ liệu của nhận xét người dùng. Gỡ toàn bộ quyền liên quan đến sheet (chỉ còn `.csv`).
- **Giai đoạn:** Tech solution
- **Thứ tự thực hiện:** Phần 6; sử dụng kết quả đã xác nhận của các phần trước.
- **Quan hệ với các phần khác:** mô hình vai trò ở đây là nguồn chuẩn cho ma trận quyền của Phần 3 v4 (mục 3.8) và danh mục tính năng Phần 2 v5. Phần 4 v4 xác định module sở hữu từng tài nguyên.

## 1. Mục tiêu

Làm rõ và thống nhất xác thực, phân quyền và bảo vệ dữ liệu cho đợt tái cấu trúc backend.

## 2. Nội dung cần bàn luận

- Vai trò hệ thống, vai trò workspace, phạm vi truy cập và ma trận quyền theo use case.
- Chính sách đăng ký/cấp quyền admin, session, refresh và thu hồi quyền.
- Validation, bảo vệ dữ liệu nhạy cảm, log, giới hạn truy cập và quản lý secrets.
- Security implication và các tình huống truy cập trái phép cần kiểm thử.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Mô hình vai trò — 5 vai trò, 2 tầng

Mô hình đã được người dùng xác nhận ở v1–v2 và mở rộng ở v3.

```
Tầng hệ thống (không nằm trong phân cấp workspace/project)
└── SYS-ADMIN          — tài khoản quản trị hệ thống, tách biệt hoàn toàn

Tầng nghiệp vụ
├── Workspace
│   ├── WS-OWNER       — chủ workspace, duy nhất tạo project & chỉ định Project Owner
│   └── WS-MEMBER      — thành viên workspace, quyền CHỈ ĐỌC ở cấp workspace
└── Project
    ├── PROJ-OWNER     — duy nhất trong project, quản lý thành viên project
    ├── PROJ-MEMBER    — thao tác dữ liệu làm việc, chạy phân tích, lưu trạng thái
    └── PROJ-VIEWER    — chỉ xem và tải, không thao tác
```

**Quy tắc cấu trúc bắt buộc:**

1. `WS-MEMBER` **không** có vai trò tương đương `PROJ-VIEWER` — đây là hai vai trò ở hai cấp khác nhau, không thể suy ra `PROJ-*` từ `WS-*` hay ngược lại.
2. `WS-MEMBER` mặc định là `PROJ-VIEWER` trong **mọi** project của workspace (mục 3.2 của Phần 6 v1).
3. `WS-OWNER` có toàn quyền quản trị với **mọi** project trong workspace, kể cả sau khi đã chỉ định Project Owner khác.
4. Mỗi project đúng **một** `PROJ-OWNER`. `WS-OWNER` không tạo thêm Project Owner thứ hai khi có mặt trong `project_member`.
5. Vai trò project nằm ở collection `project_member`; vai trò workspace nằm trong `workspace.members[]`. Hai nơi lưu **tách biệt** (Phần 4 v1 mục 3.7).

### 3.2. Quy tắc phân cấp quyền đã chốt (giữ nguyên từ v1–v2)

- Workspace chỉ có Owner và Member. Chỉ Workspace Owner được tạo project và chỉ định người làm Project Owner cũng như các Member của project.
- Project có Owner, Member và Viewer. Workspace Member mặc định là Viewer trong tất cả project; Project Owner có thể cấp quyền Member cho họ trong project mình quản lý.
- Project Owner được quản lý toàn bộ thành viên của project và tự chuyển quyền Owner cho người khác.
- Khi Workspace Owner chỉ định người khác làm Project Owner, Project Owner cũ chuyển thành Viewer trong project đó.
- Khi Project Owner tự chuyển quyền Owner cho người khác, Project Owner cũ chuyển thành Member trong project đó.
- Khi Project Owner thu hồi quyền Project Member của người vẫn là Workspace Member, người đó trở về Project Viewer, không bị chặn truy cập project.
- Workspace Owner vẫn có toàn quyền với dữ liệu và thành viên của mọi project trong workspace sau khi chỉ định Project Owner khác.
- Khi Workspace Owner xóa một người khỏi workspace mà người đó đang là Project Owner, Workspace Owner tiếp quản vai trò Project Owner của các project đó.
- Người bị xóa khỏi workspace mất toàn bộ quyền truy cập các project trong workspace đó, bất kể vai trò project trước đó; không chuyển thành Project Viewer.
- Workspace Member được tự rời workspace. Khi rời, mất toàn bộ quyền truy cập các project thuộc workspace; nếu đang là Project Owner, Workspace Owner tiếp quản.
- Workspace Owner muốn rời workspace phải chuyển quyền Workspace Owner cho người khác trước; không được rời khi chưa hoàn tất chuyển quyền.
- **Nhượng quyền (`WS-09`) ≠ Rời workspace (`WS-10`):** người được nhượng quyền Owner thành `WS-MEMBER` và **giữ nguyên vai trò project** (vẫn là `PROJ-OWNER` nếu đang là); người rời workspace mất toàn bộ quyền project.

**Bổ sung ở v3 — quyền `WS-MEMBER` ở cấp workspace (chỉ đọc):**

`WS-MEMBER` được xem: thông tin workspace (`WS-03`), danh sách thành viên (`WS-06`), tổng quan workspace (`WS-08`), danh sách project (`PROJ-02`).
`WS-MEMBER` **không** được: sửa thông tin workspace (`WS-04`), xoá workspace (`WS-05`), thêm/xoá thành viên (`WS-07`), nhượng quyền (`WS-09`), xem hoặc đổi vai trò thành viên.

### 3.3. Vai trò `SYS-ADMIN` — quyết định bổ sung ở v3

**Quyết định (người dùng xác nhận 2026-11-05):** `SYS-ADMIN` là **tài khoản riêng biệt, tách hoàn toàn khỏi phân cấp nghiệp vụ**.

| Điểm | Quyết định |
|---|---|
| Được phép | `ADMIN-01` (xem danh sách + hồ sơ người dùng, **chỉ đọc**) |
| Được phép | `ISSUE-04` (duyệt báo cáo sự cố: xem danh sách toàn bộ, xem chi tiết, đổi trạng thái) |
| **Không** được phép | Đọc nội dung dữ liệu, dataset, kết quả phân tích, Tổng kết hoặc báo cáo của bất kỳ project nào |
| **Không** được phép | Là thành viên của bất kỳ workspace/project nào |
| **Không** được phép | Tạo project, import dataset, chạy phân tích, lưu trạng thái project |
| **Không** được phép | Xem phiên đăng nhập hoặc hồ sơ đầy đủ của người khác ngoài `ADMIN-01` |
| **Không** được phép | Sửa, khoá, mở khoá, xoá tài khoản; sửa nội dung báo cáo của người dùng |
| Cấp vai trò | Chỉ bằng thao tác trực tiếp trên database hoặc bởi Admin đã có (bootstrap) — **không có endpoint API công khai để tự phong admin** |
| Ghi log | Mọi hành động của `SYS-ADMIN` đều bắt buộc ghi audit log |

**Hệ quả vận hành được chấp nhận:** một tài khoản `SYS-ADMIN` **không dùng được sản phẩm** như người dùng nghiệp vụ. Đây là đánh đổi có chủ ý để đảm bảo "toàn quyền" của Admin không phá vỡ mô hình phân cấp đã chốt. Khi cần vừa quản trị vừa nghiệp vụ → dùng **hai tài khoản khác nhau**.

**Đối chiếu mã nguồn hiện tại — sai lệch bắt buộc phải sửa:**

```typescript
// src/backend/src/shared/casl/casl-ability.factory.ts — hiện tại
if (user.role === 'admin') {
  can(Action.Manage, 'all');   // ← toàn quyền, vi phạm quyết định ở mục 3.3
  return build();
}
```

Cách sửa chốt ở v3: **không cấp `Action.Manage, 'all'` cho `SYS-ADMIN`**. Thay bằng cấp quyền **theo subject cụ thể** (`User` với điều kiện read-only, `IssueReport` với điều kiện cụ thể), và **không cấp quyền** trên các subject nghiệp vụ (`Workspace`, `Project`, `Dataset`, `DataRecord`, `AnalysisResult`, `Summary`, `Report`). Chi tiết kỹ thuật ở mục 3.10.

### 3.4. Ma trận quyền — cấp workspace/project (giữ nguyên từ v2)

| Hành động | WS-OWNER | PROJ-OWNER | PROJ-MEMBER | PROJ-VIEWER |
|---|---|---|---|---|
| Xem Data Views, lọc, sắp xếp, tìm kiếm | ✔ | ✔ | ✔ | ✔ |
| Xem kết quả phân tích đã lưu và bằng chứng mức ô | ✔ | ✔ | ✔ | ✔ |
| Sửa ô trên dữ liệu làm việc | ✔ | ✔ | ✔ | — |
| Nhập/đổi tên cột rỗng/trùng | ✔ | ✔ | ✔ | — (chỉ xem cảnh báo) |
| Xóa dòng, Reset Dataset | ✔ | ✔ | ✔ | — |
| Chạy phân tích, tạo Tổng kết | ✔ | ✔ | ✔ | — |
| Thử lại AI (khi AI lỗi) | ✔ | ✔ | ✔ | — |
| Lưu trạng thái project | ✔ | ✔ | ✔ | — |
| Tải báo cáo PDF (Tổng kết) | ✔ | ✔ | ✔ | ✔ |
| **Tải file dữ liệu gốc** (`.csv`) | ✔ | ✔ | ✔ | **✔** |
| **Xem lịch sử job AI / log lỗi AI** | ✔ | ✔ | ✔ | — |
| Quản lý thành viên project | ✔ | ✔ | — | — |
| Quản lý workspace | ✔ | — | — | — |

**Quyền tải file dữ liệu gốc — định nghĩa lại ở v3.**

Yêu cầu gốc (được người dùng xác nhận 2026-11-05): `PROJ-VIEWER` **được phép** tải file gốc, tải file Tổng kết, dùng bộ lọc và xem các tính năng xem dữ liệu. Chỉ các **thao tác ghi** mới giới hạn cho `WS-OWNER` / `PROJ-OWNER` / `PROJ-MEMBER`.

| Nhóm thao tác | WS-OWNER | PROJ-OWNER | PROJ-MEMBER | PROJ-VIEWER |
|---|---|---|---|---|
| **Đọc & tải** (xem bảng, lọc, sắp xếp, tìm kiếm, xem kết quả đã lưu, xem bằng chứng ô, tải PDF Tổng kết, **tải file gốc**) | ✔ | ✔ | ✔ | ✔ |
| **Ghi metadata** (đổi tên cột, Reset tên cột) | ✔ | ✔ | ✔ | — |
| **Ghi kết quả** (chạy phân tích, tạo Tổng kết, thử lại AI, lưu trạng thái project) | ✔ | ✔ | ✔ | — |

**Lý do thay đổi so với đề xuất ban đầu:** hệ thống là **công cụ phân tích dữ liệu nội bộ**. Người xem (`PROJ-VIEWER`) vốn đã xem toàn bộ bảng dữ liệu, xem bằng chứng mức ô và xem Tổng kết — cho phép tải file gốc **không mở rộng đáng kể** phạm vi dữ liệu họ thấy. Việc hạn chế tải file gốc khỏi `PROJ-VIEWER` sẽ tạo ra ma sát nghiệp vụ mà không tạo thêm biên an toàn.

**Hệ quả bắt buộc phải ghi nhận:**
1. Ranh giới an toàn thực sự **không phải** "ai tải được file gốc" mà là **"ai được ghi vào dữ liệu làm việc"**. Mọi quy tắc bảo vệ phải dựa trên ranh giới này.
2. **Cập nhật 2026-11-05 (quyết định "chỉ đọc"):** ranh giới này **được siết tối đa** — hệ thống **không ghi vào dữ liệu người dùng dưới bất kỳ hình thức nào**. Các quyền "sửa ô" và "xoá dòng" bị **gỡ khỏi mô hình quyền**; quyền còn lại trên dữ liệu chỉ là ghi **metadata cột** (đổi tên cột, Reset tên cột).
3. `PROJ-VIEWER` tải file gốc = tải **file gốc đã upload**, và đây là **toàn bộ** dữ liệu mà hệ thống giữ — không có lớp "dữ liệu làm việc" đã bị biến đổi nào. Tài liệu giao diện và báo cáo PDF **phải nêu rõ**: *"Hệ thống chỉ phát hiện và báo cáo — không tự sửa dữ liệu"*.
4. Vì vậy, **Reset Dataset** và mọi thao tác ghi metadata đều bắt buộc **không** được phép với `PROJ-VIEWER` — đã chốt ở bảng trên.
5. File gốc tải xuống phải đi qua cùng một cổng có kiểm tra quyền và có audit log ở mức hành động nhạy cảm (xem mục 3.8).

> ### ⚠ 3.4b. Quyết định "chỉ đọc" — gỡ quyền ghi dữ liệu (2026-11-05)
>
> Hệ thống **không ghi vào dữ liệu người dùng**. Vì vậy:
>
> | Quyền bị gỡ | Lý do |
> |---|---|
> | `PROJ-MEMBER` sửa ô | Module `cell-edit` bị gỡ |
> | `PROJ-MEMBER` xoá dòng | Tính năng `DATA-01` bị gỡ |
> | `PROJ-OWNER` xoá dòng / sửa ô | Như trên |
> | `WS-OWNER` xoá dòng / sửa ô | Như trên |
> | `PROJ-OWNER` / `WS-OWNER` rollback phiên bản | Module `versions` bị gỡ |
> | `PROJ-OWNER` / `WS-OWNER` xem & quay lại phiên bản | Module `versions` bị gỡ |
> | Áp dụng clean rules | Module `clean-rules` bị gỡ |
>
> **Quyền còn lại trên dữ liệu:** chỉ ghi **metadata cột** — đổi tên cột (`UC-10`) và Reset tên cột (`UC-12`). Cả hai đều yêu cầu `PROJ-MEMBER` trở lên; `PROJ-VIEWER` bị `FORBIDDEN`.
>
> **Hệ quả bảo mật tích cực:** ranh giới bảo vệ dữ liệu đơn giản hóa thành *"không ai ghi được vào dữ liệu"*. Không còn bề mặt tấn công từ thao tác ghi dữ liệu — chỉ còn thao tác ghi metadata, cấu hình phân tích và kết quả.

### 3.5. Ma trận quyền đầy đủ — 62 use case (đồng bộ Phần 3 v3 mục 3.8)

Cột `SYS-ADMIN` được thêm vào để thể hiện rõ quyền hệ thống.

| Use case | SYS-ADMIN | WS-OWNER | WS-MEMBER | PROJ-OWNER | PROJ-MEMBER | PROJ-VIEWER |
|---|---|---|---|---|---|---|
| UC-01 Tạo workspace | — | ✔ (trở thành Owner) | — | — | — | — |
| UC-02 Sửa workspace | — | ✔ | — | — | — | — |
| UC-03 Thêm thành viên workspace | — | ✔ | — | — | — | — |
| UC-04 Xoá thành viên workspace | — | ✔ | — | — | — | — |
| UC-05 Tạo project | — | ✔ | — | — | — | — |
| UC-06 Quản lý thành viên project | — | ✔ | — | ✔ | — | — |
| UC-07 Rời workspace | — | ✔ (chuyển quyền trước) | ✔ (tự rời) | — | — | — |
| UC-08 Import file | — | ✔ | — | ✔ | — | — |
| UC-10 Sửa tên cột | — | ✔ | — | ✔ | ✔ | — |
| UC-12 Reset Dataset | — | ✔ | — | ✔ | ✔ | — |
| UC-13 Xem thông tin dataset | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-14 Xem bảng dữ liệu | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-15 Lọc | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-16 Sắp xếp | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-17 Tìm kiếm | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-19 Cấu hình cột phân tích | — | ✔ | — | ✔ | ✔ | — |
| UC-20 Chạy phân tích | — | ✔ | — | ✔ | ✔ | — |
| UC-21 Xem trạng thái job AI | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-22 Thử lại AI | — | ✔ | — | ✔ | ✔ | — |
| UC-23 Tạo Tổng kết | — | ✔ | — | ✔ | ✔ | — |
| UC-24 Xem bằng chứng ô | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-25 Lưu project | — | ✔ | — | ✔ | ✔ | — |
| UC-26 Tải PDF | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-27 Khôi phục project | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-32 Đăng ký tài khoản | công khai | công khai | công khai | công khai | công khai | công khai |
| UC-33 Đăng nhập email/mật khẩu | công khai | công khai | công khai | công khai | công khai | công khai |
| UC-34 Đăng nhập Google | công khai | công khai | công khai | công khai | công khai | công khai |
| UC-35 Ghi nhớ đăng nhập | công khai | công khai | công khai | công khai | công khai | công khai |
| UC-36 Quên mật khẩu (gửi OTP) | công khai | công khai | công khai | công khai | công khai | công khai |
| UC-37 Đặt lại mật khẩu | công khai | công khai | công khai | công khai | công khai | công khai |
| UC-38 Thay đổi mật khẩu | tự | tự | tự | tự | tự | tự |
| UC-39 Xem danh sách phiên | tự | tự | tự | tự | tự | tự |
| UC-40 Chi tiết phiên | tự | tự | tự | tự | tự | tự |
| UC-41 Đăng xuất thiết bị khác | tự | tự | tự | tự | tự | tự |
| UC-42 Đăng xuất thiết bị hiện tại | tự | tự | tự | tự | tự | tự |
| UC-43 Làm mới access token | công khai | công khai | công khai | công khai | công khai | công khai |
| UC-44 Xem hồ sơ cá nhân | tự | tự | tự | tự | tự | tự |
| UC-45 Cập nhật hồ sơ cá nhân | tự | tự | tự | tự | tự | tự |
| UC-46 Xem hồ sơ người dùng | ✔ | — | — | — | — | — |
| UC-47 Danh sách workspace | — | ✔ | ✔ (đọc) | ✔ | ✔ | ✔ |
| UC-48 Chi tiết workspace | — | ✔ | ✔ (đọc) | ✔ | ✔ | ✔ |
| UC-49 Xoá workspace | — | ✔ | — | — | — | — |
| UC-50 Danh sách thành viên workspace | — | ✔ | ✔ (đọc) | ✔ | ✔ | ✔ |
| UC-51 Nhượng quyền Workspace Owner | — | ✔ | — | — | — | — |
| UC-52 Danh sách project | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-53 Thông tin cơ bản project | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-54 Cập nhật project | — | ✔ | — | ✔ | — | — |
| UC-55 Xoá project | — | ✔ | — | — | — | — |
| UC-56 Tìm thành viên trong project | — | ✔ | — | ✔ | — | — |
| UC-57 Lịch sử phiên bản project | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-60 Trung tâm thông báo | tự | tự | tự | tự | tự | tự |
| UC-61 Chi tiết thông báo | tự | tự | tự | tự | tự | tự |
| UC-62 Bật/tắt thông báo | tự | tự | tự | tự | tự | tự |
| UC-63 Nhận thông báo | hệ thống | hệ thống | hệ thống | hệ thống | hệ thống | hệ thống |
| UC-64 Tạo báo cáo sự cố | — | tự | tự | tự | tự | tự |
| UC-65 Danh sách báo cáo của tôi | tự | tự | tự | tự | tự | tự |
| UC-66 Chi tiết báo cáo | ✔ | tự | tự | tự | tự | tự |
| UC-67 Duyệt báo cáo | ✔ | — | — | — | — | — |
| UC-68 Nhận xét một phát hiện | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-69 Nhận xét cả lần phân tích | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-70 Xem nhận xét | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| UC-71 Sửa/xoá nhận xét của mình | tự | tự | tự | tự | tự | tự |
| UC-72 Xem thống kê chất lượng AI | — | ✔ | — | ✔ | ✔ | — |

**Quy tắc đọc ma trận v5:**
- `tự` = thao tác tự thao tác trên chính mình, không phụ thuộc vai trò workspace/project (kể cả `SYS-ADMIN`).
- `công khai` = không cần access token.
- `—` = không ai được phép bằng vai trò này.
- `SYS-ADMIN` **chỉ** có quyền ở UC-46, UC-66, UC-67. Mọi ô `—` khác của `SYS-ADMIN` là kết quả trực tiếp của quyết định tách biệt ở mục 3.3.
- `WS-OWNER` có toàn quyền với project trong workspace → mọi dòng `✔` của `PROJ-OWNER` đều áp dụng cho `WS-OWNER` khi họ là thành viên của project đó, **trừ** UC-54 (được), UC-55 (xoá project — **chỉ** `WS-OWNER`).

### 3.5b. Quyền của nhóm nhận xét kết quả — `UC-68`→`UC-72` (v5)

**Quyết định 2026-11-05:** Mỗi kết quả hệ thống trả ra đều kèm phần đánh giá để người dùng nhận xét. Nhận xét là **lớp đánh giá** tách biệt, **không** phải thao tác ghi dữ liệu — nhưng nó là dữ liệu nghiệp vụ (có thể chứa thông tin nhạy cảm của doanh nghiệp) nên cần chính sách quyền riêng.

#### Ma trận quyền nhóm `FB-*`

| Hành động | SYS-ADMIN | WS-OWNER | WS-MEMBER | PROJ-OWNER | PROJ-MEMBER | PROJ-VIEWER |
|---|---|---|---|---|---|---|
| `UC-68` Nhận xét một phát hiện | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| `UC-69` Nhận xét cả lần phân tích | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| `UC-70` Xem nhận xét (của phát hiện / của lần phân tích) | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| `UC-71` Sửa / xoá nhận xét **của chính mình** | tự | tự | tự | tự | tự | tự |
| `UC-71` Xoá nhận xét **của thành viên** (vi phạm) | ✔ (ghi log) | ✔ (ghi log) | — | ✔ (ghi log) | — | — |
| `UC-72` Xem thống kê chất lượng AI theo project | — | ✔ | — | ✔ | ✔ | — |

**Quy tắc bắt buộc:**

1. **Ai cũng được nhận xét** kể cả `PROJ-VIEWER` — vì nhận xét không sửa dữ liệu, không sửa kết quả phân tích, và là nguồn ground truth quan trọng nhất để đánh giá AI. Hạn chế quyền nhận xét sẽ làm nghèo dữ liệu học lại.
2. **`SYS-ADMIN` không có quyền với nhóm `FB-*`** — theo đúng nguyên tắc ở mục 3.3: Admin quản trị hệ thống, **không** đọc nội dung dữ liệu của workspace. Nhận xét có thể chứa thông tin nghiệp vụ nhạy cảm → không nằm trong tầm vực Admin.
3. **Chỉ chủ nhận xét** được sửa/xoá nhận xét của chính mình (`userId === currentUser.id`). Người khác → `FORBIDDEN`.
4. **`PROJ-OWNER` / `WS-OWNER`** được xoá nhận xét của thành viên **chỉ** khi vi phạm (chứa PII, spam, quấy rối) — **bắt buộc ghi audit log** với nội dung nhận xét bị xoá.
5. **`UC-72` (thống kê chất lượng AI)** chỉ dành cho vai trò có quyền chạy phân tích (`PROJ-OWNER`, `PROJ-MEMBER`, `WS-OWNER`). `PROJ-VIEWER` **không** xem — vì chỉ số này mô tả hiệu năng hệ thống, không phải dữ liệu, và để tránh việc người xem đánh giá "AI của tôi sai" mà không có quyền hành động.
6. **Quyền xem nhận xét của người khác** chỉ hiển thị **tên hiển thị**, không hiển thị `user_id`/`email`. Người nhận xét thấy đầy đủ thông tin của chính mình.
7. **Nhận xét không phải kênh để công bố dữ liệu**: tối đa 2.000 ký tự, không hỗ trợ định dạng phong phú, không cho đính kèm. Nội dung bị lọc PII khi đưa vào kho mẫu học.

#### Quy tắc vòng đời và riêng tư của nhận xét

| Quy tắc | Nội dung |
|---|---|
| Lưu trữ | Append-only; sửa nhãn giữ lại bản ghi lịch sử nội bộ để truy vết |
| Xoá theo project | Khi xoá project/workspace → nhận xét bị xoá theo. **Trừ** mẫu đã ẩn danh hoá thành `feedback_example` thì được giữ (không còn liên kết ngược) |
| Xoá theo người dùng | Khi user bị xoá → nhận xét được ẩn danh hoá thành mẫu, hoặc xoá tùy chính sách doanh nghiệp |
| Bảo mật | Cùng mức với `analysis_result` — truy cập qua cùng cơ chế kiểm tra quyền project |
| Không ảnh hưởng kết quả | Nhận xét **không** làm thay đổi kết quả phân tích đã lưu (dữ liệu bất biến) |
| Không tự động điều chỉnh | Nhận xét **không** tự điều chỉnh ngưỡng ảnh hưởng hay cấu hình phân tích trong đợt này |

### 3.6. Chính sách đăng ký và cấp quyền

**Quyết định v3:** đăng ký tài khoản **công khai**.

| Điểm | Quy tịnh |
|---|---|
| Ai có thể đăng ký | Bất kỳ ai có email hợp lệ và chưa có tài khoản |
| Vai trò mặc định | `analyst` (vai trò hệ thống cơ bản) |
| Tự chọn vai trò `admin` | **Không** — bỏ trường `role` khỏi DTO đăng ký (`register.dto.ts` dòng 17 — hiện đang cho phép) |
| Xác minh email | Không bắt buộc ở đợt này (Phần 2 v3 `AUTH-01`) |
| Tài khoản `blocked` | Từ chối đăng nhập, từ chối gửi OTP |
| Cấp vai trò `admin` | Chỉ thao tác trực tiếp trên database / bootstrap — **không có endpoint API** |

**Đánh giá rủi ro và biện pháp bù:** đăng ký công khai mở đường cho việc tạo tài khoản hàng loạt (spam). Biện pháp bù bắt buộc:
1. Rate-limit đăng ký theo IP: tối đa 5 lần/giờ/IP (mục 3.9).
2. Mỗi tài khoản mới **không** có quyền gì ngoài workspace mà họ được mời vào — rủi ro thực tế gần bằng 0 vì `WS-MEMBER` chỉ đọc và `PROJ-VIEWER` chỉ xem.
3. Tài khoản không hoạt động sẽ bị dọn theo chính sách giữ dữ liệu (mục 3.11).

### 3.7. Phiên đăng nhập, token và thu hồi quyền

**Thời hạn (chốt ở v3):**

| Đối tượng | Thời hạn | Ghi chú |
|---|---|---|
| Access token (JWT) | **15 phút** | Không thu hồi được; client phải xoá khi đăng xuất |
| Refresh token | **7 ngày** | Lưu dạng hash; xoay vòng (rotation) |
| Phiên (`user_session`) | TTL **30 ngày** | TTL index trong MongoDB |

**Cơ chế bắt buộc:**

| Cơ chế | Quy tắc |
|---|---|
| Refresh token rotation | Mỗi lần làm mới → refresh token cũ bị revoke, cấp token mới |
| Phát hiện tái sử dụng (reuse detection) | Dùng refresh token đã bị revoke → **thu hồi toàn bộ phiên** của user đó, ghi log |
| Đặt lại mật khẩu (OTP) | **Thu hồi toàn bộ** phiên đang hoạt động |
| Thay đổi mật khẩu | **Giữ** phiên hiện tại, thu hồi **các phiên khác** |
| Đăng xuất thiết bị hiện tại | Revoke phiên hiện tại; access token còn hiệu lực tới hết hạn (15 phút) |
| Đăng xuất thiết bị khác | Revoke phiên được chọn; idempotent — đã revoke thì trả trạng thái thành công, không phải lỗi |
| Tài khoản bị khoá (`blocked`) | Mọi request có access token của tài khoản đó bị từ chối (kiểm tra ở tầng guard, không chỉ lúc đăng nhập) |

**Đối chiếu mã nguồn hiện tại — cần sửa:**
- `user_session` hiện có TTL **7 ngày** → nâng lên **30 ngày** cho khớp refresh token 7 ngày (refresh token phải sống ≤ TTL phiên, nếu không sẽ có phiên "chết" không refresh được).
- `JwtStrategy.validate()` hiện kiểm tra `status === 'blocked'` mỗi request → **đã đúng**, giữ nguyên.
- JWT payload hiện mang `workspaceId` / `workspaceRole` — xem mục 3.10, cần bỏ.

### 3.8. Audit log — phạm vi, quyền xem và dữ liệu bắt buộc

**Quyết định v3:** module `audit` là module riêng (`apps/api/src/modules/audit/`), sở hữu collection `audit_log`.

**Hành động bắt buộc ghi log (đã chốt ở Phần 2 v3):**

| # | Hành động | Actor |
|---|---|---|
| 1 | Admin duyệt / đổi trạng thái báo cáo sự cố (`ISSUE-04`) | `SYS-ADMIN` |
| 2 | Admin xem danh sách hoặc chi tiết hồ sơ người dùng (`ADMIN-01`) | `SYS-ADMIN` |
| 3 | Thay đổi vai trò thành viên workspace/project (`WS-09`, `PROJ-10`, `PROJ-11`) | `WS-OWNER` / `PROJ-OWNER` |
| 4 | Nhượng quyền Owner (`WS-09`, `PROJ-11`) | `WS-OWNER` / `PROJ-OWNER` |

**Bổ sung ở v3 (do thay đổi quyền tải file gốc):**

| # | Hành động | Actor | Lý do |
|---|---|---|---|
| 5 | Tải file dữ liệu gốc (`FILE-01` tải lại) | Mọi vai trò có quyền, gồm `PROJ-VIEWER` | File gốc là dữ liệu nguyên bản — cần truy vết ai đã tải |
| 6 | Xoá workspace, xoá project | `WS-OWNER` | Xoá là hành động phá huỷ dữ liệu |
| 7 | Reset Dataset | `WS-OWNER`/`PROJ-OWNER`/`PROJ-MEMBER` | Xoá hàng loạt dòng đã xoá |
| 8 | Xuất báo cáo PDF Tổng kết | Mọi vai trò có quyền, gồm `PROJ-VIEWER` | File ra ngoài hệ thống |

**Cấu trúc bản ghi bắt buộc:**

```
audit_log: {
  _id,
  actor_id,            // user id
  actor_role,          // vai trò hệ thống tại thời điểm hành động
  action,              // mã hành động ổn định, ví dụ 'issue.status_changed'
  target_type,         // 'IssueReport' | 'User' | 'Workspace' | 'Project' | ...
  target_id,
  scope,               // workspace_id / project_id nếu có — để lọc theo phạm vi
  changes,             // diff trước/sau (chỉ trường thay đổi)
  ip_address,
  user_agent,
  created_at
}
```

**Quyền xem audit log (chốt ở v3):**

| Vai trò | Phạm vi xem |
|---|---|
| `SYS-ADMIN` | Toàn cục — tất cả bản ghi |
| `WS-OWNER` | **Chỉ** bản ghi có `scope.workspace_id` = workspace của họ |
| `WS-MEMBER`, `PROJ-*`, `SYS-ADMIN` khác | **Không** xem được |

**Quy tắc bảo mật dữ liệu trong audit log:**
- `changes` của `USER-01`/`ADMIN-01` **không** ghi `password_hash`, `password_reset_token_hash`, `google_id`, `refresh_token_hash`.
- Audit log **không** được chứa giá trị ô dữ liệu nghiệp vụ (chỉ định danh cột + số dòng + mã lỗi) — cùng nguyên tắc với log hệ thống ở mục 3.12.
- Audit log là **append-only** — không có endpoint sửa hoặc xoá trong đợt này.

### 3.9. Chống dò mật khẩu, OTP và giới hạn tần suất

**Quyết định v3:** cơ chế đếm dùng **Redis** (đã có sẵn từ quyết định hạ tầng queue ở Phần 4 v1 mục 3.1).

| Thao tác | Ngưỡng | Phạm vi đếm |
|---|---|---|
| Đăng nhập sai | 5 lần / giờ | IP + email |
| Gửi OTP | 5 lần / giờ | email |
| Nhập OTP sai | 3 lần | OTP hiện tại |
| Thay đổi mật khẩu | 5 lần / giờ | user |
| Đăng ký tài khoản | 5 lần / giờ | IP |
| Refresh token sai | 5 lần / giờ | user |

Vượt ngưỡng → trả `LIMIT_EXCEEDED` kèm thời gian chờ còn lại.

**Lý do chuyển từ in-memory sang Redis:** code hiện tại chưa có rate-limit; in-memory chỉ hiệu quả với một instance. Vì đã chốt Redis (cache + rate-limit + adapter Socket.IO), dùng chung Redis là phương án rẻ nhất và chống được trường hợp chạy nhiều instance API.

**Hạn chế đếm trùng lặp theo IP trong môi trường NAT/VPN:** chấp nhận. Nếu cần nới thì phải theo dõi tỉ lệ `LIMIT_EXCEEDED` trong Phần 10.

**Đăng ký công khai và email enumeration:**

| Quy tắc | Áp dụng cho |
|---|---|
| Phản hồi **luôn giống nhau**, kể cả khi email không tồn tại | `AUTH-05` (quên mật khẩu), `AUTH-01` (đăng ký) |
| Trả `CONFLICT` khi email đã tồn tại khi đăng ký | `AUTH-01` — cần xác nhận lại vì mâu thuẫn với nguyên tắc trên |

**Xung đột cần xử lý:** `AUTH-01` đăng ký công khai và `AUTH-05` quên mật khẩu đều dựa trên email. Nếu `AUTH-01` trả `CONFLICT` khi email đã tồn tại thì email enumeration **vẫn xảy ra** ở endpoint đăng ký. Đây là đánh đổi đã biết:

| Phương án | Đánh đổi |
|---|---|
| **Chọn: trả `CONFLICT` ở đăng ký** | Rò email đã đăng ký. Chấp nhận — endpoint đăng ký vốn đã là công khai, người dùng thường biết email của chính mình. Rủi ro thấp hơn việc chặn đăng ký trùng email vì nó phá UX người dùng đã có tài khoản |
| Phương án thay thế | Trả `200` với thông báo trung tính + email xác nhận — phức tạp hơn, cần hạ tầng email cho mọi lần đăng ký |

**Ghi chú:** `AUTH-05` (quên mật khẩu) trả phản hồi **luôn giống nhau** — đây là yêu cầu bắt buộc đã chốt ở Phần 2 v3, không đổi.

### 3.10. Cơ chế kỹ thuật — CASL, guard và cách xác định quyền

**Quyết định:** dùng **CASL** (đã có sẵn `@casl/ability` trong codebase) với mô hình **ability theo ngữ cảnh**, không nhúng quyền vào token.

**Vấn đề bắt buộc phải sửa trong code hiện tại:**

```typescript
// src/backend/src/shared/decorators/current-user.decorator.ts — payload hiện tại
export interface CurrentUserPayload {
  userId: string;
  email: string;
  role: 'admin' | 'analyst';
  sessionId?: string;
  // workspaceId / workspaceRole được nhúng vào JWT
}
```

Nhúng `workspaceId`/`workspaceRole` vào JWT sai ở 3 điểm:
1. Vai trò có thể thay đổi giữa chừng (thu hồi quyền, nhượng quyền) mà token cũ vẫn giữ quyền cũ → **hở quyền**.
2. Access token sống 15 phút → độ trễ tối đa 15 phút mới phản ánh thay đổi quyền.
3. Người dùng thuộc nhiều workspace/project → một cặp `workspaceId`/`workspaceRole` trong token không đủ biểu diễn.

**Cơ chế mới:**

```
JWT payload (tối thiểu)
└── { sub, email, role, sessionId, typ, iat, exp }
    └── role = vai trò HỆ THỐNG ('admin' | 'analyst') — không chứa vai trò workspace/project

Request → JwtAuthGuard → xác thực token, kiểm tra session chưa revoke + user chưa blocked
        → AuthorizationGuard (CASL)
             ├── Lấy ngữ cảnh: workspace_id, project_id từ route/body
             ├── Nạp vai trò THỰC TẾ từ DB (workspace.members[], project_member) — không đọc từ token
             └── Dựng ability → check
```

**Quy tắc bắt buộc:**
1. Vai trò workspace/project **luôn** được đọc từ DB tại thời điểm request. Không bao giờ tin vào token cho quyền nghiệp vụ.
2. Không có cặp `workspaceId`/`workspaceRole` trong token.
3. Guard phải trả `FORBIDDEN` (403) khi thiếu quyền, `UNAUTHENTICATED` (401) khi token thiếu/hết hạn/sai. Phân biệt rõ để frontend xử lý đúng.

**Cấu hình CASL cho `SYS-ADMIN` (thay cho `can(Action.Manage, 'all')`):**

| Subject | Quyền của `SYS-ADMIN` |
|---|---|
| `User` | `Action.Read` — chỉ đọc; **không** `Update`, `Delete` |
| `IssueReport` | `Action.Read`, `Action.Update` — chỉ cập nhật trạng thái, không sửa nội dung |
| `AuditLog` | `Action.Read` (toàn cục) |
| `Workspace`, `Project`, `Dataset`, `DataRecord`, `AnalysisResult`, `Summary`, `Report`, `UserSession` | **Không cấp quyền nào** |

**Về yêu cầu "chặn `SYS-ADMIN` không đọc dữ liệu nghiệp vụ":** đã chốt triển khai bằng **CASL** — `SYS-ADMIN` không được cấp quyền trên các subject nghiệp vụ, nên request vào các endpoint đó trả `FORBIDDEN`. Hệ quả: `SYS-ADMIN` đăng nhập thành công nhưng vào workspace/project sẽ không thấy gì — **đúng như thiết kế tách biệt ở mục 3.3**. Đây là hành vi mong muốn, không phải lỗi.

**Rủi ro đã biết và biện pháp:** cấu hình CASL viết tay dễ sót. Bắt buộc có test tự động (Phần 13) khẳng định `SYS-ADMIN` bị `FORBIDDEN` trên **toàn bộ** endpoint nghiệp vụ, và test khẳng định **không** phát sinh truy vấn đọc dữ liệu nghiệp vụ cho tài khoản `SYS-ADMIN`.

### 3.11. Chính sách giữ và xoá dữ liệu

**Quyết định v3 (người dùng xác nhận):** đợt này **không xoá tự động** bằng chứng / kết quả phân tích / dữ liệu nghiệp vụ.

| Loại dữ liệu | Chính sách ở đợt này |
|---|---|
| Bằng chứng mức ô (`cell_evidence`) | Giữ nguyên; chỉ bị xoá khi project bị xoá vĩnh viễn trong bước migration cuối (Phần 11) |
| Kết quả phân tích | Giữ nguyên |
| Audit log | Giữ nguyên; **append-only**, không có cơ chế xoá trong đợt này |
| Thông báo (`notification`) | Giữ nguyên; chính sách TTL sẽ chốt ở Phần 10 |
| File gốc trên R2 | Giữ; dọn khi project bị xoá vĩnh viễn |

**Lý do:** xoá tự động theo thời gian có nguy cơ mất dữ liệu nghiệp vụ ngoài ý muốn (kết quả phân tích là tài sản của tổ chức, không phải log). Xoá theo vòng đời project vẫn được giữ.

**Hệ quả bắt buộc:** phải ghi rõ trong tài liệu vận hành (Phần 10) rằng dung lượng MongoDB và R2 **tăng liên tục** và cần cơ chế giới hạn quota (đã có `STORAGE_MAX_QUOTA_BYTES`) — không có giới hạn thời gian, chỉ có giới hạn dung lượng.

### 3.12. Ranh giới dữ liệu gửi ra ngoài và bảo vệ dữ liệu nhạy cảm

**Cập nhật v5 — AI chạy NỘI BỘ, ranh giới dữ liệu được siết chặt hơn:**

> **Quyết định 2026-11-05 (v5):** Hệ thống **không gọi bất kỳ API AI bên ngoài nào**. Suy luận diễn ra bằng **model cục bộ** (`Qwen3-14B` chính, `Qwen3-8B` fast-path) chạy trên chính VPS qua `AiInferencePort` (Phần 12 v4 mục 3.15).

| Hạng mục | Trước (Gemini API) | Sau (AI cục bộ — v5) |
|---|---|---|
| Dữ liệu rời hệ thống | Thống kê tổng hợp + ≤ 20 ô lỗi/cột đã che PII | **Không rời hệ thống** — dữ liệu chỉ đi trong mạng nội bộ tới engine suy luận |
| Che PII | Bắt buộc | **Vẫn bắt buộc** — áp dụng cả khi mô hình chạy cùng máy, vì log/prompt cache/trace có thể bị đọc lại |
| Rủi ro dữ liệu bị dùng để huấn luyện của bên thứ ba | Có (Gemini Free Tier) | **Không** — không có bên thứ ba nào nhận dữ liệu |
| File gốc / toàn bộ tập bản ghi | Không gửi | **Không** truyền cho engine |
| Ảnh chụp màn hình lỗi | Không gửi | **Không** truyền cho engine |
| Log hệ thống | Không ghi giá trị ô chưa che | **Không** ghi giá trị ô chưa che — kể cả log của worker AI |

**Quy tắc bắt buộc (v5):**
1. Dữ liệu đưa cho mô hình **luôn** là: thống kê tổng hợp + **tối đa 20 ô lỗi/cột đã che PII**. Không có ngoại lệ "vì mô hình chạy cục bộ".
2. Engine suy luận **chỉ** được gọi qua `AiInferencePort` ở tầng `infrastructure`. **Cấm** import SDK AI bên ngoài (rule CI **R7**, Phần 4 v4 mục 3.11).
3. Engine suy luận **không** được gọi trực tiếp từ `apps/api` — chỉ worker AI gọi, để bảo đảm một điểm kiểm soát duy nhất cho che PII, timeout và rate-limit.
4. Prompt, response và trace của mô hình **không** được ghi vào log ở mức INFO; chỉ ghi metadata (model, thời gian, token, mã lỗi schema).
5. Endpoint `/ready` của engine phải được bảo vệ — không public ra ngoài; chỉ nội bộ container network gọi được.

**Cập nhật ở v3 — AI job chạy ở worker, không phải API process:**

Phần 6 v2 ghi "Job AI chạy nền trong API process". Phần 4 v1 đã chốt tách worker thành app riêng `apps/worker` với hàng đợi Kafka. Cần chốt lại ranh giới:

| Mục | Quyết định v3 |
|---|---|
| Nơi chạy | `apps/worker` — tiến trình riêng, không phải `apps/api` |
| Dữ liệu mang theo job | **Chỉ** tham chiếu tới kết quả phân tích đã lưu (`analysis_result_id`) — không nhúng dữ liệu nguyên bản vào payload job |
| Bí mật hệ thống | Job **không** mang theo bí mật hệ thống. **v5:** không còn `GEMINI_API_KEY`; thay bằng `AI_INFERENCE_BASE_URL` (URL nội bộ tới engine) trong môi trường của worker — không nằm trong payload job |
| Che PII | Thực hiện **trong worker**, ngay trước khi gọi engine — không truyền dữ liệu chưa che cho mô hình bất kỳ lúc nào, kể cả trong log worker |
| Độ trễ | Job AI bất đồng bộ — API trả `202 Accepted` với `job_id`; frontend poll trạng thái (`UC-21`) |

**Bảng dữ liệu nhạy cảm và mức bảo vệ:**

| Dữ liệu | Nơi lưu | Bắt buộc |
|---|---|---|
| `password_hash` | `user` | bcrypt/argon2; `select: false`; không bao giờ serialize |
| `refresh_token_hash` | `user_session` | hash; `select: false`; không bao giờ serialize |
| `password_reset_token_hash` / OTP hash | `user` | hash; `select: false`; xoá sau khi dùng |
| `google_id` | `user` | `select: false`; unique sparse |
| `ip_address`, `user_agent` | `user_session`, `audit_log` | dữ liệu cá nhân — không gửi cho mô hình |
| Nội dung nhận xét người dùng (`reason` trong `finding_feedback`) | `finding_feedback` | **không** dùng nguyên văn trong prompt; chỉ dùng mẫu đã chuẩn hoá, đã loại PII (Phần 12 v4 mục 3.16.4) |
| Vector embedding của mẫu học | `feedback_example` | dữ liệu đã ẩn danh hoá — được coi là dữ liệu đã che |
| Giá trị ô trong bằng chứng | `cell_evidence` | che PII trước khi gửi AI |
| File gốc, file đính kèm | R2 qua `StoragePort` | không phục vụ file tĩnh trực tiếp; luôn qua cổng có kiểm tra quyền |

### 3.13. Bảo vệ tệp đính kèm của báo cáo sự cố

Bổ sung ở v3 (chi tiết MIME type còn để Phần 8 chốt, nhưng nguyên tắc bảo mật đã chốt):

| Quy tắc | Nội dung |
|---|---|
| Kiểm tra mime type **thực** | Dùng magic bytes, không tin `Content-Type` do client gửi |
| Chặn file thực thi | `.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.jar`, `.msi`, `.ps1`, `.apk`, `.dll` |
| Chặn archive lồng nhau | Từ chối file `.zip`/`.rar`/`.7z`/`.tar` ở đợt này để tránh zip bomb |
| Không phục vụ file tĩnh | Tải tệp qua cổng có kiểm tra quyền (`GET /issues/:id/attachments/:attachmentId`), không để URL R2 public |
| Kiểm tra quyền khi tải | Chỉ chủ báo cáo và `SYS-ADMIN` được tải tệp đính kèm |
| Giới hạn dung lượng | Quota riêng cho tệp đính kèm, **không** dùng chung quota dataset (10 MB/tệp, tối đa 3 tệp — giá trị đề xuất, cần chốt ở Phần 2 mục 6.2 #8) |
| Tên file lưu trữ | Không dùng tên file gốc làm khóa lưu trữ → tránh path traversal và tránh rò dữ liệu tên file qua URL |

### 3.14. 2FA

**Quyết định v3:** **không có 2FA** ở đợt này.

**Bộ biện pháp thay thế (đủ cho Đợt 1):**

1. Rate-limit bằng Redis (mục 3.9) — chặn dò mật khẩu và dò OTP.
2. Refresh token rotation + reuse detection → thu hồi toàn bộ phiên khi phát hiện trộm token (mục 3.7).
3. OTP quên mật khẩu: 6 chữ số, hết hạn 10 phút, tối đa 3 lần nhập sai, gửi lại vô hiệu hoá OTP cũ.
4. Đặt lại mật khẩu thu hồi toàn bộ phiên — kẻ chiếm phiên không giữ được quyền truy cập.
5. Quản lý phiên: người dùng xem và đăng xuất từ xa được từng thiết bị.
6. Thông báo bắt buộc khi phát hiện hành vi bất thường — chưa có mục sự kiện tương ứng trong 7 sự kiện đợt 1 → **ghi nhận là nợ kỹ thuật**, xử lý ở đợt sau nếu cần.

**Điều kiện mở lại đề xuất:** khi có yêu cầu tuân thủ (SOC 2, ISO 27001) hoặc khi người dùng báo cáo bị chiếm tài khoản.

### 3.15. Secrets và cấu hình

| Secret | Nguồn | Bắt buộc |
|---|---|---|
| `JWT_ACCESS_SECRET` | môi trường chạy | Không có giá trị mặc định — hiện tại `jwt.strategy.ts` fallback `'default_jwt_secret'` là **rủi ro bảo mật phải sửa** |
| `JWT_REFRESH_SECRET` | môi trường chạy | Bắt buộc mới |
| ~~`GEMINI_API_KEY`~~ | — | **Gỡ ở v5** — không còn API AI bên ngoài |
| `AI_INFERENCE_BASE_URL` | môi trường chạy | URL **nội bộ** tới engine suy luận (`http://vllm:8000/v1`). Adapter AI fail an toàn (`DEPENDENCY_UNAVAILABLE`) khi thiếu hoặc engine chưa sẵn sàng |
| `AI_MODEL_PRIMARY` / `AI_MODEL_FAST` | môi trường chạy | Tên model + **checksum SHA-256** của file `.gguf`. Không dùng thẻ `latest` |
| Khóa S3/R2 | môi trường chạy | Adapter Storage có local fallback |
| `SMTP_*` | môi trường chạy | Adapter Email fail an toàn → API trả `DEPENDENCY_UNAVAILABLE` |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `GOOGLE_REDIRECT_URI` | môi trường chạy | Cần HTTPS cho redirect URI |
| `REDIS_URL` | môi trường chạy | **v5:** dùng cho **cache** + **adapter Socket.IO** (multi-instance) + rate-limit. BullMQ đã bị gỡ |
| `KAFKA_BROKERS` / `KAFKA_CLIENT_ID` / `KAFKA_SASL_*` | môi trường chạy | Cấu hình broker Kafka. Thiếu cấu hình → API khởi động ở chế độ **degraded** (không phát được sự kiện) hoặc fail tùy môi trường |
| `AI_INFERENCE_TIMEOUT_MS` | môi trường chạy | Mặc định `180000`. Vượt → job thất bại có kiểm soát, không retry vô hạn |
| `AI_MAX_CONCURRENCY` | môi trường chạy | Mặc định `1` — bắt buộc để không kiệt RAM trên CPU-only |

**Quy tắc:**
- Không secret nào nằm trong repo. `.env.example` chỉ liệt kê tên biến.
- Fail an toàn: thiếu secret hạ tầng → trả `DEPENDENCY_UNAVAILABLE` (503) kèm thông báo có kiểm soát, **không** im lặng và **không** log giá trị secret.
- Không log giá trị secret, token, mật khẩu, OTP, `refresh_token_hash` ở bất kỳ tầng nào.

### 3.16. Đối chiếu với mã nguồn hiện tại — danh sách sửa bắt buộc

| # | Vị trí | Vấn đề | Sửa |
|---|---|---|---|
| 1 | `shared/casl/casl-ability.factory.ts` | `can(Action.Manage, 'all')` cho `role === 'admin'` | Thay bằng cấp quyền theo subject cụ thể (mục 3.10) |
| 2 | `shared/casl/casl-ability.factory.ts` | `workspaceRole` dùng `owner\|editor\|viewer` | Đổi sang mô hình 2 cấp: `WS-OWNER\|WS-MEMBER` + `PROJ-OWNER\|PROJ-MEMBER\|PROJ-VIEWER` |
| 3 | `shared/casl/subjects.type.ts` | Thiếu subject mới | Thêm `ProjectMember`, `Notification`, `IssueReport`, `AuditLog`, `Summary`, `AnalysisResult` |
| 4 | `shared/decorators/current-user.decorator.ts` + JWT payload | Nhúng `workspaceId`/`workspaceRole` vào token | Bỏ khỏi token; đọc từ DB mỗi request (mục 3.10) |
| 5 | `modules/auth/strategies/jwt.strategy.ts` | Fallback `'default_jwt_secret'` | Bắt buộc có secret từ env, fail khởi động nếu thiếu |
| 6 | `modules/auth/dto/register.dto.ts` | Cho phép `role` trong DTO đăng ký | Bỏ trường `role` (mục 3.6) |
| 7 | `modules/auth/schemas/user_session.schema.ts` | TTL 7 ngày | Nâng lên 30 ngày (mục 3.7) |
| 8 | Toàn bộ `shared/` | Chưa có rate-limit | Thêm Redis rate-limit (mục 3.9) |
| 9 | Toàn bộ `shared/` | Chưa có `audit` module | Tạo module mới `apps/api/src/modules/audit/` (mục 3.8) |
| 10 | `shared/filters/all-exceptions.filter.ts` | Chưa ánh xạ `TOKEN_INVALID`, `TOKEN_EXPIRED`, `LIMIT_EXCEEDED` | Ánh xạ sang HTTP status tương ứng (401/429) |
| 11 | `modules/auth/auth.service.ts` | Refresh token hiện tại — cần kiểm tra có rotation + reuse detection chưa | Bảo đảm có, theo mục 3.7 |
| 12 | `shared/casl/subjects.type.ts` (v5) | Thiếu subject `FindingFeedback` | Thêm subject cho nhóm `FB-*` (mục 3.5b) |
| 13 | `shared/casl/casl-ability.factory.ts` (v5) | Chưa tách quyền "nhận xét của chính mình" khỏi quyền "xem nhận xét" | Thêm điều kiện `resource.userId === user.id` cho hành động sửa/xoá |
| 14 | `shared/` (v5) | Chưa có guard cho kết nối Socket.IO | Thêm `WsAuthGuard` — xác thực access token trong handshake (mục 3.18) |
| 15 | `shared/` (v5) | Chưa có kiểm soát kích thước payload Kafka | Giới hạn message size; dữ liệu lớn phải đi qua tham chiếu id, không nhúng payload |
| 16 | `shared/crypto/mask-pii` (v5) | Che PII đang gắn với "gửi ra ngoài" | Tái định nghĩa thành "che trước khi đưa cho mô hình" — áp dụng cho cả mô hình cục bộ (mục 3.12) |

### 3.17. Các tình huống truy cập trái phép bắt buộc kiểm thử

Danh sách này là **đầu vào bắt buộc** cho Phần 13 (chiến lược kiểm thử).

| # | Tình huống | Kết quả mong đợi |
|---|---|---|
| 1 | `SYS-ADMIN` gọi `GET /projects/:id` | `FORBIDDEN` |
| 2 | `SYS-ADMIN` gọi `GET /workspaces/:id` | `FORBIDDEN` |
| 3 | `SYS-ADMIN` gọi endpoint tải file gốc | `FORBIDDEN` |
| 4 | `SYS-ADMIN` gọi `GET /users` (danh sách hồ sơ) | `200` — nhưng phải ghi audit log |
| 5 | `SYS-ADMIN` sửa hồ sơ người khác | `FORBIDDEN` |
| 6 | `SYS-ADMIN` xem phiên đăng nhập của người khác | `FORBIDDEN` |
| 7 | `WS-MEMBER` sửa thông tin workspace | `FORBIDDEN` |
| 8 | `WS-MEMBER` thêm thành viên workspace | `FORBIDDEN` |
| 9 | `WS-MEMBER` xem danh sách thành viên workspace | `200` |
| 10 | ~~`PROJ-VIEWER` xoá dòng~~ | ~~`FORBIDDEN`~~ — **bỏ 2026-11-05**, endpoint không còn tồn tại |
| 11 | ~~`PROJ-VIEWER` sửa ô~~ | ~~`FORBIDDEN`~~ — **bỏ 2026-11-05**, endpoint không còn tồn tại |
| 12 | `PROJ-VIEWER` đổi tên cột | `FORBIDDEN` |
| 13 | `PROJ-VIEWER` chạy phân tích | `FORBIDDEN` |
| 14 | `PROJ-VIEWER` lưu trạng thái project | `FORBIDDEN` |
| 15 | `PROJ-VIEWER` xem bảng dữ liệu / lọc / tìm kiếm | `200` |
| 16 | `PROJ-VIEWER` tải file gốc | `200` + ghi audit log |
| 17 | `PROJ-VIEWER` tải PDF Tổng kết | `200` + ghi audit log |
| 18 | `PROJ-MEMBER` import dataset | `FORBIDDEN` |
| 19 | `PROJ-OWNER` xoá project | `FORBIDDEN` (chỉ `WS-OWNER`) |
| 20 | `PROJ-MEMBER` xoá project | `FORBIDDEN` |
| 21 | Người không thuộc workspace đọc project | `NOT_FOUND` (không lộ sự tồn tại) |
| 22 | `PROJ-09` tìm thành viên trong project — email người ngoài workspace | không xuất hiện trong kết quả |
| 23 | Access token hết hạn | `401` `TOKEN_EXPIRED` |
| 24 | Access token sai chữ ký | `401` `TOKEN_INVALID` |
| 25 | Refresh token đã bị revoke (tái sử dụng) | `401` + **thu hồi toàn bộ phiên** của user |
| 26 | Đăng nhập sai quá 5 lần/giờ | `429` `LIMIT_EXCEEDED` + thời gian chờ |
| 27 | Nhập OTP sai quá 3 lần | `INVALID` + OTP bị vô hiệu hoá |
| 28 | Yêu cầu OTP cho email không tồn tại | phản hồi **giống hệt** trường hợp email tồn tại |
| 29 | User `blocked` dùng access token còn hạn | `401` |
| 30 | Đặt lại mật khẩu bằng OTP → refresh token cũ | `401` (phiên đã bị thu hồi) |
| 31 | Tải tệp đính kèm của báo cáo của người khác | `NOT_FOUND` |
| 32 | Tải tệp đính kèm bằng URL R2 trực tiếp | `403` (URL không công khai) |
| 33 | Đăng ký với `role: 'admin'` trong body | `400` (trường bị loại bỏ khỏi DTO) |
| 34 | `WS-OWNER` xem audit log của workspace khác | `NOT_FOUND` / `FORBIDDEN` |
| 35 | `WS-MEMBER` xem audit log | `FORBIDDEN` |
| 36 | Job AI chạy — log worker có giá trị ô chưa che | log phải chỉ chứa định danh cột + số dòng |
| 37 | `SYS-ADMIN` gọi `GET /projects/:id/ai-quality-metrics` | `FORBIDDEN` — Admin không đọc nội dung nghiệp vụ |
| 38 | `PROJ-VIEWER` gọi `GET /projects/:id/ai-quality-metrics` | `FORBIDDEN` |
| 39 | `PROJ-VIEWER` tạo nhận xét | `200` — Viewer **được** nhận xét (không sửa dữ liệu) |
| 40 | Người A sửa nhận xét của người B | `FORBIDDEN` |
| 41 | `PROJ-MEMBER` xoá nhận xét của thành viên khác | `FORBIDDEN` (chỉ `PROJ-OWNER`/`WS-OWNER`, và phải ghi audit log) |
| 42 | `PROJ-OWNER` xoá nhận xét của thành viên | `200` + **bắt buộc** ghi audit log |
| 43 | Nhận xét chứa PII (email/số điện thoại) | được lưu nguyên văn nhưng **không** được đưa vào kho mẫu RAG (phải bị loại ở bước chuẩn hoá) |
| 44 | Client kết nối Socket.IO không có token / token hết hạn | handshake bị từ chối (`401`), không vào được phòng nào |
| 45 | Client cố gửi event vào phòng của user khác qua Socket.IO | `FORBIDDEN` — server từ chối emit vào room không thuộc user |
| 46 | Payload Kafka chứa dữ liệu nguyên bản chưa che | bị từ chối ở producer (rule kiểm tra kích thước + schema, mục 3.16 #15) |
| 47 | Truy cập trực tiếp `http://vllm:8000/v1` từ ngoài container network | không route được — engine chỉ bind trong mạng nội bộ |
| 48 | Yêu cầu upload file `.xlsx` | `400` `UNSUPPORTED_FILE_TYPE` — hệ thống chỉ nhận `.csv` |

### 3.18. Bảo mật kết nối Socket.IO (v5)

**Bối cảnh.** Socket.IO là kênh realtime duy nhất từ backend tới trình duyệt (Phần 9 v3 mục 3.10). Nó là **kênh đẩy dữ liệu**, không phải kênh xác thực — mọi thao tác nghiệp vụ vẫn phải qua HTTP và kiểm tra quyền.

#### Xác thực

| Quy tắc | Nội dung |
|---|---|
| Cơ chế | Access token truyền qua query string lúc handshake: `/api/v1/realtime?token=<accessToken>` (Socket.IO không gửi header tùy chọn ở bước handshake WebSocket thuần) |
| Xác thực | `WsAuthGuard` kiểm tra chữ ký + hạn + trạng thái user (`blocked` → từ chối) |
| Lỗi | Handshake bị từ chối với mã `401` + `TOKEN_INVALID`/`TOKEN_EXPIRED`; **không** gửi chi tiết lý do cho client chưa xác thực |
| Token hết hạn | Client nhận sự kiện `auth:expired` → chuyển sang luồng refresh token → kết nối lại. Server **không** tự refresh token thay client |
| Không dùng cookie | Không dùng cookie phiên để xác thực Socket.IO — tránh CSRF và tránh phụ thuộc domain |
| Không log token | Access token trong query string **không được** ghi vào access log; phải lọc ở tầng reverse proxy và ở logger |

#### Phòng (room) và phạm vi

| Phòng | Ai được vào | Nội dung nhận |
|---|---|---|
| `user:{userId}` | Chính người dùng đó | Thông báo cá nhân, tiến độ job AI của họ |
| `project:{projectId}` | Thành viên có quyền xem project | Tiến độ phân tích, phát hiện mới |
| `analysis:{analysisId}` | Người có quyền xem lần phân tích | Cập nhật chi tiết từng phát hiện |

- Server **tự** đưa client vào phòng sau khi xác thực và kiểm tra quyền — client **không** tự chọn phòng tùy ý.
- Client **không** được phát sự kiện (`emit`) vào phòng; mọi sự kiện từ client đi qua HTTP API. Gateway chặn mọi `emit` không thuộc danh sách cho phép → `FORBIDDEN`.
- Khi token hết hạn hoặc bị thu hồi → server **gỡ client khỏi mọi phòng** và đóng kết nối.
- Khi quyền của người dùng thay đổi (bị xoá khỏi project) → phải gỡ khỏi phòng tương ứng (phát sự kiện `auth:revoked` qua Kafka để gateway xử lý).

#### Chống lạm dụng

| Quy tắc | Nội dung |
|---|---|
| Giới hạn kết nối | Tối đa **3 kết nối đồng thời** trên 1 user; vượt → từ chối kết nối mới |
| Giới hạn tần suất | Tối đa 10 lần kết nối lại / phút / user (chống reconnect loop) |
| Reconnect backoff | Client dùng backoff luỹ thừa `1s → 2s → 4s → … → 30s` + jitter |
| Khi mất kết nối | Client phải **đồng bộ lại** dữ liệu qua HTTP (cursor pagination) — không coi Socket.IO là nguồn dữ liệu chính |
| Cấm dữ liệu nhạy cảm | Không đẩy giá trị ô lỗi chưa che qua Socket.IO; chỉ đẩy metadata và số lượng |

### 3.19. Chính sách bảo mật cho AI chạy nội bộ (v5)

| Hạng mục | Quy tắc |
|---|---|
| Mạng | Engine suy luận bind trong **mạng nội bộ container**; không publish port ra ngoài; không có reverse proxy route tới engine |
| Xác thực tới engine | `AiInferencePort` dùng **API key nội bộ** (`AI_INFERENCE_API_KEY`) gửi qua header — không cấu hình engine ở chế độ open |
| Mô hình | File model phải có **checksum SHA-256** khớp cấu hình; CI kiểm tra trước khi deploy |
| Prompt injection | Nội dung từ dataset (tên cột, mẫu ô) là **dữ liệu không tin cậy** → phải được đánh dấu là dữ liệu trong prompt, không phải lệnh. Không có hành động nào để mô hình thực thi |
| Dữ liệu độc | Mô hình chỉ **sinh văn bản phân tích**. Không có đường dẫn để mô hình ghi dữ liệu, gọi endpoint khác, hay thực thi mã |
| Tài nguyên | `concurrency = 1`, timeout 180s, retry ≤ 2 lần; giám sát RAM — dừng nhận job mới nếu RSS engine > 85% RAM máy |
| Log | Không log prompt/response ở mức INFO; chỉ log model, thời gian, số token, mã lỗi schema, số mẫu RAG đã chèn |
| Khi engine lỗi | AI fail **mềm**: Tổng kết vẫn trả kết quả phân tích hệ thống, chỉ thiếu phần giải thích/đề xuất của AI (Phần 12 v4 mục 3.9) |
| Khi model đổi | Bộ benchmark (Phần 12 v4 mục 3.15.5) phải chạy lại trước khi đưa model mới vào production |

## 4. Đầu vào và đầu ra

**Đầu vào**
- Phần 1 v1 — định hướng Modular Monolith + Ports and Adapters.
- Phần 2 v5 — danh mục **79 tính năng**; đặc biệt mục 3.33 (`AUTH-*`), 3.34.1 (vai trò `admin`), 3.35–3.38 (`WS-*`, `PROJ-*`, `NOTIF-*`, `ISSUE-*`), **3.38b (`FB-*` — nhận xét kết quả)**, 3.31.3 (ranh giới dữ liệu), 3.39 (chia đợt).
- Phần 3 v4 — **66 use case** và ma trận quyền (mục 3.8).
- Phần 4 v4 — ranh giới module, quyết định tách worker, quyết định viết lại backend, module `feedback`, hạ tầng Kafka + Socket.IO.
- Phần 9 v3 — hạ tầng Kafka (5 topic) + Socket.IO gateway.
- Phần 12 v4 — model AI cục bộ (mục 3.15), vòng lặp nhận xét → học lại (mục 3.16).
- Mã nguồn hiện tại — CASL factory, JWT strategy, DTO đăng ký, schema session.
- Tham chiếu: CASL + guard + policy pattern, module `audit`.

**Đầu ra**
- Mô hình 5 vai trò với ranh giới rõ ràng.
- Ma trận quyền đầy đủ cho **66 use case**, có cột `SYS-ADMIN`.
- Ma trận quyền riêng cho nhóm nhận xét kết quả `UC-68`→`UC-72` (mục 3.5b).
- Chính sách đăng ký, phiên, token, thu hồi quyền.
- Phạm vi audit log, cấu trúc bản ghi, quyền xem.
- Cơ chế rate-limit Redis, chống email enumeration.
- Cơ chế kỹ thuật CASL + guard, danh sách sửa **16 điểm** trong code hiện tại.
- **48 tình huống truy cập trái phép** bắt buộc kiểm thử.
- Chính sách bảo mật cho kết nối **Socket.IO** (mục 3.18) và cho AI chạy nội bộ (mục 3.19).

## 5. Điều kiện hoàn tất phần này

Chính sách quyền và bảo vệ dữ liệu được xác nhận trước implementation.

**Trạng thái v5:** mô hình vai trò (5 vai trò), ma trận quyền **66 use case** (gồm nhóm `FB-*`), chính sách đăng ký, chính sách phiên/token, phạm vi và quyền xem audit log, cơ chế rate-limit, cơ chế CASL, **ranh giới dữ liệu cho AI cục bộ**, bảo vệ tệp đính kèm, bảo mật Socket.IO, và danh sách tình huống kiểm thử đã chốt.

## 6. Câu hỏi và phụ thuộc còn mở (v5)

### 6.1. Đã chốt ở v3

| # | Câu hỏi đã chốt | Kết quả |
|---|---|---|
| 1 | Chính sách đăng ký / admin cấp quyền | Đăng ký **công khai**, vai trò mặc định `analyst`; `admin` chỉ cấp qua database/bootstrap, không có endpoint API (mục 3.6) |
| 2 | Cơ chế thu hồi token và thời hạn phiên | Access 15 phút, refresh 7 ngày, phiên TTL 30 ngày; rotation + reuse detection thu hồi toàn bộ phiên (mục 3.7) |
| 3 | 2FA | **Không có** ở đợt này; thay bằng 6 biện pháp thay thế (mục 3.14) |
| 4 | Quyền tải file dữ liệu gốc | `PROJ-VIEWER` **được** tải; ranh giới an toàn là "quyền ghi vào dữ liệu làm việc" (mục 3.4) |
| 5 | Quyền xuất dữ liệu đã xử lý (CSV/JSON) | **Không có tính năng** ở đợt này — chỉ xuất PDF (mục 3.5) |
| 6 | Quyền xem lịch sử job AI / log lỗi AI | Theo đúng quyền chạy phân tích — `WS-OWNER`/`PROJ-OWNER`/`PROJ-MEMBER`; `PROJ-VIEWER` không xem (mục 3.4) |
| 7 | Quyền xem audit log | `SYS-ADMIN` toàn cục; `WS-OWNER` chỉ trong workspace của họ; còn lại không xem được (mục 3.8) |
| 8 | Chính sách giữ/xoá bằng chứng, audit log, thông báo | Đợt này **không xoá tự động**; giới hạn bằng quota dung lượng (mục 3.11) |
| 9 | Ranh giới `SYS-ADMIN` | Tài khoản **tách biệt hoàn toàn**, không phải thành viên workspace/project, không đọc dữ liệu nghiệp vụ (mục 3.3) |
| 10 | Cách chặn `SYS-ADMIN` đọc dữ liệu nghiệp vụ | Qua **CASL** — không cấp quyền trên subject nghiệp vụ (mục 3.10) |
| 11 | Cơ chế đếm rate-limit | **Redis** (dùng chung cache + adapter Socket.IO) (mục 3.9) |

### 6.2. Còn mở

| # | Câu hỏi | Ảnh hưởng | Nơi xử lý |
|---|---|---|---|
| 1 | Cụ thể MIME type và dung lượng tệp đính kèm báo cáo sự cố (10 MB/tệp, 3 tệp — đề xuất) | Schema + validation | Phần 2 mục 6.2 #8, Phần 8 |
| 2 | Chính sách giữ thông báo (giữ N ngày hay tối đa M bản ghi) | TTL index | Phần 2 mục 6.2 #9, Phần 10 |
| 3 | Có nên gửi **email** cho thông báo bắt buộc không? Đợt này mới chỉ in-app | Kênh phân phối | Phần 2 mục 3.37.2 |
| 4 | Quota dung lượng tính trên tổng workspace hay từng user | Chính sách | Phần 4 mục 6 #4, Phần 10 |
| 5 | Có cần trang xem audit log trong giao diện quản trị, hay chỉ truy vấn qua API? | Phạm vi UI | Phần 7, Phần 14 |
| 6 | Khi `SYS-ADMIN` bị xoá/khoá, các bản ghi audit do họ tạo còn giữ nguyên hay ẩn danh? | Quyền riêng tư dữ liệu | Phần 8 |
| 7 | Quy tắc chuyển `workspace.members[].role` từ `editor|viewer` sang `owner|member` cho dữ liệu cũ | Migration | Phần 11 |
| 8 | Thời gian lưu tối đa của kho mẫu `feedback_example` — có giới hạn số lượng mẫu không (VD 50.000 mẫu) để tránh phình vector index? | Vận hành, chi phí | Phần 8 v4, Phần 10 v4 |
| 9 | Ai được quyền xem **ground truth của bộ benchmark** (khác với nhận xét thường)? Đề xuất: chỉ `PROJ-OWNER` + `SYS-ADMIN` (Admin được phép vì đây là chất lượng hệ thống, không phải dữ liệu người dùng) | Phạm vi | Phần 7 v3, Phần 13 v3 |
| 10 | Có cần cơ chế **phê duyệt** cho nhận xét trước khi vào kho mẫu RAG, hay kiểm duyệt tự động bằng điểm tin cậy ≥ 0,6 là đủ? | Chất lượng học lại | Phần 12 v4 mục 3.16.4 |

**Phụ thuộc cứng:** câu hỏi 1 và 7 phải chốt trước khi thiết kế schema `issue_report` và viết script migration (bước 10 của Phần 4 mục 3.10). Câu hỏi 4 phải chốt trước khi cấu hình quota ở Phần 10. Câu hỏi 8 và 10 phải chốt trước khi triển khai module `feedback` (bước 8b của Phần 4 mục 3.10).

### 6.3. Phụ thuộc bên ngoài

- ~~`GEMINI_API_KEY`~~ — **gỡ ở v5**, không còn API AI bên ngoài.
- `AI_INFERENCE_BASE_URL` (URL nội bộ tới engine suy luận cục bộ) + `AI_MODEL_PRIMARY` / `AI_MODEL_FAST` (kèm checksum). Adapter AI fail an toàn (`DEPENDENCY_UNAVAILABLE`) khi thiếu hoặc engine chưa sẵn sàng.
- `KAFKA_BROKERS` — cấu hình broker Kafka nội bộ.
- Khóa S3/R2 cho port Storage; adapter có local fallback.
- `SMTP_*` cho port `EmailSender`; thiếu cấu hình → `DEPENDENCY_UNAVAILABLE`.
- `GOOGLE_CLIENT_ID` / `_SECRET` / `GOOGLE_REDIRECT_URI` cho `AUTH-03`; cần HTTPS.
- `REDIS_URL` cho **cache** + **adapter Socket.IO** + rate-limit (BullMQ đã bị gỡ ở v4).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` bắt buộc, không có giá trị mặc định.
- Chính sách quyền cần được ánh xạ vào guard của NestJS ở Phần 5 (port) và Phần 9 (hạ tầng); chưa triển khai.

## 7. Prompting log và lịch sử thay đổi

- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 6 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu.
- **v2 / 2026-11-04:** Mô hình vai trò workspace/project + ma trận quyền thao tác + ranh giới dữ liệu gửi ra ngoài.
- **v5 / 2026-11-05:** Áp dụng 4 quyết định bảo mật. (1) **AI chạy nội bộ** — mục 3.12 viết lại: dữ liệu **không rời hệ thống**; che PII vẫn bắt buộc; cấm SDK AI bên ngoài (rule CI R7); engine chỉ gọi từ worker, chỉ qua `AiInferencePort`; không log prompt/response ở mức INFO. (2) **Nhóm nhận xét kết quả `UC-68`→`UC-72`** — thêm mục 3.5b với ma trận quyền riêng, 7 quy tắc bắt buộc; `SYS-ADMIN` **không** có quyền với nhóm này; `PROJ-VIEWER` **được** nhận xét; bổ sung 12 tình huống truy cập trái phép (#37–#48). (3) **Socket.IO** — thêm mục 3.18 về xác thực handshake, phòng, quyền emit. (4) Gỡ `GEMINI_API_KEY`, bổ sung secret mới (`AI_INFERENCE_BASE_URL`, `KAFKA_BROKERS`...). Ngoài ra: gỡ `UC-09` (chọn sheet) khỏi ma trận quyền, đổi `.xlsx`/`.csv` → `.csv`, danh sách sửa code 11 → **16 điểm**, tình huống kiểm thử 34 → **48**.
- **v3 / 2026-11-05:** Bổ sung vai trò `SYS-ADMIN` và mô hình 5 vai trò; quyền `WS-MEMBER` chỉ đọc ở cấp workspace; ma trận quyền đầy đủ 67 use case có cột `SYS-ADMIN`; chính sách đăng ký công khai; chính sách phiên/token (access 15 phút, refresh 7 ngày, phiên TTL 30 ngày); phạm vi audit log 8 hành động + quyền xem theo phạm vi workspace; rate-limit bằng Redis; cơ chế CASL thay cho `can(Manage, 'all')`; quyết định `PROJ-VIEWER` được tải file gốc; không có 2FA; không xoá tự động dữ liệu ở đợt này; danh sách 34 tình huống truy cập trái phép bắt buộc kiểm thử. **Cập nhật 2026-11-05:** gỡ 2 tình huống `PROJ-VIEWER` xoá dòng / sửa ô do các thao tác này không còn tồn tại.
