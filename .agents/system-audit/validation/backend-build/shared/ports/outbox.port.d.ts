export declare const OUTBOX_PORT: unique symbol;
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
