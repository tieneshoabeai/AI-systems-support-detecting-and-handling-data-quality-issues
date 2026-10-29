# Upload file thật → Dataset → Workspace 3D (plan, chưa triển khai)

Ngày kiểm tra source: 29/10/2026, Asia/Ho_Chi_Minh.

Người dùng chọn **lập plan upload file thật**. Đây là quyền phân tích/lưu plan, chưa phải quyền sửa upload UI, gọi API ghi dữ liệu, sửa backend hoặc tích hợp private data vào preview. Đọc cùng handoff auth và implementation-plan.md; việc sửa cổng/ống đã duyệt là batch riêng.

## 1. Cách hoạt động dễ hiểu

```text
Đăng nhập thật
→ tải Workspace/Project mà tài khoản được phép dùng
→ chọn Project đích và chọn một file
→ kiểm tra file, hiển thị xác nhận file/Project
→ người dùng bấm Tải lên
→ POST multipart lên backend
→ backend lưu file + tạo metadata Dataset + trả ID/status
→ frontend kiểm tra ACK và tải lại metadata từ backend
→ ánh xạ Dataset thành một ResourceNode
→ layout tính lại, có thêm một khối và một đường nối
```

Một file được backend nhận thành một Dataset = một khối. Không tạo khối theo số dòng/cột, không tự gọi AI, không biến bản đồ thành chart record. Tên Dataset lấy từ metadata server; tên không quyết định identity. Upload file không đồng nghĩa đã sửa lỗi/chạy AI trên dữ liệu.

## 2. Facts từ source hiện tại

| Vị trí | Bằng chứng và hệ quả |
|---|---|
| `src/backend/src/modules/datasets/datasets.controller.ts` | POST `projects/:projectId/datasets/upload`, multipart qua busboy. Trả `{ message, dataset }`. GET `projects/:projectId/datasets` trả `{ dataset }`, singular; GET `datasets/:id` trả `{ dataset }`. Có JWT/PoliciesGuard. Chưa có upload session, idempotency key hoặc endpoint cancel được thấy trong controller |
| `src/backend/src/modules/datasets/datasets.service.ts` | Từ chối 409 nếu `project.has_dataset`; **một Project tối đa một Dataset hoạt động**. Name = filename bỏ phần extension cuối. Có INGESTING → READY/FAILED. Lưu file qua StorageService, records qua repository, rồi set has_dataset và ghi outbox |
| Cùng service | Nhận diện đuôi xlsx/json nhưng vẫn gọi `processCsvStream` cho mọi file và lưu key `.csv`. Chưa có bằng chứng parser Excel/JSON; không thể quảng cáo hỗ trợ hai định dạng đó từ ApiOperation |
| `datasets.repository.ts` | `findByProject` dùng findOne và lấy bản mới nhất; không phải API liệt kê nhiều Dataset/Project |
| `datasets/schemas/dataset.schema.ts` | Metadata có `_id`, `project_id`, `workspace_id`, `name`, `status`, số dòng/cột, storage_key. Name maxlength 100. Index project/deleted_at hiện không khai báo unique |
| `src/backend/src/main.ts` và `transform.interceptor.ts` | Prefix mặc định `api/v1` nhưng có cấu hình runtime. Response bọc `{ success: true, data: ... }`. Không đọc .env và không khẳng định URL backend thực đang chạy |
| Workspaces/Projects controllers | GET `workspaces` → `{ workspaces }`; GET `workspaces/:workspaceId/projects` → `{ projects }`; GET `projects/:id` → `{ project }`. Dùng bearer và policy |
| `src/frontend/src/lib/axios-client.ts` | ApiClient unwrap envelope, giới hạn URL trong API base đã cấu hình, có auth/session, signal, timeout; DTO cụ thể phải validate ở service. Chưa expose onUploadProgress |
| `src/frontend/src/app/app-runtime.ts` | Runtime hiện ghép auth/users/drafts; chưa có service Workspace/Project/Dataset và generic private request gate cho upload |
| `src/frontend/src/app/router/app-router.tsx` | `/workspaces` được ProtectedRoute bảo vệ. `/preview/workspaces-3d` là nhánh dev demo ở entry, không được dùng cho file/private API |
| Draft repository/config/types | Đã có IndexedDB account-scoped, generation guard, 50 MiB/file, 200 MiB/account, 500 MiB/app; confirmUploaded chỉ sau ACK đã validate. Chưa có UI upload/replay. Các số này là giới hạn **draft local**, không chứng minh giới hạn file upload server |

Đây là kết quả đọc source, chưa có test live upload/auth/CORS/storage/parser hoặc authorization theo Project. Không tuyên bố BE đã chạy.

## 3. Mâu thuẫn phải chốt trước code

**Đang hỏi người dùng:**

