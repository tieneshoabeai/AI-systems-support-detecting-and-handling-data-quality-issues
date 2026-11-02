# Neon Glass Cube — Description Plan (đặc tả thiết kế có số liệu)

Trạng thái: **spec v2 locked — model v2 + preview (clay mode) + 4 cube trong Dataset 3D đã giao**
Ngày: 2026-11-02
Nguồn: 1 ảnh tham chiếu duy nhất `reference/reference.png` (1437 × 1094)
Skill: `img2threejs` — dùng validator của skill, **không đóng gate nào**
Phạm vi: module độc lập `src/graphics/neon-cube/*`; Dataset 3D chỉ nhận thêm 4 cube (không sửa
model/towers/base/scene/router hiện có).

---

## 1. Đo đạc ảnh tham chiếu

Ảnh là một render neon tổng hợp, nền đen tím, lưới sàn mờ. Đo bằng Pillow trên ảnh gốc:

| Đại lượng | Giá trị đo | Ghi chú |
|---|---|---|
| Kích thước ảnh | 1437 × 1094 px | aspect 1.3135 |
| Bounding box silhouette (ngưỡng ≥150) | y 123..966 | cao 843 px = **77.1%** chiều cao ảnh |
| Bề rộng đế trên màn hình | 942 px | điểm rộng nhất của bệ, đã loại bloom |
| Bề rộng khối lớn trên màn hình | 637–638 px | đo tại hai cạnh đứng |
| Tỉ lệ khối/đế của ảnh | **0.678** | 637 / 942 |
| Đỉnh khối (màn hình) | y ≈ 123 px | |
| Góc trước đế (màn hình) | y ≈ 966 px | đế dày, không phải tấm mỏng |
| Tỉ lệ khối/đế dùng trong spec | **0.66** | 1.32 / 2.00 (plan đã duyệt) |

Ảnh chỉ có 1 góc nhìn. Mặt sau, mặt đáy và lòng khối là **giả định đối xứng**; ghi rõ ở mục 16.

---

## 2. Hệ toạ độ & quy ước

- Right-handed; **+Y hướng lên**, **+Z là mặt hướng camera** trong ảnh, +X sang phải.
- Gốc toạ độ: tâm mặt sàn dưới model, cao độ y = 0.
- Đơn vị: tương đối. **Cạnh đế lớn = 2.00** → 1.00 = nửa cạnh đế.
- Model không bake góc isometric; camera preview dùng tele 8° ở khoảng cách 20 (gần orthographic), azimuth 45°, elevation 24°.
- Tất cả bộ phận chính xoay `(0, 0, 0)`; khối nhỏ đồng tâm khối lớn.

---

## 3. Cây bộ phận & quan hệ cha–con

```
root                               (assembly, y=0)
└─ base-outer                      (đế lớn 2.00², có lỗ vuông 1.64²)
   ├─ rim-outer                    (viền neon mép ngoài, y=0.16)
   ├─ rim-hole                     (viền neon mép lỗ, y=0.16)
   ├─ corner-markers-base          (4 điểm góc mặt trên đế, 0.03³)
   ├─ light-sheets                 (4 tấm sáng 2.00 × 0.44 × 0.004, y 0.16..0.60)
   └─ base-inner                   (đế nhỏ 1.48², tím đậm gần đen, mặt trên y=0.14)
      ├─ rim-inner                 (viền neon mép đế nhỏ, y=0.14)
      └─ cube-outer                (khối lớn 1.32³, đáy y=0.14)
         ├─ panel-grid             (54 tấm kính 3×3/mặt, InstancedMesh)
         ├─ seam-grid              (24 nan rãnh chia ô)
         ├─ cube-edges             (12 nan cạnh khối lớn)
         ├─ corner-markers-cube    (4 điểm góc mặt trên khối, 0.03³)
         └─ cube-inner             (khối nhỏ 0.88³, tâm y=0.80)
            ├─ inner-edges         (12 nan cạnh khối nhỏ)
            └─ core-glow           (point light + sprite lõi)
```

4 bộ phận chính: `base-outer`, `base-inner`, `cube-outer`, `cube-inner`.
Chi tiết con: `panel-grid`, `seam-grid`, `cube-edges`, `inner-edges`, `rim-*`, `corner-markers-*`,
`light-sheets`, `core-glow`.

---

## 4. Kích thước macro (đơn vị tương đối)

