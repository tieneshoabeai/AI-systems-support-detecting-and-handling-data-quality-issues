import type { Document, Types } from 'mongoose';
import { Schema } from 'mongoose';

export interface IUserSession extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  refresh_token_hash: string;
  device_name?: string;
  ip_address?: string;
  user_agent?: string;
  is_revoked: boolean;
  /** Cờ "ghi nhớ đăng nhập" — phiên sống lâu hơn (mặc định 30 ngày thay vì 7 ngày). */
  remember_me: boolean;
  /** Lần cuối phiên được dùng (refresh token) — dùng để hiển thị "hoạt động gần nhất". */
  last_used_at?: Date | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export const UserSessionSchema = new Schema<IUserSession>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refresh_token_hash: {
      type: String,
      required: true,
      select: false,
    },
    device_name: {
      type: String,
      default: 'Unknown Device',
    },
    ip_address: {
      type: String,
      default: null,
    },
    user_agent: {
      type: String,
      default: null,
    },
    is_revoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    remember_me: {
      type: Boolean,
      default: false,
    },
    last_used_at: {
      type: Date,
      default: null,
    },
    expires_at: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

UserSessionSchema.index({ user_id: 1, is_revoked: 1 });

/**
 * TTL index theo `expires_at` thật.
 *
 * Ghi chú: TTL của MongoDB dùng `expireAfterSeconds` (số giây cộng thêm vào giá trị
 * ngày trong field). Trước đây schema dùng `index: { expires: '7d' }` — tức TTL 7 ngày
 * tính TỪ `expires_at`, khiến phiên "ghi nhớ đăng nhập" (30 ngày) bị xoá sớm.
 * Nay dùng `expireAfterSeconds: 0` ⇒ tài liệu bị xoá đúng lúc `expires_at` tới hạn.
 */
UserSessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
