# 2. Danh sách tính năng backend

- **Version:** v5
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-05 (v5)
- **Trạng thái:** Đã chốt các câu hỏi còn mở của v1 (mục 3.25–3.31). Trạng thái chốt: **đối tượng sử dụng, nguồn dữ liệu, phạm vi phân tích, tiêu chí DQ-01..DQ-05, quyền theo vai trò, ngưỡng ảnh hưởng, mức chi tiết bằng chứng, phạm vi AI, lưu trữ file và cơ chế async AI đã xác nhận**. Phần còn mở được liệt kê tại mục 6.
- **Giai đoạn:** Feature
- **Thứ tự thực hiện:** Phần 2; sử dụng kết quả đã xác nhận của các phần trước.
- **Quan hệ với v1/v2/v3:** v1, v2 và v3 được giữ nguyên để đối chiếu. **v4 áp dụng quyết định thu hẹp phạm vi nghiệp vụ ngày 2026-11-05: hệ thống chỉ đọc và phân tích dữ liệu, không bao giờ sửa/xóa/thay đổi bất kỳ dòng hay giá trị nào.** Xem mục 3.40.

> ## ⚠ 3.0. Quyết định nền tảng — hệ thống chỉ đọc, không sửa dữ liệu (2026-11-05)
>
> **Quyết định.** Hệ thống Data Quality Platform **không bao giờ sửa, xóa hoặc thay đổi bất kỳ dòng dữ liệu hay giá trị ô nào** của dữ liệu người dùng. Toàn bộ dữ liệu tải lên được coi là **bất biến (immutable)** trong suốt vòng đời của project.
>
> **Phạm vi bị bỏ hoàn toàn:**
>
> | Bị bỏ | Mã định danh bị gỡ | Nơi ghi |
> |---|---|---|
> | Xóa dòng (một dòng / nhiều dòng chọn / một khoảng dòng) | `DATA-01` | Mục 3.11 (cũ) → mục 3.40 |
> | Sửa ô (chỉnh sửa giá trị trên dữ liệu làm việc) | `cell-edit` | Mục 3.31.6 (cũ) → mục 3.40 |
> | Áp dụng clean rules (rule engine làm sạch) | `clean-rules` | Mục 3.31.5 (cũ) → mục 3.40 |
> | Rollback phiên bản dataset (khôi phục dữ liệu cũ) | `versions` | Mục 3.32.1, 3.28 (cũ) → mục 3.40 |
> | Đồ thị lineage toàn vẹn dựa trên hash phiên bản | `lineage` | Mục 3.32.1 (cũ) → mục 3.40 |
>
> **Giữ lại (không phải thao tác sửa dữ liệu):**
>
> - **Đổi tên cột rỗng/trùng** (`UC-10`) — đây là *metadata cột*, không phải giá trị dữ liệu. Không sửa giá trị ô nào.
> - **Gán cột nhãn** — là *siêu dữ liệu phân tích*, không ghi vào ô dữ liệu.
> - **Lọc, sắp xếp, tìm kiếm** — chỉ thay đổi phần hiển thị.
> - **Reset Dataset** — thu hẹp còn khôi phục tên cột gốc (mục 3.40.5).
>
> **Hệ quả trực tiếp:**
>
> 1. Dữ liệu làm việc **luôn bằng** dữ liệu gốc — không còn khái niệm "trạng thái đã sửa".
> 2. `input_fingerprint` (mục 3.28) **không còn chứa tập số dòng đã xóa** — chỉ còn tập cột, cột nhãn và cấu hình phân tích.
> 3. Cơ chế `stale` (mục 3.28) **chỉ kích hoạt khi đổi cấu hình phân tích hoặc đổi tập cột/cột**, không kích hoạt do thao tác dữ liệu.
> 4. Không còn collection `dataset_version`, không còn hash Merkle, không còn đồ thị Neo4j.
> 5. Đề xuất của AI chỉ mang tính **gợi ý đọc** — không bao giờ có đường dẫn thực thi tự động.
> 6. Bản "Lưu trạng thái project" chỉ lưu **cấu hình phân tích + kết quả phân tích + tổng kết**, không lưu trạng thái dữ liệu đã biến đổi.
>
> **Lý do.** Đây là quyết định của người dùng ngày 2026-11-05, ưu tiên tính trung thực dữ liệu và khả năng kiểm chứng: hệ thống đo lường chất lượng dữ liệu chứ không sửa dữ liệu. Việc sửa dữ liệu là trách nhiệm của người dùng ở hệ thống nguồn, và hệ thống báo cáo vấn đề để họ xử lý.
>
> **Đánh đổi.** Hệ thống mất khả năng "sửa nhanh tại chỗ" và mất cơ chế khôi phục dữ liệu. Đổi lại: kết quả phân tích luôn mô tả đúng dữ liệu đang có, không có trạng thái trung gian gây nhầm lẫn, và toàn bộ đường dẫn ghi dữ liệu biến mất khỏi hệ thống — loại bỏ hẳn một nhóm lỗi (ghi đè dữ liệu, mất dữ liệu do transaction, race condition khi sửa ô đồng thời).
>
> **Quy trình.** Quyết định này được đồng bộ sang toàn bộ 13 tài liệu còn lại. Mỗi tài liệu tạo phiên bản mới theo quy ước của `README.md`, giữ nguyên bản cũ để đối chiếu.

## 1. Mục tiêu

Làm rõ và thống nhất danh sách tính năng backend cho đợt tái cấu trúc backend.

## 2. Nội dung cần bàn luận

- Các nhóm người dùng và mục tiêu sử dụng.
- Danh sách tính năng giữ lại, thay đổi, thêm mới hoặc loại bỏ; cấp mã định danh cho từng tính năng.
- Phạm vi ưu tiên và điều kiện chấp nhận nghiệp vụ cho từng tính năng.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Đối tượng sử dụng và nhu cầu đã xác nhận

- Hệ thống dành cho những người muốn phân tích và phát hiện vấn đề của dữ liệu.
- Người dùng chủ yếu làm việc trong các lĩnh vực xử lý và phân tích dữ liệu, chẳng hạn Data Analyst.
- Đây là mô tả đối tượng sử dụng theo công việc, chưa phải quyết định về role hoặc quyền truy cập trong hệ thống.

### 3.2. Nguồn dữ liệu và phạm vi đã xác nhận

- **v5 — chỉ `.csv`.** Mỗi project chỉ chứa **một file CSV** (một bảng duy nhất). Không hỗ trợ nhiều file dữ liệu trong cùng project. Không cho phép thay thế file dữ liệu của project; muốn làm việc với file khác phải tạo project mới. Không có khái niệm sheet.
- Có tính năng Import file và kiểm tra ngay sau khi tải lên. Nếu tải thất bại, file không đọc được hoặc thuộc loại chưa hỗ trợ thì thông báo lỗi, chưa gắn file vào project và cho nhập lại trong project đó. File được tiếp nhận thành công mới được gắn vào project và không được thay thế.
- Người dùng xác nhận dữ liệu đầu vào không có ô gộp (merged cells). Chưa đưa hỗ trợ xử lý ô gộp vào phạm vi đợt hiện tại; không mặc định bổ sung tách ô hoặc điền giá trị cho vùng gộp.
- **v5 — gỡ.** Chỉ hỗ trợ `.csv`; mọi định dạng khác bị từ chối kèm thông báo yêu cầu xuất sang CSV.
- **v5 — gỡ.** Không còn khái niệm file có mật khẩu (chỉ CSV).
- **v5 — gỡ khái niệm sheet.** Một file CSV = một bảng duy nhất: dòng đầu tiên là tên cột, các dòng bên dưới là dữ liệu. File rỗng áp dụng quy tắc tại mục 3.8 (đã gộp).
- **v5 — chỉ hỗ trợ `.csv`.** Người dùng tải file CSV lên hệ thống. Giới hạn dung lượng và quy ước đọc file đã chốt tại mục 3.25. Không mặc định bổ sung kết nối database bên ngoài.
- Tiêu đề hiển thị của bộ dữ liệu lấy từ tên file tải lên. Tên từng cột lấy từ **bản ghi đầu tiên của CSV**; phần này là tên cột, không phải dòng dữ liệu để phân tích. Không tự tìm một dòng khác làm tiêu đề. Cấu trúc bảng không hợp lệ đã chốt tại mục 3.26.
- Tên cột rỗng (không có giá trị) hoặc trùng chỉ tạo cảnh báo khi Import. Hệ thống thông báo rõ vấn đề và vị trí các cột liên quan; vẫn chấp nhận file và gắn vào project nếu không có lỗi Import khác, không yêu cầu tải lại chỉ vì tên cột rỗng/trùng. Người dùng phải nhập tên cho cột rỗng hoặc chỉnh sửa tên cột trùng ngay trên hệ thống; hệ thống kiểm tra lại và **chặn phân tích cho tới khi đã xử lý hết tên rỗng/trùng của dataset đang làm việc**. Tên chỉnh sửa chỉ áp dụng cho dữ liệu làm việc, không sửa file gốc và không tự đặt tên thay người dùng. So sánh tên có phân biệt chữ hoa/thường và khoảng trắng, không tự trim hoặc đổi hoa/thường: `Tuổi`, `tuổi` và ` Tuổi ` là ba tên khác nhau. Riêng tên chỉ chứa khoảng trắng vẫn chỉ phát hiện và hiển thị cảnh báo, không bắt buộc đổi tên; quy tắc kiểm tra trùng tên vẫn áp dụng. Quyết định này thay thế việc cho phân tích khi tên cột còn rỗng/trùng. Workspace Owner, Project Owner và Project Member được nhập/chỉnh sửa tên cột; Viewer chỉ xem cảnh báo, không được sửa tên cột. Khi Import CSV, kiểm tra toàn bộ cột và thông báo vấn đề theo từng cột. Yêu cầu sửa **tất cả** tên cột rỗng/trùng trước khi phân tích. File rỗng vẫn áp dụng mục 3.8. Đánh đổi: có cảnh báo đầy đủ từ đầu; bước Import phải đọc hết file để kiểm tra tên cột.
    40|- **Xác nhận v2 / 2026-11-04:** Quyết định cuối về tên cột rỗng/trùng là **chặn phân tích** cho tới khi sửa hết ở dataset đang làm việc. Thân bài mục 3.2 của v1 đã viết theo hướng này, nhưng các mục trong prompting log của v1 lại ghi "vẫn được chọn và phân tích bình thường". Log đã ghi lại toàn bộ các lần đảo chiều theo thứ tự thời gian; quyết định cuối cùng là chặn. Mọi tài liệu khác (phần 6, phần 12) được đồng bộ theo quyết định này.
- Danh mục gồm 5 nhóm vấn đề cơ bản bên dưới; AI hỗ trợ phát hiện thêm theo phạm vi thống kê đã chốt. Tiêu chí ban đầu DQ-01 đến DQ-04 đã chốt tại mục 3.5, gồm phương pháp outliers từng cột. DQ-05 giữ giới hạn chưa đánh giá khi chưa có quy tắc được xác nhận, không cam kết phát hiện đầy đủ mâu thuẫn nghiệp vụ trong đợt này. **v5 — thay thế.** Nhà cung cấp AI **không còn là API bên ngoài**: chuyển sang **AI cục bộ (inference nội bộ)** — model `Qwen3-14B` làm chính, `Qwen3-8B` làm fast-path (Phần 12 v4 mục 3.15). Phạm vi phát hiện cụ thể của AI giữ nguyên gồm 4 vai trò tại mục 3.31.3.
- Phần phân tích của hệ thống phát hiện vấn đề, mô tả, cung cấp bằng chứng và đưa ra hướng đề xuất xử lý. Đề xuất không đồng nghĩa với tự động thực thi thay đổi dữ liệu.
- Ngày 2026-11-03, người dùng bổ sung yêu cầu thao tác xóa dữ liệu cơ bản, ví dụ xóa dòng theo số dòng. Đây là mở rộng so với phạm vi chỉ xem/phân tích trước đó; cách xóa và phạm vi dữ liệu bị tác động đang chờ làm rõ tại mục 3.11. Chưa mở rộng sang sửa ô hoặc tự động áp dụng cleaning rules.

### 3.3. Ảnh hưởng đến tính năng hiện có

**Đã chốt 2026-11-05:** phạm vi nghiệp vụ được thu hẹp về **chỉ đọc và phân tích**. Toàn bộ chức năng sửa ô, apply cleaning rules, xóa dòng, rollback phiên bản và đồ thị lineage bị **gỡ khỏi phạm vi sản phẩm**. Chi tiết tại mục 3.40.

Bốn hướng xử lý đã được chốt:

| Hướng | Kết quả |
|---|---|
| **Xóa endpoint/module cụ thể** | Xoá `PATCH .../records/{rowIndex}`, `POST .../rules/preview`, `POST .../rules/apply`, `POST .../versions`, `POST .../versions/{n}/rollback`; gỡ module `cell-edit`, `clean-rules`, `versions`, `lineage` |
| **Versioning / lineage / export** | `versions` và `lineage` **bị xoá hoàn toàn** (phục vụ mục đích khôi phục dữ liệu). `exports` giữ là LEGACY, không đưa vào kiến trúc mới |
| **Trạng thái lưu project** | Chỉ lưu cấu hình phân tích + kết quả phân tích + Tổng kết; **không** lưu trạng thái dữ liệu đã biến đổi |
| **Dấu vân tay đầu vào** | Gỡ thành phần "tập số dòng đã xóa"; `stale` chỉ kích hoạt khi đổi cấu hình/tập cột |

**Kết quả tích cực:** toàn bộ đường dẫn ghi vào `dataset_record` biến mất khỏi hệ thống — loại bỏ hẳn một nhóm lỗi ghi đè dữ liệu, mất dữ liệu do transaction, và race condition khi sửa ô đồng thời.

### 3.4. Nội dung chưa thống nhất

Các nội dung còn mở đã được rà lại ở v2. Những mục đã chốt ở v1 (nguồn dữ liệu, tiêu chí DQ-01..DQ-05, quyền theo vai trò, ba phần làm việc, xóa dòng/reset/lưu, phân tích thời gian, tương quan/VIF, mất cân bằng lớp) **không còn nằm trong danh sách mở**.

Đã chốt ở v2: giới hạn dung lượng và quy ước đọc file (3.25), cấu trúc bảng không hợp lệ (3.26), sắp xếp và tìm kiếm (3.27), xử lý kết quả cũ sau thay đổi đầu vào (3.28), ngưỡng ảnh hưởng và số mẫu tối thiểu (3.29), tiêu chí gợi ý cột nhãn và múi giờ (3.30), bằng chứng/lưu trữ file/phạm vi AI/phạm vi module/thao tác sửa ô (3.31).

Đã chốt ở v3 (mục 3.32–3.38): đối chiếu 52 tính năng từ file đầu vào; lịch sử phiên bản project dùng lại module `versions`; gộp tổng quan workspace và danh sách project; vai trò `admin` hệ thống giữ theo code hiện tại; lọc workspace chỉ có Owner/Member; trường trạng thái project mới; ghi nhớ đăng nhập chỉ nhớ email; OTP 6 số cho quên mật khẩu; thông báo chỉ từ sự kiện hệ thống với một công tắc chung; luồng báo cáo sự cố đơn giản; Admin xem hồ sơ người dùng chỉ đọc.

Còn mở (xem mục 6): ngưỡng cảnh báo lớp quá ít mẫu, giới hạn tinh chỉnh tham số, số kỳ tối thiểu của phân tích thời gian, mục đích sử dụng lại của các module LEGACY còn lại, hình thức kết quả đầu ra và mức chi tiết bố cục báo cáo PDF, chỉ số thứ 5 của tổng quan workspace, giới hạn dung lượng tệp đính kèm của báo cáo sự cố.

### 3.5. Năm nhóm kiểm tra cơ bản đã được đồng ý

- **DQ-01 — Dữ liệu thiếu:** Ô trống hoặc thiếu trường cần thiết.
- **DQ-02 — Dữ liệu trùng:** Trùng dòng hoặc trùng giá trị tại cột cần duy nhất.
- **DQ-03 — Sai kiểu/định dạng:** Kiểu dữ liệu hoặc định dạng không nhất quán.
- **DQ-04 — Giá trị bất thường:** Giá trị ngoài miền cho phép hoặc bất thường về thống kê.
- **DQ-05 — Mâu thuẫn giữa các cột:** Quan hệ giữa các giá trị không đáp ứng quy tắc nghiệp vụ; trong đợt hiện tại, chưa có quy tắc được xác nhận thì báo Chưa đánh giá theo mục 3.5.5.

Trạng thái: người dùng đã đồng ý phạm vi 5 nhóm và tiêu chí ban đầu DQ-01 đến DQ-04 bên dưới. Các ngưỡng ảnh hưởng chi tiết và tiêu chí còn mở cần bàn tiếp. Không mặc định mọi giá trị trống, trùng hoặc ngoại lệ thống kê đều là lỗi.

#### 3.5.1. DQ-01 — Tiêu chí dữ liệu thiếu đã xác nhận

- Nhận diện thiếu: ô không có giá trị, chuỗi rỗng hoặc chỉ chứa khoảng trắng. Không tự coi `0`, `false` hoặc các chuỗi `NA`, `null`, `-`, `unknown` là thiếu. Giá trị không chuyển được sang kiểu đã chọn thuộc sai kiểu/định dạng, không âm thầm chuyển thành thiếu.
- Thống kê trên các dòng đang phân tích và các cột được chọn, không phụ thuộc bộ lọc hiển thị: số lượng/tỷ lệ thiếu từng cột, số dòng thiếu ít nhất một ô và số dòng thiếu toàn bộ các cột được chọn. Hiển thị biểu đồ tỷ lệ thiếu theo cột.
- Tỷ lệ thiếu của cột = số ô thiếu / số dòng đang phân tích × 100%. Nếu không còn dòng nào, báo Không có dữ liệu để đánh giá, không trả 0%.
- Bằng chứng trong hệ thống gồm cột, giá trị ô và số dòng tương ứng file gốc. AI nhận thống kê tổng hợp và tối đa 20 ô lỗi/cột đã che PII; không nhận toàn bộ mẫu dòng hay toàn bộ giá trị ô (mục 3.31.1, 3.31.3).
- Có giá trị thiếu là hiện tượng xác nhận được, chưa tự động là lỗi nghiệp vụ. Cột thiếu 100% khiến phép phân tích cần giá trị của cột không thực hiện được có thể được đánh giá Cao đối với phép phân tích đó; không suy rộng ra toàn dataset. Trường hợp chưa có quy tắc/ngữ cảnh thì Chưa đủ cơ sở, không gán ngưỡng phần trăm chung.

#### 3.5.2. DQ-02 — Tiêu chí dữ liệu trùng đã xác nhận

- Kiểm tra các dòng giống nhau trên toàn bộ cột được chọn phân tích, ghi rõ Trùng trên các cột đã chọn. Bỏ cột định danh có thể làm hai bản ghi hợp lệ giống nhau trên phạm vi còn lại; không mặc định đây là bản ghi lỗi.
- So khớp chính xác giá trị và kiểu dữ liệu sau bước đọc file đã thống nhất. Không tự bỏ dấu, đổi chữ hoa/thường hoặc cắt khoảng trắng để kết luận trùng. Chi tiết đọc file còn cần thiết kế.
- Dòng thiếu toàn bộ cột được chọn được báo riêng ở DQ-01, không gom thành nhóm trùng. Dòng thiếu một phần có thể được nhóm khi vị trí thiếu và các giá trị còn lại giống nhau; ghi rõ nhóm có dữ liệu thiếu.
- Báo riêng số nhóm trùng, số dòng thuộc các nhóm trùng và số dòng lặp ngoài một đại diện mỗi nhóm. Ví dụ một nhóm ba dòng giống nhau có 1 nhóm, 3 dòng liên quan và 2 dòng lặp ngoài đại diện; phép đếm không hàm ý xóa các dòng này.
- Bằng chứng gồm các cột dùng so khớp và số dòng gốc trong mỗi nhóm. AI chỉ nhận số nhóm, số lượng, tỷ lệ và thống kê liên quan. Không tự xóa dữ liệu hoặc kết luận vi phạm tính duy nhất khi chưa có khóa nghiệp vụ.
- Trùng theo khóa nghiệp vụ, so khớp gần giống và ký hiệu thiếu tùy chỉnh còn để bàn sau, chưa thuộc tiêu chí kiểm tra ban đầu. So khớp chính xác dễ giải thích/kiểm thử nhưng bỏ sót gần giống; so khớp gần giống có nguy cơ gộp nhầm nên chưa chọn ở bước này.

#### 3.5.3. DQ-03 — Tiêu chí sai kiểu và định dạng đã xác nhận

- Kiểm tra theo kiểu và định dạng cột chốt tại Data Views; giữ nguyên dữ liệu gốc, không tự đoán khi có nhiều cách hiểu. Tách kiểu dữ liệu (số nguyên, số thập phân, văn bản, boolean, ngày, ngày–giờ) khỏi vai trò phân tích (định lượng, phân loại, mã định danh); lựa chọn cột nhãn vẫn riêng. Hệ thống tự nhận diện, người dùng có quyền được điều chỉnh; ghi rõ khi nhận diện chưa chắc chắn, không mặc định dữ liệu sai vì kiểu suy đoán có thể sai.
- Phân biệt không phù hợp kiểu, không phù hợp định dạng và mơ hồ chưa thể diễn giải. Ví dụ: `abc` trong cột số; `2026-11-03` khi yêu cầu `DD/MM/YYYY`; `03/04/2026` khi chưa xác định thứ tự ngày/tháng. Ô thiếu thuộc DQ-01, không đếm lại thành lỗi kiểu.
- Số: cấu hình dấu thập phân và phân nhóm hàng nghìn cho chuỗi số; không tự diễn giải `1,234` khi chưa đủ cơ sở, không tự bỏ tiền tệ/phần trăm/đơn vị. Chuỗi số trong CSV đọc đúng theo quy tắc được chọn vẫn hợp lệ. Giá trị âm hoặc quá lớn thuộc kiểm tra miền DQ-04, không mặc định sai kiểu. Giữ mã định danh như `00123` dưới dạng văn bản khi có vai trò định danh, không tự mất số 0 đầu.
- Ngày/ngày–giờ: kiểm tra định dạng và tính hợp lệ của ngày; không tự diễn giải ngày mơ hồ hoặc gán múi giờ khi không có thông tin. Giá trị ngày trong CSV luôn là chuỗi; định dạng do người dùng cấu hình.
- Boolean dùng tập giá trị được quy định rõ, không tự chuyển mọi `yes/no`, `1/0` thành boolean. Không tự đổi chữ hoa/thường, bỏ dấu, cắt khoảng trắng trong dữ liệu. Biến thể như `Nam`, `nam`, `NAM` có thể là dấu hiệu chưa thống nhất nhưng không tự kết luận phải gộp. Không suy đoán quy tắc email, điện thoại hoặc định danh chỉ từ tên cột.
- Kết quả theo cột: kiểu/định dạng và nguồn xác định (hệ thống/người dùng), số giá trị hợp lệ/không hợp lệ/mơ hồ, tỷ lệ không hợp lệ trên số giá trị không thiếu. Mẫu số bằng 0 thì báo không có dữ liệu để đánh giá. Bằng chứng trong hệ thống gồm lý do, giá trị ô và số dòng gốc; AI nhận thống kê tổng hợp và tối đa 20 ô lỗi/cột đã che PII (mục 3.31.1, 3.31.3).
- Các phần không bị ảnh hưởng vẫn chạy. Phép tính cần số/ngày chỉ dùng giá trị diễn giải hợp lệ và công bố số giá trị dùng/bị loại khỏi phép tính đó; không xóa dòng khỏi dataset. Không đủ dữ liệu hợp lệ thì không tính và nêu lý do. Quy tắc xử lý dòng cho tương quan/VIF tại mục 3.23; số lượng tối thiểu từng phép tính cần bàn riêng.
- Tổng kết phải nêu giới hạn do phần dữ liệu không được dùng có thể làm lệch kết quả. Chọn tiếp tục phần hợp lệ thay vì chặn toàn bộ phân tích; đánh đổi là cần minh bạch phạm vi thực tế của từng phép tính.

#### 3.5.4. DQ-04 — Miền giá trị và outliers đã xác nhận

