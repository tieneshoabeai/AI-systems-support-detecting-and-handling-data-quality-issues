import { parseDurationMs } from '../src/shared/domain/utils/duration.util';
import {
  REFRESH_TOKEN_TTL_MS,
  REMEMBER_ME_REFRESH_TOKEN_TTL_MS,
} from '../src/modules/auth/domain/value-objects/auth-policy.vo';
import {
  REMEMBER_ME_SESSION_TTL_MS,
  SESSION_TTL_MS,
  sessionExpiry,
} from '../src/modules/users/domain/value-objects/session-policy.vo';
import {
  ALLOWED_ISSUE_TRANSITIONS,
  ISSUE_STATUSES,
  isAllowedIssueTransition,
  isUserEditableIssueStatus,
} from '../src/modules/issues/domain/value-objects/issue-status.vo';
import {
  LoginSchema,
} from '../src/modules/auth/presentation/dtos/login.dto';
import {
  ListIssuesQuerySchema,
  UpdateIssueStatusSchema,
  UpdateMyIssueSchema,
} from '../src/modules/issues/presentation/dtos/create-issue.dto';

describe('Buoc 1 / Nhom C — parseDurationMs', () => {
  it('parse du don vi ms/s/m/h/d/w', () => {
    expect(parseDurationMs('500ms', 0)).toBe(500);
    expect(parseDurationMs('30s', 0)).toBe(30_000);
    expect(parseDurationMs('15m', 0)).toBe(15 * 60_000);
    expect(parseDurationMs('2h', 0)).toBe(2 * 3_600_000);
    expect(parseDurationMs('7d', 0)).toBe(7 * 86_400_000);
    expect(parseDurationMs('1w', 0)).toBe(7 * 86_400_000);
  });

  it('khong don vi -> giay', () => {
    expect(parseDurationMs('3600', 0)).toBe(3_600_000);
  });

  it('chuoi rong / sai dinh dang -> fallback', () => {
    expect(parseDurationMs('', 111)).toBe(111);
    expect(parseDurationMs(null, 222)).toBe(222);
    expect(parseDurationMs(undefined, 333)).toBe(333);
    expect(parseDurationMs('abc', 444)).toBe(444);
    expect(parseDurationMs('-5d', 555)).toBe(555);
  });
});

describe('Buoc 1 / Nhom C — policy TTL phi dang nhap', () => {
  it('mac dinh 7 ngay, remember-me 30 ngay', () => {
    expect(REFRESH_TOKEN_TTL_MS).toBe(7 * 86_400_000);
    expect(REMEMBER_ME_REFRESH_TOKEN_TTL_MS).toBe(30 * 86_400_000);
    expect(SESSION_TTL_MS).toBe(7 * 86_400_000);
    expect(REMEMBER_ME_SESSION_TTL_MS).toBe(30 * 86_400_000);
  });

  it('sessionExpiry tra ve moc thoi han dung', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    expect(sessionExpiry(from).toISOString()).toBe('2026-01-08T00:00:00.000Z');
    expect(sessionExpiry(from, true).toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
});

describe('Buoc 1 / Nhom C — DTO login', () => {
  it('remember_me mac dinh false', () => {
    const r = LoginSchema.parse({ email: 'a@b.com', password: 'x' });
    expect(r.remember_me).toBe(false);
  });

  it('nhan ca remember_me va rememberMe', () => {
    expect(
      LoginSchema.parse({ email: 'a@b.com', password: 'x', remember_me: true }).remember_me,
    ).toBe(true);
    expect(
      LoginSchema.parse({ email: 'a@b.com', password: 'x', rememberMe: true }).remember_me,
    ).toBe(true);
  });

  it('remember_me va rememberMe cung gia tri -> hop le', () => {
    expect(
      LoginSchema.parse({ email: 'a@b.com', password: 'x', remember_me: true, rememberMe: true })
        .remember_me,
    ).toBe(true);
    expect(
      LoginSchema.parse({ email: 'a@b.com', password: 'x', remember_me: false, rememberMe: false })
        .remember_me,
    ).toBe(false);
  });

  it('remember_me va rememberMe xung dot gia tri -> fail (400)', () => {
    expect(
      LoginSchema.safeParse({
        email: 'a@b.com',
        password: 'x',
        remember_me: true,
        rememberMe: false,
      }).success,
    ).toBe(false);
    expect(
      LoginSchema.safeParse({
        email: 'a@b.com',
        password: 'x',
        remember_me: false,
        rememberMe: true,
      }).success,
    ).toBe(false);
  });

  it('xung dot bao loi o field rememberMe', () => {
    const res = LoginSchema.safeParse({
      email: 'a@b.com',
      password: 'x',
      remember_me: true,
      rememberMe: false,
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.issues[0]?.path).toEqual(['rememberMe']);
  });

  it('email sai -> fail', () => {
    expect(LoginSchema.safeParse({ email: 'khong-hop-le', password: 'x' }).success).toBe(false);
  });
});

describe('Buoc 1 / Nhom D — issue status', () => {
  it('co trang thai needs_info', () => {
    expect(ISSUE_STATUSES).toContain('needs_info');
  });

  it('chuyen trang thai hop le theo luong moi', () => {
    expect(isAllowedIssueTransition('new', 'needs_info')).toBe(true);
    expect(isAllowedIssueTransition('in_progress', 'needs_info')).toBe(true);
    expect(isAllowedIssueTransition('needs_info', 'in_progress')).toBe(true);
    expect(isAllowedIssueTransition('needs_info', 'closed')).toBe(false);
    expect(isAllowedIssueTransition('closed', 'new')).toBe(false);
  });

  it('chi needs_info cho phep nguoi dung tu sua', () => {
    expect(isUserEditableIssueStatus('needs_info')).toBe(true);
    expect(isUserEditableIssueStatus('new')).toBe(false);
    expect(isUserEditableIssueStatus('in_progress')).toBe(false);
    expect(isUserEditableIssueStatus('resolved')).toBe(false);
  });

  it('ALLOWED_ISSUE_TRANSITIONS bao phu moi trang thai', () => {
    for (const s of ISSUE_STATUSES) {
      expect(Array.isArray(ALLOWED_ISSUE_TRANSITIONS[s])).toBe(true);
    }
  });
});

describe('Buoc 1 / Nhom D — DTO issues', () => {
  it('list issues chap nhan loc needs_info', () => {
    const r = ListIssuesQuerySchema.parse({ status: 'needs_info' });
    expect(r.status).toBe('needs_info');
  });

  it('list issues tu cho status la', () => {
    expect(ListIssuesQuerySchema.safeParse({ status: 'khong_hop_le' }).success).toBe(false);
  });

  it('admin doi trang thai chap nhan needs_info', () => {
    const r = UpdateIssueStatusSchema.parse({ status: 'needs_info', expectedVersion: 2 });
    expect(r.status).toBe('needs_info');
    expect(r.expectedVersion).toBe(2);
  });

  it('update issue cua toi — can it nhat mot truong + expectedVersion', () => {
    expect(
      UpdateMyIssueSchema.safeParse({ expectedVersion: 1 }).success,
    ).toBe(false);
    expect(
      UpdateMyIssueSchema.safeParse({ title: 'sua tieu de', expectedVersion: 1 }).success,
    ).toBe(true);
    expect(
      UpdateMyIssueSchema.safeParse({ title: 'sua tieu de' }).success,
    ).toBe(false);
    expect(
      UpdateMyIssueSchema.safeParse({ expectedVersion: 1, removeAttachmentIds: ['a1'] }).success,
    ).toBe(true);
  });
});
