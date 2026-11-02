# Dataset 3D Canvas - Đặc tả, test case và prompt triển khai

Trạng thái: **đã triển khai batch canvas-first; chờ browser review trong phiên đăng nhập hợp lệ**

Route mục tiêu: `/workspaces/3d-dataset`

Ngày cập nhật: 01/11/2026

## 1. Mục tiêu đã chốt

Đưa mô hình holographic core đã được duyệt từ bản review độc lập trong `.agents/holographic-core/reference-v2/blockout/` vào ứng dụng React tại route `/workspaces/3d-dataset`.

Màn hình ở batch này tập trung vào canvas. Canvas phải hiển thị đúng core đã dựng: các tầng cylinder, base trung gian, orbit violet, fill blue-cyan-violet, core-cap, core-foot, axial light và các chuyển động ring/grid đã duyệt.

Sản phẩm thuộc hệ thống **AI hỗ trợ phát hiện và xử lý vấn đề chất lượng dữ liệu**. Core ở batch này là không gian trực quan Dataset, chưa phải dữ liệu chất lượng thật.

## 2. Phạm vi batch hiện tại

### Có trong batch

1. Đăng ký protected route `/workspaces/3d-dataset`.
2. Render canvas React Three Fiber responsive.
3. Chuyển và tái sử dụng mô hình holographic đã duyệt trong tầng `src/graphics/`.
4. Giữ màu, hình khối, ánh sáng và animation hiện có của core.
5. Có fallback DOM khi WebGL không khởi tạo được hoặc mất context.
6. Tôn trọng `prefers-reduced-motion`: ngừng animation tự động nhưng vẫn hiển thị khối 3D.
7. Dọn geometry, material, texture, controls và listener khi component unmount.

### Không có trong batch

- Sidebar hoặc navigation menu. Làm ở batch sau.
- Panel DataGlyph, inspector, thao tác sửa dữ liệu hoặc UI mô phỏng dữ liệu.
- Point cloud, `THREE.Points`, `InstancedMesh` hoặc hàng loạt điểm sáng mới.
- Kiểu `Complex`, animation quỹ đạo bằng số phức hoặc adapter `Complex -> Vector3`.
- Mapping record Dataset thành X/Y/Z, sampling, normalize hoặc chọn cột dữ liệu.
- Diễn giải ánh sáng hiện tại là missing value, outlier, duplicate hoặc lỗi định dạng.
- API AI, RAG, Qdrant, rerank, Qwen, SSE, download/export hoặc backend mới.
- Tuyên bố FPS, số điểm hay độ giống ảnh tham chiếu khi chưa đo browser thực tế.

## 3. Quyết định thiết kế và kiến trúc

| Hạng mục | Quyết định |
|---|---|
| Route | `/workspaces/3d-dataset`, nằm sau `ProtectedRoute` |
| Bố cục | Canvas-first. Không chừa vùng sidebar trống và không dựng inspector ở batch này |
| Renderer | React Three Fiber đã có trong dependencies |
| Nguồn model | Mô hình reference-v2 đã duyệt là chuẩn hình học/look-dev; mã runtime sản phẩm phải nằm trong `src/graphics/`, không import trực tiếp từ `.agents/` |
| Resize | Canvas theo container. Camera projection, kích thước renderer và postprocessing phải cùng cập nhật |
| Animation | Giữ animation hiện có của ring/grid. Không thay rotation 3D đơn giản bằng số phức |
| Data boundary | Scene chưa gọi service/API/Dexie và chưa tự tạo data-quality state |
| Error boundary | WebGL failure/context loss phải chuyển sang fallback HTML rõ ràng |

### 3.1 Gate migration fidelity - bắt buộc trước khi nhận scene

Mục tiêu của đợt migration không phải là dựng một khối “trông gần giống” bằng JSX primitives. Product scene phải dùng cùng hệ component, transform, material role và animation role của bản review đã duyệt.

