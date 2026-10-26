# AI-systems-support-detecting-and-handling-data-quality-issues — Frontend

Frontend của dự án **AI-systems-support-detecting-and-handling-data-quality-issues** — **Hệ thống AI hỗ trợ phát hiện và xử lý vấn đề về chất lượng dữ liệu**. Tên tiếng Anh trong README gốc: **AI Systems Support Detecting and Handling Data Quality Issues**. Tài liệu này dành cho nhóm 2 người phát triển FE, người review và người cần cài/chạy project.

**Trạng thái hiện tại:** đã setup structure, dependency và UI khởi động tối giản. Các module nghiệp vụ, API client, auth, 3D và IndexedDB/sync mới có plan, chưa được tích hợp vào ứng dụng.

## 1. Project Overview

Mục tiêu của hệ thống là hỗ trợ phát hiện các vấn đề chất lượng dữ liệu như giá trị thiếu, ngoại lai, trùng lặp và định dạng không nhất quán; giúp người dùng xem xét, xử lý và theo dõi nguồn gốc thay đổi. FE là lớp giao diện cho luồng này, không phải tên của một dự án quản lý dữ liệu khác.

Theo tài liệu dự án, lộ trình chia hai giai đoạn: **Core Platform trước**, gồm auth, workspace/project/dataset, khám phá dữ liệu và các thao tác được backend hỗ trợ; **AI hỗ trợ sau**, phục vụ phát hiện, giải thích và gợi ý xử lý. Người dùng vẫn kiểm tra và phê duyệt thao tác xử lý dữ liệu. Không gian làm việc và trực quan dữ liệu 3D là hướng phát triển FE đã chọn; chưa có runtime AI hoặc 3D trong FE hiện tại.

Nguồn đối chiếu: [README dự án](../../README.md), [báo cáo tổng quan v5](../../docs/report_overview_v5.md), [đặc tả tính năng giai đoạn 1](../../docs/feature_spec_v4.md) và source backend. Mô tả mục tiêu trong docs không được dùng thay cho bằng chứng chức năng đã chạy.

Frontend dùng **React + TypeScript + Vite**, quản lý package bằng **Yarn**. Entry hiện tại là **src/app/main.tsx**; UI khởi động nằm trong **src/app/App.tsx**.

| Công cụ | Vai trò dự kiến | Trạng thái |
|---|---|---|
| React, TypeScript, Vite | UI, type checking, dev server và build | Đang dùng |
| React Router | Điều hướng và layout | Đã cài, chưa tích hợp |
| Axios | HTTP client dùng chung | Đã cài, chưa tích hợp |
| TanStack Query | Dữ liệu server và cache | Đã cài, chưa tích hợp |
| Three.js + React Three Fiber | Scene, camera và tương tác 3D | Đã cài, chưa tích hợp |
| Dexie / IndexedDB | File, bản nháp và thao tác chờ | Đã cài, chưa tích hợp |
| Vitest, Testing Library, jsdom | Kiểm thử logic và component | Đã cài, chưa cấu hình test nghiệp vụ |

Version và script thực tế xem [package.json](package.json). Đã cài thư viện không đồng nghĩa chức năng tương ứng đã hoạt động.

## 2. Problem Statement

Dữ liệu có thể chứa giá trị thiếu, sai định dạng hoặc thông tin không nhất quán. Người sử dụng cần luồng làm việc rõ ràng để xem dữ liệu, nhận biết vấn đề, kiểm tra tác động xử lý và theo dõi nguồn gốc thay đổi.

Frontend cần giải quyết các yêu cầu:

- Tổ chức tài nguyên theo workspace → project → dataset.
- Hiển thị dữ liệu, trạng thái xử lý và lỗi dễ hiểu.
- Phân biệt dữ liệu đã được server xác nhận với bản nháp trên thiết bị.
- Tách UI, logic, API, lưu trữ và graphics để hai người phát triển cùng project.
- Hỗ trợ một số thao tác cục bộ đã duyệt khi API không khả dụng, với điều kiện thiết bị còn Internet và access token còn hạn.

Đây là mục tiêu thiết kế, không phải tuyên bố các yêu cầu đã được triển khai đầy đủ.

## 3. Main Features

| Module | Phạm vi mục tiêu | Hiện trạng FE |
|---|---|---|
| Auth | Đăng nhập/đăng ký, quản lý phiên, gia hạn theo xác nhận người dùng | Có plan, chưa triển khai |
| User | Xem và cập nhật hồ sơ | Có plan, chưa triển khai |
| Workspace | Danh sách, chi tiết và quản lý workspace/thành viên theo quyền | Có plan, chưa triển khai |
| Project | Quản lý project trong workspace | Có plan, chưa triển khai |
| Dataset | Upload, metadata, schema, đổi tên và xóa | Có plan, chưa triển khai |
| Visualization | Cursor grid, thống kê cột, sửa ô trực tuyến và ranh giới data 3D | Có plan, chưa triển khai |
| Transformation | Chuẩn bị, xem trước và thực thi phép biến đổi | Có plan; contract backend còn cần xác nhận |
| Version / Lineage | Graph, truy vết và kiểm tra toàn vẹn; history/rollback khi có contract | Có plan; một số phần chờ backend |
| Export | Preview, download và save-as-new khi có API phù hợp | Có plan; contract backend còn cần xác nhận |

