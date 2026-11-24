/**
 * ISSUE-STATUS — Domain value object: trạng thái báo cáo sự cố + luồng chuyển hợp lệ.
 *
 * Vòng đời:
 *   new ──────────────► in_progress ──────────► resolved ──► closed
 *    │                     │  ▲
 *    │                     ▼  │
 *    └──────────────► needs_info ─┘
 *
 * `needs_info` = quản trị viên yêu cầu người dùng bổ sung thông tin.
 * Khi đó người dùng được phép sửa `title`/`description`/`attachments` của chính báo cáo
 * (không được sửa `issueType`) và gửi lại — báo cáo tự quay về `in_progress`.
 */

export const ISSUE_STATUSES = ['new', 'needs_info', 'in_progress', 'resolved', 'closed'] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** Trạng thái mà người dùng được phép tự sửa báo cáo. */
export const USER_EDITABLE_ISSUE_STATUSES: IssueStatus[] = ['needs_info'];

export const ALLOWED_ISSUE_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  new: ['in_progress', 'needs_info'],
  needs_info: ['in_progress'],
  in_progress: ['resolved', 'new', 'needs_info'],
  resolved: ['closed'],
  closed: [],
};

export function isAllowedIssueTransition(from: IssueStatus, to: IssueStatus): boolean {
  return (ALLOWED_ISSUE_TRANSITIONS[from] ?? []).includes(to);
}

export function assertAllowedIssueTransition(from: IssueStatus, to: IssueStatus): void {
  if (!isAllowedIssueTransition(from, to)) {
    throw new Error(`Chuyen trang thai khong hop le: ${from} -> ${to}`);
  }
}

/** Người dùng có được tự sửa báo cáo ở trạng thái này không? */
export function isUserEditableIssueStatus(status: IssueStatus): boolean {
  return USER_EDITABLE_ISSUE_STATUSES.includes(status);
}
