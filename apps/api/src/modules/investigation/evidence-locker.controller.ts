import { Controller, Get, UseGuards } from '@nestjs/common';
import { EvidenceNotesService } from './evidence-notes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// §2.10's Evidence Locker — a Student's own pinned evidence across every incident they've
// ever worked, not just one. Separate from EvidenceNotesController's per-incident routes since
// this is a cross-session aggregate, not a sub-resource of one incident.
@Controller('evidence')
@UseGuards(JwtAuthGuard)
export class EvidenceLockerController {
  constructor(private readonly evidenceNotesService: EvidenceNotesService) {}

  @Get('mine')
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.evidenceNotesService.listMine(user);
  }
}