| id | parent | primitive | W × H × D | Local position (pivot) | World extent Y | Xoay |
|---|---|---|---|---|---|---|
| `root` | — | group | — | (0, 0, 0) | — | 0 |
| `base-outer` | root | extrude (vuông bo góc + lỗ) | 2.00 × 0.16 × 2.00; lỗ 1.64 × 1.64; thành 0.18 | (0, 0, 0) | 0 → 0.16 | 0 |
| `base-inner` | base-outer | rounded box | 1.48 × 0.14 × 1.48 | (0, 0, 0) | 0 → 0.14 | 0 |
| `cube-outer` | base-inner | box shell | 1.32 × 1.32 × 1.32 | (0, 0.14, 0) | 0.14 → 1.46 | 0 |
| `cube-inner` | cube-outer | box + rods | **0.88 × 0.88 × 0.88** | (0, 0.66, 0) | **0.36 → 1.24** | 0 |

Quan hệ kiểm tra:

- Bậc đế: mặt đế lớn 0.16, mặt đế nhỏ 0.14 → **0.02**.
- Khe đế nhỏ ↔ thành lỗ: (1.64 − 1.48) / 2 = **0.08** mỗi phía.
- Khối lớn ↔ thành lỗ: (1.64 − 1.32) / 2 = **0.16** mỗi phía.
- Khối lớn ↔ mép đế nhỏ: (1.48 − 1.32) / 2 = **0.08** mỗi phía.
- Khối nhỏ ↔ mặt khối lớn: (1.32 − 0.88) / 2 = **0.22**.
- Khối lớn đứng khít trên mặt đế nhỏ (đáy 0.14 = mặt đế 0.14; dung sai ghép 0.001), không lơ lửng, không lún.
- Tổng cao model: **1.46**; bbox X/Z = ±1.00.
- Tỉ lệ khối/đế = 1.32 / 2.00 = **0.66**.
- Khối nhỏ / khối lớn = 0.88 / 1.32 = **0.667** (2/3).

---

## 5. Chi tiết lặp

| id | Số lượng | Kích thước | Vị trí |
|---|---|---|---|
| `panel-grid` | 54 = 6 mặt × 9 | tấm 0.424 × 0.020 × 0.424; khe 0.012 | tâm ô ±0.436; mặt ngoài tấm tại ±0.660 |
| `seam-grid` | 24 = 4/mặt | nan vuông 0.006, dài 1.308 | trên mặt, nhô 0.010; offset ±0.218 |
| `cube-edges` | 12 | nan vuông 0.010, dài 1.32 | 12 cạnh khối lớn, tâm ±0.66 |
| `inner-edges` | 12 | nan vuông 0.007, dài **0.88** | 12 cạnh khối nhỏ, tâm ±0.44 |
| `rim-outer` | 1 path kín | tube r 0.009; path 2.00² bo góc 0.06 | y = 0.16 |
| `rim-hole` | 1 path kín | tube r 0.007; path 1.64² bo góc 0.04 | y = 0.16 |
| `rim-inner` | 1 path kín | tube r 0.007; path 1.48² bo góc 0.04 | y = 0.14 |
| `corner-markers` | 8 = 4 đế + 4 khối | khối 0.03³ | đế: (±0.94, 0.174, ±0.94); khối: local (±0.66, 1.334, ±0.66) |
| `light-sheet-curtain` | 4 | tấm 2.00 × 0.44 × 0.004 | x/z = ±1.026, y 0.16 → 0.60 (tâm 0.38) |
| `core-glow` | 1 light + 1 sprite | point light distance 2.2; sprite 0.30 | tâm lõi (0, 0.80, 0) |

Lưới 3×3: bước ô 0.436; seam dọc/ngang tại local ±0.218 so với tâm mặt.

Light pillars: 4 tấm 2D dày **0.004** đứng trên 4 mép đế; gradient dọc 16 × 256 (đáy đặc → đỉnh
trong) + 6 vệt tia dọc, additive. Chiều cao 0.44 = 1/3 cạnh khối lớn, bắt đầu đúng mặt trên đế
(y = 0.16), kết thúc y = 0.60. Mỗi tấm cách tâm 1.026 (mép ngoài đế 1.00 + nửa độ dày 0.002 +
khe 0.024).

---

## 6. Cách dựng hình từng bộ phận

