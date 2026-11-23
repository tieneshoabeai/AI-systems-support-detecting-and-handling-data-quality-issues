# F3/F5 · Đối chiếu contract và caller trước khi sửa

Phạm vi gồm source, OpenAPI snapshot và test hiện có trong `src/frontend`. Các đường dẫn dưới đây tính từ thư mục frontend. Kết quả phản ánh contract được lưu trong repo. Status và header của server đang chạy chưa được xác nhận.

## F3 · Response 204

| Endpoint trong snapshot | Caller thực tế | Cách dùng body |
|---|---|---|
| DELETE `/api/v1/workspaces/{id}` | `management.store.ts:528`, `remove('workspace', id)` → `mutate` | Chờ request xong rồi tải lại dữ liệu. |
| DELETE `/api/v1/projects/{id}` | `management.store.ts:528`, `remove('project', id)` → `mutate` | Chờ request xong rồi tải lại dữ liệu. |
| DELETE `/api/v1/datasets/{id}` | `dataset.service.ts:76–78`, thao tác xóa dataset | Chờ request xong, kết quả là `void`. |

Đây là toàn bộ ba operation khai báo `204` trong snapshot. DELETE tài khoản, session, member và feedback khai báo `200`. Trong số đó UI feedback đọc kết quả qua `setResponse` (`live-analysis-panel.tsx:244`). Vì vậy cần phân loại theo endpoint/caller, kể cả khi các operation có cùng HTTP method.

`axios-client.ts:129` trả `undefined as T` khi nhận 204. Ví dụ caller cần DTO là `createProject` tại `management.store.ts:551`, đọc `data.project` để lấy ID upload. Snapshot khai báo POST tạo project trả 201. Đăng xuất cũng cần body có `message` dù chữ ký service là `Promise<void>` (`auth.service.ts:67–74`). Chữ ký service mô tả kết quả trả cho UI, còn contract HTTP mô tả dữ liệu service cần đọc.

**Proposal.** Cho caller khai báo chế độ chấp nhận 204 và trả `void` ở ba endpoint có bằng chứng. Với operation cần body, 204 bất ngờ đi qua `ApiError` loại `invalid-response`. Giữ khả năng xử lý envelope hợp lệ trong đường mutation dùng chung cho các endpoint 200. Trước khi đổi mặc định ở wrapper, đối chiếu các mutation đang bỏ body và giữ đường tương thích cho caller chưa xác minh, vì snapshot có thể lệch với server live. File ứng viên gồm `api.types.ts`, `axios-client.ts`, `management.store.ts`, `dataset.service.ts` và test liên quan. Test nền hiện có tại `foundation/api.test.ts:177` kiểm tra 204 của xóa workspace. Bổ sung kiểm tra ba đường xóa theo contract, 200 có envelope qua helper dùng chung và 204 bất ngờ ở caller yêu cầu DTO.

## F5 · Status của luồng tải PDF

- **Tạo job** dùng POST `/projects/{projectId}/report`, snapshot khai báo 202. Nút **Yêu cầu PDF** lấy `reportId` từ body nếu có (`live-analysis-panel.tsx:206–211`).
- **Tải PDF** dùng GET `/projects/{projectId}/report/{reportId}/file`. Snapshot tại `openapi.json:2698–2725` mô tả 200 là PDF, 202 là metadata chờ. Hai response chỉ có mô tả, không khai báo chi tiết MIME hoặc schema metadata.
- Nút **Tải PDF** gọi `downloadReport` qua `store.analysisService`. Store truyền `sessionApi`, wrapper ghép tín hiệu hủy của phiên và forward request. Nếu service trả `pending`, UI hiện thông báo có thể kiểm tra lại. Nếu trả `ready`, UI tạo object URL và tải Blob xuống dưới tên `report-{id}.pdf` (`management.store.ts:98–105,423,454`, `live-analysis-panel.tsx:212–219`).
- `analysis.service.ts:50–61` dùng `Blob.type` để phân nhánh vì `axios-client.ts:129–131` chỉ trả body. Test tại `connected-api.test.ts:157–165` mock Blob JSON và Blob PDF. Nó xác nhận hành vi theo MIME, chưa kiểm tra nhánh theo HTTP status.

