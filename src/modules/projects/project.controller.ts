import type { Context } from "hono";
import { AppError } from "../../lib/errors";
import { parseEzFilterParams } from "../../lib/ezfilter";
import type { AppEnv } from "../../middleware/auth.middleware";
import { CreateProjectDto, UpdateProjectDto } from "./project.dto";
import {
  createProject,
  deleteProject,
  getProject,
  getProjectSummary,
  listProjects,
  updateProject,
} from "./project.service";

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
    const params = parseEzFilterParams(c);
    const result = await listProjects(params, c.get("user"));
    return c.json({
      message: "Projects retrieved successfully",
      data: result.data,
      meta: { total: result.total, page: result.page, rows: result.rows },
    });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function createProjectHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const body: unknown = await c.req.json();
    const parsed = CreateProjectDto.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation error", details: parsed.error.flatten() }, 400);
    }

    const project = await createProject(parsed.data, c.get("user").id);
    return c.json({ message: "Project created successfully", data: project }, 201);
  } catch (error) {
    return handleError(error, c);
  }
}

export async function getProjectHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const project = await getProject(requiredParam(c, "projectId"), c.get("user"));
    return c.json({ message: "Project retrieved successfully", data: project });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function updateProjectHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const body: unknown = await c.req.json();
    const parsed = UpdateProjectDto.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation error", details: parsed.error.flatten() }, 400);
    }

    const project = await updateProject(
      requiredParam(c, "projectId"),
      parsed.data,
      c.get("user").id,
    );
    return c.json({ message: "Project updated successfully", data: project });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function deleteProjectHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const project = await deleteProject(requiredParam(c, "projectId"));
    return c.json({ message: "Project deleted successfully", data: project });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function getProjectSummaryHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const summary = await getProjectSummary(requiredParam(c, "projectId"));
    return c.json({ message: "Project summary retrieved successfully", data: summary });
  } catch (error) {
    return handleError(error, c);
  }
}
