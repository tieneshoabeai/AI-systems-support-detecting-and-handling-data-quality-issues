# DisplayBase

Trong Vite dev, mở `/auth/login?preview=display-base&view=front`. Các góc cố định là `front`, `left`, `right`, `top` và `low`. Bật `slabs=1` để thấy hai khối mẫu theo kích thước hiện tại của panel. Bật `overlay=1` ở góc `front` và chọn `login1.jpg` để so hình ở độ mờ 50%.

`DisplayBase` đặt gốc tọa độ tại tâm mặt trên, với Y hướng lên. Hai slot `login` và `register` nhận mesh có đáy ở Y = 0. Đế và các điểm đặt chân được giữ trong cùng một hệ tọa độ.

| Tham số | Tác dụng |
| --- | --- |
| `tiers` | Tên mesh, bán kính, chiều cao, bo trên, bo dưới và màu tạm của ba tầng theo thứ tự từ trên xuống |
| `radialSegments`, `bevelSegments` | Số phân đoạn theo chu vi và trên từng cạnh bo |
| `ring` | Bán kính ống torus và các màu cyan, xanh lam, tím |
| `floor` | Kích thước, vị trí Y và màu sàn |
| `sockets` | Tọa độ hai điểm đặt chân và độ lún vào mặt trên |
| `effects` | Cường độ quầng sáng cục bộ, vòng phụ, gợn sàn và chuyển động |
| `low` | Bỏ PMREM, quầng vòng, vòng phụ, gợn sàn và các điểm lóe |
| `displayBaseReviewCamera` | FOV, tỷ lệ ảnh, góc camera và độ dịch khi chồng ảnh |

Các cờ review là `quality=low`, `upper=1`, `ripples=1` và `motion=1`. Số draw calls và tam giác bên dưới preview lấy từ `renderer.info.render` cho góc đang xem. Chuyển động mặc định tắt và tuân theo `prefers-reduced-motion`.

Ba tầng dùng vật liệu bóng tối với môi trường PMREM tạo bằng code. Vệt sáng trên sàn và quầng vòng là lớp sáng cục bộ, mô phỏng phản chiếu và bloom mà không làm mờ chữ trên panel. Bán kính, độ dày, vệt sáng và mặt dưới là các xấp xỉ từ ảnh.

Trong trang đăng nhập, đế và hai panel xoay ngang quanh tâm chung. Tâm được căn theo vùng chiếm chỗ của hai panel trên mặt đế. Sàn và ánh sáng trên sàn nằm ngoài nhóm xoay. Đế được vẽ cùng cảnh nền nên shader kính có thể khúc xạ hình đế.
