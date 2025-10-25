import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('OTSEM API')
    .setDescription('API do OTSEM (PIX, auth, etc.)')
    .setVersion('0.1.0')
    .addBearerAuth() // se quiser autenticação depois
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/docs', app, document);

  await app.listen(process.env.PORT || 3333);
  console.log(`http://localhost:${process.env.PORT || 3000}/docs`);
}
bootstrap();
