import { Schema, Document, Types } from 'mongoose';

export interface IProcessedEvent extends Document {
  _id: Types.ObjectId;
  consumer_name: string;
  event_id: string;
  status: 'processing' | 'completed' | 'failed';
  lease_id: string | null;
  lease_expires_at: Date | null;
  attempts: number;
  created_at: Date;
  updated_at: Date;
}

export const ProcessedEventSchema = new Schema<IProcessedEvent>(
  {
    consumer_name: { type: String, required: true },
    event_id: { type: String, required: true },
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
    lease_id: { type: String, default: null },
    lease_expires_at: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

ProcessedEventSchema.index({ consumer_name: 1, event_id: 1 }, { unique: true });
ProcessedEventSchema.index({ status: 1, lease_expires_at: 1 });
