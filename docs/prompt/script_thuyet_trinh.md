# Script thuyết trình — System Design Backend

> Đi kèm `system_design.slides.html` (23 slide). Tổng thời gian khoảng **30 phút**.
> Ký hiệu: ⏱ thời lượng gợi ý · 👉 thao tác trên slide · 💡 câu chuyển sang slide sau.
> Không cần đọc thuộc lòng. Nắm **ý in đậm** rồi nói bằng lời của mình.

---

## Slide 1 — Bìa · ⏱ 0:45

Em chào thầy. Hôm nay em trình bày phần **thiết kế hệ thống backend** của đề tài *AI hỗ trợ phát hiện và xử lý vấn đề chất lượng dữ liệu*.

👉 Chỉ vào 4 con số dưới cùng.

Để thầy hình dung quy mô: backend có **12 module nghiệp vụ** và **82 endpoint REST**. API có phiên bản `/v1`. Phần AI **chạy cục bộ**, dữ liệu không gửi ra ngoài. Các con số này em đếm trực tiếp từ mã nguồn, không lấy từ tài liệu.

💡 Trước khi vào chi tiết, em xin giới thiệu cách em sắp xếp nội dung.

---

## Slide 2 — Lộ trình · ⏱ 1:00

Bài trình bày gồm phần **yêu cầu hệ thống** và **5 phần thiết kế**: API, pipeline phân tích dataset, quy trình hoạt động, rồi đi sâu vào hai module **Auth** và **Analysis**.

👉 Chỉ vào khung 4 bước bên phải.

Mỗi phần em đều trình bày theo **4 bước**: giới thiệu, yêu cầu, kiến thức áp dụng, rồi thiết kế rút ra. Em làm vậy vì **mỗi quyết định thiết kế phải xuất phát từ một yêu cầu và dựa trên một kiến thức có nguồn**, không làm theo cảm tính. Nguồn nào em cũng để link để thầy kiểm tra.

Em cũng dùng ký hiệu: **✓ đã làm, ~ làm một phần, ✕ chưa làm**. Chỗ nào nhóm chưa làm, em sẽ nói thẳng là chưa làm.

💡 Đầu tiên là bài toán mà hệ thống giải quyết.

---

## Slide 3 — Bài toán · ⏱ 1:00

Trong phân tích dữ liệu có câu **"garbage in, garbage out"**: dữ liệu đầu vào xấu thì kết quả phân tích sai, dù mô hình tốt đến đâu.

Người dùng của hệ thống là người làm phân tích dữ liệu, ví dụ Data Analyst. Họ cần ba thứ: **phát hiện** lỗi, xem **bằng chứng** tới từng ô, và nhận **đề xuất** xử lý.

👉 Đi qua 5 thẻ DQ.

Nhóm chốt 5 nhóm lỗi:
- **DQ-01** dữ liệu thiếu.
- **DQ-02** dòng trùng.
- **DQ-03** sai kiểu hoặc sai định dạng.
- **DQ-04** giá trị ngoại lai.
- **DQ-05** vi phạm quy tắc nghiệp vụ. Nhóm này chỉ đánh giá khi người dùng đã xác nhận quy tắc, nên em tô màu khác.

💡 Từ bài toán đó, nhóm rút ra các yêu cầu cụ thể.

---

## Slide 4 — Yêu cầu · ⏱ 1:30

👉 Cột trái, yêu cầu chức năng.

Về chức năng:
- Mỗi project chứa **đúng một file CSV**, kiểm tra ngay lúc tải lên.
- Hệ thống phát hiện 5 nhóm lỗi, tính thống kê và tương quan.
- AI **chỉ giải thích và đề xuất, không tự sửa dữ liệu**.
- Người dùng nhận xét kết quả AI, và nhận xét đó được dùng để AI trả lời tốt hơn ở lần sau.
- Có cộng tác theo Workspace/Project và xuất báo cáo PDF.

👉 Cột phải, yêu cầu phi chức năng.

