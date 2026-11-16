# Đối chiếu toàn bộ command/query handler hiện có

Ngày lập: 2026-11-16. Danh sách lấy từ cây nguồn hiện tại, không dựa vào tên service cũ. Có mặt trong danh sách không có nghĩa đã được test hoặc đã đọc/kiểm chứng mọi nhánh.

Với **từng handler** dưới đây, triển khai tối thiểu các nhánh phù hợp: đầu vào hợp lệ; đầu vào biên/không hợp lệ; tài nguyên thiếu/đã xóa; dependency trả null/throw; kiểm tra kết quả và phạm vi side effect; đối với mutation kiểm tra không ghi khi bị từ chối và xử lý cập nhật thất bại. Handler forwarding thuần chỉ cần contract mapping, không lặp lại toàn bộ test của dependency. Quyền ở guard/controller phải test tại SEC, không bắt handler phải có kiểm tra chưa được phân công.

## analysis

Checklist: [09_analysis_workflows_reports.md](09_analysis_workflows_reports.md).

- [ ] `modules/analysis/application/commands/build-prompt-for-job.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/analysis/application/commands/create-summary.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/analysis/application/commands/ingest-ai-result.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/analysis/application/commands/request-report.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/analysis/application/commands/retry-job.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/analysis/application/commands/run-analysis.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/analysis/application/commands/save-config.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/analysis/application/queries/download-report-file.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/analysis/application/queries/get-config.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/analysis/application/queries/get-job.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/analysis/application/queries/get-report-file-meta.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/analysis/application/queries/get-result.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/analysis/application/queries/get-summary.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.

## audit

Checklist: [14_realtime_audit_overview.md](14_realtime_audit_overview.md).

- [ ] `modules/audit/application/commands/log.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.

## auth

Checklist: [01_auth.md](01_auth.md).

- [ ] `modules/auth/application/commands/change-password.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/auth/application/commands/forgot-password.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/auth/application/commands/login-with-google.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/auth/application/commands/login.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/auth/application/commands/logout.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/auth/application/commands/refresh-access-token.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/auth/application/commands/register.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/auth/application/commands/reset-password.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/auth/application/commands/revoke-session.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/auth/application/queries/get-session-by-id.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/auth/application/queries/get-sessions.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.

## data-view

Checklist: [07_data_view.md](07_data_view.md).

- [ ] `modules/data-view/application/queries/get-column-stats.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/data-view/application/queries/get-records.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/data-view/application/queries/query-records.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.

## datasets

Checklist: [06_datasets_import_columns.md](06_datasets_import_columns.md).

- [ ] `modules/datasets/application/commands/delete-dataset.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/datasets/application/commands/ingest-dataset-stream.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/datasets/application/commands/map-props-to-original-names.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/datasets/application/commands/rename-columns.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/datasets/application/commands/reset-column-names.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/datasets/application/commands/update-dataset.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/datasets/application/queries/download-dataset-file.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/datasets/application/queries/get-dataset-by-id.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/datasets/application/queries/get-dataset-by-project-id.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/datasets/application/queries/get-dataset-schema.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.

## feedback

Checklist: [13_feedback.md](13_feedback.md).

- [ ] `modules/feedback/application/commands/ai-quality-metrics.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/feedback/application/commands/create-finding-feedback.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/feedback/application/commands/create-run-feedback.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/feedback/application/commands/remove.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/feedback/application/commands/update-mine.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/feedback/application/queries/list-finding-feedback.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/feedback/application/queries/list-run-feedback.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.

## issues

Checklist: [11_issues.md](11_issues.md).

- [ ] `modules/issues/application/commands/create-report.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/issues/application/commands/update-my-report.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/issues/application/commands/update-status.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/issues/application/commands/upload-attachment.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/issues/application/queries/download-attachment.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/issues/application/queries/get-for-admin.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/issues/application/queries/get-mine.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/issues/application/queries/list-for-admin.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/issues/application/queries/list-mine.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.

## notifications

Checklist: [12_notifications.md](12_notifications.md).

- [ ] `modules/notifications/application/commands/dispatch.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/notifications/application/commands/mark-as-read.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/notifications/application/commands/update-preferences.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/notifications/application/queries/count-unread.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/notifications/application/queries/get-detail.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/notifications/application/queries/list-for-user.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.

## overview

Checklist: [14_realtime_audit_overview.md](14_realtime_audit_overview.md).

- [ ] `modules/overview/application/queries/get-user-overview.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/overview/application/queries/get-workspace-overview.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.

## projects

Checklist: [05_projects.md](05_projects.md).

- [ ] `modules/projects/application/commands/add-project-member.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/projects/application/commands/create-project.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/projects/application/commands/delete-project.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/projects/application/commands/mark-completed.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/projects/application/commands/remove-project-member.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/projects/application/commands/set-has-dataset.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/projects/application/commands/transfer-project-owner.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/projects/application/commands/update-project-member-role.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/projects/application/commands/update-project.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/projects/application/queries/get-project-by-id.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/projects/application/queries/get-projects-by-workspace.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/projects/application/queries/get-workspace-name.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/projects/application/queries/list-members.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/projects/application/queries/list-projects-by-workspace.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/projects/application/queries/resolve-user-project-role.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.

## realtime

Checklist: [14_realtime_audit_overview.md](14_realtime_audit_overview.md).

Không có command/query handler trong snapshot này; dùng service/gateway ở checklist tương ứng.


## users

Checklist: [02_users.md](02_users.md).

- [ ] `modules/users/application/commands/create-session.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/users/application/commands/create-user.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/users/application/commands/revoke-all-user-sessions.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/users/application/commands/revoke-session-by-id.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/users/application/commands/revoke-session.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/users/application/commands/soft-delete-user.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/users/application/commands/touch-session.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/users/application/commands/update-notification-preferences.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/users/application/commands/update-profile.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/users/application/queries/find-active-sessions.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/users/application/queries/find-by-email.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/users/application/queries/find-by-id.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/users/application/queries/find-paged.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/users/application/queries/find-session-by-id.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/users/application/queries/find-session-by-token-hash.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.

## workspaces

Checklist: [04_workspaces.md](04_workspaces.md).

- [ ] `modules/workspaces/application/commands/add-member.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/workspaces/application/commands/create-workspace.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/workspaces/application/commands/delete-workspace.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/workspaces/application/commands/increment-storage-used.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/workspaces/application/commands/leave-workspace.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/workspaces/application/commands/remove-member.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/workspaces/application/commands/transfer-owner.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/workspaces/application/commands/update-workspace.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/workspaces/application/queries/check-workspace-upload-quota.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/workspaces/application/queries/get-workspace-by-id.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/workspaces/application/queries/get-workspaces.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/workspaces/application/queries/list-members.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/workspaces/application/queries/list-workspaces.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.
- [ ] `modules/workspaces/application/queries/resolve-user-workspace-role.handler.ts` — áp dụng checklist module và các nhánh chung ở trên.

## Nhóm khác ngoài handler

Domain/value objects/utils: STAT, AI, VIEW, SHR và checklist module. Repository/mapper: kiểm tra mapping/query builder với model giả, kết nối thật tại INT. DTO/controller/guard/filter/interceptor: HTTP, SEC. Worker/event/storage/realtime: RUN, AI, SHR, RTO. Module wiring/bootstrap: integration, không tính là unit thuần.
