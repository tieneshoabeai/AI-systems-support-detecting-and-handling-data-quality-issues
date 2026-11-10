# 6. Xác thực, phân quyền và bảo vệ dữ liệu

- **Version:** v2
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-04
- **Trạng thái:** Mô hình vai trò nghiệp vụ đã được xác nhận; v2 bổ sung ma trận quyền mới (thao tác sửa ô, bằng chứng mức ô, thử lại AI, đọc file gốc, job AI) và ranh giới dữ liệu gửi ra ngoài. Thiết kế kỹ thuật (guard, token, secret) còn chờ thảo luận ở phần 8–9.
- **Giai đoạn:** Tech solution
- **Thứ tự thực hiện:** Phần 6; sử dụng kết quả đã xác nhận của các phần trước.

## 1. Mục tiêu

Làm rõ và thống nhất xác thực, phân quyền và bảo vệ dữ liệu cho đợt tái cấu trúc backend.

## 2. Nội dung cần bàn luận

- Vai trò hệ thống, vai trò workspace, phạm vi truy cập và ma trận quyền theo use case.
- Chính sách đăng ký/cấp quyền admin, session, refresh và thu hồi quyền.
- Validation, bảo vệ dữ liệu nhạy cảm, log, giới hạn truy cập và quản lý secrets.
- Security implication và các tình huống truy cập trái phép cần kiểm thử.

## 3. Quyết định và thiết kế chi tiết

Mô hình vai trò bên dưới đã được người dùng xác nhận; chưa chốt toàn bộ quyền thao tác hoặc giải pháp kỹ thuật.

### Đầu vào thảo luận quyền workspace/project

- Workspace chỉ có Owner và Member. Chỉ Workspace Owner được tạo project và chỉ định người làm Project Owner cũng như các Member của project. Quy tắc này thay thế mô tả trước về Member được tạo project.
- Project có Owner, Member và Viewer. Workspace Member mặc định là Viewer trong tất cả project; Project Owner có thể cấp quyền Member cho họ trong project mình quản lý.
- Mỗi project chỉ có một Project Owner. Quyền quản trị của Workspace Owner không tạo thêm một Project Owner thứ hai.
- Project Owner được quản lý toàn bộ thành viên của project và tự chuyển quyền Owner cho người khác.
- Khi Workspace Owner chỉ định người khác làm Project Owner, Project Owner cũ chuyển thành Viewer trong project đó.
- Khi Project Owner tự chuyển quyền Owner cho người khác, Project Owner cũ chuyển thành Member trong project đó. Sau chuyển quyền, project vẫn chỉ có một Owner. Vai trò ở project không làm mất quyền quản trị của người đồng thời là Workspace Owner.
- Khi Project Owner thu hồi quyền Project Member của người vẫn là Workspace Member, người đó trở về Project Viewer, không bị chặn truy cập project. Vai trò Workspace Member không thay đổi; workspace không có vai trò Viewer.
- Đối chiếu mã nguồn: workspace schema hiện dùng `owner/editor/viewer`; project schema có `created_by`, chưa có danh sách vai trò project riêng. Không đồng nhất người tạo với quyền Owner đã được thực thi đầy đủ.
- Workspace Owner vẫn có toàn quyền với dữ liệu và thành viên của mọi project trong workspace sau khi chỉ định Project Owner khác.
- Project Member được xóa dòng trên dữ liệu làm việc, chọn cột/nhãn, Reset Dataset, chạy phân tích và lưu trạng thái project. Quyền này không bao gồm quản lý thành viên.
- Project Viewer được xem Data Views và sử dụng bộ lọc; vẫn được xem kết quả đã lưu tại Data Analysis & Detection và Tổng kết. Viewer không được thao tác các tính năng bên trong hai phần này, tạo/chạy lại phân tích hoặc Tổng kết, thay đổi dữ liệu hay lưu trạng thái project. Mở hai phần này với quyền Viewer không được kích hoạt chạy phân tích/Tổng kết; nếu chưa có kết quả thì không tạo mới thay cho Viewer.
- Workspace Owner, Project Owner và Project Member được nhập/chỉnh sửa tên cột rỗng/trùng trên dữ liệu làm việc; Viewer chỉ xem cảnh báo, không được sửa tên cột. Sau Reset Dataset, tên gốc và cảnh báo được khôi phục theo phần 2, mục 3.12; phải sửa tên rỗng/trùng trước khi phân tích.
- Viewer chỉ xem biểu đồ theo cấu hình đã lưu; không được đổi N của Top N hoặc thay đổi cấu hình biểu đồ.
- Khi đã có bản lưu mới, từ chối yêu cầu lưu dựa trên bản cũ, thông báo có bản mới và yêu cầu tải lại trước khi tiếp tục. Không cho ghi đè bản mới từ trạng thái cũ; quy tắc nghiệp vụ được ghi đồng bộ tại phần 2, mục 3.19. Cơ chế kỹ thuật chưa chốt.
- Khi Workspace Owner xóa một người khỏi workspace mà người đó đang là Project Owner, Workspace Owner tiếp quản vai trò Project Owner của các project đó; mỗi project vẫn chỉ có một Owner. Đây là trường hợp loại khỏi workspace, khác với chỉ định lại Owner khi người cũ vẫn còn trong workspace.
- Người bị xóa khỏi workspace mất toàn bộ quyền truy cập các project trong workspace đó, bất kể vai trò project trước đó; không chuyển thành Project Viewer.
- Workspace Member được tự rời workspace. Khi rời, người đó mất toàn bộ quyền truy cập các project thuộc workspace; nếu đang là Project Owner, Workspace Owner tiếp quản các project đó.
- Workspace Owner muốn rời workspace phải chuyển quyền Workspace Owner cho người khác trước khi rời; không được rời khi chưa hoàn tất chuyển quyền. Khi người cũ rời, áp dụng quy tắc thu hồi quyền và tiếp quản project đã chốt, với Workspace Owner mới là người tiếp quản.
- Yêu cầu lưu tại Tổng kết và khôi phục lần lưu cuối cùng được ghi ở phần 2, mục 3.19. Chưa triển khai phân quyền hoặc cơ chế lưu.

