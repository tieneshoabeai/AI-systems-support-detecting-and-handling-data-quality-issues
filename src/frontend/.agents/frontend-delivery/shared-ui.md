# Shared UI — Component contract, trạng thái và prompt

Ngày: 26/10/2026. Trạng thái: đặc tả/prompt, chưa tạo component hoặc thêm thư viện. Dành cho FE A/FE B cùng dùng UI primitives; owner của shared file phải được chỉ định theo batch, người còn lại review.

Đọc cùng [Foundation](foundation-spec.md), [Screen flow](screen-flow.md), [Master plan](master-plan.md), [9 module](modules/00-contract-audit.md). UI primitives chỉ render và phát callback; không Axios, Dexie, router provider hoặc quyền server giả bên trong component.

## 1. Mục tiêu và hiện trạng

Hiện App có startup card, heading và CSS hệ thống trong `src/app/style.css`; chưa có component library/design system. `src/app/layout.tsx` chỉ render chữ Layout, chưa được dùng: giữ làm khung, không xóa và không mô tả nó là layout runtime hoàn chỉnh.

Đích: hai người dùng cùng cách thể hiện form/loading/error/confirm và dữ liệu cục bộ/server. Không tự chọn MUI/Tailwind/icon/toast lib vì dependency đã cài không có nghĩa đã được phép mở rộng. Chưa thiết kế marketing page hoặc hệ thống theme/dark mode.

## 2. Đặc tả sáu mục

| Mục | Quy định |
|---|---|
| Đầu vào | Props render/data model đã map, trạng thái từ hook, label/message, callback của owner |
| Điều kiện | Props có accessible name/identity rõ; action cần session/quyền phải được hook cha gate; UI không xác minh quyền thay server |
| Xử lý | Render theo state, phát callback đúng một tương tác; pending chặn submit lặp; hiển thị lỗi gần ngữ cảnh phù hợp |
| Đầu ra | DOM/scene region dễ đọc và điều khiển được; selection/submit/cancel callback; không server success giả |
| Xếp loại | UI loading/empty/ready/error/disabled/pending; operation local/server status tách model; component không tự suy từ truthy data |
| Thứ tự | Label/input/help/error gắn nhau; blocking session trước action; confirm trước thao tác cần xác nhận; ACK/commit đúng nguồn mới báo success |

## 3. Danh sách component và phạm vi dùng lại

Tên component dưới đây là đề xuất kỹ thuật, chưa phải export có trong code. Component cụ thể domain chỉ vào shared khi có nhu cầu dùng lại thật; không tạo generic framework cho mọi form/table/scene.

| Nhóm / component đề xuất | Props cốt lõi | Trạng thái | Bên sở hữu logic |
|---|---|---|---|
| AppLayout | header/nav/content/status regions | session-blocked/local-limited/normal | App + Auth hook |
| PageHeader / Breadcrumbs | title, description?, items có href đã xác nhận | long text, no parent | Route/page owner |
| Button | native button props, pending?, children | default/hover/focus/disabled/pending | Hook submit/action |
| FormField | id,label,help?,error?,required?, control | untouched/invalid/disabled | Form hook; không tự đoán backend field |
| TextInput / TextArea | native props tương ứng | empty/value/focus/invalid/disabled | Domain form |
| SelectField | label, options, value,onChange | empty/selected/disabled/error | Domain form |
| LoadingState | label, busy region | first load/region loading | Query hook |
| EmptyState | title,description?,action? | valid empty | Query đã xác nhận payload |
| ErrorState | title,message,retry? | transport/API/permission theo cha truyền | Error mapper/hook |
| InlineAlert | tone,title?,message | info/warning/error/success | Hook/page |
| ModalDialog | open,title,description?,onClose,children | open/closed/busy | Owner flow |
| ConfirmDialog | subject/text,onConfirm,onCancel,pending | idle/confirming/error | Hook/service owner |
| SessionRenewalDialog | open,onAccept,onDecline,pending,error? | consent/refreshing | Session coordinator duy nhất/tab |
| ResourceStatusBadge | mapped label/tone | server INGESTING/READY/FAILED | Dataset mapper |
| SyncStatusBadge / SyncBanner | operation state,reason?,action? | pending/sending/blocked/synced | Repository/sync hook sau gate |
| FilePicker | acceptedFormats theo spec đã chốt, file?,onSelect,error?,disabled | idle/selected/error/uploading | Dataset hook; không tự parse/upload |
| SceneFallback | message,retryRenderer?,DOM alternative | unsupported/context error | Graphics/page |
| CursorControls | hasMore,pending,onNext,onReset? | first/next/end/error | Query hook; không fake total pages |

