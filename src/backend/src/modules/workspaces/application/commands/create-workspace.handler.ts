/**
 * CreateWorkspaceHandler — Use case: `createWorkspace()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRecord,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { CreateWorkspaceInput } from '../workspaces.types';

@Injectable()
export class CreateWorkspaceHandler {
  private readonly logger = new Logger(CreateWorkspaceHandler.name);
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(userId: string, dto: CreateWorkspaceInput): Promise<WorkspaceRecord> {
    const workspace = await this.workspaces.create({
      name: dto.name,
      description: dto.description ?? '',
      ownerId: userId,
    });

    // H2 — Thêm các thành viên được mời kèm lúc tạo workspace.
    // Email chưa có tài khoản → báo lỗi rõ ràng (400), không tạo "pending" ẩn.
    const emails = Array.from(
      new Set((dto.member_emails ?? []).map((e) => e.trim().toLowerCase())),
    );
    if (emails.length > 0) {
      const creator = await this.users.findById(userId);
      const creatorEmail = creator?.email.toLowerCase();
      const missing: string[] = [];
      const targets: { id: string; email: string }[] = [];
      for (const email of emails) {
        if (creatorEmail && email === creatorEmail) continue;
        const u = await this.users.findByEmail(email);
        if (!u) {
          missing.push(email);
          continue;
        }
        targets.push({ id: u.id, email });
      }
      if (missing.length > 0) {
        throw new BadRequestException({
          message: `Không tìm thấy tài khoản cho các email: ${missing.join(', ')}. Vui lòng mời họ đăng ký trước.`,
          error: 'VALIDATION_ERROR',
          details: { missingEmails: missing },
        } as never);
      }
      for (const t of targets) {
        await this.workspaces.addMember(workspace.id, {
          userId: t.id,
          role: 'member',
          joinedAt: new Date(),
        });
      }
    }

    this.logger.log(
      `Tạo Workspace mới: ${workspace.name} (ID: ${workspace.id}) bởi User: ${userId}`,
    );
    return this.workspaces.findById(workspace.id).then((w) => w ?? workspace);
  }
}
