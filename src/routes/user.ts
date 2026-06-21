import { Hono } from "hono";
import prisma from "../lib/prisma";

const user = new Hono();

// GET all users
user.get("/", async (c) => {
  const users = await prisma.user.findMany();
  return c.json(users);
});

// GET user by id
user.get("/:id", async (c) => {
  const id = c.req.param("id");
  const data = await prisma.user.findUnique({ where: { id } });
  if (!data) return c.json({ message: "Not found" }, 404);
  return c.json(data);
});

// POST create user
user.post("/", async (c) => {
  const body = await c.req.json();
  const data = await prisma.user.create({ data: body });
  return c.json(data, 201);
});

// DELETE user
user.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await prisma.user.delete({ where: { id } });
  return c.json({ message: "Deleted" });
});

export default user;