Phần quyết định nhiều nhất tới thiết kế là phi chức năng:
- Dữ liệu **chỉ đọc**.
- AI **chạy cục bộ**, và thông tin cá nhân phải được che trước khi đưa vào AI.
- **AI lỗi không được làm hỏng kết quả của hệ thống.** Đây là yêu cầu định hình cả pipeline phân tích mà lát nữa em trình bày.
- Phân quyền theo vai trò, và phiên đăng nhập phải an toàn.

💡 Bắt đầu với phần thứ nhất: thiết kế API.

---

## Slide 5 — Mở phần 01: Thiết kế API · ⏱ 0:20

API của hệ thống là REST trên NestJS, gồm 82 endpoint, tiền tố `/api/v1`. Tài liệu Swagger được sinh tự động tại `/api/v1/docs`.

---

## Slide 6 — API: Yêu cầu → Kiến thức · ⏱ 1:30

👉 Chỉ hàng pill.

Với API, nhóm đặt bốn yêu cầu: đường dẫn phản ánh nghiệp vụ, response có một khuôn chung, duyệt được dataset hàng triệu dòng, và có phiên bản để nâng cấp sau này.

👉 Thẻ trái.

Kiến thức chính nhóm dựa vào là **8 tips thiết kế API của ByteByteGo**, theo gợi ý của thầy. Tám tip gồm: thiết kế theo domain model, chọn đúng HTTP method, idempotency, chọn đúng status code, versioning, đường dẫn có ngữ nghĩa, xử lý theo lô, và query language để phân trang, lọc, sắp xếp.

👉 Thẻ phải.

Bên cạnh đó, nhóm đối chiếu với **RFC 9110**, chuẩn gốc của HTTP. Mục 9.2.2 định nghĩa phương thức idempotent, mục 15 định nghĩa ý nghĩa các status code. Tức là các tip không chỉ là kinh nghiệm, mà có chuẩn đứng sau.

💡 Vậy hệ thống đã áp dụng 8 tips tới đâu?

---

## Slide 7 — 8 tips: đối chiếu · ⏱ 2:30

Đây là câu thầy hỏi nhóm, và em trả lời bằng chính mã nguồn.

👉 Đi lần lượt các ô xanh.

- **Tip 1, domain model:** đường dẫn lồng theo nghiệp vụ, ví dụ `projects/:projectId/datasets`. Đọc URL là biết dataset thuộc project nào.
- **Tip 2, HTTP method:** dùng đủ GET, POST, PATCH, PUT, DELETE. Có vài hành động dạng động từ như `transfer-owner` hay `retry`, vì đó là hành động chứ không phải tài nguyên.
- **Tip 4, status code:** dùng 200, 201, 202, 204; mọi lỗi đi qua một filter chung nên luôn cùng khuôn.
- **Tip 5, versioning:** tiền tố `/api/v1`, cấu hình ở `main.ts` dòng 96.
- **Tip 8, query language:** dữ liệu lớn dùng **phân trang con trỏ (keyset)** chứ không dùng offset, kèm lọc và sắp xếp.

👉 Hai ô vàng.

- **Tip 3, idempotency:** mới làm một phần. Có `PUT snapshot` và dấu vân tay `input_fingerprint`, nhưng **chưa có header `Idempotency-Key`** cho các request POST.
- **Tip 6, semantic path:** còn chỗ chưa thống nhất số ít/số nhiều: `analysis/jobs` và `analyses/:id`.

👉 Ô đỏ.

- **Tip 7, batch:** **chưa làm**, hệ thống chưa có endpoint `/bulk`.

**Tổng kết: 5 tip làm đủ, 2 làm một phần, 1 chưa làm.** Hướng cải tiến em để ở slide cuối.

💡 Từ các tip đó, thiết kế API cụ thể như sau.

---

## Slide 8 — API: Thiết kế rút ra · ⏱ 1:30

👉 Cây bên trái.

Tài nguyên lồng theo đúng quan hệ nghiệp vụ: **Workspace chứa Project, Project chứa Dataset, Analysis, Report**. Feedback gắn vào từng lần phân tích.

👉 Ba thẻ bên phải.

