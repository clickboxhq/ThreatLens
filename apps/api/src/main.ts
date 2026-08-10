import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { attachRealtimeGateway } from './common/realtime/realtime.gateway';
import { SessionAccessService } from './modules/session-core/session-access.service';
import { ScrubbingLogger } from './common/logging/scrubbing-logger.service';

async function bootstrap() {
  // §5.2/§15.6: redacts secret-shaped fields from every log line, from the very first
  // bootstrap log onward — passed as a NestFactory option (not app.useLogger() after the
  // fact) specifically so nothing logged during startup bypasses it.
  const app = await NestFactory.create(AppModule, {
    logger: new ScrubbingLogger(),
  });

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
