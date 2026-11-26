# Script thuyết trình: Backend làm gì sau mỗi API

> Đi kèm `backend_api_flows.slides.html` (33 slide). Bản đầy đủ khoảng **42 phút**, bản rút gọn khoảng **25 phút** (xem cuối file).
> Mỗi slide có ba phần: **Chỉ vào** là thao tác trên slide, **Nói** là lời trình bày, **Đào sâu** là phần giải thích thêm khi thầy muốn nghe kỹ hoặc hỏi lại.
> Không cần đọc thuộc lòng. Nắm ý in đậm rồi nói bằng lời của mình.

## Ba việc cần làm trước buổi trình bày

Ba điểm dưới đây em mới đọc ra từ code, chưa chạy thử. Chạy thử trước để lúc thầy hỏi mình trả lời chắc chắn.

1. Đăng nhập bằng một tài khoản analyst thường (không phải admin), gọi `POST /projects/:projectId/analysis`. Nếu nhận 403 thì điểm ở slide 6 là lỗi thật, cần nói thẳng.
2. Lấy một refresh token, sửa hạn phiên trong DB cho quá hạn, gọi `POST /auth/refresh`. Xem các phiên khác của user có bị thu hồi không (slide 15).
3. Bật `AI_WORKER_ENABLED`, cho model trả về chữ thường thay vì JSON, xem job kết thúc ở trạng thái nào (slide 29).

---

# Mở đầu

## Slide 1: Bìa (0:40)

**Nói.** Em chào thầy. Phần này em không nói về kiến trúc chung nữa mà đi thẳng vào code: **sau mỗi API, backend thực sự làm những việc gì**. Em đi theo đúng thứ tự mà một request đi qua, từ lúc chạm máy chủ tới lúc có phản hồi.

Phạm vi là **22 API**, chia ba phần: lớp chung mà mọi API đều đi qua, module Auth, và module Analysis. Mọi con số trên slide em lấy từ mã nguồn. Chỗ nào code chưa làm hoặc làm khác mô tả, em ghi trong ô màu vàng.

**Chuyển.** Trước hết là danh sách 22 API đó.

## Slide 2: Bản đồ 22 API (1:00)

**Chỉ vào** ba cột, rồi dòng chú thích màu.

**Nói.** Auth có **11 API**, Analysis có **7**, Summary và Report mỗi bên **2**. Summary và Report nằm chung module với Analysis vì chúng đọc cùng một kho kết quả.

Màu nền cho biết ai gọi được. Nền vàng là **công khai**, tức chưa cần token: đăng ký, đăng nhập, gia hạn, quên và đặt lại mật khẩu. Nền xanh là **phải đăng nhập**. Hai ô viền đứt là đăng nhập Google, nhóm em **chưa làm**, hiện trả 501.

**Đào sâu.** Toàn bộ đường dẫn có tiền tố `/api/v1`, đặt một lần trong `main.ts`. Hai đường dẫn health check được loại khỏi tiền tố để công cụ giám sát gọi thẳng.

**Chuyển.** 22 API này khác nhau về nghiệp vụ, nhưng giống nhau ở đoạn đường đầu tiên.

---

# Phần 1: Lớp chung

## Slide 3: Mở phần 1 (0:15)

**Nói.** Phần một là những chặng mà mọi request phải qua trước khi tới nghiệp vụ.

## Slide 4: Đường ống một request (2:00)

**Chỉ vào** lần lượt bảy ô, rồi các ô đỏ treo bên dưới, cuối cùng là thanh đen.

**Nói.** Một request đi qua **bảy chặng**.

Chặng một là Helmet và CORS: gắn header bảo mật và lọc nguồn gọi. Chặng hai là **giới hạn tần suất**, mặc định 200 lần trong 60 giây, vượt thì 429. Chặng ba là `JwtAuthGuard` kiểm token, sai thì 401. Chặng bốn là `PoliciesGuard` kiểm quyền, thiếu thì 403. Chặng năm là Zod kiểm body, sai thì 400. Chặng sáu mới là controller và service, nơi chứa nghiệp vụ. Chặng bảy là interceptor bọc kết quả vào một khuôn chung.

Điểm em muốn thầy để ý là **các ô đỏ**: request sai bị loại càng sớm càng tốt, và bị loại ở đâu thì trả mã ở đó. Tới được chặng sáu nghĩa là request đã đúng người, đủ quyền, đúng dữ liệu.

Thanh đen bên dưới là `AllExceptionsFilter`. Lỗi ném ra ở bất kỳ chặng nào cũng rơi về đây.

**Đào sâu.**
- Thứ tự này do NestJS quy định: guard chạy trước, rồi interceptor, rồi pipe, rồi handler. Guard giới hạn tần suất được đăng ký toàn cục bằng `APP_GUARD` trong `app.module.ts` nên chạy trước cả guard của controller. Nhờ vậy request rác bị chặn trước khi tốn một lần truy vấn DB để kiểm token.
- Helmet bật HSTS với thời hạn một năm. CORS cho phép các nguồn trong cấu hình và tên miền của Cloudflare Tunnel.
- Chặng ba và bốn chỉ chạy ở route có gắn guard. Bên Analysis guard gắn ở mức controller nên phủ mọi route. Bên Auth guard gắn từng route, các route công khai không có.

**Chuyển.** Em đi kỹ vào chặng ba, vì nó chạy ở gần như mọi request.

## Slide 5: Kiểm access token (1:30)

**Chỉ vào** bước 3 và ô vàng.

**Nói.** Kiểm token có năm bước. Lấy token từ header, kiểm chữ ký và hạn dùng, rồi **bước ba là điểm đáng nói: backend nạp lại user từ DB ở mỗi request**. Nếu user đã bị khoá hoặc xoá mềm thì chặn ngay, dù token vẫn còn hạn. Cuối cùng gắn bốn thông tin vào request: userId, email, role, sessionId.

Nghĩa là quản trị viên khoá một tài khoản thì tài khoản đó mất quyền ở ngay request kế tiếp, không phải chờ token hết hạn.

Ô vàng là hạn chế em ghi nhận: bước này kiểm **user** chứ không kiểm **phiên**. Sau khi đăng xuất, access token cũ vẫn dùng được tới khi hết 15 phút.

**Đào sâu.**
- Đây là đánh đổi có chủ ý của kiểu thiết kế token ngắn hạn: không tra phiên ở mỗi request để đỡ một truy vấn, bù lại access token chỉ sống 15 phút. Cửa sổ rủi ro tối đa là 15 phút.
- Muốn đóng cửa sổ này thì trong `JwtStrategy.validate` tra thêm phiên theo `sessionId` có sẵn trong token. Chi phí là thêm một truy vấn mỗi request, có thể giảm bằng cache.
- Khoá ký là `JWT_ACCESS_SECRET`. File kiểm cấu hình lúc khởi động bắt buộc biến này dài tối thiểu 16 ký tự, thiếu thì ứng dụng không chạy.

**Chuyển.** Biết là ai rồi, câu hỏi tiếp theo là người đó được làm gì.

## Slide 6: Phân quyền ba tầng (2:00)

**Chỉ vào** ba thẻ, rồi bảng vai trò, rồi ô vàng.

**Nói.** `PoliciesGuard` được thiết kế ba tầng. Tầng một **kiểm tĩnh**: hỏi theo tên chủ thể, ví dụ user này có quyền chạy trên Analysis hay không; trượt thì 403 ngay, chưa đụng DB. Tầng hai **nạp tài nguyên** theo id trên đường dẫn; không có thì 404. Tầng ba **kiểm trên bản ghi thật**, ví dụ bản ghi có thuộc workspace của user hay không.

