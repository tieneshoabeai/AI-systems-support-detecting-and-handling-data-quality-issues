# Types

`src/types` chứa hợp đồng dùng chung của frontend. Khi đọc hoặc thêm một tính năng, xác định kiểu đó mô tả dữ liệu trên đường truyền, trạng thái ứng dụng hay props/model của UI.

## Tìm kiểu theo trách nhiệm

| Nhóm | Dùng khi cần |
| --- | --- |
| [`api`](api/index.ts) | Hợp đồng HTTP client, request options, response envelope và lỗi ứng dụng. |
| [`auth`](auth/index.ts) | DTO đăng nhập/gia hạn, snapshot và port của phiên, AuthContext và kiểu Auth Glass. |
| [`health`](health/index.ts), [`users`](users/index.ts) | Kết quả kiểm tra sức khỏe backend và hồ sơ người dùng hiện tại. |
| [`datasets`](datasets/index.ts) | Kiểu điểm chất lượng dữ liệu, bản nháp upload và xác nhận upload. |
| [`processing`](processing/index.ts) | Các bước Processing và kiểu đánh giá kết quả. |
| [`dataset-3d`](dataset-3d/index.ts), [`workspace-3d`](workspace-3d/index.ts) | Trạng thái chọn khối, camera, sơ đồ tài nguyên và mô hình CSV cục bộ dùng trong các scene. |
| [`preview`](preview/index.ts) | Model workspace, project, thông báo, route và UI session. Các kiểu này cũng được workbench dùng qua mapping từ API. |
| [`services-type`](services-type/index.ts) | Alias sinh từ OpenAPI theo nhóm endpoint. |
| [`vite-env.d.ts`](vite-env.d.ts) | Khai báo kiểu cho môi trường Vite và các module mà frontend import. |

[`types/index.ts`](index.ts) export các kiểu dùng chung như `ApiClient`, `SessionSnapshot`, `CurrentUser` và `ConfirmedProjectResult`. Dùng `import type` khi chỉ cần kiểu. Với alias của một endpoint, tìm theo nhóm trong `services-type`.

## Từ OpenAPI đến dữ liệu hiển thị

1. [`generate-swagger-types.mjs`](../../scripts/generate-swagger-types.mjs) đọc `VITE_SWAGGER_URL` khi chạy từ thư mục frontend và tải đặc tả. Script chuẩn hóa đặc tả rồi ghi [`src/lib/openapi.json`](../lib/openapi.json).
2. Script tạo [`src/lib/openapi.ts`](../lib/openapi.ts) và tạo lại các file alias trong `src/types/services-type/`. Tên nhóm bên dưới là tên file hiện tại của working tree.
3. Service có thể dùng alias để kiểm tra request khi biên dịch. Khi nhận dữ liệu từ mạng, service kiểm tra payload lúc chạy trước khi chuyển sang model mà UI dùng.

Ví dụ dưới đây dùng alias hiện có cho body truy vấn records. Đường dẫn import tính từ một module đặt ngay dưới `src/`.

```ts
import type { postDatasetsByDatasetIdQueryRecordsRequestBody } from './types/services-type/dataViewVirtualGrid'

const firstPage: postDatasetsByDatasetIdQueryRecordsRequestBody = { limit: 50 }
```

TypeScript kiểm tra object `firstPage` lúc biên dịch. Khi request hoàn tất, [`dataset.service.ts`](../services/processing/dataset.service.ts) đọc dữ liệu từ client và kiểm tra các trường trước khi trả model của bảng. Nếu server gửi payload sai cấu trúc, việc kiểm tra trong service mới phát hiện lỗi lúc chạy.

## Khi backend đổi hợp đồng

1. Chạy `yarn gen:types` từ `src/frontend` với URL Swagger của môi trường cần đồng bộ.
2. Xem diff của đặc tả, kiểu sinh tự động và các alias theo nhóm. Chỉnh đặc tả hoặc generator khi cần thay đổi đầu ra sinh tự động.
3. Đối chiếu service, mapper, model UI và các test dùng endpoint đó. `yarn build` thực hiện kiểm tra TypeScript trước khi build Vite. Các bài test trong [bản đồ kiểm thử](../__tests__/README.md) giúp kiểm tra hành vi khi payload hợp lệ hoặc sai contract.

## Cấu trúc thư mục hiện tại

```text
src/types/
├── api/
│   ├── api.types.ts
│   └── index.ts
├── auth/
│   ├── auth-context.types.ts
│   ├── auth-glass.types.ts
│   ├── auth.types.ts
│   ├── index.ts
│   ├── session-coordinator.types.ts
│   └── session.types.ts
├── dataset-3d/
│   ├── cube-focus.types.ts
│   ├── holographic-part.types.ts
│   └── index.ts
├── datasets/
│   ├── index.ts
│   ├── quality-score.types.ts
│   └── upload-draft.types.ts
├── health/
│   ├── health.types.ts
│   └── index.ts
├── preview/
│   ├── index.ts
│   ├── preview-route.types.ts
│   ├── preview-session.types.ts
│   └── preview.types.ts
├── processing/
│   ├── index.ts
│   ├── processing-route.types.ts
│   └── result-review.types.ts
├── services-type/
│   ├── admin.ts
│   ├── analysis.ts
│   ├── auth.ts
│   ├── dataViewVirtualGrid.ts
│   ├── datasets.ts
│   ├── feedback.ts
│   ├── health.ts
│   ├── index.ts
│   ├── issues.ts
│   ├── notifications.ts
│   ├── overview.ts
│   ├── projects.ts
│   ├── report.ts
│   ├── summary.ts
│   ├── users.ts
│   └── workspaces.ts
├── users/
│   ├── index.ts
│   └── user.types.ts
├── workspace-3d/
│   ├── camera-pose.types.ts
│   ├── index.ts
│   ├── local-csv.types.ts
│   └── resource-map.types.ts
├── README.md
├── index.ts
└── vite-env.d.ts
```
