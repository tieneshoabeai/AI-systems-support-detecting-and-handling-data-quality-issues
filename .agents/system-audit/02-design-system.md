# Chương II. UI/UX và Design System

Design system là tập quy ước token/component dùng chung. FE có token chung cho app/login và nhóm token `--pv-*` cho management/processing; không phải một theme framework tập trung duy nhất.

## 1. Design System Board từ source

| Nhóm | Token / giá trị thực | File định nghĩa dưới `src/frontend/src/` | Mục đích |
|---|---|---|---|
| Font | `--font-ui: 'Plus Jakarta Sans', system-ui, sans-serif` | `styles/tokens.css` | Font UI chung |
| Font loading | Variable font 200–800, `font-display: swap` | `styles/tokens.css` | Dùng font asset cục bộ |
| Canvas/surface | `#f6f8f7`, `#ffffff`, `#eef3f0` | `styles/tokens.css` | Các lớp nền sáng |
| Ink/muted | `#202a29`, `#576660` | `styles/tokens.css` | Chữ chính/phụ |
| Brand/action | `#00a878`, `#007a57`, hover `#006146` | `styles/tokens.css` | Brand và control hành động |
| Danger | `#dc2626`, ink `#a51d1d`, surface `#fff0f0` | `styles/tokens.css` | Lỗi/cảnh báo thao tác |
| Disabled | Nền `#e4eae7`, ink `#52615a` | `styles/tokens.css` | Trạng thái tắt |
| Radius | Panel 32px; input 14px | `styles/tokens.css` | Bo góc nền tảng |
| Easing | `cubic-bezier(0.32, 0.72, 0, 1)` | `styles/tokens.css` | Transition nền tảng |
| Layer | `--layer-dialog: 10` | `styles/tokens.css` | Dialog của style nền tảng |
| Dark management | `--pv-bg-0: #0a1120`, surface `#16263c` | `views/preview/preview.css` | Nền/surface management |
| Dark ink | `--pv-ink: #e8f1fb`, muted `#a9bcd6` | `views/preview/preview.css` | Chữ trên nền tối |
| Primary fill | `--pv-blue-fill: #2563eb`, hover `#2a6ee6` | `views/preview/preview.css` | Nền button có chữ trắng |
| Accent | Blue `#2f7cf6`, violet `#7c5cff`, cyan `#22d3ee`, green `#34d399` | `views/preview/preview.css` | Accent/đồ họa/trạng thái |
| Radius management | 14px; large 20px | `views/preview/preview.css` | Panel/surface management |
| Motion durations | Chrome 140ms, hover 110ms, press 80ms, surface 130ms | `views/preview/preview.css` | Phản hồi UI |
| Motion curves | `cubic-bezier(0,.55,.2,1)`, `cubic-bezier(.2,0,0,1)` | `views/preview/preview.css` | Hover và chrome |
| Shadow | `0 18px 40px rgba(2,8,20,.55)` | `views/preview/preview.css` | Surface tối |
| Sidebar width | `--pv-sidebar-w: 240px` | `views/preview/preview.css` | Chiều rộng layout |
| Light management | bg `#f3f6fc`, surface `#ffffff`, ink `#14243e` | `views/preview/preview-theme.css` | Override theo `data-theme='light'` |

Typography không hoàn toàn nằm trong token: `styles/global.css` có line-height 1.6 cho root; heading line-height 1.15 và tracking -0.045em. Management scope có font hệ thống, font-size 14px, line-height 1.5; bảng/số dùng tabular-nums. Các font-size/weight khác nằm trong từng CSS component/view. Không có bằng chứng về một thang spacing/font-size/breakpoint tập trung đầy đủ.

Spacing hiện vừa có biến kích thước layout vừa có literal padding/gap ở các rule. Z-index cũng phân tán: preview có menu/popover 900, dialog 1000, toast 1100; không nên coi `--layer-dialog:10` đại diện toàn ứng dụng. Các giá trị trên là source, không là số đo tương phản mới. Bình luận CSS về WCAG không được dùng như kết quả audit accessibility hiện tại.

## 2. Theme ownership

`src/frontend/src/hooks/preview/use-preview-color-scheme.ts` đọc/lưu lựa chọn dark/light/system trong localStorage, theo dõi `prefers-color-scheme` và `storage` event. Nếu storage lỗi, giữ lựa chọn trong state phiên. `PreviewSessionProvider` dùng appearance chung cho management và processing; đổi route trong ApplicationFrame không có mục tiêu remount theme provider.

Đây là local preference, không phải tùy chọn đã đồng bộ tài khoản lên API. Cần phân biệt nó với notification preference được PATCH tới server.

## 3. Component architecture và showcase bằng contract

