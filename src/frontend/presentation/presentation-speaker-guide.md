# PROJECT PRESENTATION SPEAKER GUIDE

## 1. Presentation Overview

Hướng dẫn này theo đúng 42 slide của [bản HTML](index.html). Người mới vào nhóm có thể bắt đầu bằng ví dụ sau: một analyst có file CSV, cần đưa vào workspace, xem các cột và dòng, tìm vấn đề chất lượng rồi báo cáo cho người có trách nhiệm. Bài trình bày đi từ công việc đó đến mã nguồn, giao tiếp backend và bằng chứng nghiệm thu.

- **Đối tượng.** Thành viên nhóm trình bày trước giảng viên, hội đồng hoặc người nghe có nền tảng kỹ thuật khác nhau.
- **Cách dùng.** Mục 3 dùng để học và chuẩn bị câu hỏi. Mục 4 là bản luyện nói theo đúng số slide. Các đoạn chuyển tiếp báo lúc đổi slide. Dùng phím mũi tên trong bản HTML.
- **Trạng thái bằng chứng.** IMPLEMENTED nghĩa là tìm thấy triển khai. TESTED nghĩa là có kết quả từ một lần chạy xác định. VERIFIED hoặc VERIFIED LIVE cần bằng chứng tương ứng với kết luận, như phép đếm từ snapshot hoặc log chạy backend thật. MOCKED dùng fixture hoặc adapter giả. PARTIAL có một phần luồng. PLANNED là việc dự kiến. UNKNOWN hoặc UNVERIFIED nghĩa là chưa đủ bằng chứng. NOT FOUND chỉ có nghĩa trong phạm vi đã rà.
- **Cách nói khi slide lệch source.** Dùng lời thoại đã hiệu chỉnh. Nhãn `[NEEDS VERIFICATION: …]` ghi việc cần xác minh trước khi dùng thông tin tương ứng làm bằng chứng. Ví dụ minh họa như cột email hay hai người sửa workspace giúp giải thích khái niệm.

## 2. Presentation Narrative

Mạch kể đi từ bài toán CSV và người sử dụng, sang cách dựng UI nhất quán, cách chia code và quản lý phiên, rồi theo người dùng đi từ workspace đến báo cáo sự cố. Nửa sau giải thích request, contract, loại kiểm thử và điều kiện bàn giao.

| Chương | Slide | Mạch trình bày | Ngân sách nói và thao tác |
| --- | --- | --- | --- |
| 1. Tổng quan và mức bằng chứng | 01–04 | Đặt bài toán và xác định mức chắc chắn. | 3:30 |
| 2. Design System | 05–07 | Giải thích màu, chữ và component. | 2:25 |
| 3. Tổ chức kiến trúc | 08–14 | Lần từ sơ đồ tầng đến file và bootstrap. | 6:40 |
| 4. Phiên và xác thực | 15–19 | Theo phiên từ khởi tạo đến kết thúc. | 5:55 |
| 5. Luồng nghiệp vụ | 20–26 | Theo CSV từ workspace đến issue và draft. | 7:30 |
| 6. HTTP và hợp đồng API | 27–33 | Đọc request, kiểu và bốn bảng API. | 7:35 |
| 7. Truy vết và kiểm thử | 34–38 | Đọc ma trận, test, browser và coverage. | 5:00 |
| 8. Giới hạn và nghiệm thu | 39–42 | Chuyển giới hạn thành điều kiện nghiệm thu. | 3:50 |
| | **42** | | **42:25** |

## 3. Slide-by-Slide Speaker Guide

### Slide 01 — Nền Tảng Giám Sát & Xử Lý Dữ Liệu Chuẩn Kiến Trúc Phân Tầng

#### A. Bối cảnh trình bày

Chương 1, tổng quan và mức bằng chứng. Đặt vấn đề cho người mới nghe, giới thiệu lát cắt frontend của một nền tảng chất lượng dữ liệu.

#### B. Thông điệp cốt lõi

Nhóm xây giao diện để đưa dữ liệu vào, kiểm tra và quản lý theo dự án. React, TypeScript và Vite là nền tảng triển khai.

#### C. Giải thích nội dung

Khối Core 3D là minh họa nhận diện. Badge API, test và type-safe nói về ba loại bằng chứng khác nhau. React dựng UI, TypeScript kiểm tra kiểu lúc biên dịch, Vite phục vụ phát triển và build.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: đối chiếu commit, log build và số liệu kiểm thử trên badge với bản chốt.]

#### D. Lời thoại thuyết trình

Giả sử một nhóm có file CSV khách hàng và muốn biết cột nào thiếu dữ liệu hoặc chứa thông tin cá nhân. Họ cần một nơi đưa file vào dự án, xem cấu trúc và theo dõi vấn đề. Phần trình bày hôm nay đi từ trải nghiệm đó đến cách frontend gọi backend, quản lý phiên và kiểm tra phần đã làm. Trước hết, hãy nhìn ba dấu hiệu trên trang bìa như các chủ đề sẽ được kiểm chứng trong bài: phạm vi tích hợp, kiểm thử và hợp đồng dữ liệu.

#### E. Điểm cần nhấn mạnh

- CSV là ví dụ minh họa.
- Core là hình nhận diện.
- Type-safe nói về kiểu tĩnh.

#### F. Câu hỏi người nghe có thể đặt

**Khối 3D có trực tiếp chạy thuật toán làm sạch không?**  
Hình trên trang bìa minh họa sản phẩm. Việc xử lý do các luồng dữ liệu và dịch vụ phụ trách.

#### G. Chuyển tiếp

Bắt đầu bằng bức tranh tiến độ để biết các bằng chứng thuộc phạm vi nào.

#### H. Thời lượng

Khoảng 45 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 02 — 3 Trụ Cột Đạt Chuẩn: Nghiệp Vụ, Kiểm Thử & Tích Hợp Live

#### A. Bối cảnh trình bày

Chương 1, tổng quan và mức bằng chứng. Tóm tắt tình trạng bàn giao qua ba khối số liệu.

#### B. Thông điệp cốt lõi

Cần đọc riêng phạm vi tích hợp, kết quả kiểm thử và các phần còn giới hạn.

#### C. Giải thích nội dung

Thẻ 66/86 là tỷ lệ số operation slide báo đã nối trên tổng operation. Thẻ 864/864 là số ca pass của lần chạy được báo. Thẻ 4 là bốn nhóm cần làm rõ ranh giới, gồm cả lưu cục bộ.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: inventory 66 operation, log 864/864, 71 suite và 162 giây.]

#### D. Lời thoại thuyết trình

Ba con số ở đây trả lời ba câu hỏi khác nhau. Bao nhiêu operation đã được nối vào frontend? Bao nhiêu ca kiểm thử đã đạt trong lần chạy được ghi trên slide? Những phần nào người dùng vẫn gặp dữ liệu mẫu hoặc hành vi cục bộ? Swagger trong repo cho ta 86 operation. Để khẳng định 66 đã chạy live, cần danh sách từng operation gắn với kết quả gọi thật. Cũng vậy, số test pass phải đi kèm phiên bản code và lần chạy.

#### E. Điểm cần nhấn mạnh

- Operation là cặp method và path.
- 86 là tổng kiểm được.
- 4 nhóm có bản chất khác nhau.

#### F. Câu hỏi người nghe có thể đặt

**76,7% có nghĩa là 76,7% tính năng hoàn thành không?**  
Đó là tỷ lệ 66 chia 86 theo cách đếm operation của slide. Một tính năng có thể cần nhiều operation.

#### G. Chuyển tiếp

Để đọc tiến độ đúng, ta cần quy ước về mức bằng chứng.

#### H. Thời lượng

Khoảng 50 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 03 — Cam Kết Minh Bạch: Khung 7 Cấp Độ Bằng Chứng Kỹ Thuật

#### A. Bối cảnh trình bày

Chương 1, tổng quan và mức bằng chứng. Đặt quy ước bằng chứng cho mọi chương sau.

#### B. Thông điệp cốt lõi

Mỗi kết luận phải nói rõ dựa trên source, test, chạy thật hay dữ liệu mẫu.

#### C. Giải thích nội dung

Đi từ trên bảng xuống: IMPLEMENTED là có triển khai, TESTED là có test được chạy có kết quả, VERIFIED LIVE cần log chạy thật. MOCKED dùng mẫu, PARTIAL còn thiếu một phần. NOT FOUND giới hạn ở phạm vi đã tìm, UNVERIFIED là thiếu bằng chứng.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: log chạy live để nâng nhãn cho các operation trên bảng.]

#### D. Lời thoại thuyết trình

Ví dụ, một màn hình hiện danh sách project có thể đã được viết và chạy được với dữ liệu mẫu. Khi test dùng adapter giả, ta biết UI xử lý các tình huống đã mô phỏng. Để nói đã chạy live, ta cần gọi đúng server, với dữ liệu và quyền phù hợp, rồi lưu kết quả. Trong phần còn lại, hãy nghe mức bằng chứng đi cùng với từng kết luận, đặc biệt ở các bảng API.

#### E. Điểm cần nhấn mạnh

- Source và log là hai bằng chứng khác nhau.
- Mock có giá trị cho demo và test.
- Nêu phạm vi khi nói chưa tìm thấy.

#### F. Câu hỏi người nghe có thể đặt

**Có file Playwright đã được xem là TESTED chưa?**  
Có file chứng minh đã viết test. Cần kết quả chạy tương ứng mới xác nhận TESTED.

#### G. Chuyển tiếp

Áp dụng các nhãn đó vào bản đồ tích hợp và bốn nhóm ngoại lệ.

#### H. Thời lượng

Khoảng 55 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 04 — Hiện Trạng: 66/86 API Đã Nối Thật & Ranh Giới Phần Còn Mock

#### A. Bối cảnh trình bày

Chương 1, tổng quan và mức bằng chứng. Vẽ ranh giới giữa phần có API, phần demo và phần chạy cục bộ.

#### B. Thông điệp cốt lõi

Có caller API trong các nhóm chính. Mỗi phần còn lại cần mô tả theo cơ chế thật.

#### C. Giải thích nội dung

Cột trái chia Auth/User, Workspace, Project, Dataset và Issues/Admin. Cột phải gồm Workspace 3D fixture, notification/worker và Dexie. Fixture là dữ liệu mẫu. IndexedDB là cơ sở dữ liệu trong trình duyệt, có giá trị cho chế độ cục bộ.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: tỷ lệ từng nhóm, polling và phạm vi realtime của deployment.]

#### D. Lời thoại thuyết trình

Nhìn cột trái như bản đồ từ đăng nhập đến xử lý dữ liệu và báo sự cố. Cột bên phải là nơi dễ hiểu nhầm khi demo: cảnh 3D có thể dùng cây mẫu, trạng thái realtime cần kiểm mức tích hợp, còn bản nháp Dexie là dữ liệu thật của người dùng nằm cục bộ. Khi mô tả demo, hãy chỉ rõ thao tác nào tạo request đến server và thao tác nào chỉ cập nhật giao diện hoặc dữ liệu trong trình duyệt.

#### E. Điểm cần nhấn mạnh

- Đếm theo method và path.
- Dexie là lưu cục bộ.
- Realtime và polling là hai cơ chế khác nhau.

#### F. Câu hỏi người nghe có thể đặt

**Vì sao offline nằm cùng nhóm trên slide?**  
Slide nhóm theo ranh giới tích hợp. Bản nháp là tính năng lưu thật trong browser.

#### G. Chuyển tiếp

Sau phạm vi tính năng, ta xem hệ thống giao diện giúp người dùng nhận diện trạng thái thế nào.

#### H. Thời lượng

Khoảng 1 phút , gồm thời gian chỉ vào nội dung minh họa.

### Slide 05 — Bảng Màu Frontend Theo Ba Nhóm Sử Dụng

#### A. Bối cảnh trình bày

Chương 2, design system. Mở chương Design System bằng một yếu tố dễ nhìn.

#### B. Thông điệp cốt lõi

23 mẫu màu được chia theo vai trò để hỗ trợ đọc giao diện và hiểu trạng thái.

#### C. Giải thích nội dung

Đọc trái sang phải: nhóm nền/bề mặt xác lập độ sâu, nhóm thương hiệu đánh dấu hành động hoặc nhận diện, nhóm tín hiệu thể hiện trạng thái. Hex mã hóa màu, rgba có thêm độ trong suốt. Một mã có thể xuất hiện ở hai tên theo vai trò.

**Đối chiếu bằng chứng.** IMPLEMENTED trong bảng HTML, có 23 swatch. [NEEDS VERIFICATION: kết luận tương phản cho từng cặp màu nếu dùng khi nghiệm thu.]

#### D. Lời thoại thuyết trình

Hãy nhìn cột nền trước: canvas là mặt chung, surface là bề mặt đặt nội dung như thẻ. Sau đó nhìn nhóm màu chủ đạo để tìm hành động chính. Cuối cùng là tín hiệu nghiệp vụ, ví dụ màu cảnh báo nên đi kèm chữ để người dùng biết tác vụ cần chú ý gì. Cách đặt tên theo vai trò giúp người sửa giao diện hiểu màu dùng ở đâu và giúp kiểm tra tương phản theo từng cặp chữ và nền.

#### E. Điểm cần nhấn mạnh

- 23 mẫu trên slide.
- Surface khác canvas.
- Tín hiệu nên đi kèm chữ.

#### F. Câu hỏi người nghe có thể đặt

**Hai ô dùng cùng mã xanh có phải lỗi không?**  
Có thể cùng màu nhưng tên ngữ nghĩa khác, ví dụ nhận diện thương hiệu và trạng thái thành công.

#### G. Chuyển tiếp

Màu giúp nhận diện, còn chữ, khoảng cách và chuyển động định hướng cách đọc.

#### H. Thời lượng

Khoảng 45 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 06 — Nhịp Điệu Typography, Spacing & Chuyển Động Vi Mô

#### A. Bối cảnh trình bày

Chương 2, design system. Giải thích vì sao giao diện có thứ bậc và phản hồi dễ theo dõi.

#### B. Thông điệp cốt lõi

Typography và chuyển động nên phục vụ đọc, nhận biết và xác nhận thao tác.

#### C. Giải thích nội dung

Cụm mẫu Aa Bb và số thể hiện vai trò font đọc và monospace cho code. Spacing tạo nhóm nội dung. Đường cong easing mô tả tốc độ theo thời gian, chuỗi 160–240 ms là ví dụ trên slide.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: phạm vi áp dụng chính xác của các token motion trong từng màn hình.]

#### D. Lời thoại thuyết trình

Khi người dùng nhìn một bảng, trước hết họ cần nhận ra tiêu đề, sau đó là nhãn và giá trị. Font giao diện phục vụ câu dài. Font monospace giúp nhìn dấu gạch, ID và đường dẫn rõ hơn. Tương tự, khi mở dialog, chuyển động ngắn giúp mắt theo dõi điểm thay đổi. Nếu người dùng giảm chuyển động, điều quan trọng nhất vẫn là trạng thái và khả năng thực hiện thao tác.

#### E. Điểm cần nhấn mạnh

- Monospace có độ rộng ký tự đều.
- Easing khác duration.
- Kiểm tra reduced motion.

#### F. Câu hỏi người nghe có thể đặt

**160–240 ms có phải thời gian tải API không?**  
Đó là khoảng thời lượng chuyển trạng thái UI minh họa trên slide.

#### G. Chuyển tiếp

Từ những quy tắc thị giác, ta chuyển sang cách tổ chức linh kiện.

#### H. Thời lượng

Khoảng 45 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 07 — Cấu Trúc Linh Kiện 4 Tầng Theo Nguyên Lý Atomic Design

#### A. Bối cảnh trình bày

Chương 2, design system. Chuyển từ thiết kế thị giác sang cách tái sử dụng UI.

#### B. Thông điệp cốt lõi

Phân nhóm theo trách nhiệm giúp sửa UI chung và thay đổi nghiệp vụ ở đúng chỗ.