- Tách vi phạm miền giá trị khỏi bất thường thống kê. Chỉ kết luận ngoài miền khi có quy tắc được xác định; không suy miền từ tên cột hoặc min/max quan sát. Do tính năng nhập quy tắc nghiệp vụ đang hoãn, chưa có quy tắc thì báo Chưa có quy tắc kiểm tra miền. Không tự coi số âm, số lớn hoặc ngày tương lai là lỗi; AI không được tự đặt miền rồi coi là quy tắc đã xác nhận.
- Outliers từng cột: áp dụng trên cột số có vai trò định lượng được chọn phân tích, không tự áp dụng cho định danh hoặc phân loại mã hóa số. IQR mặc định: IQR = Q3 − Q1; đánh dấu x < Q1 − 1,5 × IQR hoặc x > Q3 + 1,5 × IQR. Có thể đánh dấu thêm nhóm nằm ngoài hàng rào 3 × IQR là xa hơn về thống kê, không đồng nghĩa ảnh hưởng Cao.
- Hỗ trợ Modified Z-score dùng trung vị và MAD với ngưỡng mặc định trị tuyệt đối > 3,5. Cho chọn IQR, Modified Z-score hoặc cả hai. Khi chạy cả hai, báo riêng chỉ IQR, chỉ Modified Z-score và cả hai phát hiện; không cộng trùng số lượng. Hai phương pháp đồng thuận không chứng minh dữ liệu sai.
- Chỉ tính trên số hữu hạn hợp lệ; công bố số quan sát dùng/bị loại khỏi phép tính. IQR hoặc MAD bằng 0 thì phương pháp tương ứng báo không đủ độ phân tán để đánh giá, không chia cho 0 hay báo không có outlier. Dữ liệu quá ít thì báo chưa đủ điều kiện; số lượng tối thiểu và cách tính tứ phân vị cần thiết kế sau.
- Không tự thay phương pháp, biến đổi log hoặc chia nhóm mà không thể hiện cấu hình. Bất thường thời gian cần xét xu hướng/mùa vụ riêng; kiểm tra toàn cột không thay thế kiểm tra thời gian. Outliers đa biến bàn riêng, chưa nằm trong tiêu chí ban đầu này.
- Kết quả gồm phương pháp, tham số, ngưỡng thực tế, số lượng/tỷ lệ, số quan sát dùng tính và bằng chứng theo số dòng gốc. Dùng box plot/histogram từng cột, không thêm biểu đồ giữa các cột. AI nhận thống kê tổng hợp và tối đa 20 ô lỗi/cột đã che PII (mục 3.31.1, 3.31.3).
- Xác nhận vượt ngưỡng không đồng nghĩa giá trị sai hoặc cần xóa; không tự gán mức Cao vì vượt 3 × IQR hoặc cả hai phương pháp đánh dấu. Giữ outliers trong dữ liệu và thống kê thông thường, không tự loại để cải thiện kết quả.
- Chọn phương pháp/ngưỡng tại Data Views, lưu/khôi phục cùng cấu hình và thể hiện trong Tổng kết/PDF; thay đổi yêu cầu phân tích lại. Giới hạn tinh chỉnh tham số còn cần chốt.
- Đánh đổi: IQR dễ giải thích, gắn với box plot nhưng có thể cảnh báo nhiều với dữ liệu lệch hoặc nhiều nhóm. Modified Z-score dùng thống kê ít nhạy với cực trị hơn trung bình/độ lệch chuẩn nhưng không phù hợp mọi phân bố. Không chọn Z-score thông thường làm mặc định. Tham khảo: [NIST — Outliers](https://www.itl.nist.gov/div898/handbook/prc/section1/prc16.htm), [NIST — Detection of Outliers](https://itl.nist.gov/div898/handbook/eda/section3/eda35h.htm).

#### 3.5.5. DQ-05 — Giới hạn phạm vi hiện tại đã xác nhận

- Giữ hoãn tính năng nhập/cấu hình quy tắc nghiệp vụ; không bổ sung mẫu quy tắc quan hệ tại Data Views trong đợt này.
- Chưa có quy tắc quan hệ được xác nhận thì hiển thị **Chưa đánh giá — chưa có quy tắc quan hệ được xác nhận**. Không báo Không có mâu thuẫn hoặc kết quả đạt khi chưa thực hiện kiểm tra có cơ sở.
- Không tự suy quy tắc từ tên cột, xu hướng đa số hoặc nhận xét AI. Tương quan, VIF và phân tích quan hệ vẫn chạy theo phạm vi đã thống nhất; các chỉ số này không tự chứng minh mâu thuẫn nghiệp vụ.
- AI chỉ nhận xét theo thống kê được cung cấp, phân biệt nghi vấn với lỗi đã xác nhận; không tự tạo quy tắc rồi kết luận vi phạm. Không mở rộng đầu vào AI sang mẫu dòng/giá trị ô.
- Giới hạn nghiệm thu: kiểm tra đúng trạng thái chưa đánh giá và lý do trong kết quả/Tổng kết; không tuyên bố hỗ trợ đầy đủ phát hiện mâu thuẫn nghiệp vụ DQ-05. Thiết kế và triển khai cấu hình quy tắc, đánh giá quan hệ theo từng dòng sẽ bàn ở giai đoạn mở rộng, chưa được đưa vào phạm vi hiện tại.
- Đánh đổi: giữ phạm vi và tránh kết luận thiếu cơ sở, nhưng chưa xác nhận được mâu thuẫn nghiệp vụ khi không có nguồn quy tắc.

### 3.6. Phạm vi AI — đã chốt ở v2

- **v5 — thay thế.** Hướng tích hợp đã đảo chiều: **không** gọi API mô hình bên ngoài; hệ thống **tự vận hành model cục bộ** qua `vLLM` (production) / `Ollama` (dev) / `llama.cpp` (fallback) sau `AiInferencePort`. Model đã chốt: `Qwen3-14B` (chính) + `Qwen3-8B` (fast-path) (Phần 12 v4 mục 3.15).
- Backend tính toán kết quả phân tích, chuẩn bị đầu vào có cấu trúc gồm kết quả thống kê tổng hợp và **tối đa 20 ô lỗi cho mỗi cột, đã che PII**. AI đảm nhiệm 4 vai trò: phát hiện vấn đề bổ sung, giải thích, đề xuất và nhận xét chất lượng dữ liệu. Backend kiểm tra cấu trúc phản hồi, đối chiếu số liệu và tham chiếu bằng chứng trước khi hiển thị. Phản hồi đúng cấu trúc không đồng nghĩa với kết luận đúng.
- Tích hợp qua port AI và adapter nhà cung cấp theo Ports and Adapters đã chọn. Chi tiết hợp đồng, schema phản hồi và cơ chế kiểm chứng sẽ được thiết kế ở các bước sau.
- Phạm vi gửi ra ngoài đã chốt ở v2: thống kê tổng hợp **và** mẫu ô lỗi tối đa 20 ô/cột đã che PII. Không gửi file gốc, không gửi toàn bộ tập bản ghi, không gửi ảnh chụp màn hình lỗi. Mẫu ô lỗi là **bổ sung** so với quyết định "chỉ nhận thống kê tổng hợp" ở v1; mọi câu chữ "không nhận mẫu dòng/giá trị ô" trong v1 phải được hiểu là không nhận **toàn bộ** mẫu dòng/giá trị ô, chỉ nhận mẫu giới hạn 20 ô/cột đã che PII. Chi tiết định danh cột và cách biểu diễn nhãn nhóm trong thống kê còn cần thiết kế, không mặc nhiên cho phép gửi các giá trị gốc qua nhãn nhóm. Giữ quy tắc AI lỗi không chặn kết quả hệ thống và tính năng Thử lại AI. Cơ chế bất đồng bộ tại mục 3.31.4.
- Che PII là điều kiện bắt buộc trước khi gọi API ngoài. Ô lỗi không che được thì chỉ gửi thống kê tổng hợp thuần túy.

- Cấu trúc nội dung mỗi phát hiện AI đã được xác nhận: vấn đề, cột liên quan, bằng chứng thống kê, mức độ ảnh hưởng, giải thích và đề xuất xử lý. Phải phân biệt nghi vấn cần kiểm tra thêm với vấn đề hệ thống đã xác nhận. Schema kỹ thuật chưa chốt.
- Backend xác định mức độ ảnh hưởng bằng quy tắc: **Thấp** (ảnh hưởng hạn chế đến phép phân tích), **Trung bình** (có khả năng làm sai lệch kết quả, cần kiểm tra), **Cao** (ảnh hưởng lớn đến độ tin cậy hoặc khiến một phép phân tích không thực hiện được). Thêm trạng thái **Chưa đủ cơ sở** khi thiếu quy tắc/ngữ cảnh, không mặc định là Thấp. Mỗi đánh giá cần lý do, phạm vi bị ảnh hưởng và quy tắc áp dụng; hiện đánh giá ảnh hưởng đến phân tích, chưa khẳng định thiệt hại nghiệp vụ. Ngưỡng riêng theo loại vấn đề sẽ bàn sau, không dùng một ngưỡng chung cho mọi loại.
- Trạng thái xác minh độc lập với mức độ ảnh hưởng: **Đã xác nhận bằng kiểm tra hệ thống** khi có phép tính/quy tắc tái lập được; **Nghi vấn cần kiểm tra** khi chưa đủ bằng chứng xác nhận. Xác nhận vượt ngưỡng outlier không đồng nghĩa giá trị đó sai; xác nhận tỷ lệ thiếu không đồng nghĩa xác nhận nguyên nhân thiếu.
- Kiểm chứng từng phát hiện AI bằng đúng kết quả của lần phân tích hiện tại: loại phát hiện sai số liệu/tham chiếu bằng chứng không tồn tại; suy diễn quá mức chỉ giữ dạng nghi vấn nếu có bằng chứng hỗ trợ; AI không được ghi đè mức ảnh hưởng backend xác định. Không dùng kết quả của cấu hình cũ để đối chiếu lần phân tích mới.
- Nếu loại một phần phản hồi AI, giữ nhận xét hợp lệ và báo phần nhận xét AI chưa đầy đủ tại Tổng kết. Nếu toàn bộ phản hồi hỏng hoặc không kiểm chứng được, dùng kết quả hệ thống và cho phép Thử lại AI theo quy tắc đã chốt.

Detection và nhận xét của AI phải dựa trên bằng chứng thống kê được cung cấp, phân biệt nghi vấn với lỗi đã xác nhận. Không cam kết phát hiện bất nhất ngữ nghĩa ở từng ô/dòng khi AI không nhận dữ liệu đó. Phạm vi phát hiện bổ sung và tiêu chí kiểm chứng chi tiết còn cần bàn.

### 3.7. Tính năng hoãn triển khai

Người dùng xác nhận sẽ làm tính năng nhập mô tả dữ liệu, ý nghĩa các cột và quy tắc nghiệp vụ trong tương lai, nhưng hiện tại chưa cần triển khai. Tính năng này không thuộc phạm vi nghiệm thu đợt hiện tại và chưa có lịch thực hiện.

Do chưa có đầu vào ngữ cảnh nghiệp vụ do người dùng khai báo, cần bàn riêng cách xác định tiêu chí kiểm tra, đặc biệt tính duy nhất của cột, miền giá trị và quan hệ giữa các cột. Chưa mặc định chọn bộ quy tắc cố định hoặc dùng suy luận AI thay cho yêu cầu nghiệp vụ đã xác nhận.

### 3.8. ~~Chọn sheet làm việc trong Excel~~ — **GỠ KHỎI PHẠM VI (v5)**

> **Quyết định 2026-11-05 (v5):** Hệ thống **chỉ làm việc với file `.csv`** → một file CSV là một bảng duy nhất → **không còn khái niệm sheet**, không còn thao tác chọn sheet.
>
> - Gỡ `FILE-01` (chọn mặc định), `FILE-02` (đổi sheet), toàn bộ quy tắc về sheet ẩn, sheet rỗng, hủy phân tích khi đổi sheet.
> - Gỡ collection `dataset_sheet` — gộp vào `dataset` (Phần 8 v4).
> - **Cách thay thế:** người dùng có nhiều bảng thì tách thành nhiều project, mỗi project một file CSV — phù hợp nguyên tắc "mỗi project chỉ chứa một file dữ liệu" đã chốt.
> - Mọi quy tắc còn lại trong tài liệu nói "dataset đang làm việc" được hiểu là **dataset đang làm việc** của project.

### 3.9. Ba phần làm việc với dữ liệu

- **VIEW-01 — Data Views:** Các thao tác xem dữ liệu và lọc. Thao tác xóa dòng trên dữ liệu làm việc và giữ nguyên file gốc được ghi riêng tại mục 3.11.
- **ANALYSIS-01 — Data Analysis & Detection:** Thống kê và phân tích bằng số liệu; kết hợp tính năng của hệ thống và tính năng được AI hỗ trợ để phát hiện vấn đề, mô tả, cung cấp bằng chứng và đề xuất hướng xử lý. Đây là một phần làm việc trong tổng số ba phần người dùng mô tả.
- **SUMMARY-01 — Tổng kết:** Tổng hợp hai phần trước để đưa ra kết luận về bộ dữ liệu. Khi người có quyền phân tích mở Tổng kết mà chưa chạy Data Analysis & Detection, hệ thống yêu cầu chạy phân tích trước; không tự chạy phân tích hoặc tạo Tổng kết khi đó. Nếu đã phân tích nhưng sau đó xóa dòng, đổi cột phân tích hoặc chọn/đổi/bỏ nhãn, phải chạy lại phân tích theo đầu vào hiện tại trước khi tạo Tổng kết mới; không dùng kết quả đã lỗi thời để tạo Tổng kết mới.
- Nội dung Tổng kết đã được xác nhận gồm: tổng quan dữ liệu; các vấn đề và mức độ ảnh hưởng; bằng chứng; đề xuất xử lý theo thứ tự ưu tiên. Thang đánh giá ảnh hưởng, tiêu chí xếp ưu tiên và hình thức bằng chứng chi tiết chưa chốt. Khi AI lỗi, vẫn áp dụng quy tắc không có phần giải thích và đề xuất của AI bên dưới.
- Khi phần phân tích của hệ thống bị lỗi, không cho tạo Tổng kết mới và yêu cầu người dùng chạy lại phân tích. Chỉ tạo Tổng kết mới sau khi phần phân tích hệ thống thành công với đầu vào hiện tại; sự cố AI được xử lý riêng theo quy tắc bên dưới. Quy tắc này không xóa hoặc ghi đè bản project đã lưu.
- Khi phần phân tích của hệ thống đã thành công nhưng AI gặp sự cố, Tổng kết vẫn hiển thị các kết quả phân tích của hệ thống, không có phần giải thích và đề xuất của AI. Không bắt buộc chờ AI thành công mới hiển thị Tổng kết; quy tắc này không cho phép dùng kết quả phân tích đã lỗi thời.
- **AI-01 — Thử lại AI:** Sau sự cố AI, người có quyền phân tích được chủ động thử lại riêng phần AI để bổ sung giải thích và đề xuất. Khi dữ liệu và cấu hình phân tích không đổi, dùng lại kết quả phân tích hệ thống hiện có, không chạy lại phần hệ thống. Nếu đầu vào đã đổi, vẫn phải chạy lại phân tích theo mục 3.18; không dùng kết quả hệ thống lỗi thời. Viewer không được thực hiện thao tác này. Kết quả bổ sung chỉ cập nhật bản lưu project khi người có quyền bấm Lưu thành công theo mục 3.19.

Quy tắc dùng lại kết quả Data Analysis & Detection và Tổng kết được ghi tại mục 3.18. Việc khôi phục trạng thái đã lưu khi mở lại project được bàn tại mục 3.19.

Ba phần này là phân nhóm chức năng, chưa phải quyết định chia thành ba module backend hoặc ba service riêng.

### 3.10. Chọn cột trước khi phân tích

- **VIEW-02 — Chọn cột:** Trước khi chạy phân tích, có phần tích chọn cột hiển thị tại Data Views; mặc định chọn toàn bộ cột.
- Người dùng chỉ được thay đổi lựa chọn cột tại Data Views.
- Cột được tích chọn là cột cần phân tích; cột bỏ tích không thuộc phạm vi phân tích. Mặc định tích toàn bộ cột.
- Phân tích dùng toàn bộ dòng của dataset đang làm việc trên các cột được chọn, không giới hạn theo bộ lọc hiển thị của Data Views.

### 3.11. ~~Bổ sung thao tác xóa dữ liệu cơ bản~~ — **ĐÃ BỎ (2026-11-05)**

> **Quyết định 2026-11-05:** Toàn bộ thao tác xóa dữ liệu bị **bỏ hoàn toàn**. Xem mục 3.40.
>
> - `DATA-01 — Xóa dòng` (một dòng / nhiều dòng chọn / một khoảng dòng) — **không còn triển khai**. Không có endpoint, không có quyền, không có test.
> - File đã tải lên và dữ liệu trong hệ thống **bất biến** — không có đường dẫn nào ghi đè hay xóa bản ghi `dataset_record`.
> - Không còn khái niệm "tập số dòng gốc đã xóa" trong `input_fingerprint` (mục 3.28).
> - Vì không có xóa dòng, các quy tắc phân tích dùng "bỏ qua giá trị thiếu/không hợp lệ" trở nên đơn giản và minh bạch hơn: giá trị không hợp lệ bị loại **khỏi phép tính**, không bị loại khỏi dataset.

### 3.12. Reset Dataset — **THU HẸP (2026-11-05)**

> **Quyết định 2026-11-05:** Vì không còn thao tác sửa/xóa dữ liệu, Reset Dataset **không còn ý nghĩa khôi phục dữ liệu**. Xem mục 3.40.5.
>
> - `DATA-02 — Reset Dataset` — **thu hẹp** còn một tác vụ duy nhất: **khôi phục tên cột về tên gốc từ file gốc** của dataset đang làm việc (để gỡ các tên cột rỗng/trùng đã sửa trong lúc làm việc).
> - Không còn khôi phục dòng đã xóa (không còn dòng đã xóa) và không cần khôi phục giá trị ô (không còn sửa ô).
> - File tải lên vẫn được giữ nguyên làm nguồn dữ liệu ban đầu.
- **v5 — gỡ.** Không còn khái niệm sheet nên không còn quy tắc reset theo sheet.
> - Reset không thay đổi bản project đã lưu cho đến lần Lưu thành công tiếp theo.
> - Vì chỉ còn tác vụ khôi phục tên cột, Reset **không còn làm mất hiệu lực** kết quả phân tích (dấu vân tay đầu vào mục 3.28 không chứa tên cột).

### 3.13. Lọc dữ liệu trong Data Views

- **VIEW-03 — Lọc văn bản:** Chứa, bằng, bắt đầu bằng.
- **VIEW-04 — Lọc số/ngày:** Bằng, lớn hơn, nhỏ hơn, trong khoảng.
- **VIEW-05 — Lọc ô trống:** Giá trị trống hoặc không trống.
- **VIEW-06 — Kết hợp bộ lọc:** Hỗ trợ điều kiện trên nhiều cột với cả AND (thỏa tất cả điều kiện) và OR (thỏa ít nhất một điều kiện).
- Người dùng đã đồng ý cả bốn nhóm trên. Bộ lọc chỉ thay đổi dữ liệu hiển thị; không sửa dữ liệu và không giới hạn các dòng được phân tích.
- Bộ lọc được làm mới khi reset, theo quy tắc trạng thái đã chốt.

**Quy tắc so khớp chi tiết (đã chốt ở v2):**

- **Cấu trúc điều kiện:** giữ dạng **phẳng**, không hỗ trợ nhóm điều kiện lồng nhau. Trong một cột, nhiều điều kiện được ghép bằng **OR**; giữa các cột, ghép bằng **AND**. Cấu trúc điều kiện được lưu cùng trạng thái project theo mục 3.19.
- **So khớp văn bản:** bốn toán tử — `contains` (chứa), `equals` (bằng), `startsWith` (bắt đầu bằng), `endsWith` (kết thúc bằng). Không hỗ trợ regex ở đợt này.
- **Phân biệt hoa/thường:** so khớp chuỗi **không** phân biệt hoa/thường, **có** phân biệt khoảng trắng. `Nam` khớp `nam` và `NAM`; `abc` không khớp ` ab c`.
- **Giá trị trống:** ô trống khi giá trị là `null`, `undefined` hoặc chuỗi chỉ chứa khoảng trắng. **Không** coi `"N/A"`, `"NULL"`, `"NA"`, `"-"` là trống — đây là giá trị văn bản bình thường. Điều này khớp với quy tắc DQ-01 ở mục 3.5.1 (chỉ `0`/`false` và ký hiệu không mặc nhiên là thiếu), tránh việc bộ lọc và phân tích hiểu "trống" khác nhau.
- **Biên khoảng số/ngày:** `between` **bao gồm cả hai đầu** (`min <= x <= max`). Giá trị ngoài khoảng trong khi `min > max` bị từ chối ở tầng xác thực đầu vào.
- **Cột không có kiểu phù hợp:** nếu cột chưa có kiểu định lượng/thời gian đã cấu hình tại Data Views thì các điều kiện số/ngày trên cột đó bị từ chối kèm lý do, không tự diễn giải. Điều này khớp với quy tắc "không tự đoán locale số" ở mục 3.25.
- **Đánh đổi:** dạng phẳng giữ cấu trúc điều kiện đơn giản, dễ lưu/khôi phục và dễ sinh truy vấn MongoDB; đổi lại không biểu đạt được điều kiện kiểu `(A AND B) OR (C AND D)`. Cần biên dịch bộ lọc sang truy vấn MongoDB ở phần 8, vì vậy cấu trúc phẳng giúp tránh phải dựng cây điều kiện tùy biến.

### 3.14. Sắp xếp và tìm kiếm trong Data Views

- **VIEW-07 — Sắp xếp:** Hỗ trợ sắp xếp tăng/giảm theo cột. Chưa chốt sắp xếp một hay nhiều cột đồng thời, thứ tự giá trị trống hoặc dữ liệu hỗn hợp.
- **VIEW-08 — Tìm kiếm:** Tìm kiếm trên **toàn bảng**, hai kiểu khớp `contains` (không phân biệt hoa/thường) và `equals` (khớp chính xác, có phân biệt). Kết hợp với bộ lọc theo quy tắc AND. Đã chốt tại mục 3.27.
- Người dùng đã đồng ý cả hai tính năng. Đây là các thao tác xem dữ liệu; không đổi dữ liệu gốc hoặc số dòng tham chiếu dùng để xóa, không giới hạn phạm vi phân tích.

### 3.15. Phân tích theo thời gian

- **ANALYSIS-02 — Phân tích theo thời gian:** Người dùng yêu cầu bổ sung khi dữ liệu có thông tin thời gian phù hợp; thuộc Data Analysis & Detection.
- Gợi ý cột ngày/ngày–giờ hợp lệ trong các cột được chọn phân tích: một cột phù hợp thì tự chọn và hiển thị rõ, nhiều cột thì yêu cầu người dùng chọn một trục thời gian tại Data Views. Không có cột phù hợp thì báo Không áp dụng phân tích thời gian, không tự dùng cột bị bỏ chọn.
- Tổng hợp ngày/tuần/tháng/năm, mặc định ngày; tuần bắt đầu thứ Hai, tháng/năm theo lịch và nêu rõ quy ước. Dữ liệu có múi giờ cần thống nhất múi giờ tổng hợp; không tự gán múi giờ cho dữ liệu không có. Trộn cách biểu diễn chưa đối chiếu được thì yêu cầu xác định cấu hình trước.
- Mặc định có số bản ghi mỗi kỳ. Với cột số định lượng được chọn theo dõi, mặc định trung vị; cho chọn trung bình, trung vị, min/max và tổng khi người dùng chủ động chọn. Giữ outliers; mỗi kỳ công bố số giá trị hợp lệ dùng tính, số thiếu và không hợp lệ.
- Ngày thiếu/sai/mơ hồ bị loại khỏi phép tổng hợp thời gian với số lượng/lý do, không tự sửa hay xóa dòng dataset. Nhiều bản ghi cùng thời điểm vẫn tổng hợp, không tự coi là lỗi trùng. Tạo kỳ từ thời điểm hợp lệ sớm nhất đến muộn nhất; không suy thiếu ngoài phạm vi này khi chưa có khoảng kỳ vọng.
- Kỳ không có bản ghi có số bản ghi bằng 0; thống kê giá trị gồm cả tổng báo không có dữ liệu, không tự điền 0. Không nội suy hoặc nối đường biểu đồ qua khoảng không có giá trị. Báo danh sách kỳ trống, số kỳ trống và chuỗi kỳ trống liên tiếp dài nhất dưới dạng khoảng trống quan sát được, không kết luận mất dữ liệu khi chưa có lịch thu thập kỳ vọng.
- So với kỳ liền trước: chênh lệch tuyệt đối khi tính được; phần trăm thay đổi chỉ khi giá trị kỳ trước dương. Kỳ trước bằng 0/âm/không có dữ liệu thì không trả phần trăm thay đổi thông thường. Không nhảy qua kỳ trống để lấy kỳ gần nhất có dữ liệu làm kỳ liền trước.
- Sàng lọc biến động bằng IQR trên các chênh lệch của hai kỳ liên tiếp hợp lệ, hệ số mặc định 1,5; gọi kết quả là Biến động lớn cần kiểm tra. Đây là lựa chọn sàng lọc của dự án, chưa điều chỉnh mùa vụ. Quá ít chênh lệch hợp lệ hoặc IQR = 0 thì báo chưa đủ điều kiện, không kết luận không có bất thường. Số lượng tối thiểu và giới hạn tham số cần thiết kế sau.
- Giữ bảng theo kỳ và biểu đồ đường/cột thời gian, không bổ sung biểu đồ quan hệ giữa các cột đã bỏ. Nêu giới hạn do mùa vụ, số ngày mỗi tháng khác nhau, kỳ đầu/cuối có thể chỉ quan sát một phần và kỳ ít mẫu. Chưa triển khai phân rã xu hướng–mùa vụ hoặc dự báo trong đợt này; phương pháp đơn giản dễ giải thích/kiểm thử nhưng có thể cảnh báo nhầm khi có mùa vụ.
- Cấu hình cột thời gian, mức tổng hợp, chỉ số và ngưỡng tại Data Views; thay đổi yêu cầu phân tích lại, lưu/khôi phục cùng trạng thái và thể hiện trong Tổng kết/PDF theo quy tắc thay đổi cuối cùng. AI nhận thống kê tổng hợp và tối đa 20 ô lỗi/cột đã che PII; khoảng trống hoặc biến động chưa mặc định là lỗi.

### 3.16. Biểu đồ và các đánh giá bổ sung

- **ANALYSIS-03 — Biểu đồ:** Có biểu đồ phục vụ thống kê, phân tích và phát hiện vấn đề. Loại biểu đồ, dữ liệu biểu diễn và mức tổng hợp chưa chốt. Phạm vi triển khai vẫn là backend; chưa mở rộng sang xây dựng giao diện.
- **ANALYSIS-04 — Tương quan và mối liên hệ:** Hỗ trợ số–số bằng Pearson/Spearman, phân loại–phân loại bằng Cramér’s V, số–phân loại bằng η²; quy tắc tại mục 3.23. Trình bày bằng bảng giá trị, không dùng chung một hệ số cho mọi loại cột. Giữ quyết định bỏ biểu đồ giữa các cột (scatter plot, box plot theo nhóm, cột nhóm/cột chồng giữa hai cột, heatmap tương quan); biểu đồ thống kê mô tả tại mục 3.21 vẫn được giữ.
- **ANALYSIS-05 — Đa cộng tuyến:** VIF trên các cột số định lượng được chọn phân tích, loại cột nhãn và không đưa mã định danh vào; không tự mã hóa cột phân loại. Dùng tập dòng hợp lệ chung, cảnh báo VIF > 5 theo mục 3.23. Việc mở rộng ANALYSIS-04 sang cột phân loại không thay đổi phạm vi VIF này.
- **ANALYSIS-06 — Outliers:** Áp dụng DQ-04 tại mục 3.5.4: IQR mặc định, hỗ trợ Modified Z-score hoặc cả hai cho từng cột định lượng. Outliers đa biến bàn riêng; không mặc định outlier là lỗi cần xóa.
- **ANALYSIS-07 — Mất cân bằng dữ liệu:** Đánh giá phân bố lớp của cột nhãn phân loại do người dùng chọn theo mục 3.17; hệ thống không tự gán nhãn. Thống kê từng lớp, Imbalance Ratio và cảnh báo IR ≥ 3 theo mục 3.24; không tự coi mất cân bằng là dữ liệu sai.
- Các đánh giá này vẫn phục vụ phát hiện, mô tả, bằng chứng và đề xuất; không tự động sửa dữ liệu hoặc áp dụng đề xuất. Mức phù hợp của mỗi đánh giá với dữ liệu cần được xác định trước khi tính toán.

### 3.17. Lựa chọn cột nhãn

- Tính năng lựa chọn, đổi và bỏ nhãn nằm tại Data Views. Bảng hiển thị dữ liệu phải chỉ rõ cột đang được chọn làm nhãn; hình thức thể hiện cụ thể chưa chốt.
- Mặc định không có cột nhãn; việc chọn nhãn là tùy chọn.
- Khi có nhu cầu, người dùng chủ động mở tính năng lựa chọn nhãn. Hệ thống gợi ý các cột có thể dùng làm nhãn, người dùng chọn một cột trong danh sách đó.
- Không tự chọn hoặc tự gán một cột làm nhãn chỉ vì hệ thống đã gợi ý. Tiêu chí gợi ý cột phù hợp chưa được thống nhất.
- Khi không có cột phù hợp trong danh sách gợi ý, người dùng không thể chọn nhãn. Hệ thống vẫn cho phép sử dụng các phân tích không cần nhãn; không thực hiện đánh giá mất cân bằng theo nhãn khi chưa có nhãn được chọn.
- Người dùng được đổi sang một cột nhãn khác trong danh sách gợi ý hoặc bỏ chọn để trở về trạng thái không có nhãn.
- Chưa chốt quan hệ giữa cột nhãn và các cột được tích chọn phân tích. Khi đổi/bỏ nhãn, áp dụng quy tắc chạy lại tại mục 3.18; cách lưu lịch sử kết quả chưa chốt.

### 3.18. Chốt dữ liệu và dùng lại kết quả phân tích

- Data Views là nơi chốt toàn bộ cấu trúc dữ liệu làm việc trước khi chuyển sang Data Analysis & Detection, bao gồm lựa chọn cột phân tích và cột nhãn nếu có. Yêu cầu này không tự mở rộng sang thao tác sửa ô hoặc schema chưa được thống nhất.
- Khi đã có kết quả phân tích và dữ liệu/cấu hình phân tích tại Data Views không thay đổi, mở lại Data Analysis & Detection không cần chạy lại.
- Khi dữ liệu/cấu hình phân tích tại Data Views thay đổi, bao gồm chọn, đổi hoặc bỏ nhãn, Data Analysis & Detection phải chạy lại khi người dùng mở phần này. Không tự chạy ngay tại thời điểm thay đổi trong Data Views.
- Lọc, sắp xếp, tìm kiếm và phân trang chỉ thay đổi hiển thị, không khiến phân tích chạy lại. Xóa dòng, đổi cột phân tích hoặc chọn/đổi/bỏ nhãn là thay đổi đầu vào khiến phân tích cần chạy lại khi mở phần này.
- Tổng kết dùng lại khi kết quả phân tích không đổi; tạo lại khi đã có kết quả phân tích mới và người dùng mở Tổng kết.
- Nếu dữ liệu/cấu hình phân tích đã thay đổi nhưng chưa chạy lại phân tích, hệ thống yêu cầu chạy lại Data Analysis & Detection trước khi tạo Tổng kết mới. Các thao tác chỉ đổi hiển thị không làm phát sinh yêu cầu này.
- Quy tắc cũ reset khi quay lại sheet được thay thế bằng yêu cầu lưu tại mục 3.19. Khi đổi cấu hình phân tích, hủy phân tích đang chạy theo mục 3.9; khi phân tích lỗi, áp dụng quy tắc Tổng kết và Thử lại AI tại mục 3.9.

### 3.19. Lưu trạng thái project — yêu cầu mới đang làm rõ

- **Thay đổi v1 / 2026-11-03:** Người dùng thay quy tắc reset khi quay lại sheet bằng lưu tại Tổng kết và khôi phục lần lưu cuối / Cần giữ kết quả làm việc / Ảnh hưởng mục 3.8, 3.9, 3.11, 3.18 và chính sách quyền ở phần 6; chưa chốt chi tiết lưu.
- Có nút Lưu tại Tổng kết. Khi truy cập lại project, khôi phục trạng thái theo lần lưu cuối cùng của người dùng có quyền lưu.
- **v5 — gỡ.** Không còn nhiều sheet trong 1 project nên quy tắc này không còn ý nghĩa; mỗi project có đúng 1 dataset.
- Project sử dụng bản được lưu cuối cùng, gắn với sheet được lưu ở lần đó; không duy trì các bản lưu riêng cho từng sheet để khôi phục song song. Lưu B thì B trở thành bản hiện hành; mở lại project hiển thị sheet và trạng thái của B.
- Nếu bản hiện hành là A, sang B thao tác nhưng không lưu rồi quay lại A thì khôi phục bản A đã lưu gần nhất. Thay đổi chưa lưu không trở thành trạng thái được khôi phục của project.
- Khi Lưu tại Tổng kết thành công, tên cột đã chỉnh sửa được lưu và khôi phục cùng bản project hiện hành. Reset vẫn khôi phục tên từ file gốc trong trạng thái làm việc theo mục 3.12.
- Nội dung bản lưu đã được xác nhận gồm: dataset đang làm việc; tên cột trong trạng thái làm việc, gồm tên đã nhập/chỉnh sửa; các cột được chọn phân tích và cột nhãn nếu có; kết quả Data Analysis & Detection (thống kê, biểu đồ, vấn đề, bằng chứng và đề xuất); nội dung Tổng kết. Cách biểu diễn/lưu trữ kỹ thuật chưa chốt, file gốc vẫn được giữ nguyên.
  - **Cập nhật 2026-11-05:** thành phần "trạng thái dữ liệu sau khi xóa dòng kèm số dòng gốc đã xóa" bị **gỡ bỏ** — không còn thao tác xóa dòng (mục 3.40). Bản lưu **không chứa trạng thái dữ liệu**, chỉ chứa cấu hình và kết quả.
  - **Cập nhật 2026-11-05:** bản lưu **không chứa giá trị ô đã sửa** — không còn thao tác sửa ô (mục 3.31.6). Tên cột đã chỉnh sửa vẫn được lưu vì đây là metadata, không phải giá trị dữ liệu.
- Bản lưu bao gồm toàn bộ trạng thái hiển thị đã bàn: bộ lọc, sắp xếp, tìm kiếm và trang đang xem. Khi mở lại project, khôi phục các trạng thái này theo bản lưu cuối cùng cùng với dữ liệu, cấu hình và kết quả đã xác nhận; không đưa riêng trạng thái hiển thị về mặc định. Việc lưu vẫn thực hiện qua nút Lưu tại Tổng kết, không tự động lưu mỗi thao tác.
- **v5 — gỡ.** Không còn chọn sheet nên không có trường hợp này.
- Reset Dataset không thay đổi bản lưu hiện hành; chỉ lần Lưu thành công tiếp theo mới cập nhật bản này, theo mục 3.12. Quy tắc chỉ khôi phục bản cuối không đồng nghĩa với yêu cầu xóa lịch sử/audit.
- Project Member được thao tác dữ liệu, chạy phân tích và lưu. Viewer được xem Data Views và lọc, đồng thời xem kết quả đã lưu ở Data Analysis & Detection và Tổng kết; không được thao tác các tính năng bên trong hai phần này, tạo/chạy lại kết quả, thay đổi dữ liệu hoặc lưu. Việc Viewer mở các phần này không được kích hoạt chạy phân tích/Tổng kết theo mục 3.18. Còn xác nhận quyền sắp xếp/tìm kiếm tại Data Views. Workspace Owner giữ toàn quyền sau khi giao project; chi tiết mô hình quyền được ghi tại phần 6.
- Khi nhiều người cùng mở một bản, nếu một người đã lưu bản mới thì yêu cầu lưu từ bản cũ của người còn lại phải bị từ chối. Hệ thống thông báo có bản mới và yêu cầu tải lại trước khi tiếp tục; không ghi đè bản mới bằng thay đổi dựa trên bản cũ. Người dùng có thể cần kiểm tra và thực hiện lại thay đổi của mình sau khi tải lại. Cơ chế kỹ thuật chưa chốt.

### 3.20. Xuất báo cáo PDF

- **REPORT-01 — Xuất báo cáo:** Cho phép xuất Tổng kết thành file PDF để tải xuống. Người dùng đã chọn định dạng PDF; chưa yêu cầu xuất báo cáo Excel.
- Nội dung nghiệp vụ dựa trên Tổng kết tại mục 3.9; bố cục báo cáo và mức chi tiết của biểu đồ/bằng chứng sẽ được thống nhất sau.
- Cho phép xuất báo cáo từ Tổng kết hiện tại trong lúc làm việc mà không cần lưu project trước. Xuất PDF không tự lưu hoặc thay thế bản project hiện hành; vẫn dùng nội dung Tổng kết hợp lệ theo mục 3.9.
- Viewer được tải báo cáo PDF từ nội dung họ có quyền xem. Đây là quyền tải báo cáo, không cấp quyền tạo/chạy lại phân tích, tạo Tổng kết mới hoặc lưu project cho Viewer; không mặc định cho Viewer xem trạng thái chưa lưu của người khác.
- Đây là yêu cầu tính năng backend; chưa chọn thư viện tạo PDF hoặc triển khai xuất file.

### 3.21. Thống kê mô tả và biểu đồ minh họa

- Thống kê mô tả thuộc Data Analysis & Detection. Người dùng yêu cầu có biểu đồ đại diện đi kèm chỉ số và bảng số liệu để dễ quan sát; cụ thể hóa yêu cầu biểu đồ tại mục 3.16.
- Danh sách chỉ số đang đề xuất gồm: tổng quan dòng/cột và phạm vi phân tích; kiểu dữ liệu, số lượng/tỷ lệ thiếu và số giá trị khác nhau theo cột; min/max, trung bình, trung vị, độ lệch chuẩn và tứ phân vị cho cột số; tần suất/tỷ lệ giá trị cho cột phân loại hoặc văn bản; khoảng thời gian và số giá trị không đọc được thành ngày giờ cho cột thời gian. Danh sách chi tiết chưa được chốt toàn bộ.
- Các loại biểu đồ đã được người dùng đồng ý: biểu đồ cột so sánh tỷ lệ thiếu giữa các cột; histogram thể hiện phân bố cột số; box plot thể hiện trung vị, tứ phân vị và các điểm có thể bất thường; biểu đồ thanh thể hiện tần suất/tỷ lệ giá trị của cột phân loại; biểu đồ đường hoặc cột thể hiện số bản ghi theo thời gian.
- Các giá trị chính xác vẫn được trình bày trong bảng số liệu. Với cột có nhiều giá trị khác nhau, biểu đồ hiển thị Top N giá trị phổ biến và gộp phần còn lại thành nhóm “Khác”. N mặc định là 5; người có quyền thao tác được nhập số nguyên dương tùy ý từ 1 đến 20, không giới hạn vào danh sách mức cố định. Đây là cách trình bày biểu đồ, không thay đổi dữ liệu gốc hoặc phạm vi phân tích. Cách xử lý đồng hạng chưa chốt.
- Viewer chỉ xem biểu đồ theo cấu hình đã lưu, không được thay đổi N hoặc cấu hình biểu đồ. Cấu hình Top N được lưu cùng bản project để khôi phục đúng cách hiển thị đã lưu.
- Quy tắc chia khoảng histogram còn cần bàn; tổng hợp thời gian theo mục 3.15, điểm bất thường theo IQR tại mục 3.5.4. Không mặc định điểm bất thường là lỗi.
- Phạm vi triển khai vẫn là backend cung cấp kết quả phục vụ biểu đồ, chưa triển khai giao diện.

### 3.22. Nhận diện, tinh chỉnh loại cột và thao tác trước phân tích

- Hệ thống tự nhận diện loại cột; người có quyền thao tác được tinh chỉnh lại tại Data Views, ví dụ xác định cột chứa mã số là cột phân loại. Viewer không được tinh chỉnh. Tách kiểu dữ liệu và vai trò phân tích theo mục 3.5.3; thuật toán nhận diện và kiểm tra tính hợp lệ của lựa chọn cần thiết kế sau.
- Bổ sung lựa chọn định dạng số/ngày tại Data Views theo DQ-03. Đổi kiểu, vai trò hoặc định dạng làm thay đổi đầu vào phân tích và cần chạy lại theo mục 3.18. Cấu hình định dạng thuộc trạng thái lưu/khôi phục; thay đổi cuối cùng còn hiệu lực được thể hiện trong Tổng kết và PDF như các thao tác trước phân tích khác.
- Đây là cấu hình dùng để phân tích, không mặc định cho phép sửa giá trị ô hoặc ghi đè file gốc. Thay đổi loại cột làm thay đổi đầu vào phân tích, áp dụng quy tắc chạy lại tại mục 3.18 trước khi tạo Tổng kết mới.
- Tổng kết có mục “Các thao tác trước phân tích” để thể hiện thao tác với bộ dữ liệu trước lần phân tích được tổng kết, bao gồm tinh chỉnh loại cột. Nội dung này cần khớp với đầu vào thực tế của lần phân tích, không trộn thay đổi phát sinh sau đó.
- Thông tin loại cột đã tinh chỉnh và mục thao tác thuộc trạng thái cần lưu/khôi phục; mục thao tác thuộc nội dung Tổng kết được xuất PDF. Các yêu cầu trước về nêu rõ dòng đã xóa và cột được chọn phân tích vẫn áp dụng.
- Mục “Các thao tác trước phân tích” chỉ hiển thị những thay đổi cuối cùng còn hiệu lực so với dữ liệu gốc và cấu hình ban đầu, không liệt kê toàn bộ lịch sử thao tác. Ví dụ: đổi loại cột từ số sang phân loại rồi trở lại số ban đầu thì không liệt kê là thay đổi loại cột. Nội dung phản ánh trạng thái dùng cho lần phân tích được tổng kết.
- Mức chi tiết như loại cột trước/sau, người thực hiện và thời điểm chưa chốt. Quy tắc hiển thị thay đổi cuối cùng không quyết định schema audit hoặc chính sách lưu lịch sử nội bộ.

### 3.23. Phương pháp liên hệ giữa các cột và VIF đã xác nhận

- Số–số: mặc định tính cả Pearson (liên hệ tuyến tính) và Spearman (liên hệ đơn điệu theo thứ hạng), hiển thị riêng; cho chọn một phương pháp tại Data Views. Không tự chọn chỉ dựa vào kiểm tra phân phối chuẩn. Kết quả khác nhau chỉ là dấu hiệu cần xem xét, không tự kết luận nguyên nhân; giữ outliers trong phép tính theo phạm vi đã chốt.
- Phân loại–phân loại: Cramér’s V từ bảng tần suất kết hợp, phạm vi 0–1, không có chiều âm/dương; không tự mã hóa tên nhóm thành số để tính Pearson. Báo số nhóm mỗi cột và số quan sát; cảnh báo thiếu ổn định khi nhiều nhóm/ít dữ liệu, không tự gộp nhóm hiếm.
- Số–phân loại: Eta-squared (η²) mô tả tỷ phần biến thiên của cột số gắn với khác biệt trung bình giữa các nhóm. Kèm bảng số quan sát, trung bình, trung vị và độ lệch chuẩn khi tính được theo nhóm. Không diễn giải nhân quả; nhóm quá nhỏ/quá nhiều có thể gây hiểu nhầm; không bao quát mọi khác biệt phân phối. Trước mắt chưa tự bổ sung kiểm định ANOVA/p-value.
- Phân tích từng cặp dùng dòng hợp lệ đồng thời ở hai cột, không tự điền thiếu hoặc xóa dòng khỏi dataset. Mỗi cặp báo số dùng/bị loại và lý do; thiếu ở cột thứ ba không loại dòng của cặp này. Đánh đổi: tận dụng dữ liệu hơn loại theo toàn bộ cột, nhưng mỗi cặp có thể dùng tập dòng khác nhau nên không hoàn toàn so sánh trực tiếp.
- Cột hằng, thiếu nhóm hoặc không đủ dữ liệu thì báo Không tính được và lý do, không thay kết quả bằng 0. Số quan sát tối thiểu và ngưỡng cảnh báo nhóm thưa cần thiết kế chi tiết.
- VIF cần ít nhất hai cột phù hợp; loại cột nhãn, định danh và không mã hóa phân loại. Dùng một tập dòng có giá trị hợp lệ trên toàn bộ cột tham gia VIF; công bố danh sách cột và số dòng dùng/bị loại. Cột hằng được báo riêng và loại khỏi phép tính, không âm thầm bỏ. Kiểm tra số quan sát và phụ thuộc tuyến tính trước khi trả kết quả; báo rõ phụ thuộc tuyến tính hoàn hảo, không đổi VIF vô hạn thành số hữu hạn tùy ý.
- VIF không cần cột nhãn để tính và bổ sung cho tương quan từng cặp. Ngưỡng cảnh báo tham khảo **VIF > 5** là cần kiểm tra, không tự chứng minh dữ liệu sai hoặc yêu cầu xóa cột. Không dùng chung thang yếu/vừa/mạnh cho Pearson, Cramér’s V và η²; không tự gán mức ảnh hưởng Cao từ liên hệ/VIF cao.
- Kết quả bằng bảng, gồm phương pháp, cột, giá trị, số quan sát thực tế và cảnh báo điều kiện tính; không bổ sung biểu đồ giữa các cột. Cấu hình phương pháp tại Data Views tuân thủ quy tắc lưu/khôi phục, thay đổi đầu vào yêu cầu phân tích lại và thể hiện thay đổi cuối cùng trong Tổng kết/PDF.
- Nguồn tham khảo phương pháp: [SciPy — Association](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.contingency.association.html), [SciPy — Pearson](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html), [statsmodels — Effect sizes](https://www.statsmodels.org/stable/generated/statsmodels.stats.oneway._fstat2effectsize.html), [statsmodels — VIF](https://www.statsmodels.org/stable/generated/statsmodels.stats.outliers_influence.variance_inflation_factor.html). Đây chưa phải quyết định chọn thư viện triển khai.

### 3.24. Đánh giá mất cân bằng lớp đã xác nhận

- Chỉ đánh giá khi người dùng chọn nhãn phù hợp cho phân loại, dựa vào vai trò cột tại Data Views, không suy từ việc cột chứa số nguyên. Chưa chọn nhãn: Chưa đánh giá — chưa chọn cột nhãn. Nhãn liên tục: Không áp dụng đánh giá mất cân bằng lớp, vẫn thống kê phân bố số và không tự chia khoảng tạo lớp. Không còn nhãn hợp lệ: Không có dữ liệu nhãn hợp lệ. Chỉ quan sát một lớp: báo rõ, không kết luận cân bằng.
- Với ít nhất hai lớp quan sát được: báo số dòng nhãn hợp lệ; số thiếu/không hợp lệ riêng; số lớp; số lượng/tỷ lệ từng lớp; lớp lớn nhất/nhỏ nhất (đầy đủ các lớp đồng hạng); **IR = số mẫu lớp lớn nhất / số mẫu lớp nhỏ nhất**. IR chỉ phản ánh hai đầu nên phải đi cùng phân bố đầy đủ, không dùng làm kết luận duy nhất.
- Tỷ lệ lớp tính trên số dòng có nhãn hợp lệ. Nhãn thiếu không tự thành lớp Không rõ; thiếu ở đặc trưng khác không loại dòng khỏi thống kê nhãn. Dùng toàn bộ dataset đang làm việc sau xóa dòng đã xác nhận, không phụ thuộc lọc hiển thị. Không tự gộp nhãn gần giống, điền nhãn hoặc xóa dòng trùng. Nêu rõ phân bố chỉ phản ánh phần có nhãn hợp lệ và có thể lệch so với thực tế do nhãn thiếu.
- **IR ≥ 3** bật cảnh báo Có chênh lệch đáng chú ý về số lượng giữa các lớp. Đây là ngưỡng mặc định do dự án lựa chọn, không phải chuẩn thống kê chung; không tự gán mức ảnh hưởng Cao hoặc kết luận dataset không dùng được. Luôn xem cùng số mẫu tuyệt đối; ngưỡng cảnh báo lớp quá ít mẫu cần bàn riêng.
- Bảng phân bố đầy đủ các lớp, có thể phân trang; biểu đồ cột thể hiện số lượng/tỷ lệ. Top N và Khác chỉ để hiển thị theo quy tắc đã chốt; IR, lớp nhỏ nhất và cảnh báo tính trên tất cả lớp gốc, không tính lại sau gộp Khác.
- Chỉ đề xuất kiểm tra tính đại diện/thu thập thêm dữ liệu; nếu mục tiêu huấn luyện mô hình thì có thể gợi ý cân nhắc trọng số lớp/lấy mẫu phù hợp. Không tự cân bằng, sinh mẫu, xóa mẫu hoặc huấn luyện mô hình. AI nhận thống kê tổng hợp và tối đa 20 ô lỗi/cột đã che PII, kèm giải thích giới hạn và đề xuất có điều kiện; không khẳng định chất lượng mô hình khi chưa đánh giá mô hình.
- Ngưỡng cảnh báo nếu cho chỉnh phải đặt tại Data Views, lưu cùng cấu hình và thể hiện trong Tổng kết; quyền chỉnh và giới hạn giá trị còn cần chốt. Không mặc định thêm chức năng chỉnh ngưỡng từ mô tả điều kiện này.
- Đánh đổi: cảnh báo có ngưỡng giúp nhận biết chênh lệch nhưng mang tính quy ước; số lượng mẫu và mục tiêu sử dụng vẫn cần để đánh giá tác động. Phương án chỉ báo chỉ số ít áp đặt hơn nhưng chưa được chọn cho mặc định hiện tại.

### 3.25. Giới hạn dung lượng và quy ước đọc file — đã chốt

- **Giới hạn dung lượng:** tối đa **50 MB cho một file** và **500 MB cho một workspace**. Vượt ngưỡng thì từ chối Import với thông báo rõ ngưỡng đã vượt; file chưa gắn vào project. Hard-cap hạ tầng lưu trữ vẫn là `STORAGE_MAX_QUOTA_BYTES` (mặc định 10 GB) như đang cấu hình.
- **v5 — lý do chọn 50 MB:** file CSV được đọc bằng **streaming** nên không nạp toàn bộ vào RAM, nhưng **bộ nhớ lúc phân tích** vẫn cao (nạp toàn bộ bản ghi để lọc/sắp xếp trong JS — Phần 8 v4 mục 3.6.3). Giới hạn 50 MB giữ cho mỗi request upload ở mức an toàn khi nhiều người dùng đồng thời. Đánh đổi: dataset lớn hơn 50 MB không xử lý được trong đợt này.
- **CSV:** mã hóa UTF-8, tự bỏ BOM nếu có. Tự nhận diện delimiter trong tập `,` `;` `\t` `|`; nếu không xác định được thì báo lỗi Import, không đoán.
- **Không tự đoán locale số.** Dấu thập phân và phân nhóm hàng nghìn do người dùng cấu hình tại Data Views theo mục 3.22 và mục 3.5.3. Hệ thống không tự diễn giải `1,234` là `1234` hay `1.234`, không tự bỏ tiền tệ, phần trăm hoặc đơn vị.
- **Dòng có số cột khác số cột của header:** giữ theo vị trí; cột thiếu ở dòng đó được coi là thiếu (DQ-01); cột thừa bị bỏ và ghi cảnh báo. Không tự dịch chuyển để "lần khớp" dữ liệu.
- Ô trống bên phải cột cuối không tạo dòng dư thừa (áp dụng cho CSV).
- Quy tắc so khớp văn bản, giá trị trống và biên khoảng số/ngày trong bộ lọc vẫn để mục 3.13; chi tiết so khớp chưa chốt, không tự suy diễn từ đây.

### 3.26. Cấu trúc bảng không hợp lệ trong file CSV — đã chốt

- Ba trạng thái phân biệt:
  - **File rỗng hoàn toàn** (không có cả header lẫn dòng dữ liệu): áp dụng mục 3.8 — vẫn mở, thông báo "không có dữ liệu".
  - **File chỉ có header, không có dòng dữ liệu**: coi là **hợp lệ**. Người dùng xem được cấu trúc cột; các phép phân tích báo "không có dữ liệu để đánh giá" theo mục 3.5.1, không phải lỗi Import.
  - **File có dòng dữ liệu nhưng không xác định được header** (dòng đầu không phải tên cột hợp lệ): thông báo lỗi Import, chưa gắn file vào project, cho nhập lại. Không tự dò tìm dòng khác làm header.
- Đánh đổi: cho phép file 0 dòng làm hợp lệ để không cảnh báo mọi file có sheet metadata trống, đổi lại thông điệp "không có dữ liệu để đánh giá" xuất hiện ở nhiều phép phân tích. Thông điệp này phải thống nhất giữa DQ-01, DQ-03 và mục 3.15.

### 3.27. Sắp xếp và tìm kiếm — đã chốt

- **Sắp xếp: một cột tại một thời điểm**, tăng hoặc giảm. Không hỗ trợ sắp xếp nhiều cột đồng thời.
- Lý do: keyset pagination hiện dùng `row_index` làm con trỏ duy nhất. Sắp xếp nhiều cột đòi hỏi khóa tổng hợp phức tạp, phá vỡ cơ chế cursor hiện có và tăng chi phí truy vấn trên tập bản ghi lớn.
- Thứ tự giá trị trống và dữ liệu hỗn hợn: **giá trị trống luôn xếp cuối** theo chiều sắp xếp, không phụ thuộc tăng/giảm. Dữ liệu hỗn hợp (ví dụ cột vừa số vừa chuỗi) sắp xếp theo kiểu đã cấu hình của cột tại Data Views; nếu cột chưa có kiểu, báo không sắp xếp được cột đó thay vì trộn kiểu âm thầm.
- **Tìm kiếm: toàn bảng**, không giới hạn theo cột. Hai kiểu khớp: `contains` (không phân biệt chữ hoa/thường) và `equals` (khớp chính xác, có phân biệt). Tìm kiếm kết hợp với bộ lọc theo quy tắc AND.
- Tìm kiếm và sắp xếp chỉ đổi hiển thị; không đổi dữ liệu gốc, không đổi số dòng tham chiếu dùng để xóa, không giới hạn phạm vi phân tích. Kết quả tìm kiếm/sắp xếp là một phần của trạng thái hiển thị được lưu cùng bản project theo mục 3.19.

### 3.28. Kết quả phân tích cũ sau khi thay đổi đầu vào — đã chốt

- Mỗi lần chạy phân tích ghi kèm một **dấu vân tay đầu vào** (`input_fingerprint`): hash của tổng hợp các thành phần sau — dataset đang làm việc, tập cột được chọn phân tích, cột nhãn nếu có, cấu hình phân tích (kiểu/định dạng cột, phương pháp tương quan, phương pháp outlier, mức tổng hợp thời gian, Top N), và phiên bản cấu hình.
  - **Cập nhật 2026-11-05:** thành phần "tập số dòng gốc đã xóa" bị **gỡ bỏ** — không còn thao tác xóa dòng (mục 3.40). Thành phần "tên cột đã chỉnh sửa" cũng **không có** trong fingerprint: đổi tên cột không ảnh hưởng phép tính, và Reset (mục 3.40.5) không làm mất hiệu lực kết quả phân tích.
  - Vì dữ liệu là bất biến (mục 3.40), fingerprint **chỉ thay đổi khi cấu hình phân tích hoặc lựa chọn tập cột/cột thay đổi** — không bao giờ do thao tác sửa dữ liệu.
- Khi `input_fingerprint` của yêu cầu hiện tại khác với kết quả đã lưu: kết quả cũ được đánh dấu **stale**. Kết quả stale **không bị xóa** khỏi database.
- Hành vi theo mục 3.18: mở Data Analysis & Detection với đầu vào đã đổi thì yêu cầu chạy lại phân tích; mở Tổng kết mà phân tích hệ thống chưa chạy lại với đầu vào hiện tại thì bị từ chối tạo Tổng kết mới.
- Đánh đổi: cần một lần hash mỗi lần chạy phân tích và một lần hash khi mở phần, nhưng tránh phải so sánh toàn bộ kết quả để biết có cũ hay không.
- **Đơn giản hóa do quyết định 2026-11-05:** trước đây cơ chế `stale` phải phân biệt "sửa ô" (giữ + cảnh báo) với "đổi cấu hình" (đánh dấu stale). Nay chỉ còn một loại — mọi thay đổi đầu vào đều đánh dấu `stale`.

### 3.29. Ngưỡng mức ảnh hưởng và số mẫu tối thiểu — đã chốt

Ngưỡng dưới đây là **quy ước do dự án lựa chọn**, không phải chuẩn thống kê chung. Mọi ngưỡng phải được thể hiện cùng lý do trong Tổng kết và báo cáo PDF theo mục 3.9.

| Nhóm | Thấp | Trung bình | Cao |
|---|---|---|---|
| DQ-01 — Dữ liệu thiếu | < 1% | 1% – 10% | > 10% |
| DQ-02 — Dữ liệu trùng | < 0,5% | 0,5% – 5% | > 5% |
| DQ-03 — Sai kiểu/định dạng | < 1% | 1% – 10% | > 10% |
| DQ-04 — Giá trị bất thường | vượt hàng rào IQR 1,5× | vượt hàng rào IQR 3× hoặc Modified Z-score > 3,5 | cả hai phương pháp cùng đánh dấu |
| DQ-05 — Mâu thuẫn giữa các cột | — | — | luôn hiển thị **"Chưa đánh giá"** theo mục 3.5.5 |

- Tỷ lệ tính trên số dòng đang phân tích của cột tương ứng. Không có dòng nào thì báo "không có dữ liệu để đánh giá", không trả 0% và không áp ngưỡng.
- **Số mẫu tối thiểu** để một phép phân tích được thực hiện:
  - Tương quan Pearson/Spearman: ≥ 3 quan sát hợp lệ đồng thời trên cả hai cột.
  - Cramér's V và η²: ≥ 2 quan sát hợp lệ trên mỗi lớp có mặt.
  - VIF: ≥ (số cột số tham gia + 1) quan sát hợp lệ trên tập dòng chung.
  - IQR và Modified Z-score: ≥ 4 quan sát hợp lệ.
  - Đánh giá mất cân bằng lớp: ≥ 2 lớp quan sát được (khác với điều kiện "chỉ quan sát một lớp" ở mục 3.24).
  - Sàng lọc biến động theo IQR trên chênh lệch kỳ: ≥ 3 chênh lệch hợp lệ.
- Không đủ số mẫu: báo **"không tính được" kèm lý do cụ thể**, không thay kết quả bằng 0 và không coi là dữ liệu tốt.
- Đánh đổi: ngưỡng quy ước cho phép gắn mức ảnh hưởng nhất quán và kiểm thử được, nhưng có thể gắn "Cao" cho một cột mà người dùng vẫn thấy bình thường. Vì vậy mỗi mức đều phải kèm lý do, phạm vi bị ảnh hưởng và quy tắc áp dụng theo mục 3.6.

### 3.30. Tiêu chí gợi ý cột nhãn và xử lý múi giờ — đã chốt

**Gợi ý cột nhãn.** Hệ thống chỉ gợi ý một cột khi thỏa đồng thời:
- Cột có vai trò phân tích là `categorical` (theo mục 3.5.3 và 3.22).
- Có ít nhất 2 lớp giá trị khác nhau.
- Không quá 50 lớp.
- Tỷ lệ lớp lớn nhất < 80%.

- Cột có vai trò định danh (`identifier`) không được gợi ý làm nhãn.
- Người dùng có thể **chọn thủ công** một cột khác trong danh sách gợi ý, hoặc bỏ chọn để trở về trạng thái không có nhãn. Hệ thống không tự gán nhãn.
- Khi danh sách gợi ý rỗng: không thể chọn nhãn; các phân tích không cần nhãn vẫn dùng được; đánh giá mất cân bằng theo nhãn báo "Chưa đánh giá — chưa chọn cột nhãn" theo mục 3.24.
- Đánh đổi: ngưỡng 80% loại bỏ các cột có lớp áp đảo — hợp lý cho phân tích mất cân bằng nhưng có thể loại cột người dùng thực sự muốn dùng; vì vậy luôn cho chọn thủ công.

**Múi giờ tổng hợp thời gian.** Cấu hình tại Data Views theo mục 3.15:
- Cột thời gian **có offset múi giờ** (VD `+07:00`): người dùng **bắt buộc** chọn múi giờ tổng hợp trước khi chạy phân tích thời gian.
- Cột thời gian **naive** (không có offset): mặc định dùng UTC và **ghi rõ "UTC"** trong kết quả Tổng kết và PDF.
- Hệ thống không tự gán múi giờ cho dữ liệu không có thông tin. Trộn cách biểu diễn (vừa có offset vừa naive trong cùng cột) thì yêu cầu xác định cấu hình trước, không tự quy đổi.
- Đánh đổi: bắt buộc chọn thêm một bước cho dữ liệu có offset; đổi lại tránh lệch kỳ ở các ranh giới ngày và các kỳ chuyển múi giờ.

### 3.31. Bằng chứng, lưu trữ file và phạm vi AI — đã chốt

#### 3.31.1. Mức chi tiết bằng chứng trong hệ thống

- Bằng chứng ở **mức ô**: nêu cột và giá trị ô cụ thể, kèm **số dòng gốc** của file gốc để người dùng đối chiếu.
- Bằng chứng được lưu ở **collection riêng** (tên collection và cấu trúc cụ thể thuộc phần 8), tham chiếu từ phát hiện. Không nhúng inline trong document kết quả phân tích để tránh làm phình document và giữ phân tích đọc được.
- Phân trang bằng chứng riêng khi số lượng lớn. Số lượng ô lỗi tổng vẫn được công bố đầy đủ trong phát hiện.
- Đánh đổi: bằng chứng đầy đủ tăng dung lượng lưu trữ theo tỷ lệ với số lỗi; việc tách collection đòi hỏi thêm một lần đọc khi mở chi tiết phát hiện.
- Ranh giới với AI: ô lỗi **không** đưa vào đầu vào AI theo mặc định — xem mục 3.31.3.

#### 3.31.2. Lưu trữ file import

- File gốc được lưu trên **Cloudflare R2** (S3-compatible) qua port Storage, bucket cấu hình bằng `S3_BUCKET_NAME`. Có chế độ **local fallback** ghi vào `src/backend/storage/` khi thiếu cấu hình S3 — giữ nguyên cơ chế hiện có, áp dụng cho cả môi trường phát triển.
- **Sửa lỗi hiện có:** storage key phải dùng extension `.csv`. **v5:** chỉ hỗ trợ CSV nên không còn nhánh định dạng.
- **Dọn file tạm:** nếu upload hoặc xử lý thất bại giữa chừng, file tạm phải được xóa khỏi bucket thay vì để lại rác. Mã hiện tại tạo `raw_files/{datasetId}_temp.csv` rồi mới ghi đè `storage_key` — khi lỗi giữa chừng sẽ còn file rác.
- Bản ghi dữ liệu (từng dòng) **không** nằm trong file lưu trữ; được tách riêng vào cơ sở dữ liệu. R2 chỉ giữ file gốc, snapshot phiên bản và file xuất.
- Backend mới **viết port Storage riêng** theo chuẩn Ports and Adapters, không tái sử dụng trực tiếp lớp `StorageService` hiện tại; adapter bên trong vẫn dùng R2 + local fallback.
- Giới hạn dung lượng theo mục 3.25, hard-cap hạ tầng theo `STORAGE_MAX_QUOTA_BYTES`.

#### 3.31.3. Phạm vi AI và ranh giới dữ liệu gửi ra ngoài

- AI đảm nhiệm **4 vai trò**: phát hiện vấn đề bổ sung, giải thích, đề xuất xử lý và nhận xét chất lượng dữ liệu. Mức ảnh hưởng và trạng thái xác minh vẫn do backend quyết định theo mục 3.6; AI không được ghi đè.
- **v5 — thay thế.** **Nhà cung cấp:** AI **cục bộ** — engine suy luận nội bộ qua `AiInferencePort` (`vLLM` ở production, `Ollama` ở dev, `llama.cpp` làm fallback). Model: `Qwen3-14B-Q4_K_M` (chính) + `Qwen3-8B-Q4_K_M` (fast-path). **Không có API key bên ngoài nào.**
- **v5 — thay thế.** Rủi ro bảo mật đảo chiều hoàn toàn: dữ liệu **không rời khỏi VPS**. Rủi ro còn lại nằm ở chỗ engine suy luận có thể ghi log request → phải **tắt request log** của `vLLM`/`Ollama` và tiếp tục che PII ở tầng domain (Phần 12 v4 mục 3.15).
- **Dữ liệu gửi cho AI:** thống kê tổng hợp **và tối đa 20 ô lỗi cho mỗi cột**, đã **che PII** theo cơ chế mask hiện có. Không gửi file gốc, không gửi toàn bộ tập bản ghi, không gửi ảnh chụp màn hình lỗi.
- Bổ sung này **thay đổi** các quyết định "AI chỉ nhận thống kê tổng hợp" ghi tại mục 3.5.1, mục 3.6 và mục 3.7, cũng như phần 12. Mọi nơi còn viết "không nhận mẫu dòng/giá trị ô" phải được hiểu là: không nhận **toàn bộ** mẫu dòng/giá trị ô; chỉ nhận mẫu giới hạn 20 ô/cột đã che PII.
- Che PII là điều kiện bắt buộc, không phải tuỳ chọn. Ô lỗi chứa dữ liệu nghiệp vụ (họ tên, định danh, email, số điện thoại) phải được che trước khi rời hệ thống. Nếu không che được thì gửi thống kê tổng hợp thuần túy.
- Đánh đổi: 20 ô/cột cho phép AI chỉ ra dạng lỗi cụ thể (ví dụ "cột Giới tính có giá trị `Nam` và `nam` không nhất quán") mà thống kê tổng hợp không mô tả được; đổi lại hệ thống phải có bước che PII bắt buộc trước khi gọi API ngoài và không được gửi toàn bộ tập lỗi.

#### 3.31.4. Cơ chế gọi AI bất đồng bộ

- AI chạy **bất đồng bộ**: lần phân tích hệ thống hoàn tất và trả kết quả ngay; phần AI được giao một **job** và chạy nền.
- **v5 — thay thế.** Hạ tầng: **Kafka** làm bus sự kiện + hàng đợi job nền — 5 topic, 6 consumer group, DLQ `dlq.dead-letter` (Phần 9 v3 mục 3.4.4). Job AI được giao qua topic `ai.jobs`.
- **v5 — thay thế.** Lý do đảo chiều: hệ thống cần **bus sự kiện thực sự** (domain events, thông báo, realtime push) chứ không chỉ một hàng đợi job; Kafka + outbox/inbox là cặp tự nhiên và cho phép replay. Redis giữ lại cho cache và adapter Socket.IO.
- **v5 — thay thế.** Đánh đổi: **Kafka KRaft single-node** phải được vận hành như một dịch vụ; khi worker restart thì job đang chạy được phục hồi bằng **consumer rebalance** và cơ chế quét job quá hạn. Không còn quota request bên ngoài; nhưng bộ nhớ RAM bị giới hạn (15 GB) nên phải có **RAM guard** dừng job AI mới khi RSS vượt 85% (Phần 10 v4).
- Quy tắc xử lý lỗi giữ nguyên như đã chốt: AI lỗi không chặn Tổng kết; Tổng kết hiển thị kết quả hệ thống không có phần giải thích và đề xuất của AI; người có quyền phân tích được thử lại riêng phần AI khi dữ liệu và cấu hình phân tích không đổi (mục 3.9, mục 3.18).

#### 3.31.5. Phạm vi module cho backend mới

- Module **được đưa vào backend mới**: `auth`, `users`, `workspaces`, `projects`, `datasets` (bổ sung đọc CSV streaming), `data-view` (bổ sung lọc/sắp xếp/tìm kiếm/reset tên cột/lưu trạng thái), và các module mới: `analysis` (Data Analysis & Detection), `summary` (Tổng kết), `reports` (xuất PDF), `ai` (port + adapter suy luận cục bộ + job), **`feedback`** (nhận xét người dùng + kho mẫu học lại — **v5**).
- Module **bị gỡ khỏi phạm vi sản phẩm** (2026-11-05): `cell-edit` (sửa ô — mục 3.31.6), `clean-rules` (rule engine làm sạch), `versions` (snapshot Merkle + rollback), `lineage` (đồ thị Neo4j). Cả bốn đều phục vụ mục đích **sửa hoặc khôi phục dữ liệu**, vốn không còn thuộc phạm vi.
- Module **đánh dấu LEGACY**: `exports`. Giữ nguyên chạy song song với backend mới trong đợt tái cấu trúc, **không** đưa vào kiến trúc mới.
- Trách nhiệm hoàn thiện lại các module LEGACY nằm ngoài đợt tái cấu trúc này, thực hiện sau khi backend mới đã đáp ứng đủ API. Ba module `clean-rules`, `versions`, `lineage` **không còn là LEGACY cần hoàn thiện** — chúng bị gỡ khỏi phạm vi sản phẩm và bị xoá khi cutover. Riêng `clean-rules` trước đây được đánh dấu LEGACY với câu hỏi "giữ hay thu hồi" — câu hỏi này **đã được trả lời: thu hồi**, theo quyết định 2026-11-05 về phạm vi chỉ đọc.

#### 3.31.6. ~~Thao tác sửa ô trong backend mới~~ — **ĐÃ BỎ (2026-11-05)**

> **Quyết định 2026-11-05:** Thao tác sửa ô bị **bỏ hoàn toàn**. Xem mục 3.40.
>
> - Module `cell-edit` **không được đưa vào backend mới**. Không có endpoint `PATCH .../records/{rowIndex}`, không có quyền ghi ô, không có test.
> - Không còn khái niệm "sửa ô không làm mất hiệu lực kết quả phân tích theo cơ chế `stale`" — vì không còn sửa ô, mọi thay đổi đầu vào đều dẫn tới `stale` theo mục 3.28.
> - Không còn cảnh báo "kết quả phân tích đã lưu có thể không còn khớp" do sửa ô.
> - Trạng thái lưu/khôi phục project (mục 3.19) **không còn lưu trạng thái dữ liệu đã biến đổi** — chỉ lưu cấu hình phân tích, kết quả phân tích và Tổng kết.

#### 3.31.7. Phạm vi AI sau khi bỏ thao tác sửa dữ liệu (2026-11-05)

- **AI chỉ đọc và đề xuất — không bao giờ ghi.** Bốn vai trò AI tại mục 3.31.3 giữ nguyên: phát hiện vấn đề bổ sung, giải thích, **đề xuất xử lý**, nhận xét chất lượng dữ liệu.
- **Không có đường dẫn thực thi.** Đề xuất của AI là văn bản gợi ý cho người dùng tự xử lý ở hệ thống nguồn. Không có API "apply suggestion", không có job tự động sửa dữ liệu.
- **Mức ảnh hưởng và trạng thái xác minh** do backend quyết định — AI không được ghi đè (giữ nguyên mục 3.29).
- **Ranh giới dữ liệu gửi ra ngoài** giữ nguyên mục 3.31.3: chỉ thống kê tổng hợp + tối đa 20 ô lỗi/cột đã che PII.
- Đề xuất xử lý được trình bày dưới dạng **mô tả vấn đề + hướng xử lý gợi ý + tham chiếu bằng chứng**, không kèm giá trị đề xuất ghi thẳng.

### 3.32. Đối chiếu với file tính năng đầu vào — đã chốt

**Nguồn:** `docs/restructures/feature_nescessary.xlsx` (sheet `Trang tính1`, 2 cột `Tên tính năng` / `Mô tả`, **52 dòng dữ liệu** có nội dung; 939 dòng còn lại trống và bị bỏ qua).

**Cách đối chiếu.** Từng dòng trong file được đối chiếu với ba nguồn: (1) các mã tính năng đã có trong Phần 2 v2; (2) 31 use case ở Phần 3; (3) mã nguồn hiện tại (`src/backend/src/modules/`). Kết quả:

| Kết quả | Số dòng | Cách xử lý |
|---|---|---|
| Trùng hoàn toàn với tính năng đã có | 10 | Dẫn chiếu mã/UC hiện có, không tạo mã mới |
| Đã có sẵn trong mã nguồn nhưng chưa có mã tính năng | 12 | Cấp mã mới trong nhóm tương ứng, ghi rõ trạng thái triển khai |
| Trùng nhau giữa các dòng trong file (đã gộp) | 6 | Gộp thành một tính năng, ghi rõ dòng nguồn |
| Mới hoàn toàn | 24 | Cấp mã mới, viết đặc tả đầy đủ |

**Bảng đối chiếu đầy đủ 52 dòng:**

| # | Tên tính năng trong file | Mã v3 | Kết quả |
|---|---|---|---|
| 1 | Đăng ký tài khoản | `AUTH-01` | Đã có trong code (`POST /auth/register`), chưa có mã |
| 2 | Đăng nhập bằng email và mật khẩu | `AUTH-02` | Đã có trong code (`POST /auth/login`), chưa có mã |
| 3 | Login bằng Google | `AUTH-03` | **Mới** — schema `user.google_id` đã có nhưng chưa có luồng OAuth |
| 4 | Ghi nhớ đăng nhập | `AUTH-04` | **Mới** — thu hẹp thành nhớ email |
| 5 | Quên mật khẩu | `AUTH-05` | **Mới** — DTO `password-reset.dto.ts` đã có, chưa có endpoint |
| 6 | Reset password | `AUTH-06` | **Mới** — dùng `password_reset_token_hash` đã có trong schema |
| 7 | Thay đổi mật khẩu | `AUTH-07` | **Mới** — chưa có endpoint |
| 8 | Xem 5 thông báo mới nhất | `NOTIF-01` | **Mới** — gộp với #9, #10, #11 thành một trung tâm thông báo |
| 9 | Danh sách tất cả thông báo | `NOTIF-01` | Gộp vào `NOTIF-01` |
| 10 | Danh sách thông báo chưa đọc | `NOTIF-01` | Gộp vào `NOTIF-01` |
| 11 | Danh sách thông báo đã đọc | `NOTIF-01` | Gộp vào `NOTIF-01` |
| 12 | Chi tiết thông báo | `NOTIF-02` | **Mới** |
| 13 | Tạo báo cáo mới | `ISSUE-01` | **Mới** — tính năng báo lỗi/sự cố |
| 14 | Danh sách báo cáo của tôi | `ISSUE-02` | **Mới** — gộp với #15 thành một danh sách có bộ lọc trạng thái |
| 15 | Danh sách báo cáo lọc theo status | `ISSUE-02` | Gộp vào `ISSUE-02` |
| 16 | Chi tiết báo cáo | `ISSUE-03` | **Mới** |
| 17 | Duyệt báo cáo từ người dùng | `ISSUE-04` | **Mới** — yêu cầu vai trò Admin |
| 18 | Xem toàn bộ hồ sơ thông tin người dùng | `ADMIN-01` | **Mới** — chỉ đọc |
| 19 | Xem thông tin hồ sơ cá nhân | `USER-01` | Đã có trong code (`GET /users/me`), chưa có mã |
| 20 | Cập nhật hồ sơ cá nhân | `USER-02` | Đã có trong code (`PATCH /users/me`), chưa có mã |
| 21 | Xem phiên đăng nhập của tài khoản | `AUTH-08` | Đã có trong code (`GET /auth/sessions`), chưa có mã |
| 22 | Xem chi tiết phiên đăng nhập | `AUTH-09` | **Mới** — hiện có `revokeSession` nhưng chưa có đọc chi tiết |
| 23 | Đăng xuất ra khỏi thiết bị ở phiên tùy chọn | `AUTH-10` | Đã có trong code (`DELETE /auth/sessions/:id`), chưa có mã |
| 24 | Tắt thông báo | `NOTIF-03` | **Mới** — gộp với #25 thành một công tắc bật/tắt |
| 25 | Bật thông báo | `NOTIF-03` | Gộp vào `NOTIF-03` |
| 26 | Đăng xuất ở thiết bị hiện tại | `AUTH-11` | Đã có trong code (`POST /auth/logout`), chưa có mã |
| 27 | Lưu Project | `PROJ-12` | Trùng — mục 3.19 của tài liệu này và UC-25 của Phần 3 |
| 28 | Xóa Project | `PROJ-05` | Đã có trong code (`DELETE /projects/:id`, soft delete), chưa có mã |
| 29 | Tạo project | `PROJ-01` | Trùng — UC-05 của Phần 3 |
| 30 | Xem danh sách project | `PROJ-02` | **Mới** — gộp với #51 thành một danh sách project |
| 31 | Xem thông tin cơ bản project | `PROJ-03` | **Mới** |
| 32 | Lịch sử hoạt động của project | `PROJ-06` | **Gỡ (2026-11-05)** — thuộc nhóm bị bỏ theo mục 3.40 |
| 33 | Xem chi tiết lịch sử 1 hoạt động | `PROJ-07` | **Gỡ (2026-11-05)** — thuộc nhóm bị bỏ theo mục 3.40 |
| 34 | Chỉnh sửa thông tin cơ bản project | `PROJ-04` | Đã có trong code (`PATCH /projects/:id`), chưa có mã |
| 35 | Quay lại phiên bản của project | `PROJ-08` | **Gỡ (2026-11-05)** — thuộc nhóm bị bỏ theo mục 3.40 |
| 36 | Tìm kiếm thành viên trong project | `PROJ-09` | **Mới** |
| 37 | Thay đổi quyền cho thành viên trong project | `PROJ-10` | Trùng — UC-06 của Phần 3 |
| 38 | Nhượng quyền Project Owner | `PROJ-11` | Trùng — UC-06 của Phần 3 (`transfer-owner`) |
| 39 | Rời workspace | `WS-10` | Trùng — UC-07 của Phần 3 |
| 40 | Nhượng quyền Workspace Owner | `WS-09` | **Mới** — điều kiện tiền đề của UC-07 |
| 41 | Xem tổng quan số liệu Workspace | `WS-08` | **Mới** — gộp với #48 thành một màn tổng quan |
| 42 | Tạo mới Workspace | `WS-01` | Trùng — UC-01 của Phần 3 |
| 43 | Lấy danh sách workspace | `WS-02` | **Mới** — lọc vai trò chỉ có Owner/Member |
| 44 | Lấy thông tin chi tiết Workspace | `WS-03` | Đã có trong code (`GET /workspaces/:id`), chưa có mã |
| 45 | Cập nhật thông tin workspace | `WS-04` | Đã có trong code (`PATCH /workspaces/:id`), chưa có mã |
| 46 | Lấy danh sách thành viên trong workspace | `WS-06` | **Mới** |
| 47 | Thêm thành viên vào workspace | `WS-07` | Trùng — UC-03 của Phần 3 |
| 48 | Tổng quan workspace | `WS-08` | Gộp vào `WS-08` |
| 49 | Tạo project (kèm import dataset, thêm TV) | `PROJ-01`, `PROJ-13` | Trùng — UC-05 và UC-08 của Phần 3 |
| 50 | Import dataset | `PROJ-13` | Trùng — UC-08 của Phần 3, mục 3.2 / 3.25 / 3.31.2 |
| 51 | Lấy danh sách project trong workspace | `PROJ-02` | Gộp vào `PROJ-02` |
| 52 | Xóa Workspace | `WS-05` | Đã có trong code (`DELETE /workspaces/:id`, soft delete), chưa có mã |

**Kết luận về danh mục.** Sau khi đối chiếu, Phần 3 của tài liệu này có **56 tính năng mới** (v3: 56 — bỏ `PROJ-06`/`PROJ-07`/`PROJ-08` theo mục 3.40, thêm nhóm `FB-*` 6 tính năng theo mục 3.38b): 27 tính năng lõi của sản phẩm Data Quality (đã chốt ở v2, trừ `DATA-01` xoá dòng) và **56 tính năng mới** chia theo 7 nhóm: `AUTH-*` (13), `USER-*` (2), `ADMIN-*` (1), `WS-*` (10), `PROJ-*` (10), `NOTIF-*` (3), `ISSUE-*` (4), `FB-*` (6). Mã `AUTH-12` (làm mới access token) được bổ sung để phản ánh `POST /auth/refresh` đã có sẵn trong code.

**Các quyết định đã chốt trong đợt đối chiếu:**
- ~~**Lịch sử phiên bản project** (`PROJ-06` → `PROJ-08`): dùng lại module `versions` LEGACY~~ — **ĐÃ BỎ 2026-11-05.** Cả 3 tính năng bị gỡ cùng module `versions`; xem mục 3.32.1 và 3.40.
- **Tổng quan workspace**: gộp #41 và #48 thành một màn `WS-08`.
- **Danh sách project**: gộp #30 và #51 thành một `PROJ-02` có phân trang + tìm kiếm + lọc trạng thái + sắp xếp.
- **Vai trò Admin hệ thống**: giữ theo code hiện tại (`user.role: 'admin' | 'analyst'`), nằm **ngoài** phân cấp workspace/project. Phải cập nhật lại mô hình quyền ở Phần 6 — xem mục 3.34.1.
- **Lọc workspace theo vai trò**: chỉ có `Owner` và `Member` (không có `Viewer` ở cấp workspace) — bỏ "Viewer" khỏi yêu cầu #43.
- **Trạng thái project**: thêm trường mới `status` với 3 giá trị, tự cập nhật theo tiến độ — xem mục 3.36.1.
- **Ghi nhớ đăng nhập**: chỉ nhớ **email**, không lưu mật khẩu — xem `AUTH-04`.
- **Quên mật khẩu**: OTP 6 số qua email, hết hạn 10 phút, tối đa 5 lần gửi/giờ, tối đa 3 lần nhập sai — xem `AUTH-05`.
- **Thông báo**: chỉ từ sự kiện hệ thống; một công tắc bật/tắt chung — xem mục 3.37.
- **Báo cáo sự cố**: luồng đơn giản, Admin đổi trạng thái, trạng thái "Cần bổ sung" cho phép người dùng sửa và gửi lại; không có nội dung phản hồi — xem mục 3.38.
- **Admin xem hồ sơ người dùng**: chỉ đọc, không sửa, không xoá — xem `ADMIN-01`.

#### 3.32.1. ~~Hệ quả của việc tái sử dụng module `versions` LEGACY~~ — **ĐÃ BỎ (2026-11-05)**

> **Quyết định 2026-11-05:** Module `versions` bị **xoá hoàn toàn**, kéo theo việc gỡ 3 tính năng `PROJ-06`, `PROJ-07`, `PROJ-08`. Xem mục 3.40.
>
> **Lý do.** Cả ba tính năng này đều phục vụ mục đích **khôi phục hoặc so sánh trạng thái dữ liệu đã biến đổi**. Khi dữ liệu bất biến (mục 3.40), không có trạng thái dữ liệu nào để lịch sử hóa — mọi lần phân tích đều mô tả cùng một tập dữ liệu. Cơ chế snapshot Merkle, `diffVersions` và `rollbackVersion` trở nên vô nghĩa.
>
> **Gỡ bỏ cụ thể:**
>
> | Tính năng | Mã | Xử lý |
> |---|---|---|
> | Lịch sử hoạt động của project | `PROJ-06` | **Gỡ** |
> | Xem chi tiết lịch sử 1 hoạt động | `PROJ-07` | **Gỡ** |
> | Quay lại phiên bản của project | `PROJ-08` | **Gỡ** |
>
> **Thay thế bằng gì.** Audit log (mục 3.19, Phần 6) vẫn ghi lại **hoạt động của người dùng và thay đổi quyền** — đây là nhật ký hệ thống, không phải snapshot dữ liệu. Người dùng vẫn xem được "ai đã làm gì" nhưng không có "phiên bản dữ liệu" để quay lại.
>
> **Hệ quả:** UC-29 của Phần 3 (phiên bản dataset) và UC-30 (đồ thị lineage) chuyển sang **bị gỡ khỏi phạm vi nghiệm thu**; Phần 4 ghi nhận `versions` và `lineage` là module **bị xoá**, không phải LEGACY được giữ.

#### 3.32.2. Các tính năng trong file không nằm trong danh mục v2

File đầu vào bổ sung hai nhóm hoàn toàn mới mà Phần 2 v2 chưa có: **quản lý tài khoản/xác thực** (mục 3.33) và **thông báo + báo cáo sự cố** (mục 3.37, 3.38). Hai nhóm này mở rộng bề mặt sản phẩm đáng kể:

- Chúng **không** phục vụ trực tiếp mục tiêu phân tích chất lượng dữ liệu.
- Chúng đòi hỏi **hạ tầng mới**: dịch vụ gửi email (cho OTP và thông báo), OAuth của Google, cơ chế phân phối thông báo.
- Chúng làm thay đổi mô hình quyền (thêm vai trò Admin hệ thống).

Vì vậy các nhóm này được đánh dấu ưu tiên **Could** hoặc **Should** (xem từng mục) và tách riêng khỏi phạm vi lõi Data Quality, để việc hoàn thành backend lõi không bị phụ thuộc vào hạ tầng email/OAuth.

### 3.33. Nhóm xác thực và phiên đăng nhập — `AUTH-*`

**Bối cảnh.** Module `auth` và `users` đã tồn tại và hoạt động: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `GET /users/me`, `PATCH /users/me`, `DELETE /users/me`. Schema `user` có sẵn `password_reset_token_hash`, `password_reset_expires_at`, `google_id` (unique, sparse) và `status: 'active' | 'blocked'`. Schema `user_session` có `device_name`, `ip_address`, `user_agent`, `is_revoked`, TTL 7 ngày.

Nhóm này **không thuộc phạm vi lõi Data Quality** nhưng là tiền đề để hệ thống dùng được. Vì vậy các tính năng ở đây được ưu tiên **Should** trừ `AUTH-01`, `AUTH-02`, `AUTH-08`, `AUTH-11` đã có sẵn nên là **Must** (giữ nguyên hành vi hiện tại).

#### AUTH-01. Đăng ký tài khoản

- **Mô tả chuẩn hoá:** Tạo tài khoản mới bằng email + mật khẩu, kèm họ tên. Tài khoản mặc định có vai trò hệ thống `analyst` và trạng thái `active`.
- **Phạm vi:** Email + mật khẩu + họ + tên. Không có xác minh email bắt buộc trong đợt này. Không cho người dùng tự chọn `admin` — vai trò `admin` chỉ do quản trị viên cấp.
- **Quy tắc nghiệp vụ:** Email phải hợp lệ và chưa tồn tại (unique, lowercase, trim). Mật khẩu theo `PasswordSchema` hiện có. Tự động gửi thông báo chào mừng (nếu `NOTIF-01` đã bật).
- **Module:** `auth` + `users`. **Phụ thuộc:** không.
- **Rủi ro:** Không xác minh email nghĩa là người khác có thể đăng ký hộm email. Đề xuất: đặt trạng thái `pending_verification` nếu bật xác minh email về sau.
- **Ưu tiên:** **Must** (đã có).
- **Trùng với:** `POST /auth/register` hiện có. Yêu cầu cho phép `role` trong DTO đăng ký (`register.dto.ts` dòng 17) — cần bỏ khả năng tự chọn `admin`.

#### AUTH-02. Đăng nhập bằng email và mật khẩu

- **Mô tả chuẩn hoá:** Xác thực email + mật khẩu, trả access token (JWT, ngắn hạn) + refresh token (dài hạn, lưu dạng hash), kèm thông tin người dùng.
- **Phạm vi:** Không giới hạn số lần thử trong DTO; giới hạn chống dò mật khẩu phải ở tầng hạ tầng (`AUTH-13`).
- **Quy tắc nghiệp vụ:** Tài khoản `status: 'blocked'` bị từ chối đăng nhập. Đăng nhập tạo một `user_session` mới ghi `device_name`, `ip_address`, `user_agent`.
- **Module:** `auth`. **Phụ thuộc:** `users`.
- **Rủi ro:** Không có rate limit → nguy cơ dò mật khẩu. Xem `AUTH-13`.
- **Ưu tiên:** **Must** (đã có).

#### AUTH-03. Đăng nhập bằng Google

- **Mô tả chuẩn hoá:** Đăng nhập/đăng ký liền mạch qua Google OAuth 2.0 (Authorization Code + PKCE). Không cần tạo mật khẩu.
- **Phạm vi:** Chỉ dùng Google. Không thêm Microsoft/Apple/GitHub trong đợt này.
- **Quy tắc nghiệp vụ:**
  - Nếu `google_id` chưa gắn với tài khoản nào → tạo tài khoản mới với `google_id`, `email` lấy từ Google (email phải được xác minh bởi Google — dùng `email_verified` của claims), `first_name`/`last_name` từ profile.
  - Nếu `google_id` đã gắn → đăng nhập tài khoản đó, **không** hỏi mật khẩu.
  - Nếu email đã tồn tại nhưng `google_id` chưa gắn → yêu cầu người dùng đăng nhập bằng mật khẩu rồi liên kết, **không** tự gắn (tránh chiếm đoạt tài khoản).
  - Không dùng `google_id` làm định danh duy nhất — khóa theo `google_id` (đã unique sparse) và kiểm tra `status`.
- **Module:** `auth` (adapter OAuth). **Phụ thuộc:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`; cần thư viện client OAuth hoặc gọi trực tiếp endpoint token của Google.
- **Rủi ro:** Cần HTTPS cho redirect URI. Token Google có thể dài hơn hạn mặc định → phải có refresh token hoặc chấp nhận đăng nhập lại. Rủi ro đáng kể nhất là **chiếm đoạt tài khoản** nếu liên kết tự động — đã chặn ở quy tắc thứ ba.
- **Ưu tiên:** **Could** — cần hạ tầng OAuth và biến môi trường mới; không chặn các tính năng lõi.
- **Trùng với:** không có.

#### AUTH-04. Ghi nhớ đăng nhập

- **Mô tả chuẩn hoá:** Ghi nhớ email đã dùng để đăng nhập để lần sau không phải nhập lại. **Không lưu mật khẩu.**
- **Phạm vi:** Chỉ ghi nhớ **email** ở phía client (localStorage/cookie). Backend **không** nhận và **không** lưu mật khẩu dạng rõ, dạng mã hoa yếu hay dạng có thể khôi phục.
- **Quy tắc nghiệp vụ:** Gợi ý email dựa trên lần đăng nhập gần nhất **của chính người dùng** trên thiết bị đó; không suy ra từ dữ liệu trình duyệt khác. Ô mật khẩu không bao giờ được điền sẵn.
- **Module:** `auth` (không có thay đổi backend bắt buộc). **Phụ thuộc:** không.
- **Rủi ro:** Yêu cầu gốc trong file là "ghi nhớ email **và password**". Đã thu hẹp theo quyết định: lưu mật khẩu phía server tạo kho mật khẩu và biến mất tính năng này thành hỗ trợ đăng nhập không mật khẩu — sai bản chất. Trình duyệt đã có autofill mật khẩu, đáp ứng đúng nhu cầu người dùng mà không tạo rủi ro.
- **Ưu tiên:** **Could**.
- **Trùng với:** không có.

#### AUTH-05. Quên mật khẩu (gửi OTP)

- **Mô tả chuẩn hoá:** Người dùng nhập email → hệ thống gửi mã OTP 6 chữ số qua email, dùng để đặt lại mật khẩu.
- **Phạm vi:** Chỉ gửi qua **email**. Không SMS, không OTP qua ứng dụng.
- **Quy tắc nghiệp vụ:**
  - OTP gồm 6 chữ số, hết hạn sau **10 phút**, lưu dạng hash cùng `password_reset_expires_at` (trường đã có trong schema `user`).
  - Tối đa **5 lần gửi** trong 1 giờ cho cùng một email.
  - Tối đa **3 lần nhập sai** → vô hiệu hoá OTP hiện tại, yêu cầu gửi lại.
  - Gửi lại OTP mới **vô hiệu hoá** OTP cũ.
  - Phản hồi cho API **luôn giống nhau** kể cả khi email không tồn tại — không tiết lộ email nào đã có tài khoản.
  - Tài khoản `blocked` không được gửi OTP.
- **Module:** `auth` + port `Notification`/`EmailSender`. **Phụ thuộc:** dịch vụ gửi email (mục 3.37.3).
- **Rủi ro:** Nếu không có dịch vụ email, tính năng không dùng được → cần adapter fail an toàn và thông báo rõ. Gửi email cho email không tồn tại có thể bị dùng để dò email nếu phản hồi khác nhau — đã chặn ở quy tắc thứ năm.
- **Ưu tiên:** **Should**.
- **Trùng với:** DTO `ForgotPasswordSchema` đã có trong `password-reset.dto.ts` nhưng **chưa có endpoint** và **chưa có** trường OTP.

#### AUTH-06. Đặt lại mật khẩu bằng OTP

- **Mô tả chuẩn hoá:** Người dùng nhập OTP hợp lệ + mật khẩu mới → hệ thống đổi mật khẩu, vô hiệu hoá OTP, **thu hồi toàn bộ phiên đăng nhập** đang hoạt động.
- **Quy tắc nghiệp vụ:** OTP phải khớp email đã gửi, chưa hết hạn, chưa vượt 3 lần nhập sai. Mật khẩu mới theo `PasswordSchema`. Sau khi đổi: xoá `password_reset_token_hash`, đặt `password_reset_expires_at = null`, revoke tất cả `user_session` chưa revoked.
- **Module:** `auth`. **Phụ thuộc:** `AUTH-05`, `users`.
- **Rủi ro:** Nếu không revoke phiên cũ, kẻ đã chiếm phiên vẫn truy cập được. Đây là điểm bắt buộc, không phải tuỳ chọn.
- **Ưu tiên:** **Should**.
- **Trùng với:** `ResetPasswordSchema` đã có nhưng dùng `token` chứ không dùng OTP — cần thống nhất tên trường và cơ chế.

#### AUTH-07. Thay đổi mật khẩu

- **Mô tả chuẩn hoá:** Người dùng đã đăng nhập nhập mật khẩu hiện tại + mật khẩu mới (2 lần xác nhận khớp) → đổi mật khẩu.
- **Quy tắc nghiệp vụ:** Xác minh mật khẩu hiện tại. Hai lần nhập mật khẩu mới phải khớp. Mật khẩu mới phải khác mật khẩu hiện tại. Sau khi đổi: **giữ phiên hiện tại** (người dùng không bị đăng xuất) nhưng **thu hồi các phiên khác**.
- **Module:** `auth`. **Phụ thuộc:** không.
- **Rủi ro:** Cho phép đổi mật khẩu mà không xác minh mật khẩu hiện tại sẽ biến phiên bị chiếm đoạt thành công cưỡng ép đổi mật khẩu.
- **Ưu tiên:** **Should**.
- **Trùng với:** không có.

#### AUTH-08. Xem phiên đăng nhập

- **Mô tả chuẩn hoá:** Liệt kê toàn bộ phiên đăng nhập của tài khoản hiện tại: thiết bị, IP, user agent, thời điểm tạo, thời điểm hết hạn, trạng thái.
- **Phạm vi:** Chỉ phiên của chính người gọi. Không có endpoint xem phiên của người khác (kể cả Admin — xem `ADMIN-01`).
- **Quy tắc nghiệp vụ:** Trả cả phiên đã revoked (lịch sử) và đang hoạt động, kèm cờ phân biệt. Đánh dấu rõ phiên của thiết bị hiện tại.
- **Module:** `auth` + `users`. **Phụ thuộc:** không.
- **Rủi ro:** `refresh_token_hash` phải tiếp tục `select: false` — không được lộ trong response. `ip_address` là dữ liệu cá nhân → phải thuộc phạm vi che PII khi gửi ra ngoài (không gửi ra ngoài trong đợt này).
- **Ưu tiên:** **Must** (đã có `GET /auth/sessions`).
- **Trùng với:** `GET /auth/sessions` hiện có.

#### AUTH-09. Xem chi tiết phiên đăng nhập

- **Mô tả chuẩn hoá:** Xem chi tiết một phiên đăng nhập cụ thể của chính người gọi.
- **Quy tắc nghiệp vụ:** Chỉ truy cập được phiên thuộc `user_id` của người gọi; trả `NOT_FOUND` nếu không thuộc.
- **Module:** `auth`. **Phụ thuộc:** `AUTH-08`.
- **Rủi ro:** Bảo đảm `refresh_token_hash` không bao giờ được serialize.
- **Ưu tiên:** **Should** — hiện có `revokeSession` nhưng chưa có đọc chi tiết.
- **Trùng với:** không có.

#### AUTH-10. Đăng xuất khỏi thiết bị khác

- **Mô tả chuẩn hoá:** Người dùng chọn một phiên và đăng xuất phiên đó.
- **Quy tắc nghiệp vụ:** Chỉ revoke được phiên thuộc chính mình. Nếu phiên đã revoked → trả trạng thái idempotent kèm thông báo "phiên đã đăng xuất", không phải lỗi.
- **Module:** `auth`. **Phụ thuộc:** `AUTH-08`.
- **Ưu tiên:** **Must** (đã có `DELETE /auth/sessions/:id`).
- **Trùng với:** endpoint hiện có.

#### AUTH-11. Đăng xuất ở thiết bị hiện tại

- **Mô tả chuẩn hoá:** Đăng xuất phiên của thiết bị đang dùng, vô hiệu hoá refresh token.
- **Quy tắc nghiệp vụ:** Access token hiện tại vẫn còn hiệu lực cho tới hết hạn (JWT không thể thu hồi) → client phải xoá token ở client. Ghi `is_revoked = true` và `revoked_at` cho phiên.
- **Module:** `auth`. **Phụ thuộc:** không.
- **Ưu tiên:** **Must** (đã có `POST /auth/logout`).
- **Trùng với:** endpoint hiện có.

#### AUTH-12. Làm mới access token

- **Mô tả chuẩn hoá:** Đổi refresh token còn hiệu lực lấy access token mới và refresh token mới (rotation).
- **Quy tắc nghiệp vụ:** Refresh token phải khớp hash trong session, session chưa revoked, chưa hết hạn. Khi rotation: session cũ bị revoked và tạo session mới → phát hiện được tái sử dụng refresh token cũ (reuse detection), khi đó **thu hồi toàn bộ phiên** của user.
- **Module:** `auth`. **Phụ thuộc:** `users`.
- **Rủi ro:** Rotation + reuse detection là chống trộm token; nếu bỏ reuse detection thì refresh token bị lộ vẫn dùng được mãi.
- **Ưu tiên:** **Must** (đã có `POST /auth/refresh`).
- **Trùng với:** endpoint hiện có.

#### AUTH-13. Chính sách chống dò mật khẩu và OTP

- **Mô tả chuẩn hoá:** Giới hạn tần suất thao tác nhạy cảm ở tầng hạ tầng.
- **Quy tắc nghiệp vụ:**
  - Đăng nhập sai: tối đa 5 lần/giờ/IP+email; quá ngưỡng → `LIMIT_EXCEEDED` kèm thời gian chờ.
  - Gửi OTP: tối đa 5 lần/giờ/email (đã nêu ở `AUTH-05`).
  - Nhập OTP sai: tối đa 3 lần (đã nêu ở `AUTH-05`).
  - Đổi mật khẩu: tối đa 5 lần/giờ.
- **Module:** `auth` + hạ tầng rate-limit. **Phụ thuộc:** cơ chế lưu đếm (in-memory theo instance, hoặc MongoDB nếu chạy nhiều instance).
- **Rủi ro:** Rate-limit in-memory không hiệu quả khi scale nhiều instance — cần ghi rõ trong Phần 10 (vận hành).
- **Ưu tiên:** **Must** — không có tính năng này thì `AUTH-05`/`AUTH-06` không an toàn.
- **Trùng với:** không có.

### 3.34. Nhóm hồ sơ người dùng và quản trị — `USER-*`, `ADMIN-*`

#### USER-01. Xem hồ sơ cá nhân

- **Mô tả chuẩn hoá:** Trả thông tin hồ sơ của chính người gọi: ảnh đại diện, họ tên, email, vai trò hệ thống, số điện thoại, giới thiệu.
- **Phạm vi:** Chỉ hồ sơ của chính người gọi. Không có tham số `user_id` để xem người khác.
- **Quy tắc nghiệp vụ:** Không trả `password_hash`, `password_reset_token_hash`, `google_id` ra ngoài. Không trả `deleted_at` của người khác.
- **Module:** `users`. **Phụ thuộc:** `auth`.
- **Rủi ro:** Schema `user` hiện chưa có `phone` và `bio` → cần bổ sung 2 trường.
- **Ưu tiên:** **Must** (đã có `GET /users/me`).
- **Trùng với:** endpoint hiện có.

#### USER-02. Cập nhật hồ sơ cá nhân

- **Mô tả chuẩn hoá:** Cập nhật ảnh đại diạn, họ tên, số điện thoại, giới thiệu.
- **Phạm vi:** **Không** cho cập nhật `role` và `status` qua endpoint này — vai trò hệ thống chỉ do Admin cấp, trạng thái do hệ thống quản lý.
- **Quy tắc nghiệp vụ:** Email **không** tự sửa ở đây (đổi email cần xác minh mới, chưa có trong phạm vi). `first_name`/`last_name` giữ ràng buộc 1–50 ký tự.
- **Module:** `users`. **Phụ thuộc:** `USER-01`.
- **Rủi ro:** `UpdateUserSchema` hiện có (`update-user.dto.ts`) — cần kiểm tra để bảo đảm không cho sửa `role`/`status`.
- **Ưu tiên:** **Must** (đã có `PATCH /users/me`).
- **Trùng với:** endpoint hiện có.

#### ADMIN-01. Xem hồ sơ người dùng (chỉ đọc)

- **Mô tả chuẩn hoá:** Admin xem danh sách và hồ sơ chi tiết của mọi tài khoản trong hệ thống.
- **Phạm vi:** **Chỉ đọc.** Admin không sửa hồ sơ người khác, không khóa/mở khóa tài khoản, không xoá tài khoản, không xem phiên đăng nhập của người khác.
- **Quy tắc nghiệp vụ:** Danh sách có phân trang, tìm kiếm theo tên/email, lọc theo `role` và `status`. Chi tiết trừ các trường nhạy cảm (`password_hash`, `password_reset_token_hash`). Mọi lần truy cập danh sách hồ sơ người dùng **phải được ghi log** (ai, lúc nào, lọc gì).
- **Phạm vi audit log của đợt này:** chỉ ghi log cho **hành động nhạy cảm mới**, không thiết kế module audit đầy đủ (quyết định v3 / 2026-11-05). Danh sách hành động bắt buộc ghi log: (1) Admin duyệt/đổi trạng thái báo cáo sự cố (`ISSUE-04`); (2) Admin xem danh sách hoặc chi tiết hồ sơ người dùng (`ADMIN-01`); (3) thay đổi vai trò thành viên workspace/project (`WS-09`, `PROJ-10`, `PROJ-11`); (4) nhượng quyền Owner (`WS-09`, `PROJ-11`). Mỗi bản ghi gồm `actor_id`, `action`, `target`, `timestamp`.
- **Module:** `users` (hoặc module `admin` riêng). **Phụ thuộc:** vai trò `admin` (mục 3.34.1).
- **Rủi ro:** Đây là tính năng có rủi ro lạm dụng cao nhất trong nhóm. Giới hạn "chỉ đọc" và bắt buộc ghi log là hai biện pháp bắt buộc, không phải tuỳ chọn. Không được cho Admin xem `email` của người dùng khác workspace? — Vì mô hình đã chốt là **Admin hệ thống toàn cục**, không gắn với workspace, nên không thể áp quy tắc "chỉ trong workspace" cho Admin; phải bù lại bằng audit log và bằng việc Admin **không** được xem nội dung dữ liệu của workspace.
- **Ưu tiên:** **Should**.
- **Trùng với:** không có.

#### 3.34.1. Vai trò `admin` hệ thống trong mô hình quyền

Mô hình quyền đã chốt ở Phần 6 v2 chỉ có 4 vai trò nghiệp vụ và **không có** vai trò hệ thống. Code hiện tại lại có `user.role: 'admin' | 'analyst'` và CASL đã xử lý `role === 'admin'` → `can(Action.Manage, 'all')`.

Quyết định: **giữ vai trò `admin` hệ thống**, nằm ngoài phân cấp workspace/project, với 2 tính năng duy nhất: `ISSUE-04` (duyệt báo cáo sự cố) và `ADMIN-01` (xem hồ sơ người dùng).

**Quy tắc giới hạn bắt buộc để "toàn quyền" của Admin không phá vỡ mô hình đã chốt:**
1. Admin **không** được đọc nội dung dữ liệu, dataset, kết quả phân tích hay báo cáo của bất kỳ project nào. Admin không phải thành viên workspace.
2. Admin **không** tạo được project và **không** được import dataset (quyền import thuộc `WS-OWNER`/`PROJ-OWNER`).
3. Admin **không** đăng nhập được vào workspace với vai trò nào.
4. Việc cấp vai trò `admin` phải do thao tác trực tiếp trên database hoặc bởi Admin đã có (bootstrap) — **không** có endpoint API công khai để tự phong admin. Nếu không, bất kỳ tài khoản nào cũng có thể leo thang.
5. Mọi hành động của Admin phải ghi log có `actor_id`, `action`, `target`, `timestamp`.

**Hệ quả cần đồng bộ:** Phần 6 (mô hình quyền) phải được nâng lên v3 để thêm vai trò này; Phần 4 (ranh giới module) phải xác định `admin` thuộc module `users` hay module riêng.

### 3.35. Nhóm quản lý Workspace — `WS-*`

Module `workspaces` đã có: `POST /workspaces`, `GET /workspaces`, `GET /workspaces/:id`, `PATCH /workspaces/:id`, `DELETE /workspaces/:id`, `POST /workspaces/:id/members`, `DELETE /workspaces/:id/members/:userId`. Schema `workspace` hiện có `name`, `description`, `owner_id`, `members[]` (mỗi phần tử: `user_id`, `role: 'owner'|'editor'|'viewer'`, `joined_at`), `deleted_at`.

**Sai lệch cần sửa:** `members[].role` đang dùng `owner | editor | viewer` (mô hình CASL cũ) — phải đổi sang `owner | member` theo mô hình đã chốt ở Phần 6.

#### WS-01. Tạo Workspace

- **Mô tả chuẩn hoá:** Tạo workspace mới kèm tên, mô tả và danh sách email thành viên được mời.
- **Quy tắc nghiệp vụ:** Người tạo là Workspace Owner duy nhất. Thành viên được mời trở thành `member` (mặc định `PROJ-VIEWER` trong mọi project). Nếu email chưa có tài khoản → gửi lời mời (cần `EMAIL`).
- **Trùng với:** UC-01 và UC-03 của Phần 3; `POST /workspaces` hiện có nhưng chưa có phần mời email.
- **Module:** `workspaces`. **Phụ thuộc:** `users`, `EMAIL` (cho lời mời).
- **Ưu tiên:** **Must** (đã có phần lõi).

#### WS-02. Lấy danh sách Workspace

- **Mô tả chuẩn hoá:** Liệt kê workspace người gọi tham gia, có phân trang, tìm kiếm, lọc theo vai trò và sắp xếp.
- **Quy tắc nghiệp vụ:**
  - Phân trang offset, mặc định 15 item/trang.
  - Tìm kiếm theo tên workspace (không phân biệt hoa/thường, chứa).
  - Lọc theo vai trò: `Owner` | `Member`. **Không có `Viewer`** ở cấp workspace — yêu cầu gốc (#43) có "Viewer" nhưng mô hình đã chốt không có vai trò này; đã sửa theo quyết định.
  - Sắp xếp: truy cập gần nhất (mặc định), tham gia gần nhất, cập nhật gần nhất, tên A→Z, tên Z→A.
- **Phạm vi:** Chỉ workspace mà người gọi là thành viên. Workspace đã soft-delete không hiển thị.
- **Module:** `workspaces`. **Phụ thuộc:** không.
- **Rủi ro:** "Truy cập gần nhất" đòi hỏi ghi nhận thời điểm truy cập cuối → cần trường `last_accessed_at` trên workspace hoặc bảng riêng.
- **Ưu tiên:** **Must**.
- **Trùng với:** `GET /workspaces` hiện có nhưng chưa phân trang/tìm kiếm/lọc/sắp xếp.

#### WS-03. Chi tiết Workspace

- **Mô tả chuẩn hoá:** Trả tên, mô tả, người tạo, ngày tạo, cập nhật gần nhất, số lượng thành viên, số lượng project.
- **Quy tắc nghiệp vụ:** Chỉ thành viên của workspace được xem.
- **Module:** `workspaces`. **Phụ thuộc:** `projects` (đếm số project).
- **Ưu tiên:** **Must** (đã có `GET /workspaces/:id`).

#### WS-04. Cập nhật thông tin Workspace

- **Mô tả chuẩn hoá:** Workspace Owner cập nhật tên và mô tả.
- **Quy tắc nghiệp vụ:** Chỉ `WS-OWNER`. Không ảnh hưởng project và bản lưu bên trong.
- **Trùng với:** UC-02 của Phần 3; `PATCH /workspaces/:id` hiện có.
- **Module:** `workspaces`. **Phụ thuộc:** không.
- **Ưu tiên:** **Must** (đã có).

#### WS-05. Xóa Workspace

- **Mô tả chuẩn hoá:** Soft delete workspace.
- **Quy tắc nghiệp vụ:** Chỉ `WS-OWNER`. Soft delete: đặt `deleted_at`. Workspace đã xoá không hiển thị trong danh sách và không truy cập được; dữ liệu bên trong giữ nguyên để khôi phục.
- **Quy tắc bổ sung cần chốt:** có xoá mềm cả project bên trong hay không? Đề xuất: **không** — mỗi project có `deleted_at` riêng, xoá workspace không kéo theo.
- **Module:** `workspaces`. **Phụ thuộc:** không.
- **Ưu tiên:** **Must** (đã có `DELETE /workspaces/:id`).
- **Trùng với:** endpoint hiện có.

#### WS-06. Danh sách thành viên Workspace

- **Mô tả chuẩn hoá:** Liệt kê thành viên workspace: tên, email, vai trò, ngày tham gia; có tìm kiếm và lọc theo vai trò.
- **Quy tắc nghiệp vụ:** Phân trang offset. Tìm kiếm theo tên hoặc email. Lọc theo vai trò `Owner | Member`. Không hiển thị trường nhạy cảm.
- **Quyền:** `WS-OWNER` và `WS-MEMBER` đều xem được (quyết định v3 / 2026-11-05: WS-MEMBER có quyền **đọc** ở cấp workspace — xem thông tin workspace, danh sách thành viên, tổng quan và danh sách project; không sửa workspace, không xem/đổi vai trò thành viên).
- **Module:** `workspaces`. **Phụ thuộc:** `users`.
- **Ưu tiên:** **Must**.
- **Trùng với:** chưa có endpoint danh sách thành viên (hiện chỉ có thêm/xoá).

#### WS-07. Thêm thành viên Workspace

- **Mô tả chuẩn hoá:** Workspace Owner thêm thành viên bằng email.
- **Quy tắc nghiệp vụ:** Chỉ `WS-OWNER`. Thành viên mới có vai trò `member` ở workspace và mặc định là `PROJ-VIEWER` trong mọi project của workspace. Nếu email chưa có tài khoản → gửi lời mời.
- **Trùng với:** UC-03 của Phần 3; `POST /workspaces/:id/members` hiện có.
- **Module:** `workspaces`. **Phụ thuộc:** `users`, `EMAIL`.
- **Ưu tiên:** **Must** (đã có).

#### WS-08. Tổng quan Workspace

- **Mô tả chuẩn hoá:** Màn tổng quan gộp hai yêu cầu #41 và #48, gồm: 5 chỉ số tổng quan (tổng workspace, tổng project, số workspace sở hữu, số workspace được chia sẻ, và chỉ số thứ 5 cần chốt) **và** thống kê project theo trạng thái (chưa xử lý / đang xử lý / đã xử lý).
- **Quy tắc nghiệp vụ:** Tính trên các workspace người gọi tham gia. Trạng thái project dùng trường `status` mới (mục 3.36.1).
- **Chỉ số thứ 5:** yêu cầu gốc nêu "5 chỉ số" nhưng chỉ liệt kê 4. Đề xuất chọn **"tổng số báo cáo sự cố đang mở của tôi"** — cần người dùng xác nhận.
- **Module:** `workspaces` + `projects`. **Phụ thuộc:** `projects`, `ISSUE`.
- **Rủi ro:** Truy vấn tổng hợp trên nhiều workspace có thể chậm → cần index phù hợp, ghi vào Phần 8.
- **Ưu tiên:** **Should**.
- **Trùng với:** gộp #41 + #48.

#### WS-09. Nhượng quyền Workspace Owner

- **Mô tả chuẩn hoá:** Workspace Owner chuyển quyền Owner cho một Member còn lại.
- **Quy tắc nghiệp vụ:** Chỉ `WS-OWNER` hiện tại. Không thể nhượng cho chính mình. Không thể nhượng cho người không phải thành viên workspace. Sau khi nhượng: người nhận thành Owner, người cũ thành `member` và **giữ nguyên vai trò project đang có** — nếu người cũ là `PROJ-OWNER` của project nào thì vẫn là `PROJ-OWNER` của project đó (quyết định v3 / 2026-11-05). Đây là khác biệt quan trọng với người **rời** workspace (`WS-10`), người rời mất toàn bộ quyền project.
- **Quyền của Workspace Owner với project sau khi nhượng:** người nhận quyền Owner kế thừa toàn quyền quản trị với mọi project trong workspace (quy tắc đã chốt ở Phần 6: Workspace Owner có toàn quyền với mọi project trong workspace).
- **Trùng với:** điều kiện tiền đề của UC-07 (rời workspace) trong Phần 3.
- **Module:** `workspaces`. **Phụ thuộc:** không.
- **Rủi ro:** Phải là giao dịch nguyên tử — không để workspace có 0 Owner hoặc 2 Owner.
- **Ưu tiên:** **Must** — điều kiện tiền đề của rời workspace.

#### WS-10. Rời Workspace

- **Mô tả chuẩn hoá:** Thành viên tự rời workspace; Workspace Owner phải nhượng quyền trước.
- **Quy tắc nghiệp vụ:** Mất toàn bộ quyền truy cập các project của workspace. Nếu đang là Project Owner → Workspace Owner tiếp quản.
- **Trùng với:** UC-07 của Phần 3.
- **Module:** `workspaces`. **Phụ thuộc:** `WS-09`.
- **Ưu tiên:** **Must**.

### 3.36. Nhóm quản lý Project — `PROJ-*`

Module `projects` đã có: `POST /workspaces/:workspaceId/projects`, `GET /workspaces/:workspaceId/projects`, `GET /projects/:id`, `PATCH /projects/:id`, `DELETE /projects/:id`. Schema `project` hiện có `workspace_id`, `name`, `description`, `has_dataset`, `created_by`, `deleted_at`.

#### PROJ-01. Tạo Project

- **Mô tả chuẩn hoá:** Tạo project trong workspace, có thể kèm import dataset và thêm thành viên có sẵn trong workspace.
- **Quy tắc nghiệp vụ:** Chỉ `WS-OWNER` tạo project và chỉ định `Project Owner` (mặc định chính Workspace Owner làm Project Owner). Tên project duy nhất trong workspace. Mỗi project chỉ chứa **một** file dữ liệu và **không** cho thay thế file (mục 3.2).
- **Trùng với:** UC-05 của Phần 3; `POST /workspaces/:workspaceId/projects` hiện có.
- **Module:** `projects` (+ `datasets` nếu kèm import). **Phụ thuộc:** `workspaces`, `datasets`.
- **Ưu tiên:** **Must** (đã có phần lõi).

#### PROJ-02. Danh sách Project

- **Mô tả chuẩn hoá:** Liệt kê project theo workspace (hoặc project của tôi), có phân trang, tìm kiếm, lọc theo trạng thái và sắp xếp.
- **Quy tắc nghiệp vụ:**
  - Phân trang offset, mặc định 15 item/trang.
  - Tìm kiếm theo tên project.
  - Lọc theo `status`: `not_started` | `in_progress` | `completed`.
  - Sắp xếp: truy cập gần nhất (mặc định), tham gia gần nhất, cập nhật gần nhất, tên A→Z, tên Z→A.
- **Phạm vi:** Chỉ project người gọi có quyền xem. Hỗ trợ cả "project trong workspace X" và "tất cả project của tôi" (gộp #30 và #51 — hai yêu cầu chỉ khác phạm vi lọc, dùng chung bộ tham số).
- **Module:** `projects`. **Phụ thuộc:** `workspaces`.
- **Rủi ro:** Cần `last_accessed_at` và `status` trên project (mục 3.36.1).
- **Ưu tiên:** **Must**.

#### PROJ-03. Thông tin cơ bản Project

- **Mô tả chuẩn hoá:** Trả tên, mô tả, tên workspace, ngày tạo, cập nhật gần nhất, trạng thái, vai trò của người gọi trong project.
- **Quy tắc nghiệp vụ:** Kèm số dataset nếu có để frontend biết có thể vào Data Views hay không.
- **Module:** `projects`. **Phụ thuộc:** `workspaces`.
- **Ưu tiên:** **Must** (đã có `GET /projects/:id`).

#### PROJ-04. Cập nhật thông tin cơ bản Project

- **Mô tả chuẩn hoá:** Sửa tên và mô tả project.
- **Quy tắc nghiệp vụ:** `PROJ-OWNER` hoặc `WS-OWNER`. Không ảnh hưởng dataset hay bản lưu.
- **Trùng với:** `PATCH /projects/:id` hiện có.
- **Module:** `projects`. **Phụ thuộc:** không.
- **Ưu tiên:** **Must** (đã có).

#### PROJ-05. Xóa Project

- **Mô tả chuẩn hoá:** Soft delete project.
- **Quy tắc nghiệp vụ:** Chỉ `WS-OWNER` (yêu cầu gốc #28 nói rõ "Chỉ Workspace Owner mới được xóa project"). Đặt `deleted_at`. Không xoá dataset/bản lưu để khôi phục được.
- **Trùng với:** `DELETE /projects/:id` hiện có — nhưng CASL hiện cho phép `owner` (workspace) xoá; cần khớp với quy tắc mới.
- **Module:** `projects`. **Phụ thuộc:** không.
- **Ưu tiên:** **Must** (đã có).

#### PROJ-06. Lịch sử hoạt động của Project

- **Mô tả chuẩn hoá:** Liệt kê các phiên bản dataset của project, theo thời gian giảm dần, có phân trang.
- **Trạng thái 2026-11-05:** **Gỡ khỏi phạm vi sản phẩm** cùng module `versions` (mục 3.40). Không còn endpoint, không còn collection `dataset_version`.
- **Phạm vi:** Xem lịch sử dataset, **không** phải lịch sử bản lưu project (xem mục 3.32.1 để phân biệt).
- **Trùng với:** ~~`GET /datasets/:id/versions` của module `versions` LEGACY~~ — **đã xoá**.
- **Module:** ~~`versions`~~ — **Gỡ khỏi phạm vi sản phẩm 2026-11-05 (mục 3.40)**.
- **Trạng thái 2026-11-05:** Rủi ro trên **không còn tồn tại** — module `versions` bị xoá hoàn toàn, không kéo vào phạm vi giao hàng.
- **Ưu tiên:** **Should**.
- **Trùng với:** endpoint hiện có của module `versions`.

#### PROJ-07. Chi tiết một hoạt động của Project

- **Mô tả chuẩn hoá:** Xem chi tiết một phiên bản: ai tạo, nội dung thay đổi, thời điểm, số bản ghi.
- **Trạng thái 2026-11-05:** **Gỡ khỏi phạm vi sản phẩm** cùng module `versions` (mục 3.40). Không còn endpoint, không còn collection `dataset_version`.
- **Module:** ~~`versions`~~. **Phụ thuộc:** ~~`PROJ-06`~~ (cũng đã bị gỡ).
- **Ưu tiên:** ~~Should~~ — **không còn trong danh mục**.
- **Trùng với:** ~~endpoint hiện có~~ — đã xoá.

#### PROJ-08. Quay lại phiên bản của Project

- **Mô tả chuẩn hoá:** ~~Khôi phục dataset của project về một phiên bản đã chọn.~~
- **Trạng thái 2026-11-05:** **Gỡ khỏi phạm vi sản phẩm** cùng module `versions` (mục 3.40). Rollback là thao tác **ghi đè dữ liệu** — trái với nguyên tắc dữ liệu bất biến, nên bị loại bỏ hoàn toàn.
- **Ưu tiên:** ~~Should~~ — **không còn trong danh mục**.
- **Trùng với:** ~~`POST /datasets/:id/versions/:versionNumber/rollback`~~ — đã xoá.

#### PROJ-09. Tìm kiếm thành viên trong Project

- **Mô tả chuẩn hoá:** Tìm người có thể thêm vào project, theo tên hoặc email.
- **Quy tắc nghiệp vụ:** Chỉ tìm trong phạm vi **thành viên workspace** — không tìm toàn hệ thống. Không trả về người đã là thành viên project. Không lộ email của người không thuộc workspace.
- **Module:** `projects` + `workspaces`. **Phụ thuộc:** `users`.
- **Rủi ro:** Rò rỉ email người dùng ngoài workspace là lỗi riêng tư → bắt buộc lọc theo workspace trước khi trả về.
- **Ưu tiên:** **Must** — cần cho `PROJ-10`.

#### PROJ-10. Thay đổi quyền thành viên trong Project

- **Mô tả chuẩn hoá:** Nâng/hạ vai trò của một thành viên trong project: `Member` ↔ `Viewer`.
- **Quy tắc nghiệp vụ:** Chỉ `PROJ-OWNER` (và `WS-OWNER`). Nâng lên `Member` yêu cầu người đó là **thành viên workspace**. Hạ `Member` → `Viewer` giữ nguyên vai trò workspace (vẫn truy cập được project). Không hạ được `Owner` qua endpoint này.
- **Trùng với:** UC-06 của Phần 3.
- **Module:** `projects`. **Phụ thuộc:** `PROJ-09`.
- **Ưu tiên:** **Must**.

#### PROJ-11. Nhượng quyền Project Owner

- **Mô tả chuẩn hoá:** Project Owner chuyển quyền Owner cho thành viên khác; người nhượng trở thành `PROJ-MEMBER`.
- **Quy tắc nghiệp vụ:** Chỉ `PROJ-OWNER` (hoặc `WS-OWNER` tiếp quản). Giao dịch nguyên tử — mỗi project đúng một Owner. `WS-OWNER` vẫn giữ toàn quyền quản trị với project.
- **Trùng với:** UC-06 của Phần 3 (`transfer-owner`).
- **Module:** `projects`. **Phụ thuộc:** không.
- **Ưu tiên:** **Must**.

#### PROJ-12. Lưu trạng thái Project

- **Mô tả chuẩn hoá:** Lưu phiên bản làm việc của project tại phần Tổng kết.
- **Quy tắc nghiệp vụ:** Giữ nguyên toàn bộ quy tắc đã chốt ở mục 3.19: chỉ **một** bản lưu hiện hành; chặn ghi đè bản mới bằng thay đổi từ bản cũ (`CONFLICT`); file gốc giữ nguyên; nội dung gồm tên cột, tập cột phân tích, cột nhãn, kết quả phân tích, Tổng kết, bộ lọc/sắp xếp/tìm kiếm/trang.
- **Phạm vi:** `PROJ-12` **không** tạo version dataset — xem mục 3.32.1.
- **Trùng với:** mục 3.19 của tài liệu này; UC-25 của Phần 3.
- **Module:** `projects`. **Phụ thuộc:** `analysis`, `summary`.
- **Ưu tiên:** **Must**.

#### PROJ-13. Import Dataset vào Project

- **Mô tả chuẩn hoá:** Tải file dữ liệu lên hệ thống và gắn vào project.
- **Quy tắc nghiệp vụ:** Giữ nguyên toàn bộ quy tắc ở mục 3.2, 3.25, 3.26, 3.31.2: **chỉ `.csv`** (v5); 50 MB/file, 500 MB/workspace; kiểm tra tên cột **toàn bộ cột** và **chặn phân tích** cho tới khi hết lỗi tên cột; lưu file gốc trên R2 với extension `.csv`; dọn file tạm khi thất bại; mỗi project chỉ có một dataset, không cho thay thế file.
- **Quyền:** `WS-OWNER` và `PROJ-OWNER` (quyết định đã chốt — `PROJ-MEMBER` không được import).
- **Trùng với:** UC-08 của Phần 3; `POST /projects/:projectId/datasets/upload` hiện có.
- **Module:** `datasets` + port Storage. **Phụ thuộc:** `PROJ-01`.
- **Ưu tiên:** **Must** (đã có phần lõi; **v5** chỉ còn đọc CSV streaming).

#### 3.36.1. Trường trạng thái Project

Yêu cầu #48 và #51 cần lọc project theo trạng thái "chưa xử lý / đang xử lý / đã xử lý", nhưng schema `project` hiện chỉ có `has_dataset: boolean`.

**Quyết định:** thêm trường `status` với 3 giá trị và cơ chế cập nhật tự động:

| Giá trị | Điều kiện | Cập nhật bởi |
|---|---|---|
| `not_started` | Chưa import dataset | Hệ thống, khi tạo project |
| `in_progress` | Đã import dataset nhưng chưa có kết quả phân tích đã lưu | Hệ thống, khi import xong / khi phân tích chạy |
| `completed` | Đã có kết quả phân tích đã lưu (bản lưu hiện hành) | Hệ thống, khi lưu project thành công |

**Quy tắc bổ sung:**
1. Trạng thái là **dẫn xuất từ sự kiện hệ thống**, người dùng **không** tự đánh dấu — tránh trạng thái sai lệch với dữ liệu thật.
2. Xoá dataset (nếu có) → trở về `not_started`.
3. Rollback dataset (`PROJ-08`) → phải hạ `completed` về `in_progress` nếu kết quả phân tích đã lưu trở thành stale.
4. Trường `has_dataset` hiện tại **được bỏ** — suy ra từ `status !== 'not_started'` (quyết định v3 / 2026-11-05). Một nguồn sự thật duy nhất, tránh phải đồng bộ hai trường. Code hiện tại đọc `has_dataset` ở `projects.service.ts` (`setHasDataset`) phải được chuyển sang dùng `status`.
5. Trạng thái phải hiển thị rõ trong `PROJ-02` và `PROJ-03`.

### 3.37. Nhóm thông báo — `NOTIF-*`

**Quyết định đã chốt:** thông báo **chỉ phát sinh từ sự kiện hệ thống**; một công tắc bật/tắt **chung** cho mọi loại thông báo.

#### NOTIF-01. Trung tâm thông báo

- **Mô tả chuẩn hoá:** Xem danh sách thông báo của người gọi, gộp 4 yêu cầu #8–#11: 5 thông báo mới nhất, tất cả thông báo, thông báo chưa đọc, thông báo đã đọc.
- **Quy tắc nghiệp vụ:**
  - Phân trang offset, mặc định 10 item/trang (theo yêu cầu gốc).
  - Bộ lọc `read: true | false | all` (mặc định `all`), `limit` cho "5 mới nhất".
  - Sắp xếp giảm dần theo thời điểm tạo.
  - Mỗi dòng: tiêu đề, nội dung tóm tắt, loại thông báo, trạng thái đã đọc, thời gian, liên kết tới đối tượng liên quan (project/báo cáo).
  - Trả về **số thông báo chưa đọc** kèm mọi lần gọi để frontend hiển thị badge.
- **Phạm vi:** Chỉ thông báo của chính người gọi.
- **Module:** `notifications` (module mới). **Phụ thuộc:** `auth`.
- **Rủi ro:** Số lượng thông báo tích luỹ → cần chính sách giữ lại (giữ N ngày hoặc tối đa M bản ghi) và TTL index.
- **Ưu tiên:** **Should**.
- **Trùng với:** không có.

#### NOTIF-02. Chi tiết thông báo

- **Mô tả chuẩn hoá:** Xem nội dung đầy đủ của một thông báo và đánh dấu đã đọc.
- **Quy tắc nghiệp vụ:** Truy cập thông báo của người khác → `NOT_FOUND`. Mở chi tiết đánh dấu `read_at` nếu chưa đọc.
- **Module:** `notifications`. **Phụ thuộc:** `NOTIF-01`.
- **Ưu tiên:** **Should**.
- **Trùng với:** không có.

#### NOTIF-03. Bật/tắt thông báo

- **Mô tả chuẩn hoá:** Người dùng tắt hoặc bật việc nhận thông báo.
- **Quy tắc nghiệp vụ:** Một công tắc chung cho **mọi** loại thông báo, lưu trên hồ sơ người dùng (`notifications_enabled: boolean`, mặc định `true`). Tắt không xoá thông báo đã có. Tắt không chặn thông báo bắt buộc về bảo mật (ví dụ "báo cáo của bạn cần bổ sung") — cần định nghĩa nhóm thông báo bắt buộc trong Phần 8.
- **Module:** `notifications` + `users`. **Phụ thuộc:** `NOTIF-01`.
- **Rủi ro:** Nếu tắt được cả thông báo bắt buộc, người dùng có thể không biết báo cáo của họ bị trả lại.
- **Ưu tiên:** **Should**.
- **Trùng với:** không có.

#### 3.37.1. Sự kiện phát sinh thông báo

Quyết định "chỉ từ sự kiện hệ thống" giới hạn ở các sự kiện sau ở đợt này:

| Sự kiện | Người nhận | Loại thông báo |
|---|---|---|
| Project được tạo | Thành viên workspace được thêm cùng lúc | `project` |
| Project bị xoá | Thành viên project | `project` |
| Báo cáo sự cố được duyệt với trạng thái "Cần bổ sung" | Người gửi báo cáo | `issue` — **bắt buộc**, không tắt được |
| Báo cáo sự cố đã xử lý | Người gửi báo cáo | `issue` |
| AI job hoàn tất | Người chạy phân tích | `analysis` |
| Phân tích hệ thống thất bại | Người chạy phân tích | `analysis` |
| Bản lưu project bị ghi đè bởi người khác | Người đang làm việc trên bản cũ | `conflict` — **bắt buộc** |

**Quy tắc bắt buộc:** thông báo loại `bắt buộc` vẫn được tạo dù công tắc đã tắt, nhưng không gửi email (chỉ hiển thị trong trung tâm thông báo).

**Danh sách thông báo bắt buộc (chốt ở v3 / 2026-11-05):** đúng **2 loại** — (1) báo cáo sự cố chuyển sang trạng thái "Cần bổ sung"; (2) bản lưu project bị ghi đè bởi người khác. Các loại thông báo còn lại (`project`, `issue` đã xử lý, `analysis`) là thông báo thường → tắt được.

#### 3.37.2. Kênh phân phối thông báo

Quyết định phạm vi chỉ nói về **nguồn** thông báo, chưa nói về **kênh**. Đề xuất cho đợt này: **chỉ in-app** (trung tâm thông báo trong hệ thống). Gửi email thông báo là phạm vi mở rộng cần hạ tầng email và phải cân nhắc PII.

#### 3.37.3. Phụ thuộc hạ tầng gửi email

`AUTH-05` (gửi OTP) là tính năng **duy nhất** trong nhóm này bắt buộc cần gửi email. Do đó phải có **port `EmailSender`** với adapter SMTP, cấu hình qua biến môi trường. Nếu thiếu cấu hình, adapter phải fail an toàn và API trả lỗi có kiểm soát (`DEPENDENCY_UNAVAILABLE`) chứ không im lặng.

### 3.38. Nhóm báo cáo sự cố — `ISSUE-*`

Đây là tính năng **phản hồi về hệ thống** (người dùng báo cáo sự cố), không phải báo cáo dữ liệu (`REPORT-01` là xuất PDF kết quả phân tích). Cần phân biệt rõ để tránh trùng mã.

#### ISSUE-01. Tạo báo cáo sự cố

- **Mô tả chuẩn hoá:** Người dùng gửi phản hồi về sự cố hệ thống: loại vấn đề, tiêu đề, mô tả chi tiết, tệp đính kèm (tuỳ chọn).
- **Quy tắc nghiệp vụ:**
  - Loại vấn đề: lỗi chức năng, lỗi hiển thị, lỗi dữ liệu, góp ý tính năng, khác.
  - Tệp đính kèm lưu qua port Storage, **giới hạn dung lượng riêng** (đề xuất 10 MB/tệp, tối đa 3 tệp) — chưa chốt, xem mục 6.2.
  - Báo cáo gắn với `user_id`, `workspace_id` (nếu người gọi đang ở trong workspace) và ngữ cảnh: đường dẫn API, thông báo lỗi, thời điểm.
  - Trạng thái khởi tạo: `new`.
- **Phạm vi:** Không cho Admin tạo báo cáo thay người dùng. Không tự động gửi email thông báo cho Admin mỗi lần có báo cáo mới (tránh bị spam) — Admin xem trong danh sách.
- **Module:** `issues` (module mới). **Phụ thuộc:** `users`, `workspaces`, port Storage.
- **Rủi ro:** Tệp đính kèm là **vector tấn công** (file thực thi, zip bomb). Phải kiểm tra mime type thực, chặn file thực thi, không phục vụ file tĩnh trực tiếp cho người chưa xác thực.
- **Ưu tiên:** **Should**.
- **Trùng với:** không có — **khác** `REPORT-01` (xuất PDF kết quả phân tích).

#### ISSUE-02. Danh sách báo cáo của tôi

- **Mô tả chuẩn hoá:** Xem danh sách báo cáo do chính người gọi tạo, có lọc theo trạng thái.
- **Quy tắc nghiệp vụ:**
  - Phân trang offset, mặc định 10 item/trang.
  - Lọc theo trạng thái: `new` (Cần bổ sung), `in_progress` (đang xử lý), `resolved` (đã xử lý), `closed` (đã đóng).
  - Mỗi dòng: mã báo cáo, tiêu đề, loại vấn đề, thời điểm tạo, cập nhật cuối, trạng thái.
- **Module:** `issues`. **Phụ thuộc:** `ISSUE-01`.
- **Ưu tiên:** **Should**.
- **Trùng với:** gộp #14 + #15.

#### ISSUE-03. Chi tiết báo cáo

- **Mô tả chuẩn hoá:** Xem chi tiết một báo cáo: mã, tiêu đề, loại vấn đề, thời điểm tạo, cập nhật cuối, trạng thái, mô tả chi tiết, tệp đính kèm.
- **Quy tắc nghiệp vụ:** Người gọi chỉ xem được báo cáo của mình. Admin xem được báo cáo của mọi người (`ISSUE-04`).
- **Module:** `issues`. **Phụ thuộc:** `ISSUE-02`.
- **Ưu tiên:** **Should**.
- **Trùng với:** không có.

#### ISSUE-04. Duyệt báo cáo từ người dùng (Admin)

- **Mô tả chuẩn hoá:** Admin duyệt báo cáo: xem danh sách toàn bộ, xem chi tiết, đổi trạng thái.
- **Quy tắc nghiệp vụ:**
  - Chỉ vai trò hệ thống `admin` (mục 3.34.1).
  - Chuyển trạng thái hợp lệ: `new` → `in_progress` → `resolved` → `closed`; và `in_progress` → `new` (yêu cầu bổ sung) để người dùng sửa và gửi lại.
  - Khi chuyển sang `new` (Cần bổ sung) → gửi thông báo cho người gửi (loại bắt buộc, mục 3.37.1).
  - Không có nội dung phản hồi bằng văn bản — người dùng chỉ biết trạng thái.
  - Mọi thay đổi trạng thái phải ghi log (ai, lúc nào, từ trạng thái nào sang trạng thái nào).
  - Admin **không** được sửa nội dung báo cáo của người dùng.
- **Phạm vi:** Quyết định đã chốt là luồng **đơn giản**: Admin đổi trạng thái, người dùng sửa và gửi lại khi trạng thái là "Cần bổ sung". Không có gán người xử lý, ghi chú nội bộ, phân công lại hay SLA thời gian.
- **Module:** `issues`. **Phụ thuộc:** `ISSUE-03`, `NOTIF-01`.
- **Rủi ro:** Không có phản hồi bằng văn bản khiến người dùng không biết cần bổ sung gì → giảm khả năng báo cáo được xử lý. Đánh đổi đã được người dùng chấp nhận để giữ phạm vi gọn; nếu sau này thấy không đủ thì bổ sung trường `admin_note` mà không phá luồng.
- **Ưu tiên:** **Should**.
- **Trùng với:** không có.

### 3.38b. Nhóm nhận xét kết quả — `FB-*` (v5)

**Quyết định 2026-11-05:** Mỗi kết quả hệ thống trả ra đều **kèm phần đánh giá để người dùng nhận xét**. Nhận xét được **lưu lại** và là nguồn ground truth để AI học lại. Cơ chế học lại được đặc tả ở Phần 12 v4 mục 3.16.

#### FB-01. Nhận xét một phát hiện

- **Mô tả chuẩn hoá:** Người dùng đánh giá một phát hiện (finding) mà hệ thống đưa ra: đúng / sai / đúng một phần, kèm lý do.
- **Quy tắc nghiệp vụ:**
  - Nhận xét gắn ở **cấp phát hiện** — nơi người dùng thực sự có ý kiến cụ thể.
  - Nhãn: `correct` · `partially_correct` · `false_positive` · `missed_issue` · `other`.
  - Nhãn `false_positive`, `missed_issue`, `other` → **bắt buộc** có `reason` (tối đa 2.000 ký tự).
  - Tùy chọn: `suggested_severity` (`low`/`medium`/`high`/`critical`) — gợi ý lại mức ảnh hưởng.
  - Minh bạch: hệ thống lưu kèm `ai_confidence` và `ai_rationale` **tại thời điểm nhận xét** → dùng để so sánh model nào đúng.
  - Nhiều người có thể nhận xét cùng một phát hiện → hệ thống tổng hợp thành chỉ số đánh giá.
- **Phạm vi:** Người có quyền xem project. **Không** cho AI tự tạo nhận xét — nhận xét luôn do con người.
- **Module:** `feedback` (module mới). **Phụ thuộc:** `analysis`, `users`.
- **Rủi ro:** Nhận xét sai nhãn làm ô nhiễm dữ liệu học lại → mẫu trong kho học phải qua bước kiểm duyệt và có điểm tin cậy ≥ 0,6 (Phần 12 v4 mục 3.16.4).
- **Ưu tiên:** **Must**.
- **Trùng với:** không có — **khác** `ISSUE-*` (báo cáo sự cố kỹ thuật) và `FB-02` (nhận xét cả lần phân tích).

#### FB-02. Nhận xét cả lần phân tích

- **Mô tả chuẩn hoá:** Người dùng đánh giá chung một lần phân tích: "phát hiện nhiều quá", "thiếu loại lỗi X", "kết quả chưa dùng được".
- **Quy tắc nghiệp vụ:** Cùng bộ nhãn và quy tắc bắt buộc lý do như `FB-01`. Lưu vào **cùng collection** `finding_feedback` với trường phân biệt `target_type = 'analysis'`.
- **Phạm vi:** Người có quyền xem project.
- **Module:** `feedback`. **Phụ thuộc:** `FB-01`, `analysis`.
- **Ưu tiên:** **Should**.
- **Trùng với:** `FB-01` — khác phạm vi gắn (phát hiện vs. cả lần phân tích).

#### FB-03. Xem nhận xét của một phát hiện

- **Mô tả chuẩn hoá:** Xem danh sách nhận xét của một phát hiện kèm chỉ số tổng hợp (ví dụ "3/4 người xác nhận đúng").
- **Quy tắc nghiệp vụ:**
  - Phân trang **cursor** (không offset) — `meta: { nextCursor, hasMore }`.
  - Sắp xếp mới nhất trước.
  - Chỉ số tổng hợp: tỉ lệ từng nhãn; hiển thị điểm AI tại thời điểm nhận xét để so sánh.
  - Không hiển thị `user_id` đầy đủ của người khác — chỉ hiện tên hiển thị (trừ người nhận xét thấy chính mình).
- **Module:** `feedback`. **Phụ thuộc:** `FB-01`.
- **Ưu tiên:** **Must**.
- **Trùng với:** không có.

#### FB-04. Xem nhận xét của một lần phân tích

- **Mô tả chuẩn hoá:** Xem danh sách nhận xét cấp lần phân tích, tổng hợp theo nhãn.
- **Quy tắc nghiệp vụ:** Như `FB-03`, phân trang cursor, lọc theo nhãn.
- **Module:** `feedback`. **Phụ thuộc:** `FB-02`.
- **Ưu tiên:** **Should**.
- **Trùng với:** `FB-03` — khác cấp gắn.

#### FB-05. Sửa / xoá nhận xét của chính mình

- **Mô tả chuẩn hoá:** Người đã nhận xét sửa nhãn/lý do hoặc xoá nhận xét của chính mình khi nhận ra mình đánh sai.
- **Quy tắc nghiệp vụ:**
  - Chỉ chủ nhận xét được sửa/xoá. Người khác → `FORBIDDEN`.
  - `PROJ-OWNER` được xoá nhận xét của thành viên khi vi phạm (vd: chứa PII, spam, quấy rối) — ghi log audit.
  - Sửa nhãn → bản ghi cũ giữ lại trong lịch sử thay đổi nội bộ (append-only) để truy vết.
  - Xoá nhận xét đã được đưa vào kho mẫu học → mẫu tương ứng phải bị **loại khỏi kho** trong lượt chuẩn hoá kế tiếp.
- **Phạm vi:** Không có quyền sửa kết quả phân tích — nhận xét chỉ là lớp đánh giá tách biệt, dữ liệu bất biến (Phần 12 v4 mục 3.16.6).
- **Module:** `feedback`. **Phụ thuộc:** `FB-01`.
- **Ưu tiên:** **Should**.
- **Trùng với:** không có.

#### FB-06. Thống kê chất lượng AI theo project

- **Mô tả chuẩn hoá:** Xem chỉ số chất lượng AI của một project: tỉ lệ `false_positive`, tỉ lệ `missed_issue`, F1 trên bộ benchmark, số nhận xét đã thu thập, xu hướng theo thời gian.
- **Quy tắc nghiệp vụ:**
  - Chỉ `PROJ-OWNER` / `PROJ-MEMBER` (là vai trò có quyền chạy phân tích và đánh giá chất lượng).
  - Dữ liệu lấy từ `finding_feedback` (aggregate) và bộ benchmark T3 (Phần 12 v4 mục 3.15.5).
  - Phân trang cursor cho danh sách theo chuỗi thời gian; phần chỉ số tổng hợp trả về nguyên khối.
- **Module:** `feedback`. **Phụ thuộc:** `FB-03`, `FB-04`, `analysis`.
- **Rủi ro:** Chỉ số chất lượng phụ thuộc số lượng nhận xét — hiển thị **mẫu số** để tránh đọc sai (VD "2/3 phát hiện được xác nhận" không phải "67% chính xác").
- **Ưu tiên:** **Should**.
- **Trùng với:** không có.

#### 3.38b.1. Quy tắc bắt buộc chung của nhóm `FB-*`

| Quy tắc | Nội dung |
|---|---|
| Ai được nhận xét | Người có quyền xem project (`WS-OWNER`, `PROJ-OWNER`, `PROJ-MEMBER`, `PROJ-VIEWER`) |
| Lưu trữ | Append-only trong collection `finding_feedback` (Phần 8 v4 mục 3.7.5) |
| Ẩn danh khi học lại | Nội dung tự do của nhận xét **không** dùng nguyên văn trong prompt — chỉ dùng mẫu đã chuẩn hoá, đã loại PII |
| Xoá theo project | Khi xoá project/workspace → nhận xét bị xoá theo; trừ mẫu đã ẩn danh hoá thì được giữ trong kho mẫu |
| Không tự động huấn luyện | Chỉ dùng để chèn mẫu (T1) và chấm điểm (T3) — không huấn luyện lại model trong đợt này |
| Không sửa kết quả | Nhận xét không làm thay đổi kết quả phân tích đã lưu |
| Bảo mật | Cùng mức bảo mật với `analysis_result`; audit log khi xoá nhận xét của người khác |

### 3.39. Chia đợt giao hàng — đã chốt

56 tính năng mới là khối lượng lớn, không thể giao cùng lúc với lõi Data Quality. Quyết định chia 3 đợt (chốt 2026-11-05):

| Đợt | Nội dung | Tính năng |
|---|---|---|
| **Đợt 1** | Toàn bộ phần **auth / tài khoản**: đăng ký, đăng nhập, đăng xuất, phiên đăng nhập, OTP quên/đặt lại mật khẩu, đổi mật khẩu, hồ sơ cá nhân, **thông báo**, **báo cáo sự cố**, workspace/project cơ bản | `AUTH-01`→`AUTH-13` (trừ `AUTH-03`), `USER-01`, `USER-02`, `ADMIN-01`, `WS-01`→`WS-07`, `WS-09`, `WS-10`, `PROJ-01`, `PROJ-03`→`PROJ-05`, `PROJ-09`→`PROJ-11`, `NOTIF-01`→`NOTIF-03`, `ISSUE-01`→`ISSUE-04` |
| **Đợt 2** | **Lõi Data Quality** + `AUTH-03` (Google login) | 27 tính năng lõi (`FILE-*`, `DATA-*`, `VIEW-*`, `DQ-*`, `ANALYSIS-*`, `AI-*`, `SUMMARY-*`, `REPORT-*`) + `AUTH-03` + `PROJ-02`, `PROJ-12`, `PROJ-13`, `WS-08` |
| **Đợt 3** | ~~**Lịch sử phiên bản** (module `versions`)~~ | ~~`PROJ-06`, `PROJ-07`, `PROJ-08`~~ — **ĐỢT BỊ BỎ 2026-11-05** (mục 3.40) |

**Ghi chú về Đợt 1:**
- Đợt 1 **không** phụ thuộc lõi Data Quality → có thể giao và giao diện dùng được trước.
- Rủi ro lớn nhất của Đợt 1 là **thiếu hạ tầng gửi email** (`AUTH-05`, lời mời thành viên `WS-01`/`WS-07`). Nếu chưa có SMTP, các tính năng này phải trả lỗi có kiểm soát chứ không được im lặng.
- `AUTH-03` (Google login) **không** nằm trong Đợt 1: cần OAuth client + HTTPS redirect URI + review chính sách liên kết tài khoản. Đưa vào Đợt 2 để không chặn tiến độ Đợt 1.
- `PROJ-02` (danh sách project có phân trang/lọc/sắp xếp) để Đợt 2 vì cần trường `project.status` chính thức.

**Ghi chú về Đợt 2:** là đợt giá trị sản phẩm chính — toàn bộ luồng import → Data Views → Analysis & Detection → Tổng kết → PDF.

**Ghi chú về Đợt 3 (2026-11-05):** Đợt này **bị bỏ hoàn toàn**. Module `versions` không được giao, ba tính năng `PROJ-06`/`PROJ-07`/`PROJ-08` bị gỡ khỏi danh mục. Các Đợt sau từ Đợt 2 sẽ dồn lên; xem mục 3.40.7.

**Rủi ro lịch trình:** Đợt 1 có 30 tính năng, trong đó 5 tính năng mới hoàn toàn cần hạ tầng mới (`AUTH-03` đã chuyển Đợt 2, còn lại `AUTH-05`/`AUTH-06` cần email; `NOTIF-*` và `ISSUE-*` cần module mới). Nếu thiếu hạ tầng email, Đợt 1 nên được chia nhỏ thành 1a (auth không cần email) và 1b (thông báo + báo cáo sự cố).

### 3.40. Quyết định thu hẹp phạm vi — hệ thống chỉ đọc, không sửa dữ liệu (2026-11-05)

#### 3.40.1. Nguyên tắc

Hệ thống Data Quality Platform **không bao giờ sửa, xóa hoặc thay đổi bất kỳ dòng dữ liệu hay giá trị ô nào** của dữ liệu người dùng. Dữ liệu tải lên được coi là **bất biến (immutable)** trong suốt vòng đời của project.

Hệ thống **đo lường** chất lượng dữ liệu và **báo cáo** vấn đề. Việc sửa dữ liệu là trách nhiệm của người dùng ở hệ thống nguồn.

#### 3.40.2. Danh sách tính năng bị gỡ

| Tính năng bị gỡ | Mã định danh | Use case liên quan | Module bị gỡ |
|---|---|---|---|
| Xóa dòng (một / nhiều chọn / một khoảng) | `DATA-01` | UC-11 | — |
| Sửa ô (chỉnh sửa giá trị ô) | `cell-edit` | UC-18 | `cell-edit` |
| Áp dụng clean rules (rule engine làm sạch) | — | UC-28 | `clean-rules` |
| Lịch sử hoạt động của project | `PROJ-06` | UC-29 | `versions` |
| Xem chi tiết lịch sử 1 hoạt động | `PROJ-07` | UC-29 | `versions` |
| Quay lại phiên bản của project (rollback) | `PROJ-08` | UC-29 | `versions` |
| Xem đồ thị lineage + kiểm tra toàn vẹn | — | UC-30 | `lineage` |

**Tổng số tính năng danh mục: 84 → 77** (bỏ 4 tính năng `PROJ-*` và 3 tính năng lõi `DATA-01`/sửa ô/clean rules).

#### 3.40.3. Nguyên tắc phân biệt: cái nào vẫn được giữ

| Hành vi | Còn giữ? | Lý do |
|---|---|---|
| **Đổi tên cột rỗng/trùng** (`UC-10`) | ✅ Giữ | Là *metadata cột* (tên hiển thị), không phải giá trị dữ liệu. Không sửa giá trị ô nào. |
| **Gán cột nhãn** | ✅ Giữ | Là *siêu dữ liệu phân tích*, không ghi vào ô dữ liệu. |
| **Lọc / sắp xếp / tìm kiếm** (`UC-15`→`UC-17`) | ✅ Giữ | Chỉ thay đổi phần hiển thị, không đụng tới dữ liệu. |
| **Chọn cột phân tích** (`UC-19`) | ✅ Giữ | Cấu hình phân tích, không phải dữ liệu. |
| **Loại giá trị thiếu/không hợp lệ khỏi phép tính** | ✅ Giữ | Chỉ loại khỏi *phép tính*, **không** loại khỏi dataset. |
| **Reset Dataset** | ⚠️ Thu hẹp | Chỉ còn khôi phục tên cột gốc (mục 3.40.5). |
| Xóa dòng | ❌ Bỏ | Ghi dữ liệu. |
| Sửa ô | ❌ Bỏ | Ghi dữ liệu. |
| Rollback phiên bản | ❌ Bỏ | Ghi đè dữ liệu. |

#### 3.40.4. Hệ quả kỹ thuật

| Hạng mục | Trước | Sau |
|---|---|---|
| `input_fingerprint` (mục 3.28) | Gồm tập số dòng đã xóa | **Không còn thành phần dữ liệu** — chỉ tập cột, cột nhãn, cấu hình phân tích |
| Cơ chế `stale` | Phân biệt "sửa ô" (`keep` + `warn_only`) với "đổi cấu hình" (`stale`) | **Một loại duy nhất**: mọi thay đổi đầu vào → `stale` |
| Bản lưu project (mục 3.19) | Lưu trạng thái dữ liệu đã biến đổi | **Chỉ lưu** cấu hình + kết quả phân tích + Tổng kết |
| Collection `dataset_version` | Có (snapshot Merkle) | **Không còn** — 22 collection → 21 |
| Hash Merkle / `version_hash` | Có | **Không còn** |
| Đồ thị Neo4j | Có | **Không còn** |
| Đường ghi vào `dataset_record` | Có (nhiều) | **Chỉ còn 1**: ghi lúc Import |
| Quyền theo vai trò | Có quyền xóa dòng, sửa ô, rollback | **Gỡ các quyền đó** |

#### 3.40.5. Reset Dataset — hành vi sau khi thu hẹp

| Thuộc tính | Hành vi |
|---|---|
| Phạm vi | Toàn bộ dataset đang làm việc |
| Tác vụ duy nhất | **Khôi phục tên cột về tên gốc** từ file gốc, gỡ các tên rỗng/trùng đã sửa |
| Khôi phục dòng đã xóa | **Không còn** (không có dòng đã xóa) |
| Khôi phục giá trị ô đã sửa | **Không còn** (không có ô đã sửa) |
| Ảnh hưởng kết quả phân tích | **Không** — fingerprint không chứa tên cột, nên Reset không gây `stale` |
| Ảnh hưởng bản lưu hiện hành | **Không** — chỉ lần Lưu thành công tiếp theo mới cập nhật |
| Quyền | `PROJ-OWNER`, `PROJ-MEMBER`, `WS-OWNER` (không phải `PROJ-VIEWER`) |

#### 3.40.6. Đề xuất của AI sau khi bỏ thao tác sửa

- AI giữ nguyên **4 vai trò** tại mục 3.31.3: phát hiện vấn đề bổ sung, giải thích, **đề xuất xử lý**, nhận xét chất lượng dữ liệu.
- **Không có đường dẫn thực thi.** Không có API "apply suggestion", không có job tự động sửa dữ liệu. Đề xuất là văn bản gợi ý để người dùng tự xử lý ở hệ thống nguồn.
- Đề xuất được trình bày dưới dạng: **mô tả vấn đề + hướng xử lý gợi ý + tham chiếu bằng chứng** — không kèm giá trị đề xuất ghi thẳng.
- Ranh giới dữ liệu gửi ra ngoài giữ nguyên: thống kê tổng hợp + tối đa 20 ô lỗi/cột đã che PII.

#### 3.40.7. Đánh đổi và tác động lịch trình

| Mặt | Nội dung |
|---|---|
| **Mất** | Khả năng sửa nhanh tại chỗ; cơ chế khôi phục dữ liệu; lịch sử phiên bản dataset; đồ thị lineage |
| **Được** | Kết quả phân tích luôn mô tả đúng dữ liệu đang có; không có trạng thái trung gian gây nhầm lẫn; toàn bộ đường dẫn ghi dữ liệu biến mất khỏi hệ thống |
| **Loại bỏ được nhóm lỗi** | Ghi đè dữ liệu · mất dữ liệu do transaction lỗi giữa chừng · race condition khi sửa ô đồng thời · không khớp giữa `input_fingerprint` và dữ liệu thực |
| **Lịch trình** | **Giảm** — bỏ 7 tính năng, 4 module, 1 collection, toàn bộ hash Merkle và đồ thị Neo4j. Đợt 3 bị bỏ; công việc của Đợt 3 dồn vào Đợt 2 |
| **Rủi ro mới** | Người dùng có thể mong đợi hệ thống sửa giúp. Cần thông điệp rõ ràng trong UI: "Hệ thống chỉ phát hiện và báo cáo — không tự sửa dữ liệu" |

#### 3.40.8. Đồng bộ chéo

Quyết định này được áp dụng đồng bộ sang: Phần 3 (use case), Phần 4 (ranh giới module), Phần 6 (ma trận quyền), Phần 7 (hợp đồng API), Phần 8 (schema), Phần 9 (sự kiện/worker), Phần 11 (migration), Phần 12 (logic xử lý AI), Phần 13 (kiểm thử), Phần 14 (kế hoạch triển khai), `tech.md` và các tài liệu công nghệ.

## 4. Đầu vào và đầu ra

- **Đầu vào:** Yêu cầu người dùng, kết quả các phần trước và mã nguồn/tài liệu hiện trạng liên quan.
- **Đầu ra:** Hoàn thiện kế hoạch lần đầu trong file v1 này; ghi rõ quyết định, lý do, phương án khác, trade-off, rủi ro, giới hạn và ảnh hưởng liên quan.

## 5. Điều kiện hoàn tất phần này

Danh sách tính năng được người dùng xác nhận, không mặc định giữ nguyên các module cũ.

**Trạng thái v5:** danh mục gồm **79 tính năng** (v3 có 84, bỏ 7 theo mục 3.40, thêm 6 theo mục 3.38b): **27 tính năng lõi Data Quality** (đã chốt ở v1–v2, trừ `DATA-01` xoá dòng) và **56 tính năng** mới (mục 3.32–3.38b, trừ `PROJ-06`/`PROJ-07`/`PROJ-08`), chia thành 7 nhóm: `AUTH-*` (13), `USER-*` (2), `ADMIN-*` (1), `WS-*` (10), `PROJ-*` (10), `NOTIF-*` (3), `ISSUE-*` (4), `FB-*` (6). Trong 56 tính năng mới: **13** đã có sẵn trong mã nguồn hiện tại, **13** đã có use case ở Phần 3, **30** cần thiết kế mới hoàn toàn. Chia đợt giao hàng tại mục 3.39 (Đợt 3 đã bị bỏ — mục 3.40.7). Phần lớn câu hỏi mở của v1 đã được chốt. Các câu hỏi còn mở được liệt kê tại mục 6.2 và cần chốt trước khi thiết kế chi tiết ở phần 8 (data model) và phần 9 (API).

**Việc cần làm ở các phần sau, do v3 sinh ra:**
- **Phần 3 (use case):** bổ sung UC cho 35 tính năng mới hoàn toàn. 10 tính năng đã có UC sẵn (dòng #27, #29, #37, #38, #39, #42, #47, #49, #50 và nhóm LEGACY) — không cần viết lại. Cần viết mới khoảng **30 UC** cho: `AUTH-01`→`AUTH-13`, `USER-01`, `USER-02`, `ADMIN-01`, `WS-02`, `WS-03`, `WS-06`, `WS-08`, `WS-09`, `PROJ-02`, `PROJ-03`, `PROJ-04`, `PROJ-05`, `PROJ-09`, `NOTIF-01`→`NOTIF-03`, `ISSUE-01`→`ISSUE-04`.
- **Phần 6 (quyền):** nâng lên v3 để thêm vai trò `admin` hệ thống (mục 3.34.1) và chốt quyền cụ thể cho các tính năng mới — đặc biệt `PROJ-02` (danh sách project có phân trang/tìm kiếm/lọc/sắp xếp), `WS-06` (danh sách thành viên), `AUTH-08`→`AUTH-11` (phiên đăng nhập), `NOTIF-01` (chỉ thông báo của chính mình), `ISSUE-02` (chỉ báo cáo của chính mình).
- **Phần 4 (ranh giới module):** xác định module mới `notifications`, `issues`, **`feedback`**; ghi nhận `versions` được kéo vào phạm vi giao hàng (mục 3.32.1).
- **Phần 8 (schema):** trường mới `project.status` (mục 3.36.1), `user.phone`, `user.bio`, `user.notifications_enabled`, `workspace.last_accessed_at`, collection `notification`, collection `issue_report`. ~~trường `dataset_version` cho lịch sử~~ — **gỡ 2026-11-05**, không còn collection `dataset_version` (mục 3.40).

## 6. Câu hỏi và phụ thuộc còn mở (v3)

### 6.1. Đã chốt ở v2 (không còn là câu hỏi mở)

- **Giới hạn dung lượng và quy ước đọc file:** mục 3.25.
- **Cấu trúc bảng không hợp lệ trong file CSV:** mục 3.26.
- **Sắp xếp và tìm kiếm:** mục 3.27.
- **Kết quả cũ sau thay đổi đầu vào (`stale`):** mục 3.28.
- **Ngưỡng ảnh hưởng và số mẫu tối thiểu:** mục 3.29.
- **Tiêu chí gợi ý cột nhãn và múi giờ:** mục 3.30.
- **Bằng chứng mức ô, lưu trữ file, phạm vi AI, phạm vi module, thao tác sửa ô:** mục 3.31.
- **Quy tắc tên cột và chặn phân tích:** đã chốt ở v1 và giữ nguyên ở v2 — tên cột rỗng/trùng là lỗi Import, vẫn nhận file nhưng yêu cầu sửa tên trên hệ thống; **chặn phân tích dataset đang làm việc cho tới khi hết lỗi tên cột**. **v5:** kiểm tra toàn bộ cột của file CSV khi Import.

### 6.2. Còn mở (cần người dùng quyết định)

1. **Ngưỡng cảnh báo lớp quá ít mẫu:** mục 3.29 đã chốt số mẫu tối thiểu cho phân tích tổng thể; còn ngưỡng riêng cho cảnh báo "lớp có quá ít mẫu" trong đánh giá mất cân bằng và cho tỷ lệ thiếu theo nhóm.
2. **Giới hạn tinh chỉnh tham số:** mức cho phép người dùng tinh chỉnh ngưỡng IQR / Modified Z-score / tỷ lệ thiếu / IR / VIF trong bao nhiêu phạm vi, và có bảng giá trị mặc định đề xuất không.
3. **Số kỳ tối thiểu của phân tích thời gian:** cần bao nhiêu kỳ mới đủ cơ sở kết luận về xu hướng và bất thường khoảng trống quan sát được.
4. ~~**Mục đích sử dụng lại của các module LEGACY**~~ — **đã chốt 2026-11-05:** `versions`, `lineage`, `clean-rules` **bị gỡ khỏi phạm vi sản phẩm** (xoá hoàn toàn); `exports` giữ LEGACY, ngoài phạm vi nghiệm thu. Đóng mục này.
5. **Hình thức kết quả đầu ra:** bố cục báo cáo PDF (chương, bảng, biểu đồ nhúng) và định dạng xuất (PDF chỉ hay kèm CSV/JSON cho kết quả thô).
6. **Mức chi tiết bố cục báo cáo PDF:** số phát hiện hiển thị tối đa, có phân trang bằng chứng trong PDF không, có phụ lục thống kê đầy đủ không.
7. **Chỉ số thứ 5 của tổng quan Workspace** (`WS-08`): yêu cầu gốc nêu "5 chỉ số" nhưng chỉ liệt kê 4. Đề xuất: "tổng số báo cáo sự cố đang mở của tôi" — **chờ xác nhận**.
8. **Giới hạn dung lượng tệp đính kèm của báo cáo sự cố** (`ISSUE-01`): đề xuất 10 MB/tệp, tối đa 3 tệp; cần chốt các định dạng được phép.
9. **Chính sách giữ lại thông báo** (`NOTIF-01`): giữ N ngày hay tối đa M bản ghi; cần chốt giá trị.
10. **Cơ chế bảo trì cấu trúc vai trò workspace** (`WS-02`, `WS-06`): schema hiện dùng `owner|editor|viewer` cần đổi sang `owner|member`; cần chốt có chạy migration dữ liệu hiện có hay chỉ áp dụng cho dữ liệu mới. **Đã chốt ở Phần 11 v1 mục 3.6.3: có chạy migration, map `editor`/`viewer` → `member`; bảng `workspace_member` tách collection.**
11. **Vị trí vai trò `admin` hệ thống:** thuộc module `users` hay module `admin` riêng — cần chốt khi thiết kế ranh giới module ở Phần 4.
12. **Chia nhỏ Đợt 1 thành 1a/1b:** có nên tách Đợt 1 thành 1a (auth + workspace/project cơ bản, không cần email) và 1b (thông báo + báo cáo sự cố) hay giữ Đợt 1 làm một khối — phụ thuộc vào thời điểm có hạ tầng gửi email (mục 3.39).

### 6.2c. Đã chốt ở v3 (bổ sung 2026-11-05)

- **Đối chiếu file đầu vào:** 52 tính năng trong `feature_nescessary.xlsx` đã được đối chiếu với Phần 2 v2, Phần 3 và mã nguồn hiện tại — bảng đối chiếu tại mục 3.32.
- ~~**Lịch sử phiên bản project** (`PROJ-06`→`PROJ-08`): dùng lại module `versions` LEGACY~~ — **ĐÃ BỎ 2026-11-05**, cả 3 tính năng bị gỡ cùng module `versions` (mục 3.40).
- **Tổng quan workspace:** gộp hai yêu cầu thành một tính năng `WS-08`.
- **Danh sách project:** gộp hai yêu cầu thành một tính năng `PROJ-02`.
- **Vai trò `admin` hệ thống:** giữ theo code hiện tại, nằm ngoài phân cấp workspace/project, giới hạn ở `ISSUE-04` và `ADMIN-01` (mục 3.34.1).
- **Lọc workspace theo vai trò:** chỉ `Owner`/`Member` — bỏ `Viewer` khỏi cấp workspace.
- **Trạng thái project:** trường mới `not_started` / `in_progress` / `completed`, tự cập nhật theo sự kiện hệ thống (mục 3.36.1).
- **Ghi nhớ đăng nhập:** chỉ nhớ email, không lưu mật khẩu (`AUTH-04`).
- **Quên mật khẩu:** OTP 6 số qua email, hết hạn 10 phút, tối đa 5 lần gửi/giờ, tối đa 3 lần nhập sai (`AUTH-05`).
- **Thông báo:** chỉ phát sinh từ sự kiện hệ thống; một công tắc bật/tắt chung; nhóm thông báo bắt buộc không tắt được (mục 3.37).
- **Báo cáo sự cố:** luồng đơn giản — Admin đổi trạng thái, trạng thái "Cần bổ sung" cho phép người dùng sửa và gửi lại; không có nội dung phản hồi bằng văn bản (mục 3.38).
- **Admin xem hồ sơ người dùng:** chỉ đọc, không sửa, không xoá, không xem phiên của người khác; bắt buộc ghi log (`ADMIN-01`).
- **Quyền `WS-MEMBER` ở cấp workspace:** chỉ **đọc** — xem thông tin workspace, danh sách thành viên, tổng quan và danh sách project; không sửa workspace, không xem/đổi vai trò thành viên.
- **Nhượng quyền Workspace Owner:** người cũ trở thành `WS-MEMBER` và **giữ nguyên vai trò project** (vẫn là `PROJ-OWNER` nếu đang là) — khác với người rời workspace (`WS-10`) mất toàn bộ quyền project (`WS-09`).
- **`project.has_dataset`:** **bỏ**, suy ra từ `status !== 'not_started'` — một nguồn sự thật duy nhất (mục 3.36.1).
- **Phạm vi audit log:** chỉ ghi log cho hành động nhạy cảm mới — Admin duyệt báo cáo, Admin xem hồ sơ người dùng, thay đổi vai trò thành viên, nhượng quyền Owner. Không thiết kế module audit đầy đủ trong đợt này (`ADMIN-01`).
- **Thông báo bắt buộc:** đúng **2 loại** — báo cáo sự cố "Cần bổ sung" và bản lưu project bị ghi đè bởi người khác (`NOTIF-03`).
- **Chia đợt giao hàng:** Đợt 1 = auth + thông báo + báo cáo sự cố + workspace/project cơ bản; Đợt 2 = lõi Data Quality + Google login; Đợt 3 = lịch sử phiên bản (`versions`) (mục 3.39).
- **Google login (`AUTH-03`):** không nằm trong Đợt 1, chuyển sang Đợt 2.

### 6.2b. Đã chốt sau v2 (bổ sung 2026-11-04)

- **Bộ lọc — cấu trúc điều kiện:** giữ dạng phẳng, không nhóm lồng nhau. OR trong cùng cột, AND giữa các cột (mục 3.13).
- **Bộ lọc — so khớp:** `contains`/`equals`/`startsWith`/`endsWith`; không phân biệt hoa/thường nhưng có phân biệt khoảng trắng; trống = `null`/`undefined`/chuỗi toàn khoảng trắng, **không** tính `"N/A"`, `"NULL"`, `"NA"`, `"-"`; `between` bao gồm cả hai đầu (mục 3.13).
- **Thư viện triển khai phân tích:** `simple-statistics` cho thống kê mô tả + `ml-matrix` cho tương quan, VIF và ma trận (mục 3.14 của phần 12).

### 6.3. Phụ thuộc bên ngoài

- **v5 — thay thế.** **Không còn biến môi trường API key ngoài.** Thay bằng cấu hình engine cục bộ: `AI_ENGINE_URL`, `AI_MODEL_ID`, `AI_MODEL_PATH` (đường dẫn file GGUF/weights), `AI_ENGINE_TIMEOUT_MS`. Adapter phải **fail an toàn** khi engine chưa sẵn sàng (mục 3.31.4).
- Cấu hình S3/R2 cho port Storage; adapter có local fallback nên không chặn môi trường phát triển (mục 3.31.2).
- **Dịch vụ gửi email** (SMTP/API) — cần cho `AUTH-05` (OTP quên mật khẩu) và lời mời thành viên workspace (`WS-01`, `WS-07`). Yêu cầu port `EmailSender` với adapter SMTP; thiếu cấu hình thì adapter fail an toàn và API trả lỗi có kiểm soát (mục 3.37.3).
- **Google OAuth client** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` cho `AUTH-03`. Cần HTTPS cho redirect URI.
- **Hạ tầng rate-limit** — `AUTH-13` cần cơ chế đếm theo IP/email; in-memory chỉ hiệu quả với một instance, cần ghi nhận trong Phần 10 (vận hành).


Nếu phát hiện mâu thuẫn với phần trước, cần xác nhận lại và cập nhật version phù hợp trước khi thực hiện công việc phụ thuộc.

## 7. Prompting log và lịch sử thay đổi

- **Xác nhận v5 / 2026-11-05:** Chỉ hỗ trợ file `.csv`; gỡ toàn bộ khái niệm sheet, gỡ `FILE-01`/`FILE-02`, gỡ collection `dataset_sheet` / Theo yêu cầu người dùng / Viết lại mục 3.2, 3.8, 3.25, 3.26, cập nhật mục 3.12, 3.19 và bảng đối chiếu 3.32.
- **Xác nhận v5 / 2026-11-05:** Phân trang chuyển sang **cursor** cho toàn bộ danh sách / Theo lựa chọn người dùng / Đồng bộ Phần 5 v2 mục 3.8 và Phần 7 v3 mục 3.5.
- **Xác nhận v5 / 2026-11-05:** Thêm tính năng **nhận xét kết quả** (`FB-01`→`FB-06`) và module `feedback`; AI chạy nội bộ bằng model cục bộ / Theo yêu cầu người dùng / Đồng bộ Phần 3 v4, Phần 12 v4 mục 3.15–3.16.

- **Xác nhận v3 / 2026-11-05:** Đọc và đối chiếu 52 tính năng trong `docs/restructures/feature_nescessary.xlsx` với 28 mã tính năng của v2, 31 use case của Phần 3 và mã nguồn hiện tại / Theo yêu cầu người dùng / Bổ sung mục 3.32 với bảng đối chiếu đầy đủ 52 dòng.
- **Xác nhận v3 / 2026-11-05:** ~~Lịch sử phiên bản project dùng lại module `versions` LEGACY~~ — **bị gỡ bởi quyết định 2026-11-05** (mục 3.40). Lịch sử: v3 chọn `keep_legacy`, v4 đảo chiều thành gỡ hoàn toàn.
- **Xác nhận v3 / 2026-11-05:** Gộp tổng quan workspace (#41 + #48) thành một tính năng / Theo lựa chọn người dùng `merge` / Bổ sung `WS-08`.
- **Xác nhận v3 / 2026-11-05:** Gộp danh sách project (#30 + #51) thành một tính năng / Theo lựa chọn người dùng `merge` / Bổ sung `PROJ-02`.
- **Xác nhận v3 / 2026-11-05:** Giữ vai trò `admin` hệ thống theo code hiện tại / Theo lựa chọn người dùng `keep_admin` / Bổ sung mục 3.34.1 với 5 giới hạn bắt buộc; Phần 6 cần nâng lên v3.
- **Xác nhận v3 / 2026-11-05:** Lọc workspace theo vai trò chỉ có Owner/Member, bỏ Viewer / Theo lựa chọn người dùng `two_roles` / Cập nhật `WS-02`, sửa yêu cầu gốc #43.
- **Xác nhận v3 / 2026-11-05:** Thêm trường trạng thái project `not_started`/`in_progress`/`completed`, tự cập nhật theo tiến độ / Theo lựa chọn người dùng `new_field` / Bổ sung mục 3.36.1.
- **Xác nhận v3 / 2026-11-05:** Ghi nhớ đăng nhập chỉ nhớ email, không lưu mật khẩu / Theo lựa chọn người dùng `email_only` / Bổ sung `AUTH-04` với ghi chú lý do thu hẹp so với yêu cầu gốc.
- **Xác nhận v3 / 2026-11-05:** Quên mật khẩu bằng OTP 6 số qua email, hết hạn 10 phút, tối đa 5 lần gửi/giờ, 3 lần nhập sai / Theo lựa chọn người dùng `email_otp` / Bổ sung `AUTH-05`, `AUTH-06` và port `EmailSender`.
- **Xác nhận v3 / 2026-11-05:** Thông báo chỉ phát sinh từ sự kiện hệ thống / Theo lựa chọn người dùng `system_events` / Bổ sung mục 3.37.1 với 7 sự kiện và nhóm thông báo bắt buộc.
- **Xác nhận v3 / 2026-11-05:** Một công tắc bật/tắt thông báo chung cho mọi loại / Theo lựa chọn người dùng `global` / Bổ sung `NOTIF-03`.
- **Xác nhận v3 / 2026-11-05:** Báo cáo sự cố theo luồng đơn giản, Admin chỉ đổi trạng thái, không có nội dung phản hồi bằng văn bản / Theo lựa chọn người dùng `simple_status` / Bổ sung mục 3.38 và ghi rõ đánh đổi đã được chấp nhận.
- **Xác nhận v3 / 2026-11-05:** Admin xem hồ sơ người dùng chỉ đọc / Theo lựa chọn người dùng `read_only` / Bổ sung `ADMIN-01` với yêu cầu bắt buộc ghi log.
- **Xác nhận v3 / 2026-11-05:** Không cập nhật Phần 3 và Phần 6 trong đợt này / Theo lựa chọn người dùng `part2_only` / Ghi nhận danh sách việc cần làm ở mục 5 và đánh dấu nơi cần bổ sung trong từng tính năng.
- **Xác nhận v3 / 2026-11-05:** `WS-MEMBER` có quyền **đọc** ở cấp workspace — xem thông tin workspace, danh sách thành viên, tổng quan, danh sách project / Theo lựa chọn người dùng `read_only` / Bổ sung quyền vào `WS-06`, ghi nhận tại mục 6.2c.
- **Xác nhận v3 / 2026-11-05:** Nhượng quyền Workspace Owner thì người cũ giữ nguyên vai trò project / Theo lựa chọn người dùng `stay_member` / Sửa quy tắc tại `WS-09`, phân biệt rõ với `WS-10`.
- **Xác nhận v3 / 2026-11-05:** Chia 3 đợt giao hàng: Đợt 1 auth + thông báo + báo cáo sự cố + workspace/project cơ bản; Đợt 2 lõi Data Quality; Đợt 3 lịch sử phiên bản / Theo mô tả người dùng / Bổ sung mục 3.39.
- **Xác nhận v3 / 2026-11-05:** ~~`clean-rules`, `lineage`, `exports` giữ LEGACY; chỉ `versions` vào phạm vi~~ — **bị gỡ bởi quyết định 2026-11-05** (mục 3.40). Lịch sử: v3 chọn `versions_in_rest_out`, v4 gỡ cả ba.
- **Xác nhận v3 / 2026-11-05:** Bỏ `project.has_dataset`, suy ra từ `status` / Theo lựa chọn người dùng `derive` / Sửa quy tắc 4 tại mục 3.36.1; code `setHasDataset` phải chuyển sang dùng `status`.
- **Xác nhận v3 / 2026-11-05:** Audit log chỉ ghi cho hành động nhạy cảm mới, không thiết kế module audit đầy đủ / Theo lựa chọn người dùng `only_new` / Bổ sung danh sách 4 hành động bắt buộc ghi log tại `ADMIN-01`.
- **Xác nhận v3 / 2026-11-05:** Thông báo bắt buộc gồm đúng 2 loại (báo cáo cần bổ sung, bản lưu bị ghi đè) / Theo lựa chọn người dùng `as_proposed` / Bổ sung danh sách tại mục 3.37.1.
- **Xác nhận v3 / 2026-11-05:** Google login (`AUTH-03`) chuyển sang Đợt 2, không nằm trong Đợt 1 / Theo lựa chọn người dùng `phase2` sau khi phát hiện mâu thuẫn với mô tả Đợt 1 / Sửa mục 3.39 và 6.2c.
-- **Xác nhận v2 / 2026-11-04:** Bộ lọc giữ dạng phẳng, không nhóm điều kiện lồng nhau (OR trong cùng cột, AND giữa các cột) / Theo lựa chọn người dùng / Bổ sung mục 3.13 và 6.2b.
- **Xác nhận v2 / 2026-11-04:** Quy tắc so khớp bộ lọc theo phương án đề xuất: `contains`/`equals`/`startsWith`/`endsWith`, không phân biệt hoa/thường nhưng có phân biệt khoảng trắng, giá trị trống không gồm `"N/A"`/`"NULL"`, `between` bao gồm hai đầu / Theo lựa chọn người dùng / Bổ sung mục 3.13 và 6.2b.
- **Xác nhận v2 / 2026-11-04:** Triển khai phân tích bằng `simple-statistics` + `ml-matrix` / Theo lựa chọn người dùng / Cập nhật phần 12 mục 3.14; chuyển câu hỏi thư viện thống kê sang mục 6.2b.
 **Xác nhận v2 / 2026-11-04:** Chặn phân tích cho tới khi hết lỗi tên cột rỗng/trùng của dataset đang làm việc / Theo lựa chọn `block` của người dùng / Cập nhật mục 3.2 và mục 6.1; kiểm tra tất cả sheet khi Import, chỉ chặn sheet đang phân tích.
- **Xác nhận v2 / 2026-11-04:** Bằng chứng ở mức ô (kèm giá trị ô cụ thể và số dòng gốc), lưu ở collection riêng, phân trang riêng / Theo lựa chọn `cell_level` + `separate_collection` của người dùng / Bổ sung mục 3.31.1.
- **Xác nhận v2 / 2026-11-04:** AI đủ 4 vai trò — phát hiện bổ sung, giải thích, đề xuất, nhận xét chất lượng dữ liệu / Theo lựa chọn `full` / Cập nhật mục 3.6 và 3.31.3.
- **Xác nhận v2 / 2026-11-04:** ~~Thao tác sửa ô giữ trong backend mới, `keep` + `warn_only`~~ — **bị gỡ bởi quyết định 2026-11-05** (mục 3.40). Lịch sử: v2 chọn `in_new_backend`, v4 đảo chiều thành bỏ hoàn toàn.
- **Xác nhận v2 / 2026-11-04:** Gửi tối đa 20 ô lỗi/cột cho AI, đã mask PII; mọi nơi ghi "AI chỉ nhận thống kê tổng hợp" phải hiểu là không nhận toàn bộ mẫu dòng/giá trị ô / Theo lựa chọn `send_sample_masked` / Sửa mục 3.5.1, 3.6, 3.7, 3.31.3 và phần 12.
- **Xác nhận v2 / 2026-11-04:** ~~Nhà cung cấp AI là Gemini API~~ — **bị thay thế ở v5**. **Xác nhận v5 / 2026-11-05:** AI chạy **cục bộ**, không gọi API bên ngoài; dữ liệu không rời khỏi hệ thống / Theo lựa chọn `qwen14` / Bổ sung Phần 12 v4 mục 3.15.
- **Xác nhận v2 / 2026-11-04:** AI chạy bất đồng bộ qua job table MongoDB + polling nền trong API process, timeout 60s, retry 2 lần, lỗi AI không chặn Tổng kết / Theo lựa chọn `async_job` + `mongo_job` / Bổ sung mục 3.31.4.
- **Xác nhận v2 / 2026-11-04:** Giữ R2, sửa lỗi đuôi file (giữ đúng extension gốc), dọn file tạm khi thất bại, viết port Storage riêng theo chuẩn Ports and Adapters / Theo lựa chọn `keep_r2_fix_ext` + `new_port` / Bổ sung mục 3.31.2.
- **Xác nhận v2 / 2026-11-04:** Giới hạn file 50MB (mặc định) và 500MB (tối đa), quy ước đọc CSV và xử lý bảng không hợp lệ / Theo phương án đề xuất được duyệt / Bổ sung mục 3.25 và 3.26.
- **Xác nhận v2 / 2026-11-04:** Ngưỡng ảnh hưởng và số mẫu tối thiểu theo phương án đề xuất / Theo phương án được duyệt / Bổ sung mục 3.29.
- **Xác nhận v2 / 2026-11-04:** Tiêu chí gợi ý cột nhãn và xử lý múi giờ theo phương án đề xuất / Theo phương án được duyệt / Bổ sung mục 3.30.
- **Xác nhận v2 / 2026-11-04:** Sắp xếp một cột, tìm kiếm toàn bảng, kết quả cũ đánh dấu `stale` theo fingerprint / Theo phương án được duyệt / Bổ sung mục 3.27 và 3.28.


- **Xác nhận v1 / 2026-11-04:** Workspace Owner, Project Owner và Project Member được sửa tên cột; Viewer chỉ xem cảnh báo. Reset đưa toàn bộ dataset đang làm việc về trạng thái chưa sửa và hiển thị lại cảnh báo / Theo xác nhận người dùng / Đồng bộ mục 3.2, 3.12, câu hỏi mở và phần 6; giữ phạm vi reset một sheet và bản lưu hiện hành, chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Kiểm tra tất cả sheet khi Import Excel, gồm sheet ẩn; thông báo theo từng sheet, chỉ yêu cầu sửa tên cột của sheet đang phân tích / Theo xác nhận hướng đề xuất của người dùng / Cập nhật mục 3.2 và câu hỏi mở, giữ quy tắc sheet rỗng; chưa sửa backend.

- **Điều chỉnh v1 / 2026-11-04:** Vẫn nhận file có tên cột rỗng/trùng nhưng thông báo và yêu cầu nhập/chỉnh sửa tên trên hệ thống trước khi phân tích / Theo yêu cầu mới của người dùng / Thay quyết định cho phân tích khi tên còn lỗi; đồng bộ mục 3.2, Reset, Lưu và câu hỏi mở theo quy tắc giữ file gốc và lưu toàn bộ trạng thái; chưa sửa backend.

- **Xác nhận v1 / 2026-11-04:** Cột có tên rỗng/trùng vẫn được chọn và phân tích bình thường, kèm cảnh báo / Theo xác nhận người dùng / Chốt mục 3.2 và cập nhật câu hỏi mở, không chặn phân tích vì tên cột; chưa sửa backend.
- **Điều chỉnh v1 / 2026-11-04:** Tên cột rỗng/trùng chỉ cảnh báo, vẫn chấp nhận Import và gắn file nếu không có lỗi Import khác / Theo yêu cầu sửa lại của người dùng / Thay quy định từ chối và yêu cầu tải lại vì tên cột tại mục 3.2 và câu hỏi mở; chưa tự bổ sung sửa tên hoặc chốt quyền chạy phân tích, chưa sửa backend.

- **Điều chỉnh v1 / 2026-11-04:** Tên cột rỗng/trùng là lỗi Import, báo rõ cột lỗi và yêu cầu sửa file rồi tải lại trước khi gắn vào project / Theo lựa chọn mới của người dùng / Thay phương án sửa tên trên hệ thống; đồng bộ mục 3.2, Reset, nội dung Lưu và câu hỏi mở; giữ lịch sử quyết định cũ bên dưới, chưa sửa backend.

- **Tinh chỉnh v1 / 2026-11-04:** Bổ sung Import file và kiểm tra ngay sau tải lên; lỗi tải/đọc file hoặc loại chưa hỗ trợ chưa gắn vào project và được nhập lại / Theo xác nhận và mô tả người dùng / Làm rõ thời điểm gắn file tại mục 3.2; phạm vi nhập lại khi tên cột lỗi cần xác nhận, chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Gắn file ngay khi tải lên; tên cột lỗi được sửa trên hệ thống, tải file đã sửa cần project mới / Theo lựa chọn người dùng để thống nhất với quy tắc không thay file / Cập nhật mục 3.2 và thay lựa chọn tải lại trong cùng project khi tên cột lỗi; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Không cho phép thay thế file dữ liệu của project; file khác cần project mới / Theo lựa chọn người dùng / Cập nhật mục 3.2, ghi điểm cần làm rõ với luồng sửa file rồi tải lại khi tên cột lỗi; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Mỗi project chỉ chứa một file dữ liệu / Theo lựa chọn người dùng / Chốt phạm vi tại mục 3.2; cơ chế thay thế file còn cần bàn, chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Chưa hỗ trợ file Excel có mật khẩu mở file; thông báo để người dùng gỡ mật khẩu rồi tải lại / Theo xác nhận người dùng / Bổ sung giới hạn nhập file tại mục 3.2; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Mỗi sheet có dữ liệu chứa một bảng duy nhất, dòng đầu là tên cột và các dòng bên dưới là dữ liệu / Theo xác nhận người dùng / Bổ sung phạm vi tại mục 3.2, giữ quy tắc sheet rỗng tại mục 3.8; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** File `.xlsx` chỉ chứa giá trị có sẵn, không có ô công thức / Theo xác nhận người dùng / Bổ sung giới hạn đầu vào tại mục 3.2, chưa đưa xử lý công thức vào phạm vi; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Đầu vào không có ô gộp / Theo mô tả người dùng / Ghi giới hạn dữ liệu tại mục 3.2, chưa đưa xử lý ô gộp vào phạm vi; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Cho phép chọn và xem sheet ẩn / Theo yêu cầu người dùng / Cập nhật mục 3.8 và câu hỏi mở, giữ nguyên file gốc; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Sheet đầu tiên rỗng vẫn được mở, hiển thị thông báo để người dùng tự đổi sheet / Theo lựa chọn người dùng / Cập nhật mục 3.8 và câu hỏi mở, không tự bỏ qua sheet rỗng; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Lưu tên cột đã nhập lại khi bấm Lưu tại Tổng kết và khôi phục cùng bản project hiện hành / Theo xác nhận người dùng / Bổ sung mục 3.19, giữ quy tắc reset tên từ file gốc; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Reset Dataset khôi phục tên cột từ file gốc của dataset đang làm việc / Theo lựa chọn người dùng / Bổ sung mục 3.12, áp dụng lại kiểm tra tên cột sau reset; bản lưu hiện hành vẫn giữ đến lần Lưu thành công, chưa sửa backend.
- **Tinh chỉnh v1 / 2026-11-04:** Tên cột chỉ chứa khoảng trắng chỉ được phát hiện và hiển thị cảnh báo, không bắt buộc sửa để phân tích / Theo yêu cầu người dùng / Phân biệt với tên rỗng và giữ kiểm tra trùng tên; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Phân biệt hoa/thường và khoảng trắng khi so sánh tên cột; `Tuổi`, `tuổi`, ` Tuổi ` không được xem là cùng tên / Theo trả lời người dùng / Cập nhật quy tắc tên cột và câu hỏi mở, chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Báo lỗi tên cột trống/trùng; cho nhập tên trên hệ thống hoặc sửa file rồi tải lại; chỉ phân tích khi mọi tên cột có giá trị và không trùng / Theo lựa chọn và xác nhận người dùng / Bổ sung xử lý tên cột tại 3.2, giữ nguyên file gốc; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Tiêu đề bộ dữ liệu lấy từ tên file, dòng đầu tiên của sheet/CSV dùng làm tên cột / Theo mô tả và xác nhận người dùng / Bổ sung quy tắc đọc đầu vào tại 3.2, cập nhật câu hỏi mở; chưa sửa backend.
- **Xác nhận v1 / 2026-11-04:** Chỉ hỗ trợ `.xlsx` và `.csv`, không đưa `.xls` vào đợt hiện tại / Theo lựa chọn người dùng / Chốt định dạng đầu vào tại mục 3.2 và cập nhật câu hỏi mở; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt tổng hợp thời gian theo kỳ, chọn cột tại Data Views, khoảng trống quan sát được và IQR trên chênh lệch kỳ liền trước / Người dùng đồng ý đề xuất / Hoàn thiện phạm vi 3.15, đồng bộ biểu đồ/câu hỏi mở; chưa phân rã mùa vụ, dự báo hoặc sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt đánh giá phân bố lớp, IR và cảnh báo IR ≥ 3 là ngưỡng dự án; xử lý nhãn thiếu/liên tục/một lớp và biểu đồ Top N / Người dùng đồng ý đề xuất / Bổ sung 3.24, cập nhật ANALYSIS-07; không tự cân bằng dữ liệu, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt Pearson/Spearman, Cramér’s V, η², dòng hợp lệ theo cặp và tập dòng chung cho VIF, cảnh báo VIF > 5 / Người dùng đồng ý đề xuất / Bổ sung 3.23, cập nhật ANALYSIS-04/05 và tham chiếu DQ-03; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Giữ phạm vi hiện tại với DQ-05, tiếp tục hoãn cấu hình quy tắc; chưa có quy tắc thì báo Chưa đánh giá / Người dùng chọn giữ phạm vi / Làm rõ giới hạn nghiệm thu, không cam kết đầy đủ phát hiện mâu thuẫn nghiệp vụ; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt DQ-04, IQR mặc định và Modified Z-score/cả hai, giới hạn áp dụng và cấu hình tại Data Views / Người dùng đồng ý đề xuất / Bổ sung 3.5.4, cập nhật ANALYSIS-06; đa biến và điều kiện chi tiết còn mở, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt DQ-03, phân biệt kiểu/vai trò, dữ liệu không hợp lệ/mơ hồ; cấu hình số/ngày tại Data Views và tiếp tục tính trên phần hợp lệ có công bố phạm vi / Người dùng đồng ý đề xuất / Bổ sung mục 3.5.3 và cập nhật 3.22, ảnh hưởng lưu/khôi phục, chạy lại, Tổng kết/PDF; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt tiêu chí ban đầu dữ liệu thiếu và trùng lặp, thống kê/bằng chứng, xử lý không có dòng và giới hạn diễn giải / Người dùng đồng ý đề xuất / Bổ sung mục 3.5.1–3.5.2; còn bàn khóa nghiệp vụ, gần giống, ký hiệu thiếu tùy chỉnh và ngưỡng ảnh hưởng, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt ba mức ảnh hưởng và trạng thái Chưa đủ cơ sở do backend xác định, tách trạng thái xác minh; kiểm chứng từng phát hiện AI và xử lý phản hồi không hợp lệ một phần/toàn bộ / Người dùng đồng ý phương án / Cập nhật hành vi Detection và Tổng kết; ngưỡng chi tiết, schema và implementation chưa thực hiện.
- **Xác nhận v1 / 2026-11-03:** Mỗi phát hiện AI gồm vấn đề, cột liên quan, bằng chứng thống kê, mức độ ảnh hưởng, giải thích và đề xuất xử lý; phân biệt nghi vấn với vấn đề hệ thống đã xác nhận / Người dùng xác nhận cấu trúc đề xuất / Chốt nội dung chức năng, chưa chốt schema kỹ thuật hoặc sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chỉ gửi kết quả thống kê sang API AI / Theo lựa chọn người dùng / Không gửi file gốc, mẫu dòng hay giá trị ô; thu hẹp bằng chứng và nhận xét AI tương ứng, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Dùng API mô hình ngoài để đọc kết quả hệ thống, hỗ trợ Detection/nhận xét/đề xuất, kiểm tra phản hồi và tích hợp qua port/adapter / Người dùng đồng ý hướng triển khai / Không cần mô hình riêng; nhà cung cấp, dữ liệu gửi và hợp đồng chi tiết chưa chốt, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Tổng kết chỉ thể hiện những thay đổi cuối cùng còn hiệu lực trước phân tích / Theo lựa chọn người dùng / Chốt cách trình bày mục thao tác và nội dung tương ứng trong PDF, không liệt kê thay đổi đã trở về ban đầu; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Hệ thống tự nhận diện loại cột, cho tinh chỉnh tại Data Views; Tổng kết thể hiện các thao tác với dữ liệu trước phân tích / Theo yêu cầu người dùng / Bổ sung mục 3.22, liên kết cấu hình phân tích, lưu và báo cáo; cách trình bày lịch sử còn cần chốt, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Hỗ trợ đánh giá mối liên hệ giữa một cột số và một cột phân loại / Người dùng đồng ý / Hoàn thiện phạm vi ba loại cặp tại ANALYSIS-04; phương pháp và ngưỡng chưa chốt, giữ phạm vi VIF và không thêm biểu đồ giữa các cột.
- **Mở rộng v1 / 2026-11-03:** Hỗ trợ cả cột số và cột phân loại trong đánh giá mối liên hệ / Người dùng yêu cầu bao quát khả năng của dữ liệu / Cập nhật ANALYSIS-04, phương pháp từng loại và cặp hỗn hợp còn cần chốt; giữ phạm vi VIF và quyết định không có biểu đồ giữa các cột.
- **Xác nhận v1 / 2026-11-03:** VIF tính trên các cột số được chọn phân tích và loại cột nhãn / Người dùng đồng ý đề xuất / Chốt phạm vi VIF; câu hỏi bảng tương quan chỉ cột số hay thêm cột phân loại chưa có lựa chọn cụ thể, chưa sửa backend.
- **Điều chỉnh v1 / 2026-11-03:** Bỏ biểu đồ giữa các cột theo yêu cầu mới / Người dùng điều chỉnh phạm vi / Thay yêu cầu biểu đồ quan hệ tại ANALYSIS-04, giữ bảng tương quan, VIF và biểu đồ thống kê mô tả; chưa sửa backend.
- **Bổ sung v1 / 2026-11-03:** Thêm biểu đồ quan hệ giữa các cột và chỉ số VIF cho đa cộng tuyến / Theo yêu cầu người dùng / Cụ thể hóa ANALYSIS-04 và ANALYSIS-05; loại cột, biểu đồ cụ thể và ngưỡng đánh giá còn cần chốt, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Top N mặc định 5, cho nhập tùy ý với giới hạn tối đa 20 / Theo lựa chọn người dùng / Chốt cấu hình N là số lượng nguyên dương từ 1 đến 20, giữ giới hạn quyền Viewer và cách gộp “Khác”; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Viewer chỉ xem biểu đồ theo cấu hình đã lưu, không thay đổi N / Theo lựa chọn người dùng / Chốt quyền xem biểu đồ và lưu cấu hình Top N cùng project; đồng bộ phần 6, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Biểu đồ hiển thị Top N giá trị phổ biến, gộp phần còn lại thành “Khác”, cho phép chọn N / Người dùng đồng ý / Chốt cách giảm số nhóm hiển thị; N mặc định, giới hạn, đồng hạng và quyền Viewer còn cần làm rõ; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Đồng ý biểu đồ tỷ lệ thiếu, histogram, box plot, thanh tần suất/tỷ lệ và đường/cột theo thời gian cho thống kê mô tả / Theo xác nhận người dùng / Chốt loại biểu đồ, giữ bảng số liệu; số nhóm và quy tắc tính chi tiết còn cần thống nhất, chưa sửa backend.
- **Bổ sung v1 / 2026-11-03:** Thống kê mô tả có biểu đồ minh họa đi kèm các chỉ số và bảng số liệu / Theo yêu cầu người dùng để dễ nhìn / Cụ thể hóa nhóm biểu đồ, ghi lại các chỉ số đang đề xuất; chưa chốt loại biểu đồ hoặc triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Cho phép xuất PDF khi đang làm việc mà không cần lưu project; Viewer được tải báo cáo / Theo trả lời người dùng / Tách xuất báo cáo khỏi Lưu, bổ sung quyền tải PDF nhưng không mở quyền phân tích hoặc lưu cho Viewer; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Bổ sung xuất Tổng kết thành báo cáo PDF tải xuống / Theo yêu cầu người dùng / Chốt định dạng báo cáo, còn nguồn bản xuất và quyền xuất/tải; chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Tổng kết gồm tổng quan dữ liệu, vấn đề và mức độ ảnh hưởng, bằng chứng, đề xuất xử lý theo thứ tự ưu tiên / Người dùng đồng ý / Chốt nhóm nội dung Tổng kết; tiêu chí đánh giá và xếp ưu tiên còn cần thống nhất, giữ quy tắc khi AI lỗi; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Cho chuyển sheet và hủy lần phân tích đang chạy của sheet vừa rời / Theo lựa chọn người dùng / Chốt vòng đời phân tích khi chuyển sheet, không áp dụng kết quả đến muộn của lần đã hủy và giữ bản đã lưu; chưa chọn cơ chế kỹ thuật hoặc sửa backend.
- **Xác nhận v1 / 2026-11-03:** Phân tích hệ thống lỗi thì không tạo Tổng kết mới, yêu cầu chạy lại phân tích / Người dùng đồng ý / Chốt điều kiện thành công của phần hệ thống trước Tổng kết, giữ quy tắc riêng khi AI lỗi và bản đã lưu; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Bổ sung Thử lại AI sau sự cố, dùng lại kết quả phân tích hệ thống khi đầu vào không đổi / Người dùng đồng ý / Cho phép bổ sung giải thích và đề xuất AI mà không chạy lại phần hệ thống; giữ quy tắc quyền thao tác và bấm Lưu, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** AI gặp sự cố thì Tổng kết hiển thị kết quả phân tích của hệ thống, không có giải thích và đề xuất của AI / Theo yêu cầu người dùng / AI lỗi không chặn Tổng kết khi kết quả hệ thống hợp lệ; lỗi phân tích hệ thống và thử lại AI còn cần làm rõ, chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Phải chạy lại phân tích sau khi thay đổi dữ liệu/cột phân tích/nhãn trước khi tạo Tổng kết mới / Người dùng đồng ý / Chốt xử lý kết quả lỗi thời tại mục 3.9 và 3.18, không thay đổi bản đã lưu hoặc quyền Viewer; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Mở Tổng kết khi chưa phân tích thì yêu cầu người dùng chạy Data Analysis & Detection trước, không tự chạy thay / Theo lựa chọn người dùng / Chốt điều kiện cho luồng chưa phân tích, bỏ câu hỏi tương ứng; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Sheet không thuộc bản lưu hiện hành bắt đầu từ dữ liệu gốc và trạng thái mặc định; lưu B sau A thì quay lại A không khôi phục bản A cũ / Theo xác nhận người dùng / Chốt hành vi chuyển sheet ngoài bản lưu cuối, bỏ câu hỏi tương ứng; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Reset Dataset chỉ reset trạng thái đang làm việc của sheet hiện tại, giữ nguyên bản đã lưu đến lần Lưu thành công tiếp theo / Theo xác nhận người dùng / Chốt quan hệ giữa reset và lưu, đồng bộ mục 3.12 và 3.19; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Lưu cả bộ lọc, sắp xếp, tìm kiếm và trang đang xem cùng năm nhóm nội dung đã chốt / Người dùng yêu cầu lưu lại toàn bộ / Khôi phục đầy đủ các trạng thái đã thống nhất theo bản lưu cuối khi mở lại project; không thay đổi cơ chế bấm Lưu hoặc quyền Viewer.
- **Xác nhận v1 / 2026-11-03:** Bản lưu gồm sheet, dữ liệu làm việc và số dòng gốc đã xóa, cột phân tích/nhãn, kết quả phân tích và Tổng kết / Người dùng đồng ý năm nội dung đề xuất / Chốt nội dung nghiệp vụ của bản lưu; lựa chọn lưu trạng thái hiển thị chưa được trả lời, chưa chọn schema hoặc sửa backend.
- **Làm rõ v1 / 2026-11-03:** Viewer vẫn xem được kết quả đã lưu ở Data Analysis & Detection và Tổng kết, chỉ bị giới hạn thao tác bên trong / Theo đính chính người dùng / Đồng bộ phần 6 và giới hạn trigger chạy tại mục 3.18 theo quyền; chưa sửa backend.
- **Tinh chỉnh v1 / 2026-11-03:** Ghi nhận Viewer xem Data Views và lọc, không thao tác/tạo phân tích hoặc Tổng kết / Theo làm rõ của người dùng / Đồng bộ phần 6, còn xác nhận quyền xem kết quả đã lưu; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Từ chối lưu từ bản cũ khi đã có bản lưu mới, thông báo và yêu cầu tải lại / Người dùng đồng ý đề xuất tránh ghi đè thay đổi của người khác / Chốt nghiệp vụ xung đột lưu; chưa chọn cơ chế kỹ thuật hoặc sửa backend.
- **Xác nhận v1 / 2026-11-03:** Chốt quyền thao tác và lưu của Project Member, quyền chỉ xem của Viewer, toàn quyền của Workspace Owner / Theo xác nhận người dùng / Đồng bộ yêu cầu tính năng với phần 6; chưa sửa backend.
- **Xác nhận v1 / 2026-11-03:** Project khôi phục bản lưu cuối cùng và sheet tương ứng; lưu B thay bản hiện hành A, không lưu B thì quay lại bản A đã lưu / Theo trả lời người dùng / Không giữ bản khôi phục riêng từng sheet; quyền lưu và xung đột nhiều người còn cần chốt. Mô hình quyền mới được ghi tại phần 6.
- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 2 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
- **Bổ sung v1 / 2026-11-02:** Ghi nhận người dùng làm công việc xử lý/phân tích dữ liệu, ví dụ Data Analyst, với nhu cầu phân tích và phát hiện vấn đề dữ liệu / Theo mô tả của người dùng / Chưa suy ra vai trò phân quyền hoặc danh sách tính năng chi tiết.
- **Bổ sung v1 / 2026-11-02:** Xác nhận đầu vào là file tải lên; đầu ra là phát hiện, mô tả, bằng chứng và đề xuất xử lý / Theo trả lời của người dùng / Cần rà soát tính năng sửa/làm sạch và các chức năng phụ thuộc trước khi chốt API/schema; chưa sửa implementation.
- **Bổ sung v1 / 2026-11-02:** Ưu tiên Excel/CSV, phát hiện vấn đề cơ bản và dùng AI hỗ trợ phát hiện thêm / Theo yêu cầu người dùng / Chưa chốt nhóm lỗi, chi tiết định dạng hoặc giải pháp AI; bổ sung các ví dụ chờ thảo luận.
- **Xác nhận v1 / 2026-11-02:** Người dùng đồng ý 5 nhóm kiểm tra cơ bản DQ-01 đến DQ-05 / Theo phản hồi “Đồng ý” / Chưa chốt tiêu chí chi tiết; khả năng nhập mô tả dữ liệu và quy tắc nghiệp vụ được giữ là câu hỏi chờ xác nhận riêng.
- **Xác nhận v1 / 2026-11-02:** Hoãn tính năng nhập mô tả dữ liệu, ý nghĩa cột và quy tắc nghiệp vụ sang tương lai / Người dùng xác nhận sẽ làm nhưng hiện tại chưa cần / Không đưa vào phạm vi triển khai và nghiệm thu hiện tại; cần làm rõ nguồn tiêu chí cho các kiểm tra phụ thuộc nghiệp vụ.
- **Bổ sung v1 / 2026-11-02:** Mặc định chọn sheet đầu tiên sau khi nhập Excel và cho phép người dùng đổi sheet làm việc / Theo mô tả người dùng / Chưa quyết định hành vi chạy phân tích, lưu kết quả hoặc ngoại lệ sheet.
- **Bổ sung v1 / 2026-11-02:** Xác nhận ba phần Data Views, Data Analysis & Detection, Tổng kết; khi quay lại sheet chỉ giữ Data Views, hai phần sau chạy lại khi người dùng bấm vào / Theo mô tả người dùng / Chưa chốt trạng thái view cần giữ, phạm vi dữ liệu lọc, trigger trong cùng sheet hoặc chính sách lưu lịch sử; không suy ra ranh giới module kỹ thuật.
- **Tinh chỉnh v1 / 2026-11-03:** Data Views làm mới như vừa vào trang khi quay lại sheet; phần tích chọn cột mặc định chọn toàn bộ và chỉ được thay đổi tại Data Views / Theo trả lời người dùng / Thay mô tả giữ trạng thái view; chờ làm rõ ý nghĩa cột được tích và phạm vi dòng phân tích.
- **Bổ sung v1 / 2026-11-03:** Chốt tích chọn cột cần phân tích, mặc định toàn bộ; phân tích toàn bộ dòng của sheet không phụ thuộc bộ lọc. Ghi nhận yêu cầu xóa dòng cơ bản / Theo xác nhận và yêu cầu mới của người dùng / Mở rộng phạm vi thao tác dữ liệu, cần làm rõ xóa dòng trước khi chốt use case/API/schema và cơ chế vô hiệu hóa kết quả cũ.
- **Bổ sung v1 / 2026-11-03:** Giữ nguyên file tải lên, xóa theo số dòng file gốc, nêu rõ dòng đã xóa/cột phân tích; không cần hoàn tác từng thao tác, bổ sung Reset Dataset về trạng thái ban đầu / Theo xác nhận người dùng / Còn chờ phạm vi reset giữa các sheet và chi tiết vòng đời trạng thái/kết quả.
- **Xác nhận v1 / 2026-11-03:** Reset Dataset chỉ reset dataset đang làm việc / Theo trả lời người dùng / Không reset cả file, không chuyển về sheet đầu tiên và không tác động các sheet khác.
- **Xác nhận v1 / 2026-11-03:** Khi quay lại sheet, dữ liệu và trạng thái trở về ban đầu như vừa reset, bao gồm khôi phục dòng đã xóa / Theo điều chỉnh của người dùng / Không giữ thay đổi xóa dòng qua lần quay lại sheet; loại bỏ câu hỏi tương ứng khỏi danh sách còn mở.
- **Xác nhận v1 / 2026-11-03:** Hỗ trợ cả xóa một dòng, nhiều dòng được chọn và một khoảng dòng / Theo lựa chọn “cả 3” của người dùng / Cả ba sử dụng số dòng file gốc, giữ nguyên các quy tắc bảo toàn file và reset đã chốt.
- **Xác nhận v1 / 2026-11-03:** Đồng ý lọc văn bản, số/ngày, ô trống và kết hợp điều kiện nhiều cột / Theo phản hồi người dùng / Chỉ tác động hiển thị, chưa chốt AND/OR hoặc quy tắc so khớp chi tiết.
- **Xác nhận v1 / 2026-11-03:** Bộ lọc nhiều cột hỗ trợ cả AND và OR / Theo lựa chọn người dùng / Chưa mặc định hỗ trợ nhóm điều kiện lồng nhau; bộ lọc vẫn chỉ tác động hiển thị.
- **Xác nhận v1 / 2026-11-03:** Bổ sung sắp xếp tăng/giảm theo cột và tìm kiếm giá trị trong bảng / Người dùng đồng ý cả hai / Thuộc Data Views; chi tiết sắp xếp và tìm kiếm chờ làm rõ.
- **Bổ sung v1 / 2026-11-03:** Thêm phân tích theo thời gian khi dữ liệu có thông tin thời gian phù hợp / Theo yêu cầu người dùng / Chưa chốt cách chọn cột, chỉ số, mức tổng hợp hoặc khả năng phát hiện bất thường theo thời gian.
- **Bổ sung v1 / 2026-11-03:** Đồng ý bốn nội dung phân tích thời gian; bổ sung biểu đồ, bảng tương quan, đa cộng tuyến, đánh giá outliers và mất cân bằng có điều kiện / Theo yêu cầu người dùng / Chưa chốt phương pháp/ngưỡng; cần làm rõ “dữ liệu có dãn” và cách xác định nhãn, không mở rộng phạm vi sang frontend.
- **Tinh chỉnh v1 / 2026-11-03:** Chọn nhãn tùy chọn, mặc định không có nhãn; người dùng chủ động mở tính năng và chọn một cột từ gợi ý của hệ thống / Theo mô tả người dùng / Làm rõ luồng chọn nhãn phục vụ đánh giá mất cân bằng; còn xác nhận hành vi khi không có cột phù hợp, chưa chọn thuật toán gợi ý.
- **Xác nhận v1 / 2026-11-03:** Không thể chọn nhãn khi không có cột phù hợp; vẫn sử dụng các phân tích không cần nhãn / Theo xác nhận người dùng / Chốt hành vi khi danh sách gợi ý rỗng, loại bỏ câu hỏi tương ứng; đánh giá mất cân bằng theo nhãn cần có nhãn được chọn.
- **Xác nhận v1 / 2026-11-03:** Cho phép đổi cột nhãn hoặc bỏ chọn nhãn / Theo xác nhận người dùng / Hoàn thiện thao tác lựa chọn nhãn; cách xử lý kết quả đã có khi thay đổi nhãn vẫn cần thống nhất.
- **Tinh chỉnh v1 / 2026-11-03:** Chọn nhãn tại Data Views và chỉ rõ cột nhãn trong bảng; Data Views chốt cấu trúc dữ liệu, phân tích dùng lại kết quả khi đầu vào không đổi và chạy lại khi mở sau thay đổi / Theo yêu cầu người dùng / Làm rõ vòng đời kết quả trong cùng sheet; còn xác nhận thao tác chỉ đổi hiển thị và quy tắc Tổng kết, chưa thay đổi API hoặc implementation.

