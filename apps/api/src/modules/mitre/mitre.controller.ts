import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { TACTIC_NAMES } from '../sessions/skill-radar';

// Reused rather than redeclared here, and resolved server-side rather than shipping the raw
// `TA0006` to every client that wants to print it: one canonical tactic vocabulary, already
// the one the skill radar and profile performance read from.
//
// Declaration order in TACTIC_NAMES is kill-chain order, which Object.keys preserves for
// string keys — so this doubles as the order the catalogue should be presented in.
const TACTIC_ORDER = Object.keys(TACTIC_NAMES);
const tacticRank = (tactic: string) => {
  const i = TACTIC_ORDER.indexOf(tactic);
  // An unrecognised tactic sorts last rather than first, so a bad seed row can't quietly
  // take over the top of the list.
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

// Global reference catalog (§6.8) — not session-scoped, so a Student can tag the technique
// they've concluded is correct even when it differs from what a linked alert auto-tagged
// (§12.3: the alert's mechanical tag is a hint, not the answer — see the BEC and malware
// scenarios, where the required technique deliberately isn't what the alert itself shows).
@Controller('mitre-techniques')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
export class MitreController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const techniques = await this.prisma.mitreTechnique.findMany({
      orderBy: { techniqueId: 'asc' },
    });
    return (
      techniques
        .map((t) => ({
          id: t.id,
          techniqueId: t.techniqueId,
          name: t.name,
          tactic: t.tactic,
          // Falls back to the raw ID rather than an empty string: a tactic missing from the
          // map should still render as *something* identifiable, not a blank heading.
          tacticName: TACTIC_NAMES[t.tactic] ?? t.tactic,
        }))
        // Kill-chain order, so the catalogue reads the way an attack unfolds instead of
        // alphabetically by number. Array.prototype.sort is stable, so the techniqueId
        // ordering from the query survives inside each tactic.
        .sort((a, b) => tacticRank(a.tactic) - tacticRank(b.tactic))
    );
  }
}
