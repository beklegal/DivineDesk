import type { Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { parse, serialize } from "cookie";
import type { UserRole } from "../shared/api.js";

const AUTH_COOKIE_NAME = "divinedesk_session";
const AUTH_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_SALT_ROUNDS = 10;

export interface SessionTokenPayload {
  userId: string;
  churchId: string | null;
  branchId: string | null;
  role: UserRole;
}

function getJwtSecret() {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV !== "production") {
    return "divinedesk-dev-secret";
  }

  throw new Error("JWT_SECRET is not configured");
}

export function isPasswordHash(value: string) {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(password: string, storedPassword: string) {
  if (!isPasswordHash(storedPassword)) {
    return password === storedPassword;
  }

  return bcrypt.compare(password, storedPassword);
}

export function createSessionToken(payload: SessionTokenPayload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: AUTH_COOKIE_TTL_SECONDS,
  });
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (typeof decoded !== "object" || !decoded) {
      return null;
    }

    if (typeof decoded.userId !== "string") {
      return null;
    }

    return {
      userId: decoded.userId,
      churchId: typeof decoded.churchId === "string" ? decoded.churchId : null,
      branchId: typeof decoded.branchId === "string" ? decoded.branchId : null,
      role: typeof decoded.role === "string" ? (decoded.role as UserRole) : "admin",
    };
  } catch {
    return null;
  }
}

export function getSessionTokenFromHeaders(headers: {
  authorization?: string | string[] | undefined;
  cookie?: string | undefined;
}) {
  const authorization =
    typeof headers.authorization === "string"
      ? headers.authorization
      : Array.isArray(headers.authorization)
        ? headers.authorization[0]
        : undefined;

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  const cookieHeader = headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const cookies = parse(cookieHeader);
  return cookies[AUTH_COOKIE_NAME] ?? null;
}

export function setAuthCookie(res: Response, token: string) {
  const serialized = serialize(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_COOKIE_TTL_SECONDS,
  });

  res.setHeader("Set-Cookie", serialized);
}

export function clearAuthCookie(res: Response) {
  const serialized = serialize(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  res.setHeader("Set-Cookie", serialized);
}
