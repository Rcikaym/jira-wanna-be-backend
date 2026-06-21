import type { Prisma, Project } from "@prisma/client";
import prisma from "../../lib/prisma";
import { applyEzFilter, type EzFilterParams } from "../../lib/ezfilter";

export type ProjectWithClient = Prisma.ProjectGetPayload<{
  include: { client: { select: { id: true; name: true; email: true } } };
}>;

export const projectRepository = {
  findClientUser(clientId: string): Promise<{ id: string } | null> {
    return prisma.user.findFirst({
      where: { id: clientId, role: "CLIENT_GUEST", deletedAt: null },
      select: { id: true },
    });
  },

  create(data: { name: string; description?: string; clientId: string }): Promise<Project> {
    return prisma.project.create({ data });
  },

  findById(id: string): Promise<ProjectWithClient | null> {
    return prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: { client: { select: { id: true, name: true, email: true } } },
    });
  },

  async findAll(
    params: EzFilterParams,
    baseWhere: Record<string, unknown>,
  ): Promise<{ data: Project[]; total: number; page: number; rows: number }> {
    const result = await applyEzFilter(prisma.project, params, baseWhere);
    return {
      ...result,
      data: result.data as Project[],
    };
  },

  update(
    id: string,
    data: Partial<{ name: string; description: string }>,
  ): Promise<Project> {
    return prisma.project.update({ where: { id }, data });
  },

  softDelete(id: string): Promise<Project> {
    return prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  async getSummary(projectId: string): Promise<{
    total: number;
    done: number;
    blocked: number;
    inProgress: number;
    backlog: number;
  }> {
    const [total, done, blocked, inProgress, backlog] = await Promise.all([
      prisma.task.count({ where: { projectId, deletedAt: null } }),
      prisma.task.count({ where: { projectId, deletedAt: null, status: "DONE" } }),
      prisma.task.count({ where: { projectId, deletedAt: null, status: "BLOCKED" } }),
      prisma.task.count({ where: { projectId, deletedAt: null, status: "IN_PROGRESS" } }),
      prisma.task.count({ where: { projectId, deletedAt: null, status: "BACKLOG" } }),
    ]);

    return { total, done, blocked, inProgress, backlog };
  },
};
