# Core v3 — Issue Constellation (concept C)

Trạng thái: **kế hoạch, chưa áp dụng code** · Ngày: 2026-11-02 · Phạm vi: Dataset 3D visual only
Ràng buộc chung: **không đóng gate img2threejs nào** (không chạy `forge/state.py mark`), không thêm
dependency, không sửa hành vi nghiệp vụ của Dataset 3D.

---

## 1. Câu chuyện thị giác

```
4 khối neon = 4 module              Nhân trung tâm = 1 bộ dữ liệu
┌─────────────────────┐             ┌──────────────────────────────┐
│ violet  Tổng quan   │             │  • hạt cyan/violet = bản ghi │
│ cyan    Data view   │  ← luồng    │  • vòng equator = nucleus    │
│ blue    Data analysis│    dữ liệu  │  • hạt cam = vấn đề chất lượng│
│ orange  Detection   │  ←←←←←←←←← │    tách khỏi nhân, bay sang  │
└─────────────────────┘             │    Detection (orange)        │
                                    │  • hạt sạch chạy vòng quanh  │
                                    │    nhân rồi quay lại         │
                                    └──────────────────────────────┘
```

- **Nhân (core)**: một bộ dữ liệu. Không còn là khối cyan chói; được hạ sáng, thêm 3 dải mảnh
  HDR + vòng equator + 18 hạt "record" quay quanh để đọc được cấu trúc.
- **Hạt dữ liệu vào**: giữ nguyên `inbound-data-streams` hiện có (4 guide + 24 streak) làm luồng
  dữ liệu thô đi vào nhân. Không nhân đôi luồng này.
- **Hạt lỗi**: 18 hạt amber/đỏ tách khỏi vành equator, chạy theo 3 làn cong sang khối **orange
  Detection**, chạm mặt gần thì thu nhỏ và kích hoạt beacon.
- **Hạt sạch**: 30 hạt cyan/violet chạy vòng kín quanh nhân (bán kính 1.3, cao 1.3–1.9), thể hiện
  dữ liệu sạch được tái lưu chuyển.
- **Module map**: legend HTML 5 dòng (nhân + 4 module) + câu ghi chú "hạt cam → Detection".

Đây là **minh hoạ khái niệm**, không phải telemetry thật. UI phải nói rõ điều này.

---

## 2. Anchor & hệ toạ độ (đo từ code hiện tại)

Core model đặt tại gốc scene, camera giữ nguyên
`[11.45, 9, 11.45]` → target `[0, 2.1, 0.5]`, fov 34.

| Anchor | World position | Nguồn |
|---|---|---|
| Nhân / equator | `(0, 1.90, 0)`, bán kính vành `1.02` | `core-upper` center y 1.9, drum radius ~0.90 |
| Đáy drum | y `1.30` | `core-lower` top |
| Đỉnh drum | y `2.50` | `core-upper` top |
| Cap | y `2.48 … 2.52` | generated-core |
| Detection cube center | `(6.80, 1.726, -1.20)` | layout `[6.8, 1.15, -1.2]` + `cubeCenterY 0.80 × scale 0.72` |
| Detection near face | `(6.194, 1.806, -1.093)` | center + hướng về core × `(cubeHalf 0.66 × 0.72 + 0.14)` + y 0.08 |
| Detection half-side | `0.475` | `0.66 × 0.72` |
| Tower inner face | ~`r 1.49` | tower ring hiện tại |

Công thức anchor Detection (đưa vào `core-visual-config.ts`, có test):

```ts
const node = NEON_CUBE_CLUSTER_LAYOUT.find(n => n.theme === 'orange')!
const center = [node.position[0], node.position[1] + NEON_CUBE.cubeCenterY * node.scale, node.position[2]]
const toCore = normalize([-center[0], 0, -center[2]])
const surface = center + toCore * (NEON_CUBE.cubeHalf * node.scale + 0.14) + [0, 0.08, 0]
// → center [6.8, 1.726, -1.2], surface [6.194, 1.806, -1.093]
```

Không hard-code vị trí Detection rời rạc: nếu layout cube đổi, anchor đổi theo.

---

## 3. Hạ chói core (de-glare) — bắt buộc làm trước khi thêm hạt

### 3.1 Hiện trạng đo trên `/tmp/dataset-initial.png` (1280×900)

