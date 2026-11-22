import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IUser } from './user.schema';
import { IUserSession } from './user-session.schema';
import { resolveMongoSession } from '../../../../shared/infrastructure/database/mongo-session-context';
import {
  type CreateSessionInput,
  type CreateUserInput,
  type CreateUserWithGoogleInput,
  type UpdateProfileInput,
  type UserListQuery,
  type UserRepositoryPort,
  type UserWithResetSecret,
} from '../../domain/ports/user.repository.port';
import type { User } from '../../domain/entities/user.entity';
import type { UserSession } from '../../domain/entities/user-session.entity';
import {
  toUserEntity,
  toUserSessionEntity,
  toUserWithResetSecret,
} from './user.mapper';
import {
  buildKeysetCondition,
  buildKeysetSort,
  type KeysetSortSpec,
} from '../../../../shared/domain/pagination/keyset-filter.util';
import { extractSortValue } from '../../../../shared/domain/pagination/keyset-value.util';
import { encodeKeysetCursor } from '../../../../shared/domain/pagination/keyset-cursor';

/** Số trang mặc định của danh sách hồ sơ (ADMIN-01). */
const DEFAULT_LIMIT = 15;

/**
 * Bảng ánh xạ `sortBy` (hợp đồng §3.4) → trường trong collection.
 *
 * `name` là trường ** tính toán** (ghép `first_name` + `last_name`) nên không sort
 * được trực tiếp ở MongoDB → dùng `first_name` làm trường đại diện.
 */
const USER_SORT_FIELDS: Record<string, { field: string; isDate: boolean }> = {
  created_at: { field: 'created_at', isDate: true },
  updated_at: { field: 'updated_at', isDate: true },
  name: { field: 'first_name', isDate: false },
  email: { field: 'email', isDate: false },
  role: { field: 'role', isDate: false },
  status: { field: 'status', isDate: false },
};

/** Mặc định: `createdAt` desc (hợp đồng §3.4). */
const DEFAULT_USER_SORT = 'created_at';
const DEFAULT_USER_SORT_ORDER: 'asc' | 'desc' = 'desc';

/**
 * Chuyển `sortBy` + `sortOrder` (hợp đồng) → đặc tả keyset.
 *
 * Trả về `code` là mã sort đã chuẩn hoá — dùng làm thành phần `s` của con trỏ,
 * nên con trỏ sinh với `sortBy=A` **không** dùng được cho `sortBy=B`.
 */
function resolveUserSortSpec(
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
): { code: string; spec: KeysetSortSpec } {
  const field = USER_SORT_FIELDS[sortBy ?? ''] ? (sortBy as string) : DEFAULT_USER_SORT;
  const direction = sortOrder === 'asc' ? 1 : sortOrder === 'desc' ? -1 : DEFAULT_USER_SORT_ORDER === 'asc' ? 1 : -1;
  const entry = USER_SORT_FIELDS[field] ?? USER_SORT_FIELDS[DEFAULT_USER_SORT];
  if (!entry) {
    throw new Error('Không tìm thấy đặc tả sắp xếp keyset mặc định cho hồ sơ');
  }
  return {
    // Mã sort gồm cả chiều → đổi `sortOrder` cũng làm con trỏ cũ không hợp lệ.
    code: `${field}_${direction === 1 ? 'asc' : 'desc'}`,
    spec: { field: entry.field, direction, isDate: entry.isDate },
  };
}

/**
 * USERS — Infrastructure repository (driven adapter).
 * Triển khai USER_REPOSITORY_PORT; là nơi duy nhất chạm Mongoose schemas.
 *
 * **Bước 3 — Rich Domain Model:** trả entity `User` / `UserSession`.
 */
@Injectable()
export class UsersRepository implements UserRepositoryPort {
  constructor(
    @InjectModel('User') private readonly userModel: Model<IUser>,
    @InjectModel('UserSession') private readonly sessionModel: Model<IUserSession>,
  ) {}

