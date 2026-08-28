import { useQuery } from "@tanstack/react-query";
import { certificatesService } from "@/services/certificates";

const keys = {
  mine: ["certificates", "mine"] as const,
  one: (id: string) => ["certificates", id] as const,
};

export function useCertificates() {
  const query = useQuery({
    queryKey: keys.mine,
    queryFn: () => certificatesService.listCertificates(),
  });
  return { certificates: query.data ?? [], isPending: query.isPending, isError: query.isError };
}

/** Used by the public verify.$id.tsx page — no auth required on the backend. */
export function useCertificate(id: string) {
  const query = useQuery({
    queryKey: keys.one(id),
    queryFn: () => certificatesService.getCertificate(id),
  });
  return { certificate: query.data, isPending: query.isPending, isError: query.isError };
}