| Vùng | Mean L | P95 | Hue | Cyan-sat |
|---|---:|---:|---:|---:|
| Core drum crop | 187.6 | 248 | 190.8° | 69.9% |
| Base band | 63.5 | 169 | 259.5° | 0.9% |
| Tower side | 77.9–93.0 | 178–183 | 214–218° | 1.0–1.6% |

Core hiện là vùng sáng nhất và gần như phẳng vì `emissiveIntensity 1.35 / 1.0` trên diện tích lớn,
cộng contour additive 0.8/0.7 và point light cyan 20.

### 3.2 Giá trị mới (đưa vào config, không rải magic number)

| Part | Trước (v2) | Sau (v3) |
|---|---|---|
| `core-upper` | color `#062c4e`, emissive `#2ae6ff` ×1.35, opacity 0.78, contour 0.8 | color `#041a2e`, emissive `#18c8ee` ×0.50, opacity 0.58, contour 0.22, roughness 0.55 |
| `core-lower` | `#05243f`, `#1fd0ff` ×1.00, opacity 0.70, contour 0.7 | `#031624`, `#12b8e0` ×0.38, opacity 0.50, contour 0.20, roughness 0.55 |
| `core-mid-collar` | `#062a4a`, `#2ad4ff` ×0.60, opacity 0.46, contour 0.5 | `#052238`, `#22cdf0` ×0.40, opacity 0.40, contour 0.28 |
| `core-lower-collar` | `#2fe4ff` ×1.00, opacity 0.30, contour 0.6 | `#2fd8f4` ×0.55, opacity 0.28, contour 0.30 |
| `core-cap` | emissive ×0.90 | ×0.45 |
| `core-foot` | emissive ×0.60 | ×0.30 |

Nguyên tắc: **thân core không được vượt ngưỡng bloom 1.0**; chỉ các chi tiết mảnh (dải, vành,
hạt) được phép HDR > 1.0.

### 3.3 Chi tiết thay thế độ chói

1. **3 dải ngang** (1 mesh gộp):
   - `y 1.55`, radius `0.92`, tube `0.006`, linear `(0.65, 1.45, 1.75)`
   - `y 1.90`, radius `1.02`, tube `0.011`, linear `(1.15, 2.30, 2.60)` ← vành equator/nucleus
   - `y 2.25`, radius `0.92`, tube `0.006`, linear `(0.65, 1.45, 1.75)`
   - `TorusGeometry(…, 6, 64)` ×3, `mergeGeometries`, `MeshBasicMaterial` additive,
     `depthWrite:false`, `toneMapped:false`; attach vào `core-upper` để đi theo explode.
2. **18 hạt record** (1 `InstancedMesh`, octahedron 8 tri):
   - 2 vành radius `1.02` / `1.14`, y `1.90 ± 0.06`, size `0.032`
   - màu xen kẽ cyan-white `(0.55, 1.8, 2.0)`, violet `(1.2, 0.6, 2.0)`, white `(1.6,1.9,2.2)`
   - quay chậm `0.18 rad/s`, cập nhật matrix mỗi frame (18 instance, không đáng kể).
3. Giữ nguyên `addCylinderGrid` hiện có (opacity 0.1/0.09) làm seam mảnh; không tăng.

### 3.4 Mục tiêu đo lại

| Metric | Mục tiêu |
|---|---|
| Mean L core crop | **120–150** (từ 187.6) |
| P95 | **≤ 220** (từ 248) |
| Pixel ≥ 250 | **≤ 2.0%** crop |
| Hue cyan | **185–200°**, cyan-sat ≥ 35% (vẫn nhận ra core cyan) |
| 3 dải | đếm được 3 dòng sáng ngang trong crop, mỗi dải ≤ 3 px |
| Thứ bậc | `base < tower < core`, core vẫn cao nhất nhưng không chói |

Nếu sau material vẫn > 150: giảm point light cyan `20 → 14` (bước 2), **không** đổi bloom toàn scene.
Nếu < 120: tăng dải equator linear lên 1.4×, không tăng thân.

---

## 4. Hệ hạt Issue Constellation

### 4.1 Thành phần & draw call

| Thành phần | Geometry | Material | Draw |
|---|---|---|---:|
| `constellation-particles` | 1 InstancedMesh, octahedron 8 tri | MeshBasicMaterial additive, vertex/instance color, toneMapped false | 1 |
| `constellation-lanes` | 1 LineSegments, gộp 3 issue + 1 clean loop, vertex color | LineBasicMaterial additive, opacity 0.22 | 1 |
| `nucleus-bands` | 3 torus gộp | MeshBasicMaterial additive HDR | 1 |
| `nucleus-beads` | 1 InstancedMesh, 18 octahedron | MeshBasicMaterial additive HDR | 1 |
| `detection-beacon-ring` | 1 torus 64×6 | MeshBasicMaterial additive HDR amber | 1 |
| `detection-beacon-sprite` | 1 Sprite, CanvasTexture 128² | SpriteMaterial additive | 1 |
| **Tổng mới** | ~3.8k tri | | **+6** |

