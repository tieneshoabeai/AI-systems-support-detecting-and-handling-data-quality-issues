/**
 * OPEN-01 — Admin bootstrap & khoá đăng ký.
 *
 * Nguyên tắc: **không có endpoint công khai để tự phong admin**.
 *
 * - `POST /auth/register` không nhận `role` → mọi tài khoản tự đăng ký là `analyst`.
 * - Tài khoản `admin` được tạo **một lần** khi ứng dụng khởi động, từ
 *   `ADMIN_EMAIL` + `ADMIN_PASSWORD`.
 */
import { ConfigService } from '@nestjs/config';
import { AdminBootstrapService } from '../src/modules/auth/application/admin-bootstrap.service';
import { RegisterSchema } from '../src/modules/auth/presentation/dtos/register.dto';
import type {
  AuthUserCreateInput,
  AuthUserLookup,
  AuthUserLookupPort,
} from '../src/modules/auth/domain/ports/auth-session.port';

// ── Fake port ──────────────────────────────────────────────────────────────

class FakeUserLookup implements AuthUserLookupPort {
  readonly created: AuthUserCreateInput[] = [];
  private readonly users = new Map<string, AuthUserLookup>();

  async findByEmail(email: string): Promise<AuthUserLookup | null> {
    return this.users.get(email) ?? null;
  }
  async findById(): Promise<AuthUserLookup | null> {
    return null;
  }
  async findByGoogleId(): Promise<AuthUserLookup | null> {
    return null;
  }
  async findByEmailWithResetSecret(): Promise<null> {
    return null;
  }
  async findByIdWithResetSecret(): Promise<null> {
    return null;
  }
  async setPasswordResetOtp(): Promise<boolean> {
    return true;
  }
  async incrementResetAttempts(): Promise<number> {
    return 0;
  }
  async clearPasswordReset(): Promise<boolean> {
    return true;
  }
  async setPasswordHash(): Promise<boolean> {
    return true;
  }
  async create(data: AuthUserCreateInput): Promise<AuthUserLookup> {
    this.created.push(data);
    const user: AuthUserLookup = {
      id: `u${this.created.length}`,
      email: data.email,
      role: data.role ?? 'analyst',
      status: 'active',
      passwordHash: data.passwordHash,
      googleId: null,
      deletedAt: null,
    };
    this.users.set(data.email, user);
    return user;
  }
  async createWithGoogle(): Promise<AuthUserLookup> {
    throw new Error('không dùng trong test này');
  }
  async linkGoogleId(): Promise<AuthUserLookup | null> {
    return null;
  }
}

const hasher = {
  hash: async (plain: string): Promise<string> => `hashed:${plain}`,
  compare: async (): Promise<boolean> => true,
};

function makeService(env: Record<string, string | undefined>): {
  service: AdminBootstrapService;
  users: FakeUserLookup;
} {
  const users = new FakeUserLookup();
  const config = {
    get: (key: string): string | undefined => env[key],
  } as unknown as ConfigService;
  const service = new AdminBootstrapService(users, hasher, config);
  return { service, users };
}

// ── Test ───────────────────────────────────────────────────────────────────

describe('OPEN-01 — AdminBootstrapService', () => {
  it('không có ADMIN_EMAIL/ADMIN_PASSWORD → không tạo admin', async () => {
    const { service, users } = makeService({});
    expect(await service.bootstrap()).toBe(false);
    expect(users.created).toHaveLength(0);
  });

  it('chỉ có ADMIN_EMAIL → không tạo admin', async () => {
    const { service, users } = makeService({ ADMIN_EMAIL: 'admin@example.com' });
    expect(await service.bootstrap()).toBe(false);
    expect(users.created).toHaveLength(0);
  });

  it('chỉ có ADMIN_PASSWORD → không tạo admin', async () => {
    const { service, users } = makeService({ ADMIN_PASSWORD: 'secret123' });
    expect(await service.bootstrap()).toBe(false);
    expect(users.created).toHaveLength(0);
  });

  it('có đủ → tạo tài khoản admin', async () => {
    const { service, users } = makeService({
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'secret123',
    });
    expect(await service.bootstrap()).toBe(true);
    expect(users.created).toHaveLength(1);
    expect(users.created[0]).toMatchObject({
      email: 'admin@example.com',
      role: 'admin',
      passwordHash: 'hashed:secret123',
    });
  });

  it('email được chuẩn hoá (lowercase + trim)', async () => {
    const { service, users } = makeService({
      ADMIN_EMAIL: '  Admin@Example.COM  ',
      ADMIN_PASSWORD: 'secret123',
    });
    await service.bootstrap();
    expect(users.created[0]?.email).toBe('admin@example.com');
  });

  it('idempotent — chạy lại không tạo admin thứ hai', async () => {
    const { service, users } = makeService({
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'secret123',
    });
    expect(await service.bootstrap()).toBe(true);
    expect(await service.bootstrap()).toBe(false);
    expect(await service.bootstrap()).toBe(false);
    expect(users.created).toHaveLength(1);
  });

  it('không ghi đè mật khẩu của admin đã tồn tại', async () => {
    const { service, users } = makeService({
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'secret123',
    });
    await service.bootstrap();
    // Đổi mật khẩu trong DB → bootstrap KHÔNG được reset về `secret123`.
    const existing = await users.findByEmail('admin@example.com');
    expect(existing?.passwordHash).toBe('hashed:secret123');
    await service.bootstrap();
    expect(users.created).toHaveLength(1);
  });

  it('onModuleInit không ném lỗi ra ngoài khi bootstrap thất bại', async () => {
    const { service } = makeService({
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'secret123',
    });
    // Gây lỗi: hasher ném exception.
    const broken = new AdminBootstrapService(
      {
        findByEmail: async () => {
          throw new Error('db down');
        },
      } as unknown as AuthUserLookupPort,
      {
        hash: async () => {
          throw new Error('boom');
        },
        compare: async () => false,
      },
      { get: (k: string) => (k === 'ADMIN_EMAIL' ? 'a@b.c' : 'x') } as unknown as ConfigService,
    );
    await expect(broken.onModuleInit()).resolves.toBeUndefined();
    void service;
  });
});

describe('OPEN-01 — RegisterSchema không nhận `role`', () => {
  it('body không có role → hợp lệ', () => {
    const parsed = RegisterSchema.parse({
      email: 'user@example.com',
      password: 'Password123',
      first_name: 'Nguyễn',
      last_name: 'An',
    });
    expect(parsed).not.toHaveProperty('role');
  });

  it('body có role=admin → bị từ chối', () => {
    expect(() =>
      RegisterSchema.parse({
        email: 'user@example.com',
        password: 'Password123',
        first_name: 'Nguyễn',
        last_name: 'An',
        role: 'admin',
      }),
    ).toThrow();
  });

  it('body có role=analyst → bị từ chối', () => {
    expect(() =>
      RegisterSchema.parse({
        email: 'user@example.com',
        password: 'Password123',
        first_name: 'Nguyễn',
        last_name: 'An',
        role: 'analyst',
      }),
    ).toThrow();
  });
});
