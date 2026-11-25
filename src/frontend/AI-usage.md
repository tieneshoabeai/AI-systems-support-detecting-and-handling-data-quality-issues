# AI Usage Policy

Áp dụng cho nhóm phát triển frontend của dự án **AI-systems-support-detecting-and-handling-data-quality-issues** — **Hệ thống AI hỗ trợ phát hiện và xử lý vấn đề về chất lượng dữ liệu**, bao gồm công việc học tập, lập kế hoạch, viết code, kiểm thử và báo cáo có AI hỗ trợ. Tài liệu này không thay yêu cầu của giảng viên, nhà trường hoặc quy định bảo vệ dữ liệu áp dụng cho dự án.

Phân biệt **AI dùng hỗ trợ phát triển dự án** trong tài liệu này với **phân hệ AI phát hiện/gợi ý xử lý dữ liệu của sản phẩm**. Việc nhóm sử dụng AI để lập plan hoặc viết code không có nghĩa phân hệ AI sản phẩm đã được triển khai.

## 1. Purpose

AI là công cụ hỗ trợ học và làm việc, không thay người dùng quyết định yêu cầu hoặc chịu trách nhiệm về kết quả. Mục tiêu là hiểu code, kiểm chứng được thay đổi và khai báo trung thực phạm vi AI tham gia.

Áp dụng cho cả hai thành viên FE, các task AI và nội dung dự kiến commit/nộp bài. Khi quy định môn học chưa rõ về AI, phải hỏi người phụ trách trước khi sử dụng cho phần có ảnh hưởng đến đánh giá.

## 2. Permitted AI Usage

Được dùng AI trong phạm vi đã được cho phép để:

- Làm rõ yêu cầu, đề xuất phương án và giải thích trade-off.
- Đọc code, giải thích từng bước, dò vết bằng ví dụ nhỏ và hỗ trợ học kiến thức.
- Đề xuất architecture, screen flow, component contract, pseudocode và test case.
- Hỗ trợ viết hoặc sửa code trong batch đã duyệt, bằng công cụ patch/edit có thể review.
- Phân tích lỗi từ thông tin đã được loại bỏ dữ liệu nhạy cảm.
- Hỗ trợ tài liệu/báo cáo, với điều kiện nội dung được người dùng kiểm tra.

Chỉ đưa source hoặc tài liệu mà nhóm có quyền chia sẻ với dịch vụ AI. Nội dung được phép đọc tại máy không tự động có nghĩa được phép gửi cho bên ngoài.

## 3. Prohibited AI Usage

**Cấm commit `.env`, token hoặc secrets. Cấm đưa API key, password và dữ liệu nhạy cảm vào prompt.**

Các hành vi không được phép khác:

- Gửi access/refresh token, session cookie, private key, connection string chứa credential hoặc dữ liệu cá nhân thật cho AI.
- Làm lộ dữ liệu qua screenshot, log, file upload, code comment, test fixture hoặc URL có query secret.
- Dùng code AI tạo mà không hiểu, không review hoặc khai báo như hoàn toàn tự viết khi điều đó không đúng.
- Để AI tự đặt business logic, endpoint hoặc response field còn thiếu rồi coi là contract đã được xác nhận.
- Bịa nguồn, kết quả test, benchmark, số liệu mô hình, ảnh minh chứng hoặc tuyên bố API đã chạy khi chưa thực thi.
- Tự mở rộng phạm vi, cài dependency, thay architecture hoặc thực hiện hành động ngoài batch được duyệt.
- Dùng AI để vượt yêu cầu môn học, làm bài đánh giá bị cấm dùng AI hoặc che giấu nguồn hỗ trợ.

## 4. Data Privacy & Security

- Không đọc/in nội dung `.env` vào chat hoặc tài liệu. Khi thảo luận config chỉ nhắc tên biến và chức năng; không đưa giá trị secret.
- Dùng dữ liệu giả, tổng hợp hoặc mẫu đã được ẩn danh và được phép chia sẻ. Loại credential, định danh cá nhân và metadata nhạy cảm trước khi gửi.
- Đổi tên biến hoặc che vài ký tự không bảo đảm đã ẩn danh đầy đủ. Nếu chưa chắc dữ liệu có được gửi hay không, dừng và hỏi người chịu trách nhiệm.
- Secret backend phải ở phía backend. Không đưa JWT secret, database credential hoặc API key bí mật vào browser bundle; prefix `VITE_` không bảo vệ bí mật.
- Không ghi credential vào README, AI disclosure, prompt/log, issue/PR, screenshot hoặc test output. Không dùng secret thật làm ví dụ.
- Chỉ thao tác API/dữ liệu trong môi trường và phạm vi được phép; không dùng tài khoản hoặc dataset thật để thử sửa/xóa khi chưa được duyệt.

