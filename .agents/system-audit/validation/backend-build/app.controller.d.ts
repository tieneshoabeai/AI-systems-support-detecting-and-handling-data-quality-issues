import { Connection } from 'mongoose';
import { StorageService } from './shared/storage/storage.service';
export declare class AppController {
    private readonly mongoConnection;
    private readonly storageService;
    constructor(mongoConnection: Connection, storageService: StorageService);
    getHealth(): Promise<{
        status: string;
        timestamp: string;
        services: {
            mongodb_atlas: {
                status: string;
                readyState: import("mongoose").ConnectionStates;
            };
            storage: {
                mode: string;
                bucket: string;
            };
        };
    }>;
    getReady(): Promise<{
        status: string;
        checks: {
            mongodb: {
                status: string;
                readyState: import("mongoose").ConnectionStates;
                latencyMs: number;
            };
            storage: {
                status: string;
                mode: string;
            };
        };
        uptimeSeconds: number;
        version: string;
        timestamp: string;
    }>;
}