Bảng bên dưới là luật quyền. Quản trị hệ thống toàn quyền. Chủ workspace toàn quyền trong workspace của mình. Thành viên chỉ được đọc, bị cấm chạy. Vì vậy với Analysis, mọi API POST đòi quyền chạy, mọi API GET đòi quyền đọc.

Em nói thẳng phần ô vàng. Luật quyền dựa trên `workspaceId` và `workspaceRole` của user, nhưng bước xác thực hiện **chưa gắn hai thông tin này vào request**. Và chưa controller nào khai báo tài nguyên cần nạp, nên **tầng hai chưa chạy ở đâu**. Bộ khung ba tầng đã có, phần nối vào từng route nhóm em chưa hoàn tất.

**Đào sâu.**
- Thư viện là CASL. Luật viết một chỗ trong `casl-ability.factory.ts`, controller chỉ khai báo cần quyền gì bằng `@CheckPolicies`. Tách như vậy để đổi luật không phải sửa từng controller.
- Tầng hai còn có một lợi ích: bản ghi guard đã nạp được gắn vào request để service dùng lại, tránh truy vấn hai lần.
- Hệ quả của ô vàng (đã chạy thử ở mục chuẩn bị thì nói kết quả thật): theo logic code, tài khoản không phải admin sẽ không qua được tầng một ở các API Analysis. Hướng sửa là nạp vai trò workspace của user rồi gắn vào request trước khi dựng bộ quyền, giống cách module realtime và feedback đang tự làm bằng `resolveUserWorkspaceRole`.

**Chuyển.** Qua được hai guard, body của request mới được xem xét.

## Slide 7: Kiểm body bằng Zod (1:30)

**Chỉ vào** hai bảng schema, rồi khối JSON lỗi.

**Nói.** Mỗi API nhận body đều có một **schema Zod**. Bên trái là schema đăng ký: mật khẩu 8 đến 100 ký tự, họ tên 1 đến 50. Bên phải là schema cấu hình phân tích: tối đa 200 cột, `top_n` từ 1 đến 100.

Zod làm hai việc cùng lúc: **từ chối** dữ liệu sai và **điền mặc định** cho trường thiếu. Ví dụ không gửi phương pháp tương quan thì service nhận được pearson. Nhờ vậy trong service em không phải viết kiểm tra thiếu trường.

Khi sai, client nhận 400 kèm danh sách **từng trường sai và lý do**, đủ để giao diện tô đỏ đúng ô.

**Đào sâu.**
- Schema Zod cũng là nguồn sinh tài liệu Swagger qua decorator `ApiZodBody`, nên tài liệu và phần kiểm tra không lệch nhau.
- Email được chuyển chữ thường và cắt khoảng trắng ngay trong schema, nên `A@x.vn` và `a@x.vn` là một tài khoản.
- Ngoại lệ ở ô vàng: API nạp kết quả AI không gắn Zod ở cửa vào. Body của nó được kiểm bằng một schema nghiêm ngặt ở bước đối chiếu, em trình bày ở slide 30.

**Chuyển.** Chặng cuối của đường ống là hình dạng phản hồi.

## Slide 8: Khuôn phản hồi (1:15)

**Chỉ vào** hai khối JSON, rồi bốn thẻ mã lỗi.

**Nói.** Thành công luôn có dạng `success: true` và `data`. Lỗi luôn có dạng `success: false` và một đối tượng `error` gồm mã, thông điệp, chi tiết, thời điểm, đường dẫn. **Client chỉ cần viết một hàm xử lý phản hồi cho cả 22 API.**

Bốn mã hay gặp: `VALIDATION_ERROR` từ Zod, `LIMIT_EXCEEDED` khi vượt tần suất, `DUPLICATE_RESOURCE` khi MongoDB báo trùng khoá, và `INTERNAL_ERROR` cho lỗi chưa lường trước.

**Đào sâu.**
- Mã `DUPLICATE_RESOURCE` là lưới an toàn. Ví dụ hai request đăng ký cùng email tới gần như cùng lúc, cả hai đều qua bước kiểm trùng trong service, nhưng chỉ mục duy nhất của MongoDB chặn cái thứ hai, và bộ lọc đổi lỗi đó thành 409 thay vì 500.
- Lỗi 5xx ghi log kèm stack trace, lỗi 4xx ghi mức cảnh báo. Như vậy log lỗi thật không bị chìm trong lỗi do người dùng nhập sai.
- File PDF không bị bọc vào khuôn JSON: interceptor thấy header `Content-Disposition` thì trả nguyên trạng.

**Chuyển.** Đó là lớp chung. Giờ em vào module đầu tiên.

---

# Phần 2: Module Auth

## Slide 9: Mở phần 2 (0:15)

**Nói.** Auth có 11 API. Em đi theo vòng đời một tài khoản: tạo, đăng nhập, giữ phiên, và khôi phục mật khẩu.

## Slide 10: Cấu trúc Auth (1:30)

**Chỉ vào** bốn hàng cổng và adapter, rồi biểu đồ thanh bên phải.

**Nói.** `AuthService` chứa toàn bộ luật đăng nhập, nhưng nó **không gọi thẳng thư viện hay DB nào**. Nó chỉ biết bốn cổng: tra user, quản lý phiên, băm mật khẩu, phát token. Sau mỗi cổng là một adapter: hai adapter nối sang kho của module Users, một adapter bọc bcrypt, một adapter bọc JWT.

Lợi ích cụ thể: muốn đổi bcrypt sang thuật toán khác thì sửa đúng một file adapter. Và nhờ vậy về nguyên tắc có thể thay bốn cổng bằng bản giả để test mà không cần DB. Hiện nhóm em chưa viết test nào làm vậy cho Auth; test hiện có tập trung vào các hàm thuần của Analysis.

Bên phải là giới hạn tần suất riêng. Các API nhạy cảm bị siết từ 200 lần mỗi phút xuống **5 hoặc 10 lần mỗi giờ**, để chống dò mật khẩu và chống spam OTP.

**Đào sâu.**
- User và phiên thuộc quyền sở hữu của module Users. Auth đi qua adapter để ranh giới module không bị phá: Auth không biết Users lưu bằng Mongoose.
- Ghi nhận trung thực: một số hàm về OTP được service gọi qua ép kiểu chứ chưa khai trong kiểu của cổng một cách gọn gàng. Chức năng chạy đúng, nhưng phần kiểu cần dọn.

**Chuyển.** API đầu tiên là đăng ký.

## Slide 11: Đăng ký (1:15)

**Chỉ vào** bước 3, bước 4, bước 5.

**Nói.** Sáu bước. Kiểm body, chuẩn hoá email, **tìm email trùng thì trả 409**, băm mật khẩu bằng bcrypt 12 vòng, tạo user, trả 201.

Hai điểm đáng nói. Một, **mật khẩu gốc không bao giờ được lưu**, chỉ lưu bản băm. Hai, ở bước năm, **vai trò luôn bị ép về analyst**. Schema có nhận trường role, nhưng service bỏ qua giá trị gửi lên. Không có đường công khai nào để một người tự phong mình làm quản trị.

Đăng ký xong không trả token. Người dùng phải đăng nhập.

**Đào sâu.**
- 12 vòng nghĩa là hàm băm lặp 2 mũ 12 lần. Con số này cấu hình được qua `SALT_ROUNDS`. Tăng một vòng thì thời gian băm gấp đôi, đó là cách làm chậm tấn công dò mật khẩu khi DB bị lộ.
- bcrypt tự sinh salt riêng cho mỗi mật khẩu và nhúng vào bản băm, nên hai người cùng mật khẩu vẫn có bản băm khác nhau.
- Trường role trong schema là phần thừa nên gỡ, vì nó khiến người đọc tài liệu tưởng gửi admin là được.

