"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { apiFetch } from "@/lib/http/client";
import type { LeadStageValue } from "@/lib/domain";

/**
 * This file owns dashboard reads and lead creation mutations for the home page.
 * What calls it: src/components/dashboard/dashboard-page.tsx.
 * What it calls: browser fetch helpers and React Query primitives.
 * A junior engineer would likely get this wrong by invalidating every query in
 * the app after create instead of targeting the dashboard and related detail data.
 */
type DashboardFilters = {
  stage?: LeadStageValue;
  search?: string;
  mineOnly?: boolean;
};

export type DashboardResponse = {
  viewer: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  filters: {
    stage?: LeadStageValue;
    ownerId?: string;
    search?: string;
  };
  counts: Array<{
    stage: LeadStageValue;
    _count: {
      stage: number;
    };
  }>;
  leads: Array<{
    id: string;
    companyName: string;
    contactName: string;
    email: string;
    stage: LeadStageValue;
    priority: string;
    nextFollowUpAt: string | null;
    valueCents: number | null;
    createdAt: string;
    owner: {
      id: string;
      name: string;
      role: string;
    };
    _count: {
      notes: number;
      followUps: number;
    };
  }>;
  upcomingFollowUps: Array<{
    id: string;
    description: string;
    dueAt: string;
    owner: {
      id: string;
      name: string;
      role: string;
    };
    lead: {
      id: string;
      companyName: string;
      contactName: string;
      stage: LeadStageValue;
    };
  }>;
  assignableUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
};

function buildDashboardUrl(filters: DashboardFilters) {
  const params = new URLSearchParams();

  if (filters.stage) {
    params.set("stage", filters.stage);
  }

  if (filters.search) {
    params.set("search", filters.search);
  }

  if (filters.mineOnly) {
    params.set("mineOnly", "true");
  }

  const queryString = params.toString();
  return queryString ? `/api/dashboard?${queryString}` : "/api/dashboard";
}

export function useDashboard(filters: DashboardFilters) {
  return useQuery({
    queryKey: ["dashboard", filters],
    queryFn: () => apiFetch<DashboardResponse>(buildDashboardUrl(filters)),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiFetch("/api/leads", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

