/**
 * Unit test thuần cho aggregate `IssueReport` (Bước 3 — Rich Domain Model).
 */
import { IssueReport } from '../src/modules/issues/domain/entities/issue-report.entity';
import {
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '../src/shared/domain/errors';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function buildIssue(
  overrides: Partial<Parameters<typeof IssueReport.reconstitute>[0]> = {},
): IssueReport {
  return IssueReport.reconstitute({
    id: 'i-1',
    userId: 'u-1',
    workspaceId: null,
    issueType: 'function_error',
    title: 'Lỗi',
    description: 'Mô tả',
    status: 'new',
    attachments: [],
    context: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  });
}

describe('IssueReport entity — factory', () => {
  it('create() bắt đầu ở trạng thái new, version=1', () => {
    const issue = IssueReport.create({
      id: 'i-1',
      userId: 'u-1',
      issueType: 'function_error',
      title: '  Lỗi  ',
      description: '  Mô tả  ',
      now: NOW,
    });

    expect(issue.status).toBe('new');
    expect(issue.version).toBe(1);
    expect(issue.title).toBe('Lỗi');
    expect(issue.description).toBe('Mô tả');
    expect(issue.attachments).toHaveLength(0);
  });

  it('create() issueType không hợp lệ → ValidationError', () => {
    expect(() =>
      IssueReport.create({
        id: 'i-1',
        userId: 'u-1',
        issueType: 'khong_hop_le',
        title: 'X',
        description: 'Y',
        now: NOW,
      }),
    ).toThrow(ValidationError);
  });

  it('create() title rỗng → ValidationError', () => {
    expect(() =>
      IssueReport.create({
        id: 'i-1',
        userId: 'u-1',
        issueType: 'function_error',
        title: '   ',
        description: 'Y',
        now: NOW,
      }),
    ).toThrow(ValidationError);
  });

  it('create() title > 200 ký tự → ValidationError', () => {
    expect(() =>
      IssueReport.create({
        id: 'i-1',
        userId: 'u-1',
        issueType: 'function_error',
        title: 'x'.repeat(201),
        description: 'Y',
        now: NOW,
      }),
    ).toThrow(ValidationError);
  });

  it('create() description > 5000 ký tự → ValidationError', () => {
    expect(() =>
      IssueReport.create({
        id: 'i-1',
        userId: 'u-1',
        issueType: 'function_error',
        title: 'X',
        description: 'y'.repeat(5001),
        now: NOW,
      }),
    ).toThrow(ValidationError);
  });

  it('create() phát domain event issue.created', () => {
    const issue = IssueReport.create({
      id: 'i-1',
      userId: 'u-1',
      issueType: 'function_error',
      title: 'X',
      description: 'Y',
      now: NOW,
    });

    const events = issue.dispatchDomainEvents();
    expect(events[0]?.eventType).toBe('issue.created');
    expect(issue.dispatchDomainEvents()).toHaveLength(0);
  });

  it('reconstitute() không phát domain event', () => {
    expect(buildIssue().domainEvents).toHaveLength(0);
  });
});

describe('IssueReport entity — truy vấn', () => {
  it('canTransitionTo(): new → in_progress hợp lệ', () => {
    expect(buildIssue({ status: 'new' }).canTransitionTo('in_progress')).toBe(true);
    expect(buildIssue({ status: 'new' }).canTransitionTo('needs_info')).toBe(true);
    expect(buildIssue({ status: 'new' }).canTransitionTo('resolved')).toBe(false);
  });

  it('canTransitionTo(): closed không chuyển được đâu', () => {
    expect(buildIssue({ status: 'closed' }).canTransitionTo('new')).toBe(false);
  });

  it('isUserEditable(): chỉ needs_info', () => {
    expect(buildIssue({ status: 'needs_info' }).isUserEditable()).toBe(true);
    expect(buildIssue({ status: 'new' }).isUserEditable()).toBe(false);
    expect(buildIssue({ status: 'in_progress' }).isUserEditable()).toBe(false);
  });

  it('isClosed(): status=closed', () => {
    expect(buildIssue({ status: 'closed' }).isClosed()).toBe(true);
    expect(buildIssue({ status: 'new' }).isClosed()).toBe(false);
  });
});

describe('IssueReport entity — transitionTo()', () => {
  it('chuyển trạng thái hợp lệ + tăng version + phát event', () => {
    const issue = buildIssue({ status: 'new' });
    const at = new Date('2026-01-02T00:00:00.000Z');
    issue.transitionTo('in_progress', at);

    expect(issue.status).toBe('in_progress');
    expect(issue.version).toBe(2);
    expect(issue.updatedAt).toBe(at);

    const events = issue.dispatchDomainEvents();
    expect(events[0]?.eventType).toBe('issue.status_changed');
  });

  it('chuyển sang needs_info → phát event issue.needs_info', () => {
    const issue = buildIssue({ status: 'new' });
    issue.transitionTo('needs_info', NOW);

    const types = issue.dispatchDomainEvents().map((e) => e.eventType);
    expect(types).toContain('issue.status_changed');
    expect(types).toContain('issue.needs_info');
  });

  it('chuyển sang resolved → phát event issue.resolved', () => {
    const issue = buildIssue({ status: 'in_progress' });
    issue.transitionTo('resolved', NOW);

    const types = issue.dispatchDomainEvents().map((e) => e.eventType);
    expect(types).toContain('issue.resolved');
  });

  it('transition không hợp lệ → ValidationError', () => {
    expect(() => buildIssue({ status: 'new' }).transitionTo('resolved')).toThrow(
      ValidationError,
    );
  });

  it('báo cáo đã đóng → ConflictError', () => {
    expect(() => buildIssue({ status: 'closed' }).transitionTo('new')).toThrow(
      ConflictError,
    );
  });
});

describe('IssueReport entity — updateByUser()', () => {
  it('sửa title/description khi needs_info → chuyển về in_progress', () => {
    const issue = buildIssue({ status: 'needs_info' });
    issue.updateByUser({ title: '  Tiêu đề mới ', description: 'Mô tả mới' }, NOW);

    expect(issue.title).toBe('Tiêu đề mới');
    expect(issue.description).toBe('Mô tả mới');
    expect(issue.status).toBe('in_progress');
    expect(issue.version).toBe(2);
  });

  it('trạng thái khác needs_info → ForbiddenError', () => {
    expect(() => buildIssue({ status: 'new' }).updateByUser({ title: 'X' })).toThrow(
      ForbiddenError,
    );
  });

  it('title rỗng → ValidationError', () => {
    expect(() =>
      buildIssue({ status: 'needs_info' }).updateByUser({ title: '  ' }),
    ).toThrow(ValidationError);
  });

  it('title > 200 ký tự → ValidationError', () => {
    expect(() =>
      buildIssue({ status: 'needs_info' }).updateByUser({ title: 'x'.repeat(201) }),
    ).toThrow(ValidationError);
  });

  it('gỡ tệp đính kèm thuộc báo cáo → OK, trả storageKey để dọn storage', () => {
    const issue = buildIssue({
      status: 'needs_info',
      attachments: [
        { id: 'a1', filename: 'a.png', storageKey: 'issues/a.png', sizeBytes: 10, contentType: 'image/png' },
      ],
    });

    const keys = issue.removeAttachments(['a1']);
    expect(keys).toEqual(['issues/a.png']);
    expect(issue.attachments).toHaveLength(0);
  });

  it('gỡ tệp không thuộc báo cáo → ValidationError', () => {
    const issue = buildIssue({ status: 'needs_info' });
    expect(() => issue.updateByUser({ removeAttachmentIds: ['nope'] })).toThrow(
      ValidationError,
    );
  });
});

describe('IssueReport entity — addAttachment()', () => {
  it('thêm tệp đính kèm hợp lệ', () => {
    const issue = buildIssue();
    issue.addAttachment(
      { id: 'a1', filename: 'a.png', storageKey: 'issues/a.png', sizeBytes: 10, contentType: 'image/png' },
      NOW,
    );

    expect(issue.attachments).toHaveLength(1);
    expect(issue.attachments[0]?.id).toBe('a1');
  });

  it('tên tệp rỗng → ValidationError', () => {
    expect(() =>
      buildIssue().addAttachment(
        { id: 'a1', filename: '  ', storageKey: 'k', sizeBytes: 1, contentType: 'x' },
      ),
    ).toThrow(ValidationError);
  });

  it('tệp > 10MB → ValidationError', () => {
    expect(() =>
      buildIssue().addAttachment(
        {
          id: 'a1',
          filename: 'big.bin',
          storageKey: 'k',
          sizeBytes: 11 * 1024 * 1024,
          contentType: 'application/octet-stream',
        },
      ),
    ).toThrow(ValidationError);
  });
});

describe('IssueReport entity — toProps()', () => {
  it('toProps() trả bản chụp props đầy đủ', () => {
    const props = buildIssue().toProps();
    expect(props.id).toBe('i-1');
    expect(props.userId).toBe('u-1');
    expect(props.status).toBe('new');
    expect(props.version).toBe(1);
  });
});
