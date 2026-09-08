import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAnalyticsService],
})
export class AdminModule {}
