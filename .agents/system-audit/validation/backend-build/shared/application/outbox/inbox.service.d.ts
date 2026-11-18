import { Model } from 'mongoose';
import { IProcessedEvent } from './processed-event.schema';
export declare class InboxService {
    private readonly model;
    constructor(model: Model<IProcessedEvent>);
    claim(consumer: string, eventId: string, leaseMs?: number): Promise<'claimed' | 'busy' | 'already'>;
    complete(consumer: string, eventId: string): Promise<void>;
    fail(consumer: string, eventId: string): Promise<void>;
}
