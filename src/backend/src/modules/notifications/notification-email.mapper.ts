/** NOTIFICATIONS — Anh xa loai thong bao -> kenh email (Template Simple). GIU RIENG, KHONG gop voi notification.mapper. */
import type { EmailTemplate } from '../../shared/application/ports/email.port';
import {
  analysisCompletedTemplate,
  analysisFailedTemplate,
  genericTemplate,
  issueNeedsInfoTemplate,
  issueResolvedTemplate,
  reportReadyTemplate,
  securityAlertTemplate,
} from '../../shared/domain/utils/email-templates';
import type { NotificationType } from './notifications.types';

/** Ket qua dung email cho mot thong bao. */
export interface NotificationEmailDraft {
  template: EmailTemplate;
  subject: string;
  html: string;
  text: string;
}

/** Tham so dung email — tuy chon theo loai thong bao. */
export interface NotificationEmailContext {
  appUrl: string;
  projectName?: string | null;
  issueTitle?: string | null;
  reason?: string | null;
  detail?: string | null;
}

/** Dung noi dung email cho mot loai thong bao. Tra ve null = KHONG gui qua email. */
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
      const built = analysisCompletedTemplate(projectName, summary, `${ctx.appUrl}/analysis`);
      return { template: 'analysis_completed', ...built };
    }
    case 'analysis_failed': {
      const projectName = ctx.projectName ?? title;
      const built = analysisFailedTemplate(projectName, ctx.reason ?? summary, `${ctx.appUrl}/analysis`);
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
      return null;
  }
}
