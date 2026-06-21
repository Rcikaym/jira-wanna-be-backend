/**
 * OPTIMISTIC LOCKING CONTRACT
 *
 * Every PATCH /tasks/:id and PATCH /tasks/:id/status request MUST include
 * the current `version` value of the task in the request body.
 *
 * The frontend is responsible for:
 *   1. Reading `version` from the GET /tasks/:id response
 *   2. Including it unchanged in the PATCH request body
 *
 * If the version does not match what is in the database, the API returns
 * HTTP 409 Conflict. The frontend must then re-fetch the task and prompt
 * the user to review the latest state before retrying their change.
 *
 * The `version` field is never exposed as an editable field in DTOs —
 * it is read-only from the client's perspective except as a concurrency token.
 */
import { Prisma, type Attachment, type Task, type TaskDependency, type TaskStatus } from "@prisma/client";
import prisma from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import {
  buildEzFilterOrderBy,
  buildEzFilterWhere,
  type EzFilterParams,
} from "../../lib/ezfilter";

export type FullTask = Prisma.TaskGetPayload<{
  include: {
    assignee: { select: { id: true; name: true; avatarUrl: true; department: true } };
    attachments: { select: { id: true; fileName: true; fileUrl: true } };
    project: { select: { id: true; name: true } };
  };
}>;

const fullTaskInclude = {
  assignee: { select: { id: true, name: true, avatarUrl: true, department: true } },
  attachments: {
    where: { deletedAt: null },
    select: { id: true, fileName: true, fileUrl: true },
  },
  project: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

async function updateWithOptimisticLock(
  taskId: string,
  expectedVersion: number,
  data: Prisma.TaskUpdateInput,
): Promise<Task> {
  return prisma.$transaction(async (tx) => {
    return updateWithOptimisticLockTx(tx, taskId, expectedVersion, data);
  });
}

async function updateWithOptimisticLockTx(
  tx: Prisma.TransactionClient,
  taskId: string,
  expectedVersion: number,
  data: Prisma.TaskUpdateInput,
): Promise<Task> {
  const current = await tx.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, version: true },
  });

  if (!current) throw new AppError(404, "Task not found");
  if (current.version !== expectedVersion) {
    throw new AppError(
      409,
      "Conflict: this task was modified by someone else. Refresh and try again.",
      "OPTIMISTIC_LOCK_CONFLICT",
    );
  }

  return tx.task.update({
    where: { id: taskId },
    data: { ...data, version: { increment: 1 } },
  });
}

export const taskRepository = {
  findProject(projectId: string): Promise<{ id: string } | null> {
    return prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
  },

  findInternalUser(userId: string): Promise<{ id: string } | null> {
    return prisma.user.findFirst({
      where: { id: userId, role: "INTERNAL", deletedAt: null },
      select: { id: true },
    });
  },

  create(data: {
    projectId: string;
    title: string;
    description?: string;
    assigneeId?: string;
    isClientVisible: boolean;
  }): Promise<Task> {
    return prisma.task.create({ data });
  },

  findById(taskId: string): Promise<FullTask | null> {
    return prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      include: fullTaskInclude,
    });
  },

  async findAll(
    params: EzFilterParams,
    baseWhere: Record<string, unknown>,
  ): Promise<{ data: FullTask[]; total: number; page: number; rows: number }> {
    const page = params.page ?? 1;
    const rows = params.rows ?? 10;
    const where = buildEzFilterWhere(baseWhere, params) as Prisma.TaskWhereInput;
    const [data, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: fullTaskInclude,
        skip: (page - 1) * rows,
        take: rows,
        ...(params.orderKey ? { orderBy: buildEzFilterOrderBy(params) } : {}),
      }),
      prisma.task.count({ where }),
    ]);

    return { data, total, page, rows };
  },

  updateFields(
    taskId: string,
    data: Partial<{
      title: string;
      description: string;
      assigneeId: string | null;
      isClientVisible: boolean;
    }>,
    expectedVersion: number,
  ): Promise<Task> {
    return updateWithOptimisticLock(taskId, expectedVersion, data);
  },

  updateStatus(
    taskId: string,
    status: TaskStatus,
    expectedVersion: number,
  ): Promise<Task> {
    return prisma.$transaction((tx) =>
      this.updateStatusTx(tx, taskId, status, expectedVersion),
    );
  },

  updateStatusTx(
    tx: Prisma.TransactionClient,
    taskId: string,
    status: TaskStatus,
    expectedVersion: number,
  ): Promise<Task> {
    return updateWithOptimisticLockTx(tx, taskId, expectedVersion, { status });
  },

  softDelete(taskId: string): Promise<Task> {
    return prisma.task.update({ where: { id: taskId }, data: { deletedAt: new Date() } });
  },

  async addDependency(taskId: string, dependsOnTaskId: string): Promise<TaskDependency> {
    if (dependsOnTaskId === taskId) {
      throw new AppError(400, "Task cannot depend on itself");
    }

    try {
      return await prisma.taskDependency.create({
        data: { taskId, dependsOnTaskId },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError(409, "Dependency already exists");
      }
      throw error;
    }
  },

  async removeDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
    await prisma.taskDependency.deleteMany({ where: { taskId, dependsOnTaskId } });
  },

  getDependencies(taskId: string): Promise<
    Array<{ dependsOnTask: { id: string; status: TaskStatus; title: string } }>
  > {
    return prisma.taskDependency.findMany({
      where: { taskId, dependsOnTask: { deletedAt: null } },
      select: { dependsOnTask: { select: { id: true, status: true, title: true } } },
    });
  },

  getDependents(
    taskId: string,
  ): Promise<Array<{ task: { id: string; status: TaskStatus; version: number } }>> {
    return prisma.taskDependency.findMany({
      where: { dependsOnTaskId: taskId, task: { deletedAt: null } },
      select: { task: { select: { id: true, status: true, version: true } } },
    });
  },

  addAttachment(data: {
    taskId: string;
    uploadedById: string;
    fileName: string;
    fileUrl: string;
  }): Promise<Attachment> {
    return prisma.attachment.create({ data });
  },

  getAttachments(taskId: string): Promise<Attachment[]> {
    return prisma.attachment.findMany({ where: { taskId, deletedAt: null } });
  },
};
