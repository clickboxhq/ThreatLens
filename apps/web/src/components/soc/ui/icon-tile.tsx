import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type IconTileTone = "neutral" | "info" | "success" | "warning" | "high" | "critical";
export type IconTileSize = "sm" | "md" | "lg" | "xl";
export type IconTileShape = "square" | "circle";

const sizeClass: Record<IconTileSize, string> = {
  sm: "size-7",
  md: "size-8",
  lg: "size-10",
  xl: "size-14",
};

const shapeClass: Record<IconTileSize, Record<IconTileShape, string>> = {
  sm: { square: "rounded-md", circle: "rounded-full" },
  md: { square: "rounded-md", circle: "rounded-full" },
  lg: { square: "rounded-lg", circle: "rounded-full" },
  xl: { square: "rounded-lg", circle: "rounded-full" },
};

const toneClass: Record<IconTileTone, string> = {
  neutral: "border border-border bg-background/60 text-muted-foreground",
  info: "bg-info/12 text-info",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  high: "bg-high/12 text-high",
  critical: "bg-critical/12 text-critical",
};

/**
 * The single "icon (or initials) in a tinted tile" container used across
 * the dashboard — domain badges, avatars, achievement/certificate marks,
 * threat-actor rows. Consolidates what used to be a bespoke div per call
 * site with its own size/radius/opacity.
 */
export function IconTile({
  tone = "neutral",
  size = "md",
  shape = "square",
  className,
  children,
}: {
  tone?: IconTileTone;
  size?: IconTileSize;
  shape?: IconTileShape;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center",
        sizeClass[size],
        shapeClass[size][shape],
        toneClass[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}
