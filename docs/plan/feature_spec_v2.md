# ĐẶC TẢ CHI TIẾT TÍNH NĂNG VÀ HỢP ĐỒNG API - GIAI ĐOẠN 1
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
**Tập tin:** `docs/feature_spec_v2.md`  
**Phiên bản:** v2.0  
**Giai đoạn áp dụng:** Giai đoạn 1 (Core Platform MVP - Khung nền tảng chạy độc lập)  
**Ngày lập:** 19/10/2026  
**Trạng thái tài liệu:** Tài liệu đặc tả từng tính năng chi tiết gắn liền với hợp đồng RESTful API tương ứng  

---

## Lịch sử thay đổi (Change Log v1.0 ➔ v2.0)
- **Thay đổi gì:** Nâng cấp từ bảng nhóm tính năng tổng quan (v1.0) sang **Bản đặc tả chi tiết từng tính năng kèm Hợp đồng API (API Contracts)**:
  1. Phân rã từng tính năng nghiệp vụ thành luồng giao diện (UI Action) và đặc tả API kỹ thuật tương ứng.
  2. Quy chuẩn hóa toàn bộ endpoints theo chuẩn RESTful (kebab-case, danh từ số nhiều theo Rule 9: `/api/v1/...`).
  3. Định nghĩa tường minh: HTTP Method, Request Headers, URL Parameters, Request Body Payload, Response Payload và các mã trạng thái HTTP (`200`, `201`, `400`, `401`, `404`, `409`, `422`).
  4. Xác định rõ ràng các tính năng chỉ chạy ở phía Client (No API) như Virtual Scrolling hay Offline Network Listener.
- **Lý do:** Đáp ứng yêu cầu của người dùng về việc thiết kế cụ thể từng tính năng và API đi kèm, làm căn cứ kỹ thuật chính xác cho việc lập trình Backend NestJS và Frontend Vite/React.
- **Ảnh hưởng đến đâu:** Là bản thiết kế chi tiết để lập trình viên Frontend và Backend triển khai độc lập mà không bị lệch hợp đồng giao tiếp dữ liệu.

---

## 1. Quy chuẩn Thiết kế RESTful API chung

Toàn bộ các API trong hệ thống đều tuân thủ các nguyên tắc thiết kế sau:
- **Tiền tố phiên bản API (API Prefix):** `/api/v1`
- **Quy tắc đặt tên tài nguyên:** kebab-case, danh từ số nhiều (`/workspaces`, `/datasets`, `/transformations`).
- **Xác thực:** Sử dụng Bearer Token qua header `Authorization: Bearer <accessToken>` (trừ các endpoint đăng ký, đăng nhập và refresh-token).
- **Cấu trúc phản hồi lỗi chuẩn hóa (Standard Error Response):**
  ```json
  {
    "statusCode": 400,
    "error": "Bad Request",
    "message": "Cột targetColumn 'salary' không tồn tại trong dataset",
    "timestamp": "2026-10-19T20:30:00.000Z",
    "path": "/api/v1/datasets/ds_001/transformations"
  }
  ```

---

## 2. Đặc tả Chi tiết Tính năng và API tương ứng

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DANH MỤC 7 MODULE GIAI ĐOẠN 1                   │
│                                                                        │
│  [ Module 1: Auth & User Profile ]  ──▶  API: /api/v1/auth, /users    │
│  [ Module 2: Workspace Management ] ──▶  API: /api/v1/workspaces      │
│  [ Module 3: File Ingestion ]       ──▶  API: /api/v1/.../datasets    │
│  [ Module 4: Data Grid & Visualize] ──▶  API: /api/v1/datasets/...    │
│  [ Module 5: Data Transformations ] ──▶  API: /api/v1/.../transform   │
│  [ Module 6: Versioning & Lineage ] ──▶  API: /api/v1/.../versions    │
│  [ Module 7: Clean Data Exporter ]  ──▶  API: /api/v1/.../export      │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Module 1: Quản trị Tài khoản & Phiên làm việc (AUTH)