## 5. Code Review & Verification

Trước implementation, xác định yêu cầu, input/output, giới hạn, giải pháp, rủi ro và plan; chờ xác nhận theo rules dự án. Sau khi được duyệt:

1. Dùng patch/edit tích hợp để thay đổi có thể review; không tự ghi đè source bằng script.
2. Đọc diff và giải thích được code trọng tâm, caller, dữ liệu vào/ra và tác dụng phụ.
3. Kiểm tra contract thực tế: đọc DTO phù hợp trước; response chưa có DTO thì đối chiếu service/schema và runtime được phép.
4. Review happy path, invalid input, edge case, lỗi, phân quyền, race condition và nguy cơ lộ dữ liệu trong phạm vi thay đổi.
5. Mở review diff để human kiểm tra trước khi chấp nhận.

Không xóa mã nghi không dùng chỉ vì AI không tìm thấy caller. Kiểm tra export, dynamic usage và các nơi sử dụng; ghi tình trạng cần xử lý và nhắc lại khi quay lại file liên quan.

## 6. Human Responsibility

- Người sử dụng chịu trách nhiệm về yêu cầu, giải pháp, code chấp nhận và nội dung nộp.
- Chỉ chấp nhận phần mình hiểu và có thể giải thích. Nếu chưa hiểu, yêu cầu walkthrough bằng một ví dụ cụ thể.
- Hai thành viên chỉ định owner/reviewer cho từng batch; file dùng chung có một owner tại một thời điểm.
- Review chéo không thay quyền quyết định cuối cùng của người phụ trách hoặc phân quyền thật của backend.
- Không đổ lỗi cho AI khi kết quả sai. Phải kiểm tra, sửa và ghi nhận giới hạn bằng chứng.

## 7. Academic Integrity

- Tuân thủ quy định môn học về dùng AI và trích dẫn; không tự giả định mọi hình thức hỗ trợ đều được phép.
- Phân biệt phần tự thực hiện, phần tham khảo và phần AI hỗ trợ. Không đổi vài tên biến để che nguồn code.
- Không tạo giả quá trình làm bài, log thí nghiệm, dữ liệu, lịch sử phát triển hoặc kết quả đánh giá.
- Chỉ ghi kết quả đã kiểm chứng; nếu là đề xuất, ví dụ giả lập hoặc chưa chạy thì phải nêu rõ.
- Trích dẫn tài liệu/code bên thứ ba theo yêu cầu và giấy phép. Câu trả lời AI không thay nguồn gốc thực của kiến thức/code.

## 8. AI Disclosure

Khi báo cáo, bàn giao hoặc nộp bài theo yêu cầu, khai báo tối thiểu:

| Thông tin | Cách ghi |
|---|---|
| Công cụ và thời điểm | Tên công cụ, ngày/batch; chỉ ghi model/version nếu biết chắc |
| Mục đích | Giải thích, lập plan, hỗ trợ code, test hay tài liệu |
| Phạm vi | File/feature hoặc nội dung cụ thể có AI hỗ trợ |
| Human review | Ai review, phần nào đã hiểu/chấp nhận/sửa |
| Validation | Lệnh/test/browser/API thực chạy và phần chưa kiểm chứng |
| Giới hạn | Assumption chưa chốt, dependency/backend gate hoặc lỗi còn lại |

Với dự án hiện tại, AI đã hỗ trợ plan, structure/dependency, UI khởi động và tài liệu trong các batch được duyệt. Điều này không có nghĩa các module nghiệp vụ đã được triển khai đầy đủ.

Không cần đính kèm nguyên lịch sử chat hoặc prompt chứa dữ liệu không được phép chia sẻ. Log nội bộ chỉ giữ nội dung cần thiết, đã loại dữ liệu nhạy cảm và ở vị trí được duyệt.

## 9. Testing & Validation

- Viết test theo yêu cầu/contract, không chỉ kiểm tra implementation của AI tự khớp với chính nó.
- Chọn kiểm tra phù hợp: static/type/lint, unit/component, integration/API và browser. Mỗi loại cung cấp bằng chứng khác nhau.
- Chỉ ghi “đạt/pass” khi có kết quả thực thi tương ứng; ghi rõ subset, lỗi, test chưa chạy hoặc môi trường chưa đủ.
- Mock API không chứng minh backend hoạt động; build thành công không chứng minh login, sync hoặc render 3D đúng.
- Test case trong plan không phải test đã chạy. Cài dependency test không đồng nghĩa đã có runner/config/script hoạt động.
- Không tự ghi dữ liệu thật, đổi quyền, xóa tài khoản hoặc upload dữ liệu nhạy cảm để kiểm thử.

