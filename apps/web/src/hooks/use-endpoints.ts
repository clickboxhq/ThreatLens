import { useSoc } from "@/lib/store";
import { endpointsService } from "@/services/endpoints";

export function useEndpoints() {
  const endpoints = useSoc((s) => s.endpoints);
  return { endpoints, toggleIsolate: endpointsService.toggleIsolate };
}
