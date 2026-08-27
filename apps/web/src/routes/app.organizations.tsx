import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useAccount } from "@/hooks/use-account";
import { useOrganizations } from "@/hooks/use-organizations";
import { Building2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/app/organizations")({
  component: OrgsPage,
  head: () => ({ meta: [{ title: "ThreatLens · My Organization" }] }),
});

function OrgsPage() {
  const { accountName } = useAccount();
  const { members: analysts } = useOrganizations();

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="My Organization"
        description="Roster, seats, and training assignment for your team."
      />

      <Panel>
        <div className="flex items-center gap-3">
          <IconTile tone="info" size="lg">
            <Building2 className="size-5" />
          </IconTile>
          <div>
            <div className="text-[14px] font-medium">{accountName}</div>
            <div className="text-[12px] text-muted-foreground">
              Cohort plan · {analysts.length} members · unlimited scenarios
            </div>
          </div>
          <button className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover">
            <UserPlus className="size-3.5" /> Invite member
          </button>
        </div>
      </Panel>

      <Panel padded={false} className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Member</th>
                <th className="px-4 py-2.5 text-left">Role</th>
                <th className="px-4 py-2.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {analysts.map((a) => (
                <tr key={a.name} className="hover:bg-background/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <IconTile
                        tone="info"
                        size="sm"
                        shape="circle"
                        className="text-[10.5px] font-semibold"
                      >
                        {a.initials}
                      </IconTile>
                      <span className="font-medium">{a.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-secondary">{a.role}</td>
                  <td className="px-4 py-3 text-[color:var(--success)]">Active</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
