import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { createLeadSchema } from "@/lib/validation/leadSchemas";

describe("lead validation boundary", () => {
  it("rejects an invalid lead payload before service logic runs", () => {
    // This matters because malformed payloads should fail at the edge instead of
    // reaching repositories and creating partial or misleading records.
    expect(() =>
      createLeadSchema.parse({
        companyName: "A",
        contactName: "Bo",
        email: "not-an-email",
        source: "WEBSITE",
        priority: "MEDIUM",
        stage: "NEW",
        ownerId: "",
      }),
    ).toThrow(ZodError);
  });
});