Các phần dùng chung gồm Foundation, Screen flow và Shared UI. Xem [master plan](.agents/frontend-delivery/master-plan.md) và [contract audit](.agents/frontend-delivery/modules/00-contract-audit.md) để phân biệt API đã kiểm kê, nguồn static và phần chưa kiểm thử.

## 4. System Architecture

### Luồng đang chạy

~~~text
index.html
  → src/app/main.tsx
      → React.StrictMode
          → App.tsx
              → UI khởi động tối giản
~~~

Style được import từ entry. **layout.tsx** hiện chỉ là component khung, chưa ghép vào luồng render.

### Kiến trúc mục tiêu

~~~text
Route / Page
  → View / Component
      → Hook / Flow
          → Service → API client → Backend
          → Repository → IndexedDB
          → Sync coordinator (sau khi đủ contract backend)

Graphics → nhận scene model và phát selection callback
Math     → hàm số phức, vector, Quaternion độc lập UI/API
~~~

- Component không trực tiếp gọi Axios hoặc IndexedDB.
- Service không giữ UI state; repository quản lý lưu trữ/transaction.
- Session coordinator quản lý consent và refresh; không refresh âm thầm.
- Graphics không tự quyết định nghiệp vụ hoặc gửi request.
- Backend xác nhận quyền và kết quả thay đổi dữ liệu.

Chi tiết: [architecture](.agents/Structure/frontend-architecture-plan.md), [Foundation](.agents/frontend-delivery/foundation-spec.md), [Screen flow](.agents/frontend-delivery/screen-flow.md), [Shared UI](.agents/frontend-delivery/shared-ui.md).

## 5. Folder Structure

Cây dưới đây thể hiện các thư mục chính, không phải mọi file trong repository. Nhiều thư mục mới có **.gitkeep**, chưa có code nghiệp vụ.

~~~text
frontend/
├── public/                 # Static assets
├── src/
│   ├── app/
│   │   ├── constants/
│   │   ├── context/
│   │   ├── pages/
│   │   │   ├── private/
│   │   │   └── public/
│   │   ├── router/
│   │   ├── App.tsx
│   │   ├── layout.tsx
│   │   ├── main.tsx
│   │   └── style.css
│   ├── assets/
│   ├── views/              # Màn hình theo domain
│   ├── components/         # UI component
│   ├── hooks/              # State và điều phối flow
│   ├── services/           # API theo domain
│   ├── repositories/      # IndexedDB
│   ├── sync/              # Hàng đợi và đồng bộ
│   ├── graphics/          # Scene, camera, interaction
│   ├── math/              # Số phức, vector, Quaternion
│   ├── lib/               # Client dùng chung
│   ├── types/             # DTO và UI/local models
│   ├── configs/           # Cấu hình công khai
│   ├── utils/             # Helper thuần
│   └── __tests__/         # Vị trí test chính thức dự kiến
├── .agents/               # Rules, skills và plan nội bộ
├── README.md
├── AI-usage.md
├── package.json
├── yarn.lock
├── package-lock.json
└── vite.config.ts
~~~

Phân công chính: FE A phụ trách app/auth/user/workspace/project; FE B phụ trách dataset/visualization/graphics/math. Các phần còn lại chỉ định owner/reviewer trước batch. Xem [team workflow](.agents/frontend-delivery/team-workflow.md).

## 6. Installation / Run / Test

### Yêu cầu môi trường

- Môi trường đã dùng trong lần setup trước: Node **26.7.0**, Yarn **1.22.22**.
- Với Node khác, kiểm tra engine/peer dependency trước khi cài; không dùng tùy chọn bỏ kiểm tra engine để vượt lỗi.
- Yarn là công cụ chính. Giữ cả hai lockfile theo quyết định nhóm, nhưng dùng **yarn.lock** khi cài; không chạy npm install xen kẽ.

### Cài đặt và chạy local

Mở terminal tại thư mục **src/frontend** của repository:

~~~sh
yarn install --frozen-lockfile
yarn dev
~~~

Mở URL **Local** mà Vite hiển thị trong terminal. Cổng thường dùng là 5173; nếu có tiến trình khác sử dụng, kiểm tra URL thực tế thay vì giả định cổng cố định.

### Build, lint và preview

~~~sh
yarn build
yarn lint
yarn preview
~~~

