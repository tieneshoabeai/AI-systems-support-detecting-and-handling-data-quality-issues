# Kế hoạch cải thiện frontend DataVerse

**Trạng thái:** Tài liệu để duyệt triển khai. Phạm vi source là `src/frontend`. Mã nền được rà ở HEAD `3a49455` trên working tree có thay đổi. Xem [audit và bằng chứng](./FRONTEND_QUALITY_AUDIT.md).

## 0. Baseline trước thay đổi

1. Ghi commit, tình trạng working tree, phiên bản runtime, trình duyệt và cấu hình đo. Đánh dấu thay đổi có từ trước. Chạy TypeScript, lint, Vitest liên quan và build theo thứ tự để tránh cạnh tranh tài nguyên với phép đo.
2. Chụp Login, Management, Processing và Project tại 390, 768 và 1440 px, thêm zoom 200% và các theme Light/Dark/System. Kiểm keyboard, focus visible, các trạng thái loading/empty/error/success, contrast trên glass và reduced motion.
3. Dùng cùng production build profile, trình duyệt, máy, tài khoản và project cho mỗi cặp so sánh. Chạy tuần tự tối thiểu năm lượt cho chỉ số tải trang khi đủ dữ liệu. Báo trung vị, miền min–max và loại lượt chuyển hướng sai route. Giữ dữ liệu Lighthouse và trace tương tác thành hai phép đo riêng.

## 1. Design System và Visual Consistency

- **FE-01 trước.** Đặt state preference ở phía trên điểm đổi giữa ProcessingDataProvider và ManagementDataProvider. Các file dự kiến gồm `views/application/application-frame.tsx`, `hooks/ui/use-workbench-color-scheme.ts`, workbench session và `__tests__/components/workbench-theme.test.tsx`. So sánh lựa chọn provider ổn định với store chia sẻ cấp module. Ưu tiên vòng đời rõ và test độc lập, kiểm việc Login đọc theme và xử lý StorageEvent. Giữ storage key hiện có. Nghiệm thu với Storage.setItem ném lỗi, chuyển Processing → Settings → Processing vẫn giữ Sáng, System phản ứng với OS và tab khác đồng bộ khi storage hoạt động.
- **FE-02 sau baseline thị giác.** Thử 16 px cho tên tài khoản và 14 px cho nhãn hành động trong `views/application/workbench.css`. Dùng bậc đã có. Rà screenshot tên dài, chữ có dấu, Light/Dark, focus và 200% zoom. Font-size test phải phản ánh thang đã duyệt. Nếu kích thước đề xuất làm vỡ nhãn hoặc giảm khả năng đọc, trình lại phương án trước khi áp dụng.

## 2. Animation và Micro-interactions

- **FE-03.** Sửa `views/processing/project/sections/project-data-actions.tsx` và dùng `__tests__/management/management-ui.test.tsx` để kiểm request. Khi submit, cập nhật nhãn Đang tải lên… ngay và giữ `aria-busy`, khóa trùng request, đồng thời giữ kích thước nút qua các trạng thái. Sau lỗi, thông báo và cho thử lại. Thành công theo ACK của store. Nếu cần phản hồi nhấn, dùng `transform` với token press **80 ms** hiện có, easing `cubic-bezier(0, .55, .2, 1)` và vô hiệu phần transform khi reduced motion.
- **Menu và popover.** Giữ entrance hiện tại **130 ms** với token easing trên. Baseline cần thử mở bằng con trỏ và bàn phím, đóng bằng Escape, mở lại ngay và click ngoài. Focus trở về trigger khi phù hợp. Hạng mục sửa surface chỉ mở khi có lỗi được tái hiện trong `hooks/ui/use-surface.ts` hoặc component overlay liên quan.

## 3. Animation Performance

- **FE-04.** Trace toggle sidebar open/close có bảng dài và popover đang mở. Đo style/layout, paint và frame time. Nếu layout lặp là chi phí đáng kể, thử đổi kích thước grid một lần và fade nhãn theo token chrome **140 ms**, snap ở reduced motion. So sánh với bản gốc và kiểm anchor/breakpoint 820 px trước khi chốt. Phạm vi `views/application/workbench.css` và shell. Một lần đổi bố cục có thể làm vị trí popover đổi đột ngột, nên giữ phương án gốc nếu fallback không đạt.
- **FE-05, duyệt riêng sau trace.** Đo Project Detail lúc tải lần đầu, idle, camera focus, thao tác module và drag panel. So sánh CPU/GPU khi reduced motion và tab ẩn/hiện. Đo DPR 1 và 1,5. Rà nguồn cần invalidate gồm camera controls, shader pass, sự kiện đổi theme, resize và quay lại tab trước khi thử chính sách loop. Phạm vi `components/graphics/holographic-core/holographic-core.scene.tsx`, scene motion và các test Dataset 3D/Processing. Mở scene tự động, hoàn tất camera trước panel, tách/lắp đúng và có WebGL fallback. So sánh LCP, SI, TBT và frame time qua các lượt tương đương. Dừng phương án nếu chi phí giảm ở idle nhưng tải trang hoặc tương tác xấu đi đáng kể. Lượt thử demand trước từng xấu hơn ở LCP, SI và TBT, nên một thay đổi giống trước cần bằng chứng mới.

