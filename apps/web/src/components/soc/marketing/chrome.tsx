/**
 * Shared product-chrome primitives for the ClickBox marketing demos.
 *
 * Every demo on the landing page is rendered inside the same window frame so
 * the four surfaces read as one product rather than four illustrations.
 */
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { monoFont, displayFont, Reveal } from "./atmos";

/** A macOS-ish app window with a ClickBox URL bar and a live indicator. */
export function AppWindow({
  path,
  children,
  live = true,
  className = "",
}: {
  path: string;
  children: ReactNode;
  live?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 ${className}`}
      style={{
        background: "linear-gradient(180deg, #0D0D0D, #080808)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.06) inset, 0 70px 150px -50px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.03)",
      }}
    >
      <div className="flex items-center gap-2 border-b border-white/8 bg-black/50 px-3.5 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-white/12" />
          <span className="size-2.5 rounded-full bg-white/12" />
          <span className="size-2.5 rounded-full bg-white/12" />
        </div>
        <div
          className="mx-auto flex items-center gap-2 rounded-md border border-white/8 bg-black/60 px-3 py-1 text-[10.5px] text-white/55"
          style={monoFont}
        >
          <Lock className="size-2.5" />
          {path}
        </div>
        {live && (
          <div
            className="hidden items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-white/35 sm:flex"
            style={monoFont}
          >
            <span
              className="size-1.5 animate-pulse rounded-full"
              style={{ background: "var(--primary)" }}
            />
            live
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** Editorial header for one demo chapter: number, title, one-line claim. */
export function DemoIntro({
  index,
  kicker,
  title,
  body,
}: {
  index: string;
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      <div
        className="flex items-center justify-center gap-3 text-[10.5px] uppercase tracking-[0.24em] text-white/35"
        style={monoFont}
      >
        <span style={{ color: "color-mix(in oklab, var(--primary) 90%, white)" }}>{index}</span>
        <span className="h-px w-8 bg-white/15" />
        {kicker}
      </div>
      <h3
        className="mt-5 text-[30px] font-semibold leading-[1.06] tracking-[-0.035em] text-white md:text-[46px]"
        style={displayFont}
      >
        {title}
      </h3>
      <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.7] text-white/55 [text-wrap:pretty]">
        {body}
      </p>
    </Reveal>
  );
}

/** Section shell: generous vertical rhythm, art bleeding behind the window. */
export function DemoSection({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <section id={id} className="relative px-6 py-28 md:py-40">
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

/**
 * Wraps a full-size product demo so mobile gets a tall, cropped "peek" into
 * it (masked with overflow + a fade, gently tilted) instead of the demo's
 * own responsive layout collapsing into a long, fully-stacked column. The
 * demo itself is untouched and stays a single mounted instance — only the
 * viewport window around it changes below `lg`.
 */
export function MobileDemoCrop({
  children,
  bleed = false,
}: {
  children: ReactNode;
  bleed?: boolean;
}) {
  return (
    <div className="relative">
      <div
        className={`max-h-[460px] -rotate-1 overflow-hidden rounded-2xl lg:max-h-none lg:rotate-0 lg:overflow-visible lg:rounded-none ${
          bleed ? "-mr-5 sm:-mr-8 lg:mr-0" : ""
        }`}
      >
        {children}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 rounded-b-2xl lg:hidden"
        style={{ background: "linear-gradient(180deg, transparent, #000)" }}
      />
    </div>
  );
}

export function Pill({
  tone = "muted",
  children,
}: {
  tone?: "critical" | "warn" | "ok" | "muted";
  children: ReactNode;
}) {
  const map = {
    critical: {
      color: "#FFD9DA",
      background: "color-mix(in oklab, var(--critical) 22%, transparent)",
      borderColor: "color-mix(in oklab, var(--critical) 45%, transparent)",
    },
    warn: {
      color: "#FFE6BE",
      background: "color-mix(in oklab, var(--warning) 20%, transparent)",
      borderColor: "color-mix(in oklab, var(--warning) 40%, transparent)",
    },
    ok: {
      color: "#FFFFFF",
      background: "rgba(255,255,255,0.06)",
      borderColor: "rgba(255,255,255,0.16)",
    },
    muted: {
      color: "rgba(255,255,255,0.6)",
      background: "rgba(255,255,255,0.03)",
      borderColor: "rgba(255,255,255,0.1)",
    },
  }[tone];

  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.14em]"
      style={{ ...monoFont, ...map }}
    >
      {children}
    </span>
  );
}