| Bộ phận | Cách dựng |
|---|---|
| `base-outer` | `THREE.Shape` vuông bo góc r 0.06 (curveSegments 12) + `holes.push()` vuông bo góc 1.64 (r 0.04); `ExtrudeGeometry` depth 0.12 + bevel 0.02/4 segments (tổng cao 0.16); xoay −90° quanh X; tâm hình học local y = 0.08. Có lỗ xuyên thật. |
| `base-inner` | `RoundedBoxGeometry(1.48, 0.14, 1.48, 4, 0.04)`; tâm local y = 0.07 → mặt trên 0.14, đáy ngồi trên sàn y = 0. Dùng material tối `glass-base-inner`. |
| `panel-grid` | 1 `InstancedMesh`; geometry `RoundedBoxGeometry(0.424, 0.020, 0.424, 2, 0.004)`; 6 mặt × 9 ma trận; mặt đứng xoay 90°; `instanceColor` lệch ±6%. |
| `seam-grid` + `cube-edges` | Box rods `BoxGeometry`, mỗi nhóm gộp bằng `mergeGeometries` thành **1 mesh riêng** (2 draw call); material `neon-edge` dùng chung, cường độ theo vertex color. |
| `cube-inner` | `BoxGeometry(0.88)` + 12 box rods 0.007 × 0.88 gộp thành 1 mesh; **không** chia 3×3. |
| `corner-markers-base` | 4 `BoxGeometry(0.03)` tại (±0.94, 0.174, ±0.94), gộp 1 mesh; tâm y = 0.16 + 0.015 − 0.001. |
| `corner-markers-cube` | 4 `BoxGeometry(0.03)` tại local (±0.66, 1.334, ±0.66) trong `cube-outer`, gộp 1 mesh; tâm y = 1.32 + 0.015 − 0.001. |
| `light-sheets` | 4 `BoxGeometry(2, 0.44, 0.004)`, gộp 1 mesh; `FrontSide` để hai mặt trùng không cộng sáng gấp đôi. |
| `rim-*` | Path bo góc lấy từ `Shape.getPoints(24)` → `CatmullRomCurve3(closed, 'centripetal')` → `TubeGeometry(96 tubular, 6 radial)`; rim-outer + rim-hole gộp 1 mesh, rim-inner là mesh riêng gắn vào `base-inner`. |
| `core-glow` | `PointLight` + `Sprite` dùng CanvasTexture radial-gradient 256²; **không** có sprite ở góc bệ (xem §16). |
| Sàn preview | Plane 30 × 30, CanvasTexture 1024²: lưới 1.0, alpha giảm theo bán kính; **không thuộc model**. |

---

## 7. Vật liệu

| id | Dùng cho | Loại | Màu / phát sáng | Trong & blend |
|---|---|---|---|---|
| `glass-panel` | 54 tấm khối lớn | MeshPhysicalMaterial | color `#6e1eff`, emissive `#6e1eff` × 0.90 | opacity 0.15, additive, `depthWrite:false`, DoubleSide, roughness 0.50, clearcoat 1.0/0.50, `toneMapped:false` |
| `glass-base` | **đế lớn** | MeshPhysicalMaterial | color `#5614c8`, emissive `#5614c8` × 0.85 | opacity 0.88, normal blend, `depthWrite:true`, roughness 0.18, metalness 0.10, clearcoat 1.0/0.50 |
| `glass-base-inner` | **đế nhỏ** | MeshPhysicalMaterial | color `#170528`, emissive `#0a0212` × 0.60 | opacity 0.94, normal blend, `depthWrite:true`, roughness 0.24, metalness 0.15, clearcoat 1.0/0.45 |
| `neon-edge` | seam, edge, rim, corner markers | MeshBasicMaterial trắng + vertex color | linear RGB (1.35, 1.15, 1.85), nhân hệ số theo local override (outer rim 1.0, hole 1.24, inner 1.05, seam 0.67, outer edge 1.38, inner edge 1.52, góc 1.62) | additive, `depthWrite:false`, `toneMapped:false`, opacity 1.0 |
| `core-glass` | khối nhỏ 0.88 | MeshPhysicalMaterial | color `#8b3dff`, emissive `#a83cff` × 1.15 | opacity 0.90, normal blend, roughness 0.12, metalness 0, clearcoat 1.0/0.50 |
| `glow-sprite` | lõi | SpriteMaterial | gradient trắng-tím → hồng → trong suốt | additive, `depthWrite:false`, `toneMapped:false`, opacity 0.40 |
| `light-sheet` | 4 tấm sáng | MeshBasicMaterial + CanvasTexture | color linear (0.75, 0.38, 1.35) | opacity 0.80, additive, `depthWrite:false`, `FrontSide`, `toneMapped:false` |

Quy tắc:

- **Không** dùng `transmission` (đắt, không cần cho look neon).
- Không material nào có `opacity > 1`; bloom lấy từ màu HDR của vertex color trên `neon-edge` và từ
  `light-sheet`.