Response có **một khuôn thống nhất**: thành công là `success: true` kèm `data`; lỗi là `success: false` kèm `error` có `code` và `message`. Nhờ vậy frontend chỉ cần một cách xử lý.

Với **việc chạy lâu** như tạo PDF hay thử lại AI, API trả **202 Accepted** ngay. Client theo dõi tiến độ qua endpoint job hoặc nhận sự kiện qua Socket.IO, để request không phải chờ lâu.

💡 Phần thứ hai, cũng là phần trọng tâm: hệ thống phân tích một dataset như thế nào.

---

## Slide 9 — Mở phần 02: Pipeline · ⏱ 0:20

Khi người dùng bấm "Phân tích", hệ thống gọi `POST /projects/:projectId/analysis`. Em sẽ đi qua toàn bộ những gì xảy ra sau cú bấm đó.

---

## Slide 10 — Pipeline: Yêu cầu → Kiến thức · ⏱ 1:45

👉 Hàng pill.

Pipeline phải đáp ứng bốn yêu cầu: **AI lỗi không chặn kết quả**, có **bằng chứng tới từng ô**, trạng thái **theo dõi được**, và **che thông tin cá nhân** trước khi đưa vào AI.

👉 Thẻ Hexagonal.

Kiến thức thứ nhất là **Hexagonal Architecture** của Alistair Cockburn. Ý chính: lõi ứng dụng chỉ giao tiếp ra ngoài qua **port**, còn mỗi công nghệ cụ thể là một **adapter**. Áp vào hệ thống: phần tính toán là các **hàm thuần** trong thư mục `domain`, không phụ thuộc database. AI được gọi qua `AiInferencePort`; hôm nay adapter gọi vLLM hoặc Ollama, mai đổi engine thì chỉ cần thay adapter.

👉 Thẻ RAG.

Kiến thức thứ hai là **RAG**, bài báo của Lewis và cộng sự năm 2020: trước khi hỏi mô hình, hệ thống truy xuất thông tin liên quan để đưa kèm vào prompt. Áp vào hệ thống: những nhận xét cũ của người dùng giống trường hợp hiện tại nhất được đưa vào prompt làm **ví dụ mẫu (few-shot)**.

💡 Đây là phần chạy ngay trong request.

---

## Slide 11 — 8 bước đồng bộ · ⏱ 2:30

👉 Đi theo từng chấm tròn.

1. **Kiểm tra** project, dataset và đọc cấu hình người dùng đã lưu: chọn cột nào, cột nhãn, cột thời gian.
2. **Phân vai cột** thành cột số, cột phân loại hoặc loại trừ, và tính **dấu vân tay đầu vào** từ dataset cộng cấu hình.
3. **Mở một bản ghi lần chạy** ở trạng thái `running`.
4. Kiểm tra **DQ-01 đến 04**: thiếu, trùng, sai kiểu, ngoại lai.
5. **Thống kê mô tả**, mất cân bằng nhãn, phân tích theo thời gian.
6. **Ma trận tương quan và VIF**.
7. **Lưu bằng chứng** tới từng ô, tối đa 20 ô mỗi cột, giá trị đã che PII.
8. **Lưu kết quả**, đánh dấu kết quả cũ là **stale**, và tạo một **AI job** ở trạng thái chờ.

👉 Hộp xanh dưới cùng.

Ba bước giữa, từ 4 đến 6, là **hàm thuần**: nhận dữ liệu, trả kết quả, không đụng database. Vì vậy có thể **viết test cho chúng một cách độc lập**.

Điểm quan trọng: tới bước 8, request **trả kết quả hệ thống về ngay**. AI chưa chạy, nhưng người dùng đã có số liệu.

💡 Còn AI chạy ở đâu? Ở làn thứ hai.

---

## Slide 12 — AI worker bất đồng bộ · ⏱ 2:30

👉 Làn trái.

Làn request kết thúc bằng **201 kèm kết quả hệ thống**, và phát sự kiện `analysis.completed` qua Socket.IO.

👉 Ô giữa.

