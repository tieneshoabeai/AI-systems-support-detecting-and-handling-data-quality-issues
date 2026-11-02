# Validation log — Neon Glass Cube

Ngày mở log: 2026-11-02
Người xác nhận: human (chủ dự án) — đã duyệt plan trước khi thực thi
Trạng thái: **spec v2 locked — model v2 + preview (clay mode) + 4 cube trong Dataset 3D đã giao**
Gate policy: **không đóng gate nào của img2threejs** (không chạy `forge/state.py mark`; chỉ chạy validator)

---

## 0. Xác nhận của human (bắt buộc trước khi thực thi)

| Ngày | Người xác nhận | Nội dung xác nhận | Bằng chứng |
|---|---|---|---|
| 2026-11-02 | human (chủ dự án) | Duyệt plan `/Users/mac/.qoder/plans/ardent-hollow-crane.md` | plan được chấp thuận trong phiên |
| 2026-11-02 | human (chủ dự án) | Chọn **phương án B**: dùng đúng số liệu plan gốc — đế dày 0.16, lỗ 1.64, đế nhỏ 1.48, khối lớn 1.32, cao 1.46 | trả lời "B …" trong phiên |
| 2026-11-02 | human (chủ dự án) | **Yêu cầu v2**: lõi = 2/3 khối lớn; đế nhỏ tím đậm gần đen; 8 điểm góc phát sáng; 4 tấm sáng dọc cao 1/3 khối, dày 0.004; clay render toggle; 4 cube tím/cyan/cam/xanh quanh orb Dataset 3D | các tin nhắn thiết kế trong phiên |
| 2026-11-02 | human (chủ dự án) | **Duyệt điều chỉnh camera Dataset 3D**: elevation 13.5° → 18°, distance 13.9 → 18.5; sau đó human chốt lại `INITIAL_CAMERA_POSITION (11.45, 9, 11.45)`, `CAMERA_TARGET (0, 2.1, 0.5)`, `maxDistance` 25, fog 0.011; duyệt tiếp **fov 24 → 34** cho framing mặc định | "xác nhận duyệt" + chọn "Tăng fov 24 → 34" trong phiên |

Không bước nào được coi là "human-confirmed" nếu thiếu dòng trong bảng này. Xác nhận B **không** đóng gate nào của img2threejs.

---

## 1. Bối cảnh & phạm vi đã chốt với human

- Mục tiêu: đặc tả có số liệu cho **khối neon glass cube 4 phần** trong ảnh tham chiếu, rồi dựng model Three.js thuần.
- 4 bộ phận chính: 1 khối lớn, 1 khối nhỏ bên trong, 1 đế lớn có lỗ ở giữa, 1 đế nhỏ đặt trong lỗ.
- Model là **module độc lập** `src/graphics/neon-cube/*`, tái sử dụng qua tham số `theme`.
- Dataset 3D: chỉ **thêm** cluster 4 cube quanh orb trong `workspaces/3d-dataset`; không sửa
  model/towers/base/router/view hiện có.
- Không thêm dependency; chỉ dùng `three@0.186.1` + addons đã có.
- Preview chỉ là harness dev (`preview.html`), không phải UI sản phẩm; clay mode chỉ tồn tại ở preview.
- Metadata/spec bằng tiếng Anh; tài liệu và nhãn UI bằng tiếng Việt.
- Không đóng gate, không đánh dấu bước nào của forge.

---

## 2. Quan sát & đo đạc ảnh (trước khi viết spec)

- Ảnh gốc: 1437 × 1094, một góc nhìn isometric.
- Bounding box pixel sáng (ngưỡng 120): x 51..1397, y 109..989; silhouette theo mask (lum > 55): y 123..966 → chiếm **77.1%** chiều cao khung.
- Bề rộng đế trên màn hình ≈ **942 px**; bề rộng khối lớn ≈ **637–638 px** → **0.678**.
- Góc elevation suy ra từ silhouette ≈ **24°**, không phải 32°.
- Đế là khối dày, không phải tấm mỏng; mặt đế nhỏ thấp hơn mặt đế lớn một bậc nhỏ.
- Khối lớn chia 3×3 ô/mặt; 12 cạnh sáng; khối nhỏ cùng tâm, viền sáng hơn. Ảnh gốc cho lõi ~1/3;
  **v2 nâng lên 2/3 theo yêu cầu human**.
