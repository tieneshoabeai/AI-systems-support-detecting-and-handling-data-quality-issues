# Quy trình FE — 2 người

Ngày: 26/10/2026. Áp dụng cùng AGENTS/rules và [master plan](master-plan.md).

## 1. Vai trò

FE A phụ trách app/auth/user/workspace/project. FE B phụ trách dataset/visualization/graphics/math. Đây là nhãn phân công, người dùng gán tên thật sau. Các module còn lại và lưu trữ/sync phải chỉ định owner trước mỗi batch; người còn lại review.

Một batch có: owner, reviewer, mục tiêu, phạm vi file, contract đầu vào/đầu ra, dependencies/gates và tiêu chí nghiệm thu. Không cùng sửa file chung khi chưa thống nhất.

## 2. Nhận project

1. Dùng cùng snapshot package.json và yarn.lock; Yarn 1.22.22, kiểm tra Node engines.
2. Trong frontend root chạy `yarn install --frozen-lockfile`, rồi `yarn dev` cho bootstrap mới trong src/app. File mẫu ở root src đã được xóa; index.html trỏ src/app/main.tsx. App/layout hiện chỉ là component tối giản, không có nghiệp vụ.
3. Kiểm tra `yarn build`, `yarn lint` khi chuẩn bị bàn giao thay đổi. Test chạy theo script thực tế sau batch S1, không giả định setup đã có `yarn test`.
4. Đọc architecture → master plan → foundation plan trước task liên quan.
5. Không sửa .env; base URL và dữ liệu test qua cơ chế được người dùng phê duyệt, không ghi secret trong chat/tài liệu.

Không copy node_modules, không npm install, không tự regenerate package-lock. Giữ cả hai lockfile, Yarn là chuẩn resolve.

## 3. Quy tắc sửa file chung

- Router/providers/lib/config/types shared/global CSS/manifest/lockfile: một owner mỗi batch, reviewer là người còn lại.
- Người làm feature đề xuất route/service/type trước khi cần đổi boundary chung; không tự thêm Axios client/provider thứ hai.
- Dependency mới phải được duyệt; một owner patch manifest và chạy Yarn, bàn giao manifest + lock cùng nhau.
- Branch có thể tách theo task theo quy ước repo; không tự tạo branch/commit/push hoặc áp đặt workflow Git khác khi chưa yêu cầu. Khác branch không loại bỏ conflict trên file chung.
- Nếu phát hiện thay đổi chưa bàn giao của người kia: không ghi đè/reset/revert; xác định owner và thống nhất cách tích hợp.

## 4. Trình tự một task

Đọc context/source → làm rõ → tóm tắt vấn đề/input/output → chia feature → solution/risk → plan file/test → người dùng xác nhận → implement đúng batch → self-review → test → peer review → cập nhật decision/handoff.

Không tự expand scope khi phát hiện issue khác. Ghi rõ file/function, hậu quả và bằng chứng; mã nghi không dùng cần kiểm tra caller/export/dynamic usage, nhắc lại khi quay lại file, không tự xóa.

## 5. Review chéo

- Tầng/contract: component → hook → service hoặc repository/sync, không bypass.
- Auth: consent trước refresh, exp/health, không log token; không leak cache account cũ.
- API: endpoint/DTO thực tế, loading/empty/error; source presence không thay runtime evidence.
- Storage: commit trước báo lưu, giữ pending khi lỗi, identity account và server ACK.
- 3D/math: convention rõ, render không chứa nghiệp vụ, cleanup/reduced motion/fallback.
- Scope: không mock thành công trong product, không code placeholder, không sửa stable/unrelated.

Peer review kỹ thuật không thay thế yêu cầu human confirmation cho thay đổi quan trọng.

## 6. Mẫu bàn giao trong task

```text
Batch / owner / reviewer:
Mục tiêu và phạm vi:
File chung được phép sửa:
Contract hoặc props/callback đã thống nhất:
Phần đã làm / chưa làm / blocker:
Validation: static | build/lint | tests | browser/API:
Rủi ro và việc người còn lại cần tiếp tục:
```

Lưu quyết định/handoff nội bộ trong .agents/frontend-delivery khi cần và đã duyệt; không đưa vào public/src/scripts. Không tạo nhật ký phụ cho mọi thao tác. Sau thay đổi mở diff, không chỉ liệt kê tên file.
