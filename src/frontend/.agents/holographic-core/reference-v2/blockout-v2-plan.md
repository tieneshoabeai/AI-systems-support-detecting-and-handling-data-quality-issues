# Plan dựng blockout v2 — đã được người dùng duyệt

## Mục tiêu và đầu ra

Tạo blockout tĩnh trung tính theo formal spec v2 đã kiểm tra: lõi có vành mở, 9 cột, đế có thành cong và 8 mảng hình quạt. Xuất PNG tại góc tham chiếu 468 × 360 px cùng các góc cấu trúc, bảng kích thước runtime và comparison để người dùng review.

Không coi blockout hoàn thành là material-pass hoặc độ giống đã được chấp nhận. Các view hỗ trợ không dùng làm silhouette chuẩn định lượng.

## File dự kiến

Chỉ thêm nguồn trong `reference-v2/blockout/`, giữ nguyên preview v1:

- `generated-core.ts`: bản factory current-pass từ generator; đưa mã vào project bằng apply_patch để review.
- `main.ts`: adapter trung tính, khung cạnh cột, trường lưới trong dạng mở, camera/part registry, export bằng chứng.
- `index.html`, `review.css`: viewer riêng và các nút chọn góc/xuất ảnh/chọn hoặc tách phần để kiểm tra.
- `tsconfig.json`: typecheck giới hạn trong preview.
- PNG và JSON dưới `reference-v2/blockout/evidence/`: ảnh thật từ WebGL và metadata camera/mesh/parts.

Không sửa router, Auth, API, backend, package manifest hoặc lockfile; chưa cài dependency mới và chưa tích hợp vào màn sản phẩm.

## Trình tự

1. Chạy lại strict-quality và state gate. Chỉ dựng pass đang mở.
2. Tạo 32 carrier/pivot ID bằng primitive hỗ trợ, kiểm tra dimensions, cap endpoints, latheProfile và profile2D. Chưa đổi các kích thước/9 cột/8 mảng đã duyệt nếu chưa báo impact.
3. Dùng màu xám trung tính; cột có cạnh 3D, inner field dạng mở. Không thêm bloom, vật liệu kính hoặc chuyển động tự động.
4. Dùng nền xám đen trung tính trong ảnh diagnostic để công cụ không nhận nền navy bão hòa thành foreground toàn khung. Nền màu tham chiếu chỉ xét ở look-dev sau.
5. Đo bounds/kích thước thực trong Three.js, không chỉ đọc JSON. So và hiệu chỉnh camera từ cap, ellipse đế và đỉnh cột cao nhất với ảnh chính. Giữ lại camera seed và giá trị cuối có bằng chứng.
6. Xuất ảnh front/right/rear/left và góc cao; kiểm tra part registry, chọn bộ phận và tách bố cục có thể khôi phục. Không tự xoay hoặc biến dạng hình học.
7. Chạy typecheck giới hạn, diagnostics và gate cấu trúc phù hợp. Nếu một gate không áp dụng hoặc không đạt thì ghi đúng lý do, không đổi màu/ảnh chỉ để nhận pass.
8. Mở review diff, đưa ảnh cùng các sai lệch còn lại vào chat. Không chuyển sang structural/material pass nếu chưa có review hợp lệ.

## Tiêu chí và giới hạn

- Đủ 32 carrier ID, 9 cột và 8 mảng; field không thành đĩa đục và vành giữa không thành trụ đặc.
- Kích thước runtime khớp spec trong sai số số học; các mảng đúng Y=0..0.5.
- PNG có đúng 468 × 360 pixel; không dùng ảnh AI làm bằng chứng WebGL.
- Kiểm tra camera là so ảnh thật, không gọi tham số khởi đầu là đã khôi phục camera nguồn.
- Structural manifest chứng minh phần được dựng, không chứng minh spec đã đủ hoặc hình đã giống.
- Rủi ro chính: nhiều lớp chồng, aliasing đường nhỏ, occlusion và khác biệt giữa các ảnh nguồn. Tách lỗi camera, hình học và vật liệu; giới hạn correction theo state.

Trạng thái: **được duyệt để triển khai**, theo xác nhận “xác nhận duyệt”. Phạm vi giới hạn ở blockout trung tính và bằng chứng runtime như trên.
