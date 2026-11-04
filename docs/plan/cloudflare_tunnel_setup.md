# HƯỚNG DẪN VẬN HÀNH & KÍCH HOẠT CLOUDFLARE ZERO TRUST TUNNEL (HTTPS CỔNG 443)
## (CLOUDFLARE ZERO TRUST TUNNEL SETUP & OPERATIONS GUIDE)

---

### THÔNG TIN TÀI LIỆU
- **Tập tin:** `docs/cloudflare_tunnel_setup.md`
- **Dự án:** Hệ thống AI hỗ trợ phát hiện và xử lý vấn đề về chất lượng dữ liệu *(Full-Stack Data Quality Management Platform with AI Assistance)*
- **Học phần:** Lập trình JavaScript & TypeScript Nâng Cao — UTH
- **Trạng thái:** Tài liệu hướng dẫn chính thức phục vụ nghiệm thu & chấm đồ án
- **Giao thức:** HTTPS (TLS 1.3 - Cổng 443) qua Cloudflare Global Edge Network

---

## 1. Giới thiệu Tổng quan

**Cloudflare Zero Trust Tunnel** là giải pháp kết nối đường hầm bảo mật cấp doanh nghiệp của Cloudflare, cho phép máy chủ cục bộ (Localhost) xuất bản dịch vụ an toàn ra ngoài Internet qua **giao thức HTTPS trên Cổng 443 chuẩn quốc tế**.

### Ưu điểm Nổi bật:
1. **Chứng chỉ SSL/TLS CA Quốc tế Hợp lệ:** Được ký bởi các tổ chức CA uy tín (Google Trust Services / DigiCert), hiển thị **ổ khóa xanh bảo mật** trên trình duyệt, không bị cảnh báo "Không an toàn" như các chứng chỉ tự ký.
2. **Không Cần Mua Tên Miền:** Sử dụng tính năng **Quick Tunnel** miễn phí của Cloudflare để nhận ngay một subdomain dạng `https://<random-id>.trycloudflare.com` trên Cổng 443.
3. **Không Cần Mở Cổng Firewall / Router:** Tiến trình chỉ thiết lập các kết nối outbound bằng giao thức QUIC/HTTP2 tới Cloudflare, không mở bất kỳ inbound port nào trên máy tính của bạn.
4. **Bảo mật Toàn diện:** Thừa hưởng toàn bộ năng lực chống tấn công DDoS L3/L4/L7, tường lửa WAF và kiểm soát truy cập từ Cloudflare.

---

## 2. Cách Vận hành Nhanh: 2 Bước để có HTTPS Cổng 443 Thật (Quick Tunnel)

### Bước 1: Khởi động Máy chủ Backend
Tại thư mục `src/backend`, khởi chạy máy chủ phát triển:
```bash
cd src/backend
pnpm run start:dev
```
Máy chủ NestJS sẽ lắng nghe tại `http://localhost:3000/api/v1`.

### Bước 2: Khởi chạy Cloudflare Tunnel
Mở một cửa sổ terminal mới và chạy lệnh:
```bash
cd src/backend
pnpm run tunnel:start
```
*(Nếu máy chưa có binary `cloudflared`, hệ thống sẽ tự động tải phiên bản chính thức từ Cloudflare về máy).*

Terminal sẽ in ra thông tin đường dẫn công khai, ví dụ:
```text
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some moments to be ready):  |
|  https://data-quality-ai-demo.trycloudflare.com                                           |
+--------------------------------------------------------------------------------------------+
```

Bây giờ bạn hoặc người chấm ở bất kỳ đâu trên thế giới đều có thể truy cập:
- **Tài liệu Swagger OpenAPI:** `https://<tunnel-id>.trycloudflare.com/api/v1/docs`
- **Kiểm tra trạng thái (Health Check):** `https://<tunnel-id>.trycloudflare.com/api/v1/health`

---

## 3. Cách Cấu hình Named Tunnel Cố định (Dành cho Người dùng có Domain Riêng)

Nếu bạn đã có tài khoản Cloudflare và sở hữu một tên miền thật (ví dụ: `mydataquality.dev`), bạn có thể cấu hình tên miền HTTPS cố định theo các bước sau:

### Bước 1: Đăng nhập Cloudflare bằng `cloudflared`
```bash
cloudflared tunnel login
```
Trình duyệt sẽ mở ra trang Cloudflare để bạn chọn tên miền ủy quyền.

### Bước 2: Tạo Named Tunnel
```bash
cloudflared tunnel create data-quality-backend
```
Lệnh này sẽ sinh ra một tệp thông tin xác thực tại `~/.cloudflared/<tunnel-uuid>.json`.

### Bước 3: Tạo Tệp Cấu hình `config.yml`
Tạo tệp cấu hình tại `~/.cloudflared/config.yml`:
```yaml
tunnel: <tunnel-uuid>
credentials-file: /home/hoa/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: api.mydataquality.dev
    service: http://localhost:3000
  - service: http_status:404
```

### Bước 4: Trỏ DNS và Khởi chạy
```bash
cloudflared tunnel route dns data-quality-backend api.mydataquality.dev
cloudflared tunnel run data-quality-backend
```
Dịch vụ của bạn sẽ hoạt động cố định vĩnh viễn tại `https://api.mydataquality.dev` trên Cổng 443.

---

## 4. Xử lý Lỗi & Khắc phục Sự cố (Troubleshooting)

1. **Lỗi "Command not found: cloudflared":**
   - Chạy lệnh cài đặt tự động: `bash scripts/install-cloudflared.sh`.
2. **Lỗi CORS khi gọi từ Frontend:**
   - Đảm bảo biến `CORS_ORIGIN` trong `.env` bao gồm URL của tunnel hoặc để mặc định để backend tự nhận diện `*.trycloudflare.com`.
3. **Lỗi Swagger không gọi được API qua HTTPS:**
   - Ứng dụng đã được tích hợp bộ lọc nhận diện `X-Forwarded-Proto: https` và `trust proxy` để tự động điều chỉnh schema của Swagger sang HTTPS.