#### C. Giải thích nội dung

Tháp bốn tầng là cách đọc từ primitive, composite đến layout và feature. Button/Input là nguyên liệu, Dialog là tổ hợp, ApplicationFrame là khung, ProjectWizard là chức năng. ProtectedRoute thuộc phân luồng truy cập.

**Đối chiếu bằng chứng.** IMPLEMENTED có cấu trúc components, hooks, app và views. Sơ đồ là phân loại giải thích.

#### D. Lời thoại thuyết trình

Ví dụ, nút xác nhận dùng kiểu Button chung. Dialog ghép nút, nội dung và cách đóng. Khung ứng dụng bố trí topbar và vùng hiển thị. Wizard đi xa hơn: nó có bước nhập, file và xác nhận. Khi thay đổi bố cục nút dùng chung ta tìm Design System. Khi thay đổi cách tạo project ta tìm wizard, hook và service liên quan.

#### E. Điểm cần nhấn mạnh

- Primitive nhỏ và tái sử dụng.
- Layout đặt khung.
- Feature phối hợp hành vi nghiệp vụ.

#### F. Câu hỏi người nghe có thể đặt

**Có phải mỗi tầng là một thư mục tương ứng không?**  
Đây là sơ đồ giải thích cách ghép thành phần. Hãy tra đường dẫn thật theo module.

#### G. Chuyển tiếp

Sau cấu trúc linh kiện, xem các tầng phối hợp với API và storage thế nào.

#### H. Thời lượng

Khoảng 55 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 08 — Phân Loại Kiến Trúc: Layered Kết Hợp Hexagonal Ports & Adapters

#### A. Bối cảnh trình bày

Chương 3, tổ chức kiến trúc. Đặt bản đồ kỹ thuật tổng thể trước khi đi vào thư mục.

#### B. Thông điệp cốt lõi

Layered Architecture giúp theo dõi trách nhiệm. Ports & Adapters thể hiện rõ ở các điểm ghép phiên và lưu trữ.

#### C. Giải thích nội dung

Đọc từ UI xuống hooks/context, services, repository/ports, client và backend. Port là giao diện mà logic cần, adapter là phần triển khai. Ví dụ coordinator gọi storage qua hợp đồng thay vì quản lý browser storage tự thân.

**Đối chiếu bằng chứng.** IMPLEMENTED theo app-runtime, services, repositories và lib. Số lượng live theo ghi chú Slide 04.

#### D. Lời thoại thuyết trình

Khi người dùng mở dataset, view cần dữ liệu nhưng không nên phải biết mọi chi tiết Axios. Hook hoặc provider điều phối nhu cầu, service biết endpoint và kiểm tra dữ liệu. HTTP client lo đường dẫn, token và lỗi chung. Với phiên, runtime ghép storage thật vào coordinator. Trong test có thể thay storage hoặc transport để kiểm từng tình huống. Đây là cách đọc sáu vùng trách nhiệm trong sơ đồ.

#### E. Điểm cần nhấn mạnh

- Presentation là UI.
- Port là hợp đồng.
- Backend là biên ngoài frontend.

#### F. Câu hỏi người nghe có thể đặt

**Mọi request có đi qua repository không?**  
Repository phục vụ các luồng lưu trữ như draft. Service có thể dùng ApiClient trực tiếp.

#### G. Chuyển tiếp

Tiếp theo hãy theo một request đi xuống và kết quả đi ngược lên.

#### H. Thời lượng

Khoảng 1 phút 5 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 09 — Nguyên Tắc Phụ Thuộc Một Chiều & Dòng Chảy Dữ Liệu Xuyên Tầng

#### A. Bối cảnh trình bày

Chương 3, tổ chức kiến trúc. Giải thích sự khác nhau giữa hướng phụ thuộc và hướng dữ liệu.

#### B. Thông điệp cốt lõi

UI phát thao tác, tầng dưới gửi request, kết quả đi ngược về để render lại.

#### C. Giải thích nội dung

Đọc mũi tên xuống là action → hook → service → client → mạng. Mũi tên lên là response → unwrap → validate → store → render. Immutability là cập nhật snapshot có kiểm soát, còn dependency cycle là vòng import giữa module.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: quy tắc lint chống circular dependency và phạm vi Object.freeze.]

#### D. Lời thoại thuyết trình

Lấy ví dụ người dùng yêu cầu danh sách workspace. UI báo thao tác, service biết endpoint và lớp HTTP gửi request. Khi dữ liệu quay lại, client đọc cấu trúc chung, service kiểm tra mục cần dùng rồi store cập nhật để màn hình render. Dữ liệu đi hai chiều qua cùng các lớp. Hướng import là câu hỏi khác, cần dựa vào cấu trúc source và kiểm tra dependency riêng.

#### E. Điểm cần nhấn mạnh

- Unwrap bỏ lớp bọc.
- Runtime validation diễn ra khi chạy.
- Rerender dùng snapshot mới.

#### F. Câu hỏi người nghe có thể đặt

**Dữ liệu đi ngược có tạo circular dependency không?**  
Luồng response đi ngược về caller. Vòng phụ thuộc được xác định từ quan hệ import hoặc cấu trúc module.

#### G. Chuyển tiếp

Từ mũi tên trừu tượng, chuyển sang chỗ tìm code trong src.

#### H. Thời lượng

Khoảng 55 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 10 — Cấu Trúc Thư Mục Cấp 1 (Root Architecture): 14 Folder Tại src/

#### A. Bối cảnh trình bày

Chương 3, tổ chức kiến trúc. Giúp người mới định vị code trước khi đọc sâu.

#### B. Thông điệp cốt lõi

Bảng cho thấy một số thư mục cốt lõi và trách nhiệm của chúng.

#### C. Giải thích nội dung

Đọc từ app, views/components/hooks đến services, repositories và lib. Cột ví dụ chỉ đường đến file cụ thể. Source hiện có 17 thư mục cấp một, gồm thêm types, math, graphics và các nhóm hỗ trợ.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: tiêu đề 14 folder. Working tree kiểm được 17 thư mục trực tiếp dưới src.]

#### D. Lời thoại thuyết trình

Khi muốn tìm một chức năng, đừng mở mọi thư mục cùng lúc. Bắt đầu ở app để biết route, sang views hoặc components để tìm điểm bấm, rồi services để thấy thao tác dữ liệu. Nếu vấn đề là lưu bản nháp, qua repositories. Nếu lỗi nằm ở việc gắn token hay xử lý response, qua lib. Bảng trên slide liệt kê các nhóm chính. Con số 14 ở tiêu đề lệch với 17 thư mục hiện thấy trong source.

#### E. Điểm cần nhấn mạnh

- Route ở app.
- API nghiệp vụ ở services.
- HTTP chung ở lib.

#### F. Câu hỏi người nghe có thể đặt

**views và components khác nhau ở đâu?**  
View gắn với màn hình hoặc route. Component có thể được dùng lại ở nhiều màn.

#### G. Chuyển tiếp

Đã biết cấp thư mục chính, ta mở xuống các nhóm con.

#### H. Thời lượng

Khoảng 50 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 11 — Cấu Trúc Thư Mục Cấp 2 (Module Architecture): Phân Bổ Nghiệp Vụ

#### A. Bối cảnh trình bày

Chương 3, tổ chức kiến trúc. Giải thích cách kiến trúc chia nhỏ theo nghiệp vụ.

#### B. Thông điệp cốt lõi

Cấp hai giúp tìm đúng nhóm khi đã định vị được thư mục chính.

#### C. Giải thích nội dung

Cột services chia auth, management, processing, users, health. App chia route, guard, provider và page. Repositories/datasets lưu draft, còn lib xử lý HTTP, storage và lỗi.

**Đối chiếu bằng chứng.** IMPLEMENTED theo cây source. [NEEDS VERIFICATION: đường dẫn hoặc tên provider trình bày trên slide nếu đọc nguyên văn.]

#### D. Lời thoại thuyết trình

Nếu chức năng đang sửa là gia hạn phiên, vị trí tự nhiên là services/auth. Nếu là bảng dataset, xem processing và provider tương ứng. Nếu route chuyển hướng nhầm, kiểm tra app/router và app/guards. Cách chia này giúp một lỗi có địa chỉ rõ ràng. Bảng mô tả các nhóm đại diện, ví dụ health gọi kiểm tra do backend cung cấp nên ý nghĩa chi tiết phải đọc contract.

#### E. Điểm cần nhấn mạnh

- Nhóm auth khác users.
- Guard là kiểm tra truy cập route.
- Health đọc tình trạng backend.

#### F. Câu hỏi người nghe có thể đặt

**Thêm một hàm gọi API records ở đâu?**  
Trong services/processing nếu thao tác thuộc dataset. UI nhận dữ liệu qua caller hiện có.

#### G. Chuyển tiếp

Từ nhóm con, ta chọn bốn file trung tâm để thấy đầu vào và đầu ra.

#### H. Thời lượng

Khoảng 50 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 12 — Cấu Trúc Cấp 3 (File-Level Structure): Trách Nhiệm Từng File Cốt Lõi

#### A. Bối cảnh trình bày

Chương 3, tổ chức kiến trúc. Đọc cấu trúc ở cấp file và lý do chia trách nhiệm.

#### B. Thông điệp cốt lõi

Bốn file đại diện cho khâu ghép phụ thuộc, phiên, dữ liệu quản lý và draft.

#### C. Giải thích nội dung

Đọc từng hàng qua input và output. Runtime nhận cấu hình và ghép phụ thuộc. Coordinator trả snapshot. Store nhận client và phát state. Draft repository dùng database và quyền phiên để quản lý file.

**Đối chiếu bằng chứng.** IMPLEMENTED theo bốn file. [NEEDS VERIFICATION: 66 caller gán riêng cho store và chữ ký rút gọn trên slide.]

#### D. Lời thoại thuyết trình

Hãy đọc bảng theo dạng ai nhận gì và ai dùng kết quả. Runtime dựng các thành phần rồi giao chúng cho ứng dụng. Coordinator nhận lời gọi của người dùng và trả snapshot để UI biết phiên đang ở đâu. Management store cập nhật dữ liệu nghiệp vụ cho các màn hình. Repository draft giữ dữ liệu cục bộ theo quyền phiên. Khi debug, câu hỏi đầu tiên là lỗi nằm ở bước ghép phụ thuộc, xử lý phiên, tải dữ liệu hay lưu bản nháp.

#### E. Điểm cần nhấn mạnh

- Composition root ghép dependency.
- Snapshot là trạng thái quan sát được.
- Repository có biên lưu trữ.

#### F. Câu hỏi người nghe có thể đặt

**Có cần gọi Axios trực tiếp trong component để sửa lỗi API không?**  
Lần theo service và client trước để sửa tại nơi sở hữu endpoint hoặc transport.

#### G. Chuyển tiếp

Ta phóng to runtime để giải thích lúc tạo và hủy tài nguyên.

#### H. Thời lượng

Khoảng 55 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 13 — Composition Root & Vòng Đời AppRuntime: Cơ Chế retain / release

#### A. Bối cảnh trình bày

Chương 3, tổ chức kiến trúc. Giải thích vòng đời các phụ thuộc sau khi runtime được ghép.

#### B. Thông điệp cốt lõi

retain đánh dấu một owner đang dùng runtime. Cleanup trì hoãn để setup lại trong StrictMode có thể giữ instance.

#### C. Giải thích nội dung

Đọc code từ owners tăng khi retain, closure giảm khi release, rồi kiểm tra số owner trong microtask. Microtask là việc được chạy sau đoạn đồng bộ hiện tại. Khi còn owner, runtime tiếp tục sống.

**Đối chiếu bằng chứng.** IMPLEMENTED trong app-runtime.ts. Khẳng định tuyệt đối về memory leak cần benchmark riêng.

#### D. Lời thoại thuyết trình

Trong dev, React có thể chạy lại setup và cleanup của effect để phát hiện lỗi vòng đời. Nếu đóng database ngay khi thấy cleanup đầu tiên, lần setup kế tiếp có thể gặp runtime đã bị hủy. Ở đây retain trả về hàm giải phóng. Việc kiểm tra ở microtask cho setup cùng lượt cơ hội nhận lại runtime. Khi thực sự hết owner, runtime dọn coordinator và database. Điều này giải thích một rủi ro cụ thể, còn kết luận về rò rỉ cần đo thêm.

#### E. Điểm cần nhấn mạnh

- Owner là nơi sử dụng.
- Retain trả release.
- Microtask kiểm lại trước dispose.

#### F. Câu hỏi người nghe có thể đặt

**Đóng runtime có đồng nghĩa đăng xuất không?**  
Dispose dọn instance và tài nguyên sử dụng. Sign-out đi qua luồng thu hồi và dọn phiên riêng.

#### G. Chuyển tiếp

Bây giờ đặt runtime vào thứ tự ứng dụng khởi động.

#### H. Thời lượng

Khoảng 1 phút , gồm thời gian chỉ vào nội dung minh họa.

### Slide 14 — Quy Trình Khởi Động Ứng Dụng (Bootstrap Sequence) 5 Bước

#### A. Bối cảnh trình bày

Chương 3, tổ chức kiến trúc. Nối điểm mở trang với điểm route được phép hiển thị.

#### B. Thông điệp cốt lõi

Bootstrap dựng runtime, khôi phục phiên rồi để guard quyết định route.

#### C. Giải thích nội dung

Năm ô theo thứ tự HTML/root, entry, bootstrap, restore và guard. Skeleton là khung chờ. Restore kiểm bản ghi phiên và gọi hồ sơ khi access token còn hạn. Guard giữ đích hợp lệ, mặc định sau đăng nhập là /processing.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: tuyên bố FCP, đường dẫn /management mặc định và phạm vi Error Boundary trên slide.]

#### D. Lời thoại thuyết trình

Khi mở ứng dụng, trình duyệt tải trang SPA và entry JavaScript. Entry có nhánh preview dev, còn luồng chính đi vào bootstrap để lắp runtime và query client. Trong lúc chưa biết trạng thái phiên, UI có thể hiện skeleton. Coordinator đọc bản ghi phiên rồi xác thực hồ sơ với token còn hạn. Guard dùng kết quả để cho qua hoặc chuyển về đăng nhập. Nếu không có đích hợp lệ để quay lại, source hiện đặt mặc định là Processing.

#### E. Điểm cần nhấn mạnh

- Skeleton là trạng thái chờ.
- Restore đọc hồ sơ.
- Đích mặc định /processing.

#### F. Câu hỏi người nghe có thể đặt

**Lỗi mạng khi restore có luôn dẫn đến trang lỗi không?**  
Coordinator xử lý theo loại lỗi và hạn token. Source có nhánh local-limited khi có phiên còn hạn và lỗi phù hợp.

#### G. Chuyển tiếp

Ta cần đọc kỹ những pha mà guard và dialog dựa vào.

#### H. Thời lượng

Khoảng 1 phút 5 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 15 — Bộ Điều Phối Phiên (Session Coordinator) & State Machine 7 Pha

#### A. Bối cảnh trình bày

Chương 4, phiên và xác thực. Đặt tên cho các trạng thái người dùng thấy khi đăng nhập, mất mạng hoặc gia hạn.

#### B. Thông điệp cốt lõi

State machine làm mỗi tình huống có snapshot rõ ràng. Generation giúp tác vụ cũ không ghi đè phiên mới.

#### C. Giải thích nội dung

Đọc nhóm khởi động và đăng nhập, nhóm kiểm tra/gia hạn, rồi nhánh local-limited. Source còn khai báo signing-out. Generation tăng ở ranh giới invalidation, không phải mỗi lần publish. AbortSignal báo hủy công việc, generation kiểm kết quả đến muộn.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: tiêu đề 7 pha lệch với tập 9 giá trị trong union, gồm signing-out. Tập giá trị khai báo và pha thực sự publish cần phân biệt.]

#### D. Lời thoại thuyết trình

