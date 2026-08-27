import { useSoc } from "@/lib/store";

export function useIdentities() {
  const identities = useSoc((s) => s.identities);
  return { identities };
}
