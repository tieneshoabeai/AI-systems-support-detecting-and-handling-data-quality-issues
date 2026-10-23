import { Schema, Document, Types } from 'mongoose';

export interface IOutboxEvent extends Document {
  _id: Types.ObjectId;
  aggregate_type: 'DATASET' | 'DATASET_VERSION' | 'TRANSFORMATION';
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  retry_count: number;
  error_message?: string;
  processed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export const OutboxEventSchema = new Schema<IOutboxEvent>(
  {
    aggregate_type: {
      type: String,
      enum: ['DATASET', 'DATASET_VERSION', 'TRANSFORMATION'],
      required: true,
      index: true,
    },
    aggregate_id: {
      type: String,
      required: true,
      index: true,
    },
    event_type: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    retry_count: {
      type: Number,
      default: 0,
    },
    error_message: {
      type: String,
      default: null,
    },
    processed_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

OutboxEventSchema.index({ status: 1, retry_count: 1, created_at: 1 });
