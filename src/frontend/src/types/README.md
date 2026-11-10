# types

## 1. Mục đích

Định nghĩa hợp đồng TypeScript dùng chung giữa các tầng, gồm payload API, phiên, bản nháp, preview và dữ liệu 3D. Việc kiểm tra JSON lúc chạy thuộc nơi nhận dữ liệu, như service hoặc parser.

## 2. Vị trí & phụ thuộc

`app`, `lib`, `services`, `repositories`, `hooks`, `math`, `graphics` và `views` dùng các hợp đồng từ đây. Các nhóm kiểu có thể tham chiếu nhau. Ví dụ `auth/session-coordinator.types.ts` dùng hợp đồng phiên, lỗi API, health, user và quyền draft. Giữ hướng import từ nơi sử dụng về hợp đồng, tránh kéo component, service hoặc store vào file kiểu.

## 3. Public API

| Nhóm | Hợp đồng tiêu biểu | Nơi dùng |
| --- | --- | --- |
| API | `ApiConfig`, `ApiEnvelope<T>`, `ApiClient`, `ApiRequestOptions`, `AppError` | Cấu hình, HTTP client, service |
| Auth | `LoginRequestDto`, `LoginResponseDto`, `LoginResult`, `RefreshRequestDto`, `RefreshResult`, `StoredSession`, `SessionSnapshot`, `SessionCoordinatorOptions`, `SignOutResult` | Service, coordinator, context |
| User và health | `CurrentUser`, `AuthHealth` | Service và coordinator |
| Draft | `DraftAccessPort`, `UploadDraft`, `SaveUploadDraft`, `UploadConfirmation`, `DraftCleanupResult` | Coordinator và repository |
| Workspace 3D | `ResourceNode`, `ResourceMapProps`, `ResourceLayout`, `CameraCommand`, `LocalCsvDocument` | Math, scene và view |
| Dataset 3D | `HolographicPartInfo`, `HolographicPartComponent`, `DqDimension`, `DimensionScore`, `QualityScoreSource` | Model, scene và view |
| Preview | `PreviewStoreState`, `Workspace`, `Project`, `PreviewMutationResult` và các kiểu UI theo nhóm | Mock store, hook và view preview |

Hai giá trị runtime hiện có gồm `NON_SELECTABLE_PART_IDS: Set<string>` và `isSettingsNavGroup(item: SettingsNavItem): item is SettingsNavGroup`. Dùng import thường cho hai giá trị này và `import type` cho kiểu thuần.

## 4. Cách dùng (ví dụ)

```ts
import type { ResourceNode } from './types/workspace-3d/resource-map.types'

const root: ResourceNode = { id: 'demo', name: 'Demo', kind: 'workspace', parentId: null }
console.log(root.kind) // workspace
```

Đoạn này dùng đường import từ một module TypeScript dưới `src`. Nếu đổi `kind` thành `'table'`, TypeScript báo lỗi khi kiểm kiểu. Khi nhận dữ liệu từ bên ngoài, gọi validation phù hợp, chẳng hạn `validateResources`, trước khi tính layout.

## 5. Cấu trúc thư mục

**Khi thêm code.** Kiểu chỉ dùng trong một file đặt cạnh code sử dụng, ví dụ `Props` trong [ResourceScene](../components/graphics/workspace-3d/resource-scene.tsx). Kiểu dùng chung qua các tầng đặt vào nhóm tương ứng dưới `types/`. Kiểu nội bộ của một tầng có thể ở cạnh nơi sở hữu.

