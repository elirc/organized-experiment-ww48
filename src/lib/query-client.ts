import { QueryClient } from "@tanstack/react-query";

/**
 * This file creates the shared React Query client configuration.
 * What calls it: src/components/providers/app-providers.tsx.
 * What it calls: QueryClient from TanStack Query.
 * A junior engineer would likely get this wrong by using the default retry
 * behavior for every mutation and turning permission failures into noisy retries.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

