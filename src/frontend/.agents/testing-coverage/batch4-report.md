# Batch 4 — Đồng bộ test với thiết kế 3D hiện tại

Ngày kiểm chứng: 2026-11-17.

## Quyết định và phạm vi

Human chọn giữ kính/backdrop hiện tại sau khi xem bảng khác biệt với thiết kế cũ.
Giữ cấu trúc tower hiện tại đã trình ở bước phân tích. Batch này chỉ sửa test và fixture,
không sửa source sản phẩm, vật liệu, geometry, quỹ đạo hoặc tham số renderer.

Kính ngoài được pin tại #bcc2c0, opacity 0.2, roughness 0.1, lightMapIntensity 0.3.
Backdrop giữ radial/end inset 0.001. Không phục hồi palette/inset từ tài liệu cũ.

## Nguyên nhân 9 lỗi

- 1 ca tower đòi `tower-floor-frame`, corner posts và kiến trúc cũ. Commit `714bfa8`
  đã thay thành `tower-ledger-edges`, thay material và kiến trúc mặt tower, nhưng test chưa đổi.
- 5 ca fingerprint so source mới với fixture cũ. Khác biệt gồm kiến trúc tower, guide inbound,
  kết nối core–cube, vật liệu và tree paths. Test equality vẫn giữ nguyên sau rebase.
- 1 ca clearance: bounding boxes của 8 tower đổi theo kiến trúc mới; orbit và 7 bề mặt core
  mà harness đo giữ nguyên. Fixture cũ không còn mô tả tower đang được tạo.
- 2 ca spool: assertion còn pin palette/inset cũ. Tài liệu
  `.agents/dataset-3d-core/pre-taife-checkpoint.md` và `closed-lower-drum/audit.md`
  đã ghi nhận hai sai khác có sẵn; quyết định Human hiện tại chốt giữ giá trị source.

## Thay đổi cụ thể

- `holographic-towers.test.ts`: kiểm tra ledger là InstancedMesh, đúng số thanh đứng/cạnh tầng,
  matrix hữu hạn, giữ kiểm tra cửa sổ/màu, vị trí/kích thước, khoảng cách và các node cũ đã gỡ.
- `spool-core.test.ts`: pin giá trị vật liệu hiện tại; pin inset 0.001 và vẫn kiểm tra
  backdrop nằm trong kính, bên ngoài motes, không chạm nắp; giữ ray/material-group checks.
- `model-fingerprint.test.ts`, `orbit-clearance.test.ts`: mô tả đúng vai trò structural regression,
  không gọi fixture hiện tại là bằng chứng image-neutrality của Phase 0/1 nữa.
- `.agents/dataset-3d-core/fingerprint/p0-baseline.ndjson` và `p1-orbit-clearance.ndjson`:
  cập nhật bằng apply_patch sau phép đo chỉ đọc. Giữ tên fixture lịch sử để tránh đổi đường dẫn.

Không skip/xóa test, không tăng timeout. Hai file measurement tạm dưới `.agents/testing-coverage/`
đã xóa bằng apply_patch. Generator không được thêm vào suite sản phẩm.

## Audit baseline

- Fingerprint: 287244 → 268628 bytes. Bốn trạng thái init/update/reset/detached:
  352 → 344 dòng dữ liệu mỗi trạng thái. Moment `selected-18` vẫn kiểm tra 14 tower;
  đây là tên lịch sử, không phải số tower hiện tại.
- Các node cũ floor-frame, solid-core, roof-outline, corner-post được thay bằng 8 ledger.
  3 roof pillars/light-sheets thay một phần riser cũ. Fingerprint hiện cũng ghi các
  cube-connection/lane đã có trong source; không tạo chúng trong Batch 4.
- Cả 14 selection fingerprint giống trước khi chỉ bỏ qua tree path. Số contour, hash geometry,
  opacity và kết quả clear không đổi.
- Ba dòng orbit, drift synthetic/mesh 0.000161 và cả 7 dòng measured core giữ nguyên.
- Chỉ các tower 01/02/03/04/07/08/09/16 có clearance row đổi.
- Cả 14 swept tower gaps không âm. Minimum: 0.127814 → 0.115086 ở tower-01.
- Kiểm tra độc lập về số tower, khoảng cách không âm và synthetic/actual orbit vẫn được giữ.

## Validation

Trước sửa: 4 file liên quan có 29 pass / 9 fail, tổng 38 ca.
Sau cập nhật tower/spool: 26/26 pass.

Toàn frontend sau rebase:

```sh
yarn test --reporter=json --outputFile=.agents/testing-coverage/batch4-final-test-results.json --silent
```

Kết quả: 71 file pass; 864 ca pass, 0 fail, 0 skipped. Yarn báo khoảng 125.28 giây.
TypeScript `tsc -b --pretty false`, scoped ESLint 4 file test và `git diff --check` pass.
ESLint vẫn thông báo rule stylistic deprecated từ cấu hình có sẵn.
Không build production hoặc đọc `.env`.

## Giới hạn còn giữ nguyên

Đây là chốt structural baseline theo lựa chọn thiết kế hiện tại, không phải xác nhận hình ảnh
WebGL đúng. Không render screenshot hoặc compile shader trên browser ở Batch 4.

Harness clearance vẫn không đo outer annular chamber wall; tài liệu trước ghi nhận giao cắt
tường kính ngoài với rings 1–3. Minimum tower gap dương không chứng minh mọi vật thể đều không
giao cắt. Việc giữ kính/backdrop hiện tại không được diễn giải thành đã xử lý giao cắt này.

Coverage không đo lại ở batch này. Các tỷ lệ trong `expanded-report.md` thuộc lần đo Batch 3.
Batch 5 cần browser/WebGL để kiểm tra render, interactions và review ảnh trước khi chốt visual baseline.

## Bằng chứng

- [Kết quả trước sửa](batch4-test-results.json).
- [Kết quả toàn frontend sau sửa](batch4-final-test-results.json).
