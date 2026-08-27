import type { ThreatActor, IocSighting } from "@/types/threat-intel-page";

export interface ThreatIntelService {
  listActors(): Promise<ThreatActor[]>;
  listIocs(): Promise<IocSighting[]>;
}