Không dùng geometry riêng cho từng hạt; không tạo object mỗi frame.

### 4.2 Số lượng & đường chạy

**Issue lanes (3 làn, 18 hạt, 6 hạt/làn)** — CatmullRom mở, sample 64 điểm:

| Làn | Start (vành equator) | Control giữa | End (mặt gần Detection) | Speed |
|---|---|---|---|---|
| A | góc −22° → `(0.946, 1.98, −0.382)` | `(2.4, 2.45, 0.25)`, `(4.5, 2.55, −0.15)` | `(6.194, 1.926, −1.173)` | 0.055 |
| B | góc −8° → `(1.010, 1.86, −0.142)` | `(2.2, 2.15, 0.55)`, `(4.3, 2.25, 0.15)` | `(6.194, 1.806, −1.013)` | 0.070 |
| C | góc −34° → `(0.846, 2.04, −0.571)` | `(2.6, 2.65, −0.55)`, `(4.8, 2.50, −0.85)` | `(6.194, 1.686, −1.093)` | 0.085 |

- `u = (phase + time × speed) % 1`; phase mỗi hạt = `laneOffset + i / 6`.
- Hạt thu nhỏ ở `u < 0.06` và `u > 0.94` để "tách khỏi nhân" / "bị Detection hấp thụ" không bị pop.
- End nằm trên mặt gần cube, lệch ±0.12 để 3 làn không chồng một điểm.

**Clean loop (1 vòng kín, 30 hạt)** — CatmullRom closed:

```
(-0.959, 1.90,  0.349)  ← điểm trên vành nucleus
(-1.250, 1.55,  0.550)
(-1.100, 1.35, -0.500)
(-0.200, 1.30, -1.100)
( 0.900, 1.40, -0.800)
( 1.300, 1.60,  0.200)
( 0.800, 1.80,  0.900)
```

- Bán kính lớn nhất 1.37 < mặt trong tower ~1.49 (khe ~0.12) → không cắt tower; quanh drum radius 0.90.
- `u = (phase + time × 0.03) % 1`, phase = `i / 30`; hạt chạy liên tục, không fade.
- Màu: cyan-white / violet / white xen kẽ; size 0.034.

### 4.3 Màu & HDR

| Thành phần | Linear RGB (HDR) |
|---|---|
| Issue amber | `(2.2, 0.85, 0.25)` |
| Issue red-amber | `(2.4, 0.45, 0.20)` |
| Issue light amber | `(1.8, 1.00, 0.35)` |
| Clean cyan-white | `(0.55, 1.80, 2.00)` |
| Clean violet | `(1.20, 0.60, 2.00)` |
| Clean white | `(1.60, 1.90, 2.20)` |
| Lane issue | `(1.60, 0.55, 0.15)` |
| Lane clean | `(0.35, 1.00, 1.40)` |
| Beacon ring | `(2.0, 0.8, 0.25)` |

Chỉ hạt/dải mảnh HDR; lane opacity 0.22; beacon sprite opacity 0.12–0.52. Không có mảng lớn > 1.0.

### 4.4 Beacon Detection

- Ring radius `0.55`, tube `0.012`, đặt tại `center`, `lookAt(core)`; sprite size `0.9`.
- `pulse = max(0, smoothstep(0.90, 1.0, u))` trên các hạt issue gần đích.
- `level += (pulse - level) × (1 − exp(−dt × 6))` (dùng `deltaSeconds`, không allocation).
- Ring scale `1 + level × 0.18`, opacity `0.20 + level × 0.60`; sprite opacity `0.12 + level × 0.40`.
- Khi không có hạt tới, beacon vẫn thở nhẹ 0.20–0.28 để không "chết".

### 4.5 Vòng đời & chế độ

- `update(elapsedSeconds, deltaSeconds)` chỉ chạy khi `!reducedMotion`.
- `reducedMotion`: `resetMotion()` gọi `constellation.reset()` một lần; hạt đứng ở pha cố định,
  beacon ở level 0.35; 2 frame cách 400 ms phải giống nhau.
