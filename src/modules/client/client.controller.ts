import type { Context } from "hono";
import { AppError } from "../../lib/errors";
import { parseEzFilterParams } from "../../lib/ezfilter";
import type { AppEnv } from "../../middleware/auth.middleware";
import { clientService } from "./client.service";

function handleError(error: unknown, c: Context): Response {
  if (error instanceof AppError) {
    return c.json(
      { error: error.message, ...(error.code ? { code: error.code } : {}) },
      error.statusCode,
    );
  }
  console.error(error);
  return c.json({ error: "Internal server error" }, 500);
}

function requiredParam(c: Context, name: string): string {
  const value = c.req.param(name);
  if (!value) throw new AppError(400, `${name} is required`);
  return value;
}

export async function listProjectsHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const projects = await clientService.listProjects(c.get("user"));
    return c.json({ message: "Projects retrieved successfully", data: projects });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function getProjectSummaryHandler(
  c: Context<AppEnv>,
): Promise<Response> {
  try {
    const summary = await clientService.getProjectSummary(
      requiredParam(c, "projectId"),
      c.get("user"),
    );
    return c.json({
      message: "Project summary retrieved successfully",
      data: summary,
    });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function listTasksHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const params = parseEzFilterParams(c);
    const result = await clientService.listTasks(
      requiredParam(c, "projectId"),
      params,
      c.get("user"),
    );

    return c.json({
      message: "Tasks retrieved successfully",
      data: result.data,
      meta: { total: result.total, page: result.page, rows: result.rows },
    });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function getTaskHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const task = await clientService.getTask(
      requiredParam(c, "projectId"),
      requiredParam(c, "taskId"),
      c.get("user"),
    );
    return c.json({ message: "Task retrieved successfully", data: task });
  } catch (error) {
    return handleError(error, c);
  }
}
