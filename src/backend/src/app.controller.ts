import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Neo4jService } from './shared/database/neo4j.service';
import { StorageService } from './shared/storage/storage.service';
import { Public } from './shared/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    private readonly neo4jService: Neo4jService,
    private readonly storageService: StorageService
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Kiểm tra trạng thái hoạt động của hệ thống và các CSDL Cloud' })
  @ApiResponse({ status: 200, description: 'Trạng thái hoạt động chi tiết' })
  async getHealth() {
    const mongoStatus = this.mongoConnection.readyState === 1 ? 'connected' : 'disconnected';
    const neo4jConnected = await this.neo4jService.verifyConnectivity();
    const storageStatus = this.storageService.getCloudStatus();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        mongodb_atlas: {
          status: mongoStatus,
          readyState: this.mongoConnection.readyState,
        },
        neo4j_auradb: {
          status: neo4jConnected ? 'connected' : 'disconnected',
        },
        storage: {
          mode: storageStatus.isCloudMode ? 'cloud_s3_r2' : 'local_fallback',
          bucket: storageStatus.bucketName,
        },
      },
    };
  }
}
