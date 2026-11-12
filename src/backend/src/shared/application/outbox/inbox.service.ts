import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { IProcessedEvent } from './processed-event.schema';

@Injectable()
export class InboxService {
  constructor(@InjectModel('ProcessedEvent') private readonly model: Model<IProcessedEvent>) {}

  /** claim tra ve 'claimed' | 'busy' | 'already'. Stale reclaim sau 30s. */
  async claim(consumer: string, eventId: string, leaseMs = 30000): Promise<'claimed' | 'busy' | 'already'> {
    const now = new Date();
    const leaseId = randomUUID();
    try {
      await this.model.create({
        consumer_name: consumer,
        event_id: eventId,
        status: 'processing',
        lease_id: leaseId,
        lease_expires_at: new Date(now.getTime() + leaseMs),
        attempts: 1,
      });
      return 'claimed';
    } catch (e: unknown) {
      const code = (e as Record<string, unknown>)?.code;
      if (code !== 11000) throw e;
    }
    const doc = await this.model.findOne({ consumer_name: consumer, event_id: eventId }).exec();
    if (!doc) return 'busy';
    if (doc.status === 'completed') return 'already';
    const exp = doc.lease_expires_at ? new Date(doc.lease_expires_at).getTime() : 0;
    if (doc.status === 'processing' && exp > Date.now()) return 'busy';
    await this.model.updateOne(
      { _id: doc._id },
      { $set: { status: 'processing', lease_id: leaseId, lease_expires_at: new Date(now.getTime() + leaseMs) }, $inc: { attempts: 1 } },
    );
    return 'claimed';
  }

  async complete(consumer: string, eventId: string): Promise<void> {
    await this.model.updateOne({ consumer_name: consumer, event_id: eventId }, { $set: { status: 'completed', lease_id: null, lease_expires_at: null } });
  }

  async fail(consumer: string, eventId: string): Promise<void> {
    await this.model.updateOne({ consumer_name: consumer, event_id: eventId }, { $set: { status: 'failed', lease_id: null, lease_expires_at: null } });
  }
}
