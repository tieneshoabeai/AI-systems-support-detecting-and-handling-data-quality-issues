# math

## 1. Mục đích

Tính bố cục, đường nối, camera, ngân sách nhãn và parse CSV cho Workspace 3D. Tầng này không quản lý DOM, state React hay lưu file.

## 2. Vị trí & phụ thuộc

[views](../views/README.md) gọi parse CSV và layout. [graphics](../graphics/README.md) dùng camera, nhãn và đường cong. Một số hàm dùng vector/curve của Three.js.

## 3. Public API

- `parseLocalCsv(text: string): Omit<LocalCsvDocument, 'id' | 'name'>` trả delimiter, headers và rows. Ném `Error` nếu header rỗng, dấu nháy sai hoặc độ rộng hàng lệch. `localCsvResources(documents: readonly LocalCsvDocument[]): ResourceNode[]` dựng cây mẫu.
- `validateResources(input: unknown): Validation` trả `{ ok: true, resources }` hoặc `{ ok: false, message }`. `layoutResources(resources, scopeId?): ResourceLayout`, `resourceTrail(resources, id): ResourceNode[]` và `advanceFlow(phase: number, delta: number): number` xử lý cây hợp lệ và pha hiệu ứng.
- `routeResources(input: readonly PositionedResource[], radius?: number): Pick<ResourceLayout, 'nodes' | 'edges'>`, `routeCurve(route: ResourceRoute): CurvePath<Vector3>`, `connectionRadius(nodes: readonly ResourceNode[]): number`, `CONNECTION` dựng kết nối.
- `overviewDirection(): Vector3`, `nodeCorners(node: PositionedResource): Vector3[]`, `fitPose(nodes, target, direction, fov, aspect): CameraPose`, `overviewPose(layout, fov, aspect): CameraPose`, `panPose(pose, direction, layout): CameraPose`, `clampTarget(target, layout): Vector3` tính khung camera. `updateCameraProjection(camera: PerspectiveCamera, aspect: number, far: number): void` cập nhật camera nhận vào.
- `resourceLabelBudget(sceneWidth: number): number` và `shouldShowResourceLabel(...)` quyết định ngân sách và điều kiện nhãn. Xem [resource-label-policy.ts](workspace-3d/resource-label-policy.ts) cho từng cờ.

## 4. Cách dùng (ví dụ)

```ts
import { parseLocalCsv } from './math/workspace-3d/local-csv'

console.log(parseLocalCsv('id,name\n1,An'))
// { delimiter: ',', headers: ['id', 'name'], rows: [['1', 'An']] }
```

Ví dụ chạy ở module TypeScript dưới `src`. Ô dữ liệu giữ kiểu chuỗi.

## 5. Cấu trúc thư mục

**Khi thêm code.** Với Workspace 3D, chọn file theo phép tính cần sửa, như camera trong `resource-camera.ts` hoặc đường nối trong `resource-routing.ts`. Việc áp pose lên renderer thuộc [graphics](../graphics/README.md).

- [workspace-3d/local-csv.ts](workspace-3d/local-csv.ts) — parse CSV và map thành cây tài nguyên.
- [workspace-3d/resource-camera.ts](workspace-3d/resource-camera.ts) — fit, pan và cập nhật projection.
- [workspace-3d/resource-connection-profile.ts](workspace-3d/resource-connection-profile.ts) — ngưỡng bán kính và profile cổng.
- [workspace-3d/resource-label-policy.ts](workspace-3d/resource-label-policy.ts) — số lượng nhãn và ưu tiên hiển thị.
- [workspace-3d/resource-layout.ts](workspace-3d/resource-layout.ts) — validation, breadcrumb, layout và pha chuyển động.
- [workspace-3d/resource-routing.ts](workspace-3d/resource-routing.ts) — cổng, cạnh và đoạn Bézier.
- `.gitkeep` — giữ thư mục.

## 6. Luồng hoạt động

CSV → phát hiện dấu phân cách ngoài dấu nháy → tạo header/hàng → tạo nodes. Nodes → kiểm ID và quan hệ cha → tính vị trí → dựng cổng và cạnh → camera dùng center/span hoặc scope.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| `scopeId` | `null` | Bố cục toàn bộ cây nếu không chọn scope |
| Ngưỡng chiều rộng scene | 640 px | Ngân sách nhãn 4 dưới ngưỡng, 8 từ ngưỡng trở lên |
| Dấu phân cách | Khi bằng điểm, ưu tiên `,` rồi `;` rồi tab | Đếm số lần xuất hiện ngoài dấu nháy ở header |
| Tốc độ pha | 0,22 chu kỳ/giây | `advanceFlow` tính theo delta |

## 8. Quy ước & bất biến

Kiểm tra dữ liệu trước layout. ID phải duy nhất. Thứ tự sibling theo input. Cây tuân theo Workspace → Project → Dataset. Parser giữ nguyên dấu phân cách bên trong ô có nháy.

## 9. Test & debug

Chạy `yarn test src/__tests__/workspace-3d/local-csv.test.ts src/__tests__/workspace-3d/resource-layout.test.ts src/__tests__/workspace-3d/resource-label-policy.test.ts`. Có thể dùng `/preview/workspaces-3d` để thử CSV mẫu.

## 10. Giới hạn & lưu ý

Parser đọc toàn bộ chuỗi và giữ toàn bộ rows trong bộ nhớ. Ngân sách nhãn chỉ giới hạn chữ, số node render có thể lớn hơn.

## 11. Hướng cải tiến

Đề xuất đo với cây rộng và CSV lớn trước khi thay đổi ngân sách hiển thị hoặc chuyển parse sang luồng riêng.