**Chuyển.** Có tài khoản rồi thì đăng nhập.

## Slide 12: Đăng nhập (2:00)

**Chỉ vào** ba ô đỏ ở bước 1 đến 3, rồi bước 4 đến 6.

**Nói.** Đăng nhập có bảy bước, chia hai nửa.

Nửa đầu là **kiểm tra**: tìm user, kiểm tài khoản có bị khoá không, so mật khẩu. Thầy để ý bước một và bước ba trả **cùng một câu báo lỗi**, "email hoặc mật khẩu không chính xác". Nếu trả hai câu khác nhau, người ngoài dò được email nào đã đăng ký.

Nửa sau là **tạo phiên**. Bước bốn sinh refresh token là 40 byte ngẫu nhiên, và **DB chỉ lưu bản băm SHA-256 của nó**. Bước năm tạo bản ghi phiên kèm tên thiết bị, IP, hạn 7 ngày. Bước sáu ký access token hạn 15 phút, bên trong có `sessionId` trỏ về phiên vừa tạo.

**Đào sâu.**
- Refresh token sinh bằng `crypto.randomBytes`, bộ sinh ngẫu nhiên mật mã của Node. 40 byte viết dạng hex là chuỗi 80 ký tự, không đoán được.
- Vì sao mật khẩu dùng bcrypt còn refresh token dùng SHA-256: mật khẩu do người đặt nên ít ngẫu nhiên, cần hàm băm chậm. Refresh token đã ngẫu nhiên 320 bit nên không dò được, dùng hàm nhanh là đủ, và nó phải nhanh vì gia hạn diễn ra thường xuyên.
- Tên thiết bị suy ra từ user agent, dùng cho màn hình quản lý phiên ở slide 18.
- Thứ tự ba bước kiểm tra: kiểm khoá đặt trước so mật khẩu, nên tài khoản bị khoá nhận câu báo riêng mà không tốn một lần băm.

**Chuyển.** Kết quả của đăng nhập là hai token. Em đặt chúng cạnh nhau.

## Slide 13: Hai token (1:15)

**Chỉ vào** hai con số lớn, rồi dòng "Thu hồi" ở hai bảng.

**Nói.** Access token sống **15 phút**, là JWT, máy chủ không lưu, và **không thu hồi được**. Refresh token sống **7 ngày**, là chuỗi ngẫu nhiên, máy chủ lưu bản băm, và **thu hồi được ngay**.

Hai token bù cho nhau. Access token nhanh vì không cần tra DB để biết nó hợp lệ, nhưng vì không thu hồi được nên phải ngắn hạn. Refresh token dài hạn để người dùng không phải đăng nhập lại liên tục, nhưng vì dài hạn nên phải thu hồi được.

**Đào sâu.**
- Lợi ích của việc chỉ lưu bản băm: nếu bảng phiên bị lộ, kẻ tấn công không có refresh token gốc để dùng. Đây là cùng một nguyên tắc với lưu mật khẩu.
- Access token mang `role`. Nếu đổi vai trò của user thì token cũ vẫn mang vai trò cũ tối đa 15 phút. Tuy vậy slide 5 đã cho thấy guard nạp lại user từ DB ở mỗi request và dùng vai trò đọc từ DB, nên vai trò mới có hiệu lực ngay.

**Chuyển.** Khi access token hết hạn, client dùng refresh token để gia hạn.

## Slide 14: Gia hạn, nhánh bình thường (1:30)

**Chỉ vào** bước 4 và bước 5.

**Nói.** Client gửi refresh token lên. Backend băm nó, tìm phiên còn sống theo bản băm, kiểm user còn hoạt động. Rồi tới hai bước quan trọng: **thu hồi phiên cũ và tạo phiên mới** với một refresh token hoàn toàn mới.

Tức là **mỗi refresh token chỉ dùng được đúng một lần**. Kỹ thuật này gọi là xoay vòng token. Một token bị lộ chỉ có giá trị cho tới lần gia hạn kế tiếp.

**Đào sâu.**
- "Phiên còn sống" là ba điều kiện trong một truy vấn: khớp bản băm, chưa thu hồi, chưa hết hạn.
- Phiên mới sao chép thiết bị, IP, user agent của phiên cũ, và hạn 7 ngày được tính lại. Người dùng hoạt động đều thì không bao giờ bị đẩy ra; nghỉ quá 7 ngày thì phải đăng nhập lại.
- Hạn chế: thu hồi phiên cũ và tạo phiên mới là hai thao tác rời, chưa nằm trong một transaction. Nếu tiến trình chết đúng giữa hai thao tác, người dùng mất phiên và phải đăng nhập lại. Không gây lỗ hổng, chỉ gây phiền.

**Chuyển.** Vì mỗi token chỉ dùng một lần, backend phát hiện được một tình huống rất có giá trị.

## Slide 15: Phát hiện token bị dùng lại (2:00)

**Chỉ vào** bốn thẻ từ trái sang phải, rồi hai ô bên dưới.

**Nói.** Em kể theo bốn thẻ. Lần một, đăng nhập, được token A. Lần hai, gia hạn bằng A, A bị thu hồi, được token B. Lần ba, **A lại được gửi lên**.

Người dùng thật không bao giờ làm vậy, vì client của họ đã đổi sang B. A xuất hiện lần hai nghĩa là **có hai bên cùng giữ A**, tức token đã bị sao chép. Backend không biết bên nào là kẻ gian, nên phản ứng an toàn nhất: **thu hồi toàn bộ phiên của user đó**, kể cả B, ghi cảnh báo vào log, trả 401 với mã `TOKEN_INVALID`. Cả hai bên đều phải đăng nhập lại, và chỉ người biết mật khẩu mới vào được.

Còn token hoàn toàn lạ, không có trong DB, thì chỉ trả 401 với mã `TOKEN_EXPIRED`, không đụng tới phiên nào.

Ô vàng là một điểm em phát hiện khi đọc code. Bước tra lại tìm theo bản băm mà không xét trạng thái. Nên một token chỉ đơn thuần **quá hạn 7 ngày** cũng bị coi là dùng lại và làm thu hồi mọi phiên. Người dùng mở lại máy tính sau kỳ nghỉ sẽ bị đăng xuất ở cả điện thoại.

**Đào sâu.**
- Hai mã lỗi khác nhau để client xử lý khác nhau: `TOKEN_EXPIRED` thì đưa về màn đăng nhập bình thường, `TOKEN_INVALID` thì nên hiện cảnh báo bảo mật.
- Hướng sửa cho ô vàng là một điều kiện: chỉ coi là dùng lại khi phiên tìm thấy có cờ đã thu hồi. Phiên chưa thu hồi mà hết hạn thì trả `TOKEN_EXPIRED`.
- Cách làm này trùng với khuyến nghị về xoay vòng refresh token trong RFC 9700, đã có trong danh sách nguồn của deck trước.

**Chuyển.** Còn một tình huống nữa: người dùng quên mật khẩu.

## Slide 16: Quên mật khẩu (1:45)

**Chỉ vào** ô xanh ở bước 1, ô đỏ ở bước 3, rồi ô vàng.

**Nói.** API này có một yêu cầu lạ: **không được để lộ email nào có thật trong hệ thống**. Nên ở bước một, email không tồn tại hay tài khoản bị khoá, backend vẫn trả 200 với đúng một câu: nếu email tồn tại thì mã đã được gửi.

