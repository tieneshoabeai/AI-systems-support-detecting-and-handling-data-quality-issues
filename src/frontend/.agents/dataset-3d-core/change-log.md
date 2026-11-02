# Change log — Dataset 3D core v3 (Issue Constellation)

Ngày mở log: 2026-11-02 · Phạm vi: core visual + module legend · Gate img2threejs: **không đóng**
Trạng thái tổng: **DONE — model v1 delivered; spec locked; không đóng gate nào**

Quy ước:
- Mỗi thay đổi vật lý (file/dòng) = một dòng. Không gộp.
- `Trước` / `Sau` ghi giá trị thật, không ghi "đã sửa".
- `Rollback` trỏ về baseline hoặc hằng config tương ứng.
- Chỉ đánh dấu `DONE` sau khi lệnh kiểm chứng tương ứng chạy pass và capture đã lưu.

---

## 0. Baseline snapshot (đã làm)

| File | SHA-256 | Bản sao |
|---|---|---|
| `src/graphics/holographic-core/holographic-core.model.ts` | `2bdf72d5971f3337bcafc6bcda3b3a3f4a73ed9cc8580045f2ed5cc7279d1522` | `baseline/holographic-core.model.ts` |
| `src/views/dataset-3d/dataset-3d.view.tsx` | `808a5ee0812d2ea0c3d3a06b8d29e38829bd477aed238a2f132cac9768819bae` | `baseline/dataset-3d.view.tsx` |
| `src/views/dataset-3d/dataset-3d.css` | `a32f417867ed0724c43c32540fd29b68504e7d7fb6a5d23d3d2ab803ae6dba7b` | `baseline/dataset-3d.css` |
| `src/graphics/neon-cube/neon-cube.cluster.ts` | `4068cbda4ae08fc846408ef12e68a94076765f93e5ae92ab6829c743d0e43f4b` | `baseline/neon-cube.cluster.ts` |
| `src/graphics/neon-cube/neon-cube.model.ts` | `52dc656b91aeb5e5d8b4970a0f143bdffed783e3e63da4c5b5d45c531b2f456c` | `baseline/neon-cube.model.ts` |

Baseline ảnh:
- `captures/before-attached.png` ← `/tmp/dataset-initial.png` (1280×900 hero, camera hiện tại)
- `captures/before-exploded.png` ← `.agents/holographic-core/captures/desktop-exploded-a.png`

Hai mốc baseline (đã đối soát):
- **187.6** — số đo reference ban đầu trên `/tmp/dataset-initial.png` trước khi đổi camera/layout; dùng làm mốc lịch sử.
- **139.3** — cùng crop `(590,420,125,180)` trên `captures/before-attached.png` (camera hiện tại). Đây là mốc so sánh chính vì mọi capture after dùng cùng camera.

| Vùng | Mean L | P95 | Hue | Cyan-sat |
|---|---:|---:|---:|---:|
| Core drum (reference, camera cũ) | 187.6 | 248 | 190.8° | 69.9% |
| Core crop before (camera hiện tại) | 139.3 | 238.2 | 211.4° | — |
| Core body before `(585,500,140,120)` | 125.7 | 238.8 | 209.4° | — |
| Base band | 63.5 | 169 | 259.5° | 0.9% |
| Tower side | 77.9–93.0 | 178–183 | 214–218° | 1.0–1.6% |

---

## 1. Thay đổi đã áp dụng

