import type { INestApplication } from '@nestjs/common';
export declare function useRedisAdapterIfConfigured(app: INestApplication): Promise<'redis' | 'memory'>;
