import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrganizationScenariosService } from './organization-scenarios.service';
import {
  AddOrganizationScenariosDto,
  UpdateOrganizationScenarioDueDateDto,
} from './dto/organization-scenarios.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

@Controller('organizations/mine/scenarios')
@UseGuards(JwtAuthGuard)
export class OrganizationScenariosController {
  constructor(
    private readonly organizationScenariosService: OrganizationScenariosService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationScenariosService.listOrgScenarios(user);
  }

  @Post()
  async add(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddOrganizationScenariosDto,
  ) {
    return this.organizationScenariosService.addScenarios(
      user,
      dto.scenarioIds,
    );
  }

  @Patch(':id')
  async updateDueDate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationScenarioDueDateDto,
  ) {
    return this.organizationScenariosService.updateDueDate(user, id, dto.dueAt);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.organizationScenariosService.removeScenario(user, id);
    return { removed: true };
  }
}
