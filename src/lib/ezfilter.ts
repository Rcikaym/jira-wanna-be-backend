import type { Context } from "hono";
import { AppError } from "./errors";

export type EzFilterParams = {
  filters?: Record<string, unknown>;
  searchFilters?: Record<string, unknown>;
  rangedFilters?: Array<{ key: string; start: unknown; end: unknown }>;
  page?: number;
  rows?: number;
  orderKey?: string;
  orderRule?: "asc" | "desc";
};

type PrismaListModel = {
  findMany(args: never): Promise<unknown[]>;
  count(args: never): Promise<number>;
};

function parseJsonObject(value: string | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new AppError(400, "Invalid filter format");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "Invalid filter format");
  }
}

function parseRangedFilters(
  value: string | undefined,
): Array<{ key: string; start: unknown; end: unknown }> | undefined {
  if (!value) return undefined;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new AppError(400, "Invalid filter format");
    return parsed.map((item) => {
      if (!item || typeof item !== "object") throw new AppError(400, "Invalid filter format");
      const filter = item as { key?: unknown; start?: unknown; end?: unknown };
      if (typeof filter.key !== "string") throw new AppError(400, "Invalid filter format");
      return { key: filter.key, start: filter.start, end: filter.end };
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "Invalid filter format");
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildEzFilterWhere(
  baseWhere: Record<string, unknown>,
  params: EzFilterParams,
): Record<string, unknown> {
  const ranged = params.rangedFilters?.map((filter) => ({
    [filter.key]: { gte: filter.start, lte: filter.end },
  }));

  return {
    ...baseWhere,
    ...(params.filters ?? {}),
    ...(params.searchFilters ?? {}),
    ...(ranged?.length ? { AND: ranged } : {}),
  };
}

export function buildEzFilterOrderBy(
  params: EzFilterParams,
): Record<string, "asc" | "desc"> | undefined {
  if (!params.orderKey) return undefined;
  return { [params.orderKey]: params.orderRule ?? "asc" };
}

export function parseEzFilterParams(c: Context): EzFilterParams {
  const orderRule = c.req.query("orderRule");

  return {
    filters: parseJsonObject(c.req.query("filters")),
    searchFilters: parseJsonObject(c.req.query("searchFilters")),
    rangedFilters: parseRangedFilters(c.req.query("rangedFilters")),
    page: parsePositiveInt(c.req.query("page"), 1),
    rows: parsePositiveInt(c.req.query("rows"), 10),
    orderKey: c.req.query("orderKey"),
    orderRule: orderRule === "desc" ? "desc" : "asc",
  };
}

export async function applyEzFilter<T extends PrismaListModel>(
  model: T,
  params: EzFilterParams,
  baseWhere: Record<string, unknown>,
): Promise<{ data: unknown[]; total: number; page: number; rows: number }> {
  const page = params.page ?? 1;
  const rows = params.rows ?? 10;
  const where = buildEzFilterWhere(baseWhere, params);
  const args = {
    where,
    skip: (page - 1) * rows,
    take: rows,
    ...(params.orderKey ? { orderBy: buildEzFilterOrderBy(params) } : {}),
  };
  const [data, total] = await Promise.all([
    model.findMany(args as never),
    model.count({ where } as never),
  ]);

  return { data, total, page, rows };
}