- Pane phải **emissive-dominant**: additive 54 tấm cộng dồn + diffuse sáng sẽ kéo màu về trắng sữa; emissive `#6e1eff` × 0.90 và opacity 0.15 giữ violet bão hoà khi đèn rất yếu.
- Đế nhỏ **tối hơn hẳn** đế lớn (`#170528` / emissive `#0a0212`), gần đen tím, để khe 0.08 và bậc 0.02 đọc rõ; đây là thay đổi v2.
- `clearcoatRoughness` **≥ 0.40** cho mọi vật liệu physical: giá trị thấp (≤ 0.08) tạo điểm specular gương từ point light, thành hai đốm hồng không tắt được bằng cường độ đèn.
- Tất cả material khai báo `textureless` kèm bằng chứng (render neon phẳng, không grain/print/pore ở 1437×1094); `light-sheet` và `glow-sprite` là `qualityTier: utility` vì texture gradient sinh bằng code, không lấy từ ảnh.
- Local override: `front-corner-hotspot`, `hole-wall-darkening`, lớp nhân cường độ neon theo từng nan/viền; góc trước bệ sáng bằng vertex color trên viền, không dùng sprite.
- Palette chỉ hue 260–300° + trắng; không cyan/lục. Đo trên render: 97.5% pixel màu nằm trong 260–300°, median 273.8° (reference: 275.0°).

---

## 8. Pivot, socket, attachment, collider

| Bộ phận | Pivot | Socket (local) | Collider |
|---|---|---|---|
| `base-outer` | floor-center (0,0,0) | `top-center` (0,0.16,0); `hole-seat` (0,0,0) | box 2.00 × 0.16 × 2.00, offset (0,0.08,0) |
| `base-inner` | floor-center (0,0,0) | `top-center` (0,0.14,0) | box 1.48 × 0.14 × 1.48, offset (0,0.07,0) |
| `cube-outer` | bottom-center (0,0,0) tại world y=0.14 | `bottom-center` (0,0,0); `center` (0,0.66,0) | box 1.32³, offset (0,0.66,0) |
| `cube-inner` | center (0,0,0) tại world y=0.80 | `center` (0,0,0); `bottom-center` (0,−0.44,0) | box 0.88³ |

Attachment contract:

| Child → Parent | Socket | Contact | Embed / gap |
|---|---|---|---|
| `base-inner → base-outer` | `hole-seat` | `seated-in-opening` | embedDepth 0 (đáy ngồi trên sàn y=0, không chìm); gapTolerance 0.002; khe hở thiết kế 0.08 |
| `cube-outer → base-inner` | `top-center` | `rest` | đáy 0.14 trùng mặt đế 0.14; embedDepth 0.001 là dung sai ghép; gapTolerance 0.001 |
| `cube-inner → cube-outer` | `center` | `suspended` | embedDepth 0; gapTolerance **0.22** (lơ lửng, không chạm) |
| `corner-markers-base → base-outer` | `top-center` | `surface-inlay` | embedDepth 0.001 (straddle mặt đế) |
| `corner-markers-cube → cube-outer` | `center` | `surface-inlay` | embedDepth 0.001 (straddle mặt khối) |
| `light-sheets → base-outer` | `top-center` | `rest` | đáy tấm đúng y=0.16; gapTolerance 0.001 |

Mọi object chính có `userData.partId`; pivot là `Group` riêng để có thể xoay/nâng từng phần (exploded
view) mà không phá hierarchy — preview hiện nâng `base-inner`, `cube-outer`, `cube-inner` theo +Y để
tách 4 bộ phận, không đổi cấu trúc cha–con.

---

## 9. Chi tiết bắt buộc phải giống ảnh

1. Khối lớn có **3×3 ô trên cả 3 mặt nhìn thấy** (và đối xứng 6 mặt); 24 rãnh + 12 cạnh sáng liên tục.
2. Khối nhỏ **2/3 cạnh** (0.667), cùng tâm, nhìn xuyên qua kính, **viền sáng hơn** khối lớn, không chia ô.
3. Đế lớn có **lỗ vuông thật** (không phải hình dán); đế nhỏ nằm trong lỗ, khe 0.08, thấp hơn 0.02, **màu tím đậm gần đen**.
4. Khối lớn đứng trên đế nhỏ (đáy 0.14 = mặt đế), không lơ lửng, không lún quá.
5. Viền neon ở mép ngoài đế, mép lỗ, mép đế nhỏ; cạnh bệ vát.
6. **4 điểm góc mặt trên đế lớn + 4 điểm góc mặt trên khối lớn** phát sáng rõ.
7. **4 tấm sáng dọc** ở 4 mép đế: rộng bằng đế 2.00, cao 0.44 (1/3 khối lớn), dày 0.004, từ y=0.16 đến y=0.60, có tia sắc + quầng khuếch tán mềm.
8. Điểm bloom mạnh nhất ở góc trước bệ + đáy khối; nền vẫn tối, không trắng toàn khung.
9. Bảng màu chỉ tím/hồng/trắng-tím trên nền đen; không cyan/lục **trong model neon**.
10. Không chữ, logo, texture ảnh; sàn chỉ là lưới mờ (preview harness).
11. Mặt sau/đáy đối xứng với mặt trước (giả định từ 1 ảnh).