Build chạy TypeScript build và Vite production build. Preview phục vụ bản build để xem thử, không phải backend API hoặc cấu hình production hosting hoàn chỉnh.

### Test

Hiện [package.json](package.json) **chưa có script test**, chưa có test nghiệp vụ được triển khai. Vì vậy **yarn test chưa được hỗ trợ**. Vitest/Testing Library/jsdom mới được cài để chuẩn bị cho batch Foundation.

Các test case trong plan là dự kiến, chưa phải test đã chạy hoặc kết quả pass. Build/lint không thay test hành vi, browser hoặc API integration.

### Cấu hình API

UI khởi động hiện chưa gọi API và chưa đọc biến môi trường. Tên **VITE_API_BASE_URL** mới là đề xuất trong plan, chưa được code sử dụng; không dùng đường dẫn Swagger kết thúc bằng **/docs** làm API base URL.

Khi tích hợp backend, cần chốt config/client và CORS theo đúng origin FE. Không đưa token, API key, password hoặc secret backend vào cấu hình FE; không in nội dung **.env** vào chat/tài liệu. Xem [AI usage](AI-usage.md).

## 7. Example Input / Output

### Ví dụ theo hiện trạng source

**Input:** chạy dev server và mở URL Local của Vite.

**Output UI theo source hiện tại:**

~~~text
AI-systems-support-detecting-and-handling-data-quality-issues
Ứng dụng đã khởi động
~~~

Đây là UI bootstrap; không có dữ liệu dataset hoặc kết quả AI ở màn hình này.

### Ví dụ luồng mục tiêu — chưa triển khai

**Input:** chọn file dữ liệu trong project khi upload đã được triển khai và được backend hỗ trợ.

**Output mục tiêu:** server xác nhận thì cập nhật dataset chính thức; nếu chỉ commit bản nháp IndexedDB trong phạm vi được duyệt thì UI ghi rõ “Đã lưu cục bộ — chờ đồng bộ”. Không tạo response JSON/định danh giả rồi mô tả như đã thực thi.

## 8. Results

| Hạng mục | Kết quả và giới hạn bằng chứng |
|---|---|
| Structure và dependency | Đã setup; version nằm trong manifest và yarn.lock |
| Bootstrap UI | Source hiện render tiêu đề và thông báo khởi động |
| Build/lint | Đã chạy lại và đạt trong lượt chuẩn hóa tên dự án ngày 26/10/2026; không xác nhận chức năng nghiệp vụ |
| Browser UI | Đã kiểm tra heading/tên tab đúng tên dự án và nội dung UI khởi động; không xác nhận các module nghiệp vụ |
| Plan | Có architecture, plan 9 module và đặc tả Foundation/Screen flow/Shared UI |
| Auth/API/3D/IndexedDB/sync | Chưa tích hợp vào runtime FE |
| Test nghiệp vụ và kết quả AI | Chưa có kết quả thực thi; không công bố độ chính xác, FPS hoặc tỷ lệ test pass |

## 9. Limitations

- UI mới là màn hình khởi động; chưa có đăng nhập, router hoặc flow nghiệp vụ hoàn chỉnh.
- Nhiều folder là structure chuẩn bị cho nhóm, không phải module đã implement.
- Một số contract backend còn thiếu hoặc cần đối chiếu DTO/service và response thật; xem ngày/bằng chứng trong contract audit, không coi snapshot cũ là xác nhận server hiện tại.
- Chưa chốt toàn bộ UX, permission presentation, data 3D mapping và tiêu chí hiệu năng.
- Chưa có schema/quota/retention IndexedDB hoặc replay đã kiểm chứng. Chống ghi trùng/xử lý conflict cần backend hỗ trợ.
- Resilience không yêu cầu hỗ trợ khi mất Internet; chỉ cho thao tác đã duyệt khi token còn hạn. Phần này chưa triển khai.
- Chưa cấu hình test runner, CI hoặc production deployment trong batch setup hiện tại.

## 10. Future Improvements

1. Review quyết định UX/UI còn chờ; thống nhất interface cho hai người FE.
2. Triển khai Foundation theo batch đã duyệt: config, client, query, auth/session, router và login tối giản.
3. Tích hợp module có API thực tế, kèm validation, permission và error handling.
4. Đặc tả rồi triển khai scene 3D/math; data mapping và hiệu năng cần dữ liệu/thiết bị mục tiêu.
5. Triển khai bản nháp IndexedDB và chỉ bật sync sau khi đủ contract chống trùng/đối soát/xung đột.
6. Bổ sung Transformation/Version/Export theo contract backend được xác nhận, không tự tạo endpoint.
7. Thêm automated tests, browser/API integration, accessibility, CI và deployment checks.

Mọi thay đổi quan trọng theo workflow review và human confirmation của dự án. Quy định sử dụng AI: [AI-usage.md](AI-usage.md).