## 4. Component và Architecture Quality

- **FE-06 sau FE-01 và baseline surface.** Rà caller của topbar và cascade CSS trước khi tách. Tách concern cụ thể khi có lý do, giữ `ApplicationFrame` điều phối scope và service/store quản lý dữ liệu. Phạm vi dự kiến là workbench session, theme, topbar và CSS chung. So sánh import graph, test route guard, redirect URL cũ, scope, modal focus, chuỗi API và screenshot. Nếu lợi ích chỉ là đổi vị trí file, giữ cấu trúc hiện tại.

## 5. Accessibility và Responsive Experience

- **FE-07 và các gate của FE-01 đến FE-05.** Kiểm thứ tự Tab, focus nhìn thấy, Escape, trả focus, live status, zoom 200%, nhãn dài và reflow tại các viewport baseline. Với panel Project, thử Tab → mũi tên → Shift + mũi tên → Home, và kéo bằng chuột/chạm qua giới hạn stage. Nếu hướng dẫn khó tìm, thêm mô tả liên kết tới control ở `project-workspace.view.tsx` hoặc `project-panel-controls.tsx`. Xác nhận test và browser cho cả resize, move và reset.

## Gate cho mỗi nhóm

Sau mỗi nhóm, chạy `tsc -b`, lint theo cấu hình repo, unit/integration liên quan, production build và `git diff --check`. Rồi kiểm responsive và interaction trên browser, đối chiếu trước/sau với baseline, báo lỗi có từ trước riêng với regression. Điều tra regression trước khi sang nhóm kế tiếp. Khi áp dụng trong repo, dùng công cụ patch/edit và mở diff để review.

Thứ tự duyệt đề xuất là baseline và FE-01/FE-02, sau đó FE-03/FE-07, rồi FE-04 và FE-06 theo bằng chứng. FE-05 có quyết định triển khai riêng sau khi có trace. Phạm vi từng nhóm cần được xác nhận trước khi sửa source.

## Kết quả FE-01 và FE-02 · 25/11/2026

- Baseline hai suite có 19/21 ca pass. Sau thay đổi, hai suite cùng các suite session, Auth và route đạt 78/78 ca pass. Production build thành công.
- Chromium trên production preview và phiên test giữ theme Sáng khi chuyển Processing → Settings → Processing trong lúc chặn ghi storage cho khóa theme.
- Menu tài khoản đo được tên 16 px và nhãn hành động 14 px ở viewport 390, 768 và 1440 px. Menu nằm trong viewport và không tràn ngang ở ca đã đo. Zoom 200% và trường hợp tên dài chưa kiểm tra trực quan.
- Lint toàn frontend còn đỏ. Lint các file TS/TSX liên quan báo lỗi promise ở đoạn test session có sẵn và cảnh báo indentation ở đoạn hook có sẵn.

## Kết quả FE-07 · 25/11/2026

- Nút khôi phục kiêm di chuyển và hai tay nắm đổi kích thước có mô tả bàn phím qua `aria-describedby`. Các hướng điều khiển được mô tả theo từng tay nắm.
- Suite Project Workspace đạt 5/5 ca, gồm mô tả của ba control và thao tác mũi tên, Shift và Home với kích thước mô phỏng.
- Chromium trên production preview, dùng phiên test và reduced motion, đã xác nhận Shift+Tab tới nút di chuyển, Tab tới tay nắm, focus-visible, panel nằm trong stage sau khi lặp thao tác và Home đặt lại ở 390 và 1440 px.

## Kết quả FE-03 · 25/11/2026

- Project Upload Dialog dùng drop zone Lucian #432 đã duyệt. Kéo thả hoặc chọn CSV chỉ chọn tệp. Nút Upload data gửi request, vòng chờ không hiện phần trăm, dấu check xuất hiện sau phản hồi thành công. Dialog giữ trạng thái thành công 550 ms và đóng ngay với reduced motion.
- Dữ liệu CSV vẫn qua kiểm tra của frontend và store. Request đã lưu nhưng lỗi tải lại danh sách có mã riêng để UI yêu cầu tải lại trang và khóa gửi lần nữa.
- Bốn suite liên quan đạt 45/45 ca, production build thành công. Lint hai component FE-03 không báo lỗi.
- Chromium xác nhận bộ chọn tệp mở bằng Enter ở Dark 1440 px và Space ở Light 390 px, vùng chọn nằm trong viewport. Ca Dark kiểm vòng chờ và trạng thái thành công trước khi đóng. Ca Light bật reduced motion kiểm tài liệu tĩnh và dialog đóng sau phản hồi. Hai ca mô phỏng Project chưa có dataset và chặn POST upload tại trình duyệt.