- A: giữ một Dataset hoạt động/Project theo backend hiện tại. Upload Project đã có Dataset bị khóa ở UI và server vẫn quyết định 409. Không tự xóa/thay Dataset cũ.
- B: giữ ý tưởng nhiều Dataset/Project như preview. Cần batch backend riêng: sửa cardinality, list response, has_dataset/logic xóa, concurrency và test; không chỉ mở nút upload trên FE.

Chưa có câu trả lời tại lúc lưu bản đầu. Không tự coi preview là hợp đồng nghiệp vụ, cũng không tự ép sản phẩm theo backend bằng cách giấu các Dataset.

Các đề xuất khác chờ duyệt gộp: batch đầu chỉ CSV, một file mỗi lần; giới hạn upload FE/server phải thống nhất rõ, không tự dùng 50 MiB draft làm server cap; chưa rename/replace/delete form. Nếu cần nhập tên trước upload thì backend hiện chưa đọc metadata field name ở handler này, cần contract bổ sung. Nếu chấp nhận tên từ filename thì UI nói rõ, không gửi field mà server bỏ qua.

## 4. Các khoảng trống backend cần giải quyết/kiểm chứng

1. **File và multipart:** handler chưa cấu hình busboy file count/size limits và gọi ingest cho mỗi file event; không bảo đảm single-file chỉ bằng Promise resolve lần đầu. Cần server enforce 1 file, định dạng parser thực hỗ trợ, byte cap thực theo stream, malformed multipart/empty file/abort/error và cleanup. Content-Length hiện gồm overhead multipart và có thể thiếu; không coi nó là số byte file hoặc quota enforcement đầy đủ.
2. **Cardinality/concurrency:** đọc has_dataset rồi ghi sau upload không phải thao tác atomic. Nếu chọn A, cần test hai request đồng thời và cơ chế reserve/unique active constraint/transaction được backend duyệt. Nếu chọn B, cần list/pagination/constraint phù hợp cardinality mới; không giữ findOne làm danh sách.
3. **Quyền theo tài nguyên:** controller khai báo policy trên string Dataset; phần dynamic loader trong PoliciesGuard được điều kiện bởi metadata và param `id`, còn upload dùng `projectId`. Cần test quyền theo Project/Workspace thực và tài khoản khác trước upload private; chưa kết luận có exploit chỉ từ việc đọc code.
4. **Mất ACK/retry:** chưa thấy idempotency contract. Timeout/cancel client không chứng minh server đã rollback. Không tự retry POST, không replay sau refresh/reload, không đánh dấu thành công từ upload progress=100%. Cần cơ chế đối soát có ID/request key để khẳng định request nào tạo Dataset nào; nếu chưa có thì giữ trạng thái “chưa xác định”, tải lại metadata và yêu cầu kiểm tra, không tự gửi lại.
5. **Tính nhất quán khi lỗi:** Dataset được tạo INGESTING trước khi stream hoàn tất; catch đánh FAILED nhưng chưa thấy toàn bộ cleanup/rollback object + records + has_dataset + outbox. READY có thể đã được ghi trước khi outbox lỗi làm request lỗi. Cần xác minh/fix ở BE theo batch được duyệt, không viết FE để che trạng thái không nhất quán.
6. **Phản hồi:** cần capture JSON thực từ môi trường test dùng dữ liệu không riêng tư: `_id` hay `id`, ObjectId serialize, parent IDs, READY, singular/null hoặc collection theo lựa chọn A/B. `return finalDataset ?? initialDataset` có thể trả INGESTING nếu update trả null; ACK phải validate status, không tự coi mọi 2xx là READY.

Các mục trên là điều kiện nghiệm thu tích hợp; chưa có quyền sửa BE từ yêu cầu lập plan này.

## 5. Kiến trúc frontend đề xuất

| Layer/file dự kiến | Trách nhiệm |
|---|---|
| `types/workspaces`, `types/projects`, `types/datasets` | DTO được chốt từ BE, metadata và upload state; không nhập Three vào service |
| `services/workspaces`, `services/projects`, `services/datasets` | URL relative API base, validate DTO/ACK, FormData; không đọc storage hoặc tự retry/refresh token |
| `mappers/workspace-3d/resource-node.mapper.ts` (đề xuất mới) | DTO → ResourceNode. Dùng namespace identity ổn định, ví dụ `project:<backendId>`/`dataset:<backendId>`; parentId tham chiếu đúng namespace. Backend ID giữ riêng cho API. Không lấy filename làm ID hoặc dùng index mảng |
| `app/app-runtime.ts` + private session gate | Tạo service đã bind với token/account/generation tại thời điểm request, AbortController; reject thao tác khi local-limited/awaiting-consent/refreshing/anonymous. Không để view đọc raw credential hoặc tự lấy accountId bất kỳ |
| `hooks/datasets`/upload coordinator | State machine upload, vô hiệu submit trùng, đối soát ACK, refetch/cache scope tài khoản; drop response cũ khi logout/đổi generation/Project |
| Protected Workspace view + upload panel | Chọn Project/file, trạng thái/lỗi/thử lại có chủ đích. Tách view này khỏi dev preview và fixture; giữ danh sách HTML/fallback |
| Graphics/math hiện có | Nhận ResourceNode đã validate. Không upload/parse file/gọi private API trong renderer. Giữ camera/selection theo ID khi cây đổi; focus Dataset mới chỉ sau nó có mặt trong layout thành công |

