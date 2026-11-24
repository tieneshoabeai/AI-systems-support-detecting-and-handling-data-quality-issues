# `test/factories/` — 2 tệp sinh dữ liệu giả (xác định theo seed)

Thư mục này chứa hàm tạo dữ liệu mẫu để test lặp lại được. Cùng một seed thì luôn sinh ra cùng một dữ liệu. Code thật (mở tệp ra sẽ thấy ngay):

- `user.factory.ts`: `makeUser(seed = 42, overrides)` trả về `{ email: user{n}@test.local, phone: 090{...}, role: 'analyst', seed }` với `n = seed*1000 + seq` (`seq` tăng mỗi lần gọi); `resetUserFactory()` đặt lại `seq = 0`. Chú thích đầu tệp ghi: `email @test.local, sdt 0900000000+ (T18)`.
- `workspace.factory.ts`: `makeWorkspace(seed = 42)` trả về `{ name: Workspace {seed}, description: ... }`; `makeProject` làm tương tự; `makeDatasetCsv(seed = 42, rows = 5, cols = 3)` sinh dòng tiêu đề `Cot 0,Cot 1,...` và các dòng `v{seed}_{r}_{c}` (chuỗi trong code không dấu, giữ nguyên văn). Chú thích trong code: cùng seed thì cùng dữ liệu (quy tắc 1-2).

Cùng seed thì cùng dữ liệu. Cần biến thể thì truyền `overrides`, đừng sửa factory.