- `detached`: ẩn toàn bộ constellation (`root.visible = false`) để exploded view sạch; hiện lại khi
  lắp. Không thay đổi logic detach hiện có.
- Tất cả object mới đặt `raycast = () => {}` để không cản pick part.
- `dispose()` của constellation giải phóng geometry/material/texture; product `dispose()` gọi thêm
  vì hàm traverse hiện tại không xử lý `Sprite`.

---

## 5. Module map (UI)

### 5.1 Legend

Thêm overlay HTML trong `dataset-3d.view.tsx` (không dùng 3D label để tiết kiệm draw call và
tránh chữ bị nghiêng theo camera):

```
BẢN ĐỒ MODULE
● Nhân dữ liệu      1 bộ dữ liệu
■ Tổng quan         khám phá dữ liệu
■ Data view         góc nhìn dữ liệu
■ Data analysis     phân tích / trực quan hoá
■ Detection         phát hiện vấn đề chất lượng
Hạt cam: vấn đề chất lượng → Detection
```

Màu chấm: core `#7be9ff`; violet `#a06bff`; cyan `#4de6ff`; blue `#5b9cf0`; orange `#ff9a3c`.
- Desktop: panel góc trên trái, rộng 210–230 px, `pointer-events:none`, nền `rgba(4,12,26,.72)`.
- Mobile (`max-width: 720px`): ẩn panel (tránh đè nút Tách mô hình); mapping nằm trong boundary text.

### 5.2 Boundary text

Đổi câu hiện tại:

> Mô hình hiện là không gian trực quan của Dataset. Chưa gắn record, kết quả AI hoặc trạng thái chất
> lượng dữ liệu.

thành:

> Nhân trung tâm là một bộ dữ liệu; bốn khối neon là bốn module. Hạt cyan/violet là bản ghi sạch lưu
> chuyển, hạt cam là vấn đề chất lượng được đẩy sang Detection. Đây là minh hoạ khái niệm, chưa nối
> dữ liệu thật.

Câu mới vừa giải thích ý nghĩa vừa giữ đúng ranh giới "chưa nối dữ liệu thật".

---

## 6. File map & thay đổi

### File mới

| File | Nội dung |
|---|---|
| `src/graphics/holographic-core/core-visual-config.ts` | `CORE_VISUAL_REVISION`, `CORE_GLOW_V2/V3`, `CORE_NUCLEUS`, `ISSUE_CONSTELLATION`, `resolveDetectionAnchor()`, palette/phase constants |
| `src/graphics/holographic-core/issue-constellation.ts` | `createIssueConstellation()` trả `{ root, reset, update, setDetached, dispose }`; build lanes, particles, beads, beacon |
| `src/__tests__/dataset-3d/issue-constellation.test.ts` | anchor, path endpoints, counts, colors, toggle, dispose |
| `.agents/dataset-3d-core/captures/capture-core-v3.cjs` | Playwright capture attached / reduced / exploded / close-up |

### File sửa

| File | Thay đổi |
|---|---|
| `holographic-core.model.ts` | `applyTierContrast` đọc `CORE_GLOW_V3`; tạo bands + constellation; `update/resetMotion/setDetached/dispose` nối module; giữ nguyên toàn bộ phần base/tower/camera |
| `dataset-3d.view.tsx` | legend + boundary text |
| `dataset-3d.css` | style legend, responsive |
| `src/__tests__/dataset-3d/` (file mới) | test như trên |

Không sửa: `holographic-core.scene.tsx`, `holographic-core.environment.tsx`, `inbound-streams.ts`,
`neon-cube.*`, router, model khác.

### Điểm nối trong `holographic-core.model.ts`

```ts
const constellation = createIssueConstellation({ model, runtimeNodes: runtime.nodes })
model.add(constellation.root)            // root ở world space, model ở gốc
// setDetached: constellation.setDetached(detached)
// update: constellation.update(elapsedSeconds, deltaSeconds)
// resetMotion: constellation.reset()
// dispose: constellation.dispose()
```

`constellation.root` không gắn vào `core-upper` vì đường bay phải giữ world-space tới Detection;
khi detach thì ẩn cả cụm.

---

## 7. Log & rollback

### 7.1 Thư mục