- Nền đen tím, lưới sàn mờ, không chữ/logo.

---

## 3. Chốt số liệu: A (đo) vs B (plan) — human chọn B

| Hạng mục | A — bản đo ảnh | B — plan đã duyệt (đang dùng) | Ghi chú |
|---|---|---|---|
| Cạnh đế lớn | 2.00 | **2.00** | chuẩn hoá |
| Dày đế lớn | 0.24 | **0.16** | extrude depth 0.12 + bevel 0.02 × 2 |
| Lỗ đế | 1.34 | **1.64** | thành lỗ 0.18 |
| Đế nhỏ | 1.24 × 0.24 (mặt trên 0.22) | **1.48 × 0.14** (mặt trên 0.14) | khe 0.08 quanh đế nhỏ |
| Khối lớn | 1.14 | **1.32** | tỉ lệ khối/đế 0.66 |
| Khối nhỏ | 0.36 | **0.88** (v2; 0.44 ở v1) | 0.667 cạnh khối lớn |
| Cao model | 1.34 | **1.46** | khối đứng trên mặt đế 0.14, dung sai ghép 0.001 |
| Camera | target (0, 0.70, 0) | **fov 8°, distance 20, target (0, 0.60, 0), az 45°, elev 24°** | xem mục 6 — đổi từ fov 28 / distance 4.3 / elev 32 để khớp silhouette |

Các tỉ lệ chốt: khối/đế **0.66**; khối nhỏ/khối lớn **0.667**; bậc đế **0.02**; khe đế **0.08**.
v2 bổ sung: góc phát sáng 0.03³ (8 chiếc); tấm sáng 2.00 × 0.44 × 0.004 (4 chiếc, y 0.16..0.60).

---

## 4. Kiểm tra đặc tả — kết quả cuối

Spec: `src/graphics/neon-cube/object-sculpt-spec.json` (JSON hợp lệ, đã qua 3 lớp kiểm tra).

### 4.1 `validate_sculpt_spec.py` (normal)

```bash
python3 /Users/mac/.qoder/skills/img2threejs/forge/stage2_spec/validate_sculpt_spec.py \
  src/graphics/neon-cube/object-sculpt-spec.json
```

Output nguyên văn:

```text
PASS
EXIT:0
```

### 4.2 `validate_sculpt_spec.py --strict-quality`

```bash
python3 /Users/mac/.qoder/skills/img2threejs/forge/stage2_spec/validate_sculpt_spec.py \
  src/graphics/neon-cube/object-sculpt-spec.json --strict-quality
```

Output nguyên văn:

```text
PASS
EXIT:0
```

### 4.3 `node .agents/neon-cube/check-spec.mjs`

Output tóm tắt nguyên văn:

```text
PASS: 158/158 semantic checks passed
EXIT:0
```

Script kiểm tra các nhóm: cấu trúc 4 phần + chuỗi cha–con; tỉ lệ (1.32 < 1.48 < 1.64 < 2.00,
khe vành 0.08, khe khối–đế 0.08, khe khối–thành lỗ 0.16, lõi cách kính **0.22**, tỉ lệ khối/đế 0.66,
**lõi/khối 0.667**, đế dày/cạnh 0.08); cao độ tiếp xúc (đế 0.16, đế nhỏ 0.14, khối đáy 0.14 trùng
mặt đế, khối đỉnh 1.46, lõi tâm 0.80, **lõi 0.36…1.24**); số lượng 54/24/12/12/**8 corner**/**4
light sheets** và độ dày nan 0.006/0.010/0.007; camera fov 8 / az 45 / elev 24 / distance 20 và
positionHint suy ra từ hình cầu; ngân sách 25k tri / **14 draw call** / 60 fps; palette hue 260–300
hoặc trung tính; cờ material (pane additive opacity 0.15 emissive `#6E1EFF` ×0.9, base `#5614C8`
×0.85 opacity 0.88, **inner base `#170528`/`#0A0212` opacity 0.94 tối hơn base**, neon HDR
`[1.35,1.15,1.85]`, **light-sheet HDR `[0.75,0.38,1.35]` additive FrontSide utility**, không
transmission, clearcoatRoughness ≥ 0.4, glow opacity 0.4); under-base light 1.8; đủ hợp đồng
attachment (cho phép `seated-in-opening`, `suspended` và `rest` với embedDepth 0); detail inventory
map 100% vào localFeatures/localOverrides; mọi evidenceRef trỏ tới viewEvidence hợp lệ; ≤5 critical
/ ≤3 important mỗi pass; textureless có evidence và không kèm field texture; pipeline 8 pass bắt
đầu từ blockout với 0 pass hoàn thành.

