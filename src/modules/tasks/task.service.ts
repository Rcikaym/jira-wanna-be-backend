import type { Department, Prisma, Role, TaskStatus } from "@prisma/client";
import { writeAuditLog } from "../../lib/audit";
import { AppError } from "../../lib/errors";
import type { EzFilterParams } from "../../lib/ezfilter";
import { maskTaskForClient, maskTaskListForClient } from "../../lib/mask";
import { canReadTask } from "../../lib/permissions";
import prisma from "../../lib/prisma";
import {
  taskRepository,
  type FullTask,
} from "./task.repository";
import type {
  AddAttachmentDtoType,
  AddDependencyDtoType,
  AssignTaskDtoType,
  CreateTaskDtoType,
  UpdateTaskFieldsDtoType,
  UpdateTaskStatusDtoType,
} from "./task.dto";

type UserContext = {
  id: string;
  role: Role;
  department: Department | null;
};

function toInternalTaskView(task: FullTask) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    isClientVisible: task.isClientVisible,
    assignee: task.assignee,
    project: task.project,
    attachments: task.attachments,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function createTask(
  projectId: string,
  dto: CreateTaskDtoType,
  userId: string,
) {
  const project = await taskRepository.findProject(projectId);
  if (!project) throw new AppError(404, "Project not found");

  if (dto.assigneeId) {
    const assignee = await taskRepository.findInternalUser(dto.assigneeId);
    if (!assignee) throw new AppError(400, "assigneeId must refer to an INTERNAL user");
  }

  const task = await taskRepository.create({ projectId, ...dto });
  await writeAuditLog({
    taskId: task.id,
    userId,
    changedField: "status",
    oldValue: null,
    newValue: task.status,
  });

  if (task.assigneeId) {
    await writeAuditLog({
      taskId: task.id,
      userId,
      changedField: "assigneeId",
      oldValue: null,
      newValue: task.assigneeId,
    });
  }

  return task;
}

export async function listTasks(
  projectId: string,
  params: EzFilterParams,
  user: UserContext,
) {
  const allowedOrderKeys = ["createdAt", "updatedAt", "title"];
  if (params.orderKey && !allowedOrderKeys.includes(params.orderKey)) {
    throw new AppError(400, `Invalid orderKey. Allowed values are: ${allowedOrderKeys.join(", ")}`);
  }

  const baseWhere =
    user.role === "PM"
      ? { projectId, deletedAt: null }
      : user.role === "INTERNAL"
        ? { projectId, deletedAt: null, assigneeId: user.id }
        : { projectId, deletedAt: null, isClientVisible: true };
  const result = await taskRepository.findAll(params, baseWhere);

  if (user.role === "CLIENT_GUEST") {
    return {
      ...result,
      data: maskTaskListForClient(result.data.map(toInternalTaskView)),
    };
  }

  return result;
}

export async function getTask(taskId: string, user: UserContext) {
  const task = await taskRepository.findById(taskId);
  if (!task) throw new AppError(404, "Task not found");
  if (!canReadTask(user, task)) throw new AppError(403, "Access denied");

  if (user.role === "INTERNAL" && task.assigneeId !== user.id) {
    throw new AppError(403, "Access denied");
  }

  if (user.role === "CLIENT_GUEST") {
    return maskTaskForClient(toInternalTaskView(task));
  }

  return task;
}

export async function updateTaskFields(
  taskId: string,
  dto: UpdateTaskFieldsDtoType,
  userId: string,
) {
  const current = await taskRepository.findById(taskId);
  if (!current) throw new AppError(404, "Task not found");

  if (dto.assigneeId) {
    const assignee = await taskRepository.findInternalUser(dto.assigneeId);
    if (!assignee) throw new AppError(400, "assigneeId must refer to an INTERNAL user");
  }

  const { version, ...fields } = dto;
  const updated = await taskRepository.updateFields(taskId, fields, version);
  await writeChangedFieldAudits(taskId, userId, current, fields);
  return updated;
}