Một người đang đăng nhập có thể đóng màn hình hoặc bắt đầu luồng phiên khác trước khi request cũ hoàn tất. Coordinator lưu số generation lúc bắt đầu và so lại trước khi cập nhật. UI dựa vào phase: đang khôi phục thì chờ, đang chờ consent thì mở dialog, có phiên trực tuyến thì tiếp tục. Local-limited diễn tả một số tình huống mất kết nối với phiên còn hạn. Hãy đọc các nhãn như một bản đồ trạng thái thay vì đếm theo tiêu đề.

#### E. Điểm cần nhấn mạnh

- Phase là trạng thái.
- Publish đưa snapshot ra UI.
- Generation kiểm quyền cập nhật của tác vụ.

#### F. Câu hỏi người nghe có thể đặt

**Mỗi lần phase đổi có tăng generation không?**  
Source tăng tại begin/invalidation. Nhiều lần publish phase trong cùng một tác vụ dùng chung generation.

#### G. Chuyển tiếp

Sau trạng thái, xem dữ liệu nhỏ nhất cần lưu để khôi phục phiên.

#### H. Thời lượng

Khoảng 1 phút 10 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 16 — Cơ Chế Lưu Trữ Token An Toàn Trong sessionStorage

#### A. Bối cảnh trình bày

Chương 4, phiên và xác thực. Giải thích quyền truy cập gắn với token và ranh giới browser storage.

#### B. Thông điệp cốt lõi

Frontend lưu dữ liệu phiên được whitelist theo key và đọc token còn hạn. Quyền thực tế phụ thuộc kiểm tra phía backend.

#### C. Giải thích nội dung

Chỉ bốn trường schemaVersion, accountId, accessToken, refreshToken. Access token dùng Bearer, refresh token dùng để xin gia hạn. sessionStorage có vòng đời theo phiên trang và thường theo tab, JavaScript cùng origin có thể đọc. Đóng tab và thu hồi server là hai việc khác nhau.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: các tuyên bố tuyệt đối về CSRF, cách ly tab và tự thu hồi. Source xác nhận whitelist và key lưu.]

#### D. Lời thoại thuyết trình

Khối JSON trên slide là ví dụ cấu trúc, hãy tránh đọc token mẫu như một giá trị dùng thật. Adapter kiểm phiên bản schema, tài khoản và hạn token trước khi trả dữ liệu. Khi gửi request bảo vệ, client gắn Bearer theo code của ứng dụng. Cách này có đặc tính khác cookie tự gửi, còn an toàn tổng thể phụ thuộc việc bảo vệ JavaScript trên trang và xác thực phía backend. Khi cần kết thúc quyền trên server, ta dùng luồng logout sẽ nói sau.

#### E. Điểm cần nhấn mạnh

- Bearer là thông tin mang theo request.
- Không đọc token thật khi demo.
- XSS và thu hồi server là ranh giới cần hiểu.

#### F. Câu hỏi người nghe có thể đặt

**Đóng tab có thu hồi token phía server không?**  
Việc đóng tab ảnh hưởng vòng đời dữ liệu trình duyệt. Thu hồi server cần cơ chế phía backend và bằng chứng theo phiên.

#### G. Chuyển tiếp

Dùng cấu trúc vừa giới thiệu để đọc sơ đồ đăng nhập và reload.

#### H. Thời lượng

Khoảng 1 phút 5 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 17 — Sơ Đồ Tuần Tự: Đăng Nhập & Khôi Phục Phiên (Session Restoration)

#### A. Bối cảnh trình bày

Chương 4, phiên và xác thực. Giải thích sơ đồ ba vai bằng cách tách đăng nhập mới và restore.

#### B. Thông điệp cốt lõi

Hai luồng nói chuyện với backend theo cách khác nhau nhưng đều dẫn tới snapshot khi phiên hợp lệ.

#### C. Giải thích nội dung

Ba cột Client, Coordinator và Backend. Đọc mũi tên 1–3 cho login, vòng tự gọi 4 cho ghi storage, 5–6 minh họa đọc hồ sơ, 7–8 là phát trạng thái và điều hướng. Theo source, login mật khẩu dùng user từ login response, còn restore mới lấy phiên lưu và GET /users/me.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: SVG gộp login với restore và ghi đích /management. Dùng coordinator và cấu hình route làm chuẩn.]

#### D. Lời thoại thuyết trình

Bắt đầu ở Client, nơi người dùng gửi form. Coordinator gọi API đăng nhập công khai. Nếu phản hồi chứa phiên và user khớp, nó có thể lưu và phát authenticated cho UI. Khi tải lại, đầu vào khác: coordinator đọc dữ liệu lưu rồi dùng access token còn hạn để hỏi hồ sơ server và đối chiếu tài khoản. Hai đoạn trên SVG giúp hiểu các vai, nhưng khi mô tả code hãy giữ hai luồng riêng. Cuối cùng guard chọn đích hợp lệ, mặc định là Processing.

#### E. Điểm cần nhấn mạnh

- Đọc từ trên xuống.
- Mũi tên đi và về khác vai.
- Reload dùng /users/me.

#### F. Câu hỏi người nghe có thể đặt

**Login nào lấy hồ sơ bằng /users/me trước khi commit?**  
Restore dùng hồ sơ trong bước khôi phục. Google sign-in cũng đọc hồ sơ với token ứng viên. Login mật khẩu dùng user từ login response.

#### G. Chuyển tiếp

Phiên có thể hết hạn, vậy lần gia hạn diễn ra như thế nào?

#### H. Thời lượng

Khoảng 1 phút 15 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 18 — Vòng Đời Gia Hạn Token: Health Check Ping & Awaiting-Consent

#### A. Bối cảnh trình bày

Chương 4, phiên và xác thực. Đọc sơ đồ gia hạn theo từng cụm thay vì từng mũi tên rời.

#### B. Thông điệp cốt lõi

Access token hết hạn dẫn tới kiểm tra dịch vụ, xin đồng ý, refresh và kiểm hồ sơ trước khi commit.

#### C. Giải thích nội dung

Cụm 1–3 minh họa request bảo vệ và 401. Cụm 4–6 là health và awaiting-consent. Cụm 7–10 là người dùng cho phép, gửi refresh token, nhận token và cập nhật phiên. Source checkSession dựa trên hạn token và không xác nhận sơ đồ intercept 401 cho mọi request.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: 401 trigger, refresh rotation và revoke khi hủy trên SVG. Source confirmRenewal gọi endSession khi hủy/lỗi.]

#### D. Lời thoại thuyết trình

Hãy nhìn ba vai như trước, nhưng lần này người dùng đã có bản ghi phiên. Khi coordinator xử lý một access token hết hạn, nó kiểm tra health. Nếu dịch vụ sẵn sàng, UI hỏi người dùng có gia hạn hay không. Sau khi đồng ý, coordinator dùng refresh token lấy candidate session. Nó còn dùng access token ứng viên đọc hồ sơ để xác nhận cùng tài khoản trước khi ghi và phục hồi UI. Nếu từ chối hoặc gia hạn thất bại, code hiện đi qua luồng kết thúc phiên cục bộ.

#### E. Điểm cần nhấn mạnh

- Health public.
- Consent do người dùng.
- Candidate chỉ commit sau đối chiếu hồ sơ.

#### F. Câu hỏi người nghe có thể đặt

**API nghiệp vụ trả 401 có nghĩa là chắc chắn sẽ tự refresh rồi chạy lại request không?**  
Sơ đồ minh họa tình huống cần xử lý. Cần kiểm caller và coordinator để xác định cách phản ứng cụ thể.

#### G. Chuyển tiếp

Từ nhánh dừng gia hạn, phân biệt với thao tác đăng xuất chủ động.

#### H. Thời lượng

Khoảng 1 phút 20 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 19 — Luồng Đăng Xuất An Toàn & Thu Hồi Phiên Trực Tiếp Trên Server

#### A. Bối cảnh trình bày

Chương 4, phiên và xác thực. Giải thích logout bằng hai kết quả độc lập.

#### B. Thông điệp cốt lõi

Logout dọn phiên cục bộ và thử thu hồi trên backend nếu có điều kiện. Kết quả trả về phân biệt hai việc.

#### C. Giải thích nội dung

Slide vẽ server, storage, cache. Code chụp credential hợp lệ của phiên cũ, chạy endSession, sau đó chờ revoke đã bind. Adapter dùng removeItem một key. Query client hủy query và dọn cache.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: thứ tự và blacklist như slide. Mã FE xác nhận cleanup trước await revoke, không xác nhận kỹ thuật backend từ sơ đồ.]

#### D. Lời thoại thuyết trình

Khi nhấn đăng xuất, điều người dùng thấy trước là UI kết thúc phiên. Coordinator giữ lời gọi logout gắn với đúng access token cũ nếu còn dùng được. Nó kết thúc phiên cục bộ rồi thực hiện yêu cầu thu hồi. Nhờ tách hai kết quả, mất mạng không biến thành khẳng định server đã thu hồi. Việc dọn cache giúp dữ liệu của người cũ không xuất hiện khi người tiếp theo đăng nhập.

#### E. Điểm cần nhấn mạnh

- RemoveItem một key.
- Cache hủy và dọn.
- serverRevoked là kết quả riêng.

#### F. Câu hỏi người nghe có thể đặt

**Mất mạng lúc logout thì nói tình trạng thế nào?**  
Kiểm cleanupError và serverRevoked/revokeError để biết thao tác nào đã hoàn tất.

#### G. Chuyển tiếp

Có phiên hợp lệ rồi, ta chuyển sang luồng quản lý workspace.

#### H. Thời lượng

Khoảng 1 phút 5 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 20 — Luồng Quản Lý Workspace & Kiểm Soát Xung Đột Phiên Bản (Version)

#### A. Bối cảnh trình bày

Chương 5, luồng nghiệp vụ. Mở chương nghiệp vụ bằng container của các project.

#### B. Thông điệp cốt lõi

Workspace tổ chức dự án và có cập nhật theo version để xử lý xung đột.

#### C. Giải thích nội dung

Cột thao tác gồm đọc, tạo, sửa, xóa, chuyển chủ. Cột ví dụ bản ghi v2, gửi expectedVersion, server có thể báo 409 nếu phiên bản hiện tại đã thay đổi. Cursor là mốc lấy trang tiếp.

**Đối chiếu bằng chứng.** IMPLEMENTED có expectedVersion. [NEEDS VERIFICATION: phản ứng 409 và mỗi payload với môi trường live.]

#### D. Lời thoại thuyết trình

Ví dụ hai thành viên cùng nhìn workspace ở phiên bản 2. Người đầu tiên sửa tên và server cập nhật phiên bản. Khi người thứ hai gửi thay đổi dựa trên bản cũ, expectedVersion giúp backend phát hiện và trả xung đột thay vì âm thầm chồng dữ liệu. Người dùng cần xem lại bản mới rồi quyết định chỉnh tiếp. Khi minh họa chuyển chủ, nên đọc payload hiện hành từ service vì trường hiển thị trên bảng có thể đã cũ.

#### E. Điểm cần nhấn mạnh

- expectedVersion là phiên bản kỳ vọng.
- 409 là xung đột.
- Workspace là ranh giới tài nguyên.

#### F. Câu hỏi người nghe có thể đặt

**Vì sao dùng khóa lạc quan?**  
Cho phép nhiều người đọc và chỉ kiểm xung đột tại lúc ghi.

#### G. Chuyển tiếp

Khi đã có workspace, ta đi vào quy trình tạo một project và nạp CSV.

#### H. Thời lượng

Khoảng 1 phút 5 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 21 — Project Wizard: Luồng Khởi Tạo Dự Án 4 Bước Có Khả Năng Khôi Phục

#### A. Bối cảnh trình bày

Chương 5, luồng nghiệp vụ. Giải thích wizard và rủi ro giữa nhiều request.

#### B. Thông điệp cốt lõi

Wizard hướng dẫn nhập dữ liệu. Tạo project, tải CSV và thêm thành viên là các thao tác server riêng có thể chỉ thành công một phần.

#### C. Giải thích nội dung

Các ô trình bày thông tin, file, schema và xác nhận. Source store kiểm CSV, tạo qua /workspaces/:id/projects, upload và thêm thành viên. Nếu bước sau lỗi, có thông báo project đã tạo và giữ dấu tiến độ trong store.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: endpoint POST /projects, tự rollback, tự lưu IndexedDB tại wizard và gợi ý PII như mô tả. Mã store thể hiện partial failure.]

#### D. Lời thoại thuyết trình

Người dùng chọn workspace, đặt tên và chọn CSV. Tại lúc xác nhận, hãy hình dung một chuỗi request: tạo project trước để có ID, dùng ID tải file, sau đó thêm thành viên theo lựa chọn. Nếu upload thất bại, project vừa tạo có thể đã tồn tại. UI hướng người dùng vào project để kiểm tra, và store có trạng thái tiến độ của lần thao tác. Đây là khác biệt quan trọng so với giả định cả chuỗi được rollback như một giao dịch duy nhất.

#### E. Điểm cần nhấn mạnh

- CSV cần được chọn.
- Project có thể tồn tại khi upload lỗi.
- Xem lại project trước khi tạo lại.

#### F. Câu hỏi người nghe có thể đặt

**Hệ thống tự xóa project khi tải CSV lỗi không?**  
Source store hiện giữ project và báo trạng thái chưa hoàn tất.

#### G. Chuyển tiếp

Project đã tồn tại thì câu hỏi tiếp theo là ai được thao tác ở mỗi cấp.

#### H. Thời lượng

Khoảng 1 phút 10 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 22 — Luồng Quản Lý Thành Viên & Phân Quyền Phân Cấp Đa Tầng

#### A. Bối cảnh trình bày

Chương 5, luồng nghiệp vụ. Giải thích quyền trong workspace và trong project bằng hai phạm vi.

#### B. Thông điệp cốt lõi

Role phải được đọc cùng scope và thao tác. UI hỗ trợ điều hướng, backend quyết định quyền với request.

#### C. Giải thích nội dung

Hai hàng so sánh workspace và project. Scope là phạm vi áp quyền. Nhóm thao tác gồm mời, xóa, cập nhật role hoặc chuyển chủ. Khớp tên role và body với DTO trước khi nói ví dụ cụ thể.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: role, quyền và payload chi tiết trong bảng so với DTO/policy backend và tài khoản thử.]

#### D. Lời thoại thuyết trình

Một người thuộc workspace chưa chắc thực hiện được mọi thao tác trong mọi project. Khi người trình bày chỉ vào bảng, hãy hỏi quyền nào, trên tài nguyên nào, do ai thực hiện. UI có thể ẩn thao tác dựa trên ngữ cảnh. Khi người dùng gửi request, backend vẫn cần xác nhận quyền ở tài nguyên cụ thể. Một ca test thật nên dùng cả tài khoản được phép và tài khoản bị từ chối để chứng minh hai nhánh.

#### E. Điểm cần nhấn mạnh

- Scope là phạm vi.
- Bảo vệ backend là lớp quyết định.
- So sánh quyền qua tình huống.

#### F. Câu hỏi người nghe có thể đặt

**Ẩn nút có đủ bảo vệ API không?**  
API phải kiểm tra quyền độc lập với giao diện.

#### G. Chuyển tiếp

Khi người dùng được phép mở project, họ có thể xem cấu trúc và chất lượng của dataset.

#### H. Thời lượng

Khoảng 1 phút , gồm thời gian chỉ vào nội dung minh họa.

### Slide 23 — Luồng Quản Lý Dataset: Ingestion, Parse Schema, Thống Kê & Cột PII

#### A. Bối cảnh trình bày

Chương 5, luồng nghiệp vụ. Giải thích giá trị nghiệp vụ sau khi CSV đã được nạp.

#### B. Thông điệp cốt lõi

Schema cho biết có cột nào và kiểu gì. Stats và cờ PII giúp người dùng đánh giá cột.

#### C. Giải thích nội dung