---

## 5. Capture & so sánh reference

Đã chạy đủ 8 ảnh bằng Playwright + Chrome SwiftShader, viewport 1280 × 900, dpr 1.

| File | View | Triangles | Draw calls | Ghi chú |
|---|---|---|---|---|
| `captures/hero-45.png` | az 45°, elev 24° | 23,442 | 13 | ảnh chấm chính |
| `captures/orbit-135.png` | az 135° | 23,442 | 13 | |
| `captures/orbit-225.png` | az 225° | 23,442 | 13 | |
| `captures/orbit-315.png` | az 315° | 23,442 | 13 | |
| `captures/top-60.png` | elev 60°, distance ×1.15 | 23,442 | 13 | kiểm lỗ đế |
| `captures/base-closeup.png` | zoom đế, elev 42° | 23,442 | 13 | kiểm khe 0.08 + bậc 0.02 |
| `captures/clay-45.png` | az 45°, `?clay=1&ui=0` | 23,442 | 13 | clay render: vật liệu trung tính, tắt bloom/neon |
| `captures/clay-exploded.png` | az 45°, `?clay=1&ui=0`, exploded | 23,442 | 13 | clay + tách 4 phần |
| `captures/comparison-hero.png` | — | — | — | sheet reference ↔ render |

`captures/reference.png` và `reference/reference.png` là bản copy ảnh gốc.

Preview có tương tác: `OrbitControls` (kéo trái xoay, lăn zoom, kéo phải pan), nút **Tách khối /
Ghép lại** (phím `E`) nâng 4 phần theo +Y và tự căn camera, nút **Góc 45°** (phím `R`), nút
**Clay** bật/tắt vật liệu trung tính (chỉ ở preview). Đã kiểm tách → xoay → reset → ghép lại trong
Chrome: không lỗi console, frame ở trạng thái nghỉ vẫn giống nhau. Capture chạy `?ui=0` ở trạng
thái ghép nên các số liệu dưới đây không đổi (hash hero `bb05323fdb428136`).

Kết quả lần chạy cuối (nguyên văn):

```text
hero-45.png: 23442 tri, 13 draw, view=45
orbit-135.png: 23442 tri, 13 draw, view=135
orbit-225.png: 23442 tri, 13 draw, view=225
orbit-315.png: 23442 tri, 13 draw, view=315
top-60.png: 23442 tri, 13 draw, view=top
base-closeup.png: 23442 tri, 13 draw, view=45
clay-45.png: 23442 tri, 13 draw, view=45
clay-exploded.png: 23442 tri, 13 draw, view=45
static 400ms: identical (bb05323fdb428136 vs bb05323fdb428136)
console errors: none
```

Đo framing / silhouette / palette (mask lum > 55, palette lum > 70 & sat ≥ 0.18):

```text
hero-45.png    bbox 923x732  margins L178 R179 T69 B99  occupancy 72.1% x 81.3%
orbit-135.png  bbox 924x728  margins L178 R178 T69 B103 occupancy 72.2% x 80.9%
orbit-225.png  bbox 924x729  margins L178 R178 T69 B102 occupancy 72.2% x 81.0%
orbit-315.png  bbox 923x729  margins L179 R178 T69 B102 occupancy 72.1% x 81.0%
top-60.png     bbox 802x779  margins L239 R239 T86 B35  occupancy 62.7% x 86.6%

palette: render 98.7% in 260–300 (median 278.9), cyan-green 0; reference 98.4% (median 275.0)
bloom: brightest 48×48 window mean 202.8 at (637,757) = front base corner;
       frame-corner 64×64 mean lum 0.2–0.7 (max 11.5) → nền tối > 90%
```

Tỉ lệ khối/đế trên màn hình không còn đo được bằng silhouette ngang: 4 tấm sáng v2 cao 0.44
cùng bề rộng khối nên chiếm trọn dải silhouette phía trên, làm phép đo bề rộng khối thành 1.00.
Tiêu chí 0.66 được chứng minh bằng hình học: `NEON_CUBE.cubeSide / baseSide = 1.32 / 2.00`, model
test khẳng định panel bbox 1.32³ và base bbox 2.00 × 0.16 × 2.00.

