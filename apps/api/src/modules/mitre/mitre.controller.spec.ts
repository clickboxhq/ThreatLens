import { MitreController } from './mitre.controller';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * The technique catalogue is what a student picks their ATT&CK tags from at submit time, and
 * technique accuracy is 30% of the grade. The list is deliberately global rather than
 * scenario-scoped (see the controller's own note), so nothing here is an answer key — but it
 * does have to be *legible*, which is what these tests pin down: every row carries a
 * human-readable tactic, and the catalogue arrives in kill-chain order rather than sorted by
 * technique number, so the client can group it without knowing anything about ATT&CK.
 */

// Deliberately handed to the controller in technique-ID order, the way the query returns
// them, with tactics interleaved — so an assertion about ordering is actually testing the
// controller's sort and not just echoing the input.
const ROWS = [
  {
    id: 'u1',
    techniqueId: 'T1003.001',
    name: 'LSASS Memory',
    tactic: 'TA0006',
  },
  { id: 'u2', techniqueId: 'T1041', name: 'Exfil Over C2', tactic: 'TA0010' },
  { id: 'u3', techniqueId: 'T1078', name: 'Valid Accounts', tactic: 'TA0001' },
  { id: 'u4', techniqueId: 'T1110', name: 'Brute Force', tactic: 'TA0006' },
  {
    id: 'u5',
    techniqueId: 'T1566.001',
    name: 'Spearphishing',
    tactic: 'TA0001',
  },
];

function buildController(rows: typeof ROWS = ROWS) {
  const prisma = {
    mitreTechnique: { findMany: jest.fn().mockResolvedValue(rows) },
  } as unknown as PrismaService;
  return new MitreController(prisma);
}

describe('MitreController', () => {
  it('resolves a readable tactic name for every technique', async () => {
    const result = await buildController().list();

    expect(result).toHaveLength(ROWS.length);
    for (const t of result) {
      expect(t.tacticName).toBeTruthy();
      // The raw ID is kept alongside it, not replaced — clients that group or filter on the
      // stable identifier should not have to parse a display string to do it.
      expect(t.tactic).toMatch(/^TA\d{4}$/);
    }

    const lsass = result.find((t) => t.techniqueId === 'T1003.001');
    expect(lsass?.tacticName).toBe('Credential Access');
  });

  it('returns the catalogue in kill-chain order, not technique-number order', async () => {
    const result = await buildController().list();

    // Initial Access before Credential Access before Exfiltration — which is the opposite of
    // what sorting by technique ID alone would give, since T1003.001 sorts first there.
    expect(result.map((t) => t.techniqueId)).toEqual([
      'T1078', // TA0001 Initial Access
      'T1566.001', // TA0001
      'T1003.001', // TA0006 Credential Access
      'T1110', // TA0006
      'T1041', // TA0010 Exfiltration
    ]);
  });

  it('keeps techniques sorted by ID within a single tactic', async () => {
    const result = await buildController().list();
    const credentialAccess = result
      .filter((t) => t.tactic === 'TA0006')
      .map((t) => t.techniqueId);

    expect(credentialAccess).toEqual(['T1003.001', 'T1110']);
  });

  it('falls back to the raw tactic ID when the tactic is unrecognised, and sorts it last', async () => {
    // A seed row referencing a tactic outside the Enterprise set. It should still be
    // selectable and still render under *some* heading rather than a blank one, and it must
    // not displace real tactics at the top of the list.
    const result = await buildController([
      { id: 'u9', techniqueId: 'T9999', name: 'Mystery', tactic: 'TA9999' },
      ...ROWS,
    ]).list();

    const mystery = result.find((t) => t.techniqueId === 'T9999');
    expect(mystery?.tacticName).toBe('TA9999');
    expect(result[result.length - 1]?.techniqueId).toBe('T9999');
  });
});
