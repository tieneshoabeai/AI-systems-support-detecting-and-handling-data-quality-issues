# KẾ HOẠCH THỰC THI: TÍCH HỢP CLOUDFLARE ZERO TRUST TUNNEL CỔNG 443
## (IMPLEMENTATION PLAN: CLOUDFLARE ZERO TRUST TUNNEL ON PORT 443)

---

### THÔNG TIN TÀI LIỆU
- **Tập tin:** `docs/plan_ssl_tls_port_443.md`
- **Dự án:** Hệ thống AI hỗ trợ phát hiện và xử lý vấn đề về chất lượng dữ liệu *(Full-Stack Data Quality Management Platform with AI Assistance)*
- **Học phần:** Lập trình JavaScript & TypeScript Nâng Cao — UTH
- **Trạng thái:** Kế hoạch kỹ thuật chính thức theo lựa chọn Hướng 2 của Người dùng
- **Công nghệ cốt lõi:** Cloudflare Edge Universal SSL (TLS 1.3 - Cổng 443) + Cloudflare Zero Trust Tunnel (`cloudflared`)

---

## 1. Bối cảnh & 3 Câu hỏi Cốt lõi

1. **Đang làm gì?**
   - Triển khai giải pháp **Cloudflare Zero Trust Tunnel** kết nối từ máy chủ backend NestJS tới mạng lưới Cloudflare Edge để phát hành giao thức **HTTPS TLS 1.3 Cổng 443 thực tế** ra Internet.
   - Nâng cấp mã nguồn `main.ts` để tối ưu cho Cloudflare: kích hoạt `trust proxy`, nhận diện `CF-Connecting-IP`, `CF-Ray`, cấu hình CORS cho các tên miền Cloudflare (`*.trycloudflare.com`), và động hóa cấu hình máy chủ trong tài liệu Swagger OpenAPI.
   - Soạn thảo tài liệu hướng dẫn vận hành chi tiết [`docs/cloudflare_tunnel_setup.md`](file:///home/hoa/Documents/UTH/Lập%20trình%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/cloudflare_tunnel_setup.md) và kịch bản khởi chạy tự động.
2. **Cho ai?**
   - Dành cho Người dùng (để demo trực tiếp bằng URL HTTPS 443 thực tế), Giảng viên / Hội đồng chấm điểm UTH (có thể truy cập trực tiếp từ xa mà không cần cài đặt mạng LAN).
3. **Để làm gì?**
   - Cung cấp một địa chỉ HTTPS Cổng 443 công khai có chứng chỉ số CA quốc tế hợp lệ (do DigiCert / Google Trust Services ký qua Cloudflare), loại bỏ 100% cảnh báo "Untrusted Certificate" trên trình duyệt.
   - Khắc phục triệt để rủi ro cấp quyền cổng đặc quyền (< 1024) trên hệ điều hành Linux và không cần mở cổng port-forwarding trên router firewall.

---

## 2. Kiến trúc Hạ tầng Cloudflare Zero Trust Tunnel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT / TRÌNH DUYỆT NGƯỜI CHẤM                    │
│   Truy cập URL thật: https://<tunnel-id>.trycloudflare.com (Cổng 443)       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS (TLS 1.3 - Port 443)
                                       │ Chứng chỉ CA Hợp lệ 100% (Không cảnh báo)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CLOUDFLARE GLOBAL EDGE NETWORK                        │
│  - Tiếp nhận kết nối Cổng 443 tại 330+ trung tâm dữ liệu toàn cầu          │
│  - Tường lửa ứng dụng web (WAF) & Giảm thiểu tấn công DDoS tầng L3/L4/L7    │
│  - Phân tích và chuyển giao dịch qua giao thức HTTP/2 và HTTP/3 (QUIC)     │
│  - Chèn tiêu đề định danh:                                                  │
│    + CF-Connecting-IP: IP thực của người truy cập                           │
│    + CF-Ray: Mã định danh truy vết luồng                                    │
│    + X-Forwarded-Proto: https                                               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Đường hầm Outbound QUIC/HTTP2
                                       │ (Không mở cổng Firewall máy chủ)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TIẾN TRÌNH DAEMON 'cloudflared'                       │
│  - Chạy ngầm trên máy chủ Linux của bạn                                     │
│  - Kết nối liên tục 4 phiên tới Cloudflare Edge                             │
│  - Forward gói tin giải mã về cổng nội bộ http://localhost:3000             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP nội bộ
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MÁY CHỦ NESTJS (PORT 3000)                            │
│  - app.set('trust proxy', 1): Nhận diện đúng giao thức HTTPS từ Cloudflare  │
│  - Helmet HSTS: Kích hoạt Strict-Transport-Security                        │
│  - Logging & Audit: Ghi nhận chính xác IP thực từ req.headers['cf-connecting-ip']│
│  - Swagger OpenAPI: Tự động cập nhật server URL https://*.trycloudflare.com │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Các Ưu điểm & Rủi ro Kỹ thuật của Hướng 2 (Trade-offs)

### 3.1. Ưu điểm Vượt trội
1. **Chứng chỉ SSL/TLS Cổng 443 Thật 100%:** Được cấp phát tự động bởi Cloudflare Edge từ các tổ chức CA uy tín toàn cầu (Google Trust Services / Let's Encrypt). Khi người chấm truy cập vào, trình duyệt hiển thị biểu tượng **Ổ khóa xanh bảo mật**, không bị hiện cảnh báo "Không an toàn" như chứng chỉ tự ký.
2. **Không Vướng Rào cản Quyền Root Linux:** Ứng dụng NestJS chỉ cần chạy trên cổng 3000 thông thường mà không cần cấp quyền đặc quyền `cap_net_bind_service` hay `sudo` để bind cổng 443.
3. **Không Cần Mua Domain (Dùng Quick Tunnel):** Tính năng Cloudflare Quick Tunnel cho phép sinh ngay một subdomain dạng `https://<id>.trycloudflare.com` hoàn toàn miễn phí mà không cần trả tiền mua tên miền.
4. **Hỗ trợ Demo Từ xa (Remote Testing):** Người chấm hoặc bạn bè ở bất kỳ đâu trên thế giới đều có thể truy cập kiểm tra API và giao diện mà không cần chung mạng WiFi.

### 3.2. Rủi ro Kỹ thuật & Giải pháp Phòng ngừa
| Rủi ro kỹ thuật | Mức độ | Nguyên nhân | Giải pháp phòng ngừa (Mitigation) |
|---|---|---|---|
| **URL Tunnel bị đổi khi khởi động lại** | Trung bình | Chế độ Quick Tunnel cấp URL ngẫu nhiên mỗi lần chạy lệnh. | Soạn script ghi nhận URL ra log; hướng dẫn cách tạo Named Tunnel cố định nếu có tài khoản Cloudflare Zero Trust. |
| **Phụ thuộc vào kết nối Internet** | Trung bình | Khi máy mất kết nối Internet, tunnel Cloudflare sẽ bị ngắt. | Hệ thống vẫn giữ nguyên cổng HTTP 3000 cục bộ để có thể chạy offline khi cần thiết. |
| **Chặn CORS hoặc Sai Server Swagger** | Trung bình | URL Cloudflare Tunnel khác với `localhost:5173`. | Thêm cấu hình CORS cho phép `*.trycloudflare.com` và cấu hình dynamic servers trong SwaggerModule. |

---

## 4. Kế hoạch Triển khai Chi tiết Từng bước

### Bước 1: Chuẩn Bị & Cài Đặt Công Cụ `cloudflared`
- **Tập tin:** `src/backend/scripts/install-cloudflared.sh`
- **Mục tiêu:**
  - Kiểm tra xem binary `cloudflared` đã có trong hệ thống (`which cloudflared`) chưa.
  - Nếu chưa có, script tự động tải bản phát hành chính thức cho Linux x86_64 từ kho lưu trữ của Cloudflare (`github.com/cloudflare/cloudflared/releases`) và cấp quyền thực thi `chmod +x`.

### Bước 2: Tạo Script Khởi Chạy Đường Hầm Cloudflare
- **Tập tin:** `src/backend/scripts/start-cloudflare-tunnel.sh`
- **Mục tiêu:**
  - Khởi chạy lệnh `cloudflared tunnel --url http://localhost:3000`.
  - Tự động bắt đường link HTTPS Cổng 443 (`https://*.trycloudflare.com`) in đậm ra màn hình terminal để người dùng dễ dàng copy.

### Bước 3: Cấu hình NestJS `src/backend/src/main.ts` Tương Thích Hoàn Hảo với Cloudflare
- **Tập tin:** `src/backend/src/main.ts`
- **Nội dung thực thi:**
  1. **Tin tưởng Cloudflare Proxy (`trust proxy`):**
     ```typescript
     app.getHttpAdapter().getInstance().set('trust proxy', 1);
     ```
  2. **Tối ưu hóa CORS cho Cloudflare:**
     - Cho phép các yêu cầu có Origin kết thúc bằng `.trycloudflare.com` bên cạnh `http://localhost:5173`.
  3. **Cấu hình Dynamic Server URL trong Swagger OpenAPI:**
     - Thiết lập Swagger hiển thị cả URL cục bộ `http://localhost:3000/api/v1` và URL Cloudflare Tunnel `https://*.trycloudflare.com/api/v1` để người chấm có thể bấm gọi thử API trực tiếp trên HTTPS.
  4. **Helmet Security Headers:**
     - Kích hoạt `Strict-Transport-Security` và điều chỉnh CSP để giao diện Swagger UI không bị chặn trên HTTPS.

### Bước 4: Cập nhật Biến Môi trường trong `env.validation.ts` và `.env.example`
- **Tập tin:** `src/backend/src/shared/config/env.validation.ts` và `.env.example`
- **Bổ sung:**
  - `CLOUDFLARE_TUNNEL_ENABLED: boolEnv(true)`
  - `CLOUDFLARE_PROXY_TRUST: boolEnv(true)`
  - `CLOUDFLARE_TUNNEL_URL: z.string().optional()`

### Bước 5: Bổ sung Lệnh Chạy Tiện Ích trong `package.json`
- **Tập tin:** `src/backend/package.json`
- **Bổ sung:**
  - `"tunnel:install"`: `"bash scripts/install-cloudflared.sh"`
  - `"tunnel:start"`: `"bash scripts/start-cloudflare-tunnel.sh"`
  - `"start:tunnel"`: `"pnpm run start:dev & pnpm run tunnel:start"`

### Bước 6: Biên Soạn Tài Liệu Hướng Dẫn Vận Hành
- **Tập tin:** `docs/cloudflare_tunnel_setup.md`
- **Mục tiêu:** Cung cấp hướng dẫn toàn diện từ A-Z cách cài đặt, chạy thử nghiệm Quick Tunnel, và cách cấu hình Named Tunnel cố định cho những ai muốn gắn tên miền riêng.

### Bước 7: Cập nhật Báo cáo Tổng quan Dự án
- **Tập tin:** `docs/report_over_project.md`
- **Nội dung:** Cập nhật mục 2, mục 3 và mục 4.6 mô tả chính xác cơ chế **Cloudflare Zero Trust Tunnel Cổng 443**.

---

## 5. Kế hoạch Kiểm thử & Nghiệm thu (Verification Plan)

1. **Kiểm tra Biên dịch Tĩnh (Zero Any & Type Safety):**
   - Chạy `pnpm run type-check` đảm bảo 0 lỗi biên dịch.
2. **Kiểm thử Tự động (Automated Test Suites):**
   - Chạy `pnpm test` đảm bảo 15/15 test suites PASS 100%.
3. **Kiểm thử Thực tế Cloudflare Tunnel:**
   - Khởi động server NestJS và chạy `scripts/start-cloudflare-tunnel.sh`.
   - Lấy URL `https://*.trycloudflare.com` được Cloudflare cấp.
   - Mở trình duyệt truy cập `https://<tunnel-id>.trycloudflare.com/api/v1/docs`.
   - Xác minh:
     - Biểu tượng **Ổ khóa bảo mật HTTPS** hiển thị hợp lệ (TLS 1.3 - Cổng 443).
     - Không có cảnh báo trình duyệt.
     - Swagger UI tải thành công và gọi được API.
     - Header `CF-Connecting-IP` được NestJS nhận diện chính xác.