#### Tính năng F1.1: Đăng ký tài khoản người dùng (User Registration)
- **Hành vi giao diện (UI Action):** Người dùng điền form tại màn hình `/register` (Họ tên, Email, Mật khẩu $\ge 8$ ký tự có số và chữ hoa). Bấm nút "Đăng ký".
- **API Endpoint:** `POST /api/v1/auth/register`
- **Request Body (JSON):**
  ```json
  {
    "email": "analyst@uth.edu.vn",
    "password": "SecurePassword123@",
    "fullName": "Nguyễn Văn Phân Tích"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "message": "Đăng ký tài khoản thành công",
    "userId": "usr_6713a01b",
    "email": "analyst@uth.edu.vn"
  }
  ```
- **Mã lỗi có thể xảy ra:** `409 Conflict` (Email đã tồn tại), `422 Unprocessable Entity` (Mật khẩu không đạt độ phức tạp).

---

#### Tính năng F1.2: Đăng nhập hệ thống (User Login)
- **Hành vi giao diện (UI Action):** Người dùng nhập Email và Mật khẩu tại `/login`. Bấm nút "Đăng nhập".
- **API Endpoint:** `POST /api/v1/auth/login`
- **Request Body (JSON):**
  ```json
  {
    "email": "analyst@uth.edu.vn",
    "password": "SecurePassword123@"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "dGhpcy1pcy1hLXJlZnJl...",
    "expiresIn": 900,
    "user": {
      "id": "usr_6713a01b",
      "email": "analyst@uth.edu.vn",
      "fullName": "Nguyễn Văn Phân Tích",
      "role": "DATA_ANALYST"
    }
  }
  ```
- **Mã lỗi có thể xảy ra:** `401 Unauthorized` (Sai tài khoản hoặc mật khẩu).

---

#### Tính năng F1.3: Làm mới Access Token tự động (Refresh Token)
- **Hành vi giao diện (UI Action):** Được kích hoạt ngầm tự động bởi Axios Interceptor phía Frontend khi một request nhận mã lỗi `401 Token Expired`. Không có tương tác UI trực tiếp.
- **API Endpoint:** `POST /api/v1/auth/refresh-token`
- **Request Body (JSON):**
  ```json
  {
    "refreshToken": "dGhpcy1pcy1hLXJlZnJl..."
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "expiresIn": 900
  }
  ```
- **Mã lỗi có thể xảy ra:** `401 Unauthorized` (Refresh token đã hết hạn hoặc bị thu hồi $\implies$ Điều hướng về `/login`).

---

#### Tính năng F1.4: Đăng xuất tài khoản (User Logout)
- **Hành vi giao diện (UI Action):** Người dùng bấm vào avatar, chọn "Đăng xuất". Frontend xóa token trong bộ nhớ và chuyển về màn hình đăng nhập.
- **API Endpoint:** `POST /api/v1/auth/logout`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body (JSON):**
  ```json
  {
    "refreshToken": "dGhpcy1pcy1hLXJlZnJl..."
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "message": "Đăng xuất thành công, token đã bị thu hồi"
  }
  ```

---

#### Tính năng F1.5: Lấy thông tin cá nhân (Get User Profile)
- **Hành vi giao diện (UI Action):** Tự động gọi khi người dùng mở ứng dụng để tải thông tin hiển thị lên thanh Header.
- **API Endpoint:** `GET /api/v1/users/me`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response `200 OK`:**
  ```json
  {
    "id": "usr_6713a01b",
    "email": "analyst@uth.edu.vn",
    "fullName": "Nguyễn Văn Phân Tích",
    "role": "DATA_ANALYST",
    "createdAt": "2026-10-19T10:00:00.000Z"
  }
  ```

---

### Module 2: Quản lý Không gian làm việc (WS)

#### Tính năng F2.1: Tạo Không gian làm việc mới (Create Workspace)
- **Hành vi giao diện (UI Action):** Người dùng bấm nút "+ Tạo dự án mới", nhập Tên dự án và Mô tả trong Modal. Bấm "Lưu".
- **API Endpoint:** `POST /api/v1/workspaces`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body (JSON):**
  ```json
  {
    "name": "Khảo sát Dữ liệu Nhân sự 2026",
    "description": "Dự án làm sạch và phân tích tiền lương Q4"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "id": "ws_8912c02e",
    "name": "Khảo sát Dữ liệu Nhân sự 2026",
    "description": "Dự án làm sạch và phân tích tiền lương Q4",
    "datasetCount": 0,
    "createdAt": "2026-10-19T20:30:00.000Z"
  }
  ```

---

