import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 전역 ValidationPipe 설정
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의되지 않은 속성 제거
      forbidNonWhitelisted: true, // 정의되지 않은 속성이 있으면 에러
      transform: true, // 요청 데이터를 DTO 클래스로 자동 변환
      transformOptions: {
        enableImplicitConversion: true, // 암시적 타입 변환 허용
      },
    }),
  );

  // CORS 설정
  const corsWhitelist = [
    'http://localhost:8081', // 웹 개발 환경
    'http://192.168.*.*:8081', // 로컬 네트워크
    'exp://192.168.*.*:8081', // Expo 개발 서버
    'null', // WebBrowser 등에서 들어오는 null origin
    '*', // 개발 환경에서 모든 origin 허용
  ];
  const allowAllOrigins = corsWhitelist.includes('*');
  const wildcardOrigins = corsWhitelist
    .filter((origin) => origin !== '*' && origin.includes('*'))
    .map((origin) => {
      const escaped = origin
        .split('*')
        .map((segment) => segment.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&'))
        .join('.*');
      return new RegExp(`^${escaped}$`);
    });

  const isOriginWhitelisted = (origin?: string): boolean => {
    if (!origin) {
      return true; // Postman이나 내부 서버 호출 허용
    }
    if (allowAllOrigins) {
      return true;
    }
    if (origin === 'null' || origin === null) {
      return corsWhitelist.includes('null');
    }
    if (origin && corsWhitelist.includes(origin)) {
      return true;
    }
    return wildcardOrigins.some((pattern) => pattern.test(origin));
  };

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (isOriginWhitelisted(origin)) {
        callback(null, true);
      } else {
        callback(
          new Error(`Origin ${origin ?? 'unknown'} is not allowed by CORS`),
          false,
        );
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // API 전역 접두사 설정
  app.setGlobalPrefix('api');

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('Banny-Banny API')
    .setDescription('Banny-Banny 타임캡슐 서비스 API 문서')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'JWT 토큰을 입력하세요',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Auth', '인증 관련 API')
    .addTag('Capsules', '이스터에그/캡슐 API')
    .addTag('Health', '서버 상태 확인')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // 새로고침해도 토큰 유지
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🐰 Banny-Banny Backend Server                   ║
║   🚀 Running on: http://localhost:${port}            ║
║   📚 Swagger: http://localhost:${port}/api/docs      ║
║   📦 Environment: ${process.env.NODE_ENV || 'development'}                  ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
}

void bootstrap();
