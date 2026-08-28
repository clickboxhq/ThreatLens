import type { DeviceDto } from "@/types/socverse-operations";

/** Devices are generated per session, same as identities — see socverse-operations.ts. */
export interface EndpointsService {
  list(sessionId: string): Promise<DeviceDto[]>;
  isolate(sessionId: string, deviceId: string): Promise<DeviceDto>;
}
