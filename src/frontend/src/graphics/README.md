# graphics

## 1. Mục đích

Dựng model, geometry, vật liệu, shader và render pass bằng TypeScript và Three.js. Thành phần React, lifecycle canvas và sự kiện chọn/focus thuộc [components](../components/README.md).

## 2. Vị trí & phụ thuộc

`components/graphics` lắp các builder và cấu hình thành scene. Một số view dùng cấu hình hiển thị từ graphics. Tầng này dùng Three.js, kiểu dùng chung và phép tính từ [math](../math/README.md).

## 3. Public API

| Điểm vào | Đầu vào và đầu ra |
| --- | --- |
| `createHolographicCoreProductModel()` | Trả model `THREE.Group` và các thao tác `update(elapsedSeconds, deltaSeconds)`, `resetMotion`, `snapDetach`, `setDetached`, `setSelected`, `applyQualityScores(rows)`, `resolvePart(object)` và `dispose`. `resolvePart` trả part hoặc `null`. |
| `createNeonCubeModel(options?: NeonCubeOptions): NeonCubeModel` | Nhận theme ID hoặc `NeonCubeTheme`, trả group, parts, materials, theme, đếm geometry và `dispose()`. `createNeonCubeCluster(layout?): NeonCubeCluster` trả group và mảng `cubes`. |
| `NEON_CUBE`, `NEON_CUBE_THEMES`, `NEON_CUBE_CLUSTER_LAYOUT`, `NEON_CUBE_LABELS` | Kích thước model, bảng theme, bố cục cụm và nội dung nhãn dùng chung. |
| `ORBIT_RINGS`, `ORBIT_Y` | Thông số ba quỹ đạo và cao độ dùng chung giữa môi trường và phần trang trí Dataset. |

Các builder con được export để scene và suite hình học lắp riêng. Xem source ở mục 5 khi cần gọi trực tiếp geometry, material, render pass hoặc cấu hình chuyên biệt.

## 4. Cách dùng (ví dụ)

```ts
import { createNeonCubeModel } from './graphics/neon-cube/neon-cube.model'

const cube = createNeonCubeModel({ theme: 'cyan' })
console.log(cube.group.name, cube.theme.id) // neon-glass-cube cyan
cube.dispose()
```

Chạy ở module TypeScript dưới `src` với Three.js. Ví dụ dựng model trong bộ nhớ, chưa gắn vào canvas.

## 5. Cấu trúc thư mục

**Khi thêm code.** Chọn nhóm theo scene (`auth-glass`, `holographic-core`, `neon-cube`, `workspace-3d`). Giữ geometry, vật liệu và render pass ở nhóm sở hữu. Đặt JSX và hook phụ thuộc React Three Fiber ở [components/graphics](../components/README.md).

### `holographic-core`

- [core-visual-config.ts](holographic-core/core-visual-config.ts) — camera, palette, revision và tham số lõi/hiệu ứng.
- [cube-label-layout.ts](holographic-core/cube-label-layout.ts) — bố cục nhãn và pose camera focus.
- [cube-label-texture.ts](holographic-core/cube-label-texture.ts) — tạo texture chữ nhãn.
- [generated-core.ts](holographic-core/generated-core.ts) — factory geometry/runtime từ model sinh mã.
- [holographic-core.model.ts](holographic-core/holographic-core.model.ts) — lắp model, animation, detach và tra part.
- [inbound-stream-paths.ts](holographic-core/inbound-stream-paths.ts) — định nghĩa đường luồng đi vào lõi.
- [inbound-stream-streaks.ts](holographic-core/inbound-stream-streaks.ts) — dải sáng chạy trên các đường luồng.
- [inbound-streams.ts](holographic-core/inbound-streams.ts) — lắp và cập nhật luồng đi vào.
- [issue-constellation.ts](holographic-core/issue-constellation.ts) — cụm điểm minh họa vấn đề dữ liệu.
- [liquid-glass-pass.ts](holographic-core/liquid-glass-pass.ts) — render pass và shader kính cho nhãn.
- [orbit.config.ts](holographic-core/orbit.config.ts) — bán kính, màu, tốc độ và cao độ quỹ đạo.
- [spool-core.ts](holographic-core/spool-core.ts) — lõi dạng cuộn, buồng kính và chi tiết động.
- [technical-lines.ts](holographic-core/technical-lines.ts) — helper dựng line và rod kỹ thuật.
- [tower-architecture.ts](holographic-core/tower-architecture.ts) — geometry, vật liệu và chi tiết tháp.
- [tower-config.ts](holographic-core/tower-config.ts) — danh sách tháp, tọa độ và khoảng tách.
- [tower-crowns.ts](holographic-core/tower-crowns.ts) — chi tiết đỉnh tháp.
- [tower-gauge-config.ts](holographic-core/tower-gauge-config.ts) — chiều chất lượng, palette, ngưỡng và đích gauge.
- [tower-gauge-data.ts](holographic-core/tower-gauge-data.ts) — nguồn điểm mẫu và ánh xạ điểm thành ô.
- [tower-gauge.ts](holographic-core/tower-gauge.ts) — geometry và cập nhật gauge.
- [tower-ring.ts](holographic-core/tower-ring.ts) — lắp vòng tháp, điều chỉnh hoặc bỏ geometry cũ.

