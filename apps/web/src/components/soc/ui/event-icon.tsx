import {
  Cloud,
  FileText,
  Globe,
  KeyRound,
  Mail,
  Network,
  Terminal,
  UserCog,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Icon per telemetry event table — the vocabulary an analyst uses to read a reconstructed
 * attack chain at a glance ("mail, then a sign-in, then a process, then a network connection"
 * is a recognisable shape; eight identical dots are not).
 *
 * Deliberately NOT colour-coded. This palette's colours are severity-named (--critical,
 * --high, --warning, --success), so tinting timeline entries by event type would read as
 * severity to anyone who has used the rest of the product — implying, falsely, that a process
 * event is inherently more dangerous than an email. Differentiation is by shape alone, which
 * carries the same information without inventing a signal the data does not support.
 */
const EVENT_ICONS: Record<string, typeof Circle> = {
  email_messages: Mail,
  sign_in_events: KeyRound,
  process_events: Terminal,
  file_events: FileText,
  network_events: Network,
  http_requests: Globe,
  cloud_events: Cloud,
  directory_audit_events: UserCog,
};

/** Human-readable name for an event table, for tooltips and screen readers. */
const EVENT_LABELS: Record<string, string> = {
  email_messages: "Email",
  sign_in_events: "Sign-in",
  process_events: "Process",
  file_events: "File",
  network_events: "Network connection",
  http_requests: "Web request",
  cloud_events: "Cloud action",
  directory_audit_events: "Directory change",
};

export function eventTypeLabel(eventTable: string): string {
  return EVENT_LABELS[eventTable] ?? eventTable.replace(/_/g, " ");
}

export function EventTypeIcon({
  eventTable,
  className,
}: {
  eventTable: string;
  className?: string;
}) {
  const Icon = EVENT_ICONS[eventTable] ?? Circle;
  const label = eventTypeLabel(eventTable);
  return (
    <span title={label} aria-label={label} role="img" className="inline-flex">
      <Icon className={cn("size-3 text-muted-foreground", className)} />
    </span>
  );
}
