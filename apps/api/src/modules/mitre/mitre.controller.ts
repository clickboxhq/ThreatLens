import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Global reference catalog (§6.8) — not session-scoped, so a Student can tag the technique
// they've concluded is correct even when it differs from what a linked alert auto-tagged
// (§12.3: the alert's mechanical tag is a hint, not the answer — see the BEC and malware
// scenarios, where the required technique deliberately isn't what the alert itself shows).
@Controller('mitre-techniques')
@UseGuards(JwtAuthGuard)
export class MitreController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const techniques = await this.prisma.mitreTechnique.findMany({ orderBy: { techniqueId: 'asc' } });
    return techniques.map((t) => ({ id: t.id, techniqueId: t.techniqueId, name: t.name, tactic: t.tactic }));
  }
}
