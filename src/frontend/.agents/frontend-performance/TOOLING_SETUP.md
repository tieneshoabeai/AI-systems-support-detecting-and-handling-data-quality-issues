# Lighthouse CLI cho baseline frontend

Kịch bản đầu tiên đo tải trang công khai `/auth/login` trên production build. Dùng Lighthouse CLI, preset desktop và Chrome headless. Mỗi lượt mở phiên Chrome mới, dùng cấu hình reset storage mặc định và chạy tuần tự. Không đăng nhập trong bài audit này.

## Phiên bản và lệnh chạy

Lighthouse CLI được pin ở **13.6.0**. `npm exec` lưu CLI vào cache ngoài dự án. Lần đầu cần quyền truy cập npm registry. Các lần sau có thể dùng `--offline` nếu cache còn phiên bản này. [Lighthouse CLI](https://github.com/GoogleChrome/lighthouse/tree/v13.6.0)

Từ `src/frontend`, build xong rồi mở preview HTTPS loopback ở một terminal riêng. Cấu hình Vite hiện có dùng chứng chỉ phát triển local.

```sh
yarn build
yarn preview --host 127.0.0.1 --port 4181 --strictPort
```

Từ terminal khác trên macOS, đặt thư mục kết quả mới cho mỗi đợt.

```sh
export CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
audit_dir='.agents/frontend-performance/reports/lighthouse/login-desktop-next'
mkdir -p "$audit_dir"
for sample in 1 2 3 4 5; do
  npm exec --yes --package=lighthouse@13.6.0 -- lighthouse \
    https://127.0.0.1:4181/auth/login \
    --preset=desktop --only-categories=performance \
    --chrome-flags='--headless --ignore-certificate-errors' \
    --no-enable-error-reporting --output=json --output=html \
    --output-path="$audit_dir/run-$sample" --quiet || break
done
```

Tham số bỏ qua lỗi chứng chỉ dùng cho Chrome tạm của bài audit HTTPS loopback. Dừng preview khi đo xong. Tránh chạy test hoặc build đồng thời. Khi đổi Chrome, hệ điều hành, profile throttling hoặc build, ghi thông tin đó vào báo cáo mới.

## Kiểm tra đầu ra

Mỗi lượt cần một cặp `run-N.report.json` và `run-N.report.html`. Xác nhận final URL là trang login, `runtimeError` vắng mặt và các audit cần dùng có giá trị. Báo cáo median và khoảng min–max từ các lượt hợp lệ. Lấy TTFB quan sát được từ bản ghi document trong network waterfall nếu đủ trường. Phân biệt bytes truyền theo Lighthouse với kích thước artifact trên đĩa. INP cần bài tương tác riêng.

[Kế hoạch](IMPLEMENTATION_PLAN.md) · [Phương pháp Lighthouse](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)

## So sánh trước và sau cho login 3D

Dùng cùng preview, profile, Chrome và bản Lighthouse ở trên. Với mỗi phiên bản build, đặt `audit_dir` lần lượt tương ứng với `reports/login-3d/before` hoặc `reports/login-3d/after` bên trong thư mục này. Dùng thư mục mới khi chạy lại.

- Đổi vòng lặp thành `01 02 03 04 05` và bật `--only-categories=performance,accessibility,best-practices,seo`.
- Sau khi xuất đủ năm báo cáo HTML, chạy `node .agents/frontend-performance/login-probe.mjs "$audit_dir"` từ `src/frontend`. Probe chụp PNG từ mỗi báo cáo, chạy năm lượt nhập ký tự bằng Playwright và ghi thêm một Chrome Performance trace riêng.
- Mốc nhập là `performance.mark` tại sự kiện `input` đầu tiên trên ô email, tính từ time origin của trang. Kiểm tra scene báo `ready` và có canvas sau khi gõ. Probe chỉ nhập ký tự thử nghiệm và không gửi form.

## Project Detail có xác thực

Chạy bản production preview ở một cổng HTTPS loopback riêng. Đo bằng `project-probe.mjs` trên cùng tab Chrome để giữ session, xóa HTTP cache trước mỗi lần điều hướng và xác minh URL cuối cùng của Lighthouse. Probe chọn project có dataset từ index mà tài khoản E2E được phép đọc. Các bài Project dùng thao tác đọc. Tránh chia sẻ raw artifact khi chưa kiểm tra dữ liệu fixture xuất hiện trong ảnh hoặc log.

```sh
yarn build
yarn preview --host 127.0.0.1 --port 4184 --strictPort
```

Ở terminal khác từ `src/frontend`:

```sh
lighthouse_bin=$(npm exec --yes --package=lighthouse@13.6.0 -- which lighthouse)
lighthouse_dir=$(dirname "$(dirname "$(realpath "$lighthouse_bin")")")
PROJECT_PROBE_BASE=https://127.0.0.1:4184 node .agents/frontend-performance/project-probe.mjs \
  .agents/frontend-performance/reports/project-detail/desktop-next "$lighthouse_dir"
```
