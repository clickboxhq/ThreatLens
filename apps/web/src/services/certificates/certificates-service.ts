import type {
  CareerTrackProgressDto,
  CertificateDto,
  MyCertificateDto,
} from "@/types/threatlens-learning";

export interface CertificatesService {
  listCertificates(): Promise<MyCertificateDto[]>;
  /** Career-track progress for the current user — drives the "8 of 10" view. */
  careerTrackProgress(): Promise<CareerTrackProgressDto[]>;
  /** The owner's own certificate, by public id. */
  getMyCertificate(publicId: string): Promise<CertificateDto | null>;
  /**
   * Unauthenticated on the backend — the public /verify page and the print page
   * both use this. Accepts the public id or a legacy uuid.
   */
  getPublicCertificate(idOrPublicId: string): Promise<CertificateDto | null>;
}