### `neon-cube`

- [neon-cube-label.config.ts](neon-cube/neon-cube-label.config.ts) — nhãn và mô tả theo theme.
- [neon-cube.cluster.ts](neon-cube/neon-cube.cluster.ts) — nhóm, pose và lifecycle bốn cube mặc định.
- [neon-cube.model.ts](neon-cube/neon-cube.model.ts) — geometry, vật liệu, theme và lifecycle một cube.
- [neon-cube.preview.ts](neon-cube/neon-cube.preview.ts) — renderer/camera độc lập để review cube.
- [object-sculpt-spec.json](neon-cube/object-sculpt-spec.json) — đặc tả tham chiếu của model.
- [preview.html](neon-cube/preview.html) — entry HTML review model.

### `workspace-3d`

- [connection-geometry.ts](workspace-3d/connection-geometry.ts) — tạo geometry cho cổng và vách kết nối.

### `auth-glass`

- [auth-glass.artwork.ts](auth-glass/auth-glass.artwork.ts) — tạo artwork texture hai mặt.
- [auth-glass.config.ts](auth-glass/auth-glass.config.ts) — camera, panel, artwork và mode review.
- [auth-glass.form.ts](auth-glass/auth-glass.form.ts) — chiếu vị trí form DOM lên mặt panel.
- [auth-glass.geometry.ts](auth-glass/auth-glass.geometry.ts) — geometry kính và căn mép panel.
- [auth-glass.materials.ts](auth-glass/auth-glass.materials.ts) — shader và vật liệu fallback.
- [display-base/README.md](auth-glass/display-base/README.md) — tài liệu thiết kế đế trưng bày.
- [display-base.config.ts](auth-glass/display-base/display-base.config.ts) — kích thước, đèn và góc review đế.
- [display-base.geometry.ts](auth-glass/display-base/display-base.geometry.ts) — hình học tầng và vòng đế.
- [display-base.lighting.ts](auth-glass/display-base/display-base.lighting.ts) — môi trường và hiệu ứng sáng của đế.

`.gitkeep` giữ thư mục.

## 6. Luồng hoạt động

Dataset view → scene tạo product model và cụm cube → ghép môi trường, nhãn và render pass → update theo frame hoặc reset motion → pointer trả ID part/theme về view. Workspace view → layout → ResourceScene → mesh/label → callback chọn. Login view → stage → chiếu form DOM lên panel → thao tác xoay báo panel đang chọn.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| `CORE_VISUAL_REVISION` | `v4-spool` | Chọn biến thể lõi |
| `NEON_CUBE_THEMES` / `options.theme` | `violet` cho cube riêng | Chọn palette, layout cụm truyền theme riêng từng cube |
| `GAUGE_THRESHOLD` | `good: 0.85`, `mid: 0.6` | Phân loại điểm gauge |

## 8. Quy ước & bất biến

Giữ ID part/theme nhất quán giữa model, legend và picking. Label kính dùng layer và render pass riêng, cần giữ thứ tự lấy nền trước khi vẽ kính. Gọi `dispose()` cho tài nguyên do factory sở hữu. Tầng graphics không import React, React Three Fiber hoặc tầng UI.

## 9. Test & debug

Chạy `yarn test src/__tests__/dataset-3d src/__tests__/neon-cube src/__tests__/workspace-3d`. Review qua `/workspaces/3d-dataset`, `/preview/workspaces-3d`, `/auth/login?preview=display-base` hoặc `/src/graphics/neon-cube/preview.html?angle=45` trên Vite dev server.

## 10. Giới hạn & lưu ý

Điểm gauge hiện có nguồn mẫu. Test hình học và DOM không đo GPU hay xác nhận chất lượng kính trên thiết bị thật. Suite hiện có các lỗi baseline về model/clearance và spool. Màu kính dùng RGB `#bcc2c0`; độ trong đặt riêng bằng `opacity`, không truyền hex RGBA 8 ký tự vào `THREE.Color`.

## 11. Hướng cải tiến

Đối chiếu lại fingerprint/clearance với model đã được duyệt trước khi cập nhật baseline. Xác nhận palette kính, kết nối nguồn điểm thật và đo frame trên thiết bị đại diện ở đợt riêng.