  async findByEmail(email: string, includePassword = false): Promise<User | null> {
    const query = this.userModel.findOne({ email, deleted_at: null });
    if (includePassword) query.select('+password_hash');
    const doc = await query.exec();
    return doc ? toUserEntity(doc) : null;
  }

  async findById(id: string): Promise<User | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.userModel
      .findOne({ _id: new Types.ObjectId(id), deleted_at: null })
      .exec();
    return doc ? toUserEntity(doc) : null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const trimmed = phone.trim();
    if (!trimmed) return null;
    const doc = await this.userModel.findOne({ phone: trimmed, deleted_at: null }).exec();
    return doc ? toUserEntity(doc) : null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    if (!googleId.trim()) return null;
    const doc = await this.userModel.findOne({ google_id: googleId, deleted_at: null }).exec();
    return doc ? toUserEntity(doc) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    const valid = ids.filter((id) => Types.ObjectId.isValid(id));
    if (valid.length === 0) return [];
    const docs = await this.userModel
      .find({ _id: { $in: valid.map((id) => new Types.ObjectId(id)) }, deleted_at: null })
      .exec();
    return docs.map(toUserEntity);
  }

  async findByIdWithResetSecret(id: string): Promise<UserWithResetSecret | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.userModel.findOne({ _id: new Types.ObjectId(id), deleted_at: null }).select('+password_hash +password_reset_token_hash +password_reset_expires_at +password_reset_attempts +password_reset_sent_count +password_reset_sent_window_start').exec();
    if (!doc) return null;
    return toUserWithResetSecret(doc);
  }

  async findByEmailWithResetSecret(email: string): Promise<UserWithResetSecret | null> {
    const doc = await this.userModel.findOne({ email, deleted_at: null }).select('+password_hash +password_reset_token_hash +password_reset_expires_at +password_reset_attempts +password_reset_sent_count +password_reset_sent_window_start').exec();
    if (!doc) return null;
    return toUserWithResetSecret(doc);
  }

  async setPasswordResetOtp(email: string, tokenHash: string, expiresAt: Date, sentCount: number, windowStart: Date | null): Promise<boolean> {
    const s = resolveMongoSession(undefined);
    const r = await this.userModel.updateOne({ email, deleted_at: null }, { $set: { password_reset_token_hash: tokenHash, password_reset_expires_at: expiresAt, password_reset_attempts: 0, password_reset_sent_count: sentCount, password_reset_sent_window_start: windowStart } }, { session: s }).exec();
    return r.modifiedCount > 0;
  }

  async incrementResetAttempts(email: string): Promise<number> {
    const s = resolveMongoSession(undefined);
    const doc = await this.userModel.findOneAndUpdate({ email, deleted_at: null }, { $inc: { password_reset_attempts: 1 } }, { new: true, session: s }).select('+password_reset_attempts').exec();
    return doc?.password_reset_attempts ?? 0;
  }

  async clearPasswordReset(email: string): Promise<boolean> {
    const s = resolveMongoSession(undefined);
    const r = await this.userModel.updateOne({ email, deleted_at: null }, { $set: { password_reset_token_hash: null, password_reset_expires_at: null, password_reset_attempts: 0 } }, { session: s }).exec();
    return r.matchedCount > 0;
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) return false;
    const s = resolveMongoSession(undefined);
    const r = await this.userModel.updateOne({ _id: new Types.ObjectId(userId), deleted_at: null }, { $set: { password_hash: passwordHash } }, { session: s }).exec();
    return r.modifiedCount > 0;
  }

  async findPaged(opts: UserListQuery): Promise<{ items: User[]; nextCursor: string | null; hasMore: boolean }> {
    const filter: Record<string, unknown> = { deleted_at: null };
    if (opts.search?.trim()) {
      const s = opts.search.trim();
      filter.$or = [{ email: { $regex: s, $options: 'i' } }, { first_name: { $regex: s, $options: 'i' } }, { last_name: { $regex: s, $options: 'i' } }];
    }
    if (opts.role) filter.role = opts.role;
    if (opts.status) filter.status = opts.status;

    const limit = Math.min(100, Math.max(1, opts.limit || DEFAULT_LIMIT));
    const { code, spec } = resolveUserSortSpec(opts.sort, opts.sortOrder);

    // Điều kiện keyset: chỉ áp dụng khi có con trỏ hợp lệ.
    const cursor = opts.cursor;
    if (cursor) {
      filter.$and = [
        buildKeysetCondition(spec, {
          value: cursor.value,
          isNull: cursor.isNull,
          id: cursor.id,
        }),
      ];
    }

    // Lấy limit + 1 để biết còn dữ liệu hay không (không cần countDocuments).
    const docs = await this.userModel
      .find(filter)
      .sort(buildKeysetSort(spec))
      .limit(limit + 1)
      .exec();

    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;
    const items = page.map(toUserEntity);

    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1] as unknown as Record<string, unknown>;
      const sortValue = extractSortValue(spec, last);
      nextCursor = encodeKeysetCursor({
        s: code,
        k: sortValue.value,
        n: sortValue.isNull ? 1 : 0,
        id: String((last as { _id: unknown })._id),
      });
    }

    return { items, nextCursor, hasMore };
  }

  async create(data: CreateUserInput): Promise<User> {
    const inst = new this.userModel({
      email: data.email,
      password_hash: data.passwordHash ?? undefined,
      google_id: data.googleId ?? undefined,
      auth_provider: data.authProvider,
      first_name: data.firstName,
      last_name: data.lastName,
      avatar_url: data.avatarUrl ?? null,
      role: data.role,
      deleted_at: null,
    });
    const s = resolveMongoSession(undefined);
    const saved = await inst.save({ session: s });
    return toUserEntity(saved);
  }

  async createWithGoogle(data: CreateUserWithGoogleInput): Promise<User> {
    const inst = new this.userModel({
      email: data.email,
      // Tài khoản đăng nhập bằng Google không có mật khẩu — không tạo hash rỗng.
      password_hash: undefined,
      google_id: data.googleId,
      auth_provider: 'google',
      first_name: data.firstName,
      last_name: data.lastName,
      avatar_url: data.avatarUrl ?? null,
      role: 'analyst',
      status: 'active',
      deleted_at: null,
    });
    const s = resolveMongoSession(undefined);
    const saved = await inst.save({ session: s });
    return toUserEntity(saved);
  }

  async linkGoogleId(userId: string, googleId: string): Promise<User | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    const gid = googleId.trim();
    if (!gid) return null;
    // `google_id` đã bị tài khoản khác chiếm → không liên kết (tránh chiếm đoạt).
    const owner = await this.userModel.findOne({ google_id: gid, deleted_at: null }).exec();
    if (owner && owner._id.toString() !== userId) return null;
    const doc = await this.userModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(userId), deleted_at: null },
        { $set: { google_id: gid, auth_provider: 'google' } },
        { new: true, session: resolveMongoSession(undefined) },
      )
      .exec();
    return doc ? toUserEntity(doc) : null;
  }

  async updateProfile(userId: string, data: UpdateProfileInput): Promise<User | null> {
    const doc = await this.userModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(userId), deleted_at: null },
        {
          $set: {
            ...(data.firstName !== undefined ? { first_name: data.firstName } : {}),
            ...(data.lastName !== undefined ? { last_name: data.lastName } : {}),
            ...(data.avatarUrl !== undefined ? { avatar_url: data.avatarUrl } : {}),
            ...(data.phone !== undefined ? { phone: data.phone } : {}),
            ...(data.bio !== undefined ? { bio: data.bio } : {}),
          },
        },
        { new: true, session: resolveMongoSession(undefined) },
      )
      .exec();
    return doc ? toUserEntity(doc) : null;
  }

  async updateNotificationPreferences(userId: string, enabled: boolean): Promise<boolean> {
    const doc = await this.userModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(userId), deleted_at: null },
        { $set: { notifications_enabled: enabled } },
        { new: true, session: resolveMongoSession(undefined) },
      )
      .exec();
    return doc !== null;
  }

  async setStatus(userId: string, status: 'active' | 'blocked'): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) return false;
    const s = resolveMongoSession(undefined);
    const result = await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId), deleted_at: null },
      { $set: { status } },
      { session: s },
    );
    return result.matchedCount > 0;
  }

  async softDeleteUser(userId: string): Promise<boolean> {
    const s = resolveMongoSession(undefined);
    const result = await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId), deleted_at: null },
      { $set: { deleted_at: new Date() } },
      { session: s },
    );
    if (result.matchedCount === 0) return false;
    await this.sessionModel.updateMany(
      { user_id: new Types.ObjectId(userId), is_revoked: false },
      { $set: { is_revoked: true } },
      { session: s },
    );
    return true;
  }

  async createSession(data: CreateSessionInput): Promise<UserSession> {
    const inst = new this.sessionModel({
      user_id: new Types.ObjectId(data.userId),
      refresh_token_hash: data.refreshTokenHash,
      device_name: data.deviceName ?? 'Unknown Device',
      ip_address: data.ipAddress ?? null,
      user_agent: data.userAgent ?? null,
      is_revoked: false,
      remember_me: data.rememberMe === true,
      last_used_at: new Date(),
      expires_at: data.expiresAt,
    });
    const s = resolveMongoSession(undefined);
    const saved = await inst.save({ session: s });
    return toUserSessionEntity(saved);
  }

  async findActiveSessions(userId: string): Promise<UserSession[]> {
    const docs = await this.sessionModel
      .find({
        user_id: new Types.ObjectId(userId),
        is_revoked: false,
        expires_at: { $gt: new Date() },
      })
      .sort({ created_at: -1 })
      .exec();
    return docs.map(toUserSessionEntity);
  }

  async findSessionByTokenHashIncludingRevoked(refreshTokenHash: string): Promise<UserSession | null> {
    const doc = await this.sessionModel
      .findOne({ refresh_token_hash: refreshTokenHash })
      .exec();
    return doc ? toUserSessionEntity(doc) : null;
  }

  async findSessionByTokenHash(refreshTokenHash: string): Promise<UserSession | null> {
    const doc = await this.sessionModel
      .findOne({ refresh_token_hash: refreshTokenHash, is_revoked: false, expires_at: { $gt: new Date() } })
      .exec();
    return doc ? toUserSessionEntity(doc) : null;
  }

  async findSessionById(sessionId: string): Promise<UserSession | null> {
    if (!Types.ObjectId.isValid(sessionId)) return null;
    const doc = await this.sessionModel
      .findOne({ _id: new Types.ObjectId(sessionId) })
      .select('+refresh_token_hash')
      .exec();
    return doc ? toUserSessionEntity(doc) : null;
  }

  async touchSession(sessionId: string, lastUsedAt: Date): Promise<boolean> {
    if (!Types.ObjectId.isValid(sessionId)) return false;
    const s = resolveMongoSession(undefined);
    const result = await this.sessionModel.updateOne(
      { _id: new Types.ObjectId(sessionId) },
      { $set: { last_used_at: lastUsedAt } },
      { session: s },
    );
    return result.matchedCount > 0;
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(sessionId)) return false;
    const s = resolveMongoSession(undefined);
    const result = await this.sessionModel.updateOne(
      { _id: new Types.ObjectId(sessionId), user_id: new Types.ObjectId(userId) },
      { $set: { is_revoked: true } },
      { session: s },
    );
    return result.modifiedCount > 0;
  }

  async revokeSessionById(sessionId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(sessionId)) return false;
    const s = resolveMongoSession(undefined);
    const result = await this.sessionModel.updateOne(
      { _id: new Types.ObjectId(sessionId) },
      { $set: { is_revoked: true } },
      { session: s },
    );
    return result.modifiedCount > 0;
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const s = resolveMongoSession(undefined);
    const result = await this.sessionModel.updateMany(
      { user_id: new Types.ObjectId(userId), is_revoked: false },
      { $set: { is_revoked: true } },
      { session: s },
    );
    return result.modifiedCount;
  }
}