Với email có thật, backend xét **cửa sổ một giờ**: tối đa 5 lần xin mã, lần thứ sáu nhận 429 kèm số giây phải chờ. Rồi sinh OTP 6 chữ số, lưu **bản băm** của nó, hạn 10 phút. Xin mã mới thì mã cũ mất hiệu lực.

Ô vàng là hai hạn chế. Một, **chưa có gửi email**: OTP hiện chỉ ghi ra log máy chủ để vận hành thủ công. Hai, OTP sinh bằng `Math.random`, không phải bộ sinh ngẫu nhiên mật mã.

**Đào sâu.**
- Có hai lớp giới hạn chồng nhau. Lớp ngoài theo IP, 5 lần mỗi giờ, do guard tần suất. Lớp trong theo email, 5 lần mỗi giờ, đếm trong bản ghi user. Lớp trong chặn được kẻ đổi IP liên tục để spam một email.
- Thứ được băm là chuỗi ghép gồm email và OTP, không phải riêng OTP. Nếu chỉ băm OTP thì cả hệ thống chỉ có một triệu bản băm khả dĩ, lộ DB là tra ngược được ngay.
- Mọi lỗi bất ngờ trong hàm này đều bị nuốt và vẫn trả câu trung tính, cũng để không lộ thông tin qua thông điệp lỗi.
- Sửa `Math.random` là một dòng: đổi sang `crypto.randomInt`.

**Chuyển.** Có OTP rồi thì đặt lại mật khẩu.

## Slide 17: Đặt lại mật khẩu (1:30)

**Chỉ vào** năm ô đỏ, rồi dãy bộ đếm bên dưới.

**Nói.** Bảy bước, trong đó năm bước đầu là năm lớp kiểm tra: định dạng, có mã đang chờ không, tài khoản có bị khoá không, mã còn hạn không, mã có đúng không.

Phần đáng nói là bộ đếm bên dưới. OTP 6 chữ số chỉ có một triệu khả năng, nên phải giới hạn số lần thử. Sai lần một còn hai lần, sai lần hai còn một lần, **sai lần ba thì mã bị huỷ**, phải xin mã mới. Kẻ tấn công chỉ có ba lần đoán trên một triệu.

Khi đúng, bước sáu làm ba việc: băm mật khẩu mới, xoá OTP, và **thu hồi toàn bộ phiên**. Lý do: người ta đặt lại mật khẩu thường vì nghi tài khoản bị lộ, nên mọi thiết bị đang đăng nhập phải bị đẩy ra.

**Đào sâu.**
- Ghép ba giới hạn lại: 3 lần thử mỗi mã, 5 mã mỗi giờ, mỗi mã sống 10 phút. Tối đa 15 lần đoán mỗi giờ cho một email.
- Mã hết hạn cũng bị xoá ngay khi phát hiện, không để lại rác trong DB.
- So bản băm bằng phép so chuỗi thường. Vì thứ được so là bản băm chứ không phải OTP gốc, và số lần thử bị khoá ở ba, rủi ro tấn công theo thời gian ở đây thấp.

**Chuyển.** Còn sáu API ngắn hơn, em gom vào một slide.

## Slide 18: Sáu API còn lại (1:15)

**Chỉ vào** thẻ đổi mật khẩu, rồi ba thẻ phiên, rồi thẻ viền đứt.

**Nói.** Đổi mật khẩu khác đặt lại mật khẩu ở chỗ người dùng đang đăng nhập. Nên phải nhập đúng mật khẩu hiện tại, mật khẩu mới phải khác mật khẩu cũ, và backend **giữ phiên đang dùng, thu hồi mọi phiên khác**.

Ba API về phiên cho người dùng tự quản lý: đăng xuất là thu hồi phiên hiện tại, xem danh sách phiên đang sống, và thu hồi từ xa một phiên, ví dụ khi mất điện thoại.

Hai API đăng nhập Google **chưa làm**, trả 501.

Dòng cuối tóm lại ba sự kiện làm thu hồi phiên hàng loạt, thầy có thể dùng để đối chiếu.

**Đào sâu.**
- Thu hồi phiên từ xa luôn kèm điều kiện userId trong truy vấn, nên người này không thu hồi được phiên của người khác dù đoán được id phiên.
- Lỗi khi thu hồi các phiên khác không làm hỏng việc đổi mật khẩu: mật khẩu đã đổi là việc chính, thu hồi là việc phụ.

**Chuyển.** Hết Auth. Phần ba là phần lớn nhất.

---

# Phần 3: Module Analysis

## Slide 19: Mở phần 3 (0:15)

**Nói.** Analysis có 11 API và là nơi hệ thống thực sự phân tích dữ liệu.

## Slide 20: Cấu trúc Analysis (1:30)

**Chỉ vào** bốn thẻ từ trái sang phải, rồi dãy tám loại bản ghi.

**Nói.** Module chia bốn lớp. Cửa vào là ba controller. Điều phối là các service. Lớp thứ ba là điểm em muốn nhấn: **toàn bộ phép tính nằm trong các hàm thuần** ở thư mục domain. Hàm thuần nghĩa là nhận dữ liệu vào, trả kết quả ra, không gọi DB, không gọi mạng. Lớp thứ tư là hai worker chạy nền cho AI và PDF.

Tách như vậy để **phần quan trọng nhất, tức công thức, kiểm thử được độc lập**: đưa một mảng số vào, so kết quả, không cần dựng DB.

Bên dưới là tám loại bản ghi module ghi xuống, em sẽ nhắc tới từng loại ở các slide sau.

**Đào sâu.**
- AI được gọi qua một cổng trừu tượng `AiInferencePort`. Adapter hiện tại nói chuyện với Ollama khi phát triển hoặc vLLM khi triển khai, cả hai đều chạy cục bộ. Đổi engine là đổi biến `AI_ENGINE`, không sửa service.
- Service chỉ biết cổng kho dữ liệu, không import Mongoose.

**Chuyển.** Trước khi phân tích, người dùng nói cho hệ thống biết cột nào đóng vai gì.

## Slide 21: Cấu hình phân tích (1:15)

**Chỉ vào** bước 3 và bước 4, rồi bước 6.

**Nói.** Người dùng chọn bốn thứ: các cột cần phân tích, cột nhãn, cột thời gian, cột giá trị. Backend kiểm từng thứ **theo kiểu dữ liệu của cột**. Cột nhãn phải là phân loại, vì không ai tính mất cân bằng lớp trên một cột số liên tục. Cột thời gian phải là kiểu ngày. Cột giá trị phải là số.

Bước sáu là điểm thiết kế: lưu cấu hình xong, **mọi kết quả phân tích cũ bị đánh dấu hết hạn**. Kết quả cũ không bị xoá, nhưng giao diện biết nó được tính với cấu hình khác và không còn đáng tin.

**Đào sâu.**
- Mỗi project có đúng một bản cấu hình, lưu kiểu ghi đè.
- Tên cột lạ bị lọc bỏ lặng lẽ; chỉ khi không còn cột nào khớp mới trả 400. Cách này chịu được trường hợp dataset đổi tên cột sau khi cấu hình đã lưu.

**Chuyển.** Giờ tới API trung tâm của cả hệ thống.

## Slide 22: Chạy phân tích, toàn cảnh (2:00)

**Chỉ vào** hàng "Trong request" từ 1 tới 7, hàng "Client" ở ô 201, rồi hàng "Chạy nền".

**Nói.** Đây là slide quan trọng nhất của phần ba. Một lần bấm phân tích gồm mười bước, nhưng chia **hai giai đoạn tách hẳn nhau**.

