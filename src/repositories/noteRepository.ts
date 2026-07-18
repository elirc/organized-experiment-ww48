import type { Prisma } from "@prisma/client";

import type { DatabaseClient } from "@/repositories/shared";

/**
 * This file owns note writes so note creation can stay inside lead-focused transactions.
 * What calls it: noteService.
 * What it calls: Prisma through the shared database-client contract.
 * A junior engineer would likely get this wrong by creating notes without an
 * accompanying lead authorization check, which leaks write access across owners.
 */
export async function createNote(client: DatabaseClient, data: Prisma.NoteUncheckedCreateInput) {
  return client.note.create({
    data,
    include: {
      author: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });
}

