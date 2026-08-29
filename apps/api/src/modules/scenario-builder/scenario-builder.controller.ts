import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ScenarioBuilderService } from './scenario-builder.service';
import {
  CreateScenarioDto,
  ValidateScenarioDraftDto,
} from './dto/scenario-builder.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

@Controller('scenario-builder')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('instructor', 'platform_admin')
export class ScenarioBuilderController {
  constructor(
    private readonly scenarioBuilderService: ScenarioBuilderService,
  ) {}

  @Get('templates')
  listTemplates() {
    return this.scenarioBuilderService.listTemplates();
  }

  @Post('validate')
  async validate(@Body() dto: ValidateScenarioDraftDto) {
    const errors = await this.scenarioBuilderService.validate(
      dto.groundTruthDefinition,
    );
    return { valid: errors.length === 0, errors };
  }

  @Post('scenarios')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScenarioDto,
  ) {
    return this.scenarioBuilderService.create(user, dto);
  }
}
