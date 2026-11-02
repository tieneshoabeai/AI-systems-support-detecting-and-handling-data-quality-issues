# Đặc tả tham chiếu v2 — cụm holographic

## Trạng thái và phạm vi

Đã cập nhật phân tích từ hai ảnh mới và chuyển phương án 9 cột/8 mảng đã được người dùng duyệt thành formal spec v2. Chưa sửa factory, viewer hoặc source frontend. Bản spec và blockout v1 vẫn giữ nguyên để đối chiếu; preview đó chưa thể đại diện cho ảnh mới.

`reference-analysis.json` giữ quan sát và giới hạn bằng chứng. `geometry-proposal.json` là thiết kế khởi đầu đã được duyệt, không phải số đo khôi phục từ nguồn. Formal spec hiện hành ở [object-sculpt-spec.json](object-sculpt-spec.json); xem [formal-spec-review.md](formal-spec-review.md) để đọc kết quả validator, hợp đồng trục hình học và giới hạn. Kết quả v2 được chạy riêng, không kế thừa validator v1.

## Nguồn có thẩm quyền

| Nguồn | Kích thước | Vai trò và giới hạn |
|---|---|---|
| `reference-primary.png` | 1430 × 1100 px | Chuẩn chính về hình dáng, tỷ lệ ảnh chiếu, màu và camera; admission đạt |
| `views/support-top.png` | 892 × 814 px | Quan sát bố trí quanh lõi và phân đoạn hướng tâm; không mặc định orthographic hoặc đúng 90 độ |
| `views/support-front.png` | 637 × 474 px | Hỗ trợ đọc chiều cao và quan hệ lõi/cột/đế |
| `views/support-rear.png` | 637 × 392 px | Hỗ trợ kiểm tra giả thuyết phía sau, không chứng minh chính xác mặt khuất của ảnh chính |

Ba crop hỗ trợ đã bỏ nhãn và đường chia panel. Công cụ admission vẫn nhận nền navy thành foreground 100%, nên **không dùng chúng làm silhouette chuẩn hoặc số đo 3D**. Ảnh vẫn hữu ích để quan sát định tính. Không tạo mask mới để giả kết quả đạt. Nếu cần so định lượng với các góc này, phải xử lý mask và kiểm tra tính nhất quán giữa các hình trước.

Hai bản sao ảnh gốc giữ nguyên byte, đã đối chiếu SHA-256. Crop dùng công cụ có sẵn của skill, không vẽ lại, upscale hoặc tạo pixel mới. `reference-provenance.json`, `view-crops.json` và `primary-crops.json` ghi đường dẫn và vùng cắt.

## Những gì phải sửa về cách hiểu hình khối

1. **Thân trụ và vành mở ở giữa là hai trách nhiệm khác nhau.** Crop lõi cho thấy vành giữa rộng bao quanh thân hẹp. Không dùng một cylinder đặc lớn thay vành, vì sẽ che mất thân ở giữa.
2. **Đế có thành cong và bề rộng dạng vành.** Tách thành shell, deck, các contour và những mảng hướng tâm. Không dùng đĩa đặc mỏng làm toàn bộ đế.
3. **Các cột được bố trí quanh lõi.** Năm hộp trong v1 chỉ là bản thử từ ảnh mờ; cần một tập vị trí polar có khoảng hở và chiều cao khác nhau.
4. **Vòng tím gắn về thị giác với vùng đế.** Không đọc nó thành một halo độc lập ở độ cao tùy ý.
5. **Chi tiết có nhiều hệ tọa độ.** Lưới trụ, lưới mặt hộp, lưới đồng tâm/hướng tâm và các cụm ô dữ liệu phải được đặc tả riêng.

Không khẳng định phần giữa đế là một lỗ xuyên vật lý: ảnh còn có trường lưới chiếu bên trong. Đề xuất là vành đế bên ngoài + trường chiếu mờ bên trong, không phải một sàn đục hoặc một khoang máy tự nghĩ ra.

## Tỷ lệ đề xuất để duyệt

Đơn vị dưới đây là đơn vị mô hình tương đối, lấy bán kính thân lõi bằng 0.9. Chưa phải số đo 3D khôi phục từ ảnh. Trục Y hướng lên; gốc tại tâm đáy đế, không còn tại tâm lõi như v1.