Bảy bước đầu chạy **ngay trong request**: chuẩn bị cột, đọc dữ liệu, tính tương quan và VIF, bốn phép kiểm chất lượng, thống kê, ghi bằng chứng, lưu. Xong bước bảy, client nhận 201 với **toàn bộ kết quả của hệ thống**.

Ba bước sau chạy **nền**: worker nhận job, gọi AI, đối chiếu và gắn nhận xét. Client theo dõi bằng cách hỏi trạng thái job.

Lý do tách: phép tính của hệ thống nhanh và xác định, còn AI chậm và có thể hỏng. Nhóm em đặt nguyên tắc **AI hỏng không được làm hỏng kết quả hệ thống**. Người dùng luôn có số liệu trước, nhận xét AI là phần cộng thêm.

**Đào sâu.**
- Hạn chế cần nói thẳng: bước hai **đọc toàn bộ dòng của dataset vào bộ nhớ** rồi mới tính. Với file vài chục nghìn dòng thì ổn. Với file hàng triệu dòng thì cả thời gian phản hồi lẫn bộ nhớ đều không chịu được. Hướng cải tiến là đưa cả phần tính toán vào hàng chờ giống AI, hoặc tính theo luồng.
- Khi phép tính lỗi giữa chừng, lần chạy được đánh dấu failed kèm mã lỗi và thời lượng rồi mới ném lỗi ra. Không có lần chạy nào kẹt mãi ở trạng thái đang chạy vì lỗi tính toán.
- Sự kiện realtime được bọc riêng: nếu kênh realtime hỏng thì chỉ mất thông báo, kết quả vẫn được lưu và trả về.

**Chuyển.** Em đi lần lượt vào từng bước.

## Slide 23: Chốt cột và dấu vân tay (1:30)

**Chỉ vào** dãy ưu tiên chọn cột, rồi hình bốn đầu vào gộp thành một chuỗi băm.

**Nói.** Bước một có hai việc.

Việc thứ nhất là chốt cột theo thứ tự ưu tiên: cột gửi trong body, nếu không có thì cấu hình đã lưu, nếu vẫn không có thì mọi cột suy luận được. Cột ngày bị loại khỏi tương quan và VIF.

Việc thứ hai là tính **dấu vân tay đầu vào**. Backend gộp bốn thứ: id dataset, checksum của file, số dòng, và cấu hình chạy, rồi băm SHA-256. **Cùng dữ liệu và cùng cấu hình thì luôn ra cùng một dấu vân tay.**

Dấu vân tay này được gắn vào lần chạy, kết quả, AI job và bản tổng kết. Nó trả lời câu hỏi: kết quả này được tính từ đúng dữ liệu nào, với đúng cấu hình nào.

**Đào sâu.**
- Có checksum file trong dấu vân tay nên tải lại file khác cùng tên, cùng số dòng vẫn ra dấu vân tay khác.
- Hiện tại dấu vân tay mới dùng để truy vết và so khớp, **chưa dùng để bỏ qua tính lại**. Chạy hai lần với cùng đầu vào vẫn tính hai lần. Đây là chỗ có thể tối ưu: thấy dấu vân tay trùng với một kết quả còn hạn thì trả luôn kết quả đó.
- Nếu không cấu hình cột thời gian mà dataset có đúng một cột ngày thì backend tự dùng cột đó. Có từ hai cột ngày trở lên thì không đoán.

**Chuyển.** Có cột rồi, bước tiếp là bốn phép kiểm chất lượng.

## Slide 24: Bốn phép kiểm (2:30)

**Chỉ vào** bảng dữ liệu minh hoạ: ô vàng, ô đỏ, hai dòng tím, ô xanh. Rồi trục số bên dưới.

**Nói.** Em dùng bảng sáu dòng bên trái để minh hoạ, đây là dữ liệu em tự đặt.

Dòng hai, ô tuổi **trống**: đó là DQ-01, thiếu. Định nghĩa của nhóm em rất chặt: chỉ null, rỗng, hoặc toàn khoảng trắng mới là thiếu. Số 0 và false là giá trị hợp lệ, không phải thiếu.

Dòng ba, lương ghi **abc**: đó là DQ-03, sai kiểu, vì cột này đã được chốt là số.

Dòng bốn và năm **giống hệt nhau**: đó là DQ-02, trùng. So khớp chính xác trên toàn bộ cột được chọn.

Dòng sáu, lương **98000**: đó là DQ-04, ngoại lai. Thầy nhìn trục số bên dưới: hộp xanh là khoảng từ Q1 tới Q3, hai vạch đỏ là hàng rào cách hộp 1,5 lần IQR. Điểm nào nằm ngoài hàng rào là ngoại lai.

Còn DQ-05, quy tắc nghiệp vụ, hệ thống **luôn ghi là chưa đánh giá**, vì chưa có quy tắc nào được người dùng xác nhận. Nhóm em chọn không đoán.

**Đào sâu.**
- Ranh giới giữa thiếu và sai kiểu: các chuỗi như NA, null, none, gạch ngang không phải ô trống nên không vào DQ-01, mà bị đếm ở DQ-03. Lý do: có người đã cố tình gõ gì đó vào ô, khác với ô bị bỏ trống.
- Trùng dòng: dòng thiếu sạch mọi cột không được gom thành nhóm trùng, nếu không một trăm dòng trống sẽ thành một nhóm trùng khổng lồ vô nghĩa. Số dòng trùng là kích thước nhóm trừ một, tức số dòng thừa.
- Ngoại lai có hai phương pháp, người dùng chọn một hoặc cả hai. IQR dùng tứ phân vị. Modified Z-score dùng trung vị và MAD thay cho trung bình và độ lệch chuẩn, công thức là 0,6745 nhân với độ lệch so với trung vị rồi chia cho MAD, ngưỡng 3,5. Cả hai đều dựa trên trung vị nên chính các điểm ngoại lai không làm lệch ngưỡng.
- Hai trường hợp từ chối kết luận: ít hơn 4 giá trị, hoặc IQR bằng 0 hay MAD bằng 0, tức dữ liệu không đủ phân tán. Khi đó kết quả ghi lý do thay vì báo "không có ngoại lai".
- Hàng rào 3 lần IQR cũng được tính và lưu riêng thành nhóm ngoại lai cực đoan.

**Chuyển.** Bốn phép kiểm nhìn từng cột. Bước tiếp nhìn quan hệ giữa các cột.

## Slide 25: Tương quan và VIF (2:00)

**Chỉ vào** bảng ba nhân ba, rồi hai thanh màu bên phải.

**Nói.** Không có một phép đo tương quan nào dùng được cho mọi kiểu cột. Nên backend **chọn phép đo theo cặp kiểu**. Hai cột số thì Pearson hoặc Spearman. Hai cột phân loại thì Cramér's V. Một số một phân loại thì eta bình phương. Cột ngày bị loại và có ghi lý do.

Mỗi ô ma trận không chỉ lưu hệ số. Nó lưu **số cặp giá trị thực sự dùng được**, và ba con số mất mẫu. Một hệ số 0,9 tính trên 5 cặp và 0,9 tính trên 5000 cặp có độ tin cậy rất khác nhau, nên con số n luôn đi kèm.

Bên phải là VIF, đo mức một cột số bị các cột số khác giải thích. Trên 5 thì cần xem lại, trên 10 là đa cộng tuyến cao.

Thanh dưới là cảnh báo mất mẫu. VIF chỉ tính được trên các dòng đủ giá trị ở mọi cột số. Nếu vì ô thiếu mà mất từ 20% số dòng thì cảnh báo đọc thận trọng, từ 50% thì cảnh báo VIF kém tin.

