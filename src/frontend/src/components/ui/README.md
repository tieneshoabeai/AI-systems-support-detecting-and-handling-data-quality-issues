# UI components

DOM-only Design System. Import each component from its own directory using relative
paths. There is no aggregate UI barrel, API access, auth state or Three.js dependency.

## Components

- `primitives`: Button, IconButton, Input, Textarea, Checkbox, Badge and Icon.
- `form`: FormField, PasswordInput and Select.
- `overlay`: Dialog, Popover, ContextMenu and Toast.
- `feedback`: Alert, EmptyState and Skeleton.
- `data-display`: Tabs and Pagination.
- `layout`: Panel and FullPageStatus.
- `brand`: BrandLockup, with a caller-provided logo.

Native control props and React 19 refs pass through to the DOM. Button defaults to
`type="button"`; `loading` disables actions and sets `aria-busy`. IconButton requires
an accessible label. FormField's render callback supplies the input ID and ARIA
associations without cloning or replacing the control's ref.

```tsx
import { FormField } from './form/form-field'
import { Input } from './primitives/input'

<FormField label="Tên" hint="Tên hiển thị">
  {control => <Input {...control} name="name" />}
</FormField>
```

## Compatibility and visual scope

Phase 2 retains legacy classes alongside local CSS Module classes. Existing
`app/style.css`, workbench styles and scoped theme overrides remain active so
consumers keep their visual profiles. This is a migration bridge, not completed
removal of global component CSS. Avoid deleting those styles until their consumers
and theme overrides migrate in later phases. New local base rules use low
specificity so existing scoped rules win. Styles/tokens must be loaded by the app.

The old preview exports are adapters. StatusBadge still maps business status;
Rename/Remove still own validation and mutations; Toast receives text and callbacks
without claiming server success. Application navigation dismissal lives in the
preview surface adapter, not UI hooks.

Dialog renders inline, traps/restores focus and supports backdrop/ESC dismissal.
`busy` blocks dismissal. Portal and body scroll locking are deliberately deferred.
SessionRenewalDialog keeps its specialized policy and existing focus handling.
ContextMenu is a positioned/focus-managed shell; callers render its named menuitems.
Tabs preserve current click/tab behavior; arrow-key activation is not introduced.
Pagination preserves the existing contract: valid nonnegative totals, positive
page/perPage, and caller-owned data selection. It does not fetch or slice records.

## Verification

`yarn test src/__tests__/components/ui` checks native semantics, refs, busy actions,
form associations, password values, inline dialog focus/dismissal, surface cleanup,
toast undo, composition and pagination boundaries. jsdom does not verify CSS,
WebGL or pixel equivalence. Use the existing workbench/auth suites and browser
checks when changing adapters or scoped styling.

## Luồng theo nhóm component

| Nhóm | Caller → component → kết quả |
| --- | --- |
| Primitives | Form/màn hình → Button, IconButton, Input, Textarea, Checkbox, Badge, Icon → sự kiện DOM, trạng thái hiển thị hoặc callback của caller. |
| Form | Caller → FormField cấp ID và ARIA, PasswordInput điều khiển hiển thị mật khẩu, Select hiển thị lựa chọn → control hoặc giá trị thay đổi quay về caller. |
| Overlay | Caller → Dialog, Popover, ContextMenu hoặc Toast → mở/đóng, focus, chọn thao tác hoặc hoàn tác → callback và state của caller. |
| Feedback | Caller → Alert, EmptyState, Skeleton → hiển thị lỗi, dữ liệu rỗng hoặc đang tải dựa trên props. |
| Data display | Caller → Tabs/Pagination → chọn tab hoặc trang → caller quyết định nội dung hoặc nguồn dữ liệu tương ứng. |
| Layout và brand | Caller → Panel, FullPageStatus hoặc BrandLockup → cấu trúc nội dung, trạng thái toàn trang hoặc biểu trưng. |