export function assignTask(taskId: string, dto: AssignTaskDtoType, userId: string) {
  return assignTaskInternal(taskId, dto, userId);
}

async function assignTaskInternal(
  taskId: string,
  dto: AssignTaskDtoType,
  userId: string,
) {
  const current = await taskRepository.findById(taskId);
  if (!current) throw new AppError(404, "Task not found");
  if (dto.assigneeId) {
    const assignee = await taskRepository.findInternalUser(dto.assigneeId);
    if (!assignee) throw new AppError(400, "assigneeId must refer to an INTERNAL user");
  }

  const updated = await taskRepository.updateFields(
    taskId,
    { assigneeId: dto.assigneeId },
    current.version,
  );
  await writeAuditLog({
    taskId,
    userId,
    changedField: "assigneeId",
    oldValue: current.assigneeId,
    newValue: dto.assigneeId,
  });
  return updated;
}

async function writeChangedFieldAudits(
  taskId: string,
  userId: string,
  current: FullTask,
  fields: Partial<{
    title: string;
    description: string;
    assigneeId: string | null;
    isClientVisible: boolean;
  }>,
) {
  const entries = Object.entries(fields).filter(([key, value]) => {
    const field = key as keyof typeof fields;
    return current[field] !== value;
  });

  await Promise.all(
    entries.map(([changedField, newValue]) =>
      writeAuditLog({
        taskId,
        userId,
        changedField,
        oldValue: current[changedField as keyof FullTask],
        newValue,
      }),
    ),
  );
}

export async function updateTaskStatus(
  taskId: string,
  dto: UpdateTaskStatusDtoType,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!current) throw new AppError(404, "Task not found");

    const updated = await taskRepository.updateStatusTx(
      tx,
      taskId,
      dto.status,
      dto.version,
    );
    await writeAuditLog(
      {
        taskId,
        userId,
        changedField: "status",
        oldValue: current.status,
        newValue: dto.status,
      },
      tx,
    );

    await updateDependentTaskStatusesTx(tx, taskId, dto.status, userId);
    return updated;
  });
}

async function updateDependentTaskStatusesTx(
  tx: Prisma.TransactionClient,
  taskId: string,
  status: TaskStatus,
  userId: string,
) {
  const dependents = await tx.taskDependency.findMany({
    where: { dependsOnTaskId: taskId, task: { deletedAt: null } },
    select: { task: { select: { id: true, status: true } } },
  });

  for (const dependent of dependents) {
    if (status !== "DONE" && dependent.task.status === "IN_PROGRESS") {
      await tx.task.update({
        where: { id: dependent.task.id },
        data: { status: "BLOCKED", version: { increment: 1 } },
      });
      await writeStatusAuditTx(tx, dependent.task.id, userId, "IN_PROGRESS", "BLOCKED");
    }

    if (status === "DONE" && dependent.task.status === "BLOCKED") {
      const dependencies = await tx.taskDependency.findMany({
        where: {
          taskId: dependent.task.id,
          dependsOnTask: { deletedAt: null },
        },
        select: { dependsOnTask: { select: { status: true } } },
      });
      const allDone = dependencies.every(
        (item) => item.dependsOnTask.status === "DONE",
      );
      if (allDone) {
        await tx.task.update({
          where: { id: dependent.task.id },
          data: { status: "BACKLOG", version: { increment: 1 } },
        });
        await writeStatusAuditTx(tx, dependent.task.id, userId, "BLOCKED", "BACKLOG");
      }
    }
  }
}

async function writeStatusAuditTx(
  tx: Prisma.TransactionClient,
  taskId: string,
  userId: string,
  oldValue: TaskStatus,
  newValue: TaskStatus,
) {
  await writeAuditLog(
    { taskId, userId, changedField: "status", oldValue, newValue },
    tx,
  );
}

