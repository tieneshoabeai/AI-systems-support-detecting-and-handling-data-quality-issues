# Review đặc tả cụm holographic

> **Bản lịch sử v1.** Người dùng đã cung cấp hai ảnh rõ hơn và duyệt thay nguồn tham chiếu. Phân tích hiện hành ở [reference-v2/review.md](reference-v2/review.md), với JSON đề xuất mới; xem [active-reference.json](active-reference.json). Spec và blockout v1 bên dưới được giữ để đối chiếu, chưa được cập nhật hoặc nghiệm thu theo ảnh mới. Các kết quả strict/kiểm tra ghi trong tài liệu này chỉ thuộc v1.

## Kết quả batch hoàn thiện spec

Chỉ sửa JSON và tài liệu trong `.agents/holographic-core/`. Chưa dựng factory, chưa tạo preview, chưa sửa frontend, chưa commit. Quyền hiện tại chỉ bao gồm đặc tả và kiểm tra; `implementationAuthorization` trong spec vẫn khóa phần triển khai.

- Validator thông thường: đạt, không lỗi/cảnh báo.
- Strict-quality: đạt, không lỗi/cảnh báo; xem `validation-strict.json`.
- Kiểm tra tính nhất quán: đạt 9 nhóm; xem `validation-contract-checks.json`.
- Chưa chạy trình duyệt, đo FPS, so ảnh render hoặc kết luận độ giống.

Strict đạt có nghĩa hợp đồng đặc tả đủ nhất quán theo validator hiện tại. Nó không xác nhận camera đúng, giả thuyết hình học đã giống ảnh, custom field được generator hỗ trợ, hoặc người dùng đã duyệt code.

## Hình khối được giữ lại

Tổng cộng 14 component, 4 vật liệu và 3 hệ lặp; 12 chi tiết nhận diện vẫn liên kết đến localFeatures và crop bằng chứng. Năm khung hộp, số lớp, vị trí và kích thước là tham số thử nghiệm để review, không phải số đo khôi phục từ ảnh.

| Hệ | Tham số đề xuất trong spec | Cần kiểm tra khi được duyệt dựng |
|---|---|---|
| Lõi | Bán kính 0.9, cao 1.8, tâm tọa độ tại lõi | Giữ thể tích xanh, không thành ống rỗng |
| Nắp | Cao 0.04, bán kính 0.92, khoảng Y [0.88, 0.92] | Giao lõi tại đỉnh Y=0.9 một đoạn 0.02 |
| Lớp dưới thứ nhất | Rộng 2.3, cao 0.48, tâm Y=-0.98 | Giao hình chiếu lõi 0.16, nhưng không giả quan hệ gắn cơ khí |
| Lớp dưới thứ hai | Rộng 2.6, cao 0.19, tâm Y=-1.34 | Khoảng hở với lớp trên 0.025, không chia tầng đều |
| Khung hộp | Năm khung, cao 3.25 / 2.65 / 1.55 / 2.8 / 1.4 | Edge cage và mặt mờ, không dùng hộp đặc làm kết quả cuối |
| Vành tím | Đường kính 5.5, cao 0.055 | Dải mỏng, có nhiều contour |
| Vòng cyan | Đường kính 5.9 và 4.8, các cao độ gần nhau | Giữ các vòng phụ và khoảng tối |
| Nền chiếu | Rộng 4.6, cao 0.045, tâm Y=-1.7 | Lơ lửng, không thêm chân đỡ hoặc đế kính studio |

## Quan hệ và tọa độ

ID `root` dành cho nhóm wrapper do factory tạo, không dùng làm ID lõi. Lõi đổi thành `core-body`. Những lớp chiếu độc lập có `parent=null` và nằm dưới wrapper; xoay toàn cảnh dùng wrapper, xoay riêng lõi không kéo các vành và khung theo.

Chỉ nắp khai attachment vào `core-top` của lõi. Endpoint, bán kính và độ giao được tính nhất quán với kích thước nắp. Các lớp lơ lửng không khai socket hoặc overlap giả. Điểm sáng dưới thuộc platform về ownership; không khẳng định có liên kết cơ khí.

Gốc tọa độ chuyển về tâm lõi. Camera và look-at cùng được dịch theo để giữ giả thuyết bố cục tương đối. Đã kiểm tra khoảng hở lớp dưới; tâm lớp thứ hai sửa từ -1.29 thành -1.34 để đúng mô tả khoảng hở, thay vì vô tình giao nhau.

## Vật liệu hologram và textureless

Đã đọc code generator: nhãn `type=basic` không chuyển nó thành MeshBasicMaterial. Generator hiện tạo MeshPhysicalMaterial. Spec nay mô tả đúng nhánh được hỗ trợ: vật liệu matte, emission chiếm ưu thế, alpha nhẹ; roughness là scalar thật, transmission/metalness/clearcoat bằng 0 và environment intensity bằng 0. Không dùng đặc tính khúc xạ kính để tạo phong cách holographic.

Nhánh `textureless` có sẵn trong validator và generator được áp dụng **cho các mặt màu nền đồng nhất**. Đây là quyết định biểu diễn có bằng chứng, không phải khẳng định toàn cảnh không có chi tiết:

