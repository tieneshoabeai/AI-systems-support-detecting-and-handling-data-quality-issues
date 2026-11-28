# repositories

## Mục đích

Các repository quản lý dữ liệu bền trên thiết bị. Ba database được tách riêng theo loại dữ liệu:

- Upload draft giữ metadata và Blob của file đang chờ xử lý.
- Offline reads giữ response đã tải thành công để lớp data service có thể dùng làm bản đọc dự phòng.
- Offline writes giữ command đã được chuẩn hóa để hàng đợi có thể gửi lại sau.

Runtime tạo cả ba database và repository. Offline reads được nối qua `createOfflineDataService` vào API client của ManagementDataProvider. `createOfflineWriteService` nhận request queue-first từ Axios client, sở hữu replay worker và cập nhật bảng trạng thái queue trong UI.

## Runtime và định danh môi trường

`app/app-runtime.ts` tạo ba database, truyền `draftAccess` từ session coordinator vào các repository và đóng các database khi runtime dispose. Upload drafts còn dùng tên database có `EnvironmentId`; offline reads/writes dùng namespace trong khóa. Như vậy cùng tài khoản trên hai backend không đọc nhầm file, cache hoặc queue. Mỗi repository kiểm tra account, generation phiên và hạn refresh session trước khi đọc/ghi. Access token hết hạn chỉ khóa request remote, không khóa quyền đọc cache cục bộ.

Offline reads và writes yêu cầu `namespace`. Runtime lấy namespace từ `getApiEnvironmentId()`: mặc định `environment:qa-main` trong dev, `environment:production` trong production. Cùng một môi trường QA cần giữ nguyên ID khi chỉ hostname tunnel thay đổi. Môi trường dữ liệu khác phải dùng ID khác để không đọc nhầm cache hoặc replay queue sang nơi khác.

## Public API

### Upload drafts

- `UploadDraftDatabase` có hai bảng `drafts` và `files`.
- `createUploadDraftRepository({ db, access, now?, createId?, estimate? })` cung cấp `save`, `list`, `readFile`, `remove`, wizard metadata/linking, trạng thái `queued`/`uploading`/`acknowledged`, `confirmUploaded` và `cleanupUploaded`.
- Giới hạn hiện tại: 50 MiB/file, 200 MiB/account, 500 MiB tổng. Metadata và Blob được ghi trong cùng transaction.

Ví dụ:

```ts
const draft = await runtime.drafts.save({ projectId, file })
const blob = await runtime.drafts.readFile(draft.id)

const wizardDraft = await runtime.drafts.save({ workspaceId, projectName, projectDescription, selectedMembers, file })
await runtime.drafts.attachToProject(wizardDraft.id, serverProjectId)
```

Project upload UI và ProjectWizard dùng `useUploadDraft`. Upload vào project đã tồn tại được đưa vào queue cùng draft ID và SHA-256; wizard tạo project tiếp tục dùng request riêng, không queue upload. UI chỉ báo đã lưu chờ sau khi command và liên kết draft đã commit. Queue chỉ dọn Blob sau khi ACK đã lưu vào IndexedDB và dataset được đối chiếu với tài khoản/project/tên/kích thước/hash. Wizard giữ metadata sau khi dọn Blob cho tới khi bước thêm thành viên hoàn tất.

### Offline reads

- `OfflineReadDatabase` lưu `OfflineRead` theo khóa `[accountId, namespace, key]`.
- `createOfflineReadRepository({ db, access, namespace, now? })` cung cấp `read`, `save`, `remove`, `clear`, `list`, `removeResource` và `clearAccount`.
- Hạn mức theo account + namespace: 100 MiB, tối đa 50 MiB/mục và 300 mục. Khi vượt giới hạn, mục cũ nhất trong namespace đó được dọn trước.
- [`createOfflineDataService`](../services/offline/offline-data.service.ts) bọc API client của ManagementDataProvider: cache GET trong allowlist và POST truy vấn records; khóa ổn định gồm path, method, params, body truy vấn và response type. Repository tiếp tục phân vùng khóa theo account + namespace.
- Khi network/timeout/5xx hoặc session gate chặn request, service trả response cache khớp khóa; cache miss ném trạng thái “Chưa có bản lưu offline” để UI không dựng dữ liệu giả. Service ghi thời điểm lưu và fallback vào snapshot hiển thị trên banner.
- HTTP 401 xóa cache trong account + namespace hiện tại. HTTP 403/404 xóa cache liên quan tới tài nguyên và bản ghi danh sách tương ứng; lỗi quyền/tài nguyên không dùng cache cũ làm fallback.
- Allowlist gồm workspace/project/dataset và route con, issues, admin issues, notifications, hồ sơ `/users/me`, workspace overview, analysis result/job, feedback, schema, records (bao gồm truy vấn), stats/charts và PDF report. Request ghi không được cache.

