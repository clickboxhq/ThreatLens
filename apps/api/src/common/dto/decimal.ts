import type { Prisma } from '@prisma/client';

/**
 * Score columns are `Decimal(5,2)` in Postgres, so Prisma hands back a Decimal object that
 * `JSON.stringify` renders as a *string* — `"85"`, not `85`. Every DTO that carries one has
 * always declared `number`, and the frontend believed it: the dashboard's average did
 * `sum + value` and string-concatenated its way to "AVERAGE SCORE 186172%" in production.
 *
 * Convert at the boundary so the wire type matches the declared one. Null passes through,
 * since an unscored session legitimately has no percentage.
 */
export function toNumber(value: Prisma.Decimal): number;
export function toNumber(
  value: Prisma.Decimal | null | undefined,
): number | null;
export function toNumber(
  value: Prisma.Decimal | null | undefined,
): number | null {
  return value === null || value === undefined ? null : Number(value);
}
