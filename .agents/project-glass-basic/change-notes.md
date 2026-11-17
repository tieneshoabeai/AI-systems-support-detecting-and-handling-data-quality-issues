# Giảm hiệu ứng panel Project — 2026-11-14
## Phạm vi người dùng đã chốt
Bỏ: highlight chạy theo pointer; spring/biến dạng khi nhấn; morph từ nút/cube; blur nhiều mẫu texture.
Giữ: khúc xạ, RGB split, viền kính, blur CSS fallback và cảnh 3D.
Độ đục thay đổi theo nội dung: kính trống trong hơn, có chữ/dữ liệu đậm hơn.
## Thay đổi
project-glass-motion: chỉ còn fade 180ms tại bounds cuối; không pointer listener, spring hay scale/translate; vẫn hỗ trợ reverse, reduced-motion, keyboard, cleanup.
project-glass-pass: bỏ origin/morph/press/pointer uniforms và vòng lặp scattering16 tap. Giữ direction ánh sáng cố định, lens refraction và RGB split.
Trong phần phủ kính: đường shader cũ gọi texture khoảng21 lần, đường mới4 lần (tính theo source; không tương đương tỷ lệ tăng FPS).
uContent và data-has-content dùng để chọn contrast; CSS fallback dark/light riêng.
Project view: demo panels có nội dung và panel đánh giá có data-has-content=true; panel placeholder chỉ có header=false.
## Kiểm tra
16/16 tests: motion lifecycle, pass resize/content contrast và shopping demo/review gate.
ESLint changed files: PASS. Vite build: PASS (cảnh báo chunk3D >500kB còn).
TypeScript app: PASS, bao gồm lần kiểm tra cuối sau khi thêm content uniform.
Browser: panel có nội dung, data-has-content=true, data-refractive=true, opacity1 và transform none; chữ/nút đọc và tương tác được.
Chưa đo FPS/GPU time; không cam kết mức tăng hiệu năng.
Không thay login, auth glass, scene/camera, dữ liệu mock hay logic bắt buộc đánh giá.
Chưa commit/push; giữ staging và thay đổi có sẵn.
## Điều chỉnh trắng sữa theo xác nhận tiếp theo
- Bỏ bodyLuminance nén sáng và tint xanh đen; trộn nền với trắng lạnh nhẹ.
- Kính trống: white tint12%; có nội dung:64%. CSS fallback cùng hướng; light mode giữ nền trắng sáng hơn.
- Panel có nội dung dùng chữ tối và link xanh để đọc trên nền sáng; không đổi theme toàn trang.
- Giữ khúc xạ/RGB/viền; không khôi phục bốn hiệu ứng đã bỏ.
- Ảnh kiểm tra: milky-panel.jpg. Đã quan sát panel trắng sữa, nền cảnh vẫn xuyên qua.
- ESLint và diff check: PASS. Kiểm thử lại bị chậm/timeout worker; chuyển sang threads để kiểm tra riêng. Không coi timeout môi trường là test pass.
- Kết quả cuối sau chạy riêng: 6/6 test PASS (threads); Vite build PASS, vẫn có cảnh báo chunk3D lớn. Đã đóng tab kiểm thử để giải phóng tài nguyên.