Khối code schema có key kỹ thuật, tên hiển thị, dataType, isPii. Thống kê lấy riêng theo key. PATCH gửi danh sách cột cập nhật. PII là thông tin có thể nhận diện cá nhân, như email.

**Đối chiếu bằng chứng.** IMPLEMENTED trong dataset.service.ts. [NEEDS VERIFICATION: phạm vi masking khi chia sẻ hoặc tải file.]

#### D. Lời thoại thuyết trình

Nếu cần kiểm chất lượng một cột email, trước tiên xem tên và kiểu trong schema. Dùng key kỹ thuật của cột để gọi thống kê, chẳng hạn số ô trống. Người có quyền có thể gắn cờ PII cho cột để hệ thống biết đây là dữ liệu nhạy cảm. Cờ là thông tin phân loại. Việc dữ liệu được che ở màn hình hoặc báo cáo nào cần kiểm từng đường hiển thị và xuất file.

#### E. Điểm cần nhấn mạnh

- Schema mô tả cột.
- Stats tính theo key.
- Đánh dấu và che dữ liệu là hai bước.

#### F. Câu hỏi người nghe có thể đặt

**Gắn cờ PII có tự xóa email trong file gốc không?**  
Thao tác trên slide cập nhật metadata cột. Muốn biết hành vi tải file hoặc che dữ liệu cần kiểm đúng endpoint và quyền.

#### G. Chuyển tiếp

Schema nói về cột. Slide tiếp theo nói về cách đọc từng trang dữ liệu hàng.

#### H. Thời lượng

Khoảng 1 phút , gồm thời gian chỉ vào nội dung minh họa.

### Slide 24 — Luồng Lưới Dữ Liệu Ảo (Virtual Grid) & Phân Trang Con Trỏ (Cursor)

#### A. Bối cảnh trình bày

Chương 5, luồng nghiệp vụ. Phân biệt tối ưu tải dữ liệu và tối ưu DOM.

#### B. Thông điệp cốt lõi

Cursor pagination chia dữ liệu thành trang. Virtual scrolling giới hạn hàng được dựng nếu UI đó triển khai ảo hóa.

#### C. Giải thích nội dung

Khối trên minh họa limit, cursor và response items/meta. Source dùng GET /records cho trang thường, POST /records/query khi có search/filter/sort. Khối dưới là mục tiêu về DOM và RAM cần dữ liệu đo.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: 30–40 DOM, dưới 80 MB và 500.000 dòng. POST query chỉ là một nhánh thực tế.]

#### D. Lời thoại thuyết trình

Với file lớn, lý tưởng là trình duyệt chỉ xin một phần hàng. Server trả items và một con trỏ để xin trang tiếp theo. Nếu người dùng thêm lọc hoặc sắp xếp, service hiện gửi điều kiện qua nhánh query. Một câu hỏi khác là mỗi lần trình duyệt vẽ bao nhiêu hàng. Điều đó thuộc virtual scrolling và cần kiểm implementation cùng số đo. Phần chắc chắn từ source là cách lấy trang và kiểm response, kể cả con trỏ lặp.

#### E. Điểm cần nhấn mạnh

- Cursor là mốc mờ.
- GET và POST tùy điều kiện.
- Benchmark phải ghi điều kiện đo.

#### F. Câu hỏi người nghe có thể đặt

**Cursor có cần parse ở frontend để tính trang tiếp không?**  
Frontend dùng nextCursor do server cấp và kiểm tính hợp lệ theo contract.

#### G. Chuyển tiếp

Nếu từ dữ liệu phát hiện lỗi, người dùng có thể tạo báo cáo sự cố.

#### H. Thời lượng

Khoảng 1 phút 10 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 25 — Luồng Báo Cáo Sự Cố (Issues) & Xử Lý Trạng Thái Needs-Info

#### A. Bối cảnh trình bày

Chương 5, luồng nghiệp vụ. Kết nối phát hiện vấn đề dữ liệu với quy trình xử lý giữa người dùng và quản trị.

#### B. Thông điệp cốt lõi

Báo cáo và tệp đính kèm là các bước riêng. Admin thay đổi trạng thái khi cần làm rõ hoặc xử lý.

#### C. Giải thích nội dung

Đọc bốn ô từ tạo báo cáo đến admin review, bổ sung và đóng. needs_info nghĩa là cần dữ liệu bổ sung. Source FE tạo qua POST /issues, tải tệp qua endpoint con. Cần kiểm riêng caller của nhánh bổ sung.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: path /issues/report, caller của additional-info và trạng thái cuối ở môi trường live.]

#### D. Lời thoại thuyết trình

Giả sử một dòng dữ liệu có giá trị ngày bất thường. Người dùng báo vấn đề bằng tiêu đề, mô tả và có thể gửi tệp minh họa. Store tạo issue để có ID, rồi mới tải tệp vào issue đó. Khi quản trị cần thêm thông tin, trạng thái giúp hai bên hiểu việc gì còn thiếu. Trong demo, hãy nói rõ bước nào giao diện hiện có caller và bước nào cần xác nhận lại với backend.

#### E. Điểm cần nhấn mạnh

- Issue là báo cáo sự cố.
- Attachment tải riêng.
- Trạng thái điều phối trao đổi.

#### F. Câu hỏi người nghe có thể đặt

**Nếu tệp lỗi, issue có thể vẫn tồn tại không?**  
Có. Store có thông báo riêng để người dùng thử lại tải tệp ở hộp thoại.

#### G. Chuyển tiếp

Bước lỗi giữa chừng dẫn tới câu hỏi lưu bản nháp và đồng bộ cục bộ.

#### H. Thời lượng

Khoảng 1 phút , gồm thời gian chỉ vào nội dung minh họa.

### Slide 26 — Cơ Chế Bản Nháp Ngoại Tuyến (Dexie DB) & Chống Partial Failure

#### A. Bối cảnh trình bày

Chương 5, luồng nghiệp vụ. Tách bản nháp cục bộ khỏi lỗi giữa nhiều request backend.

#### B. Thông điệp cốt lõi

Dexie quản lý dữ liệu nháp qua IndexedDB. Transaction bảo vệ tính nhất quán trong browser.

#### C. Giải thích nội dung

Khối code có bảng drafts và files. DraftAccessPort cung cấp quyền theo phiên, transaction nhóm thay đổi và confirmUploaded đối chiếu account, project và dataset. ACK là xác nhận kết quả đã được nhận.

**Đối chiếu bằng chứng.** IMPLEMENTED trong upload-draft.repository.ts. [NEEDS VERIFICATION: tích hợp mỗi màn hình và tuyên bố chỉ HTTP 201.]

#### D. Lời thoại thuyết trình

Nếu người dùng cần giữ một file nháp, repository lưu metadata và file trong hai bảng liên quan. Quyền đọc hoặc ghi dựa trên snapshot của phiên. Nếu giao dịch IndexedDB lỗi, các thao tác trong giao dịch được xử lý cùng nhau. Khi có xác nhận upload trùng với draft và phiên, repository cập nhật trạng thái và dọn nội dung theo luồng hiện tại. Đây là biên cục bộ, nên không thay thế idempotency hay cơ chế khôi phục phía server.

#### E. Điểm cần nhấn mạnh

- Dexie bọc IndexedDB.
- Transaction có phạm vi cục bộ.
- ACK cần đúng tài khoản và dự án.

#### F. Câu hỏi người nghe có thể đặt

**HTTP 201 tự nó có đủ để dọn bản nháp không?**  
Repository nhận confirmation với định danh cần đối chiếu. Nó không đọc status HTTP trực tiếp.

#### G. Chuyển tiếp

Sau các luồng nghiệp vụ, ta xem chúng dùng chung pipeline request ra sao.

#### H. Thời lượng

Khoảng 1 phút 5 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 27 — Kiến Trúc Giao Tiếp Request–Response Toàn Trình (FE → BE)

#### A. Bối cảnh trình bày

Chương 6, http và hợp đồng api. Tổng hợp các luồng nghiệp vụ thành một mô hình gọi API chung.

#### B. Thông điệp cốt lõi

Một request đi từ thao tác đến backend, rồi qua hai mức đọc dữ liệu trước khi cập nhật UI.

#### C. Giải thích nội dung

Đọc pipeline 1–5 từ UI, hook, service, Axios tới NestJS. Đọc 6–8 khi dữ liệu quay về: unwrap envelope, kiểm kiểu nghiệp vụ, cập nhật state. DTO là hợp đồng dữ liệu qua biên.

**Đối chiếu bằng chứng.** IMPLEMENTED qua axios-client và dataset.service. Pipeline là mô hình, số bước tùy feature.

#### D. Lời thoại thuyết trình

Giả sử người dùng mở schema một dataset. UI biết ID nhưng giao việc gọi API cho service. Axios thêm đường dẫn và token, gửi sang backend. Khi trả về, lớp HTTP mở phần bọc chung. Sau đó service kiểm xem danh sách cột có hợp lệ hay không. Nếu kiểm qua, caller đưa dữ liệu vào state và render. Nếu fail, UI có thể đưa ra lỗi cụ thể thay vì vẽ bảng thiếu trường.

#### E. Điểm cần nhấn mạnh

- Envelope khác DTO.
- Bearer gắn ở client.
- Lỗi runtime được xử lý trước khi render.

#### F. Câu hỏi người nghe có thể đặt

**Vì sao cần hai bước kiểm response?**  
Lớp HTTP chỉ hiểu cấu trúc chung. Service biết trường nào có nghĩa đối với nghiệp vụ.

#### G. Chuyển tiếp

Muốn hai phía thống nhất DTO, xem quy trình đồng bộ OpenAPI.

#### H. Thời lượng

Khoảng 1 phút 5 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 28 — Chuỗi Chuyển Đổi: openapi.json → TypeScript Types → Services

#### A. Bối cảnh trình bày

Chương 6, http và hợp đồng api. Giải thích cách giảm lệch hợp đồng khi backend sửa API.

#### B. Thông điệp cốt lõi

Generator tạo kiểu từ đặc tả. Service vẫn kiểm dữ liệu thực tế tại runtime.

#### C. Giải thích nội dung

Ba khối nguồn, chuyển hóa và đích. VITE_SWAGGER_URL dẫn tới đặc tả. Script chuẩn hóa operationId trùng, ghi JSON và openapi.ts, rồi sinh alias nhóm trong services-type. Operation là một method/path.

**Đối chiếu bằng chứng.** VERIFIED cấu trúc snapshot có 66 paths và 86 operations. Quy trình codegen xác nhận qua script, không chạy lại trong audit này.

#### D. Lời thoại thuyết trình

Khi backend thay input của một endpoint, nhóm cập nhật đầu vào Swagger cho generator. Lệnh gen:types tạo bản đặc tả đã chuẩn hóa và kiểu TypeScript theo nhóm. Ví dụ body query records có thể dùng alias này để kiểm thuộc tính lúc biên dịch. Kiểu đó hỗ trợ người sửa code phát hiện lỗi sớm. Khi server thật trả response, mapper vẫn kiểm trường cần dùng vì kiểu TypeScript không kiểm nội dung mạng.

#### E. Điểm cần nhấn mạnh

- 86 operations ở snapshot.
- Codegen tạo lại alias.
- Kiểm runtime vẫn cần.

#### F. Câu hỏi người nghe có thể đặt

**Có nên sửa alias sinh tự động bằng tay không?**  
Thay nguồn đặc tả hoặc generator để lần sinh lại giữ được điều chỉnh.

#### G. Chuyển tiếp

Giờ ta đọc contract qua bốn bảng, bắt đầu từ Auth và User.

#### H. Thời lượng

Khoảng 55 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 29 — Ma Trận Khế Ước API: Nhóm Authentication & User Profile (6/6 LIVE)

#### A. Bối cảnh trình bày

Chương 6, http và hợp đồng api. Dạy cách đọc bảng API bằng nhóm phiên và tài khoản.

#### B. Thông điệp cốt lõi

Đọc method, path, auth, input, output rồi mới kết luận mức tích hợp.

#### C. Giải thích nội dung

Login/refresh công khai theo client, logout gắn Bearer, GET /health đi ngoài prefix. GET /users/me đọc hồ sơ, DELETE /users/me thuộc luồng xóa tài khoản. Hai hàng /users/me là hai operations. Trường token và body cần đối chiếu contract.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: 6/6 live, status/body chính xác và refresh rotation theo deployment.]

#### D. Lời thoại thuyết trình

Bắt đầu từ login và refresh: một thao tác nhận thông tin đăng nhập, thao tác sau dùng refresh token. Đến logout, client dùng access token của phiên. Health là đường công khai để kiểm dịch vụ. Hai hàng users/me có cùng đường dẫn nhưng một hàng đọc hồ sơ và hàng kia xóa tài khoản. Khi trình bày nhãn live, chỉ đánh dấu những thao tác có dữ liệu chứng minh ở môi trường được nêu.

#### E. Điểm cần nhấn mạnh

- Method và path tạo một operation.
- Health khác prefix.
- DELETE tác động tài khoản.

#### F. Câu hỏi người nghe có thể đặt

**Cùng path sao vẫn đếm hai API?**  
GET và DELETE thực hiện hai hành vi và có hai contract riêng.

#### G. Chuyển tiếp

Phiên cung cấp danh tính. Bảng kế tiếp cho thấy danh tính đó được dùng ở workspace.

#### H. Thời lượng

Khoảng 1 phút 10 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 30 — Ma Trận Khế Ước API: Nhóm Workspace & Thành Viên (12/14 LIVE)

#### A. Bối cảnh trình bày

Chương 6, http và hợp đồng api. Áp dụng cách đọc bảng vào workspace và thành viên.

#### B. Thông điệp cốt lõi

Nhìn bảng để tách đọc, thay đổi workspace và quản lý thành viên.

#### C. Giải thích nội dung

Dòng GET nói về cursor, POST tạo workspace, PATCH cập nhật có version. Các dòng members và transfer-owner là thay đổi người có quyền. Store hiện gửi email và expectedVersion cho transfer-owner.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: 12/14 live và các field minh họa như newOwnerId, kiểu member page.]

#### D. Lời thoại thuyết trình

Danh sách workspace cần tham số phân trang khi nhiều bản ghi. Khi ghi, ví dụ chỉnh tên, frontend gửi expectedVersion để backend so với phiên bản mới nhất. Tác vụ thêm thành viên hoặc chuyển chủ có tác động đến quyền, vì vậy cần đọc payload đúng từ source và thử với tài khoản phù hợp. Bảng cho ta bản đồ nhanh. Ví dụ riêng về transfer-owner trên slide phải được so với service trước khi dùng làm hợp đồng.

#### E. Điểm cần nhấn mạnh

- Cursor đọc trang.
- Version bảo vệ cập nhật.
- Transfer owner đổi người sở hữu.

#### F. Câu hỏi người nghe có thể đặt

**Có thể sao chép newOwnerId từ bảng để gọi API không?**  
Caller hiện dùng email và expectedVersion. Cần so Swagger và backend theo phiên bản đang thử.

#### G. Chuyển tiếp

Từ workspace ta đi vào project và dataset là tài nguyên con.

#### H. Thời lượng

Khoảng 1 phút 5 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 31 — Ma Trận Khế Ước API: Projects & Dataset Virtual Grid (34/40 LIVE)

#### A. Bối cảnh trình bày

Chương 6, http và hợp đồng api. Liên kết các endpoint với trải nghiệm mở project và Data View.

#### B. Thông điệp cốt lõi

Project dẫn tới dataset. Một màn hình có thể dùng nhiều API phục vụ các phần khác nhau.

#### C. Giải thích nội dung

Đọc lần lượt project gần đây, detail, schema, records, stats và PII. Detail có số dòng/cột, schema mô tả cột, records lấy trang, stats đọc một cột, PATCH đổi metadata. Request query dùng khi có điều kiện.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: 34/40 live, tham số sort của ví dụ và schema từ môi trường thử.]

#### D. Lời thoại thuyết trình

