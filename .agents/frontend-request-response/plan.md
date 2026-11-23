# Kế hoạch audit vòng đời Request/Response của Frontend

**Trạng thái** · Chờ duyệt kế hoạch audit. Sau audit sẽ có một lượt duyệt proposal riêng trước khi chỉnh source.

## 1. Mục tiêu và phạm vi

Theo dõi một thao tác từ lúc giao diện phát sinh yêu cầu đến lúc dữ liệu hoặc lỗi được hiển thị. Đối chiếu trách nhiệm từng lớp với luồng mục tiêu: Component → Hook → Service (nếu cần) → API Layer → HTTP Client. Khi có phản hồi, theo chiều ngược lại đến nơi cập nhật state và render.

Khảo sát toàn bộ `src/frontend` để lập danh mục đường gọi HTTP và các cơ chế dùng chung. Chọn tối thiểu một GET và một thao tác ghi để đọc chi tiết từng bước, sau đó mở rộng sang các biến thể có hành vi khác. Dùng OpenAPI lưu trong FE, tài liệu và test hiện có để đối chiếu contract. Phần xử lý nội bộ Backend nằm ngoài phạm vi. Giữ nguyên API contract và bảo toàn hành vi người dùng đang dựa vào. Nội dung `.env` và giá trị thông tin xác thực không xuất hiện trong báo cáo.

## 2. Context đã đối chiếu sơ bộ

| Điểm bắt đầu | Điều đã thấy trong source | Việc sẽ kiểm tra khi audit |
|---|---|---|
| `src/frontend/src/README.md` | Tài liệu mô tả `app`, `views`, `components`, `hooks`, `services`, `lib`, `configs` và `types`. | Đối chiếu trách nhiệm được mô tả với đường gọi và hướng import thực tế. |
| `src/frontend/src/lib/axios-client.ts`, `createAxiosClient` | HTTP client dùng Axios. Wrapper nhận params, signal và response type, có nhánh trả dữ liệu cho 204 và Blob, cùng bước xử lý envelope. | Xác minh cách chọn URL, gắn thông tin xác thực, xử lý status, timeout, abort và cách lỗi đi về caller. Axios là HTTP client hiện có được đề bài chấp nhận. |
| `src/frontend/src/views/application/management-data-provider.tsx`, `ManagementDataProvider` và `ProcessingDataProvider` | Provider tham gia khởi tạo dữ liệu và biểu diễn loading/error. | Xác định route nào dùng từng provider và điểm React subscribe vào store. |
| `src/frontend/src/services/management/management.store.ts`, `createManagementStore` | Store có `load`, publish state và `createProject`. Thao tác tạo project có các bước tiếp theo như upload CSV và tải lại dữ liệu. | Làm rõ phần điều phối nghiệp vụ, phần mô tả endpoint và phần state. Tên thư mục `services` chưa đủ để kết luận trách nhiệm. |
| `src/frontend/src/lib/openapi.json` và `src/frontend/graphify-out/GRAPH_REPORT.md` | Có snapshot OpenAPI và báo cáo graph sẵn để định hướng đọc. | Đối chiếu lại từng kết luận với working tree. Snapshot và graph có thể lệch với source hoặc server đang chạy. |

Các điểm trên là bằng chứng định hướng. Kết quả audit, độ bao phủ và xác nhận runtime sẽ được ghi riêng trong báo cáo.

## 3. Cách audit

1. **Lập danh mục.** Bắt đầu từ route và các module HTTP. Tìm các điểm dùng Axios wrapper, Axios/fetch trực tiếp hoặc transport chuyên biệt. Theo dõi caller theo feature, đánh dấu đường live, mock, test và các điểm chưa xác định. Rà imports giữa UI, hook, store, service, API và transport để phát hiện phụ thuộc ngược hoặc vòng phụ thuộc có bằng chứng.
2. **Truy vết GET.** Ưu tiên luồng Management tải workspace và project qua provider, `load` và `loadWorkspaces`. Bắt đầu ở route, xác minh request nào được gửi, nơi publish state và component nào đọc state để render. Ghi rõ các request tiếp theo nếu một thao tác tải nhiều tài nguyên.
3. **Truy vết thao tác ghi.** Ưu tiên thao tác tạo project trong wizard qua `createProject`. Xác minh caller, POST, JSON hoặc multipart ở từng bước, cách chống gửi trùng, cách xử lý khi project đã tạo nhưng upload/thêm thành viên hoặc tải lại thất bại, và state sau mỗi kết quả. Xác minh route Management/Processing thực sự dùng chung những đoạn nào.
4. **Đối chiếu các biến thể.** Theo từng endpoint, kiểm tra URL, method, headers, auth, params, body, kiểu request/response và nơi parse status/body. Rà cancellation, retry, pagination, loading/error, store/cache, và nguồn phát sinh lỗi. Mở rộng theo danh mục sang các nhánh như public/session, refresh, upload/download, JSON/envelope và response rỗng nếu caller thực sự có dùng.
5. **Ghi bằng chứng và đánh giá.** Mỗi bước truy vết có đường dẫn, dòng, tên hàm, input/output và nơi cập nhật UI. Ghi lượng luồng đã rà và những chuỗi đã truy vết sâu. Chấm từng tiêu chí bằng PASS, PARTIAL, FAIL hoặc N/A. Nếu cần tóm tắt bằng tỷ lệ, công bố cả tử số, mẫu số và chỉ tính trên tiêu chí áp dụng đã có bằng chứng. Ghi riêng phần chưa xác minh, khác biệt triển khai hợp lý, lớp không cần thiết, cơ hội cải thiện, lỗi kiến trúc và lỗi chức năng. Mỗi finding có tác động và ưu tiên Critical/High/Medium/Low.

