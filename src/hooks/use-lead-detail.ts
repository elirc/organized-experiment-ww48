"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/http/client";

/**
 * This file owns lead detail reads and all lead-centric mutations.
 * What calls it: src/components/leads/lead-detail-page.tsx and its child forms.
 * What it calls: browser fetch helpers and React Query primitives.
 * A junior engineer would likely get this wrong by mutating nested timeline data
 * locally instead of invalidating the authoritative lead detail query.
 */
export type LeadDetailResponse = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  description: string | null;
  stage: string;
  source: string;
  priority: string;
  valueCents: number | null;
  ownerId: string;
  nextFollowUpAt: string | null;
  createdAt: string;
  owner: {
    id: string;
    name: string;
    role: string;
  };
  createdBy: {
    id: string;
    name: string;
    role: string;
  };
  notes: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: {
      id: string;
      name: string;
      role: string;
    };
  }>;
  followUps: Array<{
    id: string;
    description: string;
    dueAt: string;
    status: "PENDING" | "COMPLETED" | "CANCELED";
    ownerId: string;
    completedAt: string | null;
    owner: {
      id: string;
      name: string;
      role: string;
    };
    createdBy: {
      id: string;
      name: string;
      role: string;
    };
  }>;
  activities: Array<{
    id: string;
    type: string;
    message: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    actor: {
      id: string;
      name: string;
      role: string;
    } | null;
  }>;
};

export function useLeadDetail(leadId: string) {
  return useQuery({
    queryKey: ["lead-detail", leadId],
    queryFn: () => apiFetch<LeadDetailResponse>(`/api/leads/${leadId}`),
  });
}

function invalidateLeadQueries(queryClient: ReturnType<typeof useQueryClient>, leadId: string) {
  void queryClient.invalidateQueries({ queryKey: ["lead-detail", leadId] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useUpdateLead(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiFetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateLeadQueries(queryClient, leadId),
  });
}

export function useAddNote(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: string }) =>
      apiFetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateLeadQueries(queryClient, leadId),
  });
}

export function useAddFollowUp(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiFetch(`/api/leads/${leadId}/follow-ups`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateLeadQueries(queryClient, leadId),
  });
}

export function useUpdateFollowUpStatus(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      followUpId,
      status,
    }: {
      followUpId: string;
      status: "COMPLETED" | "CANCELED";
    }) =>
      apiFetch(`/api/follow-ups/${followUpId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => invalidateLeadQueries(queryClient, leadId),
  });
}

