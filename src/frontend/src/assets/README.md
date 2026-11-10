# assets

## 1. Mục đích

Lưu ảnh, logo và font tĩnh được React/CSS tham chiếu. Tầng này không xử lý bố cục, tải dữ liệu hay dựng geometry.

## 2. Vị trí & phụ thuộc

`app/layout.tsx` và `views/workspace-3d/workspace-3d.view.tsx` dùng logo. `app/design-tokens.css` nạp font. `views/auth/login-glass.css` và `views/preview/preview.css` dùng ảnh nền/ảnh thẻ. Vite giải quyết URL khi chạy hoặc build.

## 3. Public API

Không có hàm hoặc component. Import ảnh từ TypeScript cho URL kiểu `string`. CSS dùng đường dẫn tương đối qua `url(...)`.

## 4. Cách dùng (ví dụ)

```tsx
import logo from './assets/8DA AI Network Logo.png'

export const ExampleLogo = () => <img src={logo} alt="8DA AI Network" />
```

Đặt trong module TSX dưới `src` và render bằng Vite. Đầu vào là file logo, đầu ra là thẻ ảnh với URL do Vite cấp.

## 5. Cấu trúc thư mục

**Khi thêm file.** Đặt ảnh thẻ preview trong `preview/`, font và giấy phép cùng nhau trong `fonts/`, rồi kiểm đường dẫn import từ TSX/CSS tiêu thụ.

- [8DA AI Network Logo.png](8DA%20AI%20Network%20Logo.png) — logo khung ứng dụng và Workspace 3D.
- [background.svg](background.svg) — nền đăng nhập được import từ CSS.
- [hero.png](hero.png) — ảnh hero lưu trong kho asset, chưa thấy caller trong source ứng dụng đã rà.
- [image.png](image.png) — ảnh raster, chưa thấy caller trong source ứng dụng đã rà.
- [react.svg](react.svg) — logo mẫu React.
- [vite.svg](vite.svg) — logo mẫu Vite.
- [universe-backdrop.png](universe-backdrop.png) — nền không gian preview 2D.
- [plus-jakarta-sans-variable.ttf](fonts/plus-jakarta-sans/plus-jakarta-sans-variable.ttf) — font variable tự host.
- [OFL.txt](fonts/plus-jakarta-sans/OFL.txt) — giấy phép đi kèm font.
- [preview/README.md](preview/README.md) — nguồn và phạm vi ảnh thẻ.
- [project-branches-v1.png](preview/project-branches-v1.png) — biến thể ảnh thẻ project dạng nhánh.
- [project-data-flow-v1.png](preview/project-data-flow-v1.png) — biến thể ảnh thẻ project dạng dòng dữ liệu.
- [project-scan-v1.png](preview/project-scan-v1.png) — biến thể ảnh thẻ project dạng quét.
- [workspace-data-network-v1.png](preview/workspace-data-network-v1.png) — ảnh thẻ workspace dạng mạng.
- [workspace-lattice-v1.png](preview/workspace-lattice-v1.png) — biến thể ảnh thẻ workspace dạng lưới.
- [workspace-orbits-v1.png](preview/workspace-orbits-v1.png) — biến thể ảnh thẻ workspace dạng quỹ đạo.

## 6. Luồng hoạt động

Component import URL ảnh hoặc stylesheet khai báo `url` → Vite giải quyết file → trình duyệt tải URL hoặc đọc dữ liệu được inline → hiển thị ảnh/font.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| Cấu hình riêng | Không có | Tên file, đường dẫn và cách đóng gói do caller/Vite quyết định |

## 8. Quy ước & bất biến

Giữ đúng tên file và chữ hoa/thường. Khi đổi ảnh hoặc font, kiểm caller CSS/TSX và giữ giấy phép đi kèm. Đặt `alt` theo vai trò của ảnh trong UI.

## 9. Test & debug

Chạy `yarn dev`, mở `/auth/login` để kiểm nền, `/preview/workspaces-3d` để kiểm logo và `/#/preview/workspaces` để kiểm ảnh thẻ. Dùng Network/Computed để kiểm URL và font.

## 10. Giới hạn & lưu ý

Test jsdom không xác nhận hình ảnh đã tải hoặc font đã render. Các ảnh được tham chiếu chỉ bởi preview CSS thuộc luồng dev.

## 11. Hướng cải tiến

Đề xuất kiểm kê caller, dung lượng và vai trò của ảnh trước khi tối ưu hoặc xóa asset.
