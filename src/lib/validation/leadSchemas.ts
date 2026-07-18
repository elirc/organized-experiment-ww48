import { z } from "zod";

import {
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  LEAD_STAGES,
} from "@/lib/domain";

/**
 * This file defines validation for lead, note, and follow-up request payloads.
 * What calls it: lead, note, follow-up, and dashboard API routes.
 * What it calls: Zod and the shared domain enum constants.
 * A junior engineer would likely get this wrong by encoding business rules only
 * in the UI and letting direct API calls bypass required fields.
 */
export const leadFilterSchema = z.object({
  stage: z.enum(LEAD_STAGES).optional(),
  ownerId: z.string().min(1).optional(),
  search: z.string().trim().optional(),
  mineOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const createLeadSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase(),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  source: z.enum(LEAD_SOURCES),
  priority: z.enum(LEAD_PRIORITIES),
  stage: z.enum(LEAD_STAGES).default("NEW"),
  ownerId: z.string().min(1),
  valueCents: z.coerce.number().int().min(0).max(100_000_000).optional(),
});

export const updateLeadSchema = createLeadSchema.partial().superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    // ⚠️ SENIOR NOTE: empty PATCH payloads create noisy audit logs and ambiguous
    // "successful" updates that did not actually change persisted state.
    ctx.addIssue({
      code: "custom",
      message: "At least one field must be provided.",
    });
  }
});

export const createNoteSchema = z.object({
  body: z.string().trim().min(4).max(1500),
});

export const createFollowUpSchema = z.object({
  ownerId: z.string().min(1),
  description: z.string().trim().min(4).max(500),
  dueAt: z.coerce.date(),
});

export const updateFollowUpStatusSchema = z.object({
  // ⚠️ SENIOR NOTE: keeping this enum narrow prevents the route from silently
  // accepting a client-invented workflow state like "PENDING" or "SNOOZED".
  status: z.enum(["COMPLETED", "CANCELED"]),
});