Hai làn nối với nhau qua một **AI job** đang chờ.

👉 Làn phải.

Worker xử lý job qua ba bước:
1. **Nhận job một cách nguyên tử** bằng `findOneAndUpdate` trên MongoDB, kèm **lease**. Cách này bảo đảm hai worker không lấy trùng một job.
2. **Dựng prompt**: số liệu hệ thống đã tính, mẫu dữ liệu đã che PII, và ví dụ few-shot. Prompt được gửi tới model cục bộ, timeout 180 giây.
3. **Grounding**, tức là kiểm tra AI có bịa hay không. Kết quả phải đúng schema, kiểm tra bằng Zod. Hệ số tương quan AI nêu ra phải **khớp với số hệ thống tính, lệch quá 0.01 thì bị loại**.

Lỗi tạm thời được thử lại tối đa 2 lần. Nếu worker chết, giữ job quá lease thì job chuyển sang `skipped`.

👉 Thẻ vàng.

Em nói rõ một điểm: **tài liệu thiết kế đặt đích là dùng Outbox và Kafka topic `ai.jobs`**, nhưng hiện tại **chưa triển khai**; worker đang poll MongoDB. Vì trạng thái job giữ nguyên, sau này chuyển sang Kafka sẽ không ảnh hưởng API.

💡 Phần thứ ba: quy trình hoạt động của cả hệ thống.

---

## Slide 13 — Mở phần 03: Quy trình · ⏱ 0:20

Em trình bày quy trình theo hai góc nhìn: **người dùng làm gì**, và **một request đi qua những lớp nào** trong backend.

---

## Slide 14 — Kiến thức → Thiết kế · ⏱ 1:45

Yêu cầu ở đây là nhiều module phải phối hợp nhưng vẫn tách biệt, và **sự kiện giữa các module không được mất**.

👉 Thẻ trái.

Kiến thức thứ nhất là bài **Monolith First** của Martin Fowler: nên bắt đầu bằng một khối thống nhất, khi hiểu rõ nghiệp vụ rồi mới tách thành dịch vụ riêng. Nhóm theo hướng **Modular Monolith**: một ứng dụng chứa 12 module, mỗi module chia ba tầng `domain`, `application`, `infrastructure`. Như vậy vẫn triển khai đơn giản, mà ranh giới module đã rõ để tách sau nếu cần.

👉 Thẻ phải.

Kiến thức thứ hai là **Transactional Outbox**. Vấn đề cần giải quyết: nếu vừa ghi database vừa gửi message, một bên thành công một bên thất bại thì sự kiện bị mất. Cách giải: ghi sự kiện vào bảng outbox **cùng lúc** với dữ liệu nghiệp vụ, rồi một relay đọc bảng đó và publish lên broker. Ví dụ trong code: upload CSV xong, hệ thống ghi sự kiện `DATASET_INGESTED` vào outbox, và `OutboxRelayService` đẩy sang Kafka.

💡 Đây là hành trình của người dùng.

---

## Slide 15 — Hành trình người dùng · ⏱ 1:30

👉 Đi theo số thứ tự.

Người dùng đăng nhập, tạo Workspace rồi Project, upload file CSV, xem dữ liệu dạng lưới, cấu hình cột cần phân tích, rồi **chạy phân tích**. Ô tô đậm là bước trung tâm đã trình bày ở phần 02.

Sau đó AI đánh giá ở nền. Người dùng nhận xét kết quả AI và xuất báo cáo PDF.

👉 Ô viền đứt cuối cùng.

Vòng lặp nằm ở ô cuối: **nhận xét của người dùng quay lại làm ví dụ cho AI** ở những lần phân tích sau.

Dưới mỗi bước là endpoint tương ứng. Như vậy luồng nghiệp vụ khớp với thiết kế API ở phần 01.

💡 Còn bên trong backend, một request đi qua những gì?

---

## Slide 16 — 7 lớp của một request · ⏱ 2:00

👉 Đi từ trên xuống theo hình phễu.

