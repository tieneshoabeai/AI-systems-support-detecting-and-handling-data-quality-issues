/**
 * Unit test thuần cho aggregate `Feedback` (Bước 3 — Rich Domain Model).
 */
import { Feedback } from '../src/modules/feedback/feedback.types';
import {
  ForbiddenError,
  ValidationError,
} from '../src/shared/domain/errors';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function buildFeedback(
  overrides: Partial<Parameters<typeof Feedback.reconstitute>[0]> = {},
): Feedback {
  return Feedback.reconstitute({
    id: 'f-1',
    analysisRunId: 'r-1',
    projectId: 'p-1',
    workspaceId: 'w-1',
    findingId: 'DQ-01:colA',
    findingKey: null,
    authorId: 'u-1',
    label: 'correct',
    reason: null,
    suggestedSeverity: null,
    aiConfidence: null,
    aiRationale: null,
    authorRoleAtTime: 'viewer',
    modelId: null,
    promptVersion: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  });
}

describe('Feedback entity — factory', () => {
  it('create() tạo nhận xét với label hợp lệ', () => {
    const f = Feedback.create({
      id: 'f-1',
      analysisRunId: 'r-1',
      projectId: 'p-1',
      workspaceId: 'w-1',
      authorId: 'u-1',
      label: 'correct',
      now: NOW,
    });

    expect(f.label).toBe('correct');
    expect(f.reason).toBeNull();
    expect(f.version).toBe(1);
  });

  it('create() label không hợp lệ → ValidationError', () => {
    expect(() =>
      Feedback.create({
        id: 'f-1',
        analysisRunId: 'r-1',
        projectId: 'p-1',
        workspaceId: 'w-1',
        authorId: 'u-1',
        label: 'khong_hop_le',
        now: NOW,
      }),
    ).toThrow(ValidationError);
  });

  it('create() nhãn bắt buộc lý do mà thiếu reason → ValidationError', () => {
    expect(() =>
      Feedback.create({
        id: 'f-1',
        analysisRunId: 'r-1',
        projectId: 'p-1',
        workspaceId: 'w-1',
        authorId: 'u-1',
        label: 'false_positive',
        now: NOW,
      }),
    ).toThrow(ValidationError);
  });

  it('create() nhãn bắt buộc lý do + có reason → OK', () => {
    const f = Feedback.create({
      id: 'f-1',
      analysisRunId: 'r-1',
      projectId: 'p-1',
      workspaceId: 'w-1',
      authorId: 'u-1',
      label: 'false_positive',
      reason: '  Không phải lỗi  ',
      now: NOW,
    });

    expect(f.reason).toBe('Không phải lỗi');
  });

  it('create() reason > 2000 ký tự → ValidationError', () => {
    expect(() =>
      Feedback.create({
        id: 'f-1',
        analysisRunId: 'r-1',
        projectId: 'p-1',
        workspaceId: 'w-1',
        authorId: 'u-1',
        label: 'other',
        reason: 'x'.repeat(2001),
        now: NOW,
      }),
    ).toThrow(ValidationError);
  });

  it('create() findingId > 200 ký tự → ValidationError', () => {
    expect(() =>
      Feedback.create({
        id: 'f-1',
        analysisRunId: 'r-1',
        projectId: 'p-1',
        workspaceId: 'w-1',
        authorId: 'u-1',
        label: 'correct',
        findingId: 'x'.repeat(201),
        now: NOW,
      }),
    ).toThrow(ValidationError);
  });

  it('create() suggestedSeverity không hợp lệ → ValidationError', () => {
    expect(() =>
      Feedback.create({
        id: 'f-1',
        analysisRunId: 'r-1',
        projectId: 'p-1',
        workspaceId: 'w-1',
        authorId: 'u-1',
        label: 'correct',
        suggestedSeverity: 'khong_hop_le',
        now: NOW,
      }),
    ).toThrow(ValidationError);
  });

  it('create() phát domain event feedback.submitted', () => {
    const f = Feedback.create({
      id: 'f-1',
      analysisRunId: 'r-1',
      projectId: 'p-1',
      workspaceId: 'w-1',
      authorId: 'u-1',
      label: 'correct',
      now: NOW,
    });

    const events = f.dispatchDomainEvents();
    expect(events[0]?.eventType).toBe('feedback.submitted');
    expect(f.dispatchDomainEvents()).toHaveLength(0);
  });

  it('reconstitute() không phát domain event', () => {
    expect(buildFeedback().domainEvents).toHaveLength(0);
  });
});