async function writeStatusAudit(
  taskId: string,
  userId: string,
  oldValue: TaskStatus,
  newValue: TaskStatus,
) {
  await writeAuditLog({ taskId, userId, changedField: "status", oldValue, newValue });
}

export async function deleteTask(taskId: string, userId: string) {
  const task = await taskRepository.findById(taskId);
  if (!task) throw new AppError(404, "Task not found");
  const deleted = await taskRepository.softDelete(taskId);
  await writeAuditLog({
    taskId,
    userId,
    changedField: "deletedAt",
    oldValue: null,
    newValue: deleted.deletedAt?.toISOString() ?? new Date().toISOString(),
  });
  return deleted;
}

export async function addDependency(
  taskId: string,
  dto: AddDependencyDtoType,
  userId: string,
) {
  const [task, prerequisite] = await Promise.all([
    taskRepository.findById(taskId),
    taskRepository.findById(dto.dependsOnTaskId),
  ]);
  if (!task || !prerequisite) throw new AppError(404, "Task not found");
  if (task.projectId !== prerequisite.projectId) {
    throw new AppError(400, "Tasks must belong to the same project");
  }

  await assertNoCircularDependency(taskId, dto.dependsOnTaskId, 0);
  const dependency = await taskRepository.addDependency(taskId, dto.dependsOnTaskId);

  if (task.status !== "DONE" && prerequisite.status !== "DONE") {
    await taskRepository.updateStatus(taskId, "BLOCKED", task.version);
    await writeStatusAudit(taskId, userId, task.status, "BLOCKED");
  }

  return dependency;
}

export async function getTaskDependencies(taskId: string, user: UserContext) {
  const task = await taskRepository.findById(taskId);
  if (!task) throw new AppError(404, "Task not found");
  if (!canReadTask(user, task)) throw new AppError(403, "Access denied");

  return taskRepository.getDependencies(taskId);
}

async function assertNoCircularDependency(
  taskId: string,
  dependsOnTaskId: string,
  depth: number,
): Promise<void> {
  if (depth >= 5) {
    throw new AppError(400, "Dependency chain too deep or circular dependency detected");
  }

  const dependencies = await taskRepository.getDependencies(dependsOnTaskId);
  for (const dependency of dependencies) {
    if (dependency.dependsOnTask.id === taskId) {
      throw new AppError(400, "Circular dependency detected");
    }
    await assertNoCircularDependency(taskId, dependency.dependsOnTask.id, depth + 1);
  }
}

export async function removeDependency(
  taskId: string,
  dependsOnTaskId: string,
  userId: string,
) {
  await taskRepository.removeDependency(taskId, dependsOnTaskId);
  const task = await taskRepository.findById(taskId);
  if (!task) throw new AppError(404, "Task not found");

  const dependencies = await taskRepository.getDependencies(taskId);
  const allDone = dependencies.every((item) => item.dependsOnTask.status === "DONE");
  if (task.status === "BLOCKED" && allDone) {
    await taskRepository.updateStatus(taskId, "BACKLOG", task.version);
    await writeStatusAudit(taskId, userId, "BLOCKED", "BACKLOG");
  }
}

export async function addAttachment(
  taskId: string,
  dto: AddAttachmentDtoType,
  userId: string,
) {
  const task = await taskRepository.findById(taskId);
  if (!task) throw new AppError(404, "Task not found");
  const attachment = await taskRepository.addAttachment({
    taskId,
    uploadedById: userId,
    fileName: dto.fileName,
    fileUrl: dto.fileUrl,
  });
  await writeAuditLog({
    taskId,
    userId,
    changedField: "attachment",
    oldValue: null,
    newValue: { fileName: dto.fileName, fileUrl: dto.fileUrl },
  });
  return attachment;
}

export function getAttachments(taskId: string) {
  return taskRepository.getAttachments(taskId);
}
