import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganizationsService } from './organizations.service';
import {
  CreateAnnouncementDto,
  CreateInviteDto,
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organizations.dto';
import { AppException } from '../../common/exceptions/app-exception';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// Same limits and formats as the user-avatar upload (auth.controller.ts).
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Phase 6 (merge plan): real org multi-tenancy. `getOwnedOrgId` inside the service enforces
// org_admin fine-grained access the same two-layer way instructor.controller.ts does — coarse
// role gating would work too, but org_admin already exists as a real, distinct role (see
// schema.prisma's UserRole), so no new guard decorator is needed here.
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.create(user, dto);
  }

  @Get('mine')
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.getMine(user);
  }

  @Patch('mine')
  async rename(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.rename(user, dto);
  }

  @Post('mine/logo')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: LOGO_MAX_BYTES } }),
  )
  async setLogo(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new AppException(400, 'VALIDATION_ERROR', 'No file uploaded.');
    }
    if (!LOGO_ALLOWED_MIME.has(file.mimetype)) {
      throw new AppException(
        400,
        'VALIDATION_ERROR',
        'Logo must be a JPEG, PNG, or WEBP image.',
      );
    }
    if (file.size > LOGO_MAX_BYTES) {
      throw new AppException(
        400,
        'VALIDATION_ERROR',
        'Logo must be 2MB or smaller.',
      );
    }
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return this.organizationsService.setLogo(user, dataUrl);
  }

  @Delete('mine/logo')
  async removeLogo(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.removeLogo(user);
  }

  @Get('mine/members')
  async listMembers(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.listMembers(user);
  }

  @Get('mine/invites')
  async listInvites(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.listInvites(user);
  }

  @Post('mine/invites')
  async createInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInviteDto,
  ) {
    return this.organizationsService.createInvite(user, dto);
  }

  @Post('invites/:token/accept')
  async acceptInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
  ) {
    return this.organizationsService.acceptInvite(user, token);
  }

  @Get('mine/announcements')
  async listSentAnnouncements(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.listSentAnnouncements(user);
  }

  @Post('mine/announcements')
  async createAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.organizationsService.createAnnouncement(user, dto);
  }
}
