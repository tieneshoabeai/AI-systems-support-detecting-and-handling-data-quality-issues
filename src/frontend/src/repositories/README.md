# repositories

## 1. Mục đích

Lưu metadata và file của bản nháp upload trên thiết bị. Gửi file lên backend và tự động đồng bộ thuộc luồng khác.

## 2. Vị trí & phụ thuộc

`app/app-runtime.ts` tạo repository và truyền `draftAccess` từ coordinator. Repository dùng Dexie, kiểu draft, hạn mức và `ApiError`.

## 3. Public API

- `new UploadDraftDatabase(name?: string)` tạo database Dexie với bảng `drafts` và `files`.
- `createUploadDraftRepository(options: Options)` cần `db`, `access: DraftAccessPort`, tùy chọn `now`, `createId`, `estimate`.
- `save(input: SaveUploadDraft): Promise<UploadDraft>`, `list(): Promise<UploadDraft[]>`, `readFile(id: string): Promise<Blob>`, `remove(id: string): Promise<void>` thao tác bản nháp.
- `confirmUploaded(id: string, confirmation: UploadConfirmation): Promise<DraftCleanupResult>` ghi nhận xác nhận rồi dọn. `cleanupUploaded(): Promise<number>` trả số bản đã dọn. Thiếu quyền phiên hoặc lỗi lưu trữ được biểu diễn bằng `ApiError`.

## 4. Cách dùng (ví dụ)

```ts
import type { AppRuntime } from './app/app-runtime'

export async function saveSample(runtime: AppRuntime, projectId: string) {
  const file = new File(['id\n1\n'], 'demo.csv', { type: 'text/csv' })
  const draft = await runtime.drafts.save({ projectId, file })
  return { id: draft.id, size: (await runtime.drafts.readFile(draft.id)).size }
}
```

Chạy trong trình duyệt hỗ trợ IndexedDB, với runtime đang có quyền draft và project ID hợp lệ. Đầu ra có ID draft và kích thước `5` byte. Ví dụ ghi một bản nháp cục bộ.

## 5. Cấu trúc thư mục

**Khi thêm code.** Đặt schema/index IndexedDB ở `datasets/upload-draft.database.ts`, còn điều kiện truy cập, transaction và xử lý ACK ở `datasets/upload-draft.repository.ts`.

- [datasets/upload-draft.database.ts](datasets/upload-draft.database.ts) — schema và bảng metadata/Blob.
- [datasets/upload-draft.repository.ts](datasets/upload-draft.repository.ts) — phân vùng theo phiên, quota, transaction và xác nhận upload.
- `.gitkeep` — giữ thư mục.

## 6. Luồng hoạt động

`save` chụp quyền phiên → kiểm tra file/quota → lưu metadata và Blob trong transaction. `confirmUploaded` kiểm tra ACK khớp account/project/dataset → commit trạng thái `uploaded` → dọn file và metadata ở transaction kế tiếp. Nếu dọn lỗi lưu trữ, `{ cleaned: false }` cho phép dọn lại.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| DB name / schema | `data-quality.upload-drafts.v1` / 1 | Tên và phiên bản IndexedDB |
| File / account / tổng | 50 / 200 / 500 MiB | Giới hạn nhận draft |
| `now`, `createId`, `estimate` | `Date.now`, `crypto.randomUUID`, `navigator.storage.estimate` nếu có | Thời gian, ID, ước lượng quota |

## 8. Quy ước & bất biến

Đọc và sửa theo account còn hạn, kiểm tra generation trong transaction. Tách Blob khỏi metadata. Commit ACK trước dọn để bản đã được xác nhận không trở lại trạng thái chờ sau lỗi dọn.

## 9. Test & debug

Chạy `yarn test src/__tests__/auth/upload-draft.repository.test.ts`. Xem hai bảng trong IndexedDB của môi trường thử nếu cần kiểm trạng thái.

## 10. Giới hạn & lưu ý

Dung lượng thật phụ thuộc thiết bị và origin. Draft có thể còn trên thiết bị sau logout nhưng quyền truy cập phụ thuộc tài khoản và phiên hiện tại.

## 11. Hướng cải tiến

Tích hợp luồng upload sau khi có hợp đồng ACK đã duyệt. Khi ghép, xác nhận cách xử lý lỗi dọn và khả năng tiếp tục ở phiên mới.
