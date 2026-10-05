import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { InvitePreviewController } from './invite-preview.controller';
import { AnnouncementsController } from './announcements.controller';
import { OrganizationScenariosController } from './organization-scenarios.controller';
import { AssignedScenariosController } from './assigned-scenarios.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationScenariosService } from './organization-scenarios.service';
import { EmailService } from '../../common/email/email.service';

@Module({
  controllers: [
    OrganizationsController,
    InvitePreviewController,
    AnnouncementsController,
    OrganizationScenariosController,
    AssignedScenariosController,
  ],
  providers: [OrganizationsService, OrganizationScenariosService, EmailService],
  exports: [OrganizationsService, OrganizationScenariosService],
})
export class OrganizationsModule {}