**Đào sâu.**
- Pearson đo quan hệ tuyến tính. Spearman tính trên thứ hạng nên bắt được quan hệ đơn điệu không tuyến tính và ít nhạy với ngoại lai. Người dùng chọn.
- Cramér's V và eta bình phương nằm trong khoảng 0 tới 1, không có dấu. Prompt gửi AI có nhắc rõ điều này để AI không diễn giải là tương quan âm.
- Ngưỡng tối thiểu: cặp số cần ít nhất 3 cặp giá trị, hai loại còn lại cần ít nhất 4. Không đủ thì ô ghi lý do, không ghi hệ số.
- VIF của một cột bằng 1 chia cho 1 trừ R bình phương, với R bình phương là mức các cột còn lại giải thích được cột đó. Cột hằng bị loại vì không có phương sai. Khi hai cột phụ thuộc tuyến tính hoàn hảo thì ma trận suy biến, backend phát hiện và ghi lý do thay vì trả một con số vô nghĩa.

**Chuyển.** Còn ba nhóm thống kê bổ sung.

## Slide 26: Ba thống kê bổ sung (1:15)

**Chỉ vào** ba thẻ lần lượt; ở thẻ giữa chỉ hai thanh, ở thẻ phải chỉ ô "kỳ trống".

**Nói.** Thẻ một là thống kê mô tả cho từng cột. Thẻ hai là mất cân bằng nhãn: lấy lớp lớn nhất chia lớp nhỏ nhất, **từ 3 trở lên thì cảnh báo**. Thẻ ba là phân tích theo thời gian: gom theo ngày, tuần, tháng hoặc năm, rồi tìm **kỳ trống** và **kỳ biến động mạnh**.

Điểm chung của cả ba: ô thiếu và ô sai kiểu được **tách ra và đếm**, không bị xoá, không bị điền thay. Nguyên tắc của hệ thống là dữ liệu chỉ đọc.

**Đào sâu.**
- Ngưỡng 3 của tỉ số mất cân bằng là ngưỡng của dự án, không phải chuẩn chung. Chính báo cáo PDF cũng ghi rõ câu này ở phụ lục.
- Mất cân bằng có năm trạng thái, không chỉ có hoặc không: chưa chọn nhãn, nhãn là số liên tục nên không áp dụng, không có giá trị nhãn hợp lệ, chỉ có một lớp, và đã đánh giá.
- Kỳ biến động được sàng bằng chính phương pháp IQR, áp trên dãy mức thay đổi giữa các kỳ liền nhau.

**Chuyển.** Tính xong, backend khép phần đồng bộ lại.

## Slide 27: Ghi bằng chứng và lưu (1:30)

**Chỉ vào** bước 1, bước 4, bước 6, rồi ô vàng.

**Nói.** Bước một ghi **bằng chứng tới từng ô**. Hệ thống không chỉ nói cột lương có 12 ô sai, mà lưu lại dòng nào, cột nào, loại lỗi gì, lý do gì. Mỗi cột tối đa 20 bằng chứng, và giá trị được che trước khi lưu.

Rồi đóng lần chạy, lưu kết quả với phần nhận xét AI ở trạng thái pending. Bước bốn **tạo AI job** vào hàng chờ. Bước năm đánh dấu kết quả của các lần chạy trước là hết hạn. Bước sáu trả 201 kèm đường dẫn để hỏi trạng thái job.

Ô vàng: giới hạn 20 tính chung cho mọi loại lỗi của một cột. Cột đã có 20 ô thiếu thì hết chỗ cho bằng chứng ngoại lai.

**Đào sâu.**
- Giới hạn 20 để bảng bằng chứng không phình theo số dòng. Kết quả tổng hợp vẫn có con số đầy đủ; bằng chứng chỉ là mẫu để người dùng mở ra xem. Kết quả có cờ `capped` cho biết mẫu đã bị cắt.
- Hướng sửa ô vàng là đếm giới hạn theo cặp cột và loại lỗi thay vì chỉ theo cột.
- Bằng chứng trùng dòng không gắn vào cột nào mà gắn vào một cột ảo đại diện cho cả dòng.
- Lỗi khi ghi bằng chứng được nuốt, không làm hỏng lần chạy: số liệu tổng hợp quan trọng hơn mẫu minh hoạ.

**Chuyển.** Từ đây là giai đoạn chạy nền. Việc đầu tiên là chuẩn bị thứ gửi cho AI.

## Slide 28: Che dữ liệu và dựng prompt (2:00)

**Chỉ vào** bảng trái, đặc biệt dòng cuối. Rồi chồng sáu khối bên phải.

**Nói.** Trước khi một giá trị nào đi vào prompt, nó phải qua bộ che. Bảng trái là năm ví dụ em tự đặt. Email, số điện thoại, dãy 9 đến 13 chữ số, và mọi ô thuộc cột người dùng đánh dấu nhạy cảm đều bị thay bằng ba dấu sao.

Dòng cuối là điểm thiết kế quan trọng. Giá trị **không khớp luật nào** thì không được gửi nguyên, mà **bị loại khỏi prompt**. Đây là mặc định an toàn: cái gì không chắc chắn che được thì không gửi.

Hệ quả là AI **không đọc giá trị gốc**. Nó đọc các con số hệ thống đã tính: ma trận, VIF, số dòng dùng được.

Bên phải là sáu khối của prompt. Khối đầu là luật cấm: không tính lại hệ số, không bịa số, không kết luận nhân quả, không đòi xoá cột. Khối thứ năm là ví dụ lấy từ phản hồi của chính người dùng. Khối cuối ép AI trả đúng một JSON bốn khoá.

**Đào sâu.**
- AI chạy cục bộ, vậy vì sao vẫn che: prompt có thể bị ghi log, bị lưu, và model có thể lặp lại giá trị trong câu trả lời. Adapter gọi AI cũng không ghi prompt ra log, chỉ ghi độ dài và thời lượng.
- Luật dãy 9 đến 13 chữ số nhằm bắt số căn cước, nhưng nó cũng che luôn các số nguyên lớn không nhạy cảm. Đây là che thừa có chủ ý: che nhầm thì mất một mẫu, lọt thì lộ dữ liệu.
- Khối ví dụ là cơ chế RAG. Backend tìm tối đa 5 ví dụ giống nhất bằng độ tương đồng cosine, chỉ lấy ví dụ có độ tin cậy từ 0,6, không cũ quá 180 ngày, cùng ngôn ngữ, cùng workspace. Độ tin cậy tăng theo số người cùng đồng ý với một nhận xét.
- Ghi nhận trung thực về RAG: vector hiện được tạo bằng một hàm băm xác định chạy ngay trong tiến trình, chưa phải mô hình embedding. Nó bắt được trùng từ khoá, chưa bắt được gần nghĩa. Thay bằng mô hình embedding cục bộ là bước tiếp theo.
- Lấy ví dụ bị lỗi thì khối này để trống và AI vẫn chạy.

**Chuyển.** Prompt sẵn sàng. Ai gửi nó đi, và nếu hỏng thì sao?

## Slide 29: Vòng đời AI job (2:15)

**Chỉ vào** sơ đồ: pending, mũi tên sang running, ba nhánh phải, rồi đường cong quay lại. Sau đó bốn con số.

**Nói.** Mỗi AI job là một bản ghi có trạng thái. Nó bắt đầu ở **pending**. Worker quét hàng chờ mỗi **10 giây**, nhận job cũ nhất và chuyển sang **running**.

Từ running có bốn lối ra. AI trả JSON và đối chiếu đạt thì **succeeded**. Lỗi mà còn lượt thì theo đường cong **quay lại hàng chờ**. Hết lượt thì **failed**. Và nếu worker chết giữa chừng thì job thành **skipped**.

