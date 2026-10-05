import { apiClient, ApiError } from "@/lib/api-client";
import type { CertificatesService } from "./certificates-service";
import type {
  CareerTrackProgressDto,
  CertificateDto,
  MyCertificateDto,
} from "@/types/threatlens-learning";

const notFoundToNull = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError && err.code === "NOT_FOUND") return null;
    throw err;
  }
};

export const apiCertificatesService: CertificatesService = {
  listCertificates: () => apiClient.get<MyCertificateDto[]>("/learning/certificates/mine"),

  careerTrackProgress: () =>
    apiClient.get<CareerTrackProgressDto[]>("/learning/career-track-progress"),

  getMyCertificate: (publicId) =>
    notFoundToNull(() =>
      apiClient.get<CertificateDto>(`/learning/certificates/${encodeURIComponent(publicId)}`),
    ),

  getPublicCertificate: (idOrPublicId) =>
    notFoundToNull(() =>
      apiClient.get<CertificateDto>(`/learning/public/verify/${encodeURIComponent(idOrPublicId)}`),
    ),
};
