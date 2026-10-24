import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OutboxService } from '../../../shared/application/outbox/outbox.service';
import { Neo4jService } from '../../../shared/database/neo4j.service';
import { LineageCypherQueries } from '../lineage-queries.cypher';

@Injectable()
export class OutboxProcessorWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessorWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly outboxService: OutboxService,
    private readonly neo4jService: Neo4jService
  ) {}

  onModuleInit(): void {
    // Chỉ kích hoạt Polling nếu Neo4j được cấu hình
    this.startWorker();
  }

  onModuleDestroy(): void {
    this.stopWorker();
  }

  startWorker(intervalMs = 3000): void {
    if (this.timer) return;
    this.logger.log(`Outbox Processor Worker started with interval ${intervalMs}ms`);
    this.timer = setInterval(() => {
      void this.processBatch();
    }, intervalMs);
  }

  stopWorker(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log('Outbox Processor Worker stopped');
    }
  }

  /**
   * Xử lý 1 batch sự kiện PENDING từ outbox_events sang Neo4j AuraDB
   */
  async processBatch(limit = 20): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const events = await this.outboxService.getPendingEvents(limit);
      if (events.length === 0) return 0;

      let processedCount = 0;

      for (const event of events) {
        const eventId = event._id.toString();
        try {
          await this.processSingleEvent(event.event_type, event.payload);
          await this.outboxService.markAsProcessed(eventId);
          processedCount++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Error syncing event ${eventId} to Neo4j: ${msg}`);
          await this.outboxService.markAsFailed(eventId, msg);
        }
      }

      return processedCount;
    } finally {
      this.isProcessing = false;
    }
  }

  private async processSingleEvent(
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const nowIso = new Date().toISOString();

    if (eventType === 'DATASET_INGESTED') {
      const datasetId = String(payload.dataset_id ?? '');
      const name = String(payload.name ?? 'Untitled Dataset');
      const projectId = String(payload.project_id ?? '');
      const workspaceId = String(payload.workspace_id ?? '');
      const createdAt = String(payload.created_at ?? nowIso);

      // 1. Sync Dataset Node
      await this.neo4jService.runQuery(LineageCypherQueries.SYNC_DATASET, {
        dataset_id: datasetId,
        name,
        project_id: projectId,
        workspace_id: workspaceId,
        created_at: createdAt,
        updated_at: createdAt,
      });

      // 2. Sync Initial Version (v1) nếu có
      if (payload.version_id) {
        await this.neo4jService.runQuery(LineageCypherQueries.SYNC_VERSION, {
          dataset_id: datasetId,
          version_id: String(payload.version_id),
          version_number: Number(payload.version_number ?? 1),
          version_hash: String(payload.version_hash ?? ''),
          data_checksum: String(payload.data_checksum ?? ''),
          rules_hash: String(payload.rules_hash ?? ''),
          created_at: createdAt,
          parent_version_id: null,
        });
      }
    } else if (eventType === 'VERSION_COMMITTED') {
      const datasetId = String(payload.dataset_id ?? '');
      const versionId = String(payload.version_id ?? '');
      const versionNumber = Number(payload.version_number ?? 1);
      const versionHash = String(payload.version_hash ?? '');
      const dataChecksum = String(payload.data_checksum ?? '');
      const rulesHash = String(payload.rules_hash ?? '');
      const parentVersionId = payload.parent_version_id ? String(payload.parent_version_id) : null;
      const createdAt = String(payload.created_at ?? nowIso);

      await this.neo4jService.runQuery(LineageCypherQueries.SYNC_VERSION, {
        dataset_id: datasetId,
        version_id: versionId,
        version_number: versionNumber,
        version_hash: versionHash,
        data_checksum: dataChecksum,
        rules_hash: rulesHash,
        created_at: createdAt,
        parent_version_id: parentVersionId,
      });
    } else if (eventType === 'RULES_APPLIED') {
      const versionId = String(payload.version_id ?? '');
      const appliedAt = String(payload.applied_at ?? nowIso);
      const rawRules = Array.isArray(payload.rules) ? payload.rules : [];

      const rules = rawRules.map((r, index) => {
        const item = typeof r === 'object' && r !== null ? (r as Record<string, unknown>) : {};
        return {
          id: String(item.id ?? `${versionId}_rule_${index}`),
          rule_type: String(item.rule_type ?? 'UNKNOWN'),
          description: String(item.description ?? ''),
          parameters: JSON.stringify(item.parameters ?? {}),
        };
      });

      if (rules.length > 0) {
        await this.neo4jService.runQuery(LineageCypherQueries.SYNC_TRANSFORMATION, {
          version_id: versionId,
          rules,
          applied_at: appliedAt,
        });
      }
    } else {
      this.logger.debug(`Unhandled event type in Lineage Outbox Processor: ${eventType}`);
    }
  }
}