| Nguồn review | Vai trò là source of truth | Được chuyển sang product | Không chuyển sang product |
|---|---|---|---|
| `reference-v2/blockout/generated-core.ts` | Factory geometry, component hierarchy, `sculptRuntime.nodes`, `sculptRuntime.meshes`, `componentId` | Factory model thuần Three.js và runtime map | Presentation composer/inspect-control helper không được dùng nguyên xi nếu wrapper R3F thay thế lifecycle |
| `reference-v2/blockout/main.ts` | Hologram material, contour/cage, grid, hotspot, spine, orbit runner và motion | Các helper tạo look-dev cùng thông số đã duyệt | DOM query, view buttons, evidence export, explode-review UI |
| `reference-v2/object-sculpt-spec.json` | ID, parent, transform, dimensions, material role và hierarchy | Assertion/mapping test cho các component bắt buộc | Không dùng như dữ liệu Dataset runtime |
| `reference-v2/blockout/intermediate-base-spec.json` | Base trung gian và quan hệ với orbit violet | Ring có inner `2.15`, outer `2.70`, Y `[0.46, 0.66]`; orbit gap `0.10` | Không thay số này bằng JSX hard-code khác |

### 3.2 Bảng migration bắt buộc

| Review responsibility | Product responsibility | Quy tắc giữ fidelity |
|---|---|---|
| `createHolographicOrbitalDataCoreV2Model()` | `createHolographicCoreModel()` trong `src/graphics/holographic-core/` | Trả `THREE.Group` và runtime nodes/meshes đúng ID; R3F dùng `<primitive object={model} />` |
| `createHologramMaterial()` | `applyHologramLookDev()` | Giữ role `blue-volume`, `cyan-contour`, `violet-band`, `blue-face`, `field-fill`, `base-intermediate`, tower opacity theo độ sâu và `depthWrite=false` |
| `addCylinderGrid`, `addPlanarGrid`, `addTowerGrid`, `addTowerDataMarks`, `addMicroDataPattern` | `attachTechnicalDetails()` | Grid/glyph hiện là chi tiết của model review, không phải record Dataset hoặc AI result |
| `createPrimaryHotspot`, `addCapSolarRays`, `addAxialSpine`, `addScatteredNodes` | `attachHologramLights()` | Giữ 3 hotspot, cap rays, 3 axial spines và node rải thưa, không thay bằng particle cloud |
| `animatedNodes` và `updateHologramLights()` | `useFrame` controller với refs | Chỉ animate orbit violet, mid collar, base deck, cap, runner và light opacity; không quay cả root model |
| `UnrealBloomPass(0.18, 0.45, 1.0)` | R3F-compatible composer owner | Bloom chỉ enabled trong hologram mode; resize phải cập nhật render target; không dùng bloom che lỗi hình học |
| `prepareReferenceCamera()` | Camera preset/controller | Dùng FOV `40`, target `[0, 1.17, 0]`, yaw `45°`, elevation `20°`; browser review mới là bằng chứng fidelity |

### 3.3 Thông số look-dev đã chốt

| Material role | Color | Emissive | Intensity | Opacity |
|---|---|---|---:|---:|
| `blue-volume` | `#075bff` | `#1065ff` | 0.52 | 0.58 |
| `cyan-contour` | `#17d7ff` | `#17d7ff` | 0.70 | 0.34 |
| `violet-band` | `#a849f8` | `#b968ff` | 0.75 | 0.58 |
| `blue-face` | `#0a5cdf` | `#1065e8` | 0.34 | 0.30 before tower-depth override |
| `field-fill` | `#0c5ced` | `#1269e8` | 0.18 | 0.06 |
| `base-intermediate` | `#0754d7` | `#1269e8` | 0.28 | 0.18 |

Tower opacity phải giữ lần lượt: tower-01 `0.19`, tower-02 `0.21`, tower-03 `0.25`, tower-04 `0.36`, tower-05 `0.42`, tower-06 `0.39`, tower-07 `0.30`, tower-08 `0.23`, tower-09 `0.20`.

Motion phải giữ: orbit violet một vòng/21 giây, mid collar ngược chiều một vòng/15 giây, base deck một vòng/32 giây, core-cap ngược chiều một vòng/24 giây. Orbit runner quay một vòng/6 giây. Reduced motion đặt tất cả về base rotation và reset opacity/scale tĩnh.

