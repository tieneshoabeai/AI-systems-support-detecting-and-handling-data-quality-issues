# 1. Định hướng và quy trình tái cấu trúc backend

- **Version:** v1
- **Ngày:** 2026-11-02
- **Trạng thái:** Đã thống nhất định hướng; chưa chốt thiết kế chi tiết hoặc bắt đầu implementation.
- **Nguồn:** Yêu cầu và các xác nhận của người dùng trong cuộc trao đổi về tái cấu trúc.

## 1. Mục tiêu và phạm vi đã thống nhất

Backend hiện đã chạy được và có khung cơ bản. Vấn đề người dùng muốn giải quyết là khó mở rộng, các tầng/lớp phụ thuộc chặt vào nhau và khó tái sử dụng.

Đợt tái cấu trúc chỉ thực nghiệm backend. Một số API, tính năng và database schema sẽ thay đổi sau khi được bàn luận. Các phần còn lại được kế thừa và tinh chỉnh theo ảnh hưởng của thay đổi, không bị giữ cố định.

Các API backend hiện đã có nhưng còn thiếu, thừa hoặc chưa đáp ứng nghiệp vụ. Cần rà soát theo danh sách tính năng và luồng nghiệp vụ được thống nhất để xác định API cần xây lại, bổ sung, loại bỏ hoặc nâng cấp. Danh sách API cụ thể thuộc từng nhóm sẽ được quyết định ở các phần tính năng và hợp đồng API.

Điều kiện hoàn thành: các API sau tái cấu trúc đáp ứng đầy đủ nghiệp vụ trong phạm vi đã thống nhất và vượt qua bộ kiểm thử tương ứng. Danh mục test và tiêu chí nghiệm thu cụ thể chưa được quyết định.

## 2. Hướng kiến trúc đã chọn

**Modular Monolith áp dụng Ports and Adapters (Hexagonal Architecture) trong từng module.**

- Domain chứa mô hình và quy tắc nghiệp vụ, hướng đến độc lập với framework và công nghệ lưu trữ.
- Application chứa use case, điều phối nghiệp vụ và sử dụng các port.
- Infrastructure chứa các adapter cho HTTP, database, storage và tích hợp bên ngoài.
- Dependency Injection nối port với adapter cụ thể tại nơi cấu hình module.
- Các module giao tiếp qua hợp đồng công khai, hạn chế phụ thuộc trực tiếp vào implementation và database của nhau.
- Các module nghiệp vụ chạy chung trong backend API. Chỉ tách worker khi nhu cầu xử lý nền đã được xác định.

Dự án tham khảo do người dùng chỉ định:

`/home/hoa/Documents/BACK-END/Property Rental Management System -project/`

Người dùng đã xác nhận dùng hệ thống tham chiếu làm chuẩn về kiến trúc, kỹ thuật và công nghệ để áp dụng phù hợp vào dự án này.

### Nguyên tắc áp dụng hệ thống tham chiếu

- Khi thiết kế từng phần, đọc implementation liên quan trong hệ thống tham chiếu để xác định kỹ thuật và công nghệ thực sự được sử dụng; phân biệt mã nguồn với mô tả hoặc kế hoạch chưa triển khai.
- Đối chiếu với tính năng, quy mô, dữ liệu và điều kiện vận hành của backend Data Quality trước khi lựa chọn.
- Ghi rõ nội dung tham chiếu và vị trí mã nguồn, nhu cầu tương ứng, phương án kế thừa/tinh chỉnh/không áp dụng, lý do, trade-off và tác động đến các phần khác.
- Áp dụng nguyên tắc này xuyên suốt các phần: cấu trúc module, domain/use case, port/adapter, API, phân quyền, persistence, transaction, sự kiện/worker, vận hành và kiểm thử.
- Những kỹ thuật/công nghệ cụ thể chưa được thảo luận vẫn là nội dung chờ lựa chọn; yêu cầu này không mặc định đưa toàn bộ stack của hệ thống tham chiếu vào dự án hiện tại.
- Nếu hệ thống tham chiếu có hạn chế hoặc điểm không phù hợp, nêu rõ để thống nhất cách tinh chỉnh; không sao chép các phụ thuộc chéo hoặc lỗi đã nhận diện.

### Đánh đổi cần giữ trong quá trình thiết kế

Hướng này giảm chi phí vận hành so với chia các module nghiệp vụ thành microservices, đồng thời cho phép tách nghiệp vụ khỏi chi tiết kỹ thuật. Các module API vẫn được triển khai chung; việc tăng tài nguyên riêng cho từng module còn hạn chế. Cần kiểm soát chiều dependency để tránh tái tạo phụ thuộc chéo dưới tên thư mục mới.

## 3. Các nội dung chưa quyết định

