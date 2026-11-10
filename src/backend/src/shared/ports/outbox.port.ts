export const OUTBOX_PORT = Symbol('OutboxPort');

export interface OutboxEventInput {
  aggregate_type: 'DATASET' | 'DATASET_VERSION' | 'TRANSFORMATION';
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
}

export interface OutboxPort {
  recordEvent(data: OutboxEventInput): Promise<unknown>;
}
