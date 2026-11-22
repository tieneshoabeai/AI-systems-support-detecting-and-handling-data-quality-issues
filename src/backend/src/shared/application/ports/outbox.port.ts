export const OUTBOX_PORT = Symbol('OutboxPort');

export interface OutboxEventInput {
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  workspace_id?: string | null;
  project_id?: string | null;
  actor_id?: string | null;
}

export interface OutboxPort {
  recordEvent(data: OutboxEventInput): Promise<unknown>;
}
