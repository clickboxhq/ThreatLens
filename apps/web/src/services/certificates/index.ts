import { apiCertificatesService } from "./api-certificates-service";
import type { CertificatesService } from "./certificates-service";

export const certificatesService: CertificatesService = apiCertificatesService;

export type { CertificatesService } from "./certificates-service";
