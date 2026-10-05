import { useQuery } from "@tanstack/react-query";
import { certificatesService } from "@/services/certificates";

const keys = {
  mine: ["certificates", "mine"] as const,
  progress: ["certificates", "career-track-progress"] as const,
  one: (id: string) => ["certificates", "one", id] as const,
  public: (id: string) => ["certificates", "public", id] as const,
};

export function useCertificates() {
  const query = useQuery({
    queryKey: keys.mine,
    queryFn: () => certificatesService.listCertificates(),
  });
  return { certificates: query.data ?? [], isPending: query.isPending, isError: query.isError };
}

export function useCareerTrackProgress() {
  const query = useQuery({
    queryKey: keys.progress,
    queryFn: () => certificatesService.careerTrackProgress(),
  });
  return { tracks: query.data ?? [], isPending: query.isPending, isError: query.isError };
}

/** The owner's own certificate (authenticated) — for /app/certificates/$id. */
export function useMyCertificate(publicId: string) {
  const query = useQuery({
    queryKey: keys.one(publicId),
    queryFn: () => certificatesService.getMyCertificate(publicId),
  });
  return { certificate: query.data, isPending: query.isPending, isError: query.isError };
}

/** Public verification — no auth. Used by /verify/$id and the print page. */
export function usePublicCertificate(idOrPublicId: string) {
  const query = useQuery({
    queryKey: keys.public(idOrPublicId),
    queryFn: () => certificatesService.getPublicCertificate(idOrPublicId),
  });
  return { certificate: query.data, isPending: query.isPending, isError: query.isError };
}