| # | File / vị trí | Trước | Sau | Lý do | Kiểm chứng | Rollback | Trạng thái |
|---|---|---|---|---|---|---|---|
| P1 | `holographic-core.model.ts` `applyTierContrast` | `core-upper` emissive ×1.35, op 0.78, contour 0.8, roughness 0.34; `core-lower` ×1.00, op 0.70, contour 0.7 | `resolveCoreGlow()` áp: upper `#041a2e`/`#18c8ee` ×0.50, op 0.58, contour 0.22, roughness 0.55; lower `#031624`/`#12b8e0` ×0.38, op 0.50, contour 0.20; collar/cap/foot hạ theo plan §3.2 | Core chói, mất chi tiết | body crop: mean 125.7 → 107.0, P95 238.8 → 210.0, clip 0.97% → 0.33% | `CORE_VISUAL_REVISION='v2-tier'` (legacy `CORE_GLOW_V2`) | DONE |
| P2 | `holographic-core.model.ts` roughness patch | `paintPart`/`clonePartMaterial` không nhận roughness | patch type có `roughness?`; upper/lower đặt 0.55 | Giảm specular hotspot | after: không còn đốm trắng trên drum | baseline | DONE |
| P3 | `core-visual-config.ts` (mới) | — | `CORE_VISUAL_REVISION='v3-constellation'`, `CORE_GLOW_V2/V3`, `CORE_NUCLEUS`, `ISSUE_CONSTELLATION`, `ISSUE_LANES`, `CLEAN_LOOP_POINTS`, `resolveDetectionAnchor()`, `DETECTION_ANCHOR` | Tập trung số liệu; rollback 1 hằng | `issue-constellation.test.ts` (anchor/nucleus/lanes) | xoá file + restore baseline model | DONE |
| P4 | `holographic-core.model.ts` wiring | Không có constellation | Tạo sau `applyTierContrast`; `model.add(constellation.root)`; nối `resetMotion()`, `update(elapsedSeconds, deltaSeconds)`, `setDetached()`; `dispose()` remove + dispose trước traverse | Thêm nucleus + hạt | exploded: constellation ẩn; dispose test | `ISSUE_CONSTELLATION.enabled=false` | DONE |
| P5 | `issue-constellation.ts` (mới) | — | 3 issue lanes + 1 clean loop (1 `LineSegments`), 48 hạt (1 `InstancedMesh`), 3 dải gộp (vertex colour), 18 bead, beacon ring + sprite `DataTexture` 64²; mọi object `raycast=()=>{}` | Concept C | 7/7 test; capture attached/closeup | xoá file + P4 revert | DONE |
| P6 | `dataset-3d.view.tsx` overlay | Boundary cũ: "Chưa gắn record, kết quả AI hoặc trạng thái chất lượng dữ liệu." | Legend 5 dòng `BẢN ĐỒ MODULE` + ghi chú "Hạt cam: vấn đề chất lượng → Detection"; boundary text mới nêu nhân/module/hạt và "minh hoạ khái niệm, chưa nối dữ liệu thật" | Làm core có nghĩa, map 4 module | DOM test 3/3; capture desktop | baseline | DONE |
| P7 | `dataset-3d.css` | Không có `.dataset-3d-legend` | Panel desktop góc trên trái, `pointer-events:none`, ẩn `max-width:680px`; chip màu core/violet/cyan/blue/orange | Hiển thị mapping, không đè nút | capture 1280×900 + 390×844 | baseline | DONE |
| P8 | `src/__tests__/dataset-3d/issue-constellation.test.ts` (mới) | — | 7 test: anchor, lane end, clean-loop radius, 18+30, palette hue, counts, update/reset/detach/dispose, product integration | Chống hồi quy số liệu | vitest 32/32 | xoá file | DONE |
| P9 | `.agents/dataset-3d-core/captures/capture-core-v3.cjs` (mới) | — | Playwright: attached A/B, orbit, close-up, exploded, mobile, reduced A/B; log console | Bằng chứng trước–sau | console errors: none | xoá file | DONE |
| P10 | `core-visual-config.ts` `CORE_GLOW_V3` | upper `#041a2e`/`#18c8ee`; lower `#031624`/`#12b8e0`; collar `#052238`/`#22cdf0` | upper `#04222c`/`#18d2e6`; lower `#031e26`/`#12c6d6`; collar `#052a36`/`#22cfe0` | Dịch hue về cyan 185–200° | cyan P25 196.0°, P50 207.2° (trước 198.7/208.3) | revert 3 dòng về giá trị cũ | DONE |
| P11 | `core-visual-config.ts` `ISSUE_CONSTELLATION` | `laneOpacity 0.22`, lane issue `(1.6,0.55,0.15)` | `laneOpacity 0.32`, lane issue `(2.0,0.7,0.2)` | Làn amber rõ hơn trong crop acceptance | amber crop 547 → 583 px; full frame 13,611 | revert 2 dòng | DONE |
| P12 | `core-visual-config.ts` `ISSUE_LANES` ends | Lệch mặt Detection `(0,±0.12,±0.08)` → xa tới 0.144 | Lệch `(0,±0.06,±0.04)` → xa tối đa 0.072 | Acceptance §8 #5 yêu cầu ≤0.08; §4.2 cũ mâu thuẫn | `vitest` 32/32; end vẫn tách nhau | revert 3 dòng `end` | DONE |

---