### Offline writes

- `OfflineWriteDatabase` lưu command có thứ tự tăng dần `sequence`; `id` là duy nhất.
- `createOfflineWriteRepository({ db, access, namespace, now? })` cung cấp `scope`, `list`, `findDuplicate`, `add`, `update`, `recoverSending`, `confirm` và `remove`.
- Hạn mức: 100 mục và 100 MiB/account trên mọi namespace; mỗi command tối đa 50 MiB. Upload command lưu Blob, tên file, MIME type và SHA-256 do caller tính.
- Command types giới hạn ở patch tên/mô tả workspace/project có `expectedVersion`, delete workspace/project/dataset, và upload CSV vào project. Request allowlist và xác minh payload phải được service kiểm tra trước khi gọi `add`.
- `recoverSending` chuyển mục đang gửi thành `uncertain` để lần chạy tiếp theo đối chiếu với backend, thay vì giả định request thất bại.
- `confirm` lưu phản hồi ACK; với các PATCH cùng resource, nó chuyển `expectedVersion` mới sang command đang chờ tiếp theo có cùng version gốc.
- `createOfflineWriteService` dùng Web Lock riêng để ghi liên kết upload draft trước khi command xuất hiện trong queue và Web Lock độc quyền khi replay; IndexedDB sequence giữ thứ tự enqueue. Worker tự kích hoạt khi online, khi target API đổi, sau khi phiên được khôi phục và theo chu kỳ. Queue tiếp tục sống qua dispose/dừng Vite vì IndexedDB không bị xóa.
- `uncertain` upload chỉ được xác nhận khi backend trả dataset cùng hash khớp. Thiếu hash hoặc metadata không đủ sẽ chuyển `blocked`; worker không gửi lại upload mù. PATCH conflict cũng thành `blocked` để kiểm tra thủ công.
- Trạng thái `confirmed` được ghi bền trước khi xóa command payload/draft file; confirmed row được giữ làm lịch sử tới khi người dùng xóa khỏi bảng queue.

## Cấu trúc

- `datasets/upload-draft.database.ts`, `datasets/upload-draft.repository.ts` — kho draft upload; lưu Blob/metadata/hash, project wizard metadata, trạng thái ACK và dọn file sau xác nhận.
- `offline/offline-read.database.ts`, `offline/offline-read.repository.ts` — schema và repository cache đọc.
- `offline/offline-write.database.ts`, `offline/offline-write.repository.ts` — schema và repository hàng đợi ghi.
- `types/offline/` — shape payload, command và status của offline writes.

## Bất biến và giới hạn

- Mọi đọc/ghi thông thường đều gắn với account và generation phiên được cấp bởi coordinator; repository không nhận account ID tùy ý từ UI.
- Transaction bị hủy nếu phiên đổi giữa thao tác.
- Database được `close()` khi runtime dispose nhưng không bị xóa. Đổi URL tunnel trong cùng `EnvironmentId` không đổi namespace; đổi môi trường phải đổi ID.
- Dung lượng thật phụ thuộc browser và origin. IndexedDB có thể bị browser từ chối hoặc hết quota; caller cần hiển thị lỗi thay vì báo đã lưu.
- UI project và wizard chỉ báo upload hoàn tất sau ACK backend cùng đối chiếu metadata; wizard giữ metadata sau khi dọn Blob cho tới khi thành viên được xử lý xong. Draft ở trạng thái `queued`, `uploading` hoặc `acknowledged` không thể bị xóa để tránh làm mất payload cần đối soát.
- Repository không tự gọi API hoặc sync. Cache đọc chỉ bao phủ client được bọc trong ManagementDataProvider; auth, health và API call ngoài provider không được cache.
