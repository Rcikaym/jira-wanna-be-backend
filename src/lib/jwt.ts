import type { Department, Role } from "@prisma/client";
import jwt, {
  type JwtPayload as JsonWebTokenPayload,
  type SignOptions,
} from "jsonwebtoken";

const roles = ["PM", "INTERNAL", "CLIENT_GUEST"] as const satisfies readonly Role[];
const departments = [
  "UI_UX",
  "FRONTEND",
  "BACKEND",
] as const satisfies readonly Department[];

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  department: Department | null;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}

function isDepartment(value: unknown): value is Department {
  return typeof value === "string" && departments.includes(value as Department);
}

function isJwtPayload(value: unknown): value is JwtPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const decoded = value as JsonWebTokenPayload;

  return (
    typeof decoded.sub === "string" &&
    typeof decoded.email === "string" &&
    isRole(decoded.role) &&
    (decoded.department === null || isDepartment(decoded.department))
  );
}

export function signToken(payload: JwtPayload): string {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? "7d";
  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, getJwtSecret(), options);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, getJwtSecret());

  if (!isJwtPayload(decoded)) {
    throw new Error("Invalid token payload");
  }

  return {
    sub: decoded.sub,
    email: decoded.email,
    role: decoded.role,
    department: decoded.department,
  };
}
