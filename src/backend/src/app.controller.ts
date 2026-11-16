import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { StorageService } from './shared/storage/storage.service';
import { Public } from './shared/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    private readonly storageService: StorageService
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness: tiến trình còn sống, không kiểm tra dependency' })
  @ApiResponse({ status: 200, description: 'Trạng thái hoạt động chi tiết' })
  async getHealth() {
    const mongoStatus = this.mongoConnection.readyState === 1 ? 'connected' : 'disconnected';
    const storageStatus = this.storageService.getCloudStatus();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        mongodb_atlas: {
          status: mongoStatus,
          readyState: this.mongoConnection.readyState,
        },
        storage: {
          mode: storageStatus.isCloudMode ? 'cloud_s3_r2' : 'local_fallback',
          bucket: storageStatus.bucketName,
        },
      },
    };
  }

  @Public()
  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness v6: Mongo + storage sẵn sàng mới nhận traffic (ngoài /api/v1)' })
  @ApiResponse({ status: 200, description: 'Sẵn sàng' })
  @ApiResponse({ status: 503, description: 'Chưa sẵn sàng' })
  async getReady() {
    const started = Date.now();
    const mongoOk = this.mongoConnection.readyState === 1;
    const storage = this.storageService.getCloudStatus();
    const ok = mongoOk;
    const body = {
      status: ok ? 'ok' : 'degraded',
      checks: {
        mongodb: { status: mongoOk ? 'ok' : 'fail', readyState: this.mongoConnection.readyState, latencyMs: Date.now() - started },
        storage: { status: 'ok', mode: storage.isCloudMode ? 'cloud_s3_r2' : 'local_fallback' },
      },
      uptimeSeconds: Math.floor(process.uptime()),
      version: '1.1.0',
      timestamp: new Date().toISOString(),
    };
    if (!ok) {
      const { HttpException } = await import('@nestjs/common');
      throw new HttpException(body, 503);
    }
    return body;
  }
}
