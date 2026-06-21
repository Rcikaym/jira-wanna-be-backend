import type { Prisma, TaskStatus } from "@prisma/client";
import { AppError } from "../../lib/errors";
import {
  applyEzFilter,
  type EzFilterParams,
} from "../../lib/ezfilter";
import prisma from "../../lib/prisma";

export type ClientProject = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClientSummary = {
  projectId: string;
  projectName: string;
  total: number;
  percentComplete: number;
  byStatus: {
    DONE: number;
    IN_PROGRESS: number;
    BLOCKED: number;
    BACKLOG: number;
  };
};

export type ClientTask = {
  id: string;
  title: string;
  status: TaskStatus;
  project: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
};

type ClientTaskRow = ClientTask & {
  isClientVisible: boolean;
};

const clientProjectSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

const clientTaskSelect = {
  id: true,
  title: true,
  status: true,
  isClientVisible: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true } },
} satisfies Prisma.TaskSelect;

const allowedTaskFilterKeys = new Set(["id", "title", "status", "createdAt", "updatedAt"]);

function sanitizeTaskParams(params: EzFilterParams): EzFilterParams {
  return {
    ...params,
    filters: filterRecord(params.filters),
    searchFilters: filterRecord(params.searchFilters),
    rangedFilters: params.rangedFilters?.filter((filter) =>
      allowedTaskFilterKeys.has(filter.key),
    ),
    orderKey: params.orderKey && allowedTaskFilterKeys.has(params.orderKey)
      ? params.orderKey
      : undefined,
  };
}

function filterRecord(
  record: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!record) return undefined;

  return Object.fromEntries(
    Object.entries(record).filter(([key]) => allowedTaskFilterKeys.has(key)),
  );
}

function computePercentComplete(counts: ClientSummary["byStatus"]): number {
  const total = counts.DONE + counts.IN_PROGRESS + counts.BLOCKED + counts.BACKLOG;
  if (total === 0) return 0;
  return Math.round((counts.DONE / total) * 100);
}

function toClientTask(task: ClientTaskRow): ClientTask {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    project: task.project,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export const clientRepository = {
  findProjects(clientId: string): Promise<ClientProject[]> {
    return prisma.project.findMany({
      where: { clientId, deletedAt: null },
      select: clientProjectSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  findProjectById(projectId: string, clientId: string): Promise<ClientProject | null> {
    return prisma.project.findFirst({
      where: { id: projectId, clientId, deletedAt: null },
      select: clientProjectSelect,
    });
  },

  async getProjectSummary(
    projectId: string,
    clientId: string,
  ): Promise<ClientSummary> {
    const project = await this.findProjectById(projectId, clientId);
    if (!project) throw new AppError(404, "Project not found");

    const grouped = await prisma.task.groupBy({
      by: ["status"],
      where: { projectId, deletedAt: null },
      _count: { _all: true },
    });
    const byStatus = {
      DONE: 0,
      IN_PROGRESS: 0,
      BLOCKED: 0,
      BACKLOG: 0,
    };

    for (const group of grouped) {
      byStatus[group.status] = group._count._all;
    }

    return {
      projectId: project.id,
      projectName: project.name,
      total: byStatus.DONE + byStatus.IN_PROGRESS + byStatus.BLOCKED + byStatus.BACKLOG,
      percentComplete: computePercentComplete(byStatus),
      byStatus,
    };
  },

  async findClientVisibleTasks(
    projectId: string,
    clientId: string,
    params: EzFilterParams,
  ): Promise<{ data: ClientTask[]; total: number; page: number; rows: number }> {
    const project = await this.findProjectById(projectId, clientId);
    if (!project) throw new AppError(404, "Project not found");

    const model = {
      findMany(args: never): Promise<unknown[]> {
        return prisma.task.findMany({
          ...(args as Prisma.TaskFindManyArgs),
          select: clientTaskSelect,
        });
      },
      count(args: never): Promise<number> {
        return prisma.task.count(args as Prisma.TaskCountArgs);
      },
    };
    const result = await applyEzFilter(
      model,
      sanitizeTaskParams(params),
      { projectId, isClientVisible: true, deletedAt: null },
    );

    return {
      ...result,
      data: (result.data as ClientTaskRow[]).map(toClientTask),
    };
  },

  async findClientVisibleTaskById(
    taskId: string,
    projectId: string,
    clientId: string,
  ): Promise<ClientTask | null> {
    const project = await this.findProjectById(projectId, clientId);
    if (!project) throw new AppError(404, "Project not found");

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        projectId,
        isClientVisible: true,
        deletedAt: null,
      },
      select: clientTaskSelect,
    });

    return task ? toClientTask(task) : null;
  },
};