### Ma trận quyền bổ sung ở v2

| Hành động | Workspace Owner | Project Owner | Project Member | Project Viewer |
| --- | --- | --- | --- | --- |
| Xem Data Views, lọc, sắp xếp, tìm kiếm | Có | Có | Có | Có |
| Xem kết quả phân tích đã lưu và bằng chứng mức ô | Có | Có | Có | Có |
| Sửa ô trên dữ liệu làm việc | Có | Có | Có | Không |
| Nhập/đổi tên cột rỗng/trùng | Có | Có | Có | Không (chỉ xem cảnh báo) |
| Xóa dòng, Reset Dataset | Có | Có | Có | Không |
| Chạy phân tích, tạo Tổng kết | Có | Có | Có | Không |
| Thử lại AI (khi AI lỗi) | Có | Có | Có | Không |
| Lưu trạng thái project | Có | Có | Có | Không |
| Tải báo cáo PDF | Có | Có | Có | Có (ngoại lệ đã xác nhận) |
| Quản lý thành viên project | Có | Có | Không | Không |
| Quản lý workspace | Có | Không | Không | Không |

- Quyền **thử lại AI** thuộc người có quyền chạy phân tích, vì thao tác này dùng lại kết quả phân tích hệ thống đã có; không mở quyền cho Viewer.
- Quyền **xem bằng chứng mức ô** bám theo quyền xem kết quả phân tích đã lưu; bằng chứng không phải dữ liệu nguyên bản của file, nên Viewer vẫn xem được.
- Quyền **sửa ô** bám theo nhóm quyền thao tác dữ liệu của Project Member; sửa ô không ghi đè file gốc nên vẫn nằm trong ranh giới an toàn của file gốc.

