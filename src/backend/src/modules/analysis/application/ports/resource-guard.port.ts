/**
 * Port kiểm soát tài nguyên cho hàng đợi AI.
 *
 * Yêu cầu (Phần 12 v8 §3.15.4 + §3.9):
 *  - Nếu RSS của engine vượt 85% RAM máy → **tạm dừng nhận job AI mới**.
 *  - Nếu RAM khả dụng < `AI_MIN_RAM_GB` (mặc định 12 GB) → **tạm dừng nhận job AI mới**.
 *
 * Mục đích: trên VPS 15 GB, engine suy luận và API dùng chung RAM. Không có cơ chế
 * này, một đợt suy luận dài sẽ OOM và làm sập API.
 *
 * Đặt ở tầng `application/ports` (hướng vào trong): tầng ứng dụng chỉ biết port,
 * adapter đọc `/proc` thuộc tầng `infrastructure`.
 */
export interface ResourceGuardStatus {
  /** true khi không được nhận job AI mới. */
  blocked: boolean;
  /** Lý do chặn (rỗng nếu không chặn). */
  reason: string;
  /** RAM khả dụng (bytes). */
  availableBytes: number;
  /** Tổng RAM máy (bytes). */
  totalBytes: number;
  /** RSS của engine suy luận (bytes). */
  engineRssBytes: number;
}

export abstract class ResourceGuardPort {
  /** Kiểm tra tài nguyên hiện tại. */
  abstract check(): ResourceGuardStatus;

  /** true nếu được phép nhận job AI mới. */
  abstract canAcceptAiJob(): boolean;

  /** Lý do cụ thể khi bị chặn (để ghi log/ghi vào job). */
  abstract blockReason(): string | null;
}

/** Token DI cho `ResourceGuardPort`. */
export const RESOURCE_GUARD_PORT = Symbol('RESOURCE_GUARD_PORT');
