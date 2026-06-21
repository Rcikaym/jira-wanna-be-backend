import type { Department, Role } from "@prisma/client";
import type { MiddlewareHandler } from "hono";
import prisma from "../lib/prisma";
import { verifyToken } from "../lib/jwt";

export type AppEnv = {
  Variables: {
    user: {
      id: string;
      email: string;
      role: Role;
      department: Department | null;
    };
  };
};

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authorization = c.req.header("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let payload: ReturnType<typeof verifyToken>;

  try {
    payload = verifyToken(token);
  } catch {
    return c.json({ error: "Token invalid or expired" }, 401);
  }

  const user = await prisma.user.findFirst({
    where: {
      id: payload.sub,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      role: true,
      department: true,
    },
  });

  if (!user) {
    return c.json({ error: "Account no longer exists" }, 401);
  }

  c.set("user", user);

  await next();
};
