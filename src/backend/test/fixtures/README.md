# `test/fixtures/` — 3 file dữ liệu mẫu

| File | Nội dung thật (mở file ra thấy ngay) | Ai dùng |
|---|---|---|
| `valid-simple.csv` (3 dòng: header + 2 dòng) | `Ten,Tuoi,Email` + 2 dòng `Nguyen Van A,30,...` / `Tran Thi B,25,...` | Smoke test upload, e2e dataset-dataview |
| `large-50k.csv` (1 dòng placeholder, 70 bytes) | Nội dung thật chỉ có 1 dòng chữ: `placeholder: sinh dong khi chay k6/stress, khong commit file 50k dong` — không có 50k dòng thật trong git | Kịch bản stress tự sinh dữ liệu dòng khi chạy, không commit file nặng |
| `arch-baseline.json` (9 dòng) | `{ "_comment": "Baseline no ky thuat...", "CA3": [], "CA5": [], "CA6": [], "CA7": [], "CA8": [], "CA11": [] }` — hiện tại các list đều rỗng | `unit/arch/clean-architecture.spec.ts` đọc file này để cho phép vi phạm cũ, chặn vi phạm mới; cập nhật bằng `pnpm arch:baseline` (`scripts/generate-arch-baseline.ts` ghi ra đúng đường dẫn này) |

Không commit file CSV lớn vào git — file > vài MB thì để ở MinIO test hoặc sinh dòng trong factory (`factories/workspace.factory.ts` → `makeDatasetCsv`).
