import { Model, ClientSession } from 'mongoose';
import { IOutboxEvent } from './outbox-event.schema';
import type { OutboxPort } from '../../ports/outbox.port';
import type { OutboxEventInput } from '../../ports/outbox.port';
export declare class OutboxService implements OutboxPort {
    private readonly outboxModel;
    private readonly logger;
    constructor(outboxModel: Model<IOutboxEvent>);
    recordEvent(data: OutboxEventInput, session?: ClientSession): Promise<IOutboxEvent>;
    getPendingEvents(limit?: number): Promise<IOutboxEvent[]>;
    claimForPublish(limit?: number): Promise<IOutboxEvent[]>;
    markAsPublished(eventId: string): Promise<void>;
    markAsProcessed(eventId: string): Promise<void>;
    markAsFailed(eventId: string, errorMessage: string): Promise<void>;
    reclaimStuckPublishing(): Promise<number>;
}
