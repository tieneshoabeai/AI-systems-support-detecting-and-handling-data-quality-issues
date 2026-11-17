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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const app_module_1 = require("./app.module");
const all_exceptions_filter_1 = require("./shared/filters/all-exceptions.filter");
const redis_io_adapter_1 = require("./shared/adapters/redis-io.adapter");
const transform_interceptor_1 = require("./shared/interceptors/transform.interceptor");
const logging_interceptor_1 = require("./shared/interceptors/logging.interceptor");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const sslEnabled = process.env.SSL_ENABLED === 'true' || process.env.SSL_ENABLED === '1';
    let httpsOptions;
    if (sslEnabled) {
        const keyPath = path.resolve(process.cwd(), process.env.SSL_KEY_PATH || 'certs/privkey.pem');
        const certPath = path.resolve(process.cwd(), process.env.SSL_CERT_PATH || 'certs/fullchain.pem');
        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
            try {
                httpsOptions = {
                    key: fs.readFileSync(keyPath),
                    cert: fs.readFileSync(certPath),
                };
                logger.log(`✓ Đã nạp chứng chỉ SSL/TLS thành công từ ${keyPath} và ${certPath}`);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`✗ Lỗi đọc chứng chỉ SSL/TLS: ${message}`);
            }
        }
        else {
            logger.warn(`⚠ Không tìm thấy chứng chỉ tại ${keyPath} hoặc ${certPath}. Chạy lệnh 'pnpm run ssl:generate' để sinh.`);
        }
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule, httpsOptions ? { httpsOptions } : {});
    const realtimeAdapter = await (0, redis_io_adapter_1.useRedisAdapterIfConfigured)(app);
    if (realtimeAdapter === 'memory')
        app.useWebSocketAdapter(new platform_socket_io_1.IoAdapter(app));
    const config = app.get(config_1.ConfigService);
    const port = config.get('PORT', 3000);
    const sslPort = config.get('SSL_PORT', 443);
    const apiPrefix = config.get('API_PREFIX', 'api/v1');
    const corsOrigin = config.get('CORS_ORIGIN', 'http://localhost:5173');
    const cloudflareProxyTrust = config.get('CLOUDFLARE_PROXY_TRUST', true);
    const cloudflareTunnelUrl = config.get('CLOUDFLARE_TUNNEL_URL', '');
    if (cloudflareProxyTrust) {
        app.getHttpAdapter().getInstance().set('trust proxy', 1);
    }
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
    }));
    app.enableCors({
        origin: (requestOrigin, callback) => {
            if (!requestOrigin || corsOrigin === '*' || process.env.NODE_ENV === 'development') {
                return callback(null, true);
            }
            if (requestOrigin.endsWith('.trycloudflare.com')) {
                return callback(null, true);
            }
            const allowedOrigins = corsOrigin.split(',').map((o) => o.trim());
            if (allowedOrigins.includes(requestOrigin)) {
                return callback(null, true);
            }
            callback(new Error('Blocked by CORS'));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'CF-Connecting-IP', 'CF-Ray'],
    });
    app.setGlobalPrefix(apiPrefix, {
        exclude: [
            { path: 'health', method: common_1.RequestMethod.GET },
            { path: 'health/ready', method: common_1.RequestMethod.GET },
        ],
    });
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    app.useGlobalInterceptors(new transform_interceptor_1.TransformInterceptor(), new logging_interceptor_1.LoggingInterceptor());
    const swaggerBuilder = new swagger_1.DocumentBuilder()
        .setTitle('AI-Driven Data Quality Management Platform API')
        .setDescription('Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ. ' +
        'Cung cấp RESTful endpoints cho Ingestion, Virtual Grid, Data Quality, Notifications, Issues và AI Detection.')
        .setVersion('1.0.0')
        .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Nhập access token nhận được khi đăng nhập (Bearer <token>)',
        in: 'header',
    }, 'bearer');
    const localListenPort = httpsOptions ? sslPort : port;
    const protocol = httpsOptions ? 'https' : 'http';
    swaggerBuilder.addServer('/', 'Current origin (tu dong dung khi qua tunnel)');
    swaggerBuilder.addServer(`${protocol}://localhost:${localListenPort}`, 'Local Development Server');
    if (cloudflareTunnelUrl) {
        swaggerBuilder.addServer(cloudflareTunnelUrl, 'Cloudflare Zero Trust Tunnel (HTTPS Port 443)');
    }
    const swaggerConfig = swaggerBuilder.build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
        swaggerOptions: {
            persistAuthorization: true,
        },
        customSiteTitle: 'Data Quality API Docs',
    });
    let actualPort = localListenPort;
    try {
        await app.listen(actualPort);
    }
    catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('EACCES') && actualPort === 443) {
            logger.warn('⚠ Không đủ quyền root để mở Cổng đặc quyền 443 trên Linux. Tự động chuyển sang cổng dự phòng 8443...');
            actualPort = 8443;
            await app.listen(actualPort);
        }
        else {
            throw err;
        }
    }
    logger.log(`✓ Realtime adapter: ${realtimeAdapter === 'redis' ? 'redis (Socket.IO Redis adapter)' : 'memory (single-instance)'}`);
    logger.log(`✓ Server is running at: ${protocol}://localhost:${actualPort}/${apiPrefix}`);
    logger.log(`✓ Swagger OpenAPI Docs: ${protocol}://localhost:${actualPort}/${apiPrefix}/docs`);
    logger.log(`✓ Cloudflare Proxy Trust: ${cloudflareProxyTrust ? 'ENABLED' : 'DISABLED'}`);
    logger.log(`✓ Để mở Cổng 443 ra Internet qua Cloudflare Tunnel: chạy lệnh 'pnpm run tunnel:start'`);
}
bootstrap().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Application bootstrap failed: ${message}\n`);
    process.exitCode = 1;
});
//# sourceMappingURL=main.js.map