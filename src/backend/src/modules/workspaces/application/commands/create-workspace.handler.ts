/**
 * CreateWorkspaceHandler — Use case: `createWorkspace()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * Luồng (WS-01 — Phần 2 v11 §3.38):
 *   1. Tạo workspace, người tạo là Owner.
 *   2. Thêm các thành viên được mời kèm lúc tạo:
 *      - Email đã có tài khoản → thêm thành viên trực tiếp.
 *      - Email CHƯA có tài khoản → **gửi lời mời qua email** (không báo lỗi 400).
 *
 * Quy tắc bắt buộc:
 *   - Lời mời workspace là email **bắt buộc** (Phần 9 v3 §3.5.5).
 *   - Lỗi gửi email **không** làm fail thao tác chính → log cảnh báo.
 */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import type { Workspace } from '../../domain/entities/workspace.entity';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { EMAIL_SENDER_PORT, type EmailSenderPort } from '../../../../shared/application/ports/email.port';
import { workspaceInvitationTemplate } from '../../../../shared/domain/utils/email-templates';
import { CreateWorkspaceInput } from '../workspaces.types';
import { MAX_WORKSPACES_PER_USER } from '../../domain/value-objects/workspace-quota.vo';
import { RateLimitExceededError } from '../../../../shared/domain/errors';

@Injectable()
export class CreateWorkspaceHandler {
  private readonly logger = new Logger(CreateWorkspaceHandler.name);
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Optional()
    @Inject(EMAIL_SENDER_PORT)
    private readonly email: EmailSenderPort,
  ) {}

  async execute(userId: string, dto: CreateWorkspaceInput): Promise<Workspace> {
    // ── Quota: tối đa MAX_WORKSPACES_PER_USER workspace do user làm chủ ──────
    // Chống lạm dụng tạo hàng loạt workspace để spam lời mời qua email.
    // Admin (quản trị viên hệ thống) không bị giới hạn.
    const creator = await this.users.findById(userId);
    if (creator && creator.role !== 'admin') {
      const ownedCount = await this.workspaces.countOwnedByUser(userId);
      if (ownedCount >= MAX_WORKSPACES_PER_USER) {
        throw new RateLimitExceededError(
          `Bạn đã đạt giới hạn ${MAX_WORKSPACES_PER_USER} không gian làm việc ` +
            `(hiện có ${ownedCount}). Hãy xoá bớt workspace không dùng hoặc liên hệ quản trị viên.`,
          { currentCount: ownedCount, max: MAX_WORKSPACES_PER_USER },
        );
      }
    }

    const workspace = await this.workspaces.create({
      name: dto.name,
      description: dto.description ?? '',
      ownerId: userId,
    });

    // H2 — Thêm các thành viên được mời kèm lúc tạo workspace.
    // Email chưa có tài khoản → gửi lời mời (không tạo "pending" ẩn).
    const emails = Array.from(
      new Set((dto.member_emails ?? []).map((e) => e.trim().toLowerCase())),
    );
    if (emails.length > 0) {
      const creatorEmail = creator?.email.toLowerCase();
      const inviterName = creator
        ? [creator.firstName, creator.lastName].filter(Boolean).join(' ').trim()
        : '';
      const invitedEmails: string[] = [];
      const targets: { id: string; email: string }[] = [];
      for (const email of emails) {
        if (creatorEmail && email === creatorEmail) continue;
        const u = await this.users.findByEmail(email);
        if (!u) {
          invitedEmails.push(email);
          continue;
        }
        targets.push({ id: u.id, email });
      }
      for (const t of targets) {
        await this.workspaces.addMember(workspace.id, {
          userId: t.id,
          role: 'member',
          joinedAt: new Date(),
        });
      }
      for (const email of invitedEmails) {
        await this.sendInvitation(workspace, email, 'member', inviterName);
      }
    }

    this.logger.log(
      `Tạo Workspace mới: ${workspace.name} (ID: ${workspace.id}) bởi User: ${userId}`,
    );
    return this.workspaces.findById(workspace.id).then((w) => w ?? workspace);
  }

  /**
   * Gửi email lời mời thành viên.
   *
   * Lỗi gửi **không** làm fail thao tác chính — chỉ log cảnh báo
   * (Phần 9 v3 §3.5.5 quy tắc 3).
   */
  private async sendInvitation(
    workspace: Workspace,
    email: string,
    role: 'owner' | 'member',
    inviterName: string,
  ): Promise<void> {
    if (!this.email?.isConfigured()) {
      this.logger.warn(
        `[WS-01] Chưa cấu hình SMTP — không gửi được lời mời cho ${email}. ` +
          'Cần đặt SMTP_HOST/SMTP_USER/SMTP_PASS.',
      );
      return;
    }
    const draft = workspaceInvitationTemplate(
      workspace.name,
      role,
      inviterName || 'Quản trị viên',
      `${this.appUrl()}/workspaces`,
    );
    try {
      const ok = await this.email.send({
        to: email,
        template: 'workspace_invitation',
        subject: draft.subject,
        html: draft.html,
        text: draft.text,
      });
      if (ok) {
        this.logger.log(`[WS-01] Đã gửi lời mời workspace "${workspace.name}" tới ${email}.`);
      } else {
        this.logger.warn(`[WS-01] Gửi lời mời workspace tới ${email} không thành công.`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[WS-01] Lỗi khi gửi lời mời workspace tới ${email}: ${msg}`);
    }
  }

  /** URL gốc của ứng dụng web — dùng cho link trong email. */
  private appUrl(): string {
    const configured = process.env.APP_URL?.trim();
    if (configured) return configured.replace(/\/+$/, '');
    const cors = process.env.CORS_ORIGIN?.trim();
    if (cors) return cors.replace(/\/+$/, '');
    return 'http://localhost:5173';
  }
}