- Thể tích xanh, mặt mờ và mặt dải vòng dùng carrier màu đồng nhất.
- Lưới trụ, lưới mặt phẳng, cạnh khung, contour và cung nhấn dùng hình học riêng.
- Độ đậm lõi, độ mờ khung sau và một số cung sáng dùng scalar theo submesh.
- Không tạo normal/roughness/AO map, độ phân giải texture hoặc điểm tin cậy PBR giả.
- Nếu implementation sau này dùng bitmap hoặc texture sampling để vẽ các chi tiết này, phải đánh giá lại khai báo textureless và các gate tương ứng.

Bằng chứng, crop, giới hạn và audit generator nằm trong `material-evidence.json`. Màu hex, opacity và emissiveIntensity là đề xuất mỹ thuật; không gọi chúng là albedo vật lý đã đo.

Đánh đổi: đường hình học tăng chi phí đỉnh/draw call. Sau khi được duyệt hình ảnh có thể merge các đường cùng material hoặc instance. Không giảm chi tiết nhận diện để đạt một chỉ tiêu hiệu năng chưa đo.

## Sửa lỗi hợp đồng vành

Generator đọc `geometryDescriptor.latheProfile`, không đọc trường `profile` cũ. Ba vành nay có profile chuẩn hóa: bán kính ngoài 0.5, chiều cao 1, sau đó nhân kích thước component đúng một lần. Kiểm tra không còn profile sai tên hoặc scale hai lần.

## Pixel, camera và giới hạn bằng chứng

Viewport review tham chiếu vẫn là **468 × 360 px**. Tọa độ mesh là đơn vị nội bộ; camera chiếu ra pixel, không có quy tắc 1 đơn vị Three.js bằng 1 pixel.

Camera giữ `solved=false`. Vị trí thử nghiệm [5,2.5,8], look-at [0,-0.35,0], FOV 40 độ; yaw/pitch được tính nhất quán với vector nhìn và ghi đơn vị radian. Đây chưa phải camera calibration.

Các điểm chưa biết từ ảnh được giữ trong `preSpecAssessment.referenceLimitations` với trạng thái chưa kiểm chứng, thay vì xếp mọi giới hạn đơn ảnh thành input bắt buộc phải có trước khi viết một spec thử nghiệm. Không có giới hạn nào được tuyên bố đã đo xong hoặc đã được render chứng minh. Quyền triển khai vẫn phải qua human review riêng.

- `reference-masked.png` chỉ là ROI; không dùng biên polygon làm silhouette chuẩn.
- Vùng nhãn bị che không phải lỗ hình học và không được tự phục hồi pixel.
- Góc bên/sau dùng kiểm tra cấu trúc, không phải bằng chứng về mặt khuất của ảnh gốc.
- Bóng tiếp xúc và sàn phản chiếu không được thêm vào cảnh hologram lơ lửng. Setup ánh sáng trung tính chỉ phục vụ review hình học.

## Những gì strict chưa chứng minh

Code stock generator chưa được xác nhận thực hiện toàn bộ `renderIntent`, các đường lưới/contour, scalar theo submesh hoặc `depthWrite/blending` trong `rendererIntent`. Các trách nhiệm này được ghi trong `renderLayerContract`, không coi việc JSON hợp lệ là bằng chứng feature đã hiện ra.

Sau khi tạo preview phải inspect material thực, so ảnh khi bloom tắt rồi mới bật bloom có kiểm soát. Không chuyển pass nếu hình lại thành tháp đĩa, thiếu khung hộp, miệng ống tối hoặc lưới sáng đồng đều.

## Bước kế tiếp cần duyệt riêng

Đề xuất một preview blockout tĩnh, riêng trong `.agents/holographic-core/blockout/`, chưa ghép vào màn thật:

1. Tạo factory/carrier và viewer theo spec; triển khai edge cage trung tính cho khung hộp.
2. Không thêm màu holographic, bloom, animation, API hoặc Auth.
3. Chụp góc tham chiếu 468 × 360; so cap, ellipse và các góc khung, hiệu chỉnh camera bằng bằng chứng.
4. Chụp thêm các góc cấu trúc và mở review diff để người dùng duyệt trước structural/material pass.

Đây là đề xuất phạm vi cho lượt sau, không phải implementation đã được cấp quyền trong batch này.

## Prompting log

| Bước | Kết quả |
|---|---|
| Yêu cầu | Hoàn thiện spec hologram, không dựng hay sửa frontend |
| Đặc tả | Tách wrapper/lõi, attachment thật, các projection độc lập, textureless carrier + chi tiết hình học |
| Kiểm tra | Schema thường, strict-quality và 9 nhóm kiểm tra nhất quán đều đạt |
| Pseudocode | Validate → human review plan → dựng pass đang mở → capture → so reference → review từng hệ |
| Prompt/code | Chưa phát hành mã triển khai hoặc chạy generator |
| Quyết định | Spec đủ qua validator; runtime, camera calibration và độ giống còn chờ bước dựng được duyệt |
