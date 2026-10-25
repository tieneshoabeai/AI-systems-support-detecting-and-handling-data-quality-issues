import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CleanRuleSchema } from './schemas/clean-rule.schema';
import { DatasetRecordSchema } from '../datasets/schemas/dataset-record.schema';
import { CleanRulesRepository } from './clean-rules.repository';
import { RuleExecutorService } from './services/rule-executor.service';
import { CleanRulesService } from './clean-rules.service';
import { CleanRulesController } from './clean-rules.controller';
import { DatasetsModule } from '../datasets/datasets.module';
import { VersionsModule } from '../versions/versions.module';
import { OutboxModule } from '../../shared/application/outbox/outbox.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CleanRule', schema: CleanRuleSchema },
      { name: 'DatasetRecord', schema: DatasetRecordSchema },
    ]),
    DatasetsModule,
    VersionsModule,
    OutboxModule,
  ],
  controllers: [CleanRulesController],
  providers: [CleanRulesRepository, RuleExecutorService, CleanRulesService],
  exports: [CleanRulesRepository, RuleExecutorService, CleanRulesService],
})
export class CleanRulesModule {}
