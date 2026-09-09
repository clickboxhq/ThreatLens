import { Global, Module } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';

// @Global: the maintenance-mode middleware (registered in AppModule) and the admin settings
// controller both need it, and they live in different parts of the tree — same reason
// AuditLogModule is global.
@Global()
@Module({
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
