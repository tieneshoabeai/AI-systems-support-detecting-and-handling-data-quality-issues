# Shopping demo — đặc tả, test case và prompt
Ngày: 2026-11-14. Trạng thái: được người dùng cho phép triển khai sau discussion.
## 1. Yêu cầu và quyết định đã duyệt
BE offline. Demo login và Project bằng JSON được chuẩn bị từ shopping_trends_corrupted_10pct.csv.
Không gọi AI, không chạy phân tích lúc bấm Detection, không dùng SSE server.
Bật bốn panel Tổng quan, Data View, Data Analysis, Detection; giữ scene/motion hiện có.
Hiện nhãn chung “Demo — không kết nối backend”; không thêm nhãn “Kết quả AI mô phỏng”.
Data View: 10 dòng đầu; link tới trang riêng trong ứng dụng có phân trang toàn bộ 3.900 dòng.
Giữ thay đổi project trong sessionStorage cùng tab; F5 giữ dữ liệu; Reset demo khôi phục JSON và không logout.
Detection: stream trạng thái lần lượt trong 4 giây, sau đó đọc kết quả JSON. Có thể đóng/hủy khi đang chạy.
Khi đã có kết quả chưa đánh giá: x, Escape, click ngoài, chuyển module phải mở đánh giá và chặn thoát.
Đánh giá: số nguyên 1–5 sao và nội dung sau trim không rỗng; chỉ cho thoát sau lưu hợp lệ.
Có thể hủy form để quay lại kết quả, nhưng chưa được thoát panel.
Đóng tab/trình duyệt không bị khóa; kết quả chưa đánh giá giữ qua reload trong cùng tab.
## 2. Source-of-truth map và integration gate
- app/router/workbench-routes.tsx: route /processing/projects/:projectId, thêm route records.
- app/app-runtime.ts, lib/axios-client.ts, services/auth/: tái sử dụng login, refresh rotation, logout, restore.
- services/preview/preview-mock.service.ts: owner state project, rename, members, delete và undo.
- views/preview/project-workspace-2d.view.tsx: owner lựa chọn panel và chặn đóng.
- Dataset3DView và bindProjectGlassMotion: giữ nguyên ownership geometry/material/event/GPU; không redesign.
- ResultReviewDialog: dùng lại validation 1–5 sao + comment.
- CSV: nguồn sự thật của records. JSON stats/findings được tạo trước, không có model AI.
Mode: behavioral approximation của AI/SSE; tái sử dụng UI/source hiện có, không tuyên bố AI thật.
Gate runtime/fidelity: phải kiểm tra trình duyệt nếu công cụ khả dụng; static pass không thay thế bằng chứng này.
## 3. Đặc tả
### Input
CSV UTF-8: 3.900 records, 18 cột, 413.968 bytes. Giữ raw strings và thứ tự.
Credentials demo công khai riêng; token demo không có chữ ký thật và không gửi sang BE.
### Điều kiện
Chế độ demo được bật rõ qua query demo=shopping trong development; API thật vẫn là mặc định.
JSON có metadata, workspace/project, records, analysis, findings và auth.
Sai credentials -> 401; session demo bị revoke/hết hạn -> không chấp nhận protected request.
### Xử lý
Nạp mock adapter tại biên API; khớp DTO BE hiện tại. Không gọi API thật trong chế độ demo.
Store project nạp thêm project shopping gắn dataset; mutation lưu sessionStorage và có reset.
Chọn panel -> hiển thị nội dung JSON tương ứng.
Detection idle -> running -> complete -> reviewed. Đóng running -> idle, dọn timer.
Complete chưa reviewed -> mọi lối đóng quy định bị chặn bằng form review.
### Output
Overview đúng shape/size; bảng raw; stats/frequencies; findings có row, CSV line, column, value, reason/rule.
Tải CSV gốc và JSON báo cáo. Không giả tạo CSV đã làm sạch hay PDF chưa có.
Lỗi storage/fixture phải báo, không ACK thành công giả.
### Xếp loại và phương pháp
Missing = raw.trim()=='' theo BE DQ01. 0/false không missing.
NaN literal là chuỗi trong CSV, không phải JSON NaN. Tách nhóm ký hiệu thiếu và sai kiểu.
DQ03: số hữu hạn theo cột numeric; không tính ô trống thành lỗi kiểu.
DQ02: fingerprint toàn bộ cột, đếm dòng dư trong nhóm trùng.
DQ04: IQR với Q1/Q3 nội suy, < Q1-1.5 IQR hoặc > Q3+1.5 IQR; bằng ngưỡng không outlier.
IQR=0 hoặc ít hơn 4 số -> không đủ cơ sở kết luận.
Category/domain bổ sung: gắn rule origin demo-proposal, không khẳng định có từ BE.
Miền Age 0..120 integer, rating 1..5, purchase >=0, previous purchases >=0 integer là giả thuyết demo có ghi rõ nguồn.
Không tự sửa/drop/impute bất kỳ dòng nào. Outlier là cảnh báo, không phải lỗi chắc chắn.
### Thứ tự
Raw preview là records 1..10, không tính header. Full table phân trang 50 dòng.
Findings sort row tăng dần, column theo thứ tự CSV; bảng thống kê theo thứ tự cột.
Mỗi ô có thể có nhiều findings; tổng findings không đồng nghĩa tổng ô lỗi hoặc tổng dòng lỗi.
## 4. Test case
| ID | Nhóm | Input | Expected | Lý do |
|---|---|---|---|---|
| L01 | Thường | đúng credentials | phiên demo và protected route mở | login |
| L02 | Invalid | sai password | 401, không session | auth |
| L03 | Biên | refresh lần 2 | dùng refresh token mới | rotation |
| L04 | Đặc biệt | logout và response cũ | không hồi sinh phiên | race |
| P01 | Thường | project shopping | 3900 rows,18 cols,413968 bytes | metadata |
| P02 | Biên | preview | đúng 10 dòng đầu | giới hạn |
| P03 | Biên | full page 78 | records 3851..3900 | không thiếu dòng |
| P04 | Invalid | project ID lạ | not found | route |
| D01 | Thường | bấm Detection | running trước 4000ms, complete tại 4000ms | UX |
| D02 | Biên | đóng tại 3999ms | cancel timer, không có kết quả | cleanup |
| D03 | Biên | complete chưa review + x/Escape/outside/module | mở review, không thoát | gate |
| D04 | Invalid | rating 0,6,NaN/null; comment whitespace | không lưu | validation |
| D05 | Thường | rating5+comment | lưu, cho phép hành động bị chặn | gate |
| D06 | Đặc biệt | reload complete chưa review | tiếp tục bắt review | persistence |
| S01 | Thường | rename/member + F5 | giữ cùng tab | persistence |
| S02 | Đặc biệt | Reset demo | project/detection reset, auth giữ | isolation |
| F01 | Thường | count missing | 80 raw blank cells | CSV baseline |
| F02 | Đặc biệt | raw 'NaN' | giữ raw string, không serialize non-finite | accuracy |
| F03 | Biên | numeric bằng IQR bound | không outlier | boundary |
| E01 | Invalid | storage không ghi được | hiện lỗi, không báo đã lưu | failure |
## 5. Pseudocode
Init -> đọc demo flag -> chọn adapter mock -> restore session.
Store -> đọc seed JSON -> phục hồi mutation cùng tab hoặc dùng seed.
Select module -> nếu complete chưa reviewed và rời detection: queue action, mở review; ngược lại chuyển.
Detection -> ghi running, lên lịch trạng thái; tại 4000ms ghi complete.
Cancel running -> clear timers, về idle. Unmount -> clear timers/listeners.
Review -> validate -> persist -> reviewed -> chạy action đang chờ.
Reset -> clear demo data keys -> seed; auth keys giữ nguyên.
Dò tay: login đúng -> project -> detection -> 4s -> x -> đánh giá5+nội dung -> đóng.
Dò biên: 3999ms -> đóng -> timer bị hủy -> không complete.
## 6. Prompt triển khai
CONTEXT: React19 / TS6 / Vite8, repo hiện có và BE offline.
TASK: triển khai đúng đặc tả này, dữ liệu JSON từ CSV, không tích hợp AI.
INPUT: CSV và source map mục2.
CONSTRAINTS: giữ raw data; chỉ mock development opt-in; giữ scene; dùng patch/edit; không commit/push.
EXAMPLES: đúng login -> shopping -> 10rows -> full table; sai password ->401; thiếu review -> chặn đóng.
OUTPUT: source/JSON hoàn chỉnh, giải thích code trọng tâm, danh sách quyết định, kết quả test/diff.
CRITERIA: mục4; static(type/lint), functional, runtime(browser), fidelity(data/interaction) tách riêng.
## 7. AI prompting log
Bước1–5: tài liệu này. Bước6: đang triển khai sau người dùng cho phép.
Bước7 kiểm chứng: sẽ cập nhật kết quả thực tế.
Bước8 quyết định cuối: người dùng review diff.
## 8. Implementation notes
JSON và source sản phẩm nằm src/frontend/src/mocks/shopping-trends/ và layers hiện có.
Đây là vị trí source sản phẩm đã được đề xuất trong discussion và được triển khai theo yêu cầu hiện tại.
Tài liệu/script hỗ trợ nội bộ chỉ nằm .agents/shopping-demo/. Không thêm vào public/scripts/docs.
## 9. Kết quả triển khai và cách thử
- Mở development URL /auth/login?demo=shopping. Tài khoản demo công khai: demo@shopping.test / Demo12345!.
- Link mở project có trong banner; project URL /processing/projects/shopping-trends.
- Link bảng đầy đủ /processing/projects/shopping-trends/records: 50 dòng/trang, 78 trang, tìm kiếm và sắp xếp.
- Dùng ?demo=off và reload để trở lại API thật. Session demo dùng key riêng, không ghi đè session thật.
- 13 JSON fixtures: auth, project/workspace, dataset, analysis, detection, 8 batch records.
- Đối chiếu Python CSV reader: toàn bộ 3900x18 raw strings và thứ tự cột khớp chính xác nguồn.
- Tổng 448 findings trên 390 dòng: missing80, NaN60, sai kiểu80, sai miền62, categorical80, outlier86; duplicate0, ký hiệu thiếu khác0.
- Một ô có thể đồng thời sai miền và outlier. Không coi tổng findings là tổng ô lỗi.
- Miền bổ sung được ghi demo-proposal. Item Purchased/Color/Location dùng dictionary ứng viên từ file, loại các nhãn nghi vấn hiển nhiên; không khẳng định là taxonomy nghiệp vụ đã xác minh.
- useShoppingDetection sở hữu timer và trạng thái idle/running/complete/reviewed. Timer hủy khi rời panel hoặc unmount.
- ProjectWorkspaceView sở hữu close gate và hành động chuyển module chờ review. ResultReviewDialog dùng validation hiện có.
- shoppingAuthAdapter xử lý login/refresh/profile/logout tại chỗ, không có request đến server; refresh token được rotate.
- preview-mock.service persist trước khi cập nhật state; lỗi storage trả Promise reject để toast hiện lỗi, không báo lưu thành công.
- TypeScript app và ESLint changed files: PASS.
- Vite production build: PASS, có cảnh báo chunk >500kB của bundle 3D; formatter không chạy.
- 6 file test liên quan: 157/157 PASS trước khi bổ sung test lỗi storage. Suite demo sau bổ sung: 10/10 PASS. TypeScript và lint hai file thay đổi cuối được kiểm tra lại.
- Browser: login đúng -> protected processing/project; streaming -> kết quả; đóng -> review; submit thiếu sao bị chặn; gửi 5 sao+comment -> panel đóng.
- Browser: link Xem đầy đủ đi đúng route records; bảng 50 dòng/trang, chuyển được trang2/78; Reset demo quay về project mà vẫn giữ login.
- Browser account header hiển thị Demo Analyst. Runtime có lúc fallback WebGL; nav/panel vẫn thao tác được. Chưa xác nhận fidelity 3D trên mọi thiết bị.
- Ảnh minh chứng: full-table.jpg trong cùng thư mục tài liệu.
- Chưa commit/push. Backend staged và các thay đổi có sẵn trước task không được sửa/reset.