Batch đầu đề xuất upload từ File trong memory; **chưa tự ghép draft IndexedDB hoặc auto offline queue**. Nếu người dùng muốn giữ file khi offline/reload, triển khai batch draft riêng dùng repository hiện có, consent lưu local và quy tắc ACK/account; không tạo hệ lưu trữ thứ hai.

FormData gửi đúng một file, tên field đề xuất `file` phải chốt hợp đồng server (hiện `_fieldName` bị bỏ qua). Browser tự tạo multipart boundary; không hard-code Content-Type. Client hiện có nhận data unknown nên có thể gửi FormData; progress % cần mở rộng ApiRequestOptions có chủ đích và test, hoặc batch đầu dùng trạng thái gửi/xử lý không phần trăm. Timeout upload phải được thống nhất riêng với thời gian ingest, không tự vô hiệu timeout bằng 0.

## 6. State machine và lỗi

```text
idle → file-selected → validating → ready-to-submit
→ sending → waiting-for-server → verifying-ack → reloading-metadata → success
```

- 100% byte gửi chỉ chuyển sang đang xử lý, không success. INGESTING/FAILED phải được hiện đúng từ server; không suy ra READY từ file đã đọc xong.
- 400/415/422: báo lỗi file/contract theo phản hồi chuẩn hóa; không hiển thị raw storage key/stack trace.
- 401: dừng request và đi qua coordinator/renewal policy hiện có, không tự replay POST sau refresh. 403: không có quyền, không đổi sang lỗi mạng. 404: Project không còn, yêu cầu chọn lại. 409: cardinality/conflict theo A/B; refetch metadata.
- 413/quota: báo quá dung lượng và giữ lựa chọn file nếu còn memory. Network/timeout/cancel sau gửi: kết quả chưa xác định, không tự tạo khối hoặc upload lại.
- ACK sai ID/status/parent: không thêm khối, không dọn draft; báo invalid-response và đối soát. Nếu upload được ACK nhưng refetch lỗi, báo “đã upload, chưa tải lại bản đồ”, không báo upload thất bại và khuyến khích gửi lại.
- Logout/đổi account: abort, khóa thao tác, clear private query cache, drop mọi response/progress cũ. Client abort không được mô tả là xóa file trên server.

## 7. Tải metadata và cập nhật cây

Đề xuất chọn một Workspace thật, tải Projects thuộc Workspace đó và metadata Dataset theo contract A/B. Cache/query key phải account-scoped và có Workspace/Project ID. API hiện theo Project nên có thể nhiều request; dùng concurrency hữu hạn và loading/error riêng từng nhánh, không báo nhánh chưa tải là “không có Dataset”. Không cần lấy record/AI result để vẽ cây.

ACK được validate phải có Dataset ID, Project ID trùng đích đã capture, Workspace ID phù hợp và status được hỗ trợ. Invalidate/refetch Project/Dataset metadata; chỉ merge theo ID server, không append trùng từ cả ACK và refetch. Nếu thiếu parent, báo lỗi cấu trúc ở adapter và giữ UI phục hồi; không tạo Project giả. ResourceNode vẫn chỉ gồm id/kind/name/parentId, status/row count ở metadata panel riêng.

Đổi tên server giữ ID → chỉ đổi nhãn; đổi số dòng → vẫn một khối; thêm Dataset → chỉ thêm node/cạnh nếu hợp lệ theo cardinality đã chốt. Với A, “upload file thứ hai vào cùng Project” không phải case thêm node; phải tạo/chọn Project khác hoặc xử lý Dataset cũ qua batch riêng.

## 8. Batch sau khi được duyệt

1. Chốt A/B, định dạng/cap/name/ACK/idempotence và môi trường test; kiểm backend đang chạy với fixture không private, không suy từ health=200 rằng ingest/storage đã đúng.
2. Batch BE prerequisite riêng nếu cần, review contract và test trước FE upload. Không thay đổi BE âm thầm trong batch FE.
3. FE services + mapper + private runtime gate và unit/contract tests; chưa chạm renderer hoặc public preview.
4. Protected upload UI + trạng thái/lỗi + metadata loader; ghép cây 3D sau khi DTO hợp lệ. Giữ guard và production preview boundary.
5. End-to-end thật với tài khoản/file test được phép; kiểm byte/progress/READY/refetch/node/parent, failure/account race và resource authorization. Lưu bằng chứng đã loại thông tin private vào `.agents/workspace-3d/`; không publish test file/draft.
6. Yarn test phù hợp, lint/build/diff check; self-review và mở Codex review diff. Giải thích service → mapper → view → graphics cho fresher. Không commit/reset/revert.

