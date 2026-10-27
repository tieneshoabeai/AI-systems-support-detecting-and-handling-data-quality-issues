# Kế Hoạch Chỉnh Sửa Kỹ Thuật: Tự Động Nhận Diện Tên Thiết Bị Khi Đăng Nhập (Auto Device Detection)

## 1. Bối cảnh & Mục tiêu (Context & Objective)
- **Vấn đề hiện tại:** Khi gọi API `POST /api/v1/auth/login`, hệ thống đang định nghĩa trường `device_name` với giá trị mặc định `"Web Browser"` trong schema. Điều này khiến Swagger UI tự động hiển thị trường này trong request body, buộc người dùng phải nhìn thấy hoặc gửi lên thủ công.
- **Yêu cầu mới:** Hệ thống phải tự động phân tích tiêu đề HTTP `User-Agent` (do trình duyệt, mobile app hoặc API client tự động gửi lên) để nhận diện tên thiết bị và trình duyệt thực tế (ví dụ: `"Chrome on Linux"`, `"Edge on Windows"`, `"Safari on iPhone"`, `"Postman Desktop"`), không bắt người dùng phải nhập thủ công.

---

## 2. Phạm vi Thay đổi Mã nguồn (Scope of Changes)

### 2.1. Module Tiện ích Mới (New Utility)
- **File:** `src/backend/src/shared/utils/device-detector.util.ts` [NEW]
- **Trách nhiệm:** 
  - Cung cấp hàm thuần túy (pure function) `detectDeviceName(userAgent?: string): string`.
  - Phân tích bóc tách hệ điều hành (Windows, Linux, macOS, Android, iOS, ChromeOS).
  - Phân tích trình duyệt (Chrome, Firefox, Safari, Edge, Opera, Samsung Browser).
  - Nhận diện các công cụ lập trình / API client (Postman, cURL, Insomnia).
  - Tuân thủ 100% nguyên tắc **Zero Any** (sử dụng kiểu `string | undefined`, type narrowing bằng regex an toàn).

### 2.2. Kiểm thử Tự động Mới (New Unit Test Suite)
- **File:** `src/backend/test/device-detector.spec.ts` [NEW]
- **Trách nhiệm:** Kiểm thử đơn vị toàn diện hàm `detectDeviceName` với các mẫu User-Agent thực tế:
  - Chrome trên Ubuntu/Linux (máy phát triển của dự án).
  - Firefox trên Windows 10/11.
  - Safari trên macOS.
  - Safari trên iPhone / iPad (iOS / iPadOS).
  - Chrome trên Android.
  - Postman Runtime, cURL CLI.
  - Trường hợp ngoại lệ: User-Agent rỗng, undefined hoặc chuỗi lạ.

### 2.3. Điều chỉnh Schema DTO Đăng nhập
- **File:** `src/backend/src/modules/auth/dto/login.dto.ts` [MODIFY]
- **Trách nhiệm:**
  - Loại bỏ hoàn toàn trường `device_name` khỏi `LoginSchema`.
  - Request Body trên Swagger UI chỉ hiển thị duy nhất 2 trường: `email` và `password`.

### 2.4. Cập nhật Dịch vụ Xác thực
- **File:** `src/backend/src/modules/auth/auth.service.ts` [MODIFY]
- **Trách nhiệm:**
  - Tích hợp `detectDeviceName(userAgent)` tự động nhận diện thiết bị 100% từ header `User-Agent`.
  - Lưu tên thiết bị thực tế vào `Session` trong MongoDB Atlas.
  - Bổ sung trường `device_name` vào đối tượng phản hồi của `POST /api/v1/auth/login` để client biết ngay thiết bị đã được nhận diện.

---

## 3. Đánh giá Rủi ro & Giải pháp Phòng ngừa (Risk & Mitigation)

| Rủi ro tiềm ẩn | Đánh giá | Giải pháp phòng ngừa |
|---|---|---|
| Request không có header `User-Agent` (ví dụ script tự viết) | Thấp | Cung cấp giá trị fallback an toàn `"Web Client"`, không gây crash server |
| Client gửi User-Agent giả mạo (User-Agent spoofing) | Trung bình | Bản chất của HTTP. Hệ thống ghi nhận chuỗi nhận diện để hỗ trợ UX và audit, các quyết định phân quyền vẫn dựa 100% trên JWT token |
| Phá vỡ các test suite hiện có của hệ thống | Thấp | Chạy lại toàn bộ 15 test suites sau khi chỉnh sửa |

---

## 4. Kế hoạch Kiểm thử & Xác thực (Verification Plan)

1. **Kiểm tra biên dịch tĩnh & Type Safety:**
   ```bash
   pnpm run type-check
   ```
   *Tiêu chí:* 0 lỗi TypeScript, tuyệt đối không vi phạm quy tắc Zero Any.
2. **Kiểm thử tự động:**
   ```bash
   pnpm test
   ```
   *Tiêu chí:* 16/16 Test Suites PASS (thêm mới suite `device-detector.spec.ts`).
3. **Kiểm thử biên dịch:**
   ```bash
   pnpm run build
   ```
   *Tiêu chí:* Biên dịch NestJS `dist/` thành công.
4. **Kiểm thử thủ công trên Swagger UI:**
   - Mở `POST /api/v1/auth/login`.
   - Gửi payload chỉ có `email` và `password`.
   - Kiểm tra response trả về có trường `"device_name": "Chrome on Linux"`.
