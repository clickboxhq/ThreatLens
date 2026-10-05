import { Controller, Get, UseGuards } from '@nestjs/common';
import { StreaksService } from './streaks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

@Controller('streak')
@UseGuards(JwtAuthGuard)
export class StreaksController {
  constructor(private readonly streaksService: StreaksService) {}

  @Get('mine')
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.streaksService.getMine(user.id);
  }
}