## 4. Giải thích các tham khảo ngoài scope

Hai slide tham khảo về vector leaf/RAG chỉ đóng góp các nguyên tắc có thể dùng trong tương lai:

- Khi thật sự có rất nhiều glyph/record, ưu tiên `THREE.Points` hoặc `InstancedMesh`, không tạo một `Mesh` cho từng record.
- State-driven material chỉ có ý nghĩa khi đã có state được xác nhận từ UI/backend.
- Mọi yêu cầu hiệu năng phải benchmark trên browser và thiết bị đại diện.

Chúng **không** là yêu cầu tạo cây RAG hay gắn RAG backend vào Dataset 3D.

Số phức chỉ được xem xét sau này nếu có yêu cầu rõ ràng về nhiều điểm chạy trên quỹ đạo. Khi đó công thức dự kiến là `z(t) = r * exp(i * theta)` trên một mặt phẳng đã chốt, rồi adapter ánh xạ `Re(z)` và `Im(z)` sang tọa độ 3D. Không đưa công thức này vào core hiện tại khi nó không mang ý nghĩa dữ liệu.

## 5. Đặc tả sáu mục

| Mục | Nội dung |
|---|---|
| Đầu vào | URL `/workspaces/3d-dataset`; session hợp lệ; khả năng WebGL; model/hologram material đã duyệt |
| Điều kiện | Route phải qua `ProtectedRoute`; model chỉ hiển thị khi renderer khởi tạo thành công; browser không hỗ trợ WebGL phải có fallback |
| Xử lý | Router mở view; view render canvas; scene dựng core đã duyệt; resize cập nhật projection/render target; reduced motion dừng motion; unmount dọn tài nguyên GPU |
| Đầu ra | Khối holographic tương tác bằng OrbitControls, canvas responsive, fallback khi lỗi WebGL |
| Xếp loại | `loading`, `ready`, `webgl-unavailable`, `context-lost`, `scene-failed`, `reduced-motion` |
| Thứ tự | Session gate -> route -> scene init -> render -> interaction; lỗi renderer ưu tiên fallback, không crash toàn route |

## 6. File dự kiến

Tên file chỉ là cấu trúc triển khai đề xuất. Không tạo file ngoài phạm vi patch được duyệt.

```text
src/app/router/app-router.tsx
src/views/dataset-3d/dataset-3d.view.tsx
src/views/dataset-3d/dataset-3d.css
src/graphics/holographic-core/holographic-core.scene.tsx
src/graphics/holographic-core/holographic-core.model.ts
src/graphics/holographic-core/holographic-core-look-dev.ts
src/graphics/holographic-core/holographic-core-motion.ts
src/__tests__/dataset-3d/dataset-3d-route.test.tsx
src/__tests__/dataset-3d/holographic-core-lifecycle.test.tsx
```

Nếu tái cấu trúc model đã duyệt cần thêm hoặc đổi file, phải nêu rõ trong review trước khi mở rộng patch.

## 7. Test case trước implementation

| Mã | Nhóm | Đầu vào / sự kiện | Kết quả mong đợi |
|---|---|---|---|
| C01 | Thường | Session hợp lệ mở `/workspaces/3d-dataset` | View canvas được render trong protected route |
| C02 | Không hợp lệ | Session anonymous mở route | Guard chuyển về login theo flow hiện có |
| C03 | Thường | Canvas thay đổi desktop width/height | Camera aspect và renderer size cập nhật, hình không bị kéo méo |
| C04 | Biên | Viewport hẹp | Canvas không tràn ngang, vẫn có kích thước dùng được |
| C05 | Không hợp lệ | Renderer/WebGL khởi tạo lỗi | Hiện fallback DOM, không crash route |
| C06 | Đặc biệt | `webglcontextlost` | Hiện thông báo context lost và không tiếp tục render lỗi |
| C07 | Đặc biệt | `prefers-reduced-motion: reduce` | Không chạy vòng animation tự động, core vẫn hiển thị |
| C08 | Đặc biệt | StrictMode mount/unmount | Controls, listener và GPU resource được cleanup |
| C09 | Thường | Kéo/xoay/zoom canvas | OrbitControls hoạt động, không tạo React state theo từng frame |
| C10 | Giới hạn | Chưa có Dataset record/API | Không render glyph dữ liệu, không gọi service, không mô tả core là kết quả AI |
| C11 | Fidelity | Factory được tạo | Có đủ component ID trong `object-sculpt-spec.json` cộng `base-intermediate`; component giữ parent/transform/runtime map |
| C12 | Fidelity | Hologram mode | Sáu material role, tower depth opacity, grid, hotspots, spines và runner có mặt theo source review |
| C13 | Visual | Reference/front/right/rear/high | Screenshot browser được so với review evidence; ghi rõ khác biệt còn lại thay vì tự tuyên bố giống |
| C14 | Biên | Resize đang bật bloom | Camera aspect và composer render target cùng cập nhật; không kéo méo hoặc crop core |