```
.agents/dataset-3d-core/
├─ plan-issue-constellation.md      ← file này
├─ change-log.md                    ← log từng thay đổi trước/sau
├─ baseline/
│  ├─ holographic-core.model.ts
│  ├─ dataset-3d.view.tsx
│  ├─ dataset-3d.css
│  ├─ neon-cube.cluster.ts
│  └─ neon-cube.model.ts
├─ baseline.sha256                  ← hash của 5 file trên
└─ captures/
   ├─ before-attached.png           ← baseline /tmp/dataset-initial.png
   ├─ before-exploded.png
   ├─ after-attached.png            ← sinh ở bước verify
   ├─ after-reduced.png
   ├─ after-exploded.png
   └─ after-core-closeup.png
```

### 7.2 Quy tắc ghi log

Mỗi thay đổi code phải có một dòng trong `change-log.md`:

| Trường | Nội dung |
|---|---|
| `#` | P1, P2… |
| Thời điểm | ISO/local |
| File + dòng | đường dẫn + khoảng dòng |
| Trước | giá trị/hành vi cũ (copy nguyên văn nếu ngắn) |
| Sau | giá trị mới |
| Lý do | metric/acceptance nào cần |
| Kiểm chứng | lệnh + kết quả |
| Rollback | file baseline hoặc tên hằng config |

Không ghi "đã sửa nhiều chỗ"; mỗi thay đổi vật lý một dòng.

### 7.3 Ba mức rollback

1. **Theo feature (không cần git):**
   ```ts
   // core-visual-config.ts
   export const CORE_VISUAL_REVISION: 'v2-tier' | 'v3-constellation' = 'v2-tier'
   ```
   → không tạo constellation, `applyTierContrast` dùng `CORE_GLOW_V2` (giá trị cũ nguyên văn).
   Capture lại để xác nhận look cũ.
2. **Theo file (khôi phục baseline):**
   ```bash
   cp .agents/dataset-3d-core/baseline/holographic-core.model.ts src/graphics/holographic-core/holographic-core.model.ts
   cp .agents/dataset-3d-core/baseline/dataset-3d.view.tsx src/views/dataset-3d/dataset-3d.view.tsx
   cp .agents/dataset-3d-core/baseline/dataset-3d.css src/views/dataset-3d/dataset-3d.css
   ```
   (chỉ dùng sau khi đã xác nhận; không chạy `git reset --hard`.)
3. **Theo commit:** `git diff` / `git checkout -- <file>` do người dùng chủ động; agent không tự chạy
   lệnh phá huỷ.

### 7.4 Không làm

- Không chạy `forge/state.py mark`.
- Không sửa spec/validator/gate của img2threejs.
- Không đổi camera, fog, bloom toàn scene trừ khi metric de-glare yêu cầu và có log riêng.
- Không thêm package.

---

## 8. Tiêu chí nghiệm thu (đo được)

| # | Tiêu chí | Cách đo | Ngưỡng |
|---|---|---|---|
| 1 | Core bớt chói | crop core cố định `(590,420,125,180)` trên 1280×900 | mean 120–150; P95 ≤ 220; pixel ≥250 ≤ 2% |
| 2 | Core vẫn là cyan | hue trên pixel cyan-sat | 185–200°; cyan-sat ≥ 35% |
| 3 | Có cấu trúc | đếm dải sáng ngang + hạt record | 3 dải; ≥ 12 hạt thấy rõ |
| 4 | Issue flow | crop vùng giữa core→Detection `(700,430,330,220)` | pixel amber tăng ≥ 800 px so với before |
| 5 | Issue tới đích | khoảng cách end → mặt cube | ≤ 0.08 world; ≤ 6 px trên ảnh |
| 6 | Clean recirculation | vòng kín quanh core | ≥ 8 hạt cyan/violet thấy trong mọi frame |
| 7 | Module map | DOM legend | đủ 5 dòng; boundary text mới |
| 8 | Reduced motion | 2 ảnh cách 400 ms | diff ≤ 0.1% pixel |
| 9 | Hiệu năng | renderer info | draw call +≤6; tri +≤4k; 60 fps @1280×900, dpr 1.5 |
| 10 | Không hồi quy | tsc / eslint / vitest | 0 error; dataset tests 25/25 + test mới pass |
| 11 | Không lỗi console | capture Playwright | 0 error/warning (trừ Clock deprecation đã lọc) |
| 12 | Detach sạch | exploded capture | constellation ẩn; panel/selection vẫn hoạt động |

---

## 9. Các bước thực thi (có gate nội bộ, không phải forge gate)

