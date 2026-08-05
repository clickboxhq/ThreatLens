import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RateLimiterService } from './rate-limiter.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { MfaEnableDto } from './dto/mfa-enable.dto';
import { MfaDisableDto } from './dto/mfa-disable.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// §15.5: 10 requests/minute per IP on every unauthenticated, abuse-prone auth endpoint.
const AUTH_RATE_LIMIT = 10;
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;

// Matches docs/SOCVerse-Architecture.md §16.2.
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  @Post('signup')
  async signup(@Body() dto: SignupDto, @Req() req: Request) {
    await this.rateLimiter.enforce(`signup:${req.ip}`, AUTH_RATE_LIMIT, AUTH_RATE_LIMIT_WINDOW_SECONDS);
    return this.authService.signup(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    await this.rateLimiter.enforce(`login:${req.ip}`, AUTH_RATE_LIMIT, AUTH_RATE_LIMIT_WINDOW_SECONDS);
    return this.authService.login(dto, req.ip ?? 'unknown');
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
  async logoutAll(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.logoutAll(user.id);
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async mfaVerify(@Body() dto: MfaVerifyDto) {
    return this.authService.mfaVerify(dto.mfaChallengeId, dto.code);
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
  async mfaEnable(@CurrentUser() user: AuthenticatedUser, @Body() dto: MfaEnableDto) {
    return this.authService.mfaEnable(user.id, dto.code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async mfaDisable(@CurrentUser() user: AuthenticatedUser, @Body() dto: MfaDisableDto) {
    await this.authService.mfaDisable(user.id, dto.password);
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.NO_CONTENT)
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto, @Req() req: Request) {
    await this.rateLimiter.enforce(`password-reset:${req.ip}`, AUTH_RATE_LIMIT, AUTH_RATE_LIMIT_WINDOW_SECONDS);
    await this.authService.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    await this.authService.confirmPasswordReset(dto.token, dto.newPassword);
  }
}
