import { useEffect, useState } from "react";

/**
 * Zustand's `persist` middleware reads localStorage on mount, so
 * server-rendered/first-paint markup can briefly disagree with the
 * hydrated client state. Routes reading persisted store data gate their
 * real content behind this until the first client render has happened.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