Test jsdom chỉ kiểm tra lifecycle, route và fallback. Render fidelity, GPU memory, FPS, touch thật và visual comparison phải được kiểm tra trong browser riêng.

## 8. Pseudocode

```text
KHI truy cập /workspaces/3d-dataset:
  ProtectedRoute kiểm tra session
  NẾU session không cho phép:
    dùng flow redirect hiện có
    DỪNG

  render Dataset3DView
  NẾU renderer/WebGL lỗi:
    hiện fallback HTML
    DỪNG

  tạo R3F Canvas theo kích thước container
  tạo model holographic core qua product factory
  assert component ID/runtime map theo source review
  attach material, grid, hotspot, spine, runner và motion đã duyệt
  tạo OrbitControls có cleanup

  NẾU reduced motion:
    không chạy motion loop
  NGƯỢC LẠI:
    cập nhật ring/grid bằng ref trong frame loop

  KHI resize:
    cập nhật camera projection và render targets

  KHI unmount hoặc context lost:
    dừng animation
    dispose controls/listener/geometry/material/texture theo ownership
```

## 9. Prompt triển khai

```markdown
# PROMPT: Dataset 3D canvas với holographic core

## CONTEXT
- React 19.3.1, TypeScript 6.0.3, Vite 8, React Router 8.5, Three 0.186, React Three Fiber 9.8.
- Đây là frontend của hệ thống AI hỗ trợ phát hiện và xử lý vấn đề chất lượng dữ liệu.
- Mục tiêu route là `/workspaces/3d-dataset`.
- Holographic core đã được duyệt về hình học, material blue-cyan-violet, base trung gian, orbit violet, core-cap, core-foot và animation ring/grid.
- Batch này chỉ chuyển core vào ứng dụng React, chưa trực quan hóa record hay kết quả AI.

## TASK
Tạo protected route `/workspaces/3d-dataset` và một Dataset 3D view canvas-first bằng React Three Fiber. Tái sử dụng core đã duyệt nhưng đưa runtime product vào `src/graphics/`.

## INPUT
| Tên | Kiểu | Miền hợp lệ |
|---|---|---|
| route | string | `/workspaces/3d-dataset` |
| session | Auth snapshot | chỉ authenticated hoặc local-limited qua guard hiện có |
| WebGL | browser capability | available hoặc unavailable/context lost |
| reduced motion | MediaQuery state | reduce hoặc no-preference |

## CONSTRAINTS
1. Không import mã production trực tiếp từ `.agents/`.
2. Không dùng standalone `index.html`, `document.querySelector`, hoặc listener DOM rải rác của bản review.
3. Không thêm dependency.
4. Không thêm sidebar, inspector, DataGlyph, point cloud, Complex, mapping X/Y/Z hoặc dịch vụ/API mới.
5. Không gọi RAG, Qdrant, rerank, Qwen, SSE, Export hoặc backend giả.
6. Scene không gọi Axios/Dexie; data mapping không thuộc batch.
7. Canvas phải responsive, có fallback WebGL, reduced motion và cleanup khi unmount.
8. Không set React state trong mỗi animation frame.
9. Không dựng lại core bằng JSX cylinder/torus/box rời rạc nếu source factory đã có; port model factory và look-dev source-of-truth sang `src/graphics/`.
10. Giữ component ID, parent, transform, material role, base intermediate, grid, hotspots, axial spines và animation tốc độ theo mục 3.1-3.3.
11. Không làm thay đổi hình học/material đã duyệt nếu chưa có review riêng.

## PSEUDOCODE
Thực hiện đúng pseudocode ở mục 8 của tài liệu này.

## EXAMPLES
- Session hợp lệ + WebGL available -> render core trong canvas và OrbitControls hoạt động.
- WebGL unavailable -> render fallback HTML, route không crash.
- Reduced motion -> render core nhưng không auto animate ring/grid.
- Không có Dataset record -> không tạo glyph, không gọi API.

## OUTPUT
1. Patch chỉ trong các file đã duyệt hoặc file mới được giải thích rõ.
2. Code trọng tâm kèm walkthrough ngắn bằng tiếng Việt.
3. Test route/lifecycle/fallback/reduced-motion.
4. Kết quả typecheck, test, lint/build, `git diff --check`.
5. Browser evidence tách riêng với static validation.
6. Danh sách giả định còn lại, nếu có.

## CRITERIA
- Qua C01-C10 trong phạm vi có thể tự động hóa.
- Không tạo dữ liệu chất lượng giả hoặc tuyên bố data/AI integration.
- Không biến build pass thành bằng chứng visual fidelity hoặc FPS.
```

