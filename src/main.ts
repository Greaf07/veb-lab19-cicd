import 'dotenv/config';
import { getPort } from './config/port';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.enableShutdownHooks();
  const port = getPort(process.env.PORT);
  await app.listen(port, process.env.HOST || '0.0.0.0');
  console.log(`Сервер запущен: http://localhost:${port}`);
}

void bootstrap();
