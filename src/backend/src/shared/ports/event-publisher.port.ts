export const EVENT_PUBLISHER_PORT = Symbol('EventPublisherPort');

export interface DomainEventEnvelope {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  workspaceId?: string | null;
  projectId?: string | null;
  actorId?: string | null;
  occurredAt: string;
}

export interface EventPublisherPort {
  readonly mode: 'kafka' | 'in-process';
  publish(envelope: DomainEventEnvelope): Promise<void>;
}
