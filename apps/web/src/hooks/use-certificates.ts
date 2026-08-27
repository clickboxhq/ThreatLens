import { useQuery } from "@tanstack/react-query";
import { certificatesService } from "@/services/certificates";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useCertificates() {
  const query = useQuery({
    queryKey: queryKeys.certificates,
    queryFn: () => certificatesService.listCertificates(),
  });
  return { ...query, certificates: query.data ?? [], state: deriveViewState(query) };
}

export function useCertificate(id: string) {
  const query = useQuery({
    queryKey: [...queryKeys.certificates, id],
    queryFn: () => certificatesService.getCertificate(id),
  });
  return { certificate: query.data, isPending: query.isPending, isError: query.isError };
}