Trường hợp cuối cần cơ chế riêng. Khi nhận job, worker **thuê** nó 10 phút, và trong lúc làm cứ đều đặn gửi **nhịp tim** để gia hạn. Worker chết thì nhịp tim dừng, hạn thuê trôi qua, và lượt quét sau phát hiện job này bị bỏ rơi. Không có job nào kẹt mãi ở running.

Mỗi lần gọi model có thời hạn **180 giây**. Tổng cộng **3 lần**: một lần đầu và hai lần thử lại.

Ô vàng: worker mặc định tắt. Và em phát hiện một hành vi chưa đúng: khi AI trả về thứ không phải JSON, job kết thúc ở succeeded với nhận xét trống, lẽ ra phải là failed.

**Đào sâu.**
- Nhận job là một thao tác nguyên tử của MongoDB: tìm và cập nhật trong một lệnh. Nếu sau này chạy hai worker, không có chuyện cả hai cùng nhận một job.
- Gọi model với nhiệt độ 0 và ép định dạng JSON, để cùng một prompt cho câu trả lời ổn định nhất có thể.
- Mỗi lượt quét chỉ xử lý một job. Model chạy cục bộ, chạy song song sẽ tranh bộ nhớ.
- Nguyên nhân của hành vi trong ô vàng: ở nhánh xử lý lỗi, worker gọi lại hàm nạp kết quả với một đối tượng rỗng để ghi nhận thất bại, nhưng đối tượng rỗng lại hợp lệ theo schema vì mọi trường đều có mặc định, nên bộ đối chiếu trả succeeded. Sửa bằng cách ghi thẳng trạng thái failed thay vì nạp đối tượng rỗng.
- Hàng chờ hiện là bảng trong MongoDB được quét định kỳ, chạy trong cùng tiến trình với API. Phù hợp quy mô đồ án. Đích thiết kế là tách worker riêng qua biến `WORKER_MODE` và dùng Kafka.

**Chuyển.** AI trả lời rồi. Nhưng hệ thống chưa tin ngay.

## Slide 30: Đối chiếu câu trả lời AI (2:00)

**Chỉ vào** ba dòng trong bảng, rồi ba thẻ API bên phải.

**Nói.** Model ngôn ngữ có thể bịa số. Nên nguyên tắc ở đây là: **AI nói gì cũng phải khớp với số hệ thống đã tính**. Em minh hoạ bằng ba nhận định tự đặt.

Dòng một: AI nói tuổi và lương tương quan 0,82, ma trận cũng ghi 0,82. **Giữ**, và con số hiển thị là số của hệ thống chứ không phải số AI viết.

Dòng hai: AI nói 0,95, ma trận ghi 0,41. Lệch quá 0,01. **Bỏ.**

Dòng ba: AI nói VIF cột tuổi cao, nhưng hệ thống xếp cột đó ở mức ổn. **Bỏ.**

Mọi nhận định bị bỏ đều được ghi lại, không biến mất lặng lẽ. Còn nếu câu trả lời sai hẳn cấu trúc, thừa khoá hoặc sai kiểu, thì hỏng toàn bộ, hệ thống không cố sửa.

Bên phải là ba API về job: xem trạng thái, thử lại, và nạp kết quả thủ công. API thứ ba đi qua đúng bộ đối chiếu này.

**Đào sâu.**
- Kỹ thuật này gọi là grounding. AI ở đây đóng vai người diễn giải: chọn ra cặp nào đáng chú ý và viết lời, còn con số thuộc trách nhiệm của hệ thống.
- Schema kiểm câu trả lời ở chế độ nghiêm ngặt: có khoá lạ là từ chối. Lý do là không đoán ý AI.
- Phần giới hạn và bước tiếp theo AI viết bằng lời thì được giữ nguyên, vì không có số để đối chiếu. Đây là phần duy nhất của câu trả lời AI không được kiểm chứng, và prompt đã cấm AI kết luận nhân quả ở đó.
- Hạn chế ở ô vàng: API thử lại không xét trạng thái hiện tại, nên có thể đưa một job đang chạy hoặc đã thành công về hàng chờ. Sửa bằng một điều kiện chỉ cho thử lại job ở trạng thái failed hoặc skipped.
- API nạp thủ công chỉ đòi quyền chạy Analysis. Về lâu dài nên là API nội bộ dành riêng cho worker.

**Chuyển.** Người dùng đã có số liệu và nhận xét. Hai bước cuối là gói lại.

## Slide 31: Tổng kết (1:15)

**Chỉ vào** hai ô đỏ, rồi bước 3 và bước 4.

**Nói.** Tổng kết chỉ tạo được khi lần chạy mới nhất đã thành công. Rồi backend đọc kết quả và gom thành danh sách vấn đề: mỗi cột có thiếu, sai kiểu hoặc ngoại lai là một mục, trùng dòng là một mục cho cả bảng. Xếp theo số lượng giảm dần, giữ tối đa 50.

Bản tổng kết là một **bản chụp**. Nó được lưu riêng kèm dấu vân tay. Chạy phân tích lại sau đó cũng không làm bản tổng kết cũ thay đổi, chỉ khi tạo bản mới thì bản cũ mới bị đánh dấu hết hạn.

**Đào sâu.**
- Phần AI chỉ được đính kèm khi AI job đã succeeded. AI còn đang chạy hoặc đã hỏng thì bản tổng kết vẫn tạo được, phần AI để trống. Vẫn là nguyên tắc AI không chặn hệ thống.
- Hai khuyến nghị hiện là câu cố định viết sẵn trong code, chưa sinh theo dữ liệu. Em nói rõ để thầy không hiểu là AI viết.

**Chuyển.** Cuối cùng là xuất PDF.

## Slide 32: Báo cáo PDF (1:30)

**Chỉ vào** bước 2, ba ô tím, rồi ô xanh ở bước 6.

**Nói.** Dựng PDF tốn thời gian, nên API **không dựng**. Nó chỉ tạo một yêu cầu và trả **202** ngay, nghĩa là đã nhận, chưa xong.

Ba ô tím là phần của worker: nhận job, dựng PDF, đẩy file lên kho lưu trữ. Dựng lỗi thì job thành failed kèm mã lỗi.

Khi tải, nếu file chưa xong thì client nhận 202 kèm trạng thái và hỏi lại sau. Nếu xong thì nhận luồng PDF, và mỗi lần tải thành công được **ghi vào nhật ký kiểm toán**: ai tải, từ IP nào, file bao nhiêu byte.

**Đào sâu.**
- Đây là cùng một mẫu với AI job: việc chạy lâu thì trả 202 kèm đường dẫn để hỏi, công việc là bản ghi có trạng thái, worker quét hàng chờ.
- File không nằm trong MongoDB. DB chỉ giữ khoá file và dung lượng. Kho file là dịch vụ tương thích S3 nếu đã cấu hình `S3_ENDPOINT`, còn không thì ghi ra đĩa cục bộ của máy chủ.
- PDF có phụ lục ghi lại mọi ngưỡng đã dùng. Người đọc báo cáo không cần mở hệ thống để biết "ngoại lai" được định nghĩa thế nào.
- Hạn chế so với AI job: report job chưa có cơ chế thuê và nhịp tim. Worker chết giữa lúc dựng thì job kẹt ở running. Nên áp cùng cơ chế của AI worker.

**Chuyển.** Em nối tất cả lại.

---

# Kết

## Slide 33: Một hành trình (1:15)

**Chỉ vào** sáu ô từ trái sang phải, rồi ba thẻ bên dưới.

**Nói.** Sáu bước này là một hành trình đầy đủ của người dùng, và mỗi bước là một API em vừa trình bày: đăng nhập, cấu hình, phân tích, AI nhận xét, tổng kết, báo cáo.

