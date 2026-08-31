import { Controller, Get, UseGuards } from '@nestjs/common';
import { CareerProgressionService } from './career-progression.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

@Controller('career-progression')
@UseGuards(JwtAuthGuard)
export class CareerProgressionController {
  constructor(private readonly service: CareerProgressionService) {}

  @Get('mine')
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getStatus(user);
  }
}
