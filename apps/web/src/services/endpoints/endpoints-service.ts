import type {
  DeviceDto,
  ProcessTreeNodeDto,
  FileEventDto,
  NetworkEventDto,
  HttpRequestDto,
} from "@/types/socverse-operations";

/** Devices are generated per session, same as identities — see socverse-operations.ts.
 * The forensics reads below are what endpoint/malware/ransomware/web scenarios actually turn
 * on: what ran, what it touched, and where it talked to. */
export interface EndpointsService {
  list(sessionId: string): Promise<DeviceDto[]>;
  getProfile(sessionId: string, deviceId: string): Promise<DeviceDto>;
  /** Parent/child nested by processGuid — the endpoint analyst's primary view. */
  getProcessTree(sessionId: string, deviceId: string): Promise<ProcessTreeNodeDto[]>;
  getFiles(sessionId: string, deviceId: string): Promise<FileEventDto[]>;
  getNetwork(sessionId: string, deviceId: string): Promise<NetworkEventDto[]>;
  getHttpRequests(sessionId: string, deviceId: string): Promise<HttpRequestDto[]>;
  isolate(sessionId: string, deviceId: string): Promise<DeviceDto>;
}