## 2. Bảng đo sau khi áp dụng

Nguồn: `captures/measurements.json`, sinh bởi `captures/measure-core-v3.py` (cùng crop, cùng ảnh 1280×900).

| Mốc | Ảnh | Mean L core | P95 | ≥250 | Hue | Amber px vùng lane | Ghi chú |
|---|---|---:|---:|---:|---:|---:|---|
| Before | `captures/before-attached.png` | 139.3 | 238.2 | 0.79% | 211.4° | 0 | crop plan |
| Final | `captures/after-attached.png` | 132.1 | 240.7 | 2.17% | 212.2° | 583 | crop plan; 294/488 px clip nằm ở inbound arcs |
| Final body | `captures/after-attached.png` | 107.2 | 211.7 | 0.25% | 211.6° | — | crop body (585,500,140,120) |
| Final cyan | `captures/after-attached.png` | — | — | — | 196.0–215.8° (P25–P75) | — | cyan-dominant 73.6% |

Bổ sung:
- Amber toàn khung: 13,611 px (0 trước khi thêm constellation); crop acceptance `(700,430,330,220)`: **583** (before 0).
- Tier order hiện tại (crop đại diện): base **48.8** < tower **76.1** < core **107.2**.
- Clean loop + 18 bead + 3 dải: thấy trong `after-closeup.png` (3 dải mảnh, >12 sparkle bead/clean, vòng kín cyan, 3 làn amber).
- Reduced motion: `after-reduced-a/b.png` khác **0.000%**, max diff **0**.
- Console khi capture: **none**.
- Sheet so sánh: `captures/comparison-attached.png` (before | after | close-up).

Diễn giải P95/clip của crop plan: crop chứa các inbound-stream arcs có sẵn từ trước (plan §1 yêu cầu giữ nguyên). Tách theo vùng: 294 px clip ở `y < 480` (arcs), 194 px ở phần core/band ⇒ core clip thực tế **0.86%**; body crop (không có arcs) đạt cả 3 ngưỡng.

### 2.1 Đối chiếu tiêu chí nghiệm thu (plan §8)

| # | Tiêu chí | Kết quả | Trạng thái |
|---|---|---|---|
| 1 | Core bớt chói (crop plan) | body: mean 125.7 → 107.2, P95 238.8 → 211.7, clip 0.97% → 0.25%; crop plan P95 240.7/clip 2.17% do arcs | **PARTIAL** — body đạt; crop plan vượt vì arcs có sẵn |
| 2 | Core cyan 185–200° | P25 196.0°, P50 207.2°, cyan-share 73.6% | **PARTIAL** — lệch ~7° do ACES + ánh sáng scene |
| 3 | 3 dải + ≥12 hạt | close-up: 3 dải mảnh, >12 sparkle (18 bead + 30 clean) | **PASS** |
| 4 | Amber crop tăng ≥800 px | 0 → 583 px (classifier sat≥0.25, val≥0.28; 700,430,330,220) | **FAIL (proxy)** — làn rõ bằng mắt; 800 px không đạt vì làn mảnh |
| 5 | End ≤0.08 world tới mặt cube | offsets mới ≤0.072; test endpoint pass | **PASS** (đã sửa P12) |
| 6 | ≥8 hạt clean mỗi frame | 30 hạt loop, thấy ở hero/close-up/orbit | **PASS (visual)** — chưa đếm tự động 4 góc |
| 7 | Legend 5 dòng + boundary mới | DOM test + capture desktop | **PASS** |
| 8 | Reduced motion ≤0.1% | 0.000% | **PASS** |
| 9 | Draw call +≤6, tri +≤4k | +6 draw (bands/beads/lanes/particles/ring/sprite), ~+3.8k tri theo thiết kế | **UNVERIFIED** — chưa hook `renderer.info` |
| 10 | tsc/eslint/vitest | 0 / 0 / 32/32 | **PASS** |
| 11 | Console sạch | none | **PASS** |
| 12 | Detach sạch | constellation ẩn; panel hoạt động | **PASS** |

---

## 3. Lệnh kiểm chứng (chạy từ `src/frontend`)

```bash
npx tsc -b
npx eslint src/graphics/holographic-core src/views/dataset-3d src/__tests__/dataset-3d
npx vitest run src/__tests__/dataset-3d
# dev server: npm run dev -- --port 5173
NODE_PATH=/Users/mac/.npm/_npx/e41f203b7505f1fb/node_modules \
  node .agents/dataset-3d-core/captures/capture-core-v3.cjs
python3 .agents/dataset-3d-core/captures/measure-core-v3.py
```