- Danh sách tính năng và luồng nghiệp vụ mới; API cần thêm, sửa hoặc bỏ.
- Ranh giới module, port, adapter và cấu trúc thư mục chi tiết.
- Database schema và quan hệ giữa các thực thể, bao gồm ràng buộc Project–Dataset.
- Bảo toàn/migration dữ liệu hiện tại và tương thích API cũ.
- Những công nghệ hiện tại bắt buộc giữ lại.
- Nhu cầu tách worker và trách nhiệm của worker.
- Danh mục test, ngưỡng đánh giá và tiêu chí nghiệm thu cho từng API.
- Chính sách cấp quyền admin khi đăng ký: người dùng chọn **chưa quyết định, ghi nhận để bàn sau**. Chưa được phép coi việc cho tự chọn admin hay chỉ cấp qua seed/quản trị là yêu cầu đã chốt.

## 4. Quy trình tiếp theo

Tuân theo working rule của dự án:

1. Làm rõ user requirement.
2. Xây dựng và thống nhất danh sách feature cùng luồng nghiệp vụ.
3. Xây dựng tech solution: ranh giới module, API, schema, port/adapter và các quyết định migration liên quan.
4. Làm rõ logic/AI solution theo phạm vi tính năng được chọn; nếu không áp dụng cần xác nhận rõ.
5. Implementation theo kế hoạch đã thống nhất.
6. Evaluation theo tiêu chí và bộ kiểm thử đã thống nhất.

Định hướng kiến trúc đã được chọn trước, nhưng thiết kế kỹ thuật chi tiết vẫn cần dựa trên danh sách tính năng. Bước làm việc tiếp theo là xây dựng danh sách tính năng backend.

Các điểm chưa rõ phải được hỏi, không tự coi giả định là yêu cầu. Khi có thay đổi ảnh hưởng quyết định trước đó, cần chỉ rõ ảnh hưởng và xác nhận lại trước khi thực hiện phần phụ thuộc.

## 5. Tổ chức bộ kế hoạch

- Lưu các phần kế hoạch tại `docs/restructures/`.
- Mỗi phần là một file Markdown riêng, có số thứ tự ở đầu và version ở cuối tên.
- Mẫu tên: `<số_thứ_tự>_<tên_phần>_v<n>.md`.
- Số thứ tự là thứ tự thực hiện các phần, không phải thứ tự tạo tài liệu.
- File đầu tiên: `1_architecture_direction_v1.md`.
- Danh sách và liên kết các phần nằm trong `README.md` cùng thư mục.
- Lần thảo luận đầu hoàn thiện các file v1 đã tạo khung. Sau vòng đầu, thay đổi nội dung kế hoạch được ghi thành v2, v3... của cùng phần, giữ nguyên bản trước.
- Khi tạo phiên bản kế tiếp của cùng phần, giữ số thứ tự và tên phần, tăng version; giữ bản trước để đối chiếu lịch sử.
- Mỗi file ghi rõ trạng thái, nội dung đã thống nhất, nội dung còn chờ quyết định và lịch sử thay đổi. Version mới không tự động đồng nghĩa với đã được phê duyệt.
- Các phần kế hoạch tiếp theo chỉ được bổ sung nội dung khi đã có trao đổi tương ứng.

## 6. Prompting log và lịch sử thay đổi

**Yêu cầu người dùng:** Tạo `docs/restructures/`, lưu mỗi phần kế hoạch tái cấu trúc thành một file Markdown, đánh số thứ tự và có hậu tố version `v<n>` để không quên quy trình.

**Nội dung ghi nhận:** Tổng hợp định hướng đã được xác nhận và các câu hỏi đang hoãn; chưa tạo thiết kế API/schema hoặc sửa mã nguồn ứng dụng.

- **v1 / 2026-11-02:** Tạo bản ghi định hướng và quy trình / Lưu các quyết định đã trao đổi để tiếp tục lập kế hoạch nhất quán / Chỉ bổ sung tài liệu trong `docs/restructures/`.
- **Hoàn thiện khung v1 / 2026-11-02:** Đổi tiền tố `01` thành `1`, làm rõ số thứ tự thực hiện và liên kết bộ khung / Theo yêu cầu mới của người dùng / Không thay đổi định hướng kiến trúc đã chốt.
- **Bổ sung v1 / 2026-11-02:** Lấy hệ thống tham chiếu làm chuẩn kỹ thuật và công nghệ, áp dụng theo mức phù hợp / Theo yêu cầu bổ sung của người dùng trong vòng đầu / Áp dụng xuyên suốt bộ kế hoạch; chưa chốt thêm công nghệ cụ thể.
- **Tinh chỉnh v1 / 2026-11-02:** Làm rõ API hiện có còn thiếu, thừa hoặc chưa đáp ứng nghiệp vụ; cần xây lại, bổ sung, loại bỏ hoặc nâng cấp theo kết quả rà soát / Theo xác nhận của người dùng khi rà phần 1 / Nghiệm thu dựa trên đáp ứng đầy đủ nghiệp vụ đã thống nhất và vượt qua bộ kiểm thử, chưa quyết định thay đổi endpoint cụ thể.
