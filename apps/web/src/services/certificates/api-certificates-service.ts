import { apiClient, ApiError } from "@/lib/api-client";
import type { CertificatesService } from "./certificates-service";
import type { MyCertificateDto, PublicCertificateDto } from "@/types/threatlens-learning";

export const apiCertificatesService: CertificatesService = {
  listCertificates: () => apiClient.get<MyCertificateDto[]>("/learning/certificates/mine"),

  getCertificate: async (id) => {
    try {
      return await apiClient.get<PublicCertificateDto>(`/learning/public/verify/${id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_FOUND") return null;
      throw err;
    }
  },
};
