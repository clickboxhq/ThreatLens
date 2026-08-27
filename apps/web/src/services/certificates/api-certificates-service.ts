import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { CertificatesService } from "./certificates-service";

export const apiCertificatesService: CertificatesService = {
  listCertificates: () => {
    throw new NotConnectedError("CertificatesService.listCertificates");
  },
  getCertificate: () => {
    throw new NotConnectedError("CertificatesService.getCertificate");
  },
};