## 9. Tiêu chí nghiệm thu upload

| Case | Kết quả cần đạt |
|---|---|
| U01 | Không đăng nhập: không có request/private cache; preview dev không hiện uploader thật |
| U02 | Project đúng quyền + CSV hợp lệ: ACK READY, một ID server, đúng parent, một khối/cạnh mới phù hợp A/B |
| U03 | Cùng Dataset refetch/ACK nhiều lần: không trùng node; tên trùng khác ID vẫn phân biệt |
| U04 | File rỗng/sai định dạng/vượt cap/multipart thiếu file: lỗi rõ, server không giữ ingest mồ côi |
| U05 | Nhấn submit hai lần/two tabs đồng thời: không vượt cardinality; server có bảo đảm được duyệt |
| U06 | A: Project đã có Dataset trả 409, không thay/xóa dữ liệu. B: nhiều Dataset được trả đủ, không dùng findOne làm list |
| U07 | 100% gửi nhưng server đang parse: chưa success/chưa khối READY giả |
| U08 | 401/403/404/413/5xx: phân loại đúng; không tự replay POST hoặc đọc token từ view |
| U09 | Mất ACK/timeout/abort: không báo rollback hoặc tự resend; đối soát theo hợp đồng |
| U10 | ACK sai/malformed/INGESTING/FAILED: không giả READY, không clear draft |
| U11 | ACK hợp lệ nhưng refetch lỗi: báo upload thành công riêng với lỗi tải bản đồ |
| U12 | Logout/đổi account trong lúc gửi/refetch: response cũ không cập nhật account mới; cache/draft không lộ chéo |
| U13 | Đổi Project trong lúc upload: request giữ đích cũ đã capture, UI không ghép nhầm parent |
| U14 | File cùng tên/nhiều dòng/đổi tên: identity theo ID, một Dataset một khối |
| U15 | Backend storage/parser/outbox lỗi: có trạng thái/cleanup/đối soát được kiểm chứng, không chỉ mock success |
| U16 | Cross-account/cross-workspace Project ID: backend từ chối đúng, không chỉ UI ẩn nút |
| U17 | WebGL lỗi/reduced motion/keyboard/mobile: uploader và danh sách HTML dùng được |
| U18 | Regression auth/bootstrap/preview production boundary + unit/contract suite đạt; build không thay live upload test |
| U19 | CSV dấu `;` và `,` được nhận diện/xử lý theo contract delimiter đã duyệt; không đọc sai thành một cột và không tự chuyển nội dung file âm thầm |

## 10. Trạng thái và phần chưa làm

Đã đọc source và lưu plan. Chưa sửa upload/frontend-private/backend, chưa gửi file, chưa chạy BE hoặc live integration. Cardinality A/B đang chờ người dùng. Đề xuất CSV-only và các lựa chọn còn lại chưa được duyệt. Các test chạy trong lượt này thuộc batch sửa cổng 3D trước đó, không phải bằng chứng upload thật.

## 11. Kiểm tra hai CSV người dùng cung cấp (29/10/2026)

Đọc cục bộ, không sửa file/không gửi backend/không đưa records vào public preview:

| File | Số record dữ liệu không tính header | Cột | Delimiter | Kích thước |
|---|---:|---:|---|---:|
| Day_sell_24_12_18.csv | 362 | 5 | `;` | 15,030 byte |
| customer.csv | 50 | 5 | `,` | 1,227 byte |

Cả hai decode được UTF-8-sig; mọi record có đúng 5 trường, không có record rỗng trong cách đọc này. Chỉ kiểm cấu trúc, chưa audit chất lượng/nội dung/kiểu dữ liệu hoặc kết luận hai file có quan hệ join. Headers file thứ nhất: Date, zn, sb, tax, marza; file thứ hai: age, gender, review, education, purchased.

`fastCsv.parse({ headers: true, trim: true })` hiện không khai báo delimiter, nên file dấu `;` cần giải quyết contract delimiter trước khi upload thật; không coi đuôi CSV là đủ. Ảnh minh họa đã tạo theo quy tắc backend hiện tại: Workspace thử nghiệm → hai Project tên gợi ý Day_sell/Customer → mỗi Project một Dataset. Đây không phải quyết định người dùng đã chọn A và không phải ảnh browser/upload thành công. Hai cartridge cùng kích thước dù số dòng khác nhau; không tự nối dataset với nhau dựa vào filename.
