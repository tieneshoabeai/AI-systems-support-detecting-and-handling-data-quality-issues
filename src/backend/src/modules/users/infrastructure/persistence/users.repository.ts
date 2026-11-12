import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IUser } from './user.schema';
import { IUserSession } from './user-session.schema';
import {
  USER_REPOSITORY_PORT,
  type CreateSessionInput,
  type CreateUserInput,
  type UpdateProfileInput,
  type PasswordResetState,
  type UserRecord,
  type UserRepositoryPort,
  type UserSessionRecord,
} from '../../domain/ports/user.repository.port';

function toUserRecord(doc: IUser): UserRecord {
  return {
    id: doc._id.toString(),
    email: doc.email,
    passwordHash: doc.password_hash ?? null,
    googleId: doc.google_id ?? null,
    firstName: doc.first_name,
    lastName: doc.last_name,
    avatarUrl: doc.avatar_url ?? null,
    role: doc.role,
    notificationsEnabled: doc.notifications_enabled !== false,
    status: doc.status,
    deletedAt: doc.deleted_at,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

function toSessionRecord(doc: IUserSession): UserSessionRecord {
  return {
    id: doc._id.toString(),
    userId: doc.user_id.toString(),
    refreshTokenHash: doc.refresh_token_hash,
    deviceName: doc.device_name ?? null,
    ipAddress: doc.ip_address ?? null,
    userAgent: doc.user_agent ?? null,
    isRevoked: doc.is_revoked,
    expiresAt: doc.expires_at,
    createdAt: doc.created_at,
  };
}

/**
 * USERS — Infrastructure repository (driven adapter).
 * Triển khai USER_REPOSITORY_PORT; là nơi duy nhất chạm Mongoose schemas.
 */
@Injectable()
export class UsersRepository implements UserRepositoryPort {
  constructor(
    @InjectModel('User') private readonly userModel: Model<IUser>,
    @InjectModel('UserSession') private readonly sessionModel: Model<IUserSession>,
  ) {}

  async findByEmail(email: string, includePassword = false): Promise<UserRecord | null> {
    const query = this.userModel.findOne({ email, deleted_at: null });
    if (includePassword) query.select('+password_hash');
    const doc = await query.exec();
    return doc ? toUserRecord(doc) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.userModel
      .findOne({ _id: new Types.ObjectId(id), deleted_at: null })
      .exec();
    return doc ? toUserRecord(doc) : null;
  }

  async findByIdWithResetSecret(id: string): Promise<(UserRecord & PasswordResetState) | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.userModel.findOne({ _id: new Types.ObjectId(id), deleted_at: null }).select('+password_hash +password_reset_token_hash +password_reset_expires_at +password_reset_attempts +password_reset_sent_count +password_reset_sent_window_start').exec();
    if (!doc) return null;
    const base = toUserRecord(doc);
    return { ...base, tokenHash: doc.password_reset_token_hash ?? null, expiresAt: doc.password_reset_expires_at ?? null, attempts: doc.password_reset_attempts ?? 0, sentCount: doc.password_reset_sent_count ?? 0, windowStart: doc.password_reset_sent_window_start ?? null };
  }

  async findByEmailWithResetSecret(email: string): Promise<(UserRecord & PasswordResetState) | null> {
    const doc = await this.userModel.findOne({ email, deleted_at: null }).select('+password_hash +password_reset_token_hash +password_reset_expires_at +password_reset_attempts +password_reset_sent_count +password_reset_sent_window_start').exec();
    if (!doc) return null;
    const base = toUserRecord(doc);
    return { ...base, tokenHash: doc.password_reset_token_hash ?? null, expiresAt: doc.password_reset_expires_at ?? null, attempts: doc.password_reset_attempts ?? 0, sentCount: doc.password_reset_sent_count ?? 0, windowStart: doc.password_reset_sent_window_start ?? null };
  }

  async setPasswordResetOtp(email: string, tokenHash: string, expiresAt: Date, sentCount: number, windowStart: Date | null): Promise<boolean> {
    const r = await this.userModel.updateOne({ email, deleted_at: null }, { $set: { password_reset_token_hash: tokenHash, password_reset_expires_at: expiresAt, password_reset_attempts: 0, password_reset_sent_count: sentCount, password_reset_sent_window_start: windowStart } }).exec();
    return r.modifiedCount > 0;
  }

  async incrementResetAttempts(email: string): Promise<number> {
    const doc = await this.userModel.findOneAndUpdate({ email, deleted_at: null }, { $inc: { password_reset_attempts: 1 } }, { new: true }).select('+password_reset_attempts').exec();
    return doc?.password_reset_attempts ?? 0;
  }

  async clearPasswordReset(email: string): Promise<boolean> {
    const r = await this.userModel.updateOne({ email, deleted_at: null }, { $set: { password_reset_token_hash: null, password_reset_expires_at: null, password_reset_attempts: 0 } }).exec();
    return r.matchedCount > 0;
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) return false;
    const r = await this.userModel.updateOne({ _id: new Types.ObjectId(userId), deleted_at: null }, { $set: { password_hash: passwordHash } }).exec();
    return r.modifiedCount > 0;
  }

  async findPaged(opts: { search?: string; role?: string; status?: string; page: number; limit: number }): Promise<{ items: UserRecord[]; total: number }> {
    const filter: Record<string, unknown> = { deleted_at: null };
    if (opts.search?.trim()) {
      const s = opts.search.trim();
      filter.$or = [{ email: { $regex: s, $options: 'i' } }, { first_name: { $regex: s, $options: 'i' } }, { last_name: { $regex: s, $options: 'i' } }];
    }
    if (opts.role) filter.role = opts.role;
    if (opts.status) filter.status = opts.status;
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, Math.max(1, opts.limit || 15));
    const [docs, total] = await Promise.all([
      this.userModel.find(filter).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);
    return { items: docs.map(toUserRecord), total };
  }

  async create(data: CreateUserInput): Promise<UserRecord> {
    const inst = new this.userModel({
      email: data.email,
      password_hash: data.passwordHash,
      first_name: data.firstName,
      last_name: data.lastName,
      role: data.role ?? 'analyst',
      deleted_at: null,
    });
    const saved = await inst.save();
    return toUserRecord(saved);
  }

  async updateProfile(userId: string, data: UpdateProfileInput): Promise<UserRecord | null> {
    const doc = await this.userModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(userId), deleted_at: null },
        {
          $set: {
            ...(data.firstName !== undefined ? { first_name: data.firstName } : {}),
            ...(data.lastName !== undefined ? { last_name: data.lastName } : {}),
            ...(data.avatarUrl !== undefined ? { avatar_url: data.avatarUrl } : {}),
          },
        },
        { new: true },
      )
      .exec();
    return doc ? toUserRecord(doc) : null;
  }

  async updateNotificationPreferences(userId: string, enabled: boolean): Promise<boolean> {
    const doc = await this.userModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(userId), deleted_at: null },
        { $set: { notifications_enabled: enabled } },
        { new: true },
      )
      .exec();
    return !!doc;
  }

  async softDeleteUser(userId: string): Promise<boolean> {
    const result = await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId), deleted_at: null },
      { $set: { deleted_at: new Date() } },
    );
    if (result.matchedCount === 0) return false;
    await this.sessionModel.updateMany(
      { user_id: new Types.ObjectId(userId), is_revoked: false },
      { $set: { is_revoked: true } },
    );
    return true;
  }

  async createSession(data: CreateSessionInput): Promise<UserSessionRecord> {
    const inst = new this.sessionModel({
      user_id: new Types.ObjectId(data.userId),
      refresh_token_hash: data.refreshTokenHash,
      device_name: data.deviceName ?? 'Unknown Device',
      ip_address: data.ipAddress ?? null,
      user_agent: data.userAgent ?? null,
      is_revoked: false,
      expires_at: data.expiresAt,
    });
    const saved = await inst.save();
    return toSessionRecord(saved);
  }

  async findActiveSessions(userId: string): Promise<UserSessionRecord[]> {
    const docs = await this.sessionModel
      .find({
        user_id: new Types.ObjectId(userId),
        is_revoked: false,
        expires_at: { $gt: new Date() },
      })
      .sort({ created_at: -1 })
      .exec();
    return docs.map(toSessionRecord);
  }

  async findSessionByTokenHashIncludingRevoked(refreshTokenHash: string): Promise<UserSessionRecord | null> {
    const doc = await this.sessionModel
      .findOne({ refresh_token_hash: refreshTokenHash })
      .exec();
    return doc ? toSessionRecord(doc) : null;
  }

  async findSessionByTokenHash(refreshTokenHash: string): Promise<UserSessionRecord | null> {
    const doc = await this.sessionModel
      .findOne({ refresh_token_hash: refreshTokenHash, is_revoked: false, expires_at: { $gt: new Date() } })
      .exec();
    return doc ? toSessionRecord(doc) : null;
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(sessionId)) return false;
    const result = await this.sessionModel.updateOne(
      { _id: new Types.ObjectId(sessionId), user_id: new Types.ObjectId(userId) },
      { $set: { is_revoked: true } },
    );
    return result.modifiedCount > 0;
  }

  async revokeSessionById(sessionId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(sessionId)) return false;
    const result = await this.sessionModel.updateOne(
      { _id: new Types.ObjectId(sessionId) },
      { $set: { is_revoked: true } },
    );
    return result.modifiedCount > 0;
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const result = await this.sessionModel.updateMany(
      { user_id: new Types.ObjectId(userId), is_revoked: false },
      { $set: { is_revoked: true } },
    );
    return result.modifiedCount;
  }
}

