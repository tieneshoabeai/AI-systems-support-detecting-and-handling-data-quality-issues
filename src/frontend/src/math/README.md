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
| [`local-csv.ts`](workspace-3d/local-csv.ts) | Parse nội dung CSV cục bộ và chuyển tài liệu CSV thành cây tài nguyên. |

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

## CSV cục bộ

`parseLocalCsv(text)` dò dấu phân cách từ hàng tiêu đề, xử lý ô có dấu nháy và trả `delimiter`, `headers`, `rows`. Hàm ném lỗi khi thiếu tiêu đề hợp lệ, dấu nháy sai hoặc số ô lệch với tiêu đề. Caller thêm ID và tên tài liệu. `localCsvResources(documents)` dùng các tài liệu này để tạo node workspace, project và dataset cho scene.

## Cấu trúc thư mục hiện tại

```text
src/math/
├── workspace-3d/
│   ├── index.ts
│   ├── local-csv.ts
│   ├── resource-camera.ts
│   ├── resource-connection-profile.ts
│   ├── resource-label-policy.ts
│   ├── resource-layout.ts
│   └── resource-routing.ts
├── README.md
└── index.ts
```

## Kiểm thử

Từ `src/frontend`, chạy `yarn test src/__tests__/workspace-3d`. Bắt đầu từ [test layout](../__tests__/workspace-3d/resource-layout.test.ts), [test nhãn](../__tests__/workspace-3d/resource-label-policy.test.ts) hoặc [test CSV](../__tests__/workspace-3d/local-csv.test.ts) tùy phần đang sửa.