### Ranh giới dữ liệu gửi ra ngoài (bổ sung ở v2)

- Dữ liệu rời hệ thống qua Gemini API chỉ gồm: thống kê tổng hợp và **tối đa 20 ô lỗi/cột đã che PII**. Che PII là điều kiện bắt buộc; không che được thì chỉ gửi thống kê tổng hợp.
- **Gemini Free Tier dùng nội dung prompt/phản hồi để cải thiện sản phẩm, dữ liệu nằm ngoài EU/UK/EEA.** Đây là điều kiện vận hành đã được người dùng chấp nhận và phải được ghi rõ trong tài liệu bàn giao cũng như hiển thị trong tài liệu về dữ liệu của hệ thống.
- Không gửi file gốc, không gửi toàn bộ tập bản ghi, không gửi ảnh chụp màn hình lỗi ra ngoài.
- Log của hệ thống không được ghi nguyên giá trị ô lỗi chưa che; chỉ ghi định danh cột, số dòng gốc và mã lỗi.
- Job AI chạy nền trong API process; job không được mang theo bí mật hệ thống, chỉ mang tham chiếu tới kết quả phân tích đã lưu.

- Viewer được tải báo cáo PDF từ nội dung có quyền xem, là ngoại lệ cụ thể đối với giới hạn thao tác ở Tổng kết. Quyền tải không cho phép chạy phân tích, tạo Tổng kết mới hoặc lưu project. Người có quyền làm việc được xuất Tổng kết hiện tại ra PDF mà không cần lưu project trước; chi tiết tại phần 2, mục 3.20.

## 4. Đầu vào và đầu ra

- **Đầu vào:** Yêu cầu người dùng, kết quả các phần trước và mã nguồn/tài liệu hiện trạng liên quan.
- **Đầu ra:** Hoàn thiện kế hoạch lần đầu trong file v1, cập nhật v2; ghi rõ quyết định, lý do, phương án khác, trade-off, rủi ro, giới hạn và ảnh hưởng liên quan.

## 5. Điều kiện hoàn tất phần này

Chính sách quyền và bảo vệ dữ liệu được xác nhận trước implementation.

**Trạng thái v2:** mô hình vai trò và ma trận quyền thao tác đã chốt. Các câu hỏi còn mở tại mục 6.2 cần chốt trước khi thiết kế guard và API ở phần 8–9.

## 6. Câu hỏi và phụ thuộc còn mở (v2)

### 6.1. Đã chốt ở v2

- **Quyền sắp xếp/tìm kiếm:** thuộc thao tác xem tại Data Views của Viewer (xem mục 3.7 ở phần 2).
- **Quyền thao tác sửa ô:** theo vai trò thao tác dữ liệu tại mục 3.7 của phần 2 (xem mục 3.8 v2 của phần 2).
- **Quyền xem bằng chứng mức ô:** theo quyền xem kết quả phân tích đã lưu.
- **Quyền thử lại AI:** người có quyền chạy phân tích.
- **Quyền tải báo cáo PDF:** đã xác nhận ở v1 (Viewer được tải).

### 6.2. Còn mở

1. Quyền tải **file dữ liệu gốc** (file `.xlsx`/`.csv` đã upload) — chưa chốt. Đề xuất: chỉ Workspace Owner/Project Owner/Member, không cho Viewer tải file gốc vì tải file gốc đồng nghĩa bypass mọi xóa dòng/đổi tên cột đã làm trên dữ liệu làm việc.
2. Quyền xuất **dữ liệu đã xử lý** (CSV/JSON kết quả) — chưa chốt.
3. Quyền đổi tên / xóa / archive **project** — chưa chốt.
4. Quyền xem **lịch sử job AI** và log lỗi AI — chưa chốt (đề xuất theo quyền phân tích, không chứa dữ liệu nguyên bản trong log).
5. Quyền **xóa bằng chứng** / dọn dữ liệu theo hạn mức lưu trữ — chưa chốt.
6. Cơ chế **thu hồi token** và thời hạn phiên — chưa chốt (mục 3.6 v2 đã nêu cơ chế kỹ thuật chưa chốt).
7. Chính sách **đăng ký / admin cấp quyền** — chưa chốt.
8. Có cần **2FA / xác thực bước hai** cho Workspace Owner không — chưa chốt.

