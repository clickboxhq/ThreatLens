import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EvidenceNotesService } from './evidence-notes.service';
import { CreateNoteDto, PinEvidenceDto } from './dto/incident.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// §16.7
@Controller('sessions/:sessionId/incidents/:incidentId')
@UseGuards(JwtAuthGuard)
export class EvidenceNotesController {
  constructor(private readonly service: EvidenceNotesService) {}

  @Post('evidence')
  async pinEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Body() dto: PinEvidenceDto,
  ) {
    return this.service.pinEvidence(sessionId, incidentId, user, dto);
  }

  @Get('evidence')
  async listEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
  ) {
    return this.service.listEvidence(sessionId, incidentId, user);
  }

  @Delete('evidence/:evidenceId')
  async removeEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    await this.service.removeEvidence(sessionId, incidentId, evidenceId, user);
    return { removed: true };
  }

  @Post('notes')
  async createNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.service.createNote(sessionId, incidentId, user, dto);
  }

  @Get('notes')
  async listNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
  ) {
    return this.service.listNotes(sessionId, incidentId, user);
  }

  // §2.15/§6.20: a Student sees both their automated score and any instructor feedback,
  // distinctly attributed — this is the Student-facing read side of that requirement.
  @Get('feedback')
  async listFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
  ) {
    return this.service.listInstructorFeedback(sessionId, incidentId, user);
  }
}