---

## 10. Camera, ánh sáng, hậu kỳ (preview harness)

- Camera: `PerspectiveCamera(fov 8, near 0.1, far 100)`, aspect theo canvas 1280/900,
  target (0, 0.60, 0), **azimuth 45°, elevation 24°, distance 20** → position ≈
  (12.92, 8.73, 12.92). Lens dài giữ phối cảnh gần orthographic đúng như ảnh; khối chiếm ~70% bề
  ngang và ~80% chiều cao khung (đo trên render: đế 884 px, bbox cao 720 px).
- Góc review: 45° (hero), 135°, 225°, 315° cùng elevation 24°; thêm 1 góc elevation 60° để kiểm lỗ
  đế (dùng distance × 1.15 = 23 để không cắt đáy khung); thêm close-up đế (`zoom=base`: distance
  12.6, elevation 42°, target y 0.16).
- Tương tác (chỉ trong preview, không thuộc model): `OrbitControls` — kéo trái xoay, lăn chuột zoom,
  kéo phải pan. Nút **Tách khối / Ghép lại** (phím `E`) nâng 4 phần theo +Y — đế nhỏ 0.42, khối lớn
  0.62, khối nhỏ 0.92 — rồi tự căn camera theo bounding sphere (target dời lên tâm cụm, distance
  tăng để không cắt khung). Nút **Góc 45°** (phím `R`) trả orientation/distance ban đầu nhưng giữ
  trạng thái tách. Capture dùng `?ui=0` và trạng thái ghép nên số liệu bên dưới không đổi.
- **Clay mode (chỉ preview)**: nút `Clay`/`Neon` (hoặc `?clay=1`) đổi toàn bộ mesh sang
  `MeshStandardMaterial` nhám `#c9c5be` (roughness 0.82, DoubleSide), ẩn sprite/sheets/glow/sàn,
  tắt bloom, nền `#232327`, thêm ambient + directional trung tính. Giữ nguyên orbit, explode,
  reset. Đây là chế độ kiểm hình học, không phải product mode và không can thiệp chuỗi material neon.
- Lights (đã hạ sau thử nghiệm vì pane/base lấy màu từ emissive, không từ diffuse):
  - ambient `#341470` intensity 0.35;
  - key point `#b07bff` (−2.6, 3.4, 2.8) intensity 1.5 / distance 12;
  - rim point `#ff4fd8` (−2.6, 1.4, −2.4) intensity 0.15 / distance 10;
  - core point `#ff5ce0` (0, 0.80, 0) intensity 1.5 / distance 2.2;
  - under-base point `#b23cff` (0, 0.12, 0.85) intensity 1.8 / distance 3.
- Hậu kỳ: `UnrealBloomPass(strength 0.05, radius 0.25, threshold 1.00)`;
  ACESFilmic, exposure 1.05; background `#04010a`; `FogExp2('#060212', 0.012)` (giữ thấp vì camera
  tele đứng cách 20 đơn vị).
  Ghi chú: `EffectComposer` render vào target HalfFloat **không tone map**, `OutputPass` áp ACES một
  lần; vì vậy bloom hiệu dụng mạnh hơn nhiều so với `strength` danh nghĩa — 0.05 nominal đã tương
  đương mức bloom rộng của ảnh gốc.
- Reduced-motion: khi `prefers-reduced-motion: reduce`, tách khối chuyển tức thì (bỏ animation 360 ms).
  Ở trạng thái nghỉ không có animation; mọi frame giống nhau (đã kiểm 2 frame cách 400 ms: hash trùng).

---

## 11. Theme 4 object & tích hợp Dataset 3D

Model nhận `theme` (`violet` mặc định, `cyan`, `orange`, `blue`) qua `createNeonCubeModel({ theme })`.
Theme chỉ đổi màu pane/base/core/glow/neon/light-sheet; hình học và số liệu giữ nguyên.

| theme | pane | core | light-sheet (HDR) |
|---|---|---|---|
| `violet` | `#6e1eff` | `#8b3dff` / `#a83cff` | (0.75, 0.38, 1.35) |
| `cyan` | `#0aa6d8` | `#22d3ee` / `#7ff3ff` | (0.18, 0.95, 1.30) |
| `orange` | `#d96a12` | `#ff9a3c` / `#ffc46b` | (1.30, 0.50, 0.12) |
| `blue` | `#2f6bff` | `#2f6bff` / `#5b8cff` | (0.18, 0.50, 1.30) |