#### Tính năng F2.2: Lấy danh sách Không gian làm việc (List Workspaces)
- **Hành vi giao diện (UI Action):** Hiển thị danh sách các dự án dưới dạng thẻ (Cards) tại trang chủ Dashboard.
- **API Endpoint:** `GET /api/v1/workspaces`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Query Parameters:** `?page=1&limit=10&search=Nhân+sự`
- **Response `200 OK`:**
  ```json
  {
    "data": [
      {
        "id": "ws_8912c02e",
        "name": "Khảo sát Dữ liệu Nhân sự 2026",
        "description": "Dự án làm sạch và phân tích tiền lương Q4",
        "datasetCount": 3,
        "updatedAt": "2026-10-19T20:30:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
  }
  ```

---

#### Tính năng F2.3: Xóa Không gian làm việc (Delete Workspace)
- **Hành vi giao diện (UI Action):** Người dùng bấm vào menu của Workspace, chọn "Xóa dự án", xác nhận Modal cảnh báo.
- **API Endpoint:** `DELETE /api/v1/workspaces/:workspaceId`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response `200 OK`:**
  ```json
  {
    "message": "Không gian làm việc đã được xóa thành công"
  }
  ```

---

### Module 3: Tiếp nhận và Quản lý Tệp Dữ liệu (FILE & DATASET)

