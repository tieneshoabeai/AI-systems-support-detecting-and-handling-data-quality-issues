import { NestFactory } from '@nestjs/core';
import { Logger, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // Kiểm tra cấu hình SSL/TLS cục bộ (nếu kích hoạt SSL_ENABLED=true)
  const sslEnabled = process.env.SSL_ENABLED === 'true' || process.env.SSL_ENABLED === '1';
  let httpsOptions: { key: Buffer; cert: Buffer } | undefined;

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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`✗ Lỗi đọc chứng chỉ SSL/TLS: ${message}`);
      }
    } else {
      logger.warn(`⚠ Không tìm thấy chứng chỉ tại ${keyPath} hoặc ${certPath}. Chạy lệnh 'pnpm run ssl:generate' để sinh.`);
    }
  }

  const app = await NestFactory.create(
    AppModule,
    httpsOptions ? { httpsOptions } : {}
  );
  const config = app.get(ConfigService);

  const port = config.get<number>('PORT', 3000);
  const sslPort = config.get<number>('SSL_PORT', 443);
  const apiPrefix = config.get<string>('API_PREFIX', 'api/v1');
  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:5173');
  const cloudflareProxyTrust = config.get<boolean>('CLOUDFLARE_PROXY_TRUST', true);
  const cloudflareTunnelUrl = config.get<string>('CLOUDFLARE_TUNNEL_URL', '');

  // 1. Trust Proxy cho Cloudflare (Nhận diện chính xác X-Forwarded-Proto: https và CF-Connecting-IP)
  if (cloudflareProxyTrust) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  // 2. Security Headers (Helmet với HSTS và Content Security Policy)
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // 3. CORS (Hỗ trợ truy cập từ frontend local, domain chỉ định, và domain *.trycloudflare.com)
  app.enableCors({
    origin: (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
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

  // 4. Global Prefix (/api/v1) - Loại trừ endpoint health check giống chuẩn sgod-rental-management
  app.setGlobalPrefix(apiPrefix, {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  // 5. Global Exception Filter & Response Transform Interceptor
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor(), new LoggingInterceptor());

  // 6. Swagger OpenAPI Documentation
  const swaggerBuilder = new DocumentBuilder()
    .setTitle('AI-Driven Data Quality Management Platform API')
    .setDescription(
      'Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ. ' +
        'Cung cấp 43 RESTful endpoints cho Ingestion, Virtual Grid, Neo4j Lineage, Cryptographic Audit Chaining và AI Detection.'
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Nhập access token nhận được khi đăng nhập (Bearer <token>)',
        in: 'header',
      },
      'bearer'
    );

  const localListenPort = httpsOptions ? sslPort : port;
  const protocol = httpsOptions ? 'https' : 'http';

  swaggerBuilder.addServer(`${protocol}://localhost:${localListenPort}`, 'Local Development Server');

  if (cloudflareTunnelUrl) {
    swaggerBuilder.addServer(cloudflareTunnelUrl, 'Cloudflare Zero Trust Tunnel (HTTPS Port 443)');
  }

  const swaggerConfig = swaggerBuilder.build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: 'Data Quality API Docs',
  });

  // 7. Khởi động Lắng nghe
  let actualPort = localListenPort;
  try {
    await app.listen(actualPort);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('EACCES') && actualPort === 443) {
      logger.warn('⚠ Không đủ quyền root để mở Cổng đặc quyền 443 trên Linux. Tự động chuyển sang cổng dự phòng 8443...');
      actualPort = 8443;
      await app.listen(actualPort);
    } else {
      throw err;
    }
  }

  logger.log(`✓ Server is running at: ${protocol}://localhost:${actualPort}/${apiPrefix}`);
  logger.log(`✓ Swagger OpenAPI Docs: ${protocol}://localhost:${actualPort}/${apiPrefix}/docs`);
  logger.log(`✓ Cloudflare Proxy Trust: ${cloudflareProxyTrust ? 'ENABLED' : 'DISABLED'}`);
  logger.log(`✓ Để mở Cổng 443 ra Internet qua Cloudflare Tunnel: chạy lệnh 'pnpm run tunnel:start'`);
}

bootstrap().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Application bootstrap failed: ${message}\n`);
  process.exitCode = 1;
});
