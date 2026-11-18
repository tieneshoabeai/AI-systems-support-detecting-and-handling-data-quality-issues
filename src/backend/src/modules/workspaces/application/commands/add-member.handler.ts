/**
 * AddMemberHandler — Use case: `addMember()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * Luồng (WS-07 — Phần 2 v11 §3.38 "WS-07 Thêm thành viên Workspace"):
 *   1. Workspace không tồn tại → `NotFoundError` (mã `NOT_FOUND`).
 *   2. Email đã có tài khoản → thêm thành viên ngay (role theo yêu cầu).
 *      - Đã là thành viên → `ConflictError` (mã `CONFLICT`).
 *   3. Email CHƯA có tài khoản → **gửi lời mời qua email** (không báo lỗi).
 *      Người được mời đăng ký rồi sẽ được thêm vào workspace.
 *
 * Quy tắc bắt buộc:
 *   - Lời mời workspace là email **bắt buộc** (Phần 9 v3 §3.5.5).
 *   - Lỗi gửi email **không** làm fail thao tác chính → log cảnh báo.
 *   - KHÔNG log nội dung email (Phần 9 v3 §3.5.5 quy tắc 2).
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
import { AddWorkspaceMemberInput } from '../workspaces.types';
import { GetWorkspaceByIdHandler } from '../queries/get-workspace-by-id.handler';

/** Kết quả thêm thành viên — phân biệt "thêm trực tiếp" và "đã gửi lời mời". */
export interface AddMemberResult {
  workspace: Workspace;
  /** `true` nếu email chưa có tài khoản và đã gửi lời mời. */
  invited: boolean;
}

@Injectable()
export class AddMemberHandler {
  private readonly logger = new Logger(AddMemberHandler.name);
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    private readonly getWorkspaceByIdHandler: GetWorkspaceByIdHandler,
    @Optional()
    @Inject(EMAIL_SENDER_PORT)
    private readonly email: EmailSenderPort,
  ) {}

  async execute(
    workspaceId: string,
    dto: AddWorkspaceMemberInput,
    invitedByUserId?: string,
  ): Promise<AddMemberResult> {
    const workspace = await this.getWorkspaceByIdHandler.execute(workspaceId);
    const role = dto.role ?? 'member';
    const targetUser = await this.users.findByEmail(dto.email);

    // ── Trường hợp 1: email chưa có tài khoản → gửi lời mời ──────────────
    if (!targetUser) {
      await this.sendInvitation(workspace, dto.email, role, invitedByUserId);
      return { workspace, invited: true };
    }

    // ── Trường hợp 2: đã có tài khoản → thêm thành viên trực tiếp ─────────
    const targetUserIdStr = targetUser.id;

    // Entity tự kiểm tra invariant → ném ConflictError nếu đã là thành viên.
    workspace.addMember(targetUserIdStr, role === 'owner' ? 'member' : role);

    await this.workspaces.addMember(workspaceId, {
      userId: targetUserIdStr,
      role: role === 'owner' ? 'member' : role,
      joinedAt: new Date(),
    });
    return {
      workspace: await this.getWorkspaceByIdHandler.execute(workspaceId),
      invited: false,
    };
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
    invitedByUserId?: string,
  ): Promise<void> {
    if (!this.email?.isConfigured()) {
      this.logger.warn(
        `[WS-07] Chưa cấu hình SMTP — không gửi được lời mời cho ${email}. ` +
          'Cần đặt SMTP_HOST/SMTP_USER/SMTP_PASS.',
      );
      return;
    }

    let inviterName = 'Quản trị viên';
    if (invitedByUserId) {
      const inviter = await this.users.findById(invitedByUserId).catch(() => null);
      if (inviter) {
        inviterName = [inviter.firstName, inviter.lastName].filter(Boolean).join(' ').trim();
      }
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
        this.logger.log(`[WS-07] Đã gửi lời mời workspace "${workspace.name}" tới ${email}.`);
      } else {
        this.logger.warn(`[WS-07] Gửi lời mời workspace tới ${email} không thành công.`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[WS-07] Lỗi khi gửi lời mời workspace tới ${email}: ${msg}`);
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
