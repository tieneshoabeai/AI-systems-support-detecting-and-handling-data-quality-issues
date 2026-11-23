# Components

`src/components` chứa các thành phần React dùng ở cấp ứng dụng, gồm UI dùng chung, component theo nghiệp vụ và các scene 3D. Bắt đầu từ bảng dưới để tìm file triển khai và điểm import.

## Chọn nơi đặt component

| Khi viết hoặc sửa | Vị trí |
| --- | --- |
| Button, Dialog, Skeleton, Pagination hoặc thành phần giao diện dùng chung | [`components/ui`](ui/README.md) |
| Bảng, dialog hoặc panel gắn với nghiệp vụ như project, workspace hoặc báo cáo | Thư mục nghiệp vụ trong `components` |
| UI chỉ thuộc một route, như panel dataset trên trang chi tiết project | Thư mục màn hình tương ứng trong [`views`](../views/README.md) |
| Canvas, vòng render, camera và sự kiện chọn vật thể | `components/graphics` |
| Geometry, vật liệu, shader và dữ liệu scene | [`src/graphics`](../graphics/README.md) |

## Bản đồ thư mục

| Nhóm | Trách nhiệm | Điểm import hoặc file triển khai |
| --- | --- | --- |
| `auth` | Dialog xác nhận gia hạn phiên | [`auth/index.ts`](auth/index.ts) |
| `branding` | Biểu trưng DataVerse | [`branding/index.ts`](branding/index.ts) |
| `loading` | Skeleton cấp trang và phản hồi tải/lỗi theo vùng | [`loading/index.ts`](loading/index.ts), [`data-region-status.tsx`](loading/data-region-status.tsx) |
| `navigation` | Giao diện không tìm thấy trang | [`navigation/index.ts`](navigation/index.ts) |
| `project` | Wizard tạo project, dialog thành viên, thẻ thông tin và bảng project gần đây | [`project/index.ts`](project/index.ts), [`project/list/index.ts`](project/list/index.ts) |
| `workspace` | Dialog chỉnh sửa workspace và quản lý thành viên | [`workspace/dialogs/index.ts`](workspace/dialogs/index.ts) |
| `resource` | Avatar, artwork, trình bày và thao tác quyền trên tài nguyên | [`resource/index.ts`](resource/index.ts), [`resource/access/index.ts`](resource/access/index.ts) |
| `notification`, `report` | Trung tâm thông báo và báo cáo | [`notification/index.ts`](notification/index.ts), [`report/index.ts`](report/index.ts) |
| `processing` | Dialog đánh giá và lưu kết quả xử lý | [`processing/result-review/index.ts`](processing/result-review/index.ts) |
| `graphics` | Workspace 3D, Dataset 3D và màn Auth Glass | [`graphics/index.ts`](graphics/index.ts) |
| `ui` | Design System DOM | [`ui/README.md`](ui/README.md) |

Khi import qua thư mục, kiểm tra tên export trong `index.ts` của nhóm. [`components/index.ts`](index.ts) chỉ xuất một số thành phần dùng ở cấp ứng dụng. Ví dụ, `RecentProjects` có entry riêng ở `project/list`, còn `DataRegionStatus` được import từ file triển khai.

## Đọc luồng từ code

### Gia hạn phiên

[`App.tsx`](../app/App.tsx) gắn một [`SessionRenewalDialog`](auth/session-renewal-dialog.tsx). Dialog dùng `useAuth()` để đọc `snapshot.phase` và gọi `confirmRenewal`. Pha `awaiting-consent` mở hộp thoại. Nhấn Escape ở pha này gửi quyết định hủy. Pha `refreshing` giữ hộp thoại mở và khóa quyết định trong lúc xử lý. Ở các pha còn lại component trả `null`. [Session coordinator](../services/auth/session-coordinator.ts) xử lý quyết định và cập nhật snapshot.

### Tải dữ liệu theo vùng

[`ManagementDataProvider`](../views/application/management-data-provider.tsx) cấp trạng thái tải hoặc lỗi. [`DataRegionStatus`](loading/data-region-status.tsx) nhận `status`, `label` và `children`. Khi tải, nó render `children` trong vùng `role="status"` có nhãn. Khi lỗi, nó render thông báo với `role="alert"` và chỉ hiện nút **Thử lại** nếu có callback `status.retry`. Caller render nội dung bình thường khi đã có dữ liệu.

Ví dụ trong một module đặt trực tiếp dưới `src/`:

```tsx
import { DataRegionStatus } from './components/loading/data-region-status'

export function ProjectLoading() {
  return (
    <DataRegionStatus status={{ phase: 'loading' }} label="Đang tải project">
      <span>Đang tải…</span>
    </DataRegionStatus>
  )
}
```

### Project gần đây

[`RecentProjects`](project/list/recent-projects.tsx) nhận hai props tùy chọn là `action` và `onOpenProject`. Component lấy store từ context. Khi caller truyền `onOpenProject` và store có `listRecentProjects`, bảng tải từng trang theo con trỏ. Yêu cầu trang đang chạy được hủy khi effect kết thúc. Nếu thiếu một trong hai điều kiện, bảng dùng danh sách trong snapshot. Khi chọn hàng, component gọi `onOpenProject(id)` nếu có, hoặc chuyển thao tác mở project cho session.

### Đánh giá kết quả và scene 3D

- [`ResultReviewDialog`](processing/result-review/result-review-dialog.tsx) nhận kết quả đã xác nhận và các callback đóng/lưu. Hook [`useResultReview`](../hooks/processing/use-result-review.ts) giữ trạng thái form, kiểm tra đầu vào và xử lý lưu. Dialog khóa thao tác đóng trong lúc lưu và tắt đóng bằng backdrop.
- [`ResourceScene`](graphics/workspace-3d/resource-scene.tsx) nhận layout, lựa chọn và lệnh camera từ view. [`HolographicCoreCanvas`](graphics/holographic-core/holographic-core.scene.tsx) nhận trạng thái scene và báo thao tác chọn về view. Khi chỉnh scene, kiểm tra cả reduced motion, fallback WebGL và quá trình tháo component.

## Kiểm thử

Chạy từ `src/frontend`.

| Cần kiểm tra | Lệnh |
| --- | --- |
| Hiển thị và thao tác gia hạn phiên | `yarn test src/__tests__/auth/auth-flow.test.tsx` |
| Panel kết nối dữ liệu và trạng thái tải/lỗi | `yarn test src/__tests__/management/connected-panels.test.tsx src/__tests__/management/management-data-provider.test.tsx` |
| Vòng đời Workspace 3D và tương tác Dataset 3D | `yarn test src/__tests__/workspace-3d/scene-lifecycle.test.tsx src/__tests__/dataset-3d/dataset-3d-view.test.tsx` |

Các suite trên kiểm tra hành vi giao diện trong môi trường mô phỏng. Kiểm tra render WebGL và thao tác bàn phím trên trình duyệt khi thay đổi scene hoặc dialog.