1. **Cloudflare Tunnel:** chỉ mở cổng 443 qua HTTPS.
2. **Helmet và CORS:** thêm header bảo mật, chỉ chấp nhận origin hợp lệ.
3. **ThrottlerGuard:** giới hạn 200 request mỗi 60 giây; riêng endpoint auth giới hạn chặt hơn.
4. **JwtAuthGuard:** xác thực access token.
5. **PoliciesGuard dùng CASL:** kiểm tra user có quyền trên Workspace/Project này không. Đây là phân quyền theo vai trò.
6. **ZodValidationPipe:** kiểm tra body và query theo schema.
7. Qua hết các lớp trên, request mới tới **Controller → Service → Repository**.

Mỗi lớp chặn một loại rủi ro, nên **request sai bị loại càng sớm càng tốt** và không chạm tới dữ liệu.

👉 Ba pill dưới cùng.

Ở chiều ra, sự kiện đi qua Outbox sang Kafka, cập nhật realtime đi qua Socket.IO, và response được định dạng theo khuôn chung.

💡 Phần thứ tư, module Auth.

---

## Slide 17 — Mở phần 04: Auth · ⏱ 0:20

Module Auth có 11 endpoint: đăng ký, đăng nhập, đăng nhập bằng Google, làm mới phiên, quên và đổi mật khẩu bằng OTP, xem và thu hồi phiên.

---

## Slide 18 — Auth: Yêu cầu → Kiến thức · ⏱ 1:45

Yêu cầu của Auth gói trong ba ý: **không để lộ thông tin, không cho dò mật khẩu, và phiên bị đánh cắp phải thu hồi được**.

👉 Thẻ OWASP.

Kiến thức thứ nhất là **OWASP Authentication Cheat Sheet**, bộ khuyến nghị bảo mật được dùng rộng rãi. Ba điểm nhóm áp dụng:
- Đăng nhập sai thì trả **thông báo lỗi chung chung**, không cho biết sai email hay sai mật khẩu.
- Băm mật khẩu an toàn.
- Giới hạn số lần thử và khóa tài khoản.

👉 Thẻ RFC 9700.

Kiến thức thứ hai là **RFC 9700**, bộ thực hành bảo mật tốt nhất của OAuth 2.0. Mục 4.14.2 mô tả **xoay vòng refresh token**: mỗi lần làm mới thì cấp token mới và token cũ mất hiệu lực. Nếu token cũ bị dùng lại, máy chủ hiểu là có dấu hiệu bị đánh cắp và thu hồi token đang hoạt động.

💡 Hai kiến thức này hiện ra trong code như sau.

---

## Slide 19 — Auth: Thiết kế · ⏱ 2:30

👉 Cột trái, đăng nhập.

Khi đăng nhập, hệ thống:
1. Tìm user và kiểm tra tài khoản có bị khóa không.
2. So khớp mật khẩu bằng **bcrypt**.
3. Nếu sai, dù sai email hay sai mật khẩu, đều trả **cùng một câu "Email hoặc mật khẩu không chính xác"**. Đây là chỗ khớp OWASP, em đánh dấu chấm than đỏ.
4. Nếu đúng, cấp **access token 15 phút** và **refresh token 7 ngày**.
5. Lưu phiên, nhưng chỉ lưu **mã băm SHA-256 của refresh token**. Nếu database bị lộ, kẻ tấn công cũng không có token gốc để dùng.

👉 Cột phải, làm mới phiên.

Khi làm mới, hệ thống tìm phiên theo mã băm token. Nếu phiên còn hiệu lực thì thu hồi phiên cũ và cấp cặp token mới; đó là xoay vòng.

Dấu chấm than đỏ thứ hai: nếu một **token đã bị thu hồi mà vẫn được gửi lên**, nghĩa là có hai người đang giữ cùng một token. Lúc đó hệ thống **thu hồi toàn bộ phiên của user**, bắt đăng nhập lại. Đây là chỗ khớp RFC 9700.

👉 Pill dưới cùng.

Thêm hai lớp bảo vệ:
- **OTP quên mật khẩu** hết hạn sau 10 phút, sai quá 3 lần thì OTP bị vô hiệu.
- Endpoint auth bị giới hạn **5 đến 10 lần mỗi giờ**.

