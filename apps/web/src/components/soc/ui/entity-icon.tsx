import { Cloud, Mail, MonitorSmartphone, UserRound } from "lucide-react";
import type { EntityType } from "@/types/telemetry";
import { cn } from "@/lib/utils";

/** Canonical icon per telemetry entity type — the same domain vocabulary used in the sidebar (Identity/Endpoint/Email) plus Cloud, reused wherever an entity type is labeled. */
export const entityIcon: Record<EntityType, typeof UserRound> = {
  identity: UserRound,
  device: MonitorSmartphone,
  mailbox: Mail,
  cloud: Cloud,
};

export function EntityTypeIcon({ type, className }: { type: EntityType; className?: string }) {
  const Icon = entityIcon[type];
  return <Icon className={cn("size-3", className)} />;
}
