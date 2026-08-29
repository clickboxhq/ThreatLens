import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchDto } from './dto/search.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

@Controller('sessions/:sessionId/search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: SearchDto,
  ) {
    return this.searchService.search(
      sessionId,
      user,
      dto.filters ?? [],
      dto.freetext,
    );
  }
}

// §2.8's "Global Search" — the same field=value/freetext query as SearchController, across
// every session the Student has ever run instead of just the one it's nested under.
@Controller('search')
@UseGuards(JwtAuthGuard)
export class GlobalSearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('mine')
  async searchMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SearchDto,
  ) {
    return this.searchService.searchMine(user, dto.filters ?? [], dto.freetext);
  }
}