DataGrid, ColumnProfilePanel và GraphPanel là component domain Visualization/Lineage, không generic SharedDataTable ngay từ đầu. Selection identity/callback theo module; không chọn thêm grid/chart library trong đặc tả này. Icons chưa chọn, ưu tiên text label thay vì SVG logo mẫu hay emoji thành nút hành động.

## 4. Interface props đề xuất

Mẫu contract TypeScript cho batch shared UI, không phải source đã tạo:

```ts
type AsyncRegion<T> =
  | { state: 'loading' }
  | { state: 'empty'; message: string }
  | { state: 'ready'; data: T }
  | { state: 'error'; message: string; retry?: () => void };

type ResourceSelection = {
  resourceType: 'workspace' | 'project' | 'dataset';
  resourceId: string;
};

type DialogActions = {
  open: boolean;
  title: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

type FieldPresentation = {
  id: string;
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
};
```

Native button/input props kế thừa qua React types khi implementation, tránh tự viết lại onChange/key/ref types không tương thích. AsyncRegion dùng rõ empty sau query thành công; không `if (!data) empty` cho mọi lỗi. Background refetch có dữ liệu cũ cần model riêng ở hook, không ép first-load state rồi nhấp nháy page.

ResourceSelection không áp dụng trực tiếp cho row/lineage node: dùng identity đầy đủ từ module, không ép row_index vào resourceId chung làm mất dataset scope. Props dialog không có endpoint/url/token; parent chịu tác dụng phụ. Session dialog callback không nhận refresh token từ view.

## 5. Quy tắc hành vi dùng chung

### Form và feedback

- Label hiển thị, id/label gắn đúng input; help/error qua aria-describedby; aria-invalid khi có field error.
- Không normalize password hoặc tự chuyển 0/false/null thành empty. Workspace/Project/Dataset DTO trim trước length; Auth/User tên có thứ tự khác, bám module audit thay vì một hàm trim tất cả.
- Error transport/API không có field rõ thì hiển thị form/global error, không gán đoán cho một input. Khi validation chặn submit phải giúp người dùng tìm field lỗi.
- Pending disable lặp action và có text trạng thái; không chỉ spinner không tên. Không set tất cả button mặc định type=submit, tránh click cancel gây mutation.
- Không dùng success toast làm bằng chứng đã ghi server. Local transaction commit mới “Đã lưu cục bộ — chờ đồng bộ”; server ACK mới “Đã đồng bộ/Đã lưu trên server”.

### Dialog và thao tác nguy cơ mất dữ liệu

- Có tên/description, focus vào vùng phù hợp, giữ focus trong modal và trả về trigger sau đóng nếu trigger còn tồn tại; keyboard thao tác được.
- SessionRenewalDialog chỉ coordinator render một instance/tab; không mở dialog cho mỗi component bắt 401. Không tự refresh trước accept.
- Delete dataset pending đã được người dùng cho phép auto-send: copy xác nhận phải nói rõ ý định sẽ gửi khi BE phục hồi; có nút hủy trước gửi, không hứa cancel request đã tới server.
- Escape/backdrop close của confirm/session dialog, pending close và điều hướng rời form là UI-P02/UX-P05 chờ duyệt. Không tự coi dismiss session dialog là consent accept.

### Read/loading/error

- Loading region đặt aria-busy; empty chỉ sau dữ liệu hợp lệ rỗng; 401/403/404/network có message theo nguồn, không dùng empty để che lỗi.
- Retry callback dùng cho read/renderer theo batch; mutation không auto retry qua ErrorState generic.
- Không raw stack/error object/token/URL chứa secret trên UI. Health status chỉ hiện thông tin người dùng cần, không dump bucket/infrastructure payload.
- Banner local-limited không có nghĩa toàn app offline-capable. Action chưa có local storage phải khóa hoặc báo giới hạn theo UX được duyệt, không demo thành công.

## 6. Quyền và capability presentation

Đặc tả này **không tạo permission matrix mới**. Backend roles admin/analyst và workspace owner/editor/viewer cần runtime xác minh; thiếu context không được FE tự cấp quyền. Capability UI đề xuất phân biệt:

| Trường hợp | Hành vi cần thể hiện |
|---|---|
| Chưa có API/contract | Không có action thực thi; region không quảng cáo là hoạt động |
| Session bootstrapping/expired/consent | Action nghiệp vụ chặn theo Foundation |
| Quyền server đã từ chối | Denied state; không fallback role/admin |
| Quyền chưa xác định | Không enabled mutation mặc định; cách ẩn/disabled cần UI-P03 |
| Pending cùng operation | Disable submit lặp |
| Local action whitelist + token còn hạn + repository có thật | Chỉ cho action đã được duyệt, label local rõ |

