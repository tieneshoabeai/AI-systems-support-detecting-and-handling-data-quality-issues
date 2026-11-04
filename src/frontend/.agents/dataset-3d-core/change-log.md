# Change log — Dataset 3D core v3 (Issue Constellation)

Ngày mở log: 2026-11-02 · Phạm vi: core visual + module legend · Gate img2threejs: **không đóng**
Trạng thái tổng: **DONE — v3 locked (2026-11-02); v4 spool reactor delivered (2026-11-03); cap 3 phần P21–P23; nhãn vật liệu + explode từng tầng P24; chamber tinh gọn P25 (2026-11-03); không đóng gate nào**

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

Checkpoint git: `1c71e16` — `feat(dataset-3d): add 3D workspace with neon modules and issue constellation`
(`git show 1c71e16 --stat`, `git revert 1c71e16` để quay lại trạng thái trước checkpoint).

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

---

## 7. v4 — Spool Reactor (2026-11-03)

Yêu cầu: thay core cũ bằng khối spool reactor teal trong ảnh tham chiếu (trụ thấp, đỉnh có 6 rãnh
đồng tâm, chamber kính trong với vòng cyan + tick + hạt, nhân turquoise, bệ kính, 4 quỹ đạo
nghiêng có cầu phát sáng, luồng hạt rơi, tia amber bên phải). Phạm vi đã chốt với human:
**Core + platform + orbits**, giữ 4 cube neon + camera + constellation, thêm revision `v4-spool`
để rollback; giữ ngữ nghĩa lane issue → Detection; reflection giả (không thêm render pass);
giữ khung hình hiện tại (không phóng to che cube).

### 7.0 Baseline v4

| File | SHA-256 trước khi sửa | Bản sao |
|---|---|---|
| `src/graphics/holographic-core/core-visual-config.ts` | `b14dae8ed2d64f20db6702d5ebfdc2eedcd5c326cf68a2232f9ba2403f5d799c` | `reference-v4-spool/baseline-v3.sha256` |
| `src/graphics/holographic-core/holographic-core.model.ts` | `a820932aae3bc7f010bff1d18e07e574b6c2718473f35c32cad431ba719831e9` | `reference-v4-spool/baseline-v3.sha256` |
| `src/graphics/holographic-core/issue-constellation.ts` | `03bc6b102b1dd998b50a61741b816fa640971d0c5b8ed52aa53ae014155b26d3` | `reference-v4-spool/baseline-v3.sha256` |

Bảng trên là **vân tay lúc bắt đầu v4**, không phải bề mặt rollback: 3 hash khớp đúng blob của commit `39e66cf`
(nên `shasum -a 256 -c` chạy trên cây nguồn *hiện tại* FAILED cả 3 dòng — đó là độ lệch tích luỹ của P21–P26, không
phải baseline hỏng). Bề mặt thực tế của v4 tính đến P26 là **7 file**; xem **7.4.1**.

Ảnh baseline v3 (cùng camera/khung 1280×900): `captures/v3-baseline-{attached,orbit,closeup,exploded,mobile}.png`.
Ảnh tham chiếu: `reference-v4-spool/reference.png`. Sheet đối chiếu: `captures/comparison-v4.png`
(reference | v3 | v4 hero | v4 close-up).

### 7.1 Thay đổi

| # | File / vị trí | Trước | Sau | Lý do | Kiểm chứng | Rollback | Trạng thái |
|---|---|---|---|---|---|---|---|
| P13 | `core-visual-config.ts` revision | `CORE_VISUAL_REVISION='v3-constellation'` | `'v4-spool'` (union thêm `'v4-spool'`) | Bật core mới | tsc, vitest | đổi lại `'v3-constellation'` | DONE |
| P14 | `core-visual-config.ts` nucleus/lanes | `CORE_NUCLEUS`, `ISSUE_LANES` (giá trị v3) | Tách `CORE_NUCLEUS_V3/V4`, `ISSUE_LANES_V3/V4` + `resolveCoreNucleus()`, `resolveIssueLanes()`; V4: tâm y1.42, equator r0.9, band y1.16/1.42/1.68, bead ring 0.55×10 + 0.72×8; 3 lane start ở mặt chamber (r≈0.98, y1.36–1.5), end giữ trên mặt Detection | Lõi mới nằm trong chamber; lane không xuyên kính | `issue-constellation.test.ts` (anchor/lane/version) | dùng resolver mặc định với `'v3-constellation'` hoặc restore baseline hash | DONE |
| P15 | `core-visual-config.ts` `SPOOL_CORE` (mới) | — | `platform r1.9/t0.05/y0.495`, `baseGlass r1.06/h0.38/y0.71`, `chamber r0.95/h0.86/y1.42`, `topDrum r1.17/h0.46/y2.17`, `topY 2.4`, 6 groove r0.30–1.05, 24 tick, nucleus r0.16, 4 orbit r1.96–2.20 (flatten 0.78, tilt/yaw riêng), particle 90+36+24+14 = **164**, palette teal/amber, `budget 18 draw / 23,000 tri` (phần `topDrum`/groove được thay bởi **P21**) | Tập trung số liệu v4; test đối chiếu | `spool-core.test.ts` (stack, orbit, palette, budget) | xoá khối `SPOOL_CORE` + P13–P14 revert | DONE |
| P16 | `src/graphics/holographic-core/spool-core.ts` (mới) | — | Top drum dark-glass + upper/lower band kim loại + 7 vòng groove gộp + center glow; chamber kính trong, 3 vòng cyan gộp, 24 tick + 2 dashed ring + 8 seam dọc, nucleus + glow sprite + PointLight; bệ kính + 2 rim; platform + 4 vòng + reflection giả (DataTexture 64²); 4 torus nghiêng gộp + 8 cầu instanced; 164 hạt instanced (chamber/stream/floating/spark amber); `update/reset/setDetached/dispose` không cấp phát mỗi frame | Dựng core theo ảnh, tối đa ít draw call | `spool-core.test.ts` 7 test; đo **18 draw call / 22,080 tri** | xoá file | DONE |
| P17 | `holographic-core.model.ts` wiring | Core cũ hiển thị đầy đủ; không có spool | Khi v4: tạo `createSpoolCore()`, ẩn `core-upper/core-lower/core-cap/core-mid-collar/core-lower-collar/core-foot/orbit-violet`, ẩn đèn v3 tương ứng + `runner`, bỏ grid/solar decoration của cap, ẩn `axialSpines`/`beam`; attach `top+chamber→core-upper`, `base→core-lower`, `platform→base-deck`, `fx` ở world; contour + pickable lấy từ `spool.selectableMeshes`; `resetMotion/update/setDetached/dispose` gọi spool | Giữ detach, picking, tier contrast, constellation, inbound streams | vitest suite 39/39; capture attached/orbit/exploded/mobile | so sánh hash baseline hoặc P13 revert | DONE |
| P18 | `issue-constellation.ts` options | Luôn dựng 3 dải nucleus | `createIssueConstellation({ nucleusBands?: boolean })`; v4 truyền `false` (spool có vòng/tick riêng), v3 giữ mặc định `true` | Tránh 2 bộ vòng chồng nhau | test lan + capture | bỏ option (luôn true) | DONE |
| P19 | Tests | Suite 32 test | `issue-constellation.test.ts`: lane start theo `SPOOL_CORE.chamber.radius + 0.03`, start Y 1.3–1.55, revision `'v4-spool'`; thêm `spool-core.test.ts` 7 test (stack/contact, orbit ngoài drum & trong vành tower, palette, node detail, selectable id, animate/reset/detach/dispose, budget đo được) | Chống hồi quy v4 | vitest **39/39** (6 file) | xoá file test mới + revert P19 | DONE |
| P20 | Capture | `capture-core-v3.cjs` (v3) | Dùng lại script, chụp 8 ảnh after + 5 ảnh baseline v3; thêm `make-comparison-sheet-v4.py` → `comparison-v4.png` | Bằng chứng trước–sau | console errors: none; reduced-motion A/B byte-identical | xoá script/sheet | DONE |
| P21 | `core-visual-config.ts` `cap` + `spool-core.ts` | `topDrum r1.17/h0.46/y2.17` + 6 groove đồng tâm + upper/lower band | Cap chia **3 phần** theo mô tả human: `lid` = vành r0.75–0.90, h0.05, tâm y2.375, lỗ xuyên suốt r0.75 (5/7 bán kính), vành ngoài 0.90–1.05 là chỗ ghép roof; `roof` = nón cụt đối xứng, vành trên 0.90–1.05 tại y2.40, vành dưới 1.02–1.17 tại y2.152 (inset 2 mm khỏi drum), cao 0.25, rộng vành 0.15 mỗi phía; `drum` = trụ r1.02–1.17, h0.30, tâm y2.0; tổng cap 0.55 (y1.85–2.40); bỏ toàn bộ rãnh đồng tâm; 3 ID selectable riêng `core-cap-lid`/`core-cap-roof`/`core-cap-drum`; 4 rim gộp r0.756/0.90/1.05/1.166; band kim loại y1.87 giữ nguyên | Sửa cap "chưa khướp" theo đúng tỉ lệ human: nắp rỗng 5/7 + vành ghép 1/7, mái chéo đối xứng, trụ rộng H3 = 0.30 | `spool-core.test.ts` 8 test (stack/contact, split ratios, through-hole, selectable id, budget); đo **19 draw / 20,688 tri**; capture `after-cap-detail.png` | đổi lại `topDrum`/groove theo P15 hoặc restore baseline hash | DONE (số liệu lid/roof được thay bởi **P22**) |
| P22 | `core-visual-config.ts` `cap` + `spool-core.ts` | lid r0.75–0.90 ×0.05 flush ở y2.40; roof 0.25 cao; lid dùng `darkGlass`, roof dùng `glass` | `lid` = vành r0.65–0.85 (rộng 0.2), **h0.2**, tâm y2.30, lỗ xuyên suốt r0.65, lồng trong roof và nhô 0.13 lên trên (đỉnh y2.40 giữ nguyên); `roof` = nón cụt đối xứng **h0.12** (y2.152–2.27), vành trên 0.85–1.05 (ghép sát lid), vành dưới 1.02–1.17; `drum` giữ r1.02–1.17, thành 0.15, h0.30; **đổi vật liệu lid ↔ roof** (lid `glass`/`blue-volume`, roof `darkGlass`/`cyan-contour`); rim gộp 6 vòng: lid trong/ngoài ở y2.396, roof trên trong/ngoài ở y2.266, roof dưới ngoài/trong ở y2.154; topY vẫn 2.40, cap vẫn cao 0.55 | Human chỉnh: roof thấp 0.12, lid dày 0.2 vành 0.65–0.85 lỗ 0.65, lid lồng trong roof, đổi màu 2 phần | `spool-core.test.ts` 8 test pass (stack, lid/roof split, nesting, through-hole, budget); đo **19 draw / 22,224 tri**; capture toàn bộ + `after-cap-detail.png`; console errors none; reduced-motion A/B byte-identical | revert config lid/roof P21 + đổi lại vật liệu + 4 rim | DONE |
| P23 | `core-visual-config.ts` `cap` + `spool-core.ts` | P22: lid r0.65–0.85, roof 2.152–2.27, drum 1.85–2.15 | **Dâng cụm roof+drum lên ngang lid**: `drum` 1.98–2.28 (giữ r1.02–1.17, thành 0.15, h0.30, tâm y2.13); `roof` 2.282–2.40 (h0.12, **vành trên 0.90–1.05**, vành dưới 1.02–1.17, nón cụt đối xứng); `lid` thu còn **r0.65–0.80** (rộng 0.15), h0.2, 2.20–2.40; roof và lid cùng mặt trên y2.40, chừa **khe hướng tâm 0.10** (0.80→0.90) để human thiết kế lại; band kim loại dời lên tâm y2.0; `cap.bottomY 1.85→1.98` nên có khe **0.13** giữa đỉnh chamber (1.85) và drum; `cap.topY − cap.bottomY = 0.42` | Human: dâng roof+drum cùng độ cao lid, lid 0.65–0.80, giữ dạng nón cụt đối xứng | `spool-core.test.ts` 8/8; đo **19 draw / 22,224 tri**; capture toàn bộ + `after-cap-detail.png`; console errors none; reduced-motion A/B byte-identical | revert config/rim về P22 | DONE |
| P24 | `spool-core.ts`, `holographic-core.scene.tsx`, `core-visual-config.ts`, `spool-core.test.ts` | nhãn `material: blue-volume / cyan-contour`; 1 mesh `spool-cap-rims`; cap + chamber cùng node `core-upper`; không có API explode; raycast vẫn bắt mesh ẩn | **Nhãn thật**: lid/chamber/base `material: 'glass'`, roof/drum `material: 'dark-glass'`. **Pivot riêng**: `spool-cap-lid-part` / `spool-cap-roof-part` / `spool-cap-drum-part`; rims tách `spool-cap-lid-rims` (2 vòng) + `spool-cap-roof-rims` (4 vòng); band kim loại vào nhóm drum; base bọc `spool-base-shift` để offset explode không đè vị trí `attach()` bake. **`setExplode(progress)`**: drum +0.16, roof +0.36, lid +0.70, base +0.12 (clamp 0–1) cộng với detach node (`core-upper` +0.42, `core-lower` +0.12, `base-deck` +0.15) → ladder world **platform 0.15 / base 0.24 / chamber 0.42 / drum 0.58 / roof 0.78 / lid 1.12**; `reset()` trả offset về 0. **Pick**: `isVisibleInScene()` lọc hit có ancestor `visible=false`, nên mesh legacy `core-cap` ẩn không còn bắt click phía trên lid. Budget draw call **19→20** (tách rims), tam giác giữ 22,224 | Human: "sửa đúng nhãn" + khi tách mỗi phần phải ở một độ cao riêng để dễ tương tác | `spool-core.test.ts` 10 test (thêm label + explode/reset/clamp) → **42/42**; probe exploded close-up: y320→`core-cap-lid`, y360→`core-cap-roof`, y410→`core-cap-drum`, y470→`core-upper`; panel lid hiện `material = glass`; capture `after-exploded.png`, `after-exploded-cap-detail.png`, `after-exploded-selected.png`; console errors none; reduced-motion A/B byte-identical | revert 4 file về P23 + budget 19 | DONE |
| P25 | `core-visual-config.ts` `chamber`/`nucleus`/`palette`, `spool-core.ts`, `spool-core.test.ts` | chamber trụ hở r0.95 × h0.86 (0.99–1.85, khe 0.13 tới cap), 3 vòng neon teal r0.90, 24 tick + 2 vòng nét đứt + 8 seam, lõi cầu r0.16, quầng sprite 0.95, đèn `4.2 / d2.6` | **Bỏ** `spool-chamber-rings` + `spool-chamber-ticks` (kèm `buildChamberTicks`, `lineMaterial`, `palette.neonLinear`, `SPOOL_CORE.ticks`). **Thân kính**: vỏ dày **0.01** (lathe: inner 0.94 / outer 0.95, đóng kín 2 vành), **h0.99, tâm y1.485 → 0.99–1.98**, chạm đúng đáy cap (`cap.bottomY 1.98`, khe 0); panel `1.9 × 0.99 × 1.9`. **Lõi**: `CapsuleGeometry(r0.2, length0.16, capSeg 8, radialSeg 24)` → cao 0.56, tâm y1.42 (1.14–1.70), vẫn material `ice`. **Quầng**: scale theo bao lõi `(0.4+0.6, 0.56+0.6) = 1.0 × 1.16`, pulse cùng lõi. **Đèn**: `PointLight('#22e5e0', 6, 0.94, 2)` — tầm dừng ở thành trong nên không chiếu lên kính, intensity 4.2→6 | Human chốt: "A capsule bo tròn", "width=0.01 là bề dày thành kính", "đèn distance 0.94 + tăng intensity" | `spool-core.test.ts` 11 test (thêm wall/capsule/light-range, bỏ rings/ticks, stack khe 0) → **43/43**; đo **18 draw / 20,400 tri**; capture `after-*` + `after-chamber-clear.png` + `after-exploded-cap-detail.png`; console errors none; reduced-motion A/B byte-identical | revert config/spool/test về P24 (rings/ticks, cầu r0.16, đèn 4.2/2.6) | DONE |