## 10. Limitations & Hallucinations

AI có thể hiểu sai yêu cầu, dùng API cũ, bịa field/endpoint, bỏ sót lỗi hoặc đưa kết luận quá rộng. Vì vậy:

- Tách rõ fact đã kiểm chứng, giả định, đề xuất và dự đoán.
- Không chắc thì kiểm tra source/DTO/contract hoặc hỏi người phụ trách; không lấp chỗ trống bằng logic tự đặt.
- Đánh dấu giả định chờ xác nhận và nêu ảnh hưởng; không dùng nó làm expected test chính thức.
- Ưu tiên nguồn nội bộ đúng phiên bản và tài liệu chính thức phù hợp; không dùng câu trả lời tự tin làm bằng chứng.
- Chưa thực thi phải nói chưa thực thi; kết quả cũ phải ghi là lịch sử khi source/môi trường đã đổi.

## 11. Git & Repository Safety

- **Không commit `.env`, token, API key, password hoặc secret ở bất kỳ file nào.** Không chỉ dựa vào tên file hoặc `.gitignore` để kết luận an toàn.
- Trước commit, kiểm tra danh sách staged file và phạm vi diff; không tự stage toàn repository hoặc file của người khác.
- Không tự commit, push, reset, revert, force-push, sửa history hoặc ghi đè thay đổi sẵn có khi chưa được yêu cầu rõ.
- Manifest và yarn.lock phải đi cùng nhau khi thay dependency; dùng Yarn theo quy ước nhóm, giữ package-lock theo quyết định hiện tại.
- Không đưa file AI phân tích/debug nội bộ vào src/scripts/docs/public nếu chưa duyệt vị trí. File phụ trợ cần giữ đặt trong `.agents/<task>/`; test/tài liệu sản phẩm chính thức theo vị trí đã xác nhận.
- Nếu phát hiện secret trong working tree hoặc history, xử lý như sự cố; không paste diff chứa secret vào chat để hỏi cách sửa.

## 12. Incident Handling

Khi nghi đã gửi/commit/push secret hoặc dữ liệu nhạy cảm:

1. Dừng chia sẻ và thao tác có thể làm lộ thêm; không đưa lại giá trị bí mật vào thông báo sự cố.
2. Thông báo người chịu trách nhiệm bằng loại dữ liệu, nơi có thể bị lộ và thời điểm; không gửi credential thật.
3. Yêu cầu người có quyền thu hồi/rotate key, token hoặc password liên quan. Xóa khỏi file không làm secret đã lộ trở lại an toàn.
4. Xác định phạm vi: local file, commit, remote, log, prompt, screenshot hay artifact; hạn chế truy cập/chia sẻ theo quyền được cấp.
5. Loại bản sao không cần thiết và sửa cấu hình/quy trình sau khi được duyệt. Nếu cần sửa Git history, phối hợp với nhóm; không tự reset/force-push.
6. Kiểm tra credential cũ không còn dùng được trong phạm vi được phép và ghi lại biện pháp khắc phục, không ghi giá trị secret.

Không hứa xóa chat/file là đã thu hồi mọi bản sao hoặc dữ liệu đã gửi cho bên thứ ba.

## 13. Compliance Checklist

Trước khi commit hoặc nộp bài, người phụ trách và reviewer kiểm tra:

- [ ] Phạm vi thay đổi đã duyệt; không có feature/contract tự thêm.
- [ ] Không có `.env`, token, API key, password hoặc secret trong staged file, code, test, log, ảnh và tài liệu.
- [ ] Không đưa dữ liệu nhạy cảm vào prompt; fixture/ví dụ được phép chia sẻ.
- [ ] Đã hiểu và giải thích được code trọng tâm, input/output và tác dụng phụ.
- [ ] Đã mở và review diff; không ghi đè thay đổi của thành viên khác.
- [ ] DTO/API và tài liệu được đối chiếu đúng phiên bản; assumption còn mở được ghi rõ.
- [ ] Validation có bằng chứng; phân biệt test dự kiến, mock, test thật và kiểm tra lịch sử.
- [ ] Không có số liệu, nguồn, kết quả hoặc capability bị bịa.
- [ ] File phụ trợ đã dọn hoặc nằm đúng vị trí được duyệt.
- [ ] AI disclosure và trích dẫn đáp ứng yêu cầu môn học/bàn giao.
- [ ] Owner/reviewer đồng ý phần chấp nhận; không tự commit/push ngoài yêu cầu.

Nếu một mục không áp dụng, ghi lý do thay vì đánh dấu đạt giả. Nếu phát hiện vi phạm bảo mật, dừng bàn giao và thực hiện mục Incident Handling.
