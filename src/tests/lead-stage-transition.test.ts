import { describe, expect, it } from "vitest";

import { assertValidStageTransition } from "@/services/leadService";

describe("lead stage transitions", () => {
  it("rejects a skipped transition from NEW directly to WON", () => {
    // This matters because silent stage skipping destroys forecast quality and
    // makes activity timelines impossible to trust during pipeline review.
    expect(() => assertValidStageTransition("NEW", "WON")).toThrow(
      /Cannot move a lead from NEW to WON/,
    );
  });
});