| P26 | `core-visual-config.ts` `platform`/`orbits`/`chamber.backdrop`/`budget`, `spool-core.ts`, `spool-core.test.ts` | orbits 4 vòng r1.96–2.20 tâm y1.45 cắt qua vành tower (mặt trong tower gần nhất chỉ r1.288 ở phương vị 346° — tower-15), platform r1.90 loe ra dưới chân tower với vòng ring ngoài r1.78, chamber không có mặt nào ghi độ sâu nên mọi lớp xếp theo `renderOrder` áp đặt (defect #5), budget 18 draw = đúng trần nên không còn chỗ | **Human chốt phương án C**: giữ nguyên 18 tower, nén core vào hành lang còn lại. `orbits` → tâm **y1.25**, `radii [1.20,1.26,1.32,1.38]`, `tube 0.011`, `flatten 0.88`, `tiltX [0.18,-0.24,0.28,-0.34]`, `yaw [1.31,1.48,1.66,1.83]` (họ 75–105° để trục ngắn quay vào phía tower-15/tower-02); toàn bộ cụm nằm dưới mép trên backdrop nên cả 4 vòng bị che **đều ~30%** (lệch 1.9 điểm). `platform` **1.90→1.55**, `ringRadii [0.45,0.82,1.19,1.46]` (bỏ vòng 1.78). **Backdrop**: `CylinderGeometry(r0.930, h0.966, 48, mở 2 đầu)` `MeshStandardMaterial` **không transparent / depthWrite true / BackSide**, name `spool-chamber-backdrop`, `raycast=()=>{}`, là mesh opaque **duy nhất** trong chamber → 1.002–1.968, tâm y1.485; suy ra từ `chamber.backdrop.radiusInset 0.010` (lệch 10 mm mặt trong kính 0.940, vẫn trong tầm đèn 0.94) và `heightInset 0.012` (hai đầu không đồng mức vành kính 0.99/1.98 vốn P25 khoá khe 0). `budget.drawCalls 18→19` | Kịch bản 1 (core đặc, không miễn nhiễm depth-test cho quỹ đạo) + C (không di chuyển tower) human chốt; 4 vòng cắt nhất quán là nghĩa vụ của kịch bản 1 | `spool-core.test.ts` **13 test** (thêm 2: backdrop opaque/BackSide/not-selectable + inset dẫn xuất) → **45/45**; `tsc --noEmit` sạch; đo **19 draw / 20,496 tri** (thêm 96 tri); `holographic-towers.test.ts` **không sửa** (C giữ tower). **Chưa capture** tại thời điểm làm (ảnh sẽ đổi vì core thành vật đặc) — đã chụp ở **P29**, xem deviation #8 | revert 3 file về P25 (orbits 1.96–2.20, platform 1.90, không backdrop, budget 18) | DONE |

| P27 | `.agents/dataset-3d-core/change-log.md` (chỉ tài liệu, §7.0 + §7.4) | §7.4 ghi: `shasum -a 256 -c baseline-v3.sha256` rồi "restore **3 file** từ git `39e66cf` — đã xác nhận 3 hash khớp đúng commit này" | **§7.4.1 mới**: bề mặt v4 là **7 file** (5 tracked đã sửa + 2 untracked), kèm bảng path/cách restore, bước 0 cứu 2 file spool trước mọi lệnh `git`/`git clean`, và vì sao restore thiếu `spool-core.ts` làm gãy build (`39e66cf` không export `SPOOL_CORE`). §7.0 thêm ghi chú: 3 hash là **vân tay lúc bắt đầu**, không phải bề mặt rollback. Diễn giải lại `baseline-v3.sha256`: 3 hash **khớp đúng** blob `39e66cf` (đã đối chiếu `git show ... | shasum`), nên `-c` trên cây hiện tại FAILED cả 3 dòng **là đúng** — đó là máy đo độ lệch của P21–P26, không phải máy kiểm chứng commit; sau rollback nó phải chuyển thành 3 dòng OK | Tài liệu rollback mà chạy theo thì **gãy build** và ** xoá mất nhân spool**; thông tin sai ở mục rollback còn hại hơn thiếu thông tin | Đã nghiệm thu từng lệnh: `git cat-file -e 39e66cf:src/frontend/<path>` → **OK cho cả 5 file tracked**, **MISS cho cả 2 file spool**; `git diff --stat 39e66cf -- <5 path tương đối từ src/frontend>` → đúng 5 file; `git show 39e66cf:…core-visual-config.ts | grep -c SPOOL_CORE` → `0`; `shasum -a 256 -c …baseline-v3.sha256` → 3 FAILED (đúng như mô tả mới). Không sửa code nên không cần vitest | Khôi phục đoạn §7.4 cũ (nội dung sai) | DONE |

| P28 | `core-visual-config.ts` `palette.wall`/`palette.nucleusHotLinear`/`nucleus.light`, `spool-core.ts` (backdrop material, `nucleusHot`, `nucleusLight`, `applyNucleus`), `spool-core.test.ts` | backdrop `MeshStandardMaterial` mượn `palette.metal` (`#05161c`, metalness **0.34**, roughness 0.62, emissive `glass` 0.3); lõi dùng **chung `ice`** với 4 vành rim; đèn `PointLight('#22e5e0', 6, chamberInner=0.94, 2)` **tĩnh**; `applyNucleus` chỉ scale capsule + sprite | **F6 + bước 4 + F3 gộp một batch.** `palette.wall` mới: `#1b4750` / metalness **0** / roughness 0.62 / emissive `#0b6a70` 0.3 (kim loại `metal` không đổi vì 2 mesh khác đang dùng). `nucleusHot = linearMaterial([0.5,2.6,2.3], 0.95)` cấp riêng cho `spool-nucleus`; `ice` vẫn dùng chung cho `spool-cap-lid-rims`/`-roof-rims`/`spool-base-rims`. `nucleus.light` vào config: `intensity 6→10`, `distance 0.94→1.2`, decay 2; `applyNucleus` thêm `nucleusLight.intensity = 10 * pulse` | P25 đặt cutoff **đúng bằng** bán kính tường (0.930) nên cửa sổ `(1-(d/cutoff)⁴)²` của three.js nuốt sạch ánh sáng: vũng sáng đo được **2.6e-5**, tức **~1.900 lần thấp hơn chính phát xạ của tường** — bằng 0 chứ không phải "yếu". Tường gần đen (`#05161c` → albedo linear 0.0116) cộng metalness 0.34 trong khi **không env map nào được install** (`createHolographicOrbitalDataCoreV2Environment` có tồn tại ở `generated-core.ts:1991` nhưng 0 call site) → metalness chỉ cắt diffuse. Lõi không có bậc sáng vì nó là **cùng một material instance** với vành | `spool-core.test.ts` **14 test** (thêm 1 test thang sáng + pool, sửa 2 test light/inset cũ) → **46/46**; toàn repo **372/372**; `tsc -b` 0 lỗi; eslint 0 lỗi. **19 draw / 20,496 tri không đổi** (tách material không thêm mesh). Số nghiệm thu: pool **0.1206** (gấp **4.600** lần so với trước), tự phát xạ tường 0.0486 → tương phản **2.48:1**, vẫn dưới ngưỡng bloom 1; lõi/vành **1.566×** (2.185 vs 1.395 mỗi pixel); **kính +217% là số LINEAR** — trên ảnh thật chỉ **+2.2%** (deviation #11, đã đo ở P29) | undo: backdrop về `palette.metal` + metalness 0.34; `nucleus` về `ice`; `nucleus.light` về `6 / 0.94` và bỏ dòng pulse | DONE (đã capture, xem P29) |

| P29 | `.agents/dataset-3d-core/captures/` (chỉ tài liệu kiểm chứng + harness mới, **0 dòng source sửa**) | Capture cuối cùng lấy sau P25; P26 và P28 đều ghi "chưa capture". `capture-core-v3.cjs` là harness duy nhất, kéo/zoom rồi chụp ngay | Chụp lại toàn bộ `after-*.png` ở trạng thái P28. Thêm **`capture-frozen.cjs`**: một context `reducedMotion: 'reduce'`, chờ 8 s, chụp `frozen.png` + `frozen-b.png` — frame **đóng băng**, vì harness chính hai lần chạy cho Δ tới **+227/255 trên từng pixel** chỉ do vị trí hạt khác nhau, nhấn chìm delta ánh sáng. Thêm **`measure-brightness-p28.py`** (dò đỉnh teal rồi quét scanline) và A/B một biến: tạm đặt `nucleus.light` về `6 / 0.94`, chụp, **restore bằng md5**, chụp lại | human yêu cầu đo mức sáng thật sau khi tôi báo "+217%" từ không gian linear mà không nói rõ đơn vị | A/B đông/frame: `frozen` vs `frozen-b` **0 px khác** ở cả hai trạng thái → pose thực sự đóng băng → delta duy nhất là ánh sáng. **0.33% số pixel toàn khung đổi, max Δ46.** Theo vùng: vũng sáng giữa buồng **+17.0%** (63.7→74.5), vỏ kính **+2.2%** (90.5→92.5), rim +1.0%, **tower/cap-top/background 0.0%** (đèn không lọt ra ngoài). `measure-core-v3.py`: thang sáng giờ **đơn điệu** — base 49.3 < tower 73.9 < core 95.6; `reducedMotionChangedPct 0.0`, `maxDiff 0`; `console errors: none`. Ảnh: `p28/` (P28), `ab-light-off/` (A/B), `pre-p28/` (mốc P25, **chưa từng commit** nên đã copy trước khi ghi đè) | xoá 3 file mới + `capture-core-v3.cjs` chạy lại; không có gì trong `src/` để revert | DONE |

| P30 | `.agents/dataset-3d-core/change-log.md` (viết lại deviation #12) + `.agents/dataset-3d-core/captures/measure-chamber-occlusion.mjs` (mới), **0 dòng source sửa** | #12 ghi F5 = "hai dải **12 mm** ở 2 vành kính không có surface ghi độ sâu", và ghi hướng (b) `openEnded:false` sẽ "bịt luôn tầm nhìn vào buồng" | Đo lại bằng **ray-test từ đúng camera hero** (`[11.45, 9, 11.45]` → `[0, 2.1, 0.5]`, trích từ `holographic-core.scene.tsx:29-30`), chỉ tính mặt mà `side` thực sự vẽ **và** ghi depth. Viết lại #12 theo số đo, kể cả việc tự sửa hai nhận định sai của chính tôi (hướng (b), và vai trò `spool-lower-band`) | F5 được assert từ hình học thuần (2 inset 12 mm) mà chưa từng ray-test; số đo cho thấy khung mô tả đó sai vị trí lỗ | Chạy `node .agents/dataset-3d-core/captures/measure-chamber-occlusion.mjs` tái lập từng chữ số: **71.2%** diện tích mặt kính nhìn thấy **không có gì chắn** (28.8% có), theo lát: **100%** từ y0.99→1.08, **9.2%** phẳng lì từ y1.878→1.98 ⇒ **dải hở TRÊN 12 mm có giá trị đúng 0.0 điểm %**, dải dưới thủng tuyệt đối nhưng **kéo dài ~88 mm chứ không 12 mm**; `spool-lower-band` tự chặn **0 tia**. Không sửa source nên không cần vitest; md5 `core-visual-config.ts` `bfbe8f0d…` và `spool-core.ts` `671c7f2c…` **không đổi** | xoá `.mjs` + khôi phục đoạn #12 cũ (nội dung sai) | DONE — **hướng sửa vẫn chờ human gate** |
| P31 | `.agents/dataset-3d-core/change-log.md` (§7.2 + #10) + 2 harness mới `captures/orbit-tower-clearance.measure.ts`, `captures/vitest.measure.config.ts`, **0 dòng source sửa** | §7.2 assert "Orbit trong cùng `1.96 − 0.007 = 1.953 > cap.outerRadius 1.17`, ngoài cùng `2.20 < 2.30` (mặt trong vành tower) — không cắt cap, không lọt vào tower" bằng **số của v3**: P26 đã dồn orbits từ `radii [1.96,2.04,2.12,2.2] / centerY 1.45` xuống `[1.20,1.26,1.32,1.38] / centerY 1.25`, nên cả hai vế dẫn chiếu một hình không còn tồn tại | Đo lại từ **scene graph thật**: dựng `createHolographicCoreProductModel()`, lấy `Box3` world của 18 tower (hộp trục-aligned nên khoảng cách điểm→hộp là **chính xác**, không xấp xỉ), mẫu 2.048 điểm/vành đúng pipeline `TorusGeometry(r,tube,4,128) → rotateX → scale(flatten) → Euler(tiltX,yaw) → translateY`, **đối chiếu bbox mesh thật (drift 0.0002)** để harness không tự nói dối khi `spool-core.ts` đổi. Viết lại §7.2, sửa `r1.288 → 1.2851` ở #10 | human chốt "Đo lại hình học orbit so với tower để sửa §7.2 trước"; trước đó chính tôi định điền số bằng phép tính bán kính — sai loại hình, vì torus nghiêng+dẹt không phải đường tròn trong nhìn-from-trên | `npx vitest run --config .agents/dataset-3d-core/captures/vitest.measure.config.ts` → **1/1 pass**, in toàn bộ bảng. Kết luận: **không cắt** (gap 3D nhỏ nhất mọi vành đều > 0, harness `expect(globalMin).toBeGreaterThan(0)`), nhưng cơ chế thoát là **chiều cao + phương vị**, không phải bán kính. md5 `core-visual-config.ts bfbe8f0d…` / `spool-core.ts 671c7f2c…` **không đổi**; `npx vitest run` vẫn **25 file / 372 pass** (harness nằm ngoài `include` của suite) | xoá 2 file harness + khôi phục 1 bullet §7.2 và 1 số ở #10 | DONE |
| P32 | `captures/orbit-tower-clearance.measure.ts` (thêm mục 5 + 3 helper), `change-log.md` (§7.2), **0 dòng source sửa** | P31 kết luận "**không cắt**" nhưng chỉ đo ở **một pose** (`rotation.y = 0`). Kế hoạch refactor mục S3 đánh dấu đúng chỗ này là `[Giả thuyết]`: "*orbit xoay trong khi tháp đứng yên… Test B có thể cho thấy orbit hiện đã chạm hoặc xuyên tháp ở một số góc xoay*". Human chốt D2 = đo | Thêm **worst-case theo góc xoay, chính xác không cần lấy mẫu**: xoay quanh trục Y không đổi bán kính và cao độ của một điểm ⇒ `min_gyaw min_point gap = min_point min_gyaw gap` (hai phép min giao hoán), và hộp quay quanh trục quét thành **vỏ trụ đặc** `[r0..r1] × [y0..y1]` nên khoảng cách tới nó tính bằng một phép clamp. `spool-core.ts` không đổi pipeline nên không cần chạy lại suite source; đối chiếu bằng **quét thô 512 góc** cho tower chốt | P31 để ngỏ câu hỏi quay; nếu chỉ dựa vào pose tĩnh thì "biên 0.0608" dễ bị đọc là "an toàn tuyệt đối" | Harness **1/1 pass**, in thêm 8 dòng. Kết luận: **có xuyên** — bead ring 4 **−0.0785**, ống kính **−0.0349** vào Box3 tower-15; 17 tower còn lại clear (min 0.1278); brute-force lệch **0.0006**; `expect(sweptMin.gap ≤ globalMin)` pass (worst-case quay luôn ≤ pose tĩnh, đúng như lý thuyết). `npx tsc --ignoreConfig --noEmit --strict` sạch. md5 `core-visual-config.ts bfbe8f0d…` / `spool-core.ts 671c7f2c…` **không đổi** | bỏ mục 5 + 3 helper trong harness, khôi phục 1 bullet §7.2 | DONE — **phát hiện có sẵn, không sửa (đổi hình ảnh)** |
| P33 | `captures/orbit-tower-clearance.measure.ts` (thêm mục 6 + 2 helper), `change-log.md` (§7.2), **0 dòng source sửa** | P32 để ngỏ: số −0.0785 đo theo **Box3**, mà tower là khối vát góc nên hộp có thể chứa **không gian rỗng** — nếu vậy "xuyên" chỉ là báo động giả của hộp bao | Đo lại với **bề mặt thật**: rút bài toán 3D về mặt kinh tuyến 2D `(r, y)` (xoay quanh Y giữ `(r,y)` và tới được mọi phương vị ⇒ 2 phép min đổi được cho nhau), raster tam giác thật của tower chốt, có nhân `instanceMatrix` cho `InstancedMesh` và bỏ `!visible`, rồi tra khoảng cách cho các điểm ứng viên | P32 tự ghi rõ caveat nhưng không có số; kết luận "xuyên" nếu dừng ở Box3 là chưa đủ bằng chứng | bead **ăn sâu 0.0550** vào khối kính đã vẽ (hộp phóng đại 0.0235), ống kính **chạm** bề mặt (346/2548 điểm), 1/4 bead ứng viên chạm; `expect(surface ≥ shell − 0.005)` pass; raster 86.461 ô @2 mm, 2.552/8.200 điểm vào shell hộp. Harness **1/1** (9.7 s), `tsc --ignoreConfig --strict` 0, `eslint` 0, `npx vitest run` vẫn **25 file / 372 pass**, md5 `spool-core 671c7f2c…` / `config bfbe8f0d…` / `model 66efa4d2…` **không đổi** | bỏ mục 6 + 2 helper, khôi phục đoạn caveat trong bullet P32 của §7.2 | DONE — **thật, không sửa**. Human chốt D7: **bỏ qua, xử lý sau** |

| P34 | **Mới**: `src/__tests__/dataset-3d/support/model-fingerprint.ts`, `src/__tests__/dataset-3d/model-fingerprint.test.ts`, `captures/model-fingerprint.measure.ts`, `captures/capture-p0.cjs`, `fingerprint/p0-baseline.ndjson`, `fingerprint/p0-images.sha256`, `fingerprint/p0-metrics.json`, `captures/p0-baseline/*.png` (16). **Sửa**: `captures/vitest.measure.config.ts` (testTimeout). **0 dòng source sửa** | Kế hoạch refactor chốt D1 = Phase 0→5 với gate "fingerprint diff = 0", nhưng fingerprint chưa từng tồn tại; ảnh baseline cũ stale từ v3; ba con số hiệu năng (139 draw tháp, 20.496 tri, budget 19) chưa từng đo trong trình duyệt | Executed Phase 0 items 0.1–0.4: máy dựng vân tay 5 moment (init có hash vertex, update-7.3, reset-motion, detached, selected-18) + test so sánh đọc baseline đã commit; harness Playwright chụp 5 trạng thái × 3 camera dưới `reducedMotion` (damping tắt nên pose camera tất định) và đo `renderer.info` + số lệnh GL thật. Chi tiết số ở **§7.6** | Không có lưới thì Phase 2→5 chỉ là lời hứa "không đổi hình ảnh"; và D7 vừa bỏ qua một va chạm thật, nên lưới càng cần | `npx vitest run` **26 file / 378 pass** (+1 file, +6 test, +13 s); 2 lần sinh baseline → **sha256 `a1c70e1e819a837d…` như nhau**; 2 lần capture → **cả 15 PNG byte-identical**; **mutation check**: sửa 1 `matrixWorld` + xoá 1 dòng baseline → **4 test đỏ** in đúng dòng lệch, khôi phục → xanh; `tsc -p tsconfig.app.json --noEmit` 0; eslint 0; `npm run build` OK (chứng minh `node:fs`/`node:path` typecheck trong `src`); md5 `model 66efa4d2…` / `spool 671c7f2c…` / `config bfbe8f0d…` **không đổi**, `git status src/graphics` **trống** | xoá 8 file/mục mới + khôi phục 1 dòng `vitest.measure.config.ts`; suite trở 25 file / 372 test | DONE — Phase 0 complete, số đo trong §7.6 |

| P35 | **Mới**: `src/__tests__/dataset-3d/support/orbit-clearance.ts`, `src/__tests__/dataset-3d/orbit-clearance.test.ts`, `fingerprint/p1-orbit-clearance.ndjson` (28 dòng: 1 header + 27 dòng đo). **Sửa**: `captures/orbit-tower-clearance.measure.ts` (dùng spec chung + ghi baseline). **0 dòng source sửa** | Ràng buộc tháp↔orbit chỉ tồn tại ở dạng comment trong `core-visual-config.ts`; P31–P33 đã **đo** nhưng số chỉ nằm trong báo cáo in ra console, **không có gate nào trong `npm test`** — nghĩa là một phase refactor vẫn có thể dịch tháp lại gần orbit mà không ai cấm | Executed Phase 1 (S3, đã rút gọn còn **Test B** theo D2): phép đo dời vào `support/orbit-clearance.ts` để máy sinh và test gọi **cùng một spec** (đúng quy tắc của fingerprint P34); baseline ghim 18 tháp + 6 mặt core + 3 dòng orbit, mọi float quantise 6 chữ số thập phân, **dung sai 0**. Chi tiết số ở **§7.7** | D1 duyệt Phase 0→5 với lời hứa “image-neutral”; D7 vừa bỏ qua một va chạm **thật**, nên lưới “không làm gần hơn” càng cần trước khi đụng tháp | Generator **1/1** (6,06 s), chạy **2 lần → sha256 `e58b98f33bb6a12e…` như nhau**, và **toàn bộ số trùng khớp báo cáo P32/P33** (tower-15 swept `-0.078476`, tube `-0.034928`, bead xuyên mặt vẽ `0.0550`, brute-force lệch `0.0006`) → tách code dùng chung không đổi phép đo. Test mới **4/4**. **Mutation check**: sửa 3 ô trong baseline (swept tower-04 1e-6, box tower-15 1e-6, gap chamber 1 mm) → test byte **đỏ** và in đúng 3 dòng lệch; đổi `KNOWN_PIERCE` sang `tower-04` → guard ngữ nghĩa **đỏ** với thông điệp “a second tower entered the orbit path” (chứng minh nó đọc hình học thật, không đọc lại baseline). Khôi phục → xanh, sha256 baseline **trở lại đúng giá trị cũ**. `tsc -b` 0 lỗi; `eslint` 0 lỗi; `npm run build` OK; md5 `model 66efa4d2…` / `spool 671c7f2c…` / `config bfbe8f0d…` **không đổi**, `git status src/graphics` **trống**. **Ngoài phạm vi**: suite có flake `Test timed out in 5000ms` có từ trước — human quyết step 2, đã sửa ở **P36 / §7.8** | Xoá 3 file/mục mới + `git checkout -- captures/orbit-tower-clearance.measure.ts`; suite trở 26 file / 378 test | DONE — Phase 1 complete |
| P36 | **Sửa**: `vitest.config.ts` (+4 dòng: `fileParallelism: false` + 3 dòng comment). **0 dòng source sửa** | `npm test` chết một test **luân phiên** với `Test timed out in 5000ms`; đỏ thật/giả không phân biệt được thì mọi gate fingerprint (P34) và clearance (P35) đều mất tác dụng | Step 2 do human chốt: **đo** 4 phương án trên cùng một máy thay vì đoán. Bảng số ở **§7.8**. Chọn chạy tuần tự giữa các file, **giữ nguyên `isolate` mặc định** để không mở đường leak state | Suite đã hỏng **từ trước** Phase 1 (bỏ file test mới ra, 3/3 lần vẫn đỏ); Phase 2→5 sẽ không thể nghiệm thu nếu phải nghi ngờ mọi lần đỏ | Baseline song song **5/1/6** lần timeout; `isolate: false` **6/7/4** (tệ hơn, đã revert, xác nhận file byte-identical HEAD); `maxThreads: 2` **1/1/3**; `fileParallelism: false` **0/0/0** — `npm test` ×4 xanh **27 file / 382 test** ở đúng timeout mặc định 5 s (181,18 / 159,97 / 194,79 / 174,75 s), cộng 2 lần CLI trước đó = **6/6 lần tuần tự liên tiếp sạch**. `tsc -b` 0; `eslint src`, `eslint .agents/dataset-3d-core`, `eslint vitest.config.ts` **0 lỗi cả ba** (riêng `npm run lint` = `eslint .` vẫn **12 lỗi có từ trước**, tất cả ở `.agents/holographic-core/**` scratch chưa commit, xem §7.8), `git diff --stat HEAD` = 1 file **+4 dòng**, `git status src/graphics` **trống**. Cái giá **+80 s**; `pool: 'vmThreads'` **chưa đo**, để ngỏ | `git checkout -- vitest.config.ts` | DONE — suite tất định, số đo ở §7.8 |
| P37 | **Mới**: `src/graphics/holographic-core/technical-lines.ts`. **Sửa**: `holographic-core.model.ts` (+1 dòng import, −60 dòng) | Phase 2 của kế hoạch kiến trúc: tháp sắp tách ra `tower-architecture.ts` / `tower-ring.ts` trong khi `addTechnicalRods` + `CYAN` nằm trong model → hoặc hai file import lẫn nhau (vòng) hoặc nhân bản code | Chuyển **nguyên văn** `CYAN`, `addTechnicalLine`, 5 biến tạm của rod và `addTechnicalRods` sang module mới, model import lại. Không đổi một dòng logic nào; `addPlanarGrid` / `addBaseWallGrid` / `addDeckRecess` ở lại vì chúng thuộc base, không thuộc tháp | §3.4 bắt buộc "không file `tower-*` nào import file Core"; lưới này phải dựng trước khi tách, nếu không Phase 4 không còn đường đi | **Bằng chứng trở thành chuyển code thuần tuý**: đối chiếu máy 57 dòng đã chuyển với bản cũ sau khi gỡ từ khoá `export` → **byte-identical**; diff của model đúng 1 dòng thêm + 60 dòng xoá, không dòng logic mới. Fingerprint **10/10** (5 moment, so từng byte với baseline đã commit), clearance **4/4**, `npm test` **27 file / 382 test** (215,75 s), `tsc -b` 0, `eslint` 0 trên cả hai file, `npm run build` OK. **Ảnh thật trong trình duyệt**: chạy lại harness rồi `shasum -a 256 -c p0-images.sha256` → **15/15 OK** | `git checkout -- src/graphics/holographic-core/holographic-core.model.ts` và xoá `technical-lines.ts` | DONE — Phase 2 complete, số đo ở **§7.9** |

### 7.2 Kiểm chứng v4 (2026-11-03, chạy từ `src/frontend`)
```bash
npx tsc -b                                             # 0 lỗi
npx eslint src/graphics/holographic-core src/__tests__/dataset-3d   # 0 lỗi
npx vitest run src/__tests__/dataset-3d                # 6 file, 46/46 pass (P28)
npx vitest run                                         # 25 file, 372/372 pass (P31 vẫn đúng)
npx vitest run --config .agents/dataset-3d-core/captures/vitest.measure.config.ts \
                                                       # P31: đo orbit↔tower/core, in bảng số, 1/1
NODE_PATH=/Users/mac/.npm/_npx/e41f203b7505f1fb/node_modules \
  node .agents/dataset-3d-core/captures/capture-core-v3.cjs
NODE_PATH=/Users/mac/.npm/_npx/e41f203b7505f1fb/node_modules \
  node .agents/dataset-3d-core/captures/capture-frozen.cjs \
  .agents/dataset-3d-core/captures/p28                 # P29: frame đóng băng, dùng cho A/B
python3 .agents/dataset-3d-core/captures/measure-core-v3.py
python3 .agents/dataset-3d-core/captures/make-comparison-sheet-v4.py
node .agents/dataset-3d-core/captures/measure-chamber-occlusion.mjs   # P30: 28.8% che / 71.2% hở
```

- Capture: `reduced-motion label: Chuyển động tự động đã tắt theo cài đặt thiết bị.`; `console errors: none`.
- `after-reduced-a.png` và `after-reduced-b.png` giống hệt từng byte (0.000% diff).
- Đo tĩnh từ unit test (không cần WebGL): **19 draw call**, **20,496 tam giác** — nằm trong budget
  `19 / 23,000`; budget từng là `14 / 18,000` ước tính, sau đó `18 / 22,080` (P16), `19 / 20,688`
  (P21), `19 / 22,224` (P22–P23), `20 / 22,224` (P24), `18 / 20,400` (P25 bỏ rings/ticks, đổi
  chamber shell + capsule), `19 / 20,496` (P26 thêm backdrop opaque duy nhất +96 tri). **P28 không đổi
  một mesh nào**: tách `nucleusHot` ra khỏi `ice` chỉ đổi material trên mesh đã tồn tại, nên vẫn
  `19 / 20,496` và `budget` không phải nâng (test đếm drawable, không đếm material).
- Capture P25: `after-chamber-clear.png` (orbit qua khe tower + zoom) và `after-exploded-cap-detail.png`
  xác nhận không còn vòng teal/vạch chia trong chamber; `after-attached.png` giữ silhouette 4 lớp.
  *(P31: chú thích "qua khe tower" là mô tả thao tác camera của harness, không phải claim hình học —
  orbit không đi qua khe nào, nó đi vào **phía trong** mặt trong tower-15, xem bullet orbit ở trên.)*
- Capture cap: `after-cap-detail.png` (zoom + nâng elevation) đọc rõ mặt trên phẳng y2.40 của lid +
  roof, khe hướng tâm 0.10, roof nón cụt 0.12, drum 1.98–2.28; `after-*.png` chụp lại toàn bộ sau P23.
- `nucleus.y = chamber.centerY = 1.42`; stack: platform 0.52 = base đáy 0.52; base đỉnh 0.90 =
  lower band đáy 0.90; lower band đỉnh 0.99 = chamber đáy 0.99; chamber đỉnh **1.98** = cap đáy;
  khe **0** (P25 nối dài thân kính, vách dày 0.01, capsule r0.2); drum 1.98–2.28; roof 2.282–2.40;
  lid 2.20–2.40; `topY 2.40`; cap cao **0.42**.
- Cap P23: lid vành 0.65–0.80 (rộng 0.15, cao 0.2, lỗ xuyên suốt 0.65), roof nón cụt cao 0.12
  (trên 0.90–1.05, dưới 1.02–1.17), drum thành 0.15 (1.02–1.17, h0.30) dâng lên 1.98–2.28; roof và
  lid cùng mặt trên 2.40, khe hướng tâm 0.10; lid hole 0.65 < drum inner 1.02 nên nhìn xuyên qua cap
  xuống chamber/nucleus; drum và roof cùng dải bán kính nên drum nằm dưới roof, không chồng hình học.
- **Orbits ↔ cap ↔ tower — đã đo lại từ scene graph (P31)**. Bản cũ của bullet này ("orbit trong cùng
  `1.96 − 0.007 = 1.953 > cap.outerRadius 1.17`, ngoài cùng `2.20 < 2.30` — không cắt cap, không lọt
  vào tower") là **số của v3** và đã bị P26 xoá sổ: orbits đi từ `radii [1.96…2.2] / centerY 1.45`
  xuống `[1.20…1.38] / centerY 1.25`. Số đo thật, dựng `createHolographicCoreProductModel()` và lấy
  `Box3` world của 18 tower (hộp trục-aligned ⇒ khoảng cách điểm→hộp là **chính xác**, không xấp xỉ):
  - Dải y orbit **0.783–1.717**, bbox XZ **x ±1.236 / z ±1.301** (đo trên `spool-orbit-tubes`; đám mây
    điểm tái dựng lệch bbox mesh thật **0.0002**, harness assert điều đó nên nó không tự nói dối được
    khi `spool-core.ts` đổi pipeline).
  - Cap không bị cắt **vì chiều cao, không phải vì bán kính**: `cap.bottomY 1.98 − orbit maxY 1.717 =`
    **0.263**. Mệnh đề cũ so `1.953 > 1.17` là so một đại lượng không còn ở tầm đó.
  - **"bán kính orbit" không tồn tại dưới dạng một con số**: `flatten 0.88` dẹt torus theo z *trước khi*
    `tiltX` nghiêng, nên reach phụ thuộc **đồng thời** phương vị và y. Reach lớn nhất toàn cụm (kể bead
    r 0.055) **1.3636**, nhỏ nhất **1.0450**; ring 4 max **1.3200** ở phương vị 64.6° / y 1.672.
  - Mép trong gần trục nhất: **tower-15 = 1.2851** (ô phương vị 336.78–353.73°), gần nhất *sau* nó là
    **tower-01-back-high = 1.4914**, tức mọi tower khác đều ≥ 1.49.
  - Ở tower-15, cơ chế không va chạm là **orbit luồn vào trong**, không phải vòng ra ngoài: trong ô
    phương vị của tower-15, ring 4 chỉ đạt reach **1.2258 < 1.2851** (hở hướng tâm 0.0593). 664 điểm
    của ring 4 vượt r 1.2851 nhưng rơi vào cung phương vị **31.6–278.2°** — vẫn có tower ở đó (t05 35°,
    t06 75°, t07 120°, t08 165°, t09 200°, t11 63°, t12 96.5°, t13 151.5°, t14 181.5°, t16 241.5°),
    nhưng mép trong của chúng **≥ 1.4914**, xa hơn reach toàn cụm 0.1278.
  - Khoảng cách 3D nhỏ nhất orbit↔tower, **cả 4 vành đều chốt ở tower-15**, **đo tại yaw `rotation.y = 0`**
    (= pose lúc `spool.reset()`, `spool-core.ts:618`): ring1 **0.2002**, ring2 **0.1603**, ring3
    **0.1143**, ring4 **0.0608**. bead không phải điểm chốt ở yaw này (bead gần nhất vẫn cách
    0.1779). ⇒ ở **một pose tĩnh** thì không cắt, nhưng biên ring 4 chỉ còn **6 cm** ≈ 3.9% bán kính
    platform, và tower-15 cao tới y 1.756 **phủ trọn** dải y orbit nên không còn đường tránh theo
    chiều đứng.
  - **P32 (sửa kết luận trên): quay thật thì CÓ cắt.** `orbitGroup.rotation.y = elapsedSeconds * 0.05`
    (`spool-core.ts:634`) nên mọi góc phương vị đều được đi qua theo thời gian. Quét toàn bộ góc (công
    thức chính xác, không lấy mẫu — xem ghi chú P32): **bead ring 4 xuyên hộp tower-15 sâu 0.0785**
    (tâm bead ở r 1.3086 / y 0.8519, trong khi vỏ quét của tower-15 là r 1.2851–1.7270 × y 0.4319–1.7560),
    và **thân ống kính cũng vào trong hộp 0.0349** (r 1.3200 / y 1.6717). Tổn hao so với pose tĩnh
    **0.1393**. 17 tower còn lại vẫn-clear cả khi quay (gần nhất tower-01-back-high **0.1278**, riêng
    ống kính 0.1714). Cross-check bằng quét thô 512 góc: −0.0778, **lệch công thức 0.0006**.
    **Caveat bắt buộc đọc kèm**: số đo trên tính theo **Box3 world của tower**, mà điểm chốt của tower-15 là
    **góc hộp** ở phía trục — tower là khối *bevel* (vát góc) và Box3 gộp cả corner-post/roof-rod/window
    — nên 0.0349/0.0785 là **cận trên** của phần chồng lấn với tam giác thật.
  - **P33: đã đo tiếp bằng bề mặt thật ⇒ chồng lấn LÀ THẬT**, không phải vùng góc vát trống. Phép đo
    3D rút về 2D: xoay quanh trục Y giữ nguyên `(r, y)` và cho một điểm đi tới **mọi phương vị**, nên
    `min_the_góc khỏang(c_θ, bề_mặt) = khỏang_mặt_kinh_tuyến((r,y)_điểm, ảnh_chiếu_của_bề_mặt)` — đúng,
    không xấp xỉ. Raster hoá tam giác thật của tower-15 (kể `InstancedMesh`, bỏ `!visible`) xuống lưới
    (r,y) **2 mm**, mẫu bề mặt bước ~4 mm, 86.461 ô ứng viên. Kết quả trên chính ô chốt:
    **bead ăn sâu 0.0550 vào khối kính đã vẽ của tower-15** (Box3 nói 0.0785 → hộp **phóng đại 0.0235**,
    đúng như lo ngại về vát góc), và **ống kính cũng chạm bề mặt** (346/2548 điểm ống nằm trong ảnh chiếu
    của khối kính). `cell drawn by "Inner projection field tower 15"` **không** phải một mesh lạ: đó là
    `mesh.name` của chính thể tích kính tower-15 (`holographic-core.model.ts:647-648` đặt node và mesh
    cùng mang tên hiển thị). **Giới hạn của phép đo**: một điểm bán kính 0 trong ảnh chiếu chỉ cho ra `0`
    nên với ống kính chỉ kết luận được "chùng trùng bề mặt ở một góc yaw", không đo được **độ sâu**; chỉ
    vật thể có bán kính (bead) mới có số sâu. **Không sửa, gate human**: còn nhìn thấy được hay không là
    câu hỏi **capture tại đúng góc yaw chốt** (tower-15 ở phương vị 346°, camera hero ở 45° → core nằm
    giữa camera và tower, một phần quỹ đạo có thể bị che), `capture-frozen.cjs` hiện chỉ chụp ở yaw 0.
    **Human chốt 04/11: bỏ qua, xử lý sau** — không vào kế hoạch refactor image-neutral, không đo thêm
    trong đợt này; giữ nguyên P32/P33 như hồ sơ hiện trường.
  - Orbit cũng không cắt thân core: cách mặt kính chamber (r 0.95) **0.0950**, backdrop (r 0.93)
    **0.1150**, lower band (r 1.02) **0.1141**, base glass (r 1.06) **0.1465**, platform (r 1.55)
    **0.3554**.
  - **Chưa sửa, gate human**: comment đầu `core-visual-config.ts:264-271` là lý thiết kế của chính
    orbits, và nó có hai chỗ **đọc ra sai** so với số đo: (a) "the ring is **nine** axis-aligned boxes"
    — vành tower là **18** hộp (9 gốc + 9 vành ngoài, và tower-15 thuộc 9 hộp *ngoài*); (b) "*so its
    minor axis must clear 1.288 while its major axis clears ~1.50*" — "clear" ở đây phải hiểu là
    **ở trong** chứ không phải **vượt lên trên**: trục ngắn đo được 1.045–1.197 **nhỏ hơn** 1.2851, và
    đó chính là cơ chế thoát (P26 ghi đúng ý này: "*yaw vào họ 75–105° để trục ngắn quay vào phía
    tower-15*"). Điều kiện không cắt viết lại cho gọn: **reach trong ô phương vị tower-15 < 1.2851**
    *và* **reach toàn cụm < 1.4914**. Số `1.288` là 1.2851 (lệch 3 mm, kết luận không đổi). Đó là source
    nên tôi không tự đổi.

### 7.3 Deviations v4 (đã ghi nhận, không sửa thêm)

1. **Kích thước bị vành tower giới hạn**: ảnh tham chiếu có platform/orbit rộng ~2.6× bán kính
   thân; scene có 18 tower ở r2.6–2.74 nên platform đặt r1.9 và orbit r1.96–2.20. Đây là lựa chọn
   "giữ khung hiện tại" của human; silhouette 4 lớp vẫn đọc được nhưng không phóng to như ảnh.
2. **Reflection giả**: dùng `CircleGeometry` + `DataTexture` radial, không dùng `Reflector` (tránh
   thêm render pass). Không phản chiếu chính xác tower/module.
3. **Cap chia 3 phần theo mô tả human, không theo ảnh gốc**: nắp vành 0.65–0.80 × 0.2 (lỗ 0.65),
   roof nón cụt đối xứng 0.12 cao (0.90–1.05 trên), drum 1.02–1.17 × 0.30 dâng lên 1.98–2.28; roof
   và lid cùng mặt trên y2.40, khe hướng tâm 0.10 giữa lid và roof (human sẽ thiết kế lại). Vì drum
   và roof cùng dải bán kính, drum nằm dưới roof (2.28) thay vì chồng cùng khoảng 2.28–2.40. Vật
   liệu lid/roof đổi chỗ. (Khe 0.13 giữa chamber 1.85 và drum 1.98 của P23 đã được P25 đóng lại:
   chamber 0.99–1.98, khe 0.)
4. **Không dùng `transmission`** cho kính: giữ MeshPhysicalMaterial opacity thấp + additive layer
   như quy ước neon-cube; hình khối đọc được nhưng không khúc xạ thật.
5. **Constellation nucleus bands ẩn ở v4** (`nucleusBands:false`): chamber đã có vỏ kính riêng +
   capsule lõi (P25 bỏ 3 vòng teal và vạch chia); lane issue vẫn giữ và bắt đầu từ mặt chamber thay
   vì equator cũ.
6. **Amber sparks chỉ trang trí** (14 hạt quanh x1.48/y1.5/z−0.78); 3 lane amber issue → Detection
   vẫn là ngữ nghĩa chính, không đổi.
7. **Core cũ ẩn, không xoá**: `core-upper/lower/cap/collar/foot/orbit-violet` + đèn v3 vẫn còn trong
   code để rollback tức thời bằng `CORE_VISUAL_REVISION`.
8. **Hero view: chiều che đã đảo chiều (kịch bản 1, P26)**. Backdrop opaque ghi độ sâu thật nên core
   che tower phía sau thay vì các lớp xuyên thấu lẫn nhau như v3; 4 vòng quỹ đạo bị chính tường đó
   cắt ~30% cung (31.5/30.7/30.0/29.6, **đo hình học**). P29 đã chụp ảnh: `after-attached.png` và
   `after-closeup.png` xác nhận **chiều che** (các vòng nằm trước tường tối, tower sau lưng bị che
   thật), còn **con số ~30% thì chưa đo lại trên ảnh** — ảnh không đủ tương phản để vạch cung nào bị
   tường ăn mất bao nhiêu độ dài. close-up và exploded thể hiện rõ spool; **hero thì không** (xem #3,
   #10: core vẫn nhỏ hơn vành tower và bị tower sáng xanh che mất tầm nhìn). **Mở rộng (P30): "core
   che tower" chỉ đúng trên 28.8% diện tích mặt kính — 71.2% còn lại vẫn xuyên thấu như v3, xem #12.**
9. **Số đo hiệu năng lấy từ unit test** (đếm geometry/drawable), không phải `renderer.info` runtime;
   chưa hook đo FPS.
10. **Hành lang quỹ đạo phương án C hẹp hơn ghi trong plan**: plan người dùng viết "towers start
    r≈2.30, orbits ≤1.68", nhưng vành tower là 9 hộp trục-aligned chứ không phải đường tròn — mép
    trong gần trục nhất là **r1.288** (tower-15, phương vị 346°), kế đó t02/t06/t08 ~1.50. Vì vòng
    kín quét mọi phương vị nên `radii [1.5,1.65,1.8,1.95]` không dùng được; C nén thành
    [1.20,1.26,1.32,1.38] và ép `yaw` vào họ 75–105°. Hệ quả: core **nhỏ hơn về cỡ** so với tower
    (defect #3), chỉ cứu được bằng độ sáng → backdrop/`nucleusHot`/phân tầng sáng thành bắt buộc.
    **Đo lại (P31)**: vành tower là **18** hộp chứ không 9; mép trong tower-15 là **1.2851** (không phải
    1.288, lệch 3 mm), hộp gần nhất *sau* tower-15 là tower-01-back-high **1.4914**. Hành lang hẹp hơn
    nữa so với chính mô tả này: reach 3D nhỏ nhất orbit↔tower-15 là **0.0608 ở ring 4** (0.2002 /
    0.1603 / 0.1143 / 0.0608 cho ring 1–4), tức `radii` không còn chỗ nở ra hướng đó, và tower-15 cao
    tới y 1.756 nên phủ trọn dải y 0.783–1.717 của orbits — không có cửa tránh theo chiều đứng. Cơ chế
    không cắt là **trục ngắn luồn vào trong tower-15 theo phương vị**, không phải "orbit nhỏ hơn vành".
11. **Vỏ kính sáng nhiều hơn mức human đã duyệt khi đổi lấy vũng sáng (P28)**: báo cáo trước khi làm
    ghi "+86%", số thật là **+217%** (0.0356 → 0.1130 mỗi pixel, chưa tính `opacity 0.42`). Lý do
    phải chấp nhận: tường backdrop ở **r 0.930, nằm TRONG vỏ kính r 0.95**, nên không giá trị
    `distance` nào chiếu được tường mà không xuyên qua kính trước — hai yêu cầu "đèn không chạm kính"
    (P25) và "có vũng sáng" loại trừ nhau về mặt hình học, không phải do chọn tham số.
    **Đã đo trên capture và con số +217% là sai về đơn vị, không sai về bản chất.** +217% là **không
    gian linear** (0.0356 → 0.1130 tiền tố cộng dồn của riêng lớp kính). Trên ảnh thật, sau ACES tone
    mapping + sRGB encode + `opacity 0.42` blend, A/B đông/frame cho thấy: **vỏ kính chỉ sáng thêm
    +2.2%** (90.5 → 92.5), vùng vũng sáng giữa buồng **+17.0%** (63.7 → 74.5), vành rim +1.0%, và
    `tower trái`/`tower phải`/`mặt cap trên`/`background` đổi **0.0%** — đèn nằm trong tầm là đúng.
    Toàn khung chỉ **0.33% số pixel** đổi, max Δ46/255. Kết luận: cái giá human duyệt nhỏ hơn nhiều
    so với chính con số tôi báo; **không cần núm vặn nào cả**, ba lựa chọn `glass.opacity`/
    `glass.emissiveIntensity`/`light.intensity` ở trên **không dùng tới**. Bài học rút ra: số linear
    không được báo như số hiển thị — xem lại cách trình bày ở P28 row.
12. **F5 — đã ray-test: lỗ không nằm ở 2 dải 12 mm, nó nằm ở GIỮA khung nhìn (P30, chưa sửa code)**.
    Bản cũ của deviation này assert F5 từ hình học ("kính 0.99–1.98, tường 1.002–1.968 ⇒ hai dải hở
    12 mm") và **không chạy ray-test**. Đo lại bằng `captures/measure-chamber-occlusion.mjs` (camera
    hero thật `[11.45, 9, 11.45]` → `[0, 2.1, 0.5]`, chỉ tính mặt **được `side` vẽ** *và* **ghi depth**):

    | toàn bộ mặt kính nhìn thấy được | % |
    |---|---|
    | có surface chắn (`spool-chamber-backdrop`, mặt xa) | **28.8%** |
    | **không có gì chắn** — object sau lọt qua | **71.2%** |

    Chia lát 6 mm (số % ở đây là % **xuyên thấu**, tức % pixel không có gì chắn):

    ```
    y 0.990 → 1.080   100.0%   <- dải hở DƯỚI: thủng tuyệt đối, và kéo dài ~88 mm chứ không 12 mm
    y 1.500            71.1%
    y 1.800            36.4%
    y 1.878 → 1.980     9.2%   <- dải hở TRÊN: 9.2%, GIỐNG HẰNG mọi lát ngay dưới nó
    ```

    **Nguyên nhân, và là lý do bản cũ sai vị trí:** camera ở y9 nhìn xuống y2.1 nên **mọi** tia nhìn đi
    chếch xuống. Tia chui qua khe trên tiếp tục xuống và vẫn đập vào mặt *xa* của tường ⇒ vẫn bị che.
    Tia vào thân buồng hoặc khe dưới rơi *dưới* mép 1.002 ⇒ thoát thẳng xuống nền. Nên % che **tăng dần
    từ dưới lên trên**, ngược hẳn suy luận "thiếu 12 mm ở đầu = hở 12 mm ở đầu". Hai hệ quả: (i)
    `heightInset 0.012` **phía trên đang trả giá (rủi ro mép đồng mức vành kính mà P25 khoá) để đổi lấy
    đúng 0.0 điểm %**; (ii) vùng hở nặng nhất là **tia dài nhất, tức đúng giữa silhouette — chỗ lõi
    sáng**, không phải viền.
    **`spool-lower-band` không cứu được gì: đo ra 0 tia tự chặn** — nó là `MeshStandardMaterial` mặc
    định `FrontSide`, mà tia từ trong buồng đi ra đập vào **mặt sau** của nó ⇒ bị cull. Đây là điều tôi
    đoán sai trước khi đo, nên không ai được dựa vào dải đó như một mặt chắn.

    Ba hướng sửa, đánh giá lại theo số đo:
    - **(a) kéo tường cao bằng kính — loại.** Phía trên vô ích (0.0 điểm %); phía dưới chỉ vá được lớp
      0.99→1.002 trong khi vùng thủng tuyệt đối tới ~1.086 và thủng một phần tới tận 1.878; muốn bịt
      hết thì tường phải xuống ~y0.5, tức ló ra khỏi buồng. Cộng `spool-core.test.ts:82-83` chặn mép
      tường đồng mức vành kính P25 đã ghim.
    - **(b) đậy nắp bằng `openEnded: false` — rẻ nhất theo số đo, và bản cũ đánh giá sai một nửa.**
      Bản cũ ghi "nắp BackSide sẽ bịt luôn tầm nhìn vào buồng từ elevation camera hero". **Sai**: nắp
      DƯỚI có pháp tuyến −y, nhìn từ trên xuống là *mặt sau* ⇒ BackSide **vẽ** ⇒ chặn đúng vùng thủng
      (mọi tia chúc xuống đều đập vào sàn này); nắp TRÊN pháp tuyến +y, nhìn từ trên xuống là *mặt
      trước* ⇒ BackSide **cull** ⇒ vẫn nhìn thấu xuống lõi. Giá: **0 draw call** (không thêm mesh),
      **+96 tam giác** (20,496 → 20,592, vẫn dưới 23,000), test hiện hành không chặn (dòng 190/192 chỉ
      đo bounding box). **Cái giá thật, và là thứ thuộc human**: buồng thành hộp **có sàn đặc ở y1.002**
      — nó cắt mất phần `spool-base-glass` nằm sau nó theo đường nhìn (phần overlap r0.93), và vũng
      sáng P28 sẽ đổ thêm lên mặt sàn. Đây là **đổi thiết kế** (buồng kính → bình có đáy), không phải
      sửa bug.
    - **(c) thêm 2 vành annular ở 2 đầu — loại.** 1–2 draw call chỉ để vá 24 mm, mà 12 mm trên đo ra vô
      hại và 12 mm dưới chỉ là ngọn của lỗ.

    **Giới hạn của chính phép đo:** đây là **toán tia, chưa phải pixel render**. Vùng "thủng" vẫn nhận
    màu từ `glass` (opacity 0.42), `spool-base-glass`, platform và nucleus sprite — tất cả additive
    `depthWrite:false` — nên nó không nhất thiết tối trên ảnh; số 71.2% là *diện tích không có occlusion
    thật*, không phải *diện tích tối*. Nếu human chọn (b), nghiệm thu bằng A/B một cờ với
    `capture-frozen.cjs` (frame đã chứng minh 0 px nhiễu, P29) rồi đo lại bằng chính script này.
    **Trạng thái: chưa đổi một dòng source nào.** `core-visual-config.ts` md5 `bfbe8f0d…`,
    `spool-core.ts` md5 `671c7f2c…` — nguyên P28.

### 7.4 Ma trận rollback

| Từ | Về | Cách | Kết quả |
|---|---|---|---|
| P26 | P25 | **Không dùng được đường git**: `spool-core.ts` + `spool-core.test.ts` là file **untracked** (`??`), chưa từng có trong commit nào, nên `git diff`/`git checkout` không restore được và một lệnh `git clean -fd` sẽ xoá sạch nhân spool. Restore tay 3 chỗ: `SPOOL_CORE.platform` `1.55→1.90` + `ringRadii [0.55,1.0,1.45,1.78]`, `SPOOL_CORE.orbits` về `centerY1.45 / radii[1.96,2.04,2.12,2.2] / tube0.007 / flatten0.78 / tiltX[0.38,-0.62,0.86,-1.02] / yaw[0.4,1.3,2.2,3.05]`, xoá khối `spool-chamber-backdrop` (`spool-core.ts:292-314`) + `chamber.backdrop` + `budget.drawCalls 19→18` + 2 test backdrop | Hết mesh ghi độ sâu, các lớp quay về xếp theo `renderOrder` |
| v4-spool | v3-constellation | `CORE_VISUAL_REVISION='v3-constellation'` | Spool không được tạo; core cũ + constellation bands hiện lại; giữ nguyên file v4 |
| v3-constellation | v2-tier | `CORE_VISUAL_REVISION='v2-tier'` | Material core cũ + không constellation |
| v4-spool | mã v3 nguyên bản | xem **7.4.1** bên dưới — không phải một lệnh; 3 bước, bước 0 là bắt buộc | Quay lại đúng cây nguồn trước v4, **không mất** 2 file spool |

### 7.4.1 Rollback về cây nguồn trước v4 (`39e66cf`)

**Bề mặt v4 là 7 file**, không phải 3. Bảng dưới là toàn bộ đường biên của rollback; `git diff --stat 39e66cf`
xác nhận 5 file tracked, `git status --porcelain -- src` xác nhận 2 file untracked. Đã nghiệm thu bằng
`git cat-file -e 39e66cf:src/frontend/<path>`: **5 file trên có blob ở commit đó** (restore được), **2 file spool
trả về MISS** (không restore được — chúng không tồn tại ở bất kỳ commit nào, kể cả `39e66cf`).

| # | File | Trạng thái git | Cách restore |
|---|---|---|---|
| 1 | `src/graphics/holographic-core/core-visual-config.ts` | tracked, đã sửa | `git restore --source=39e66cf` |
| 2 | `src/graphics/holographic-core/holographic-core.model.ts` | tracked, đã sửa | `git restore --source=39e66cf` |
| 3 | `src/graphics/holographic-core/issue-constellation.ts` | tracked, đã sửa | `git restore --source=39e66cf` |
| 4 | `src/graphics/holographic-core/holographic-core.scene.tsx` | tracked, đã sửa | `git restore --source=39e66cf` |
| 5 | `src/__tests__/dataset-3d/issue-constellation.test.ts` | tracked, đã sửa | `git restore --source=39e66cf` |
| 6 | `src/graphics/holographic-core/spool-core.ts` | **untracked** — không có trong commit nào | copy tay, hoặc xoá |
| 7 | `src/__tests__/dataset-3d/spool-core.test.ts` | **untracked** — không có trong commit nào | copy tay, hoặc xoá |

**Cùng chung hazard nhưng không thuộc bề mặt source**: các harness đo dưới `.agents/dataset-3d-core/captures/`
cũng untracked (`measure-chamber-occlusion.mjs` P30, `orbit-tower-clearance.measure.ts` +
`vitest.measure.config.ts` P31, `capture-frozen.cjs` + `measure-brightness-p28.py` P29). `git clean -fd` xoá
sạch chúng, và khi đó **mọi chữ số trong §7.2/#10/#12 không còn cách nào tái lập** ngoài đọc lại ảnh. Nếu
rollback, cứu cả nhóm này cùng lúc với 2 file spool.

**Bước 0 — cứu 2 file untracked (bắt buộc, làm trước mọi lệnh git).** `git log --all -- src/frontend/src/graphics/holographic-core/spool-core.ts`
trả về rỗng: file chưa từng được commit trên nhánh nào, nên `git restore`/`git checkout` **không** restore được và
một lệnh `git clean -fd` sẽ xoá sạch nhân spool. Chọn một trong hai:

```bash
# (a) copy ra ngoài, rollback, rồi copy trả nếu muốn giữ để thử lại
mkdir -p /tmp/spool-keep && cp src/graphics/holographic-core/spool-core.ts \
  src/__tests__/dataset-3d/spool-core.test.ts /tmp/spool-keep/

# (b) tốt hơn: commit 2 file untracked trước khi rollback, để git lo phần còn lại
git add src/graphics/holographic-core/spool-core.ts src/__tests__/dataset-3d/spool-core.test.ts
```

**Bước 1 — restore đủ 5 file tracked** (chạy từ `src/frontend`; path tương đối git tự quy về repo root):

```bash
git restore --source=39e66cf -- \
  src/graphics/holographic-core/core-visual-config.ts \
  src/graphics/holographic-core/holographic-core.model.ts \
  src/graphics/holographic-core/issue-constellation.ts \
  src/graphics/holographic-core/holographic-core.scene.tsx \
  src/__tests__/dataset-3d/issue-constellation.test.ts
```

**Bước 2 — xử lý 2 file spool rồi nghiệm thu.** `core-visual-config.ts` ở `39e66cf` **không export `SPOOL_CORE`**
(`git show 39e66cf:...core-visual-config.ts | grep -c SPOOL_CORE` → `0`), nên nếu để `spool-core.ts` nằm lại thì
`import { SPOOL_CORE }` của nó và của `spool-core.test.ts` không còn đích → **build gãy**. Hoặc xoá 2 file đó,
hoặc giữ bản copy ở `/tmp` nhưng không đặt trong `src/`. Sau đó: `yarn tsc -b && yarn vitest run src/__tests__/dataset-3d`.

**Về `baseline-v3.sha256` — sửa lại cách dùng (P26/F1).** File này **đúng**: 3 hash trong nó khớp *chính xác* các
blob của `39e66cf` (đã đối chiếu lại bằng `git show 39e66cf:<path> | shasum -a 256`). Sai ở chỗ bảng cũ mô tả
`shasum -a 256 -c baseline-v3.sha256` như một bước "xác nhận trước khi rollback" — chạy trên cây nguồn hiện tại thì
**cả 3 dòng FAILED là hợp lý**, vì P21–P26 đã sửa đúng 3 file đó. Nó là máy đo **độ lệch** so với baseline, không phải
máy kiểm chứng commit. Dùng đúng hai vai trò:

```bash
# (1) baseline còn khớp commit không? — mọi lệnh ở đây chạy từ `src/frontend`; path sau `:` là so với repo root
for p in core-visual-config holographic-core.model issue-constellation; do
  git show 39e66cf:src/frontend/src/graphics/holographic-core/$p.ts | shasum -a 256; done
# kỳ vọng: 3 hash in ra đúng bằng 3 hash đã ghi trong baseline-v3.sha256

# (2) cây nguồn hiện tại đã lệch baseline bao nhiêu? — FAILED là tín hiệu "đang ở v4", không phải hỏng
shasum -a 256 -c .agents/dataset-3d-core/reference-v4-spool/baseline-v3.sha256
```

Sau khi rollback xong, lệnh (2) phải chuyển thành **3 dòng OK**; đó là nghiệm thu của bước 1.

Gate img2threejs: **không đóng** (không chạy `forge/state.py mark`).

### 7.5 Duyệt kế hoạch refactor Tower (2026-11-04)

Nguồn quyết định: `~/Documents/JS-TS-AI/CODE ARCHITECTURE IMPROVEMENT PLAN.md` (562 dòng, chỉ phân tích,
**0 dòng source sửa**). Human duyệt từng câu hỏi, chốt như sau:

| # | Câu hỏi trong plan | Quyết định của human | Hệ quả với code |
|---|---|---|---|
| D1 | Phạm vi | **Phase 0 → 5 (Necessary)** | Phase 6/7 không làm đợt này |
| D2 | Đo nốt góc xoay orbit trước Phase 1? | **Có** | Đã đo ở **P32**: quay thật thì bead ring 4 **xuyên** hộp tower-15 0.0785 — ghi nhận, **không sửa** (sửa là đổi hình ảnh) |
| D3 | Phase 1 rút còn Test B? | **Có** | Test A đã tồn tại (`holographic-towers.test.ts:172-188`, ngưỡng 3.07/2.15/0.96), baseline tower-15 **1.2851** / khe pose tĩnh **0.0608** / worst khi quay **−0.0785** đã có trong harness P31+P32 → Phase 1 **không đo trùng Test A** |
| D4 | S6 phần Spool (chạm `spool-core.ts`)? | Cắt theo khuyến nghị, **chỉ làm risers** (`tower-ring.ts`) | Bất biến "không file Core nào bị sửa" giữ được tuyệt đối. (Mục này vốn thuộc Phase 6 = Optional, đã bị D1 cắt, nên không còn việc.) |
| D5 | Commit baseline trước Phase 0? | **Có** | `ca93b56 feat(dataset-3d): commit v4 spool baseline before tower refactor` — 65 file, gồm `spool-core.ts` + test của nó (trước đó **untracked**, `git clean -fd` là mất). Nghiệm thu trước commit: `npx vitest run` **25 file / 372 pass**, harness khoảng trống **1/1**. Không đưa vào commit: `.agents/skills/dac-ta-prompt-test/*`, `.agents/holographic-core/**`, `.agents/neon-cube/**`, `.qoder/`, `vibe_images/` (việc khác) |
| D6 | P10 / `React.StrictMode` | **Để Phase 0 quan sát, chưa sửa** | Đã xác minh `[Code]`: StrictMode **BẬT** ở cả hai nhánh (`src/app/main.tsx:19` preview, `:25` application), và `scene.tsx:76` `useEffect(() => () => productModel.dispose(), [productModel])` gọi `constellation.dispose()` → `root.clear()` (`issue-constellation.ts:409-411`) — cơ chế phá là thật. Phép quan sát cần chốt ở Phase 0: sau mount trong dev, model còn bao nhiêu con / có còn đường cam + hạt không. Ảnh capture từ `localhost:5173` (dev, tức có StrictMode) **vẫn thấy** hạt → chưa kết luận được, cần đếm chứ không suy luận |
| D7 | P32/P33: orbit quay xuyên tower-15 0.0550 — xử lý thế nào? | **Bỏ qua, xử lý sau** (human 04/11) | Không phải việc của refactor image-neutral; mọi hướng sửa đều đổi hình ảnh. Kéo theo: Phase 0 **không** cần chụp ở góc yaw chốt, giữ capture bộ hiện tại |

Bốn ràng buộc tôi tự ghi để không tự ý nới khi thực thi: (1) fingerprint **diff = 0** là gate của mọi phase,
lệch là dừng và revert riêng phase đó; (2) **Phase 5** — "lệch dù chỉ một vật liệu: **không** xoá
`TOWER_OPACITY`, dừng và điều tra"; (3) **thứ tự mảng tháp là dữ liệu** (seed hạt riser = chỉ số mảng, hiệu
chỉnh audit mục 0.4 #8) nên Phase 3 phải so thứ tự với baseline; (4) `SPOOL_CORE.budget.drawCalls = 19` đang
** đúng trần** (18 mảnh + slot 19 đã chi cho backdrop, xem comment `core-visual-config.ts:353-355`) — refactor
không thêm mảnh nào vào Core, nên không được phép chạm số đó; muốn chạm là quyết định của human.

Câu hỏi V2/V3 của plan đã có đáp án nên không cần hỏi lại: test runner là **Vitest 5.0.5** (`package.json`
`"test": "vitest run"`), và **dựng model headless trong jsdom chạy được** (chính harness P31/P32 +
`holographic-towers.test.ts` đã làm từ trước). Còn mở: **V4** (`holographic-part.types.ts` ở
`src/types/dataset-3d/`, `neon-cube.*` ở `src/graphics/neon-cube/` — chưa đọc, cần trước Phase 5).

### 7.6 Phase 0 — lưới an toàn và số đo thật (2026-11-04, **0 dòng source sửa**)

Phạm vi D1 = Phase 0→5, gate của mọi phase là "fingerprint diff = 0". Phase 0 dựng lưới đó và đo
ba con số hiệu năng mà kế hoạch tự đánh dấu là chưa đo.

**7.6.1 Vân tay scene graph (item 0.3)**

`src/__tests__/dataset-3d/support/model-fingerprint.ts` là spec dùng chung cho cả máy sinh
(`.agents/dataset-3d-core/captures/model-fingerprint.measure.ts`) lẫn test so sánh
(`src/__tests__/dataset-3d/model-fingerprint.test.ts`) — baseline không thể được xác nhận bởi một
spec khác với spec kiểm tra nó. Mỗi dòng ghi: đường dẫn chỉ số con, tên, loại, `visible`,
`renderOrder`, `matrixWorld` (6 chữ số thập phân), geometry (loại + tên attribute + `n` + hash
position/index/normal ở moment `init`), `instanceMatrix`/`instanceColor`, chữ ký vật liệu theo
**object identity**, hash `raycast.toString()`, và kết quả `resolvePart`.

| moment | dòng | nội dung |
|---|---|---|
| `init` | 1539 | full vertex hash cho mọi mesh |
| `update-7.3` | 1154 | sau `update(7.3, 0.016)` |
| `reset-motion` | 769 | sau `update(...)` rồi `resetMotion()` |
| `detached` | 384 | sau `setDetached(true); snapDetach()` |
| `selected-18` | 19 | mỗi tháp 1 dòng `sel[...] visible=1 verts=112 hash=<riêng> afterClear=0` |

`fingerprint/p0-baseline.ndjson` = 320.404 byte, sha256
`a1c70e1e819a837d1e89b98df6878b74e3df6573ddea8cf113ab1883f38ee203`. Hai lần sinh liên tiếp cho **cùng
một hash**. Dòng header vật liệu, nguyên văn:
`materials total=196 shared=g9x2,g11x4,g12x24,g14x2,g16x2,g18x3,g19x3,g46x18,g47x18,g48x18,g49x18,g51x18,g94x8,g95x8,g96x8,g97x8,g164x8`
— **đúng 5 vật liệu tháp `g46/g47/g48/g49/g51` mỗi cái dùng chung cho 18 mesh**, nghĩa là giả định
"xoá `TOWER_OPACITY` mà không tạo 18 bản clone `tone.glass`" của Phase 5 là **có bằng chứng**, không
còn là suy đoán; `budget.drawCalls` không bị đụng tới.

Lưới có cắn không: mutation test (sửa 1 `matrixWorld` trong baseline, xoá 1 dòng ở moment `detached`)
làm **4/6 test đỏ** và in đúng dòng lệch; khôi phục → xanh. Test này nằm trong `npm test`, máy sinh
thì **không** (một test tự viết lại baseline thì không phải gate).

**7.6.2 Ảnh baseline (item 0.1)**

`captures/capture-p0.cjs` chụp 5 trạng thái × 3 camera = **15 PNG** trong `captures/p0-baseline/`
(`normal`, `detached`, `sel-tower-01`, `sel-tower-10`, `sel-core` × `hero`, `orbit`, `closeup`) dưới
`reducedMotion: reduce`. Chọn reducedMotion không chỉ để "tắt chuyển động": `scene.tsx:47` đặt
`controls.enableDamping = !reducedMotion`, nên khi reduce thì một cú kéo **landing đúng pose** — ảnh
tất định theo code, không phải theo tốc độ máy.

- `p0-images.sha256`: 15 hash; chạy harness **hai lần → cả 15 PNG byte-identical**.
- Mỗi cú chọn part được **xác minh bằng DOM** (`#dataset-3d-part-panel[data-part-id]`), không tin
  vào toạ độ. Pixel bấm được tính bằng cách chiếu chính vertex của part đó rồi raycast ngược
  (`inbound` của `scene.tsx`: điểm gần nhất có tổ tiên mang `sculptComponent`), và làm tròn về pixel
  nguyên **trước khi** kiểm tra — bản chưa làm tròn từng chọn nhầm `core-upper` khi nhắm
  `core-cap-drum`.
- Cả 3 camera đều ra `tower-01-back-high`, `tower-10`, `core-cap-drum` — danh sách candidate core
  chưa cần tới phương án dự phòng.
- `p0-motion-reference.png` (bloom + motion BẬT) chỉ để so bằng mắt, **không** có trong manifest.

**7.6.3 Số đo thật trong trình duyệt (item 0.2)**

`renderer.info` lấy được mà không sửa source: ba gán `render` theo **instance**, không theo prototype,
nhưng `Object3D.prototype.onBeforeRender` nhận `renderer` làm tham số đầu tiên → hook prototype bắt
được renderer, rồi wrap `render` trên instance. Số đo đối chiếu độc lập bằng cách đếm lệnh GL
(`drawElements`/`drawArrays`/`*Instanced`, chỉ tính tam giác cho mode TAMGIÁC, điểm/line = 0).

| pose | calls/frame | triangles/frame | passes | geometries | textures | programs |
|---|---|---|---|---|---|---|
| attached | **476** | **378.574** | 1 | 304 | 15 | 27 |
| detached | **468** | **370.748** | 1 | 304 | 15 | 27 |
| animated (bloom on) | **490** | 378.588 | 14 (`rt0=476` scene + 12 post + 2 screen) | — | — | — |

`shadows=false`, `toneMapping=4` (ACESFilmic), `autoClear=true`, WebGL2, dpr 1. Máy đếm GL khớp
`renderer.info` **chính xác từng chữ số** ở attached (476 / 378.574); ở detached nó đọc 476 vì cửa sổ
90 khung hình vắt ngang cú lắp/tách — coi `renderer.info` là số chuẩn theo pose.

**7.6.4 Ngân sách chi vào đâu — trả lời ba câu human hỏi**

Đi bộ scene graph (chỉ tính `visible`, nhân `instanceMatrix` cho `InstancedMesh`):

| nhóm | drawable | GL call (ước theo material array) | triangle |
|---|---|---|---|
| trong model (`holographic-core.model.ts`) | 271 | — | — |
| · tháp (`tower-*`) | **130** | 130 | **18.864** |
| · core/spool (`core-*`, `spool-*`) | 41 | 41 | 79.056 |
| · base (`base-*`) | 45 | 69 | 18.352 |
| · không có part | 25 | 25 | 17.508 |
| ngoài model (sao, `neon-cube-cluster`, environment) | **61** | 61 | **93.842** |
| **tổng** | **308** | 332 | 230.822 |

1. **"139 draw call của tháp"** (kế hoạch đếm từ code): số **object** thật là **130** — cùng loại số,
   lệch 9 vì vài mesh tower không có `sculptComponent` và vài mesh bị ẩn. Nhưng tháp **không** phải
   chỗ tốn nhất: 130/308 object và 18.864/230.822 triangle. Chỗ tốn nhất là **61 object ngoài model
   = 93.842 triangle** (đầy sao + cụm neon-cube + environment), rồi core 79.056.
2. **"20.496 triangles"** (ghi ở P26): không phải tổng khung hình. Khung hình thật **378.574**
   (`renderer.info`) và 230.822 nếu cộng hình học một lần. Con số cũ chỉ đúng trong phạm vi phép đo
   của nó; đừng trích nó làm tổng.
3. **`SPOOL_CORE.budget.drawCalls = 19`** là ngân sách **của phân hệ spool**, không phải ngân sách
   khung hình. Khung hình là 476 call, tức gate "thêm mesh vào Core là vỡ test" vẫn đúng và vẫn phải
   giữ (ràng buộc #4 ở §7.5), nhưng nó không mô tả chi phí thật của trang.
4. **Chênh chưa đóng được**: 476 call thật vs 332 ước từ scene graph vs 334 render item đếm qua
   `onBeforeRender`. `Sprite` có `onBeforeRender` **của riêng prototype nó** nên bỏ qua hook, và ba
   chia submission theo group/vật liệu. Hệ quả cho Phase 2→5: **không** dùng số walk làm ngân sách
   draw call, chỉ dùng fingerprint để kết luận "không đổi".

**7.6.5 Quan sát D6 / P10 (StrictMode)**

Trang dev (`/workspaces/3d-dataset`, `main.tsx:25` bọc `React.StrictMode`) sau mount có **đủ**:
`issue-constellation` 5 con theo đúng thứ tự (`nucleus-beads` inst 18, `constellation-lanes` 512 verts,
`constellation-particles` inst 48, `detection-beacon-ring`, `detection-beacon-sprite`), 24
`inbound-stream-streaks`, 45 `selection-contour` — **giống hệt** cấu trúc headless trong baseline.
Không có dấu hiệu P10 phá scene graph khi double-mount. Giới hạn: đây là quan sát trạng thái đã commit,
không phải chứng minh `dispose()` vô hại; harness fingerprint dựng model ngoài React nên không kiểm
được chu trình mount. P10 vẫn **không sửa** (đã bị D1 cắt khỏi phạm vi).

**7.6.6 Nghiệm thu Phase 0**

| Gate | Kết quả |
|---|---|
| `npx vitest run` | **26 file / 378 pass** (trước: 25/372; +6 test fingerprint, +~13 s) |
| Baseline 2 lần | sha256 ndjson **như nhau**; 15 PNG **byte-identical** |
| Lưới có cắn | mutation → 4 test đỏ, khôi phục → xanh |
| `tsc -p tsconfig.app.json --noEmit` | 0 lỗi (chứng minh `node:fs`/`node:path` typecheck trong `src`) |
| `eslint` trên file mới | 0 lỗi |
| `npm run build` | OK |
| Source không đổi | md5 `model 66efa4d2…` / `spool 671c7f2c…` / `config bfbe8f0d…`; `git status src/graphics` **trống** |
| Console errors khi capture | **none** (không chèn probe `hasWebGL`, theo đúng lệnh của human) |

Rollback Phase 0: xoá `src/__tests__/dataset-3d/support/model-fingerprint.ts`,
`src/__tests__/dataset-3d/model-fingerprint.test.ts`, `captures/model-fingerprint.measure.ts`,
`captures/capture-p0.cjs`, `captures/p0-baseline/`, `fingerprint/`; khôi phục 1 dòng `testTimeout`
trong `captures/vitest.measure.config.ts`. Suite về 25 file / 372 test.

### 7.7 Phase 1 — ghim khoảng trống Tower↔Orbit (2026-11-04)

Phase 1 = S3, **đã rút gọn còn Test B** theo D2 (Test A — công thức chứa vòng ngoài — bị cắt vì nó chỉ
đúng cho một họ tháp và đã bị phép đo 3D thay thế). Ba file: `support/orbit-clearance.ts` (spec dùng
chung), `fingerprint/p1-orbit-clearance.ndjson` (baseline 28 dòng = 1 header + 27 dòng đo), `orbit-clearance.test.ts` (gate
trong `npm test`). Máy sinh `orbit-tower-clearance.measure.ts` gọi **cùng** `buildClearance()`, nên
không có chuyện baseline được xác nhận bởi một spec khác với spec kiểm tra nó.

**7.7.1 Dòng ghim những gì**

```
orbit|samples=8200|mesh|bbox=-1.235736,0.782901,-1.301447|1.235736,1.717099,1.301447
orbit|samples=8200|synthetic|bbox=...|drift=0.000161
orbit|maxReach=1.320023|meshReach=1.320003
tower|tower-15|swept=-0.078476|tube=-0.034928|bead=-0.078476|static=0.060796|shell=1.285096,1.726987,0.431900,1.756000|box=...
core|chamber-glass|r=0.950000|y=0.990000,1.980000|gap=0.095036|at=ring 1,tube,reach 1.045036,y 1.194162
```

| Trường | Nghĩa |
|---|---|
| `swept` | khoảng cách nhỏ nhất **trong suốt vòng xoay** (worst case, chính xác không cần lấy mẫu góc) |
| `tube` / `bead` | cùng phép đo nhưng tách riêng ống kính và quả cầu quỹ đạo |
| `static` | cùng phép đo ở **pose chụp** (`rotation.y = 0`) — để thấy quay tệ hơn bao nhiêu |
| `shell` | `[r0, r1, y0, y1]` của vỏ trụ mà hộp tháp quét quanh trục Y |
| `box` | Box3 world của tháp. `Box3.setFromObject` **bỏ qua `visible`** (three r0.186 `expandByObject`), nên nó union cả `selection-contour` ẩn scale 1.002 → số đọc được là **bảo thủ**: khoảng cách không bao giờ rộng hơn sự thật đã vẽ |
| `drift` | bbox mẫu tổng hợp vs bbox mesh thật — chứng minh phép đo đang mô tả hình học trên màn hình |

**7.7.2 18 tháp, xếp theo `swept` tăng dần**

| # | tháp | swept | tube | static | static − swept |
|---|---|---|---|---|---|
| 1 | tower-15 | **−0.078476** | −0.034928 | 0.060796 | 0.139272 |
| 2 | tower-01-back-high | 0.127814 | 0.171363 | 0.184373 | 0.056559 |
| 3 | tower-03 | 0.132214 | 0.175762 | 0.261537 | 0.129323 |
| 4 | tower-05 | 0.132283 | 0.175831 | 0.206342 | 0.074059 |
| 5 | tower-07 | 0.132433 | 0.175982 | 0.243314 | 0.110881 |
| 6 | tower-09 | 0.132737 | 0.176286 | 0.240284 | 0.107547 |
| 7 | tower-06 | 0.132956 | 0.176504 | 0.177925 | 0.044969 |
| 8 | tower-08 | 0.133012 | 0.176561 | 0.272451 | 0.139439 |
| 9 | tower-02 | 0.133428 | 0.176977 | 0.195392 | 0.061964 |
| 10 | tower-04 | 0.425741 | 0.469290 | 0.553926 | 0.128185 |
| 11 | tower-16 | 0.819629 | 0.863178 | 0.834248 | 0.014619 |
| 12 | tower-18 | 0.837796 | 0.881345 | 0.983779 | 0.145983 |
| 13 | tower-10 | 0.869796 | 0.913345 | 0.985778 | 0.115982 |
| 14 | tower-12 | 0.909715 | 0.953264 | 0.972586 | 0.062871 |
| 15 | tower-14 | 0.925537 | 0.969086 | 1.053373 | 0.127836 |
| 16 | tower-13 | 1.079712 | 1.123261 | 1.227219 | 0.147507 |
| 17 | tower-11 | 1.082419 | 1.125968 | 1.103134 | 0.020715 |
| 18 | tower-17 | 1.119659 | 1.163208 | 1.196672 | 0.077013 |

Bốn điều rút ra từ chính bảng này:

1. `bead == swept` trên **cả 18 dòng**: quả cầu quỹ đạo (bán kính 0.0785) luôn là vật bám, không bao
   giờ ống kính. Gate vì vậy đọc cột `swept`, còn `tube` chỉ là ngữ cảnh.
2. `static > swept` trên **cả 18 dòng** (khoảng 0.0146 → 0.1475) — đúng bất biến lý thuyết
   `swept ≤ static` mà P32 chứng minh bằng lập luận giao hoán hai phép min; giờ nó là số đo, không còn
   là suy luận.
3. Tám tháp nhóm trong (01, 02, 03, 05, 06, 07, 08, 09) nằm trong dải rộng **0.0056** (0.127814 →
   0.133428). Một dịch chuyển tháp cỡ milimet đều bị bắt, và **không** có tháp nào trong nhóm này có
   biên đáng kể để "nới tay".
4. tower-15 là **D7** (đã human chốt bỏ qua): xuyên 0.078476 theo Box3, và P33 đã đo trên mặt thật là
   bead ăn sâu **0.0550** vào khối kính đã vẽ. Nó được ghim như một số **âm có chủ đích**, không bị
   miễn nhiễm: mọi thay đổi hình học của tower-15 đều làm test byte đỏ.

**7.7.3 Phía Core và bằng chứng tự thân**

| mặt | bán kính | dải y | gap | tại |
|---|---|---|---|---|
| platform-disc | 1.550000 | 0.470000–0.520000 | 0.355407 | ring 4 bead, reach 1.363572 |
| base-glass | 1.060000 | 0.520000–0.900000 | 0.146451 | ring 3 bead, reach 1.269529 |
| lower-band | 1.020000 | 0.900000–0.990000 | 0.114147 | ring 1 tube, reach 1.101605 |
| chamber-glass | 0.950000 | 0.990000–1.980000 | **0.095036** | ring 1 tube, reach 1.045036 |
| chamber-backdrop | 0.930000 | 1.002000–1.968000 | 0.115036 | ring 1 tube, reach 1.045036 |
| cap-envelope | 1.170000 | 1.980000–2.400000 | 0.265884 | ring 4 bead, reach 1.362645 |

Sáu mặt này là **trụ đồng tâm trên trục Y** nên chúng bất biến theo yaw: vòng xoay chỉ có thể làm tháp
đến gần hơn, không làm core gần hơn. Vì vậy chỉ các dòng `tower|` cần `swept`, còn `core|` dùng phép
đo tĩnh. Khoảng cách cap thật chất là **chiều cao** (`cap.bottomY 1.98 − orbit maxY 1.7172 = 0.2628`),
bán kính của cap không tham gia.

`drift = 0.000161` và `maxReach 1.320023` vs `meshReach 1.320003`: mẫu tổng hợp (512 bước góc) nằm
**ngoài** mesh thật (128 bước góc) một khoảng 2.0e-5 — tức phép đo over-approximate hình đã vẽ, hướng
an toàn cho một gate kiểu "không được đến gần hơn". Hai số này giờ nằm trong baseline, nên nếu
`spool-core.ts` đổi pipeline mà spec không theo kịp, `drift` nhảy và gate tự đỏ.

**7.7.4 Nghiệm thu Phase 1**

| Gate | Kết quả |
|---|---|
| Generator 2 lần | sha256 `e58b98f33bb6a12eb3a4eb563388b04c0369f12c0ea23bcd1b97c5be8ef9e267` **như nhau** (4.057 byte, 28 dòng) |
| Không đổi phép đo | mọi số trùng khớp báo cáo P32/P33 (−0.0785 / −0.0349 / 0.0550 / brute lệch 0.0006) |
| Test mới trong `npm test` | **4/4 pass** (1,2 s): 18 dòng tháp, byte-exact, `drift < 0.003`, không tháp nào xuyên ngoài D7 |
| Mutation baseline | 3 ô sửa (1e-6, 1e-6, 1 mm) → test byte **đỏ**, in đúng 3 dòng |
| Mutation nhãn D7 | `KNOWN_PIERCE` đổi sang tower-04 → guard ngữ nghĩa **đỏ**: “a second tower entered the orbit path: expected [ 'tower-15' ] to deeply equal []” — chứng minh nó đọc hình học thật |
| `tsc -b` / `eslint` / `npm run build` | 0 lỗi / 0 lỗi / OK (268 module) |
| Image-neutral | md5 `model 66efa4d2…` / `spool 671c7f2c…` / `config bfbe8f0d…` không đổi; `git status src/graphics` trống |

**Ngoài phạm vi Phase 1 — `npm test` flake: ĐÃ SỬA, xem §7.8.** Khi chạy nguyên suite,
một test **không liên quan** (`workspace-3d/local-csv-viewer`, cũng từng gặp `auth-flow`,
`holographic-towers`, `issue-constellation`, `resource-map`) chết với `Error: Test timed out in
5000ms`; chạy riêng thì **pass** (1,93 s). Đã đối chứng: **bỏ file test mới của Phase 1 ra khỏi suite,
3/3 lần chạy vẫn đỏ** (1–2 file fail), tức bệnh có từ trước, không do Phase 1. Human chốt step 2 =
sửa nguyên nhân; bốn phương án đã **đo** và bảng kết quả ở **§7.8**.

Rollback Phase 1: xoá `src/__tests__/dataset-3d/support/orbit-clearance.ts`,
`src/__tests__/dataset-3d/orbit-clearance.test.ts`, `fingerprint/p1-orbit-clearance.ndjson`;
`git checkout -- .agents/dataset-3d-core/captures/orbit-tower-clearance.measure.ts`.
Suite trở 26 file / 378 test; §7.2 và các số P31–P33 vẫn đúng nguyên văn.

### 7.8 Flake `npm test`: bốn phương án đo, một phương án đứng (2026-11-03, step 2)

**Triệu chứng.** Một test **luân phiên** đổi nạn nhân (`local-csv-viewer`, `auth-flow`, `holographic-towers`,
`issue-constellation`, `resource-map`) chết với `Error: Test timed out in 5000ms`; chính test đó chạy riêng
thì pass (1,93 s). Đổi nạn nhân theo lần chạy là dấu hiệu của **đói tài nguyên**, không của một assertion sai.

**Nguyên nhân.** Máy 4 nhân CPU thật / 8 GB RAM, swap **10.995/12.288 MB đã dùng**, load average 136,97 giảm dần
xuống 39,40 trong lúc đo; không có process playwright/node cô cút nào. 27 môi trường jsdom tốn ~90 s chỉ để
dựng (Vitest tự in `jsdom was created 27 times · 90,58 s`), đồng hồ 5 s của **từng test** bị tính bằng thời
gian thực, nên khi các file tranh CPU nhau thì test nào cũng có thể trễ hạn. Đây là bài toán **scheduling**,
không phải bài toán chi phí dựng environment.

**Bốn phương án** (b), (c1), (c2), (c3), đo trên cùng một máy đang chạy; cột Timeout là *số lần test trễ hạn /
số lần chạy nguyên suite*; dòng đầu là **đo nền**, chưa sửa gì:

| Phương án | Timeout / lần chạy | Duration | Phán quyết |
|---|---|---|---|
| `vitest.config.ts` như HEAD (song song) | **5 / 1 / 6** (3 lần) | 95,88 / 77,62 / 94,73 s | đỏ — bệnh nền, không do Phase 1 |
| (b) `--testTimeout=20000` | 0 (1 lần) | (không ghi duration) | **loại**: đồng hồ dài hơn chỉ biến triệu chứng thành vô hình, không trả lời được câu hỏi mà gate cần — test này chậm hay bị đói? |
| (c1) `isolate: false` | **6 / 7 / 4** (3 lần) | 83,96 / 59,02 / 50,09 s | **tệ hơn**: environment ít đi nên nhanh hơn (50–84 s), nhưng tổng số lần trễ hạn tăng **12 → 17**; đã `git checkout --` ngay, xác nhận file trở **byte-identical** với HEAD |
| (c2) `poolOptions.threads.maxThreads: 2` | **1 / 1 / 3** (3 lần) | ~68–76 s | vẫn đỏ — giới hạn thread không đủ; config thí điểm `vitest.max2.config.ts` đã xoá |
| (c3) `fileParallelism: false` | **0/0/0/0** (4 lần) + 0/0 (2 lần CLI) | 196,90 / 175,25 s (CLI), rồi **181,18 / 159,97 / 194,79 / 174,75 s** khi ghi vào config | **xanh cả 6 lần chạy tuần tự liên tiếp** ở đúng timeout mặc định 5 s; lần 4 chạy trên file đã chốt comment, để config được kiểm chứng đúng như nó đang tồn tại |

**Đã áp dụng** (c3): `vitest.config.ts` thêm `fileParallelism: false` kèm 3 dòng comment mang chính các số
trên, vì nó là lý do người sau không được "tối ưu" ngược lại. **Cái giá: +80 s** (77–96 s → 160–195 s) đổi
lấy kết quả tất định. **Không có rủi ro leak state**: `fileParallelism: false` chỉ bỏ song song *giữa các
file*, vẫn giữ `isolate` mặc định — mỗi file một environment mới, nên không có đường chia sẻ module state;
bằng chứng là 27 file / **382 test pass y hệt nhau cả 4 lần**, và `clearMocks` / `restoreMocks` /
`unstubEnvs` vẫn bật.

**Chưa đo, để ngỏ:** `pool: 'vmThreads'` — lời gợi ý rẻ hơn của Vitest, chưa thử nên không cam kết. Nó cũng
**không** được phản ánh trong bảng trên. Sau khi chuyển sang tuần tự, dòng `jsdom was created 27 times` vẫn
in ra: đó là **giá của isolation**, không phải thứ còn hỏng.

**Nghiệm thu bước này**: `npm test` ×4 → 27 file / 382 test pass (181,18 / 159,97 / 194,79 / 174,75 s,
timeout mặc định; 3 lần đầu chạy trên config, lần 4 chạy sau khi sửa lại comment cho đúng số);
`npx tsc -b` 0 lỗi; `git diff --stat HEAD` chỉ một file **+4 dòng**; `git status src/graphics` **trống**;
md5 `model 66efa4d2…` / `spool 671c7f2c…` / `config bfbe8f0d…` không đổi → không ảnh hưởng hình ảnh.
Rollback: `git checkout -- vitest.config.ts` (bỏ 4 dòng), suite trở lại đỏ luân phiên như mô tả ở trên.

**Cảnh báo về `npm run lint`** (đã kiểm tra lại vì các dòng trước ghi `eslint 0 lỗi`): lệnh này là
`eslint .` trên toàn repo nên vẫn **12 lỗi**, **toàn bộ** nằm trong `.agents/holographic-core/blockout/` và
`reference-v2/blockout/` — scratch **chưa commit** (`??`) của pass img2threejs, trong đó `generated-core.ts`
là file sinh nên **không sửa tay**. Gate thật cho thay đổi này là lint theo phạm vi: `eslint src`,
`eslint .agents/dataset-3d-core`, `eslint vitest.config.ts` → **0 lỗi cả ba**. Không trộn việc sửa 12 lỗi
scratch vào bước này (ngoài phạm vi).

## 7.9 Phase 2 — trích `technical-lines.ts` (2026-11-04, P37)

**Chuyển gì.** `CYAN`, `addTechnicalLine`, năm biến tạm của rod (`ROD_UP`, `rodMidpoint`, `rodDirection`,
`rodQuaternion`, `rodScale`) và `addTechnicalRods` sang `src/graphics/holographic-core/technical-lines.ts`;
model import lại một dòng. `addPlanarGrid` / `addBaseWallGrid` / `addDeckRecess` **ở lại** model vì chúng là
base/deck, không phải tháp (§3.1). Module mới không import gì ngoài `three`, nên tháp tách ra sau này dùng
chung được mà không tạo vòng phụ thuộc (§3.4).

**Bằng chứng "chỉ là di chuyển code", không phải viết lại.** Phép đối chiếu máy, không phải mắt đọc: 57 dòng
đã chuyển được so từng ký tự với bản trong `git show HEAD:…holographic-core.model.ts` sau khi gỡ đúng hai từ
khoá `export ` ở đầu dòng → **identical**. Diff của model là **+1 / −60**, không một dòng logic mới.

**Gate.** Fingerprint **10/10** (cả 5 moment so từng byte với baseline đã commit), clearance **4/4** (baseline
`e58b98f3…` không đổi), `npm test` **27 file / 382 test** (215,75 s), `tsc -b` 0, `eslint` 0 trên cả hai file,
`npm run build` OK. Quan trọng hơn mọi thứ headless: chạy lại harness trong trình duyệt rồi
`shasum -a 256 -c fingerprint/p0-images.sha256` → **15/15 OK**, tức raster thật không đổi một byte.

**Điều học được về chính harness (mới, chưa ai ghi).** `capture-p0.cjs` **ghi đè** hai artefact không tất
định: `p0-motion-reference.png` (motion + bloom BẬT) và `p0-metrics.json` (cửa sổ lấy mẫu phụ thuộc số frame
kịp quan sát). Bằng chứng: hai lần chụp **trên cùng một code** cho `ca3649b8…` và `e3b4b1e6…`, cửa sổ animated
tụt từ 57 xuống 47 frame nên mọi `perFrame` nhân đúng 1,0667 lần. Đây **không** phải hồi quy: 15 ảnh
`reducedMotion` trong manifest vẫn nguyên hash. Hai file đã `git checkout --` khôi phục. **Cần human quyết
(nho nhỏ, để ngỏ)**: hoặc cho harness ghi hai artefact này ra đường dẫn scratch, hoặc ngừng commit chúng —
hiện tại mỗi lần chạy capture là `git status` bẩn một cách vô nghĩa, và đó là loại bẩn dễ bị người sau "commit
đi cho sạch" nhất.

**Rollback Phase 2**: `git checkout -- src/graphics/holographic-core/holographic-core.model.ts` và
`rm src/graphics/holographic-core/technical-lines.ts`.