Nút disabled cần lý do dễ tiếp cận trong text/context, không chỉ tooltip hover. Việc ẩn so với khóa từng action phải được chốt UI-P03 cùng bảng quyền cụ thể; không gộp mọi lý do thành `disabled: true` rồi người dùng không hiểu.

## 7. Style, responsive và các quyết định còn mở

Style nền hiện có system font, background sáng, panel trắng; đây là startup baseline, chưa phải design system. Không tự sao chép giao diện SGOD, đặt thêm dark mode, palette/spacing/shadow scale mới hoặc cài CSS framework trong batch đặc tả.

| ID | Cần chốt | Đề xuất / điều kiện | Trade-off |
|---|---|---|---|
| UI-P01 | Visual system | Dùng system font/CSS thuần hiện có, chốt tokens màu/khoảng cách/size ở batch UI | Ít dependency; cần hai người dùng cùng token, chưa chọn màu chi tiết |
| UI-P02 | Dialog dismiss | Confirm thường có cancel rõ; khi pending không hứa cancel server; session dismiss không thể là accept | Escape/backdrop/pending behavior cần duyệt để tránh lệch flow |
| UI-P03 | Ẩn hay disabled theo quyền/capability | Action không có contract chưa xuất hiện như hoạt động; denied/unknown có lý do; bảng action cụ thể cần duyệt | Disabled giải thích được nhưng nhiều nút không dùng; hidden gọn hơn nhưng khó khám phá |
| UI-P04 | Success feedback | Inline trong context trước; toast nếu được chọn sau, không thêm lib ngay | Inline đơn giản nhưng có thể nằm ngoài viewport; toast cần lifecycle/accessibility |
| UI-P05 | Responsive app shell | Theo UX-P07: nav co gọn, bảng có vùng cuộn riêng, form/dialog không tràn màn hình | Breakpoint/size/browser mục tiêu và layout 3D chưa chốt |

Yêu cầu kỹ thuật chung để nghiệm thu: keyboard/focus nhìn thấy, không chỉ dùng màu để truyền lỗi/trạng thái, chữ dài/Unicode không làm che action, vùng bảng/scene không khóa scroll toàn app ngoài thiết kế đã duyệt, reduced-motion và DOM fallback của 3D được giữ. Không tự đặt FPS, point count hoặc pixel breakpoint thành requirement khi chưa có thiết bị/dataset mục tiêu.

## 8. Files và phân công

- `src/components/shared/` là đề xuất vị trí primitives sau khi batch UI được duyệt; feature component giữ domain. Không di chuyển source hiện có để đạt tên folder khi chưa cần.
- Shared props/types giữ gần component; chỉ type thật sự dùng đa tầng mới đưa `types/ui/`. Style tokens/global nằm trong app/style.css hoặc file được duyệt rõ, không mỗi người một reset CSS.
- FE A phụ trách AppLayout/nav/dialog auth batch đầu; FE B review từ nhu cầu dataset/scene. Owner Button/FormField/Dialog và tokens chỉ định một người mỗi batch; người kia không đồng thời tạo bản sao cùng chức năng.
- Tests chính thức `src/__tests__/shared-ui/` dùng Testing Library/jsdom; visual/browser evidence riêng. Chưa thêm test setup/config hoặc actual components trong đợt này.

## 9. Test case dự kiến

| Mã | Nhóm | Sự kiện/input | Kết quả mong đợi | Lý do |
|---|---|---|---|---|
| UI01 | Thường | Button click một lần | Callback một lần, đúng native type | Primitive |
| UI02 | Đặc biệt | Submit double-click khi pending | Không gửi mutation lặp | Pending |
| UI03 | Không hợp lệ | Form field validation error | Label/error association và message rõ | Accessibility |
| UI04 | Biên | Input 0/false/null/Unicode | Không truthy fallback/coercion sai | Data fidelity |
| UI05 | Đặc biệt | Loading rồi query error | ErrorState, không EmptyState | State |
| UI06 | Đặc biệt | Query success [] | EmptyState với action chỉ nếu hợp lệ | Empty |
| UI07 | Thường | Mở/đóng dialog bằng action đã duyệt | Focus đúng, return trigger; dismiss detail chờ UI-P02 | Keyboard |
| UI08 | Đặc biệt | Nhiều component cần gia hạn | Một SessionRenewalDialog/tab | Coordination |
| UI09 | Đặc biệt | Local commit vs server ACK | Hai label riêng; không dùng cùng success | Sync semantics |
| UI10 | Không hợp lệ | Error raw object chứa secret/stack | Mapper không render raw payload | Boundary |
| UI11 | Không hợp lệ | Quyền unknown/403 hoặc action thiếu API | Không enabled mutation mặc định; ẩn/disabled theo UI-P03 sau duyệt | Capability |
| UI12 | Đặc biệt | Retry ở read error | Read callback; không tự mutation retry | Side effects |
| UI13 | Biên | Màn hẹp, text dài, zoom | Nội dung/action vẫn tiếp cận được; breakpoint chi tiết UI-P05 | Layout |
| UI14 | Đặc biệt | Renderer context lỗi/reduced motion | DOM fallback và motion policy | 3D boundary |
| UI15 | Đặc biệt | Cancel delete đang in-flight | Không báo server đã hủy nếu chưa xác nhận | Ambiguous cancel |
| UI16 | Đặc biệt | Unmount trigger khi dialog đóng | Không crash/đưa focus vào node không còn | Lifecycle |

