"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));
    app.enableCors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3001',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });
    app.setGlobalPrefix('api');
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Banny-Banny API')
        .setDescription('Banny-Banny 타임캡슐 서비스 API 문서')
        .setVersion('1.0')
        .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'JWT 토큰을 입력하세요',
        in: 'header',
    }, 'access-token')
        .addTag('Auth', '인증 관련 API')
        .addTag('Health', '서버 상태 확인')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
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
//# sourceMappingURL=main.js.map