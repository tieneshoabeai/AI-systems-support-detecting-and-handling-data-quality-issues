# Nhật ký tích hợp Concept A cho Dataset 3D

Ngày 07-11-2026. Route kiểm tra `/workspaces/3d-dataset`.

## Thay đổi

- `holographic-core.environment.tsx` thêm `export` cho `ORBIT_RINGS` và `ORBIT_Y`.
- `holographic-core.scene.tsx` import và mount `HolographicDecor` ngay sau environment, trước `NeonCubeNodes`.
- `holographic-core.decor.tsx` dùng file đính kèm với `DECOR_CONCEPT = 'star-chart'`. Concept B ở trạng thái tắt. Vignette tùy chọn được bỏ qua trong lượt tích hợp này.
- `eslint.config.js` có ngoại lệ kèm chú thích cho đúng export `ORBIT_RINGS` trong file environment. Rule Fast Refresh hiện đã cho phép `ORBIT_Y` vì giá trị là số.

Năm lượt vẽ của decor gồm lưới, nét nối chòm sao, nút chòm sao, vạch chia quỹ đạo và một `InstancedMesh` cho 15 hạt vệ tinh. Shader nhận `uTime` để điều khiển độ nhấp nháy nhẹ của nút chòm sao. JS cập nhật thời gian, góc xoay và 15 ma trận. Resize cập nhật tỉ lệ qua effect. Khi bật reduced motion, component chứa `useFrame` của Concept A được tháo, còn geometry giữ nguyên. `disposeObject` giải phóng geometry, material và bộ đệm instance khi tháo lớp.

Các lớp dùng `depthWrite: false`, `fog: false` và render order `-5` hoặc `-4`. Group dùng order `-1` để Three.js xếp decor dưới các group môi trường ngay cả khi hai object có cùng render order `-4`. Các mức alpha của decor giữ đóng góp sáng từng lớp dưới ngưỡng bloom 1.0. Decor dùng geometry tạo lúc khởi tạo và dùng shader hiện có trong module. Tích hợp thêm 0 texture, 0 render target và 0 pass hậu kỳ.

## Điều chỉnh so với file đính kèm

| Tham số | Trước | Sau |
| --- | --- | --- |
| Chòm sao trái `(azimuth, elevation)` | `(199°, −21°)` | `(199°, −12°)` |
| Chòm sao phải `(azimuth, elevation)` | `(251°, −31°)` | `(249°, −5°)` |
| Độ nghiêng thiên cầu `(x, z)`, radian | `(−0.32, 0.08)` | `(−0.23, 0.01)` |
| Opacity nút chòm sao | `0.9` | `0.48` |
| Opacity vệ tinh | `0.9` | `0.5` |
| Render order vạch quỹ đạo / vệ tinh | `1 / 8` | `−5 / −4` |

Shader dùng `smoothstep` với hai ngưỡng đúng thứ tự và chặn alpha hình nút trước khi nhân opacity. Việc chỉnh góc nâng cả hai chòm sao vào khung và đưa xích đạo lên dải phía trên core.

## Kiểm tra mã và test

- `tsc -p tsconfig.app.json --pretty false` pass. Chạy thử toàn frontend với `--strict --noUncheckedIndexedAccess` cho thấy lỗi ở mã sẵn có, gồm truy cập phần tử ở phần meteor của environment. Kết quả không có lỗi trong file decor.
- `eslint src` pass. `npm run lint` còn 12 lỗi trong các bản blockout cũ ở `.agents/holographic-core`.
- Vitest trước và sau đều 548 pass, 9 fail trên 40 file. Cùng 9 lỗi gồm 5 fingerprint, 1 orbit-clearance, 1 cấu trúc tower và 2 assertion chamber của spool core. Gate draw call spool pass cả hai lần. Ngưỡng hiện tại là 21 trong `SPOOL_CORE.budget.drawCalls`, và test chỉ đếm các phần của spool model. Không tìm thấy gate đếm toàn scene trong bộ test frontend.
- `git diff --check` pass.

## Kiểm tra WebGL

Chrome headless, 1280 × 900, DPR 1, ANGLE Metal trên Intel Iris Plus Graphics 645. Đọc `renderer.info.render.calls` ngay sau lượt render scene chính của composer để phép đo cùng loại ở hai bản. Bỏ qua 45 frame làm nóng, lấy 120 khoảng cách giữa hai callback `requestAnimationFrame`. Giữ bloom bật ở cả hai bản.

| Chỉ số | Trước | Sau |
| --- | ---: | ---: |
| Draw call trong lượt render scene | 363 | 368 |
| Khoảng cách frame p50 | 16.7 ms | 16.7 ms |
| Khoảng cách frame p95 | 16.7 ms | 16.7 ms |
| Thời gian CPU quanh lượt gọi render scene p50 | 7.0 ms | 7.1 ms |
| Thời gian CPU quanh lượt gọi render scene p95 | 10.0 ms | 9.7 ms |

Một lượt đo cùng lúc với test/lint cho p95 50 ms. Lượt đo lại sau đó cho các số ở bảng. Đo bổ sung trong cùng phiên Chrome với 3 lượt bật và 3 lượt tắt decor (120 frame mỗi lượt) cho kết quả lặp lại 363 → 368 draw call. p50 là 16.7 ms ở cả 6 lượt. p95 là 16.8 ms khi tắt và 16.7 ms khi bật. Khoảng cách frame bị giới hạn bởi tần số làm mới và thời gian CPU chỉ đo quanh lệnh render. Các số này chưa cho biết thời gian xử lý GPU riêng.

- Camera mặc định `[11.45, 9, 11.45]`. Vùng quanh core đọc rõ. Xích đạo đi chéo phía trên, còn lưới, vạch và vệ tinh mờ hơn linework của core. Hai chòm sao tách khỏi dải aurora trong ảnh kiểm tra.
- Phép chiếu vị trí hai chòm sao cho hộp x/y lần lượt `[245, 430, 435, 508]` và `[973, 391, 1125, 501]` theo pixel viewport. Cả hai tách khỏi legend mở và nút detach. Mười tinh thể đều chiếu ngoài khung theo trục x ở camera mặc định.
- Kéo camera xuống polar `89.11°`, đúng giới hạn `maxPolarAngle`, rồi kiểm tra góc cao `41.55°`. Ảnh hai góc giữ đường nền liên tục và không có lỗi cắt hình quan sát được. Chrome không báo lỗi WebGL/shader trong lượt kiểm tra. Ảnh tĩnh tại hai góc chỉ xác nhận hình ở các thời điểm chụp.
- Đổi `prefers-reduced-motion` khi scene đang chạy. Hai lần lấy mẫu cách nhau 500 ms có cùng `uTime`, góc lưới, góc vạch chia và phiên bản ma trận instance. Sau khi bật motion lại, các giá trị tiếp tục cập nhật.