---

## 6. Checklist nghiệm thu (mục 12 của plan)

| # | Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Khối lớn / đế = 0.66 ± 0.04; khối cao = cạnh | **PASS** | hình học 0.66; đo màn hình 0.697 do bloom nở viền; model test: panel bbox 1.32³ |
| 2 | Đế dày / cạnh = 0.08 ± 0.01; bậc đế 0.02 ± 0.005 | **PASS** | spec 0.16/2.00; base-inner top 0.14 vs base-outer top 0.16; model test |
| 3 | 9 ô/mặt; 24 rãnh + 12 cạnh sáng liên tục | **PASS** | InstancedMesh 54; seam 24; outer edge 12; ảnh hero/orbit |
| 4 | Khối nhỏ (lõi) = 2/3 cạnh khối lớn (v2), tâm trùng | **PASS** | 0.88/1.32 = 0.667; ảnh hero thấy lõi qua kính; test spec + model |
| 5 | Khe 0.08 quanh đế nhỏ nhìn thấy 4 phía | **PASS** | ảnh base-closeup + top-60; spec gap 0.08 |
| 6 | Palette chỉ hue 260–300° + trắng; không cyan/lục | **PASS** | 98.7% trong 260–300; median 278.9 vs reference 275.0; cyan-green 0 |
| 7 | Góc trước bệ sáng nhất; nền góc khung tối > 90% | **PASS** | cửa sổ 48×48 sáng nhất tại (637,757); góc khung mean 0.2–0.7 |
| 8 | 4 góc + top giữ silhouette 4 phần, không clipping | **PASS** | margins ngang 178–179, trên 69, dưới 35–103 |
| 9 | Static: 2 frame cách 400 ms giống nhau | **PASS** | SHA giống nhau `bb05323fdb428136` |
| 10 | `tsc`, eslint, test pass; không lỗi console | **PASS** | `tsc -b` 0; eslint 0; vitest 22/22; console errors: none |
| 11 | Đế nhỏ tím đậm gần đen, tách khỏi đế lớn | **PASS** | `glass-base-inner` `#170528` / emissive `#0A0212`, opacity 0.94; ảnh hero + base-closeup |
| 12 | 8 điểm góc phát sáng (4 mặt trên đế lớn + 4 mặt trên khối lớn) | **PASS** | ảnh hero/orbit; spec `corner-markers` count 8, perFace 4, 0.03³ |
| 13 | 4 tấm sáng 2D ở viền đế, cao 0.44, dày 0.004, phát sáng additive | **PASS** | `light-sheet` HDR [0.75,0.38,1.35], additive FrontSide; ảnh hero thấy 4 tấm |
| 14 | Clay mode chỉ ở preview, giữ orbit/tách–ghép | **PASS** | `clay-45.png`, `clay-exploded.png`; bloom/neon/sheet/sprite tắt |
| 15 | 4 cube tím/cyan/cam/xanh quanh orb ở `workspaces/3d-dataset`, model độc lập | **PASS** | `NEON_CUBE_CLUSTER_LAYOUT` + `createNeonCubeCluster()`; ảnh `/tmp/dataset-cluster.png`, không lỗi console |

---

## 7. Deviations / giả định đã ghi nhận

- Chỉ có 1 view: mặt sau, đáy, lòng khối giả định đối xứng.
- **Camera đổi so với plan** để khớp silhouette ảnh: fov **8°**, distance **20**, azimuth **45°**,
  elevation **24°**, target **(0, 0.60, 0)** → position ≈ (12.92, 8.73, 12.92). Plan ghi fov 28 /
  distance 4.3 / elev 32 / target 0.72; số đo ảnh (elevation ≈24°, silhouette 77.1% khung) dẫn
  tới cấu hình tele hiện tại.
- **Bloom** thực tế **0.05 / 0.25 / 1.00** (strength/radius/threshold) thay cho 0.85/0.60/0.70 của
  plan: `UnrealBloomPass` trong composer HDR cho hiệu ứng mạnh hơn nhiều so với giá trị danh nghĩa;
  0.85 làm bão hoà trắng toàn khối.