- [api/api.types.ts](api/api.types.ts) — cấu hình, request, envelope và lỗi HTTP.
- [auth/auth-context.types.ts](auth/auth-context.types.ts) — snapshot và thao tác qua AuthContext.
- [auth/auth-glass.types.ts](auth/auth-glass.types.ts) — ID panel dùng giữa login view và scene.
- [auth/auth.types.ts](auth/auth.types.ts) — DTO và model login/refresh.
- [auth/session-coordinator.types.ts](auth/session-coordinator.types.ts) — snapshot, port và kết quả kết thúc phiên.
- [auth/session.types.ts](auth/session.types.ts) — schema lưu phiên, token info và kết quả đọc.
- [dataset-3d/cube-focus.types.ts](dataset-3d/cube-focus.types.ts) — theme và yêu cầu focus dùng giữa view, scene và model.
- [dataset-3d/holographic-part.types.ts](dataset-3d/holographic-part.types.ts) — mô tả part và ID bỏ qua khi chọn.
- [datasets/quality-score.types.ts](datasets/quality-score.types.ts) — chiều chất lượng, scope và nguồn điểm.
- [datasets/upload-draft.types.ts](datasets/upload-draft.types.ts) — quyền draft, metadata và ACK.
- [health/health.types.ts](health/health.types.ts) — kết quả kiểm tra khả dụng cho auth.
- [preview/preview-route.types.ts](preview/preview-route.types.ts) — route và ID dùng giữa service, hook và view.
- [preview/preview-session.types.ts](preview/preview-session.types.ts) — model tương tác và callback điều hướng của preview.
- [preview/preview.types.ts](preview/preview.types.ts) — dữ liệu, store và tương tác preview.
- [users/user.types.ts](users/user.types.ts) — model người dùng sau mapping.
- [vite-env.d.ts](vite-env.d.ts) — khai báo kiểu biến Vite cho TypeScript.
- [workspace-3d/camera-pose.types.ts](workspace-3d/camera-pose.types.ts) — vị trí và điểm nhìn dùng giữa math và controller.
- [workspace-3d/local-csv.types.ts](workspace-3d/local-csv.types.ts) — tài liệu CSV đã parse.
- [workspace-3d/resource-map.types.ts](workspace-3d/resource-map.types.ts) — cây tài nguyên, hình học và lệnh camera.

## 6. Luồng hoạt động

Ví dụ login, service nhận payload từ backend, kiểm dữ liệu rồi map sang `LoginResult`. Coordinator đọc kết quả và cập nhật `SessionSnapshot`. Provider cấp snapshot cho hook và view. Khi đọc một union như `SessionSnapshot`, kiểm tra `phase` trước khi dùng trường riêng của pha đó.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| `ImportMetaEnv.VITE_API_BASE_URL`, `VITE_API_PREFIX` | Khai báo kiểu tùy chọn | TypeScript biết tên và kiểu. [configs](../configs/README.md) đọc và yêu cầu giá trị hợp lệ khi tạo client. |
| OpenAPI codegen | Chưa có lệnh trong package frontend | Kiểu API hiện được đối chiếu và cập nhật cùng mapper. |

## 8. Quy ước & bất biến

Giữ DTO theo tên trường trên wire và map riêng sang model dùng trong UI. Dùng `import type` cho hợp đồng thuần. Với dữ liệu đi từ mạng, storage hoặc file, kiểm tra giá trị tại ranh giới runtime trước khi dùng.

## 9. Test & debug

Chạy `yarn tsc --noEmit -p tsconfig.app.json` từ frontend để kiểm kiểu. Dùng `yarn test src/__tests__/foundation/api.test.ts src/__tests__/workspace-3d/resource-layout.test.ts` để kiểm validation runtime liên quan.

## 10. Giới hạn & lưu ý

Khai báo kiểu và ép kiểu đều bị xóa khi build. Một object được ép sang DTO vẫn có thể thiếu field lúc chạy. Ví dụ parser và mapper cần xử lý trường hợp đó ở tầng nhận dữ liệu.

## 11. Hướng cải tiến

Khi backend đổi contract, cập nhật DTO, mapper và test liên quan trong cùng lượt review. Khi có hợp đồng nguồn điểm thật, đối chiếu kiểu `QualityScoreSource` và các caller đang dùng mock trước khi ghép.