| Bộ phận | Đề xuất | Ý nghĩa |
|---|---|---|
| Thân trên | R=0.9, Y từ 1.30 đến 2.40 | Thân hẹp, có nắp kín |
| Nắp | R=0.92, dày 0.04, tâm Y=2.40 | Có grid hướng tâm/đồng tâm và điểm sáng giữa |
| Thân dưới | R=0.9, Y từ 0.35 đến 1.30 | Tiếp tục thân bên dưới vành giữa |
| Vành giữa | R ngoài 1.45, R trong 0.915, cao 0.32, tâm Y=1.18 | Dạng vành mở quanh thân, không phải cylinder đặc |
| Vành dưới | R ngoài 1.32, R trong 0.915, cao 0.10, tâm Y=0.44 | Phân tầng thấp rõ ràng |
| Chân lõi thấp | R=0.96, Y từ 0.10 đến 0.35 | Phần mờ/che khuất, confidence thấp hơn |
| Shell đế | R ngoài 3.10, R trong 2.15, Y từ 0 đến 0.45 | Có chiều cao thành cong |
| Mặt vành đế | R từ 2.15 đến 3.10, tại Y=0.45 | Có grid hướng tâm và đồng tâm |
| Mảng hướng tâm | **8 mảng đề xuất**, mỗi mảng rộng 24 độ, R ngoài 3.20 | Có khoảng hở và nhô cục bộ; số 8 chưa phải số đếm xác nhận từ nguồn |
| Vòng tím | R=2.53, Y=0.52 | Nằm gần mặt trên của vành đế |

Đường kính bao ngoài đề xuất 6.4, đường kính thân lõi 1.8: tỷ lệ khoảng 3.56. Đây là điểm bắt đầu để so ảnh, không thay cho hiệu chỉnh camera/phối cảnh.

## Bố trí cột đề xuất

**Đề xuất 9 cột**, chưa tuyên bố nguồn có đúng 9 cột. Mỗi cột bắt đầu ở Y=0.45; một cột cao nhất phía sau, các cột còn lại cao thấp khác nhau.

Góc 0 độ hướng +Z, X = R × sin(góc), Z = R × cos(góc). JSON chứa cả tham số polar lẫn tâm XYZ để dò lại. Các số là giả thuyết có thể sửa khi duyệt.

| Cột | Góc | Bán kính bố trí | Rộng × sâu | Cao |
|---|---:|---:|---|---:|
| 01 — cao nhất phía sau | 225° | 2.05 | 0.76 × 0.76 | 3.00 |
| 02 | 180° | 1.93 | 0.48 × 0.48 | 2.15 |
| 03 | 140° | 1.98 | 0.45 × 0.45 | 1.80 |
| 04 | 95° | 2.02 | 0.42 × 0.42 | 1.20 |
| 05 | 55° | 1.94 | 0.36 × 0.36 | 0.85 |
| 06 | 15° | 1.98 | 0.40 × 0.40 | 1.00 |
| 07 | 330° | 2.02 | 0.42 × 0.42 | 1.30 |
| 08 | 285° | 1.96 | 0.46 × 0.46 | 2.00 |
| 09 | 250° | 1.92 | 0.46 × 0.46 | 2.20 |

Bán kính cột cao nhất được chọn để footprint không chạm vành giữa trong đề xuất. Đây là kiểm tra tính nhất quán của mô hình thử, không phải bằng chứng về khoảng cách thật trong ảnh.

## Vật liệu và chi tiết cần giữ

Inventory mới có **25 chi tiết**, liên kết đến localFeatures của 14 nhóm trách nhiệm. Nhóm trách nhiệm không đồng nghĩa với số mesh sẽ được dựng.

- Mặt xanh tạo thể tích, không thành kính trong không màu.
- Cyan phân biệt grid, cạnh và điểm sáng; không để tất cả đường cùng độ sáng.
- Tím chủ yếu ở vòng đế và một số vòng thấp.
- Lưới mặt đỉnh/đế dùng tọa độ polar; thân dùng cylindrical; cột dùng planar.
- Các ô/vạch dữ liệu tập trung theo vùng, không rải hạt tùy ý.
- Chưa kế thừa khai báo textureless của v1. Chọn geometry, instancing hoặc shader/map cho từng lớp chi tiết phải có hợp đồng riêng, không làm mất chi tiết để qua validator.

## Pixel và camera

Ảnh chính 1430 × 1100 có cùng tỷ lệ 1.3 với viewport review 468 × 360. Có thể thu nhỏ đồng tỷ lệ, không kéo méo. Bounding box/cap/vòng trong JSON là ước lượng bằng mắt, không phải segmentation.

Camera vẫn `solved=false`. Điểm khởi đầu đề xuất: FOV 40°, azimuth 45°, elevation 20°. Vị trí và khoảng cách cuối cùng phải fit sau khi hình khối được dựng và so landmark. Góc nhìn cao trong sheet không được mặc định là camera orthographic nhìn thẳng 90°.