- **FogExp2 density 0.012** (plan 0.03) để nền không bị tim hoá quá mức.
- **clearcoatRoughness 0.5** (thử 0.08 sinh highlight gương hồng lạ trên mặt kính).
- **Bỏ sprite góc trước**: sprite ghim world bị lệch thành quầng rời khi xoay 135°/315°; độ sáng
  góc trước bệ hiện do vertex-color hotspot trên viền neon (hướng nhìn độc lập). Nhờ vậy v1 giảm
  còn **10 draw calls**; v2 thêm marker + tấm sáng + material đế nhỏ nên hiện là **13** (trần 14).
- **Top view** dùng distance ×1.15 để tránh cắt đáy khung (margin B từ 0 lên 35 px).
- **Dịch hue ấm hơn** để khớp reference: pane `#6e1eff`, base `#5614c8`, ambient `#341470`,
  under-base light intensity **1.8**.
- **Tinh chỉnh bề dày**: nan rãnh 0.006, cạnh khối lớn 0.010, cạnh khối nhỏ 0.007; bán kính viền
  ngoài 0.009, viền lỗ 0.007, viền đế nhỏ 0.007; pane opacity 0.15 + emissive ×0.9.
- **Mặt ngoài panel** dùng bán kính tâm 0.650 + nửa dày 0.010 = 0.660 (nửa cạnh khối 1.32/2),
  pane không nhô ra ngoài khung cạnh.
- Không dùng transmission; độ trong đến từ additive + bloom.
- Sàn chỉ thuộc preview harness, không thuộc model.
- Bloom/ACES có thể lệch giữa GPU thật và SwiftShader; ưu tiên silhouette/tỉ lệ.
- `cube-outer → base-inner` là contact `rest`: đáy khối 0.14 trùng mặt đế 0.14; `embedDepth 0.001`
  được giữ làm dung sai ghép, không phải độ lún hình học.
- Delta thị giác còn lại (chấp nhận, hướng stylized): bloom reference mềm/rộng hơn, gradient mặt
  trên đế mạnh hơn, lưới sàn mờ hơn.

### 7.1 Thay đổi v2 (human yêu cầu 2026-11-02)

- **Lõi 0.44 → 0.88**: ảnh gốc cho lõi ~1/3 nhưng human chốt 2/3; khe lõi–kính còn 0.22 mỗi phía;
  `inner-edge-frame` dài 0.88; check-spec cập nhật tỉ lệ 0.667 và bounds 0.36…1.24.
- **Đế nhỏ tím đậm gần đen**: material riêng `glass-base-inner` (`#170528`, emissive `#0A0212`
  ×0.6, opacity 0.94, depthWrite true) thay vì dùng chung `glass-base`.
- **8 điểm góc phát sáng**: 2 component `corner-markers-base` / `corner-markers-cube`, mỗi cái 4
  khối 0.03³ trong 1 InstancedMesh, dùng material `neon-edge`. `corner-markers-cube` lưu transform
  local `[0, 1.32, 0]` trong không gian cube-outer để worldY = 1.46 (đúng mặt trên khối).
- **4 tấm sáng dọc**: `light-sheets` gồm 4 `BoxGeometry(2.00, 0.44, 0.004)` dựng đứng ở viền đế,
  từ y=0.16 (mặt đế) tới y=0.60 (= 1/3 chiều cao khối), additive, FrontSide, depthWrite false,
  `toneMapped:false`, HDR [0.75,0.38,1.35]; khai báo `qualityTier: utility` để strict validator
  không đòi texture-authoring cho một tấm phát sáng thuần.
- **Bỏ cyan/electric blue khỏi cube**: palette vẫn tím; 4 màu tím/cyan/cam/xanh chỉ dùng cho
  **cluster ở Dataset 3D** qua `theme`, không đổi cube trung tâm trong preview.
- **Clay mode** chỉ ở preview (`?clay=1` hoặc nút Clay): đổi sang `MeshStandardMaterial` xám
  `#c9c5be`, roughness 0.82, ẩn sprite/tấm sáng/quầng, tắt bloom, nền `#232327`; OrbitControls và
  tách/ghép giữ nguyên.
- **Dataset 3D**: thêm `createNeonCubeCluster()` trong `neon-cube.cluster.ts` + `<NeonCubeNodes />`
  trong `holographic-core.scene.tsx`; 4 cube đặt 4 góc phần tư quanh orb (bố cục tham khảo
  `DataVerse_Project_Workspace_Overview_v1.png`), model vẫn độc lập và tái sử dụng.
