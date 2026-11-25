// @ts-nocheck
/** Auto-generated from OpenAPI. Do not edit manually. */
export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Liveness: tiến trình còn sống, không kiểm tra dependency */
        get: operations["AppController_getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Readiness v6: Mongo + storage sẵn sàng mới nhận traffic (ngoài /api/v1) */
        get: operations["AppController_getReady"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lấy thông tin tài khoản hiện tại */
        get: operations["UsersController_getProfile"];
        put?: never;
        post?: never;
        /** Xóa mềm tài khoản người dùng (Soft Delete) */
        delete: operations["UsersController_deleteAccount"];
        options?: never;
        head?: never;
        /** Cập nhật thông tin hồ sơ cá nhân */
        patch: operations["UsersController_updateProfile"];
        trace?: never;
    };
    "/api/v1/admin/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** ADMIN-01: Danh sách hồ sơ (chỉ đọc, có audit log) */
        get: operations["AdminUsersController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** ADMIN-01: Chi tiết hồ sơ (chỉ đọc, có audit log) */
        get: operations["AdminUsersController_detail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Đăng ký tài khoản mới (F1.1) */
        post: operations["AuthController_register"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Đăng nhập hệ thống (F1.2) — hỗ trợ "ghi nhớ đăng nhập" */
        post: operations["AuthController_login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cấp mới Access Token bằng Refresh Token (F1.3) */
        post: operations["AuthController_refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/forgot-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** AUTH-05: Quên mật khẩu — gửi OTP 6 số (TTL 10 phút) */
        post: operations["AuthController_forgotPassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/reset-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** AUTH-06: Đặt lại mật khẩu bằng OTP */
        post: operations["AuthController_resetPassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** AUTH-07: Đổi mật khẩu (giữ phiên hiện tại) */
        post: operations["AuthController_changePassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/google": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** AUTH-03: Đăng nhập Google — chuyển hướng tới trang xác thực Google */
        get: operations["AuthController_googleStart"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/google/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** AUTH-03: Google callback — đổi mã lấy token và đăng nhập */
        get: operations["AuthController_googleCallback"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Đăng xuất tài khoản và thu hồi session hiện hành (F1.4) */
        post: operations["AuthController_logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Xem danh sách các phiên đăng nhập đang hoạt động (F1.8) */
        get: operations["AuthController_getSessions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/sessions/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Chi tiết phiên đăng nhập hiện tại (tài nguyên của chính mình) */
        get: operations["AuthController_getCurrentSession"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/sessions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Chi tiết 1 phiên đăng nhập (chỉ chính user đó) */
        get: operations["AuthController_getSessionById"];
        put?: never;
        post?: never;
        /** Thu hồi phiên đăng nhập từ xa (F1.10) */
        delete: operations["AuthController_revokeSession"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * WS-02: Lấy danh sách workspace (phân trang cursor/tìm kiếm/lọc/sắp xếp)
         * @description Phân trang keyset: dùng `meta.nextCursor` làm tham số `cursor` của request kế tiếp. Response: `{ items, meta: { nextCursor, hasMore, limit } }` — không có `total`/`page`.
         */
        get: operations["WorkspacesController_listWorkspaces"];
        put?: never;
        /** WS-01: Tạo không gian làm việc mới */
        post: operations["WorkspacesController_createWorkspace"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** WS-03: Xem chi tiết không gian làm việc */
        get: operations["WorkspacesController_getWorkspaceById"];
        put?: never;
        post?: never;
        /** WS-05: Xóa mềm không gian làm việc */
        delete: operations["WorkspacesController_deleteWorkspace"];
        options?: never;
        head?: never;
        /** WS-04: Cập nhật thông tin không gian làm việc */
        patch: operations["WorkspacesController_updateWorkspace"];
        trace?: never;
    };
    "/api/v1/workspaces/{id}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * WS-06: Danh sách thành viên workspace (tìm kiếm/lọc/phân trang cursor)
         * @description Phân trang keyset: dùng `meta.nextCursor` làm tham số `cursor` của request kế tiếp. Response: `{ items, meta: { nextCursor, hasMore, limit } }` — không có `total`/`page`.
         */
        get: operations["WorkspacesController_listMembers"];
        put?: never;
        /**
         * WS-07: Thêm thành viên vào không gian làm việc
         * @description Email đã có tài khoản → thêm thành viên ngay. Email chưa có tài khoản → gửi lời mời qua email (trả `invited: true`).
         */
        post: operations["WorkspacesController_addMember"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/{id}/members/{userId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Xóa thành viên khỏi không gian làm việc */
        delete: operations["WorkspacesController_removeMember"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/{id}/transfer-owner": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** WS-09: Nhượng quyền Workspace Owner */
        post: operations["WorkspacesController_transferOwner"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/{id}/leave": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** WS-10: Rời workspace */
        post: operations["WorkspacesController_leave"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/{workspaceId}/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * PROJ-02: Danh sách project (phân trang cursor/tìm kiếm/lọc status/sắp xếp)
         * @description Phân trang keyset: dùng `meta.nextCursor` làm tham số `cursor` của request kế tiếp. Response: `{ items, meta: { nextCursor, hasMore, limit } }` — không có `total`/`page`.
         */
        get: operations["ProjectsController_listByWorkspace"];
        put?: never;
        /** PROJ-01: Tạo dự án mới trong không gian làm việc */
        post: operations["ProjectsController_createProject"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * PROJ-02b: Danh sách project toàn hệ thống (không theo workspace)
         * @description Trả về mọi project người dùng có quyền đọc, gom từ tất cả workspace. Phân trang keyset: dùng `meta.nextCursor` làm tham số `cursor` của request kế tiếp. Response: `{ items, meta: { nextCursor, hasMore, limit } }`.
         */
        get: operations["ProjectsController_listAllProjects"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** PROJ-03: Xem chi tiết dự án */
        get: operations["ProjectsController_getProjectById"];
        put?: never;
        post?: never;
        /** PROJ-05: Xóa mềm dự án */
        delete: operations["ProjectsController_deleteProject"];
        options?: never;
        head?: never;
        /** PROJ-04: Cập nhật thông tin dự án */
        patch: operations["ProjectsController_updateProject"];
        trace?: never;
    };
    "/api/v1/projects/{id}/snapshot": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** PROJ-12: Lưu trạng thái project (optimistic locking) */
        put: operations["ProjectsController_markCompleted"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{id}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * PROJ-09: Danh sách thành viên project (tìm kiếm/lọc/phân trang cursor)
         * @description Phân trang keyset: dùng `meta.nextCursor` làm tham số `cursor` của request kế tiếp. Response: `{ items, meta: { nextCursor, hasMore, limit } }` — không có `total`/`page`.
         */
        get: operations["ProjectsController_listMembers"];
        put?: never;
        /** PROJ-09: Thêm thành viên project */
        post: operations["ProjectsController_addMember"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{id}/members/{userId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Xóa thành viên khỏi project */
        delete: operations["ProjectsController_removeMember"];
        options?: never;
        head?: never;
        /** PROJ-10: Đổi vai trò thành viên project */
        patch: operations["ProjectsController_updateMember"];
        trace?: never;
    };
    "/api/v1/projects/{id}/transfer-owner": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** PROJ-11: Nhượng quyền Project Owner */
        post: operations["ProjectsController_transferOwner"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/datasets/upload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** F4.1 (Wave 4): Streaming upload file CSV duy nhat (1 file = 1 bang) vao Project */
        post: operations["DatasetsController_uploadDataset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/datasets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** F4.2: Lay thong tin tap du lieu cua du an */
        get: operations["DatasetsController_getDatasetByProject"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/datasets/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** F4.3: Xem chi tiet thong tin tap du lieu (khong bao gom storage_key) */
        get: operations["DatasetsController_getDatasetById"];
        put?: never;
        post?: never;
        /** F4.5: Xoa mem tap du lieu va giai phong du an */
        delete: operations["DatasetsController_deleteDataset"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/datasets/{id}/file": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** FILE-01: Tải file gốc .csv (stream trực tiếp, có audit log) */
        get: operations["DatasetsController_downloadDatasetFile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/datasets/{id}/schema": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** F4.6: Xem schema voi key cot on dinh c0..cN */
        get: operations["DatasetsController_getDatasetSchema"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/datasets/{datasetId}/records": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** F5.1 (Wave 4): Keyset pagination cho Virtual Grid - { items, meta: { nextCursor, hasMore } } */
        get: operations["DataViewController_getRecords"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/datasets/{datasetId}/records/query": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** F5.4 (Wave 4): Truy van loc/sap xep/tim kiem tren props.cN + keyset pagination */
        post: operations["DataViewController_queryRecords"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/datasets/{datasetId}/columns/{columnKey}/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** F5.3 (Wave 4): Thong ke cot theo key on dinh c{i} (chap nhan ca ten hien thi) */
        get: operations["DataViewController_getColumnStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/datasets/{datasetId}/charts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** GĐ6/E1: So lieu bieu do (histogram, box plot, Top N) cho cac cot cua dataset */
        get: operations["DataViewController_getChartData"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/analysis": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** ANALYSIS-02: Chạy phân tích hệ thống (đồng bộ) + tạo AI job corr-v1 (bất đồng bộ) */
        post: operations["runAnalysis"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/analysis/result": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** ANALYSIS-03: Kết quả phân tích (DQ-05 có điều kiện + ma trận tương quan + VIF + nhận xét AI) */
        get: operations["getAnalysisResult"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analysis/jobs/{jobId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** AI-01: Trạng thái AI job corr-v1 */
        get: operations["getAiJob"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analysis/jobs/{jobId}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** AI-01: Thử lại AI job (không giới hạn — job cũ thành skipped) */
        post: operations["retryAiJob"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analysis/jobs/{jobId}/result": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** AI nội bộ: Gắn kết quả AI corr-v1 đã grounding vào analysis_result */
        post: operations["ingestAiResult"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** SUMMARY-01: Xem Tổng kết mới nhất */
        get: operations["getSummary"];
        put?: never;
        /** SUMMARY-01: Tạo Tổng kết từ kết quả phân tích hệ thống mới nhất */
        post: operations["createSummary"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/report": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** REPORT-01: Yêu cầu sinh PDF ở worker (202, không sinh tại API) */
        post: operations["requestReport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{projectId}/report/{reportId}/file": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** REPORT-01: Tải file PDF do worker sinh */
        get: operations["downloadReport"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** NOTIF-01: Trung tâm thông báo của chính mình */
        get: operations["NotificationsController_listNotifications"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/unread-count": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** NOTIF-01: Số thông báo chưa đọc */
        get: operations["NotificationsController_getUnreadCount"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** NOTIF-02: Chi tiết thông báo (mở là đánh dấu đã đọc) */
        get: operations["NotificationsController_getDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/{id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** NOTIF-02: Đánh dấu đã đọc */
        patch: operations["NotificationsController_markAsRead"];
        trace?: never;
    };
    "/api/v1/users/me/notification-preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** NOTIF-03: Bật/tắt nhận thông báo */
        patch: operations["NotificationsController_updatePreferences"];
        trace?: never;
    };
    "/api/v1/issues": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** ISSUE-02: Danh sách báo cáo của tôi */
        get: operations["IssuesController_listMine"];
        put?: never;
        /** ISSUE-01: Tạo báo cáo sự cố */
        post: operations["IssuesController_createReport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/issues/{id}/attachments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** ISSUE-01: Upload tệp đính kèm (png/jpg/pdf, <=10MB, tối đa 3 tệp) */
        post: operations["IssuesController_uploadAttachment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/issues/{id}/attachments/{attachmentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Tải tệp đính kèm báo cáo (kiểm tra quyền, có audit log) */
        get: operations["IssuesController_downloadAttachment"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/issues/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** ISSUE-03: Chi tiết báo cáo của tôi */
        get: operations["IssuesController_getMine"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** ISSUE-EDIT: Sửa báo cáo của tôi (chỉ khi status = needs_info — quản trị viên đã yêu cầu bổ sung) */
        patch: operations["IssuesController_updateMine"];
        trace?: never;
    };
    "/api/v1/admin/issues": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** ISSUE-04: Danh sách báo cáo (quản trị) */
        get: operations["IssuesController_listForAdmin"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/issues/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** ISSUE-04: Chi tiết báo cáo (quản trị) */
        get: operations["IssuesController_getForAdmin"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/issues/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** ISSUE-04: Đổi trạng thái báo cáo (optimistic locking) */
        patch: operations["IssuesController_updateStatus"];
        trace?: never;
    };
    "/api/v1/analyses/{analysisId}/findings/{findingId}/feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** FB-03: Xem nhận xét của một phát hiện */
        get: operations["FeedbackController_listFindingFeedback"];
        put?: never;
        /** FB-01: Nhận xét một phát hiện */
        post: operations["FeedbackController_createFindingFeedback"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analyses/{analysisId}/feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** FB-04: Xem nhận xét của một lần phân tích */
        get: operations["FeedbackController_listRunFeedback"];
        put?: never;
        /** FB-02: Nhận xét cả lần phân tích */
        post: operations["FeedbackController_createRunFeedback"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/feedback/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** FB-05: Xoá nhận xét (chủ, Owner xử lý vi phạm, hoặc System Admin kiểm duyệt) */
        delete: operations["FeedbackController_remove"];
        options?: never;
        head?: never;
        /** FB-05: Sửa nhận xét của chính mình (System Admin bị chặn) */
        patch: operations["FeedbackController_updateMine"];
        trace?: never;
    };
    "/api/v1/projects/{projectId}/ai-quality-metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** FB-06: Thống kê chất lượng AI theo project (System Admin bị chặn) */
        get: operations["FeedbackController_aiQualityMetrics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/overview/workspaces": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * E3: Tổng quan workspace của người dùng (5 chỉ số)
         * @description Trả về: `totalWorkspaces`, `totalProjects`, `ownedWorkspaces`, `sharedWorkspaces`, `myProjects`.
         */
        get: operations["OverviewController_userWorkspacesOverview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/{id}/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * E4: Tổng quan một không gian làm việc
         * @description Trả về: `projectCount`, `notStartedCount`, `inProgressCount`, `completedCount`, `memberCount`, `storageUsedBytes`, `lastAccessedAt`.
         */
        get: operations["OverviewController_workspaceOverview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: never;
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    AppController_getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Trạng thái hoạt động chi tiết */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AppController_getReady: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sẵn sàng */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Chưa sẵn sàng */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    UsersController_getProfile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thông tin hồ sơ người dùng thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    UsersController_deleteAccount: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Tài khoản đã được xóa mềm thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    UsersController_updateProfile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Thông tin cập nhật hồ sơ cá nhân */
        requestBody: {
            content: {
                "application/json": {
                    first_name?: string;
                    last_name?: string;
                    /** Format: uri */
                    avatar_url?: string;
                    phone?: string | null;
                    bio?: string | null;
                };
            };
        };
        responses: {
            /** @description Hồ sơ đã được cập nhật */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AdminUsersController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Danh sách hồ sơ — `{ items, meta: { nextCursor, hasMore, limit } }` (keyset cursor, không có `total`/`page`) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AdminUsersController_detail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AuthController_register: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Thông tin đăng ký tài khoản mới */
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                    password: string;
                    first_name: string;
                    last_name: string;
                };
            };
        };
        responses: {
            /** @description Tài khoản được tạo thành công */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": true,
                     *       "data": {
                     *         "id": "507f1f77bcf86cd799439011",
                     *         "email": "analyst@example.com",
                     *         "role": "analyst",
                     *         "first_name": "An",
                     *         "last_name": "Nguyen",
                     *         "created_at": "2026-11-22T04:00:00.000Z"
                     *       }
                     *     }
                     */
                    "application/json": unknown;
                };
            };
            /** @description Email, mật khẩu hoặc thông tin đăng ký không hợp lệ */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "VALIDATION_ERROR",
                     *         "message": "Dữ liệu gửi lên không hợp lệ.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/register"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Email đã được sử dụng; mã lỗi CONFLICT hoặc DUPLICATE_RESOURCE nếu xung đột tại database */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "CONFLICT",
                     *         "message": "Email này đã được sử dụng bởi một tài khoản khác",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/register"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Vượt 100 request đăng ký/giờ trên mỗi IP */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "LIMIT_EXCEEDED",
                     *         "message": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/register"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
        };
    };
    AuthController_login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Thông tin đăng nhập hệ thống */
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                    password: string;
                    /** @description Ghi nhớ đăng nhập: true → phiên 30 ngày, false/mặc định → 7 ngày. */
                    remember_me?: boolean;
                    /** @description Deprecated — alias của `remember_me`. Sẽ bị gỡ trong phiên bản sau. Không gửi cùng `remember_me` với giá trị khác nhau (sẽ trả 400). */
                    rememberMe?: boolean;
                };
            };
        };
        responses: {
            /** @description Đăng nhập thành công, trả về JWT Access Token và Refresh Token */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": true,
                     *       "data": {
                     *         "access_token": "<access_token>",
                     *         "refresh_token": "<refresh_token>",
                     *         "expires_in": 900,
                     *         "device_name": "Chrome on Windows",
                     *         "remember_me": false,
                     *         "expires_at": "2026-11-29T04:00:00.000Z",
                     *         "user": {
                     *           "id": "507f1f77bcf86cd799439011",
                     *           "email": "analyst@example.com",
                     *           "role": "analyst"
                     *         }
                     *       }
                     *     }
                     */
                    "application/json": unknown;
                };
            };
            /** @description Dữ liệu đầu vào không hợp lệ: email sai định dạng, thiếu mật khẩu hoặc sai kiểu dữ liệu */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "VALIDATION_ERROR",
                     *         "message": "Dữ liệu gửi lên không hợp lệ.",
                     *         "details": {
                     *           "fields": [
                     *             {
                     *               "field": "password",
                     *               "message": "Mật khẩu không được để trống",
                     *               "code": "too_small"
                     *             }
                     *           ]
                     *         },
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/login"
                     *       }
                     *     }
                     */
                    "application/json": unknown;
                };
            };
            /** @description Email hoặc mật khẩu không chính xác, tài khoản chưa có mật khẩu đăng nhập hoặc đã bị khóa */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "UNAUTHENTICATED",
                     *         "message": "Email hoặc mật khẩu không chính xác",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/login"
                     *       }
                     *     }
                     */
                    "application/json": unknown;
                };
            };
            /** @description Vượt giới hạn đăng nhập: tối đa 100 request trong 1 giờ cho mỗi IP trên endpoint này */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "LIMIT_EXCEEDED",
                     *         "message": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/login"
                     *       }
                     *     }
                     */
                    "application/json": unknown;
                };
            };
        };
    };
    AuthController_refresh: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Refresh token dùng để gia hạn access token */
        requestBody: {
            content: {
                "application/json": {
                    refresh_token: string;
                };
            };
        };
        responses: {
            /** @description Cấp mới Access Token và xoay vòng Refresh Token */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": true,
                     *       "data": {
                     *         "access_token": "<access_token>",
                     *         "refresh_token": "<refresh_token>",
                     *         "expires_in": 900,
                     *         "remember_me": false,
                     *         "expires_at": "2026-11-29T04:00:00.000Z"
                     *       }
                     *     }
                     */
                    "application/json": unknown;
                };
            };
            /** @description Thiếu refresh_token hoặc sai kiểu dữ liệu */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "VALIDATION_ERROR",
                     *         "message": "Dữ liệu gửi lên không hợp lệ.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/refresh"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Refresh token hết hạn/bị thu hồi/tái sử dụng hoặc tài khoản không hoạt động; mã TOKEN_EXPIRED, TOKEN_INVALID hoặc UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "TOKEN_EXPIRED",
                     *         "message": "Refresh token không hợp lệ hoặc đã hết hạn",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/refresh"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Vượt 100 request refresh/giờ trên mỗi IP */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "LIMIT_EXCEEDED",
                     *         "message": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/refresh"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
        };
    };
    AuthController_forgotPassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Email nhận mã OTP */
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                };
            };
        };
        responses: {
            /** @description Thông báo trung lập, không xác nhận email có tồn tại hay email đã gửi thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": true,
                     *       "data": {
                     *         "message": "Nếu email tồn tại trong hệ thống, mã OTP đã được gửi. Mã có hiệu lực 10 phút."
                     *       }
                     *     }
                     */
                    "application/json": unknown;
                };
            };
            /** @description Email không hợp lệ */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "VALIDATION_ERROR",
                     *         "message": "Dữ liệu gửi lên không hợp lệ.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/forgot-password"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Vượt 500 request/giờ/IP hoặc giới hạn 5 lần gửi OTP/giờ/tài khoản; lỗi quota OTP có thể kèm details.retryAfterSeconds và header Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "LIMIT_EXCEEDED",
                     *         "message": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/forgot-password"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
        };
    };
    AuthController_resetPassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Email + OTP + mật khẩu mới */
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                    otp: string;
                    new_password: string;
                };
            };
        };
        responses: {
            /** @description Đặt lại mật khẩu và thu hồi toàn bộ phiên đăng nhập */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": true,
                     *       "data": {
                     *         "message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại."
                     *       }
                     *     }
                     */
                    "application/json": unknown;
                };
            };
            /** @description Body sai, OTP sai/hết hạn/bị vô hiệu hóa do vượt số lần thử */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "VALIDATION_ERROR",
                     *         "message": "Dữ liệu gửi lên không hợp lệ.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/reset-password"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Tài khoản bị khóa */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "UNAUTHENTICATED",
                     *         "message": "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/reset-password"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Vượt 100 request đặt lại mật khẩu/giờ trên mỗi IP */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "LIMIT_EXCEEDED",
                     *         "message": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/reset-password"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
        };
    };
    AuthController_changePassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Mật khẩu hiện tại + mật khẩu mới 2 lần nhập */
        requestBody: {
            content: {
                "application/json": {
                    current_password: string;
                    new_password: string;
                    confirm_password: string;
                };
            };
        };
        responses: {
            /** @description Đổi mật khẩu, giữ phiên hiện tại và thu hồi các phiên khác */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": true,
                     *       "data": {
                     *         "message": "Đổi mật khẩu thành công."
                     *       }
                     *     }
                     */
                    "application/json": unknown;
                };
            };
            /** @description Body sai, mật khẩu hiện tại sai, mật khẩu mới trùng cũ hoặc xác nhận không khớp */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "VALIDATION_ERROR",
                     *         "message": "Dữ liệu gửi lên không hợp lệ.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/change-password"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Thiếu access token, token không hợp lệ/hết hạn hoặc tài khoản không còn hoạt động */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "UNAUTHENTICATED",
                     *         "message": "Phiên đăng nhập không hợp lệ hoặc đã hết hạn (Unauthorized)",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/change-password"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Vượt 500 request đổi mật khẩu/giờ trên mỗi IP */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "LIMIT_EXCEEDED",
                     *         "message": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/change-password"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
        };
    };
    AuthController_googleStart: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Chuyển hướng tới Google khi đã cấu hình OAuth; không trả JSON envelope */
            302: {
                headers: {
                    /** @description URL xác thực Google */
                    Location?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Giới hạn request theo IP; thử lại sau khi hết thời gian chặn */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "LIMIT_EXCEEDED",
                     *         "message": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/google"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Chưa cấu hình GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "DEPENDENCY_UNAVAILABLE",
                     *         "message": "Đăng nhập Google chưa được cấu hình. Cần GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET và GOOGLE_REDIRECT_URI.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/google"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
        };
    };
    AuthController_googleCallback: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Đăng nhập thành công ở chế độ JSON (mặc định), hoặc fallback khi không thể redirect */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": true,
                     *       "data": {
                     *         "access_token": "<access_token>",
                     *         "refresh_token": "<refresh_token>",
                     *         "expires_in": 900,
                     *         "remember_me": false,
                     *         "expires_at": "2026-11-29T04:00:00.000Z",
                     *         "device_name": "Chrome on Windows",
                     *         "user": {
                     *           "id": "507f1f77bcf86cd799439011",
                     *           "email": "analyst@example.com",
                     *           "role": "analyst"
                     *         },
                     *         "provider": "google"
                     *       }
                     *     }
                     */
                    "application/json": unknown;
                };
            };
            /** @description Chế độ redirect và APP_URL hợp lệ: chuyển về frontend, fragment chứa token khi thành công hoặc mã lỗi khi thất bại. Các lỗi OAuth bên dưới trả JSON khi không redirect; lỗi throttling vẫn trả 429. */
            302: {
                headers: {
                    /** @description URL frontend kèm fragment kết quả */
                    Location?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Google từ chối đăng nhập, code/state/token Google không hợp lệ hoặc email chưa xác minh (nhánh JSON) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "VALIDATION_ERROR",
                     *         "message": "Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/google/callback"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Tài khoản bị khóa (nhánh JSON) */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "FORBIDDEN",
                     *         "message": "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/google/callback"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Định danh Google đã thuộc tài khoản khác; có thể có DUPLICATE_RESOURCE khi database phát hiện trùng (nhánh JSON) */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "CONFLICT",
                     *         "message": "Không thể liên kết tài khoản Google. Định danh Google này đã được gắn với một tài khoản khác.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/google/callback"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Giới hạn request theo IP; thử lại sau khi hết thời gian chặn */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "LIMIT_EXCEEDED",
                     *         "message": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/google/callback"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Chưa cấu hình GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "DEPENDENCY_UNAVAILABLE",
                     *         "message": "Đăng nhập Google chưa được cấu hình. Cần GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET và GOOGLE_REDIRECT_URI.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/google/callback"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Không kết nối được dịch vụ Google hoặc Google tạm thời không khả dụng (nhánh JSON) */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "DEPENDENCY_UNAVAILABLE",
                     *         "message": "Không thể kết nối tới Google. Vui lòng thử lại sau.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/google/callback"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
        };
    };
    AuthController_logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Đăng xuất và thu hồi phiên hiện hành */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": true,
                     *       "data": {
                     *         "message": "Đăng xuất thành công"
                     *       }
                     *     }
                     */
                    "application/json": unknown;
                };
            };
            /** @description Thiếu access token, token không hợp lệ/hết hạn hoặc tài khoản không còn hoạt động */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "UNAUTHENTICATED",
                     *         "message": "Phiên đăng nhập không hợp lệ hoặc đã hết hạn (Unauthorized)",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/logout"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Giới hạn request theo IP; thử lại sau khi hết thời gian chặn */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "LIMIT_EXCEEDED",
                     *         "message": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/logout"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
        };
    };
    AuthController_getSessions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Các phiên đăng nhập đang hoạt động; data là mảng, có thể rỗng */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": true,
                     *       "data": [
                     *         {
                     *           "id": "507f1f77bcf86cd799439012",
                     *           "device_name": "Chrome on Windows",
                     *           "ip_address": "192.0.2.1",
                     *           "user_agent": "Mozilla/5.0 (example)",
                     *           "is_revoked": false,
                     *           "remember_me": false,
                     *           "last_used_at": "2026-11-22T04:00:00.000Z",
                     *           "expires_at": "2026-11-29T04:00:00.000Z",
                     *           "created_at": "2026-11-22T04:00:00.000Z"
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": unknown;
                };
            };
            /** @description Thiếu access token, token không hợp lệ/hết hạn hoặc tài khoản không còn hoạt động */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "UNAUTHENTICATED",
                     *         "message": "Phiên đăng nhập không hợp lệ hoặc đã hết hạn (Unauthorized)",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/sessions"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Giới hạn request theo IP; thử lại sau khi hết thời gian chặn */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "LIMIT_EXCEEDED",
                     *         "message": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/sessions"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
        };
    };
    AuthController_getCurrentSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Chi tiết phiên xác định bởi sessionId trong access token */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": true,
                     *       "data": {
                     *         "id": "507f1f77bcf86cd799439012",
                     *         "device_name": "Chrome on Windows",
                     *         "ip_address": "192.0.2.1",
                     *         "user_agent": "Mozilla/5.0 (example)",
                     *         "is_revoked": false,
                     *         "remember_me": false,
                     *         "last_used_at": "2026-11-22T04:00:00.000Z",
                     *         "expires_at": "2026-11-29T04:00:00.000Z",
                     *         "created_at": "2026-11-22T04:00:00.000Z"
                     *       }
                     *     }
                     */
                    "application/json": unknown;
                };
            };
            /** @description Thiếu access token, token không hợp lệ/hết hạn hoặc tài khoản không còn hoạt động */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "UNAUTHENTICATED",
                     *         "message": "Phiên đăng nhập không hợp lệ hoặc đã hết hạn (Unauthorized)",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/sessions/me"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Không tìm thấy phiên đăng nhập hoặc phiên thuộc người dùng khác */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "NOT_FOUND",
                     *         "message": "Không tìm thấy phiên đăng nhập",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/sessions/me"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Giới hạn request theo IP; thử lại sau khi hết thời gian chặn */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "LIMIT_EXCEEDED",
                     *         "message": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/sessions/me"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
        };
    };
    AuthController_getSessionById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Chi tiết phiên của chính người dùng, có thể bao gồm phiên đã thu hồi hoặc hết hạn */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": true,
                     *       "data": {
                     *         "id": "507f1f77bcf86cd799439012",
                     *         "device_name": "Chrome on Windows",
                     *         "ip_address": "192.0.2.1",
                     *         "user_agent": "Mozilla/5.0 (example)",
                     *         "is_revoked": false,
                     *         "remember_me": false,
                     *         "last_used_at": "2026-11-22T04:00:00.000Z",
                     *         "expires_at": "2026-11-29T04:00:00.000Z",
                     *         "created_at": "2026-11-22T04:00:00.000Z"
                     *       }
                     *     }
                     */
                    "application/json": unknown;
                };
            };
            /** @description Thiếu access token, token không hợp lệ/hết hạn hoặc tài khoản không còn hoạt động */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "UNAUTHENTICATED",
                     *         "message": "Phiên đăng nhập không hợp lệ hoặc đã hết hạn (Unauthorized)",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/sessions/507f1f77bcf86cd799439012"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Không tìm thấy phiên đăng nhập hoặc phiên thuộc người dùng khác */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "NOT_FOUND",
                     *         "message": "Không tìm thấy phiên đăng nhập",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/sessions/507f1f77bcf86cd799439012"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Giới hạn request theo IP; thử lại sau khi hết thời gian chặn */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "LIMIT_EXCEEDED",
                     *         "message": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/sessions/507f1f77bcf86cd799439012"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
        };
    };
    AuthController_revokeSession: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thu hồi phiên đăng nhập thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": true,
                     *       "data": {
                     *         "message": "Đã thu hồi phiên đăng nhập thành công"
                     *       }
                     *     }
                     */
                    "application/json": unknown;
                };
            };
            /** @description Phiên không tồn tại, thuộc người dùng khác hoặc đã bị thu hồi */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "VALIDATION_ERROR",
                     *         "message": "Không tìm thấy phiên đăng nhập hoặc phiên đã bị thu hồi trước đó",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/sessions/507f1f77bcf86cd799439012"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Thiếu access token, token không hợp lệ/hết hạn hoặc tài khoản không còn hoạt động */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "UNAUTHENTICATED",
                     *         "message": "Phiên đăng nhập không hợp lệ hoặc đã hết hạn (Unauthorized)",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/sessions/507f1f77bcf86cd799439012"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
            /** @description Giới hạn request theo IP; thử lại sau khi hết thời gian chặn */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": false,
                     *       "error": {
                     *         "code": "LIMIT_EXCEEDED",
                     *         "message": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
                     *         "timestamp": "2026-11-22T04:00:00.000Z",
                     *         "path": "/api/v1/auth/sessions/507f1f77bcf86cd799439012"
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: false;
                        error: {
                            code: string;
                            message: string;
                            details?: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            timestamp: string;
                            path: string;
                        };
                    };
                };
            };
        };
    };
    WorkspacesController_listWorkspaces: {
        parameters: {
            query?: {
                search?: string;
                role?: "owner" | "member";
                sort?: "last_accessed" | "updated" | "name_asc" | "name_desc" | "joined";
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspacesController_createWorkspace: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                    description?: string;
                    member_emails?: string[];
                };
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspacesController_getWorkspaceById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspacesController_deleteWorkspace: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công, không có nội dung phản hồi */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspacesController_updateWorkspace: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name?: string;
                    description?: string;
                    expectedVersion?: number;
                };
            };
        };
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspacesController_listMembers: {
        parameters: {
            query?: {
                search?: string;
                role?: "owner" | "member";
                sort?: "name_asc" | "name_desc" | "joined" | "role";
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspacesController_addMember: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                    /**
                     * @default member
                     * @enum {string}
                     */
                    role?: "owner" | "member";
                };
            };
        };
        responses: {
            /** @description Tạo mới thành công */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspacesController_removeMember: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspacesController_transferOwner: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                    expectedVersion: number;
                };
            };
        };
        responses: {
            /** @description Tạo mới thành công */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspacesController_leave: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Tạo mới thành công */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProjectsController_listByWorkspace: {
        parameters: {
            query?: {
                search?: string;
                status?: "not_started" | "in_progress" | "completed";
                sort?: "last_accessed" | "updated" | "name_asc" | "name_desc" | "joined";
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path: {
                workspaceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProjectsController_createProject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workspaceId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                    description?: string;
                    owner_id?: string;
                };
            };
        };
        responses: {
            /** @description Tạo mới thành công */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProjectsController_listAllProjects: {
        parameters: {
            query?: {
                search?: string;
                status?: "not_started" | "in_progress" | "completed";
                sort?: "last_accessed" | "updated" | "name_asc" | "name_desc" | "joined";
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Danh sách project + cursor phân trang */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProjectsController_getProjectById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProjectsController_deleteProject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công, không có nội dung phản hồi */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProjectsController_updateProject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name?: string;
                    description?: string;
                    expectedVersion?: number;
                };
            };
        };
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProjectsController_markCompleted: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    expectedVersion: number;
                };
            };
        };
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProjectsController_listMembers: {
        parameters: {
            query?: {
                search?: string;
                role?: "owner" | "member" | "viewer";
                sort?: "name_asc" | "name_desc" | "joined" | "role";
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProjectsController_addMember: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                    /**
                     * @default viewer
                     * @enum {string}
                     */
                    role?: "member" | "viewer";
                };
            };
        };
        responses: {
            /** @description Tạo mới thành công */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProjectsController_removeMember: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProjectsController_updateMember: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    role: "member" | "viewer";
                    expectedVersion: number;
                };
            };
        };
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProjectsController_transferOwner: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                    expectedVersion: number;
                };
            };
        };
        responses: {
            /** @description Tạo mới thành công */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DatasetsController_uploadDataset: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        /** @description File CSV duy nhat (field name: file) */
        requestBody: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                };
            };
        };
        responses: {
            /** @description Tạo mới thành công */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DatasetsController_getDatasetByProject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DatasetsController_getDatasetById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DatasetsController_deleteDataset: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công, không có nội dung phản hồi */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DatasetsController_downloadDatasetFile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description File CSV gốc (stream) — tải trực tiếp từ storage */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DatasetsController_getDatasetSchema: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DataViewController_getRecords: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
                sort_field?: string;
                sort_order?: "asc" | "desc";
            };
            header?: never;
            path: {
                datasetId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DataViewController_queryRecords: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                datasetId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @default [] */
                    filters?: {
                        column: string;
                        /** @enum {string} */
                        operator: "equals" | "notEquals" | "contains" | "notContains" | "startsWith" | "endsWith" | "greaterThan" | "greaterThanOrEqual" | "lessThan" | "lessThanOrEqual" | "between" | "in" | "isEmpty" | "isNotEmpty";
                        value?: unknown;
                    }[];
                    /** @default [] */
                    sort?: {
                        column: string;
                        /**
                         * @default asc
                         * @enum {string}
                         */
                        order?: "asc" | "desc";
                    }[];
                    search?: {
                        columns: string[];
                        value: string;
                    };
                    cursor?: string;
                    /** @default 50 */
                    limit?: number;
                };
            };
        };
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DataViewController_getColumnStats: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                datasetId: string;
                columnKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DataViewController_getChartData: {
        parameters: {
            query?: {
                columns?: string;
                top_n?: number;
                max_rows?: number;
            };
            header?: never;
            path: {
                datasetId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Số liệu biểu đồ của từng cột (một phần tử cho mỗi cột được chọn) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": true,
                     *       "data": {
                     *         "charts": [
                     *           {
                     *             "column_key": "c0",
                     *             "column_name": "amount",
                     *             "data_type": "number",
                     *             "total_records": 78,
                     *             "sampled_records": 78,
                     *             "truncated": false,
                     *             "missing_count": 0,
                     *             "missing_ratio": 0,
                     *             "histogram": {
                     *               "column_key": "c0",
                     *               "column_name": "amount",
                     *               "method": "freedman_diaconis",
                     *               "bins": [
                     *                 {
                     *                   "from": 10,
                     *                   "to": 15,
                     *                   "count": 12
                     *                 }
                     *               ]
                     *             },
                     *             "box_plot": {
                     *               "column_key": "c0",
                     *               "column_name": "amount",
                     *               "q1": 13.25,
                     *               "median": 17,
                     *               "q3": 21,
                     *               "whisker_low": 10,
                     *               "whisker_high": 25,
                     *               "outside_count": 1,
                     *               "n": 78
                     *             }
                     *           },
                     *           {
                     *             "column_key": "c1",
                     *             "column_name": "nhom",
                     *             "data_type": "string",
                     *             "total_records": 78,
                     *             "sampled_records": 78,
                     *             "truncated": false,
                     *             "missing_count": 0,
                     *             "missing_ratio": 0,
                     *             "category": {
                     *               "column_key": "c1",
                     *               "column_name": "nhom",
                     *               "top_n": 5,
                     *               "items": [
                     *                 {
                     *                   "value": "A",
                     *                   "count": 13,
                     *                   "rate": 0.1667
                     *                 }
                     *               ],
                     *               "other": {
                     *                 "count": 13,
                     *                 "rate": 0.1667
                     *               },
                     *               "distinct_count": 6
                     *             }
                     *           }
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": {
                        /** @enum {boolean} */
                        success: true;
                        data: {
                            /** @description Một phần tử cho mỗi cột (không phải 3 mảng tách biệt). */
                            charts: {
                                /** @description Key ổn định của cột (vd "c3"). */
                                column_key: string;
                                /** @description Tên hiển thị của cột. */
                                column_name: string;
                                /**
                                 * @description Kiểu dữ liệu đã suy luận của cột.
                                 * @enum {string}
                                 */
                                data_type: "string" | "number" | "boolean" | "date";
                                /** @description Tổng số dòng toàn bộ dataset. */
                                total_records: number;
                                /** @description Số dòng thực sự đọc để tính (bị giới hạn bởi `max_rows`). */
                                sampled_records: number;
                                /** @description `true` khi số liệu được tính trên **mẫu** chứ không phải toàn bộ dataset. */
                                truncated: boolean;
                                /** @description Số giá trị thiếu trong mẫu đã đọc. */
                                missing_count: number;
                                /** @description `missing_count / sampled_records` (không làm tròn). */
                                missing_ratio: number;
                                /** @description Chỉ có với cột `number`. */
                                histogram?: {
                                    /** @description Key ổn định của cột (vd "c3"). */
                                    column_key: string;
                                    /** @description Tên hiển thị của cột. */
                                    column_name: string;
                                    /**
                                     * @description Cách chọn số bin: `freedman_diaconis` (2·IQR·n^(-1/3)), `sturges` (ceil(log2 n)+1) khi IQR = 0, `single_value` khi cột chỉ có một giá trị.
                                     * @enum {string}
                                     */
                                    method: "freedman_diaconis" | "sturges" | "single_value";
                                    /** @description Các bin đã sắp xếp tăng dần; tối đa 50 bin. */
                                    bins: {
                                        /** @description Cận trái của bin (số thực). */
                                        from: number;
                                        /** @description Cận phải của bin (số thực). */
                                        to: number;
                                        /** @description Số giá trị rơi vào bin này. */
                                        count: number;
                                    }[];
                                };
                                /** @description Chỉ có với cột `number`. */
                                box_plot?: {
                                    /** @description Key ổn định của cột (vd "c3"). */
                                    column_key: string;
                                    /** @description Tên hiển thị của cột. */
                                    column_name: string;
                                    /** @description Tứ phân vị 1 (nội suy type 7). */
                                    q1: number;
                                    /** @description Trung vị (nội suy type 7). */
                                    median: number;
                                    /** @description Tứ phân vị 3 (nội suy type 7). */
                                    q3: number;
                                    /** @description Râu dưới: giá trị nhỏ nhất còn nằm trong rào IQR 1,5×. */
                                    whisker_low: number;
                                    /** @description Râu trên: giá trị lớn nhất còn nằm trong rào IQR 1,5×. */
                                    whisker_high: number;
                                    /** @description Số giá trị nằm ngoài rào — **không** mặc định là lỗi dữ liệu. */
                                    outside_count: number;
                                    /** @description Số quan sát số hữu ích đã dùng để tính. */
                                    n: number;
                                };
                                /** @description Chỉ có với cột `string` / `boolean`. */
                                category?: {
                                    /** @description Key ổn định của cột (vd "c3"). */
                                    column_key: string;
                                    /** @description Tên hiển thị của cột. */
                                    column_name: string;
                                    /** @description Số nhóm tối đa được trả về (theo `top_n` của request). */
                                    top_n: number;
                                    /** @description Các nhóm phổ biến nhất, đã sắp xếp giảm dần theo count. */
                                    items: {
                                        /** @description Giá trị của nhóm (đã chuẩn hoá sang chuỗi). */
                                        value: string;
                                        /** @description Số bản ghi thuộc nhóm này. */
                                        count: number;
                                        /** @description Tỷ trọng = count / (số giá trị không thiếu), làm tròn 4 chữ số thập phân. */
                                        rate: number;
                                    }[];
                                    /** @description Nhóm "các giá trị còn lại" — `null` khi không có giá trị nào ngoài Top N. */
                                    other: {
                                        /** @description Số bản ghi còn lại ngoài Top N. */
                                        count: number;
                                        /** @description Tỷ trọng của nhóm "còn lại". */
                                        rate: number;
                                    } | null;
                                    /** @description Tổng số giá trị khác nhau (không tính rỗng). */
                                    distinct_count: number;
                                    /** @description `true` khi cột bị đánh dấu PII ⇒ **không** trả giá trị thô; chỉ có `distinct_count` và thống kê thiếu. `items` sẽ là mảng rỗng. */
                                    masked?: boolean;
                                };
                            }[];
                        };
                    };
                };
            };
            /** @description Dataset khong ton tai hoac khong co cot nao khop `columns` */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    runAnalysis: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * @default pearson
                     * @enum {string}
                     */
                    correlation_method?: "pearson" | "spearman";
                    /**
                     * @default iqr
                     * @enum {string}
                     */
                    outlier_method?: "iqr" | "modified_zscore" | "both";
                    /** @default 10 */
                    top_n?: number;
                    /** @default 5 */
                    chart_top_n?: number;
                };
            };
        };
        responses: {
            /** @description Tạo mới thành công */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getAnalysisResult: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getAiJob: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                jobId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    retryAiJob: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                jobId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Đã tiếp nhận yêu cầu (xử lý bất đồng bộ) */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ingestAiResult: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                jobId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getSummary: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    createSummary: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Tạo mới thành công */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    requestReport: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Đã tiếp nhận yêu cầu (xử lý bất đồng bộ) */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    downloadReport: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
                reportId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description File PDF (stream) — tải về khi report đã sinh xong */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Report chưa sẵn sàng — trả metadata trạng thái để client thử lại */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    NotificationsController_listNotifications: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
                sortBy?: "createdAt";
                sortOrder?: "asc" | "desc";
                read?: "true" | "false" | "all";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    NotificationsController_getUnreadCount: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    NotificationsController_getDetail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    NotificationsController_markAsRead: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    NotificationsController_updatePreferences: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    notificationsEnabled: boolean;
                };
            };
        };
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IssuesController_listMine: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
                sortBy?: "createdAt" | "updatedAt" | "status";
                sortOrder?: "asc" | "desc";
                status?: "new" | "needs_info" | "in_progress" | "resolved" | "closed";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IssuesController_createReport: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    issueType: "function_error" | "display_error" | "data_error" | "feature_feedback" | "other";
                    title: string;
                    description: string;
                    workspaceId?: string;
                    apiPath?: string;
                    errorMessage?: string;
                    /** Format: date-time */
                    occurredAt?: string;
                };
            };
        };
        responses: {
            /** @description Tạo mới thành công */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IssuesController_uploadAttachment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Tạo mới thành công */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IssuesController_downloadAttachment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                attachmentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description File đính kèm (stream) — tải trực tiếp từ storage */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IssuesController_getMine: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IssuesController_updateMine: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    title?: string;
                    description?: string;
                    removeAttachmentIds?: string[];
                    expectedVersion: number;
                };
            };
        };
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IssuesController_listForAdmin: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
                sortBy?: "createdAt" | "updatedAt" | "status" | "severity";
                sortOrder?: "asc" | "desc";
                status?: "new" | "needs_info" | "in_progress" | "resolved" | "closed";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IssuesController_getForAdmin: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IssuesController_updateStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    status: "new" | "needs_info" | "in_progress" | "resolved" | "closed";
                    expectedVersion: number;
                };
            };
        };
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    FeedbackController_listFindingFeedback: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
                label?: "correct" | "partially_correct" | "false_positive" | "missed_issue" | "other";
                sortOrder?: "asc" | "desc";
            };
            header?: never;
            path: {
                analysisId: string;
                findingId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    FeedbackController_createFindingFeedback: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                analysisId: string;
                findingId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    label: "correct" | "partially_correct" | "false_positive" | "missed_issue" | "other";
                    reason?: string | null;
                    /** @enum {string|null} */
                    suggestedSeverity?: "low" | "medium" | "high" | "critical" | null;
                };
            };
        };
        responses: {
            /** @description Tạo mới thành công */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    FeedbackController_listRunFeedback: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
                label?: "correct" | "partially_correct" | "false_positive" | "missed_issue" | "other";
                sortOrder?: "asc" | "desc";
            };
            header?: never;
            path: {
                analysisId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    FeedbackController_createRunFeedback: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                analysisId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    label: "correct" | "partially_correct" | "false_positive" | "missed_issue" | "other";
                    reason?: string | null;
                    /** @enum {string|null} */
                    suggestedSeverity?: "low" | "medium" | "high" | "critical" | null;
                };
            };
        };
        responses: {
            /** @description Tạo mới thành công */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    FeedbackController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    FeedbackController_updateMine: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    label?: "correct" | "partially_correct" | "false_positive" | "missed_issue" | "other";
                    reason?: string | null;
                    /** @enum {string|null} */
                    suggestedSeverity?: "low" | "medium" | "high" | "critical" | null;
                };
            };
        };
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description System Admin không có quyền với nhóm nhận xét */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    FeedbackController_aiQualityMetrics: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OverviewController_userWorkspacesOverview: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Các chỉ số tổng quan workspace */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OverviewController_workspaceOverview: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Các chỉ số tổng quan workspace */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Không tìm thấy không gian làm việc */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}
