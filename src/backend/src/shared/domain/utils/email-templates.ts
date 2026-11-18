/**
 * EMAIL — Template email tiếng Việt.
 *
 * Hàm thuần (không framework, không I/O) → nằm ở `shared/utils/` để tầng
 * `domain/` của mọi module dùng được mà không vi phạm CA11
 * ("domain chỉ được import shared/ ở thư mục thuần: utils|validation|crypto").
 *
 * Ràng buộc (Phần 9 v3 §3.5.5):
 *   - Không chứa liên kết tới file dữ liệu hay PDF — chỉ liên kết tới trang web.
 *   - Không log nội dung email (hàm này chỉ trả về nội dung, không log).
 *
 * Mọi giá trị động đều được escape HTML trước khi chèn — chống HTML injection
 * qua tên người dùng / tiêu đề báo cáo.
 */

/** Escape 5 ký tự đặc biệt của HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Bảng màu thương hiệu — dùng chung cho mọi template. */
const BRAND = {
  bg: '#f4f6f9',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#1e293b',
  muted: '#64748b',
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  dangerBorder: '#fecaca',
  success: '#059669',
  code: '#0f172a',
} as const;

/** Bọc nội dung vào khung HTML chuẩn (header + body + footer). */
function layout(options: {
  heading: string;
  bodyHtml: string;
  accent?: string;
  footerNote?: string;
}): string {
  const accent = options.accent ?? BRAND.primary;
  const footer = options.footerNote
    ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:${BRAND.muted};">${escapeHtml(options.footerNote)}</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(options.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <h1 style="margin:0 0 16px 0;font-size:20px;line-height:1.4;font-weight:600;color:${BRAND.text};">${escapeHtml(options.heading)}</h1>
              ${options.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px 32px;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:${BRAND.muted};">Trân trọng,<br><strong style="color:${BRAND.text};">AI Data Quality Platform</strong></p>
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Khối mã OTP — nổi bật, monospace, letter-spacing. */
function otpBlock(code: string, expiresInMinutes: number): string {
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td align="center" style="background:${BRAND.code};border-radius:10px;padding:24px;">
            <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:#ffffff;line-height:1;">${escapeHtml(code)}</div>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:14px;line-height:1.6;color:${BRAND.muted};text-align:center;">Mã này có hiệu lực trong <strong style="color:${BRAND.text};">${escapeHtml(String(expiresInMinutes))} phút</strong>. Chỉ dùng mã này một lần.</p>`;
}

/** Nội dung email quên mật khẩu (AUTH-05). */
export function passwordResetOtpTemplate(
  otp: string,
  expiresInMinutes: number,
): { subject: string; html: string; text: string } {
  const bodyHtml = `
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BRAND.text};">Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Sử dụng mã bảo mật dưới đây để đặt mật khẩu mới:</p>
      ${otpBlock(otp, expiresInMinutes)}
      <p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:${BRAND.muted};">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.</p>`;
  return {
    subject: 'Mã đặt lại mật khẩu',
    html: layout({
      heading: 'Đặt lại mật khẩu',
      bodyHtml,
      footerNote: 'Không bao giờ chia sẻ mã này với bất kỳ ai, kể cả nhân viên của chúng tôi.',
    }),
    text: `Mã đặt lại mật khẩu của bạn là: ${otp}\n\nMã có hiệu lực trong ${expiresInMinutes} phút.\nNếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.`,
  };
}

/** Nội dung lời mời thành viên workspace (WS-07). */
export function workspaceInvitationTemplate(
  workspaceName: string,
  role: string,
  inviterName: string,
  appUrl: string,
): { subject: string; html: string; text: string } {
  const roleLabel = role === 'owner' ? 'Chủ sở hữu' : role === 'member' ? 'Thành viên' : role;
  const bodyHtml = `
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BRAND.text};"><strong style="color:${BRAND.text};">${escapeHtml(inviterName)}</strong> đã mời bạn tham gia workspace <strong style="color:${BRAND.text};">${escapeHtml(workspaceName)}</strong> với vai trò ${escapeHtml(roleLabel)}.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="border-radius:8px;">
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">Truy cập workspace</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;line-height:1.7;color:${BRAND.muted};">Nếu nút không hoạt động, hãy sao chép địa chỉ sau vào trình duyệt:<br><span style="color:${BRAND.text};word-break:break-all;">${escapeHtml(appUrl)}</span></p>`;
  return {
    subject: `Lời mời tham gia workspace "${workspaceName}"`,
    html: layout({ heading: 'Lời mời tham gia workspace', bodyHtml }),
    text: `${inviterName} đã mời bạn tham gia workspace "${workspaceName}" với vai trò ${roleLabel}.\n\nTruy cập: ${appUrl}`,
  };
}

/** Nội dung thông báo báo cáo cần bổ sung thông tin (bắt buộc). */
export function issueNeedsInfoTemplate(
  issueTitle: string,
  appUrl: string,
): { subject: string; html: string; text: string } {
  const bodyHtml = `
      <div style="background:${BRAND.dangerBg};border:1px solid ${BRAND.dangerBorder};border-left:3px solid ${BRAND.danger};border-radius:8px;padding:16px 18px;margin:0 0 20px 0;">
        <p style="margin:0;font-size:14px;line-height:1.7;color:${BRAND.text};"><strong style="color:${BRAND.danger};">Báo cáo cần bổ sung thông tin</strong></p>
      </div>
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BRAND.text};">Báo cáo <strong style="color:${BRAND.text};">${escapeHtml(issueTitle)}</strong> đang chờ bạn cung cấp thêm thông tin để đội ngũ quản trị viên xử lý.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="border-radius:8px;">
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">Xem báo cáo</a>
          </td>
        </tr>
      </table>`;
  return {
    subject: 'Báo cáo của bạn cần bổ sung thông tin',
    html: layout({ heading: 'Báo cáo cần bổ sung thông tin', bodyHtml }),
    text: `Báo cáo "${issueTitle}" đang chờ bạn bổ sung thêm thông tin.\n\nXem báo cáo: ${appUrl}`,
  };
}

/** Nội dung thông báo báo cáo đã xử lý. */
export function issueResolvedTemplate(
  issueTitle: string,
  appUrl: string,
): { subject: string; html: string; text: string } {
  const bodyHtml = `
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BRAND.text};">Báo cáo <strong style="color:${BRAND.text};">${escapeHtml(issueTitle)}</strong> của bạn đã được xử lý.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="border-radius:8px;">
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:${BRAND.success};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">Xem chi tiết</a>
          </td>
        </tr>
      </table>`;
  return {
    subject: 'Báo cáo sự cố đã được xử lý',
    html: layout({ heading: 'Báo cáo đã được xử lý', bodyHtml, accent: BRAND.success }),
    text: `Báo cáo "${issueTitle}" của bạn đã được xử lý.\n\nXem chi tiết: ${appUrl}`,
  };
}

/** Nội dung thông báo kết quả phân tích hoàn tất. */
export function analysisCompletedTemplate(
  projectName: string,
  summary: string | null,
  appUrl: string,
): { subject: string; html: string; text: string } {
  const summaryHtml = summary
    ? `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BRAND.muted};">${escapeHtml(summary)}</p>`
    : '';
  const bodyHtml = `
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BRAND.text};">Phân tích chất lượng dữ liệu cho project <strong style="color:${BRAND.text};">${escapeHtml(projectName)}</strong> đã hoàn tất.</p>
      ${summaryHtml}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="border-radius:8px;">
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">Xem kết quả</a>
          </td>
        </tr>
      </table>`;
  return {
    subject: `Phân tích hoàn tất: ${projectName}`,
    html: layout({ heading: 'Phân tích đã hoàn tất', bodyHtml, accent: BRAND.success }),
    text: `Phân tích chất lượng dữ liệu cho project "${projectName}" đã hoàn tất.\n\nXem kết quả: ${appUrl}`,
  };
}

/** Nội dung thông báo phân tích thất bại. */
export function analysisFailedTemplate(
  projectName: string,
  reason: string | null,
  appUrl: string,
): { subject: string; html: string; text: string } {
  const reasonHtml = reason
    ? `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BRAND.muted};">Lý do: ${escapeHtml(reason)}</p>`
    : '';
  const bodyHtml = `
      <div style="background:${BRAND.dangerBg};border:1px solid ${BRAND.dangerBorder};border-left:3px solid ${BRAND.danger};border-radius:8px;padding:16px 18px;margin:0 0 20px 0;">
        <p style="margin:0;font-size:14px;line-height:1.7;color:${BRAND.text};"><strong style="color:${BRAND.danger};">Phân tích không hoàn tất</strong></p>
      </div>
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BRAND.text};">Phân tích cho project <strong style="color:${BRAND.text};">${escapeHtml(projectName)}</strong> đã gặp lỗi.</p>
      ${reasonHtml}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="border-radius:8px;">
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:${BRAND.primaryDark};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">Vào project</a>
          </td>
        </tr>
      </table>`;
  return {
    subject: `Phân tích thất bại: ${projectName}`,
    html: layout({ heading: 'Phân tích không hoàn tất', bodyHtml, accent: BRAND.danger }),
    text: `Phân tích cho project "${projectName}" đã gặp lỗi.${reason ? ` Lý do: ${reason}` : ''}\n\nVào project: ${appUrl}`,
  };
}

/** Nội dung thông báo báo cáo PDF sẵn sàng. */
export function reportReadyTemplate(
  projectName: string,
  appUrl: string,
): { subject: string; html: string; text: string } {
  const bodyHtml = `
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BRAND.text};">Báo cáo Tổng kết cho project <strong style="color:${BRAND.text};">${escapeHtml(projectName)}</strong> đã được tạo xong.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="border-radius:8px;">
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">Mở trang báo cáo</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;line-height:1.7;color:${BRAND.muted};">Tải file PDF trực tiếp từ trang báo cáo của project.</p>`;
  return {
    subject: `Báo cáo đã sẵn sàng: ${projectName}`,
    html: layout({ heading: 'Báo cáo đã sẵn sàng', bodyHtml, accent: BRAND.success }),
    text: `Báo cáo Tổng kết cho project "${projectName}" đã được tạo xong.\n\nMở trang báo cáo: ${appUrl}`,
  };
}

/** Nội dung cảnh báo bảo mật (bắt buộc gửi dù tắt thông báo). */
export function securityAlertTemplate(
  alertTitle: string,
  detail: string | null,
): { subject: string; html: string; text: string } {
  const detailHtml = detail
    ? `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BRAND.muted};">${escapeHtml(detail)}</p>`
    : '';
  const bodyHtml = `
      <div style="background:${BRAND.dangerBg};border:1px solid ${BRAND.dangerBorder};border-left:3px solid ${BRAND.danger};border-radius:8px;padding:16px 18px;margin:0 0 20px 0;">
        <p style="margin:0;font-size:14px;line-height:1.7;color:${BRAND.text};"><strong style="color:${BRAND.danger};">${escapeHtml(alertTitle)}</strong></p>
      </div>
      ${detailHtml}
      <p style="margin:0;font-size:13px;line-height:1.7;color:${BRAND.muted};">Nếu bạn không nhận ra hoạt động này, hãy đổi mật khẩu ngay và liên hệ quản trị viên.</p>`;
  return {
    subject: `Cảnh báo bảo mật: ${alertTitle}`,
    html: layout({ heading: 'Cảnh báo bảo mật', bodyHtml, accent: BRAND.danger }),
    text: `Cảnh báo bảo mật: ${alertTitle}${detail ? `\n${detail}` : ''}\n\nNếu bạn không nhận ra hoạt động này, hãy đổi mật khẩu ngay.`,
  };
}

/** Nội dung thông báo chung (project được tạo/xoá, thêm thành viên…). */
export function genericTemplate(
  title: string,
  body: string,
  appUrl: string | null,
): { subject: string; html: string; text: string } {
  const ctaHtml = appUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="border-radius:8px;">
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">Mở hệ thống</a>
          </td>
        </tr>
      </table>`
    : '';
  const bodyHtml = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BRAND.text};">${escapeHtml(body)}</p>${ctaHtml}`;
  return {
    subject: title,
    html: layout({ heading: title, bodyHtml }),
    text: `${title}\n\n${body}${appUrl ? `\n\n${appUrl}` : ''}`,
  };
}
