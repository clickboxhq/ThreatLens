import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { HintsService } from './hints.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// §12.5
@Controller('sessions/:sessionId/hints')
@UseGuards(JwtAuthGuard)
export class HintsController {
  constructor(private readonly hintsService: HintsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.hintsService.list(sessionId, user);
  }

  @Post(':index/unlock')
  async unlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.hintsService.unlock(sessionId, index, user);
  }
}
