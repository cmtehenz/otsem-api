import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  interface CorsOriginCallback {
    (err: Error | null, allow?: boolean): void;
  }

  interface CustomCorsOptions {
    origin: (origin: string | undefined, cb: CorsOriginCallback) => void;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  }

  app.enableCors({
    origin: (origin: string | undefined, cb: CorsOriginCallback) => {
      const allowed: ReadonlyArray<string> = [
        'https://otsem-web.vercel.app',
        'http://localhost:3000',
      ];
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(new Error('CORS blocked'), false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization'],
    credentials: false, // mude para true se usar cookies
    maxAge: 3600,
  } as CustomCorsOptions);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.use(
    bodyParser.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('OTSEM API')
    .setDescription('API do OTSEM (PIX, auth, etc.)')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/docs', app, document);

  const port = process.env.PORT || 3333;
  await app.listen(port);

  // 🧭 Log geral
  console.group('\n🚀 OTSEM API Iniciada');
  console.log(`📡 Porta: ${port}`);
  console.log(`📚 Swagger: http://localhost:${port}/docs`);
  console.log('✅ Endpoints principais:');
  console.log(`   • GET    /pix/keys/account-holders/:accountHolderId`);
  console.log(`   • POST   /pix/keys/account-holders/:accountHolderId`);
  console.log(`   • DELETE /pix/keys/account-holders/:accountHolderId/key/:pixKey`);
  console.groupEnd();
}

bootstrap();
