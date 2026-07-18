import type { Prisma } from "@prisma/client";

import type { DatabaseClient } from "@/repositories/shared";

/**
 * This file owns audit-log writes for the lead timeline.
 * What calls it: leadService, noteService, and followUpService.
 * What it calls: Prisma through the shared database-client contract.
 * A junior engineer would likely get this wrong by treating activity logging as
 * optional, which removes the forensic trail teams need during support incidents.
 */
export async function createActivityLog(
  client: DatabaseClient,
  data: Prisma.ActivityLogUncheckedCreateInput,
) {
  return client.activityLog.create({
    data,
  });
}

