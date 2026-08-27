import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { useMitreExplorer } from "@/hooks/use-mitre-explorer";

export const Route = createFileRoute("/app/mitre")({
  component: MitreExplorer,
  head: () => ({
    meta: [
      { title: "ThreatLens · MITRE ATT&CK Explorer" },
      {
        name: "description",
        content:
          "Explore ATT&CK tactics and techniques you have practiced across ThreatLens investigations.",
      },
      { property: "og:title", content: "ThreatLens · MITRE ATT&CK Explorer" },
      {
        property: "og:description",
        content: "Technique-level mastery across the ATT&CK enterprise matrix.",
      },
    ],
  }),
});

function tone(v: number) {
  if (v >= 85) return "var(--success)";
  if (v >= 70) return "var(--info)";
  if (v >= 60) return "var(--warning)";
  return "var(--high)";
}

function MitreExplorer() {
  const { mastery: mitreMastery, techniques: mitreTechniques } = useMitreExplorer();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="MITRE ATT&CK Explorer"
        description="Technique-level mastery across the enterprise matrix, derived from your graded investigations."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {mitreMastery.map((t) => (
          <Panel key={t.tactic} className="p-0">
            <div className="p-3">
              <div className="text-[11px] font-medium text-secondary">{t.tactic}</div>
              <div
                className="mt-2 text-xl font-semibold tabular-nums"
                style={{ color: tone(t.mastery) }}
              >
                {t.mastery}%
              </div>
              <div className="mt-1 text-[10.5px] text-muted-foreground tabular-nums">
                {t.practiced} of {t.total} techniques
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${t.mastery}%`, background: tone(t.mastery) }}
                />
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="mt-6" title="Techniques practiced" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Technique</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Tactic</th>
                <th className="px-4 py-2.5 font-medium">Investigations</th>
                <th className="px-4 py-2.5 font-medium">Mastery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mitreTechniques.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-background/40">
                  <td className="px-4 py-2.5 font-mono text-[11px] text-[color:var(--info)]">
                    {t.id}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 text-secondary">{t.tactic}</td>
                  <td className="px-4 py-2.5 tabular-nums">{t.practicedCount}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-24 overflow-hidden rounded-full bg-background">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${t.mastery}%`, background: tone(t.mastery) }}
                        />
                      </div>
                      <span className="tabular-nums text-muted-foreground">{t.mastery}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
