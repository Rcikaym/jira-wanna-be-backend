import type { Department, Role, TaskStatus } from "@prisma/client";

type UserContext = {
  id: string;
  role: Role;
  department: Department | null;
};

export function isPM(user: UserContext): boolean {
  return user.role === "PM";
}

export function isInternal(user: UserContext): boolean {
  return user.role === "INTERNAL";
}

export function isClientGuest(user: UserContext): boolean {
  return user.role === "CLIENT_GUEST";
}

export function canReadTask(
  user: UserContext,
  task: { isClientVisible: boolean },
): boolean {
  if (isPM(user) || isInternal(user)) return true;
  return isClientGuest(user) && task.isClientVisible;
}

export function canSetStatus(
  user: UserContext,
  nextStatus: TaskStatus,
  context: {
    assigneeId: string | null;
    allDependenciesDone: boolean;
  },
): { allowed: boolean; reason?: string } {
  if (isClientGuest(user)) return deny("Clients cannot update task status");
  if (isPM(user)) return canPMSetStatus(nextStatus);
  return canInternalSetStatus(user, nextStatus, context);
}

function canPMSetStatus(
  nextStatus: TaskStatus,
): { allowed: boolean; reason?: string } {
  if (nextStatus === "DONE") return deny("PM cannot set task to DONE");
  return { allowed: true };
}

function canInternalSetStatus(
  user: UserContext,
  nextStatus: TaskStatus,
  context: { assigneeId: string | null; allDependenciesDone: boolean },
): { allowed: boolean; reason?: string } {
  if (nextStatus === "BLOCKED" || nextStatus === "BACKLOG") return deny("Internal users cannot set this status");
  if (nextStatus === "IN_PROGRESS" && !context.allDependenciesDone) return deny("Task dependencies are not done");
  if (nextStatus === "DONE" && context.assigneeId !== user.id) return deny("Only the assignee can set task to DONE");
  return { allowed: true };
}

function deny(reason: string): { allowed: false; reason: string } {
  return { allowed: false, reason };
}

export function canEditTaskFields(user: UserContext): boolean {
  return isPM(user);
}

export function canUploadAttachment(user: UserContext): boolean {
  return isInternal(user);
}

export function canManageDependencies(user: UserContext): boolean {
  return isPM(user);
}