Kết quả 2026-11-02:
- `tsc -b`: 0 lỗi.
- `eslint`: 0 lỗi.
- `vitest`: 5 file, **32/32 test pass**.
- `capture-core-v3.cjs`: `reduced-motion label: Chuyển động tự động đã tắt theo cài đặt thiết bị.`; `console errors: none`.
- `measure-core-v3.py`: JSON ở §2, reduced diff 0.000%.

---

## 4. Nhật ký thực thi

### 2026-11-02 — P0 baseline snapshot
- Copy 5 file gốc + hash vào `baseline/`, lưu 2 ảnh before.
- Chưa sửa file source nào.
- Gate img2threejs: không đóng.

### 2026-11-02 — P1–P2 de-glare core
- File: `src/graphics/holographic-core/holographic-core.model.ts` + `core-visual-config.ts`.
- Trước: upper emissive ×1.35/op 0.78/contour 0.8; lower ×1.00/op 0.70/contour 0.7; roughness 0.34.
- Sau: `CORE_GLOW_V3` (§1 P1), roughness 0.55.
- Đo lần 1 (bands theo plan §3.3): plan crop mean 155.0, P95 255, clip 9.31% → fail. Tắt constellation để cô lập: body-only 118.5 / 217.9 / 0.02% → thân core đạt, phần vượt do bands + bead HDR.
- Đo lần 2: giảm band tube/HDR, bead size/palette (xem §5) + sửa bug mất `linear` (thêm vertex colour attribute cho từng torus) → final 131.4 / 240.1 / 2.19%; body 107.0 / 210.0 / 0.33%.
- Rollback: `CORE_VISUAL_REVISION='v2-tier'`.
- Gate: không đóng.

### 2026-11-02 — P3–P5 nucleus + Issue Constellation
- File mới: `core-visual-config.ts`, `issue-constellation.ts`.
- Nối vào `holographic-core.model.ts`: tạo sau `applyTierContrast`, ẩn khi exploded, update theo `elapsed/delta`, dispose tường minh (Sprite không nằm trong traverse dispose).
- `constellation-particles`: 48 instance (18 issue + 30 clean); `constellation-lanes`: 1 LineSegments; `nucleus-bands`: 3 torus gộp; `nucleus-beads`: 18 instance; beacon ring + sprite.
- Kiểm chứng: capture attached/closeup/orbit; amber lane rõ (3,074 px trong crop đường bay); clean loop và bead thấy ở close-up.
- Rollback: `ISSUE_CONSTELLATION.enabled=false` hoặc `CORE_VISUAL_REVISION='v2-tier'`.
- Gate: không đóng.

### 2026-11-02 — P6–P7 legend + boundary text
- `dataset-3d.view.tsx`: thêm `<aside className="dataset-3d-legend">` 5 dòng + note; thay boundary text.
- `dataset-3d.css`: style legend + ẩn < 680px.
- Kiểm chứng: DOM test pass; desktop 1280×900 thấy legend, mobile 390×844 ẩn legend, nút Tách mô hình không bị đè.
- Rollback: restore 2 file baseline.
- Gate: không đóng.

### 2026-11-02 — P8–P9 test + capture + đo
- `issue-constellation.test.ts`: 7 test; tổng suite dataset-3d 32 test.
- `capture-core-v3.cjs`: 8 ảnh; console sạch; reduced-motion 2 frame giống hệt.
- `measure-core-v3.py` + `measurements.json`: số liệu §2.
- Trạng thái: **spec locked / model v1 delivered**.
- Gate: không đóng (không chạy `forge/state.py mark`).