| Mức phân loại dùng trong báo cáo | File dưới `src/frontend/src/` | Input/props | State/output/dependencies |
|---|---|---|---|
| Atomic/primitives | `components/ui/primitives/button/button.tsx` | Native button props, variant, loading | Disabled khi loading; aria-busy; CSS Module; không gọi API |
| Atomic/primitives | `components/ui/primitives/input/input.tsx` | Native input props, error | aria-invalid; controlled value từ caller |
| Composite/form | `components/ui/form/form-field/form-field.tsx` | Form presentation | Gom nhãn/hint/error; responsibility trình bày |
| Composite/overlay | `components/ui/overlay/dialog/dialog.tsx` | open/onClose, as, busy, dismissOnBackdrop | Focus hook; busy ngăn close; aria-modal; render inline |
| Layout | `views/application/application-frame.tsx` | Router location và Outlet | Theme/session surfaces + data provider |
| Feature | `components/project/create/project-wizard.tsx` | initialWorkspaceId, onClose | Step/form/File/member/pending/error; gọi session hook |
| Feature | `views/processing/project/sections/project-data-actions.tsx` | onClose hoặc result callbacks; projectId đọc từ session selection | Upload/download/review busy và lỗi |
| Graphics UI | `views/dataset-3d/dataset-3d.view.tsx` | embedded, colorMode, focus/callbacks | Detached/legend/selected part; gọi canvas component |
| Shared feedback | `components/ui/feedback/empty-state/empty-state.tsx`, `components/loading/page-skeleton.tsx` | Presentation input | Empty/loading UI, không xác nhận dữ liệu server |

Atomic/composite là cách phân loại báo cáo, không phải khẳng định repo dùng kiến trúc Atomic Design hoặc có folder tên `atoms`.

Ví dụ đọc Button: caller đưa `loading=true` → component kết hợp `disabled || loading` → DOM button bị tắt và nhận `aria-busy`. Logic gửi request nằm ở hook/store, không ở Button. Component nhận native props giúp tái sử dụng nhưng chưa phải mọi view đã chuyển sang các primitive này: lint scope bổ sung vẫn có 22 warning migration.

## 4. Interactive states

| State | Bằng chứng thực tế | Giới hạn |
|---|---|---|
| Default/hover/active | Button CSS và `src/frontend/src/app/style.css` | Cần browser kiểm tra cascade thực |
| Focus | `styles/global.css` focus-visible; preview-theme override | Chưa kiểm chứng mọi focus ring trên mọi nền |
| Disabled/loading | Button primitive; wizard pending; upload dialog busy | Test mock có kiểm tra chống gửi trùng |
| Error | ManagementDataProvider role=alert/retry; upload giữ dialog khi lỗi | Lỗi HTTP thật chưa chạy |
| Success | Store chỉ trả saved sau request/reload phù hợp; hook toast | Client đã nhận 204 mà không yêu cầu JSON; live server vẫn chưa kiểm chứng |
| Empty | Store online khởi tạo arrays rỗng; empty-state component | Không dùng fixture thay thế lỗi online |
| Unavailable | unsupported methods trong API store; auth provider note | Có control hiện diện không đồng nghĩa thao tác đã nối |

Dialog có focus trap (giữ focus trong hộp thoại) và trả focus khi đóng qua `src/frontend/src/hooks/ui/use-surface.ts`. Source Dialog ghi portal/scroll lock chưa triển khai tại component đó; không kết luận tất cả overlay trên app có cùng cơ chế scroll lock.

## 5. Responsive và Accessibility

Responsive là layout thích ứng kích thước; accessibility là khả năng sử dụng với bàn phím/công nghệ hỗ trợ. Các bằng chứng source:

- Login dùng matchMedia `(width < 992px)`, bỏ scene khi compact/WebGL không khả dụng; scene load timeout 10000 ms chuyển fallback.
- `app/style.css` có mốc max-width 900/767px; preview styles còn có 720/820/900/1180px và theme có 640px. Không có một breakpoint token duy nhất.
- `styles/global.css` đặt min-width 320px và reduced-motion rule. Dataset3DView tự theo dõi reduced-motion cho graphics, vì CSS không tự dừng animation WebGL.
- `use-surface.ts` có Escape/outside click, roving focus Arrow/Home/End và dialog Tab trap.
- AppRouter/ManagementArea cố focus `#page-heading` khi đổi path; login có label, form name và trạng thái aria.

Desktop/tablet/mobile rendering, screen reader, zoom 200%, focus traversal và contrast trên pixel thực đều **UNVERIFIED** trong lượt này. Không có screenshot mới; không thay bằng hình trang trí.

## 6. Đề xuất tách khỏi hiện trạng

Ưu tiên chuẩn hóa contract control/loading/error trước khi di chuyển toàn bộ CSS. Sau đó hợp nhất token spacing/type/layer có consumer rõ ràng; không đổi giá trị hàng loạt khi chưa có visual regression baseline. Việc gộp token giúp consistency nhưng có thể đổi cascade/theme nếu làm vội. Không áp dụng các đề xuất này trong nhiệm vụ viết báo cáo.
