import type { Department, Role } from "@prisma/client";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./auth.middleware";

export function requireRole(...roles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (!roles.includes(user.role)) {
      return c.json({ error: "Forbidden", reason: "Insufficient role" }, 403);
    }

    await next();
  };
}

export function requireDepartment(
  ...departments: Department[]
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (!user.department || !departments.includes(user.department)) {
      return c.json({ error: "Forbidden", reason: "Insufficient department" }, 403);
    }

    await next();
  };
}
