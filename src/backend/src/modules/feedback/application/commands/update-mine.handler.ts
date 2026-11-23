/**
 * UpdateMineHandler — Use case: `updateMine()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  FEEDBACK_REPOSITORY_PORT,
  type Feedback,
  type FeedbackRepositoryPort,
} from '../../domain/ports/feedback.repository.port';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { UpdateFeedbackInput } from '../feedback.types';
import { toPlain } from '../feedback.utils';
import { ForbiddenError, NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class UpdateMineHandler {
  constructor(
    @Inject(FEEDBACK_REPOSITORY_PORT)
    private readonly repo: FeedbackRepositoryPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  private async authorNames(docs: Feedback[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    const ids = [...new Set(docs.map((d) => d.authorId))];
    for (const id of ids) {
      try {
        const u = await this.users.findById(id);
        if (u) map.set(id, `${u.firstName} ${u.lastName}`.trim());
        else map.set(id, null);
      } catch {
        map.set(id, null);
      }
    }
    return map;
  }

  async execute(
    userId: string,
    roleOrId: string,
    idOrDto: string | UpdateFeedbackInput,
    dtoOrRole?: UpdateFeedbackInput | string,
  ): Promise<Record<string, unknown>> {
    // Tương thích 2 chữ ký:
    // - mới (controller): execute(userId, role, id, dto)
    // - cũ (test trực tiếp): execute(userId, id, dto)
    let role: string | undefined;
    let id: string;
    let dto: UpdateFeedbackInput;
    if (typeof idOrDto === 'string' && dtoOrRole !== undefined && typeof dtoOrRole === 'object') {
      role = roleOrId;
      id = idOrDto;
      dto = dtoOrRole;
    } else {
      id = roleOrId;
      dto = idOrDto as UpdateFeedbackInput;
      role = typeof dtoOrRole === 'string' ? dtoOrRole : undefined;
    }
    // FB-05: System Admin không có quyền với nhóm nhận xét (kể cả sửa của
    // chính mình) — nhất quán với create/list (ensureNotAdmin).
    if (role === 'admin') {
      throw new ForbiddenError('Quản trị viên hệ thống không có quyền với nhóm nhận xét (FB-*)',);
    }
    const existing = await this.repo.findByIdActive(id);
    if (!existing) throw new NotFoundError('Không tìm thấy nhận xét');
    // Entity áp dụng invariant: chỉ chủ nhận xét được sửa + nhãn bắt buộc lý do
    // + giới hạn độ dài `reason`.
    existing.updateByAuthor(userId, {
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
      ...(dto.suggestedSeverity !== undefined
        ? { suggestedSeverity: dto.suggestedSeverity }
        : {}),
    });
    const updated = await this.repo.updateById(id, {
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.reason !== undefined
        ? { reason: dto.reason?.trim() ? (dto.reason as string).trim().slice(0, 2000) : null }
        : {}),
      ...(dto.suggestedSeverity !== undefined ? { suggestedSeverity: dto.suggestedSeverity } : {}),
    });
    if (!updated) throw new NotFoundError('Không tìm thấy nhận xét');
    const names = await this.authorNames([updated]);
    return toPlain(updated, userId, names.get(userId) ?? null);
  }
}
