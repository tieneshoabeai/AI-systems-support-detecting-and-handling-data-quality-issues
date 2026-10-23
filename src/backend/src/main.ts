import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const port = config.get<number>('PORT', 3000);
  const apiPrefix = config.get<string>('API_PREFIX', 'api/v1');
  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:5173');

  // 1. Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    })
  );

  // 2. CORS (Hỗ trợ truy cập từ frontend local và các domain tunnel ngrok)
  app.enableCors({
    origin: corsOrigin === '*' || process.env.NODE_ENV === 'development' ? true : corsOrigin.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // 3. Global Prefix (/api/v1)
  app.setGlobalPrefix(apiPrefix);

  // 4. Validation Note: Các Controller sử dụng ZodValidationPipe trực tiếp theo schema Zod tương ứng
  // đảm bảo tính bất biến kiểu và loại bỏ hoàn toàn phụ thuộc vào class-validator / class-transformer.

  // 5. Global Exception Filter & Response Transform Interceptor
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor(), new LoggingInterceptor());

  // 6. Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
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
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: 'Data Quality API Docs',
  });

  await app.listen(port);
  logger.log(`Server is running at: http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger OpenAPI Documentation: http://localhost:${port}/${apiPrefix}/docs`);
}

bootstrap();
