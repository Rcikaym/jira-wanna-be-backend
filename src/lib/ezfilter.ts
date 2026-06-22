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

type NestedRecord = Record<string, unknown>;

type PrismaListModel = {
  findMany(args: never): Promise<unknown[]>;
  count(args: never): Promise<number>;
};

type ContainsFilter = { contains: string; mode: "insensitive" };
type WrappedValue = ContainsFilter | NestedRecord | unknown;

// Transforms dot-notation keys into nested objects and wraps array values
// with Prisma's { in: [...] } operator for OR filtering.
// e.g. "assignee.department" → { assignee: { department: ... } }
// e.g. { status: ["DONE", "BLOCKED"] } → { status: { in: ["DONE", "BLOCKED"] } }
function nestKeys(obj: Record<string, unknown>): NestedRecord {
  const result: NestedRecord = {};

  for (const [key, value] of Object.entries(obj)) {
    const transformedValue = Array.isArray(value) ? { in: value } : value;

    if (key.includes(".")) {
      const parts = key.split(".");
      let current: NestedRecord = result;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i] as string;
        if (!current[part] || typeof current[part] !== "object" || Array.isArray(current[part])) {
          current[part] = {};
        }
        current = current[part] as NestedRecord;
      }

      const lastPart = parts[parts.length - 1] as string;
      current[lastPart] = transformedValue;
    } else {
      result[key] = transformedValue;
    }
  }

  return result;
}

// Deep merges two plain objects. Arrays and primitives from source
// always overwrite target — only plain objects are merged recursively.
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const targetValue = target[key];
    const isPlainObject = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null && !Array.isArray(v);

    if (isPlainObject(value) && isPlainObject(targetValue)) {
      output[key] = deepMerge(targetValue, value);
    } else {
      output[key] = value;
    }
  }

  return output;
}

// Wraps string leaf values in Prisma's contains filter for case-insensitive
// partial matching. Non-string primitives and arrays pass through unchanged.
function wrapContains(obj: unknown): WrappedValue {
  if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
    const wrapped: NestedRecord = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      wrapped[k] = wrapContains(v);
    }
    return wrapped;
  }

  if (typeof obj === "string") {
    return { contains: obj, mode: "insensitive" } satisfies ContainsFilter;
  }

  return obj;
}

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

    return parsed.map((item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new AppError(400, "Invalid filter format");
      }
      const filter = item as Record<string, unknown>;
      if (typeof filter["key"] !== "string") {
        throw new AppError(400, "Invalid filter format");
      }
      return {
        key: filter["key"],
        start: filter["start"],
        end: filter["end"],
      };
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
  const nestedFilters = nestKeys(params.filters ?? {});

  const nestedSearchFilters = nestKeys(params.searchFilters ?? {});
  const finalSearchFilters = wrapContains(nestedSearchFilters) as NestedRecord;

  const ranged = params.rangedFilters?.map((filter) =>
    nestKeys({ [filter.key]: { gte: filter.start, lte: filter.end } }),
  );

  let where = deepMerge(baseWhere, nestedFilters);
  where = deepMerge(where, finalSearchFilters);

  if (ranged?.length) {
    where = deepMerge(where, { AND: ranged });
  }

  return where;
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