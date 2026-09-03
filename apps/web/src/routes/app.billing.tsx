import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { Panel, SectionHeader } from "@/components/soc/primitives";

export const Route = createFileRoute("/app/billing")({
  component: Billing,
  head: () => ({
    meta: [
      { title: "ThreatLens · Billing" },
      {
        name: "description",
        content: "Billing and invoicing for your ThreatLens account.",
      },
      { property: "og:title", content: "ThreatLens · Billing" },
      {
        property: "og:description",
        content: "Billing and invoicing for your ThreatLens account.",
      },
    ],
  }),
});

/**
 * Billing is not built yet, so this page says so.
 *
 * It previously rendered a mock service: an Enterprise plan, 128 of 150 seats, a "Visa ••••
 * 4242" nobody had added, and four invoices totalling roughly $68,000 with one marked Open.
 * Every instructor and org_admin saw it, whatever their actual account. Placeholder copy reads
 * as unfinished; placeholder invoices read as money owed, and there is no way for someone
 * looking at that screen to tell it is not real.
 *
 * The route is kept rather than deleted so an existing link lands somewhere truthful instead of
 * on a 404.
 */
function Billing() {
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Billing"
        description="Plans, seats, and invoices for your ThreatLens account."
      />

      <Panel>
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <div className="grid size-10 place-items-center rounded-full border border-border bg-background text-muted-foreground">
            <CreditCard className="size-4" />
          </div>
          <h2 className="text-[15px] font-medium text-foreground">Billing isn't available yet</h2>
          <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
            There is nothing to pay and no invoices to show. Your account has full access to every
            scenario, cohort, and report while we finish this.
          </p>
          <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
            If you need a quote, an invoice, or seats for a team,{" "}
            <Link to="/contact" className="text-[color:var(--info)] underline underline-offset-2">
              get in touch
            </Link>{" "}
            and we'll sort it out directly.
          </p>
        </div>
      </Panel>
    </div>
  );
}
