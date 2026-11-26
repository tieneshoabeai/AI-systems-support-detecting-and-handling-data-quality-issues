# Math

`src/math` chứa logic tính toán dùng cho Workspace 3D. Code ở đây nhận dữ liệu và tính layout, đường nối, góc camera hoặc nhãn. Canvas và tương tác được triển khai trong [`components/graphics`](../components/README.md).

## Bản đồ file

| File | Trách nhiệm |
| --- | --- |
| [`resource-layout.ts`](workspace-3d/resource-layout.ts) | Kiểm tra cây tài nguyên, tìm đường dẫn cha và bố trí node. |
| [`resource-routing.ts`](workspace-3d/resource-routing.ts) | Tạo tuyến đường nối giữa node và đường cong để scene vẽ. |
| [`resource-connection-profile.ts`](workspace-3d/resource-connection-profile.ts) | Tập trung thông số đường nối và tính bán kính theo danh sách node. |
| [`resource-camera.ts`](workspace-3d/resource-camera.ts) | Tính góc tổng quan, fit camera vào nhóm node, giới hạn pan và cập nhật projection. |
| [`resource-label-policy.ts`](workspace-3d/resource-label-policy.ts) | Tính số lượng nhãn phù hợp và quyết định nhãn nào được hiển thị. |

Import các hàm dùng chung qua [`math/index.ts`](index.ts). Danh sách export riêng của nhóm nằm tại [`workspace-3d/index.ts`](workspace-3d/index.ts).

## Từ dữ liệu tài nguyên đến scene

1. `validateResources(input)` kiểm tra ID, tên, loại và quan hệ cha. Hierarchy hợp lệ là Workspace → Project → Dataset. ID trùng hoặc parent sai loại trả `{ ok: false, message }`.
2. `layoutResources(resources, scopeId)` tính vị trí node theo cây và scope, giữ thứ tự đầu vào. Bên trong, hàm tính tuyến nối qua `routeResources` và trả layout có tâm và kích thước để scene sử dụng.
3. Scene dùng các hàm camera để fit vùng đang xem. Chính sách nhãn quyết định số nhãn có thể hiển thị và nhãn nào được giữ.

Ví dụ từ module đặt ngay dưới `src/`. Kiểm tra nhánh lỗi trước khi tính layout.

```ts
import { layoutResources, validateResources } from './math'

export function prepareWorkspaceLayout(input: unknown) {
  const result = validateResources(input)
  if (!result.ok) throw new Error(result.message)
  return layoutResources(result.resources)
}
```

## Cấu trúc thư mục hiện tại

```text
src/math/
├── workspace-3d/
│   ├── index.ts
│   ├── resource-camera.ts
│   ├── resource-connection-profile.ts
│   ├── resource-label-policy.ts
│   ├── resource-layout.ts
│   └── resource-routing.ts
├── README.md
└── index.ts
```

## Kiểm thử

Từ `src/frontend`, chạy `yarn test src/__tests__/workspace-3d`. Bắt đầu từ [test layout](../__tests__/workspace-3d/resource-layout.test.ts) hoặc [test nhãn](../__tests__/workspace-3d/resource-label-policy.test.ts) tùy phần đang sửa.

## Điểm nối giữa math, view và scene

| Chức năng | Đầu vào → hàm xử lý → đầu ra |
| --- | --- |
| Cây và phạm vi tài nguyên | Workspace view → `validateResources`, `layoutResources` → lỗi cấu trúc hoặc layout theo scope cho scene. |
| Đường nối | Layout → [resource-routing](workspace-3d/resource-routing.ts) và [connection profile](workspace-3d/resource-connection-profile.ts) → tuyến và kích thước phù hợp để dựng đường nối. |
| Camera | Node, bounds và kích thước viewport → [resource-camera](workspace-3d/resource-camera.ts) → góc nhìn, fit và giới hạn điều khiển dùng bởi scene. |
| Nhãn | Node và trạng thái hiển thị → [resource-label-policy](workspace-3d/resource-label-policy.ts) → quyết định giữ/ẩn nhãn và ngân sách hiển thị. |
