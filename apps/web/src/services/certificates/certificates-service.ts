import type { MyCertificateDto, PublicCertificateDto } from "@/types/threatlens-learning";

export interface CertificatesService {
  listCertificates(): Promise<MyCertificateDto[]>;
  /** Unauthenticated on the backend — verify.$id.tsx uses this from a public link, not just
   * the authenticated Certificates page. */
  getCertificate(id: string): Promise<PublicCertificateDto | null>;
}
