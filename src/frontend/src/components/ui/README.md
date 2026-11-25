# UI components

DOM-only Design System. Mỗi component có thư mục riêng, mỗi cấp có `index.ts` riêng
và mỗi component vẫn import được bằng đường dẫn riêng. Design System không đọc API,
auth hay Three.js.

## Barrels theo cấp

| Barrel | Nội dung |
| --- | --- |
| `ui/index.ts` | Export toàn bộ `primitives`, `form`, `overlay`, `feedback`, `data-display`, `layout`, `brand` |
| `ui/primitives/index.ts` | Button, IconButton, Input, Textarea, Checkbox, Badge, Icon |
| `ui/form/index.ts` | FormField, PasswordInput, Select |
| `ui/overlay/index.ts` | Dialog, Popover, ContextMenu, Toast |
| `ui/feedback/index.ts` | Alert, EmptyState, Skeleton |
| `ui/data-display/index.ts` | Tabs, Pagination |
| `ui/layout/index.ts` | Panel, FullPageStatus |
| `ui/brand/index.ts` | BrandLockup |

`ui/index.ts` export `controls` và `legacyDialog` dưới dạng namespace: hai adapter cũ
(`ui/controls.tsx`, `ui/dialog.tsx`) vẫn có `Button`/`Dialog`/`Input`… riêng nên nếu
export phẳng sẽ trùng tên với Design System. Các màn hình cũ tiếp tục import trực tiếp
`components/ui/controls`.

## Tokens

`src/styles/tokens.css` chia ba tầng: primitive (palette, thang chữ, khoảng cách,
bán kính, đổ bóng, chuyển động), semantic (`--color-*`, `--glass-*`, `--shadow-*`,
`--duration-*`, `--state-*`, `--focus-ring*`) và token component. Theme tối bật bằng
`data-theme="dark"` trên bất kỳ phần tử nào; `data-theme="light"` khôi phục lại theme
sáng cho một nhánh con.

Tên token cũ (`--color-canvas`, `--radius-panel`, `--radius-input`, `--ease-ui`,
`--layer-dialog`, `--text-xs`…) được giữ nguyên nên CSS hiện có không phải sửa.

## Liquid glass

`src/styles/glass.css` cung cấp utility dùng lại, tất cả đọc từ token `--glass-*`:

```html
<section class="glass-surface">…</section>
<div class="glass-surface is-raised is-pill">…</div>
<button class="glass-surface is-interactive">…</button>
```

`is-sunken` cho ô nhập/khung chìm, `is-interactive` thêm hover nâng nhẹ, active thu nhỏ
và focus ring. Khi trình duyệt không có `backdrop-filter`, hoặc người dùng bật
`prefers-reduced-transparency`, bề mặt tự chuyển sang màu đặc để chữ vẫn đọc được.

Trong React, dùng trực tiếp qua component: `Button variant="glass"`,
`Panel surface="glass"`; `Dialog` và `Popover` đã dùng bề mặt kính theo mặc định.
Với màu sắc, độ mờ hay viền khác nhau, sửa token `--glass-*`, không thêm class mới.

## Components

- `primitives`: Button (primary/secondary/danger/glass/plain), IconButton, Input,
  Textarea, Checkbox, Badge và Icon.
- `form`: FormField, PasswordInput và Select.
- `overlay`: Dialog, Popover, ContextMenu và Toast.
- `feedback`: Alert, EmptyState và Skeleton.
- `data-display`: Tabs và Pagination.
- `layout`: Panel và FullPageStatus.
- `brand`: BrandLockup, với logo do nơi gọi truyền vào.

Native control props và React 19 refs đi thẳng tới DOM. Button mặc định
`type="button"`; `loading` khoá thao tác và đặt `aria-busy`. IconButton bắt buộc có
nhãn trợ năng. FormField truyền ID và liên kết ARIA qua render callback, không clone
hay thay ref của control.

```tsx
import { FormField } from './form/form-field'
import { Input } from './primitives/input'

<FormField label="Tên" hint="Tên hiển thị">
  {control => <Input {...control} name="name" />}
</FormField>
```

## Compatibility and visual scope

Phase 2 giữ class cũ song song với class CSS Module. `app/style.css`, style workbench
và override theme theo phạm vi vẫn hoạt động để các màn hình giữ nguyên hiện trạng.
Đây là cầu chuyển đổi, chưa phải đã gỡ CSS component toàn cục. Rule nền của Design
System dùng `:where()` (độ ưu tiên 0) nên rule theo phạm vi hiện có vẫn thắng; màu
glass chỉ áp dụng nơi chưa có style cũ, hoặc khi chủ động chọn `variant="glass"` /
`surface="glass"`.

Dialog render inline, giữ/trap focus và đóng bằng backdrop/ESC. `busy` chặn đóng.
Portal và khoá scroll body vẫn chủ động hoãn. ContextMenu là khung định vị và quản lý
focus; nơi gọi render menuitem. Tabs giữ hành vi click/tab hiện tại; chưa thêm
arrow-key activation. Pagination giữ hợp đồng cũ: total không âm, page/perPage dương,
dữ liệu do nơi gọi chọn. Nó không fetch hay cắt bản ghi.

## Verification

`yarn test src/__tests__/components/ui` kiểm tra semantics native, refs, busy, liên kết
form, giá trị password, focus/đóng dialog inline, dọn surface, toast undo, composition
và biên pagination. jsdom không kiểm tra CSS, WebGL hay tương đương pixel; thay đổi
glass/token cần xem bằng trình duyệt.