## 10. Context đã chốt và pipeline visual A–F

### 10.1 Mục tiêu và ranh giới

- Route review: `/workspaces/3d-dataset`. `ProtectedRoute` đang được bypass **tạm thời** chỉ để review visual; phải khôi phục trước release.
- Đây là holographic Dataset 3D presentational. Không gắn record, DataGlyph semantic, kết quả AI, API, RAG, Qdrant hay mapping dữ liệu giả.
- Nguồn hình học/material/motion: `reference-v2/blockout/main.ts`; `index.html` chỉ là host của review scene. Nguồn component gốc: `reference-v2/object-sculpt-spec.json` và `reference-v2/blockout/generated-core.ts`.
- Hologram là blue-volume + cyan technical contour/grid + một violet orbit chính; không phải liquid glass khúc xạ hoặc wireframe trắng.
- Base trung gian bắt buộc: `innerRadius=2.15`, `outerRadius=2.70`, `Y=[0.46,0.66]`, parent `base-shell`; orbit violet ở trên với gap `0.10`.
- Tâm cap là hotspot mạnh nhất; core-foot là điểm nhận sáng mạnh thứ hai. Collar chỉ là accent phụ. Các node còn lại rải thưa, có kích thước/cường độ khác nhau.
- Chuyển động giữ hình học: orbit violet `21s`, mid collar `15s` ngược chiều, base deck `32s`, core cap `24s`, runner `6s`.

### 10.2 Bằng chứng runtime trước pipeline

Quan sát route thật ngày 2026-11-01: canvas render thành công, không có console error; chỉ có warning deprecation `THREE.Clock`. Runtime có base-intermediate sau migration nhưng cyan contour/grid quá mạnh, core đọc như trụ liền, hierarchy violet/cyan/blue chưa đủ rõ. Browser screenshot là evidence quan sát, không phải bằng chứng pass fidelity.

### 10.3 Matrix HTML/Three.js → React hiện tại

| Hệ | Bản review | Product React trước A–F | Trạng thái |
|---|---|---|---|
| Carrier geometry | Factory core + tower + base | Đã port | Giữ kích thước đã duyệt |
| `base-intermediate` | LatheGeometry gắn `base-shell` | Đã port sau review runtime | Cần hạ contour để đọc thành layer riêng |
| Material role | 6 preset role + 9 tower opacity | Đã port sơ bộ | Chưa visually accepted |
| Technical grid | Planar/cylinder/tower | Đã port sơ bộ | Density/hierarchy cần review |
| Light | cap/collar/foot, solar rays, axial spine, nodes | Đã port sơ bộ | Collar phải hạ thành accent theo quyết định mới nhất |
| Motion | 4 rotating nodes, runner, pulse | Đã port sơ bộ | Cần browser-review reduced/non-reduced motion |
| Camera/layout | Reference fit 45°/20° và wide review frame | Fixed product camera, portrait-biased stage khi viewport hẹp | Chưa pass |
| Bloom | Composer tồn tại nhưng review source để tắt mặc định | Chưa port | Chỉ làm sau static pass |

