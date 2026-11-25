# sync

## 1. Mục đích

Thư mục dành cho tầng đồng bộ được dự kiến. Hiện chỉ có `.gitkeep`. Lưu và dọn bản nháp là trách nhiệm hiện tại của [repositories](../repositories/README.md).

## 2. Vị trí & phụ thuộc

Nằm cùng cấp với `services` và `repositories`. Chưa có module được import hoặc caller runtime.

## 3. Public API

Chưa có export, kiểu công khai hoặc tác vụ đồng bộ.

## 4. Cách dùng (ví dụ)

Chưa có ví dụ chạy được. Để khảo sát luồng hiện có, xem các phương thức `save` và `confirmUploaded` ở [repositories](../repositories/README.md).

## 5. Cấu trúc thư mục

**Khi thêm code.** Chỉ đặt điều phối đồng bộ ở đây sau khi hợp đồng ACK và retry được chốt. Việc lưu draft hiện tại thuộc [repositories](../repositories/README.md).

- `.gitkeep` — giữ thư mục trong Git.

## 6. Luồng hoạt động

Hiện không có bước khởi tạo tầng `sync`. Repository dọn draft sau xác nhận upload theo contract riêng của nó.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| Cấu hình riêng | Chưa có | Tầng chưa có runtime |

## 8. Quy ước & bất biến

Giữ ranh giới giữa bản nháp lưu cục bộ và thao tác đã được server xác nhận.

## 9. Test & debug

Chưa có suite hay trang debug riêng. Lệnh liên quan tới bản nháp là `yarn test src/__tests__/auth/upload-draft.repository.test.ts`.

## 10. Giới hạn & lưu ý

Chưa có tự động gửi lại bản nháp, hàng đợi hay bộ điều phối đồng bộ trong thư mục này.

## 11. Hướng cải tiến

Phần đã dự kiến là coordinator sau khi contract backend đủ rõ. Khi đặc tả, cần chốt ACK, vòng đời theo tài khoản, retry và cách xử lý kết quả đến sau khi đổi phiên.