`createNeonCubeCluster()` (file `neon-cube.cluster.ts`) dựng 4 cube quanh orb trung tâm của
`workspaces/3d-dataset`, bố cục tham khảo `DataVerse_Project_Workspace_Overview_v1.png` (chỉ bố cục,
không sao hình dạng/UI):

| theme | vị trí | scale |
|---|---|---|
| violet | (−6, 2.7, 2) | 0.75 |
| cyan | (2, 2.9, −6) | 0.75 |
| blue | (−1.2, 1, 6.8) | 0.72 |
| orange | (6.8, 1.15, −1.2) | 0.72 |

(v3: cube lớn 1.5× và cách trục core gấp đôi so với bản đầu — bán kính ngang 6.32/6.90.)

Camera mặc định của trang Dataset 3D (`holographic-core.scene.tsx`): target (0, 2.1, 0.5),
position **(11.45, 9, 11.45)** → distance **17.3**, elevation **23.5°**, azimuth **46.3°**;
`fov` **34** (nới từ 24 để đủ 4 cube + core), `OrbitControls.maxDistance = 25`,
`minDistance = 4.4`; fog density 0.011.

Mỗi cube xoay yaw `atan2(-x, -z)` về phía orb; pane opacity/emissive × 0.55 và core emissive × 0.6 để
4 additive cube không bão hoà trắng. Cluster trả `{ group, cubes, dispose }`; `HolographicScene` gắn
bằng một `<primitive>` và dispose khi unmount. Model vẫn độc lập, tái sử dụng được ngoài dataset.

### 11.1 Tương phản 3 tầng `base – tower – core`

Tách tầng bằng **giá trị sáng + hue**, không đổi hình học (material/light only):

| Tầng | Vai trò thị giác | Vật liệu chính | Đo trên ảnh (L / hue) |
|---|---|---|---|
| `base` | khối tím, tối nhất | shell `#2a0f52` / emissive `#6d3bff`; 8 sector tím; rim/grid/ring tím | 63.9 / **259.6** |
| `tower` | khối thép xanh, trung gian | glass `#0a2848` emissive ×0.42; frame `#2a6fdb` ×0.55; accent `#6fa8ff` | 77.9–93.0 / **214–218** |
| `core` | orb cyan, sáng nhất | emissive HDR `#2ae6ff` ×1.35 / `#1fd0ff` ×1.0 | 172.5–199.5 / **186.5–192.5** |

- Core là tầng duy nhất vượt ngưỡng bloom 1.0; ambient hạ còn `#266bc9` 0.28; sàn quanh bệ dùng
  glow + 2 vòng tím để không kéo hue base về cyan.
- Tower **không dùng cyan**: post/window/roof/data mark/riser đều steel-blue (~215°); chỉ core giữ
  cyan-trắng. Rim point `#3f7dff` @12/d10 tại (−5, 4.5, −5) tách silhouette tower khỏi nền navy.
- Thứ tự nghiệm thu **L_base < L_tower < L_core** (bậc ≥ 15%) và hue base ~265°, tower ~210°,
  core ~190°. Chi tiết thay đổi + số đo: `validation-log.md` §7.2.

---

## 12. Giới hạn hiệu năng

| Hạng mục | Ngân sách |
|---|---|
| Triangles | ≤ 25,000 (thực tế **23,442**) |
| Draw calls | ≤ 14 (thực tế **13** trong model: 2 đế, 1 panels instanced, 1 seam gộp, 1 outer edge gộp, 1 inner cube, 1 inner rods gộp, 2 mesh viền, 1 corner markers, 1 light sheets, 1 sprite + 1 core glow; sàn preview nằm ngoài model) |
| Texture | 1 × 1024² (sàn preview) + 1 × 256² (glow) + 1 × 16×256 (light sheet); không texture PBR |
| FPS | 60 fps @ 1280×900, dpr ≤ 1.5 |
| Kỹ thuật đắt | Không shadow map, không transmission, không per-frame allocation |

Cluster 4 cube trong dataset dùng material riêng của từng theme; mỗi cube vẫn 13 draw call và
tổng tam giác 4 × 23,442 ≈ 93,8k.

---

## 13. Tiêu chí nghiệm thu (đo trên ảnh render)