💡 Phần cuối, module Analysis.

---

## Slide 20 — Mở phần 05: Analysis · ⏱ 0:20

Module Analysis có 11 endpoint: cấu hình, chạy, kết quả, AI job, tổng kết và báo cáo PDF. Kiến thức áp dụng là Hexagonal và RAG như ở phần 02, nên em không nhắc lại mà đi thẳng vào thiết kế.

---

## Slide 21 — Ba tầng, ba vòng đời · ⏱ 2:00

👉 Cột trái, từ dưới lên.

Module chia ba tầng:
- **domain** ở đáy: các hàm thuần cho DQ, thống kê, tương quan, VIF, che PII, grounding. Tầng này không biết tới database hay HTTP.
- **application** ở giữa: các service điều phối như `AnalysisService` cho pipeline, `AiWorkerService` cho job AI, `RagFewShotService` cho ví dụ mẫu.
- **infrastructure** ở trên: controller, schema MongoDB, và adapter gọi model AI.

Phụ thuộc chỉ đi **từ ngoài vào trong**, nên tầng domain không bị ảnh hưởng khi đổi database hay đổi model.

👉 Cột phải, các vòng đời.

Mỗi thực thể có một vòng đời trạng thái rõ ràng:
- **Lần chạy và job báo cáo:** pending → running → succeeded hoặc failed.
- **AI job:** thêm trạng thái `skipped` khi hết lease; người dùng bấm thử lại thì job quay về pending.
- **Kết quả phân tích:** khi chạy lại, kết quả trước bị gắn `is_stale`. Dấu vân tay đầu vào cho biết mỗi kết quả ứng với dữ liệu và cấu hình nào.

💡 Cuối cùng, em xin nhìn lại những gì chưa làm tốt.

---

## Slide 22 — Hạn chế & hướng cải tiến · ⏱ 1:45

Em liệt kê thẳng những gì còn thiếu:
1. **POST chưa chống gửi trùng.** Hướng sửa: thêm header `Idempotency-Key`.
2. **Chưa có xử lý hàng loạt.** Hướng sửa: thêm endpoint `/bulk` khi nghiệp vụ cần.
3. **Đường dẫn chưa thống nhất số ít/số nhiều.** Hướng sửa: chuẩn hoá ở `/api/v2` để không phá client đang dùng v1.
4. **Pipeline chạy đồng bộ và nạp toàn bộ dòng vào bộ nhớ.** Với dataset rất lớn, đây là điểm nghẽn. Hướng sửa: chuyển sang job nền và xử lý theo lô.
5. **AI job đang poll MongoDB.** Hướng sửa: chuyển sang Outbox + Kafka đúng như tài liệu thiết kế.

💡 Đây là các nguồn em đã dùng.

---

## Slide 23 — Tài liệu tham khảo & cảm ơn · ⏱ 0:45

Tất cả kiến thức trong bài đều có nguồn trên slide này, và em đã kiểm tra từng link: ByteByteGo, RFC 9110, Hexagonal Architecture, bài báo RAG, Monolith First, Transactional Outbox, OWASP và RFC 9700.

Phần trình bày của em đến đây là hết. **Em cảm ơn thầy đã lắng nghe, em xin nhận câu hỏi ạ.**

---
---

# Phần hỏi đáp — câu thầy có thể hỏi

> Mỗi câu trả lời đều dựa trên code hoặc tài liệu đã kiểm. Câu nào trả lời "chưa làm" thì nói thẳng, **không hứa thêm**.

### Nhóm API

**H1. 8 tips em làm được 5. Vì sao chưa làm batch?**
Vì hiện tại nghiệp vụ chưa có thao tác nào cần ghi hàng loạt: dữ liệu dataset chỉ đọc, người dùng không sửa hay xoá dòng. Thao tác "nhiều mục một lần" duy nhất là đổi tên nhiều cột, và đã gom vào một request `PATCH datasets/:id/columns`. Khi có nhu cầu thật thì nhóm sẽ thêm endpoint `/bulk`.

