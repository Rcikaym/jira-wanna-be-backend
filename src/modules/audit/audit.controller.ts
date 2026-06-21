import type { Context } from "hono";
import { AppError } from "../../lib/errors";
import { parseEzFilterParams } from "../../lib/ezfilter";
import type { AppEnv } from "../../middleware/auth.middleware";
import { getAuditLog } from "./audit.service";

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

export async function getAuditLogHandler(c: Context<AppEnv>): Promise<Response> {
  try {
    const params = parseEzFilterParams(c);
    const result = await getAuditLog(
      requiredParam(c, "projectId"),
      params,
      c.get("user"),
    );

    return c.json({
      message: "Audit log retrieved successfully",
      data: result.data,
      meta: { total: result.total, page: result.page, rows: result.rows },
    });
  } catch (error) {
    return handleError(error, c);
  }
}