Em tóm lại ba ý. Lớp chung cho mọi API **một đường ống và một khuôn phản hồi**. Auth dùng **token ngắn hạn, phiên xoay vòng, và phát hiện token bị dùng lại**. Analysis theo nguyên tắc **hệ thống tính trước và chịu trách nhiệm về con số, AI chỉ diễn giải và bị đối chiếu**.

Những chỗ chưa hoàn thiện em đã ghi trong các ô vàng. Em xin dừng ở đây và mời thầy đặt câu hỏi.

---

# Bản rút gọn 25 phút

Giữ các slide: 1, 2, 4, 5, 6, 10, 12, 13, 14, 15, 17, 20, 22, 24, 25, 28, 29, 30, 32, 33.

Lướt nhanh trong một câu: 7, 8, 11, 16, 18, 21, 23, 26, 27, 31. Bỏ qua ba slide mở phần.

---

# Câu thầy có thể hỏi

### Lớp chung

**Vì sao giới hạn tần suất đặt trước xác thực?**
Để request rác bị chặn trước khi tốn một lần truy vấn DB kiểm user. Nếu đặt sau thì chính bước xác thực trở thành điểm bị tấn công làm nghẽn.

**Mỗi request đều truy vấn DB để nạp user, có chậm không?**
Là một truy vấn theo khoá chính, rất nhanh. Đổi lại, khoá tài khoản có hiệu lực ngay. Nếu thành nút cổ chai thì thêm cache ngắn hạn.

**Giới hạn tần suất lưu ở đâu, chạy nhiều máy thì sao?**
Hiện bộ đếm nằm trong bộ nhớ của tiến trình. Chạy nhiều bản thì mỗi bản đếm riêng, giới hạn thực tế bị nhân lên. Cần chuyển bộ đếm sang Redis khi mở rộng.

**Phân quyền hiện tại có chạy đúng không?**
Trả lời theo kết quả chạy thử ở mục chuẩn bị. Nếu analyst bị 403: nói thẳng bộ khung ba tầng và luật quyền đã có, phần gắn vai trò workspace vào request chưa nối, và hướng sửa là dùng `resolveUserWorkspaceRole` như module feedback đang làm.

### Auth

**Vì sao không lưu JWT làm refresh token luôn?**
Refresh token cần thu hồi được, mà muốn thu hồi thì đằng nào cũng phải tra DB. Khi đã tra DB thì chuỗi ngẫu nhiên là đủ, lại không mang thông tin gì để lộ.

**Client lưu hai token ở đâu?**
Đó là phần frontend, backend chỉ trả về trong body. Em không trả lời thay phần frontend; nếu thầy hỏi sâu thì em xin kiểm tra lại code frontend.

**Hai request gia hạn cùng một token tới cùng lúc thì sao?**
Cả hai có thể cùng tìm thấy phiên còn sống trước khi cái nào kịp thu hồi, và cùng được cấp phiên mới. Đây là điều kiện đua mà code hiện chưa chặn. Sửa bằng cách thu hồi theo kiểu tìm và cập nhật nguyên tử, chỉ request nào đổi được cờ mới được đi tiếp.

**Access token vẫn dùng được sau khi đăng xuất, có chấp nhận được không?**
Trong 15 phút. Với đồ án em chấp nhận và ghi rõ. Hướng đóng: kiểm phiên theo `sessionId` trong token ở bước xác thực.

**OTP ghi ra log có phải lỗ hổng không?**
Có, nếu triển khai thật. Hiện là giải pháp tạm vì chưa có dịch vụ gửi email. Khi có adapter email thì bỏ dòng log đó.

**Vì sao đổi mật khẩu giữ phiên hiện tại còn đặt lại mật khẩu thì thu hồi hết?**
Đổi mật khẩu được thực hiện bởi người đang đăng nhập và đã chứng minh biết mật khẩu cũ, nên phiên đó đáng tin. Đặt lại mật khẩu thì người thực hiện chỉ chứng minh được là đọc được email, và thường xảy ra khi nghi bị lộ, nên không phiên nào đáng tin.

### Analysis

**Dataset một triệu dòng thì API phân tích chạy bao lâu?**
Em chưa đo ở quy mô đó nên không đưa con số. Điều chắc chắn là toàn bộ dòng được đọc vào bộ nhớ và tính trong request, nên đây là giới hạn rõ nhất của thiết kế hiện tại. Hướng sửa là đưa phần tính toán vào hàng chờ như AI.

**Vì sao tự viết công thức mà không gọi thư viện Python?**
Để cả backend là một ngôn ngữ, một tiến trình, không thêm dịch vụ. Các hàm là hàm thuần và có file kiểm thử riêng cho tương quan, VIF và đối chiếu AI. Phần trung vị dùng thư viện `simple-statistics`.

**Ngưỡng 1,5 lần IQR và 3,5 lấy từ đâu?**
1,5 lần IQR là quy ước hàng rào của Tukey. 3,5 với hằng số 0,6745 là ngưỡng khuyến nghị cho Modified Z-score của Iglewicz và Hoaglin. Em chưa đưa hai nguồn này vào deck; nếu thầy cần em bổ sung link đã kiểm.

**VIF trên 5 và trên 10 lấy từ đâu?**
Là hai ngưỡng kinh nghiệm thường gặp trong tài liệu hồi quy, không phải chuẩn tuyệt đối. Hệ thống dùng chúng để gắn nhãn "xem lại" và "cao", không tự động loại cột nào.

**AI có thể bịa trong phần lời văn không?**
Có thể. Phần số bị đối chiếu, phần lời văn về giới hạn và bước tiếp theo thì không kiểm được bằng máy. Biện pháp hiện có là luật cấm trong prompt và nhiệt độ 0. Biện pháp tiếp theo là để người dùng đánh giá, và phản hồi đó quay lại thành ví dụ qua RAG.

**Sai lệch 0,01 có quá chặt không?**
Hệ số được làm tròn bốn chữ số thập phân. 0,01 cho phép AI làm tròn tới hai chữ số mà vẫn khớp, nhưng không cho phép nhầm sang ô khác.

**Vì sao hàng chờ dùng MongoDB mà không dùng Redis hay Kafka?**
Quy mô đồ án mỗi lúc chỉ có vài job, và model cục bộ chỉ chạy được một việc mỗi lần. Bảng trong MongoDB với thao tác nhận job nguyên tử là đủ và không thêm hạ tầng. Kafka là đích khi tách worker ra nhiều máy.

**Worker tắt mặc định thì demo thế nào?**
Bật hai biến `AI_WORKER_ENABLED` và `REPORT_WORKER_ENABLED`. Mặc định tắt để máy không có model vẫn chạy được phần còn lại của hệ thống.

**Kết quả hết hạn nghĩa là gì, có bị xoá không?**
Không xoá. Chỉ gắn cờ kèm lý do. Giao diện dựa vào cờ để báo người dùng rằng kết quả được tính với cấu hình hoặc dữ liệu cũ.

### Câu mở

**Nếu làm lại, em sửa gì trước?**
Theo thứ tự rủi ro: một là nối vai trò workspace vào phân quyền; hai là sửa nhánh token quá hạn bị coi là dùng lại; ba là sửa trạng thái job khi AI trả sai định dạng; bốn là đưa phần tính toán ra khỏi request.

**Phần nào em tự tin nhất?**
Chuỗi che dữ liệu, dựng prompt, đối chiếu. Mỗi mắt xích đều có mặc định an toàn: không che được thì không gửi, sai cấu trúc thì từ chối, không khớp số thì bỏ.