### 6.3. Phụ thuộc bên ngoài

- `GEMINI_API_KEY` là secret cấu hình ở môi trường chạy, không nằm trong repo; adapter AI phải fail an toàn khi thiếu key.
- Khóa S3/R2 cho port Storage là secret cấu hình ở môi trường chạy.
- Chính sách quyền cần được ánh xạ vào guard của NestJS ở phần 9; chưa triển khai.

## 7. Prompting log và lịch sử thay đổi

- **Xác nhận v2 / 2026-11-04:** Chặn phân tích cho tới khi hết lỗi tên cột rỗng/trùng của sheet đang làm việc; Viewer chỉ xem cảnh báo / Theo lựa chọn `block` / Đồng bộ quyền sửa tên cột với phần 2 mục 3.2.
- **Xác nhận v2 / 2026-11-04:** Sửa ô giữ trong backend mới với quy tắc `keep` + `warn_only`; thao tác sửa ô thuộc nhóm quyền thao tác dữ liệu của Project Member / Theo lựa chọn `in_new_backend` / Bổ sung dòng sửa ô vào ma trận quyền.
- **Xác nhận v2 / 2026-11-04:** Bằng chứng ở mức ô lưu collection riêng; quyền xem bằng chứng bám theo quyền xem kết quả phân tích đã lưu / Theo lựa chọn `cell_level` + `separate_collection` / Bổ sung vào ma trận quyền.
- **Xác nhận v2 / 2026-11-04:** Thử lại AI thuộc quyền chạy phân tích; AI chạy bất đồng bộ qua job table MongoDB / Theo lựa chọn `async_job` + `mongo_job` / Bổ sung dòng thử lại AI vào ma trận quyền.
- **Xác nhận v2 / 2026-11-04:** Gemini Free Tier dùng prompt để cải thiện sản phẩm ngoài EU; người dùng chấp nhận và yêu cầu ghi rõ trong tài liệu bàn giao / Theo lựa chọn `gemini` / Bổ sung mục ranh giới dữ liệu gửi ra ngoài.
- **Xác nhận v2 / 2026-11-04:** Che PII bắt buộc trước khi gọi API ngoài; tối đa 20 ô lỗi/cột / Theo lựa chọn `send_sample_masked` / Đồng bộ ranh giới dữ liệu gửi ra ngoài với phần 2 mục 3.31.3.
- **Xác nhận v2 / 2026-11-04:** Cấu hình S3/R2 và `GEMINI_API_KEY` là secret ở môi trường chạy; adapter fail an toàn khi thiếu key / Theo thiết kế port Storage và AI / Bổ sung phụ thuộc bên ngoài ở mục 6.3.
- **Xác nhận v1 / 2026-11-04:** Workspace Owner, Project Owner và Project Member được sửa tên cột; Viewer chỉ xem cảnh báo / Theo xác nhận người dùng / Đồng bộ quyền với phần 2 và quy tắc khôi phục tên/cảnh báo khi Reset, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Viewer xem biểu đồ theo cấu hình đã lưu, không được đổi N / Theo xác nhận người dùng / Làm rõ quyền xem biểu đồ, đồng bộ phần 2; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Viewer được tải báo cáo PDF / Theo xác nhận người dùng / Bổ sung quyền tải báo cáo, giữ giới hạn phân tích và lưu; đồng bộ phần 2, chưa sửa backend.
- **Làm rõ v1 / 2026-11-03:** Viewer được xem kết quả đã lưu ở Data Analysis & Detection và Tổng kết nhưng không thao tác tính năng bên trong / Theo đính chính người dùng / Phân biệt quyền xem với quyền thực thi; mở phần xem không được kích hoạt phân tích hoặc Tổng kết, chưa sửa backend.
- **Tinh chỉnh v1 / 2026-11-03:** Viewer xem Data Views và lọc, không thao tác/tạo phân tích ở Data Analysis & Detection và Tổng kết / Theo làm rõ của người dùng / Thay mô tả chỉ xem bản lưu; còn xác nhận phạm vi với kết quả đã lưu và thao tác xem khác, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Workspace Owner phải chuyển quyền workspace cho người khác trước khi rời / Người dùng đồng ý / Bổ sung điều kiện rời của Owner, áp dụng quy tắc thu hồi quyền và tiếp quản project bởi Workspace Owner mới; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Workspace Member được tự rời workspace, mất quyền truy cập các project và chuyển các project đang sở hữu cho Workspace Owner / Người dùng đồng ý / Áp dụng cùng quy tắc thu hồi quyền và tiếp quản như khi bị loại; chưa chốt trường hợp Workspace Owner tự rời.
- **Xác nhận v1 / 2026-11-03:** Người bị xóa khỏi workspace mất toàn bộ quyền truy cập các project thuộc workspace đó / Theo xác nhận người dùng / Chốt phạm vi thu hồi quyền, không giữ quyền Viewer; các project họ sở hữu do Workspace Owner tiếp quản theo quy tắc đã chốt.
- **Xác nhận v1 / 2026-11-03:** Workspace Owner tiếp quản Project Owner khi người giữ vai trò này bị xóa khỏi workspace / Theo trả lời người dùng / Chốt người tiếp quản, duy trì một Owner mỗi project; phạm vi thu hồi truy cập và tự rời workspace còn cần làm rõ.
- **Xác nhận v1 / 2026-11-03:** Thu hồi quyền Project Member thì trở về Project Viewer nếu người đó vẫn là Workspace Member / Theo xác nhận người dùng / Chốt hành vi hạ quyền trong project, không thay đổi vai trò workspace và không chặn quyền xem mặc định.
- **Xác nhận v1 / 2026-11-03:** Workspace Owner chỉ định lại thì Project Owner cũ thành Viewer; Project Owner tự chuyển quyền thì trở thành Member / Theo quy tắc người dùng / Chốt hai luồng chuyển quyền, duy trì một Project Owner và quyền quản trị workspace đã xác nhận; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Mỗi project chỉ có một Project Owner / Theo lựa chọn người dùng / Chốt số lượng Owner; giữ quyền quản trị đã xác nhận của Workspace Owner, còn làm rõ chuyển quyền và vai trò Owner cũ.
- **Xác nhận v1 / 2026-11-03:** Từ chối lưu bản lỗi thời và yêu cầu tải lại khi có người đã lưu bản mới / Theo lựa chọn người dùng / Bảo vệ bản lưu hiện hành khỏi bị ghi đè từ bản cũ; chưa thiết kế cơ chế kiểm soát đồng thời.
- **Xác nhận v1 / 2026-11-03:** Workspace Owner giữ toàn quyền sau khi giao project; Project Member được thao tác dữ liệu, phân tích và lưu; Viewer chỉ xem bản lưu và thao tác hiển thị / Theo xác nhận người dùng / Chốt nhóm quyền thao tác chính, chưa triển khai guard hoặc API; còn chính sách lưu đồng thời và thu hồi quyền.
- **Xác nhận v1 / 2026-11-03:** Workspace chỉ có Owner/Member, chỉ Owner tạo và phân công project; project có Owner/Member/Viewer, Workspace Member mặc định Viewer và Project Owner quản lý thành viên / Theo quyết định người dùng / Thay mô hình trước, cần điều chỉnh schema và ma trận quyền ở các bước sau; chưa sửa backend.
- **Bổ sung v1 / 2026-11-03:** Ghi nhận câu hỏi quyền workspace/project và quyền lưu trạng thái / Theo yêu cầu thảo luận của người dùng / Chưa phê duyệt chính sách hoặc chuyển sang implementation.
- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 6 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.

