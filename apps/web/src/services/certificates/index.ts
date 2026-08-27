import type { CertificatesService } from "./certificates-service";
import { mockCertificatesService } from "./mock-certificates-service";

export const certificatesService: CertificatesService = mockCertificatesService;
export type { CertificatesService } from "./certificates-service";
