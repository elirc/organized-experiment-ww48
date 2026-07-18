import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import type { SessionUser } from "@/lib/types/auth";

/**
 * This file signs, verifies, and reads the session cookie for both pages and APIs.
 * What calls it: auth routes, withAuth middleware, and authenticated pages.
 * What it calls: jose, next/headers cookie storage, and the validated env module.
 * A junior engineer would likely get this wrong by storing too much user data in
 * the cookie or forgetting that the API and page code paths both need the same contract.
 */
const SESSION_COOKIE_NAME = "crm_session";
const encoder = new TextEncoder();

async function getSecretKey() {
  return encoder.encode(env.SESSION_SECRET);
}

export async function signSessionToken(user: SessionUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(await getSecretKey());
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify<SessionUser>(token, await getSecretKey());
    return verified.payload;
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser) {
  const cookieStore = await cookies();
  const token = await signSessionToken(user);

  // ⚠️ SENIOR NOTE: the cookie must remain HTTP-only because the UI does not
  // need to read the token, and exposing it to JS would expand XSS blast radius.
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getPageSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function requirePageSession() {
  const session = await getPageSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function getRequestSession(request: Request) {
  const header = request.headers.get("cookie");
  const token = header
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.split("=")[1];

  return verifySessionToken(token);
}