## 4. Deliverable sau audit

Một báo cáo gồm bảy phần theo đề bài: hiện trạng kiến trúc, trace GET và ghi, bảng đối chiếu từng tầng, findings, proposal refactor, sơ đồ kiến trúc đề xuất và lộ trình. Bảng đối chiếu ghi tầng, trách nhiệm mục tiêu, hiện trạng, kết quả và bằng chứng. Sơ đồ thể hiện hướng phụ thuộc và những nhánh thực sự cần Service.

Mỗi thay đổi đề xuất liệt kê file sửa/tạo/bỏ nếu có, trách nhiệm trước và sau, phụ thuộc mới, lợi ích, rủi ro và cách kiểm chứng. Chỉ chốt danh sách file sau khi có bằng chứng. Ưu tiên giữ luồng hợp lý đang có. Một workflow nhiều bước như tạo project kèm CSV là ứng viên để đánh giá vai trò điều phối của Service. Một thao tác chỉ chuyển tiếp HTTP cần được xem xét dựa trên trách nhiệm thực tế.

## 5. Lộ trình refactor dự kiến sau khi proposal được duyệt

| Giai đoạn | Hướng thực hiện có điều kiện | Điều kiện qua giai đoạn |
|---|---|---|
| 1. HTTP Client và API Layer | Dùng lại transport hiện có. Chuẩn hóa khai báo endpoint hoặc option bị lặp khi audit xác nhận. | Method, URL, auth, body và cách trả dữ liệu giữ đúng contract, kể cả 204, Blob và upload. |
| 2. Hook và state | Làm rõ nơi điều phối loading/error, subscribe, cập nhật state/cache và hủy request. | Kiểm tra loading → success/error, đổi route hoặc session khi request còn chạy, và cập nhật UI sau mutation. |
| 3. Service và store | Chỉ tách phần nghiệp vụ có trách nhiệm rõ. Giữ thứ tự thao tác, chống gửi trùng và theo dõi tiến độ của workflow nhiều bước. | Kiểm tra cả thành công và thất bại từng phần, đặc biệt khi server đã ghi dữ liệu nhưng UI chưa tải lại được. |
| 4. Lỗi và TypeScript | Thống nhất lỗi transport ở biên HTTP, giữ thông báo theo ngữ cảnh UI và thu hẹp DTO ở các điểm được xác nhận. | Kiểm tra response rỗng hoặc khác hình dạng, lỗi HTTP, lỗi mạng và tính tương thích với caller. |
| 5. Regression và bàn giao | Dùng các bộ test hiện có cho HTTP client, auth/session, management store và UI kết nối. Xác nhận lại GET và thao tác ghi qua entry point. | Ghi lệnh, kết quả và giới hạn runtime. Nếu có môi trường phù hợp, kiểm tra FE–BE bằng dữ liệu kiểm thử. |

Các giai đoạn có thể gộp hoặc bỏ khi audit cho thấy chưa cần. Rủi ro cần ưu tiên là đổi hành vi xác thực, đọc nhầm response schema hoặc khiến thao tác bị ghi lặp sau lỗi một phần. Proposal phải mô tả cách giữ các hành vi này trước khi triển khai.

## 6. Điểm duyệt

1. Duyệt phạm vi, cách lấy bằng chứng và hai luồng ưu tiên trong tài liệu này.
2. Audit đọc source, tự rà soát bằng chứng rồi trình báo cáo và proposal để duyệt phạm vi thay đổi.
3. Khi proposal và giai đoạn sửa đã được duyệt, chỉnh bằng patch/edit, kiểm thử theo giai đoạn và mở diff trong Codex. Bàn giao kèm đoạn code trọng tâm, chức năng, cách gọi và cách đọc lỗi nếu input thiếu, sai hoặc thao tác chỉ thành công một phần.
