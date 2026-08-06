import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SubmitSessionDto } from './dto/submit-session.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimiterService } from '../../common/rate-limiter/rate-limiter.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// §15.5/§7.7: session creation synchronously triggers telemetry generation (real CPU-bound
// compute, since the pre-generation pool is deferred — §7.7), and submission triggers the
// Scoring Engine job — the two real compute costs on this controller, so both get a stricter,
// per-user limit than the "generous, click-through-speed" default the doc describes for
// authenticated endpoints generally. Keyed by user_id per §5.2, not IP, since these are
// authenticated routes.
const SESSION_CREATE_RATE_LIMIT = 10;
const SESSION_CREATE_RATE_LIMIT_WINDOW_SECONDS = 600;
const SESSION_SUBMIT_RATE_LIMIT = 20;
const SESSION_SUBMIT_RATE_LIMIT_WINDOW_SECONDS = 600;

// §16.4
@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSessionDto) {
    await this.rateLimiter.enforce(
      `session-create:${user.id}`,
      SESSION_CREATE_RATE_LIMIT,
      SESSION_CREATE_RATE_LIMIT_WINDOW_SECONDS,
    );
    return this.sessionsService.createSession(user, dto.scenarioId, dto.cohortAssignmentId);
  }

  @Get()
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.listMine(user);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.getSession(id, user);
  }

  @Post(':id/submit')
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitSessionDto,
  ) {
    await this.rateLimiter.enforce(
      `session-submit:${user.id}`,
      SESSION_SUBMIT_RATE_LIMIT,
      SESSION_SUBMIT_RATE_LIMIT_WINDOW_SECONDS,
    );
    return this.sessionsService.submitSession(id, user, dto.incidentIds);
  }

  @Get(':id/score')
  async getScore(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.getScore(id, user);
  }
}
