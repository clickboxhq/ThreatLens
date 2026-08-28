import { Controller, Get, Param } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';

// Deliberately unauthenticated, same pattern and reasoning as
// certificate-verification.controller.ts — the accept-invite page needs to show who's inviting
// whom (and whether the invite is still valid) before the visitor has necessarily logged in.
@Controller('organizations/invites')
export class InvitePreviewController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get(':token')
  async preview(@Param('token') token: string) {
    return this.organizationsService.previewInvite(token);
  }
}