1. Tỉ lệ cạnh khối lớn / cạnh đế lớn = **0.66 ± 0.04** (hình học); đo trên render hero 0.697 do bloom nở viền; khối lớn cao = cạnh (không kéo dọc).
2. Đế dày / cạnh đế = **0.08 ± 0.01**; đế nhỏ thấp hơn đế lớn **0.02 ± 0.005** (nhìn thấy bậc) và **tối hơn rõ rệt**.
3. Đếm được **9 ô/mặt** trên cả 3 mặt nhìn thấy; 24 rãnh + 12 cạnh sáng liên tục.
4. Khối nhỏ hiện rõ qua kính, cạnh = **0.667 ± 0.03** cạnh khối lớn, tâm trùng.
5. Khe **0.08** giữa đế nhỏ và thành lỗ nhìn thấy ở cả 4 phía; không có mặt nào bị hàn liền.
6. Thấy **8 điểm góc phát sáng** (4 trên mặt đế, 4 trên mặt khối) và **4 tấm sáng dọc** cao đúng
   1/3 khối, dày 0.004, không che khuất pane.
7. Palette: chỉ hue **260–300°** + trắng; không có pixel cyan/lục đáng kể. Đo: 97.5% pixel màu trong khoảng, cyan/lục 0.
8. Bloom: góc trước bệ là vùng sáng nhất; nền (góc khung) vẫn tối > 90% khung.
9. Từ 4 góc, silhouette giữ nguyên quan hệ 4 phần; không clipping ở viền khung.
10. Static: 2 frame cách 400 ms giống nhau (trừ nhiễu AA).
11. `tsc`, eslint, test model/spec đều pass; không lỗi console khi capture.
12. Clay mode: toàn bộ mesh nhám/trung tính, không neon/bloom, orbit + explode vẫn hoạt động.
13. Dataset: đủ 4 cube tím/cyan/cam/xanh quanh orb, không chồng lên bệ trung tâm, không lỗi console.

---

## 14. Kiểm tra đặc tả trước khi sinh code

1. Validator của skill:
   ```bash
   python3 /Users/mac/.qoder/skills/img2threejs/forge/stage2_spec/validate_sculpt_spec.py \
     src/graphics/neon-cube/object-sculpt-spec.json
   python3 /Users/mac/.qoder/skills/img2threejs/forge/stage2_spec/validate_sculpt_spec.py \
     src/graphics/neon-cube/object-sculpt-spec.json --strict-quality
   ```
   Fail → sửa spec theo schema; **không bypass**, không đóng gate.
2. `node .agents/neon-cube/check-spec.mjs` — kiểm tra ngữ nghĩa:
   - đúng 4 bộ phận chính + hierarchy `base-outer → base-inner → cube-outer → cube-inner`;
   - 1.32 < 1.48 < 1.64 < 2.00; lõi 0.88 = 2/3 khối lớn, khe 0.22;
   - `cube.bottom == baseInner.top == 0.14`; tổng cao `1.46`;
   - khối nhỏ nằm trọn trong khối lớn và đồng tâm;
   - 54 panels / 24 seams / 12 edges / 12 inner edges / 8 corner markers / 4 light sheets;
   - camera, budget tam giác/draw call, palette hue tím;
   - material bắt buộc (neon additive, glass không depthWrite, base có depthWrite, inner base tối hơn base, light-sheet additive);
   - detailInventory map đúng, attachment đủ trường.
3. Chỉ khi cả 3 bước pass mới sinh code model.

---

## 15. Pipeline & file map

```
A Ảnh tham chiếu → B Quan sát → C Cây bộ phận
→ D description-plan.md + object-sculpt-spec.json
→ E validate_sculpt_spec.py + --strict-quality + check-spec.mjs
→ F neon-cube.model.ts + preview.html
→ G capture 5 góc + base closeup + clay + clay exploded
→ H so với reference → I lặp (sửa spec trước, rồi code)
→ J validation-log.md + bàn giao
```

| File | Vai trò |
|---|---|
| `.agents/neon-cube/description-plan.md` | bản đặc tả này |
| `.agents/neon-cube/validation-log.md` | log xác nhận của human + kết quả kiểm tra |
| `.agents/neon-cube/check-spec.mjs` | kiểm tra ngữ nghĩa ngoài schema |
| `.agents/neon-cube/captures/capture-neon-cube.cjs` | Playwright capture nhiều góc + clay |
| `src/graphics/neon-cube/object-sculpt-spec.json` | đặc tả máy đọc |
| `src/graphics/neon-cube/neon-cube.model.ts` | factory Three.js + theme |
| `src/graphics/neon-cube/neon-cube.cluster.ts` | cluster 4 theme cho Dataset 3D |
| `src/graphics/neon-cube/preview.html` + `neon-cube.preview.ts` | preview harness độc lập + clay mode |
| `src/__tests__/neon-cube/*.test.ts` | test hierarchy/số liệu/budget/theme |

---

## 16. Rủi ro / giả định

