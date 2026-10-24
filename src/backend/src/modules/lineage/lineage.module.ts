import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { OutboxModule } from '../../shared/application/outbox/outbox.module';
import { LineageService } from './lineage.service';
import { LineageController } from './lineage.controller';
import { OutboxProcessorWorker } from './services/outbox-processor.worker';

@Module({
  imports: [SharedModule, OutboxModule],
  controllers: [LineageController],
  providers: [LineageService, OutboxProcessorWorker],
  exports: [LineageService, OutboxProcessorWorker],
})
export class LineageModule {}