#### Tính năng F3.1: Upload tệp dữ liệu đa định dạng (Upload Dataset File)
- **Hành vi giao diện (UI Action):** Trong Workspace, người dùng kéo thả tệp CSV, Excel (`.xlsx`), hoặc JSON vào vùng Dropzone. Hệ thống hiển thị thanh tiến trình tải lên (Progress Bar).
- **API Endpoint:** `POST /api/v1/workspaces/:workspaceId/datasets/upload`
- **Headers:** 
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: multipart/form-data`
- **Form Data Payload:**
  - `file`: Tệp dữ liệu binary (CSV, XLSX, hoặc JSON).
  - `datasetName`: (Tùy chọn) Chuỗi tên bộ dữ liệu. Nếu rỗng, lấy theo tên tệp gốc.
- **Xử lý Backend:**
  - Kiểm tra kích thước ($\le 50\text{MB}$ với CSV/JSON, $\le 20\text{MB}$ với Excel).
  - Đọc streaming từng dòng, bóc tách cấu trúc, đếm dòng/cột.
  - Nếu là JSON lồng nhau: Kích hoạt Schema Normalizer làm phẳng Dot-notation (max depth = 3).
  - Lưu trữ dữ liệu thô vào MongoDB collection `dataset_records`, lưu metadata vào `datasets`.
- **Response `201 Created`:**
  ```json
  {
    "datasetId": "ds_9901f42a",
    "name": "nhan_su_thang_10.csv",
    "workspaceId": "ws_8912c02e",
    "fileFormat": "CSV",
    "fileSizeBytes": 12582912,
    "rowCount": 50000,
    "columnCount": 6,
    "currentVersion": 1,
    "columns": [
      { "name": "emp_id", "dataType": "string", "nullCount": 0, "nullRate": 0.0 },
      { "name": "full_name", "dataType": "string", "nullCount": 12, "nullRate": 0.00024 },
      { "name": "age", "dataType": "integer", "nullCount": 45, "nullRate": 0.0009 },
      { "name": "salary", "dataType": "float", "nullCount": 85, "nullRate": 0.0017 }
    ],
    "ai_profile": null,
    "ai_recommendations": [],
    "createdAt": "2026-10-19T20:35:00.000Z"
  }
  ```
- **Mã lỗi có thể xảy ra:** `400 Bad Request` (Tệp hỏng hoặc sai định dạng), `413 Payload Too Large` (Vượt quá dung lượng giới hạn).

---

#### Tính năng F3.2: Lấy danh sách Tập dữ liệu trong Workspace (List Datasets)
- **Hành vi giao diện (UI Action):** Hiển thị danh sách các bảng dữ liệu bên trong một Workspace.
- **API Endpoint:** `GET /api/v1/workspaces/:workspaceId/datasets`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response `200 OK`:**
  ```json
  {
    "data": [
      {
        "id": "ds_9901f42a",
        "name": "nhan_su_thang_10.csv",
        "fileFormat": "CSV",
        "rowCount": 50000,
        "columnCount": 6,
        "currentVersion": 1,
        "updatedAt": "2026-10-19T20:35:00.000Z"
      }
    ]
  }
  ```

---

#### Tính năng F3.3: Lấy chi tiết siêu dữ liệu của một Dataset (Get Dataset Metadata)
- **Hành vi giao diện (UI Action):** Được gọi khi người dùng nhấp vào một Dataset để mở màn hình phân tích Data Explorer.
- **API Endpoint:** `GET /api/v1/datasets/:datasetId`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Query Parameters:** `?version=1` (Tùy chọn, mặc định lấy phiên bản hiện tại).
- **Response `200 OK`:**
  ```json
  {
    "id": "ds_9901f42a",
    "name": "nhan_su_thang_10.csv",
    "currentVersion": 1,
    "rowCount": 50000,
    "columnCount": 6,
    "columns": [
      { "name": "emp_id", "dataType": "string", "nullCount": 0, "uniqueCount": 50000 },
      { "name": "salary", "dataType": "float", "nullCount": 85, "uniqueCount": 3400 }
    ],
    "ai_profile": null,
    "ai_recommendations": []
  }
  ```

---

### Module 4: Bảng Dữ liệu Tương tác & Trực quan hóa (GRID & VIS)

#### Tính năng F4.1: Truy vấn dữ liệu bảng có phân trang, lọc và sắp xếp (Query Data Grid)
- **Hành vi giao diện (UI Action):** Cung cấp dữ liệu cho bảng ảo hóa (Virtual Data Grid). Kích hoạt khi người dùng cuộn trang, nhập từ khóa tìm kiếm, lọc theo cột hoặc bấm vào tiêu đề cột để sắp xếp.
- **API Endpoint:** `POST /api/v1/datasets/:datasetId/query`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body (JSON):**
  ```json
  {
    "version": 1,
    "page": 1,
    "pageSize": 50,
    "sortBy": "salary",
    "sortDirection": "desc",
    "searchKeyword": "An",
    "filters": [
      {
        "column": "salary",
        "operator": "greater_than_or_equal",
        "value": 10000000
      },
      {
        "column": "age",
        "operator": "is_not_null"
      }
    ]
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "page": 1,
    "pageSize": 50,
    "totalMatchingRows": 1420,
    "rows": [
      {
        "_rowId": "row_001",
        "emp_id": "EMP-102",
        "full_name": "Nguyễn Văn An",
        "age": 29,
        "salary": 35000000.0
      }
    ]
  }
  ```

---

#### Tính năng F4.2: Lấy thông tin thống kê và biểu đồ phân phối của cột (Get Column Profile & Chart Data)
- **Hành vi giao diện (UI Action):** Người dùng nhấp vào nút "Thống kê" trên tiêu đề một cột. Một Drawer bên phải mở ra hiển thị các chỉ số chi tiết và biểu đồ phân phối.
- **API Endpoint:** `GET /api/v1/datasets/:datasetId/columns/:columnName/profile`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Query Parameters:** `?version=1`
- **Response `200 OK` (Với cột số - Numerical):**
  ```json
  {
    "columnName": "salary",
    "dataType": "float",
    "totalCount": 50000,
    "nullCount": 85,
    "nullPercentage": 0.17,
    "uniqueCount": 3400,
    "statistics": {
      "min": 4500000.0,
      "max": 180000000.0,
      "mean": 18500000.0,
      "median": 15000000.0,
      "stdDev": 12400000.0
    },
    "histogram": [
      { "binRange": "4.5M - 15M", "frequency": 24500 },
      { "binRange": "15M - 30M", "frequency": 18200 },
      { "binRange": "30M - 60M", "frequency": 6500 },
      { "binRange": "> 60M", "frequency": 715 }
    ]
  }
  ```
- **Response `200 OK` (Với cột danh mục - Categorical):**
  ```json
  {
    "columnName": "department",
    "dataType": "string",
    "nullCount": 10,
    "uniqueCount": 5,
    "topCategories": [
      { "value": "Kỹ thuật", "count": 21000, "percentage": 42.0 },
      { "value": "Kinh doanh", "count": 15000, "percentage": 30.0 },
      { "value": "Vận hành", "count": 8500, "percentage": 17.0 }
    ]
  }
  ```

---

#### Tính năng F4.3: Ảo hóa danh sách trên giao diện (Virtual Scrolling DOM Rendering)
- **Hành vi giao diện (UI Action):** Người dùng cuộn nhanh chuột qua hàng chục nghìn dòng. Giao diện duy trì 60 FPS mượt mà.
- **Cơ chế kỹ thuật:** **Chỉ xử lý Client-side (No API)** bằng thư viện `@tanstack/react-virtual`. Frontend chỉ render 25–30 dòng DOM đang hiển thị trong khung nhìn màn hình.

---

### Module 5: Bộ công cụ Xử lý và Biến đổi Dữ liệu (TRANS)

#### Tính năng F5.1: Thực thi biến đổi dữ liệu (Execute Data Transformation)
- **Hành vi giao diện (UI Action):** Người dùng bấm vào menu "Xử lý dữ liệu" trên thanh công cụ, chọn hành động (ví dụ: "Xử lý ô trống" hoặc "Chuẩn hóa chuỗi"), chọn tham số (ví dụ: điền Median), sau đó bấm **"Áp dụng" (Apply)**.
- **API Endpoint:** `POST /api/v1/datasets/:datasetId/transformations`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body (JSON) — Kịch bản 1: Điền giá trị trung vị vào ô trống:**
  ```json
  {
    "currentVersion": 1,
    "actionType": "IMPUTE_STATISTICAL",
    "targetColumn": "salary",
    "parameters": {
      "strategy": "median",
      "customValue": null
    }
  }
  ```
- **Request Body (JSON) — Kịch bản 2: Cắt khoảng trắng thừa và viết hoa:**
  ```json
  {
    "currentVersion": 1,
    "actionType": "SANITIZE_STRING",
    "targetColumn": "full_name",
    "parameters": {
      "trimWhitespace": true,
      "textCase": "CAPITALIZE"
    }
  }
  ```
- **Request Body (JSON) — Kịch bản 3: Xóa các dòng có ô trống:**
  ```json
  {
    "currentVersion": 1,
    "actionType": "DROP_ROWS",
    "parameters": {
      "conditionType": "ANY_NULL",
      "targetColumns": ["age", "salary"]
    }
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "datasetId": "ds_9901f42a",
    "previousVersion": 1,
    "newVersion": 2,
    "actionExecuted": "IMPUTE_STATISTICAL",
    "targetColumn": "salary",
    "rowsAffected": 85,
    "newRowCount": 50000,
    "message": "Đã điền thành công giá trị trung vị (15,000,000) vào 85 ô trống tại cột salary",
    "timestamp": "2026-10-19T20:40:00.000Z"
  }
  ```
- **Mã lỗi có thể xảy ra:** `400 Bad Request` (Tham số không hợp lệ), `409 Conflict` (Phiên bản gửi lên lệch với phiên bản máy chủ đang giữ $\implies$ có người khác vừa sửa).

---

### Module 6: Quản lý Phiên bản Dữ liệu & Hoàn tác (VER)

#### Tính năng F6.1: Lấy lịch sử các phiên bản biến đổi (Get Version History / Changelog)
- **Hành vi giao diện (UI Action):** Người dùng bấm vào nút "Lịch sử thay đổi" (History icon) trên thanh công cụ để xem danh sách các bước đã thực hiện từ trước đến nay.
- **API Endpoint:** `GET /api/v1/datasets/:datasetId/versions`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response `200 OK`:**
  ```json
  {
    "datasetId": "ds_9901f42a",
    "currentVersion": 2,
    "history": [
      {
        "version": 1,
        "actionType": "INITIAL_IMPORT",
        "description": "Nạp dữ liệu gốc từ tệp nhan_su_thang_10.csv",
        "rowsCount": 50000,
        "createdAt": "2026-10-19T20:35:00.000Z"
      },
      {
        "version": 2,
        "actionType": "IMPUTE_STATISTICAL",
        "description": "Điền giá trị trung vị vào 85 ô trống tại cột salary",
        "rowsAffected": 85,
        "rowsCount": 50000,
        "createdAt": "2026-10-19T20:40:00.000Z"
      }
    ]
  }
  ```

---

#### Tính năng F6.2: Hoàn tác về phiên bản trước (Undo / Rollback Version)
- **Hành vi giao diện (UI Action):** Người dùng bấm nút **"Hoàn tác" (Undo)** trên thanh công cụ (hoặc chọn một phiên bản cũ trong lịch sử và bấm "Khôi phục mốc này").
- **API Endpoint:** `POST /api/v1/datasets/:datasetId/rollback`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body (JSON):**
  ```json
  {
    "targetVersion": 1
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "datasetId": "ds_9901f42a",
    "currentVersion": 1,
    "message": "Đã hoàn tác thành công về Phiên bản 1",
    "rowCount": 50000,
    "columnCount": 6
  }
  ```
- **Mã lỗi có thể xảy ra:** `400 Bad Request` (Không thể rollback về phiên bản không tồn tại).

---

#### Tính năng F6.3: Lấy đồ thị nguồn gốc dữ liệu (Get Data Lineage Graph)
- **Hành vi giao diện (UI Action):** Người dùng bấm tab "Data Lineage" để xem cây sơ đồ các bước biến đổi dữ liệu (vẽ bằng thư viện React Flow).
- **API Endpoint:** `GET /api/v1/datasets/:datasetId/lineage`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Xử lý Backend:** Truy vấn đồ thị từ **Neo4j** bằng câu lệnh Cypher:
  `MATCH (d:Dataset {id: $id})-[:HAS_VERSION]->(v:DatasetVersion) OPTIONAL MATCH (v)-[r:TRANSFORMED_BY]->(vNext) RETURN v, r, vNext`
- **Response `200 OK`:**
  ```json
  {
    "nodes": [
      { "id": "v1", "label": "Version 1 (Initial)", "rowCount": 50000 },
      { "id": "v2", "label": "Version 2 (Imputed)", "rowCount": 50000 }
    ],
    "edges": [
      { "source": "v1", "target": "v2", "label": "IMPUTE_STATISTICAL: salary" }
    ]
  }
  ```

---

### Module 7: Xuất bản Dữ liệu Sạch (EXP)

#### Tính năng F7.1: Xem trước dữ liệu trước khi xuất bản (Preview Clean Data)
- **Hành vi giao diện (UI Action):** Người dùng bấm "Xuất dữ liệu", một Modal hiện ra cho xem trước 20 dòng đầu tiên của dữ liệu đã làm sạch để kiểm tra lần cuối.
- **API Endpoint:** `GET /api/v1/datasets/:datasetId/export/preview`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Query Parameters:** `?version=2&limit=20`
- **Response `200 OK`:**
  ```json
  {
    "version": 2,
    "totalRows": 50000,
    "previewRows": [
      { "emp_id": "EMP-101", "full_name": "Nguyễn Văn A", "salary": 15000000.0 }
    ]
  }
  ```

---

#### Tính năng F7.2: Tải tệp dữ liệu đã làm sạch về máy (Download Cleaned File)
- **Hành vi giao diện (UI Action):** Người dùng chọn định dạng muốn tải (CSV, Excel `.xlsx`, hoặc JSON), bấm "Tải xuống". Trình duyệt tự động tải tệp về.
- **API Endpoint:** `GET /api/v1/datasets/:datasetId/export/download`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Query Parameters:** `?version=2&format=csv` *(hoặc `format=xlsx`, `format=json`)*
- **Response `200 OK` (Stream tải về):**
  - Headers:
    - `Content-Type: text/csv; charset=utf-8` (kèm mã UTF-8 BOM để Excel hiển thị đúng tiếng Việt).
    - `Content-Disposition: attachment; filename="nhan_su_thang_10_clean_v2.csv"`
  - Body: Binary stream dữ liệu tệp sạch.

---

#### Tính năng F7.3: Lưu tệp sạch thành một Dataset mới trong hệ thống (Save as New Dataset)
- **Hành vi giao diện (UI Action):** Người dùng chọn "Lưu thành Dataset mới", nhập tên bộ dữ liệu và chọn Workspace đích.
- **API Endpoint:** `POST /api/v1/datasets/:datasetId/export/save-as-new`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body (JSON):**
  ```json
  {
    "version": 2,
    "newDatasetName": "nhan_su_da_lam_sach_q4.csv",
    "targetWorkspaceId": "ws_8912c02e"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "newDatasetId": "ds_1122a33b",
    "name": "nhan_su_da_lam_sach_q4.csv",
    "rowCount": 50000,
    "currentVersion": 1,
    "message": "Tập dữ liệu sạch đã được lưu thành Dataset mới thành công"
  }
  ```

---

### Module 8: Thích ứng Ngoại tuyến Cơ bản (OFF)

#### Tính năng F8.1: Nhận diện và Cảnh báo trạng thái Ngoại tuyến (Offline Status Detection)
- **Hành vi giao diện (UI Action):** Khi người dùng bị mất mạng hoặc Backend bị tắt đột ngột:
  - Một banner màu vàng xuất hiện trên đầu màn hình: *"Mất kết nối tới máy chủ. Hệ thống đang chuyển sang chế độ xem dữ liệu ngoại tuyến"*.
  - Các nút hành động gọi API (như Upload file, Biến đổi dữ liệu, Rollback) bị vô hiệu hóa (disabled) kèm thông báo tooltip.
  - Người dùng vẫn có thể xem bảng dữ liệu hiện tại đã được nạp vào bộ nhớ tạm.
- **Cơ chế kỹ thuật:** **Chỉ xử lý Client-side (No API)** bằng cách lắng nghe sự kiện `window.addEventListener('offline')` kết hợp bộ chặn lỗi mạng của Axios.

---

## 3. Tổng hợp Bảng Đối chiếu Tính năng và Endpoints API (Mapping Summary)

| Module | Tên tính năng | Phương thức HTTP | Đường dẫn API Endpoint | Quyền hạn |
|---|---|:---:|---|:---:|
| **AUTH** | Đăng ký tài khoản | `POST` | `/api/v1/auth/register` | Public |
| **AUTH** | Đăng nhập tài khoản | `POST` | `/api/v1/auth/login` | Public |
| **AUTH** | Làm mới Access Token | `POST` | `/api/v1/auth/refresh-token` | Public |
| **AUTH** | Đăng xuất tài khoản | `POST` | `/api/v1/auth/logout` | Authenticated |
| **AUTH** | Lấy thông tin cá nhân | `GET` | `/api/v1/users/me` | Authenticated |
| **WS** | Tạo Không gian làm việc | `POST` | `/api/v1/workspaces` | Authenticated |
| **WS** | Lấy danh sách Không gian làm việc | `GET` | `/api/v1/workspaces` | Authenticated |
| **WS** | Xóa Không gian làm việc | `DELETE` | `/api/v1/workspaces/:workspaceId` | Authenticated |
| **FILE** | Upload tệp dữ liệu đa định dạng | `POST` | `/api/v1/workspaces/:workspaceId/datasets/upload` | Authenticated |
| **FILE** | Lấy danh sách Dataset trong Workspace | `GET` | `/api/v1/workspaces/:workspaceId/datasets` | Authenticated |
| **FILE** | Lấy siêu dữ liệu chi tiết của Dataset | `GET` | `/api/v1/datasets/:datasetId` | Authenticated |
| **GRID** | Truy vấn dữ liệu bảng (Phân trang, Lọc, Sắp xếp)| `POST` | `/api/v1/datasets/:datasetId/query` | Authenticated |
| **VIS** | Lấy chỉ số thống kê & biểu đồ của cột | `GET` | `/api/v1/datasets/:datasetId/columns/:columnName/profile`| Authenticated |
| **GRID** | Ảo hóa danh sách bảng dữ liệu | *Client-side* | *Không cần API (Xử lý bằng Virtual Scrolling)* | - |
| **TRANS**| Thực thi biến đổi/làm sạch dữ liệu | `POST` | `/api/v1/datasets/:datasetId/transformations` | Authenticated |
| **VER** | Lấy lịch sử các phiên bản biến đổi | `GET` | `/api/v1/datasets/:datasetId/versions` | Authenticated |
| **VER** | Hoàn tác về phiên bản trước (Undo) | `POST` | `/api/v1/datasets/:datasetId/rollback` | Authenticated |
| **VER** | Lấy đồ thị Data Lineage | `GET` | `/api/v1/datasets/:datasetId/lineage` | Authenticated |
| **EXP** | Xem trước dữ liệu trước khi xuất | `GET` | `/api/v1/datasets/:datasetId/export/preview` | Authenticated |
| **EXP** | Tải tệp dữ liệu đã làm sạch về máy | `GET` | `/api/v1/datasets/:datasetId/export/download` | Authenticated |
| **EXP** | Lưu tệp sạch thành Dataset mới | `POST` | `/api/v1/datasets/:datasetId/export/save-as-new` | Authenticated |
| **OFF** | Cảnh báo trạng thái Ngoại tuyến | *Client-side* | *Không cần API (Xử lý bằng Event Listener)* | - |
