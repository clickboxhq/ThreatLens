import { Global, Module } from '@nestjs/common';
import { SessionAccessService } from './session-access.service';
import { InvestigationActionsService } from './investigation-actions.service';

// Shared by every module that operates on a session's sub-resources (sessions,
// investigation, identity/email portals) — kept global and dependency-free of those
// modules specifically to avoid a circular-import cycle between them.
@Global()
@Module({
  providers: [SessionAccessService, InvestigationActionsService],
  exports: [SessionAccessService, InvestigationActionsService],
})
export class SessionCoreModule {}
