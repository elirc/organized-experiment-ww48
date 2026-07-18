/**
 * This file defines the authenticated user shape shared across routes, services,
 * and server-rendered pages.
 * What calls it: auth/session helpers, middleware guards, services, and pages.
 * What it calls: no runtime dependencies; it is the shared contract layer.
 * A junior engineer would likely get this wrong by passing around raw Prisma
 * user records and accidentally exposing password hashes beyond the auth layer.
 */
export const APP_ROLES = ["ADMIN", "MANAGER", "REP"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
};

export type AuthContext = {
  user: SessionUser;
};

