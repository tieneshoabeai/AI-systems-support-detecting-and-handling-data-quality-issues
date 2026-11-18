"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.useRedisAdapterIfConfigured = useRedisAdapterIfConfigured;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const common_1 = require("@nestjs/common");
const logger = new common_1.Logger('RedisIoAdapter');
async function useRedisAdapterIfConfigured(app) {
    const rawUrl = (process.env.REDIS_URL ?? '').trim();
    if (!rawUrl) {
        logger.log('REDIS_URL trống — dùng realtime memory (single-instance)');
        return 'memory';
    }
    let url = rawUrl;
    const pwd = (process.env.REDIS_PASSWORD ?? '').trim();
    if (pwd && !url.match(/:\/\/[^/]*@/)) {
        url = url.replace('://', `://:${encodeURIComponent(pwd)}@`);
    }
    let pub = null;
    let sub = null;
    try {
        const { createAdapter } = await Promise.resolve().then(() => __importStar(require('@socket.io/redis-adapter')));
        const { default: Redis } = await Promise.resolve().then(() => __importStar(require('ioredis')));
        const opts = {
            maxRetriesPerRequest: null,
            lazyConnect: true,
            enableReadyCheck: true,
            retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
        };
        const pubClient = new Redis(url, opts);
        const subClient = new Redis(url, opts);
        pub = pubClient;
        sub = subClient;
        pubClient.on('error', () => undefined);
        subClient.on('error', () => undefined);
        await Promise.race([
            (async () => {
                await pubClient.connect();
                await subClient.connect();
                await pubClient.ping();
            })(),
            new Promise((_, reject) => {
                const t = setTimeout(() => reject(new Error('Redis connect timeout 5s')), 5000);
                t.unref?.();
            }),
        ]);
        app.useWebSocketAdapter(new (class extends platform_socket_io_1.IoAdapter {
            createIOServer(port, opts) {
                const s = super.createIOServer(port, { ...(opts ?? {}) });
                s.adapter(createAdapter(pubClient, subClient));
                return s;
            }
        })(app.getHttpServer()));
        logger.log('Realtime adapter: redis (Socket.IO Redis adapter)');
        return 'redis';
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`Redis realtime không khả dụng (${msg}) — fallback về memory (single-instance). Kiểm tra REDIS_URL/REDIS_PASSWORD.`);
        try {
            pub?.disconnect();
        }
        catch { }
        try {
            sub?.disconnect();
        }
        catch { }
        return 'memory';
    }
}
//# sourceMappingURL=redis-io.adapter.js.map