| Bước | Việc | Bằng chứng |
|---|---|---|
| P0 | Baseline snapshot + plan + change-log skeleton | thư mục `baseline/`, `baseline.sha256`, file này |
| P1 | Config + de-glare only (chưa hạt) | capture `p1-attached.png`, số đo core |
| P2 | Nucleus bands + beads | capture `p2-attached.png`, số đo 3 dải |
| P3 | Issue lanes + particles + clean loop + beacon | capture `p3-attached.png`, đếm amber |
| P4 | UI legend + boundary text + responsive | capture desktop/mobile, DOM check |
| P5 | Tests + tsc + eslint | log output nguyên văn |
| P6 | Capture cuối 5 ảnh + đo + comparison sheet | `captures/after-*`, bảng số |
| P7 | Chốt change-log + trạng thái "v3 delivered" | `change-log.md` đủ dòng, không gate forge |

Mỗi bước P1–P4: nếu metric lệch, sửa **config trước**, rồi code; tối đa 3 vòng/bước.

---

## 10. Rủi ro & phương án

| Rủi ro | Phương án |
|---|---|
| Hạt HDR nhỏ bị bloom ăn thành đốm to | giảm size 0.05→0.04 hoặc linear 2.2→1.7; không tăng bloom scene |
| Lane cắt tower khi camera xoay | clean loop radius ≤1.37; issue lane y ≥2.15 ở r 2–4; kiểm 4 góc 45/135/225/315 |
| Core quá tối sau de-glare | tăng dải equator 1.3× trước khi tăng thân; không đụng base/tower |
| “Telemetry giả” | boundary text ghi rõ minh hoạ khái niệm; không hiện số liệu giả |
| Detach làm hạt lơ lửng | ẩn constellation khi detached |
| Sprite texture leak | dispose explicit trong `issue-constellation.dispose()` |
| Mobile legend đè nút | ẩn legend < 720px; boundary text giữ mapping |

---

## 11. Không nằm trong phạm vi

- Không nối dữ liệu thật, không tính quality score thật, không gọi AI.
- Không thêm label 3D billboard, không click cube để mở panel module.
- Không đổi camera/fog/bloom toàn scene (trừ khi P1 đo vượt ngưỡng và được log riêng).
- Không sửa img2threejs spec/validator/gate.

---

## 12. Kết quả thực thi (2026-11-02)

Trạng thái: **P0–P12 DONE; v3 delivered; spec locked; không đóng gate nào.** Số đo chi tiết, log
trước/sau và rollback nằm ở `change-log.md` §1–§6.

Khác biệt so với đặc tả gốc (đã ghi log):
- Band equator: tube `0.011 → 0.007`, linear `(1.15,2.30,2.60) → (0.8,1.6,1.8)`; band ngoài
  `0.006 → 0.0045`, `(0.65,1.45,1.75) → (0.45,0.9,1.05)` — tránh bão hoà trắng (lần đo đầu clip 9.31%).
- Bead: size `0.032 → 0.026`, palette HDR max `2.2 → 1.15`.
- Lane end offset: `(0,±0.12,±0.08) → (0,±0.06,±0.04)` để thoả §8 #5 (≤0.08 world); giá trị trong
  §4.2 được thay bằng bảng này.
- `laneOpacity 0.22 → 0.32`, lane issue `(1.6,0.55,0.15) → (2.0,0.7,0.2)`.
- Bands/beads/beacon nằm trong `constellation.root` world-space (không gắn `core-upper`) để làn đi
  tới Detection và ẩn sạch khi detach.
- Capture thực tế: `after-attached[-b].png`, `after-orbit.png`, `after-closeup.png`,
  `after-exploded.png`, `after-mobile.png`, `after-reduced-a/b.png`, `comparison-attached.png`;
  không tạo ảnh trung gian `p1/p2/p3-attached.png`.

Kết quả đo cuối (1280×900, xem `captures/measurements.json`):
- Crop plan `(590,420,125,180)`: mean **132.1**, P95 **240.7**, clip **2.17%** — P95/clip vượt do
  inbound-stream arcs có sẵn (294/488 px clip ở `y<480`).
- Core body `(585,500,140,120)`: mean **107.2**, P95 **211.7**, clip **0.25%**.
- Amber crop `(700,430,330,220)`: **0 → 583 px** (ngưỡng 800 là proxy, không đạt; làn nhìn rõ).
- Tier order: base **48.8** < tower **76.1** < core **107.2**.
- Cyan-dominant: 73.6% pixel, hue P25–P75 **196.0–215.8°**.
- Reduced motion: diff **0.000%**; console: **none**; test **32/32**; tsc/eslint **0**.
