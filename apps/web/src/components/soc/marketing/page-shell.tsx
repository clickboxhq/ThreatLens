import type { ReactNode } from "react";
import { Nav, Footer } from "@/routes/index";

/** Shared chrome for every dedicated marketing page: nav + footer, same as the homepage. */
export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Nav />
      <div className="pt-[57px]">{children}</div>
      <Footer />
    </div>
  );
}

/** A full-bleed section with an explicit dark or light background. */
export function Section({
  tone = "dark",
  id,
  className = "",
  children,
}: {
  tone?: "dark" | "light";
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      style={
        tone === "light"
          ? { background: "#FFFFFF", color: "#0A0C0F" }
          : { background: "#000000", color: "#EDEDED" }
      }
    >
      <div className={`relative mx-auto max-w-7xl px-6 py-24 ${className}`}>{children}</div>
    </section>
  );
}
