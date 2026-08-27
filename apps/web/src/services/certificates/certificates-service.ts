import type { Certificate } from "@/types/certificates";

export interface CertificatesService {
  listCertificates(): Promise<Certificate[]>;
  getCertificate(id: string): Promise<Certificate | null>;
}
