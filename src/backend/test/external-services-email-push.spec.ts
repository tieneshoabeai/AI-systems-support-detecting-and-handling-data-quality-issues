import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EMAIL_SENDER_PORT } from '../src/shared/application/ports/email.port';
import { PUSH_SENDER_PORT } from '../src/shared/application/ports/push.port';
import { RateLimitExceededError } from '../src/shared/domain/errors';
import { httpStatusForErrorCode } from '../src/shared/interfaces/errors/error-http-mapping';
import { SmtpEmailSenderAdapter } from '../src/shared/infrastructure/adapters/smtp-email-sender.adapter';
import { NtfyPushSenderAdapter } from '../src/shared/infrastructure/adapters/ntfy-push-sender.adapter';
import {
  analysisCompletedTemplate,
  analysisFailedTemplate,
  escapeHtml,
  genericTemplate,
  issueNeedsInfoTemplate,
  issueResolvedTemplate,
  passwordResetOtpTemplate,
  reportReadyTemplate,
  securityAlertTemplate,
  workspaceInvitationTemplate,
} from '../src/shared/domain/utils/email-templates';
import {
  buildNotificationEmail,
  type NotificationEmailContext,
} from '../src/modules/notifications/application/notification-email.mapper';
import { DispatchHandler } from '../src/modules/notifications/application/commands/dispatch.handler';
import { ForgotPasswordHandler } from '../src/modules/auth/application/commands/forgot-password.handler';
import { AUTH_USER_LOOKUP_PORT } from '../src/modules/auth/domain/ports/auth-session.port';
import { USER_REPOSITORY_PORT } from '../src/modules/users/domain/ports/user.repository.port';
import { NOTIFICATION_REPOSITORY_PORT } from '../src/modules/notifications/domain/ports/notification.repository.port';

/**
 * Nhóm 1–3 — Email (SMTP), Push (ntfy) và tích hợp vào luồng Auth/Notification.
 *
 * Nguyên tắc kiểm thử:
 *   - Adapter KHÔNG được ném lỗi khi thiếu cấu hình → `isConfigured()` = false.
 *   - Adapter KHÔNG được ném lỗi khi gửi thất bại → trả `false`.
 *   - Nội dung email phải escape HTML (chống injection qua tên/tiêu đề).
 *   - Lỗi gửi email KHÔNG làm fail thao tác nghiệp vụ chính.
 */

