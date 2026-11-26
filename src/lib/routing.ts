import type { Profile } from "./types.ts";

export type Area = "/login" | "/agent" | "/admin" | "/pending" | "/blocked";

/**
 * Where a person belongs, decided ONLY from the profile row the database
 * returned (role and status). Nothing the user typed is ever used.
 * This is convenience routing: the real protection is row level security
 * and the role checks inside the Edge Functions.
 */
export function routeFor(
  hasSession: boolean,
  profile: Pick<Profile, "role" | "status"> | null,
): Area {
  if (!hasSession || !profile) return "/login";
  if (profile.role === "admin") {
    return profile.status === "active" ? "/admin" : "/blocked";
  }
  switch (profile.status) {
    case "active":
      return "/agent";
    case "pending":
      return "/pending";
    default: // rejected, suspended, or anything unexpected
      return "/blocked";
  }
}

/** Where "/" goes: like routeFor, but a first-time visitor with no session sees the welcome screens first. */
export function startRoute(
  hasSession: boolean,
  profile: Pick<Profile, "role" | "status"> | null,
  welcomed: boolean,
): Area | "/welcome" {
  if (!hasSession && !welcomed) return "/welcome";
  return routeFor(hasSession, profile);
}
