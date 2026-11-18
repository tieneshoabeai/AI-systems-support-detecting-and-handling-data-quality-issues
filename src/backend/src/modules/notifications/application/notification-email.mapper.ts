/**
 * NOTIFICATIONS — Ánh xạ loại thông báo → kênh email.
 *
 * Hàm thuần (không framework, không I/O) → đặt ở tầng `application/`.
 *
 * Vì sao không đặt ở `domain/`?
 * `domain/` chỉ được import `shared/` ở thư mục thuần (utils|validation|crypto).
 * Các hàm dựng nội dung email nằm ở `shared/domain/utils/email-templates.ts` — hợp lệ.
 * Nhưng mapper này phụ thuộc `NotificationType` (một khái niệm nghiệp vụ của
 * module notifications) và phụ thuộc `EmailTemplate` của hợp đồng hạ tầng —
 * đặt ở `application/` là vị trí tự nhiên cho logic phối hợp.
 */

import type { EmailTemplate } from '../../../shared/application/ports/email.port';
import {
  analysisCompletedTemplate,
  analysisFailedTemplate,
  genericTemplate,
  issueNeedsInfoTemplate,
  issueResolvedTemplate,
  reportReadyTemplate,
  securityAlertTemplate,
} from '../../../shared/domain/utils/email-templates';
import type { NotificationType } from '../domain/value-objects/notification-type.vo';

/** Kết quả dựng email cho một thông báo. */
export interface NotificationEmailDraft {
  template: EmailTemplate;
  subject: string;
  html: string;
  text: string;
}

/**
 * Tham số dựng email — tùy chọn theo loại thông báo.
 * `appUrl` là URL gốc của ứng dụng (VD: `http://localhost:5173`).
 */
export interface NotificationEmailContext {
  appUrl: string;
  /** Tên project (dùng cho analysis/report). */
  projectName?: string | null;
  /** Tên báo cáo (dùng cho issue). */
  issueTitle?: string | null;
  /** Lý do (dùng cho analysis_failed). */
  reason?: string | null;
  /** Mô tả thêm (dùng cho security_alert). */
  detail?: string | null;
}

/**
 * Dựng nội dung email cho một loại thông báo.
 *
 * @returns `null` nghĩa là loại thông báo này KHÔNG gửi qua email
 *          (chỉ hiển thị trong trung tâm thông báo trong ứng dụng).
 */
export function buildNotificationEmail(
  type: NotificationType,
  title: string,
  summary: string | null,
  ctx: NotificationEmailContext,
): NotificationEmailDraft | null {
  switch (type) {
    case 'issue_needs_info': {
      const issueTitle = ctx.issueTitle ?? title;
      const built = issueNeedsInfoTemplate(issueTitle, `${ctx.appUrl}/issues`);
      return { template: 'issue_needs_info', ...built };
    }
    case 'issue_resolved': {
      const issueTitle = ctx.issueTitle ?? title;
      const built = issueResolvedTemplate(issueTitle, `${ctx.appUrl}/issues`);
      return { template: 'issue_resolved', ...built };
    }
    case 'analysis_completed': {
      const projectName = ctx.projectName ?? title;
      const built = analysisCompletedTemplate(
        projectName,
        summary,
        `${ctx.appUrl}/analysis`,
      );
      return { template: 'analysis_completed', ...built };
    }
    case 'analysis_failed': {
      const projectName = ctx.projectName ?? title;
      const built = analysisFailedTemplate(
        projectName,
        ctx.reason ?? summary,
        `${ctx.appUrl}/analysis`,
      );
      return { template: 'analysis_failed', ...built };
    }
    case 'report_ready': {
      const projectName = ctx.projectName ?? title;
      const built = reportReadyTemplate(projectName, `${ctx.appUrl}/reports`);
      return { template: 'report_ready', ...built };
    }
    case 'security_alert': {
      const built = securityAlertTemplate(title, ctx.detail ?? summary);
      return { template: 'security_alert', ...built };
    }
    case 'project_created':
    case 'project_deleted':
    case 'project_member_added':
    case 'ai_analysis_ready': {
      const built = genericTemplate(title, summary ?? '', `${ctx.appUrl}`);
      return { template: 'generic', ...built };
    }
    default:
      // Loại chưa hỗ trợ email → chỉ hiển thị trong ứng dụng.
      return null;
  }
}
