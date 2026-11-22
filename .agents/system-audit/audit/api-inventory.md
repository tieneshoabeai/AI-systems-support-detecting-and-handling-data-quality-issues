# API inventory — cập nhật 19/11/2026

HEAD `f017663` + working tree, ghép chọn lọc TaiFE@48d1ba6. Các payload response dưới đây là kỳ vọng FE, không phải schema 2xx đã được OpenAPI xác nhận. Cả 86 operation thiếu success content trực tiếp. Status trong bảng đọc từ snapshot, không từ network.

Caller dưới `src/frontend/src/services/`: A=auth/auth.service.ts; G=auth/google-sign-in.ts; U=users/users.service.ts; H=health/health.service.ts; M=management/management.store.ts; R=processing/recent-projects.service.ts; D=processing/dataset.service.ts; B=management/admin.service.ts. Transport `lib/axios-client.ts`; auth session gửi Bearer. Path bảng dùng prefix của snapshot, không công bố API URL thực.

| Method / endpoint | Caller / auth / timeout | Input | Output / behavior | Status snapshot |
|---|---|---|---|---|
| GET `/health` | H/public/5s | Không body; root origin | Health status; không ghép prefix | 200 |
| POST `/api/v1/auth/login` | A/public/30s | email,password và remember theo DTO | Credential + user qua mapper | 200 |
| POST `/api/v1/auth/refresh` | A/public/30s | refresh_token | Access/refresh token rotate | 200 |
| POST `/api/v1/auth/logout` | A/session/30s | Không body bắt buộc | Message; local cleanup tách revoke | 200 |
| GET `/api/v1/auth/google` | G/navigation | format=redirect | Điều hướng Google; callback fragment do BE chuyển về | 302, 501 |
| GET `/api/v1/users/me` | U hoặc M/session/30s | Không body | Profile camelCase; mỗi consumer có guards riêng | 200 |
| PATCH `/api/v1/users/me` | M/session/30s | first_name,last_name,phone,bio | Reload profile; organization chưa nối | 200 |
| DELETE `/api/v1/users/me` | U/coordinator/session/30s | Email confirmation chỉ ở UI | Cleanup sau success; chưa live delete | 200 |
| GET `/api/v1/workspaces` | M/session/30s | limit/page hoặc cursor | items + total hoặc meta | 200 |
| POST `/api/v1/workspaces` | M/session/30s | name,description | workspace + id/version | 201 |
| GET `/api/v1/workspaces/{id}` | M/session/30s | id | Workspace detail/name lookup | 200 |
| PATCH `/api/v1/workspaces/{id}` | M/session/30s | name/description,expectedVersion | Reload sau mutation | 200 |
| DELETE `/api/v1/workspaces/{id}` | M/session/30s | id | 204 → undefined | 204 |
| GET `/api/v1/workspaces/{id}/members` | M/session/30s | limit,cursor; lặp trang | members/items, meta; chống cursor lặp | 200 |
| POST `/api/v1/workspaces/{id}/members` | M/session/30s | email,role=member | Reload | 201 |
| DELETE `/api/v1/workspaces/{id}/members/{userId}` | M/session/30s | IDs | Reload | 200 |
| POST `/api/v1/workspaces/{id}/transfer-owner` | M/session/30s | email,expectedVersion | Reload | 201 |
| POST `/api/v1/workspaces/{id}/leave` | M/session/30s | Không body | Reload | 201 |
| GET `/api/v1/workspaces/{workspaceId}/projects` | M/session/30s | limit/page hoặc cursor | items + total hoặc meta | 200 |
| GET `/api/v1/projects` | R/session/30s | cursor,limit; recent service | items/meta; optional workspace name lookup | 200 |
| POST `/api/v1/workspaces/{workspaceId}/projects` | M/session/30s | name,description | project ID trước upload | 201 |
| GET `/api/v1/projects/{id}` | M/session/30s | id + cancellation | project, validate id/version/status | 200 |
| PATCH `/api/v1/projects/{id}` | M/session/30s | name,expectedVersion | Reload | 200 |
| DELETE `/api/v1/projects/{id}` | M/session/30s | id | 204 → undefined | 204 |
| PUT `/api/v1/projects/{id}/snapshot` | M/session/30s | expectedVersion | Đánh dấu completed; không lưu snapshot tùy ý | 200 |
| GET `/api/v1/projects/{id}/members` | M/session/30s | limit,cursor; lặp trang | members/items + meta | 200 |
| POST `/api/v1/projects/{id}/members` | M/session/30s | email,role=member/viewer | Reload/tiếp wizard | 201 |
| PATCH `/api/v1/projects/{id}/members/{userId}` | M/session/30s | role,expectedVersion | Reload | 200 |
| DELETE `/api/v1/projects/{id}/members/{userId}` | M/session/30s | IDs | Reload | 200 |
| POST `/api/v1/projects/{id}/transfer-owner` | M/session/30s | email,expectedVersion | Reload | 201 |
| GET `/api/v1/projects/{projectId}/datasets` | M/session/30s | projectId | dataset hoặc null | 200 |
| POST `/api/v1/projects/{projectId}/datasets/upload` | M/session/120s | multipart file gốc | Partial retry Map trong instance | 201 |
| GET `/api/v1/datasets/{id}` | D/session/30s | id + signal | dataset{id,name,rowCount,columnCount} | 200 |
| GET `/api/v1/datasets/{id}/schema` | D/session/30s | id + signal | columns; guards key/type/isPii | 200 |
| GET `/api/v1/datasets/{datasetId}/records` | D/session/30s | limit,cursor | items{rowIndex,props},meta | 200 |
| POST `/api/v1/datasets/{datasetId}/records/query` | D/session/30s | search,filters,sort,cursor,limit | items/meta; server-side query | 200 |
| GET `/api/v1/datasets/{datasetId}/columns/{columnKey}/stats` | D/session/30s | columnKey | stats, numeric guards | 200 |
| PATCH `/api/v1/datasets/{id}/columns/pii` | D/session/30s | columns:[{columnKey,isPii}] | Metadata only; reload schema/preview | 200, 400, 404 |
| DELETE `/api/v1/datasets/{id}` | D/session/30s | id | 204; refreshProject; không tự retry | 204 |
| GET `/api/v1/datasets/{id}/file` | D/session/120s | responseType=blob | CSV Blob; revoke object URL | 200 |
| GET `/api/v1/overview/workspaces` | M/session/30s | Không body | Overview counters | 200 |
| GET `/api/v1/workspaces/{id}/overview` | M/session/30s | workspaceId | Overview đúng workspace | 200, 404 |
| GET `/api/v1/auth/sessions` | M/session/30s | Không body | Snake_case rows → session mapper | 200 |
| GET `/api/v1/auth/sessions/{id}` | M/session/30s | id | Session detail, is_revoked | 200, 404 |
| DELETE `/api/v1/auth/sessions/{id}` | M/session/30s | Không cho revoke current ở UI | Xóa row sau ACK | 200 |
| GET `/api/v1/notifications` | M/session/30s | limit,cursor | items/meta, readAt → unread | 200 |
| GET `/api/v1/notifications/{id}` | M/session/30s | id | Detail; cập nhật unread | 200 |
| PATCH `/api/v1/notifications/{id}/read` | M/session/30s | id | Read + personal reload | 200 |
| GET `/api/v1/issues` | M/session/30s | limit,cursor | items/meta, version | 200 |
| POST `/api/v1/issues` | M/session/30s | issueType,title,description | ID; tiếp upload attachment | 201 |
| GET `/api/v1/issues/{id}` | M/session/30s | id | Detail/version/status | 200 |
| PATCH `/api/v1/issues/{id}` | M/session/30s | title/description,expectedVersion | needs_info → supplement; detail reload | 200 |
| POST `/api/v1/issues/{id}/attachments` | M/session/30s | FormData file | Không rollback issue nếu attachment fail | 201 |
| GET `/api/v1/issues/{id}/attachments/{attachmentId}` | M/session/30s | responseType=blob | Attachment Blob | 200 |
| GET `/api/v1/admin/users` | B/session/30s | Cursor options theo service | Admin user page | 200 |
| GET `/api/v1/admin/users/{id}` | B/session/30s | id | Admin user detail | 200 |
| GET `/api/v1/admin/issues` | B/session/30s | Cursor options theo service | Admin issue page | 200 |
| GET `/api/v1/admin/issues/{id}` | B/session/30s | id | Admin issue detail | 200 |
| PATCH `/api/v1/admin/issues/{id}/status` | B/session/30s | status,expectedVersion | Updated issue | 200 |
| GET `/api/v1/projects/{projectId}/analysis/result` | M/session/30s | signal | Saved result; 404 → null | 200 |
| POST `/api/v1/projects/{projectId}/analysis` | M/session/30s | {} | Run caller; không suy ra async job đã hoàn tất | 201 |

## Giới hạn và phần khác

Không còn caller đổi/reset tên cột. PII là metadata, không thay nội dung dataset. Request aliases có consumer; response vẫn kết hợp DTO và guards, chưa là end-to-end runtime schema.

Store còn caller password/session-other revocation, notification delete/read-all/preferences và các thao tác cá nhân khác; bảng chọn lọc này không thay cho [ledger đủ 86 operations](swagger-operation-ledger.md). Không suy ra caller chỉ từ ledger. Polling AI jobs, PDF pipeline và realtime chưa được kiểm chứng trong flow này.

E2E trước ghép mới: 6 PASS/1 FAIL; chức năng mới Google/delete account/PII/complete/supplement/profile live UNVERIFIED. [Revalidation](frontend-api-revalidation.md) ghi đầy đủ thời điểm và giới hạn.