**Proposal.** Cho riêng request tải report nhận `{ status, data }` với body là Blob. Giữ dạng response thông thường ở dataset download và attachment download. Service phân nhánh theo status: 202 luôn trả `pending`, kể cả khi MIME thiếu hoặc metadata chỉ đọc được dạng text; 200 cần file phù hợp trước khi trả `ready`; status thành công khác báo response không hợp lệ. Giữ kiểu `ReportDownload` đang dùng ở UI và truyền nguyên auth/abort qua store. File ứng viên gồm `api.types.ts`, `axios-client.ts`, `analysis.service.ts` và test. Nếu mở rộng chữ ký transport, kiểm tra cả adapter `sessionApi` và các test double khi chạy TypeScript. Kiểm thử 202 với MIME thiếu/sai, 202 metadata không parse được, 200 PDF, 200 body JSON và lỗi HTTP.

## Điểm duyệt

### Kết quả rà tương thích F3 sau F5

| Nhóm caller | Ví dụ đã đối chiếu | Tác động nếu wrapper từ chối 204 mặc định |
|---|---|---|
| 204 theo snapshot và caller bỏ body | Xóa workspace/project qua `management.store.ts:528`, xóa dataset qua `dataset.service.ts:76–78` | Ba luồng xóa cần đường chấp nhận 204 rõ ràng. |
| Caller cần response | Tạo project/workspace và issue lấy ID, logout kiểm tra `message`, records có cả GET và POST, xóa feedback đưa dữ liệu về UI, dataset/attachment download cần Blob | Có thể áp dụng kiểm tra 204 theo từng caller đã biết cần body. Nếu thiếu dữ liệu bắt buộc, báo `invalid-response` tại biên API. |
| Caller chỉ chờ thành công, snapshot ghi 200/201 | Xóa tài khoản/session, đổi mật khẩu, đăng ký/khôi phục mật khẩu, đổi PII, xóa member, upload CSV/attachment, cập nhật workspace và profile | FE hiện tiếp tục khi nhận 204. Nếu live thực sự trả 204, đổi mặc định sẽ biến một thao tác có thể đã lưu thành lỗi UI. Đặc biệt với mutation theo nhiều bước, điều này có thể ngắt workflow giữa chừng. |
| F5 trả cả status lẫn body | `analysis.service.ts:51` gửi `includeStatus: true`; wrapper trả status để service xử lý 200/202 và từ chối status ngoài contract | Giữ nguyên khả năng đọc status của report khi triển khai F3. |

**Phạm vi đề xuất để duyệt.** Bước đầu giữ nhánh 204 cũ cho caller chưa phân loại. Thêm chế độ yêu cầu body theo từng request, áp dụng trước cho các endpoint tạo workspace/project/issue cần ID. Dùng kiểu `void` cho ba đường xóa theo contract ở mức caller. Với helper mutation chung, chỉ đường xóa workspace/project dùng mode body rỗng nếu cần tách mode. Chạy regression cho response 200/201 có envelope, 204 của ba đường xóa, 204 bất ngờ ở thao tác tạo và tải report 200/202.

**Điều kiện trước khi siết toàn wrapper.** Xác nhận status thực tế của nhóm mutation bỏ body nhưng snapshot ghi 200/201 trên môi trường test, nhất là xóa tài khoản/session/member, upload và cập nhật dữ liệu. Lần rà này dựa trên source và OpenAPI snapshot. Chưa gọi server live, chạy test mới hoặc sửa source.

Ưu tiên F5 nếu muốn sửa theo phạm vi hẹp tại một endpoint có caller UI rõ. Với F3, việc siết 204 trên toàn wrapper cần xác nhận tương thích thêm. Lượt này chỉ đọc và lưu kết quả, chưa sửa source hay chạy test mới.
