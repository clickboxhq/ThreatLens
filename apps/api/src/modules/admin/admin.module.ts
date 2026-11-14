import { Module } from '@nestjs/common';
import { EmailService } from '../../common/email/email.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';
import { AdminOrganizationsController } from './organizations/admin-organizations.controller';
import { AdminOrganizationsService } from './organizations/admin-organizations.service';
import { AdminCertificatesController } from './certificates/admin-certificates.controller';
import { AdminCertificatesService } from './certificates/admin-certificates.service';
import { AdminAdministratorsController } from './administrators/admin-administrators.controller';
import { AdminAdministratorsService } from './administrators/admin-administrators.service';
import { AdminSecurityController } from './security/admin-security.controller';
import { AdminSecurityService } from './security/admin-security.service';
import { AdminSettingsController } from './settings/admin-settings.controller';
import { AdminSettingsService } from './settings/admin-settings.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [
    AdminController,
    AdminUsersController,
    AdminOrganizationsController,
    AdminCertificatesController,
    AdminAdministratorsController,
    AdminSecurityController,
    AdminSettingsController,
  ],
  providers: [
    // Provided here rather than inherited: EmailService is per-module in this codebase
    // (see the note in billing.module.ts). AdminUsersService needs it to tell someone their
    // two-factor authentication has been removed.
    EmailService,
    AdminService,
    AdminAnalyticsService,
    AdminUsersService,
    AdminOrganizationsService,
    AdminCertificatesService,
    AdminAdministratorsService,
    AdminSecurityService,
    AdminSettingsService,
  ],
})
export class AdminModule {}