**H2. Nếu người dùng bấm "Phân tích" hai lần liên tiếp thì sao?**
Hiện tại hệ thống **tạo hai lần chạy**, vì POST chưa có `Idempotency-Key`. Kết quả không bị sai: hai lần có cùng dấu vân tay đầu vào, và kết quả cũ được gắn `stale`. Nhưng tốn tài nguyên tính toán hai lần, nên nhóm ghi vào phần hạn chế.

**H3. Tại sao dùng phân trang con trỏ (cursor) mà không dùng page/offset?**
Với offset, muốn lấy trang 10.000 thì database phải bỏ qua toàn bộ các dòng phía trước, càng về sau càng chậm. Keyset cursor nhớ vị trí dòng cuối cùng và đọc tiếp từ đó qua index, nên tốc độ gần như không đổi dù ở trang nào. Đây đúng là tip số 8, query language.

**H4. Tại sao tạo báo cáo trả 202, còn chạy phân tích trả 201?**
Phân tích hệ thống tính xong ngay trong request và **tạo ra kết quả**, nên trả 201 Created. Tạo PDF thì được giao cho worker chạy nền, server chỉ **nhận yêu cầu**, nên trả 202 Accepted. Cách chọn này theo ý nghĩa status code trong RFC 9110 mục 15.

### Nhóm Pipeline & AI

**H5. Làm sao biết AI không bịa?**
Hệ thống grounding qua hai lớp:
1. Phản hồi phải **đúng schema**, kiểm tra bằng Zod. Thiếu trường hay sai kiểu thì đánh giá đó bị đánh `failed`.
2. Mỗi hệ số tương quan AI nhắc tới phải **khớp với số hệ thống đã tính**, lệch quá 0.01 thì bị loại khỏi kết quả hiển thị.

Ngoài ra, AI **không được ghi đè** số liệu hay mức độ nghiêm trọng do hệ thống tính.

**H6. Thông tin cá nhân được bảo vệ thế nào khi đưa vào AI?**
Có hai lớp. Thứ nhất, nhận diện bằng regex: email, số điện thoại, CCCD. Thứ hai, cột nào người dùng đánh dấu là PII thì luôn bị che. Ô nào không che được thì **loại khỏi prompt**, không gửi đi. Thêm nữa, model chạy cục bộ nên dữ liệu không rời hệ thống.

**H7. RAG của em dùng embedding gì?**
*Trả lời trung thực:* hiện tại embedding là một **vector băm từ khoá 64 chiều chạy ngay trong code** (`embedText` trong `rag-few-shot.util.ts`), so độ giống bằng cosine, lấy top 5, chỉ dùng ví dụ đủ độ tin cậy. Tài liệu thiết kế đặt mục tiêu dùng model embedding cục bộ (Qwen3-Embedding), nhưng **chưa thay vào**. Cách hiện tại đủ để tìm ví dụ cùng loại lỗi và cùng cột, nhưng chưa hiểu được nghĩa của câu.

**H8. Dùng model AI nào?**
Model **chưa chốt**. Nhóm có 5 ứng viên (Qwen3-14B, Gemma-3-12B, Qwen3-8B, Llama-3.1-8B, Vistral-7B) và sẽ chọn theo kết quả benchmark trên 9 chỉ số. Trong code, model được cấu hình bằng biến môi trường `AI_MODEL_ID`, nên đổi model không phải sửa code.

**H9. Pipeline chạy đồng bộ, dataset vài triệu dòng thì có treo không?**
Đây là hạn chế em đã nêu. Hiện pipeline nạp toàn bộ dòng vào bộ nhớ (`listAllRecords`), nên với dataset rất lớn sẽ chậm và tốn RAM. Hướng sửa là chuyển phân tích sang job nền giống AI và xử lý theo lô. Nhờ các hàm tính toán là hàm thuần, việc chuyển chủ yếu thay đổi phần điều phối.