Trên giao diện, người dùng thấy một màn hình dataset nhưng dữ liệu đến từ nhiều nguồn. Detail cho biết quy mô, schema dựng cột, records cấp từng nhóm hàng. Khi chọn một cột, stats trả thông tin như tỷ lệ thiếu. Nếu người dùng đổi cờ PII, đó là một thao tác ghi riêng. Khi đọc bảng, hãy ghép mỗi hàng với một mục tiêu của người dùng thay vì đọc nguyên payload.

#### E. Điểm cần nhấn mạnh

- Stats theo column key.
- Records và schema tách riêng.
- PATCH là ghi.

#### F. Câu hỏi người nghe có thể đặt

**Nếu chỉ có id và cursor thì luôn gọi POST query không?**  
Service hiện dùng GET records cho trang thường, POST khi có search, filter hoặc sort.

#### G. Chuyển tiếp

Nếu người dùng phát hiện sự cố, nhóm API tiếp theo hỗ trợ gửi và quản trị báo cáo.

#### H. Thời lượng

Khoảng 1 phút 10 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 32 — Ma Trận Khế Ước API: Nhóm Issues & Admin Service (14/20 LIVE)

#### A. Bối cảnh trình bày

Chương 6, http và hợp đồng api. Chỉ ra hai góc nhìn của báo cáo sự cố.

#### B. Thông điệp cốt lõi

Người dùng gửi vấn đề và tệp. Admin có màn hình đọc theo trang và cập nhật trạng thái có kiểm version.

#### C. Giải thích nội dung

Đọc từ issue create và multipart attachment sang hai danh sách admin rồi PATCH status. Multipart là định dạng form hỗ trợ file. Source tạo issue dùng /issues, admin service gọi /admin/users và /admin/issues.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: 14/20 live, POST /issues/report trên slide và payload minh họa.]

#### D. Lời thoại thuyết trình

Sau khi gửi báo cáo, người dùng có thể đính kèm bằng chứng. Frontend cần ID issue trước để biết tệp thuộc báo cáo nào. Ở phía quản trị, danh sách người dùng và issue tải theo trang để xử lý từng nhóm. Đổi trạng thái issue gửi expectedVersion nhằm tránh ghi đè khi hai quản trị viên cùng xem. Tên đường dẫn và body trong bảng cần đọc cùng service đang chạy để demo đúng.

#### E. Điểm cần nhấn mạnh

- Multipart gửi file.
- Admin có scope riêng.
- expectedVersion áp dụng khi sửa trạng thái.

#### F. Câu hỏi người nghe có thể đặt

**Admin service có tạo báo cáo của người dùng không?**  
Caller tạo báo cáo nằm trong Management store. Admin service tập trung luồng quản trị.

#### G. Chuyển tiếp

Bảng chỉ mô tả đường thành công. Tiếp theo xem frontend xử lý đường lỗi.

#### H. Thời lượng

Khoảng 1 phút 5 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 33 — Chiến Lược Chuẩn Hóa & Kiểm Soát Lỗi Hệ Thống Toàn Diện

#### A. Bối cảnh trình bày

Chương 6, http và hợp đồng api. Giải thích cách chuyển lỗi kỹ thuật thành trạng thái có thể xử lý.

#### B. Thông điệp cốt lõi

Chuẩn hóa lỗi giúp caller chọn thông báo hoặc thao tác phục hồi phù hợp.

#### C. Giải thích nội dung

Cột trái nhóm 400, 401, 403, 404, 409 và 5xx. Cột phải phân biệt đọc và ghi. QueryClient hiện tắt retry mặc định. Các trường retryAfterMs có thể hướng dẫn lúc thử lại nếu caller dùng.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: retry tự động, quy tắc chung cho mọi 401/404/5xx. Source xác nhận cấu hình retry false.]

#### D. Lời thoại thuyết trình

Mã 400 thường yêu cầu kiểm input, 403 liên quan quyền, 409 báo xung đột ghi. Với timeout hoặc mất mạng, hãy xem thao tác đã gửi là đọc hay ghi. Đọc có thể cung cấp nút thử lại theo caller. Với ghi, nếu server đã xử lý nhưng phản hồi bị mất, bấm lại có thể tạo thêm bản ghi. Cấu hình query hiện không tự retry mặc định. Hành vi cụ thể của từng màn cần tìm trong caller.

#### E. Điểm cần nhấn mạnh

- 401 là xác thực, 403 là quyền.
- 409 kiểm phiên bản.
- Retry ghi có thể tạo trùng.

#### F. Câu hỏi người nghe có thể đặt

**Có tự retry một lần khi GET lỗi mạng không?**  
QueryClient tắt retry mặc định. UI có thể cung cấp thử lại theo luồng riêng.

#### G. Chuyển tiếp

Để chứng minh từng đường thành công và lỗi, ta nối giao diện với test qua ma trận.

#### H. Thời lượng

Khoảng 1 phút 5 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 34 — Ma Trận Truy Vết Toàn Trình (Technical Traceability Matrix)

#### A. Bối cảnh trình bày

Chương 7, truy vết và kiểm thử. Dạy kỹ thuật lần theo một tính năng từ thao tác đến test.

#### B. Thông điệp cốt lõi

Ma trận truy vết cho biết UI, hook, service, endpoint và bằng chứng kiểm thử liên quan.

#### C. Giải thích nội dung

Mỗi hàng là một nghiệp vụ. Đọc ngang từ login, workspace, records, renew đến attachment. Tên spec trong slide là gợi ý truy vết, đối chiếu với tên test thật như auth.service.test.ts, session-coordinator.test.ts và connected-api.test.ts.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: tên suite .spec.ts và mapping attachment/admin trên ma trận.]

#### D. Lời thoại thuyết trình

Chọn ví dụ gia hạn phiên. Người dùng thấy SessionRenewalDialog, lựa chọn được chuyển qua AuthContext, coordinator xử lý rồi auth service gọi endpoint refresh. Nếu kiểm một lỗi, hãy tìm bài test theo hành vi ở mắt xích cần kiểm. Cách đọc ngang này áp dụng được cho tạo workspace và đọc records. Với đính kèm, hãy theo caller tạo issue, sau đó request upload. Mục đích là tìm bằng chứng đủ sát tình huống thực tế.

#### E. Điểm cần nhấn mạnh

- Đọc ngang theo nghiệp vụ.
- Đối chiếu tên file test.
- Lỗi nên truy đúng tầng.

#### F. Câu hỏi người nghe có thể đặt

**Tại sao một hàng có thể cần nhiều test?**  
Test service kiểm contract, test UI kiểm tương tác và E2E kiểm sự phối hợp trên trình duyệt.

#### G. Chuyển tiếp

Sau khi biết tìm test nào, ta xem cách diễn giải tổng số test.

#### H. Thời lượng

Khoảng 1 phút 5 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 35 — Bằng Chứng Kiểm Thử Đạt Chuẩn Tuyệt Đối: 864/864 Tests PASS

#### A. Bối cảnh trình bày

Chương 7, truy vết và kiểm thử. Diễn giải báo cáo kiểm thử mà không suy rộng kết quả.

#### B. Thông điệp cốt lõi

Số test pass thuộc một lần chạy và tập test xác định.

#### C. Giải thích nội dung

Ba thẻ gồm số case, số suite và thời lượng. Case là một kỳ vọng, suite là nhóm ca hoặc file, giây là thời gian thực thi. 0 flaky cần nhiều lần chạy hoặc dữ liệu theo dõi.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: log 864/864, 71 suite, 162 giây, Node v26 và 0 flaky.]

#### D. Lời thoại thuyết trình

Slide ghi 864 ca, 71 suite và 162 giây. Khi nói, hãy gọi đó là số liệu được báo trong bản slide và đề nghị trích log của đúng commit khi dùng làm bằng chứng. Một lượt pass cho thấy các kỳ vọng của lượt chạy đó đạt. Kết quả không tự đo các hành vi ngoài phạm vi test, chẳng hạn tải lớn hay sự ổn định qua nhiều lần chạy. Cùng một dự án có thể có số ca khác khi thêm test hoặc chỉ chạy một nhóm.

#### E. Điểm cần nhấn mạnh

- Case khác suite.
- Gắn số liệu với commit.
- Flakiness cần dữ liệu lặp.

#### F. Câu hỏi người nghe có thể đặt

**Pass 100% có nghĩa là code không có lỗi không?**  
Có nghĩa các ca đã chạy trong báo cáo không thất bại. Các luồng chưa được kiểm vẫn cần bằng chứng khác.

#### G. Chuyển tiếp

Tổng số ca có ý nghĩa hơn khi biết mỗi tầng test đang kiểm gì.

#### H. Thời lượng

Khoảng 1 phút , gồm thời gian chỉ vào nội dung minh họa.

### Slide 36 — Kim Tự Tháp Kiểm Thử 4 Tầng: Từ Đáy Mã Nguồn Đến Live Retest

#### A. Bối cảnh trình bày

Chương 7, truy vết và kiểm thử. Đặt từng loại test vào mục đích kiểm chứng.

#### B. Thông điệp cốt lõi

Kết hợp unit, integration, browser E2E và live retest cho các loại bằng chứng khác nhau.

#### C. Giải thích nội dung

Đọc kim tự tháp từ đáy: hàm nhỏ, phối hợp module, trình duyệt, môi trường nghiệm thu. Unit kiểm ví dụ token parser. Integration ghép coordinator với port giả. Live retest dùng đúng deployment và tài khoản.

**Đối chiếu bằng chứng.** IMPLEMENTED có file Vitest và Playwright. [NEEDS VERIFICATION: số suite chạy thành công và retest live.]

#### D. Lời thoại thuyết trình

Khi sửa hàm parse token, unit test là điểm bắt đầu nhanh. Khi muốn biết coordinator có dọn storage và cache đúng không, ghép nhiều phụ thuộc trong integration test. Khi muốn xem guard hoặc dialog hoạt động đúng qua thao tác, dùng trình duyệt. Cuối cùng dùng môi trường live để kiểm hợp đồng và quyền thực tế. Tầng trên đắt hơn về dữ liệu và thời gian nên cần chọn hành trình đại diện.

#### E. Điểm cần nhấn mạnh

- Unit nhanh và hẹp.
- Browser thật có thể vẫn mô phỏng mạng.
- Live retest cần điều kiện riêng.

#### F. Câu hỏi người nghe có thể đặt

**E2E có đồng nghĩa backend thật không?**  
E2E mô tả phạm vi luồng. Tùy cấu hình, backend có thể là mock hoặc live.

#### G. Chuyển tiếp

Ta xem cấu hình Playwright hiện tại để biết frontend dùng loại bằng chứng nào.

#### H. Thời lượng

Khoảng 55 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 37 — Kiểm Thử Trình Duyệt Thực Tế Với Playwright E2E Suite

#### A. Bối cảnh trình bày

Chương 7, truy vết và kiểm thử. Giải thích cách kiểm thử frontend trên trình duyệt hiện tại.

#### B. Thông điệp cốt lõi

Playwright chạy thao tác thực tế trên Chromium. Cấu hình và spec quyết định các điều kiện cụ thể.

#### C. Giải thích nội dung

Code block minh họa lệnh dev:e2e và cổng 4173. Config hiện đặt reuseExistingServer false. Cây tests/e2e có guard, login/reload, logout, theme, admin, reachability và lifecycle workspace/project.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: báo cáo pass, 6 suite, wizard/renewal trong slide và cấu hình reuseExistingServer cũ.]

#### D. Lời thoại thuyết trình

Muốn kiểm hành trình người dùng, Playwright khởi động server frontend riêng và mở trang trên Chromium. Một ca kiểm guard không cần đăng nhập, còn những ca live cần backend thử và tài khoản phù hợp. Trong repo hiện có ca auth, quản trị, theme và vòng đời tài nguyên. Hãy phân biệt danh sách spec với danh sách test đã đạt. Nếu trình bày kết quả pass, dùng báo cáo của lần chạy trên đúng môi trường.

#### E. Điểm cần nhấn mạnh

- Cổng 4173.
- Config hiện không tái sử dụng server.
- Không trình chiếu credentials.

#### F. Câu hỏi người nghe có thể đặt

**Có thể nói wizard dialog renewal đã pass chỉ từ slide không?**  
Cần tìm spec tương ứng và kết quả chạy. Danh sách test hiện tại kiểm được từ cây source.

#### G. Chuyển tiếp

Tiếp theo, đọc coverage như một số đo khác với số test pass.

#### H. Thời lượng

Khoảng 1 phút 5 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 38 — Báo Cáo Phủ Mã Nguồn Lịch Sử 70.83% & Kế Hoạch CI/CD

#### A. Bối cảnh trình bày

Chương 7, truy vết và kiểm thử. Phân biệt độ phủ và chất lượng bằng chứng.

#### B. Thông điệp cốt lõi

Coverage lịch sử cho biết tỷ lệ code được thực thi theo một chỉ số. Nên ghi rõ metric và phiên bản.

#### C. Giải thích nội dung

Thẻ 70,83% là số được slide trích. Các gạch bên cạnh là kế hoạch hook, ca lỗi và artifact pipeline. Coverage có thể là lines, branches, functions hoặc statements. Slide chưa chỉ rõ loại.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: báo cáo gốc 70,83%, loại metric, commit và trạng thái cài hook/pipeline.]

#### D. Lời thoại thuyết trình

Khi chạy test, report coverage có thể cho biết test đi qua bao nhiêu dòng, nhánh hoặc hàm. Hỏi trước: 70,83% đang đo loại nào và ở commit nào? Sau đó nhìn các nhánh nghiệp vụ có rủi ro, như xung đột cập nhật và lỗi quyền. Kế hoạch CI/CD giúp lặp lại việc đo và lưu báo cáo. Dùng coverage để tìm chỗ thiếu bằng chứng, đồng thời giữ các test có assertion sát hành vi.

#### E. Điểm cần nhấn mạnh

- Tỷ lệ phải ghi metric.
- Số lịch sử cần ngày/commit.
- CI plan là kế hoạch.

#### F. Câu hỏi người nghe có thể đặt

**Coverage tăng có chắc phát hiện nhiều lỗi hơn không?**  
Điều đó phụ thuộc chất lượng assertion, dữ liệu và nhánh được kiểm.

#### G. Chuyển tiếp

Từ chất lượng kiểm thử, chuyển sang những tích hợp vẫn cần hoàn thiện.

#### H. Thời lượng

Khoảng 55 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 39 — Khoảng Trống Hiện Tại: Các Phần Chờ Hoàn Thiện Phía Backend

#### A. Bối cảnh trình bày

Chương 8, giới hạn và nghiệm thu. Đặt kỳ vọng đúng về phạm vi phần còn thiếu.

#### B. Thông điệp cốt lõi

Các khoảng trống nên mô tả theo hành vi frontend, bằng chứng backend và ảnh hưởng người dùng.

#### C. Giải thích nội dung

Bảng gồm notification stream, worker progress và tọa độ 3D. Realtime stream đẩy sự kiện, polling hỏi định kỳ, fixture cấp dữ liệu mẫu. Chưa kiểm deployment thì ghi giới hạn theo phạm vi FE.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: deployment realtime, nguồn polling, stream tiến độ và API lưu tọa độ.]

#### D. Lời thoại thuyết trình

Nhìn từng dòng theo ba câu hỏi: người dùng thấy gì, dữ liệu đến từ đâu, còn thiếu xác minh nào? UI thông báo có thể hoạt động với dữ liệu tải theo request. Tiến độ xử lý file lớn là luồng riêng cần xác định nguồn sự kiện. Scene Workspace 3D có thể chạy với dữ liệu mẫu. Nếu backend có module realtime trong repo, ta vẫn cần kiểm kết nối frontend và deployment để nói tính năng đã hoạt động.

#### E. Điểm cần nhấn mạnh

- UI list khác stream.
- Worker progress là luồng riêng.
- Fixture giúp demo bố cục.

