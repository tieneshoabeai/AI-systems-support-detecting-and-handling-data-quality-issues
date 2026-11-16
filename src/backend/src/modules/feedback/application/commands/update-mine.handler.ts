/**
 * UpdateMineHandler — Use case: `updateMine()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FEEDBACK_REPOSITORY_PORT,
  type FeedbackRecord,
  type FeedbackRepositoryPort,
} from '../../domain/ports/feedback.repository.port';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { requiresReason } from '../../domain/value-objects/feedback-label.vo';
import { UpdateFeedbackInput } from '../feedback.types';
import { toPlain } from '../feedback.utils';

@Injectable()
export class UpdateMineHandler {
  constructor(
    @Inject(FEEDBACK_REPOSITORY_PORT)
    private readonly repo: FeedbackRepositoryPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  private checkReason(label: string, reason: string | null | undefined): void {
    if (requiresReason(label) && (!reason || reason.trim().length === 0)) {
      throw new BadRequestException('Nhãn này bắt buộc kèm lý do (reason)');
    }
  }

  private async authorNames(docs: FeedbackRecord[]): Promise<Map<string, string | null>> {
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
    id: string,
    dto: UpdateFeedbackInput,
  ): Promise<Record<string, unknown>> {
    const existing = await this.repo.findByIdActive(id);
    if (!existing) throw new NotFoundException('Không tìm thấy nhận xét');
    if (existing.authorId !== userId) {
      throw new ForbiddenException('Chỉ chủ nhận xét được sửa');
    }
    const nextLabel = dto.label ?? existing.label;
    const nextReason = dto.reason !== undefined ? dto.reason : existing.reason;
    this.checkReason(nextLabel, nextReason);
    const updated = await this.repo.updateById(id, {
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.reason !== undefined
        ? { reason: dto.reason?.trim() ? (dto.reason as string).trim().slice(0, 2000) : null }
        : {}),
      ...(dto.suggestedSeverity !== undefined ? { suggestedSeverity: dto.suggestedSeverity } : {}),
    });
    if (!updated) throw new NotFoundException('Không tìm thấy nhận xét');
    const names = await this.authorNames([updated]);
    return toPlain(updated, userId, names.get(userId) ?? null);
  }
}
