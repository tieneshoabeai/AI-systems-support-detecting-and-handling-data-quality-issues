# Hướng dẫn test thủ công DataVerse

Dùng file này để kiểm tra chức năng, giao diện và request thực tế. Phần cuối có inventory **84 thao tác HTTP**, gồm cả route nội bộ không dành cho frontend. Kết quả đã thu trước đó nằm trong [báo cáo tích hợp](API_INTEGRATION_STATUS.md). Ghi kết quả của lần chạy mới vào checklist, kể cả các ca bị chặn hoặc chưa chạy.

**Chuẩn hiện tại (25/11):** ưu tiên hợp đồng full stack trong `API_ANSWER_24-11.md`, tiếp theo danh sách/hành vi nút đã đối chiếu trên `origin/frontend` tại `3a49455`; giữ giao diện TaiFE tại `511f5f9`. Người dùng đã xác nhận theo frontend về các nút. Code được cập nhật trực tiếp trên `TaiFE`. Kết quả runtime IndexedDB và API thật nằm ở đầu [báo cáo tích hợp](API_INTEGRATION_STATUS.md). Checklist bên dưới là phạm vi nghiệm thu, không phải danh sách tất cả ca đã qua.

## 1. Chuẩn bị

- [ ] Mở [Swagger QA](https://additions-kid-soft-pond.trycloudflare.com/api/v1/docs). Nếu tunnel đã đổi, lấy link mới của **cùng môi trường QA**. Kiểm tra `/health` và `/health/ready` trên origin backend. Nếu Swagger không mở hoặc `/health` lỗi kết nối, ghi `BLOCKED`, giữ nguyên số liệu cũ và báo người vận hành trước khi thử mutation.
- [ ] Kiểm tra `src/frontend/.env`: `VITE_API_BASE_URL` là origin backend HTTPS, `VITE_API_PREFIX=/api/v1`, `VITE_SWAGGER_URL` là URL trang docs. Khởi động lại Vite sau khi đổi cấu hình. Dùng URL Vite in ra, thường là `localhost:5173`. Lệnh PowerShell khi cần chạy HTTP local: `cd src/frontend`, `$env:DEV_HTTPS = 'false'`, `npm run dev`.
- [ ] Chuẩn bị hai profile trình duyệt cho **Analyst A** và **Analyst B**, một profile cho **Admin**, và một tài khoản QA mới để thử đăng ký, OTP, đổi mật khẩu, thu hồi phiên và xóa tài khoản. Dùng hộp thư QA có thể nhận OTP. Đăng nhập Google bằng tài khoản QA của bạn khi kiểm tra OAuth.
- [ ] Đặt tên dữ liệu thử theo `QA-YYYYMMDD-<tên>-<số>` và ghi lại ID của Workspace, Project, dataset, report và feedback vừa tạo. Dùng CSV, ảnh PNG hoặc PDF tổng hợp. Chỉ đổi quyền hoặc xóa dữ liệu vừa tạo cho lần test; bỏ qua xóa nếu chưa xác minh được ID. Issue QA và tệp có thể còn lại vì Swagger chưa có DELETE; dùng issue dành riêng cho test và đánh dấu `resolved` sau khi thử.
- [ ] Mở Chrome DevTools → **Network** → bật **Preserve log**, **Disable cache**. Dùng **Fetch/XHR** cho các API thường, **All** cho chuyển hướng OAuth và tải file. Xóa dòng cũ trước từng cụm thử, lọc theo endpoint, rồi kiểm tra đúng **method, origin, path, status, payload và phản hồi**. `OPTIONS 204` mới là preflight; đọc thêm dòng request nghiệp vụ. `304` là cache; đổi bộ lọc hoặc reload với Disable cache nếu cần xác minh body.
- [ ] Với mỗi ca, kiểm tra UI sau phản hồi: thông báo, dữ liệu mới, trạng thái nút, lỗi, và tính nhất quán sau reload. Với POST/PATCH/DELETE, xác nhận request dùng đúng ID và bấm một lần. Nếu timeout sau mutation, kiểm tra danh sách trước khi thử lại để tránh tạo trùng.

### CSV thử nhanh

Lưu UTF-8 với tên `qa-data.csv`. Dùng `score` cho histogram/Box Plot, `nhom` cho Top N. Nhân thêm dòng tổng hợp và đổi `id` để có đủ bản ghi thử phân trang và đủ nhóm để thấy mục **Các giá trị còn lại**. Để thử trạng thái bị che, dùng cột được backend đánh dấu `masked` hoặc schema đánh dấu PII; không dùng dữ liệu cá nhân thật.

```csv
id,nhom,score,amount,ngay
Q001,A,10,100,2026-11-01
Q002,A,12,115,2026-11-02
Q003,B,15,150,2026-11-03
Q004,B,16,160,2026-11-04
Q005,C,18,185,2026-11-05
Q006,D,20,195,2026-11-06
Q007,E,23,220,2026-11-07
Q008,F,24,245,2026-11-08
Q009,A,,120,2026-11-09
Q010,A,90,905,2026-11-10
```

## 2. Thứ tự kiểm tra trên UI

### A. Đăng nhập, hồ sơ, bảo mật và hệ thống

- [ ] Mở trang bảo vệ khi chưa đăng nhập. Kiểm tra chuyển về đăng nhập, lỗi khi bỏ trống form, sai mật khẩu một lần trên tài khoản tạm, đăng ký tài khoản mới và đăng nhập đúng. Thử reload trang sau đăng nhập, kiểm tra đúng tài khoản, quyền và phiên.
- [ ] Thử **Quên mật khẩu** trên tài khoản tạm. Kiểm tra gửi yêu cầu và nhận OTP thật, thử một mã sai, sau đó dùng mã hợp lệ còn hạn. Đăng nhập lại bằng mật khẩu mới. Kiểm tra mật khẩu hiển thị/ẩn, đối chiếu hai ô nhập lại và hành vi báo lỗi.
- [ ] Bấm **Đăng nhập bằng Google** với Preserve log. Kiểm tra `302`, URL `redirect_uri`, callback rồi màn hình/role khi hoàn tất. Nếu vẫn chuyển về `localhost:3000`, ghi `BLOCKED – OAuth QA`. Hai nút Microsoft/GitHub hiện chưa khả dụng.
- [ ] **Cài đặt → Hồ sơ cá nhân:** kiểm tra thông tin hiện tại; sửa một giá trị trên tài khoản tạm, lưu, reload và kiểm tra giữ đúng. Đổi mật khẩu từ mục **Bảo mật** chỉ trên tài khoản tạm, rồi xác nhận đăng nhập lại.
- [ ] **Đăng nhập & phiên:** mở danh sách, chi tiết phiên hiện tại và phiên thứ hai. Tạo phiên thứ hai rồi thu hồi đúng phiên đó; xác nhận phiên hiện tại vẫn hoạt động. Với phiên tạm hết hạn, kiểm tra hộp thoại gia hạn, `/health`, request refresh sau khi đồng ý và việc khôi phục trang. Thử đăng xuất rồi mở lại một trang bảo vệ.
- [ ] **Cài đặt → System:** đổi màu Sáng/Tối/Theo hệ thống, reload kiểm tra lưu trên thiết bị; bật/tắt thông báo rồi khôi phục; mở **Trạng thái hệ thống**, bấm Kiểm tra lại và xem DB/lưu trữ/thời gian kiểm tra. Các lỗi kết nối phải có thông báo để thử lại.

### B. Trang chủ, Workspace và Project

- [ ] Ở **Quản lý**, kiểm tra Activity Overview, bộ lọc thời gian, số Workspace/Project, phân bố trạng thái và điều hướng tới từng mục. So sánh số liệu trên cùng phạm vi quyền và bộ lọc. Thử tìm kiếm, chọn Workspace/Project từ thanh đầu trang, danh sách rỗng và chuyển dạng lưới/danh sách.
- [ ] Dùng Analyst A tạo Workspace QA, mở chi tiết, sửa tên/mô tả, kiểm tra danh sách thành viên và reload. Kiểm tra trạng thái hủy form, avatar/icon và yêu thích. Các thao tác chỉ lưu cục bộ không cần HTTP.
- [ ] Thêm Analyst B vào Workspace, kiểm tra quyền bằng profile B. Thử gỡ và thêm lại **chính thành viên vừa thêm**. Thử nhượng owner qua lại rồi cho B rời Workspace. Thêm lại B nếu còn cần chạy ca Project. Xác nhận quyền ở cả hai profile sau mỗi thay đổi.
- [ ] Từ **Processing** và **Workspace → Tạo Project**, mở wizard, thử bỏ trống/bấm Quay lại/Hủy. Tạo Project QA trong đúng Workspace, chọn CSV, thử vai trò thành viên ở wizard, xác nhận và bấm **Xem Project**. Hộp thoại phải đóng, Project phải mở đúng. Kiểm tra metadata upload và reload.
- [ ] Từ menu **Quản lý thành viên** mở trực tiếp ở Processing, thêm B từ roster Workspace, đổi vai trò rồi gỡ. Thêm lại nếu cần thử nhượng owner Project và chuyển quyền lại. Dùng một account không thuộc Workspace để kiểm tra UI không cho thao tác ngoài quyền. Đổi tên Project qua Quản lý, reload để kiểm tra tên mới đồng bộ ở Processing.

### C. Processing, 3D, Data View và phân tích

- [ ] Mở trực tiếp `/processing/projects/<projectId>` và qua danh sách. Kiểm tra breadcrumb, tổng quan dataset, menu Project, ba module **Tổng quan / Data View / Data Analysis**, đóng/mở panel. Theo frontend `3a49455`, Detection không có tab riêng và khối cam không mở module; không được mở trùng Data Analysis. Thử điều hướng bàn phím, màn hẹp, tải chậm và khi scene 3D không khả dụng.
- [ ] **Data View:** so sánh số dòng/cột với CSV, lấy trang trước/sau bằng mẫu đủ lớn, lọc/tìm `A`, sắp xếp `score`, áp dụng nhiều điều kiện, thử không có kết quả rồi tải lại. Tải CSV gốc và mở file để kiểm tra tên và nội dung.
- [ ] **Phân bố dữ liệu:** chọn `score`, bấm **Tải thống kê cột** và xem cả `/stats` lẫn `/charts`. Kiểm tra histogram ở chế độ Số bản ghi/Tỷ trọng, Box Plot có hộp/râu/trung vị và số điểm ngoài râu, kể cả cột có giá trị giống nhau. Chọn `nhom` và tải lại, kiểm tra Top N cùng số bản ghi/tỷ trọng/nhóm còn lại. Cột bị ẩn phải không hiện nhãn giá trị. Nếu charts lỗi nhưng stats thành công, UI phải báo fallback.
- [ ] **Data Analysis:** thử tải kết quả trước lần đầu; chạy phân tích với bốn tham số phương pháp và kiểm tra body POST. Không có lưu/tải cấu hình cột hay nút sửa PII. Đối chiếu `analysisRunId` và job; thử lại trên job QA, xác nhận UI theo dõi ID mới. Kết quả hiển thị chỉ số chất lượng, thống kê, tương quan và feedback đúng lần chạy/phát hiện; JSON nằm trong Chi tiết kỹ thuật.
- [ ] Tạo và tải tổng kết; yêu cầu PDF và thử tải khi còn `202`. Đọc `status`: `pending`/`running` thì tiếp tục chờ; `failed` phải dừng chờ và hiện lỗi; `200` phải là PDF mở được. Nếu job không tiến triển, ghi `BLOCKED – worker PDF` cùng report ID và thời gian chờ.
- [ ] Tạo, xem, sửa và xóa feedback **vừa tạo** cho lần phân tích và cho một finding của lần chạy QA. Xem chỉ số AI. Thử nhập sai mã trong fixture của mình để kiểm tra mức lỗi và thông báo. Nhấn **Hoàn thành Project**, xác minh cập nhật trạng thái sau reload.

### D. Thông báo, issue và Quản trị

- [ ] Dùng Analyst tạo issue QA trong chuông **Báo cáo vấn đề**, đính kèm PNG/PDF tổng hợp, mở danh sách, chi tiết và tải tệp. Kiểm tra trường bắt buộc, kiểu/kích thước tệp không hợp lệ, và trạng thái tải.
- [ ] Dùng Admin mở **Quản trị → Tài khoản** và **Báo cáo vấn đề**, kiểm tra danh sách/chi tiết và phân trang nếu có. Mở đúng issue QA và chuyển `needs_info`. Bên Analyst mở thông báo, quay lại issue, gửi bổ sung. Bên Admin kiểm tra cập nhật và chuyển `resolved`. Với Analyst, kiểm tra mục Quản trị không xuất hiện và không mở được route quản trị khi dán URL trực tiếp.
- [ ] Kiểm tra chuông, trang thông báo, bộ lọc, badge chưa đọc và liên kết tới issue. Đánh dấu một thông báo QA chưa đọc để thấy request `PATCH`; mở chi tiết để thấy `GET`. Nếu mở chi tiết đã tự đánh dấu đọc, dùng một thông báo QA khác để thử PATCH. Kiểm tra không thể xóa thông báo ở chế độ API hiện tại.

### E. Dọn dữ liệu và kiểm tra hồi quy UI

- [ ] Thực hiện theo thứ tự **feedback → dataset → Project → Workspace → tài khoản tạm**. Dùng đúng ID đã ghi khi tạo. Với dataset, kiểm tra upload lại trên Project QA còn trống, xóa `204` và bảo đảm UI về trạng thái chưa có dataset, Network không tiếp tục gọi schema/records trên ID cũ. Kiểm tra danh sách không chứa fixture đã xóa sau reload.
- [ ] Lặp kiểm tra nhanh ở màn hình desktop và màn hẹp: cuộn bảng, bàn phím Tab/Shift+Tab/Escape, focus khi đóng dialog, text dài, form hợp lệ/không hợp lệ, nút gửi khi đang tải, lỗi dễ hiểu, trạng thái trống và theme sáng/tối. Thử nút Back/Forward, reload, liên kết sâu và đường dẫn không tồn tại. Xem dự án 3D và trình xem CSV cục bộ nếu build QA có mục đó.

## 3. Ca cần Swagger, quyền riêng hoặc hỗ trợ backend

### Bổ sung: hàng đợi upload/sửa/xóa với API thật

- [ ] **Lỗi từng endpoint:** với Project QA đã READY, cho GET kết quả phân tích lần lượt trả 500/503, lỗi mạng hoặc timeout trong khi các API khác trả 200. Nếu có bản lưu thì cảnh báo đúng phần dữ liệu; nếu không thì module báo lỗi thực. Không có banner offline toàn hệ thống, nút Chạy phân tích vẫn được dùng theo quyền và POST phân tích thật trả 201.
- [ ] **Health lỗi riêng:** cho health trả 503 cùng lúc một endpoint khác bị timeout; profile có xác thực vẫn 200. Không khóa phân tích vì health. Nếu profile probe trả 401/403 thì ngừng đúng phiên và không dùng cache để che lỗi xác thực.
- [ ] **Không có hàng đợi:** tải Project/Data View, chặn toàn bộ API nhưng giữ navigator online rồi reload. Đọc đúng bản lưu, phân tích bị khóa, số yêu cầu chờ bằng 0. Bỏ chặn và không bấm Kết nối lại: tự xác minh lại phiên, bỏ banner backend và cho gọi phân tích thật.
- [ ] **Mạng hồi phục trước BE:** offline trình duyệt → reload production → vẫn xem bản lưu; bật mạng nhưng tiếp tục chặn API. UI vẫn báo chưa kết nối được backend và chưa cho chạy phân tích. Chỉ khi API thực sự hoạt động mới mở lại. Kiểm tra cả phiên hết hạn/đổi tài khoản trong lúc chờ, không phục hồi từ kết quả probe cũ.

- [ ] Mở và tải Workspace/Project QA khi online, giữ phiên còn hạn, đợi tải đầy đủ quyền thao tác (menu đã được bật). Chặn riêng origin API trong trình duyệt (máy vẫn online), đổi tên Project từ menu ở danh sách. UI phải báo chờ đồng bộ; server vẫn giữ tên cũ; IndexedDB `data-quality.offline-writes.v1/writes` có bản ghi `queued`. Đợi thông báo xác nhận đã lưu chờ/đóng dialog trước khi chuyển trang hoặc reload; bấm nút chưa đồng nghĩa transaction IndexedDB đã commit.
- [ ] Reload khi API vẫn bị chặn: bản lưu và hàng đợi còn nguyên. Bỏ chặn API, không bấm Kết nối lại. Trong lần tự thử tiếp theo (thường khoảng 10 giây khi tab hoạt động), phải có GET health, GET phiên bản rồi PATCH đúng `expectedVersion`. Sau ACK tên thật cập nhật, hàng đợi được dọn.
- [ ] Với Project QA chưa có dataset, ngắt API, chọn CSV tổng hợp rồi bấm Upload/Lưu chờ upload. Kiểm tra Blob có kích thước thật trong IndexedDB; reload vẫn còn. Nối lại API: đúng một multipart POST và file CSV gốc tải từ server khớp nội dung; nháp tương ứng được dọn sau ACK.
- [ ] Ngắt mạng trình duyệt, yêu cầu xóa dataset/Project/Workspace QA. UI báo chờ, dữ liệu server chưa bị xóa. Nối mạng, chờ DELETE thành công và kiểm tra lại danh sách/bản lưu sau reload.
- [ ] Sửa tên/mô tả Workspace theo cùng luồng. Thử hai sửa liên tiếp khi offline để xác minh gửi đúng thứ tự và phiên bản mới sau ACK. Thay đổi phiên bản ở client QA thứ hai trước khi đồng bộ: yêu cầu cũ phải dừng, không ghi đè.
- [ ] Mất phản hồi sau mutation: PATCH đối chiếu dữ liệu, DELETE đối chiếu 404, upload đối chiếu hash file gốc. Upload chưa xác định kết quả phải dừng để kiểm tra, không tự gửi lặp. Lỗi 401/403/409/422 không được retry vô hạn.
- [ ] Hết phiên/đăng xuất/đổi tài khoản: ngừng gửi và không hiện hàng đợi của tài khoản trước. Đăng nhập lại đúng tài khoản để tiếp tục. Mở hai tab cùng tài khoản: mutation chỉ gửi từ tab giữ Web Lock. Đóng ứng dụng không có đồng bộ nền; mở lại mới tiếp tục.
- [ ] Kiểm tra đầy dung lượng hoặc lỗi IndexedDB: không được báo đã lưu chờ và không gửi mutation khi chưa ghi được yêu cầu. Chạy AI/tạo PDF mới/đổi mật khẩu vẫn yêu cầu BE online.

- `GET /workspaces/{workspaceId}/projects` là fallback của frontend. Nếu UI chỉ gọi `/projects`, dùng Swagger **Try it out** với Workspace QA và ghi `DIRECT`. Không cần gây lỗi môi trường để ép fallback.
- `POST /analysis/jobs/{jobId}/result` là route nội bộ. Xác nhận cùng người phụ trách worker bằng job dùng một lần trên môi trường QA. Kết quả `404` với ID không tồn tại chỉ xác nhận ca âm tính. Không gửi kết quả giả vào job đang chạy hoặc job thật.
- Google callback cần OAuth thật. Gọi riêng không có code có thể trả `401`. Để xác nhận đầu cuối, cần backend trả callback HTTPS đúng và cấu hình Google Cloud Console khớp.
- Ba route `GET`/`POST /api/v1/projects/{projectId}/analysis/config` và `PATCH /api/v1/datasets/{id}/columns/pii` đã được rút có chủ đích. Kiểm tra Network không gọi chúng khi dùng UI; không chờ backend triển khai lại.
- UI hiện chưa có API tương ứng cho xóa thông báo, đổi vai trò thành viên Workspace ngoài luồng nhượng owner, đồng bộ yêu thích hoặc ảnh/biểu tượng Workspace, lưu trường Đơn vị, và tải CSV sau xử lý. Kiểm tra nút bị khóa hoặc UI hiển thị đúng giới hạn; ghi `N/A – chưa có API`. Tải CSV gốc và PDF là hai luồng riêng đã có API.

### Mẫu ghi kết quả

```text
Ngày/giờ · build frontend · URL backend · vai trò · mã ca
Thao tác và dữ liệu QA:
Method + Path · status thực tế · UI / DIRECT:
Mong đợi:
Quan sát trên UI và sau reload:
PASS / FAIL / BLOCKED / N/A · người phụ trách nếu cần:
```

Khi báo lỗi, đính kèm ảnh Network đã che cookie, token, mật khẩu, OTP, query OAuth và dữ liệu cá nhân. Ghi rõ `401` do phiên hết hạn (thử lại sau đăng nhập), `403` do quyền nếu là ca âm tính, `404` do fixture chưa có, và lỗi CORS/preflight nếu browser chưa gửi request nghiệp vụ.

## 4. Checklist 84 API

Mã dưới đây để đối chiếu khi chạy. Nếu Swagger hiện tại có contract mới, ghi mã thực tế và phiên bản. **UI** là thao tác qua DataVerse. **DIRECT** là Swagger hoặc kiểm tra cùng backend/worker. Với endpoint yêu cầu quyền, dùng đúng phiên cùng môi trường và không đưa token vào báo cáo.


### Hệ thống và tài khoản

- [ ] **API-01** `GET /health` · UI hoặc DIRECT: khi phiên hết hạn và UI chuẩn bị gia hạn; nếu chưa tạo được phiên hết hạn, mở /health trực tiếp · Mong đợi: 200 khi truy cập được · Thực tế: ___
- [ ] **API-02** `GET /health/ready` · UI: Cài đặt → System → Trạng thái hệ thống (đã nối) · Mong đợi: 200 khi sẵn sàng; 503 khi backend báo chưa sẵn sàng · Thực tế: ___
- [ ] **API-03** `GET /api/v1/users/me` · UI: Bootstrap/khôi phục hồ sơ hiện tại sau đăng nhập · Mong đợi: 200 · Thực tế: ___
- [ ] **API-04** `PATCH /api/v1/users/me` · UI: Settings → Hồ sơ cá nhân, lưu profile · Mong đợi: 200 · Thực tế: ___

- [ ] **API-05** `DELETE /api/v1/users/me` · UI: Cài đặt → Hồ sơ → Xóa tài khoản (thử với tài khoản tạm) · Mong đợi: 200 · Thực tế: ___

### Quản trị tài khoản

- [ ] **API-06** `GET /api/v1/admin/users` · UI: Quản lý → Quản trị → Tài khoản, danh sách user · Mong đợi: 200 · Thực tế: ___
- [ ] **API-07** `GET /api/v1/admin/users/{id}` · UI: Mở hồ sơ user trong trang quản trị · Mong đợi: 200 · Thực tế: ___

### Đăng nhập và phiên

- [ ] **API-08** `POST /api/v1/auth/register` · UI: Form đăng ký account · Mong đợi: 201 · Thực tế: ___
- [ ] **API-09** `POST /api/v1/auth/login` · UI: Form đăng nhập · Mong đợi: 200 · Thực tế: ___
- [ ] **API-10** `POST /api/v1/auth/refresh` · UI: Gia hạn phiên sau consent · Mong đợi: 200 · Thực tế: ___
- [ ] **API-11** `POST /api/v1/auth/forgot-password` · UI: Form quên mật khẩu, gửi OTP · Mong đợi: 200 · Thực tế: ___
- [ ] **API-12** `POST /api/v1/auth/reset-password` · UI: nhập OTP của tài khoản tạm, thử cả mã sai và mã hợp lệ · Mong đợi: 400 khi mã sai; 2xx khi đặt lại thành công · Thực tế: ___
- [ ] **API-13** `POST /api/v1/auth/change-password` · UI: Settings → Bảo mật → Đổi mật khẩu · Mong đợi: 200 · Thực tế: ___
- [ ] **API-14** `GET /api/v1/auth/google` · UI: Nút đăng nhập Google, bắt đầu OAuth redirect · Mong đợi: 302; kiểm tra redirect_uri · Thực tế: ___
- [ ] **API-15** `GET /api/v1/auth/google/callback` · UI: theo dõi chuỗi OAuth; DIRECT chỉ dùng bổ sung cho ca thiếu code · Mong đợi: callback hợp lệ chuyển về app; thiếu code có thể 401 · Thực tế: ___
- [ ] **API-16** `POST /api/v1/auth/logout` · UI: Menu account/đăng xuất, thu hồi session hiện tại · Mong đợi: 200 · Thực tế: ___
- [ ] **API-17** `GET /api/v1/auth/sessions` · UI: Settings → Đăng nhập & phiên, danh sách thiết bị · Mong đợi: 200 · Thực tế: ___
- [ ] **API-18** `GET /api/v1/auth/sessions/me` · UI: Chi tiết session hiện tại · Mong đợi: 200 · Thực tế: ___
- [ ] **API-19** `GET /api/v1/auth/sessions/{id}` · UI: Mở chi tiết một session · Mong đợi: 200 · Thực tế: ___
- [ ] **API-20** `DELETE /api/v1/auth/sessions/{id}` · UI: Thu hồi một session khác · Mong đợi: 200 · Thực tế: ___

### Workspace

- [ ] **API-21** `POST /api/v1/workspaces` · UI: Dialog Tạo Workspace · Mong đợi: 201 · Thực tế: ___
- [ ] **API-22** `GET /api/v1/workspaces` · UI: Bootstrap và danh sách Workspace · Mong đợi: 200 · Thực tế: ___
- [ ] **API-23** `GET /api/v1/workspaces/{id}` · UI: Mở chi tiết Workspace · Mong đợi: 200 · Thực tế: ___
- [ ] **API-24** `PATCH /api/v1/workspaces/{id}` · UI: Lưu thông tin Workspace · Mong đợi: 200 · Thực tế: ___
- [ ] **API-25** `DELETE /api/v1/workspaces/{id}` · UI: Xóa mềm Workspace sau xác nhận · Mong đợi: 204 · Thực tế: ___
- [ ] **API-26** `GET /api/v1/workspaces/{id}/members` · UI: Danh sách thành viên trong Workspace · Mong đợi: 200 · Thực tế: ___
- [ ] **API-27** `POST /api/v1/workspaces/{id}/members` · UI: Thêm thành viên Workspace · Mong đợi: 201 · Thực tế: ___
- [ ] **API-28** `DELETE /api/v1/workspaces/{id}/members/{userId}` · UI: Gỡ thành viên Workspace · Mong đợi: 200 · Thực tế: ___
- [ ] **API-29** `POST /api/v1/workspaces/{id}/transfer-owner` · UI: Chuyển quyền owner Workspace · Mong đợi: 201 · Thực tế: ___
- [ ] **API-30** `POST /api/v1/workspaces/{id}/leave` · UI: Rời Workspace · Mong đợi: 201 · Thực tế: ___

### Project

- [ ] **API-31** `POST /api/v1/workspaces/{workspaceId}/projects` · UI: Wizard Tạo Project trong Workspace · Mong đợi: 201 · Thực tế: ___
- [ ] **API-32** `GET /api/v1/workspaces/{workspaceId}/projects` · DIRECT nếu UI chạy nhánh /projects chính; dùng Workspace QA · Mong đợi: 200 · Thực tế: ___
- [ ] **API-33** `GET /api/v1/projects` · UI: Processing/Projects, danh sách Project toàn hệ thống · Mong đợi: 200 · Thực tế: ___
- [ ] **API-34** `GET /api/v1/projects/{id}` · UI: Mở Project overview · Mong đợi: 200 · Thực tế: ___
- [ ] **API-35** `PATCH /api/v1/projects/{id}` · UI: Cập nhật Project · Mong đợi: 200 · Thực tế: ___
- [ ] **API-36** `DELETE /api/v1/projects/{id}` · UI: Xóa mềm Project sau xác nhận · Mong đợi: 204 · Thực tế: ___
- [ ] **API-37** `PUT /api/v1/projects/{id}/snapshot` · UI: Hoàn tất Project/snapshot · Mong đợi: 200 · Thực tế: ___
- [ ] **API-38** `GET /api/v1/projects/{id}/members` · UI: Thành viên Project · Mong đợi: 200 · Thực tế: ___
- [ ] **API-39** `POST /api/v1/projects/{id}/members` · UI: Thêm thành viên Project · Mong đợi: 201 · Thực tế: ___
- [ ] **API-40** `PATCH /api/v1/projects/{id}/members/{userId}` · UI: Đổi role thành viên Project · Mong đợi: 200 · Thực tế: ___
- [ ] **API-41** `DELETE /api/v1/projects/{id}/members/{userId}` · UI: Gỡ thành viên Project · Mong đợi: 200 · Thực tế: ___
- [ ] **API-42** `POST /api/v1/projects/{id}/transfer-owner` · UI: Chuyển quyền owner Project · Mong đợi: 201 · Thực tế: ___

### Dataset và Data View

- [ ] **API-43** `POST /api/v1/projects/{projectId}/datasets/upload` · UI: Wizard upload CSV vào Project · Mong đợi: 201 · Thực tế: ___
- [ ] **API-44** `GET /api/v1/projects/{projectId}/datasets` · UI: Tải dataset của Project · Mong đợi: 200 · Thực tế: ___
- [ ] **API-45** `GET /api/v1/datasets/{id}` · UI: Đọc metadata dataset · Mong đợi: 200 · Thực tế: ___
- [ ] **API-46** `DELETE /api/v1/datasets/{id}` · UI: Xóa mềm dataset sau xác nhận · Mong đợi: 204 · Thực tế: ___
- [ ] **API-47** `GET /api/v1/datasets/{id}/file` · UI: Data View → Tải CSV gốc · Mong đợi: 200 · Thực tế: ___
- [ ] **API-48** `GET /api/v1/datasets/{id}/schema` · UI: Data View/Data Analysis, dựng cột và kiểu dữ liệu · Mong đợi: 200 · Thực tế: ___
- [ ] **API-49** `GET /api/v1/datasets/{datasetId}/records` · UI: Data View, tải trang bản ghi cursor · Mong đợi: 200 · Thực tế: ___
- [ ] **API-50** `POST /api/v1/datasets/{datasetId}/records/query` · UI: Data View, tìm kiếm/lọc/sắp xếp rồi Áp dụng · Mong đợi: 200 · Thực tế: ___
- [ ] **API-51** `GET /api/v1/datasets/{datasetId}/columns/{columnKey}/stats` · UI: Data View → Thống kê cột đã chọn · Mong đợi: 200 · Thực tế: ___
- [ ] **API-52** `GET /api/v1/datasets/{datasetId}/charts` · UI: Data View → Phân bố dữ liệu, thử cột số, phân loại và cột bị che · Mong đợi: 200 · Thực tế: ___

### Phân tích, AI, tổng kết và PDF

- [ ] **API-53** `POST /api/v1/projects/{projectId}/analysis` · UI: Project → Data Analysis → Chạy phân tích · Mong đợi: 201 · Thực tế: ___
- [ ] **API-54** `GET /api/v1/projects/{projectId}/analysis/result` · UI: Data Analysis → Tải kết quả · Mong đợi: 404 trước khi có kết quả; 200 sau khi có · Thực tế: ___
- [ ] **API-55** `GET /api/v1/analysis/jobs/{jobId}` · UI: Data Analysis → Xem trạng thái AI job · Mong đợi: 200 · Thực tế: ___
- [ ] **API-56** `POST /api/v1/analysis/jobs/{jobId}/retry` · UI: Data Analysis → Thử lại job · Mong đợi: 202 · Thực tế: ___
- [ ] **API-57** `POST /api/v1/analysis/jobs/{jobId}/result` · Nội bộ worker, **không gọi từ frontend hoặc thử mutation thủ công**. Ghi `N/A — worker`; nghiệm thu qua job thành công và kết quả đã lưu · Thực tế: ___
- [ ] **API-58** `POST /api/v1/projects/{projectId}/summary` · UI: Data Analysis → Tạo tổng kết · Mong đợi: 201 · Thực tế: ___
- [ ] **API-59** `GET /api/v1/projects/{projectId}/summary` · UI: Data Analysis → Tải tổng kết · Mong đợi: 200 · Thực tế: ___
- [ ] **API-60** `POST /api/v1/projects/{projectId}/report` · UI: Data Analysis → Yêu cầu PDF · Mong đợi: 202 · Thực tế: ___
- [ ] **API-61** `GET /api/v1/projects/{projectId}/report/{reportId}/file` · UI: Data Analysis → Tải PDF/poll trạng thái · Mong đợi: 202 khi chờ; 200 và mở được PDF khi hoàn tất · Thực tế: ___

### Thông báo

- [ ] **API-62** `GET /api/v1/notifications` · UI: Chuông/trang thông báo, danh sách cá nhân · Mong đợi: 200 · Thực tế: ___
- [ ] **API-63** `GET /api/v1/notifications/unread-count` · UI: Badge số thông báo chưa đọc · Mong đợi: 200 · Thực tế: ___
- [ ] **API-64** `GET /api/v1/notifications/{id}` · UI: Mở chi tiết thông báo · Mong đợi: 200 · Thực tế: ___
- [ ] **API-65** `PATCH /api/v1/notifications/{id}/read` · UI: Đánh dấu thông báo đã đọc · Mong đợi: 200 · Thực tế: ___
- [ ] **API-66** `PATCH /api/v1/users/me/notification-preferences` · UI: Settings thông báo, bật/tắt nhận · Mong đợi: 200 · Thực tế: ___

### Issue và quản trị issue

- [ ] **API-67** `POST /api/v1/issues` · UI: Gửi báo cáo vấn đề từ UI · Mong đợi: 201 · Thực tế: ___
- [ ] **API-68** `GET /api/v1/issues` · UI: Danh sách báo cáo vấn đề của user · Mong đợi: 200 · Thực tế: ___
- [ ] **API-69** `POST /api/v1/issues/{id}/attachments` · UI: Upload file đính kèm issue · Mong đợi: 201 · Thực tế: ___
- [ ] **API-70** `GET /api/v1/issues/{id}/attachments/{attachmentId}` · UI: Tải file đính kèm issue · Mong đợi: 200 · Thực tế: ___
- [ ] **API-71** `GET /api/v1/issues/{id}` · UI: Mở chi tiết issue của user · Mong đợi: 200 · Thực tế: ___
- [ ] **API-72** `PATCH /api/v1/issues/{id}` · UI: Sửa issue khi backend cho phép · Mong đợi: 200 · Thực tế: ___
- [ ] **API-73** `GET /api/v1/admin/issues` · UI: Quản trị → Báo cáo vấn đề, danh sách · Mong đợi: 200 · Thực tế: ___
- [ ] **API-74** `GET /api/v1/admin/issues/{id}` · UI: Quản trị → Chi tiết issue · Mong đợi: 200 · Thực tế: ___
- [ ] **API-75** `PATCH /api/v1/admin/issues/{id}/status` · UI: Quản trị → Cập nhật trạng thái issue · Mong đợi: 200 · Thực tế: ___

### Feedback và tổng quan

- [ ] **API-76** `POST /api/v1/analyses/{analysisId}/findings/{findingId}/feedback` · UI: Data Analysis → Gửi feedback cho finding · Mong đợi: 201 · Thực tế: ___
- [ ] **API-77** `GET /api/v1/analyses/{analysisId}/findings/{findingId}/feedback` · UI: Data Analysis → Xem feedback finding · Mong đợi: 200 · Thực tế: ___
- [ ] **API-78** `POST /api/v1/analyses/{analysisId}/feedback` · UI: Data Analysis → Gửi feedback lần chạy · Mong đợi: 201 · Thực tế: ___
- [ ] **API-79** `GET /api/v1/analyses/{analysisId}/feedback` · UI: Data Analysis → Xem feedback lần chạy · Mong đợi: 200 · Thực tế: ___
- [ ] **API-80** `PATCH /api/v1/feedback/{id}` · UI: Data Analysis → Cập nhật feedback · Mong đợi: 200 · Thực tế: ___
- [ ] **API-81** `DELETE /api/v1/feedback/{id}` · UI: Data Analysis → Xóa feedback · Mong đợi: 200 · Thực tế: ___
- [ ] **API-82** `GET /api/v1/projects/{projectId}/ai-quality-metrics` · Route có trong hợp đồng; bản UI mới chưa có consumer hiển thị metrics này. Chỉ kiểm tra backend nếu cần nghiệm thu riêng, không thêm nút để lấp inventory · Thực tế: ___
- [ ] **API-83** `GET /api/v1/overview/workspaces` · UI: Home/Activity Overview, tổng quan workspace của user · Mong đợi: 200 · Thực tế: ___
- [ ] **API-84** `GET /api/v1/workspaces/{id}/overview` · UI: Workspace Detail, cards và phân bố trạng thái · Mong đợi: 200 · Thực tế: ___

### Kiểm tra loại bỏ chức năng đã rút

- [ ] Mở Data Analysis và chạy phân tích: không gửi GET/POST `analysis/config`, không có chọn cột/vai trò cột, không có nút lưu/tải cấu hình. Bốn tham số phương pháp đi trong POST chạy phân tích · Thực tế: ___
- [ ] Mở Data View: PII chỉ là nhãn đọc; không có nút bật/tắt và không gửi PATCH `columns/pii`. Cột masked không lộ giá trị ở Top N · Thực tế: ___
- [ ] OTP: khi nhận `429`, nút gửi bị khóa theo `Retry-After`, không tự retry; hết thời gian mới cho thử lại · Thực tế: ___

## Kiểm tra bổ sung: file nháp và dữ liệu ngoại tuyến

Dùng tài khoản và dữ liệu QA được phép. Để thử refresh khi mất mạng, dùng bản production (`npm run build`, `npm run preview`) trên HTTPS hoặc localhost; Vite dev không đăng ký service worker. Giữ tab/phiên đăng nhập còn hạn. Mỗi trang, bộ lọc và tệp chỉ có bản lưu sau khi đã tải thành công khi có mạng.

1. Project chưa có dataset → Upload data → chọn CSV hợp lệ → đợi “Đã lưu file nháp”. Đóng/mở lại hộp thoại hoặc reload → khôi phục đúng tên và nội dung file. Bỏ nháp → mở lại không còn file đó.
2. Wizard tạo Project → Import Dataset → chọn CSV → đóng/mở lại, chọn cùng Workspace → khôi phục nháp. Nếu Project đã được tạo nhưng upload lỗi, khôi phục và tiếp tục đúng tên Project; kiểm tra không gửi POST tạo thêm Project.
3. Cho upload thất bại → file nháp vẫn tồn tại. Cho upload thành công → đợi ACK có dataset ID → nháp được dọn. Nếu chỉ tải lại danh sách thất bại sau upload, UI không yêu cầu gửi lại file đã được máy chủ nhận.
4. Khi có mạng, xem danh sách Project, mở Project và Data View, mở Data Analysis, tải một PDF hoàn chỉnh. Chờ lưu xong; trong DevTools → Application kiểm tra service worker đã active và IndexedDB có bản đọc.
5. DevTools → Network → Offline → reload. Ứng dụng mở lại, có banner ngoại tuyến và thời điểm bản lưu; danh sách Project, trang bản ghi và kết quả đã xem vẫn đọc được. Mở trang/bộ lọc chưa tải → thông báo chưa có dữ liệu trên thiết bị.
6. Trong Data Analysis → Tổng kết và PDF → chọn “PDF đã lưu trên thiết bị” → tải PDF khi đang Offline. PDF mới còn HTTP 202 hoặc job failed không được xuất hiện trong danh sách bản hoàn chỉnh.
7. Khi Offline, sửa tên/mô tả, xóa hoặc upload CSV vào Project có sẵn → báo chờ đồng bộ và có yêu cầu bền vững trong IndexedDB, không báo đã lưu lên server. Bật mạng → tự đồng bộ các yêu cầu hỗ trợ, đọc dữ liệu thật và dọn hàng đợi sau ACK. Tạo Project/Workspace mới, chạy AI và các nghiệp vụ ngoài allowlist vẫn cần kết nối.
8. Đăng xuất tài khoản A, đăng nhập B → B không thấy dữ liệu hoặc nháp của A. Cache đọc của A được dọn; đăng nhập lại A còn hạn mới được khôi phục nháp của A. Xác minh 401/403/404 từ server không bị thay bằng cache.

Ca tự động `tests/e2e/api/analysis-offline.spec.ts` kiểm tra nguồn dữ liệu ở runtime mới: chỉ thay bản ghi tổng hợp của chính ca test trong IndexedDB bằng marker, reload và xác nhận marker xuất hiện khi offline; có đếm các lệnh đọc IndexedDB native. Ca còn chặn riêng API trong khi `navigator.onLine` vẫn true để kiểm tra fallback lỗi mạng. Khi nối lại, giá trị gốc từ server phải thay marker. API HTTP không được mock trong ca E2E này; ca production dùng HTTP mô phỏng được ghi riêng trong báo cáo.

Ghi rõ URL QA, kết quả thực tế và dữ liệu thử đã dọn. Tách ca dùng HTTP giả khỏi ca chạy server thật; riêng worker AI, OTP, Google OAuth và quyền Admin cần đủ hạ tầng/tài khoản mới kết luận đầu cuối.
