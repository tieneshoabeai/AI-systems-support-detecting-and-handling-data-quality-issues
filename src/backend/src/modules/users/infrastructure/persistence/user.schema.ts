import type { Document, Types } from 'mongoose';
import { Schema } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password_hash?: string;
  google_id?: string;
  /** Nguồn đăng nhập — `local` (email + mật khẩu) hoặc `google` (AUTH-03). */
  auth_provider?: 'local' | 'google';
  first_name: string;
  last_name: string;
  avatar_url?: string;
  /** Số điện thoại (E.164-ish). Duy nhất qua partial unique index ở dưới. */
  phone?: string;
  /** Giới thiệu ngắn, tối đa 500 ký tự. */
  bio?: string;
  role: 'admin' | 'analyst';
  notifications_enabled: boolean;
  status: 'active' | 'blocked';
  password_reset_token_hash?: string;
  password_reset_expires_at?: Date;
  password_reset_attempts?: number;
  password_reset_sent_count?: number;
  password_reset_sent_window_start?: Date;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      select: false,
    },
    google_id: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    auth_provider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
      index: true,
    },
    first_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    avatar_url: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    role: {
      type: String,
      enum: ['admin', 'analyst'],
      default: 'analyst',
      index: true,
    },
    notifications_enabled: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'blocked'],
      default: 'active',
      index: true,
    },
    password_reset_token_hash: {
      type: String,
      default: null,
      select: false,
    },
    password_reset_expires_at: {
      type: Date,
      default: null,
      select: false,
    },
    password_reset_attempts: {
      type: Number,
      default: 0,
      select: false,
    },
    password_reset_sent_count: {
      type: Number,
      default: 0,
      select: false,
    },
    password_reset_sent_window_start: {
      type: Date,
      default: null,
      select: false,
    },
    deleted_at: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Hỗ trợ Cursor Pagination theo created_at và _id khi tài khoản chưa bị xóa
UserSchema.index({ created_at: -1, _id: -1 });

// Partial Unique Index: Chỉ kiểm tra unique email cho các tài khoản chưa xóa mềm (deleted_at === null)
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } }
);

// Partial Unique Index: số điện thoại phải duy nhất (chỉ khi có giá trị).
UserSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }
);
