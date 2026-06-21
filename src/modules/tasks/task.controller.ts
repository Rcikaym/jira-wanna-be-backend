import type { Context } from "hono";
import { AppError } from "../../lib/errors";
import { parseEzFilterParams } from "../../lib/ezfilter";
import type { AppEnv } from "../../middleware/auth.middleware";
import {
  AddAttachmentDto,
  AddDependencyDto,
  AssignTaskDto,
  CreateTaskDto,
  UpdateTaskFieldsDto,
  UpdateTaskStatusDto,
} from "./task.dto";
import {
  addAttachment,
  addDependency,
  assignTask,
  createTask,
  deleteTask,
  getAttachments,
  getTask,
  listTasks,
  removeDependency,
  updateTaskFields,
  updateTaskStatus,
} from "./task.service";

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

export async function listTasksHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const params = parseEzFilterParams(c);
    const result = await listTasks(requiredParam(c, "projectId"), params, c.get("user"));
    return c.json({
      message: "Tasks retrieved successfully",
      data: result.data,
      meta: { total: result.total, page: result.page, rows: result.rows },
    });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function createTaskHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const body: unknown = await c.req.json();
    const parsed = CreateTaskDto.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation error", details: parsed.error.flatten() }, 400);
    }
    const task = await createTask(requiredParam(c, "projectId"), parsed.data, c.get("user").id);
    return c.json({ message: "Task created successfully", data: task }, 201);
  } catch (error) {
    return handleError(error, c);
  }
}

export async function getTaskHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const task = await getTask(requiredParam(c, "taskId"), c.get("user"));
    return c.json({ message: "Task retrieved successfully", data: task });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function updateTaskFieldsHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const body: unknown = await c.req.json();
    const parsed = UpdateTaskFieldsDto.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation error", details: parsed.error.flatten() }, 400);
    }
    const task = await updateTaskFields(requiredParam(c, "taskId"), parsed.data, c.get("user").id);
    return c.json({ message: "Task updated successfully", data: task });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function deleteTaskHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const task = await deleteTask(requiredParam(c, "taskId"), c.get("user").id);
    return c.json({ message: "Task deleted successfully", data: task });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function updateTaskStatusHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const body: unknown = await c.req.json();
    const parsed = UpdateTaskStatusDto.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation error", details: parsed.error.flatten() }, 400);
    }
    const task = await updateTaskStatus(requiredParam(c, "taskId"), parsed.data, c.get("user").id);
    return c.json({ message: "Task status updated successfully", data: task });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function assignTaskHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const body: unknown = await c.req.json();
    const parsed = AssignTaskDto.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation error", details: parsed.error.flatten() }, 400);
    }
    const task = await assignTask(requiredParam(c, "taskId"), parsed.data, c.get("user").id);
    return c.json({ message: "Task assigned successfully", data: task });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function addDependencyHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const body: unknown = await c.req.json();
    const parsed = AddDependencyDto.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation error", details: parsed.error.flatten() }, 400);
    }
    const dependency = await addDependency(requiredParam(c, "taskId"), parsed.data, c.get("user").id);
    return c.json({ message: "Dependency added successfully", data: dependency }, 201);
  } catch (error) {
    return handleError(error, c);
  }
}

export async function removeDependencyHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    await removeDependency(
      requiredParam(c, "taskId"),
      requiredParam(c, "dependsOnTaskId"),
      c.get("user").id,
    );
    return c.json({ message: "Dependency removed successfully", data: null });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function getAttachmentsHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const attachments = await getAttachments(requiredParam(c, "taskId"));
    return c.json({ message: "Attachments retrieved successfully", data: attachments });
  } catch (error) {
    return handleError(error, c);
  }
}

export async function addAttachmentHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const body: unknown = await c.req.json();
    const parsed = AddAttachmentDto.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation error", details: parsed.error.flatten() }, 400);
    }
    // TODO: In production, validate ownership of uploaded files and store via S3/multipart.
    const attachment = await addAttachment(requiredParam(c, "taskId"), parsed.data, c.get("user").id);
    return c.json({ message: "Attachment added successfully", data: attachment }, 201);
  } catch (error) {
    return handleError(error, c);
  }
}
