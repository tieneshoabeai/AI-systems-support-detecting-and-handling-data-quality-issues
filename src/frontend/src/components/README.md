# components

## 1. Mục đích

Chứa component UI ở cấp ứng dụng và các scene React Three Fiber. Dialog hiển thị lựa chọn gia hạn phiên. Scene dựng canvas, quản lý lifecycle render và trả sự kiện về view. Điều phối phiên thuộc service, còn geometry và vật liệu thuộc graphics.

## 2. Vị trí & phụ thuộc

`app/App.tsx` render dialog dưới `AuthProvider`. Dialog dùng `hooks/auth/use-auth.ts` để nhận snapshot và callback. Các view Workspace 3D, Dataset 3D và Auth dùng scene từ `components/graphics`. Scene dùng [graphics](../graphics/README.md), [math](../math/README.md) và [types](../types/README.md).

## 3. Public API

`SessionRenewalDialog(): JSX.Element | null` không nhận props. Cần `AuthProvider` ở phía trên. Dialog hiển thị lúc chờ xác nhận hoặc đang gia hạn và trả `null` ở các pha khác.

| Component scene | Đầu vào và đầu ra |
| --- | --- |
| `HolographicCoreCanvas(props)` | Nhận trạng thái motion, detach, part và cube focus. Trả canvas hoặc fallback. Báo part hoặc theme qua callback. |
| `ResourceScene(props)` | Nhận layout, ID chọn/focus, trạng thái motion và lệnh camera. Trả canvas hoặc fallback. Gọi `onSelect(id)` khi chọn node. |
| `AuthGlassStage(props)` | Nhận góc nhìn, ref form, panel đang chọn và tùy chọn render. Báo đổi panel qua callback. |
| `AuthGlassReview({ view, overlay, low })`, `DisplayBaseReview({ view, overlay, slabs })` | Nhận góc review và cờ hiển thị, trả UI review. |

## 4. Cách dùng (ví dụ)

```tsx
import { SessionRenewalDialog } from './components/auth/session-renewal-dialog'

// Trong cây đã có AuthContext, dùng một instance như App đang làm.
export const RenewalSlot = () => <SessionRenewalDialog />
```

Đầu vào đến từ context. `awaiting-consent` mở dialog, còn `anonymous` không render dialog.

## 5. Cấu trúc thư mục

**Khi thêm code.** Đặt component được dùng ở cấp ứng dụng trong nhóm phù hợp như `auth/`. Component chỉ phục vụ một màn hình đặt cạnh màn hình đó, như `views/preview/components/`.

- `.gitkeep` — tệp giữ chỗ của thư mục.
- [auth/session-renewal-dialog.tsx](auth/session-renewal-dialog.tsx) — hiển thị lựa chọn gia hạn và chuyển thao tác tới context.
- [graphics/workspace-3d/resource-scene.tsx](graphics/workspace-3d/resource-scene.tsx) — canvas, ống dữ liệu, nhãn và fallback Workspace 3D.
- [graphics/workspace-3d/resource-camera-controller.tsx](graphics/workspace-3d/resource-camera-controller.tsx) — áp lệnh camera và theo dõi context.
- [graphics/workspace-3d/resource-hardware.tsx](graphics/workspace-3d/resource-hardware.tsx) — mesh tài nguyên và sự kiện pointer.
- [graphics/workspace-3d/hardware-lighting.tsx](graphics/workspace-3d/hardware-lighting.tsx) — ánh sáng môi trường phần cứng.
- [graphics/holographic-core/holographic-core.scene.tsx](graphics/holographic-core/holographic-core.scene.tsx) — canvas, picking, compositing và fallback Dataset 3D.
- [graphics/holographic-core/holographic-core.environment.tsx](graphics/holographic-core/holographic-core.environment.tsx) — nền và quỹ đạo.
- [graphics/holographic-core/holographic-core.decor.tsx](graphics/holographic-core/holographic-core.decor.tsx) — trang trí nền và chế độ concept.
- [graphics/holographic-core/cube-label.tsx](graphics/holographic-core/cube-label.tsx) — mesh nhãn và callback focus.
- [graphics/auth-glass/auth-glass.scene.tsx](graphics/auth-glass/auth-glass.scene.tsx) — stage và review kính, thao tác xoay panel.
- [graphics/auth-glass/auth-glass.backdrop.tsx](graphics/auth-glass/auth-glass.backdrop.tsx) — nền và pattern.
- [graphics/auth-glass/auth-glass.render.ts](graphics/auth-glass/auth-glass.render.ts) — hook điều phối render kính.
- [graphics/auth-glass/auth-glass.css](graphics/auth-glass/auth-glass.css) — stage, overlay và form projection.
- [graphics/auth-glass/display-base/display-base.tsx](graphics/auth-glass/display-base/display-base.tsx) — mesh đế, chân đèn và bàn xoay.
- [graphics/auth-glass/display-base/display-base.review.tsx](graphics/auth-glass/display-base/display-base.review.tsx) — trang review đế.
- [graphics/auth-glass/display-base/display-base.review.css](graphics/auth-glass/display-base/display-base.review.css) — style trang review đế.
- [graphics/auth-glass/display-base/use-base-environment.ts](graphics/auth-glass/display-base/use-base-environment.ts) — hook cấp và dọn texture PMREM của đế.

## 6. Luồng hoạt động

Provider cập nhật snapshot → dialog kiểm tra pha → người dùng tiếp tục hoặc hủy → `confirmRenewal` chuyển quyết định đến coordinator → snapshot mới cập nhật giao diện.

View truyền layout hoặc state vào scene → scene lắp geometry và vật liệu Three.js → frame loop cập nhật camera/mesh → sự kiện chọn gọi callback về view.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| Props dialog | Không có | Nội dung hiển thị do pha phiên quyết định |
| Canvas Dataset / Workspace DPR | `[1, 1.5]` | Giới hạn pixel ratio |
| Auth Glass `view`, `interactive`, `low` | `hero`, `false`, `false` | Góc, điều khiển và chất lượng mặc định |
| `DECOR_CONCEPT` | `star-chart` | Trang trí scene Dataset |

## 8. Quy ước & bất biến

Chỉ gắn một dialog trong cây provider. Escape khi chờ xác nhận tương ứng hủy. Trong lúc refresh, thao tác được khóa.

Components không import từ `app` hoặc `views`. Scene nhận state và callback qua props, giữ reduced motion, fallback WebGL và dọn tài nguyên khi tháo khỏi cây React.

## 9. Test & debug

Chạy `yarn test src/__tests__/auth/auth-flow.test.tsx src/__tests__/workspace-3d/scene-lifecycle.test.tsx src/__tests__/dataset-3d/dataset-3d-view.test.tsx`. Review scene qua các route trong [views](../views/README.md).

## 10. Giới hạn & lưu ý

Dialog cần context và trạng thái phiên phù hợp để xuất hiện. Test UI dùng môi trường mô phỏng.

## 11. Hướng cải tiến

Chưa có thay đổi component nào được chốt. Đề xuất kiểm tra trải nghiệm bàn phím trong lần kiểm thử gia hạn trên trình duyệt với môi trường thật.
