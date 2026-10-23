import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IUser } from './schemas/user.schema';
import { IUserSession } from './schemas/user-session.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<IUser>,
    @InjectModel('UserSession') private readonly sessionModel: Model<IUserSession>
  ) {}

  async findByEmail(email: string, includePassword = false): Promise<IUser | null> {
    const query = this.userModel.findOne({
      email: email.toLowerCase().trim(),
      deleted_at: null,
    });

    if (includePassword) {
      query.select('+password_hash');
    }

    return query.exec();
  }

  async findById(id: string): Promise<IUser | null> {
    return this.userModel
      .findOne({
        _id: new Types.ObjectId(id),
        deleted_at: null,
      })
      .exec();
  }

  async createUser(data: {
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    role?: 'admin' | 'analyst';
  }): Promise<IUser> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('Email này đã được sử dụng bởi một tài khoản khác');
    }

    const newUser = new this.userModel({
      ...data,
      email: data.email.toLowerCase().trim(),
      deleted_at: null,
    });

    return newUser.save();
  }

  async updateProfile(
    userId: string,
    data: { first_name?: string; last_name?: string; avatar_url?: string }
  ): Promise<IUser> {
    const user = await this.userModel.findOneAndUpdate(
      { _id: new Types.ObjectId(userId), deleted_at: null },
      { $set: data },
      { new: true }
    );

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    return user;
  }

  async softDeleteUser(userId: string): Promise<boolean> {
    const result = await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId), deleted_at: null },
      { $set: { deleted_at: new Date() } }
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('Không tìm thấy tài khoản hoặc tài khoản đã bị xóa');
    }

    // Thu hồi toàn bộ session đang mở của user này
    await this.sessionModel.updateMany(
      { user_id: new Types.ObjectId(userId), is_revoked: false },
      { $set: { is_revoked: true } }
    );

    return true;
  }

  async createSession(data: {
    user_id: Types.ObjectId | string;
    refresh_token_hash: string;
    device_name?: string;
    ip_address?: string;
    user_agent?: string;
    expires_at: Date;
  }): Promise<IUserSession> {
    const session = new this.sessionModel({
      ...data,
      user_id: new Types.ObjectId(data.user_id),
      is_revoked: false,
    });

    return session.save();
  }

  async findActiveSessions(userId: string): Promise<IUserSession[]> {
    return this.sessionModel
      .find({
        user_id: new Types.ObjectId(userId),
        is_revoked: false,
        expires_at: { $gt: new Date() },
      })
      .sort({ created_at: -1 })
      .exec();
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.sessionModel.updateOne(
      {
        _id: new Types.ObjectId(sessionId),
        user_id: new Types.ObjectId(userId),
      },
      { $set: { is_revoked: true } }
    );

    return result.modifiedCount > 0;
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const result = await this.sessionModel.updateMany(
      {
        user_id: new Types.ObjectId(userId),
        is_revoked: false,
      },
      { $set: { is_revoked: true } }
    );

    return result.modifiedCount;
  }

  async findSessionByTokenHash(refreshTokenHash: string): Promise<IUserSession | null> {
    return this.sessionModel
      .findOne({
        refresh_token_hash: refreshTokenHash,
        is_revoked: false,
        expires_at: { $gt: new Date() },
      })
      .exec();
  }

  async revokeSessionById(sessionId: string): Promise<boolean> {
    const result = await this.sessionModel.updateOne(
      { _id: new Types.ObjectId(sessionId) },
      { $set: { is_revoked: true } }
    );
    return result.modifiedCount > 0;
  }
}
