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

