import { format as formatDateFn, formatDistanceToNow } from "date-fns";

/**
 * This file owns display formatting helpers used across the dashboard and detail views.
 * What calls it: dashboard and lead detail components.
 * What it calls: date-fns and Intl APIs.
 * A junior engineer would likely get this wrong by formatting dates differently
 * in each component and making the UI feel inconsistent and harder to scan.
 */
export function formatCurrency(cents: number | null | undefined) {
  if (!cents) {
    return "No estimate";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) {
    return "Not scheduled";
  }

  return formatDateFn(new Date(date), "MMM d, yyyy");
}

export function formatRelativeDate(date: string | Date | null | undefined) {
  if (!date) {
    return "Not scheduled";
  }

  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