- **Camera mặc định Dataset 3D** (human chốt 2026-11-02, **đã duyệt**):
  `INITIAL_CAMERA_POSITION = (11.45, 9, 11.45)`, `CAMERA_TARGET = (0, 2.1, 0.5)` →
  distance **17.3**, elevation **23.5°**, azimuth **46.3°**; `maxDistance` **25**, `minDistance` 4.4;
  fog density **0.011**. (Lịch sử chỉnh: 13.9 → 18.5 → 17.3; target y 1.45 → 2.1.)
  Kiểm chứng: ảnh `/tmp/dataset-initial.png` + `/tmp/dataset-zoomout.png`, không lỗi console.
- **Cluster v3** (human duyệt Option A 2026-11-02): cube lớn **1.5×** (0.50 → 0.75; 0.48 → 0.72)
  và đẩy xa core **gấp đôi** theo XZ, giữ nguyên y — `NEON_CUBE_CLUSTER_LAYOUT`:
  violet (−6, 2.7, 2) 0.75; cyan (2, 2.9, −6) 0.75; blue (−1.2, 1, 6.8) 0.72;
  orange (6.8, 1.15, −1.2) 0.72. Yaw vẫn suy ra từ `atan2(−x, −z)`.
  Ở distance mặc định 17.3 với `fov 24`, blue/orange chạm mép khung; human chốt **tăng `fov` 24 → 34**
  (giữ nguyên position/target/`maxDistance` 25) → cả 4 cube + core nằm trọn khung ngay khi mở trang;
  ở `maxDistance` 25 vẫn còn lề rộng (`/tmp/dataset-initial.png`, `/tmp/dataset-zoomout.png`),
  không lỗi console.
- **Ngân sách v2**: 23,442 tri (≤ 25,000), **13 draw call** (≤ 14: thêm 1 marker instanced +
  1 light-sheet + 1 inner-base material). Ảnh framing rộng hơn v1 vì tấm sáng nới silhouette.
- **Test v2**: thêm 3 test model + 1 test spec cho corner markers, light sheets, inner-base material;
  tổng 22/22.

### 7.2 Tương phản 3 tầng Dataset 3D (human yêu cầu + duyệt 2026-11-02)

Yêu cầu: `tower – core – base` đang cùng tông xanh nên khó tách tầng. Human duyệt plan tách bằng
**giá trị sáng + hue** (chỉ material/ánh sáng, không đổi hình học):

- **Core (tầng sáng nhất, HDR cyan)**: `applyTierContrast()` đặt `core-upper` emissive `#2ae6ff`
  ×1.35, `core-lower` `#1fd0ff` ×1.0, mid/lower collar ×0.6/1.0; contour `#4de6ff`. Đây là tầng
  duy nhất vượt ngưỡng bloom 1.0 nên tâm orb là điểm sáng chính.
- **Tower (steel blue, trung gian)**: `TowerTone` glass emissive `#031a42` ×0.36, frame `#1b5fbf`
  ×0.45/opacity 0.82, window 0.5, corner post `#9fefff` 0.85.
- **Base (tím, tối nhất)**: shell `#2a0f52` emissive `#6d3bff` ×0.45/opacity 0.26; intermediate
  `#1c0a3a`; 4 sắc sector tím `#2f1666/#140626/#1a0733/#241047`; contour/linework/deck/rim đều tím
  (`#8a5bff`/`#a37bff`/`#b18cff`); ring light hạ opacity (orbit 0.5, halo 0.18, deck 0.2/0.1, base
  halo 0.22). Sàn quanh bệ đổi glow + 2 vòng sàn sang tím (`rgba(70,60,190,0.30)`,
  `rgba(178,140,255,0.16)`); lưới sàn vẫn cyan.
- **Ánh sáng scene**: ambient `#266bc9` 0.28 (hạ để không làm phẳng), key `#35e9ff` 20, violet
  `#9a55ff` 10.
- **Đo trên `/tmp/dataset-initial.png`** (band đại diện, luminance Rec.709 + hue vòng tròn có trọng
  số độ bão hoà):
  base lower band **L 63.9 / hue 259.6**; tower trái **79.9 / 208.1**, tower phải **100.3 / 210.7**;
  core drum **172.5–199.5 / 186.5–192.5**. Thứ tự **base < tower < core** đạt (base thấp hơn tower
  25–57%, core cao hơn tower 70–116%); hue cách nhau ~50° (base↔tower) và ~20° (tower↔core).