### 10.4 Pipeline cải thiện (one correction group per pass)

| Pass | Chỉ thay đổi | Tiêu chí pass | Không được làm |
|---|---|---|---|
| A — Framing | Canvas review desktop 16:9; camera 45° azimuth, 20° elevation, target `[0,1.17,0]`; fit theo model bounds | Base ngoài không crop, cap không sát top, thấy tầng trung gian/tower sau | Không đổi geometry/material |
| B — Material hierarchy | Giảm contour đồng loạt; blue fill làm mass, cyan cho line, orbit violet là accent ngoài; tower opacity depth | Nhìn ra blue → cyan → violet trong một glance | Không thêm bloom |
| C — Tier separation | Tách đọc core-foot/lower/collar/upper/cap và base-intermediate | Zoom out vẫn thấy tối thiểu 4 nấc core | Không đổi proportion đã duyệt |
| D — Light hierarchy | Cap/foot hotspot, axial spine giảm dần, sparse nodes 3 cấp; collar thành accent phụ | Đọc luồng cap → foot; không thành 3 đèn sáng bằng nhau | Không biến node thành record data |
| E — Tower technical detail | Tower cage/grid + data mark/micro-pattern có chọn lọc | Tower có depth/detail, không cạnh tranh core | Không phủ glyph dày toàn bộ tower |
| F — Motion/Bloom/performance | Kiểm tra motion, thêm selective bloom resize-safe nếu static pass đạt | Bloom-off vẫn đúng; bloom-on chỉ làm mềm hotspot/contour mạnh | Không dùng bloom che lỗi hình học |

### 10.5 Review gate cho từng pass

1. Chụp fixed camera desktop 16:9, góc phải và góc sau.
2. Đối chiếu 5 feature: silhouette, tier separation, violet orbit, tower depth, light hierarchy.
3. Kiểm tra console/WebGL; với pass F kiểm tra resize và reduced motion.
4. Chỉ đánh dấu pass khi có screenshot evidence. Nếu không đạt, ghi `refine-code`; không tự nhảy pass.
5. `img2threejs` state hiện chờ evidence blockout (`render-capture`, diagnostics, multi-angle và AI review); không ghi completion khi chưa có artifacts.

### 10.6 Kết quả thực hiện A–F ngày 2026-11-01

| Pass | Thay đổi source | Trạng thái evidence |
|---|---|---|
| A | Stage desktop 16:9 fit trong viewport; camera pose 45°/20° | Browser fixed-view đã cho thấy outer base không crop; chưa lưu capture artifact |
| B | Contour opacity/color theo role, planar grid giảm density | Browser fixed-view đã quan sát; chờ review user/reference sheet |
| C | Tier opacity và cylinder-grid opacity tách riêng | Một refine-code đã phục hồi blue mass; browser fixed-view đọc tier tốt hơn |
| D | Cap/foot hotspot hierarchy, collar accent, axial/node pulse nhẹ | Browser fixed-view đã quan sát; reduced-motion chưa kiểm tra |
| E | Tower data marks và micro-pattern có chọn lọc | Đã render trên tower; chưa có close-up/right/rear evidence |
| F | EffectComposer + UnrealBloomPass, resize theo canvas; strength `.08`, radius `.25`, threshold `1.35` | Browser fixed-view hoạt động sau một refine; chưa kiểm tra resize/performance đa góc |

Không có pass nào trong bảng này được xem là fidelity-complete cho đến khi có screenshot artifacts, multi-angle review và review của user.

## 11. Nhật ký tiến độ

