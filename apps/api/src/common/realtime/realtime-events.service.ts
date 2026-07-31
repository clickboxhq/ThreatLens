import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface RealtimeMessage {
  type: 'alert.new' | 'alert.updated' | 'incident.status_changed';
  payload: unknown;
}

// §4.4/§5.10: the Alert Engine and other background workers publish here; every API
// Gateway replica's RealtimeGateway subscribes to the matching `session:{sessionId}`
// channel and forwards to any locally-connected socket for that session. This
// pub/sub indirection is what lets a worker emit an event without knowing which
// replica (if any) holds the Student's live connection.
@Injectable()
export class RealtimeEventsService implements OnModuleDestroy {
  private readonly publisher: Redis;

  constructor(config: ConfigService) {
    this.publisher = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
  }

  async publish(sessionId: string, message: RealtimeMessage): Promise<void> {
    await this.publisher.publish(`session:${sessionId}`, JSON.stringify(message));
  }

  async onModuleDestroy(): Promise<void> {
    await this.publisher.quit();
  }
}
