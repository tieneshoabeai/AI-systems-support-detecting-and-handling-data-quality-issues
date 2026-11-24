/**
 * Unit test thuần cho aggregate `User` (Bước 3 — Rich Domain Model).
 *
 * Không dùng NestJS/Mongoose — chỉ kiểm tra hành vi + invariant của entity.
 */
import { User } from '../src/modules/users/domain/entities/user.entity';
import {
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '../src/shared/domain/errors';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function buildUser(overrides: Partial<Parameters<typeof User.reconstitute>[0]> = {}): User {
  return User.reconstitute({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: 'hash',
    googleId: null,
    authProvider: 'local',
    firstName: 'Nguyen',
    lastName: 'Van A',
    avatarUrl: null,
    phone: null,
    bio: null,
    role: 'analyst',
    notificationsEnabled: true,
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    version: 1,
    ...overrides,
  });
}

describe('User entity — factory', () => {
  it('create() chuẩn hoá email (lowercase + trim)', () => {
    const user = User.create({
      id: 'u-1',
      email: '  USER@Example.COM  ',
      passwordHash: 'h',
      firstName: 'A',
      lastName: 'B',
      now: NOW,
    });

    expect(user.email).toBe('user@example.com');
  });

  it('create() mặc định role=analyst, status=active, notifications=true', () => {
    const user = User.create({
      id: 'u-1',
      email: 'a@b.com',
      passwordHash: 'h',
      firstName: 'A',
      lastName: 'B',
      now: NOW,
    });

    expect(user.role).toBe('analyst');
    expect(user.status).toBe('active');
    expect(user.notificationsEnabled).toBe(true);
    expect(user.deletedAt).toBeNull();
  });

  it('create() có googleId → authProvider=google', () => {
    const user = User.create({
      id: 'u-1',
      email: 'a@b.com',
      googleId: 'gid-1',
      firstName: 'A',
      lastName: 'B',
      now: NOW,
    });

    expect(user.authProvider).toBe('google');
    expect(user.isGoogleAccount()).toBe(true);
  });

  it('create() phát domain event user.created', () => {
    const user = User.create({
      id: 'u-1',
      email: 'a@b.com',
      passwordHash: 'h',
      firstName: 'A',
      lastName: 'B',
      now: NOW,
    });

    const events = user.dispatchDomainEvents();
    expect(events[0]?.eventType).toBe('user.created');
    expect(user.dispatchDomainEvents()).toHaveLength(0);
  });

  it('reconstitute() không phát domain event', () => {
    expect(buildUser().domainEvents).toHaveLength(0);
  });
});

describe('User entity — truy vấn', () => {
  it('canLogin(): active + chưa xoá → true', () => {
    expect(buildUser().canLogin()).toBe(true);
  });

  it('canLogin(): blocked → false', () => {
    expect(buildUser({ status: 'blocked' }).canLogin()).toBe(false);
  });

  it('canLogin(): đã xoá mềm → false', () => {
    expect(buildUser({ deletedAt: NOW }).canLogin()).toBe(false);
  });

  it('isAdmin(): role=admin → true', () => {
    expect(buildUser({ role: 'admin' }).isAdmin()).toBe(true);
    expect(buildUser({ role: 'analyst' }).isAdmin()).toBe(false);
  });

  it('isDeleted(): deletedAt khác null → true', () => {
    expect(buildUser({ deletedAt: NOW }).isDeleted()).toBe(true);
    expect(buildUser().isDeleted()).toBe(false);
  });
});

describe('User entity — assertCanLogin()', () => {
  it('tài khoản active → không ném', () => {
    expect(() => buildUser().assertCanLogin()).not.toThrow();
  });

  it('tài khoản bị khoá → ForbiddenError', () => {
    expect(() => buildUser({ status: 'blocked' }).assertCanLogin()).toThrow(ForbiddenError);
  });

  it('tài khoản đã xoá → ForbiddenError', () => {
    expect(() => buildUser({ deletedAt: NOW }).assertCanLogin()).toThrow(ForbiddenError);
  });
});

describe('User entity — updateProfile()', () => {
  it('cập nhật họ tên, điện thoại, giới thiệu', () => {
    const user = buildUser();
    user.updateProfile({
      firstName: '  Tran  ',
      lastName: 'Van B',
      phone: ' +84901234567 ',
      bio: 'Kỹ sư dữ liệu',
    });

    expect(user.firstName).toBe('Tran');
    expect(user.lastName).toBe('Van B');
    expect(user.phone).toBe('+84901234567');
    expect(user.bio).toBe('Kỹ sư dữ liệu');
  });

  it('tên rỗng → ValidationError', () => {
    expect(() => buildUser().updateProfile({ firstName: '   ' })).toThrow(ValidationError);
  });

  it('họ rỗng → ValidationError', () => {
    expect(() => buildUser().updateProfile({ lastName: '' })).toThrow(ValidationError);
  });

  it('tên > 50 ký tự → ValidationError', () => {
    expect(() => buildUser().updateProfile({ firstName: 'x'.repeat(51) })).toThrow(ValidationError);
  });

  it('giới thiệu > 500 ký tự → ValidationError', () => {
    expect(() => buildUser().updateProfile({ bio: 'x'.repeat(501) })).toThrow(ValidationError);
  });

  it('chuỗi rỗng → null (xoá giá trị)', () => {
    const user = buildUser({ phone: '123', bio: 'old' });
    user.updateProfile({ phone: '', bio: '' });

    expect(user.phone).toBeNull();
    expect(user.bio).toBeNull();
  });

  it('không truyền field nào → giữ nguyên', () => {
    const user = buildUser();
    user.updateProfile({});
    expect(user.firstName).toBe('Nguyen');
    expect(user.phone).toBeNull();
  });
});

describe('User entity — changeEmail()', () => {
  it('đổi email → chuẩn hoá', () => {
    const user = buildUser();
    user.changeEmail('  NEW@Example.com ');
    expect(user.email).toBe('new@example.com');
  });

  it('email rỗng → ValidationError', () => {
    expect(() => buildUser().changeEmail('  ')).toThrow(ValidationError);
  });

  it('email không đổi → ConflictError', () => {
    expect(() => buildUser().changeEmail('user@example.com')).toThrow(ConflictError);
  });
});

describe('User entity — setPasswordHash()', () => {
  it('đặt hash mới', () => {
    const user = buildUser();
    user.setPasswordHash('new-hash');
    expect(user.passwordHash).toBe('new-hash');
  });

  it('hash rỗng → ValidationError', () => {
    expect(() => buildUser().setPasswordHash('  ')).toThrow(ValidationError);
  });
});

describe('User entity — linkGoogleId()', () => {
  it('gắn google id + chuyển authProvider sang google', () => {
    const user = buildUser();
    user.linkGoogleId('  gid-1  ');

    expect(user.googleId).toBe('gid-1');
    expect(user.authProvider).toBe('google');
  });

  it('google id rỗng → ValidationError', () => {
    expect(() => buildUser().linkGoogleId(' ')).toThrow(ValidationError);
  });
});

describe('User entity — setNotificationsEnabled()', () => {
  it('bật/tắt thông báo', () => {
    const user = buildUser();
    user.setNotificationsEnabled(false);
    expect(user.notificationsEnabled).toBe(false);
  });
});

describe('User entity — block()/unblock()', () => {
  it('block() chuyển status=blocked + phát event user.blocked', () => {
    const user = buildUser();
    user.block();

    expect(user.status).toBe('blocked');
    expect(user.canLogin()).toBe(false);
    const events = user.dispatchDomainEvents();
    expect(events[0]?.eventType).toBe('user.blocked');
  });

  it('block() tài khoản đã khoá → ConflictError', () => {
    expect(() => buildUser({ status: 'blocked' }).block()).toThrow(ConflictError);
  });

  it('unblock() chuyển status=active + phát event user.unblocked', () => {
    const user = buildUser({ status: 'blocked' });
    user.unblock();

    expect(user.status).toBe('active');
    const events = user.dispatchDomainEvents();
    expect(events[0]?.eventType).toBe('user.unblocked');
  });

  it('unblock() tài khoản không bị khoá → ConflictError', () => {
    expect(() => buildUser().unblock()).toThrow(ConflictError);
  });
});

describe('User entity — softDelete()', () => {
  it('đánh dấu xoá + chặn đăng nhập', () => {
    const user = buildUser();
    user.softDelete();

    expect(user.isDeleted()).toBe(true);
    expect(user.canLogin()).toBe(false);
    expect(user.status).toBe('blocked');
  });

  it('xoá 2 lần → ConflictError', () => {
    const user = buildUser({ deletedAt: NOW });
    expect(() => user.softDelete()).toThrow(ConflictError);
  });
});

describe('User entity — toProps()', () => {
  it('toProps() trả bản chụp props đầy đủ', () => {
    const props = buildUser().toProps();
    expect(props.id).toBe('u-1');
    expect(props.email).toBe('user@example.com');
    expect(props.version).toBe(1);
  });
});
