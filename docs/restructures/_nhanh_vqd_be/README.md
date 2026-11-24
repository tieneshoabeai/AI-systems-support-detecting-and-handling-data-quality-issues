# Bản cùng số phiên bản của nhánh `Vqd_BE` (lưu trữ)

Nhánh `Vqd_BE` (module analysis, đợt A–I) và nhánh `backend` (Bước 1–6, GĐ, OPEN-01..10, refactor P1–P6) đều nâng phiên bản tài liệu từ cùng một bản gốc. Vì làm song song, cả hai nhánh tạo ra một số file **trùng tên nhưng khác nội dung**.

Sau khi merge `origin/backend` vào `Vqd_BE` (commit `131e14c`, 2026-11-24):

- File cùng tên ở thư mục cha `docs/restructures/` là **bản của `backend`**.
- Thư mục này giữ **bản của `Vqd_BE`** để các tham chiếu cũ trong tài liệu đợt A–I vẫn tra được. Ví dụ "Phần 6 v7 mục 3.20" là file [`6_security_authorization_v7.md`](6_security_authorization_v7.md) ở đây.
- Nội dung của cả hai nhánh đã được gộp vào bản mới: **Phần 2 v15 · 6 v9 · 7 v12 · 8 v12 · 10 v8 · 13 v13**. Đây là các bản đang dùng; file trong thư mục này **chỉ để đối chiếu, không sửa**.

| Phần | Bản `Vqd_BE` ở đây | Bản `backend` cùng số | Bản hợp nhất |
|---|---|---|---|
| 2 — Danh sách tính năng | [v10](2_feature_catalog_v10.md), [v11](2_feature_catalog_v11.md) | [v10](../2_feature_catalog_v10.md), [v11](../2_feature_catalog_v11.md) | [v15](../2_feature_catalog_v15.md) |
| 6 — Xác thực, phân quyền | [v7](6_security_authorization_v7.md) | [v7](../6_security_authorization_v7.md) | [v9](../6_security_authorization_v9.md) |
| 7 — Hợp đồng API | [v7](7_api_contracts_v7.md), [v8](7_api_contracts_v8.md) | [v7](../7_api_contracts_v7.md), [v8](../7_api_contracts_v8.md) | [v12](../7_api_contracts_v12.md) |
| 8 — Database schema | [v7](8_database_schema_v7.md) | [v7](../8_database_schema_v7.md) | [v12](../8_database_schema_v12.md) |
| 10 — Vận hành | [v7](10_runtime_operations_v7.md) | [v7](../10_runtime_operations_v7.md) | [v8](../10_runtime_operations_v8.md) |
| 13 — Kiểm thử | [v8](13_testing_acceptance_plan_v8.md), [v9](13_testing_acceptance_plan_v9.md) | [v8](../13_testing_acceptance_plan_v8.md), [v9](../13_testing_acceptance_plan_v9.md) | [v13](../13_testing_acceptance_plan_v13.md) |

**Lưu ý về đổi số mục ở Phần 6 v9:** mục 3.20 / 3.21 (Vqd_BE v7) và 3.22 (Vqd_BE v8) được đổi thành **3.22 / 3.23 / 3.24**, vì số 3.20 / 3.21 đã dùng cho Google OAuth / `needs_info` ở nhánh `backend`.

Liên kết tương đối bên trong các file ở đây được viết cho thư mục cha, nên có thể không mở được khi xem trực tiếp. Muốn mở các file khác thì vào thư mục `docs/restructures/`.