| Hạng mục | Trạng thái | Bằng chứng / ghi chú |
|---|---|---|
| Hình học core | Đã duyệt ở bản review | Reference-v2 blockout là nguồn đối chiếu |
| Look-dev blue/cyan/violet | Đã duyệt ở bản review | Giữ nguyên trong batch canvas |
| Route `/workspaces/3d-dataset` | Đã triển khai, tạm bypass guard | Lazy-loaded Dataset3DView; `ProtectedRoute` chỉ được bỏ tạm để review visual, phải khôi phục trước release |
| React Three Fiber scene shell | Đã triển khai | `src/graphics/holographic-core/holographic-core.scene.tsx` |
| Fidelity migration factory | Đã triển khai ở source | `src/graphics/holographic-core/generated-core.ts` là bản product-port của factory review; scene dùng factory thay vì JSX reconstruction |
| `base-intermediate` | Đã port ở source | LatheGeometry `inner 2.15`, `outer 2.70`, Y `[0.46, 0.66]`, gắn vào `base-shell`; node/mesh được thêm vào runtime map |
| Look-dev kỹ thuật bổ sung | Đã port một phần ở source | Có material-role preset, tower opacity map, cylinder/planar grid, cap solar rays, 3 hotspot, axial spine, scattered nodes, tower grid và runner pulse; chưa browser-review |
| Canvas responsive | Đã triển khai ở source | R3F Canvas lấy kích thước container; chưa browser-review với phiên hợp lệ |
| WebGL fallback | Đã triển khai ở source | Canvas fallback, error boundary và context-lost handler; chưa browser-review lỗi renderer thật |
| Reduced motion | Đã triển khai và unit test | View theo dõi media query và gửi prop cho scene; browser-review còn chờ |
| Cleanup lifecycle | Đã triển khai ở source | OrbitControls/context listener cleanup; cần bổ sung test lifecycle riêng nếu batch mở rộng |
| Sidebar | Hoãn | Không thuộc batch canvas-first |
| Inspector/DataGlyph | Hoãn | Không thuộc batch canvas-first |
| Data-quality mapping | Chờ đặc tả | Cần input/output, axis, sampling và source identity |
| Complex orbit | Hoãn | Chỉ làm nếu có yêu cầu quỹ đạo nhiều glyph rõ ràng |
| RAG backend | Ngoài phạm vi | Slide chỉ là tham khảo kỹ thuật |
| Unit test view | Đã chạy | 2 test mới: canvas-first boundary và reduced-motion prop |
| Full test suite | Đã chạy | 18 files, 306 tests pass |
| Typecheck / targeted lint / build / diff check | Đã chạy lại sau migration | Pass cho `src/graphics/holographic-core`, route/view/test mới; Vite cảnh báo chunk 3D lớn do Three.js/geometry |
| Unit test view | Đã chạy lại sau migration | 2 test pass; chưa kiểm chứng pixel/WebGL runtime |
| C11 factory/component runtime | Pass tĩnh | Product factory tạo `sculptRuntime` gồm node/mesh map và scene mount bằng `<primitive>` |
| C12 look-dev hoàn chỉnh | Chưa đạt | Chờ browser review cho layer đã port; tower data marks/micro-pattern chi tiết của bản review chưa port vì cần duyệt density sau screenshot |
| C13/C14 visual và resize-bloom | Chờ browser review | Route hiện không còn yêu cầu phiên để review; bloom composer vẫn chưa được gắn vào R3F product scene |
| Lint toàn repo | Chưa chạy lại toàn repo | Legacy review files trong `.agents/holographic-core/...` vẫn ngoài source product; targeted lint của batch pass |
| Browser route review | Chờ screenshot mới | Route tạm bypass auth để visual review; cần kiểm tra geometry/camera/motion trên browser thật |

## 12. Quy trình cập nhật tài liệu

Sau mỗi batch, chỉ cập nhật bảng tiến độ bằng bằng chứng thực tế:

1. Patch/source đã review.
2. Lệnh validation đã chạy và kết quả.
3. Browser evidence đã quan sát.
4. Vấn đề còn mở hoặc test chưa thực hiện.

Không đổi `Chưa triển khai` thành `Đã xong` chỉ vì source đã viết hoặc build pass.
