import { Schema, Document, Types } from 'mongoose';

export interface IUserSession extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  refresh_token_hash: string;
  device_name?: string;
  ip_address?: string;
  user_agent?: string;
  is_revoked: boolean;
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
    expires_at: {
      type: Date,
      required: true,
      index: { expires: '7d' }, // TTL index dọn dẹp các session hết hạn
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

UserSessionSchema.index({ user_id: 1, is_revoked: 1 });