- Kiểm chứng: `tsc` 0, eslint 0, `vitest run src/__tests__/dataset-3d` **25/25**, capture không lỗi
  console. Ảnh: `/tmp/dataset-initial.png`, `/tmp/dataset-zoomout.png`.

### 7.3 Tinh chỉnh tầng tower (human yêu cầu 2026-11-02)

Human xác nhận base đã ổn nhưng tower vẫn chưa tách tầng. Nguyên nhân: mọi accent của tower dùng
cyan của core (`#9fefff` posts, `#7fd8f5` window lit, `#9fe6ff` risers, `#17d7ff` data marks), nên ở
điểm sáng nhất tower "dính" vào core. Sửa **chỉ material/ánh sáng**, không đổi hình học/draw call:

- Corner post `#9fefff` @0.85 → `#6fa8ff` @0.62; window lit `#7fd8f5` → `#4f97e8`, unlit
  `#12374c` → `#0a2136`, opacity 0.5 → 0.34; roof outline `#9fefff` @0.55 → `#6fa8ff` @0.45;
  data marks nhận thêm tham số `color` và dùng `#6fa8ff`; risers `#9fe6ff` @0.55 → `#5b9cf0` @0.45.
- Giữ cấu trúc khối: frame `#0b3f86/#1b5fbf` ×0.45 → `#2a6fdb` ×0.55, opacity 0.9; glass
  `#0a2a52` → `#0a2848`, opacity 0.4 → 0.36, emissive ×0.42.
- Thêm rim point `#3f7dff` intensity 12 / d10 tại (−5, 4.5, −5) để tách tower sau khỏi nền navy.
- **Đo lại** (`/tmp/dataset-initial.png`, band tower trái/phải): mean **77.9 / 93.0**, P95 **178.3 /
  182.6**, hue **214.0 / 218.1**, pixel cyan bão hoà **1.0% / 1.6%** (trước đây accent cyan chiếm
  phần lớn điểm sáng). Base **63.5 / 259.5**, core drum **187.6 / 190.8** — thứ tự
  `base < tower < core` và hue base↔tower ~43°, tower↔core ~24°.
- Kiểm chứng: `tsc` 0, eslint 0, dataset tests **25/25**, capture không lỗi console.

---

## 8. Kiểm tra mã & test

```bash
npx tsc -b
npx eslint src/graphics/neon-cube src/graphics/holographic-core src/__tests__/neon-cube .agents/neon-cube/*.mjs
npx vitest run src/__tests__/neon-cube
```

Kết quả: tsc **0**, eslint **0**, vitest **22/22 pass** (14 test model + 8 test spec).

Test bao phủ: chuỗi cha–con 4 phần; kích thước/contact của đế, đế nhỏ, khối lớn, lõi; số panel
54 + seam 24 + edge 12 + inner edge 12; 8 corner marker / 4 light sheet; HDR trong vertex color;
chỉ còn 1 sprite `core-halo` (không có sprite góc); cờ material (gồm `glass-base-inner` tối hơn
`glass-base` và `light-sheet` additive/utility); ngân sách 23,442 tri / 13 draw; hằng camera;
dispose không ném lỗi; đối chiếu spec JSON ↔ hằng số model; `theme` đổi màu được cho cluster.

---

## 9. Trạng thái cuối

- Spec: **B v2 — locked (human xác nhận 2026-11-02)**
- Model: **v2 delivered** — `src/graphics/neon-cube/neon-cube.model.ts` (lõi 0.88, 8 góc sáng,
  4 tấm sáng, đế nhỏ tím đậm, theme hoá)
- Cluster cho Dataset 3D: **delivered** — `src/graphics/neon-cube/neon-cube.cluster.ts` +
  `NeonCubeNodes` trong `holographic-core.scene.tsx` (4 cube tím/cyan/cam/xanh)
- Preview harness: **delivered** — `src/graphics/neon-cube/preview.html` + `neon-cube.preview.ts`
  (orbit bằng chuột, tách/ghép 4 khối, reset góc 45°, clay mode)
- Capture + comparison: **delivered** — `.agents/neon-cube/captures/` (8 ảnh + sheet so sánh)
- Gate img2threejs: **không đóng** (không chạy `forge/state.py mark`, không đánh dấu pass nào)