#### F. Câu hỏi người nghe có thể đặt

**Có thể kết luận backend chưa có WebSocket chỉ từ việc FE chưa dùng không?**  
Cần kiểm backend và deployment. Từ FE chỉ kết luận được mức nối đã quan sát.

#### G. Chuyển tiếp

Từ khoảng trống tính năng, chuyển sang các rủi ro cần kiểm soát ở code hiện tại.

#### H. Thời lượng

Khoảng 1 phút , gồm thời gian chỉ vào nội dung minh họa.

### Slide 40 — Phân Tích Nợ Kỹ Thuật (Technical Debt) & Rủi Ro Tiềm Ẩn

#### A. Bối cảnh trình bày

Chương 8, giới hạn và nghiệm thu. Tách phần cần bảo trì khỏi rủi ro vận hành.

#### B. Thông điệp cốt lõi

Mỗi khoản nợ cần xác định điều kiện xảy ra, tác động và cách kiểm.

#### C. Giải thích nội dung

Cột trái nêu lint, file lớn và redirect cũ. Cột phải gồm giới hạn quota, lỗi giữa chừng và lệch DTO. Storage estimate là phép ước lượng. Transaction Dexie và chuỗi upload server có phạm vi khác nhau.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: số lỗi lint tại commit, phạm vi rollout và giả định rollback server.]

#### D. Lời thoại thuyết trình

Một khoản nợ như file lớn gây khó đọc và sửa. Một rủi ro như lỗi giữa chừng có thể để lại project đã tạo nhưng chưa có file. Repository có giao dịch cục bộ và kiểm quota để giảm lỗi ở trình duyệt. Store cần thông báo rõ trạng thái nếu lỗi ở server. Khi backend đổi DTO, generator hỗ trợ đồng bộ nhưng bước review mapper và test vẫn cần. Nói song song mỗi rủi ro với cách phát hiện của nó.

#### E. Điểm cần nhấn mạnh

- Quota có thể thay đổi.
- Lỗi cục bộ khác lỗi đa request.
- Codegen cần review.

#### F. Câu hỏi người nghe có thể đặt

**Storage estimate có bảo đảm ghi thành công không?**  
Ước lượng hỗ trợ preflight. Giao dịch vẫn có thể fail do quota hoặc lỗi storage.

#### G. Chuyển tiếp

Từ đây nhóm chọn việc cần làm trước khi nghiệm thu.

#### H. Thời lượng

Khoảng 1 phút , gồm thời gian chỉ vào nội dung minh họa.

### Slide 41 — 3 Ưu Tiên Hành Động Kỹ Thuật Cấp Thiết Trước Khi Nghiệm Thu Live

#### A. Bối cảnh trình bày

Chương 8, giới hạn và nghiệm thu. Chuyển danh sách rủi ro thành công việc có bằng chứng bàn giao.

#### B. Thông điệp cốt lõi

Ba ưu tiên là kiểm lại API live, mở rộng E2E dữ liệu lớn và chốt contract realtime.

#### C. Giải thích nội dung

Ba thẻ là đề xuất tương lai. Retest cần inventory và kết quả theo endpoint. E2E grid cần dataset và tiêu chí đo. Realtime cần contract, quyền, hành vi reconnect và cập nhật UI.

**Đối chiếu bằng chứng.** PLANNED theo slide. Tiêu chí và owner cần chốt cùng nhóm.

#### D. Lời thoại thuyết trình

Ưu tiên đầu là chọn môi trường thử nghiệm, danh sách operation và tài khoản theo quyền để retest. Sau đó thêm hành trình grid với dữ liệu đủ lớn và tiêu chí rõ ràng cho cuộn, lọc, thời gian đáp ứng. Cuối cùng, làm việc với backend để chốt sự kiện realtime, khi nào phát và cách UI xử lý mất kết nối. Mỗi việc chỉ được đóng khi có bằng chứng phù hợp, như report run hoặc hợp đồng đã thống nhất.

#### E. Điểm cần nhấn mạnh

- Đây là PLANNED.
- Đặt tiêu chí trước khi test.
- Realtime cần chốt giao thức.

#### F. Câu hỏi người nghe có thể đặt

**Có nhất thiết WebSocket là lựa chọn đã chốt không?**  
Slide nêu đề xuất. Cần xác nhận thiết kế và phạm vi với backend.

#### G. Chuyển tiếp

Khép lại bằng những gì frontend đã dựng và điều kiện để chốt nghiệm thu.

#### H. Thời lượng

Khoảng 55 giây, gồm thời gian chỉ vào nội dung minh họa.

### Slide 42 — Hệ Thống Đạt Chuẩn Kiến Trúc & Sẵn Sàng Nghiệm Thu

#### A. Bối cảnh trình bày

Chương 8, giới hạn và nghiệm thu. Kết bài bằng giá trị người dùng và bước xác minh còn lại.

#### B. Thông điệp cốt lõi

Frontend có kiến trúc và luồng nghiệp vụ có thể truy vết. Nghiệm thu cần dữ liệu kiểm chứng đúng môi trường.

#### C. Giải thích nội dung

Biểu tượng dấu kiểm là hình kết luận. Đọc thông điệp về luồng dữ liệu, kiến trúc, quản lý phiên, test và khoảng trống theo bằng chứng ở các chương trước. Đưa câu hỏi về slide chi tiết phù hợp.

**Đối chiếu bằng chứng.** [NEEDS VERIFICATION: kết luận PASSED 100%, mức an toàn tuyệt đối và sẵn sàng nghiệm thu.]

#### D. Lời thoại thuyết trình

Qua một ví dụ từ file CSV đến báo cáo sự cố, chúng ta đã thấy cách frontend đưa dữ liệu vào workspace, kiểm schema, hiển thị records và theo dõi vấn đề. Kiến trúc cho phép lần từ một thao tác trên UI đến service, contract và test. Khi chốt bàn giao, nhóm sẽ gắn các số liệu trên báo cáo với log đúng phiên bản và kiểm lại những luồng live còn mở. Cảm ơn mọi người đã theo dõi. Nhóm sẵn sàng trao đổi về kiến trúc, dữ liệu và kiểm thử.

#### E. Điểm cần nhấn mạnh

- Kết bằng giá trị nghiệp vụ.
- Tóm tắt phần có source.
- Nêu điều kiện nghiệm thu.

#### F. Câu hỏi người nghe có thể đặt

**Có thể bàn giao ngay theo dòng PASSED 100% không?**  
Cần tiêu chí nghiệm thu, build và log live trên bản triển khai. Slide là tổng kết của bài báo cáo.

#### G. Chuyển tiếp

Mời câu hỏi. Khi trả lời, quay lại sơ đồ hoặc bảng API liên quan nếu cần.

#### H. Thời lượng

Khoảng 55 giây, gồm thời gian chỉ vào nội dung minh họa.

## 4. Complete Presentation Script

Kịch bản có khoảng 4075 đơn vị cách trắng. Giả định nói 125 đơn vị/phút, phần lời thoại mất khoảng 33 phút. Ngân sách 42 phút 25 giây trong bảng chương gồm thêm thời gian chỉ vào bảng, giải thích hình và chuyển slide. Hỏi đáp sau bài tính riêng.

Mở HTML ở Slide 01 và chào người nghe: “Chào thầy cô và các bạn. Nhóm xin trình bày cách frontend hỗ trợ kiểm tra chất lượng dữ liệu, từ lúc đưa một file CSV vào đến khi theo dõi và xác minh kết quả.”

### Chương 1 — Tổng quan và mức bằng chứng (3:30)

**Hiển thị 01**

Giả sử một nhóm có file CSV khách hàng và muốn biết cột nào thiếu dữ liệu hoặc chứa thông tin cá nhân. Họ cần một nơi đưa file vào dự án, xem cấu trúc và theo dõi vấn đề. Phần trình bày hôm nay đi từ trải nghiệm đó đến cách frontend gọi backend, quản lý phiên và kiểm tra phần đã làm. Trước hết, hãy nhìn ba dấu hiệu trên trang bìa như các chủ đề sẽ được kiểm chứng trong bài: phạm vi tích hợp, kiểm thử và hợp đồng dữ liệu.

Bắt đầu bằng bức tranh tiến độ để biết các bằng chứng thuộc phạm vi nào.

**Chuyển Slide 02**

Ba con số ở đây trả lời ba câu hỏi khác nhau. Bao nhiêu operation đã được nối vào frontend? Bao nhiêu ca kiểm thử đã đạt trong lần chạy được ghi trên slide? Những phần nào người dùng vẫn gặp dữ liệu mẫu hoặc hành vi cục bộ? Swagger trong repo cho ta 86 operation. Để khẳng định 66 đã chạy live, cần danh sách từng operation gắn với kết quả gọi thật. Cũng vậy, số test pass phải đi kèm phiên bản code và lần chạy.

Để đọc tiến độ đúng, ta cần quy ước về mức bằng chứng.

**Chuyển Slide 03**

Ví dụ, một màn hình hiện danh sách project có thể đã được viết và chạy được với dữ liệu mẫu. Khi test dùng adapter giả, ta biết UI xử lý các tình huống đã mô phỏng. Để nói đã chạy live, ta cần gọi đúng server, với dữ liệu và quyền phù hợp, rồi lưu kết quả. Trong phần còn lại, hãy nghe mức bằng chứng đi cùng với từng kết luận, đặc biệt ở các bảng API.

Áp dụng các nhãn đó vào bản đồ tích hợp và bốn nhóm ngoại lệ.

**Chuyển Slide 04**

Nhìn cột trái như bản đồ từ đăng nhập đến xử lý dữ liệu và báo sự cố. Cột bên phải là nơi dễ hiểu nhầm khi demo: cảnh 3D có thể dùng cây mẫu, trạng thái realtime cần kiểm mức tích hợp, còn bản nháp Dexie là dữ liệu thật của người dùng nằm cục bộ. Khi mô tả demo, hãy chỉ rõ thao tác nào tạo request đến server và thao tác nào chỉ cập nhật giao diện hoặc dữ liệu trong trình duyệt.

Sau phạm vi tính năng, ta xem hệ thống giao diện giúp người dùng nhận diện trạng thái thế nào.

### Chương 2 — Design System (2:25)

**Chuyển Slide 05**

Hãy nhìn cột nền trước: canvas là mặt chung, surface là bề mặt đặt nội dung như thẻ. Sau đó nhìn nhóm màu chủ đạo để tìm hành động chính. Cuối cùng là tín hiệu nghiệp vụ, ví dụ màu cảnh báo nên đi kèm chữ để người dùng biết tác vụ cần chú ý gì. Cách đặt tên theo vai trò giúp người sửa giao diện hiểu màu dùng ở đâu và giúp kiểm tra tương phản theo từng cặp chữ và nền.

Màu giúp nhận diện, còn chữ, khoảng cách và chuyển động định hướng cách đọc.

**Chuyển Slide 06**

Khi người dùng nhìn một bảng, trước hết họ cần nhận ra tiêu đề, sau đó là nhãn và giá trị. Font giao diện phục vụ câu dài. Font monospace giúp nhìn dấu gạch, ID và đường dẫn rõ hơn. Tương tự, khi mở dialog, chuyển động ngắn giúp mắt theo dõi điểm thay đổi. Nếu người dùng giảm chuyển động, điều quan trọng nhất vẫn là trạng thái và khả năng thực hiện thao tác.

Từ những quy tắc thị giác, ta chuyển sang cách tổ chức linh kiện.

**Chuyển Slide 07**

Ví dụ, nút xác nhận dùng kiểu Button chung. Dialog ghép nút, nội dung và cách đóng. Khung ứng dụng bố trí topbar và vùng hiển thị. Wizard đi xa hơn: nó có bước nhập, file và xác nhận. Khi thay đổi bố cục nút dùng chung ta tìm Design System. Khi thay đổi cách tạo project ta tìm wizard, hook và service liên quan.

Sau cấu trúc linh kiện, xem các tầng phối hợp với API và storage thế nào.

### Chương 3 — Tổ chức kiến trúc (6:40)

**Chuyển Slide 08**

Khi người dùng mở dataset, view cần dữ liệu nhưng không nên phải biết mọi chi tiết Axios. Hook hoặc provider điều phối nhu cầu, service biết endpoint và kiểm tra dữ liệu. HTTP client lo đường dẫn, token và lỗi chung. Với phiên, runtime ghép storage thật vào coordinator. Trong test có thể thay storage hoặc transport để kiểm từng tình huống. Đây là cách đọc sáu vùng trách nhiệm trong sơ đồ.

Tiếp theo hãy theo một request đi xuống và kết quả đi ngược lên.

**Chuyển Slide 09**

Lấy ví dụ người dùng yêu cầu danh sách workspace. UI báo thao tác, service biết endpoint và lớp HTTP gửi request. Khi dữ liệu quay lại, client đọc cấu trúc chung, service kiểm tra mục cần dùng rồi store cập nhật để màn hình render. Dữ liệu đi hai chiều qua cùng các lớp. Hướng import là câu hỏi khác, cần dựa vào cấu trúc source và kiểm tra dependency riêng.

Từ mũi tên trừu tượng, chuyển sang chỗ tìm code trong src.

**Chuyển Slide 10**

Khi muốn tìm một chức năng, đừng mở mọi thư mục cùng lúc. Bắt đầu ở app để biết route, sang views hoặc components để tìm điểm bấm, rồi services để thấy thao tác dữ liệu. Nếu vấn đề là lưu bản nháp, qua repositories. Nếu lỗi nằm ở việc gắn token hay xử lý response, qua lib. Bảng trên slide liệt kê các nhóm chính. Con số 14 ở tiêu đề lệch với 17 thư mục hiện thấy trong source.

Đã biết cấp thư mục chính, ta mở xuống các nhóm con.

**Chuyển Slide 11**

Nếu chức năng đang sửa là gia hạn phiên, vị trí tự nhiên là services/auth. Nếu là bảng dataset, xem processing và provider tương ứng. Nếu route chuyển hướng nhầm, kiểm tra app/router và app/guards. Cách chia này giúp một lỗi có địa chỉ rõ ràng. Bảng mô tả các nhóm đại diện, ví dụ health gọi kiểm tra do backend cung cấp nên ý nghĩa chi tiết phải đọc contract.

Từ nhóm con, ta chọn bốn file trung tâm để thấy đầu vào và đầu ra.

**Chuyển Slide 12**

Hãy đọc bảng theo dạng ai nhận gì và ai dùng kết quả. Runtime dựng các thành phần rồi giao chúng cho ứng dụng. Coordinator nhận lời gọi của người dùng và trả snapshot để UI biết phiên đang ở đâu. Management store cập nhật dữ liệu nghiệp vụ cho các màn hình. Repository draft giữ dữ liệu cục bộ theo quyền phiên. Khi debug, câu hỏi đầu tiên là lỗi nằm ở bước ghép phụ thuộc, xử lý phiên, tải dữ liệu hay lưu bản nháp.

Ta phóng to runtime để giải thích lúc tạo và hủy tài nguyên.

**Chuyển Slide 13**

Trong dev, React có thể chạy lại setup và cleanup của effect để phát hiện lỗi vòng đời. Nếu đóng database ngay khi thấy cleanup đầu tiên, lần setup kế tiếp có thể gặp runtime đã bị hủy. Ở đây retain trả về hàm giải phóng. Việc kiểm tra ở microtask cho setup cùng lượt cơ hội nhận lại runtime. Khi thực sự hết owner, runtime dọn coordinator và database. Điều này giải thích một rủi ro cụ thể, còn kết luận về rò rỉ cần đo thêm.

Bây giờ đặt runtime vào thứ tự ứng dụng khởi động.

**Chuyển Slide 14**

Khi mở ứng dụng, trình duyệt tải trang SPA và entry JavaScript. Entry có nhánh preview dev, còn luồng chính đi vào bootstrap để lắp runtime và query client. Trong lúc chưa biết trạng thái phiên, UI có thể hiện skeleton. Coordinator đọc bản ghi phiên rồi xác thực hồ sơ với token còn hạn. Guard dùng kết quả để cho qua hoặc chuyển về đăng nhập. Nếu không có đích hợp lệ để quay lại, source hiện đặt mặc định là Processing.

