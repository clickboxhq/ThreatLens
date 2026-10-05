import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { LearningService } from './learning.service';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// §16.15
@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(
    private readonly learningService: LearningService,
    private readonly certificatesService: CertificatesService,
  ) {}

  @Get('courses')
  async listCourses() {
    return this.learningService.listCourses();
  }

  @Get('paths/:id')
  async getPath(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.learningService.getPath(id, user);
  }

  @Get('certificates/mine')
  async myCertificates(@CurrentUser() user: AuthenticatedUser) {
    return this.certificatesService.myCertificates(user);
  }

  @Get('career-track-progress')
  async careerTrackProgress(@CurrentUser() user: AuthenticatedUser) {
    return this.certificatesService.careerTrackProgress(user);
  }

  // Placed last so the static routes above win — this only catches ids.
  @Get('certificates/:publicId')
  async myCertificate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('publicId') publicId: string,
  ) {
    return this.certificatesService.getMine(user, publicId);
  }
}
