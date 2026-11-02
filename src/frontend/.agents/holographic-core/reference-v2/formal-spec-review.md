# Formal spec v2 — kết quả và giới hạn

## Kết quả

Phương án **9 cột, 8 mảng hướng tâm** đã được người dùng duyệt làm thiết kế khởi đầu. Formal spec ở [object-sculpt-spec.json](object-sculpt-spec.json). Nó chưa phải bằng chứng mô hình giống ảnh hoặc source đã được triển khai.

Spec có **32 component**, 5 vật liệu, 8 hệ lặp và 25 chi tiết nhận diện được giữ nguyên ý nghĩa từ phân tích v2:

| Nhóm | Số component | Trách nhiệm |
|---|---:|---|
| Lõi | 6 | Hai đoạn thân hẹp, nắp kín, hai vành mở, chân lõi thấp |
| Cột | 9 | Các vị trí polar đã duyệt, chiều cao khác nhau |
| Đế | 10 | Thành vành, mặt vành và 8 mảng hướng tâm |
| Vòng tím | 1 | Dải mỏng gần mặt đế |
| Các viền đế | 3 | Viền trên, dưới và viền trong |
| Trường chiếu trong | 1 | Carrier mờ, bắt buộc tránh đĩa đục |
| Điểm nhấn sáng | 2 | Tâm nắp và vùng vòng phía trước |

Mỗi phần có ID, parent, kích thước, transform, vật liệu, pivot và trách nhiệm localFeatures. `root` được dành cho wrapper của factory, không phải ID của một khối. Các nhóm logic trong `assemblyGroups` không bị giả thành mesh container.

## Đọc phần hình học quan trọng

**Vành tròn đầy đủ:** dùng `lathe` với `geometryDescriptor.latheProfile`. Bán kính ngoài của profile chuẩn hóa là 0.5; sau đó áp dụng dimensions đúng một lần. Bán kính trong luôn lớn hơn 0 nên không biến vành thành trụ đặc.

**Mảng hướng tâm:** dùng `extrude` và `geometryDescriptor.profile2D`, đúng đường dựng được generator hiện tại hỗ trợ. Mỗi mảng có đường biên cung ngoài/cung trong gồm 16 đoạn mỗi cung, góc rộng 24 độ và khoảng trống góc 21 độ giữa hai mảng kế tiếp. Bán kính ngoài 3.2 vượt đế 3.1 như thiết kế khởi đầu.

Hợp đồng trục của mảng cần đọc kỹ:

```json
{
  "primitive": "extrude",
  "geometryDescriptor": { "profile2D": { "depth": 1 } },
  "transform": { "rotation": [-1.5707963267948966, 0, 0] }
}
```

Đoạn trên chỉ minh họa các trường trọng tâm; profile điểm đầy đủ nằm trong từng component của JSON, không phải mã/đặc tả thay thế có thể chạy riêng.

- Profile XY được chuẩn hóa theo footprint X/Z của chính mảng đó.
- `dimensions.width` là độ rộng X trước xoay; `dimensions.height` là độ rộng Z trước xoay; **`dimensions.depth` là chiều dày theo Y sau xoay**.
- Generator extrude từ Z=0 đến Z=depth, không tự căn giữa. Phép xoay X=-90 độ biến chiều extrude thành +Y.
- Vị trí node đặt tại đáy mảng, có bù tọa độ parent `base-shell`. Kết quả dự kiến phải nằm từ **Y=0 đến Y=0.5**.
- `expectedWorldBounds` lưu giới hạn để kiểm tra, không đoán bằng tên trường height.

Không có `transform.scale=[1,1,1]` ở component, vì generator ưu tiên trường đó và sẽ bỏ qua dimensions. Pivot và wrapper vẫn giữ scale đơn vị theo hợp đồng factory.

**Nắp:** endpoint parent-local và socket cho ra khoảng Y thế giới 2.38–2.42, giao thân trên 0.02. Các lớp chiếu lơ lửng không có socket/overlap giả để vượt gate.

## Chi tiết và vật liệu

25 ref trong inventory đều trỏ đến localFeatures có owner rõ ràng. Những đặc điểm thuộc cả một nhóm, như độ cao các cột hoặc các mảng đế, có `memberComponentRefs` liệt kê đủ instance; không được dựng instance đầu rồi coi là đã phủ cả nhóm.

Năm vật liệu mô tả các carrier màu đồng nhất: blue volume, cyan contour, violet band, blue faces và faint field. Nhánh textureless được đánh giá lại cho v2, có bằng chứng riêng trong [material-evidence-formal.json](material-evidence-formal.json):

- Không suy ra roughness/normal/AO map hay điểm tin cậy PBR giả từ ảnh hologram.
- Các lưới, contour và glyph dữ liệu vẫn là trách nhiệm hình học/instance và scalar theo submesh.
- Nếu implementation dùng map hoặc texture sampling thay cách biểu diễn này, phải đánh giá lại khai báo vật liệu và các gate tương ứng.
- Màu hex, alpha và emission là giá trị khởi đầu mỹ thuật, không phải albedo vật lý đã khôi phục.
- Mật độ glyph cuối cùng phải được ghi và review ở surface-pass; chưa gọi số glyph trong nguồn là đã biết.

Generator hiện tạo MeshPhysicalMaterial. Spec dùng roughness scalar thật, emission và alpha, không dùng nhãn `basic` để giả rằng đã có unlit material. Những trường `renderIntent`, `rendererIntent`, line/glyph và localOverride vẫn cần code adapter và kiểm tra runtime; schema đạt không có nghĩa generator đã thực hiện mọi trường.

## Kết quả kiểm tra

- [validation-normal.json](validation-normal.json): validator cấu trúc đạt, không lỗi/cảnh báo.
- [validation-strict.json](validation-strict.json): strict-quality đạt, không lỗi/cảnh báo.
- [validation-formal-contracts.json](validation-formal-contracts.json): kiểm tra toán học về hierarchy, cap, vị trí cột, profile vành, trục/giới hạn thế giới của 8 mảng, inventory và quyền triển khai.

Kiểm tra toán học không phải phép triangulate mesh, test WebGL, FPS hoặc đo độ giống. Chưa chạy generator v2, chưa tạo source hoặc render v2, chưa ghi `continue` cho bất kỳ visual pass nào.

## Camera và nguồn ảnh

Ảnh chính 1430 × 1100 px là chuẩn appearance. Review 468 × 360 px giữ cùng tỷ lệ. Camera khởi đầu FOV 40°, azimuth 45°, elevation 20° có vị trí/look-at nhất quán về toán học, nhưng **`solved=false`** cho đến khi có overlay render chứng minh.

Ba ảnh hỗ trợ vẫn chỉ định tính vì chưa có mask admission hợp lệ và chưa chứng minh các view thuộc cùng một mesh. Không kế thừa bất kỳ điểm strict/visual nào của v1.

## Bước tiếp theo

Plan cụ thể ở [blockout-v2-plan.md](blockout-v2-plan.md). Cần người dùng duyệt plan nguồn trước khi tạo preview v2; formal spec không tự cấp quyền sửa source.
