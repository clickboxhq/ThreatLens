import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { InvitePreviewController } from './invite-preview.controller';
import { AnnouncementsController } from './announcements.controller';
import { OrganizationsService } from './organizations.service';
import { EmailService } from '../../common/email/email.service';

@Module({
  controllers: [
    OrganizationsController,
    InvitePreviewController,
    AnnouncementsController,
  ],
  providers: [OrganizationsService, EmailService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
