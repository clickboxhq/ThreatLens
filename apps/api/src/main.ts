import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { attachRealtimeGateway } from './common/realtime/realtime.gateway';
import { SessionAccessService } from './modules/session-core/session-access.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'ready'],
  });

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // §5.10: attached to the same HTTP server as REST, at /ws (outside the api/v1 prefix).
  attachRealtimeGateway(app.getHttpServer(), {
    jwtService: app.get(JwtService),
    sessionAccess: app.get(SessionAccessService),
    config: app.get(ConfigService),
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