Case UI-P02/P03/P05 là nghiệm thu có điều kiện sau quyết định UX, không tự chọn expected route/dismiss. Empty/array áp dụng AsyncRegion, không ép mảng vào props Button. Tất cả chưa thực thi.

## 10. Pseudocode và dò tay

```text
hook cha phân loại query/error/capability và truyền props
component:
  loading → busy region
  valid empty → empty region
  error → message + read retry nếu được cung cấp
  ready → render data model
action click:
  NẾU pending/blocked theo props: không callback mutation
  NGƯỢC LẠI phát callback; parent chịu auth/service/ACK
dialog:
  mở → focus/accessibility
  accept/cancel → parent flow; không tự gọi API
```

Dò tay thường: query ACK [] → EmptyState, không spinner/error. Dò tay biên: pending=true, click submit lần hai → không thêm mutation. Đây là walkthrough model, chưa test DOM.

## 11. Prompt triển khai chi tiết

```text
CONTEXT
Bạn tạo Shared UI cho 2 người FE, React 19.3.1/TypeScript 6.0.3/Vite 8/Yarn; CSS hiện có chỉ startup baseline. Đọc shared-ui.md, screen-flow.md, foundation-spec.md và module plan dùng component. Không có UI library đã duyệt.

TASK
Chỉ implement primitives thuộc batch được người dùng duyệt; owner shared được chỉ định và người còn lại review. Không dựng toàn design system hoặc generic data grid/scene framework trước nhu cầu thật. Không sửa toàn App/layout để thay visual ngoài batch.

INPUT
Props contract ở mục 3–4, session/operation states từ Foundation/module, UI-P01–P05 và UX-P01–P08 đã được xác nhận. ID chưa được duyệt là gate, không tự chọn phương án đề xuất. Error data đi qua mapper, không raw server/Axios object.

CONSTRAINTS
Components render + callback, không Axios/Dexie/navigation provider bên trong. Native props/types đúng React; label/help/error association, keyboard/focus, busy/pending và reason. Không password/token log, không fake success, không auto mutation retry. CSS tokens/global do một owner, không thêm framework/icon/toast lib.

PSEUDOCODE
Theo mục 10. Loading/empty/error tách biệt. Pending ngăn double-submit. Dialog không tự refresh; chỉ coordinator quyết định request. Server ACK và local commit có label khác nhau.

EXAMPLES
GET list trả [] → EmptyState; network error → ErrorState, không empty. Upload transaction commit → Đã lưu cục bộ — chờ đồng bộ; upload ACK mới là server success. Button pending=true → click lặp không sinh request mới. Field value 0 không được đổi thành chuỗi rỗng vì truthy fallback.

OUTPUT
Patch primitives/style/types/tests đúng file đã duyệt, code trọng tâm và ví dụ caller dùng props. Mở diff. Báo build/lint/unit DOM/browser visual riêng; liệt kê pending UX và phần chưa kiểm chứng. Không khẳng định jsdom pass là rendered browser hoàn chỉnh.

CRITERIA
UI01–UI16 liên quan batch đạt; component không ôm business/auth side effect. UI pending decision phải dừng nhánh đó. Người còn lại dùng được cùng interface mà không copy Button/Dialog/FormField riêng.
```

## 12. Log và bước review

Bước 1 yêu cầu ở mục 1; bước 2 spec/props/rules mục 2–8; bước 3 test mục 9; bước 4 pseudocode mục 10; bước 5 prompt mục 11. Code, DOM/browser tests và quyết định nhận code chưa thực hiện. Review UI-P01–P05 cùng Screen UX registry trước visual/behavior batch tương ứng; không tự chuyển đề xuất thành yêu cầu đã duyệt.