Ta cần đọc kỹ những pha mà guard và dialog dựa vào.

### Chương 4 — Phiên và xác thực (5:55)

**Chuyển Slide 15**

Một người đang đăng nhập có thể đóng màn hình hoặc bắt đầu luồng phiên khác trước khi request cũ hoàn tất. Coordinator lưu số generation lúc bắt đầu và so lại trước khi cập nhật. UI dựa vào phase: đang khôi phục thì chờ, đang chờ consent thì mở dialog, có phiên trực tuyến thì tiếp tục. Local-limited diễn tả một số tình huống mất kết nối với phiên còn hạn. Hãy đọc các nhãn như một bản đồ trạng thái thay vì đếm theo tiêu đề.

Sau trạng thái, xem dữ liệu nhỏ nhất cần lưu để khôi phục phiên.

**Chuyển Slide 16**

Khối JSON trên slide là ví dụ cấu trúc, hãy tránh đọc token mẫu như một giá trị dùng thật. Adapter kiểm phiên bản schema, tài khoản và hạn token trước khi trả dữ liệu. Khi gửi request bảo vệ, client gắn Bearer theo code của ứng dụng. Cách này có đặc tính khác cookie tự gửi, còn an toàn tổng thể phụ thuộc việc bảo vệ JavaScript trên trang và xác thực phía backend. Khi cần kết thúc quyền trên server, ta dùng luồng logout sẽ nói sau.

Dùng cấu trúc vừa giới thiệu để đọc sơ đồ đăng nhập và reload.

**Chuyển Slide 17**

Bắt đầu ở Client, nơi người dùng gửi form. Coordinator gọi API đăng nhập công khai. Nếu phản hồi chứa phiên và user khớp, nó có thể lưu và phát authenticated cho UI. Khi tải lại, đầu vào khác: coordinator đọc dữ liệu lưu rồi dùng access token còn hạn để hỏi hồ sơ server và đối chiếu tài khoản. Hai đoạn trên SVG giúp hiểu các vai, nhưng khi mô tả code hãy giữ hai luồng riêng. Cuối cùng guard chọn đích hợp lệ, mặc định là Processing.

Phiên có thể hết hạn, vậy lần gia hạn diễn ra như thế nào?

**Chuyển Slide 18**

Hãy nhìn ba vai như trước, nhưng lần này người dùng đã có bản ghi phiên. Khi coordinator xử lý một access token hết hạn, nó kiểm tra health. Nếu dịch vụ sẵn sàng, UI hỏi người dùng có gia hạn hay không. Sau khi đồng ý, coordinator dùng refresh token lấy candidate session. Nó còn dùng access token ứng viên đọc hồ sơ để xác nhận cùng tài khoản trước khi ghi và phục hồi UI. Nếu từ chối hoặc gia hạn thất bại, code hiện đi qua luồng kết thúc phiên cục bộ.

Từ nhánh dừng gia hạn, phân biệt với thao tác đăng xuất chủ động.

**Chuyển Slide 19**

Khi nhấn đăng xuất, điều người dùng thấy trước là UI kết thúc phiên. Coordinator giữ lời gọi logout gắn với đúng access token cũ nếu còn dùng được. Nó kết thúc phiên cục bộ rồi thực hiện yêu cầu thu hồi. Nhờ tách hai kết quả, mất mạng không biến thành khẳng định server đã thu hồi. Việc dọn cache giúp dữ liệu của người cũ không xuất hiện khi người tiếp theo đăng nhập.

Có phiên hợp lệ rồi, ta chuyển sang luồng quản lý workspace.

### Chương 5 — Luồng nghiệp vụ (7:30)

**Chuyển Slide 20**

Ví dụ hai thành viên cùng nhìn workspace ở phiên bản 2. Người đầu tiên sửa tên và server cập nhật phiên bản. Khi người thứ hai gửi thay đổi dựa trên bản cũ, expectedVersion giúp backend phát hiện và trả xung đột thay vì âm thầm chồng dữ liệu. Người dùng cần xem lại bản mới rồi quyết định chỉnh tiếp. Khi minh họa chuyển chủ, nên đọc payload hiện hành từ service vì trường hiển thị trên bảng có thể đã cũ.

Khi đã có workspace, ta đi vào quy trình tạo một project và nạp CSV.

**Chuyển Slide 21**

Người dùng chọn workspace, đặt tên và chọn CSV. Tại lúc xác nhận, hãy hình dung một chuỗi request: tạo project trước để có ID, dùng ID tải file, sau đó thêm thành viên theo lựa chọn. Nếu upload thất bại, project vừa tạo có thể đã tồn tại. UI hướng người dùng vào project để kiểm tra, và store có trạng thái tiến độ của lần thao tác. Đây là khác biệt quan trọng so với giả định cả chuỗi được rollback như một giao dịch duy nhất.

Project đã tồn tại thì câu hỏi tiếp theo là ai được thao tác ở mỗi cấp.

**Chuyển Slide 22**

Một người thuộc workspace chưa chắc thực hiện được mọi thao tác trong mọi project. Khi người trình bày chỉ vào bảng, hãy hỏi quyền nào, trên tài nguyên nào, do ai thực hiện. UI có thể ẩn thao tác dựa trên ngữ cảnh. Khi người dùng gửi request, backend vẫn cần xác nhận quyền ở tài nguyên cụ thể. Một ca test thật nên dùng cả tài khoản được phép và tài khoản bị từ chối để chứng minh hai nhánh.

Khi người dùng được phép mở project, họ có thể xem cấu trúc và chất lượng của dataset.

**Chuyển Slide 23**

Nếu cần kiểm chất lượng một cột email, trước tiên xem tên và kiểu trong schema. Dùng key kỹ thuật của cột để gọi thống kê, chẳng hạn số ô trống. Người có quyền có thể gắn cờ PII cho cột để hệ thống biết đây là dữ liệu nhạy cảm. Cờ là thông tin phân loại. Việc dữ liệu được che ở màn hình hoặc báo cáo nào cần kiểm từng đường hiển thị và xuất file.

Schema nói về cột. Slide tiếp theo nói về cách đọc từng trang dữ liệu hàng.

**Chuyển Slide 24**

Với file lớn, lý tưởng là trình duyệt chỉ xin một phần hàng. Server trả items và một con trỏ để xin trang tiếp theo. Nếu người dùng thêm lọc hoặc sắp xếp, service hiện gửi điều kiện qua nhánh query. Một câu hỏi khác là mỗi lần trình duyệt vẽ bao nhiêu hàng. Điều đó thuộc virtual scrolling và cần kiểm implementation cùng số đo. Phần chắc chắn từ source là cách lấy trang và kiểm response, kể cả con trỏ lặp.

Nếu từ dữ liệu phát hiện lỗi, người dùng có thể tạo báo cáo sự cố.

**Chuyển Slide 25**

Giả sử một dòng dữ liệu có giá trị ngày bất thường. Người dùng báo vấn đề bằng tiêu đề, mô tả và có thể gửi tệp minh họa. Store tạo issue để có ID, rồi mới tải tệp vào issue đó. Khi quản trị cần thêm thông tin, trạng thái giúp hai bên hiểu việc gì còn thiếu. Trong demo, hãy nói rõ bước nào giao diện hiện có caller và bước nào cần xác nhận lại với backend.

Bước lỗi giữa chừng dẫn tới câu hỏi lưu bản nháp và đồng bộ cục bộ.

**Chuyển Slide 26**

Nếu người dùng cần giữ một file nháp, repository lưu metadata và file trong hai bảng liên quan. Quyền đọc hoặc ghi dựa trên snapshot của phiên. Nếu giao dịch IndexedDB lỗi, các thao tác trong giao dịch được xử lý cùng nhau. Khi có xác nhận upload trùng với draft và phiên, repository cập nhật trạng thái và dọn nội dung theo luồng hiện tại. Đây là biên cục bộ, nên không thay thế idempotency hay cơ chế khôi phục phía server.

Sau các luồng nghiệp vụ, ta xem chúng dùng chung pipeline request ra sao.

### Chương 6 — HTTP và hợp đồng API (7:35)

**Chuyển Slide 27**

Giả sử người dùng mở schema một dataset. UI biết ID nhưng giao việc gọi API cho service. Axios thêm đường dẫn và token, gửi sang backend. Khi trả về, lớp HTTP mở phần bọc chung. Sau đó service kiểm xem danh sách cột có hợp lệ hay không. Nếu kiểm qua, caller đưa dữ liệu vào state và render. Nếu fail, UI có thể đưa ra lỗi cụ thể thay vì vẽ bảng thiếu trường.

Muốn hai phía thống nhất DTO, xem quy trình đồng bộ OpenAPI.

**Chuyển Slide 28**

Khi backend thay input của một endpoint, nhóm cập nhật đầu vào Swagger cho generator. Lệnh gen:types tạo bản đặc tả đã chuẩn hóa và kiểu TypeScript theo nhóm. Ví dụ body query records có thể dùng alias này để kiểm thuộc tính lúc biên dịch. Kiểu đó hỗ trợ người sửa code phát hiện lỗi sớm. Khi server thật trả response, mapper vẫn kiểm trường cần dùng vì kiểu TypeScript không kiểm nội dung mạng.

Giờ ta đọc contract qua bốn bảng, bắt đầu từ Auth và User.

**Chuyển Slide 29**

Bắt đầu từ login và refresh: một thao tác nhận thông tin đăng nhập, thao tác sau dùng refresh token. Đến logout, client dùng access token của phiên. Health là đường công khai để kiểm dịch vụ. Hai hàng users/me có cùng đường dẫn nhưng một hàng đọc hồ sơ và hàng kia xóa tài khoản. Khi trình bày nhãn live, chỉ đánh dấu những thao tác có dữ liệu chứng minh ở môi trường được nêu.

Phiên cung cấp danh tính. Bảng kế tiếp cho thấy danh tính đó được dùng ở workspace.

**Chuyển Slide 30**

Danh sách workspace cần tham số phân trang khi nhiều bản ghi. Khi ghi, ví dụ chỉnh tên, frontend gửi expectedVersion để backend so với phiên bản mới nhất. Tác vụ thêm thành viên hoặc chuyển chủ có tác động đến quyền, vì vậy cần đọc payload đúng từ source và thử với tài khoản phù hợp. Bảng cho ta bản đồ nhanh. Ví dụ riêng về transfer-owner trên slide phải được so với service trước khi dùng làm hợp đồng.

Từ workspace ta đi vào project và dataset là tài nguyên con.

**Chuyển Slide 31**

Trên giao diện, người dùng thấy một màn hình dataset nhưng dữ liệu đến từ nhiều nguồn. Detail cho biết quy mô, schema dựng cột, records cấp từng nhóm hàng. Khi chọn một cột, stats trả thông tin như tỷ lệ thiếu. Nếu người dùng đổi cờ PII, đó là một thao tác ghi riêng. Khi đọc bảng, hãy ghép mỗi hàng với một mục tiêu của người dùng thay vì đọc nguyên payload.

Nếu người dùng phát hiện sự cố, nhóm API tiếp theo hỗ trợ gửi và quản trị báo cáo.

**Chuyển Slide 32**

Sau khi gửi báo cáo, người dùng có thể đính kèm bằng chứng. Frontend cần ID issue trước để biết tệp thuộc báo cáo nào. Ở phía quản trị, danh sách người dùng và issue tải theo trang để xử lý từng nhóm. Đổi trạng thái issue gửi expectedVersion nhằm tránh ghi đè khi hai quản trị viên cùng xem. Tên đường dẫn và body trong bảng cần đọc cùng service đang chạy để demo đúng.

Bảng chỉ mô tả đường thành công. Tiếp theo xem frontend xử lý đường lỗi.

**Chuyển Slide 33**

Mã 400 thường yêu cầu kiểm input, 403 liên quan quyền, 409 báo xung đột ghi. Với timeout hoặc mất mạng, hãy xem thao tác đã gửi là đọc hay ghi. Đọc có thể cung cấp nút thử lại theo caller. Với ghi, nếu server đã xử lý nhưng phản hồi bị mất, bấm lại có thể tạo thêm bản ghi. Cấu hình query hiện không tự retry mặc định. Hành vi cụ thể của từng màn cần tìm trong caller.

Để chứng minh từng đường thành công và lỗi, ta nối giao diện với test qua ma trận.

### Chương 7 — Truy vết và kiểm thử (5:00)

**Chuyển Slide 34**

Chọn ví dụ gia hạn phiên. Người dùng thấy SessionRenewalDialog, lựa chọn được chuyển qua AuthContext, coordinator xử lý rồi auth service gọi endpoint refresh. Nếu kiểm một lỗi, hãy tìm bài test theo hành vi ở mắt xích cần kiểm. Cách đọc ngang này áp dụng được cho tạo workspace và đọc records. Với đính kèm, hãy theo caller tạo issue, sau đó request upload. Mục đích là tìm bằng chứng đủ sát tình huống thực tế.

Sau khi biết tìm test nào, ta xem cách diễn giải tổng số test.

**Chuyển Slide 35**

Slide ghi 864 ca, 71 suite và 162 giây. Khi nói, hãy gọi đó là số liệu được báo trong bản slide và đề nghị trích log của đúng commit khi dùng làm bằng chứng. Một lượt pass cho thấy các kỳ vọng của lượt chạy đó đạt. Kết quả không tự đo các hành vi ngoài phạm vi test, chẳng hạn tải lớn hay sự ổn định qua nhiều lần chạy. Cùng một dự án có thể có số ca khác khi thêm test hoặc chỉ chạy một nhóm.

Tổng số ca có ý nghĩa hơn khi biết mỗi tầng test đang kiểm gì.

**Chuyển Slide 36**

Khi sửa hàm parse token, unit test là điểm bắt đầu nhanh. Khi muốn biết coordinator có dọn storage và cache đúng không, ghép nhiều phụ thuộc trong integration test. Khi muốn xem guard hoặc dialog hoạt động đúng qua thao tác, dùng trình duyệt. Cuối cùng dùng môi trường live để kiểm hợp đồng và quyền thực tế. Tầng trên đắt hơn về dữ liệu và thời gian nên cần chọn hành trình đại diện.

Ta xem cấu hình Playwright hiện tại để biết frontend dùng loại bằng chứng nào.

**Chuyển Slide 37**

Muốn kiểm hành trình người dùng, Playwright khởi động server frontend riêng và mở trang trên Chromium. Một ca kiểm guard không cần đăng nhập, còn những ca live cần backend thử và tài khoản phù hợp. Trong repo hiện có ca auth, quản trị, theme và vòng đời tài nguyên. Hãy phân biệt danh sách spec với danh sách test đã đạt. Nếu trình bày kết quả pass, dùng báo cáo của lần chạy trên đúng môi trường.

Tiếp theo, đọc coverage như một số đo khác với số test pass.

**Chuyển Slide 38**

Khi chạy test, report coverage có thể cho biết test đi qua bao nhiêu dòng, nhánh hoặc hàm. Hỏi trước: 70,83% đang đo loại nào và ở commit nào? Sau đó nhìn các nhánh nghiệp vụ có rủi ro, như xung đột cập nhật và lỗi quyền. Kế hoạch CI/CD giúp lặp lại việc đo và lưu báo cáo. Dùng coverage để tìm chỗ thiếu bằng chứng, đồng thời giữ các test có assertion sát hành vi.

Từ chất lượng kiểm thử, chuyển sang những tích hợp vẫn cần hoàn thiện.

### Chương 8 — Giới hạn và nghiệm thu (3:50)

**Chuyển Slide 39**

