import { Schema, Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password_hash?: string;
  google_id?: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  role: 'admin' | 'analyst';
  status: 'active' | 'blocked';
  password_reset_token_hash?: string;
  password_reset_expires_at?: Date;
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
    role: {
      type: String,
      enum: ['admin', 'analyst'],
      default: 'analyst',
      index: true,
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