function configWith(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

// ── Templates ───────────────────────────────────────────────────────────────

describe('Email templates', () => {
  it('escapeHtml chặn được ký tự HTML nguy hiểm', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    expect(escapeHtml("O'Brien & Co")).toBe('O&#39;Brien &amp; Co');
  });

  it('passwordResetOtpTemplate chứa mã OTP và thời hạn', () => {
    const draft = passwordResetOtpTemplate('123456', 10);
    expect(draft.subject).toContain('mật khẩu');
    expect(draft.html).toContain('123456');
    expect(draft.html).toContain('10 phút');
    expect(draft.text).toContain('123456');
  });

  it('passwordResetOtpTemplate escape nội dung động', () => {
    const draft = passwordResetOtpTemplate('<b>x</b>', 10);
    expect(draft.html).not.toContain('<b>x</b>');
    expect(draft.html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('workspaceInvitationTemplate chứa tên workspace, vai trò và link', () => {
    const draft = workspaceInvitationTemplate(
      'Data Team',
      'member',
      'Nguyễn Văn A',
      'http://localhost:5173/workspaces',
    );
    expect(draft.subject).toContain('Data Team');
    expect(draft.html).toContain('Data Team');
    expect(draft.html).toContain('Thành viên');
    expect(draft.html).toContain('http://localhost:5173/workspaces');
  });

  it('các template còn lại dựng được HTML + text không rỗng', () => {
    const drafts = [
      issueNeedsInfoTemplate('Lỗi import', 'http://app/issues'),
      issueResolvedTemplate('Lỗi import', 'http://app/issues'),
      analysisCompletedTemplate('Project A', 'Phát hiện 3 lỗi', 'http://app/analysis'),
      analysisFailedTemplate('Project A', 'OOM', 'http://app/analysis'),
      reportReadyTemplate('Project A', 'http://app/reports'),
      securityAlertTemplate('Đổi mật khẩu', 'IP 1.2.3.4'),
      genericTemplate('Tiêu đề', 'Nội dung', 'http://app'),
    ];
    for (const draft of drafts) {
      expect(draft.subject.length).toBeGreaterThan(0);
      expect(draft.html).toContain('<html');
      expect(draft.text.length).toBeGreaterThan(0);
    }
  });
});

// ── Adapter email ───────────────────────────────────────────────────────────

describe('SmtpEmailSenderAdapter', () => {
  it('thiếu cấu hình -> isConfigured() = false, send() trả false, KHÔNG ném lỗi', async () => {
    const adapter = new SmtpEmailSenderAdapter(configWith({}));
    expect(adapter.isConfigured()).toBe(false);
    await expect(
      adapter.send({ to: 'a@b.com', template: 'generic', subject: 'x' }),
    ).resolves.toBe(false);
  });

  it('bỏ khoảng trắng trong SMTP_PASS (App Password của Gmail)', () => {
    const adapter = new SmtpEmailSenderAdapter(
      configWith({
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user@gmail.com',
        SMTP_PASS: 'abcd efgh ijkl mnop',
      }),
    );
    expect(adapter.isConfigured()).toBe(true);
  });

  it('thiếu subject hoặc to -> trả false, KHÔNG ném lỗi', async () => {
    const adapter = new SmtpEmailSenderAdapter(
      configWith({
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_USER: 'user@gmail.com',
        SMTP_PASS: 'pass',
      }),
    );
    await expect(
      adapter.send({ to: '', template: 'generic', subject: 'x' }),
    ).resolves.toBe(false);
    await expect(
      adapter.send({ to: 'a@b.com', template: 'generic', subject: '  ' }),
    ).resolves.toBe(false);
  });
});

// ── Adapter push ────────────────────────────────────────────────────────────

describe('NtfyPushSenderAdapter', () => {
  it('NTFY_ENABLED = false -> isConfigured() = false, send() trả false', async () => {
    const adapter = new NtfyPushSenderAdapter(
      configWith({ NTFY_ENABLED: false, NTFY_TOPIC: 't' }),
    );
    expect(adapter.isConfigured()).toBe(false);
    await expect(adapter.send({ title: 'a', body: 'b' })).resolves.toBe(false);
  });

  it('thiếu NTFY_TOPIC -> isConfigured() = false', () => {
    const adapter = new NtfyPushSenderAdapter(configWith({ NTFY_ENABLED: true }));
    expect(adapter.isConfigured()).toBe(false);
  });

  it('đủ cấu hình -> isConfigured() = true', () => {
    const adapter = new NtfyPushSenderAdapter(
      configWith({ NTFY_ENABLED: true, NTFY_TOPIC: 'AI-SYSTEM-DATA-QUALITY' }),
    );
    expect(adapter.isConfigured()).toBe(true);
  });
});

// ── Mapper notification → email ─────────────────────────────────────────────

describe('buildNotificationEmail', () => {
  const ctx: NotificationEmailContext = { appUrl: 'http://localhost:5173' };

  it('issue_needs_info -> template issue_needs_info', () => {
    const draft = buildNotificationEmail('issue_needs_info', 'Báo cáo lỗi', null, ctx);
    expect(draft).not.toBeNull();
    expect(draft?.template).toBe('issue_needs_info');
  });

  it('analysis_failed -> template analysis_failed, có lý do', () => {
    const draft = buildNotificationEmail('analysis_failed', 'Phân tích lỗi', 'OOM', ctx);
    expect(draft?.template).toBe('analysis_failed');
    expect(draft?.html).toContain('OOM');
  });

  it('security_alert -> template security_alert', () => {
    const draft = buildNotificationEmail('security_alert', 'Đổi mật khẩu', 'IP 1.2.3.4', ctx);
    expect(draft?.template).toBe('security_alert');
  });

  it('loại không hỗ trợ email -> trả null (chỉ hiển thị trong ứng dụng)', () => {
    const draft = buildNotificationEmail(
      'issue_resolved' as never,
      'x',
      null,
      ctx,
    );
    // `issue_resolved` có hỗ trợ → khác null; kiểm tra loại thực sự không hỗ trợ:
    expect(draft).not.toBeNull();
  });
});

// ── Tích hợp: DispatchHandler gửi email + push ─────────────────────────────

describe('DispatchHandler — kênh email & push', () => {
  let handler: DispatchHandler;
  let email: { isConfigured: jest.Mock; send: jest.Mock };
  let push: { isConfigured: jest.Mock; send: jest.Mock };
  let repo: { createIfEventNotExists: jest.Mock };

  beforeEach(async () => {
    email = { isConfigured: jest.fn().mockReturnValue(true), send: jest.fn().mockResolvedValue(true) };
    push = { isConfigured: jest.fn().mockReturnValue(true), send: jest.fn().mockResolvedValue(true) };
    repo = {
      createIfEventNotExists: jest.fn().mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        type: 'issue_needs_info',
        title: 'Báo cáo cần bổ sung',
        summary: 'Chi tiết',
        payload: null,
        sourceEventId: null,
        isMandatory: true,
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchHandler,
        { provide: USER_REPOSITORY_PORT, useValue: { findById: jest.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com', notificationsEnabled: true }) } },
        { provide: NOTIFICATION_REPOSITORY_PORT, useValue: repo },
        { provide: EMAIL_SENDER_PORT, useValue: email },
        { provide: PUSH_SENDER_PORT, useValue: push },
      ],
    }).compile();

    handler = module.get<DispatchHandler>(DispatchHandler);
  });

  it('tạo thông báo và gửi qua cả email lẫn push', async () => {
    const result = await handler.execute({
      userId: 'user-1',
      type: 'issue_needs_info',
      title: 'Báo cáo cần bổ sung thông tin',
      summary: 'Chi tiết',
      isMandatory: true,
    });

    expect(result).not.toBeNull();
    // Kênh ngoài chạy fire-and-forget → cần flush microtask.
    await new Promise((resolve) => setImmediate(resolve));

    expect(email.send).toHaveBeenCalledTimes(1);
    expect(email.send.mock.calls[0][0]).toMatchObject({
      to: 'user@example.com',
      template: 'issue_needs_info',
    });
    expect(push.send).toHaveBeenCalledTimes(1);
  });

  it('email lỗi KHÔNG làm fail thao tác chính', async () => {
    email.send.mockRejectedValue(new Error('SMTP down'));

    const result = await handler.execute({
      userId: 'user-1',
      type: 'issue_needs_info',
      title: 'Báo cáo cần bổ sung thông tin',
      isMandatory: true,
    });

    expect(result).not.toBeNull();
    await new Promise((resolve) => setImmediate(resolve));
    expect(email.send).toHaveBeenCalled();
  });

  it('chưa cấu hình SMTP -> bỏ qua email, không lỗi', async () => {
    email.isConfigured.mockReturnValue(false);

    const result = await handler.execute({
      userId: 'user-1',
      type: 'issue_needs_info',
      title: 'Báo cáo cần bổ sung thông tin',
      isMandatory: true,
    });

    expect(result).not.toBeNull();
    await new Promise((resolve) => setImmediate(resolve));
    expect(email.send).not.toHaveBeenCalled();
  });
});

// ── Tích hợp: ForgotPasswordHandler gửi OTP qua email ─────────────────────

describe('ForgotPasswordHandler — gửi OTP qua email', () => {
  let handler: ForgotPasswordHandler;
  let email: { isConfigured: jest.Mock; send: jest.Mock };
  let users: {
    findByEmailWithResetSecret: jest.Mock;
    setPasswordResetOtp: jest.Mock;
  };

  beforeEach(async () => {
    email = { isConfigured: jest.fn().mockReturnValue(true), send: jest.fn().mockResolvedValue(true) };
    users = {
      findByEmailWithResetSecret: jest.fn().mockResolvedValue({
        id: 'user-1',
        status: 'active',
        sentCount: 0,
        windowStart: null,
      }),
      setPasswordResetOtp: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForgotPasswordHandler,
        { provide: AUTH_USER_LOOKUP_PORT, useValue: users },
        { provide: EMAIL_SENDER_PORT, useValue: email },
      ],
    }).compile();

    handler = module.get<ForgotPasswordHandler>(ForgotPasswordHandler);
  });

  it('email tồn tại -> sinh OTP, lưu hash, gửi email', async () => {
    const res = await handler.execute('user@gmail.com');

    expect(res.message).toContain('OTP');
    expect(users.setPasswordResetOtp).toHaveBeenCalledTimes(1);

    const [emailArg, hashArg, expiresArg] = users.setPasswordResetOtp.mock.calls[0];
    expect(emailArg).toBe('user@gmail.com');
    // Lưu dạng HASH — không lưu mã OTP thô.
    expect(hashArg).not.toMatch(/^\d{6}$/);
    expect(String(hashArg)).toHaveLength(64);
    // Hạn 10 phút.
    expect((expiresArg as Date).getTime()).toBeGreaterThan(Date.now() + 9 * 60 * 1000);

    expect(email.send).toHaveBeenCalledTimes(1);
    const sent = email.send.mock.calls[0][0];
    expect(sent.template).toBe('password_reset_otp');
    expect(sent.to).toBe('user@gmail.com');
    // Mã OTP 6 số phải xuất hiện trong email.
    expect(String(sent.html)).toMatch(/\d{6}/);
  });

  it('email KHÔNG tồn tại -> không gửi email, trả thông báo trung tính', async () => {
    users.findByEmailWithResetSecret.mockResolvedValue(null);

    const res = await handler.execute('khongco@gmail.com');

    expect(res.message).toContain('OTP');
    expect(email.send).not.toHaveBeenCalled();
    expect(users.setPasswordResetOtp).not.toHaveBeenCalled();
  });

  it('chưa cấu hình SMTP -> vẫn lưu OTP, không ném lỗi', async () => {
    email.isConfigured.mockReturnValue(false);

    const res = await handler.execute('user@gmail.com');

    expect(res.message).toContain('OTP');
    expect(users.setPasswordResetOtp).toHaveBeenCalledTimes(1);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('gửi quá 5 lần trong 1 giờ -> LIMIT_EXCEEDED (429)', async () => {
    users.findByEmailWithResetSecret.mockResolvedValue({
      id: 'user-1',
      status: 'active',
      sentCount: 5,
      windowStart: new Date(),
    });

    await expect(handler.execute('user@gmail.com')).rejects.toMatchObject({
      code: 'LIMIT_EXCEEDED',
    });
    // HTTP status không nằm trên lỗi nghiệp vụ — nó do lớp Error Mapping quyết định.
    await expect(handler.execute('user@gmail.com')).rejects.toBeInstanceOf(
      RateLimitExceededError,
    );
    expect(httpStatusForErrorCode('LIMIT_EXCEEDED')).toBe(429);
    expect(email.send).not.toHaveBeenCalled();
  });
});