Nhìn từng dòng theo ba câu hỏi: người dùng thấy gì, dữ liệu đến từ đâu, còn thiếu xác minh nào? UI thông báo có thể hoạt động với dữ liệu tải theo request. Tiến độ xử lý file lớn là luồng riêng cần xác định nguồn sự kiện. Scene Workspace 3D có thể chạy với dữ liệu mẫu. Nếu backend có module realtime trong repo, ta vẫn cần kiểm kết nối frontend và deployment để nói tính năng đã hoạt động.

Từ khoảng trống tính năng, chuyển sang các rủi ro cần kiểm soát ở code hiện tại.

**Chuyển Slide 40**

Một khoản nợ như file lớn gây khó đọc và sửa. Một rủi ro như lỗi giữa chừng có thể để lại project đã tạo nhưng chưa có file. Repository có giao dịch cục bộ và kiểm quota để giảm lỗi ở trình duyệt. Store cần thông báo rõ trạng thái nếu lỗi ở server. Khi backend đổi DTO, generator hỗ trợ đồng bộ nhưng bước review mapper và test vẫn cần. Nói song song mỗi rủi ro với cách phát hiện của nó.

Từ đây nhóm chọn việc cần làm trước khi nghiệm thu.

**Chuyển Slide 41**

Ưu tiên đầu là chọn môi trường thử nghiệm, danh sách operation và tài khoản theo quyền để retest. Sau đó thêm hành trình grid với dữ liệu đủ lớn và tiêu chí rõ ràng cho cuộn, lọc, thời gian đáp ứng. Cuối cùng, làm việc với backend để chốt sự kiện realtime, khi nào phát và cách UI xử lý mất kết nối. Mỗi việc chỉ được đóng khi có bằng chứng phù hợp, như report run hoặc hợp đồng đã thống nhất.

Khép lại bằng những gì frontend đã dựng và điều kiện để chốt nghiệm thu.

**Chuyển Slide 42**

Qua một ví dụ từ file CSV đến báo cáo sự cố, chúng ta đã thấy cách frontend đưa dữ liệu vào workspace, kiểm schema, hiển thị records và theo dõi vấn đề. Kiến trúc cho phép lần từ một thao tác trên UI đến service, contract và test. Khi chốt bàn giao, nhóm sẽ gắn các số liệu trên báo cáo với log đúng phiên bản và kiểm lại những luồng live còn mở. Cảm ơn mọi người đã theo dõi. Nhóm sẵn sàng trao đổi về kiến trúc, dữ liệu và kiểm thử.

## 5. Technical Glossary

### Software Engineering

| English Term | Vietnamese Meaning | Simple Explanation | Role in Project |
| --- | --- | --- | --- |
| Layered Architecture | Kiến trúc phân tầng | Chia chương trình theo trách nhiệm. | Lần từ UI đến tầng giao tiếp backend. |
| Ports & Adapters | Cổng và bộ chuyển đổi | Logic khai báo giao diện cần dùng. Adapter thực hiện giao diện đó. | Runtime gắn storage vào coordinator. |
| Composition Root | Nơi ghép phụ thuộc | Điểm tạo và kết nối các đối tượng. | AppRuntime ghép client, phiên và draft repository. |
| Optimistic Lock | Khóa lạc quan | Kiểm phiên bản khi ghi. | So expectedVersion khi sửa dữ liệu. |
| Technical Debt | Nợ kỹ thuật | Chi phí bảo trì phát sinh từ thiết kế hiện có. | Giải thích vì sao file lớn, lint và redirect được theo dõi. |

### Frontend Architecture

| English Term | Vietnamese Meaning | Simple Explanation | Role in Project |
| --- | --- | --- | --- |
| Design Token | Giá trị thiết kế có tên | Màu, chữ hoặc khoảng cách gắn với một vai trò. | Tổ chức palette của UI. |
| Primitive / Composite | Linh kiện cơ bản / tổ hợp | Thành phần nhỏ và thành phần ghép từ các phần nhỏ. | Button và Dialog. |
| Hook / Context | Hook / ngữ cảnh React | Tái sử dụng logic và chia sẻ dữ liệu trong cây React. | useAuth đọc trạng thái phiên. |
| Bootstrap / Route Guard | Khởi động / bảo vệ route | Dựng runtime và quyết định truy cập màn hình. | Restore xong thì guard chọn route. |
| StrictMode / Microtask | Chế độ kiểm tra / tác vụ nhỏ | React kiểm vòng đời trong dev, tác vụ nhỏ chạy sau đoạn đồng bộ hiện tại. | retain/release dùng microtask để kiểm lại owner. |
| Skeleton / Reduced Motion | Khung chờ / giảm chuyển động | Mô phỏng nội dung đang tải và giới hạn hiệu ứng. | Giúp người dùng nhận biết trạng thái UI. |
| Virtual Scrolling | Cuộn ảo | Hạn chế số hàng dựng gần vùng nhìn. | Phân biệt với tải từng trang từ server. |
| WebGL | Đồ họa 3D trình duyệt | API render đồ họa qua GPU. | Scene Workspace và Dataset. |

### Backend & API

| English Term | Vietnamese Meaning | Simple Explanation | Role in Project |
| --- | --- | --- | --- |
| Endpoint / Operation | Điểm gọi / thao tác HTTP | Operation là cặp method và path. | GET và DELETE cùng path vẫn đếm riêng. |
| OpenAPI / Swagger | Đặc tả / công cụ API | Mô tả đường dẫn, payload và phản hồi. | Nguồn sinh kiểu TypeScript. |
| DTO / Envelope | Dữ liệu truyền / lớp bọc | DTO mô tả payload, envelope mang cấu trúc chung. | Client đọc lớp bọc, service kiểm payload. |
| Runtime Validation | Kiểm tra khi chạy | Kiểm dữ liệu nhận thực tế. | Service xác nhận schema và records. |
| Multipart / Cursor | Biểu mẫu nhiều phần / con trỏ | Multipart mang file, cursor xác định trang kế tiếp. | Tải attachment và đọc records. |
| Retry / HTTP 409 | Thử lại / xung đột | Retry gửi lại request, 409 báo va chạm trạng thái. | Đọc lại bản mới khi cập nhật lệch version. |

### Authentication & Security

| English Term | Vietnamese Meaning | Simple Explanation | Role in Project |
| --- | --- | --- | --- |
| JWT / Bearer | Token có claim / xác thực mang token | Client gửi token cùng header. | Dùng cho request bảo vệ. |
| Access Token / Refresh Token | Token truy cập / gia hạn | Một token gọi API, token kia xin gia hạn. | Coordinator điều phối vòng đời. |
| Session Snapshot / Generation | Trạng thái phiên / số thế hệ | Snapshot mô tả pha, generation nhận biết tác vụ cũ. | Guard, dialog và kiểm kết quả đến trễ. |
| Session Storage / Revocation | Lưu phiên / thu hồi | Bản ghi browser và quyền server nằm ở hai biên. | Logout báo kết quả cục bộ và server riêng. |
| XSS / CSRF | Chèn script / giả mạo request | Hai nhóm rủi ro có cơ chế khác nhau theo cách giữ và gửi credential. | Đọc giới hạn khi dùng Web Storage. |
| Scope / Role | Phạm vi / vai trò | Quyền theo tài nguyên và thao tác. | Tách workspace, project và admin. |

### Data Engineering

| English Term | Vietnamese Meaning | Simple Explanation | Role in Project |
| --- | --- | --- | --- |
| CSV / Ingestion | Tệp phân tách / tiếp nhận | Đưa bản ghi từ tệp vào xử lý. | Dữ liệu đầu vào của project. |
| Schema / Record | Cấu trúc / bản ghi | Schema định nghĩa cột, record chứa một hàng giá trị. | Dựng Data View. |
| IndexedDB / Dexie | CSDL trình duyệt / thư viện bọc | Ghi dữ liệu cục bộ bằng giao dịch. | Lưu metadata và file nháp. |
| Partial Failure / ACK | Lỗi một phần / xác nhận | Một bước đã thành công trước khi bước sau lỗi, ACK xác nhận kết quả. | Phục hồi upload hoặc dọn draft. |

### Data Quality

| English Term | Vietnamese Meaning | Simple Explanation | Role in Project |
| --- | --- | --- | --- |
| PII | Thông tin nhận diện cá nhân | Dữ liệu như email có thể liên hệ tới một người. | Cờ metadata của cột. |
| Missing Ratio | Tỷ lệ thiếu | Phần giá trị thiếu trong tập bản ghi đã tính. | Chỉ số thống kê cột. |
| Issue / Needs Info | Sự cố / cần bổ sung | Báo cáo vấn đề và trạng thái cần thêm dữ kiện. | Trao đổi giữa người báo và quản trị. |

### Machine Learning / Deep Learning

| English Term | Vietnamese Meaning | Simple Explanation | Role in Project |
| --- | --- | --- | --- |
| Quality Worker | Tác vụ nền chất lượng dữ liệu | Tiến trình được nêu để xử lý hoặc báo tiến độ. | Slide nói về khoảng trống tích hợp. Chưa có bằng chứng về một mô hình ML/DL cụ thể trong nội dung đã rà. |

### Testing & Quality Assurance

| English Term | Vietnamese Meaning | Simple Explanation | Role in Project |
| --- | --- | --- | --- |
| Unit / Integration / E2E | Đơn vị / tích hợp / đầu cuối | Kiểm hàm, phối hợp module hoặc hành trình người dùng. | Vitest và Playwright phục vụ các mức khác nhau. |
| Fixture / Mock | Dữ liệu mẫu / mô phỏng | Đầu vào hoặc phụ thuộc kiểm soát được. | Preview và test lỗi. |
| Coverage / Flakiness | Độ phủ / tính chập chờn | Coverage đo phần code được chạy. Flakiness là kết quả thay đổi giữa lượt. | Giải thích số liệu test và nhu cầu chạy lặp. |
| Traceability Matrix | Ma trận truy vết | Nối yêu cầu với UI, API và test. | Tìm vị trí của bằng chứng. |

### Deployment & Infrastructure

| English Term | Vietnamese Meaning | Simple Explanation | Role in Project |
| --- | --- | --- | --- |
| Live Retest | Kiểm tra lại môi trường triển khai | Chạy với backend, tài khoản và dữ liệu xác định. | Chốt bằng chứng nghiệm thu. |
| CI/CD | Tích hợp / chuyển giao liên tục | Pipeline tự động chạy build, test và lưu báo cáo. | Kế hoạch duy trì coverage. |
| WebSocket / SSE / Polling | Kênh hai chiều / sự kiện server / hỏi định kỳ | Các cơ chế đưa cập nhật tới frontend. | Thảo luận luồng thông báo và tiến độ worker. |

## 6. Potential Audience Questions & Answers

| Câu hỏi | Trả lời |
| --- | --- |
| Dự án giúp ai làm việc gì? | Analyst đưa CSV vào workspace/project, xem schema và records, rồi báo vấn đề chất lượng dữ liệu. |
| Đếm 66/86 thế nào? | Đặc tả kiểm được 86 operation và 66 paths. Số 66 operation live trên slide cần inventory theo method/path và log riêng. |
| Vì sao giữ HTTP client và service riêng? | Client xử lý transport và envelope. Service kiểm dữ liệu theo nghiệp vụ để UI dùng. |
| Reload khác refresh ở đâu? | Reload khởi động ứng dụng và khôi phục bản ghi phiên. Refresh dùng refresh token để xin credential mới khi đủ điều kiện. |
| Upload lỗi sau khi tạo project thì làm gì? | Mở project đã được tạo để kiểm tra trạng thái file và thành viên trước khi chạy thêm thao tác. |
| Cờ PII bảo đảm gì? | Source xác nhận ghi metadata cột. Kiểm từng đường hiển thị hoặc tải file để biết masking áp dụng ở đâu. |
| Chạy test rồi sao vẫn cần retest? | Retest xác nhận quyền, dữ liệu và phản hồi trên đúng deployment dùng để nghiệm thu. |
| Điều kiện chốt bàn giao là gì? | Build và test có commit tương ứng, bằng chứng live cho luồng cam kết, và kết luận rõ về các khoảng trống còn mở. |

## 7. Final Presentation Checklist

- [ ] Nêu được mục tiêu hệ thống và bài toán CSV bằng ví dụ dễ hiểu.
- [ ] Giải thích được kiến trúc, module chính và đường đi từ UI đến backend.
- [ ] Đọc được sơ đồ login, restore, refresh và logout theo đầu vào, xử lý và kết quả.
- [ ] Theo được luồng workspace, project, CSV, schema, records và issue.
- [ ] Giải thích API quan trọng bằng method, path, xác thực, input và output.
- [ ] Giải thích thuật ngữ, số ca, số suite, coverage và phạm vi môi trường test.
- [ ] Phân biệt triển khai, kiểm thử, xác minh live, mock và kế hoạch.
- [ ] Đọc các nhãn NEEDS VERIFICATION trước khi dùng con số hoặc contract trong demo.
- [ ] Tập chuyển slide, chỉ vào sơ đồ và trả lời câu hỏi theo từng chương.
- [ ] Trình bày được toàn bài khi người phát triển ban đầu vắng mặt.

## 8. Evidence & Source References

| Slide | Nguồn đối chiếu | Bằng chứng |
| --- | --- | --- |
| 01–07 | [HTML](index.html), [Design System](../src/components/ui/README.md), [token màu](../src/styles/tokens.css) | Nội dung slide và cấu trúc UI. Badge và báo cáo lịch sử cần nguồn chạy riêng. |
| 08–14 | [Bản đồ source](../src/README.md), [runtime](../src/app/app-runtime.ts), [bootstrap](../src/app/application-bootstrap.tsx), [router](../src/app/router/workbench-routes.tsx), [đích đăng nhập](../src/services/navigation/application-route.ts) | Trách nhiệm, vòng đời runtime và thứ tự khởi động. |
| 15–19 | [Kiểu snapshot](../src/types/auth/session-coordinator.types.ts), [coordinator](../src/services/auth/session-coordinator.ts), [auth service](../src/services/auth/auth.service.ts), [storage](../src/lib/session-storage.ts), [query client](../src/lib/query-client.ts) | Pha, generation, login, restore, refresh, dọn phiên và revoke. |
| 20–26 | [Management store](../src/services/management/management.store.ts), [dataset service](../src/services/processing/dataset.service.ts), [admin service](../src/services/management/admin.service.ts), [draft repository](../src/repositories/datasets/upload-draft.repository.ts) | Request, con trỏ, version, lỗi một phần và xác nhận draft. |
| 27–33 | [HTTP client](../src/lib/axios-client.ts), [ApiError](../src/lib/api-error.ts), [OpenAPI snapshot](../src/lib/openapi.json), [generator](../scripts/generate-swagger-types.mjs), [users service](../src/services/users/users.service.ts) | 66 paths và 86 operations trong đặc tả, codegen và xử lý response. |
| 34–38 | [Bản đồ test](../src/__tests__/README.md), [test coordinator](../src/__tests__/auth/session-coordinator.test.ts), [test contract](../src/__tests__/management/backend-contract.test.ts), [Playwright config](../playwright.config.ts), [spec guard](../tests/e2e/auth/anonymous-guard.spec.ts), [spec lifecycle](../tests/e2e/management/workspace-project-lifecycle.spec.ts) | Các suite và cài đặt tồn tại trong source. Cần log để xác nhận số trên slide. |
| 39–42 | [README frontend](../README.md), [kế hoạch nội dung slide](planning/content-plan.md), [QA bản trình bày](qa/qa-report.md) | Phạm vi và đề xuất. QA bản trình bày ghi nhận bài HTML. |

**Tổng hợp xác minh.** Có 36/42 slide chứa ít nhất một điểm cần xác minh (01, 02, 03, 04, 05, 06, 09, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 42). Các nhóm chính gồm inventory và log API live, log kiểm thử và coverage lịch sử, benchmark grid, phạm vi realtime và tiêu chí bàn giao. Audit này đọc HTML, source và snapshot OpenAPI. Vitest, Playwright, build và benchmark chưa được chạy lại.
