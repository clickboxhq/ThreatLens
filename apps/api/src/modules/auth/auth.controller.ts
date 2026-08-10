import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RateLimiterService } from '../../common/rate-limiter/rate-limiter.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { MfaEnableDto } from './dto/mfa-enable.dto';
import { MfaDisableDto } from './dto/mfa-disable.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { EmailVerificationConfirmDto } from './dto/email-verification-confirm.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// §15.5: 10 requests/minute per IP on every unauthenticated, abuse-prone auth endpoint.
const AUTH_RATE_LIMIT = 10;
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;

// §5.2: every request carries a correlation ID (CorrelationIdMiddleware); audit_logs rows
// tie back to it (§6.22) so a security-relevant DB row can be traced to the request/log line
// that produced it.
function correlationIdOf(req: Request): string | undefined {
  return (req as Request & { correlationId?: string }).correlationId;
}

// Matches docs/SOCVerse-Architecture.md §16.2.
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  @Post('signup')
  async signup(@Body() dto: SignupDto, @Req() req: Request) {
    await this.rateLimiter.enforce(
      `signup:${req.ip}`,
      AUTH_RATE_LIMIT,
      AUTH_RATE_LIMIT_WINDOW_SECONDS,
    );
    return this.authService.signup(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    await this.rateLimiter.enforce(
      `login:${req.ip}`,
      AUTH_RATE_LIMIT,
      AUTH_RATE_LIMIT_WINDOW_SECONDS,
    );
    return this.authService.login(
      dto,
      req.ip ?? 'unknown',
      correlationIdOf(req),
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.authService.logoutAll(user.id, req.ip, correlationIdOf(req));
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async mfaVerify(@Body() dto: MfaVerifyDto, @Req() req: Request) {
    return this.authService.mfaVerify(
      dto.mfaChallengeId,
      dto.code,
      req.ip,
      correlationIdOf(req),
    );
  }

  @Get('mfa/status')
  @UseGuards(JwtAuthGuard)
  async mfaStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.mfaStatus(user.id);
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  async mfaSetup(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.mfaSetup(user.id);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  async mfaEnable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaEnableDto,
    @Req() req: Request,
  ) {
    return this.authService.mfaEnable(
      user.id,
      dto.code,
      req.ip,
      correlationIdOf(req),
    );
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async mfaDisable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaDisableDto,
    @Req() req: Request,
  ) {
    await this.authService.mfaDisable(
      user.id,
      dto.password,
      req.ip,
      correlationIdOf(req),
    );
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.NO_CONTENT)
  async requestPasswordReset(
    @Body() dto: PasswordResetRequestDto,
    @Req() req: Request,
  ) {
    await this.rateLimiter.enforce(
      `password-reset:${req.ip}`,
      AUTH_RATE_LIMIT,
      AUTH_RATE_LIMIT_WINDOW_SECONDS,
    );
    await this.authService.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmPasswordReset(
    @Body() dto: PasswordResetConfirmDto,
    @Req() req: Request,
  ) {
    await this.authService.confirmPasswordReset(
      dto.token,
      dto.newPassword,
      req.ip,
      correlationIdOf(req),
    );
  }

  @Post('email-verification/request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async requestEmailVerification(@CurrentUser() user: AuthenticatedUser) {
    // Keyed by user_id, not IP: this is an authenticated endpoint (§5.2's keying rule), unlike
    // the enumeration-prone unauthenticated request endpoints above.
    await this.rateLimiter.enforce(
      `email-verification-request:${user.id}`,
      AUTH_RATE_LIMIT,
      AUTH_RATE_LIMIT_WINDOW_SECONDS,
    );
    await this.authService.requestEmailVerification(user.id);
  }

  @Post('email-verification/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmEmailVerification(
    @Body() dto: EmailVerificationConfirmDto,
    @Req() req: Request,
  ) {
    await this.authService.confirmEmailVerification(
      dto.token,
      req.ip,
      correlationIdOf(req),
    );
  }
}
