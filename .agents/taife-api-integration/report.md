# Tích hợp chọn lọc frontend TaiFE

Nguồn: origin/TaiFE c486cd4. Chỉ lấy FE nối API; không merge/pull toàn nhánh.

Đã tích hợp chọn lọc bằng apply_patch vào ThuongFEAI. Backend, guard, routes, Shopping demo, avatar/theme/3D và các thay đổi local có sẵn được bảo toàn. Không có fallback từ lỗi API sang fixture.

Test route/theme cô lập ManagementDataProvider; test riêng provider dùng session storage và API store thật, chỉ thay transport. Không dùng MODE=test để bỏ provider trong production source.

Giới hạn đã biết: backend local dùng PoliciesGuard/JWT thiếu workspace claims và chưa bổ sung email/tên thành viên như TaiFE. Chưa nghiệm thu backend triển khai thật. Không in hoặc sao chép .env.

## Các phần đã lấy

- services/management: store gọi API, tương thích phân trang page/cursor và payload members/items; CSV preview và kiểm tra upload.
- ManagementDataProvider: lấy phiên hiện tại, đọc token mới mỗi request, trạng thái loading/error/retry, không công bố kết quả load của phiên cũ sau cleanup. Shopping demo giữ nguồn fixture hiện có.
- use-preview-store/session và các màn/dialog: lấy store được cấp thay vì gọi trực tiếp mock singleton; chờ server trước màn thành công; chống gửi lặp ở form; upload File/FormData; blob attachment và HTTP 204.
- Hợp đồng types và test liên quan. Thông tin tài khoản, quyền thao tác, ngày tháng, biểu đồ tháng đọc dữ liệu API; dữ liệu mẫu vẫn giữ hành vi riêng.
- Giữ control và class giao diện sẵn có; không lấy wrapper ui/controls, avatar redesign, CSS/theme, cảnh 3D, dev mock bypass guard hoặc root barrel của TaiFE.

## Code trọng tâm

```ts
const success = await session.createProject(input)
if (!success) return
// Chỉ chuyển màn thành công sau khi store xác nhận hoàn tất.
```

Luồng: ApplicationFrame → ManagementDataProvider → ManagementStoreContext → useManagementStore/createManagementStore → createAxiosClient → backend. Store gặp lỗi request sẽ đưa lỗi lên giao diện. Ví dụ tạo project đã thành công nhưng upload CSV lỗi: thông báo thành công một phần và giữ draft để retry upload, không tự tạo thêm project trong cùng phiên.

## Kiểm chứng cuối

- Vitest chọn lọc: 38 file, 581/581 test đạt (management, foundation API, auth, preview, navigation). Không phải toàn bộ test FE và không phải browser E2E.
- yarn build: TypeScript và Vite production build đạt. Còn cảnh báo chunk >500 kB.
- ESLint chọn lọc 39 file sau chỉnh định dạng: 0 lỗi, 160 cảnh báo (158 Design System migration, 2 indent). Không thực hiện đợt chuyển control sang Design System ngoài phạm vi.
- Dùng kết quả ESLint layout-only dry-run để tạo apply_patch cho 5 file dialog API đã sửa: project-wizard, project-members-dialog, workspace-detail-dialogs, workspace-create-dialog, preview-dialog. Không chạy formatter ghi đè source. TypeScript và diff check kiểm tra lại sau định dạng đều đạt; 581 test và production build đạt trước bước định dạng chỉ thay whitespace này.
- git diff --check b4f0734 HEAD đạt.
- Các test route/theme mock riêng provider để cô lập trách nhiệm; suite provider thật kiểm tra chờ dữ liệu, lỗi/retry, token rotation, account mismatch, session kết thúc, Shopping demo và local-limited. Không sửa production để bỏ provider theo test mode.
- Không chạy/can thiệp backend, không thay cấu hình môi trường, không thử request với server thật hoặc nghiệm thu WebGL bằng browser.

## Trạng thái Git quan sát lúc bàn giao

HEAD đổi từ b4f0734 sang 9e3518b trong lúc thực hiện; commit này đã chứa cả phần tích hợp FE và thay đổi OpenAPI/kiểm thử có sẵn/ngoài lượt này. Agent của lượt tích hợp không chạy commit hoặc push. Không reset/revert commit đó. Review cần so sánh base b4f0734 với HEAD và phân biệt các thay đổi có sẵn.

Vẫn cần nghiệm thu API thật: quyền analyst có thể bị 403 theo source backend local hiện có; member payload có thể thiếu email/tên. Những điểm này được báo giới hạn, không sửa BE để khắc phục.