**H10. Vì sao DQ-05 luôn "chưa đánh giá"?**
Quy tắc nghiệp vụ, ví dụ "ngày kết thúc phải sau ngày bắt đầu", phải do người dùng xác nhận. Nhóm chốt **không để hệ thống hay AI tự suy ra quy tắc**, vì suy sai sẽ báo lỗi sai. Chưa có quy tắc được xác nhận thì DQ-05 giữ trạng thái `unassessed`.

**H11. Vì sao chưa dùng Kafka cho AI job như tài liệu?**
Nhóm ưu tiên cho luồng AI chạy được trước bằng cách poll MongoDB. Cách này vẫn bảo đảm không xử lý trùng nhờ nhận job nguyên tử và lease. Trạng thái job được thiết kế giống hệt bản Kafka, nên chuyển đổi sau này không ảnh hưởng API và frontend.

### Nhóm Kiến trúc

**H12. Vì sao không làm microservices?**
Theo Fowler, tách dịch vụ quá sớm khi chưa hiểu rõ nghiệp vụ thì ranh giới dễ sai và tốn chi phí vận hành. Đồ án là nhóm nhỏ, chạy trên một máy, nên Modular Monolith hợp lý hơn. Mỗi module đã tách ba tầng và giao tiếp qua port, nên nếu cần thì tách module ra thành dịch vụ riêng được.

**H13. Outbox có bảo đảm sự kiện chỉ xử lý đúng một lần không?**
Outbox bảo đảm sự kiện **không bị mất**, nhưng có thể được gửi **nhiều hơn một lần** (at-least-once). Vì vậy phía nhận có thêm **inbox** để chống xử lý trùng: mỗi consumer ghi lại `event_id` đã xử lý (`inbox.service.ts`).

**H14. Phân quyền hoạt động thế nào?**
Hệ thống dùng thư viện CASL. Mỗi endpoint khai báo quyền cần có, ví dụ chạy phân tích cần quyền `Execute` trên `Analysis`. `PoliciesGuard` kiểm tra vai trò của user trong Workspace/Project hiện tại. Ví dụ: thành viên workspace mặc định chỉ được **đọc** dữ liệu project, không được ghi. Admin hệ thống có toàn quyền.

### Nhóm Auth

**H15. Refresh token bị đánh cắp thì sao?**
Có hai trường hợp:
- Kẻ tấn công dùng token trước: token của người dùng thật trở thành token cũ. Khi người dùng thật làm mới phiên, hệ thống phát hiện token cũ bị dùng lại và **thu hồi toàn bộ phiên**, kẻ tấn công cũng bị đá ra.
- Người dùng thật làm mới trước: token kẻ tấn công cầm đã bị thu hồi, gửi lên là kích hoạt thu hồi toàn bộ phiên.

Ngoài ra access token chỉ sống 15 phút, nên khoảng thời gian bị lợi dụng ngắn.

**H16. Vì sao lưu SHA-256 của refresh token mà không lưu bằng bcrypt?**
Refresh token là chuỗi ngẫu nhiên dài, không đoán được như mật khẩu người dùng đặt, nên không cần thuật toán băm chậm như bcrypt. SHA-256 đủ an toàn và cho phép **tra cứu phiên trực tiếp theo mã băm**. Mật khẩu thì dễ đoán hơn nên vẫn dùng bcrypt.

**H17. Đăng nhập Google có đi qua cùng cơ chế phiên không?**
Đăng nhập Google qua hai endpoint `GET /auth/google` và `/auth/google/callback`. *Nếu thầy hỏi sâu hơn về luồng cấp phiên sau callback, em xin phép kiểm tra lại code rồi trả lời*, vì phần này em chưa trình bày chi tiết trong slide.

### Câu mở

**H18. Nếu làm lại, em sẽ thay đổi gì đầu tiên?**
Em sẽ đưa pipeline phân tích sang job nền ngay từ đầu, giống AI job. Đây là điểm hạn chế lớn nhất về khả năng mở rộng. Kiến trúc hiện tại đã tách sẵn hàm tính toán nên việc chuyển không khó, nhưng làm từ đầu sẽ tránh được một lần sửa.
