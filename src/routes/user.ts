import { Role } from "@prisma/client";
import { Hono } from "hono";
import prisma from "../lib/prisma";
import { authMiddleware, type AppEnv } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";

const user = new Hono<AppEnv>();

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
} as const;

function parseRole(value: string | undefined): Role | undefined {
  if (!value) return undefined;
  return Object.values(Role).includes(value as Role) ? (value as Role) : undefined;
}

user.use("*", authMiddleware);
user.use("*", requireRole("PM"));

user.get("/", async (c) => {
  const role = parseRole(c.req.query("role"));
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(role ? { role } : {}),
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: userSelect,
  });

  return c.json({ message: "Users retrieved successfully", data: users });
});

user.get("/:id", async (c) => {
  const id = c.req.param("id");
  const data = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: userSelect,
  });

  if (!data) return c.json({ error: "User not found" }, 404);
  return c.json({ message: "User retrieved successfully", data });
});

export default user;
