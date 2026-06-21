import { TaskStatus, type TaskStatus as TaskStatusType } from "@prisma/client";
import type { MiddlewareHandler } from "hono";
import prisma from "../lib/prisma";
import { canSetStatus } from "../lib/permissions";
import type { AppEnv } from "./auth.middleware";

function isTaskStatus(value: unknown): value is TaskStatusType {
  return (
    typeof value === "string" &&
    Object.values(TaskStatus).includes(value as TaskStatusType)
  );
}

function isStatusUpdateBody(
  value: unknown,
): value is { status: TaskStatusType; version: number } {
  if (!value || typeof value !== "object") return false;
  const body = value as { status?: unknown; version?: unknown };
  return isTaskStatus(body.status) && typeof body.version === "number";
}

export function requireProjectMembership(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    const projectId = c.req.param("projectId");

    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (!projectId) return c.json({ error: "Project id is required" }, 400);
    if (user.role === "PM") return next();
    if (user.role === "CLIENT_GUEST") return c.json({ error: "Forbidden" }, 403);

    const task = await prisma.task.findFirst({
      where: { projectId, assigneeId: user.id, deletedAt: null },
      select: { id: true },
    });

    if (!task) {
      return c.json(
        { error: "Forbidden", reason: "You are not assigned to this project" },
        403,
      );
    }

    await next();
  };
}

export function requireClientOwnsProject(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    const projectId = c.req.param("projectId");

    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (user.role !== "CLIENT_GUEST") return next();
    if (!projectId) return c.json({ error: "Project id is required" }, 400);

    const project = await prisma.project.findFirst({
      where: { id: projectId, clientId: user.id, deletedAt: null },
      select: { id: true },
    });

    if (!project) {
      return c.json(
        { error: "Forbidden", reason: "Project not found or access denied" },
        403,
      );
    }

    await next();
  };
}

export function requireTaskStatusTransitionAllowed(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    const taskId = c.req.param("taskId");

    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (!taskId) return c.json({ error: "Task id is required" }, 400);

    let body: unknown;
    try {
      body = await c.req.raw.clone().json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!isStatusUpdateBody(body)) {
      return c.json({ error: "Validation error" }, 400);
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { id: true, assigneeId: true, status: true, version: true },
    });

    if (!task) return c.json({ error: "Task not found" }, 404);

    const dependencies = await prisma.taskDependency.findMany({
      where: { taskId },
      select: { dependsOnTask: { select: { status: true } } },
    });
    const allDependenciesDone = dependencies.every(
      (dependency) => dependency.dependsOnTask.status === "DONE",
    );
    const result = canSetStatus(user, body.status, {
      assigneeId: task.assigneeId,
      allDependenciesDone,
    });

    if (!result.allowed) {
      return c.json({ error: "Forbidden", reason: result.reason }, 403);
    }

    await next();
  };
}
