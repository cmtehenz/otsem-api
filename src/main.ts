import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      const allowed: string[] = [
        'https://otsem-web.vercel.app',
        'https://app.otsempay.com',
        'https://app.otsempay.com.br',
        'http://localhost:3000',
        'http://localhost:3001',
      ];
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(new Error('CORS blocked'), false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization'],
    credentials: false,
    maxAge: 3600,
  });

  // Habilitar validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configuração Swagger
  const config = new DocumentBuilder()
    .setTitle('OTSEM Bank API')
    .setDescription('API REST completa para Banking as a Service integrada com BRX Bank')
    .setVersion('1.0')
    .addTag('Auth', 'Autenticação e gestão de sessões')
    .addTag('Users', 'Gestão de usuários')
    .addTag('Customers', 'Gestão de clientes (PF/PJ)')
    .addTag('Accreditation', 'Credenciamento BRX')
    .addTag('Pix', 'Chaves e transações Pix')
    .addTag('Statements', 'Saldo e extrato')
    .addTag('Webhooks', 'Webhooks BRX')
    .addTag('Admin', 'Endpoints administrativos')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer('http://localhost:3333', 'Desenvolvimento')
    .addServer('https://api.otsembank.com', 'Produção')
    .setContact(
      'OTSEM Bank',
      'https://otsembank.com',
      'suporte@otsembank.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'OTSEM Bank API - Documentação',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 50px 0 }
      .swagger-ui .info .title { font-size: 36px }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = process.env.PORT || 3333;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
}
bootstrap();
