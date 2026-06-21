import type { Prisma } from "@prisma/client";
import { applyEzFilter, type EzFilterParams } from "../../lib/ezfilter";
import prisma from "../../lib/prisma";

export type AuditLogEntry = Prisma.AuditLogGetPayload<{
  include: {
    user: { select: { id: true; name: true; role: true; department: true } };
    task: { select: { id: true; title: true } };
  };
}>;

const auditLogInclude = {
  user: { select: { id: true, name: true, role: true, department: true } },
  task: { select: { id: true, title: true } },
} satisfies Prisma.AuditLogInclude;

export const auditRepository = {
  async findByProject(
    projectId: string,
    params: EzFilterParams,
  ): Promise<{ data: AuditLogEntry[]; total: number; page: number; rows: number }> {
    const baseWhere = {
      task: {
        projectId,
        deletedAt: null,
      },
    };
    const model = {
      findMany(args: never): Promise<unknown[]> {
        return prisma.auditLog.findMany({
          ...(args as Prisma.AuditLogFindManyArgs),
          include: auditLogInclude,
        });
      },
      count(args: never): Promise<number> {
        return prisma.auditLog.count(args as Prisma.AuditLogCountArgs);
      },
    };
    const result = await applyEzFilter(model, params, baseWhere);

    return {
      ...result,
      data: result.data as AuditLogEntry[],
    };
  },
};