## Test case trước implementation

| Mã | Nhóm | Tình huống | Kết quả mong đợi |
|---|---|---|---|
| R01 | Thường | Các ảnh khác nhau về tỷ lệ/chi tiết | Ảnh chính quyết định appearance; ghi mâu thuẫn, không lấy trung bình tùy ý |
| R02 | Thường | Layout 9 cột/8 mảng | Nhãn proposal rõ, không báo là số đếm đã xác minh |
| R03 | Thường | Tính tâm cột từ polar | XYZ khớp công thức và cao độ tâm bằng đáy + cao/2 |
| R04 | Biên | Thu 1430 × 1100 về 468 × 360 | Cùng hệ số X/Y, không bóp hình |
| R05 | Không hợp lệ | R trong >= R ngoài hoặc chiều cao <= 0 | Đề xuất không hợp lệ, không đưa sang builder |
| R06 | Không hợp lệ | Cột giao footprint hoặc chạm thân/vành giữa ngoài ý định | Báo lỗi hình học đề xuất trước khi render |
| R07 | Đặc biệt | Crop hỗ trợ admission không đạt | Chỉ dùng định tính; không tính silhouette pass hay điểm camera |
| R08 | Đặc biệt | Mở preview v1 sau khi đổi ảnh | Xác định là bản cũ, không coi là build v2 |
| R09 | Thường | Đọc 25 chi tiết | Mỗi ref tồn tại trong localFeatures và chỉ đến ảnh/crop hiện có |
| R10 | Không hợp lệ | Dùng đĩa đục thay đế hoặc cylinder đặc thay vành | Không đạt tiêu chí hình học, dù ảnh glow nhìn đẹp |

Các kiểm tra dữ liệu nguồn/liên kết/tỷ lệ/layout có thể chạy ngay. Các tiêu chí hình ảnh, vật liệu và camera chưa thể chạy vì chưa có blockout v2.

Đã chạy và đạt kiểm tra SHA/kích thước ảnh, vùng crop, liên kết 25 chi tiết, đồng bộ assessment, công thức polar, footprint cột không chồng nhau, khoảng cách với vành giữa, bán kính vành hợp lệ, phân đoạn không giao nhau và tỷ lệ viewport. Báo cáo ở [validation-data-contracts.json](validation-data-contracts.json). Đây là kiểm tra dữ liệu đề xuất, không phải test runtime, strict-quality hay độ giống hình ảnh.

## Pseudocode và prompt cho bước sau

1. Đọc ảnh chính và các vai trò bằng chứng đã ghi.
2. Nhận các tham số hình học đã được người dùng duyệt.
3. Kiểm tra bán kính, chiều cao, khoảng hở và layout polar.
4. Chuyển đề xuất sang ObjectSculptSpec; đánh dấu trách nhiệm generator hỗ trợ/chưa hỗ trợ.
5. Chạy validator. Chỉ dựng khi các gate và phạm vi source đã được duyệt.
6. Dựng blockout trung tính, so landmark với ảnh chính, rồi mới xét các lớp màu và ánh sáng.

```text
CONTEXT: Dự án React/TypeScript/Three.js; chỉ cụm trung tâm. Nguồn hiện hành là reference-v2/reference-primary.png; ba crop sheet chỉ hỗ trợ định tính.
TASK: Sau khi người dùng duyệt geometry-proposal.json, chuyển thành ObjectSculptSpec v2 và lập plan sửa blockout riêng; chưa tự chạy source implementation.
INPUT: reference-analysis.json, geometry-proposal.json, assessment.json và crop/admission reports.
CONSTRAINTS: Không biến proposal thành số đo; giữ lõi kín, vành mở, đế có chiều cao, cột quanh lõi và 25 detail refs. Không kế thừa pass v1; không bỏ chi tiết để qua gate.
EXAMPLES: Vành giữa phải có vùng mở quanh thân hẹp. Dùng cylinder đặc che thân là lỗi, phải sửa spec trước khi render.
OUTPUT: Formal spec, danh sách quyết định và giới hạn, kế hoạch file/capture/test để human review.
CRITERIA: Qua test dữ liệu có liên quan; validator đúng phạm vi; không gọi JSON pass là fidelity pass.
```

## Nhật ký

Đã thực hiện intake, crop, quan sát, local search, assessment và inventory. Người dùng đã duyệt phương án khởi đầu 9 cột/8 mảng; formal spec v2 đã qua validator riêng. Chưa có build hoặc visual score v2. Plan dựng lại nằm ở [blockout-v2-plan.md](blockout-v2-plan.md), còn chờ quyền triển khai riêng.
