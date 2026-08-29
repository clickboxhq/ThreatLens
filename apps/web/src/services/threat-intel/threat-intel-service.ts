import type { ThreatActor, IocSighting } from "@/types/threat-intel-page";

export interface ThreatIntelService {
  /** Every real indicator lookup the Student has made and its worst-seen actor rollup. */
  listMine(): Promise<{ indicators: IocSighting[]; actors: ThreatActor[] }>;
}