- 1 ảnh duy nhất: mặt sau, đáy, độ dày kính và lòng khối là giả định đối xứng.
- Số liệu macro chốt theo **plan đã duyệt (phương án B)**: đế dày 0.16, lỗ 1.64, đế nhỏ 1.48, khối lớn 1.32, tổng cao 1.46. Bản đo A chỉ giữ làm tham chiếu lịch sử.
- **v2 thay đổi theo yêu cầu**: lõi 0.44 → **0.88** (2/3 khối lớn); đế nhỏ chuyển sang
  `glass-base-inner` tím gần đen; thêm 8 góc phát sáng và 4 tấm sáng dọc. Các thay đổi này **không**
  còn khớp tuyệt đối ảnh gốc — chúng là thiết kế bổ sung có chủ đích, đã đo lại tỉ lệ trong spec.
- Hai chỉnh kỹ thuật đã ghi nhận so với bảng plan: (1) point light lõi đặt tại (0, 0.80, 0) — đúng tâm lõi — thay vì 0.62; (2) mặt ngoài panel dùng bán kính 0.660 (nửa cạnh khối) thay vì 0.670, để pane không nhô ra ngoài khung cạnh.
- Ảnh có bất nhất hình học nhẹ giữa chiều cao khối và cao độ bệ khi chiếu phối cảnh; spec ưu tiên **quan hệ cấu trúc** (4 phần, lưới 3×3, lỗ đế, khối lõi, palette) hơn khớp pixel tuyệt đối.
- Additive 54 tấm bão hoà trắng ở tâm nếu pane dựa vào diffuse: đã xử lý bằng pane emissive-dominant (`opacity` 0.15, emissive × 0.90) + đèn yếu, không đổi hình học.
- Vòng chỉnh cuối đã: làm nan mảnh hơn (seam 0.006, outer 0.010, inner 0.007; viền r 0.009/0.007), hạ HDR neon còn (1.35, 1.15, 1.85), nâng under-base lên 1.8 và pane opacity 0.15 để mặt kính gánh ánh sáng thay vì khung dây; dời tông tím ấm hơn (pane `#6e1eff`, đế `#5614c8`, ambient `#341470`) để khớp median hue 275° của ảnh.
- **Bỏ sprite quầng ở góc bệ**: sprite billboard cố định ở góc world (1, 0.16, 1) lơ lửng cạnh đế ở góc 135°/315°. Điểm sáng góc trước nay lấy từ vertex-color boost trên `rim-outer`; model đối xứng theo mọi azimuth.
- `TubeGeometry` cho viền bo góc: path lấy `getPoints(24)` (đủ mịn ở cỡ render), nếu nứt ở góc thì tăng số điểm, không đổi bán kính.
- Góc top (elevation 60°) cắt đáy khung ở distance 20; preview dùng distance × 1.15 cho riêng view `top`.
- Bloom/ACES khác nhau giữa GPU thật và SwiftShader capture; chấp nhận lệch nhẹ, ưu tiên silhouette và tỉ lệ hơn màu tuyệt đối.
- Light sheet additive rất dễ bão hoà: đã hạ HDR về (0.75, 0.38, 1.35), opacity 0.8, `FrontSide` để
  hai mặt không cộng đôi; nếu vẫn cháy trắng, giảm tiếp `lightSheet` trước khi đổi hình học.
- Corner markers là khối 0.03 đặt lệch 0.001 so với mặt để cạnh phát sáng đọc từ mọi góc; nếu nhìn
  như hạt rời ở góc xa, tăng nhẹ kích thước thay vì thêm sprite (giữ đối xứng).
- Dataset 3D: 4 cube là **vật thể trang trí quanh orb**, không có hành vi dữ liệu; màu cyan/cam/xanh ở
  đây là theme của object, không mâu thuẫn quy tắc palette tím của model neon gốc.
- **Không đóng gate nào** của img2threejs; chỉ chạy validator và ghi log.

---

## 17. Lệnh kiểm chứng

```bash
python3 /Users/mac/.qoder/skills/img2threejs/forge/stage2_spec/validate_sculpt_spec.py \
  src/graphics/neon-cube/object-sculpt-spec.json
python3 /Users/mac/.qoder/skills/img2threejs/forge/stage2_spec/validate_sculpt_spec.py \
  src/graphics/neon-cube/object-sculpt-spec.json --strict-quality
node .agents/neon-cube/check-spec.mjs
npx tsc -b
npx eslint src/graphics/neon-cube src/__tests__/neon-cube .agents/neon-cube/*.mjs
npx vitest run src/__tests__/neon-cube
npm run dev -- --port 5173
NODE_PATH=/Users/mac/.npm/_npx/e41f203b7505f1fb/node_modules \
  node .agents/neon-cube/captures/capture-neon-cube.cjs
```
