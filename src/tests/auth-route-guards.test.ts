import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

describe("dashboard route permissions", () => {
  it("rejects a rep trying to filter another owner's leads with 403", async () => {
    // This matters because route-level filtering is an easy place to leak data:
    // a rep could otherwise enumerate team-owned leads by tweaking query params.
    vi.resetModules();
    vi.doMock("@/lib/middleware/withAuth", () => ({
      withAuth: (_request: NextRequest, handler: (context: { user: { id: string; email: string; name: string; role: "REP" } }) => Promise<Response>) =>
        handler({
          user: {
            id: "rep-user",
            email: "rep@crm.local",
            name: "Riley Rep",
            role: "REP",
          },
        }),
    }));

    const { GET } = await import("@/app/api/dashboard/route");
    const request = new NextRequest("http://localhost/api/dashboard?ownerId=manager-user");

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.code).toBe("FORBIDDEN");
  });
});
