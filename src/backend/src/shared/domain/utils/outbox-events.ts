/**
 * SHARED — Danh mục tên event **outbox** của hệ thống.
 *
 * ── Vì sao cần file này? ─────────────────────────────────────────────────
 * Trước đây tên event outbox được **viết literal rải rác** ở nhiều nơi:
 *   - `'DATASET_INGESTED'` trong `ingest-dataset-stream.handler.ts`
 *   - `'WORKSPACE_DELETED'` trong `cascade-workspace-projects.handler.ts`
 *   - `'PROJECT_DELETED'` trong `cascade-project-datasets.handler.ts`
 *   - `'DATASET_INGESTED'`, `'ANALYSIS_STARTED'`, … trong
 *     `event-dispatcher.service.ts` (switch-case)
 *
 * Hệ quả: đổi tên event ở một nơi ⇒ các nơi khác **âm thầm không khớp**.
 * Đặc biệt nguy hiểm với `EventDispatcherService.route()`: một tên sai
 * không báo lỗi, chỉ **rơi xuống `default`** ⇒ realtime im lặng, không ai biết.
 *
 * ── Vì sao đặt ở `shared/domain/utils/`? ──────────────────────────────────
 * - `shared/infrastructure/events/event-dispatcher.service.ts` cần dùng mà
 *   **không được** import từ `modules/` (quy tắc CA5 — shared là lớp
 *   cross-cutting, không biết module nghiệp vụ).
 * - Module nghiệp vụ (`datasets`, `projects`, `workspaces`) cần dùng mà
 *   `domain/` chỉ được import `shared/` ở các thư mục thuần
 *   (quy tắc CA11 — `utils|validation|crypto`).
 *
 * → `shared/domain/utils/` là nơi duy nhất thỏa cả hai ràng buộc.
 *
 * ── Quy ước phân biệt hai loại tên ────────────────────────────────────────
 * 1. **Event outbox** (file này) — ký hiệu `UPPER_SNAKE`
 *    (`DATASET_INGESTED`, `WORKSPACE_DELETED`, `PROJECT_DELETED`).
 *    Đây là tên ghi vào collection `outbox_events` và tên mà
 *    `EventDispatcherService` + `DomainEventHandlerRegistry` khớp theo.
 * 2. **Domain event của entity** (`dataset.ingested`, `workspace.created`, …)
 *    — ký hiệu `dot.case`, khai báo trong `modules/<m>/domain/events/`.
 *    Hai nhóm này là **hai không gian tên khác nhau**, không được trộn.
 *
 * ⚠️ Lưu ý: entity domain event (`addDomainEvent`) hiện **chưa** được rút
 * vào outbox ⇒ `DATASET_EVENTS.INGESTED` (`dataset.ingested`) là tên **chưa
 * dùng** trong production. Tên outbox chuẩn của việc nạp dataset là
 * `DATASET_INGESTED` (hằng `DATASET_OUTBOX_EVENTS.INGESTED`).
 */

/** Event outbox của module `datasets`. */
export const DATASET_OUTBOX_EVENTS = {
  /** Dataset nạp CSV thành công (kèm metadata file, số dòng/cột). */
  INGESTED: 'DATASET_INGESTED',
} as const;

/** Event outbox của module `projects`. */
export const PROJECT_OUTBOX_EVENTS = {
  /** Project bị xóa mềm → trigger cascade xóa dataset (và file R2) bên trong. */
  DELETED: 'PROJECT_DELETED',
} as const;

/** Event outbox của module `workspaces`. */
export const WORKSPACE_OUTBOX_EVENTS = {
  /** Workspace bị xóa mềm → trigger cascade xóa project (và dataset) bên trong. */
  DELETED: 'WORKSPACE_DELETED',
} as const;

export type DatasetOutboxEventName = (typeof DATASET_OUTBOX_EVENTS)[keyof typeof DATASET_OUTBOX_EVENTS];
export type ProjectOutboxEventName = (typeof PROJECT_OUTBOX_EVENTS)[keyof typeof PROJECT_OUTBOX_EVENTS];
export type WorkspaceOutboxEventName =
  (typeof WORKSPACE_OUTBOX_EVENTS)[keyof typeof WORKSPACE_OUTBOX_EVENTS];
