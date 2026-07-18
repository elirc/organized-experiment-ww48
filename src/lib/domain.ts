/**
 * This file centralizes shared domain enums for client and server code so the UI
 * does not need to import Prisma-generated types directly.
 * What calls it: form components, validation schemas, services, and docs-facing helpers.
 * What it calls: no runtime dependencies.
 * A junior engineer would likely get this wrong by duplicating enum strings in
 * multiple forms and creating subtle drift from the API validation boundary.
 */
export const LEAD_STAGES = [
  "NEW",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export const LEAD_SOURCES = [
  "REFERRAL",
  "WEBSITE",
  "OUTBOUND",
  "PARTNER",
  "EVENT",
  "OTHER",
] as const;

export const LEAD_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export const FOLLOW_UP_STATUSES = ["PENDING", "COMPLETED", "CANCELED"] as const;

export type LeadStageValue = (typeof LEAD_STAGES)[number];
export type LeadSourceValue = (typeof LEAD_SOURCES)[number];
export type LeadPriorityValue = (typeof LEAD_PRIORITIES)[number];
export type FollowUpStatusValue = (typeof FOLLOW_UP_STATUSES)[number];

export const stageLabels: Record<LeadStageValue, string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export const followUpStatusLabels: Record<FollowUpStatusValue, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
};

