import { describe, expect, it } from "vitest";

import { buildLeadWhere } from "@/repositories/leadRepository";

describe("lead query ownership isolation", () => {
  it("keeps the owner scope in the repository where-clause for rep visibility", () => {
    // This matters because ownership scoping must survive alongside search and
    // filter conditions, otherwise one "helpful" query refactor can leak data.
    const where = buildLeadWhere(
      {
        search: "northwind",
        stage: "QUALIFIED",
      },
      {
        ownerId: "rep-user",
      },
    );

    expect(where).toEqual({
      AND: [
        { stage: "QUALIFIED" },
        {
          OR: [
            { companyName: { contains: "northwind", mode: "insensitive" } },
            { contactName: { contains: "northwind", mode: "insensitive" } },
            { email: { contains: "northwind", mode: "insensitive" } },
          ],
        },
        { ownerId: "rep-user" },
      ],
    });
  });
});