### 2026-11-02 — Audit plan §8 + P10–P12
- Đối chiếu 12 tiêu chí: 7 PASS, 3 PARTIAL (glare crop plan, hue, clean 4 góc), 1 FAIL proxy (amber 583 < 800), 1 UNVERIFIED (performance).
- P10 hue nudge: `CORE_GLOW_V3` 3 dòng; cyan P50 208.3 → 207.2; vẫn ngoài 185–200° do ACES + light scene → ghi deviation, không chỉnh thêm để tránh lệch màu đã duyệt.
- P11 lane visibility: `laneOpacity 0.22 → 0.32`, lane color `(1.6,0.55,0.15) → (2.0,0.7,0.2)`; amber crop 547 → 583; làn rõ hơn trong ảnh.
- P12 lane ends: offset `(0,±0.12,±0.08)` → `(0,±0.06,±0.04)`, đạt acceptance ≤0.08 (max 0.072).
- Thêm `make-comparison-sheet.py` + `comparison-attached.png` (before | after | close-up).
- Kiểm chứng lại: `tsc` 0, eslint 0, vitest **32/32**, capture console none, reduced diff 0.000%.
- Rollback: revert P10–P12 trong `core-visual-config.ts` (3 khối giá trị).
- Gate: không đóng.

---

## 5. Deviations & giới hạn đã biết

1. **Bands/beads/beacon nằm trong `constellation.root` (world space)**, không attach vào `core-upper` như plan §3.3 gợi ý. Lý do: issue lanes phải giữ world-space tới Detection; `setDetached` ẩn cả cụm nên exploded view vẫn sạch. Nếu cần bands đi theo explode, tách band mesh sang `runtime.nodes['core-upper']` và giữ lanes ở root.
2. **Band tuning khác plan §3.3** (sau lần đo 155/9.31%): equator tube `0.011 → 0.007`, linear `(1.15,2.30,2.60) → (0.8,1.6,1.8)`; outer bands tube `0.006 → 0.0045`, linear `(0.65,1.45,1.75) → (0.45,0.9,1.05)`; opacity 0.65. Hệ quả: nucleus vẫn HDR nhưng không bão hoà trắng toàn drum.
3. **Bead nhỏ hơn plan**: size `0.032 → 0.026`, palette HDR giảm còn max 1.15 (plan tới 2.2). Lý do: 18 hạt additive ở HDR cao gây clip.
4. **Beacon texture**: `DataTexture` 64² (plan ghi CanvasTexture 128²). Cùng mục đích, nhẹ hơn; gradient lõi amber.
5. **P95 240.7 / clip 2.17% trên crop plan** vượt ngưỡng vì crop chứa inbound streams có sẵn (294/488 px clip ở `y<480`). Không sửa streams theo plan §1. Core body đạt: 211.7 / 0.25%.
6. **Hue median 207–212°** thay vì 185–200° do crop trộn tower steel-blue + ACES/ánh sáng scene; pixel cyan-dominant (73.6%) có P25–P75 = 196.0–215.8°, vẫn đọc là cyan. P10 chỉ dịch được ~1° nên dừng, không đổi màu thêm.
7. **Ngoài phạm vi, chưa xử lý**: inbound streams là điểm sáng nhất khung (hành vi có trước); orbit tự do có thể cắt khối Data analysis ở mép stage. Cả hai thuộc camera/cluster, không thuộc constellation.
8. **Amber crop acceptance (583 < 800)**: classifier strict (hue 10–60°, sat ≥0.25, val ≥0.28) đếm pixel làn; làn 1 px nên số pixel bị giới hạn bởi độ dài, không phải độ sáng. Tăng `issueParticlesPerLane`/size sẽ đạt proxy nhưng lệch plan §4.2 (18 hạt) — chọn giữ thiết kế, ghi FAIL proxy; làn amber nhìn rõ trong `after-closeup.png` và crop `/tmp/amber-crop.png`.
9. **Performance (draw call/tri) chưa đo trực tiếp**: scene không expose `renderer.info`; ngân sách +6 draw / ~+3.8k tri là ước tính từ thiết kế, không phải số đo runtime.
10. **Mâu thuẫn nội bộ plan đã xử lý**: §4.2 đặt end lệch ±0.12 nhưng §8 #5 yêu cầu ≤0.08. P12 thu offsets còn ≤0.072, giữ 3 làn tách nhau; ghi nhận §4.2 là giá trị cũ.

---

## 6. Rollback nhanh

```bash
# toàn bộ visual về trước concept C (giữ code mới nhưng tắt)
#   src/graphics/holographic-core/core-visual-config.ts
CORE_VISUAL_REVISION = 'v2-tier'      # core materials cũ
ISSUE_CONSTELLATION.enabled = false   # không dựng hạt/lanes

# hoặc khôi phục file gốc
shasum -c .agents/dataset-3d-core/baseline.sha256
cp .agents/dataset-3d-core/baseline/<file> <đường-dẫn-gốc-tương-ứng>
```

Gate img2threejs: **không đóng**.
