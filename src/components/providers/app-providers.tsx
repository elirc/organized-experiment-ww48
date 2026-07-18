"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { createQueryClient } from "@/lib/query-client";

/**
 * This file mounts client-side providers shared by the application shell.
 * What calls it: src/app/layout.tsx.
 * What it calls: the shared React Query client factory.
 * A junior engineer would likely get this wrong by creating a new QueryClient on
 * every render, which wipes cache state and causes unexpected refetching.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