describe('Feedback entity — truy vấn', () => {
  it('isOwnedBy(): đúng tác giả', () => {
    expect(buildFeedback({ authorId: 'u-1' }).isOwnedBy('u-1')).toBe(true);
    expect(buildFeedback({ authorId: 'u-1' }).isOwnedBy('u-2')).toBe(false);
  });

  it('requiresReason(): false_positive / missed_issue / other', () => {
    expect(buildFeedback({ label: 'false_positive' }).requiresReason()).toBe(true);
    expect(buildFeedback({ label: 'missed_issue' }).requiresReason()).toBe(true);
    expect(buildFeedback({ label: 'other' }).requiresReason()).toBe(true);
    expect(buildFeedback({ label: 'correct' }).requiresReason()).toBe(false);
    expect(buildFeedback({ label: 'partially_correct' }).requiresReason()).toBe(false);
  });

  it('isSoftDeleted(): deletedAt khác null', () => {
    expect(buildFeedback({ deletedAt: NOW }).isSoftDeleted()).toBe(true);
    expect(buildFeedback().isSoftDeleted()).toBe(false);
  });
});

describe('Feedback entity — updateByAuthor()', () => {
  it('tác giả sửa được label + reason', () => {
    const f = buildFeedback();
    f.updateByAuthor('u-1', { label: 'partially_correct', reason: 'một phần' }, NOW);

    expect(f.label).toBe('partially_correct');
    expect(f.reason).toBe('một phần');
    expect(f.version).toBe(2);
  });

  it('người khác sửa → ForbiddenError', () => {
    expect(() => buildFeedback().updateByAuthor('u-2', { label: 'correct' })).toThrow(
      ForbiddenError,
    );
  });

  it('sửa sang nhãn bắt buộc lý do mà thiếu reason → ValidationError', () => {
    expect(() => buildFeedback().updateByAuthor('u-1', { label: 'false_positive' })).toThrow(
      ValidationError,
    );
  });

  it('sửa sang nhãn bắt buộc lý do + có reason → OK', () => {
    const f = buildFeedback();
    f.updateByAuthor('u-1', { label: 'false_positive', reason: 'sai' });
    expect(f.label).toBe('false_positive');
  });

  it('reason > 2000 ký tự → ValidationError', () => {
    expect(() =>
      buildFeedback().updateByAuthor('u-1', { reason: 'x'.repeat(2001) }),
    ).toThrow(ValidationError);
  });

  it('sửa reason rỗng → null', () => {
    const f = buildFeedback({ reason: 'cũ' });
    f.updateByAuthor('u-1', { reason: '   ' });
    expect(f.reason).toBeNull();
  });
});

describe('Feedback entity — softDelete()', () => {
  it('đánh dấu xoá mềm + phát event feedback.promoted', () => {
    const f = buildFeedback();
    f.softDelete(NOW);

    expect(f.isSoftDeleted()).toBe(true);
    const events = f.dispatchDomainEvents();
    expect(events[0]?.eventType).toBe('feedback.promoted');
  });
});

describe('Feedback entity — toProps()', () => {
  it('toProps() trả bản chụp props đầy đủ', () => {
    const props = buildFeedback().toProps();
    expect(props.id).toBe('f-1');
    expect(props.authorId).toBe('u-1');
    expect(props.label).toBe('correct');
    expect(props.version).toBe(1);
  });
});
